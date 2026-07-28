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

// How far up the sun sits from the shadow frustum centre. Short enough to keep
// depth precision usable, tall enough to clear the tallest tower.
const SHADOW_DIST = 1800;
const _sDir = new THREE.Vector3();
const _sRight = new THREE.Vector3();
const _sUp = new THREE.Vector3();
const _sUpRef = new THREE.Vector3(0, 1, 0);
const _sTmp = new THREE.Vector3();

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

/* Every Standard material in the city used to set envMapIntensity: 0 while
   also setting metalness 0.2-0.7. In the metallic-roughness model a metal has
   NO diffuse term — its whole appearance is the specular reflection of the
   environment — so those spires, mullions and shopfront panes rendered as dead
   featureless grey. Weather.updateEnvironment feeds scene.environment from the
   sky dome, which makes all of it reflect the actual sky at the actual time of
   day, for one small cubemap. */
const ENV_I = 0.9;

// Seeded facade textures per height tier. 3 keeps VRAM sane (9 x 512^2 pairs)
// while breaking up the "every building is the same building" read.
const FACADE_VARIANTS = 3;

/* Ledges, parapet caps, setback plates, spires and mullions were six near
   identical cool greys (0x8a94a4 .. 0xdce4f0) on every building in the city, so
   from any distance the skyline read as coloured boxes wearing identical bright
   white lids. These meshes are already instanced, so per-instance trim colour is
   free: take the building's own tint, desaturate it toward concrete and darken
   it, and the trim belongs to the building it sits on. */
const _trim = new THREE.Color();
const _trimHsl = { h: 0, s: 0, l: 0 };
function trimColor(hex, lightness = 0.44) {
    _trim.set(hex).getHSL(_trimHsl, THREE.SRGBColorSpace);
    return _trim.setHSL(_trimHsl.h, _trimHsl.s * 0.35, lightness, THREE.SRGBColorSpace);
}

// Fallback palette for infill in districts DISTRICT_TINT doesn't name.
const INFILL_TINT = {
    urban: '#5f6a7c', industry: '#6a6257', coastal: '#5b6d78', suburban: '#8a6d5c',
    academic: '#6b6a80', plaza: '#68717f', wasteland: '#524a42', desert: '#8a7a5e'
};

function buildingColor(b) {
    if (b.lab && LABS[b.lab]) return LABS[b.lab].color;
    if (b.dcData && b.dcData.color) return b.dcData.color;
    if (TYPE_COLORS[b.type]) return TYPE_COLORS[b.type];
    const base = DISTRICT_TINT[b.district] || '#5a6472';
    const c = new THREE.Color(base);
    // offsetHSL also works in the linear working space, where a ±0.08 nudge is
    // perceptually invisible. Widen it so neighbouring blocks actually differ.
    c.offsetHSL((rng() - 0.5) * 0.06, (rng() - 0.5) * 0.16, (rng() - 0.5) * 0.14);
    return '#' + c.getHexString(THREE.SRGBColorSpace);
}

/* Brand colours are chosen for logos on white, not for façades: many are
   fully saturated and dark (DeepSeek blue is rgb 0.05/0.23/0.90). Instance
   colours MULTIPLY the facade texture, so those blocks collapse to near-black
   in daylight and the whole city reads as dusk at noon. Pull the tint into a
   range a lit wall can survive — hue (the identity) is untouched; the neon
   signs still carry the full-strength brand colour.

   The colour space matters and used to be wrong. `Color.getHSL`/`setHSL`
   default to ColorManagement.workingColorSpace, which is LINEAR — so a clamp
   of L to [0.46, 0.74] was clamping LINEAR lightness, i.e. sRGB [0.71, 0.88].
   Every façade in the city was forced into a near-white band, and the
   saturation clamp bit far harder than 0.42 suggests: district grey #5a6b80
   came out #94aecf and DeepSeek's vivid #0ea5e9 came out #8db2d3 — two
   completely different colours landing on the same pale blue. That single line
   is most of why the city read as flat washed-out grey. Clamp in sRGB, where
   the numbers mean what they look like. */
const _tint = new THREE.Color();
const _hsl = { h: 0, s: 0, l: 0 };
const FACADE_MIN_L = 0.24, FACADE_MAX_L = 0.62, FACADE_MAX_S = 0.58;
function facadeTint(hex) {
    _tint.set(hex).getHSL(_hsl, THREE.SRGBColorSpace);
    return _tint.setHSL(
        _hsl.h,
        Math.min(_hsl.s, FACADE_MAX_S),
        Math.max(FACADE_MIN_L, Math.min(FACADE_MAX_L, _hsl.l)),
        THREE.SRGBColorSpace
    );
}

/* ── shared building box ────────────────────────────────────────────────────
   One unit box, origin at its base, carrying a baked vertical ambient-occlusion
   gradient in its `color` attribute. There is no SSAO here (no post-processing)
   and a shadow map can't produce the soft darkening where a wall meets the
   ground, so this fakes it for free: r160's color_vertex chunk multiplies
   `color` and `instanceColor` together, so the AO composes with the per-building
   tint without either fighting the other. It is the cheapest thing in the whole
   renderer that makes a box stop floating. */
function buildingBoxGeometry() {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.translate(0, 0.5, 0);
    const pos = g.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);                       // 0 at base, 1 at top
        // dark at the base, neutral by a quarter height, then a whisker of
        // extra light at the parapet where the sky wraps around the edge
        const ao = 0.52 + 0.48 * Math.min(1, y / 0.22) + Math.max(0, y - 0.9) * 0.35;
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = Math.min(1.12, ao);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
}

/* Façade UVs used to be the unit box's 0..1 per face, stretched by the instance
   matrix — so a 186-wide block and an 87-wide block both showed exactly `cols`
   windows, and window size and aspect varied arbitrarily across the city.
   Nothing reads as cheap CG faster than that. This carries a per-instance
   repeat count so a window is the same physical size on every building; counts
   are rounded to whole repeats so no pane is ever sliced at a face seam. */
const UV_REF_H = 26;   // world units per window column
function attachUVScale(mesh, list, rowsPerTile) {
    const n = list.length;
    const arr = new Float32Array(n * 3);
    const refH = UV_REF_H * (mesh.userData.uvCols || 8);
    const refV = rowsPerTile * FLOOR_H;
    for (let i = 0; i < n; i++) {
        const p = list[i];
        arr[i * 3] = Math.max(1, Math.round(p.w / refH));
        arr[i * 3 + 1] = Math.max(1, Math.round(p.h / refV));
        arr[i * 3 + 2] = Math.max(1, Math.round(p.d / refH));
    }
    mesh.geometry.setAttribute('aUVScale', new THREE.InstancedBufferAttribute(arr, 3));
}

