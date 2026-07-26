// ════════════════════════════════════════════════════════════════════════════
// SUBMIT-DATA — the verify-then-write gate for everything the browser used to
// write straight into Supabase with the anon key.
//
// WHY: the publishable key is public by design, so "anon can INSERT/UPDATE"
// meant anyone with devtools could rename every model, inject fake citizens,
// or scramble building coordinates for every visitor. This function is now the
// ONLY write path for those tables (run rls_all.sql once to revoke the anon
// write policies): the client POSTs candidate rows here, each row is validated
// against a per-table column allowlist with shape/length caps, model rows
// additionally pass the shared verification engine, and only then does the
// service key write.
//
// Request:  POST { table: string, rows: object[], op?: 'upsert'|'insert'|'update' }
// Response: { ok, written, rejected: [{ index, reason }] }
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (same as collect-events).
// Run locally:  node netlify/functions/submit-data.mjs --selftest
// ════════════════════════════════════════════════════════════════════════════

import { buildRegistry, verifyModel, isHighConfidence, fetchTrustedNames } from './_shared/model-verify.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const MAX_ROWS_PER_REQUEST = 25;
const MAX_BODY_BYTES = 120_000;

// ─── FIELD VALIDATORS ────────────────────────────────────────────────────────
const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const optStr = (v, max) => v == null || (typeof v === 'string' && v.length <= max);
const isNum = (v, min, max) => typeof v === 'number' && isFinite(v) && v >= min && v <= max;
const optNum = (v, min, max) => v == null || isNum(v, min, max);
const optBool = (v) => v == null || typeof v === 'boolean';
const isHex = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);
const isDateish = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);
const optDateish = (v) => v == null || isDateish(v);
const isHttpUrl = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };
const optHttpUrl = (v, max = 500) => v == null || (typeof v === 'string' && v.length <= max && isHttpUrl(v));

const numericBenchmarks = (b) => {
    if (b == null) return true;
    if (typeof b !== 'object' || Array.isArray(b)) return false;
    const entries = Object.entries(b);
    if (entries.length > 20) return false;
    return entries.every(([k, v]) => isStr(k, 40) && typeof v === 'number' && isFinite(v));
};

