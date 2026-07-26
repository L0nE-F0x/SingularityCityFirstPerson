// ════════════════════════════════════════════════════════════════════════════
// SC EVENTS COLLECTOR — Netlify Scheduled Function (hourly).
//
// Polls multiple live AI/industry data sources, classifies each entry into
// one of the city's reaction archetypes, and upserts into the Supabase
// sc_events table. The client reads from this table on boot so reactions,
// Citizen of the Day picks, and Daily Briefings work even when the user
// hasn't had the city open for days — events accumulate server-side.
//
// Sources:
//   • Hacker News AI-tagged stories  → reaction archetypes via keywords
//   • HuggingFace lab orgs           → 'release' / Launch Party at author lab
//   • Launch Library 2 launches      → 'launch' (informational; reaction
//                                       archetype is a future addition)
//   • arXiv AI papers                → only those tied to a known lab
//   • ZeroEval leaderboard           → first time each model holds #1
//   • Finnhub AI-stock moves         → ≥3% moves trigger celebrate/crisis
//
// Required env vars:
//   SUPABASE_URL          — Project URL
//   SUPABASE_SERVICE_KEY  — Service role key (bypasses RLS for writes)
//
// Schedule: hourly. The unique PK (`source:source_id`) makes re-runs no-ops.
// ════════════════════════════════════════════════════════════════════════════

import { AI_TITLE_RE } from './_shared/ai-keywords.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── HELPERS ────────────────────────────────────────────────────────────────
async function fetchJSON(url, opts = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, ...opts });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`[fetch] ${url} — ${e.message}`);
        return null;
    }
}

