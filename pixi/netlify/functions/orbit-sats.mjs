// Server-side CelesTrak fetch + region filter + sampling.
// Starlink's JSON is ~4 MB (8400+ sats). Shipping that to the browser is fragile;
// doing it here returns a ~20 KB sampled payload instead.

let cache = { ts: 0, starlink: [], oneweb: [] };
const CACHE_TTL = 30 * 60 * 1000; // 30 min in-memory

async function fetchGroup(group) {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${group} → HTTP ${res.status}`);
    return res.json();
}

function compact(raw, group) {
    return {
        name: raw.OBJECT_NAME || 'Unknown',
        group,
        noradId: raw.NORAD_CAT_ID || 0,
        inclination: raw.INCLINATION || 0,
        eccentricity: raw.ECCENTRICITY || 0,
        meanMotion: raw.MEAN_MOTION || 0,
        raan: raw.RA_OF_ASC_NODE || 0,
        phase: raw.MEAN_ANOMALY || 0
    };
}

function filterByLon(arr, userLon) {
    if (userLon == null || Number.isNaN(userLon)) return arr;
    return arr.filter(s => {
        const diff = Math.abs(((s.raan - userLon + 540) % 360) - 180);
        return diff < 90;
    });
}

function sample(arr, n) {
    if (arr.length <= n) return arr;
    const step = arr.length / n;
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
    return out;
}

function pickBest(arr, n, lon) {
    const regional = filterByLon(arr, lon);
    // If the region yielded a decent subset, use it; otherwise fall back to global.
    return sample(regional.length > n / 2 ? regional : arr, n);
}

export default async (req) => {
    const url = new URL(req.url);
    const lonRaw = url.searchParams.get('lon');
    const lon = lonRaw != null ? Number(lonRaw) : null;
    const starlinkN = Math.min(Number(url.searchParams.get('starlink') || 80), 200);
    const onewebN = Math.min(Number(url.searchParams.get('oneweb') || 20), 100);

    try {
        const fresh = cache.ts && (Date.now() - cache.ts < CACHE_TTL);
        if (!fresh) {
            const [star, one] = await Promise.all([
                fetchGroup('starlink').catch(e => { console.warn('starlink:', e.message); return []; }),
                fetchGroup('oneweb').catch(e => { console.warn('oneweb:', e.message); return []; })
            ]);
            const newStar = star.map(s => compact(s, 'starlink'));
            const newOne = one.map(s => compact(s, 'oneweb'));
            // Only overwrite cache if we got at least one group — keep stale data
            // rather than regress to empty if CelesTrak hiccups briefly.
            if (newStar.length > 0 || newOne.length > 0) {
                cache = {
                    ts: Date.now(),
                    starlink: newStar.length > 0 ? newStar : cache.starlink,
                    oneweb: newOne.length > 0 ? newOne : cache.oneweb
                };
            }
        }

        return new Response(JSON.stringify({
            cachedAt: cache.ts,
            counts: { starlink: cache.starlink.length, oneweb: cache.oneweb.length },
            starlink: pickBest(cache.starlink, starlinkN, lon),
            oneweb: pickBest(cache.oneweb, onewebN, lon)
        }), {
            headers: {
                'content-type': 'application/json',
                'cache-control': 'public, max-age=600, s-maxage=1800',
                'access-control-allow-origin': '*'
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({
            error: err.message,
            starlink: [],
            oneweb: []
        }), {
            status: 500,
            headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
        });
    }
};
