// ════════════════════════════════════════════════════════════════════════════
// UPDATE AI BANS — Netlify Scheduled Function (every 6h).
//
// Self-maintains the `ai_bans` table that powers the AI Detention Center
// (js/jail.js → JailData.fetchRemoteBans). It reads live AI-regulation news,
// detects "a government banned/suspended <model> in <country>" events, and:
//   • UPSERTS a row per (model × jurisdiction), keyed by ban_key, active=true,
//     last_seen=now  → the model is detained for visitors in that country.
//   • DELETES its own rows whose news hasn't reappeared for STALE_DAYS
//     → the ban is presumed lifted and the model walks back home.
//   • RELEASE DETECTION: a "lifted / reinstated / restored / overturned" headline
//     for a model PURGES its ban rows immediately AND suppresses re-upserts from
//     older ban headlines still inside the news window. (Without this, a lifted
//     ban kept re-writing itself for weeks — the Fable 5 export-directive bug.)
// It only ever touches rows it owns (managed_by='news_bot'); hand-added
// (managed_by='manual') rows are left alone.
//
// Conservative on purpose (it writes to a public production table):
//   requires a ban verb + a known model line + a government/authority actor +
//   an explicit jurisdiction, and skips negations/lifts ("reinstated", "no
//   ban", "appeal", …) and lab-as-actor phrasing ("OpenAI bans accounts …").
//   Anything wrong self-heals within STALE_DAYS once the news rotates out.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (same as collect-events).
// Run locally:  node netlify/functions/update-ai-bans.mjs --selftest
// ════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const STALE_DAYS = 21;   // delete a bot row if its ban hasn't been seen in the news this long
const MAX_ROWS = 60;     // sanity cap on rows written per run
const NEWS_WINDOW = '45d';
const COOLDOWN_DAYS = 21; // once a ban is lifted, suppress re-creating that model×country this long
                          // (a lifted-ban headline and the old ban headline coexist in the news
                          //  window; without a sticky tombstone the ban row flaps every run —
                          //  see the grok:ID / Indonesia case that motivated this).

