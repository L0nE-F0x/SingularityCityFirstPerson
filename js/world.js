/* ══════════════════════════════════════════════════════════════════════════
   WORLD RENDERER — builds the entire city with performance as the priority.

   Lessons applied from the laggy SingularityCity3D autopsy:
     • NO per-building meshes — all generic towers live in 3 InstancedMeshes
       (bucketed by height tier) with a shared procedural facade texture.
     • NO per-sign textures — one 2048² canvas atlas, merged quads, 1 draw call.
     • NO shadow maps, NO bloom, NO logarithmic depth, NO transmission.
     • All specialty structures merged into ONE vertex-colored static mesh.
     • Everything repeated (trees, lamps, benches, tombstones, containers,
       poles) is instanced.
   Target: < 150 draw calls for the whole city.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CELL_W, CELL_D, CITY_W, CITY_D, SEA_X, FLOOR_H } from './state.js';
import { LABS, SPACE_ORGS, BIOMES, DISTRICTS, NEWS } from './data.js';
import * as TEX from './textures.js';
import { City, CARRIAGE, KERB_H } from './city.js';

// Deterministic RNG so the city is identical every visit
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(1337);

// ── merged-geometry helpers ──────────────────────────────────────────────────
const STATIC = []; // vertex-colored lambert bucket (merged into 1 mesh)
function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}
// Tile the shared detail texture by real size (default UVs span 0..1 per face,
// which stretches one texel over a whole cooling tower). The map is near-white
// and multiplies the vertex colour, so it adds concrete grain without changing
// the tint. TILE ≈ one texture repeat every 42 units.
const TILE = 42;
function scaleUV(geo, su, sv) {
    const uv = geo.attributes.uv;
    if (!uv) return geo;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return geo;
}
function sBox(w, h, d, x, y, z, color, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    scaleUV(g, Math.max(w, d) / TILE, h / TILE);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    STATIC.push(paint(g, color));
}
function sCyl(rt, rb, h, seg, x, y, z, color) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    scaleUV(g, (2 * Math.PI * rb) / TILE, h / TILE);
    g.translate(x, y, z);
    STATIC.push(paint(g, color));
}
function sCone(r, h, seg, x, y, z, color) {
    const g = new THREE.ConeGeometry(r, h, seg);
    scaleUV(g, (2 * Math.PI * r) / TILE, h / TILE);
    g.translate(x, y, z);
    STATIC.push(paint(g, color));
}
function sSphere(r, x, y, z, color, ws = 10, hs = 8) {
    const g = new THREE.SphereGeometry(r, ws, hs);
    scaleUV(g, (2 * Math.PI * r) / TILE, (Math.PI * r) / TILE);
    g.translate(x, y, z);
    STATIC.push(paint(g, color));
}
function sPlaneUV(w, h, x, y, z, ry, color) { // vertical quad (flags etc.)
    const g = new THREE.PlaneGeometry(w, h);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    STATIC.push(paint(g, color));
}

const TYPE_COLORS = {
    hq: null, housing: '#8a6d5c', villa: '#cbb79a', cabin: '#6b4f35',
    datacenter: null, fab: null, metro: '#3f4a5a', bar: '#3d2a5e',
    newspaper: '#5a5148', warehouse: '#7a6f5f', embassy: '#c8ccd4'
};
const DISTRICT_TINT = {
    tech: '#5a6b80', vc: '#5e5a72', agents: '#3d6b6f', robotics: '#6b5d4f',
    longevity: '#4f7d6b', backbone: '#4a5568', civic: '#66707e', university: '#5d6e7d',
    underground: '#4a4038', residential: '#8a6d5c', embassy: '#b8bcc6', embassy_q: '#cbb79a'
};

function buildingColor(b) {
    if (b.lab && LABS[b.lab]) return LABS[b.lab].color;
    if (b.dcData && b.dcData.color) return b.dcData.color;
    if (TYPE_COLORS[b.type]) return TYPE_COLORS[b.type];
    const base = DISTRICT_TINT[b.district] || '#5a6472';
    const c = new THREE.Color(base);
    c.offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.08);
    return '#' + c.getHexString();
}

/* Brand colours are chosen for logos on white, not for façades: many are
   fully saturated and dark (DeepSeek blue is rgb 0.05/0.23/0.90). Instance
   colours MULTIPLY the facade texture, so those blocks collapse to near-black
   in daylight and the whole city reads as dusk at noon. Pull the tint into a
   range a lit wall can survive — hue (the identity) is untouched; the neon
   signs still carry the full-strength brand colour. */
const _tint = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };
const FACADE_MIN_L = 0.46, FACADE_MAX_L = 0.74, FACADE_MAX_S = 0.42;
function facadeTint(hex) {
    _tint.set(hex).getHSL(_hsl);
    return _tint.setHSL(
        _hsl.h,
        Math.min(_hsl.s, FACADE_MAX_S),
        Math.max(FACADE_MIN_L, Math.min(FACADE_MAX_L, _hsl.l))
    );
}

