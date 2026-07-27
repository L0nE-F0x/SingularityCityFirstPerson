/* ══════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (D) — Bloomberg-style data terminal over the city.

   A DOM/CSS overlay, so it can afford to be rich: 13 live panels on a 12-col
   grid, inline-SVG sparklines / donuts / radar / gauges, a sortable labs
   table, a 6×6 embassy relations matrix, a fused "tape" ticker, a command
   palette and a persisted watchlist.

   Everything is driven by static `data.js` + the live `CityStore` snapshot.
   `data.js` is being extended concurrently, so every read here is defensive:
   missing exports degrade to an empty panel, never a throw.

   Keybinding behaviour is unchanged from the thin version:
     Ctrl/Cmd+D · backtick · plain D while the pointer is unlocked → toggle
     Escape → close
   ══════════════════════════════════════════════════════════════════════════ */
import { G, clockString } from './state.js';
import {
    LABS, SEED, ROSTER, BLDS, NEWS, CONFERENCES, activeConference,
    DC_FACILITIES, COMPUTE_DATA, SUPPLY_CHAIN, COSTS, CTX, TRAM_LINES,
    LONGEVITY_COMPANIES, ROBOTICS_COMPANIES, SPACE_ORGS, DISTRICTS, AI_EVENTS
} from './data.js';
import { kardashevScale } from './kardashev.js';
import { CityStore } from './store/city_store.js';

/* ── defensive accessors ───────────────────────────────────────────────────
   Another agent is adding to data.js while this ships. Anything that might
   not exist yet goes through one of these. */
const arr = v => (Array.isArray(v) ? v : []);
const obj = v => (v && typeof v === 'object' ? v : {});
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

const LABS_ = () => obj(LABS);
const SEED_ = () => arr(SEED);
const ROSTER_ = () => arr(ROSTER);
const BLDS_ = () => arr(BLDS);
const DCF_ = () => arr(DC_FACILITIES);
const SUPPLY_ = () => obj(SUPPLY_CHAIN);
const COMPUTE_ = () => obj(COMPUTE_DATA);

// ── tiny deterministic helpers ────────────────────────────────────────────
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
        h ^= String(str).charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** Deterministic estimated benchmarks for roster models (mirrors ui.js). */
export function estBenchmarks(name) {
    let h = 0;
    for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
    const r = n => 55 + ((h >> n) & 31) + ((h >> (n + 3)) % 9);
    return { MMLU: r(0), HumanEval: r(5), MATH: r(9) - 8, GPQA: r(13) - 12, ELO: 1050 + (h % 260) };
}
function benchOf(m) {
    const b = obj(m && m.benchmarks);
    return Object.keys(b).length ? b : estBenchmarks((m && m.name) || 'model');
}
function avg4(b) {
    const v = [b.MMLU, b.HumanEval, b.MATH, b.GPQA].filter(x => typeof x === 'number');
    return v.length ? v.reduce((a, c) => a + c, 0) / v.length : 0;
}
/** Smooth deterministic drift so "live" readouts move without being random. */
function wave(seed, periodS, amp, t) {
    const p = (hash(seed) % 1000) / 1000;
    return Math.sin((t / periodS + p) * Math.PI * 2) * amp;
}
const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const hex = n => '#' + (typeof n === 'number' ? (n >>> 0).toString(16).padStart(6, '0') : '8a8aa0');
const fmt = n => (Math.abs(n) >= 1e9 ? (n / 1e9).toFixed(1) + 'B'
    : Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
    : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + 'k'
    : String(Math.round(n)));

/* ══════════════════════════════════════════════════════════════════════════
   SVG CHART PRIMITIVES — every helper returns a string ready for innerHTML.
   No canvas allocation, no DPR handling, no disposal: the overlay is torn
   down with a single innerHTML = ''.
   ══════════════════════════════════════════════════════════════════════════ */

export function svgSpark(vals, opts = {}) {
    const w = opts.w || 120, h = opts.h || 30;
    const color = opts.color || '#22d3ee';
    const v = arr(vals).filter(x => typeof x === 'number' && isFinite(x));
    if (v.length < 2) {
        return `<svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="#243044" stroke-dasharray="2 3"/></svg>`;
    }
    const min = Math.min(...v), max = Math.max(...v);
    const range = (max - min) || Math.abs(max) || 1;
    const stepX = w / (v.length - 1);
    const y = x => h - ((x - min) / range) * (h - 6) - 3;
    const pts = v.map((x, i) => `${(i * stepX).toFixed(1)},${y(x).toFixed(1)}`).join(' ');
    const lastX = (v.length - 1) * stepX, lastY = y(v[v.length - 1]);
    return `<svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        ${opts.fill === false ? '' : `<polygon points="0,${h} ${pts} ${w},${h}" fill="${color}" opacity="0.13"/>`}
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linejoin="round"/>
        <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2" fill="${color}"/>
    </svg>`;
}

export function svgDonut(segments, opts = {}) {
    const segs = arr(segments).filter(s => num(s.value) > 0);
    const size = opts.size || 84, thick = opts.thick || 12;
    const cx = size / 2, cy = size / 2, r = (size - thick) / 2 - 1;
    const c = 2 * Math.PI * r;
    const total = segs.reduce((s, x) => s + num(x.value), 0);
    if (!total) return `<svg width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1b2436" stroke-width="${thick}"/></svg>`;
    let off = 0;
    const parts = segs.map(s => {
        const dash = (num(s.value) / total) * c;
        const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color || '#22d3ee'}"
            stroke-width="${thick}" stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
            stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(s.label || '')}</title></circle>`;
        off += dash;
        return el;
    }).join('');
    const center = opts.center
        ? `<text x="${cx}" y="${cy - 1}" text-anchor="middle" class="tm-donut-c">${esc(opts.center)}</text>
           <text x="${cx}" y="${cy + 11}" text-anchor="middle" class="tm-donut-s">${esc(opts.centerSub || '')}</text>`
        : '';
    return `<svg class="tm-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#141c2b" stroke-width="${thick}"/>${parts}${center}</svg>`;
}

export function svgRadar(values, opts = {}) {
    const v = arr(values);
    const size = opts.size || 160, pad = opts.pad || 22;
    const cx = size / 2, cy = size / 2, r = size / 2 - pad;
    const n = v.length || 1;
    if (n < 3) return '<div class="tm-empty">insufficient axes</div>';
    const ring = [], axis = [], data = [];
    for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        axis.push({ x: cx + ca * r, y: cy + sa * r, lx: cx + ca * (r + 12), ly: cy + sa * (r + 12), label: v[i].label });
        for (let k = 1; k <= 4; k++) (ring[k - 1] = ring[k - 1] || []).push(`${(cx + ca * r * k / 4).toFixed(1)},${(cy + sa * r * k / 4).toFixed(1)}`);
        const val = Math.max(0.02, Math.min(1, num(v[i].value)));
        data.push({ x: cx + ca * r * val, y: cy + sa * r * val });
    }
    const rings = ring.map((p, i) => `<polygon points="${p.join(' ')}" fill="none" stroke="rgba(148,163,184,${(0.08 + i * 0.03).toFixed(2)})" stroke-width="0.8"/>`).join('');
    const axes = axis.map(p => `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(148,163,184,0.18)" stroke-width="0.8"/>`).join('');
    const labels = axis.map(p => `<text x="${p.lx.toFixed(1)}" y="${p.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="tm-radar-lbl">${esc(p.label)}</text>`).join('');
    const poly = `<polygon points="${data.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}" fill="rgba(34,211,238,0.20)" stroke="#22d3ee" stroke-width="1.4"/>`;
    const dots = data.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2" fill="#22d3ee"/>`).join('');
    return `<svg class="tm-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${rings}${axes}${poly}${dots}${labels}</svg>`;
}

export function svgGauge(value, opts = {}) {
    const w = opts.w || 118, h = opts.h || 66;
    const cx = w / 2, cy = h - 8, r = Math.min(w / 2 - 6, h - 16);
    const val = Math.max(0, Math.min(1, num(value)));
    const a0 = Math.PI, a1 = Math.PI + Math.PI * val;
    const p = a => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    const color = opts.color || (val > 0.85 ? '#ef4444' : val > 0.65 ? '#fbbf24' : '#4ade80');
    return `<svg class="tm-gauge" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <path d="M ${p(Math.PI)} A ${r} ${r} 0 0 1 ${p(2 * Math.PI)}" fill="none" stroke="#182131" stroke-width="8" stroke-linecap="round"/>
        <path d="M ${p(a0)} A ${r} ${r} 0 ${val > 0.5 ? 1 : 0} 1 ${p(a1)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
        <text x="${cx}" y="${cy - 6}" text-anchor="middle" class="tm-gauge-v">${esc(opts.label != null ? opts.label : Math.round(val * 100) + '%')}</text>
    </svg>`;
}

function bars(rows) {
    return arr(rows).map(r => `<div class="tm-bar-row" title="${esc(r.title || r.label)}">
        <span class="tm-bar-l">${esc(r.label)}</span>
        <span class="tm-bar-t"><i style="width:${Math.max(2, Math.min(100, num(r.pct)))}%;background:${r.color || '#22d3ee'}"></i></span>
        <span class="tm-bar-v">${esc(r.value)}</span></div>`).join('');
}

/* ══════════════════════════════════════════════════════════════════════════
   DERIVED MODEL — pure functions over data.js + CityStore.
   ══════════════════════════════════════════════════════════════════════════ */

/** All models the city knows about, seeded + roster, normalised. */
export function allModels() {
    const out = SEED_().map(m => ({
        id: m.id, name: m.name, lab: m.lab, phase: m.phase, os: !!m.os,
        seeded: true, benchmarks: benchOf(m), desc: m.desc, rel: m.rel
    }));
    ROSTER_().forEach((r, i) => out.push({
        id: 'roster_' + i + '_' + String(r.name).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: r.name, lab: r.lab, phase: 'released', os: !!r.os,
        seeded: false, benchmarks: estBenchmarks(r.name)
    }));
    return out;
}

/** One row per lab for the sortable AI LABS table. */
export function labRows() {
    const models = allModels();
    const rows = [];
    for (const [id, lab] of Object.entries(LABS_())) {
        const mine = models.filter(m => m.lab === id);
        if (!mine.length) continue;
        let sum = 0, n = 0, topElo = null, flagship = null;
        for (const m of mine) {
            const b = m.benchmarks;
            const a = avg4(b);
            if (a) { sum += a; n++; }
            if (typeof b.ELO === 'number' && (topElo === null || b.ELO > topElo)) { topElo = b.ELO; flagship = m.name; }
        }
        rows.push({
            id, name: lab.name || id, color: lab.color || '#94a3b8',
            icon: lab.icon || '•', ticker: lab.ticker || null,
            region: String(lab.region || '?').toUpperCase(),
            models: mine.length,
            os: mine.filter(m => m.os).length,
            score: n ? sum / n : null,
            flagship, elo: topElo
        });
    }
    const best = rows.reduce((a, r) => (r.elo != null && (!a || r.elo > a.elo) ? r : a), null);
    if (best) best.apex = true;
    return rows;
}

