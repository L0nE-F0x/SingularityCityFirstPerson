/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   COMPUTE WORKER (v1.0.0)
   Off-main-thread model data aggregation — eliminates redundant array scans from the game loop
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

self.onmessage = function(e) {
    const { type, payload } = e.data;
    if (type === 'crunch') {
        self.postMessage({ type: 'crunched', payload: crunch(payload) });
    }
};

/**
 * Single-pass aggregation of all model data.
 * Replaces 60+ redundant Array.filter() calls in evolveCity + 5 filter/map calls in HUD stats.
 *
 * @param {Object} payload
 * @param {Array}  payload.models     — [{id, lab, name, ret, os, phase, _src}, ...]
 * @param {Object} payload.benchmarks — { modelId: { ELO, ...scores }, ... }
 * @param {Object} payload.costs      — { modelId: { output: N }, ... }
 * @param {Object} payload.labRegions — { labKey: 'us'|'cn'|'eu', ... }
 */
function crunch({ models, benchmarks, costs, labRegions }) {
    const now = Date.now();

    // ─── Global counters (HUD stats) ───
    let alive = 0, discovered = 0, training = 0;
    const labSet = new Set();

    // ─── Per-lab aggregation ───
    // { labKey: { active, total, osCount, topScore, topName, topElo } }
    const perLab = {};

    // ─── Global leaders ───
    let topElo = 0, topLab = null;
    let lowestCost = Infinity, cheapestLab = null;

    // ─── Per-region active counts ───
    const perRegion = {};

    // ═══ SINGLE PASS over all models ═══
    for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const retTime = m.ret ? new Date(m.ret).getTime() : Infinity;
        const isAlive = retTime > now;

        // HUD counters
        if (isAlive) alive++;
        if (m._src) discovered++;
        const ph = m.phase;
        if (ph === 'rumored' || ph === 'pre_training' || ph === 'training') training++;
        labSet.add(m.lab);

        // Per-lab bucket
        if (!perLab[m.lab]) {
            perLab[m.lab] = { active: 0, total: 0, osCount: 0, topScore: 0, topName: '', topElo: 0 };
        }
        const pl = perLab[m.lab];
        pl.total++;
        if (isAlive) pl.active++;
        if (m.os) pl.osCount++;

        // Benchmark scoring — find top model per lab
        const bm = benchmarks[m.id];
        if (bm) {
            let score = 0;
            if (bm.ELO) {
                score = (bm.ELO - 1000) / 4.5;
                if (bm.ELO > pl.topElo) pl.topElo = bm.ELO;
            }
            if (score === 0) {
                const keys = Object.keys(bm);
                let sum = 0, cnt = 0;
                for (let k = 0; k < keys.length; k++) {
                    const v = bm[keys[k]];
                    if (typeof v === 'number' && v > 0) { sum += v; cnt++; }
                }
                if (cnt > 0) score = sum / cnt;
            }
            if (score >= pl.topScore) {
                pl.topScore = score;
                pl.topName = m.name;
            }

            // Global top ELO
            if (bm.ELO && bm.ELO > topElo) { topElo = bm.ELO; topLab = m.lab; }
        }

        // Global cheapest
        const cost = costs[m.id];
        if (cost && cost.output > 0 && cost.output < lowestCost) {
            lowestCost = cost.output;
            cheapestLab = m.lab;
        }

        // Per-region active count
        if (isAlive) {
            const region = labRegions[m.lab] || 'eu';
            perRegion[region] = (perRegion[region] || 0) + 1;
        }
    }

    return {
        stats: {
            alive,
            dead: models.length - alive,
            discovered,
            training,
            labCount: labSet.size,
            total: models.length
        },
        perLab,
        perRegion,
        topLab,
        cheapestLab
    };
}
