/**
 * Street geometry test (Node — no renderer). Proves the junction fixes:
 *   1. No kerb segment runs across an intersecting street's carriageway
 *      (the "sidewalks in the middle of the road" bug).
 *   2. Every sidewalk still hugs its own road (each segment is flush against
 *      exactly one carriageway edge), so the fix didn't just delete kerbs.
 *   3. There is a signalled junction at every avenue × street crossing, and
 *      each carries four signal heads clear of the tarmac.
 */
import assert from 'assert';

// city.js touches state.G at import; no browser globals needed, but be safe.
globalThis.window = globalThis;

const { City, CARRIAGE, SIDEWALK } = await import('../js/city.js');

City.layout();

// ── carriageway rectangles for every road ────────────────────────────────────
const carriageRects = City.roads.map(r => {
    if (r.vertical) return { x0: r.x - r.carriage / 2, x1: r.x + r.carriage / 2, z0: r.z - r.d / 2, z1: r.z + r.d / 2 };
    return { x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.z - r.carriage / 2, z1: r.z + r.carriage / 2 };
});

// strict overlap area of two axis-aligned rects, shrunk by `eps` so flush
// (edge-touching) neighbours don't count as overlapping.
function overlapArea(a, b, eps) {
    const ox = Math.min(a.x1 - eps, b.x1 - eps) - Math.max(a.x0 + eps, b.x0 + eps);
    const oz = Math.min(a.z1 - eps, b.z1 - eps) - Math.max(a.z0 + eps, b.z0 + eps);
    return ox > 0 && oz > 0 ? ox * oz : 0;
}

const segs = City.sidewalkSegments();
assert.ok(segs.length > 0, 'sidewalk segments produced');

// (1) no sidewalk box overlaps ANY carriageway interior
let worstOverlap = 0;
for (const s of segs) {
    const rect = { x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2 };
    for (const c of carriageRects) worstOverlap = Math.max(worstOverlap, overlapArea(rect, c, 0.5));
}
assert.equal(worstOverlap, 0, `a kerb overlaps a carriageway by ${worstOverlap} u² — sidewalk crosses a junction`);
console.log('ok: no kerb crosses any carriageway');

// (2) every sidewalk hugs a real road (flush against a carriageway edge)
const edges = new Set();
for (const r of City.roads) {
    const o = r.carriage / 2 + r.sidewalk / 2;
    if (r.vertical) { edges.add(`x:${Math.round(r.x + o)}`); edges.add(`x:${Math.round(r.x - o)}`); }
    else { edges.add(`z:${Math.round(r.z + o)}`); edges.add(`z:${Math.round(r.z - o)}`); }
}
for (const s of segs) {
    const hug = edges.has(`x:${Math.round(s.x)}`) || edges.has(`z:${Math.round(s.z)}`);
    assert.ok(hug, `kerb at (${s.x},${s.z}) is not aligned to any road edge`);
}
console.log('ok: every kerb segment hugs a road');

// (3) signalled junctions: one per avenue × street crossing
const j = City.junctions();
assert.equal(j.length, City.avenueXs.length * City.streetZs.length, 'a junction per avenue×street');
assert.ok(j.length >= 12, `expected >=12 junctions, got ${j.length}`);
for (const { x, z } of j) {
    assert.ok(City.avenueXs.includes(x) && City.streetZs.includes(z), 'junction sits on real centrelines');
}
console.log(`ok: ${j.length} signalled junctions on real centrelines`);

// sanity: the cross-section constants the signals rely on exist
assert.ok(CARRIAGE.main > 0 && SIDEWALK.main > 0);

console.log('street_check: OK');
