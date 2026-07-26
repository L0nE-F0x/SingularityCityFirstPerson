// ════════════════════════════════════════════════════════════════
// NEWSPAPER ARCHIVE PUBLISHER — Netlify Scheduled Function
// Runs daily at 00:00 UTC. Builds the Daily Brief every day; on Sundays
// also builds the Weekly Edition. Both are written to Supabase as a
// permanent, immutable snapshot of the city as the news cycle saw it.
//
// Output schema (defined in Supabase): newspaper_editions + newspaper_edition_html
// — see the SQL in the audit doc. RLS allows anon reads of both tables;
// only this function (with SUPABASE_SERVICE_KEY) can write.
//
// Required env vars:
//   SUPABASE_URL          — Project URL
//   SUPABASE_SERVICE_KEY  — Service role key (writes bypass RLS)
//
// Idempotent: the unique (edition_date, kind) constraint means re-runs
// of the same day are no-ops, so re-deploys / replays are safe.
// ════════════════════════════════════════════════════════════════

import { AI_TITLE_RE } from './_shared/ai-keywords.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const VOLUME_START = new Date(Date.UTC(2025, 0, 1)); // Vol 1 / Issue 1 = 2025-01-01

// ──────────────────────────────────────────────────────────────────────────
//  ESCAPING — simple HTML-attr safe; we only emit text from external sources
// ──────────────────────────────────────────────────────────────────────────
function esc(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ──────────────────────────────────────────────────────────────────────────
//  FEED FETCHERS
// ──────────────────────────────────────────────────────────────────────────

// Hacker News top AI stories — same logic as hn-ai-stories.mjs but inlined.
// Keyword filter shared with hn-ai-stories.mjs / collect-events.mjs.
const HN_RE = AI_TITLE_RE;

async function fetchHNStories() {
    try {
        const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
            signal: AbortSignal.timeout(8000)
        });
        if (!idsRes.ok) return [];
        const ids = (await idsRes.json()).slice(0, 60);
        const items = await Promise.all(ids.map(async id => {
            try {
                const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    signal: AbortSignal.timeout(6000)
                });
                if (!r.ok) return null;
                return await r.json();
            } catch { return null; }
        }));
        return items
            .filter(it => it && it.type === 'story' && it.title && !it.deleted && !it.dead && HN_RE.test(it.title))
            .slice(0, 5)
            .map(it => ({
                id: it.id,
                headline: it.title,
                source: 'Hacker News',
                url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
                score: it.score || 0,
                comments: it.descendants || 0
            }));
    } catch (e) {
        console.warn('[HN] fetch failed:', e.message);
        return [];
    }
}

