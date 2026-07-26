// ════════════════════════════════════════════════════════════════
// VC FUNDING UPDATER — Netlify Scheduled Function
// Runs daily at 07:00 UTC. Keeps the Supabase `vc_funding` table (per-lab
// aggregate totals + valuations) populated, and AUTO-RAISES a lab's
// valuation when a fresh funding headline reports a bigger one.
//
// Design (accuracy-first — this feeds an accuracy-mandate site):
//   • BASELINE below is the curated floor, mirrored from js/vc_row.js FUNDING.
//     Every run writes it, so the table is never empty and never worse than
//     the human-reviewed code values.
//   • On top of that, it scans free venture RSS for valuation headlines and
//     only RAISES a lab's valuation when the mention is name-anchored, in $B,
//     and within a sane band (guards against misparses / misattribution).
//   • The client (js/api.js fetchVCFunding) MAX-merges table vs. code, so a
//     stale row can never mask a fresher curated valuation, and vice-versa.
//   Net: valuations are "raise-only" from either source — safe by construction.
//
// Required env vars (Netlify → Site settings → Environment):
//   SUPABASE_URL          — Supabase project URL
//   SUPABASE_SERVICE_KEY  — Service role key (NOT anon — needs write access)
//
// One-time setup: run netlify/functions/vc_funding_schema.sql in Supabase.
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Curated floor — keep roughly in sync with VCRow.FUNDING in js/vc_row.js.
// aliases: lowercased name fragments used to attribute a headline to a lab.
// Values are $ millions.
const BASELINE = {
    openai:     { total: 179000, valuation: 852000, rounds: 'YC → Microsoft $13B → SoftBank → $122B round at $852B', aliases: ['openai'] },
    anthropic:  { total: 83000,  valuation: 965000, rounds: 'Google → Amazon $8B → Series H $65B at $965B → IPO filed',  aliases: ['anthropic'] },
    xai:        { total: 32000,  valuation: 230000, rounds: 'Series E $20B at $230B → merged into SpaceX at $250B',      aliases: ['xai', 'x.ai'] },
    mistral:    { total: 3200,   valuation: 23200,  rounds: 'Series C €1.7B at €12B → in talks at ~€20B',              aliases: ['mistral'] },
    cohere:     { total: 1500,   valuation: 7000,   rounds: 'Series D $500M → 2026 raise at $7B',                        aliases: ['cohere'] },
    inflection: { total: 1525,   valuation: 4000,   rounds: 'Microsoft $1.3B → pivot to enterprise',                     aliases: ['inflection ai', 'inflection.ai'] },
    stability:  { total: 350,    valuation: 1200,   rounds: 'Series A $150M → 2024 recap',                               aliases: ['stability ai', 'stability.ai'] },
    adept:      { total: 415,    valuation: 1000,   rounds: 'Series B $350M → Amazon licensing deal',                     aliases: ['adept ai'] },
};

// Free venture RSS, via the rss2json proxy (same source the client uses for
// the vc_deals ticker). Server-side we still send a descriptive User-Agent —
// several feeds (and undici's default UA) otherwise get 403/406'd.
const FEEDS = [
    'https://techcrunch.com/category/venture/feed/',
    'https://venturebeat.com/category/business/feed/',
];

const UA = 'SingularityCity/1.0 (vc-funding refresh; +https://singularitycity.net)';

// The valuation figure must sit ADJACENT to a valuation cue, so we never grab a
// round-size figure by mistake ("raises $30B ... at $350B valuation" → $350B,
// not $30B). Two shapes: cue-then-figure ("valued at $250B") and figure-then-cue
// ("$350B valuation"). The `[^$€\d]` gap can't skip over another figure. Billions
// only — these labs are all valued in $B, so an "$X million" match is noise.
const VAL_AFTER = /(?:valued|valuation|worth|post-money|pre-money)[^$€\d]{0,12}[$€]\s*([\d.]+)\s*(?:b|bn|billion)\b/i;
const VAL_BEFORE = /[$€]\s*([\d.]+)\s*(?:b|bn|billion)\s+(?:(?:post|pre)-money\s+)?valuation\b/i;

function fetchJSON(url, timeoutMs = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal })
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
        .finally(() => clearTimeout(timer));
}

// Pull the billions figure out of a headline, if it reads as a valuation.
// Returns $millions or null. Euro figures are converted at a coarse 1.08.
export function extractValuationM(title) {
    const t = title || '';
    const m = VAL_AFTER.exec(t) || VAL_BEFORE.exec(t);
    if (!m) return null;
    const num = parseFloat(m[1]);
    if (!isFinite(num) || num <= 0) return null;
    const isEuro = /€/.test(t) && !/\$/.test(t);
    return Math.round(num * 1000 * (isEuro ? 1.08 : 1));
}

