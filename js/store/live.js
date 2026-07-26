/* ============================================================================
   LIVE DATA — adapters inspired by production js/api.js (read-only reference).

   Runs entirely inside SingularityCityFirstPerson. Does not touch the production
   tree. Offline fallbacks always win if the network fails.
   ============================================================================ */

import { INTEGRATION, flagEnabled } from './config.js';
import { CityStore } from './city_store.js';
import { NEWS as FALLBACK_NEWS, LABS } from '../data.js';

const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url=';

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function guessLab(text) {
    const t = (text || '').toLowerCase();
    for (const [lab, keys] of Object.entries(INTEGRATION.labKeywords)) {
        if (keys.some(k => t.includes(k))) return lab;
    }
    return null;
}

function utcDateString(d = new Date()) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function readLiveCache() {
    try {
        const raw = localStorage.getItem(INTEGRATION.LIVE_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

function writeLiveCache(payload) {
    try {
        localStorage.setItem(INTEGRATION.LIVE_CACHE_KEY, JSON.stringify({
            ...payload,
            cachedAt: Date.now()
        }));
    } catch (_) { /* quota */ }
}

function appendNewsEvents(items) {
    try {
        const key = INTEGRATION.NEWS_EVENTS_KEY;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const today = utcDateString();
        const rows = items
            .map(n => ({
                date: today,
                title: n.headline,
                url: n.url || '#',
                lab: guessLab(n.headline),
                source: n.source || 'rss',
                ts: Date.now()
            }))
            .filter(e => e.lab);
        const merged = [...rows, ...(Array.isArray(existing) ? existing : [])].slice(0, 200);
        localStorage.setItem(key, JSON.stringify(merged));
    } catch (_) { /* ignore */ }
}

async function fetchRssFeeds() {
    const feeds = shuffle(INTEGRATION.newsFeeds).slice(0, 2);
    const collected = [];
    const sources = [];
    for (const feed of feeds) {
        try {
            const r = await fetch(RSS2JSON + encodeURIComponent(feed.url), {
                signal: AbortSignal.timeout(8000)
            });
            if (!r.ok) continue;
            const d = await r.json();
            if (d.status === 'ok' && d.items?.length) {
                sources.push(feed.source);
                for (const i of d.items.slice(0, 12)) {
                    collected.push({
                        headline: i.title,
                        url: i.link || '#',
                        source: feed.source,
                        date: i.pubDate || undefined
                    });
                }
            }
        } catch (e) {
            console.warn('[Live] RSS failed', feed.source, e.message);
        }
    }
    const seen = new Set();
    const unique = [];
    for (const n of collected) {
        const k = (n.headline || '').toLowerCase();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        unique.push(n);
    }
    return { news: unique.slice(0, 40), sources };
}

async function fetchSupabaseMeta() {
    const { supabaseUrl, supabaseKey } = INTEGRATION;
    if (!supabaseUrl || !supabaseKey) return null;
    const headers = {
        apikey: supabaseKey,
        Authorization: 'Bearer ' + supabaseKey
    };
    try {
        const modelsUrl = `${supabaseUrl}/rest/v1/models?select=id&limit=1`;
        const mRes = await fetch(modelsUrl, {
            headers: { ...headers, Prefer: 'count=exact' },
            signal: AbortSignal.timeout(8000)
        });
        let models;
        const cr = mRes.headers.get('content-range');
        if (cr && cr.includes('/')) {
            const total = parseInt(cr.split('/')[1], 10);
            if (Number.isFinite(total)) models = total;
        }
        let events = [];
        try {
            const eRes = await fetch(
                `${supabaseUrl}/rest/v1/sc_events?select=title,url,lab,source,created_at&order=created_at.desc&limit=12`,
                { headers, signal: AbortSignal.timeout(8000) }
            );
            if (eRes.ok) {
                const data = await eRes.json();
                if (Array.isArray(data)) {
                    events = data
                        .filter(e => e && e.title)
                        .map(e => ({
                            headline: e.title,
                            url: e.url || '#',
                            source: e.source || 'Cloud',
                            lab: e.lab
                        }));
                }
            }
        } catch (_) { /* table may differ */ }
        return { models, events, ok: mRes.ok || events.length > 0 };
    } catch (e) {
        console.warn('[Live] Supabase meta failed', e.message);
        return null;
    }
}

function applyNewsToStore(news, meta) {
    CityStore.setNews(news, meta);
    if (news.length) appendNewsEvents(news);
}

export const Live = {
    _timer: null,
    _running: false,

    async refresh() {
        if (!flagEnabled('liveData')) {
            applyNewsToStore(FALLBACK_NEWS.map(n => ({ ...n, source: n.source || 'Static' })), {
                online: false,
                sources: ['static'],
                error: null
            });
            return CityStore.getSnapshot();
        }

        let news = [];
        let sources = [];
        let models;
        let error = null;
        let online = false;

        try {
            const rss = await fetchRssFeeds();
            news = rss.news;
            sources = rss.sources;
            if (news.length) online = true;
        } catch (e) {
            error = e.message;
        }

        const sb = await fetchSupabaseMeta();
        if (sb?.models != null) models = sb.models;
        if ((!news.length) && sb?.events?.length) {
            news = sb.events;
            sources = [...new Set([...sources, 'supabase'])];
            online = true;
        } else if (sb?.ok) {
            sources = [...new Set([...sources, 'supabase'])];
            online = true;
        }

        if (!news.length) {
            const cache = readLiveCache();
            if (cache?.news?.length) {
                news = cache.news;
                sources = cache.sources || ['cache'];
                models = cache.models ?? models;
                online = false;
                error = error || 'using live cache';
            } else {
                news = FALLBACK_NEWS.map(n => ({ ...n, source: n.source || 'Static' }));
                sources = ['static'];
            }
        } else {
            writeLiveCache({ news, sources, models });
        }

        applyNewsToStore(news, {
            online,
            sources,
            models,
            error,
            lastFetch: Date.now(),
            mixed: online && sources.includes('static')
        });

        if (typeof models === 'number' && models > 0) {
            const base = CityStore.getSnapshot().aiIndex || 512;
            const boosted = Math.min(1000, Math.round(base * 0.85 + Math.min(models, 1200) * 0.12));
            CityStore.patch({
                aiIndex: boosted,
                aiDelta: boosted - base,
                live: { ...CityStore.getSnapshot().live, models }
            });
        }

        return CityStore.getSnapshot();
    },

    start(intervalMs = 5 * 60 * 1000) {
        if (this._running) return;
        this._running = true;
        setTimeout(() => { this.refresh().catch(() => {}); }, 1200);
        this._timer = setInterval(() => {
            this.refresh().catch(() => {});
        }, intervalMs);
    },

    stop() {
        this._running = false;
        if (this._timer) clearInterval(this._timer);
        this._timer = null;
    },

    labColor(labId) {
        return LABS[labId]?.color || '#94a3b8';
    }
};

if (typeof window !== 'undefined') window.Live = Live;
