/* ════════════════════════════════════════════════════════════════════════════════════════════
   SNAPSHOT-METRICS — the Terminal's long memory.
   Once a day, compute the globally-meaningful AI-industry metrics from the shared `models` table
   and upsert one row into `sc_metrics_history`. This accumulates authoritative history 24/7 —
   regardless of whether anyone has the Terminal open — so the Terminal's charts can show real
   multi-day / multi-week trends, deltas, and all-time highs instead of an in-RAM window.

   The client (js/terminal.js → _lhFetchCloud) reads this table and merges it on top of its own
   per-session localStorage samples.

   Run locally:  node netlify/functions/snapshot-metrics.mjs --selftest
   Env vars:     SUPABASE_URL, SUPABASE_SERVICE_KEY   (same as db-maintenance / collect-events)
   One-time SQL: netlify/functions/sc_metrics_history_schema.sql
   ════════════════════════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
            'models?select=id,lab,rel,ret,phase,benchmarks&order=id.asc',
            { headers: { Range: `${from}-${from + PAGE - 1}` } }
        );
        if (!res.ok) throw new Error(`models select HTTP ${res.status}: ${await res.text()}`);
        const page = await res.json();
        rows.push(...page);
        if (page.length < PAGE) break;
    }
    return rows;
}

const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : null;

function computeMetrics(rows) {
    let models = 0, active = 0, topElo = 0, benchCeiling = 0;
    const labs = new Set();
    for (const m of rows) {
        if (!m) continue;
        models++;
        if (!m.ret) active++;                      // no retirement date → still shipping
        if (m.lab) labs.add(m.lab);
        const b = (m.benchmarks && typeof m.benchmarks === 'object') ? m.benchmarks : {};
        const elo = num(b.ELO) ?? num(b.elo);
        if (elo != null && elo > topElo) topElo = elo;
        const vals = [b.MMLU, b.HumanEval, b.MATH, b.GPQA].map(num).filter((v) => v != null);
        if (vals.length) {
            const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
            if (avg > benchCeiling) benchCeiling = avg;
        }
    }
    return {
        models,
        active_models: active,
        labs: labs.size,
        top_elo: topElo || null,
        bench_ceiling: benchCeiling ? +benchCeiling.toFixed(2) : null,
    };
}

// ─── HANDLER ──────────────────────────────────────────────────────────────────
export default async () => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error('[snapshot-metrics] ' + msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const rows = await fetchAllModels();
    const day = new Date().toISOString().slice(0, 10);
    const record = { day, ...computeMetrics(rows), captured_at: new Date().toISOString() };

    // Upsert by day so a re-run on the same date overwrites (idempotent).
    const res = await sbFetch('sc_metrics_history?on_conflict=day', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(record),
    });
    if (!res.ok) {
        const msg = `upsert HTTP ${res.status}: ${await res.text()}`;
        console.error('[snapshot-metrics] ' + msg);
        return new Response(JSON.stringify({ error: msg, record }), { status: 500 });
    }

    console.log('[snapshot-metrics] snapshot', JSON.stringify(record));
    return new Response(JSON.stringify({ ok: true, record }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
    });
};

// Daily at 05:15 UTC — offset from db-maintenance (30 */6) and update-ai-bans (0 */6).
export const config = { schedule: '15 5 * * *' };

// ─── SELFTEST (node netlify/functions/snapshot-metrics.mjs --selftest) ────────
if (process.argv.includes('--selftest')) {
    const sample = [
        { id: 'a', lab: 'openai', ret: null, benchmarks: { ELO: 1400, MMLU: 90, MATH: 80 } },
        { id: 'b', lab: 'anthropic', ret: null, benchmarks: { ELO: 1390, MMLU: 92 } },
        { id: 'c', lab: 'openai', ret: '2025-01-01', benchmarks: {} },
        { id: 'd', lab: 'google', ret: null, benchmarks: { elo: 1375 } },
    ];
    console.log(JSON.stringify(computeMetrics(sample), null, 2));
}