// RSS feeds via rss2json.com — same proxy the browser uses.
async function fetchRSSFeed(url, source) {
    try {
        const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`, {
            signal: AbortSignal.timeout(10000)
        });
        if (!r.ok) return [];
        const d = await r.json();
        if (d.status !== 'ok' || !Array.isArray(d.items)) return [];
        return d.items.slice(0, 8).map(i => ({
            headline: i.title,
            url: i.link,
            source
        }));
    } catch (e) {
        console.warn(`[RSS ${source}] failed:`, e.message);
        return [];
    }
}

async function fetchLiveNews() {
    const feeds = [
        { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
        { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
        { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        { url: 'https://arstechnica.com/tag/ai/feed/', source: 'Ars Technica' }
    ];
    const results = await Promise.all(feeds.map(f => fetchRSSFeed(f.url, f.source)));
    return results.flat();
}

// arXiv Atom feed — parsed via simple regex (no DOMParser in Node).
// Atom <entry> blocks contain <title>, <id>, and <published>; we extract those
// without bringing in a full XML library.
async function fetchArxivPapers() {
    try {
        const r = await fetch(
            'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=10',
            { signal: AbortSignal.timeout(12000) }
        );
        if (!r.ok) return [];
        const xml = await r.text();
        const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
        return entries.map(entry => {
            const title = (entry.match(/<title>([\s\S]*?)<\/title>/) || [])[1]?.trim().replace(/\s+/g, ' ');
            const idUrl = (entry.match(/<id>([\s\S]*?)<\/id>/) || [])[1]?.trim() || '';
            const id = idUrl.split('/abs/').pop() || '';
            const published = (entry.match(/<published>([\s\S]*?)<\/published>/) || [])[1]?.split('T')[0] || '';
            return { title, id, published };
        }).filter(p => p.title);
    } catch (e) {
        console.warn('[arXiv] fetch failed:', e.message);
        return [];
    }
}

// ──────────────────────────────────────────────────────────────────────────
//  ISSUE NUMBER MATH (matches Newspaper module client-side)
// ──────────────────────────────────────────────────────────────────────────
function computeWeeklyIssueNum(now) {
    const ms = now - VOLUME_START;
    const weeks = Math.max(1, Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1);
    const issuesPerVolume = 52;
    const vol = Math.floor((weeks - 1) / issuesPerVolume) + 1;
    const issue = ((weeks - 1) % issuesPerVolume) + 1;
    return { vol, issue };
}
function computeDailyIssueNum(now) {
    const ms = now - VOLUME_START;
    return Math.max(1, Math.floor(ms / (24 * 3600 * 1000)) + 1);
}

// ──────────────────────────────────────────────────────────────────────────
//  RENDERERS — emit semantic HTML using the same class names as the live
//  modal. The modal's runtime stylesheet (in newspaper.js) styles them.
// ──────────────────────────────────────────────────────────────────────────

function pickDailyLead(hn, headlines) {
    const hot = hn.find(s => (s.score || 0) >= 200);
    if (hot) return hot;
    if (hn.length > 0) return hn[0];
    if (headlines.length > 0) return headlines[0];
    return null;
}

function mergeHeadlines(wires, hn, n) {
    const seen = new Set();
    const out = [];
    const push = (item) => {
        const key = (item.url || item.headline || '').toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(item);
    };
    if (wires[0]) push(wires[0]);
    for (let i = 0; i < Math.max(wires.length, hn.length) && out.length < n; i++) {
        if (hn[i]) push(hn[i]);
        if (wires[i + 1]) push(wires[i + 1]);
    }
    return out.slice(0, n);
}

function buildDailyHTML(now, hn, headlines, papers, lead) {
    const dateStr = now.toUTCString().replace(' GMT', ' UTC');
    const issueNum = computeDailyIssueNum(now);

    let html = '';
    // Masthead
    html += `<div class="np-masthead">
        <div class="np-tagline">— TODAY ON THE FRONTIER · DAILY BRIEF —</div>
        <h1>The Singularity City Times</h1>
        <div class="np-meta">
            <span><b>DAILY</b> · No. ${issueNum}</span>
            <span>${esc(dateStr)}</span>
            <span>ARCHIVED EDITION</span>
        </div>
    </div>`;

    // Lead
    if (lead) {
        const subAttr = lead.source === 'Hacker News'
            ? `▲ Hacker News · ${lead.score || 0} points · ${lead.comments || 0} comments`
            : `Source: ${esc(lead.source)}`;
        html += `<div class="np-top-story">
            <h2><a href="${esc(lead.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(lead.headline)}</a></h2>
            <div class="np-sub">${subAttr} · <a href="${esc(lead.url)}" target="_blank" rel="noopener" style="color:#5a3e1a">Read full article →</a></div>
        </div>`;
    } else {
        html += `<div class="np-top-story">
            <h2>The Wires Were Quiet</h2>
            <div class="np-sub">No headlines reached the press desk this cycle.</div>
        </div>`;
    }

    // Two-column grid: HN + Wires
    html += `<div class="np-grid">`;
    html += `<div class="np-section"><h3>▲ Hacker News — AI Top</h3>`;
    if (hn.length) {
        for (const s of hn) {
            html += `<div class="np-item">
                <b><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(s.headline)}</a></b>
                <span class="np-byline">▲ ${s.score} · ${s.comments} comments · <a href="https://news.ycombinator.com/item?id=${esc(s.id)}" target="_blank" rel="noopener" style="color:#5a3e1a">discuss</a></span>
            </div>`;
        }
    } else {
        html += `<div class="np-item"><i>HackerNews quiet at press time.</i></div>`;
    }
    html += `</div>`;

    html += `<div class="np-section"><h3>📡 On the Wires</h3>`;
    if (headlines.length) {
        for (const h of headlines.slice(0, 3)) {
            html += `<div class="np-item">
                <b><a href="${esc(h.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(h.headline)}</a></b>
                <span class="np-byline">${esc(h.source)}</span>
            </div>`;
        }
    } else {
        html += `<div class="np-item"><i>Wire feeds offline at press time.</i></div>`;
    }
    html += `</div>`;
    html += `</div>`;

    // Paper of the day
    if (papers.length) {
        const p = papers[0];
        html += `<div class="np-section" style="margin-top:14px"><h3>📄 Paper of the Day</h3>
            <div class="np-item">
                <b><a href="https://arxiv.org/abs/${esc(p.id)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(p.title)}</a></b>
                <span class="np-byline">arXiv: ${esc(p.id)} · ${esc(p.published)}</span>
            </div></div>`;
    }

    // Colophon
    html += `<div class="np-colophon">
        ARCHIVED EDITION — captured ${esc(now.toISOString())} from the daily 00:00 UTC press cycle.
        Live newspaper available at <a href="https://singularitycity.net" target="_blank" rel="noopener" style="color:#5a3e1a">singularitycity.net</a>.
    </div>`;

    return html;
}

function buildWeeklyHTML(now, hn, headlines, papers) {
    const dateStr = now.toUTCString().replace(' GMT', ' UTC');
    const { vol, issue } = computeWeeklyIssueNum(now);
    const merged = mergeHeadlines(headlines, hn, 8);

    let html = '';
    // Masthead
    html += `<div class="np-masthead">
        <div class="np-tagline">— ESTABLISHED 2025 · WEEKLY RECORD OF THE INTELLIGENCE FRONTIER —</div>
        <h1>The Singularity City Times</h1>
        <div class="np-meta">
            <span><b>VOL. ${vol}</b> · No. ${issue}</span>
            <span>${esc(dateStr)}</span>
            <span>ARCHIVED EDITION</span>
        </div>
    </div>`;

    // Lead = first merged headline
    if (merged.length) {
        const lead = merged[0];
        html += `<div class="np-top-story">
            <h2>${esc(lead.headline)}</h2>
            <div class="np-sub">Source: ${esc(lead.source)} · <a href="${esc(lead.url)}" target="_blank" rel="noopener" style="color:#5a3e1a">Read full article →</a></div>
        </div>`;
    } else {
        html += `<div class="np-top-story">
            <h2>The Frontier Held Steady</h2>
            <div class="np-sub">A quiet week on the wires.</div>
        </div>`;
    }

    // Two-column grid
    html += `<div class="np-grid">`;
    html += `<div class="np-section"><h3>📡 AI Industry Watch</h3>`;
    if (merged.length > 1) {
        for (let i = 1; i < merged.length; i++) {
            const h = merged[i];
            html += `<div class="np-item">
                <b><a href="${esc(h.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(h.headline)}</a></b>
                <span class="np-byline">${esc(h.source)}</span>
            </div>`;
        }
    } else {
        html += `<div class="np-item"><i>RSS desks were dark this week.</i></div>`;
    }
    html += `</div>`;

    html += `<div class="np-section"><h3>📄 Research Frontiers</h3>`;
    if (papers.length) {
        for (const p of papers.slice(0, 4)) {
            html += `<div class="np-item">
                <b><a href="https://arxiv.org/abs/${esc(p.id)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${esc(p.title)}</a></b>
                <span class="np-byline">arXiv: ${esc(p.id)} · ${esc(p.published)}</span>
            </div>`;
        }
    } else {
        html += `<div class="np-item"><i>arXiv was unreachable at press time.</i></div>`;
    }
    html += `</div>`;
    html += `</div>`;

    // Colophon
    html += `<div class="np-colophon">
        ARCHIVED EDITION — captured ${esc(now.toISOString())} from the Sunday 00:00 UTC press cycle.
        Live newspaper available at <a href="https://singularitycity.net" target="_blank" rel="noopener" style="color:#5a3e1a">singularitycity.net</a>.
    </div>`;

    return html;
}

// ──────────────────────────────────────────────────────────────────────────
//  SUPABASE WRITE — insert into newspaper_editions, then newspaper_edition_html
// ──────────────────────────────────────────────────────────────────────────
async function writeEdition({ editionDate, kind, issueNumber, volumeNumber, lead, html, sources }) {
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=representation'
    };

    // Insert metadata row. The unique constraint on (edition_date, kind) makes
    // duplicate publishes harmless: Supabase returns 409, we treat it as "already
    // archived for today" and return the existing row instead.
    const metaRow = {
        edition_date: editionDate,
        kind,
        issue_number: issueNumber,
        volume_number: volumeNumber,
        lead_headline: lead ? lead.headline : null,
        lead_source: lead ? lead.source : null,
        lead_url: lead ? lead.url : null,
        publisher: 'scheduled-function'
    };

    let res = await fetch(`${SUPABASE_URL}/rest/v1/newspaper_editions`, {
        method: 'POST', headers, body: JSON.stringify(metaRow)
    });

    let editionId;
    if (res.status === 409) {
        // Already published today — fetch existing id so we can no-op gracefully.
        const existing = await fetch(
            `${SUPABASE_URL}/rest/v1/newspaper_editions?edition_date=eq.${editionDate}&kind=eq.${kind}&select=id`,
            { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        );
        const arr = await existing.json();
        editionId = arr[0]?.id;
        console.log(`  ↺ ${kind} for ${editionDate} already archived (id=${editionId}) — skipping HTML insert`);
        return { skipped: true, editionId };
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`metadata insert failed: ${res.status} ${body}`);
    }
    const inserted = await res.json();
    editionId = inserted[0].id;

    // Insert HTML body
    res = await fetch(`${SUPABASE_URL}/rest/v1/newspaper_edition_html`, {
        method: 'POST', headers, body: JSON.stringify({
            edition_id: editionId,
            html,
            sources_json: sources
        })
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`html insert failed: ${res.status} ${body}`);
    }

    console.log(`  ✅ ${kind} for ${editionDate} archived (id=${editionId}, ${html.length} bytes)`);
    return { skipped: false, editionId };
}

// ──────────────────────────────────────────────────────────────────────────
//  ENTRY POINT
// ──────────────────────────────────────────────────────────────────────────
export default async (_req) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error(msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const now = new Date();
    const editionDate = now.toISOString().slice(0, 10);    // YYYY-MM-DD UTC
    const isSunday = now.getUTCDay() === 0;

    console.log(`📰 Publishing edition for ${editionDate}${isSunday ? ' (Sunday — both daily + weekly)' : ' (daily only)'}`);

    // Fetch all feeds in parallel
    const [hn, headlines, papers] = await Promise.all([
        fetchHNStories(),
        fetchLiveNews(),
        fetchArxivPapers()
    ]);
    console.log(`  📡 Sources: ${hn.length} HN · ${headlines.length} wire · ${papers.length} arXiv`);

    const sources = { hn, headlines, papers, fetchedAt: now.toISOString() };
    const results = { daily: null, weekly: null };

    // Daily Brief — every day
    try {
        const lead = pickDailyLead(hn, headlines);
        const html = buildDailyHTML(now, hn, headlines, papers, lead);
        const issueNumber = computeDailyIssueNum(now);
        results.daily = await writeEdition({
            editionDate, kind: 'daily', issueNumber, volumeNumber: null, lead, html, sources
        });
    } catch (e) {
        console.error('  ❌ daily failed:', e.message);
        results.daily = { error: e.message };
    }

    // Weekly Edition — Sundays only
    if (isSunday) {
        try {
            const html = buildWeeklyHTML(now, hn, headlines, papers);
            const { vol, issue } = computeWeeklyIssueNum(now);
            const lead = mergeHeadlines(headlines, hn, 1)[0] || null;
            results.weekly = await writeEdition({
                editionDate, kind: 'weekly', issueNumber: issue, volumeNumber: vol, lead, html, sources
            });
        } catch (e) {
            console.error('  ❌ weekly failed:', e.message);
            results.weekly = { error: e.message };
        }
    }

    // Fail loudly (collect-events convention): a schema mismatch or dead feed
    // used to return success:true / HTTP 200 forever — invisible in the Netlify
    // dashboard, which is where MAINTENANCE Part A checks for red invocations.
    const anyFailed = Boolean(results.daily?.error) || (isSunday && Boolean(results.weekly?.error));
    return new Response(JSON.stringify({
        success: !anyFailed,
        editionDate,
        isSunday,
        results,
        sourceCounts: { hn: hn.length, headlines: headlines.length, papers: papers.length }
    }), {
        status: anyFailed ? 500 : 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// ── Netlify config: daily UTC midnight ──
export const config = {
    schedule: '0 0 * * *'
};