export const World = {
    animated: [],
    windowMats: [],
    lampHeadMat: null,
    neonMat: null,
    aiBoard: null,
    signCount: 0,

    build() {
        const scene = G.scene;

        // ── LIGHTS ──────────────────────────────────────────────────────
        this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a443c, 1.15);
        scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
        this.sun.position.set(800, 1200, 400);
        scene.add(this.sun);
        this.ambient = new THREE.AmbientLight(0x8a97ac, 0.55);
        scene.add(this.ambient);

        this._buildGround(scene);
        this._buildBuildings(scene);
        this._buildSigns(scene);
        this._buildProps(scene);
        this._buildWater(scene);
        this._buildBillboard(scene);
        this._buildHills(scene);

        // Merge the static specialty bucket → ONE mesh. A shared near-white
        // detail texture (concrete grain + streaks) multiplies the vertex tint
        // so every cooling tower, plinth and turbine hall picks up surface
        // detail for a single extra texture, no extra draw calls.
        if (STATIC.length) {
            const merged = mergeGeometries(STATIC, false);
            const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({
                vertexColors: true, map: TEX.detail()
            }));
            mesh.matrixAutoUpdate = false;
            scene.add(mesh);
            STATIC.length = 0;
        }
    },

    // ── GROUND / ROADS / PAVEMENT ────────────────────────────────────────────
    _buildGround(scene) {
        // World base
        const base = new THREE.Mesh(
            new THREE.PlaneGeometry(24000, 24000),
            new THREE.MeshLambertMaterial({ color: 0x2a3324 })
        );
        base.rotation.x = -Math.PI / 2; base.position.y = -2;
        scene.add(base);

        // District tiles (merged, vertex-colored)
        const tiles = [];
        for (const d of City.districts) {
            const g = new THREE.PlaneGeometry(CELL_W, CELL_D);
            g.rotateX(-Math.PI / 2);
            g.translate(d.cx, 0, d.cz);
            tiles.push(paint(g, d.biomeDef.ground));
        }
        // Outskirts green ring inside the perimeter road
        const tilesMesh = new THREE.Mesh(mergeGeometries(tiles, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        tilesMesh.matrixAutoUpdate = false;
        scene.add(tilesMesh);

        // ── Carriageways ────────────────────────────────────────────────
        // The asphalt texture carries NO lane markings: it tiles in both
        // directions, so a baked centre line drew a grid of dashes running
        // across the road as well as along it. Markings are real geometry now.
        const roadTex = TEX.road();
        const roadGeos = [];
        for (const r of City.roads) {
            const w = r.vertical ? r.carriage : r.w;
            const d = r.vertical ? r.d : r.carriage;
            const g = new THREE.PlaneGeometry(w, d);
            g.rotateX(-Math.PI / 2);
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 64, uv.getY(i) * d / 64);
            g.translate(r.x, 0.4, r.z);
            roadGeos.push(g);
        }
        const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos, false),
            new THREE.MeshLambertMaterial({ map: roadTex }));
        roadMesh.matrixAutoUpdate = false;
        scene.add(roadMesh);

        this._buildSidewalks(scene);
        this._buildRoadMarkings(scene);

        // Pavement quadrant pads (merged)
        const pavTex = TEX.pavement();
        const pavGeos = [];
        for (const d of City.districts) {
            if (d.biome === 'forest' || d.biome === 'desert' || d.biome === 'park') continue;
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                const g = new THREE.PlaneGeometry(352, 352);
                g.rotateX(-Math.PI / 2);
                const uv = g.attributes.uv;
                for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 22, uv.getY(i) * 22);
                g.translate(d.cx + ox * 210, 0.25, d.cz + oz * 210);
                pavGeos.push(g);
            }
        }
        if (pavGeos.length) {
            const m = new THREE.Mesh(mergeGeometries(pavGeos, false),
                new THREE.MeshLambertMaterial({ map: pavTex }));
            m.matrixAutoUpdate = false;
            scene.add(m);
        }
    },

    // Raised, kerbed sidewalks down both sides of every road — one merged
    // mesh. Boxes rather than planes so the kerb has an actual face; that
    // edge is most of what makes a street read as a street.
    _buildSidewalks(scene) {
        const geos = [];
        for (const r of City.roads) {
            if (r.sidewalk <= 0) continue;
            const off = r.carriage / 2 + r.sidewalk / 2;
            for (const side of [-1, 1]) {
                const w = r.vertical ? r.sidewalk : r.w;
                const d = r.vertical ? r.d : r.sidewalk;
                const g = new THREE.BoxGeometry(w, KERB_H, d);
                g.translate(
                    r.x + (r.vertical ? side * off : 0),
                    KERB_H / 2,
                    r.z + (r.vertical ? 0 : side * off));
                const uv = g.attributes.uv;
                for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 40, uv.getY(i) * d / 40);
                geos.push(g);
            }
        }
        if (!geos.length) return;
        const m = new THREE.Mesh(mergeGeometries(geos, false),
            new THREE.MeshLambertMaterial({ map: TEX.pavement() }));
        m.matrixAutoUpdate = false;
        scene.add(m);
    },

    // Lane markings as flat quads just above the tarmac: centre dashes down
    // the direction of travel, solid edge lines, and zebra crossings on every
    // approach to an intersection. One vertex-coloured merged mesh.
    _buildRoadMarkings(scene) {
        const geos = [];
        const mark = (x, z, w, d, hex) => {
            const g = new THREE.PlaneGeometry(w, d);
            g.rotateX(-Math.PI / 2);
            g.translate(x, 0.62, z);
            geos.push(paint(g, hex));
        };
        // where the cross-streets cut each road — no markings inside a junction
        const crossOf = r => (r.vertical
            ? [...City.streetZs, ...City.ringZ, ...City.districts.map(d => d.cz)]
            : [...City.avenueXs, ...City.ringX, ...City.districts.map(d => d.cx)]);

        for (const r of City.roads) {
            const len = r.vertical ? r.d : r.w;
            const along = r.vertical ? r.z : r.x;
            const cross = crossOf(r).filter(c => Math.abs(c - along) <= len / 2 + 200);
            const junction = (t) => cross.some(c => Math.abs(t - c) < CARRIAGE.main / 2 + 26);
            const start = along - len / 2, end = along + len / 2;

            // solid edge lines, full length
            for (const side of [-1, 1]) {
                const o = side * (r.carriage / 2 - 3);
                if (r.vertical) mark(r.x + o, r.z, 3, len, 0xe8e8e0);
                else mark(r.x, r.z + o, len, 3, 0xe8e8e0);
            }
            // centre dashes, skipping junctions
            const DASH = 34, GAPD = 30;
            for (let t = start + 10; t < end - 10; t += DASH + GAPD) {
                if (junction(t + DASH / 2)) continue;
                if (r.vertical) mark(r.x, t + DASH / 2, 3.5, DASH, 0xd8c24a);
                else mark(t + DASH / 2, r.z, DASH, 3.5, 0xd8c24a);
            }
            // zebra crossings on each approach to a junction
            if (r.inner) continue;
            for (const c of cross) {
                if (Math.abs(c) > 1e5) continue;
                for (const near of [-1, 1]) {
                    const base = c + near * (CARRIAGE.main / 2 + 20);
                    if (base < start + 6 || base > end - 6) continue;
                    for (let s = -r.carriage / 2 + 8; s < r.carriage / 2 - 8; s += 18) {
                        if (r.vertical) mark(r.x + s + 5, base, 10, 26, 0xe8e8e0);
                        else mark(base, r.z + s + 5, 26, 10, 0xe8e8e0);
                    }
                }
            }
        }
        if (!geos.length) return;
        const m = new THREE.Mesh(mergeGeometries(geos, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        m.matrixAutoUpdate = false;
        scene.add(m);
    },

    // ── BUILDINGS ────────────────────────────────────────────────────────────
    _buildBuildings(scene) {
        const tiers = [
            { maxFl: 2, rows: 2, facades: TEX.facade(2, { litRatio: 0.5 }) },
            { maxFl: 5, rows: 4, facades: TEX.facade(4, { litRatio: 0.55 }) },
            { maxFl: 99, rows: 8, facades: TEX.facade(8, { litRatio: 0.6 }) }
        ];
        const buckets = [[], [], []];
        const OPEN = new Set(['park', 'launchpad', 'solar', 'wind', 'dam', 'crane', 'graveyard', 'billboard', 'monument', 'arena', 'black_market', 'nuclear', 'coal', 'dish']);

        for (const p of G.placements) {
            const b = p.b;
            if (OPEN.has(b.type)) { this._buildSpecialty(p); continue; }
            const ti = (b.fl || 3) <= 2 ? 0 : (b.fl || 3) <= 5 ? 1 : 2;
            buckets[ti].push(p);
        }

        const dummy = new THREE.Object3D();
        buckets.forEach((list, ti) => {
            if (!list.length) return;
            const t = tiers[ti];
            const geo = new THREE.BoxGeometry(1, 1, 1);
            geo.translate(0, 0.5, 0);
            const side = new THREE.MeshLambertMaterial({
                map: t.facades.map, emissiveMap: t.facades.emissiveMap,
                emissive: new THREE.Color(0xffd9a0), emissiveIntensity: 0
            });
            const roof = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
            this.windowMats.push(side);
            const mats = [side, side, roof, roof, side, side];
            const im = new THREE.InstancedMesh(geo, mats, list.length);
            list.forEach((p, i) => {
                dummy.position.set(p.x, 0, p.z);
                dummy.scale.set(p.w, p.h, p.d);
                dummy.rotation.y = 0;
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                im.setColorAt(i, facadeTint(buildingColor(p.b)));
            });
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            scene.add(im);
            this.bldMeshes = this.bldMeshes || [];
            this.bldMeshes.push(im);
        });

        this._buildRoofs(scene, buckets.flat());
    },

    /* Parapets and rooftop plant. Every building was a bare box cut off flat
       at the top, which is most of why the skyline read as untextured blocks.
       Both are instanced with per-building transforms — 2 draw calls for the
       whole city, and they scale exactly (a parapet baked into the shared unit
       box would stretch to 20 units on a 200-wide building). */
    _buildRoofs(scene, list) {
        if (!list.length) return;
        const d = new THREE.Object3D();

        const capGeo = new THREE.BoxGeometry(1, 1, 1);
        capGeo.translate(0, 0.5, 0);
        const caps = new THREE.InstancedMesh(capGeo,
            new THREE.MeshLambertMaterial({ color: 0x8a909c }), list.length);
        list.forEach((p, i) => {
            d.position.set(p.x, p.h, p.z);
            d.scale.set(p.w + 5, 7, p.d + 5);
            d.updateMatrix();
            caps.setMatrixAt(i, d.matrix);
        });
        caps.instanceMatrix.needsUpdate = true;
        scene.add(caps);

        // plant: AC units, vents and water tanks, 0-4 per roof
        const spots = [];
        for (const p of list) {
            const n = p.w > 150 ? 4 : p.w > 90 ? 3 : 2;
            for (let i = 0; i < n; i++) {
                if (rng() < 0.22) continue;
                spots.push({
                    x: p.x + (rng() - 0.5) * (p.w - 30),
                    y: p.h + 7,
                    z: p.z + (rng() - 0.5) * (p.d - 30),
                    s: 0.7 + rng() * 0.9,
                    r: rng() * Math.PI
                });
            }
        }
        if (!spots.length) return;
        const unit = mergeGeometries([
            paint(new THREE.BoxGeometry(16, 9, 12).translate(0, 4.5, 0), 0x9aa1ab),
            paint(new THREE.BoxGeometry(13, 1.6, 9).translate(0, 9.6, 0), 0x6e757f),
            paint(new THREE.CylinderGeometry(3.4, 3.4, 7, 8).translate(11, 3.5, 3), 0x878e98)
        ], false);
        const plant = new THREE.InstancedMesh(unit,
            new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
        spots.forEach((s, i) => {
            d.position.set(s.x, s.y, s.z);
            d.scale.setScalar(s.s);
            d.rotation.set(0, s.r, 0);
            d.updateMatrix();
            plant.setMatrixAt(i, d.matrix);
        });
        d.rotation.set(0, 0, 0);
        plant.instanceMatrix.needsUpdate = true;
        scene.add(plant);
    },

    // Specialty structures — pushed into the STATIC bucket, animated parts kept live
    _buildSpecialty(p) {
        const { x, z, w, d } = p;
        const b = p.b;
        const A = this.animated;

        switch (b.type) {
            case 'launchpad': {
                const org = SPACE_ORGS[b.org] || { color: 0x999999 };
                sBox(w * 0.9, 6, w * 0.9, x, 3, z, 0x8a8a86);                    // pad
                sBox(w * 0.3, 4, w * 0.7, x, 1.5, z, 0x3a3a3a);                  // flame trench
                sCyl(3, 4, 130, 6, x - w * 0.42, 65, z - w * 0.42, 0xb8483a);    // lightning mast
                sCyl(3, 4, 130, 6, x + w * 0.42, 65, z + w * 0.42, 0xb8483a);
                // rocket standing on pad
                sCyl(7, 7, 70, 10, x, 41, z, 0xf2f2f0);
                sCone(7, 18, 10, x, 85, z, org.color);
                sCyl(7.4, 7.4, 9, 10, x, 10, z, org.color);
                break;
            }
            case 'dish': {
                sBox(w * 0.5, 22, w * 0.5, x, 11, z, 0x5a6470);                  // ops building
                for (let i = 0; i < 3; i++) {
                    const dx = x + (i - 1) * w * 0.33, dz = z - d * 0.3;
                    sCyl(2.5, 3, 18, 6, dx, 31, dz, 0x9aa2ae);
                    const dish = new THREE.Mesh(
                        paint(new THREE.SphereGeometry(14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.6), 0xd8dde4),
                        matVC());
                    dish.position.set(dx, 42, dz);
                    dish.rotation.x = Math.PI * 0.72;
                    G.scene.add(dish);
                    A.push({ obj: dish, kind: 'dish', phase: i * 1.7 });
                }
                break;
            }
            case 'solar': {
                sBox(30, 8, 30, x - w * 0.4, 4, z - w * 0.4, 0x707880);          // inverter hut
                for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
                    const px = x - w * 0.28 + c * w * 0.14, pz = z - d * 0.3 + r * d * 0.2;
                    sCyl(1.5, 1.5, 8, 4, px, 4, pz, 0x888888);
                    const g = new THREE.BoxGeometry(26, 2, 16);
                    g.rotateX(-0.42); g.translate(px, 11, pz);
                    STATIC.push(paint(g, 0x1c3a6e));
                }
                break;
            }
            case 'wind': {
                for (let i = 0; i < 3; i++) {
                    const px = x + (i - 1) * w * 0.5, pz = z + (i % 2 ? 1 : -1) * d * 0.22;
                    sCyl(2, 4, 110, 8, px, 55, pz, 0xe8e8e4);
                    const nac = new THREE.Group();
                    const nacelle = new THREE.Mesh(paint(new THREE.BoxGeometry(14, 8, 8), 0xd8d8d4), matVC());
                    nac.add(nacelle);
                    for (let bl = 0; bl < 3; bl++) {
                        const blade = new THREE.Mesh(paint(new THREE.BoxGeometry(3, 52, 1.2), 0xf0f0ec), matVC());
                        blade.position.y = 26;
                        const holder = new THREE.Group();
                        holder.add(blade);
                        holder.rotation.z = (bl / 3) * Math.PI * 2;
                        nac.add(holder);
                    }
                    nac.position.set(px, 110, pz + 5);
                    G.scene.add(nac);
                    A.push({ obj: nac, kind: 'turbine', speed: 0.9 + rng() * 0.5 });
                }
                break;
            }
            case 'nuclear': {
                sSphere(38, x - w * 0.18, 14, z, 0xd8d4cc);                      // containment
                sBox(w * 0.45, 30, d * 0.6, x + w * 0.22, 15, z, 0x8b939e);      // turbine hall
                for (const oz of [-d * 0.28, d * 0.28]) {
                    sCyl(20, 26, 84, 14, x - w * 0.34, 42, z + oz, 0xc9c5bd);    // cooling towers
                }
                break;
            }
            case 'coal': {
                sBox(w * 0.7, 42, d * 0.7, x, 21, z, 0x7a6a5a);
                sCyl(5, 6, 110, 10, x - w * 0.2, 55, z - d * 0.15, 0xa8503c);
                sCyl(5, 6, 110, 10, x + w * 0.15, 55, z + d * 0.1, 0xa8503c);
                sBox(w * 0.3, 14, d * 0.3, x + w * 0.3, 7, z + d * 0.3, 0x4a4038);
                break;
            }
            case 'dam': {
                sBox(w * 1.2, 60, 24, x, 30, z, 0x9aa0a8);
                sBox(w * 0.3, 22, 30, x, 11, z + 20, 0x6a7078);                  // turbine hall
                for (let i = 0; i < 4; i++) sBox(10, 44, 4, x - w * 0.45 + i * w * 0.3, 22, z + 13, 0x7e848c);
                break;
            }
            case 'crane': {
                const H = 90;
                for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
                    sBox(6, H, 6, x + ox * w * 0.3, H / 2, z + oz * d * 0.25, 0xd8a02c);
                sBox(w * 0.72, 8, 10, x, H, z, 0xd8a02c);                        // beam
                sBox(10, 8, 90, x, H, z - 30, 0xd8a02c);                         // jib over water side
                sBox(16, 12, 14, x, H, z + 28, 0x8a6a20);                        // counterweight
                const trolley = new THREE.Mesh(paint(new THREE.BoxGeometry(12, 6, 10), 0x444444), matVC());
                trolley.position.set(x, H - 4, z);
                const cable = new THREE.Mesh(paint(new THREE.BoxGeometry(1.2, 40, 1.2), 0x222222), matVC());
                cable.position.y = -22;
                const hook = new THREE.Mesh(paint(new THREE.BoxGeometry(14, 8, 12), 0xcc5533), matVC());
                hook.position.y = -44;
                trolley.add(cable, hook);
                G.scene.add(trolley);
                A.push({ obj: trolley, kind: 'trolley', cx: x, cz: z, phase: rng() * 6 });
                break;
            }
            case 'monument': {
                if (b.id === 'park') {          // Leaderboard Monument
                    sCyl(46, 52, 8, 20, x, 4, z, 0x8a8f98);
                    sBox(60, 10, 60, x, 13, z, 0x9aa0a8);
                    sBox(40, 12, 40, x, 24, z, 0xaab0b8);
                    sBox(22, 14, 22, x, 37, z, 0xbcc2ca);
                    sCyl(6, 9, 30, 10, x, 59, z, 0xd8b23a);                      // gold pillar
                    sSphere(10, x, 82, z, 0xf0c93a);                             // gold orb
                } else if (b.id === 'visitor_monument') {
                    sCyl(40, 46, 8, 6, x, 4, z, 0x8f959e);
                    sCyl(16, 26, 120, 4, x, 68, z, 0xcfd4da);                    // obelisk
                    sCone(16, 14, 4, x, 135, z, 0xf0c93a);
                } else {                        // open_square — open source arch
                    sBox(14, 70, 14, x - 40, 35, z, 0x9fb4c8);
                    sBox(14, 70, 14, x + 40, 35, z, 0x9fb4c8);
                    sBox(110, 12, 16, x, 76, z, 0xb8c8d8);
                    sSphere(12, x, 96, z, 0xe8f4ff);
                }
                G.colliders.push({ x0: x - 30, z0: z - 30, x1: x + 30, z1: z + 30, id: b.id });
                break;
            }
            case 'arena': {
                sCyl(78, 84, 44, 24, x, 22, z, 0x6a5a7a);
                sCyl(80, 80, 6, 24, x, 47, z, 0x8a7a9a);
                sBox(70, 36, 4, x, 30, z - 78, 0x1a1a2e);                        // big screen
                sPlaneUV(66, 32, x, 30, z - 77.5, 0, 0x2a3a5e);
                G.colliders.push({ x0: x - 84, z0: z - 84, x1: x + 84, z1: z + 84, id: b.id });
                break;
            }
            case 'graveyard': {
                for (let i = 0; i < 24; i++) {
                    const gx = x - 70 + (i % 6) * 28 + rng() * 8;
                    const gz = z - 50 + Math.floor(i / 6) * 32 + rng() * 8;
                    sBox(10, 16 + rng() * 8, 3, gx, 8, gz, 0x9aa0a6, (rng() - 0.5) * 0.3);
                }
                for (let i = 0; i < 10; i++) sBox(3, 14, 3, x - 90 + i * 20, 7, z - 75, 0x3a3f46);
                sBox(180, 4, 3, x, 13, z - 75, 0x3a3f46);
                break;
            }
            case 'park': {
                if (b.id === 'central_park') {
                    sCyl(34, 38, 7, 18, x, 3.5, z, 0x9aa0a8);                    // fountain basin
                    sCyl(4, 6, 26, 10, x, 13, z, 0xaab0b8);                      // column
                    sCyl(12, 10, 5, 12, x, 28, z, 0x9aa0a8);                     // top bowl
                    const water = new THREE.Mesh(
                        new THREE.CylinderGeometry(31, 31, 2, 18),
                        new THREE.MeshLambertMaterial({ color: 0x3a7ab8, transparent: true, opacity: 0.85 }));
                    water.position.set(x, 6.5, z);
                    G.scene.add(water);
                    A.push({ obj: water, kind: 'fountain', phase: 0 });
                    G.colliders.push({ x0: x - 38, z0: z - 38, x1: x + 38, z1: z + 38, id: b.id });
                } else {                        // pine_reserve — ranger lodge
                    sBox(50, 22, 36, x, 11, z, 0x6b4f35);
                    const roof = new THREE.CylinderGeometry(0.1, 30, 18, 4, 1);
                    roof.rotateY(Math.PI / 4); roof.scale(1.3, 1, 0.9);
                    roof.translate(x, 31, z);
                    STATIC.push(paint(roof, 0x4a3524));
                }
                break;
            }
            case 'black_market': {
                // alley between two long walls
                sBox(140, 34, 10, x, 17, z - 42, 0x3a3230);
                sBox(140, 30, 10, x, 15, z + 42, 0x352e2c);
                sBox(10, 34, 94, x - 70, 17, z, 0x3a3230);
                for (let i = 0; i < 3; i++) sBox(18, 14, 12, x - 30 + i * 26, 7, z - 28, 0x2e4a34); // dumpsters
                for (let i = 0; i < 3; i++) {                                                                    // stalls
                    const sx = x - 20 + i * 30, sz = z + 24;
                    sBox(20, 12, 14, sx, 6, sz, 0x4a3a30);
                    sBox(24, 3, 18, sx, 15, sz, [0x7a3a5e, 0x3a5e7a, 0x5e7a3a][i]);
                }
                sCyl(4, 4, 3, 8, x + 52, 2, z - 20, 0x8a5a2a);                   // barrel
                G.colliders.push(
                    { x0: x - 70, z0: z - 47, x1: x + 70, z1: z - 37, id: 'bm_wall_n' },
                    { x0: x - 70, z0: z + 37, x1: x + 70, z1: z + 47, id: 'bm_wall_s' },
                    { x0: x - 75, z0: z - 47, x1: x - 65, z1: z + 47, id: 'bm_wall_w' });
                break;
            }
            case 'billboard': {
                sBox(8, 90, 8, x - 34, 45, z, 0x6a7078);
                sBox(8, 90, 8, x + 34, 45, z, 0x6a7078);
                break; // panel added in _buildBillboard
            }
            default:
                // metro + unknown specialty → small canopy
                sBox(w * 0.6, 4, d * 0.6, x, 26, z, 0x4a5560);
                for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
                    sBox(4, 26, 4, x + ox * w * 0.26, 13, z + oz * d * 0.26, 0x38404a);
        }
    },

    // ── SIGNS (single atlas, single mesh) ────────────────────────────────────
    _buildSigns(scene) {
        // OPEN structures are shorter/irregular than their placeholder box
        // height p.h, which is why signs pinned to p.h floated in the sky.
        // Those get a ground-planted pylon sign; solid buildings get a lit
        // box mounted flat on the street-facing wall above the entrance.
        const OPEN = new Set(['park', 'launchpad', 'solar', 'wind', 'dam', 'crane',
            'graveyard', 'billboard', 'monument', 'arena', 'black_market',
            'nuclear', 'coal', 'dish']);

        const signs = G.placements.map(p => {
            const b = p.b;
            const color = (b.lab && LABS[b.lab]) ? LABS[b.lab].color
                : b.type === 'black_market' ? '#f472b6'
                : b.type === 'bar' ? '#e879f9'
                : '#22d3ee';
            const label = b.id === 'black_market' ? 'THE UNDERGROUND' : b.name.toUpperCase();
            return { id: b.id, text: label, emoji: b.emoji, color, p };
        });
        const { texture, uv } = TEX.signAtlas(signs);
        const neonGeos = [];        // the emissive text planes
        const structGeos = [];      // backing boxes + posts (lit, vertex-coloured)

        for (const s of signs) {
            const r = uv.get(s.id);
            const p = s.p;
            const b = p.b;
            const pylon = OPEN.has(b.type);
            const sw = Math.min(Math.max(p.w * 0.9, 60), 108), sh = sw / 4;

            // face the district centre (the street)
            const dd = City.districts.find(x => x.id === p.district);
            const ang = dd ? Math.atan2(dd.cx - p.x, dd.cz - p.z) : 0;
            const nx = Math.sin(ang), nz = Math.cos(ang);

            // mount height + how far the board sits off the footprint
            const mountY = pylon ? 50 : Math.min(p.h - sh / 2 - 6, 42);
            const off = Math.max(p.w, p.d) / 2 + (pylon ? 20 : 4);
            const bx = p.x + nx * off, bz = p.z + nz * off;

            // dark sign box behind the neon, with depth so it reads as a fixture
            const board = new THREE.BoxGeometry(sw + 8, sh + 7, 4);
            board.rotateY(ang);
            board.translate(bx, mountY, bz);
            structGeos.push(paint(board, 0x12151b));
            // thin accent frame line
            const frame = new THREE.BoxGeometry(sw + 12, 3, 4.5);
            frame.rotateY(ang);
            frame.translate(bx, mountY - sh / 2 - 4, bz);
            structGeos.push(paint(frame, new THREE.Color(s.color).multiplyScalar(0.5).getHex()));

            if (pylon) {
                // two support posts from the ground to the board
                for (const sx of [-1, 1]) {
                    const px = bx + Math.cos(ang) * sx * (sw * 0.32);
                    const pz = bz - Math.sin(ang) * sx * (sw * 0.32);
                    const post = new THREE.BoxGeometry(5, mountY - sh / 2, 5);
                    post.translate(px, (mountY - sh / 2) / 2, pz);
                    structGeos.push(paint(post, 0x3a4048));
                }
            }

            // neon text, front + mirrored back, floated just off the board
            for (const back of [false, true]) {
                const g = new THREE.PlaneGeometry(sw, sh);
                const a = g.attributes.uv;
                for (let i = 0; i < a.count; i++) {
                    a.setXY(i, r.u0 + a.getX(i) * (r.u1 - r.u0), r.v0 + a.getY(i) * (r.v1 - r.v0));
                }
                const face = back ? ang + Math.PI : ang;
                const push = back ? -2.6 : 2.6;
                g.rotateY(face);
                g.translate(bx + nx * push, mountY, bz + nz * push);
                neonGeos.push(g);
            }
        }

        this.neonMat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(mergeGeometries(neonGeos, false), this.neonMat);
        mesh.matrixAutoUpdate = false;
        scene.add(mesh);

        const structMesh = new THREE.Mesh(mergeGeometries(structGeos, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        structMesh.matrixAutoUpdate = false;
        scene.add(structMesh);
        this.signCount = signs.length;
    },

    // ── PROPS: trees, lamps, benches, poles, containers, ships ───────────────
    _buildProps(scene) {
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        // Trees — trunks + canopies, two InstancedMeshes
        const treeSpots = [];
        for (const d of City.districts) {
            const count = { park: 70, forest: 120, suburban: 26, academic: 16, urban: 6, industry: 3, coastal: 10, wasteland: 5, desert: 2 }[d.biome] ?? 6;
            for (let i = 0; i < count; i++) {
                const tx = d.cx + (rng() - 0.5) * (CELL_W - 70);
                const tz = d.cz + (rng() - 0.5) * (CELL_D - 70);
                if (Math.abs(tx - d.cx) < 44 || Math.abs(tz - d.cz) < 44) continue;   // inner roads
                let blocked = false;
                for (const c of G.colliders) if (tx > c.x0 - 8 && tx < c.x1 + 8 && tz > c.z0 - 8 && tz < c.z1 + 8) { blocked = true; break; }
                if (blocked) continue;
                treeSpots.push({ x: tx, z: tz, biome: d.biome, s: 0.7 + rng() * 0.8 });
            }
        }
        const trunkGeo = new THREE.CylinderGeometry(2.2, 3.2, 22, 5);
        trunkGeo.translate(0, 11, 0);
        const canGeo = new THREE.ConeGeometry(13, 34, 7);
        canGeo.translate(0, 38, 0);
        const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5a4430 }), treeSpots.length);
        const cans = new THREE.InstancedMesh(canGeo, new THREE.MeshLambertMaterial(), treeSpots.length);
        treeSpots.forEach((t, i) => {
            dummy.position.set(t.x, 0, t.z);
            dummy.scale.setScalar(t.s);
            dummy.rotation.y = rng() * Math.PI;
            dummy.updateMatrix();
            trunks.setMatrixAt(i, dummy.matrix);
            cans.setMatrixAt(i, dummy.matrix);
            const cc = t.biome === 'wasteland' ? color.set(0x6a5a48)
                : t.biome === 'coastal' ? color.set(0x3f8a3f)
                : t.biome === 'desert' ? color.set(0x4a7a3a)
                : color.set(0x2d5a28).offsetHSL((rng() - 0.5) * 0.05, 0, rng() * 0.1);
            cans.setColorAt(i, cc);
        });
        scene.add(trunks, cans);

        // Street lamps along avenues/streets
        const lampSpots = [];
        for (const ax of City.avenueXs) for (let z = -CITY_D / 2 + 80; z < CITY_D / 2; z += 260)
            lampSpots.push({ x: ax + 78, z });
        for (const sz of City.streetZs) for (let x = -CITY_W / 2 + 80; x < CITY_W / 2; x += 260)
            lampSpots.push({ x, z: sz + 78 });
        const poleGeo = new THREE.CylinderGeometry(1.4, 1.8, 34, 5);
        poleGeo.translate(0, 17, 0);
        const headGeo = new THREE.SphereGeometry(3, 6, 5);
        headGeo.translate(0, 35, 0);
        const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0x333a44 }), lampSpots.length);
        this.lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
        const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, lampSpots.length);
        lampSpots.forEach((l, i) => {
            dummy.position.set(l.x, 0, l.z);
            dummy.scale.setScalar(1); dummy.rotation.y = 0; dummy.updateMatrix();
            poles.setMatrixAt(i, dummy.matrix);
            heads.setMatrixAt(i, dummy.matrix);
        });
        scene.add(poles, heads);

        // Benches (park districts + public square)
        const benchSpots = [];
        for (const d of City.districts) {
            if (!['park', 'academic', 'suburban'].includes(d.biome)) continue;
            for (let i = 0; i < 8; i++) {
                benchSpots.push({
                    x: d.cx + (rng() - 0.5) * (CELL_W * 0.55),
                    z: d.cz + (rng() - 0.5) * (CELL_D * 0.55),
                    r: rng() * Math.PI
                });
            }
        }
        const benchGeo = new THREE.BoxGeometry(16, 4, 6);
        benchGeo.translate(0, 4, 0);
        const benches = new THREE.InstancedMesh(benchGeo, new THREE.MeshLambertMaterial({ color: 0x6a4e30 }), benchSpots.length);
        benchSpots.forEach((bp, i) => {
            dummy.position.set(bp.x, 0, bp.z);
            dummy.rotation.y = bp.r; dummy.scale.setScalar(1); dummy.updateMatrix();
            benches.setMatrixAt(i, dummy.matrix);
        });
        scene.add(benches);

        // ── City-wide power lines (a Living City feature from the 2D app):
        // wooden utility poles with two crossarms + insulators down the avenue
        // sidewalks, and sagging catenary wires between consecutive poles.
        const POLE_H = 74, ARM1 = 66, ARM2 = 54;   // heights of post top + two crossarms
        const GAP = 200;
        const clear = (x, z) => !G.colliders.some(c =>
            x > c.x0 - 12 && x < c.x1 + 12 && z > c.z0 - 12 && z < c.z1 + 12);

        // one line of poles down the east sidewalk of each avenue
        const lines = [];
        for (const ax of City.avenueXs) {
            const px = ax + CARRIAGE.main / 2 + 18;
            const row = [];
            for (let z = -CITY_D / 2 + 60; z < CITY_D / 2 - 40; z += GAP) {
                if (clear(px, z)) row.push({ x: px, z });
            }
            if (row.length > 1) lines.push({ vertical: true, poles: row });
        }

        const poleGeos = [];
        const wirePts = [];
        // insulator x-offsets on the crossarms (2 wires per arm)
        const armOff = [-9, 9, -6, 6];
        const armY = [ARM1, ARM1, ARM2, ARM2];

        for (const line of lines) {
            for (const p of line.poles) {
                // wooden post
                const post = new THREE.BoxGeometry(4, POLE_H, 4);
                post.translate(p.x, POLE_H / 2, p.z);
                poleGeos.push(paint(post, 0x5a4a3a));
                // crossarms (run across the road, i.e. along x for a vertical line)
                for (const ay of [ARM1, ARM2]) {
                    const arm = new THREE.BoxGeometry(ay === ARM1 ? 24 : 18, 3, 3);
                    arm.translate(p.x, ay, p.z);
                    poleGeos.push(paint(arm, 0x6a5a45));
                }
                // insulators
                for (let k = 0; k < armOff.length; k++) {
                    const ins = new THREE.BoxGeometry(2.4, 3, 2.4);
                    ins.translate(p.x + armOff[k], armY[k] + 2, p.z);
                    poleGeos.push(paint(ins, 0xcfd4da));
                }
            }
            // catenary wires between consecutive poles
            for (let i = 0; i < line.poles.length - 1; i++) {
                const a = line.poles[i], b = line.poles[i + 1];
                const span = Math.hypot(b.x - a.x, b.z - a.z);
                if (span > GAP * 1.6) continue;
                const sag = Math.min(9, span * 0.05);
                for (let k = 0; k < armOff.length; k++) {
                    const ax = a.x + armOff[k], az = a.z, bx = b.x + armOff[k], bz = b.z;
                    const y = armY[k] + 2;
                    let prev = null;
                    for (let s = 0; s <= 6; s++) {
                        const t = s / 6;
                        const wy = y - Math.sin(t * Math.PI) * sag;
                        const wx = ax + (bx - ax) * t, wz = az + (bz - az) * t;
                        if (prev) wirePts.push(prev.x, prev.y, prev.z, wx, wy, wz);
                        prev = { x: wx, y: wy, z: wz };
                    }
                }
            }
        }

        if (poleGeos.length) {
            const m = new THREE.Mesh(mergeGeometries(poleGeos, false),
                new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.detail() }));
            m.matrixAutoUpdate = false;
            scene.add(m);
        }
        if (wirePts.length) {
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
            const wires = new THREE.LineSegments(g,
                new THREE.LineBasicMaterial({ color: 0x2c333d, transparent: true, opacity: 0.5 }));
            scene.add(wires);
        }

        // Power poles + sagging lines along the east ring road
        const poleXs = City.ringX[1] - 0, step = 300;
        const linePts = [];
        const poleGeo2 = new THREE.CylinderGeometry(1.6, 2.2, 58, 5);
        poleGeo2.translate(0, 29, 0);
        const crossGeo = new THREE.BoxGeometry(26, 3, 3);
        crossGeo.translate(0, 52, 0);
        const poleCount = Math.floor(CITY_D / step) + 1;
        const poles2 = new THREE.InstancedMesh(poleGeo2, new THREE.MeshLambertMaterial({ color: 0x4a3a28 }), poleCount);
        const crossarms = new THREE.InstancedMesh(crossGeo, new THREE.MeshLambertMaterial({ color: 0x4a3a28 }), poleCount);
        for (let i = 0; i < poleCount; i++) {
            const z = -CITY_D / 2 + i * step;
            dummy.position.set(poleXs, 0, z); dummy.rotation.y = 0; dummy.scale.setScalar(1); dummy.updateMatrix();
            poles2.setMatrixAt(i, dummy.matrix);
            crossarms.setMatrixAt(i, dummy.matrix);
            if (i > 0) {
                const z0 = -CITY_D / 2 + (i - 1) * step;
                for (const ox of [-10, 10]) {
                    // 3-point sag per span
                    linePts.push(
                        poleXs + ox, 52, z0,
                        poleXs + ox, 47, (z0 + z) / 2,
                        poleXs + ox, 47, (z0 + z) / 2,
                        poleXs + ox, 52, z
                    );
                }
            }
        }
        scene.add(poles2, crossarms);
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePts, 3));
        scene.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));

        // Shipping containers at the port
        const portD = City.districts.find(d => d.id === 'port');
        if (portD) {
            const contGeo = new THREE.BoxGeometry(34, 14, 14);
            contGeo.translate(0, 7, 0);
            const contCols = [0xc0392b, 0x2980b9, 0x27ae60, 0xd39c12, 0x7f8c8d, 0x8e44ad];
            const conts = new THREE.InstancedMesh(contGeo, new THREE.MeshLambertMaterial(), 40);
            for (let i = 0; i < 40; i++) {
                const stack = Math.floor(i / 10);
                dummy.position.set(
                    portD.cx - 320 + (i % 10) * 42 + rng() * 6,
                    stack * 14,
                    portD.cz + 220 + stack * 22 + rng() * 4);
                dummy.rotation.y = (rng() - 0.5) * 0.12;
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                conts.setMatrixAt(i, dummy.matrix);
                conts.setColorAt(i, color.set(contCols[i % contCols.length]));
            }
            scene.add(conts);
        }

        // Ships (2) bobbing in the harbour
        this.ships = [];
        for (let i = 0; i < 2; i++) {
            const ship = new THREE.Group();
            const hull = new THREE.Mesh(paint(new THREE.BoxGeometry(220, 26, 52), i ? 0x8a2f28 : 0x2f4a6a), matVC());
            hull.position.y = 10;
            const bow = new THREE.Mesh(paint(new THREE.CylinderGeometry(0, 26, 60, 4), i ? 0x8a2f28 : 0x2f4a6a), matVC());
            bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4;
            bow.position.set(-140, 10, 0);
            const cabin = new THREE.Mesh(paint(new THREE.BoxGeometry(36, 34, 40), 0xe8e8e4), matVC());
            cabin.position.set(80, 36, 0);
            ship.add(hull, bow, cabin);
            for (let c = 0; c < 6; c++) {
                const cont = new THREE.Mesh(paint(new THREE.BoxGeometry(30, 12, 14),
                    [0xc0392b, 0x2980b9, 0x27ae60, 0xd39c12][c % 4]), matVC());
                cont.position.set(-60 + (c % 3) * 34, 28 + Math.floor(c / 3) * 13, (c % 2 ? 10 : -10));
                ship.add(cont);
            }
            ship.position.set(SEA_X - 420 - i * 260, 0, -500 + i * 480);
            ship.rotation.y = i ? 0.25 : -0.15;
            scene.add(ship);
            this.ships.push(ship);
            this.animated.push({ obj: ship, kind: 'ship', phase: i * 2.1 });
        }

        // Pier from the port into the water
        if (portD) {
            sBox(420, 6, 60, SEA_X - 180, 3, portD.cz, 0x7a6248);
            for (let i = 0; i < 6; i++) sCyl(3, 3, 12, 6, SEA_X - 40 - i * 70, 2, portD.cz + 26, 0x5a4632);
            // Lighthouse
            sCyl(10, 14, 90, 10, SEA_X - 60, 45, portD.cz - 330, 0xe8e0d0);
            sCyl(11, 11, 10, 10, SEA_X - 60, 28, portD.cz - 330, 0xc0392b);
            sCyl(11, 11, 10, 10, SEA_X - 60, 58, portD.cz - 330, 0xc0392b);
            sCyl(8, 8, 12, 8, SEA_X - 60, 96, portD.cz - 330, 0x2a2a2a);
            const lamp = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6),
                new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
            lamp.position.set(SEA_X - 60, 96, portD.cz - 330);
            scene.add(lamp);
            this.animated.push({ obj: lamp, kind: 'lighthouse', phase: 0 });
        }
    },

    // ── WATER + BEACH ────────────────────────────────────────────────────────
    _buildWater(scene) {
        this.waterTex = TEX.water();
        const w = new THREE.Mesh(
            new THREE.PlaneGeometry(6000, CITY_D + 6000),
            new THREE.MeshPhongMaterial({ map: this.waterTex, color: 0x9fc8e8, shininess: 120, specular: 0x88bbee })
        );
        w.rotation.x = -Math.PI / 2;
        w.position.set(SEA_X - 2900, -0.6, 0);
        scene.add(w);
        // beach
        const beach = new THREE.Mesh(
            new THREE.PlaneGeometry(260, CITY_D + 400),
            new THREE.MeshLambertMaterial({ color: 0xd8c08a })
        );
        beach.rotation.x = -Math.PI / 2;
        beach.position.set(SEA_X + 10, 0.15, 0);
        scene.add(beach);
    },

    // ── AI INDEX BILLBOARD PANEL ─────────────────────────────────────────────
    _buildBillboard(scene) {
        const p = G.bldById['ai_index'];
        if (!p) return;
        this.aiBoard = TEX.aiIndexBoard();
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(92, 46),
            new THREE.MeshBasicMaterial({ map: this.aiBoard.texture })
        );
        panel.position.set(p.worldX, 78, p.worldZ + 6);
        scene.add(panel);
        const back = new THREE.Mesh(paint(new THREE.BoxGeometry(96, 50, 3), 0x2a2e36), matVC());
        back.position.set(p.worldX, 78, p.worldZ + 3);
        scene.add(back);
        G.colliders.push({ x0: p.worldX - 40, z0: p.worldZ - 6, x1: p.worldX + 40, z1: p.worldZ + 10, id: 'ai_index' });
    },

    // ── DISTANT HILLS ────────────────────────────────────────────────────────
    _buildHills(scene) {
        const geo = new THREE.ConeGeometry(1, 1, 7);
        geo.translate(0, 0.5, 0);
        const spots = [];
        for (let i = 0; i < 42 && spots.length < 42; i++) {
            const a = (i / 42) * Math.PI * 2 + rng() * 0.12;
            const r = 3900 + rng() * 1400;
            const hx = Math.cos(a) * r + 1200;
            if (hx < SEA_X + 200) continue;   // keep the hills out of the sea
            spots.push({ x: hx, z: Math.sin(a) * r });
        }
        const hills = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x33402e }), spots.length);
        const dummy = new THREE.Object3D();
        spots.forEach((s, i) => {
            dummy.position.set(s.x, -4, s.z);
            dummy.scale.set(500 + rng() * 700, 180 + rng() * 260, 500 + rng() * 700);
            dummy.rotation.y = rng() * Math.PI;
            dummy.updateMatrix();
            hills.setMatrixAt(i, dummy.matrix);
        });
        scene.add(hills);
    },

    // ── per-frame ────────────────────────────────────────────────────────────
    update(dt, t) {
        for (const a of this.animated) {
            switch (a.kind) {
                case 'turbine': a.obj.rotation.z += dt * a.speed * (1 + G.weatherIntensity * 2); break;
                case 'dish': a.obj.rotation.z = Math.sin(t * 0.12 + a.phase) * 0.35; break;
                case 'trolley': a.obj.position.z = a.cz - 30 + Math.sin(t * 0.25 + a.phase) * 30; break;
                case 'fountain': a.obj.position.y = 6.5 + Math.sin(t * 2.2) * 0.35; break;
                case 'ship': a.obj.rotation.z = Math.sin(t * 0.5 + a.phase) * 0.02; a.obj.position.y = Math.sin(t * 0.7 + a.phase) * 0.8; break;
                case 'lighthouse': a.obj.material.color.setHSL(0.12, 0.8, 0.5 + Math.sin(t * 1.4) * 0.4); break;
            }
        }
        if (this.waterTex) {
            this.waterTex.offset.x = t * 0.008;
            this.waterTex.offset.y = Math.sin(t * 0.1) * 0.03;
        }
    }
};

function matVC() {
    if (!matVC._m) matVC._m = new THREE.MeshLambertMaterial({ vertexColors: true });
    return matVC._m;
}