// ─── PER-TABLE SPECS ─────────────────────────────────────────────────────────
// `check` returns null when the row is acceptable, else a reason string.
// `pick` lists the ONLY columns forwarded to Supabase — unknown keys are dropped.
const TABLES = {
    models: {
        conflict: 'id',
        pick: ['id', 'name', 'lab', 'rel', 'ret', 'phase', 'os', 'desc', 'per', 'tal', 'fav',
               'benchmarks', 'arch', 'ctx', 'cost_input', 'cost_out', 'region', 'params'],
        check(r) {
            if (!isStr(r.id, 120) || !isStr(r.name, 120) || !isStr(r.lab, 60)) return 'id/name/lab required (≤120 chars)';
            if (!optDateish(r.rel) || !optDateish(r.ret)) return 'rel/ret must be YYYY-MM-DD';
            if (!optStr(r.phase, 24) || !optStr(r.desc, 600) || !optStr(r.per, 60) || !optStr(r.tal, 60) || !optStr(r.fav, 60)) return 'string field too long';
            if (!optStr(r.arch, 60) || !optStr(r.region, 12) || !optStr(r.params, 40)) return 'string field too long';
            if (!optBool(r.os)) return 'os must be boolean';
            if (!optNum(r.ctx, 0, 1e9) || !optNum(r.cost_input, 0, 100000) || !optNum(r.cost_out, 0, 100000)) return 'numeric field out of range';
            if (!numericBenchmarks(r.benchmarks)) return 'benchmarks must be a small numeric map';
            return null;
        },
    },
    founders: {
        conflict: 'lab_id',
        ignoreDuplicates: true,
        pick: ['lab_id', 'name', 'role', 'color', 'fact'],
        check(r) {
            if (!isStr(r.lab_id, 60) || !isStr(r.name, 100)) return 'lab_id/name required';
            if (!optStr(r.role, 100) || !optStr(r.fact, 400)) return 'role/fact too long';
            if (r.color != null && !isHex(r.color)) return 'color must be hex';
            return null;
        },
    },
    families: {
        conflict: 'lab',
        pick: ['lab', 'edges'],
        check(r) {
            if (!isStr(r.lab, 60)) return 'lab required';
            if (!Array.isArray(r.edges) || r.edges.length > 200) return 'edges must be an array (≤200)';
            for (const e of r.edges) {
                if (!e || !isStr(e.id, 120)) return 'edge.id required';
                if (!Array.isArray(e.children) || e.children.length > 60 || !e.children.every(c => isStr(c, 120))) return 'edge.children invalid';
            }
            return null;
        },
    },
    ai_events: {
        insert: true,
        pick: ['name', 'date', 'desc', 'type'],
        check(r) {
            if (!isStr(r.name, 160) || !isDateish(r.date)) return 'name/date required';
            if (!optStr(r.desc, 400) || !optStr(r.type, 30)) return 'desc/type too long';
            return null;
        },
    },
    vc_deals: {
        insert: true,
        pick: ['headline', 'amount', 'round', 'url', 'source', 'pub_date'],
        check(r) {
            if (!isStr(r.headline, 300)) return 'headline required';
            if (!optStr(r.amount, 40) || !optStr(r.round, 60) || !optStr(r.source, 80)) return 'field too long';
            if (!optHttpUrl(r.url)) return 'url must be http(s)';
            if (r.pub_date != null && r.pub_date !== '' && !isDateish(r.pub_date)) return 'pub_date must be YYYY-MM-DD';
            if (r.pub_date === '') r.pub_date = null;
            return null;
        },
    },
    supply_chain: {
        insert: true,
        pick: ['category', 'title', 'detail', 'source_url'],
        check(r) {
            if (!isStr(r.title, 220) || !isStr(r.category, 40)) return 'title/category required';
            if (!optStr(r.detail, 200)) return 'detail too long';
            if (!optHttpUrl(r.source_url)) return 'source_url must be http(s)';
            return null;
        },
    },
    blds: {
        conflict: 'id',
        pick: ['id', 'name', 'w', 'x', 'fl', 'emoji', 'lab', 'desc'],
        check(r) {
            if (!isStr(r.id, 80) || !isStr(r.name, 120)) return 'id/name required';
            if (!isNum(r.w, 20, 2000) || !isNum(r.x, -100000, 2000000)) return 'w/x out of range';
            if (!optNum(r.fl, 1, 60)) return 'fl out of range';
            if (!optStr(r.emoji, 8) || !optStr(r.lab, 60) || !optStr(r.desc, 400)) return 'field too long';
            return null;
        },
    },
    dc_facilities: {
        conflict: 'id',
        pick: ['id', 'name', 'operator', 'location', 'type', 'status', 'gpus', 'power_mw',
               'cooling', 'process', 'products', 'investment', 'completion', 'description', 'width', 'color'],
        check(r) {
            if (!isStr(r.id, 80) || !isStr(r.name, 140)) return 'id/name required';
            if (!optStr(r.operator, 100) || !optStr(r.location, 120) || !optStr(r.type, 30) || !optStr(r.status, 30)) return 'field too long';
            if (!optStr(r.cooling, 80) || !optStr(r.process, 80) || !optStr(r.products, 160) || !optStr(r.investment, 80)) return 'field too long';
            if (!optStr(r.description, 600)) return 'description too long';
            if (!optNum(r.gpus, 0, 1e8) || !optNum(r.power_mw, 0, 100000) || !optNum(r.width, 40, 2000)) return 'numeric out of range';
            if (r.completion != null && !isNum(r.completion, 2000, 2100) && !isDateish(String(r.completion))) return 'completion invalid';
            if (r.color != null && !isHex(r.color)) return 'color must be hex';
            return null;
        },
    },
};

// models UPDATE op: price/context backfill only — nothing else is mutable via this route.
const MODEL_UPDATE_FIELDS = ['cost_input', 'cost_out', 'ctx'];