// Scan RSS items and return { labId: { valuation_m, source, source_url } } for
// any lab whose valuation a headline RAISES within the sane band.
export function detectRaises(items) {
    const out = {};
    for (const it of items) {
        const title = it.title || '';
        const lower = title.toLowerCase();
        const cand = extractValuationM(title);
        if (cand == null) continue;
        for (const [labId, def] of Object.entries(BASELINE)) {
            if (!def.aliases.some(a => lower.includes(a))) continue;
            const floor = def.valuation;
            // Monotonic + sanity band: only accept a raise, and reject > 4x
            // (almost certainly a market-size number or a misattribution).
            if (cand <= floor || cand > floor * 4) continue;
            if (!out[labId] || cand > out[labId].valuation_m) {
                out[labId] = { valuation_m: cand, source: it.source || 'RSS', source_url: it.url || null };
            }
        }
    }
    return out;
}

async function upsertLab(labId, row) {
    const body = { lab_id: labId, ...row, updated_at: new Date().toISOString() };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/vc_funding?on_conflict=lab_id`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        console.warn(`  ❌ upsert ${labId} failed: ${res.status} ${await res.text()}`);
        return false;
    }
    return true;
}

export default async (_req) => {
    console.log('💰 VC funding update starting…');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
        return new Response(JSON.stringify({ error: 'Missing Supabase config' }), { status: 500 });
    }

    // 1. Gather RSS items (best-effort — a dead feed just means no raises this run).
    const items = [];
    for (const url of FEEDS) {
        const d = await fetchJSON(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
        if (d && d.status === 'ok' && Array.isArray(d.items)) {
            const source = d.feed?.title || url;
            for (const it of d.items) items.push({ title: it.title, url: it.link, source });
        }
    }
    console.log(`💰 Scanned ${items.length} headlines from ${FEEDS.length} feeds`);

    // 2. Detect any valuation raises from the headlines.
    const raises = detectRaises(items);
    const raised = Object.keys(raises);
    if (raised.length) {
        raised.forEach(id => console.log(`  ↑ ${id}: $${(raises[id].valuation_m / 1000).toFixed(0)}B — ${raises[id].source}`));
    } else {
        console.log('  (no valuation raises detected this run — ratcheting against existing rows)');
    }

    // 3. Read the current rows FIRST so the ratchet holds ACROSS runs. A raise
    // detected last week must survive after its headline rotates out of the
    // RSS window — without this read, step 4 used to write the curated
    // baseline back over every previously detected raise.
    const existing = {};
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/vc_funding?select=lab_id,total_m,valuation_m,source,source_url`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (res.ok) for (const row of await res.json()) existing[row.lab_id] = row;
        else console.warn(`  ⚠ could not read existing rows (HTTP ${res.status}) — ratchet falls back to baseline-only this run`);
    } catch (e) {
        console.warn(`  ⚠ could not read existing rows (${e.message}) — ratchet falls back to baseline-only this run`);
    }

    // 4. Upsert every tracked lab: max(existing, curated floor, detected raise).
    let ok = 0, failed = 0;
    for (const [labId, def] of Object.entries(BASELINE)) {
        const bump = raises[labId];
        const prev = existing[labId];
        const candidates = [
            { v: def.valuation, source: 'curated (js/vc_row.js)', source_url: null },
            ...(prev && Number(prev.valuation_m) > 0 ? [{ v: Number(prev.valuation_m), source: prev.source, source_url: prev.source_url }] : []),
            ...(bump ? [{ v: bump.valuation_m, source: bump.source, source_url: bump.source_url }] : []),
        ];
        const winner = candidates.reduce((a, b) => (b.v > a.v ? b : a));
        const row = {
            total_m: Math.max(def.total, prev ? Number(prev.total_m) || 0 : 0),
            valuation_m: winner.v,
            rounds: def.rounds,
            source: winner.source,
            source_url: winner.source_url,
        };
        if (await upsertLab(labId, row)) ok++; else failed++;
    }

    console.log(`💰 VC funding update complete: ${ok}/${Object.keys(BASELINE).length} rows written, ${raised.length} raised, ${failed} failed`);
    // Fail loudly (same convention as collect-events): a red invocation in the
    // Netlify dashboard is how MAINTENANCE Part A notices a dead writer.
    return new Response(JSON.stringify({ success: failed === 0, written: ok, failed, raised }), {
        status: failed === 0 ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
    });
};

// ── Netlify scheduled function config ──
export const config = {
    schedule: '0 7 * * *'   // daily at 07:00 UTC
};