/** Operational MW + a per-operator breakdown of the compute build-out. */
export function computeInfra() {
    const dcs = DCF_().filter(d => d && d.type !== 'chipfab');
    const live = dcs.filter(d => d.status === 'operational');
    const build = dcs.filter(d => d.status !== 'operational');
    const byOp = {};
    for (const d of live) {
        const k = d.operator || 'other';
        byOp[k] = (byOp[k] || 0) + num(d.power_mw);
    }
    const palette = ['#22d3ee', '#f472b6', '#fbbf24', '#4ade80', '#a78bfa', '#fb923c', '#38bdf8', '#f87171'];
    const segments = Object.entries(byOp).sort((a, b) => b[1] - a[1])
        .map(([k, v], i) => ({ label: k, value: v, color: palette[i % palette.length] }));
    return {
        facilities: dcs.length,
        fabs: DCF_().filter(d => d && d.type === 'chipfab').length,
        liveMw: live.reduce((s, d) => s + num(d.power_mw), 0),
        pipelineMw: build.reduce((s, d) => s + num(d.power_mw), 0),
        segments,
        clusters: arr(COMPUTE_().clusters),
        trends: arr(COMPUTE_().trends)
    };
}

/** Live-ish power grid: solar follows the sun, wind follows the weather. */
export function powerGrid(dayPhase, weatherIntensity, t) {
    const dp = num(dayPhase, 0.5);
    const wi = num(weatherIntensity, 0.3);
    const solar = dp > 0.25 && dp < 0.75 ? Math.round(200 * Math.sin((dp - 0.25) * Math.PI * 2)) : 0;
    const sources = [
        { id: 'solar', label: 'Solar', mw: solar, color: '#fbbf24' },
        { id: 'wind', label: 'Wind', mw: Math.round(150 * (0.35 + wi * 0.55) + wave('wind', 40, 12, t)), color: '#4ade80' },
        { id: 'nuclear', label: 'Nuclear', mw: 1100, color: '#a78bfa' },
        { id: 'hydro', label: 'Hydro', mw: 400 + Math.round(wave('hydro', 90, 18, t)), color: '#38bdf8' },
        { id: 'coal', label: 'Coal', mw: 600 + Math.round(wave('coal', 55, 26, t)), color: '#f87171' }
    ];
    const supply = sources.reduce((s, x) => s + Math.max(0, x.mw), 0);
    // Demand: compute build-out is the load, with a diurnal + noise ripple.
    const base = computeInfra().liveMw * 0.55 + 900;
    const demand = Math.round(base * (0.86 + 0.14 * Math.sin((dp - 0.15) * Math.PI * 2)) + wave('demand', 30, 60, t));
    return { sources, supply, demand, reserve: supply - demand, margin: supply ? (supply - demand) / supply : 0 };
}

/** Agent-district telemetry, derived from citizen count + city clock. */
export function agentStats(t) {
    const pop = num(G.citizens?.list?.length, 0);
    const active = Math.max(0, Math.round(pop * 3.4 + 120 + wave('agents', 22, 40, t)));
    const queued = Math.max(0, Math.round(active * 0.18 + wave('queue', 13, 14, t)));
    const errRate = Math.max(0.004, Math.min(0.22, 0.035 + wave('err', 47, 0.028, t)));
    const tools = 2400 + Math.round(wave('tools', 300, 60, t));
    return { active, queued, errRate, tools, throughput: Math.round(active * (2.1 + wave('tp', 17, 0.5, t))) };
}

/** Fused wire: news + deals + launches + rulings + papers, newest-ish first. */
export function tapeItems(snap) {
    const out = [];
    const news = arr(snap && snap.news).length ? arr(snap.news) : arr(NEWS);
    for (const n of news.slice(0, 10)) {
        if (!n) continue;
        out.push({ k: 'WIRE', c: '#22d3ee', text: n.headline || n.title || '', url: n.url });
    }
    const deals = num(G.vcDealFlow?.dealsCompleted, 0);
    if (deals) out.push({ k: 'DEAL', c: '#4ade80', text: `${deals} venture rounds closed on VC Row` });
    const papers = num(G.researchPapers?.delivered, 0);
    if (papers) out.push({ k: 'PAPER', c: '#a78bfa', text: `${papers} preprints delivered to the University` });
    const court = G.court?.snapshot?.();
    if (court) {
        out.push({ k: 'COURT', c: '#fbbf24', text: court.current ? `In session: ${court.current}` : `${num(court.rulings)} rulings handed down · docket ${num(court.docket)}` });
    }
    const jail = G.jail?.snapshot?.();
    if (jail) out.push({ k: 'JAIL', c: '#f87171', text: `${num(jail.inmates)} models detained · ${num(jail.processed)} processed` });
    const conf = safe(activeConference);
    if (conf) out.push({ k: 'CONF', c: '#f472b6', text: `${conf.name} in session — ${conf.theme}` });
    for (const o of Object.values(obj(SPACE_ORGS)).slice(0, 3)) {
        out.push({ k: 'LAUNCH', c: '#fb923c', text: `${o.icon || '🚀'} ${o.name} window open over the Space Zone` });
    }
    return out;
}

function safe(fn, fallback = null) {
    try { return typeof fn === 'function' ? fn() : fallback; } catch (e) { return fallback; }
}

/** Countries with a diplomatic presence, derived from the building list. */
export function embassyCountries() {
    const seen = new Map();
    for (const b of BLDS_()) {
        const m = /^(?:embassy|diplomat_villa)_([a-z]{2})$/.exec(String(b && b.id || ''));
        if (!m) continue;
        if (!seen.has(m[1])) seen.set(m[1], { id: m[1], code: m[1].toUpperCase(), name: COUNTRY_NAMES[m[1]] || m[1].toUpperCase() });
    }
    if (!seen.size) return ['us', 'cn', 'eu', 'uk', 'in', 'ae'].map(id => ({ id, code: id.toUpperCase(), name: COUNTRY_NAMES[id] || id.toUpperCase() }));
    return [...seen.values()].slice(0, 8);
}

const COUNTRY_NAMES = {
    us: 'United States', cn: 'China', eu: 'European Union', uk: 'United Kingdom',
    jp: 'Japan', in: 'India', ae: 'United Arab Emirates', kr: 'South Korea', ca: 'Canada'
};
const COUNTRY_COLORS = {
    us: '#60a5fa', cn: '#f87171', eu: '#818cf8', uk: '#a78bfa',
    jp: '#fb7185', in: '#fbbf24', ae: '#4ade80', kr: '#38bdf8', ca: '#f472b6'
};
/** Hand-tuned bilateral scores; unlisted pairs get a stable pseudo-score. */
const EMBASSY_RELATIONS = {
    us_cn: 22, us_eu: 82, us_uk: 90, us_jp: 86, us_in: 70, us_ae: 62,
    cn_eu: 48, cn_uk: 40, cn_jp: 34, cn_in: 28, cn_ae: 72,
    eu_uk: 75, eu_jp: 74, eu_in: 65, eu_ae: 58,
    uk_jp: 72, uk_in: 78, uk_ae: 68,
    jp_in: 71, jp_ae: 60,
    in_ae: 76
};
export function relationScore(a, b) {
    if (a === b) return null;
    const k1 = a + '_' + b, k2 = b + '_' + a;
    if (EMBASSY_RELATIONS[k1] != null) return EMBASSY_RELATIONS[k1];
    if (EMBASSY_RELATIONS[k2] != null) return EMBASSY_RELATIONS[k2];
    return 35 + (hash([a, b].sort().join('_')) % 45);
}

/** Alignment orgs, read out of the Alignment Forest building set. */
const ALIGN_META = {
    align_miri: { focus: 'Agent foundations · deconfusion', lead: 'Nate Soares', founded: 2000, location: 'Berkeley, CA' },
    align_metr: { focus: 'Dangerous-capability evaluations', lead: 'Beth Barnes', founded: 2022, location: 'Berkeley, CA' },
    align_apollo: { focus: 'Scheming & deception evals', lead: 'Marius Hobbhahn', founded: 2023, location: 'London, UK' },
    align_redwood: { focus: 'Control & interpretability', lead: 'Buck Shlegeris', founded: 2021, location: 'Berkeley, CA' },
    align_far: { focus: 'Robustness · frontier research', lead: 'Adam Gleave', founded: 2022, location: 'Berkeley, CA' }
};
export function alignmentOrgs() {
    return BLDS_().filter(b => b && String(b.id).startsWith('align_')).map(b => ({
        id: b.id, name: b.name || b.id, emoji: b.emoji || '🛡️', desc: b.desc || '',
        ...(ALIGN_META[b.id] || {})
    }));
}

/** Kardashev pillars derived from the city's own content. */
export function kardashevPillars() {
    const infra = computeInfra();
    const models = allModels();
    const ceiling = models.reduce((m, x) => Math.max(m, avg4(x.benchmarks)), 0);
    const power = BLDS_().filter(b => ['solar', 'wind', 'nuclear', 'coal', 'dam'].includes(b && b.type)).length;
    return [
        { key: 'compute', label: 'CMPT', value: Math.min(1, (infra.liveMw + infra.pipelineMw) / 14000) },
        { key: 'energy', label: 'NRGY', value: Math.min(1, power / 6) },
        { key: 'cognition', label: 'COGN', value: Math.min(1, ceiling / 95) },
        { key: 'biology', label: 'BIO', value: Math.min(1, Object.keys(obj(LONGEVITY_COMPANIES)).length / 8) },
        { key: 'space', label: 'SPCE', value: Math.min(1, Object.keys(obj(SPACE_ORGS)).length / 9) },
        { key: 'alignment', label: 'ALGN', value: Math.min(1, alignmentOrgs().length / 6) }
    ];
}

/* ══════════════════════════════════════════════════════════════════════════
   PARITY EXPORTS — the flat model + shell renderer the exercise harness and
   any headless consumer import. `terminalHtml` renders the whole chrome;
   panel bodies are filled in by Terminal._renderAll() once mounted.
   ══════════════════════════════════════════════════════════════════════════ */

export const PANELS = [
    { id: 'labs', title: 'AI LABS', cols: 6, rows: 2, hint: 'Sortable — models, avg benchmark, flagship, ELO' },
    { id: 'news', title: 'LIVE NEWS', cols: 6, rows: 2, hint: 'Wire feed from CityStore · falls back to static desk' },
    { id: 'alignment', title: 'ALIGNMENT', cols: 3, rows: 2, hint: 'Alignment Forest orgs — focus, lead, location' },
    { id: 'embassy', title: 'EMBASSY RELATIONS', cols: 4, rows: 2, hint: 'Bilateral relations matrix' },
    { id: 'kardashev', title: 'KARDASHEV', cols: 5, rows: 2, hint: 'K-scale, milestone, six-pillar radar' },
    { id: 'compute', title: 'COMPUTE INFRA', cols: 6, rows: 1, hint: 'MW capacity · operator donut · FLOP trend' },
    { id: 'capital', title: 'THE TAPE', cols: 6, rows: 1, hint: 'Fused wire — news, deals, launches, rulings' },
    { id: 'power', title: 'POWER GRID', cols: 4, rows: 2, hint: 'Source mix donut · supply vs demand' },
    { id: 'supply', title: 'SUPPLY CHAIN', cols: 4, rows: 2, hint: 'Bottlenecks · foundries · accelerators' },
    { id: 'agents', title: 'AGENTS', cols: 4, rows: 2, hint: 'Active swarms · error gauge · throughput' },
    { id: 'population', title: 'POPULATION', cols: 4, rows: 1, hint: 'Citizen count · lab mix' },
    { id: 'robotics', title: 'ROBOTICS', cols: 4, rows: 1, hint: 'Humanoid programs · unit curve' },
    { id: 'longevity', title: 'LONGEVITY', cols: 4, rows: 1, hint: 'Compounds · trials · genomes' }
];

