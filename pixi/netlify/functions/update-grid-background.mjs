// ════════════════════════════════════════════════════════════════
// GLOBAL POWER GRID UPDATER — Netlify Scheduled Background Function
// Runs weekly on Mondays at 04:00 UTC. Queries OpenStreetMap Overpass
// API region by region (with patient delays to avoid rate limits),
// processes plant data, and writes the result to Supabase grid_data.
//
// Required env vars (set in Netlify dashboard → Site settings → Environment):
//   SUPABASE_URL          — Your Supabase project URL
//   SUPABASE_SERVICE_KEY  — Service role key (needs write access)
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

// Regional bounding boxes: [south, west, north, east, label]
const GRID_REGIONS = [
    [24, -130, 50, -60,  'North America'],
    [35,  -12, 62,  30,  'Europe'],
    [10,   60, 55, 145,  'Asia-Pacific'],
    [-35, -75, 12, -34,  'South America'],
    [-38, 112, -10, 155, 'Australia'],
    [20,   30, 42,  60,  'Middle East'],
    [-35,  10, 38,  52,  'Africa'],
];

const SOURCE_META = {
    Solar:      { emoji: '☀️',  color: '#fbbf24' },
    Wind:       { emoji: '💨',  color: '#4ade80' },
    Nuclear:    { emoji: '☢️',  color: '#22d3ee' },
    Hydro:      { emoji: '🌊',  color: '#06b6d4' },
    Coal:       { emoji: '🏭',  color: '#94a3b8' },
    Gas:        { emoji: '🔥',  color: '#f97316' },
    Oil:        { emoji: '🛢️',  color: '#78716c' },
    Biomass:    { emoji: '🌿',  color: '#a3e635' },
    Waste:      { emoji: '♻️',  color: '#a78bfa' },
    Geothermal: { emoji: '🌋',  color: '#ef4444' },
    Tidal:      { emoji: '🌊',  color: '#0ea5e9' },
    Other:      { emoji: '⚡',  color: '#64748b' },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseMW(str) {
    if (!str) return 0;
    const m = str.match(/([\d.,]+)\s*(GW|MW|kW|W)\b/i);
    if (!m) return 0;
    let v = parseFloat(m[1].replace(/,/g, ''));
    const u = m[2].toUpperCase();
    if (u === 'GW') v *= 1000;
    if (u === 'KW') v /= 1000;
    if (u === 'W')  v /= 1e6;
    return v;
}

function classifySource(src) {
    if (!src) return 'Other';
    const s = src.toLowerCase();
    if (s.includes('solar'))                                  return 'Solar';
    if (s.includes('wind'))                                   return 'Wind';
    if (s.includes('nuclear'))                                return 'Nuclear';
    if (s.includes('hydro') || s.includes('water'))           return 'Hydro';
    if (s.includes('coal') || s.includes('lignite'))          return 'Coal';
    if (s.includes('gas') && !s.includes('biogas'))           return 'Gas';
    if (s.includes('oil') || s.includes('diesel'))            return 'Oil';
    if (s.includes('biomass') || s.includes('biofuel') || s.includes('biogas') || s.includes('wood')) return 'Biomass';
    if (s.includes('waste'))                                  return 'Waste';
    if (s.includes('geothermal'))                             return 'Geothermal';
    if (s.includes('tidal') || s.includes('wave'))            return 'Tidal';
    return 'Other';
}

async function queryOverpass(query, endpointIdx, retries = 2) {
    const url = OVERPASS_ENDPOINTS[endpointIdx];
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 90000); // 90s per query
            const r = await fetch(url, {
                method: 'POST',
                // Overpass began returning HTTP 406 (mid-2026) to requests without an
                // explicit User-Agent — Node/undici's default UA is rejected. A
                // descriptive UA (Overpass etiquette) restores 200s. Content-Type is
                // set for correctness on the form-encoded body.
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'SingularityCity/1.0 (global grid refresh; +https://singularitycity.net)'
                },
                body: 'data=' + encodeURIComponent(query),
                signal: controller.signal
            });
            clearTimeout(timer);

            if (r.status === 429) {
                console.log(`  ⏳ Rate limited, waiting 60s (attempt ${attempt + 1})…`);
                await sleep(60000);
                continue;
            }
            if (r.status === 504) {
                console.log(`  ⏳ Gateway timeout, waiting 30s (attempt ${attempt + 1})…`);
                await sleep(30000);
                continue;
            }
            if (!r.ok) throw new Error('http-' + r.status);

            const data = await r.json();
            // Check for Overpass runtime errors (query timed out on their end)
            if (data.remark && data.remark.includes('timed out')) {
                console.log(`  ⏳ Query timed out on server, retrying…`);
                await sleep(20000);
                continue;
            }
            return data;
        } catch (e) {
            if (e.name === 'AbortError') {
                console.log(`  ⏳ Fetch aborted (90s), retrying…`);
                await sleep(15000);
                continue;
            }
            throw e;
        }
    }
    throw new Error('Max retries exceeded');
}

