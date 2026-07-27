/* ══════════════════════════════════════════════════════════════════════════
   CITY LAYOUT — places every building into the 5×5 district grid.
   Ported from SingularityCity3D districts.js (round-robin quadrant clusters
   around an inner cross-road), extended with roads, walkable plazas and
   collision boxes.
   ══════════════════════════════════════════════════════════════════════════ */
import { DISTRICTS, BLDS, DC_FACILITIES, BIOMES } from './data.js';
import { CELL_W, CELL_D, GAP, GRID_COLS, GRID_ROWS, FLOOR_H, CITY_W, CITY_D, G } from './state.js';

// Road cross-sections, in world units (10 u = 1 m). A "main" road is a 12 m
// carriageway — two 3 m lanes each way — with 4 m sidewalks either side.
export const CARRIAGE = { main: 120, ring: 96, inner: 44 };
export const SIDEWALK = { main: 38, ring: 20, inner: 16 };
export const INNER_STRIP = CARRIAGE.inner + SIDEWALK.inner * 2;
export const KERB_H = 1.8;
export const LANE_W = 30;          // one lane; cars sit on its centre

// Deterministic RNG (same generator as world.js) so the infill blocks are
// identical every visit and the collision boxes match what you can see.
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* Storey multiplier per building type. The authored `fl` values top out at 9,
   which at FLOOR_H 24 made Google DeepMind — the tallest structure in
   Singularity City — 21.6 m, while footprints ran to 18 m wide. Every building
   was twice as wide as it was tall, so there was no skyline at all, and all of
   world.js's setback / crown / spire code was unreachable dead code because it
   gates on 10+ storeys. The authored numbers stay the source of relative
   ranking; this turns them into a city.

   `slim` narrows the footprint for the tall types so towers read as towers
   rather than as very large sheds. */
const HEIGHT_SCALE = {
    hq:         { fl: 3.6, slim: 0.78 },   // the lab HQs ARE the skyline (~7:1)
    generic:    { fl: 2.1, slim: 0.86 },
    housing:    { fl: 2.6, slim: 0.80 },
    newspaper:  { fl: 2.6, slim: 0.80 },
    bar:        { fl: 1.7, slim: 0.90 },
    embassy:    { fl: 1.7, slim: 0.92 },
    datacenter: { fl: 1.3, slim: 1.0 },
    fab:        { fl: 1.3, slim: 1.0 },
    warehouse:  { fl: 1.2, slim: 1.0 },
    villa:      { fl: 1.0, slim: 1.0 },
    cabin:      { fl: 1.0, slim: 1.0 },
    metro:      { fl: 1.0, slim: 1.0 }
};
const HEIGHT_DEFAULT = { fl: 1.9, slim: 0.9 };

/* How much of a district's leftover land gets anonymous background blocks, and
   how tall they are. The named buildings are only 3–7 per district in an
   800×800 cell, which left the city reading as a sparse office park with
   enormous empty lots between landmarks. Infill is what turns it into a city:
   the landmarks stay the landmarks, but they now sit in a built-up block
   instead of a field. */
const INFILL = {
    urban:     { p: 0.82, fl: [4, 14] },
    industry:  { p: 0.58, fl: [1, 4] },
    coastal:   { p: 0.46, fl: [1, 4] },
    suburban:  { p: 0.72, fl: [2, 5] },
    academic:  { p: 0.44, fl: [2, 6] },
    plaza:     { p: 0.22, fl: [2, 5] },
    wasteland: { p: 0.38, fl: [1, 3] },
    desert:    { p: 0.10, fl: [1, 2] },
    park:      { p: 0, fl: [1, 1] },
    forest:    { p: 0, fl: [1, 1] }
};