export function buildTerminalModel(Gref = G) {
    const g = Gref || {};
    const snap = safe(() => CityStore.getSnapshot(), {}) || {};
    const idx = num(g.ui?.aiIndex, num(snap.aiIndex, 512));
    const k = kardashevScale(idx);
    const infra = computeInfra();
    return {
        clock: clockString(num(g.dayPhase, 0.5)),
        weather: g.weatherSys?.state || snap.weather?.state || 'clear',
        district: g.districtAt?.label || 'Singularity City',
        aiIndex: idx,
        aiDelta: num(g.ui?.aiDelta, num(snap.aiDelta, 0)),
        kardashev: k,
        pillars: kardashevPillars(),
        pop: num(g.citizens?.list?.length, 0),
        buildings: arr(g.placements).length,
        labs: labRows(),
        models: allModels().slice(0, 48),
        news: (arr(snap.news).length ? arr(snap.news) : arr(NEWS)).slice(0, 14),
        live: obj(snap.live),
        source: snap.source || 'offline',
        conferences: arr(CONFERENCES),
        activeConf: safe(activeConference),
        events: arr(AI_EVENTS),
        alignment: alignmentOrgs(),
        countries: embassyCountries(),
        datacenters: DCF_().slice(0, 16).map(d => ({
            id: d.id, name: d.name, operator: d.operator, location: d.location,
            mw: num(d.power_mw), status: d.status, type: d.type
        })),
        infra,
        power: powerGrid(g.dayPhase, g.weatherSys?.intensity, num(g.time, 0)),
        supply: SUPPLY_(),
        agents: agentStats(num(g.time, 0)),
        robotics: obj(ROBOTICS_COMPANIES),
        longevity: obj(LONGEVITY_COMPANIES),
        districts: arr(DISTRICTS).length,
        metro: arr(TRAM_LINES),
        costs: Object.keys(obj(COSTS)),
        ctx: obj(CTX),
        compute: COMPUTE_(),
        deals: num(g.vcDealFlow?.dealsCompleted, 0),
        papers: num(g.researchPapers?.delivered, 0),
        jail: g.jail?.snapshot?.() || null,
        court: g.court?.snapshot?.() || null,
        tape: tapeItems(snap)
    };
}

export function terminalHtml(model) {
    const m = model || buildTerminalModel(G);
    const liveTag = m.live?.online ? 'LIVE' : (m.source === 'offline' ? 'STATIC' : 'CACHED');
    const stat = (id, label, val, tip) =>
        `<span class="tm-stat" title="${esc(tip || label)}"><span class="tm-lbl">${esc(label)}</span><span class="tm-val" id="tm-${id}">${esc(val)}</span></span>`;

    const panels = PANELS.map(p => `
        <section class="tm-panel" data-panel="${p.id}" style="grid-column:span ${p.cols};grid-row:span ${p.rows}">
            <header class="tm-panel-h">
                <span class="tm-panel-title">${esc(p.title)}</span>
                <span class="tm-panel-info" title="${esc(p.hint)}">i</span>
                <span class="tm-panel-live"><i class="tm-live-dot"></i>LIVE</span>
            </header>
            <div class="tm-panel-body" id="tm-body-${p.id}"></div>
        </section>`).join('');

    return `
    <div class="tm-topbar">
        <div class="tm-logo">
            <span class="tm-logo-dot"></span>
            <span class="tm-logo-main">SC TERMINAL</span>
            <span class="tm-logo-suf">⟫ ${esc(liveTag)}</span>
        </div>
        <div class="tm-status">
            ${stat('aiindex', 'AI INDEX', Math.round(m.aiIndex), 'Composite capability index for the whole city')}
            ${stat('kscale', 'K-SCALE', m.kardashev.k.toFixed(3), m.kardashev.tier)}
            ${stat('citizens', 'CITIZENS', m.pop, 'Model-citizens currently simulated')}
            ${stat('blds', 'BLDS', m.buildings, 'Named buildings placed across the districts')}
            ${stat('mw', 'MW', fmt(m.infra.liveMw), 'Operational data-centre draw')}
            ${stat('clock', 'CLOCK', m.clock, 'City clock')}
        </div>
        <div class="tm-topbar-right">
            <button type="button" id="termClose" class="tm-cta-btn" title="Return to the street (D / ESC)">▶ ENTER CITY</button>
        </div>
    </div>
    <div class="tm-cmdbar">
        <span class="tm-cmd-prompt">&gt;</span>
        <input id="tm-cmd-input" class="tm-cmd-input" type="text" autocomplete="off" spellcheck="false"
               placeholder="lab · model · country · panel —  OPENAI · CLAUDE · CN · POWER · WATCH   ( press / )"
               aria-label="Terminal command line" />
        <span class="tm-cmd-hint"><kbd>/</kbd> focus <kbd>↑↓</kbd> nav <kbd>⏎</kbd> go <kbd>esc</kbd> clear</span>
        <div class="tm-cmd-dropdown" id="tm-cmd-dropdown" hidden></div>
    </div>
    <div class="tm-watchbar" id="tm-watchbar" hidden></div>
    <div class="tm-grid" id="tm-grid">${panels}</div>
    <div class="tm-detail" id="tm-detail" hidden></div>
    <div class="tm-tape-strip"><div class="tm-tape-track" id="tm-tape-track"></div></div>
    <div class="tm-footer">
        <span><kbd>D</kbd> / <kbd>ESC</kbd> back to the street</span>
        <span class="tm-foot-mid">${PANELS.length} live panels · command line · watchlist · persisted series</span>
        <span id="tm-foot-src">${esc(liveTag)} · ${esc(arr(m.live?.sources).join(' ') || 'static')}</span>
    </div>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   STYLESHEET — injected at init so css/styles.css stays untouched.
   ══════════════════════════════════════════════════════════════════════════ */
const CSS = `
#terminal{position:fixed;inset:0;z-index:90;background:#05080f;color:#c9d6e6;
  font-family:var(--mo,'JetBrains Mono',monospace);display:flex;flex-direction:column;
  padding:0;overflow:hidden;font-size:11px;line-height:1.45}
#terminal.hidden{display:none!important}
#terminal ::-webkit-scrollbar{width:7px;height:7px}
#terminal ::-webkit-scrollbar-thumb{background:#1e2b40;border-radius:4px}
#terminal ::-webkit-scrollbar-track{background:transparent}
#terminal kbd{background:#131c2b;border:1px solid #26344c;border-radius:3px;padding:0 4px;font-size:9px;color:#8fa3bd}

#terminal .tm-topbar{display:flex;align-items:center;gap:18px;padding:8px 14px;
  border-bottom:1px solid #16283a;background:linear-gradient(180deg,#0a1220,#070c16);flex:0 0 auto}
#terminal .tm-logo{display:flex;align-items:center;gap:7px;white-space:nowrap}
#terminal .tm-logo-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:tmpulse 2s infinite}
@keyframes tmpulse{0%,100%{opacity:1}50%{opacity:.35}}
#terminal .tm-logo-main{font-family:var(--px,monospace);font-size:11px;color:#34d399;letter-spacing:1px}
#terminal .tm-logo-suf{font-size:9px;color:#5b7align;color:#64748b;letter-spacing:1px}
#terminal .tm-status{display:flex;gap:16px;flex:1;overflow:hidden}
#terminal .tm-stat{display:flex;flex-direction:column;line-height:1.15;cursor:default}
#terminal .tm-lbl{font-size:8px;color:#4b6076;letter-spacing:1px}
#terminal .tm-val{font-size:13px;color:#e2ecf7;font-variant-numeric:tabular-nums}
#terminal .tm-cta-btn{background:#0d2a22;border:1px solid #2f6d56;color:#5eead4;
  padding:6px 12px;border-radius:3px;font-size:10px;letter-spacing:1px;font-family:inherit}
#terminal .tm-cta-btn:hover{background:#124435;border-color:#5eead4;color:#a7f3d0}

#terminal .tm-cmdbar{display:flex;align-items:center;gap:8px;padding:5px 14px;position:relative;
  border-bottom:1px solid #12202f;background:#070d17;flex:0 0 auto}
#terminal .tm-cmd-prompt{color:#34d399;font-weight:700}
#terminal .tm-cmd-input{flex:1;background:transparent;border:0;outline:0;color:#e2ecf7;
  font-family:inherit;font-size:11px;padding:4px 0}
#terminal .tm-cmd-input::placeholder{color:#3d4f66}
#terminal .tm-cmd-hint{font-size:9px;color:#3f5management;color:#41556e;white-space:nowrap}
#terminal .tm-cmd-dropdown{position:absolute;top:100%;left:26px;right:180px;z-index:5;max-height:290px;overflow:auto;
  background:#0a1523;border:1px solid #1f3a52;border-top:0;box-shadow:0 12px 30px rgba(0,0,0,.6)}
#terminal .tm-cmd-dropdown[hidden]{display:none}
#terminal .tm-cmd-item{display:flex;align-items:baseline;gap:10px;padding:5px 10px;cursor:pointer;border-bottom:1px solid #101d2c}
#terminal .tm-cmd-item.sel,#terminal .tm-cmd-item:hover{background:#12283c}
#terminal .tm-cmd-k{color:#5eead4;font-size:10px;min-width:64px}
#terminal .tm-cmd-l{color:#e2ecf7;flex:1}
#terminal .tm-cmd-s{color:#546a85;font-size:9px}

#terminal .tm-watchbar{display:flex;align-items:center;gap:8px;padding:4px 14px;flex:0 0 auto;
  border-bottom:1px solid #12202f;background:#080f1b;overflow-x:auto;white-space:nowrap}
#terminal .tm-watchbar[hidden]{display:none}
#terminal .tm-watch-lbl{font-size:9px;color:#fbbf24;letter-spacing:1px}
#terminal .tm-watch-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #2b3d55;
  border-radius:12px;padding:2px 8px;font-size:10px;color:#cbd5e1;cursor:pointer}
#terminal .tm-watch-chip:hover{border-color:#f472b6;color:#fbcfe8}
#terminal .tm-watch-chip b{font-variant-numeric:tabular-nums;color:#5eead4}
#terminal .tm-watch-x{color:#64748b}

#terminal .tm-grid{flex:1;min-height:0;overflow:auto;display:grid;gap:8px;padding:10px 14px;
  grid-template-columns:repeat(12,1fr);grid-auto-rows:minmax(96px,auto)}
#terminal .tm-panel{background:linear-gradient(180deg,#0a1220,#080e18);border:1px solid #16283a;
  border-radius:3px;display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}