// ─── CLASSIFIER ──────────────────────────────────────────────────────────────
const BAN_RE = /\b(ban|bans|banned|banning|block|blocks|blocked|blocking|suspend|suspends|suspended|suspension|restrict|restricts|restricted|outlaw|outlawed|prohibit|prohibits|prohibited|bar|bars|barred|removed from|pull(?:s|ed)? from)\b/i;
// "orders / pulled / took / forced <model> offline" — allow a word or two between the verb and "offline".
const OFFLINE_RE = /\b(order(?:s|ed)?|pull(?:s|ed)?|take[sn]?|took|forc(?:e|es|ed)|knock(?:s|ed)?)\b[\w\s'’]{0,18}\boffline\b/i;
const RELEASE_RE = /\b(not banned|won'?t ban|no ban|despite|reject|rejects|rejected|unban|unbanned|lift|lifts|lifted|lifting|overturn|overturned|restore|restored|reinstate|reinstated|allow|allowed|approve|approved|avoid|avoids|avoided|reverse|reversed|appeal|appeals)\b/i;
// Statistical / ranking pieces ("the most frequently restricted chatbot worldwide") are not ban events.
const STATS_RE = /\b(most|least)\s+(frequently|commonly|widely|often|heavily)\b/i;

// ─── RELEASE CLASSIFIER ──────────────────────────────────────────────────────
// Strong, past-tense lift verbs only — "releases Grok 5" (a product launch) must NOT count.
const LIFT_RE = /\b(unban(?:s|ned)?|lift(?:s|ed|ing)?|reinstat(?:e|es|ed)|restor(?:e|es|ed)|overturn(?:s|ed)?|revers(?:e|es|ed)|back online|resum(?:e|es|ed)|ban (?:ends|ended|expires|expired))\b/i;
// Tentative / negated lifts keep the ban standing: "court rejects appeal to lift…", "may overturn…".
const LIFT_NEG_RE = /\b(reject(?:s|ed)?|declin(?:e|es|ed)|refus(?:e|es|ed)|den(?:y|ies|ied)|won'?t|will not|\bnot\b|no plans|fails? to|urg(?:e|es|ed)|call(?:s|ed)? (?:on|for)|may|might|could|consider(?:s|ing)?|seek(?:s|ing)?|petition)\b/i;
// A service OUTAGE / infra recovery ("back online after outage", "service restored", Cloudflare,
// DDoS) is not a government ban lift — it must never release a jailed model.
const OUTAGE_RE = /\b(outage|outages|downtime|down\s*time|degraded|ddos|server error|cloudflare|service (?:disruption|interruption|restored after))\b/i;
// An UNSCOPED lift only counts as a *global* release with an explicit worldwide / export-directive
// signal (the real Fable export-ban pattern). Without this gate, a lift in a jurisdiction we don't
// map ("Philippines lifts ban on Grok") collapses to code=null and wrongly purges EVERY country's
// ban for that model — including independent court orders in Turkey / Malaysia.
const GLOBAL_LIFT_RE = /\b(worldwide|globally|export\s+(?:ban|bans|control|controls|restriction|restrictions|directive|directives|order|orders|curb|curbs))\b/i;

// model token → row target (a lab id to jail wholesale, or a name regex)
// `origin` = the model's home country. A model is never detained in its own home country
// (that's almost always an origin reference — "China's DeepSeek …" — not a real domestic ban).
const MODEL_MATCHERS = [
    // Specific sub-brands first so a headline about one frontier model doesn't jail a whole family.
    { id: 'fable',    re: /\b(fable|mythos)\b/i, target: { match_name: 'fable|mythos' }, origin: 'US' },
    { id: 'deepseek', re: /\bdeepseek\b/i, target: { match_lab: 'deepseek' }, origin: 'CN' },
    { id: 'grok',     re: /\bgrok\b/i,     target: { match_name: 'grok' },    origin: 'US' },
    { id: 'gemini',   re: /\bgemini\b/i,   target: { match_name: 'gemini' },  origin: 'US' },
    { id: 'chatgpt',  re: /\b(chatgpt|gpt-?\d)\b/i, target: { match_name: 'gpt' }, origin: 'US' },
    { id: 'claude',   re: /\bclaude\b/i,   target: { match_name: 'claude' },  origin: 'US' },
    { id: 'llama',    re: /\bllama\b/i,    target: { match_name: 'llama' },   origin: 'US' },
    { id: 'qwen',     re: /\bqwen\b/i,     target: { match_name: 'qwen' },    origin: 'CN' },
    { id: 'mistral',  re: /\bmistral\b/i,  target: { match_name: 'mistral' }, origin: 'FR' },
];

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const COUNTRIES = [
    { re: /\bt[uü]rkiye\b|\bturkey\b|\bturkish\b/i, code: 'TR', name: 'Turkey' },
    { re: /\bgermany\b|\bgerman\b/i,    code: 'DE', name: 'Germany' },
    { re: /\bczech/i,                   code: 'CZ', name: 'Czechia' },
    { re: /\baustralia\b|\baustralian\b/i, code: 'AU', name: 'Australia' },
    { re: /\bitaly\b|\bitalian\b/i,     code: 'IT', name: 'Italy' },
    { re: /\bfrance\b/i,                code: 'FR', name: 'France' },   // not 'french' (Mistral origin)
    { re: /\bspain\b|\bspanish\b/i,     code: 'ES', name: 'Spain' },
    { re: /\bindia\b|\bindian\b/i,      code: 'IN', name: 'India' },
    { re: /\bchina\b/i,                 code: 'CN', name: 'China' },    // not 'chinese' (DeepSeek/Qwen origin)
    { re: /\bcanada\b|\bcanadian\b/i,   code: 'CA', name: 'Canada' },
    { re: /\bsouth korea\b|\bkorean\b/i, code: 'KR', name: 'South Korea' },
    { re: /\bmalaysia\b|\bmalaysian\b/i, code: 'MY', name: 'Malaysia' },   // before ID: "Malaysia and Indonesia…" headlines key on MY
    { re: /\bindonesia\b|\bindonesian\b/i, code: 'ID', name: 'Indonesia' },
    { re: /\bunited kingdom\b|\bbritain\b|\bbritish\b|\bu\.k\.\b/i, code: 'GB', name: 'United Kingdom' },
    { re: /\beuropean union\b|\be\.u\.\b/i, code: 'EU', name: 'European Union' },
    { re: /\bunited states\b|\busa\b|\bamerica\b|\bu\.s\.a?\.?\b|\bus\s+(?:states?|government|federal|lawmakers?|senate|congress|officials?|regulators?|administration)\b/i, code: 'US', name: 'United States' },
];

// Returns a ban descriptor for a headline, or null if it isn't a clear state ban.
function classify(title) {
    const low = (title || '').toLowerCase();
    if (!BAN_RE.test(low) && !OFFLINE_RE.test(low)) return null;
    if (RELEASE_RE.test(low)) return null;          // a lift / appeal / negation, not a new ban
    if (STATS_RE.test(low)) return null;            // ranking/statistics piece, not a ban event
    const matcher = MODEL_MATCHERS.find(m => m.re.test(low));
    if (!matcher) return null;
    // lab-as-actor guard: skip "<model> bans/blocks/… <something>" (the LAB is doing the banning).
    // Only present-tense active verbs — past participles ("DeepSeek blocked") are passive = a real ban.
    if (new RegExp(matcher.re.source + '\\s+(bans|blocks|blocking|banning|restricts|restricting|suspends|suspending|prohibits|bars)\\b', 'i').test(low)) return null;
    // jurisdiction
    let scope = null, label = null, code = null;
    if (/\b(worldwide|globally|global ban|every country|all countries)\b/i.test(low)) {
        scope = 'global'; label = 'Worldwide'; code = 'GLOBAL';
    } else {
        // First country named that ISN'T the model's home country (skip origin references).
        const c = COUNTRIES.find(cn => cn.code !== matcher.origin && cn.re.test(low));
        if (c) { scope = (c.code === 'EU') ? JSON.stringify({ countries: EU }) : JSON.stringify({ countries: [c.code] }); label = c.name; code = c.code; }
    }
    if (!scope) return null;                        // no jurisdiction → too ambiguous to act on
    return { matcher, scope, label, code };
}

// Returns a release descriptor for a headline, or null. code=null means "all jurisdictions"
// (an origin-country actor lifting its own directive — e.g. "U.S. lifts export ban on Fable" —
// ends the global ban, so origin references don't scope the release down).
function classifyRelease(title) {
    const low = (title || '').toLowerCase();
    if (!LIFT_RE.test(low)) return null;
    if (LIFT_NEG_RE.test(low)) return null;         // tentative / rejected lift — ban stands
    if (OUTAGE_RE.test(low)) return null;           // service outage recovery ≠ government ban lift
    const matcher = MODEL_MATCHERS.find(m => m.re.test(low));
    if (!matcher) return null;
    const c = COUNTRIES.find(cn => cn.code !== matcher.origin && cn.re.test(low));
    if (c) return { matcher, code: c.code };         // scoped lift for a recognised jurisdiction
    // No recognised country → only a worldwide / export-directive signal may release everywhere.
    // Otherwise skip: a lift in an unmapped country must NOT purge other countries' bans.
    if (GLOBAL_LIFT_RE.test(low)) return { matcher, code: null };
    return null;
}

// "news:<model>:<code>" → { model, code }  (null for any other shape). code is an ISO-2 / EU / GLOBAL.
function parseBanKey(k) {
    const m = /^news:([a-z0-9]+):([A-Z]+)$/.exec(k || '');
    return m ? { model: m[1], code: m[2] } : null;
}

// ─── NEWS SOURCE (Google News RSS — server-side, no CORS, no key) ─────────────
const QUERIES = [
    '(DeepSeek OR Grok OR Gemini OR ChatGPT OR Claude OR Llama OR Qwen OR Mistral) (banned OR blocked OR suspended OR restricted OR prohibited) (government OR court OR regulator OR ministry OR watchdog)',
    'AI chatbot banned government court country',
    'AI model suspended regulator data privacy',
    // Release-focused query: ban and lift headlines coexist in the news window, but the ban queries
    // above only surface lift stories incidentally. Pulling lifts explicitly makes release detection
    // reliable every run (so a lifted ban doesn't flap back in on runs that miss the lift headline).
    '(DeepSeek OR Grok OR Gemini OR ChatGPT OR Claude OR Llama OR Qwen OR Mistral) ("lifts ban" OR "lifted ban" OR unbanned OR reinstated OR restored OR "back online" OR "lets * resume" OR "stops blocking")',
];

async function fetchText(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'SingularityCity-BanBot/1.0' } });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`[fetch] ${url} — ${e.message}`);
        return null;
    }
}