function patchUVScale(mat) {
    mat.onBeforeCompile = (s) => {
        s.vertexShader = s.vertexShader
            .replace('#include <common>', '#include <common>\nattribute vec3 aUVScale;')
            .replace('#include <uv_vertex>', `#include <uv_vertex>
                {
                    vec3 an = abs(normal);
                    vec2 sc = an.x > 0.5 ? vec2(aUVScale.z, aUVScale.y)
                            : an.y > 0.5 ? vec2(aUVScale.x, aUVScale.z)
                            : vec2(aUVScale.x, aUVScale.y);
                    #ifdef USE_MAP
                        vMapUv *= sc;
                    #endif
                    #ifdef USE_EMISSIVEMAP
                        vEmissiveMapUv *= sc;
                    #endif
                }`);
    };
    return mat;
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
        // A DirectionalLight aims at its target, and the target defaults to the
        // world origin. Weather.update parks the sun relative to the camera, so
        // with the default target the light DIRECTION swung around as the player
        // walked — the same façade was lit at one end of the city and in shade at
        // the other. An explicit target that tracks the camera keeps the sun
        // vector constant everywhere, which is also what the shadow frustum needs.
        this.sunTarget = new THREE.Object3D();
        scene.add(this.sunTarget);
        this.sun.target = this.sunTarget;
        this.ambient = new THREE.AmbientLight(0x8a97ac, 0.55);
        scene.add(this.ambient);

        this.shadows = G.preset.shadowMap > 0;
        if (this.shadows) {
            const S = G.preset.shadowMap;
            const R = G.preset.shadowRadius;
            this.sun.castShadow = true;
            this.sun.shadow.mapSize.set(S, S);
            const sc = this.sun.shadow.camera;
            sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R;
            sc.near = 10; sc.far = SHADOW_DIST * 2.2;
            sc.updateProjectionMatrix();
            // Slope-scaled bias: the city is 10 units per metre, so absolute
            // biases have to be an order of magnitude larger than the defaults
            // or every wall self-shadows into stripes.
            this.sun.shadow.bias = -0.0006;
            this.sun.shadow.normalBias = 2.4;
            this.sun.shadow.blurSamples = 12;
        }

        this._buildGround(scene);
        this._buildGrass(scene);
        this._buildBuildings(scene);
        this._buildInfill(scene);
        this._buildStreetGlass(scene);
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
        // World base — countryside texture so free-fly / birds-eye views
        // beyond the city edge read as fields and meadows, not a flat green void.
        const countryTex = TEX.countryside();
        countryTex.repeat.set(48, 48);
        const base = new THREE.Mesh(
            new THREE.PlaneGeometry(28000, 28000),
            new THREE.MeshLambertMaterial({ map: countryTex, color: 0xa8c890 })
        );
        base.rotation.x = -Math.PI / 2; base.position.y = -2;
        base.name = 'ground';
        base.userData.shadowReceiveOnly = true;
        scene.add(base);

        // District tiles — parks/forests/suburbs get grass texture; others vertex colour
        const tiles = [];
        const grassTiles = [];
        for (const d of City.districts) {
            const g = new THREE.PlaneGeometry(CELL_W, CELL_D);
            g.rotateX(-Math.PI / 2);
            g.translate(d.cx, 0.02, d.cz);
            if (d.biome === 'park' || d.biome === 'forest' || d.biome === 'suburban') {
                const uv = g.attributes.uv;
                for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 16, uv.getY(i) * 16);
                grassTiles.push(g);
            } else {
                tiles.push(paint(g, d.biomeDef.ground));
            }
        }
        if (tiles.length) {
            const tilesMesh = new THREE.Mesh(mergeGeometries(tiles, false),
                new THREE.MeshStandardMaterial({
                    vertexColors: true, roughness: 0.86, metalness: 0.0, envMapIntensity: ENV_I * 0.6
                }));
            tilesMesh.matrixAutoUpdate = false;
            tilesMesh.userData.shadowReceiveOnly = true;
            scene.add(tilesMesh);
        }
        if (grassTiles.length) {
            const grassMesh = new THREE.Mesh(
                mergeGeometries(grassTiles, false),
                new THREE.MeshLambertMaterial({ map: TEX.grassGround(), color: 0xc8e0b8 })
            );
            grassMesh.matrixAutoUpdate = false;
            grassMesh.userData.shadowReceiveOnly = true;
            scene.add(grassMesh);
        }

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
        if (roadGeos.length) {
            /* Standard, not Lambert. Lambert has no specular term at all, so the
               road could never catch a sky sheen or a wet highlight no matter what
               wetness.js did to it — and with scene.environment now fed from the sky
               dome, a rough dielectric road picks up grazing-angle reflection for free. */
            const roadMesh = new THREE.Mesh(mergeGeometries(roadGeos, false),
                new THREE.MeshStandardMaterial({
                    map: roadTex, roughness: 0.82, metalness: 0.0, envMapIntensity: ENV_I * 0.4
                }));
            roadMesh.matrixAutoUpdate = false;
            roadMesh.userData.shadowReceiveOnly = true;
            scene.add(roadMesh);
        }

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
                new THREE.MeshStandardMaterial({
                    map: pavTex, roughness: 0.88, metalness: 0.0, envMapIntensity: ENV_I * 0.5
                }));
            m.matrixAutoUpdate = false;
            m.userData.shadowReceiveOnly = true;
            scene.add(m);
        }
    },

    // Raised, kerbed sidewalks down both sides of every road — one merged
    // mesh. Boxes rather than planes so the kerb has an actual face; that
    // edge is most of what makes a street read as a street. The segments come
    // from City.sidewalkSegments(), which breaks each kerb around the
    // carriageways that cross it (see there) so no sidewalk runs across a
    // junction — the "sidewalks in the middle of the road" bug.
    _buildSidewalks(scene) {
        const geos = [];
        for (const s of City.sidewalkSegments()) {
            const g = new THREE.BoxGeometry(s.w, KERB_H, s.d);
            g.translate(s.x, KERB_H / 2, s.z);
            const uv = g.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s.w / 40, uv.getY(i) * s.d / 40);
            geos.push(g);
        }
        if (!geos.length) return;
        const m = new THREE.Mesh(mergeGeometries(geos, false),
            new THREE.MeshStandardMaterial({
                map: TEX.pavement(), roughness: 0.88, metalness: 0.0, envMapIntensity: ENV_I * 0.5
            }));
        m.matrixAutoUpdate = false;
        m.userData.shadowReceiveOnly = true;
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
            const HB = CARRIAGE.main / 2 + 26;
            const junction = (t) => cross.some(c => Math.abs(t - c) < HB);
            const start = along - len / 2, end = along + len / 2;

            // clear spans = the road length minus every junction box. Lane lines
            // only get painted here — a solid edge line running straight across
            // an intersecting carriageway is what reads as "markings in the
            // wrong direction" at a junction, so nothing paints through the box.
            const blocked = cross.map(c => [c - HB, c + HB]).sort((a, b) => a[0] - b[0]);
            const clear = [];
            let cur = start;
            for (const [b0, b1] of blocked) {
                if (b0 > cur) clear.push([cur, Math.min(b0, end)]);
                cur = Math.max(cur, b1);
            }
            if (cur < end) clear.push([cur, end]);

            // solid edge lines, segmented around the junctions
            for (const side of [-1, 1]) {
                const o = side * (r.carriage / 2 - 3);
                for (const [s0, s1] of clear) {
                    const segLen = s1 - s0, m = (s0 + s1) / 2;
                    if (segLen < 4) continue;
                    if (r.vertical) mark(r.x + o, m, 3, segLen, 0xe8e8e0);
                    else mark(m, r.z + o, segLen, 3, 0xe8e8e0);
                }
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
            new THREE.MeshStandardMaterial({
                vertexColors: true, roughness: 0.72, metalness: 0.0, envMapIntensity: ENV_I * 0.5,
                // Markings sit 0.22 units above the tarmac. Rather than rely on
                // that gap surviving depth quantisation at distance, bias them.
                polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4
            }));
        m.matrixAutoUpdate = false;
        m.userData.shadowReceiveOnly = true;
        scene.add(m);
    },


    /** Instanced grass blades for park / forest / plaza cells — breaks up flat green slabs. */
    _buildGrass(scene) {
        const spots = [];
        for (const d of City.districts) {
            if (!['park', 'forest', 'plaza', 'suburban', 'academic'].includes(d.biome)) continue;
            // denser in true parks/forests
            const n = d.biome === 'forest' ? 900
                : d.biome === 'park' ? 700
                : d.biome === 'plaza' ? 220
                : 180;
            const pad = d.biome === 'park' || d.biome === 'forest' ? 40 : 80;
            // must match the skip list in _buildGround's pavement-pad loop
            const hasPads = !['forest', 'desert', 'park'].includes(d.biome);
            for (let i = 0; i < n; i++) {
                const gx = d.cx + (rng() - 0.5) * (CELL_W - pad);
                const gz = d.cz + (rng() - 0.5) * (CELL_D - pad);
                // keep off road corridors through district centre
                if (Math.abs(gx - d.cx) < 36 && Math.abs(gz - d.cz) < 36) continue;
                // ...and off the paving. Only the district-centre cross was
                // excluded before, so blades sprouted straight out of the
                // tarmac and the sidewalk slabs and read as green confetti
                // scattered over the street.
                if (City.onCarriageway(gx, gz) || City.onSidewalk(gx, gz)) continue;
                // ...and off the four 352² paved quadrant pads, where those exist
                // (parks, forests and desert districts don't get them).
                if (hasPads &&
                    Math.abs(Math.abs(gx - d.cx) - 210) < 176 &&
                    Math.abs(Math.abs(gz - d.cz) - 210) < 176) continue;
                // avoid building footprints roughly
                let hit = false;
                for (const p of G.placements) {
                    if (p.district !== d.id) continue;
                    if (Math.abs(gx - p.x) < p.w * 0.55 && Math.abs(gz - p.z) < p.d * 0.55) { hit = true; break; }
                }
                if (hit) continue;
                spots.push({
                    x: gx, z: gz,
                    h: 2.2 + rng() * 4.5,
                    s: 0.7 + rng() * 0.9,
                    yaw: rng() * Math.PI,
                    hue: d.biome === 'forest' ? 0.28 + rng() * 0.06 : 0.30 + rng() * 0.08
                });
            }
        }
        if (spots.length < 20) return;

        // Crossed-card blade (two thin quads) reads as a tuft from any angle
        const blade = new THREE.PlaneGeometry(1.1, 1);
        blade.translate(0, 0.5, 0);
        const blade2 = blade.clone();
        blade2.rotateY(Math.PI / 2);
        const geo = mergeGeometries([blade, blade2], false);

        // Vertex colours green
        const n = geo.attributes.position.count;
        const cols = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            // tip brighter
            const y = geo.attributes.position.getY(i);
            const g = 0.35 + y * 0.45;
            cols[i * 3] = 0.15; cols[i * 3 + 1] = g; cols[i * 3 + 2] = 0.12;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));

        const mat = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            // slight alpha at tips would need texture; keep solid for perf
        });
        const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
        mesh.frustumCulled = true;
        mesh.name = 'grass';
        mesh.userData.shadowReceiveOnly = true;
        const dummy = new THREE.Object3D();
        const c = new THREE.Color();
        spots.forEach((s, i) => {
            dummy.position.set(s.x, 0, s.z);
            dummy.rotation.set((rng() - 0.5) * 0.25, s.yaw, (rng() - 0.5) * 0.2);
            dummy.scale.set(s.s * 1.4, s.h, s.s * 1.4);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            c.setHSL(s.hue, 0.55 + rng() * 0.25, 0.28 + rng() * 0.18);
            mesh.setColorAt(i, c);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        scene.add(mesh);
        this.grassMesh = mesh;

        // Soft ground noise texture on park district tiles already exists as flat colour;
        // add a few larger "tuft clumps" as low hemispheres for depth
        const clumpSpots = spots.filter((_, i) => i % 18 === 0).slice(0, 120);
        if (clumpSpots.length) {
            const clumpGeo = new THREE.SphereGeometry(1, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
            const clumpMat = new THREE.MeshLambertMaterial({ color: 0x3a7a32 });
            const clumps = new THREE.InstancedMesh(clumpGeo, clumpMat, clumpSpots.length);
            clumpSpots.forEach((s, i) => {
                dummy.position.set(s.x, 0, s.z);
                dummy.rotation.set(0, s.yaw, 0);
                dummy.scale.set(3 + rng() * 4, 1.2 + rng() * 1.5, 3 + rng() * 4);
                dummy.updateMatrix();
                clumps.setMatrixAt(i, dummy.matrix);
            });
            clumps.instanceMatrix.needsUpdate = true;
            scene.add(clumps);
        }
    },
    /* The three shared façade atlases (low / mid / high rise). Generated once
       and reused by the named buildings AND the background infill — a 512²
       canvas per tier instead of per building is the whole reason the city
       fits in a handful of draw calls. */
    _facadeTiers() {
        if (!this._tiers) {
            const spec = [
                { maxFl: 4, rows: 2, cols: 6, litRatio: 0.48 },
                { maxFl: 9, rows: 4, cols: 7, litRatio: 0.55 },
                { maxFl: 99, rows: 8, cols: 8, litRatio: 0.62 }
            ];
            this._tiers = spec.map((t, ti) => ({
                ...t,
                // Several seeded variants per tier. With one texture per tier the
                // mullion style, the soot streaks AND the lit-window pattern were
                // rolled once and shared by every building in the city — after
                // dark literally the same windows were lit on every mid-rise.
                variants: Array.from({ length: FACADE_VARIANTS }, (_, v) =>
                    TEX.facade(t.rows, { litRatio: t.litRatio, cols: t.cols, seed: 7919 * (ti + 1) + v * 104729 }))
            }));
            // Per-instance UV repeats sample the maps outside 0..1; left on the
            // default ClampToEdge that smears the edge texel across the extra
            // span instead of tiling.
            for (const t of this._tiers) {
                for (const f of t.variants) {
                    for (const m of [f.map, f.emissiveMap]) {
                        if (!m) continue;
                        m.wrapS = m.wrapT = THREE.RepeatWrapping;
                        m.needsUpdate = true;
                    }
                }
            }
        }
        return this._tiers;
    },

    /** Stable per-building variant pick, so a building looks the same every visit. */
    _variantOf(key) {
        let h = 2166136261;
        const s = String(key || '');
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return (h >>> 0) % FACADE_VARIANTS;
    },

    // ── BUILDINGS ────────────────────────────────────────────────────────────
    _buildBuildings(scene) {
        const tiers = this._facadeTiers();
        const buckets = [[], [], []];
        const OPEN = new Set(['park', 'launchpad', 'solar', 'wind', 'dam', 'crane', 'graveyard', 'billboard', 'monument', 'arena', 'black_market', 'nuclear', 'coal', 'dish', 'fusion', 'jail']);

        // setbacks: upper tower mass on mid/high buildings (reads as a real skyline)
        const setbacks = [];

        for (const p of G.placements) {
            const b = p.b;
            if (b.type === 'metro') { this._buildMetroStation(p); continue; }
            if (OPEN.has(b.type)) { this._buildSpecialty(p); continue; }
            // Effective storeys from City.layout (authored fl x type multiplier).
            // Gating on the raw b.fl is what kept fl>=10 — and therefore every
            // setback, crown and spire below — permanently unreachable.
            const fl = p.floors || b.fl || 3;
            const ti = fl <= 4 ? 0 : fl <= 9 ? 1 : 2;
            // multi-tier setbacks — refined step ratios so silhouettes taper cleanly
            // (no zero-height slices, upper mass always inset enough to read)
            if (fl >= 8 && p.h > FLOOR_H * 6) {
                if (fl >= 16) {
                    // Exact partition of p.h so stacked masses never overshoot / gap.
                    // _hasStackAbove: skip parapet/plant on intermediate tops (avoids
                    // cap geometry buried inside the next setback mass).
                    const h0 = p.h * 0.44;
                    const h1 = p.h * 0.30;
                    const h2 = p.h - h0 - h1;
                    buckets[ti].push({ ...p, h: h0, _isBase: true, _hasStackAbove: true });
                    setbacks.push({ ...p, h: h1, w: p.w * 0.74, d: p.d * 0.74, y0: h0, _isSetback: true, _hasStackAbove: true });
                    setbacks.push({ ...p, h: h2, w: p.w * 0.48, d: p.d * 0.48, y0: h0 + h1, _isSetback: true, _crown: true });
                } else if (fl >= 12) {
                    const baseH = p.h * 0.56;
                    const topH = p.h - baseH;
                    buckets[ti].push({ ...p, h: baseH, _isBase: true, _hasStackAbove: true });
                    setbacks.push({
                        ...p,
                        h: topH,
                        w: p.w * 0.62,
                        d: p.d * 0.62,
                        y0: baseH,
                        _isSetback: true
                    });
                } else {
                    const baseH = p.h * 0.68;
                    const topH = p.h - baseH;
                    buckets[ti].push({ ...p, h: baseH, _isBase: true, _hasStackAbove: true });
                    setbacks.push({
                        ...p,
                        h: topH,
                        w: p.w * 0.72,
                        d: p.d * 0.72,
                        y0: baseH,
                        _isSetback: true
                    });
                }
            } else {
                buckets[ti].push(p);
            }
        }

        const dummy = new THREE.Object3D();
        const placeList = (all, ti, yOffset = 0) => {
            if (!all.length) return;
            const t = tiers[ti];
            // one mesh per (tier, facade variant)
            for (let v = 0; v < FACADE_VARIANTS; v++) {
                const list = all.filter(p => this._variantOf(p.id || p.b?.id) === v);
                if (!list.length) continue;
                placeVariant(list, t, v, yOffset);
            }
        };
        const placeVariant = (list, t, v, yOffset) => {
            const facades = t.variants[v];
            const geo = buildingBoxGeometry();
            // Standard: glass-ish facade response, lit by the sky PMREM
            const side = patchUVScale(new THREE.MeshStandardMaterial({
                map: facades.map,
                emissiveMap: facades.emissiveMap,
                emissive: new THREE.Color(0xffe0a8),
                emissiveIntensity: 0,
                metalness: 0.22,
                roughness: 0.38,
                vertexColors: true,
                envMapIntensity: ENV_I
            }));
            const roof = new THREE.MeshStandardMaterial({
                color: 0x2a303a,
                metalness: 0.35,
                roughness: 0.62,
                vertexColors: true,
                envMapIntensity: ENV_I
            });
            this.windowMats.push(side);
            const mats = [side, side, roof, roof, side, side];
            const im = new THREE.InstancedMesh(geo, mats, list.length);
            im.userData.uvCols = t.cols;
            list.forEach((p, i) => {
                dummy.position.set(p.x, (p.y0 || 0) + yOffset, p.z);
                dummy.scale.set(p.w, p.h, p.d);
                dummy.rotation.y = p.rot || 0;
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                const tint = facadeTint(buildingColor(p.b));
                im.setColorAt(i, tint);
                /* Remember where this building lives in its instanced mesh, and
                   its base tint. Buildings share three meshes, so any system
                   that wants to change ONE building's look (a datacentre
                   browning out under a GPU shortage) has to reach the instance
                   rather than the material. */
                if (p.b && !p._isSetback) {
                    p.b._inst = { mesh: im, i, base: tint.clone() };
                }
            });
            attachUVScale(im, list, t.rows);
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            scene.add(im);
            this.bldMeshes = this.bldMeshes || [];
            this.bldMeshes.push(im);
        };

        buckets.forEach((list, ti) => placeList(list, ti));
        // setback tops use mid/high facade tier
        if (setbacks.length) placeList(setbacks, 2);

        // mid-belt ledge strip for taller masses — depth without per-building meshes
        this._buildLedges(scene, [...buckets[1], ...buckets[2], ...setbacks]);
        // Parapet/plant only on terminal tops (not intermediate setback floors)
        const roofList = [
            ...buckets.flat().filter(p => !p._hasStackAbove).map(p => ({ ...p, h: (p.y0 || 0) + p.h })),
            ...setbacks.filter(p => !p._hasStackAbove).map(p => ({ ...p, h: (p.y0 || 0) + p.h }))
        ];
        this._buildRoofs(scene, roofList);
        // Thin setback "floor plate" rings on intermediate steps (reads as a real step)
        this._buildSetbackPlates(scene, [
            ...buckets.flat().filter(p => p._hasStackAbove),
            ...setbacks.filter(p => p._hasStackAbove)
        ]);
    },

    /* Background city blocks (City.infill). Three instanced meshes bucketed by
       height tier plus one instanced roof cap — the whole built fabric of the
       city for four draw calls. Colour comes from a per-district palette so
       walking from the Agent District into Residential actually looks like
       crossing into a different part of town. */
    _buildInfill(scene) {
        const lots = City.infill || [];
        if (!lots.length) return;
        const tiers = this._facadeTiers();
        const buckets = [];
        for (let ti = 0; ti < 3; ti++) buckets.push(Array.from({ length: FACADE_VARIANTS }, () => []));
        lots.forEach((l, i) => {
            const ti = l.fl <= 4 ? 0 : l.fl <= 9 ? 1 : 2;
            buckets[ti][this._variantOf(l.district + ':' + i)].push(l);
        });

        const dummy = new THREE.Object3D();
        const col = new THREE.Color();
        for (let ti = 0; ti < 3; ti++) for (let v = 0; v < FACADE_VARIANTS; v++) {
            const list = buckets[ti][v];
            if (!list.length) continue;
            const geo = buildingBoxGeometry();
            const side = patchUVScale(new THREE.MeshStandardMaterial({
                map: tiers[ti].variants[v].map,
                emissiveMap: tiers[ti].variants[v].emissiveMap,
                emissive: new THREE.Color(0xffe0a8),
                emissiveIntensity: 0,
                metalness: 0.16,
                roughness: 0.52,
                vertexColors: true,
                envMapIntensity: ENV_I
            }));
            const roof = new THREE.MeshStandardMaterial({
                color: 0x2b313b, metalness: 0.3, roughness: 0.7,
                vertexColors: true, envMapIntensity: ENV_I
            });
            // Registered so Weather's night ramp lights these windows too —
            // without this the background city stayed dead black after dusk
            // while the named buildings glowed.
            this.windowMats.push(side);
            const im = new THREE.InstancedMesh(geo, [side, side, roof, roof, side, side], list.length);
            im.userData.uvCols = tiers[ti].cols;
            list.forEach((l, i) => {
                dummy.position.set(l.x, 0, l.z);
                dummy.scale.set(l.w, l.h, l.d);
                dummy.rotation.y = l.rot || 0;
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                const base = DISTRICT_TINT[l.district] || INFILL_TINT[l.biome] || '#5a6472';
                col.set(base).offsetHSL((l.seed - 0.5) * 0.10, (l.seed - 0.5) * 0.22, (l.seed - 0.5) * 0.26);
                im.setColorAt(i, facadeTint('#' + col.getHexString(THREE.SRGBColorSpace)));
            });
            attachUVScale(im, list, tiers[ti].rows);
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            scene.add(im);
        }

        // Parapet caps — the single cheapest thing that stops a box reading as
        // a box, because it gives the roofline a lit edge against the sky.
        const capGeo = new THREE.BoxGeometry(1, 1, 1);
        capGeo.translate(0, 0.5, 0);
        const caps = new THREE.InstancedMesh(capGeo,
            new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.14, roughness: 0.78, envMapIntensity: ENV_I * 0.5 }),
            lots.length);
        lots.forEach((l, i) => {
            dummy.position.set(l.x, l.h, l.z);
            dummy.scale.set(l.w + 3.5, 3, l.d + 3.5);
            dummy.updateMatrix();
            caps.setMatrixAt(i, dummy.matrix);
            caps.setColorAt(i, trimColor(DISTRICT_TINT[l.district] || INFILL_TINT[l.biome] || '#5a6472', 0.36 + l.seed * 0.1));
        });
        caps.instanceMatrix.needsUpdate = true;
        if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
        scene.add(caps);
    },

    /** Slim floor-plate rings at intermediate setback tops — not full parapets. */
    _buildSetbackPlates(scene, list) {
        if (!list.length) return;
        const spots = list.map(p => ({
            x: p.x,
            y: (p.y0 || 0) + p.h,
            z: p.z,
            w: p.w + 5,
            d: p.d + 5,
            tint: buildingColor(p.b)
        }));
        const geo = new THREE.BoxGeometry(1, 1, 1);
        geo.translate(0, 0.5, 0);
        const im = new THREE.InstancedMesh(geo,
            new THREE.MeshStandardMaterial({
                color: 0xffffff, metalness: 0.26, roughness: 0.52, envMapIntensity: ENV_I * 0.8
            }), spots.length);
        const d = new THREE.Object3D();
        spots.forEach((s, i) => {
            d.position.set(s.x, s.y, s.z);
            d.scale.set(s.w, 2.2, s.d); // thin plate, overhangs the mass below
            d.updateMatrix();
            im.setMatrixAt(i, d.matrix);
            im.setColorAt(i, trimColor(s.tint, 0.50));
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        scene.add(im);
    },

    /** Horizontal belt ledges so facades read as stacked floors, not flat slabs. */
    _buildLedges(scene, list) {
        if (!list.length) return;
        const spots = [];
        for (const p of list) {
            const base = p.y0 || 0;
            const h = base + p.h;
            if (h < FLOOR_H * 3) continue;
            // belt ledges — denser on tall masses; thin so they don't read as shelves
            // keep them strictly inside the mass height to avoid clipping into parapets
            const tint = buildingColor(p.b);
            const yMid = base + p.h * 0.52;
            spots.push({ x: p.x, y: yMid, z: p.z, w: p.w + 4.5, d: p.d + 4.5, th: 2.4, tint });
            if (h > FLOOR_H * 5) {
                spots.push({ x: p.x, y: base + p.h * 0.26, z: p.z, w: p.w + 3.5, d: p.d + 3.5, th: 2.1, tint });
            }
            if (h > FLOOR_H * 9) {
                spots.push({ x: p.x, y: base + p.h * 0.76, z: p.z, w: p.w + 2.8, d: p.d + 2.8, th: 1.9, tint });
            }
        }
        if (!spots.length) return;
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const im = new THREE.InstancedMesh(geo,
            new THREE.MeshStandardMaterial({
                color: 0xffffff, metalness: 0.24, roughness: 0.55, envMapIntensity: ENV_I * 0.8
            }), spots.length);
        const d = new THREE.Object3D();
        spots.forEach((s, i) => {
            d.position.set(s.x, s.y, s.z);
            d.scale.set(s.w, s.th, s.d);
            d.updateMatrix();
            im.setMatrixAt(i, d.matrix);
            im.setColorAt(i, trimColor(s.tint, 0.52));
        });
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        scene.add(im);
    },

    /** Street-level subway pavilion — not a generic office box. */
    _buildMetroStation(p) {
        const { x, z, w, d } = p;
        const lineCol = 0x22d3ee;
        // sunken plaza edge
        sBox(w * 1.05, 3, d * 1.05, x, 1.5, z, 0x3a424e);
        // pavilion shell
        sBox(w * 0.72, 22, d * 0.55, x, 14, z, 0x4a5568);
        // glass curtain walls (cyan-tinted blocks)
        sBox(w * 0.66, 16, 2.2, x, 12, z + d * 0.26, 0x5ec8e8);
        sBox(w * 0.66, 16, 2.2, x, 12, z - d * 0.26, 0x5ec8e8);
        sBox(2.2, 16, d * 0.48, x + w * 0.34, 12, z, 0x5ec8e8);
        sBox(2.2, 16, d * 0.48, x - w * 0.34, 12, z, 0x5ec8e8);
        // roof canopy overhang
        sBox(w * 0.88, 3, d * 0.72, x, 26, z, 0x2a3340);
        // "M" totem / entrance pylon
        sBox(8, 36, 8, x - w * 0.42, 18, z + d * 0.42, 0x1e293b);
        sBox(10, 8, 10, x - w * 0.42, 38, z + d * 0.42, lineCol);
        // escalator well — dark hole + side walls
        sBox(w * 0.28, 2, d * 0.22, x + w * 0.08, 0.6, z, 0x0a0e14);
        sBox(w * 0.3, 8, 2, x + w * 0.08, 4, z + d * 0.12, 0x334155);
        sBox(w * 0.3, 8, 2, x + w * 0.08, 4, z - d * 0.12, 0x334155);
        // handrail glow strip
        sBox(w * 0.26, 1.2, 1.5, x + w * 0.08, 7, z + d * 0.12, lineCol);
        sBox(w * 0.26, 1.2, 1.5, x + w * 0.08, 7, z - d * 0.12, lineCol);
        // platform edge lights
        for (const ox of [-0.2, 0, 0.2]) {
            sBox(6, 1.5, 6, x + ox * w, 1.2, z + d * 0.38, lineCol);
        }
    },

    /* Parapets and rooftop plant. Every building was a bare box cut off flat
       at the top, which is most of why the skyline read as untextured blocks.
       Both are instanced with per-building transforms — few draw calls for the
       whole city, and they scale exactly (a parapet baked into the shared unit
       box would stretch to 20 units on a 200-wide building). */
    _buildRoofs(scene, list) {
        if (!list.length) return;
        const d = new THREE.Object3D();
        const CAP_H = 4.2; // slim parapet cap — was 8 (chunky lid look)

        // Parapet cap: slight overhang, thin height so it reads as coping stone
        const capGeo = new THREE.BoxGeometry(1, 1, 1);
        capGeo.translate(0, 0.5, 0);
        const caps = new THREE.InstancedMesh(capGeo,
            new THREE.MeshStandardMaterial({
                color: 0xffffff, metalness: 0.16, roughness: 0.72, envMapIntensity: ENV_I * 0.6
            }), list.length);
        list.forEach((p, i) => {
            d.position.set(p.x, p.h, p.z);
            // modest overhang (not +6 which floated past setback edges)
            d.scale.set(p.w + 4, CAP_H, p.d + 4);
            d.updateMatrix();
            caps.setMatrixAt(i, d.matrix);
            const capCol = trimColor(buildingColor(p.b), 0.40).clone();
            caps.setColorAt(i, capCol);
            /* The parapet cap is the brightest thing on a building from above.
               Record it alongside the mass so a brownout dims the whole
               building — dimming only the walls left the roof vividly lit and
               the effect didn't read at all. */
            if (p.b) p.b._capInst = { mesh: caps, i, base: capCol };
        });
        caps.instanceMatrix.needsUpdate = true;
        if (caps.instanceColor) caps.instanceColor.needsUpdate = true;
        scene.add(caps);

        // Crown / antenna spires on the tallest setback tops (skyline punctuation)
        const crownList = list.filter(p => p._crown || (p.h > FLOOR_H * 14 && (p.floors || p.b?.fl || 0) >= 12));
        if (crownList.length) {
            const spireGeo = new THREE.BoxGeometry(1, 1, 1);
            spireGeo.translate(0, 0.5, 0);
            const spires = new THREE.InstancedMesh(spireGeo,
                new THREE.MeshStandardMaterial({
                    color: 0xc8d0dc, metalness: 0.55, roughness: 0.28, envMapIntensity: ENV_I
                }), crownList.length);
            crownList.forEach((p, i) => {
                const spireH = 22 + (p.floors || p.b?.fl || 8) * 1.8;
                const spireW = Math.max(4.5, Math.min(p.w, p.d) * 0.07);
                d.position.set(p.x, p.h + CAP_H, p.z);
                d.scale.set(spireW, spireH, spireW);
                d.updateMatrix();
                spires.setMatrixAt(i, d.matrix);
            });
            spires.instanceMatrix.needsUpdate = true;
            scene.add(spires);

            // slender tip antenna above the spire mass
            const tipGeo = new THREE.BoxGeometry(1, 1, 1);
            tipGeo.translate(0, 0.5, 0);
            const tips = new THREE.InstancedMesh(tipGeo,
                new THREE.MeshStandardMaterial({
                    color: 0xdce4f0, metalness: 0.7, roughness: 0.22, envMapIntensity: ENV_I
                }), crownList.length);
            crownList.forEach((p, i) => {
                const spireH = 22 + (p.floors || p.b?.fl || 8) * 1.8;
                d.position.set(p.x, p.h + CAP_H + spireH, p.z);
                d.scale.set(1.6, 12 + (p.floors || p.b?.fl || 8) * 0.6, 1.6);
                d.updateMatrix();
                tips.setMatrixAt(i, d.matrix);
            });
            tips.instanceMatrix.needsUpdate = true;
            scene.add(tips);
        }

        // plant: AC units, water tanks, dish antennas — sit ON the parapet deck
        const acSpots = [], tankSpots = [], dishSpots = [];
        for (const p of list) {
            // keep plant inside the footprint so nothing clips past parapet edges
            const n = p.w > 150 ? 5 : p.w > 90 ? 3 : 2;
            const margin = Math.max(18, Math.min(p.w, p.d) * 0.22);
            for (let i = 0; i < n; i++) {
                if (rng() < 0.2) continue;
                const spot = {
                    x: p.x + (rng() - 0.5) * Math.max(12, p.w - margin),
                    y: p.h + CAP_H,
                    z: p.z + (rng() - 0.5) * Math.max(12, p.d - margin),
                    s: 0.6 + rng() * 0.85,
                    r: rng() * Math.PI
                };
                const roll = rng();
                if (roll < 0.55) acSpots.push(spot);
                else if (roll < 0.82) tankSpots.push(spot);
                else dishSpots.push(spot);
            }
        }
        const addPlant = (spots, geo) => {
            if (!spots.length) return;
            const plant = new THREE.InstancedMesh(geo,
                new THREE.MeshStandardMaterial({
                    vertexColors: true, metalness: 0.3, roughness: 0.55, envMapIntensity: ENV_I
                }), spots.length);
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
        };
        addPlant(acSpots, mergeGeometries([
            paint(new THREE.BoxGeometry(16, 9, 12).translate(0, 4.5, 0), 0x9aa1ab),
            paint(new THREE.BoxGeometry(13, 1.6, 9).translate(0, 9.6, 0), 0x6e757f),
            paint(new THREE.CylinderGeometry(3.4, 3.4, 7, 8).translate(11, 3.5, 3), 0x878e98)
        ], false));
        addPlant(tankSpots, mergeGeometries([
            paint(new THREE.CylinderGeometry(7, 7, 14, 10).translate(0, 7, 0), 0x7a8494),
            paint(new THREE.CylinderGeometry(7.6, 7.6, 1.4, 10).translate(0, 14.2, 0), 0x5a6470),
            paint(new THREE.BoxGeometry(3, 4, 3).translate(0, 2, 0), 0x4a5360)
        ], false));
        addPlant(dishSpots, mergeGeometries([
            paint(new THREE.CylinderGeometry(1.4, 2.2, 10, 6).translate(0, 5, 0), 0x6a7280),
            paint(new THREE.SphereGeometry(6, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55).translate(0, 12, 0), 0xb8c0cc)
        ], false));
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
            case 'fusion': {
                // Tokamak hall: a torus you can actually see through the roof
                // lantern, ringed by cryo dewars and the neutral-beam gallery.
                sBox(w * 0.92, 34, d * 0.92, x, 17, z, 0x8e97a4);            // plinth
                sCyl(w * 0.40, w * 0.40, 46, 20, x, 57, z, 0xb4bcc8);        // containment drum
                const torus = new THREE.Mesh(
                    paint(new THREE.TorusGeometry(w * 0.26, w * 0.075, 10, 22).rotateX(Math.PI / 2), 0x3fd8e8),
                    matVC());
                torus.position.set(x, 74, z);
                G.scene.add(torus);
                A.push({ obj: torus, kind: 'tokamak' });
                sCyl(w * 0.42, w * 0.42, 5, 20, x, 82, z, 0x6a7482);          // roof lantern ring
                for (let i = 0; i < 6; i++) {                                  // cryo dewars
                    const a2 = (i / 6) * Math.PI * 2;
                    sCyl(9, 9, 30, 10, x + Math.cos(a2) * w * 0.56, 15, z + Math.sin(a2) * d * 0.56, 0xd6dce4);
                }
                sBox(w * 0.34, 20, 16, x, 10, z + d * 0.62, 0x707a88);        // beam gallery
                G.colliders.push({ x0: x - w * 0.48, z0: z - d * 0.48, x1: x + w * 0.48, z1: z + d * 0.48, id: b.id });
                break;
            }
            case 'jail': {
                // Detention centre: cell block behind a perimeter wall with
                // watchtowers and a floodlit yard. Reads as a jail from outside,
                // which is the whole point of giving it its own building.
                const hw = w * 0.5, hd = d * 0.5;
                sBox(w * 0.62, 78, d * 0.42, x, 39, z - d * 0.18, 0x6a6d74);   // cell block
                for (let f = 1; f <= 3; f++) {                                  // barred window bands
                    sBox(w * 0.64, 3, d * 0.44, x, f * 19, z - d * 0.18, 0x33363c);
                }
                sBox(w * 0.30, 26, d * 0.22, x, 13, z + d * 0.24, 0x7a7e86);   // intake block
                // perimeter wall
                sBox(w, 26, 6, x, 13, z - hd, 0x585c63);
                sBox(w, 26, 6, x, 13, z + hd, 0x585c63);
                sBox(6, 26, d, x - hw, 13, z, 0x585c63);
                sBox(6, 26, d, x + hw, 13, z, 0x585c63);
                for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {  // watchtowers
                    sBox(14, 46, 14, x + ox * hw, 23, z + oz * hd, 0x4e5259);
                    sBox(20, 6, 20, x + ox * hw, 48, z + oz * hd, 0x3a3e45);
                }
                G.colliders.push(
                    { x0: x - hw - 3, z0: z - hd - 3, x1: x + hw + 3, z1: z - hd + 3, id: 'jail_n' },
                    { x0: x - hw - 3, z0: z + hd - 3, x1: x + hw + 3, z1: z + hd + 3, id: 'jail_s' },
                    { x0: x - hw - 3, z0: z - hd, x1: x - hw + 3, z1: z + hd, id: 'jail_w' },
                    { x0: x + hw - 3, z0: z - hd, x1: x + hw + 3, z1: z + hd, id: 'jail_e' },
                    { x0: x - w * 0.32, z0: z - d * 0.4, x1: x + w * 0.32, z1: z + d * 0.04, id: b.id });
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
                // Jumbotron. It used to be a flat 0x1a1a2e slab with a slightly
                // bluer quad on it, which from the street read as a hole cut out
                // of the world. It is the LMSYS Arena — it should be showing the
                // matchup.
                sBox(74, 40, 4, x, 30, z - 78, 0x15161f);                        // bezel
                // aiIndexBoard returns { texture, draw } — keep the draw handle
                // so the jumbotron can be refreshed with live numbers later.
                this.arenaBoard = TEX.aiIndexBoard();
                const board = new THREE.Mesh(
                    new THREE.PlaneGeometry(66, 32),
                    new THREE.MeshBasicMaterial({
                        map: this.arenaBoard.texture, toneMapped: false, fog: true
                    }));
                board.position.set(x, 30, z - 75.6);
                G.scene.add(board);
                // corner floodlights so the bowl reads as a venue at night
                for (const ox of [-1, 1]) {
                    sBox(5, 22, 5, x + ox * 74, 58, z - 40, 0x3a3f48);
                    sBox(16, 5, 8, x + ox * 74, 70, z - 40, 0x22262c);
                }
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


    /** Real transparent shopfront glass on street faces (see-through ground floor). */
    _buildStreetGlass(scene) {
        const OPEN = new Set(['park', 'launchpad', 'solar', 'wind', 'dam', 'crane',
            'graveyard', 'billboard', 'monument', 'arena', 'black_market',
            'nuclear', 'coal', 'dish', 'metro', 'fusion', 'jail']);
        const glassGeos = [];
        const frameGeos = [];
        // Tasteful glass: light cyan, low opacity, slight metal sheen — not black slabs
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0xd0eaf6,
            metalness: 0.35,
            roughness: 0.1,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide,
            emissive: new THREE.Color(0x204860),
            emissiveIntensity: 0.1,
            envMapIntensity: ENV_I * 2.2
        });
        for (const p of G.placements) {
            if (OPEN.has(p.b.type)) continue;
            if ((p.h || 0) < FLOOR_H * 1.5) continue;
            const faces = [
                { nx: 1, nz: 0, ang: Math.PI / 2, half: p.w / 2, span: p.d },
                { nx: -1, nz: 0, ang: -Math.PI / 2, half: p.w / 2, span: p.d },
                { nx: 0, nz: 1, ang: 0, half: p.d / 2, span: p.w },
                { nx: 0, nz: -1, ang: Math.PI, half: p.d / 2, span: p.w }
            ];
            for (const f of faces) {
                const wx = p.x + f.nx * (f.half + 1.2);
                const wz = p.z + f.nz * (f.half + 1.2);
                let nearRoad = false;
                for (const ax of (City.avenueXs || [])) if (Math.abs(wx - ax) < 90) nearRoad = true;
                for (const sz of (City.streetZs || [])) if (Math.abs(wz - sz) < 90) nearRoad = true;
                if (!nearRoad) continue;

                const gw = Math.min(f.span * 0.68, 110);
                const gh = Math.min(FLOOR_H * 0.95, 22);
                const gy = gh * 0.52 + 3.5;

                const g = new THREE.PlaneGeometry(gw, gh);
                g.rotateY(f.ang);
                g.translate(wx, gy, wz);
                glassGeos.push(g);

                // thin metal mullion frame around the pane
                const fw = gw + 1.6, fh = gh + 1.6;
                for (const side of [-1, 1]) {
                    const bar = new THREE.BoxGeometry(0.7, fh, 0.55);
                    bar.rotateY(f.ang);
                    bar.translate(
                        wx + f.nx * 0.4 + (-f.nz) * side * (gw * 0.5),
                        gy,
                        wz + f.nz * 0.4 + f.nx * side * (gw * 0.5)
                    );
                    frameGeos.push(paint(bar, 0xb8c0cc));
                }
                for (const vSide of [-1, 1]) {
                    const rail = new THREE.BoxGeometry(fw, 0.65, 0.55);
                    rail.rotateY(f.ang);
                    rail.translate(
                        wx + f.nx * 0.4,
                        gy + vSide * (gh * 0.5),
                        wz + f.nz * 0.4
                    );
                    frameGeos.push(paint(rail, 0xb8c0cc));
                }
                const mid = new THREE.BoxGeometry(0.55, gh * 0.92, 0.45);
                mid.rotateY(f.ang);
                mid.translate(wx + f.nx * 0.45, gy, wz + f.nz * 0.45);
                frameGeos.push(paint(mid, 0xa8b2c0));
            }
        }
        if (glassGeos.length) {
            const mesh = new THREE.Mesh(mergeGeometries(glassGeos, false), glassMat);
            mesh.matrixAutoUpdate = false;
            mesh.renderOrder = 2;
            scene.add(mesh);
            this.streetGlass = mesh;
        }
        if (frameGeos.length) {
            const frameMesh = new THREE.Mesh(mergeGeometries(frameGeos, false),
                new THREE.MeshStandardMaterial({
                    vertexColors: true, metalness: 0.55, roughness: 0.35, envMapIntensity: ENV_I
                }));
            frameMesh.matrixAutoUpdate = false;
            scene.add(frameMesh);
        }
    },
    // ── SIGNS (one atlas, three draw calls) ──────────────────────────────────
    _buildSigns(scene) {
        /* Fixed facade signs — no camera lookAt, which is what used to make the
           boards float and spin in the street. Each building gets a plate flush
           on its street-facing wall.

           All of them share ONE atlas texture and ONE merged quad geometry. The
           previous version built a dedicated 512x128 DataTexture and three
           separate meshes per building: ~130 textures (~34 MB), ~130 blocking
           GPU uploads during boot, and ~390 draw calls for signage in a
           renderer whose whole budget is 150. */
        const NO_SIGN = new Set(['park', 'launchpad', 'crane', 'graveyard', 'billboard',
            'monument', 'solar', 'wind', 'dam']);

        // Always face the nearest road (outward), never the district centre —
        // that stuck signs on opposite embassies into the middle of the road.
        const axs = (City.avenueXs || []).concat(City.ringX || []);
        const zss = (City.streetZs || []).concat(City.ringZ || []);
        const faceFor = (p) => {
            let bestAx = axs[0] ?? 0, bestAd = Infinity;
            for (const ax of axs) { const d = Math.abs(p.x - ax); if (d < bestAd) { bestAd = d; bestAx = ax; } }
            let bestSz = zss[0] ?? 0, bestZd = Infinity;
            for (const sz of zss) { const d = Math.abs(p.z - sz); if (d < bestZd) { bestZd = d; bestSz = sz; } }
            if (bestAd <= bestZd) {
                const nx = Math.sign(bestAx - p.x) || 1;
                return { nx, nz: 0, ang: nx > 0 ? Math.PI / 2 : -Math.PI / 2 };
            }
            const nz = Math.sign(bestSz - p.z) || 1;
            return { nx: 0, nz, ang: nz > 0 ? 0 : Math.PI };
        };

        const signColor = (b) => (b.lab && LABS[b.lab]) ? LABS[b.lab].color
            : b.type === 'black_market' ? '#f472b6'
            : b.type === 'bar' ? '#e879f9'
            : b.type === 'coal' || b.type === 'nuclear' ? '#fbbf24'
            : b.type === 'newspaper' ? '#fbbf24'
            : b.type === 'embassy' || b.type === 'villa' ? '#38bdf8'
            : '#22d3ee';

        // ── pass 1: work out every sign's placement and atlas entry ──
        const signs = [];
        for (const p of G.placements) {
            const b = p.b;
            if (!b || NO_SIGN.has(b.type)) continue;
            const { nx, nz, ang } = faceFor(p);
            const faceW = nx !== 0 ? p.d : p.w;
            const halfOut = nx !== 0 ? p.w / 2 : p.d / 2;
            // Hung on the wall, not a highway gantry
            const sw = Math.min(Math.max(faceW * 0.42, 40), Math.min(faceW * 0.75, 88));
            const sh = Math.max(14, Math.min(sw / 3.8, 24));
            const gap = 2.8;
            signs.push({
                id: b.id,
                text: b.id === 'black_market' ? 'THE UNDERGROUND' : String(b.name || b.id || 'BUILDING'),
                color: signColor(b),
                nx, nz, ang, sw, sh,
                bx: p.x + nx * (halfOut + gap + 0.6),
                bz: p.z + nz * (halfOut + gap + 0.6),
                y: Math.min(Math.max(FLOOR_H * 1.25, 28), Math.min((p.h || 40) * 0.38, 42))
            });
        }
        if (!signs.length) { this.signCount = 0; return; }

        const atlas = TEX.signAtlas(signs);

        // ── pass 2: one merged quad mesh for the text plates ──
        const plateGeos = [];
        for (const s of signs) {
            const g = new THREE.PlaneGeometry(s.sw, s.sh);
            const uvA = g.attributes.uv;
            const r = atlas.uv.get(s.id);
            for (let i = 0; i < uvA.count; i++) {
                uvA.setXY(i,
                    r.u0 + uvA.getX(i) * (r.u1 - r.u0),
                    r.v0 + uvA.getY(i) * (r.v1 - r.v0));
            }
            g.rotateY(s.ang);
            g.translate(s.bx + s.nx * 1.1, s.y, s.bz + s.nz * 1.1);
            plateGeos.push(g);
        }
        const plates = new THREE.Mesh(mergeGeometries(plateGeos, false),
            new THREE.MeshBasicMaterial({
                map: atlas.texture,
                side: THREE.FrontSide,
                toneMapped: false,
                // Signs used to opt out of fog, so a board 2 km down the avenue
                // punched through the haze at full brightness like a sticker on
                // the lens. They are part of the city; they fade with it.
                fog: true
            }));
        plates.matrixAutoUpdate = false;
        plates.renderOrder = 2;
        plates.name = 'signPlates';
        scene.add(plates);

        // ── pass 3: housings and accent bars, one InstancedMesh each ──
        const unit = new THREE.BoxGeometry(1, 1, 1);
        const housings = new THREE.InstancedMesh(unit,
            new THREE.MeshStandardMaterial({ color: 0x0c1018, metalness: 0.3, roughness: 0.55, envMapIntensity: ENV_I * 0.4 }),
            signs.length);
        const barGeo = new THREE.BoxGeometry(1, 1, 1);
        const barMat = new THREE.MeshStandardMaterial({
            color: 0xffffff, metalness: 0.2, roughness: 0.45,
            emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.35, envMapIntensity: ENV_I * 0.4
        });
        const bars = new THREE.InstancedMesh(barGeo, barMat, signs.length);
        const d = new THREE.Object3D();
        const c = new THREE.Color();
        signs.forEach((s, i) => {
            d.position.set(s.bx - s.nx * 0.5, s.y, s.bz - s.nz * 0.5);
            d.rotation.set(0, s.ang, 0);
            d.scale.set(s.sw + 3, s.sh + 3, 3);
            d.updateMatrix();
            housings.setMatrixAt(i, d.matrix);

            d.position.set(s.bx - s.nx * 0.3, s.y - s.sh / 2 - 2, s.bz - s.nz * 0.3);
            d.scale.set(s.sw + 3, 1.4, 2.2);
            d.updateMatrix();
            bars.setMatrixAt(i, d.matrix);
            bars.setColorAt(i, c.set(s.color));
        });
        housings.instanceMatrix.needsUpdate = true;
        bars.instanceMatrix.needsUpdate = true;
        if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
        scene.add(housings, bars);

        this.signPlates = plates;
        this.signBarMat = barMat;
        this.signCount = signs.length;
        console.log('[SC-FP] building signs (atlas):', signs.length, '- 3 draw calls');
    },






    // ── PROPS: trees, lamps, benches, poles, containers, ships ───────────────
    _buildProps(scene) {
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        // Trees - tapered trunk + multi-lobe canopy (organic, still 2 draw calls)
        const treeSpots = [];
        for (const d of City.districts) {
            const count = { park: 70, forest: 120, plaza: 26, academic: 16, urban: 6, industry: 3, coastal: 10, wasteland: 5, desert: 2 }[d.biome] ?? 6;
            for (let i = 0; i < count; i++) {
                const tx = d.cx + (rng() - 0.5) * (CELL_W - 70);
                const tz = d.cz + (rng() - 0.5) * (CELL_D - 70);
                if (Math.abs(tx - d.cx) < 44 || Math.abs(tz - d.cz) < 44) continue;
                let blocked = false;
                for (const c of G.colliders) if (tx > c.x0 - 8 && tx < c.x1 + 8 && tz > c.z0 - 8 && tz < c.z1 + 8) { blocked = true; break; }
                if (blocked) continue;
                treeSpots.push({ x: tx, z: tz, biome: d.biome, s: 0.75 + rng() * 0.85, spin: rng() * Math.PI });
            }
        }
        const trunkGeo = new THREE.CylinderGeometry(1.6, 3.4, 26, 7);
        trunkGeo.translate(0, 13, 0);
        const lobeA = new THREE.SphereGeometry(14, 8, 6); lobeA.translate(0, 34, 0);
        const lobeB = new THREE.SphereGeometry(11, 7, 6); lobeB.translate(5, 42, -3);
        const lobeC = new THREE.SphereGeometry(10, 7, 6); lobeC.translate(-6, 30, 4);
        const lobeD = new THREE.SphereGeometry(8, 6, 5); lobeD.translate(3, 38, 6);
        const canGeo = mergeGeometries([lobeA, lobeB, lobeC, lobeD], false);
        const nTrees = Math.max(1, treeSpots.length);
        const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x4a3528 }), nTrees);
        const cans = new THREE.InstancedMesh(canGeo, new THREE.MeshLambertMaterial({ flatShading: true }), nTrees);
        treeSpots.forEach((t, i) => {
            dummy.position.set(t.x, 0, t.z);
            dummy.scale.setScalar(t.s);
            dummy.rotation.y = t.spin;
            dummy.updateMatrix();
            trunks.setMatrixAt(i, dummy.matrix);
            cans.setMatrixAt(i, dummy.matrix);
            const cc = t.biome === 'wasteland' ? color.set(0x6a5a48)
                : t.biome === 'coastal' ? color.set(0x3f8a3f)
                : t.biome === 'desert' ? color.set(0x5a7a3a)
                : color.set(0x2f6b2a).offsetHSL((rng() - 0.5) * 0.06, 0.05, (rng() - 0.5) * 0.12);
            cans.setColorAt(i, cc);
        });
        trunks.count = treeSpots.length;
        cans.count = treeSpots.length;
        trunks.instanceMatrix.needsUpdate = true;
        cans.instanceMatrix.needsUpdate = true;
        if (cans.instanceColor) cans.instanceColor.needsUpdate = true;
        scene.add(trunks, cans);

        /* Street lamps down BOTH pavements of every avenue and street.
           They used to be 34 units — 3.4 m — tall, with a single unlit sphere on
           top and nothing else: at night the sphere turned white and that was
           the entire lighting contribution to the surface city. No glow, no
           pool of light on the ground, and marble-sized lamps at chest height.
           Real street lamps are 8-10 m, so 88 units, and the two things that
           actually sell a night street — a halo around the lamp and a pool
           under it — are added below for two extra draw calls and no lights. */
        const LAMP_H = 88;
        const lampSpots = [];
        for (const ax of City.avenueXs) {
            for (let z = -CITY_D / 2 + 80; z < CITY_D / 2; z += 230) {
                lampSpots.push({ x: ax + 79, z }, { x: ax - 79, z: z + 115 });
            }
        }
        for (const sz of City.streetZs) {
            for (let x = -CITY_W / 2 + 80; x < CITY_W / 2; x += 230) {
                lampSpots.push({ x, z: sz + 79 }, { x: x + 115, z: sz - 79 });
            }
        }
        const poleGeo = mergeGeometries([
            new THREE.CylinderGeometry(1.5, 2.6, LAMP_H, 6).translate(0, LAMP_H / 2, 0),
            new THREE.CylinderGeometry(4.5, 3, 3, 8).translate(0, LAMP_H + 1.5, 0)   // luminaire hood
        ], false);
        const headGeo = new THREE.SphereGeometry(3.4, 8, 6);
        headGeo.translate(0, LAMP_H - 1.2, 0);
        const poles = new THREE.InstancedMesh(poleGeo,
            new THREE.MeshStandardMaterial({ color: 0x2f353f, metalness: 0.4, roughness: 0.6, envMapIntensity: ENV_I }),
            lampSpots.length);
        this.lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, toneMapped: false });
        const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, lampSpots.length);
        lampSpots.forEach((l, i) => {
            dummy.position.set(l.x, 0, l.z);
            dummy.scale.setScalar(1); dummy.rotation.y = 0; dummy.updateMatrix();
            poles.setMatrixAt(i, dummy.matrix);
            heads.setMatrixAt(i, dummy.matrix);
        });
        scene.add(poles, heads);
        this._buildLampLight(scene, lampSpots, LAMP_H);

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

    /* The two halves of a lit street lamp, both free of actual lights:
       a camera-facing halo (one Points cloud) and a pool of light on the
       pavement (one InstancedMesh of additive discs). Weather ramps both with
       `night`, so they cost nothing by day. */
    _buildLampLight(scene, spots, lampH) {
        const pos = new Float32Array(spots.length * 3);
        spots.forEach((l, i) => {
            pos[i * 3] = l.x; pos[i * 3 + 1] = lampH - 1; pos[i * 3 + 2] = l.z;
        });
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.lampGlowMat = new THREE.PointsMaterial({
            map: TEX.glowSprite('rgba(255,226,160,1)'),
            // 92 was far too wide: two lamps near the camera filled the frame
            // with white, and a receding avenue of them stacked additively into
            // a blown-out wall at the vanishing point.
            color: 0xffffff, size: 54, sizeAttenuation: true,
            transparent: true, opacity: 0, depthWrite: false,
            blending: THREE.AdditiveBlending, fog: false, toneMapped: false
        });
        const halo = new THREE.Points(g, this.lampGlowMat);
        halo.name = 'lampGlow';
        halo.renderOrder = 3;
        scene.add(halo);

        // Ground pool. A flat disc rather than a decal projector — the pavement
        // is flat here, so the cheap version is indistinguishable.
        const disc = new THREE.CircleGeometry(58, 16);
        disc.rotateX(-Math.PI / 2);
        this.lampPoolMat = new THREE.MeshBasicMaterial({
            map: TEX.glowSprite('rgba(255,214,150,1)'),
            transparent: true, opacity: 0, depthWrite: false,
            blending: THREE.AdditiveBlending, fog: false, toneMapped: false
        });
        const pools = new THREE.InstancedMesh(disc, this.lampPoolMat, spots.length);
        pools.name = 'lampPool';
        pools.renderOrder = 3;
        const d = new THREE.Object3D();
        spots.forEach((l, i) => {
            d.position.set(l.x, 2.4, l.z);
            d.updateMatrix();
            pools.setMatrixAt(i, d.matrix);
        });
        pools.instanceMatrix.needsUpdate = true;
        scene.add(pools);
    },

    // ── WATER + BEACH ────────────────────────────────────────────────────────
    _buildWater(scene) {
        this.waterTex = TEX.water();
        // Larger ocean so birds-eye / free-fly still sees water to the horizon
        const w = new THREE.Mesh(
            new THREE.PlaneGeometry(10000, CITY_D + 9000, 1, 1),
            new THREE.MeshPhongMaterial({
                map: this.waterTex,
                color: 0xb8dcf0,
                shininess: 160,
                specular: 0xaad4f0,
                reflectivity: 0.35
            })
        );
        w.rotation.x = -Math.PI / 2;
        w.position.set(SEA_X - 4800, -0.6, 0);
        w.name = 'water';
        scene.add(w);

        // Foam strip where water meets the beach
        const foam = new THREE.Mesh(
            new THREE.PlaneGeometry(90, CITY_D + 800),
            new THREE.MeshLambertMaterial({
                color: 0xdceef8,
                transparent: true,
                opacity: 0.55,
                depthWrite: false
            })
        );
        foam.rotation.x = -Math.PI / 2;
        foam.position.set(SEA_X - 35, -0.35, 0);
        foam.name = 'water';
        foam.userData.noShadow = true;
        scene.add(foam);

        // Beach with sand texture (readable from altitude)
        const sandTex = TEX.sand();
        sandTex.repeat.set(4, 48);
        const beach = new THREE.Mesh(
            new THREE.PlaneGeometry(320, CITY_D + 600),
            new THREE.MeshStandardMaterial({
                map: sandTex,
                color: 0xf0e0b8,
                roughness: 0.92,
                metalness: 0.0,
                envMapIntensity: ENV_I * 0.35
            })
        );
        beach.rotation.x = -Math.PI / 2;
        beach.position.set(SEA_X + 20, 0.15, 0);
        beach.userData.shadowReceiveOnly = true;
        scene.add(beach);

        // Wet sand band (darker, closer to the water)
        const wet = new THREE.Mesh(
            new THREE.PlaneGeometry(70, CITY_D + 500),
            new THREE.MeshLambertMaterial({ color: 0xb89a68 })
        );
        wet.rotation.x = -Math.PI / 2;
        wet.position.set(SEA_X - 5, 0.18, 0);
        wet.userData.shadowReceiveOnly = true;
        scene.add(wet);
    },

    // ── AI INDEX BILLBOARD PANEL ─────────────────────────────────────────────
    _buildBillboard(scene) {
        // Posts only — the live display is Kardashev's grounded monument (js/kardashev.js).
        // Previously this also spawned a free-floating plane that doubled the board
        // and read as a second mid-air panel next to the visitor monument.
        const p = G.bldById['ai_index'];
        if (!p) return;
        this.aiBoard = TEX.aiIndexBoard(); // keep API for UI redraw hooks if any
        // steel posts (specialty case also adds posts; harmless if both run)
        const steel = new THREE.MeshStandardMaterial({ color: 0x6a7280, metalness: 0.5, roughness: 0.4 });
        for (const ox of [-34, 34]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(8, 90, 8), steel);
            post.position.set(p.worldX + ox, 45, p.worldZ);
            scene.add(post);
        }
        G.colliders.push({
            x0: p.worldX - 40, z0: p.worldZ - 10,
            x1: p.worldX + 40, z1: p.worldZ + 10, id: 'ai_index'
        });
    },

    // ── DISTANT HILLS / MOUNTAINS ────────────────────────────────────────────
    // Multi-layer range: large forested foothills + taller rocky peaks with a
    // shared mountain texture so aerial / free-fly views read as real terrain
    // instead of flat green cones.
    _buildHills(scene) {
        const foothillGeo = new THREE.ConeGeometry(1, 1, 9);
        foothillGeo.translate(0, 0.5, 0);
        // Slightly more radial segments + a second peak mesh for ridgelines
        const peakGeo = new THREE.ConeGeometry(1, 1, 8);
        peakGeo.translate(0, 0.5, 0);

        const foothills = [];
        const peaks = [];
        // Ring around the city — denser than before so the horizon feels full
        for (let i = 0; i < 64; i++) {
            const a = (i / 64) * Math.PI * 2 + rng() * 0.1;
            const r = 4600 + rng() * 1800;
            const hx = Math.cos(a) * r + 1100;
            const hz = Math.sin(a) * r;
            if (hx < SEA_X + 250) continue;   // keep the range out of the ocean
            foothills.push({
                x: hx, z: hz,
                sx: 480 + rng() * 820,
                sy: 160 + rng() * 280,
                sz: 480 + rng() * 820,
                ry: rng() * Math.PI
            });
            // Every other foothill gets a taller rocky peak on top of the ring
            if (i % 2 === 0) {
                peaks.push({
                    x: hx + (rng() - 0.5) * 200,
                    z: hz + (rng() - 0.5) * 200,
                    sx: 280 + rng() * 420,
                    sy: 280 + rng() * 420,
                    sz: 280 + rng() * 420,
                    ry: rng() * Math.PI
                });
            }
        }
        // A few far outer "snow ridge" mountains for depth from altitude
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + 0.4;
            const r = 6200 + rng() * 900;
            const hx = Math.cos(a) * r + 900;
            if (hx < SEA_X + 400) continue;
            peaks.push({
                x: hx, z: Math.sin(a) * r,
                sx: 600 + rng() * 500,
                sy: 420 + rng() * 380,
                sz: 600 + rng() * 500,
                ry: rng() * Math.PI
            });
        }

        const mtnTex = TEX.mountain();
        mtnTex.repeat.set(2, 2);
        const foothillMat = new THREE.MeshLambertMaterial({
            map: mtnTex, color: 0x8fad78
        });
        const peakMat = new THREE.MeshLambertMaterial({
            map: mtnTex, color: 0xc8c4b8
        });

        const dummy = new THREE.Object3D();
        if (foothills.length) {
            const mesh = new THREE.InstancedMesh(foothillGeo, foothillMat, foothills.length);
            mesh.name = 'hills';
            foothills.forEach((s, i) => {
                dummy.position.set(s.x, -8, s.z);
                dummy.scale.set(s.sx, s.sy, s.sz);
                dummy.rotation.set((rng() - 0.5) * 0.08, s.ry, (rng() - 0.5) * 0.08);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });
            scene.add(mesh);
        }
        if (peaks.length) {
            const mesh = new THREE.InstancedMesh(peakGeo, peakMat, peaks.length);
            mesh.name = 'hills';
            peaks.forEach((s, i) => {
                dummy.position.set(s.x, -6, s.z);
                dummy.scale.set(s.sx, s.sy, s.sz);
                dummy.rotation.set((rng() - 0.5) * 0.05, s.ry, (rng() - 0.5) * 0.05);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });
            scene.add(mesh);
        }
    },

    /* Point the sun at the player and park the shadow frustum on them.
       `dir` is the unit vector FROM the sun TOWARDS the ground, supplied by
       Weather so the shadow direction always matches the visible sun arc.
       The frustum centre is snapped to whole shadow texels in light space —
       without that, sub-texel movement makes every shadow edge crawl and
       sparkle as you walk, which looks far worse than no shadows at all. */
    aimSun(dirX, dirY, dirZ, focusX, focusZ) {
        _sDir.set(dirX, dirY, dirZ);
        if (_sDir.lengthSq() < 1e-6) _sDir.set(-0.5, -0.8, -0.3);
        _sDir.normalize();
        _sTmp.set(focusX, 0, focusZ);

        if (this.shadows) {
            const R = G.preset.shadowRadius;
            const texel = (2 * R) / G.preset.shadowMap;
            // orthonormal light basis (guard against dir ≈ straight down)
            _sRight.crossVectors(_sDir, _sUpRef);
            if (_sRight.lengthSq() < 1e-6) _sRight.set(1, 0, 0);
            _sRight.normalize();
            _sUp.crossVectors(_sRight, _sDir).normalize();
            const px = Math.round(_sTmp.dot(_sRight) / texel) * texel;
            const py = Math.round(_sTmp.dot(_sUp) / texel) * texel;
            const pz = _sTmp.dot(_sDir);
            _sTmp.set(0, 0, 0)
                .addScaledVector(_sRight, px)
                .addScaledVector(_sUp, py)
                .addScaledVector(_sDir, pz);
        }

        this.sunTarget.position.copy(_sTmp);
        this.sunTarget.updateMatrixWorld();
        this.sun.position.copy(_sTmp).addScaledVector(_sDir, -SHADOW_DIST);
    },

    /* Turn casting/receiving on across the finished scene. Called once, after
       every system has added its objects, so citizens/traffic/props are covered
       too. Sky, weather particles, water, wires and the far hills are skipped:
       they either can't sensibly cast (sprites/points/lines) or the cost is
       real and the payoff is nil at that distance. */
    finalizeShadows(scene) {
        if (!this.shadows) return;
        const SKIP = new Set(['sky', 'stars', 'water', 'hills', 'aurora', 'precip']);
        scene.traverse(o => {
            if (!o.isMesh && !o.isInstancedMesh) return;
            if (o.isSprite || o.isPoints || o.isLine || o.isLineSegments) return;
            if (SKIP.has(o.name)) return;
            if (o.userData.noShadow) return;
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            const m0 = mats[0];
            if (!m0) return;
            // Ground-ish and grass: receive only. Casting from a 30 000-instance
            // grass field costs a fortune and produces noise, not shape.
            const receiveOnly = o.userData.shadowReceiveOnly === true;
            // Unlit basic surfaces (signs, neon, glow plates) don't shade, so a
            // shadow on them reads as a dirt smear — cast, but don't receive.
            const unlit = mats.every(m => m && m.isMeshBasicMaterial);
            const seeThrough = mats.some(m => m && m.transparent && (m.opacity ?? 1) < 0.5);
            o.castShadow = !receiveOnly && !seeThrough;
            o.receiveShadow = !unlit;
        });
        this.shadowsReady = true;
    },

    // ── per-frame ────────────────────────────────────────────────────────────
    update(dt, t) {
        for (const a of this.animated) {
            switch (a.kind) {
                case 'turbine': a.obj.rotation.z += dt * a.speed * (1 + G.weatherIntensity * 2); break;
                case 'tokamak': a.obj.rotation.y += dt * 0.35; break;
                case 'dish': a.obj.rotation.z = Math.sin(t * 0.12 + a.phase) * 0.35; break;
                case 'trolley': a.obj.position.z = a.cz - 30 + Math.sin(t * 0.25 + a.phase) * 30; break;
                case 'fountain': a.obj.position.y = 6.5 + Math.sin(t * 2.2) * 0.35; break;
                case 'ship': a.obj.rotation.z = Math.sin(t * 0.5 + a.phase) * 0.02; a.obj.position.y = Math.sin(t * 0.7 + a.phase) * 0.8; break;
                case 'lighthouse': a.obj.material.color.setHSL(0.12, 0.8, 0.5 + Math.sin(t * 1.4) * 0.4); break;
            }
        }
        if (this.waterTex) {
            // Gentle dual-axis drift so the ocean shimmers from altitude
            this.waterTex.offset.x = t * 0.006;
            this.waterTex.offset.y = t * 0.0035 + Math.sin(t * 0.12) * 0.02;
        }
    }
};

function matVC() {
    if (!matVC._m) matVC._m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 18, specular: 0x222228 });
    return matVC._m;
}