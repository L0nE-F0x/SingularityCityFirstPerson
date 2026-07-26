// ════════════════════════════════════════════════════════════════════════════
// DB MAINTENANCE — Netlify Scheduled Function (every 6h, offset from update-ai-bans).
//
// Owns ALL destructive writes on the `models` table. Until v484 every visitor's
// browser ran purge/dedupe with the anon key, which meant the publishable key
// needed DELETE rights on `models` — i.e. anyone could wipe the table from the
// devtools console. Now the browser only filters its LOCAL display list
// (js/api.js purgeHallucinations/dedupeModels) and this function, running with
// the service key, is the single writer that actually deletes rows. Apply
// sc_models_rls.sql once in the Supabase SQL editor to revoke anon DELETE.
//
// Two passes, mirroring js/api.js (keep the two in sync when tuning):
//   1. PURGE — delete rows that fail HIGH-CONFIDENCE hallucination checks
//      (future/ancient release dates, impossible benchmarks/pricing, version
//      numbers past the known family ceiling, hallucination-marker phrases,
//      known fake name patterns). "Not in registry" is NOT high confidence and
//      never deletes — a future registry update can still rescue those rows.
//   2. DEDUPE — collapse rows that are the same real-world model written under
//      different IDs by different sources; merge data into the best row, delete
//      the rest.
//
// Version ceilings are FLOORS that auto-raise from live trusted sources
// (HuggingFace / ZeroEval / OpenRouter) fetched fresh every run — never frozen
// caps (see project memory: frozen caps made new flagships vanish). Closed
// frontier families additionally get bounded forward tolerance because
// aggregators lag their launches.
//
// Safety rails: purge aborts unless at least one trusted registry loaded, and
// deletions are capped per run so a bad upstream day can't nuke the table.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (same as collect-events).
// Run locally:  node netlify/functions/db-maintenance.mjs --selftest
// ════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const MAX_PURGE_PER_RUN = 80;   // sanity cap — a registry outage must not cascade into mass deletion
const MAX_DEDUPE_PER_RUN = 80;

// Verification engine lives in _shared/model-verify.mjs (single authoritative
// copy, also used by submit-data.mjs — the verify-then-write gate for client
// submissions). Tune ceilings/registry THERE, not here.
import {
    buildRegistry,
    verifyModel,
    isHighConfidence,
    fuzzyNorm,
    fetchTrustedNames,
} from './_shared/model-verify.mjs';

// ─── SUPABASE REST (service role bypasses RLS) ────────────────────────────────
async function sbFetch(path, opts = {}) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            ...(opts.headers || {}),
        },
    });
}

async function fetchAllModels() {
    const rows = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
        const res = await sbFetch(
            'models?select=id,name,lab,rel,ret,phase,ctx,benchmarks,cost_input,cost_out&order=id.asc',
            { headers: { Range: `${from}-${from + PAGE - 1}` } }
        );
        if (!res.ok) throw new Error(`models select HTTP ${res.status}: ${await res.text()}`);
        const page = await res.json();
        rows.push(...page);
        if (page.length < PAGE) break;
    }
    return rows;
}

// PostgREST in.() list — quote every id, escape embedded quotes.
const quoteIds = (ids) => ids.map(id => `"${String(id).replace(/"/g, '\\"')}"`).join(',');

async function deleteModels(ids) {
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        // return=representation so the summary reports rows ACTUALLY deleted,
        // not just batch sizes (a partial match used to overcount).
        const res = await sbFetch(`models?id=in.(${encodeURIComponent(quoteIds(batch))})`, {
            method: 'DELETE', headers: { Prefer: 'return=representation' },
        });
        if (!res.ok) console.error(`[delete] batch HTTP ${res.status}: ${await res.text()}`);
        else {
            const gone = await res.json().catch(() => null);
            deleted += Array.isArray(gone) ? gone.length : batch.length;
        }
    }
    return deleted;
}