function decodeEntities(s) {
    return (s || '')
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .trim();
}

// Light RSS item extraction (no XML dep — same spirit as collect-events' regex parsing).
function parseRss(xml) {
    const items = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const b of blocks) {
        const t = b.match(/<title>([\s\S]*?)<\/title>/);
        const l = b.match(/<link>([\s\S]*?)<\/link>/);
        if (!t) continue;
        let title = decodeEntities(t[1]);
        // Google News appends " - Publisher" — strip it for a cleaner reason line.
        title = title.replace(/\s+-\s+[^-]+$/, '').trim();
        items.push({ title, link: l ? decodeEntities(l[1]) : null });
    }
    return items;
}

async function fetchBanNews() {
    const out = [];
    const seen = new Set();
    for (const q of QUERIES) {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:' + NEWS_WINDOW)}&hl=en-US&gl=US&ceid=US:en`;
        const xml = await fetchText(url);
        if (!xml) continue;
        for (const it of parseRss(xml)) {
            const k = it.title.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(it);
        }
    }
    return out;
}

// ─── SUPABASE WRITES (service role bypasses RLS) ─────────────────────────────
async function sbFetch(path, opts) {
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

async function upsertBans(rows) {
    if (!rows.length) return { written: 0, error: null };
    const res = await sbFetch('ai_bans?on_conflict=ban_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[supabase] upsert HTTP ${res.status}: ${detail}`);
        return { written: 0, error: `HTTP ${res.status}: ${detail.slice(0, 400)}` };
    }
    return { written: rows.length, error: null };
}

async function deleteStaleBans(cutoffISO) {
    // Delete only bot-owned ACTIVE bans not re-seen since the cutoff. Inactive rows are cooldown
    // tombstones — they're aged out by deleteExpiredTombstones() on their own `until`, not here.
    const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&active=eq.true&last_seen=lt.${encodeURIComponent(cutoffISO)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[supabase] delete HTTP ${res.status}: ${detail}`);
        return { deleted: 0, error: `HTTP ${res.status}: ${detail.slice(0, 400)}` };
    }
    const gone = await res.json().catch(() => []);
    return { deleted: Array.isArray(gone) ? gone.length : 0, error: null };
}

// Delete specific bot-owned ban_keys (used to enforce the "never in home country" rule and
// retire rows that should never have been written — without waiting for the staleness TTL).
async function purgeKeys(keys) {
    if (!keys.length) return { purged: 0 };
    const list = keys.map(encodeURIComponent).join(',');
    const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&ban_key=in.(${list})`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
    });
    if (!res.ok) { console.error(`[supabase] purge HTTP ${res.status}: ${await res.text().catch(() => '')}`); return { purged: 0 }; }
    const gone = await res.json().catch(() => []);
    return { purged: Array.isArray(gone) ? gone.length : 0 };
}