async function writeToSupabase(gridData) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing Supabase credentials');
        return false;
    }
    const row = {
        id: 'global',
        data: gridData,
        updated_at: new Date().toISOString()
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/grid_data?on_conflict=id`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(row)
    });
    if (!res.ok) {
        console.error(`Supabase upsert failed: ${res.status} ${await res.text()}`);
        return false;
    }
    console.log('✅ Grid data written to Supabase');
    return true;
}

export default async (_req) => {
    console.log('⚡ Weekly grid data update starting…');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
        return new Response(JSON.stringify({ error: 'Missing Supabase config' }), { status: 500 });
    }

    const bySource = {};
    const byRegion = {};
    let plantCount = 0;
    let totalMW = 0;
    let regionsOK = 0;

    for (let i = 0; i < GRID_REGIONS.length; i++) {
        const [south, west, north, east, label] = GRID_REGIONS[i];

        // Query nodes only (ways take 10x longer and most capacity data is on nodes)
        const query = `[out:json][timeout:60];\n(\n  node["power"="plant"](${south},${west},${north},${east});\n);\nout tags;`;

        console.log(`⚡ [${i + 1}/${GRID_REGIONS.length}] Querying ${label}…`);

        let elements = [];
        let success = false;

        // Try both endpoints
        for (let ep = 0; ep < OVERPASS_ENDPOINTS.length && !success; ep++) {
            try {
                const data = await queryOverpass(query, ep);
                elements = data.elements || [];
                success = true;
                console.log(`  ✅ ${label}: ${elements.length} plants`);
            } catch (e) {
                console.warn(`  ❌ ${label} endpoint ${ep}: ${e.message}`);
            }
        }

        if (!success) {
            console.warn(`  ⚠️ Skipping ${label} — all endpoints failed`);
            // Wait before next region anyway
            if (i < GRID_REGIONS.length - 1) await sleep(15000);
            continue;
        }

        // Process elements
        for (const el of elements) {
            const tags = el.tags || {};
            const src = tags['plant:source'] || tags['generator:source'] || '';
            const mwStr = tags['plant:output:electricity'] || tags['generator:output:electricity'] || '';
            const mw = parseMW(mwStr);
            const name = tags.name || tags.operator || '';
            const type = classifySource(src);
            const meta = SOURCE_META[type] || SOURCE_META.Other;

            if (!bySource[type]) bySource[type] = { count: 0, totalMW: 0, emoji: meta.emoji, color: meta.color, plants: [] };
            bySource[type].count++;
            bySource[type].totalMW += mw;
            if (mw >= 100 && bySource[type].plants.length < 5) {
                bySource[type].plants.push({ name: name || type + ' plant', mw });
            }

            if (!byRegion[label]) byRegion[label] = { count: 0, totalMW: 0 };
            byRegion[label].count++;
            byRegion[label].totalMW += mw;

            plantCount++;
            totalMW += mw;
        }

        regionsOK++;

        // Patient delay between regions to stay within rate limits
        if (i < GRID_REGIONS.length - 1) {
            console.log('  ⏳ Waiting 15s before next region…');
            await sleep(15000);
        }
    }

    if (regionsOK === 0) {
        console.error('⚡ All regions failed — aborting update');
        return new Response(JSON.stringify({ error: 'All regions failed' }), { status: 502 });
    }

    // Build final dataset
    const sorted = Object.entries(bySource)
        .map(([type, d]) => ({ type, ...d }))
        .sort((a, b) => b.totalMW - a.totalMW);

    const renewTypes = new Set(['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Tidal']);
    const fossilTypes = new Set(['Coal', 'Gas', 'Oil']);
    let renewMW = 0, fossilMW = 0;
    sorted.forEach(s => {
        if (renewTypes.has(s.type)) renewMW += s.totalMW;
        if (fossilTypes.has(s.type)) fossilMW += s.totalMW;
    });

    const gridData = {
        sources: sorted,
        byRegion: Object.entries(byRegion)
            .map(([region, d]) => ({ region, ...d }))
            .sort((a, b) => b.totalMW - a.totalMW),
        plantCount,
        totalMW,
        renewMW,
        fossilMW,
        renewPct: totalMW > 0 ? Math.round((renewMW / totalMW) * 1000) / 10 : 0,
        fossilPct: totalMW > 0 ? Math.round((fossilMW / totalMW) * 1000) / 10 : 0,
        regionsScanned: regionsOK,
        regionsTotal: GRID_REGIONS.length,
        fetchedAt: new Date().toISOString(),
        dataSource: 'OpenStreetMap Overpass API (auto-refreshed weekly)'
    };

    console.log(`⚡ Total: ${plantCount} plants, ${Math.round(totalMW).toLocaleString()} MW, ${gridData.renewPct}% renewable (${regionsOK}/${GRID_REGIONS.length} regions)`);

    // Write to Supabase
    const ok = await writeToSupabase(gridData);
    if (!ok) {
        return new Response(JSON.stringify({ error: 'Supabase write failed' }), { status: 500 });
    }

    console.log('⚡ Weekly grid update complete!');
    return new Response(JSON.stringify({
        success: true,
        plantCount,
        totalMW: Math.round(totalMW),
        renewPct: gridData.renewPct,
        regions: regionsOK
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// ── Netlify config: background function + weekly schedule ──
export const config = {
    schedule: "0 4 * * 1"   // Every Monday at 04:00 UTC
};