// ─── MODEL REGISTRY (cached across warm invocations; 3 upstream calls) ───────
let _registryCache = { ts: 0, registry: null };
const REGISTRY_TTL = 10 * 60 * 1000;

async function getRegistry() {
    if (_registryCache.registry && Date.now() - _registryCache.ts < REGISTRY_TTL) return _registryCache.registry;
    const { names, sources } = await fetchTrustedNames().catch(() => ({ names: [], sources: 0 }));
    // Even with zero live sources the static KNOWN_REAL floor + frontier forward
    // tolerance accepts plausible new flagships — a registry outage must not
    // block legitimate discovery (mirrors db-maintenance's skip-purge rail).
    const registry = buildRegistry(names);
    registry._sources = sources;
    _registryCache = { ts: Date.now(), registry };
    return registry;
}

// ─── SUPABASE (service role) ─────────────────────────────────────────────────
async function sbWrite(path, method, body, prefer) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: prefer,
        },
        body: JSON.stringify(body),
    });
}

// ─── VALIDATION CORE (exported for selftest) ─────────────────────────────────
export function validateRows(table, rows, op, registry) {
    const spec = TABLES[table];
    if (!spec) return { error: `unknown table: ${table}` };
    if (!Array.isArray(rows) || rows.length === 0) return { error: 'rows must be a non-empty array' };
    if (rows.length > MAX_ROWS_PER_REQUEST) return { error: `too many rows (max ${MAX_ROWS_PER_REQUEST})` };

    if (table === 'models' && op === 'update') {
        const accepted = [], rejected = [];
        rows.forEach((r, index) => {
            if (!isStr(r?.id, 120)) return rejected.push({ index, reason: 'id required' });
            const fields = {};
            for (const f of MODEL_UPDATE_FIELDS) if (r[f] != null) fields[f] = r[f];
            if (Object.keys(fields).length === 0) return rejected.push({ index, reason: 'no updatable fields' });
            if (!optNum(fields.cost_input, 0, 100000) || !optNum(fields.cost_out, 0, 100000) || !optNum(fields.ctx, 0, 1e9)) {
                return rejected.push({ index, reason: 'numeric field out of range' });
            }
            accepted.push({ id: r.id, fields });
        });
        return { accepted, rejected };
    }

    const accepted = [], rejected = [];
    rows.forEach((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return rejected.push({ index, reason: 'row must be an object' });
        const reason = spec.check(raw);
        if (reason) return rejected.push({ index, reason });
        if (table === 'models' && registry) {
            const v = verifyModel(raw, registry);
            // Reject only HIGH-CONFIDENCE failures — "not in registry" stays
            // acceptable so genuine discovery keeps working (db-maintenance
            // rescues or purges later with fresher registries).
            if (!v.ok && isHighConfidence(v.reason)) return rejected.push({ index, reason: v.reason });
        }
        const row = {};
        for (const col of spec.pick) if (raw[col] !== undefined) row[col] = raw[col];
        accepted.push(row);
    });
    return { accepted, rejected };
}