// Turn detected releases into durable state:
//   • SCOPED lift (a specific country) → UPSERT a cooldown TOMBSTONE under the same ban_key
//     (active=false, until=now+COOLDOWN_DAYS). Because on_conflict=ban_key merges, this instantly
//     replaces any active ban row for that key, AND — since buildRows consults live tombstones
//     (fetchActiveTombstones) — it suppresses re-creation from stale ban headlines for the whole
//     cooldown, even on runs that miss the lift headline. This is what stops the flap.
//   • UNSCOPED lift (worldwide / export directive, code=null) → delete every jurisdiction row for
//     the model AND drop a GLOBAL cooldown tombstone, so a lingering worldwide-ban headline can't
//     re-create it next run (the original Fable export-ban flap).
// The client (js/jail.js fetchRemoteBans) already skips active===false rows, so tombstones never jail.
async function applyReleases(releases, nowISO) {
    const untilISO = new Date(Date.now() + COOLDOWN_DAYS * 86400000).toISOString();
    const tombs = [];
    let purged = 0;
    for (const r of releases) {
        if (r.code) {
            tombs.push({
                ban_key: `news:${r.matcher.id}:${r.code}`,
                managed_by: 'news_bot',
                label: 'Lifted',
                authority: 'Ban lifted',
                scope: JSON.stringify({ countries: [r.code] }),
                until: untilISO,                 // cooldown expiry — reused as "suppress until"
                reason: (r.title || 'Ban lifted').slice(0, 240),
                source: r.link || null,
                active: false,                   // ← tombstone: never jails, only suppresses
                last_seen: nowISO,
                match_lab: r.matcher.target.match_lab || null,
                match_name: r.matcher.target.match_name || null,
            });
        } else {
            const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&ban_key=like.news:${r.matcher.id}:*`, {
                method: 'DELETE', headers: { Prefer: 'return=representation' },
            });
            if (!res.ok) { console.error(`[supabase] release purge HTTP ${res.status}: ${await res.text().catch(() => '')}`); continue; }
            const gone = await res.json().catch(() => []);
            purged += Array.isArray(gone) ? gone.length : 0;
            tombs.push({                          // GLOBAL tombstone → suppress a re-flap from a lingering worldwide-ban headline
                ban_key: `news:${r.matcher.id}:GLOBAL`,
                managed_by: 'news_bot',
                label: 'Lifted',
                authority: 'Ban lifted',
                scope: 'global',
                until: untilISO,
                reason: (r.title || 'Ban lifted').slice(0, 240),
                source: r.link || null,
                active: false,
                last_seen: nowISO,
                match_lab: r.matcher.target.match_lab || null,
                match_name: r.matcher.target.match_name || null,
            });
        }
    }
    let tombstoned = 0;
    if (tombs.length) {
        const res = await sbFetch('ai_bans?on_conflict=ban_key', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(tombs),
        });
        if (res.ok) tombstoned = tombs.length;
        else console.error(`[supabase] tombstone HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    return { tombstoned, purged };
}

// Live cooldown tombstones (active=false, until still in the future) → Set of "model|code" to
// suppress in buildRows. This is the sticky half of release detection: a lift stays in effect for
// COOLDOWN_DAYS even across runs whose news pull happens to omit the lift headline.
async function fetchActiveTombstones(nowISO) {
    const set = new Set();
    const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&active=eq.false&until=gt.${encodeURIComponent(nowISO)}&select=ban_key`, { method: 'GET' });
    if (!res.ok) return set;
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) return set;
    for (const r of rows) { const p = parseBanKey(r.ban_key); if (p) set.add(p.model + '|' + p.code); }
    return set;
}

// Retire expired tombstones (cooldown elapsed) so a genuine RE-ban after the cooldown can land again.
async function deleteExpiredTombstones(nowISO) {
    const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&active=eq.false&until=lt.${encodeURIComponent(nowISO)}`, {
        method: 'DELETE', headers: { Prefer: 'return=representation' },
    });
    if (!res.ok) { console.error(`[supabase] tombstone expiry HTTP ${res.status}: ${await res.text().catch(() => '')}`); return { expired: 0 }; }
    const gone = await res.json().catch(() => []);
    return { expired: Array.isArray(gone) ? gone.length : 0 };
}

// Self-heal on classifier upgrades: re-run classify() over the headline each bot row was
// created from; purge rows the CURRENT classifier would no longer produce (e.g. the old
// "most frequently restricted chatbot worldwide" stats row).
async function purgeMisclassified() {
    // Only active ban rows — an inactive tombstone's `reason` is a LIFT headline, which classify()
    // returns null for; reclassifying those would wrongly delete the tombstone (re-opening the flap).
    const res = await sbFetch('ai_bans?managed_by=eq.news_bot&active=eq.true&select=ban_key,reason', { method: 'GET' });
    if (!res.ok) return { purged: 0 };
    const rows = await res.json().catch(() => []);
    if (!Array.isArray(rows)) return { purged: 0 };
    const bad = rows.filter(r => {
        const c = classify(r.reason || '');
        return !c || `news:${c.matcher.id}:${c.code}` !== r.ban_key;
    }).map(r => r.ban_key);
    if (!bad.length) return { purged: 0 };
    console.log('  🧹 reclassify purge:', bad.join(', '));
    return purgeKeys(bad);
}

// Extract deduped releases from current news.
function buildReleases(news) {
    const releases = [];
    const seen = new Set();
    for (const it of news) {
        const r = classifyRelease(it.title);
        if (!r) continue;
        const k = r.matcher.id + '|' + (r.code || '*');
        if (seen.has(k)) continue;
        seen.add(k);
        releases.push({ ...r, title: it.title, link: it.link });
    }
    return releases;
}

// Build the deduped row set from current news. Two suppression layers keep a lifted ban from
// re-appearing while its old ban headline still circulates:
//   • `releases`   — lifts detected in THIS run's news (immediate).
//   • `suppressed` — live cooldown tombstones from the DB, a Set of "model|code" (sticky across
//                    runs, so a run that happens to miss the lift headline still won't re-jail).
function buildRows(news, nowISO, releases = [], suppressed = new Set()) {
    const liftedAll = new Set(releases.filter(r => !r.code).map(r => r.matcher.id));
    const liftedScoped = new Set(releases.filter(r => r.code).map(r => r.matcher.id + '|' + r.code));
    const rows = [];
    const seen = new Set();
    for (const it of news) {
        const c = classify(it.title);
        if (!c) continue;
        if (liftedAll.has(c.matcher.id) || liftedScoped.has(c.matcher.id + '|' + c.code)) continue;
        if (suppressed.has(c.matcher.id + '|' + c.code)) continue; // still inside a lift cooldown
        const ban_key = `news:${c.matcher.id}:${c.code}`;
        if (seen.has(ban_key)) continue;
        seen.add(ban_key);
        rows.push({
            ban_key,
            managed_by: 'news_bot',
            label: c.label,
            authority: c.label,
            scope: c.scope,
            reason: it.title.slice(0, 240),
            source: it.link,
            active: true,
            last_seen: nowISO,
            // Always include BOTH target columns (one null) — PostgREST bulk insert (PGRST102)
            // rejects an array whose objects don't all share the exact same key set.
            match_lab: c.matcher.target.match_lab || null,
            match_name: c.matcher.target.match_name || null,
        });
        if (rows.length >= MAX_ROWS) break;
    }
    return rows;
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default async (_req) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error(msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
    const startedAt = Date.now();
    console.log('⛓️  update-ai-bans running…');

    const news = await fetchBanNews().catch(e => { console.warn('news error:', e.message); return []; });
    const nowISO = new Date().toISOString();
    const releases = buildReleases(news);
    // Live cooldown tombstones suppress lifted bans across runs (sticky release detection).
    const suppressed = await fetchActiveTombstones(nowISO);
    const rows = buildRows(news, nowISO, releases, suppressed);

    const up = await upsertBans(rows);
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
    const del = await deleteStaleBans(cutoff);
    // A lifted ban walks its model out of jail immediately (don't wait for staleness): a scoped lift
    // writes a cooldown tombstone (replaces the active row + suppresses re-creation), a global lift
    // purges every jurisdiction for that model.
    const rel = await applyReleases(releases, nowISO);
    // Enforce "no model is detained in its own home country" on existing rows too — purge any
    // such bot rows immediately (fixes e.g. a 'China's DeepSeek' headline mis-read as a CN ban).
    const homeKeys = MODEL_MATCHERS.filter(m => m.origin).map(m => `news:${m.id}:${m.origin}`);
    const purge = await purgeKeys(homeKeys);
    // Retire rows the current (stricter) classifier would no longer create.
    const reclass = await purgeMisclassified();
    // Age out cooldown tombstones whose window has elapsed (lets a genuine re-ban land again).
    const exp = await deleteExpiredTombstones(nowISO);

    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const summary = {
        ok: !up.error && !del.error,
        headlines: news.length,
        detected: rows.length,
        releasesDetected: releases.map(r => r.matcher.id + ':' + (r.code || 'ALL')),
        written: up.written,
        deletedStale: del.deleted,
        tombstonedReleased: rel.tombstoned,
        purgedReleased: rel.purged,
        purgedHomeCountry: purge.purged,
        purgedReclassified: reclass.purged,
        expiredTombstones: exp.expired,
        ...(up.error ? { upsertError: up.error } : {}),
        ...(del.error ? { deleteError: del.error } : {}),
        hint: (up.error || del.error)
            ? "Writes failed — run netlify/functions/sc_ai_bans_schema.sql in the Supabase SQL Editor (the current version, with ban_key/managed_by/last_seen), then re-run this."
            : undefined,
        bans: rows.map(r => ({ ban_key: r.ban_key, scope: r.scope })),
        elapsedSec: elapsed,
    };
    console.log(`  ✅ ${news.length} headlines · ${rows.length} bans · ${releases.length} releases (${rel.tombstoned} tombstoned) · ${up.written} written · ${del.deleted + rel.purged + purge.purged + reclass.purged + exp.expired} removed · ${elapsed}s`);
    return new Response(JSON.stringify(summary, null, 2), { status: 200, headers: { 'content-type': 'application/json' } });
};

// Run every 6 hours.
export const config = { schedule: '0 */6 * * *' };

// ─── LIVE DRY-RUN (real Google News, NO DB write): node update-ai-bans.mjs --dryrun ──
if (process.argv.includes('--dryrun')) {
    (async () => {
        const news = await fetchBanNews();
        console.log(`fetched ${news.length} headlines`);
        const releases = buildReleases(news);
        const rows = buildRows(news, new Date().toISOString(), releases);
        console.log(`\n${rows.length} ban(s) detected:`);
        for (const r of rows) console.log(`  ⛓️  ${r.ban_key.padEnd(22)} ${JSON.stringify(r.scope).padEnd(26)} ${(r.match_lab || r.match_name)}  ←  ${r.reason}`);
        console.log(`\n${releases.length} release(s) detected:`);
        for (const r of releases) console.log(`  🕊️  ${r.matcher.id}:${r.code || 'ALL'}  ${r.code ? '→ cooldown tombstone' : '→ purge all jurisdictions'}`);
        if (process.argv.includes('--verbose')) { console.log('\nall headlines:'); news.forEach(n => console.log('  · ' + n.title)); }
        process.exit(0);
    })();
}

// ─── LOCAL SELF-TEST (no network / no DB): node update-ai-bans.mjs --selftest ──
if (process.argv.includes('--selftest')) {
    const samples = [
        ["DeepSeek blocked nationwide in Turkey by court order", true, 'news:deepseek:TR'],
        ["Italy's privacy watchdog bans Google Gemini over data breach", true, 'news:gemini:IT'],
        ["German government bars DeepSeek from official devices", true, 'news:deepseek:DE'],
        ["India's IT ministry orders Grok offline pending review", true, 'news:grok:IN'],
        ["Anthropic Claude reinstated in France after successful appeal", false, null], // release wording
        ["EU lawmakers reject proposal to ban Qwen, no decision reached", false, null], // negation
        ["OpenAI bans thousands of accounts in China for misuse", false, null],         // lab-as-actor
        ["Gemini tops the leaderboard again this quarter", false, null],                // no ban/actor
        ["Senate debates AI safety rules for ChatGPT and Claude", false, null],         // no jurisdiction-scoped ban verb? has 'rules' not ban
        ["US states move to ban DeepSeek on government devices", true, 'news:deepseek:US'],
        ["DeepSeek is the most frequently restricted chatbot worldwide", false, null],  // stats piece, not a ban
    ];
    let pass = 0, total = 0;
    for (const [title, shouldHit, expectKey] of samples) {
        const c = classify(title);
        const got = c ? `news:${c.matcher.id}:${c.code}` : null;
        const ok = shouldHit ? (got === expectKey) : (c === null);
        console.log(`${ok ? '✅' : '❌'}  ${got || '(skip)'}  ←  ${title}`);
        if (ok) pass++; total++;
    }
    // Release classifier: [title, expected 'model:CODE' | 'model:ALL' | null]
    const relSamples = [
        ["Anthropic's Fable 5 restored worldwide after US lifts export directive", 'fable:ALL'],
        ["Turkey lifts ban on Grok after xAI compliance deal", 'grok:TR'],
        ["Italy reinstates ChatGPT after OpenAI privacy fixes", 'chatgpt:IT'],
        ["Indonesia lets Elon Musk's Grok resume, lifting ban over sexualized images", 'grok:ID'], // scoped — must NOT purge other countries
        ["Court rejects appeal to lift DeepSeek ban in Italy", null],       // rejected lift — ban stands
        ["Germany may overturn DeepSeek ban next year", null],              // tentative — ban stands
        ["xAI releases Grok 5 to the public", null],                        // product launch ≠ ban lift
        ["Australia bans DeepSeek on government devices", null],            // a ban, not a release
        // A lift in a jurisdiction we don't map must NOT collapse to a global purge of TR/MY/…
        ["Philippines lifts ban on Musk's Grok chatbot after changes", null],
        // Service outages are not government ban lifts.
        ["ChatGPT back online after major outage, OpenAI says", null],
        ["Anthropic's Claude AI service restored after outage", null],
        // Genuine global lift (explicit export / worldwide signal) still releases everywhere.
        ["US lifts export ban on Fable and Mythos worldwide", 'fable:ALL'],
    ];
    for (const [title, expect] of relSamples) {
        const r = classifyRelease(title);
        const got = r ? `${r.matcher.id}:${r.code || 'ALL'}` : null;
        const ok = got === expect;
        console.log(`${ok ? '✅' : '❌'}  release ${got || '(skip)'}  ←  ${title}`);
        if (ok) pass++; total++;
    }

    // Sticky release: a live cooldown tombstone must suppress re-creating that model×country even
    // while the OLD ban headline is still circulating (the grok:ID / Indonesia flap this fix targets).
    {
        const banNews = [{ title: "Indonesia blocks Musk's Grok chatbot due to risk of pornographic content", link: null }];
        const iso = new Date().toISOString();
        const t1 = buildRows(banNews, iso, [], new Set()).some(r => r.ban_key === 'news:grok:ID');
        const t2 = !buildRows(banNews, iso, [], new Set(['grok|ID'])).some(r => r.ban_key === 'news:grok:ID');
        const pk = parseBanKey('news:grok:ID');
        const t3 = !!pk && pk.model === 'grok' && pk.code === 'ID';
        const t4 = parseBanKey('not-a-key') === null;
        for (const [ok, msg] of [[t1, 'builds news:grok:ID with no tombstone'], [t2, 'suppresses news:grok:ID while tombstone active'], [t3, "parseBanKey('news:grok:ID')"], [t4, 'parseBanKey rejects junk']]) {
            console.log(`${ok ? '✅' : '❌'}  ${msg}`);
            if (ok) pass++; total++;
        }
    }

    console.log(`\n${pass}/${total} cases correct`);
    process.exit(pass === total ? 0 : 1);
}