export const City = {
    districts: [],          // enriched district defs with world coords
    infill: [],             // background blocks filling the empty lots
    roads: [],              // { x, z, w, d, vertical, carriage, sidewalk }
    avenueXs: [], streetZs: [],   // road centrelines for traffic/citizens
    plazas: [],             // open walkable rects (park hearts etc.)

    cellCenter(col, row) {
        const startX = -CITY_W / 2 + CELL_W / 2;
        const startZ = -CITY_D / 2 + CELL_D / 2;
        return { x: startX + col * (CELL_W + GAP), z: startZ + row * (CELL_D + GAP) };
    },

    layout() {
        // Merge DC facilities into the building list (they're buildings too)
        for (const dc of DC_FACILITIES) {
            if (!BLDS.find(b => b.id === dc.id)) {
                BLDS.push({
                    id: dc.id, name: dc.name, w: dc.w || 160, fl: 3,
                    emoji: dc.type === 'chipfab' ? '🔧' : '🖥️',
                    type: dc.type === 'chipfab' ? 'fab' : 'datacenter',
                    desc: dc.desc, dcData: dc
                });
            }
        }

        const innerRoadHalf = 30;
        const inset = 30;
        const halfW = CELL_W / 2;
        const quadAvail = halfW - innerRoadHalf - inset;
        const QUADS = [{ dx: -1, dz: -1 }, { dx: 1, dz: -1 }, { dx: -1, dz: 1 }, { dx: 1, dz: 1 }];

        this.districts = DISTRICTS.map(def => {
            const c = this.cellCenter(def.col, def.row);
            const d = { ...def, cx: c.x, cz: c.z, biomeDef: BIOMES[def.biome] };
            const blds = def.bldIds.map(id => BLDS.find(b => b.id === id)).filter(Boolean);

            // Round-robin into 4 quadrant clusters
            const quadBlds = [[], [], [], []];
            blds.forEach((b, i) => quadBlds[i % 4].push(b));

            quadBlds.forEach((qb, qi) => {
                if (!qb.length) return;
                const N = qb.length;
                const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
                const rows = Math.max(1, Math.ceil(N / cols));
                const slotW = Math.min(210, quadAvail / cols);
                const slotD = Math.min(180, quadAvail / rows);
                const clusterW = cols * slotW, clusterD = rows * slotD;
                const off = QUADS[qi];
                const ccx = c.x + off.dx * (innerRoadHalf + clusterW / 2);
                const ccz = c.z + off.dz * (innerRoadHalf + clusterD / 2);

                qb.forEach((b, i) => {
                    const col = i % cols, row = Math.floor(i / cols);
                    const bx = ccx - clusterW / 2 + col * slotW + slotW / 2;
                    const bz = ccz - clusterD / 2 + row * slotD + slotD / 2;
                    const hs = HEIGHT_SCALE[b.type] || HEIGHT_DEFAULT;
                    const bw = Math.min(b.w, slotW - 24) * hs.slim;
                    const bd = Math.min(b.w * 0.8, slotD - 24) * hs.slim;
                    // Effective storeys — `floors`, not `b.fl`, is what the
                    // renderer tiers, sets back and crowns off.
                    const floors = Math.max(1, Math.round((b.fl || 3) * hs.fl));
                    const bh = Math.max(FLOOR_H * 0.7, floors * FLOOR_H);
                    const p = {
                        b, id: b.id, x: bx, z: bz, w: bw, d: bd, h: bh, floors,
                        district: d.id, rot: 0
                    };
                    G.placements.push(p);
                    G.bldById[b.id] = Object.assign(b, { worldX: bx, worldZ: bz, worldH: bh, worldW: bw, worldD: bd, worldFloors: floors, district: d.id });
                    // Collide box (pad a little). Open/walk-through types get
                    // their own precise colliders in world.js instead.
                    const OPEN = new Set(['park', 'launchpad', 'solar', 'wind', 'dam', 'crane', 'graveyard', 'billboard', 'monument', 'arena', 'black_market', 'nuclear', 'coal', 'dish', 'fusion', 'jail']);
                    if (!OPEN.has(b.type)) {
                        G.colliders.push({ x0: bx - bw / 2 - 2, z0: bz - bd / 2 - 2, x1: bx + bw / 2 + 2, z1: bz + bd / 2 + 2, id: b.id });
                    }
                });
            });
            return d;
        });

        // ── Roads: the GAP strips between cells + perimeter ring ──
        // Each road is a strip of total width `w`/`d` split into a central
        // carriageway (asphalt, CARRIAGE wide) and a raised sidewalk on either
        // side. Everything downstream — lane markings, kerbs, car lanes and
        // pedestrian paths — is derived from these two numbers, so the road
        // surface and the things using it can never disagree.
        // Vertical avenues between columns
        for (let c = 0; c < GRID_COLS - 1; c++) {
            const x = -CITY_W / 2 + CELL_W + GAP / 2 + c * (CELL_W + GAP);
            this.roads.push({ x, z: 0, w: GAP, d: CITY_D, vertical: true, carriage: CARRIAGE.main, sidewalk: SIDEWALK.main });
            this.avenueXs.push(x);
        }
        // Horizontal streets between rows
        for (let r = 0; r < GRID_ROWS - 1; r++) {
            const z = -CITY_D / 2 + CELL_D + GAP / 2 + r * (CELL_D + GAP);
            this.roads.push({ x: 0, z, w: CITY_W, d: GAP, vertical: false, carriage: CARRIAGE.main, sidewalk: SIDEWALK.main });
            this.streetZs.push(z);
        }
        // Perimeter ring
        const per = 140;
        this.roads.push({ x: -CITY_W / 2 - GAP / 2 + 30, z: 0, w: per, d: CITY_D + GAP, vertical: true, carriage: CARRIAGE.ring, sidewalk: SIDEWALK.ring });
        this.roads.push({ x: CITY_W / 2 + GAP / 2 - 30, z: 0, w: per, d: CITY_D + GAP, vertical: true, carriage: CARRIAGE.ring, sidewalk: SIDEWALK.ring });
        this.roads.push({ x: 0, z: -CITY_D / 2 - GAP / 2 + 30, w: CITY_W + GAP, d: per, vertical: false, carriage: CARRIAGE.ring, sidewalk: SIDEWALK.ring });
        this.roads.push({ x: 0, z: CITY_D / 2 + GAP / 2 - 30, w: CITY_W + GAP, d: per, vertical: false, carriage: CARRIAGE.ring, sidewalk: SIDEWALK.ring });
        this.ringX = [-CITY_W / 2 - GAP / 2 + 30, CITY_W / 2 + GAP / 2 - 30];
        this.ringZ = [-CITY_D / 2 - GAP / 2 + 30, CITY_D / 2 + GAP / 2 - 30];

        // Inner cross roads, one per district (previously built straight into
        // the ground mesh, so nothing else knew they existed)
        for (const d of this.districts) {
            this.roads.push({ x: d.cx, z: d.cz, w: INNER_STRIP, d: CELL_D, vertical: true, carriage: CARRIAGE.inner, sidewalk: SIDEWALK.inner, inner: true });
            this.roads.push({ x: d.cx, z: d.cz, w: CELL_W, d: INNER_STRIP, vertical: false, carriage: CARRIAGE.inner, sidewalk: SIDEWALK.inner, inner: true });
        }

        this.buildInfill();

        // districtAt(x, z) lookup helper
        G.districtAt = (x, z) => {
            for (const d of this.districts) {
                if (Math.abs(x - d.cx) <= CELL_W / 2 && Math.abs(z - d.cz) <= CELL_D / 2) return d;
            }
            return null;
        };

        return this.districts;
    },

    /* Background city blocks on every lot the named buildings didn't claim.
       Laid out on a regular grid so the result reads as city blocks rather than
       scattered debris, clear of the inner cross road and of anything that
       already has a collider. Each block also becomes a collider, so citizens,
       traffic and the player all agree with what is drawn. */
    buildInfill() {
        this.infill = [];
        const STEP = 104;            // lot pitch
        const HALF = 392;            // stay a hair inside the cell so the pavement survives
        const CROSS = 96;            // clearance around the inner cross road
        let seed = 90210;

        for (const d of this.districts) {
            const cfg = INFILL[d.biome] || INFILL.urban;
            if (cfg.p <= 0) continue;
            const rnd = mulberry32(seed++);
            // Centre the lot grid on the district so the blocks line up with the
            // inner cross road instead of drifting to one corner.
            const n = Math.floor((2 * HALF) / STEP);
            const first = -((n - 1) / 2) * STEP;
            for (let ix = 0; ix < n; ix++) {
                for (let iz = 0; iz < n; iz++) {
                    const gx = first + ix * STEP;
                    const gz = first + iz * STEP;
                    if (Math.abs(gx) < CROSS || Math.abs(gz) < CROSS) continue;
                    if (rnd() > cfg.p) continue;

                    const w = STEP * (0.62 + rnd() * 0.26);
                    const dp = STEP * (0.62 + rnd() * 0.26);
                    const x = d.cx + gx + (rnd() - 0.5) * 10;
                    const z = d.cz + gz + (rnd() - 0.5) * 10;

                    // Never build on top of a landmark, monument or plaza.
                    let blocked = false;
                    for (const c of G.colliders) {
                        if (x + w / 2 + 16 > c.x0 && x - w / 2 - 16 < c.x1 &&
                            z + dp / 2 + 16 > c.z0 && z - dp / 2 - 16 < c.z1) { blocked = true; break; }
                    }
                    if (blocked) continue;

                    // Height falls off toward the city edge so the skyline has a
                    // downtown rather than a uniform wall of blocks.
                    const edge = Math.max(Math.abs(d.cx) / (CITY_W / 2), Math.abs(d.cz) / (CITY_D / 2));
                    const [lo, hi] = cfg.fl;
                    const span = hi - lo;
                    const fl = Math.max(1, Math.round(lo + span * Math.pow(rnd(), 1.5) * (1 - edge * 0.45)));

                    const lot = {
                        x, z, w, d: dp,
                        h: fl * FLOOR_H,
                        fl,
                        district: d.id,
                        biome: d.biome,
                        seed: rnd()
                    };
                    this.infill.push(lot);
                    G.colliders.push({ x0: x - w / 2, z0: z - dp / 2, x1: x + w / 2, z1: z + dp / 2, id: 'infill' });
                }
            }
        }
        return this.infill;
    },

    // ── derived street geometry (pure — no renderer) ────────────────────────
    // Kerb segments for every road, broken around the carriageways that cross
    // it, so a raised sidewalk never runs across an intersecting street's
    // tarmac (the "sidewalks in the middle of the road" junction bug). Because
    // each surviving segment starts exactly at the crossing carriageway's edge,
    // the parallel road's kerb fills the corner and the junction closes cleanly.
    // Returned as {x, z, w, d} boxes; world.js renders them, street_check.mjs
    // asserts none overlaps a carriageway.
    sidewalkSegments() {
        const out = [];
        const verticals = this.roads.filter(r => r.vertical);
        const horizontals = this.roads.filter(r => !r.vertical);
        for (const r of this.roads) {
            if (r.sidewalk <= 0) continue;
            const off = r.carriage / 2 + r.sidewalk / 2;
            const len = r.vertical ? r.d : r.w;          // extent along r's length axis
            const c0 = r.vertical ? r.z : r.x;
            const start = c0 - len / 2, end = c0 + len / 2;
            const perps = r.vertical ? horizontals : verticals;
            const gaps = [];
            for (const p of perps) {
                if (p === r) continue;
                const perpPos = r.vertical ? p.x : p.z;             // p's centre on r's cross axis
                const perpHalf = (r.vertical ? p.w : p.d) / 2;      // …and half-span there
                if (Math.abs((r.vertical ? r.x : r.z) - perpPos) > perpHalf) continue;
                const at = r.vertical ? p.z : p.x;                  // p's position along r's length axis
                if (at < start - 1 || at > end + 1) continue;
                gaps.push([at - p.carriage / 2, at + p.carriage / 2]);
            }
            gaps.sort((a, b) => a[0] - b[0]);
            let cur = start;
            const segs = [];
            for (const [g0, g1] of gaps) {
                if (g0 > cur) segs.push([cur, Math.min(g0, end)]);
                cur = Math.max(cur, g1);
            }
            if (cur < end) segs.push([cur, end]);
            for (const side of [-1, 1]) {
                for (const [s0, s1] of segs) {
                    const segLen = s1 - s0;
                    if (segLen < 2) continue;
                    const mid = (s0 + s1) / 2;
                    out.push(r.vertical
                        ? { x: r.x + side * off, z: mid, w: r.sidewalk, d: segLen }
                        : { x: mid, z: r.z + side * off, w: segLen, d: r.sidewalk });
                }
            }
        }
        return out;
    },

    // Signalled junctions: every avenue × street crossing (where the player
    // actually walks and drives). Ring / inner-district crossings stay clear.
    junctions() {
        const out = [];
        for (const x of this.avenueXs) for (const z of this.streetZs) out.push({ x, z });
        return out;
    },

    // Nearest road intersection to a world point (for citizen routing)
    nearestIntersection(x, z) {
        let bx = this.avenueXs[0] ?? this.ringX[0];
        for (const ax of [...this.avenueXs, ...this.ringX]) if (Math.abs(x - ax) < Math.abs(x - bx)) bx = ax;
        let bz = this.streetZs[0] ?? this.ringZ[0];
        for (const sz of [...this.streetZs, ...this.ringZ]) if (Math.abs(z - sz) < Math.abs(z - bz)) bz = sz;
        return { x: bx, z: bz };
    },

    // ── cross-section lookups ────────────────────────────────────────────────
    // Cars and pedestrians both ask these, so a car lane and the sidewalk a
    // pedestrian walks on are always derived from the same carriageway width.
    _index() {
        if (this._byX) return;
        this._byX = new Map(); this._byZ = new Map();
        for (const r of this.roads) {
            if (r.vertical) { if (!this._byX.has(r.x)) this._byX.set(r.x, r); }
            else if (!this._byZ.has(r.z)) this._byZ.set(r.z, r);
        }
    },
    roadAt(coord, vertical) {
        this._index();
        return (vertical ? this._byX : this._byZ).get(coord) || { carriage: CARRIAGE.main, sidewalk: SIDEWALK.main };
    },
    // centre of lane `n` (0 = innermost) on the given side (+1 / -1)
    laneCentre(coord, vertical, side, n = 0) {
        const r = this.roadAt(coord, vertical);
        const lanes = Math.max(1, Math.floor(r.carriage / 2 / LANE_W));
        const lane = Math.min(n, lanes - 1);
        return coord + side * (lane * LANE_W + LANE_W / 2);
    },
    // centre of the sidewalk on the given side of a road
    sidewalkCentre(coord, vertical, side) {
        const r = this.roadAt(coord, vertical);
        return coord + side * (r.carriage / 2 + r.sidewalk / 2);
    },
    // is this point on tarmac? (pedestrians use it to stay off the road)
    onCarriageway(x, z) {
        this._index();
        for (const [cx, r] of this._byX) if (Math.abs(x - cx) < r.carriage / 2) return true;
        for (const [cz, r] of this._byZ) if (Math.abs(z - cz) < r.carriage / 2) return true;
        return false;
    },
    // standing on a raised sidewalk? (so pedestrians stand on it, not in it)
    onSidewalk(x, z) {
        this._index();
        for (const [cx, r] of this._byX) {
            const d = Math.abs(x - cx);
            if (d >= r.carriage / 2 && d <= r.carriage / 2 + r.sidewalk) return true;
        }
        for (const [cz, r] of this._byZ) {
            const d = Math.abs(z - cz);
            if (d >= r.carriage / 2 && d <= r.carriage / 2 + r.sidewalk) return true;
        }
        return false;
    },
    // nudge a point off the tarmac onto the nearest pavement
    offRoad(x, z) {
        this._index();
        for (const [cx, r] of this._byX) {
            const d = x - cx;
            if (Math.abs(d) < r.carriage / 2) x = cx + Math.sign(d || 1) * (r.carriage / 2 + r.sidewalk / 2);
        }
        for (const [cz, r] of this._byZ) {
            const d = z - cz;
            if (Math.abs(d) < r.carriage / 2) z = cz + Math.sign(d || 1) * (r.carriage / 2 + r.sidewalk / 2);
        }
        return { x, z };
    }
};