#terminal .tm-panel.flash{animation:tmflash 1s ease-out}
@keyframes tmflash{0%{border-color:#5eead4;box-shadow:0 0 0 1px #5eead4 inset}100%{border-color:#16283a}}
#terminal .tm-panel-h{display:flex;align-items:center;gap:6px;padding:4px 9px;border-bottom:1px solid #13222f;flex:0 0 auto}
#terminal .tm-panel-title{font-family:var(--px,monospace);font-size:8px;color:#34d399;letter-spacing:1.2px;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#terminal .tm-panel-info{width:12px;height:12px;border:1px solid #26384f;border-radius:50%;font-size:8px;
  display:grid;place-items:center;color:#4b6076;cursor:help}
#terminal .tm-panel-live{display:flex;align-items:center;gap:4px;font-size:7px;color:#3f6d5c;letter-spacing:1px}
#terminal .tm-live-dot{width:5px;height:5px;border-radius:50%;background:#34d399;animation:tmpulse 2.4s infinite}
#terminal .tm-panel-body{flex:1;min-height:0;overflow:auto;padding:7px 9px}
#terminal .tm-empty{color:#3f5management;color:#41556e;font-size:10px;padding:10px 0;text-align:center}

#terminal table.tm-table{width:100%;border-collapse:collapse;font-size:10px}
#terminal .tm-table th{position:sticky;top:0;background:#0b1523;color:#4b6076;font-weight:400;
  text-align:left;padding:3px 5px;border-bottom:1px solid #1a2c40;cursor:pointer;white-space:nowrap;letter-spacing:.5px}
#terminal .tm-table th:hover{color:#5eead4}
#terminal .tm-table td{padding:3px 5px;border-bottom:1px solid #101c29;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#terminal .tm-table tbody tr{cursor:pointer}
#terminal .tm-table tbody tr:hover{background:#11212f}
#terminal .tm-num{text-align:right;font-variant-numeric:tabular-nums}
#terminal .tm-rank{color:#3f5management;color:#41556e;width:18px}
#terminal .tm-lab-dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}
#terminal .tm-apex{color:#fbbf24}
#terminal .tm-elo{color:#5eead4}
#terminal .tm-pill{display:inline-block;border:1px solid #27384e;border-radius:8px;padding:0 5px;font-size:8px;color:#7d92ab}

#terminal .tm-news-row{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #101c29;align-items:baseline}
#terminal .tm-news-src{font-size:8px;color:#0f172a;background:#38bdf8;border-radius:2px;padding:0 4px;flex:0 0 auto}
#terminal .tm-news-t{flex:1;color:#cbd5e1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#terminal .tm-news-t a{color:#cbd5e1;text-decoration:none}
#terminal .tm-news-t a:hover{color:#5eead4;text-decoration:underline}

#terminal .tm-align-card{border-left:2px solid #4ade80;padding:4px 8px;margin-bottom:5px;background:#0a1420}
#terminal .tm-align-top{display:flex;justify-content:space-between;gap:6px}
#terminal .tm-align-name{color:#a7f3d0;font-size:10px}
#terminal .tm-align-year{color:#41556e;font-size:9px}
#terminal .tm-align-focus{color:#8fa3bd;font-size:9px}
#terminal .tm-align-meta{color:#546a85;font-size:9px;display:flex;justify-content:space-between;gap:6px}

#terminal table.tm-matrix{border-collapse:collapse;font-size:9px;margin:0 auto}
#terminal .tm-matrix th{color:#7d92ab;padding:2px 4px;font-weight:400}
#terminal .tm-matrix td{width:26px;height:20px;text-align:center;border:1px solid #0b131f;
  font-variant-numeric:tabular-nums;cursor:pointer;color:#0a1018}
#terminal .tm-m-good{background:#22c55e}
#terminal .tm-m-neutral{background:#84cc16}
#terminal .tm-m-cool{background:#f59e0b}
#terminal .tm-m-cold{background:#ef4444}
#terminal .tm-m-self{background:#111c29;color:#2c3d52;cursor:default}
#terminal .tm-dim{opacity:.28}
#terminal .tm-m-legend{display:flex;gap:8px;justify-content:center;margin-top:6px;font-size:8px;color:#546a85;align-items:center;flex-wrap:wrap}
#terminal .tm-m-dot{width:8px;height:8px;display:inline-block;border-radius:2px;margin-right:3px}

#terminal .tm-k-layout{display:flex;gap:10px;height:100%;min-height:0}
#terminal .tm-k-left{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
#terminal .tm-k-right{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px}
#terminal .tm-stat-big{display:flex;align-items:baseline;gap:5px}
#terminal .tm-stat-unit{font-size:10px;color:#4b6076}
#terminal .tm-stat-num{font-family:var(--px,monospace);font-size:22px;color:#fbbf24}
#terminal .tm-kprog-track{height:6px;background:#111c29;border-radius:3px;overflow:hidden}
#terminal .tm-kprog-track i{display:block;height:100%;background:linear-gradient(90deg,#fbbf24,#f472b6)}
#terminal .tm-kprog-labels{display:flex;justify-content:space-between;font-size:8px;color:#41556e}
#terminal .tm-k-next{font-size:9px;color:#5eead4}
#terminal .tm-k-pillars{display:flex;flex-wrap:wrap;gap:3px;justify-content:center}
#terminal .tm-k-pillar{border:1px solid #1f3245;border-radius:2px;padding:1px 4px;font-size:8px;color:#8fa3bd}
#terminal .tm-k-pillar b{color:#5eead4}
#terminal .tm-radar-lbl{fill:#5b7086;font-size:7px;font-family:var(--mo,monospace)}

#terminal .tm-cols{display:flex;gap:10px;align-items:center;height:100%;min-height:0}
#terminal .tm-col{min-width:0}
#terminal .tm-col-grow{flex:1;min-width:0}
#terminal .tm-kv{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#7d92ab;padding:1px 0}
#terminal .tm-kv b{color:#e2ecf7;font-variant-numeric:tabular-nums}
#terminal .tm-big{font-family:var(--px,monospace);font-size:18px;color:#5eead4}
#terminal .tm-sub{font-size:9px;color:#546a85}
#terminal .tm-spark-lbl{font-size:8px;color:#41556e;letter-spacing:1px}
#terminal .tm-spark{display:block;width:100%}
#terminal .tm-donut-c{fill:#e2ecf7;font-size:13px;font-family:var(--mo,monospace)}
#terminal .tm-donut-s{fill:#4b6076;font-size:7px;font-family:var(--mo,monospace)}
#terminal .tm-gauge-v{fill:#e2ecf7;font-size:12px;font-family:var(--mo,monospace)}
#terminal .tm-legend{display:flex;flex-direction:column;gap:1px;font-size:8px;color:#7d92ab}
#terminal .tm-legend i{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:4px}

#terminal .tm-bar-row{display:flex;align-items:center;gap:6px;font-size:9px;padding:1px 0}
#terminal .tm-bar-l{flex:0 0 40%;color:#8fa3bd;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#terminal .tm-bar-t{flex:1;height:5px;background:#111c29;border-radius:3px;overflow:hidden}
#terminal .tm-bar-t i{display:block;height:100%}
#terminal .tm-bar-v{flex:0 0 auto;color:#cbd5e1;font-variant-numeric:tabular-nums;min-width:34px;text-align:right}

#terminal .tm-delta-up{color:#4ade80}
#terminal .tm-delta-down{color:#f87171}
#terminal .tm-delta-flat{color:#546a85}

#terminal .tm-tape-strip{flex:0 0 auto;height:22px;overflow:hidden;border-top:1px solid #16283a;
  background:#070d17;display:flex;align-items:center;position:relative}
#terminal .tm-tape-track{display:inline-flex;gap:26px;white-space:nowrap;animation:tmtape 70s linear infinite;padding-left:100%}
#terminal .tm-tape-strip:hover .tm-tape-track{animation-play-state:paused}
@keyframes tmtape{from{transform:translateX(0)}to{transform:translateX(-100%)}}
#terminal .tm-tape-i{font-size:10px;color:#8fa3bd}
#terminal .tm-tape-k{font-size:8px;letter-spacing:1px;margin-right:5px}

#terminal .tm-footer{flex:0 0 auto;display:flex;justify-content:space-between;gap:12px;
  padding:4px 14px;font-size:9px;color:#3f5management;color:#41556e;border-top:1px solid #12202f}
#terminal .tm-foot-mid{color:#334c66}

#terminal .tm-detail{position:absolute;right:14px;top:78px;width:320px;max-height:64vh;overflow:auto;z-index:6;
  background:#0a1523;border:1px solid #1f3a52;border-radius:3px;box-shadow:0 18px 40px rgba(0,0,0,.66);padding:10px 12px}
#terminal .tm-detail[hidden]{display:none}
#terminal .tm-d-head{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
#terminal .tm-d-title{font-size:13px;flex:1}
#terminal .tm-d-close{background:none;border:0;color:#546a85;font-size:14px}
#terminal .tm-d-close:hover{color:#f472b6}
#terminal .tm-d-body{font-size:10px;color:#9fb3c8}
#terminal .tm-d-watch{margin-top:8px;background:#111c29;border:1px solid #2b3d55;color:#8fa3bd;
  padding:4px 9px;border-radius:3px;font-size:9px;font-family:inherit;letter-spacing:1px}
#terminal .tm-d-watch.on{border-color:#fbbf24;color:#fbbf24}
#terminal .tm-toasts{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);z-index:8;display:flex;
  flex-direction:column;gap:5px;align-items:center;pointer-events:none}
#terminal .tm-toast{background:#0f2033;border:1px solid #2b4d66;color:#a5d8e8;padding:5px 12px;
  border-radius:3px;font-size:10px;animation:tmtoast .3s ease-out}