async function patchModel(id, fields) {
    const res = await sbFetch(`models?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(fields),
    });
    if (!res.ok) console.error(`[patch] ${id} HTTP ${res.status}: ${await res.text()}`);
}

// ─── PASS 1: PURGE ────────────────────────────────────────────────────────────
async function purgePass(rows, registry) {
    const toDelete = [];
    for (const m of rows) {
        const r = verifyModel(m, registry);
        if (!r.ok && isHighConfidence(r.reason)) {
            toDelete.push({ id: m.id, name: m.name, reason: r.reason });
        }
    }
    let capped = toDelete;
    if (toDelete.length > MAX_PURGE_PER_RUN) {
        console.warn(`[purge] ${toDelete.length} candidates exceeds cap ${MAX_PURGE_PER_RUN} — truncating (rest next run)`);
        capped = toDelete.slice(0, MAX_PURGE_PER_RUN);
    }
    for (const d of capped) console.log(`[purge] ${d.id} (${d.name}) — ${d.reason}`);
    const deletedIds = capped.map(d => d.id);
    const deleted = deletedIds.length ? await deleteModels(deletedIds) : 0;
    return { candidates: toDelete.length, deleted, deletedIds };
}

// ─── PASS 2: DEDUPE (mirrors js/api.js dedupeModels scoring/merging) ──────────
function scoreModel(m) {
    let s = 1;
    if (m.phase === 'released') s += 10;
    else if (m.phase === 'rumored' || m.phase === 'baby' || m.phase === 'kid') s -= 2;
    if (!m.ret) s += 3;
    if (m.benchmarks && Object.keys(m.benchmarks).length > 0) s += 3;
    if (m.cost_input != null && m.cost_out != null && (m.cost_input > 0 || m.cost_out > 0)) s += 2;
    if (m.ctx) s += 1;
    if (m.rel) s += 1;
    return s;
}

async function dedupePass(rows, purgedIds) {
    const alive = rows.filter(m => !purgedIds.has(m.id));
    const groups = new Map();
    for (const m of alive) {
        const key = fuzzyNorm(m.name);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(m);
    }

    const toRemove = [];
    let merged = 0;
    for (const [, group] of groups) {
        if (group.length < 2) continue;
        group.sort((a, b) => scoreModel(b) - scoreModel(a));
        const winner = group[0];
        const patch = {};
        for (const loser of group.slice(1)) {
            if (!winner.rel && loser.rel) { winner.rel = loser.rel; patch.rel = loser.rel; }
            if (!winner.ctx && loser.ctx) { winner.ctx = loser.ctx; patch.ctx = loser.ctx; }
            if ((winner.cost_input == null || winner.cost_input === 0) && loser.cost_input) {
                winner.cost_input = loser.cost_input; winner.cost_out = loser.cost_out;
                patch.cost_input = loser.cost_input; patch.cost_out = loser.cost_out;
            }
            if (loser.benchmarks) {
                const bm = { ...(winner.benchmarks || {}) };
                let changed = false;
                for (const [k, v] of Object.entries(loser.benchmarks)) {
                    if (!bm[k] || v > bm[k]) { bm[k] = v; changed = true; }
                }
                if (changed) { winner.benchmarks = bm; patch.benchmarks = bm; }
            }
            toRemove.push(loser.id);
            merged++;
            if (toRemove.length >= MAX_DEDUPE_PER_RUN) break;
        }
        if (Object.keys(patch).length > 0) await patchModel(winner.id, patch);
        if (toRemove.length >= MAX_DEDUPE_PER_RUN) {
            console.warn(`[dedupe] hit cap ${MAX_DEDUPE_PER_RUN} — rest next run`);
            break;
        }
    }

    const deleted = toRemove.length ? await deleteModels(toRemove) : 0;
    return { merged, deleted };
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export default async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error('[db-maintenance] ' + msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const { names, sources } = await fetchTrustedNames();
    const rows = await fetchAllModels();
    console.log(`[db-maintenance] ${rows.length} rows, ${names.length} trusted names from ${sources}/3 sources`);

    // No registry → version-cap floors would be stale and false positives possible.
    // Dedupe is registry-independent, so it still runs.
    let purge = { candidates: 0, deleted: 0, deletedIds: [], skipped: false };
    if (sources === 0) {
        console.warn('[db-maintenance] all registry sources failed — skipping purge pass');
        purge.skipped = true;
    } else {
        const registry = buildRegistry(names);
        purge = { ...(await purgePass(rows, registry)), skipped: false };
    }

    const dedupe = await dedupePass(rows, new Set(purge.deletedIds));

    const summary = {
        rows: rows.length, registrySources: sources,
        purge: { candidates: purge.candidates, deleted: purge.deleted, skipped: purge.skipped },
        dedupe,
    };
    console.log('[db-maintenance] done', JSON.stringify(summary));
    return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// Offset 30min from update-ai-bans (0 */6) so the two never contend.
export const config = { schedule: '30 */6 * * *' };

// ─── SELFTEST (node netlify/functions/db-maintenance.mjs --selftest) ──────────
if (process.argv.includes('--selftest')) {
    const registry = buildRegistry(['GLM 5', 'Qwen3.5 Max', 'Claude Opus 4.6']);
    const cases = [
        [{ name: 'GPT-9', lab: 'openai' }, false],                                   // absurd version jump
        [{ name: 'Claude Opus 5.5', lab: 'anthropic' }, true],                        // within frontier tolerance (4.6+1)
        [{ name: 'Claude Opus 7', lab: 'anthropic' }, false],                         // beyond tolerance
        [{ name: 'Aya 23', lab: 'cohere' }, true],                                    // registry protects name-suffix number
        [{ name: 'Gemini 2.0 Flash (Rumored)', lab: 'google' }, false],               // hallucination marker
        [{ name: 'Llama 4 Scout', lab: 'meta', rel: '2030-01-01' }, false],           // future date
        [{ name: 'DeepSeek V3.2', lab: 'deepseek', benchmarks: { MMLU: 88 } }, true], // normal
        [{ name: 'Mystery Model X', lab: 'nobody' }, true],                           // unknown ≠ high confidence... (ok:false but NOT deleted)
    ];
    let pass = 0, fail = 0;
    for (const [m, expectOk] of cases) {
        const r = verifyModel(m, registry);
        const deletable = !r.ok && isHighConfidence(r.reason);
        const effectiveOk = !deletable; // what matters: would we delete it?
        if (effectiveOk === expectOk) { pass++; }
        else { fail++; console.error(`FAIL: ${m.name} → ${JSON.stringify(r)} (expected deletable=${!expectOk})`); }
    }
    console.log(`selftest: ${pass} pass, ${fail} fail`);
    process.exit(fail ? 1 : 0);
}