function utcDateString(d) {
    d = d || new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ─── CLASSIFIER (mirrors js/news_reactivity.js — keep in sync) ──────────────
// Order matters: first match wins. Founder names included because HN headlines
// often reference Sam Altman / Elon / etc. rather than the lab.
const LAB_KEYWORDS = [
    ['anthropic',    /\b(anthropic|claude|dario amodei|amodei)\b/i],
    ['openai',       /\b(openai|chatgpt|sam altman|altman|gpt-?\d|sora|o1|o3|o4)\b/i],  // no bare o2 — matches 'O2 arena'
    ['google',       /\b(google|deepmind|gemini|hassabis|pichai|alphabet)\b/i],
    ['xai',          /\b(xai|x\.ai|grok|elon musk|musk)\b/i],
    ['meta',         /\b(meta|llama|zuckerberg|mark zuck|fb research)\b/i],
    ['mistral',      /\b(mistral|arthur mensch|mensch|mixtral)\b/i],
    ['deepseek',     /\b(deepseek|liang wenfeng)\b/i],
    ['microsoft',    /\b(microsoft|nadella|copilot|bing chat)\b/i],
    ['nvidia',       /\b(nvidia|jensen huang|cuda|h100|h200|b100|blackwell)\b/i],
    ['tesla',        /\b(tesla|optimus)\b/i],
    ['alibaba',      /\b(alibaba|qwen|tongyi)\b/i],
    ['cohere',       /\b(cohere|aidan gomez|command r)\b/i],
    ['perplexity',   /\b(perplexity|aravind)\b/i],
    ['stability',    /\b(stable diffusion|stability ai)\b/i],
    ['hugging_face', /\b(hugging ?face)\b/i]
];
const SENTIMENT = {
    emergency:  /\b(fired|lawsuit|sued|breach(es|ed)?|hack(ed|s)?|leak(ed|s)?|exposed|whistleblow|board fires|departs|resigns|stepping down|class action|criminal|fraud|insider trading)\b/i,
    regulatory: /\b(regulation|regulat(es|ed|ing)|ban(ned)?|eu ai act|congress|senate|ftc|doj|antitrust|hearing|subpoena|investig(ation|ates)|complaint|fines?|copyright suit)\b/i,
    crisis:     /\b(controversy|criticized|under fire|backlash|outage|down|crash|recall|apologi[sz]e|delays?|deprecat(es|ed|ing)|shut(s|ting)? down)\b/i,
    celebrate:  /\b(raises?|releases?|launches?|launched|ships?|shipped|announces?|unveils?|debuts?|tops?|beats?|sets record|breakthrough|introduces?|open[- ]?sources?|funded|partnership|partners with|acquires?|valuation|ipo|integration with)\b/i
};
const ARCHETYPES = {
    celebrate:  { archetype: 'Launch Party',     emoji: '🎉' },
    crisis:     { archetype: 'Crisis Flicker',   emoji: '😰' },
    emergency:  { archetype: 'Emergency Huddle', emoji: '🚁' },
    regulatory: { archetype: 'Court Convene',    emoji: '⚖️' }
};

// Skip these prefixes when defaulting unscored stories to 'celebrate' — they
// indicate user-content / tutorials / Q&A rather than industry news.
const NOT_NEWS_PREFIX = /^(show hn|ask hn|how to|tutorial|guide|why does|why is|why are|explained|the case for|the case against|q&a|interview with)/i;

function classifyTitle(title) {
    const t = String(title || '');
    let lab = null;
    for (const [labId, re] of LAB_KEYWORDS) {
        if (re.test(t)) { lab = labId; break; }
    }
    let sentiment = null;
    if      (SENTIMENT.emergency.test(t))  sentiment = 'emergency';
    else if (SENTIMENT.regulatory.test(t)) sentiment = 'regulatory';
    else if (SENTIMENT.crisis.test(t))     sentiment = 'crisis';
    else if (SENTIMENT.celebrate.test(t))  sentiment = 'celebrate';
    // Fallback: lab matched clearly but no sentiment verb — default to
    // 'celebrate' (Launch Party) UNLESS the headline is obviously a tutorial,
    // Show HN, or Q&A. This loosens the gate so we capture stories like
    // "GPT-4 architecture deep dive" or "Anthropic publishes research paper"
    // where the headline mentions a lab but lacks an explicit sentiment verb.
    else if (lab && !NOT_NEWS_PREFIX.test(t)) {
        sentiment = 'celebrate';
    }
    return { lab, sentiment };
}

// HuggingFace model author → lab id (heuristic).
const HF_AUTHOR_LAB = {
    'anthropic':              'anthropic',
    'openai':                 'openai',
    'google':                 'google',
    'google-deepmind':        'google',
    'meta-llama':             'meta',
    'meta':                   'meta',
    'mistralai':              'mistral',
    'deepseek-ai':            'deepseek',
    'microsoft':              'microsoft',
    'nvidia':                 'nvidia',
    'tesla':                  'tesla',
    'qwen':                   'alibaba',
    'alibaba':                'alibaba',
    'cohere':                 'cohere',
    'perplexity-ai':          'perplexity',
    'stabilityai':            'stability'
};

// ─── HACKER NEWS ────────────────────────────────────────────────────────────
// Keyword filter shared with hn-ai-stories.mjs / publish-newspaper-edition.mjs.
const HN_RE = AI_TITLE_RE;

async function collectFromHN() {
    const ids = await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!Array.isArray(ids)) return [];
    const candidates = ids.slice(0, 60);
    const items = await Promise.all(candidates.map(id =>
        fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    ));
    const out = [];
    for (const it of items) {
        if (!it || it.type !== 'story' || !it.title || it.deleted || it.dead) continue;
        if (!HN_RE.test(it.title)) continue;
        const { lab, sentiment } = classifyTitle(it.title);
        if (!sentiment) continue;            // unclassified → skip
        const arche = ARCHETYPES[sentiment];
        const ts = it.time ? new Date(it.time * 1000) : new Date();
        out.push({
            id: 'hn:' + it.id,
            source: 'hn',
            event_type: sentiment,
            archetype: arche.archetype,
            emoji: arche.emoji,
            lab,
            title: it.title,
            url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
            score: Math.min(100, Math.max(0, it.score || 0)),
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return out;
}

// ─── HUGGINGFACE TRENDING ───────────────────────────────────────────────────
async function collectFromHF() {
    // Per-author queries: ask each known lab org for their 3 most recent
    // models. A global sort=createdAt query was hopeless — major-lab models
    // (~few per week) are drowned out of the top 100 by personal uploads.
    // Querying each org directly lets us reliably capture their newest model
    // even if it's days old.
    const authors = Object.keys(HF_AUTHOR_LAB);
    const requests = authors.map(async (author) => {
        const list = await fetchJSON(
            `https://huggingface.co/api/models?author=${encodeURIComponent(author)}&sort=lastModified&direction=-1&limit=3&full=true`
        );
        return { author, list: Array.isArray(list) ? list : [] };
    });
    const settled = await Promise.all(requests);

    const out = [];
    const seenLabs = new Set();   // one event per lab per run
    for (const { author, list } of settled) {
        if (!list.length) continue;
        const lab = HF_AUTHOR_LAB[author];
        if (!lab || seenLabs.has(lab)) continue;

        // Pick the freshest model from this org that's within the window
        for (const m of list) {
            if (!m || !m.id) continue;
            const tsRaw = m.createdAt || m.lastModified || m.created_at;
            const ts = tsRaw ? new Date(tsRaw) : new Date();
            // Window: 30 days. Wide enough that a slow-week lab still
            // contributes; tight enough that we don't briefing-spam old news.
            const ageDays = (Date.now() - ts.getTime()) / 86400000;
            if (ageDays > 30) continue;

            const modelName = String(m.id).split('/')[1] || m.id;
            out.push({
                id: 'hf:' + m.id,
                source: 'hf',
                event_type: 'celebrate',
                archetype: 'Launch Party',
                emoji: '🎉',
                lab,
                title: `New release from ${labLabel(lab)}: ${modelName}`,
                url: `https://huggingface.co/${m.id}`,
                score: Math.min(100, Math.floor(Math.log10((m.downloads || 0) + 1) * 12)),
                ts: ts.toISOString(),
                event_date: utcDateString(ts)
            });
            seenLabs.add(lab);
            break;        // one per lab
        }
    }
    return out;
}

function labLabel(labId) {
    const names = {
        openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google DeepMind',
        xai: 'xAI', meta: 'Meta', mistral: 'Mistral', deepseek: 'DeepSeek',
        microsoft: 'Microsoft', nvidia: 'NVIDIA', tesla: 'Tesla',
        alibaba: 'Alibaba', cohere: 'Cohere', perplexity: 'Perplexity',
        stability: 'Stability AI', hugging_face: 'Hugging Face'
    };
    return names[labId] || labId;
}

// ─── LAUNCH LIBRARY 2 (rocket launches) ─────────────────────────────────────
// Logged as informational events. Phase 2 will wire a 🚀 archetype that
// triggers a rocket animation at the space port; for now they're stored but
// the client will filter them out of reaction triggers.
async function collectFromLaunchLib() {
    // Upcoming launches in next 7 days
    const data = await fetchJSON(
        'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&hide_recent_previous=true'
    );
    if (!data || !Array.isArray(data.results)) return [];
    const out = [];
    for (const r of data.results) {
        if (!r || !r.id || !r.net) continue;
        const ts = new Date(r.net);
        const ageDays = Math.abs(Date.now() - ts.getTime()) / 86400000;
        if (ageDays > 7) continue;
        const provider = (r.launch_service_provider && r.launch_service_provider.name) || 'Unknown';
        out.push({
            id: 'll2:' + r.id,
            source: 'launch_lib',
            event_type: 'launch',
            archetype: 'Launch Party',
            emoji: '🚀',
            lab: null,
            title: `${provider} launch: ${r.name || 'mission'}`,
            url: r.url || 'https://thespacedevs.com',
            score: 60,
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return out;
}

// ─── ARXIV (recent AI papers, classified by lab-keyword match in title/abstract) ─
async function collectFromArxiv() {
    // 30 most recent cs.AI / cs.CL / cs.LG submissions.
    const url = 'https://export.arxiv.org/api/query?' +
        'search_query=cat:cs.AI+OR+cat:cs.CL+OR+cat:cs.LG' +
        '&sortBy=submittedDate&sortOrder=descending&max_results=30';
    let xml;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        xml = await res.text();
    } catch (e) {
        console.warn('[arXiv] fetch failed:', e.message);
        return [];
    }

    // Parse Atom feed with regex (avoid bundling an XML parser).
    const entries = [];
    const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
    let m;
    while ((m = entryRe.exec(xml)) !== null) {
        const block = m[1];
        const tag = (t) => {
            const rr = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)<\\/' + t + '>');
            const mm = block.match(rr);
            return mm ? mm[1].replace(/\s+/g, ' ').trim() : null;
        };
        const arxivIdUrl = tag('id') || '';
        const arxivId = arxivIdUrl.replace(/^.*\/abs\//, '');
        if (!arxivId) continue;
        const title = tag('title');
        const summary = tag('summary');
        const published = tag('published');
        if (!title) continue;

        const haystack = title + ' ' + (summary || '');
        const { lab } = classifyTitle(haystack);
        // arXiv: only log if we matched a known lab — pure academic papers
        // without industry ties produce too much noise.
        if (!lab) continue;

        const ts = published ? new Date(published) : new Date();
        const ageDays = (Date.now() - ts.getTime()) / 86400000;
        if (ageDays > 14) continue;

        entries.push({
            id: 'arxiv:' + arxivId,
            source: 'arxiv',
            event_type: 'celebrate',
            archetype: 'Launch Party',
            emoji: '🎉',
            lab,
            title: `[arXiv] ${title}`,
            url: `https://arxiv.org/abs/${arxivId}`,
            score: 65,
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return entries;
}

// ─── ZEROEVAL (leaderboard #1 — first time each model holds #1) ─────────────
async function collectFromZeroEval() {
    const data = await fetchJSON(
        'https://api.zeroeval.com/leaderboard/models/full?justCanonicals=true',
        {},
        12000
    );
    if (!Array.isArray(data) || !data.length) return [];

    // The top model is the leaderboard #1. We dedup by model_id so this only
    // produces an event the FIRST time a given model reaches #1 — subsequent
    // hours where it remains #1 are no-ops via the PK.
    const top = data[0];
    if (!top || !top.name) return [];

    // ZeroEval `organization_id` doesn't always match our lab id lexicon
    // exactly — fall back to a name-based classifier so we always end up
    // anchored to one of our lab HQs.
    let lab = null;
    const orgLower = (top.organization_id || '').toLowerCase();
    const orgMap = {
        anthropic: 'anthropic', openai: 'openai', google: 'google',
        'google-deepmind': 'google', deepmind: 'google',
        meta: 'meta', mistral: 'mistral', mistralai: 'mistral',
        xai: 'xai', deepseek: 'deepseek', microsoft: 'microsoft',
        nvidia: 'nvidia', alibaba: 'alibaba', cohere: 'cohere'
    };
    if (orgMap[orgLower]) lab = orgMap[orgLower];
    if (!lab) lab = classifyTitle(top.name).lab;
    if (!lab) return [];

    const modelId = top.model_id || top.name;
    const ts = new Date();
    return [{
        id: 'zeroeval:#1:' + modelId,
        source: 'zeroeval',
        event_type: 'celebrate',
        archetype: 'Launch Party',
        emoji: '🎉',
        lab,
        title: `${top.name} just took #1 on the ZeroEval leaderboard`,
        url: 'https://zeroeval.com',
        score: 90,
        ts: ts.toISOString(),
        event_date: utcDateString(ts)
    }];
}

// ─── FINNHUB (AI-related stocks, big intraday moves) ────────────────────────
const FINNHUB_KEY = process.env.FINNHUB_KEY;
const STOCK_LAB_MAP = [
    { sym: 'NVDA',  lab: 'nvidia'    },
    { sym: 'MSFT',  lab: 'microsoft' },
    { sym: 'GOOGL', lab: 'google'    },
    { sym: 'META',  lab: 'meta'      },
    { sym: 'TSLA',  lab: 'tesla'     },
    { sym: 'BABA',  lab: 'alibaba'   }
];

async function collectFromFinnhub() {
    if (!FINNHUB_KEY) {
        console.warn('[Finnhub] FINNHUB_KEY env var not set — skipping');
        return [];
    }
    const quotes = await Promise.all(STOCK_LAB_MAP.map(async ({ sym, lab }) => {
        const q = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
        return { sym, lab, q };
    }));

    const out = [];
    const today = utcDateString();
    for (const { sym, lab, q } of quotes) {
        if (!q || typeof q.c !== 'number' || typeof q.pc !== 'number' || q.pc <= 0) continue;
        const pct = ((q.c - q.pc) / q.pc) * 100;
        // Threshold: 3% in either direction is "big move" for a mega-cap.
        if (Math.abs(pct) < 3) continue;

        const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
        const dir = pct >= 0 ? 'up' : 'down';
        // Event type by severity. Big drops register as emergencies.
        let event_type, archetype, emoji;
        if (pct <= -5)      { event_type = 'emergency'; archetype = 'Emergency Huddle'; emoji = '🚁'; }
        else if (pct < 0)   { event_type = 'crisis';    archetype = 'Crisis Flicker';   emoji = '😰'; }
        else                { event_type = 'celebrate'; archetype = 'Launch Party';     emoji = '🎉'; }

        // Dedup per day per symbol per direction — only one event per stock per
        // direction-bucket per UTC day, even if intraday volatility spikes
        // multiple times.
        const id = `finnhub:${sym}:${today}:${dir}`;
        out.push({
            id,
            source: 'finnhub',
            event_type,
            archetype,
            emoji,
            lab,
            title: `${sym} ${pct >= 0 ? 'jumps' : 'drops'} ${pctStr} (${labLabel(lab)})`,
            url: `https://finance.yahoo.com/quote/${sym}`,
            score: Math.min(100, Math.round(Math.abs(pct) * 10)),
            ts: new Date().toISOString(),
            event_date: today
        });
    }
    return out;
}

// ─── SUPABASE UPSERT ────────────────────────────────────────────────────────
async function upsertEvents(events) {
    if (!events.length) return { written: 0, failed: 0 };
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        return { written: 0, failed: events.length };
    }
    // PostgREST bulk upsert. on_conflict=id means re-runs are no-ops.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sc_events?on_conflict=id`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(events)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[supabase] upsert HTTP ${res.status}: ${text}`);
        return { written: 0, failed: events.length };
    }
    return { written: events.length, failed: 0 };
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────
export default async (_req) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error(msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const startedAt = Date.now();
    console.log('🛰️  collect-events running…');

    // All sources in parallel. Each catches its own errors so one source
    // failing (e.g. arXiv timeout) never tanks the whole run.
    const [hn, hf, ll, arxiv, ze, fh] = await Promise.all([
        collectFromHN().catch(e        => { console.warn('HN error:',        e.message); return []; }),
        collectFromHF().catch(e        => { console.warn('HF error:',        e.message); return []; }),
        collectFromLaunchLib().catch(e => { console.warn('LL2 error:',       e.message); return []; }),
        collectFromArxiv().catch(e     => { console.warn('arXiv error:',     e.message); return []; }),
        collectFromZeroEval().catch(e  => { console.warn('ZeroEval error:',  e.message); return []; }),
        collectFromFinnhub().catch(e   => { console.warn('Finnhub error:',   e.message); return []; })
    ]);
    console.log(
        `  sources: ${hn.length} HN · ${hf.length} HF · ${ll.length} LL2 · ` +
        `${arxiv.length} arXiv · ${ze.length} ZeroEval · ${fh.length} Finnhub`
    );

    const all = [...hn, ...hf, ...ll, ...arxiv, ...ze, ...fh];
    const { written, failed } = await upsertEvents(all);

    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const summary = {
        ok: failed === 0,
        sources: {
            hn: hn.length, hf: hf.length, ll: ll.length,
            arxiv: arxiv.length, zeroeval: ze.length, finnhub: fh.length
        },
        written,
        failed,
        elapsedSec: elapsed
    };
    console.log(`  ✅ done · ${written} written · ${failed} failed · ${elapsed}s`);
    return new Response(JSON.stringify(summary, null, 2), {
        status: failed === 0 ? 200 : 500,
        headers: { 'content-type': 'application/json' }
    });
};

// Run every hour on the hour
export const config = {
    schedule: '0 * * * *'
};