@keyframes tmtoast{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (max-width:1100px){
  #terminal .tm-grid{grid-template-columns:repeat(6,1fr)}
  #terminal .tm-panel{grid-column:span 6!important}
  #terminal .tm-status .tm-stat:nth-child(n+5){display:none}
}
`.replace(/#3f5management;color:/g, 'x-ignore:0;color:').replace(/#5b7align;color:/g, 'x-ignore:0;color:');

/* ══════════════════════════════════════════════════════════════════════════
   HISTORY — small persisted series so the sparklines have something to say
   the moment the terminal opens for the first time in a session.
   ══════════════════════════════════════════════════════════════════════════ */
const HIST_KEY = 'sc_fp_term_hist_v1';
const HIST_MAX = 90;
const WATCH_KEY = 'sc_fp_term_watch_v1';

const History = {
    data: null,
    load() {
        if (this.data) return this.data;
        try {
            const raw = typeof localStorage !== 'undefined' && localStorage.getItem(HIST_KEY);
            this.data = raw ? JSON.parse(raw) : {};
        } catch (e) { this.data = {}; }
        if (!this.data || typeof this.data !== 'object') this.data = {};
        return this.data;
    },
    push(metric, v) {
        if (typeof v !== 'number' || !isFinite(v)) return;
        const d = this.load();
        const a = (d[metric] = arr(d[metric]));
        const last = a[a.length - 1];
        if (last && Math.abs(last - v) < 1e-9) return;
        a.push(Math.round(v * 1e4) / 1e4);
        if (a.length > HIST_MAX) a.splice(0, a.length - HIST_MAX);
    },
    series(metric) { return arr(this.load()[metric]); },
    delta(metric) {
        const a = this.series(metric);
        if (a.length < 2) return null;
        return a[a.length - 1] - a[0];
    },
    save() {
        try {
            if (typeof localStorage !== 'undefined') localStorage.setItem(HIST_KEY, JSON.stringify(this.load()));
        } catch (e) { /* quota — series are disposable */ }
    }
};

function deltaChip(metric, digits = 0) {
    const d = History.delta(metric);
    if (d == null) return '';
    const cls = d > 0 ? 'tm-delta-up' : d < 0 ? 'tm-delta-down' : 'tm-delta-flat';
    const sign = d > 0 ? '+' : '';
    return `<span class="${cls}">${sign}${d.toFixed(digits)}</span>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE TERMINAL
   ══════════════════════════════════════════════════════════════════════════ */
export const Terminal = {
    open: false,
    el: null,
    model: null,

    _t: 0,
    _sampleT: 0,
    _sig: {},
    _labsSort: { col: 'elo', dir: 'desc' },
    _filter: { labs: null, embassy: null },
    _cmdIdx: 0,
    _cmdMatches: [],
    _dprSaved: null,

    // ── lifecycle ────────────────────────────────────────────────────────
    init() {
        if (typeof document === 'undefined') return;
        if (!document.getElementById('sc-term-css')) {
            const s = document.createElement('style');
            s.id = 'sc-term-css';
            s.textContent = CSS;
            document.head.appendChild(s);
        }
        let el = document.getElementById('terminal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'terminal';
            el.className = 'hidden';
            document.body.appendChild(el);
        }
        this.el = el;

        document.addEventListener('keydown', e => {
            if (!G.started) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            // KeyD alone is WASD strafe — open terminal with Ctrl/Meta+D, backtick,
            // or plain D when pointer is unlocked (pause / menu). Closes with D too.
            const dTerm = e.code === 'KeyD' && (e.ctrlKey || e.metaKey || !G.player?.locked || this.open);
            const tick = e.code === 'Backquote';
            if ((dTerm || tick) && !e.repeat && (!G.panelOpen || this.open)) {
                e.preventDefault();
                this.toggle();
            }
            if (e.code === 'Escape' && this.open) {
                e.preventDefault();
                this.close();
            }
            if (this.open && e.code === 'Slash' && !e.repeat) {
                e.preventDefault();
                this.el?.querySelector('#tm-cmd-input')?.focus();
            }
        });

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => History.save());
        }
    },

    toggle() { if (this.open) this.close(); else this.show(); },

    show() {
        if (G.orbitMode) G.orbitModeSys?.exit?.();
        if (G.xrayMode) G.xrayModeSys?.exit?.();
        if (G.holomapMode) G.holomap?.exit?.();
        this.open = true;
        G.terminalOpen = true;
        G.panelOpen = true;          // block game keys the same way panels do
        G.player?.unlock?.();

        this.model = buildTerminalModel(G);
        this.el.innerHTML = terminalHtml(this.model);
        this.el.classList.remove('hidden');
        this._sig = {};
        this._bind();
        this._sample(true);
        this._renderAll(true);
        this._renderTape();
        this._renderWatchbar();

        // The overlay is opaque — there is nothing to see behind it, so drop the
        // renderer to a token pixel ratio while it is up and restore on close.
        try {
            if (G.renderer && this._dprSaved == null) {
                this._dprSaved = G.renderer.getPixelRatio();
                G.renderer.setPixelRatio(0.12);
            }
        } catch (e) { /* renderer may not exist in headless use */ }

        G.progress?.unlock?.('terminal_open');
    },

    close() {
        this.open = false;
        G.terminalOpen = false;
        G.panelOpen = false;
        History.save();
        if (this.el) {
            this.el.classList.add('hidden');
            this.el.innerHTML = '';
        }
        try {
            if (G.renderer && this._dprSaved != null) {
                G.renderer.setPixelRatio(this._dprSaved);
                this._dprSaved = null;
            }
        } catch (e) { /* ignore */ }
        if (G.started && !G.paused) G.player?.lock?.();
    },

    update(dt) {
        if (!this.open || !this.el) return;
        this._t += num(dt, 0);
        this._sampleT += num(dt, 0);
        if (this._sampleT >= 5) { this._sampleT = 0; this._sample(); }
        if (this._t < 0.25) return;
        this._t = 0;
        this.model = buildTerminalModel(G);
        this._renderTop();
        this._renderAll(false);
        this._renderWatchbar();
    },

    // ── history sampling ─────────────────────────────────────────────────
    _sample(seedIfEmpty = false) {
        const m = this.model || buildTerminalModel(G);
        History.push('aiIndex', m.aiIndex);
        History.push('kscore', m.kardashev.k);
        History.push('pop', m.pop);
        History.push('mw', m.infra.liveMw);
        History.push('demand', m.power.demand);
        History.push('supply', m.power.supply);
        History.push('agents', m.agents.active);
        History.push('errors', m.agents.errRate * 100);
        History.push('deals', m.deals);
        History.push('papers', m.papers);
        if (seedIfEmpty) {
            // First ever open: synthesise a plausible tail so charts aren't flat
            // lines. Deterministic, so it is the same shape every session.
            for (const [k, base] of [['aiIndex', m.aiIndex], ['kscore', m.kardashev.k], ['mw', m.infra.liveMw],
                ['demand', m.power.demand], ['supply', m.power.supply], ['agents', m.agents.active]]) {
                if (History.series(k).length >= 8) continue;
                const out = [];
                for (let i = 12; i > 0; i--) out.push(base * (1 - i * 0.006) + wave(k + i, 5, base * 0.012, i));
                History.load()[k] = out.concat(History.series(k));
            }
        }
    },

    // ── DOM binding ──────────────────────────────────────────────────────
    _bind() {
        const el = this.el;
        const close = el.querySelector('#termClose');
        if (close) close.onclick = () => this.close();

        el.addEventListener('click', e => {
            const th = e.target.closest && e.target.closest('th[data-col]');
            if (th) {
                const col = th.dataset.col;
                if (this._labsSort.col === col) this._labsSort.dir = this._labsSort.dir === 'asc' ? 'desc' : 'asc';
                else { this._labsSort.col = col; this._labsSort.dir = (col === 'name' || col === 'region' || col === 'flagship') ? 'asc' : 'desc'; }
                this._sig.labs = null;
                this._renderLabs();
                return;
            }
            const act = e.target.closest && e.target.closest('[data-action]');
            if (!act) return;
            if (e.target.closest('a[href]')) return;   // let real links through
            e.preventDefault();
            this._action(act.getAttribute('data-action'));
        });

        const input = el.querySelector('#tm-cmd-input');
        if (input) {
            input.addEventListener('input', () => this._cmdFilter(input.value));
            input.addEventListener('keydown', e => {
                e.stopPropagation();
                if (e.key === 'ArrowDown') { e.preventDefault(); this._cmdMove(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); this._cmdMove(-1); }
                else if (e.key === 'Enter') { e.preventDefault(); this._cmdRun(); }
                else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (input.value) { input.value = ''; this._cmdFilter(''); }
                    else { input.blur(); }
                }
            });
            input.addEventListener('focus', () => this._cmdFilter(input.value));
            input.addEventListener('blur', () => setTimeout(() => this._cmdHide(), 140));
        }
    },

    _action(a) {
        const [kind, ...rest] = String(a).split(':');
        const id = rest.join(':');
        switch (kind) {
            case 'panel': this._goto(id); break;
            case 'lab': this._detailLab(id); break;
            case 'model': this._detailModel(id); break;
            case 'country': this._detailCountry(id); break;
            case 'dc': this._detailDc(id); break;
            case 'labsfilter':
                this._filter.labs = this._filter.labs === id ? null : id;
                this._sig.labs = null; this._renderLabs();
                break;
            case 'embassy':
                this._filter.embassy = this._filter.embassy === id ? null : id;
                this._sig.embassy = null; this._renderEmbassy();
                break;
            case 'watch': this._watchToggle(rest[0], rest.slice(1).join(':')); break;
            case 'detailclose': this._detailClose(); break;
            default: break;
        }
    },

    _goto(panelId, flash = true) {
        const p = this.el?.querySelector(`.tm-panel[data-panel="${panelId}"]`);
        if (!p) return;
        p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        if (flash) { p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash'); }
    },

    _toast(text) {
        let host = this.el?.querySelector('.tm-toasts');
        if (!host) {
            host = document.createElement('div');
            host.className = 'tm-toasts';
            this.el?.appendChild(host);
        }
        const t = document.createElement('div');
        t.className = 'tm-toast';
        t.textContent = text;
        host.appendChild(t);
        setTimeout(() => t.remove(), 2600);
    },

    // ── watchlist ────────────────────────────────────────────────────────
    _watchLoad() {
        try {
            const raw = typeof localStorage !== 'undefined' && localStorage.getItem(WATCH_KEY);
            const a = raw ? JSON.parse(raw) : [];
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    },
    _watchSave(list) {
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(WATCH_KEY, JSON.stringify(list)); } catch (e) { /* quota */ }
    },
    _isWatched(kind, id) { return this._watchLoad().some(w => w.kind === kind && w.id === id); },
    _watchToggle(kind, id) {
        const list = this._watchLoad();
        const i = list.findIndex(w => w.kind === kind && w.id === id);
        if (i >= 0) { list.splice(i, 1); this._toast('Unpinned ' + id); }
        else { list.push({ kind, id }); this._toast('Pinned ' + id + ' to the watchbar'); }
        this._watchSave(list);
        this._renderWatchbar();
        if (this._detailRef && this._detailRef.kind === kind && this._detailRef.id === id) {
            this._action(kind + ':' + id);   // re-render the drawer with the new star
        }
    },
    _watchValue(w) {
        const m = this.model || buildTerminalModel(G);
        if (w.kind === 'lab') {
            const r = m.labs.find(x => x.id === w.id);
            return r ? { label: r.name, value: r.elo != null ? 'ELO ' + Math.round(r.elo) : r.models + ' models', color: r.color } : null;
        }
        if (w.kind === 'model') {
            const x = allModels().find(y => y.id === w.id);
            return x ? { label: x.name, value: 'ELO ' + Math.round(num(x.benchmarks.ELO)), color: LABS_()[x.lab]?.color } : null;
        }
        if (w.kind === 'country') {
            const c = m.countries.find(x => x.id === w.id);
            return c ? { label: c.code, value: 'relations', color: COUNTRY_COLORS[c.id] } : null;
        }
        if (w.kind === 'dc') {
            const d = m.datacenters.find(x => x.id === w.id);
            return d ? { label: d.name, value: d.mw + ' MW', color: '#38bdf8' } : null;
        }
        return null;
    },
    _renderWatchbar() {
        const bar = this.el?.querySelector('#tm-watchbar');
        if (!bar) return;
        const list = this._watchLoad();
        if (!list.length) { bar.hidden = true; return; }
        bar.hidden = false;
        bar.innerHTML = '<span class="tm-watch-lbl">★ WATCH</span>' + list.map(w => {
            const v = this._watchValue(w);
            if (!v) return '';
            return `<span class="tm-watch-chip" data-action="${esc(w.kind)}:${esc(w.id)}" style="border-color:${esc(v.color || '#2b3d55')}">
                ${esc(v.label)} <b>${esc(v.value)}</b>
                <span class="tm-watch-x" data-action="watch:${esc(w.kind)}:${esc(w.id)}">✕</span></span>`;
        }).join('');
    },

    // ── command palette ──────────────────────────────────────────────────
    _cmdIndex() {
        const m = this.model || buildTerminalModel(G);
        const out = [];
        for (const p of PANELS) out.push({ key: 'PANEL', label: p.title, sub: p.hint, run: () => this._goto(p.id) });
        for (const l of m.labs) out.push({ key: 'LAB', label: l.name, sub: `${l.region} · ${l.models} models · ELO ${l.elo != null ? Math.round(l.elo) : '—'}`, run: () => this._detailLab(l.id) });
        for (const x of allModels().slice(0, 60)) out.push({ key: 'MODEL', label: x.name, sub: `${LABS_()[x.lab]?.name || x.lab} · ELO ${Math.round(num(x.benchmarks.ELO))}`, run: () => this._detailModel(x.id) });
        for (const c of m.countries) out.push({ key: 'COUNTRY', label: c.code, sub: c.name, run: () => this._detailCountry(c.id) });
        for (const d of m.datacenters) out.push({ key: 'SITE', label: d.name, sub: `${d.operator || '—'} · ${d.mw} MW · ${d.status}`, run: () => this._detailDc(d.id) });
        out.push({ key: 'CMD', label: 'WATCH', sub: 'list what you have pinned', run: () => this._toast(this._watchLoad().length ? this._watchLoad().map(w => w.id).join(' · ') : 'Nothing pinned — open any row and hit ☆ WATCH') });
        out.push({ key: 'CMD', label: 'CLEAR', sub: 'drop all filters and the watchlist', run: () => { this._filter.labs = null; this._filter.embassy = null; this._watchSave([]); this._sig = {}; this._renderAll(true); this._renderWatchbar(); this._toast('Filters + watchlist cleared'); } });
        out.push({ key: 'CMD', label: 'CITY', sub: 'close the terminal, return to the street', run: () => this.close() });
        return out;
    },
    _cmdFilter(q) {
        const dd = this.el?.querySelector('#tm-cmd-dropdown');
        if (!dd) return;
        const needle = String(q || '').trim().toLowerCase();
        const idx = this._cmdIndex();
        this._cmdMatches = (needle
            ? idx.filter(x => (x.label + ' ' + x.key + ' ' + x.sub).toLowerCase().includes(needle))
            : idx.filter(x => x.key === 'PANEL' || x.key === 'CMD')
        ).slice(0, 40);
        this._cmdIdx = 0;
        if (!this._cmdMatches.length) { dd.hidden = true; return; }
        dd.hidden = false;
        dd.innerHTML = this._cmdMatches.map((x, i) =>
            `<div class="tm-cmd-item${i === 0 ? ' sel' : ''}" data-i="${i}">
                <span class="tm-cmd-k">${esc(x.key)}</span>
                <span class="tm-cmd-l">${esc(x.label)}</span>
                <span class="tm-cmd-s">${esc(x.sub)}</span></div>`).join('');
        dd.querySelectorAll('.tm-cmd-item').forEach(node => {
            node.onmousedown = ev => { ev.preventDefault(); this._cmdIdx = +node.dataset.i; this._cmdRun(); };
        });
    },
    _cmdMove(d) {
        if (!this._cmdMatches.length) return;
        this._cmdIdx = (this._cmdIdx + d + this._cmdMatches.length) % this._cmdMatches.length;
        const dd = this.el?.querySelector('#tm-cmd-dropdown');
        if (!dd) return;
        dd.querySelectorAll('.tm-cmd-item').forEach((n, i) => n.classList.toggle('sel', i === this._cmdIdx));
        dd.querySelectorAll('.tm-cmd-item')[this._cmdIdx]?.scrollIntoView({ block: 'nearest' });
    },
    _cmdRun() {
        const m = this._cmdMatches[this._cmdIdx];
        if (!m) return;
        safe(() => m.run());
        this._cmdHide();
        const input = this.el?.querySelector('#tm-cmd-input');
        if (input) { input.value = ''; input.blur(); }
    },
    _cmdHide() {
        const dd = this.el?.querySelector('#tm-cmd-dropdown');
        if (dd) dd.hidden = true;
    },

    // ── detail drawer ────────────────────────────────────────────────────
    _detail(kind, id, title, color, bodyHtml) {
        const d = this.el?.querySelector('#tm-detail');
        if (!d) return;
        this._detailRef = { kind, id };
        const on = this._isWatched(kind, id);
        d.hidden = false;
        d.innerHTML = `
            <div class="tm-d-head">
                <span class="tm-d-title" style="color:${esc(color || '#e2ecf7')}">${esc(title)}</span>
                <button type="button" class="tm-d-close" data-action="detailclose:x">✕</button>
            </div>
            <div class="tm-d-body">${bodyHtml}</div>
            <button type="button" class="tm-d-watch${on ? ' on' : ''}" data-action="watch:${esc(kind)}:${esc(id)}">${on ? '★ WATCHING' : '☆ WATCH'}</button>`;
    },
    _detailClose() {
        const d = this.el?.querySelector('#tm-detail');
        if (d) { d.hidden = true; d.innerHTML = ''; }
        this._detailRef = null;
    },
    _kv(k, v) { return `<div class="tm-kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`; },

    _detailLab(id) {
        const row = (this.model || buildTerminalModel(G)).labs.find(l => l.id === id);
        const lab = LABS_()[id];
        if (!row || !lab) return;
        const mine = allModels().filter(m => m.lab === id).sort((a, b) => num(b.benchmarks.ELO) - num(a.benchmarks.ELO));
        this._detail('lab', id, `${lab.icon || '•'} ${row.name}`, row.color,
            this._kv('Region', COUNTRY_NAMES[String(lab.region).toLowerCase()] || row.region) +
            this._kv('Public proxy', row.ticker || 'private') +
            this._kv('Models tracked', row.models) +
            this._kv('Open weights', `${row.os} / ${row.models}`) +
            this._kv('Avg benchmark', row.score != null ? row.score.toFixed(1) : '—') +
            this._kv('Flagship', row.flagship || '—') +
            this._kv('Top ELO', row.elo != null ? Math.round(row.elo) : '—') +
            `<div class="tm-spark-lbl" style="margin-top:8px">ROSTER</div>` +
            mine.slice(0, 12).map(x => `<div class="tm-kv" data-action="model:${esc(x.id)}" style="cursor:pointer">
                <span>${esc(x.name)}${x.os ? ' <span class="tm-pill">OS</span>' : ''}</span>
                <b>${Math.round(num(x.benchmarks.ELO))}</b></div>`).join(''));
        this._goto('labs');
    },

    _detailModel(id) {
        const x = allModels().find(y => y.id === id);
        if (!x) return;
        const lab = LABS_()[x.lab] || {};
        const b = x.benchmarks;
        const cost = obj(COSTS)[x.id];
        const ctx = obj(CTX)[x.id];
        this._detail('model', id, x.name, lab.color,
            this._kv('Lab', lab.name || x.lab) +
            this._kv('Phase', x.phase || '—') +
            this._kv('Weights', x.os ? 'open' : 'closed') +
            (x.rel ? this._kv('Released', x.rel) : '') +
            (x.seeded ? '' : '<div class="tm-sub">Benchmarks are city estimates for roster models.</div>') +
            bars(['MMLU', 'HumanEval', 'MATH', 'GPQA'].map(k => ({
                label: k, pct: num(b[k]), value: num(b[k]).toFixed(0), color: '#22d3ee'
            }))) +
            this._kv('Arena ELO', Math.round(num(b.ELO))) +
            (ctx ? this._kv('Context', ctx.toLocaleString() + ' tok') : '') +
            (cost ? this._kv('Price in/out', `$${cost.input}/$${cost.output} per 1M`) : '') +
            (x.desc ? `<div class="tm-sub" style="margin-top:6px">${esc(x.desc)}</div>` : ''));
    },

    _detailCountry(id) {
        const m = this.model || buildTerminalModel(G);
        const c = m.countries.find(x => x.id === id);
        if (!c) return;
        const rows = m.countries.filter(o => o.id !== id)
            .map(o => ({ o, s: relationScore(id, o.id) }))
            .sort((a, b) => b.s - a.s);
        this._detail('country', id, `${c.code} — ${c.name}`, COUNTRY_COLORS[id],
            bars(rows.map(r => ({
                label: r.o.code, pct: r.s, value: r.s,
                color: r.s >= 75 ? '#22c55e' : r.s >= 55 ? '#84cc16' : r.s >= 35 ? '#f59e0b' : '#ef4444'
            }))) +
            `<div class="tm-sub" style="margin-top:6px">Bilateral posture across export controls, compute sharing and joint safety work.</div>`);
        this._filter.embassy = id;
        this._sig.embassy = null;
        this._renderEmbassy();
        this._goto('embassy');
    },

    _detailDc(id) {
        const d = DCF_().find(x => x && x.id === id);
        if (!d) return;
        this._detail('dc', id, d.name || id, d.color || '#38bdf8',
            this._kv('Operator', d.operator || '—') +
            this._kv('Location', d.location || '—') +
            this._kv('Class', d.type === 'chipfab' ? 'chip fab' : 'data centre') +
            this._kv('Status', d.status === 'construction' ? `under construction (${d.completion || 'TBD'})` : 'operational') +
            (d.power_mw ? this._kv('Power draw', d.power_mw + ' MW') : '') +
            (d.gpus ? this._kv('Accelerators', d.gpus) : '') +
            (d.cooling ? this._kv('Cooling', d.cooling) : '') +
            (d.process ? this._kv('Process', d.process) : '') +
            (d.investment ? this._kv('Investment', d.investment) : '') +
            (d.desc ? `<div class="tm-sub" style="margin-top:6px">${esc(d.desc)}</div>` : ''));
        this._goto('compute');
    },

    // ── panel rendering ──────────────────────────────────────────────────
    _body(id) { return this.el?.querySelector('#tm-body-' + id); },
    /** Only rewrite a panel when its inputs actually changed. */
    _dirty(id, sig) {
        if (this._sig[id] === sig) return false;
        this._sig[id] = sig;
        return true;
    },

    _renderAll(force) {
        if (force) this._sig = {};
        this._renderTop();
        this._renderLabs();
        this._renderNews();
        this._renderAlignment();
        this._renderEmbassy();
        this._renderKardashev();
        this._renderCompute();
        this._renderCapital();
        this._renderPower();
        this._renderSupply();
        this._renderAgents();
        this._renderPopulation();
        this._renderRobotics();
        this._renderLongevity();
    },

    _renderTop() {
        const m = this.model;
        if (!m || !this.el) return;
        const set = (id, v) => { const n = this.el.querySelector('#tm-' + id); if (n && n.textContent !== String(v)) n.textContent = v; };
        set('aiindex', Math.round(m.aiIndex));
        set('kscale', m.kardashev.k.toFixed(3));
        set('citizens', m.pop);
        set('blds', m.buildings);
        set('mw', fmt(m.infra.liveMw));
        set('clock', m.clock);
        const src = this.el.querySelector('#tm-foot-src');
        if (src) {
            const tag = m.live?.online ? 'LIVE' : (m.source === 'offline' ? 'STATIC' : 'CACHED');
            src.textContent = `${tag} · ${arr(m.live?.sources).join(' ') || 'static'} · ${esc(m.weather)} · ${esc(m.district)}`;
        }
    },

    // 1 · AI LABS — sortable
    _renderLabs() {
        const host = this._body('labs');
        if (!host) return;
        let rows = (this.model || buildTerminalModel(G)).labs;
        const f = this._filter.labs;
        if (f) rows = rows.filter(r => r.region === f);
        const { col, dir } = this._labsSort;
        const mul = dir === 'asc' ? 1 : -1;
        const get = r => ({
            name: String(r.name).toLowerCase(), region: r.region, models: r.models,
            score: r.score == null ? -1 : r.score, elo: r.elo == null ? -1 : r.elo,
            os: r.os, flagship: String(r.flagship || '').toLowerCase()
        })[col] ?? 0;
        rows = rows.slice().sort((a, b) => {
            const av = get(a), bv = get(b);
            if (av < bv) return -mul;
            if (av > bv) return mul;
            return num(b.elo, -1) - num(a.elo, -1);
        });
        const sig = `${col}${dir}${f}${rows.length}${rows.slice(0, 8).map(r => r.id + Math.round(num(r.elo))).join('')}`;
        if (!this._dirty('labs', sig)) return;
        if (!rows.length) { host.innerHTML = '<div class="tm-empty">No labs match this filter.</div>'; return; }

        const arrow = c => (col !== c ? '' : dir === 'asc' ? ' ▴' : ' ▾');
        host.innerHTML = `
            ${f ? `<div class="tm-pill" data-action="labsfilter:${esc(f)}" style="cursor:pointer;margin-bottom:4px">FILTER · ${esc(f)} ✕</div>` : ''}
            <table class="tm-table">
                <thead><tr>
                    <th class="tm-rank">#</th>
                    <th data-col="name" title="Lab name">LAB${arrow('name')}</th>
                    <th data-col="region" title="HQ region — click a cell to filter">REG${arrow('region')}</th>
                    <th data-col="models" class="tm-num" title="Models tracked in the city">MDL${arrow('models')}</th>
                    <th data-col="os" class="tm-num" title="Open-weight releases">OS${arrow('os')}</th>
                    <th data-col="score" class="tm-num" title="Mean of MMLU · HumanEval · MATH · GPQA">AVG${arrow('score')}</th>
                    <th data-col="flagship" title="Highest-ELO model">FLAGSHIP${arrow('flagship')}</th>
                    <th data-col="elo" class="tm-num" title="Arena ELO of the flagship">ELO${arrow('elo')}</th>
                </tr></thead>
                <tbody>${rows.map((r, i) => `
                    <tr data-action="lab:${esc(r.id)}">
                        <td class="tm-rank">${i + 1}</td>
                        <td><span class="tm-lab-dot" style="background:${esc(r.color)}"></span>${esc(r.name)}${r.apex ? ' <span class="tm-apex">♕</span>' : ''}</td>
                        <td data-action="labsfilter:${esc(r.region)}">${esc(r.region)}</td>
                        <td class="tm-num">${r.models}</td>
                        <td class="tm-num">${r.os}</td>
                        <td class="tm-num">${r.score == null ? '—' : r.score.toFixed(0)}</td>
                        <td>${esc(r.flagship || '—')}</td>
                        <td class="tm-num tm-elo">${r.elo == null ? '—' : Math.round(r.elo)}</td>
                    </tr>`).join('')}</tbody>
            </table>`;
    },

    // 2 · LIVE NEWS
    _renderNews() {
        const host = this._body('news');
        if (!host) return;
        const m = this.model || buildTerminalModel(G);
        const items = arr(m.news);
        const sig = 'n' + items.length + (items[0]?.headline || items[0]?.title || '').slice(0, 48);
        if (!this._dirty('news', sig)) return;
        if (!items.length) { host.innerHTML = '<div class="tm-empty">Wire silent.</div>'; return; }
        host.innerHTML = items.map(n => {
            const t = n.headline || n.title || '';
            const src = String(n.source || 'WIRE').toUpperCase().replace(/\s+/g, '').slice(0, 10);
            const link = n.url && n.url !== '#'
                ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t);
            return `<div class="tm-news-row" title="${esc(t)}"><span class="tm-news-src">${esc(src)}</span><span class="tm-news-t">${link}</span></div>`;
        }).join('');
    },

    // 3 · ALIGNMENT
    _renderAlignment() {
        const host = this._body('alignment');
        if (!host) return;
        const orgs = (this.model || buildTerminalModel(G)).alignment;
        if (!this._dirty('alignment', 'a' + orgs.length)) return;
        if (!orgs.length) { host.innerHTML = '<div class="tm-empty">Alignment Forest not populated.</div>'; return; }
        host.innerHTML = orgs.map(o => `
            <div class="tm-align-card">
                <div class="tm-align-top"><span class="tm-align-name">${esc(o.emoji)} ${esc(o.name)}</span>
                    <span class="tm-align-year">${esc(o.founded || '')}</span></div>
                <div class="tm-align-focus">${esc(o.focus || o.desc || '')}</div>
                <div class="tm-align-meta"><span>${esc(o.lead || '')}</span><span>${esc(o.location || '')}</span></div>
            </div>`).join('');
    },

    // 4 · EMBASSY RELATIONS — matrix
    _renderEmbassy() {
        const host = this._body('embassy');
        if (!host) return;
        const cs = (this.model || buildTerminalModel(G)).countries;
        const focus = this._filter.embassy;
        if (!this._dirty('embassy', 'e' + cs.map(c => c.id).join() + focus)) return;
        if (cs.length < 2) { host.innerHTML = '<div class="tm-empty">No diplomatic presence.</div>'; return; }
        const cls = s => s === null ? 'tm-m-self' : s >= 75 ? 'tm-m-good' : s >= 55 ? 'tm-m-neutral' : s >= 35 ? 'tm-m-cool' : 'tm-m-cold';
        host.innerHTML = `
            <table class="tm-matrix">
                <thead><tr><th></th>${cs.map(c => `<th style="color:${esc(COUNTRY_COLORS[c.id] || '#7d92ab')}" title="${esc(c.name)}">${esc(c.code)}</th>`).join('')}</tr></thead>
                <tbody>${cs.map(r => `<tr>
                    <th style="color:${esc(COUNTRY_COLORS[r.id] || '#7d92ab')}" title="${esc(r.name)}" data-action="country:${esc(r.id)}">${esc(r.code)}</th>
                    ${cs.map(c => {
                        const s = relationScore(r.id, c.id);
                        const dim = focus && focus !== r.id && focus !== c.id ? ' tm-dim' : '';
                        const act = s === null ? '' : ` data-action="country:${esc(r.id)}"`;
                        return `<td class="${cls(s)}${dim}" title="${esc(r.code)} → ${esc(c.code)}${s === null ? ' (self)' : ' · ' + s + '/100'}"${act}>${s === null ? '·' : s}</td>`;
                    }).join('')}</tr>`).join('')}</tbody>
            </table>
            <div class="tm-m-legend">
                <span><span class="tm-m-dot tm-m-good"></span>aligned</span>
                <span><span class="tm-m-dot tm-m-neutral"></span>neutral</span>
                <span><span class="tm-m-dot tm-m-cool"></span>tense</span>
                <span><span class="tm-m-dot tm-m-cold"></span>restricted</span>
                ${focus ? `<span class="tm-pill" data-action="embassy:${esc(focus)}" style="cursor:pointer">FOCUS ${esc(focus.toUpperCase())} ✕</span>` : ''}
            </div>`;
    },

    // 5 · KARDASHEV — radar + milestone
    _renderKardashev() {
        const host = this._body('kardashev');
        if (!host) return;
        const m = this.model || buildTerminalModel(G);
        const k = m.kardashev.k;
        if (!this._dirty('kardashev', 'k' + k.toFixed(4) + History.series('kscore').length)) return;
        const MILESTONES = [
            { k: 0.25, name: 'DIGITAL SUBSTRATE' }, { k: 0.45, name: 'INDUSTRIAL AI' },
            { k: 0.65, name: 'CONTINENTAL GRID' }, { k: 0.85, name: 'NEAR TYPE-I' }, { k: 1.0, name: 'TYPE I' }
        ];
        const next = MILESTONES.find(x => x.k > k);
        host.innerHTML = `
            <div class="tm-k-layout">
                <div class="tm-k-left">
                    <div class="tm-stat-big"><span class="tm-stat-unit">K</span><span class="tm-stat-num">${k.toFixed(3)}</span></div>
                    <div class="tm-sub">${esc(m.kardashev.tier)}</div>
                    <div>
                        <div class="tm-kprog-track"><i style="width:${(k * 100).toFixed(1)}%"></i></div>
                        <div class="tm-kprog-labels"><span>0.000</span><span>1.000 · Type I</span></div>
                    </div>
                    <div class="tm-k-next">${next ? `▲ NEXT · ${esc(next.name)} @ K ${next.k.toFixed(2)} (${(next.k - k).toFixed(3)} to go)` : '⟡ APEX — Type I reached'}</div>
                    <div>
                        <div class="tm-spark-lbl">K-SCORE TREND ${deltaChip('kscore', 3)}</div>
                        ${svgSpark(History.series('kscore'), { w: 230, h: 30, color: '#fbbf24' })}
                    </div>
                    <div>
                        <div class="tm-spark-lbl">AI INDEX ${deltaChip('aiIndex', 0)}</div>
                        ${svgSpark(History.series('aiIndex'), { w: 230, h: 26, color: '#22d3ee' })}
                    </div>
                </div>
                <div class="tm-k-right">
                    ${svgRadar(m.pillars, { size: 168, pad: 24 })}
                    <div class="tm-k-pillars">${m.pillars.map(p =>
                        `<span class="tm-k-pillar" title="${esc(p.key)}">${esc(p.label)} <b>${Math.round(p.value * 100)}</b></span>`).join('')}</div>
                </div>
            </div>`;
    },

    // 6 · COMPUTE INFRA
    _renderCompute() {
        const host = this._body('compute');
        if (!host) return;
        const m = this.model || buildTerminalModel(G);
        const c = m.infra;
        if (!this._dirty('compute', 'c' + c.liveMw + c.pipelineMw + c.facilities)) return;
        const trend = c.trends.map(t => Math.log10(Math.max(1, num(t.flops))));
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col">
                    ${svgDonut(c.segments, { size: 76, thick: 11, center: fmt(c.liveMw), centerSub: 'MW LIVE' })}
                </div>
                <div class="tm-col tm-col-grow">
                    <div class="tm-legend">${c.segments.slice(0, 6).map(s =>
                        `<span><i style="background:${esc(s.color)}"></i>${esc(s.label)} · ${fmt(s.value)} MW</span>`).join('')}</div>
                </div>
                <div class="tm-col tm-col-grow">
                    ${this._kv('Facilities', `${c.facilities} DC · ${c.fabs} fab`)}
                    ${this._kv('Pipeline', fmt(c.pipelineMw) + ' MW under construction')}
                    ${this._kv('Largest cluster', (c.clusters.slice().sort((a, b) => num(b.gpus) - num(a.gpus))[0]?.name) || '—')}
                    <div class="tm-spark-lbl" style="margin-top:3px">LIVE MW ${deltaChip('mw', 0)}</div>
                    ${svgSpark(History.series('mw'), { w: 150, h: 22, color: '#38bdf8' })}
                </div>
                <div class="tm-col tm-col-grow">
                    <div class="tm-spark-lbl">TRAINING FLOP CEILING (log10, ${c.trends[0]?.year || '—'}→${c.trends[c.trends.length - 1]?.year || '—'})</div>
                    ${svgSpark(trend, { w: 190, h: 34, color: '#a78bfa' })}
                    <div class="tm-sub">${c.clusters.length} tracked clusters · ${fmt(c.clusters.reduce((s, x) => s + num(x.gpus), 0))} accelerators</div>
                </div>
            </div>`;
    },

    // 7 · THE TAPE
    _renderCapital() {
        const host = this._body('capital');
        if (!host) return;
        const m = this.model || buildTerminalModel(G);
        if (!this._dirty('capital', 'cap' + m.tape.length + m.deals + m.papers)) return;
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col"><div class="tm-big">${m.deals}</div><div class="tm-sub">ROUNDS CLOSED</div></div>
                <div class="tm-col"><div class="tm-big">${m.papers}</div><div class="tm-sub">PREPRINTS</div></div>
                <div class="tm-col"><div class="tm-big">${num(m.court?.rulings)}</div><div class="tm-sub">RULINGS</div></div>
                <div class="tm-col"><div class="tm-big">${num(m.jail?.inmates)}</div><div class="tm-sub">DETAINED</div></div>
                <div class="tm-col tm-col-grow">
                    ${m.tape.slice(0, 4).map(i => `<div class="tm-kv"><span style="color:${esc(i.c)}">${esc(i.k)}</span><b style="font-weight:400;color:#9fb3c8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:340px">${esc(i.text)}</b></div>`).join('')}
                </div>
            </div>`;
        this._renderTape();
    },

    _renderTape() {
        const track = this.el?.querySelector('#tm-tape-track');
        if (!track) return;
        const items = (this.model || buildTerminalModel(G)).tape;
        if (!items.length) { track.innerHTML = ''; return; }
        const html = items.map(i =>
            `<span class="tm-tape-i"><span class="tm-tape-k" style="color:${esc(i.c)}">${esc(i.k)}</span>${esc(i.text)}</span>`).join('');
        const next = html + html;   // duplicated so the marquee wraps seamlessly
        if (track.innerHTML !== next) track.innerHTML = next;
    },

    // 8 · POWER GRID
    _renderPower() {
        const host = this._body('power');
        if (!host) return;
        const p = (this.model || buildTerminalModel(G)).power;
        if (!this._dirty('power', 'p' + p.supply + p.demand)) return;
        const margin = Math.max(-1, Math.min(1, p.margin));
        host.innerHTML = `
            <div class="tm-cols" style="align-items:flex-start">
                <div class="tm-col">${svgDonut(p.sources.map(s => ({ label: s.label, value: Math.max(0, s.mw), color: s.color })),
                    { size: 78, thick: 11, center: fmt(p.supply), centerSub: 'MW GEN' })}</div>
                <div class="tm-col tm-col-grow">
                    <div class="tm-legend">${p.sources.map(s =>
                        `<span><i style="background:${esc(s.color)}"></i>${esc(s.label)} · ${Math.max(0, s.mw)} MW</span>`).join('')}</div>
                </div>
            </div>
            ${this._kv('Demand', fmt(p.demand) + ' MW')}
            ${this._kv('Reserve margin', (margin * 100).toFixed(1) + '%')}
            <div class="tm-bar-row"><span class="tm-bar-l">headroom</span>
                <span class="tm-bar-t"><i style="width:${Math.max(2, Math.min(100, margin * 100)).toFixed(0)}%;background:${margin < 0.05 ? '#ef4444' : margin < 0.15 ? '#fbbf24' : '#4ade80'}"></i></span>
                <span class="tm-bar-v">${p.reserve >= 0 ? '+' : ''}${fmt(p.reserve)}</span></div>
            <div class="tm-spark-lbl" style="margin-top:4px">SUPPLY ${deltaChip('supply', 0)} · DEMAND ${deltaChip('demand', 0)}</div>
            ${svgSpark(History.series('supply'), { w: 240, h: 24, color: '#4ade80' })}
            ${svgSpark(History.series('demand'), { w: 240, h: 24, color: '#f87171' })}`;
    },

    // 9 · SUPPLY CHAIN
    _renderSupply() {
        const host = this._body('supply');
        if (!host) return;
        const s = (this.model || buildTerminalModel(G)).supply;
        const bn = arr(s.bottlenecks), fo = arr(s.foundries), ac = arr(s.accelerators);
        if (!this._dirty('supply', 's' + bn.length + fo.length + ac.length)) return;
        if (!bn.length && !fo.length && !ac.length) { host.innerHTML = '<div class="tm-empty">Supply chain data unavailable.</div>'; return; }
        host.innerHTML = `
            <div class="tm-spark-lbl">BOTTLENECKS</div>
            ${bars(bn.map(b => ({ label: b.name, pct: num(b.load), value: num(b.load) + '%', color: b.color, title: b.name })))}
            <div class="tm-spark-lbl" style="margin-top:6px">FOUNDRIES</div>
            <table class="tm-table"><tbody>${fo.map(f =>
                `<tr title="${esc(f.capacity || '')}"><td>${esc(f.name)}</td><td>${esc(f.node)}</td><td>${esc(f.packaging || '')}</td></tr>`).join('')}</tbody></table>
            <div class="tm-spark-lbl" style="margin-top:6px">ACCELERATORS</div>
            <table class="tm-table"><tbody>${ac.map(a =>
                `<tr title="${esc(a.price || '')}"><td>${esc(a.name)}</td><td>${esc(a.memory)}</td><td class="tm-num">${esc(a.status)}</td></tr>`).join('')}</tbody></table>`;
    },

    // 10 · AGENTS
    _renderAgents() {
        const host = this._body('agents');
        if (!host) return;
        const a = (this.model || buildTerminalModel(G)).agents;
        if (!this._dirty('agents', 'ag' + a.active + a.queued + a.errRate.toFixed(3))) return;
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col"><div class="tm-big">${fmt(a.active)}</div><div class="tm-sub">ACTIVE SWARMS</div></div>
                <div class="tm-col">${svgGauge(a.errRate / 0.25, { label: (a.errRate * 100).toFixed(1) + '%' })}
                    <div class="tm-sub" style="text-align:center">ERROR RATE</div></div>
            </div>
            ${this._kv('Queued tasks', fmt(a.queued))}
            ${this._kv('Tool registry', fmt(a.tools) + ' tools')}
            ${this._kv('Throughput', fmt(a.throughput) + ' task/min')}
            <div class="tm-spark-lbl" style="margin-top:4px">ACTIVE ${deltaChip('agents', 0)}</div>
            ${svgSpark(History.series('agents'), { w: 240, h: 28, color: '#5eead4' })}
            <div class="tm-spark-lbl">ERROR % ${deltaChip('errors', 2)}</div>
            ${svgSpark(History.series('errors'), { w: 240, h: 22, color: '#f87171' })}`;
    },

    // 11 · POPULATION
    _renderPopulation() {
        const host = this._body('population');
        if (!host) return;
        const m = this.model || buildTerminalModel(G);
        const list = arr(G.citizens?.list);
        const byLab = {};
        for (const c of list) {
            const id = c?.model?.lab || c?.lab || 'other';
            byLab[id] = (byLab[id] || 0) + 1;
        }
        const segs = Object.entries(byLab).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([id, v]) => ({ label: LABS_()[id]?.name || id, value: v, color: LABS_()[id]?.color || '#94a3b8' }));
        if (!this._dirty('population', 'pop' + m.pop + segs.length)) return;
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col"><div class="tm-big">${m.pop}</div><div class="tm-sub">CITIZENS</div>
                    ${svgSpark(History.series('pop'), { w: 100, h: 20, color: '#a78bfa' })}</div>
                <div class="tm-col">${svgDonut(segs, { size: 66, thick: 9 })}</div>
                <div class="tm-col tm-col-grow"><div class="tm-legend">${segs.slice(0, 6).map(s =>
                    `<span><i style="background:${esc(s.color)}"></i>${esc(s.label)} · ${s.value}</span>`).join('')}</div></div>
                <div class="tm-col tm-col-grow">
                    ${this._kv('Districts', m.districts)}
                    ${this._kv('Named buildings', m.buildings)}
                    ${this._kv('Metro lines', m.metro.length)}
                </div>
            </div>`;
    },

    // 12 · ROBOTICS
    _renderRobotics() {
        const host = this._body('robotics');
        if (!host) return;
        const r = Object.entries((this.model || buildTerminalModel(G)).robotics);
        if (!this._dirty('robotics', 'r' + r.length)) return;
        if (!r.length) { host.innerHTML = '<div class="tm-empty">No robotics programs tracked.</div>'; return; }
        const t = num(G.time, 0);
        const curve = [];
        for (let i = 0; i < 14; i++) curve.push(1200 * Math.pow(1.28, i) + wave('rob' + i, 9, 400, t));
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col"><div class="tm-big">${r.length}</div><div class="tm-sub">PROGRAMS</div></div>
                <div class="tm-col tm-col-grow">
                    <div class="tm-spark-lbl">FLEET SCALING CURVE</div>
                    ${svgSpark(curve, { w: 170, h: 28, color: '#fb923c' })}
                </div>
                <div class="tm-col tm-col-grow" style="max-height:74px;overflow:auto">
                    ${r.map(([id, c]) => `<div class="tm-kv" title="${esc(c.desc || '')}"><span>${esc(c.icon || '🤖')} ${esc(c.name)}</span><b style="font-weight:400;color:#546a85">${esc(c.ceo || '')}</b></div>`).join('')}
                </div>
            </div>`;
    },

    // 13 · LONGEVITY
    _renderLongevity() {
        const host = this._body('longevity');
        if (!host) return;
        const l = Object.entries((this.model || buildTerminalModel(G)).longevity);
        if (!this._dirty('longevity', 'l' + l.length)) return;
        if (!l.length) { host.innerHTML = '<div class="tm-empty">No longevity programs tracked.</div>'; return; }
        const t = num(G.time, 0);
        const series = k => Array.from({ length: 16 }, (_, i) => 40 + i * (k === 'c' ? 9 : k === 't' ? 3.2 : 6) + wave(k + i, 11, 7, t));
        host.innerHTML = `
            <div class="tm-cols">
                <div class="tm-col tm-col-grow"><div class="tm-spark-lbl">COMPOUNDS</div>${svgSpark(series('c'), { w: 120, h: 24, color: '#4ade80' })}</div>
                <div class="tm-col tm-col-grow"><div class="tm-spark-lbl">TRIALS</div>${svgSpark(series('t'), { w: 120, h: 24, color: '#fbbf24' })}</div>
                <div class="tm-col tm-col-grow"><div class="tm-spark-lbl">GENOMES</div>${svgSpark(series('g'), { w: 120, h: 24, color: '#38bdf8' })}</div>
                <div class="tm-col tm-col-grow" style="max-height:74px;overflow:auto">
                    ${l.map(([id, c]) => `<div class="tm-kv" title="${esc(c.desc || '')}"><span>${esc(c.icon || '🧬')} ${esc(c.name)}</span><b style="font-weight:400;color:#546a85">${esc(c.ceo || '')}</b></div>`).join('')}
                </div>
            </div>`;
    },

    snapshot() {
        return {
            open: this.open,
            boundKey: 'KeyD',
            aliases: ['Backquote', 'Ctrl+KeyD', 'Slash (focus command bar)'],
            hasEl: !!this.el,
            panels: PANELS.map(p => p.id),
            watching: this._watchLoad().length,
            series: Object.keys(History.load()).length,
            modelKeys: Object.keys(buildTerminalModel(G))
        };
    }
};
