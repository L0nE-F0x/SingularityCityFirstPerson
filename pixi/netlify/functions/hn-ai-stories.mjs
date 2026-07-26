// Server-side Hacker News fetch + AI-topic filter.
// Scans the top ~60 HN stories, keeps those whose title matches an AI-related
// keyword (word-boundary only — avoids "AI" inside "paid" etc.), and returns
// the top 5. In-memory cached for 10 minutes so Netlify functions don't spam
// HN's Firebase API.

let cache = { ts: 0, stories: [] };
const CACHE_TTL = 10 * 60 * 1000; // 10 min

import { isAITitle } from './_shared/ai-keywords.mjs';

export default async (_req) => {
    const now = Date.now();
    if (now - cache.ts < CACHE_TTL && cache.stories.length) {
        return new Response(
            JSON.stringify({ cachedAt: cache.ts, stories: cache.stories }),
            { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' } }
        );
    }

    try {
        const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
            signal: AbortSignal.timeout(8000)
        });
        if (!idsRes.ok) throw new Error('topstories → HTTP ' + idsRes.status);
        const ids = await idsRes.json();
        const candidates = Array.isArray(ids) ? ids.slice(0, 60) : [];

        const items = await Promise.all(candidates.map(async id => {
            try {
                const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    signal: AbortSignal.timeout(6000)
                });
                if (!r.ok) return null;
                return await r.json();
            } catch { return null; }
        }));

        const stories = items
            .filter(it => it && it.type === 'story' && it.title && !it.deleted && !it.dead && isAITitle(it.title))
            .slice(0, 5)
            .map(it => ({
                id: it.id,
                title: it.title,
                url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
                by: it.by || 'anon',
                score: it.score || 0,
                descendants: it.descendants || 0
            }));

        cache = { ts: now, stories };
        return new Response(
            JSON.stringify({ cachedAt: now, stories }),
            { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' } }
        );
    } catch (err) {
        // Serve stale cache on failure so the city never has blank sky after first success.
        if (cache.stories.length) {
            return new Response(
                JSON.stringify({ cachedAt: cache.ts, stories: cache.stories, stale: true }),
                { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } }
            );
        }
        return new Response(
            JSON.stringify({ error: String(err && err.message || err), stories: [] }),
            { status: 502, headers: { 'content-type': 'application/json' } }
        );
    }
};