// ─── HANDLER ─────────────────────────────────────────────────────────────────
export default async (req) => {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 });
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing Supabase env vars' }), { status: 500 });
    }

    let payload;
    try {
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) return new Response(JSON.stringify({ ok: false, error: 'body too large' }), { status: 413 });
        payload = JSON.parse(text);
    } catch {
        return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), { status: 400 });
    }

    const { table, rows, op } = payload || {};
    const registry = table === 'models' ? await getRegistry() : null;
    const result = validateRows(table, rows, op, registry);
    if (result.error) return new Response(JSON.stringify({ ok: false, error: result.error }), { status: 400 });

    const { accepted, rejected } = result;
    let written = 0;

    if (accepted.length > 0) {
        const spec = TABLES[table];
        if (table === 'models' && op === 'update') {
            for (const u of accepted) {
                const res = await sbWrite(`models?id=eq.${encodeURIComponent(u.id)}`, 'PATCH', u.fields, 'return=minimal');
                if (res.ok) written++;
                else console.error(`[submit-data] models update ${u.id}: HTTP ${res.status} ${await res.text().catch(() => '')}`);
            }
        } else if (spec.insert) {
            const res = await sbWrite(table, 'POST', accepted, 'return=minimal');
            if (res.ok) written = accepted.length;
            else console.error(`[submit-data] ${table} insert: HTTP ${res.status} ${await res.text().catch(() => '')}`);
        } else {
            const dup = spec.ignoreDuplicates ? 'resolution=ignore-duplicates' : 'resolution=merge-duplicates';
            const res = await sbWrite(`${table}?on_conflict=${spec.conflict}`, 'POST', accepted, `${dup},return=minimal`);
            if (res.ok) written = accepted.length;
            else console.error(`[submit-data] ${table} upsert: HTTP ${res.status} ${await res.text().catch(() => '')}`);
        }
    }

    if (rejected.length) console.log(`[submit-data] ${table}: rejected ${rejected.length}/${rows.length} — ${rejected.slice(0, 3).map(r => r.reason).join(' · ')}`);
    return new Response(JSON.stringify({ ok: written > 0 || accepted.length === 0, written, rejected }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
};

// ─── SELFTEST (node netlify/functions/submit-data.mjs --selftest) ────────────
if (process.argv.includes('--selftest')) {
    const registry = buildRegistry(['Claude Opus 4.6', 'GLM 5']);
    const cases = [
        // [table, rows, op, expectAccepted, expectRejected]
        ['models', [{ id: 'm1', name: 'Claude Opus 4.6', lab: 'anthropic', benchmarks: { MMLU: 90 } }], undefined, 1, 0],
        ['models', [{ id: 'm2', name: 'GPT-9', lab: 'openai' }], undefined, 0, 1],                       // version cap
        ['models', [{ id: 'm3', name: 'Nova X (rumored)', lab: 'amazon' }], undefined, 0, 1],            // hallucination marker
        ['models', [{ id: 'm4', name: 'x'.repeat(200), lab: 'openai' }], undefined, 0, 1],               // length cap
        ['models', [{ id: 'm5', name: 'Mystery Model', lab: 'nobody' }], undefined, 1, 0],               // unknown ≠ high-confidence
        ['models', [{ id: 'm1', cost_input: 3, ctx: 200000 }], 'update', 1, 0],
        ['models', [{ id: 'm1', name: 'sneaky rename' }], 'update', 0, 1],                                // update can't rename
        ['founders', [{ lab_id: 'openai', name: 'Sam Altman', color: '#ff0000' }], undefined, 1, 0],
        ['founders', [{ lab_id: 'openai', name: 'Evil', color: 'red" onmouseover="x' }], undefined, 0, 1],
        ['blds', [{ id: 'bld_x', name: 'X HQ', w: 160, x: 4000, fl: 3 }], undefined, 1, 0],
        ['blds', [{ id: 'bld_x', name: 'X HQ', w: 160, x: 99e9 }], undefined, 0, 1],                      // coordinate vandalism
        ['vc_deals', [{ headline: 'Lab raises $1B', url: 'javascript:alert(1)' }], undefined, 0, 1],       // js: URL
        ['vc_deals', [{ headline: 'Lab raises $1B', url: 'https://example.com/a' }], undefined, 1, 0],
        ['ai_events', [{ name: 'NeurIPS 2026', date: '2026-12-08' }], undefined, 1, 0],
        ['nonsense', [{}], undefined, null, null],                                                         // unknown table → error
    ];
    let pass = 0, fail = 0;
    for (const [table, rows, op, expA, expR] of cases) {
        const r = validateRows(table, rows, op, registry);
        const ok = expA === null ? Boolean(r.error) : (r.accepted?.length === expA && r.rejected?.length === expR);
        if (ok) pass++;
        else { fail++; console.error(`FAIL: ${table} ${JSON.stringify(rows[0]).slice(0, 60)} → ${JSON.stringify(r).slice(0, 120)}`); }
    }
    console.log(`selftest: ${pass} pass, ${fail} fail`);
    process.exit(fail ? 1 : 0);
}
