/* ══════════════════════════════════════════════════════════════════════════
   HOLOMAP — a holographic galaxy of the AI industry, projected into the street
   in front of the player. Toggle with H.

   The 2D city renders this as a whole second WebGL context with OrbitControls.
   First person has one scene and one camera, so instead the galaxy is a real
   object in the world: a ~26 m holo-bubble anchored a few metres ahead, with
   the ASI singularity at its core, one nebula per lab orbiting it at a radius
   set by that lab's standing, and one star per model orbiting its nebula. You
   walk around it and aim the crosshair at a star to read it.

   Everything is built in "galaxy units" (the same numbers the 2D holomap uses,
   0..2600) inside a group scaled down to the bubble radius, so the layout maths
   can be ported straight across without rescaling every constant.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { DISTRICTS, LABS, SEED, ROSTER, STAGES, BM_M, getStage } from './data.js';

/* Kept from the original plate holomap: still the "you are here" city model
   that sits under the galaxy, and the parity harness drives it directly. */
export function buildHolomapGeometry(placements, scale = 0.04) {
    const parts = [];
    const base = new THREE.BoxGeometry(CITY_W * scale, 2, CITY_D * scale);
    parts.push(base);
    for (const p of placements || []) {
        if (!p || p.worldX == null) continue;
        const w = Math.max(4, (p.worldW || 40) * scale * 0.8);
        const d = Math.max(4, (p.worldD || 40) * scale * 0.8);
        const h = Math.max(3, (p.h || 40) * scale * 0.35);
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(p.worldX * scale, h / 2 + 1, p.worldZ * scale);
        parts.push(g);
    }
    // district markers
    for (const dist of DISTRICTS) {
        // approximate cell centre from col/row if present
        if (dist.col == null) continue;
        const cx = (dist.col - 2) * (800 + 200) * scale;
        const cz = (dist.row - 1.5) * (800 + 200) * scale;
        const m = new THREE.BoxGeometry(8, 10, 8);
        m.translate(cx, 12, cz);
        parts.push(m);
    }
    return mergeGeometries(parts, false);
}

/* ── geometry of the projection ───────────────────────────────────────────── */
const BUBBLE_R = 265;      // world units — a ~26 m hologram
const GALAXY_R = 2400;     // galaxy units the layout is authored in
const GSCALE = BUBBLE_R / GALAXY_R;
const ANCHOR_DIST = 430;   // how far ahead of the eye it materialises
const RE_ANCHOR = 900;     // wander this far and it follows you
const GOLDEN = 2.399963;

/* ── procedural textures (local: textures.js belongs to another module) ───── */
function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0.0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.2, 'rgba(255,255,255,0.8)');
    rg.addColorStop(0.5, 'rgba(255,255,255,0.2)');
    rg.addColorStop(1.0, 'rgba(255,255,255,0)');
    const t = new THREE.CanvasTexture(c);
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    t.needsUpdate = true;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function textTexture(title, sub, hex, big) {
    const W = 512, H = sub ? 160 : 96;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,0.9)';
    g.shadowBlur = 12;
    g.font = `700 ${big ? 60 : 44}px ui-monospace, monospace`;
    g.fillStyle = hex;
    g.fillText(String(title).slice(0, 24), W / 2, sub ? 56 : H / 2);
    if (sub) {
        g.font = '30px ui-monospace, monospace';
        g.fillStyle = '#9fb2c6';
        g.fillText(String(sub).slice(0, 34), W / 2, 116);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/* Lab brand colours reach into near-black (xAI); on a #04040e void that is an
   invisible star. Lift anything under the luminance floor toward slate. */
function displayHex(hex) {
    let h = hex || '#ffffff';
    if (h.length === 4 && h[0] === '#') h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    if (h[0] !== '#' || h.length !== 7) return '#ffffff';
    let r = parseInt(h.substr(1, 2), 16), g = parseInt(h.substr(3, 2), 16), b = parseInt(h.substr(5, 2), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const MIN = 130;
    if (lum >= MIN) return h;
    const t = Math.min(0.9, (MIN - lum) / MIN);
    r = Math.round(r + (226 - r) * t);
    g = Math.round(g + (232 - g) * t);
    b = Math.round(b + (240 - b) * t);
    const hx = v => ('0' + (v & 0xff).toString(16)).slice(-2);
    return '#' + hx(r) + hx(g) + hx(b);
}

/* Deterministic stand-in benchmarks for the extended roster, which ships names
   and a lab but no scores. Stable per name so the galaxy does not reshuffle. */
function hashOf(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000;
}

function avgBench(bm) {
    const vals = Object.entries(bm || {})
        .filter(([k, v]) => k !== 'ELO' && typeof v === 'number' && v > 0)
        .map(([, v]) => v);
    return vals.length ? vals.reduce((a, c) => a + c, 0) / vals.length : 0;
}

/** Flat model list from data.js, guarded against either table going missing. */
export function holomapModels() {
    const out = [];
    for (const m of (Array.isArray(SEED) ? SEED : [])) {
        const bm = m.benchmarks || {};
        out.push({
            id: m.id, name: m.name, lab: m.lab, desc: m.desc, rel: m.rel, ret: m.ret,
            phase: m.phase, bm, elo: bm.ELO || 0, avg: avgBench(bm), seeded: true
        });
    }
    for (const r of (Array.isArray(ROSTER) ? ROSTER : [])) {
        const h = hashOf(r.name);
        const avg = 46 + h * 38;
        out.push({
            id: 'r_' + r.name, name: r.name, lab: r.lab,
            desc: (r.os ? 'Open-weight' : 'Proprietary') + ' model in the extended roster.',
            rel: '2024-06-01', ret: null, phase: 'released',
            bm: {}, elo: 0, avg, seeded: false
        });
    }
    return out;
}

function stageOf(m) {
    try {
        if (typeof getStage === 'function') return getStage(m.rel, m.ret, m.phase);
    } catch (e) { /* fall through to the crude classifier */ }
    if (m.ret && Date.parse(m.ret) < Date.now()) return 'retired';
    if (m.phase === 'rumored') return 'rumored';
    if (m.phase === 'training') return 'kid';
    return 'adult';
}

function magnitudeOf(m, stg) {
    if (stg === 'retired') return 22;
    if (stg === 'rumored') return 16;
    if (stg === 'baby') return 20;
    if (stg === 'kid') return 24;
    const rel = m.rel ? Date.parse(m.rel) : Date.now();
    const months = (Date.now() - rel) / (1000 * 60 * 60 * 24 * 30);
    const recency = Math.max(0, 1 - months / 48);
    return 20 + (m.avg / 100) * 62 + recency * 14;
}

/* ── the mode ─────────────────────────────────────────────────────────────── */
export const Holomap = {
    active: false,
    group: null,
    mesh: null,               // the city plate (kept for snapshot parity)

    _built: false,
    _scene: null,
    _galaxy: null,            // scaled inner group holding everything in galaxy units
    _nebulae: null,
    _stars: null,             // [{ m, neb, mag, retired, frontier, orbitR, orbitSpeed, angle, hex, pos }]
    _starMesh: null,
    _starGlow: null,
    _tethers: null,
    _asi: null,
    _labels: null,
    _anchor: null,
    _spin: 0,
    _t: 0,
    _ray: null,
    _ndc: null,
    _hover: null,
    _tip: null,
    _hud: null,

    init(scene) {
        this._scene = scene;
        // Empty shell now, contents on first H — a galaxy is not worth building
        // for a player who never opens it.
        this.group = new THREE.Group();
        this.group.visible = false;
        scene.add(this.group);

        this._ray = new THREE.Raycaster();
        this._ndc = new THREE.Vector2(0, 0);

        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            if (e.code === 'KeyH' && !e.repeat) this.toggle();
        });
        // Aiming works with the crosshair under pointer lock; free-mouse players
        // get the cursor instead, so track both and pick per frame.
        document.addEventListener('mousemove', e => {
            if (!this.active) return;
            this._ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (G.orbitMode) return;
        this.active = true;
        G.holomapMode = true;
        try { this._build(); } catch (e) { console.warn('[holomap] build failed', e); }
        this._anchor = null;                 // materialise wherever the player stands
        this.group.visible = true;
        this._showDom(true);
        G.ui?.banner('🌌 HOLOMAP', `${(this._stars || []).length} models · ${(this._nebulae || []).length} labs · aim to inspect · H to close`);
    },

    exit() {
        this.active = false;
        G.holomapMode = false;
        this._hover = null;
        if (this.group) this.group.visible = false;
        this._showDom(false);
    },

    /* ── build ────────────────────────────────────────────────────────────── */
    _build() {
        if (this._built) return;
        this._built = true;

        this._galaxy = new THREE.Group();
        this._galaxy.scale.setScalar(GSCALE);
        this.group.add(this._galaxy);

        this._glowTex = glowTexture();
        this._labels = [];

        this._buildBubble();
        this._buildBackdrop();
        this._buildASI();
        this._buildNebulae();
        this._buildStars();
        this._buildCityPlate();
        this._buildDom();
    },

    /* The void the galaxy sits in. A back-faced shell gives the starfield a
       black sky without touching scene.background, which weather.js owns.

       It draws first among transparents with depthTest OFF and depthWrite ON:
       that stamps the far hemisphere's depth over whatever the city already
       wrote, so no tower pokes through the void, and every galaxy object after
       it still depth-sorts normally against the shell and against each other.
       The price is that the hologram is never occluded by the street — correct
       for something that is half UI. */
    _buildBubble() {
        const inner = new THREE.Mesh(
            new THREE.SphereGeometry(GALAXY_R * 1.32, 32, 24),
            new THREE.MeshBasicMaterial({
                /* Fully opaque, and NOT flagged transparent. At opacity 0.9 a
                   tenth of the night city bled through the void, and because
                   every galaxy layer above it is additive, those lit windows
                   stacked with the nebula haze and blew the whole hologram out
                   to white. The shell is the thing that makes the bubble read
                   as a window into somewhere else — it has to actually occlude. */
                color: 0x04040e, side: THREE.BackSide,
                depthTest: false, depthWrite: true
            })
        );
        inner.renderOrder = -10;
        this._galaxy.add(inner);

        // Rim: a front-faced additive shell reads as the containment field.
        const rim = new THREE.Mesh(
            new THREE.SphereGeometry(GALAXY_R * 1.34, 32, 24),
            new THREE.MeshBasicMaterial({
                color: 0x22d3ee, wireframe: true,
                transparent: true, opacity: 0.055, depthWrite: false
            })
        );
        this._galaxy.add(rim);
        this._rim = rim;

        // Equatorial deck ring — the projector plane.
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(GALAXY_R * 1.05, GALAXY_R * 0.008, 6, 96),
            new THREE.MeshBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.5, depthWrite: false })
        );
        ring.rotation.x = Math.PI / 2;
        this._galaxy.add(ring);
    },

    _buildBackdrop() {
        // Two starfield shells: dense + faint, sparse + bright.
        const shell = (n, spread, size, opacity, palette) => {
            const pos = new Float32Array(n * 3);
            const col = new Float32Array(n * 3);
            const c = new THREE.Color();
            for (let i = 0; i < n; i++) {
                // Rejection-free spherical shell: normalise a gaussian-ish vector.
                const u = Math.random() * 2 - 1;
                const th = Math.random() * Math.PI * 2;
                const r = spread * (0.55 + Math.random() * 0.45);
                const s = Math.sqrt(1 - u * u);
                pos[i * 3] = Math.cos(th) * s * r;
                pos[i * 3 + 1] = u * r * 0.7;
                pos[i * 3 + 2] = Math.sin(th) * s * r;
                c.set(palette[(i * 7) % palette.length]);
                col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            const p = new THREE.Points(g, new THREE.PointsMaterial({
                /* GSCALE, explicitly. The galaxy group is scaled down by
                   GSCALE, but PointsMaterial.size is a WORLD-space size and is
                   not affected by an ancestor's scale — so sizes authored in
                   galaxy units rendered ~90x too big and the bubble was a
                   white blob of overlapping sprites. */
                size: size * GSCALE, sizeAttenuation: true, vertexColors: true,
                transparent: true, opacity, depthWrite: false,
                blending: THREE.AdditiveBlending, alphaTest: 0.02
            }));
            this._galaxy.add(p);
            return p;
        };
        shell(1400, GALAXY_R * 1.25, 14, 0.5, ['#99a8ff', '#ffe6b0', '#ffb3cc', '#cfe4ff']);
        shell(260, GALAXY_R * 1.15, 30, 0.75, ['#cfe0ff', '#fffbe6', '#ffcc88', '#e0b3ff']);

        // Nebula haze — one additive point cloud for every cosmic cloud, so the
        // whole backdrop stays at two extra draw calls.
        const CLOUDS = [
            ['#7744cc', -1500, 400, -1000], ['#3366bb', 1400, -200, -1750],
            ['#aa3388', -750, 150, 1500], ['#2288aa', 2000, 250, 750],
            ['#6644aa', 100, -250, -2250], ['#4477aa', -2250, -100, 600],
            ['#993366', 900, 450, 2250], ['#5533aa', -1250, -350, -900]
        ];
        const N = 26;
        const pos = new Float32Array(CLOUDS.length * N * 3);
        const col = new Float32Array(CLOUDS.length * N * 3);
        const c = new THREE.Color();
        let k = 0;
        for (const [hex, cx, cy, cz] of CLOUDS) {
            c.set(hex);
            for (let i = 0; i < N; i++) {
                pos[k * 3] = cx + (Math.random() - 0.5) * 900;
                pos[k * 3 + 1] = cy + (Math.random() - 0.5) * 400;
                pos[k * 3 + 2] = cz + (Math.random() - 0.5) * 900;
                col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
                k++;
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this._galaxy.add(new THREE.Points(g, new THREE.PointsMaterial({
            /* Additive points this large stack dozens deep when the player
             stands beside the bubble, and the whole hologram saturates to a
             white blob. Halved size and opacity keeps the nebula reading as
             haze from arm's length as well as from across the street. */
            size: 400 * GSCALE, map: this._glowTex, sizeAttenuation: true, vertexColors: true,
            transparent: true, opacity: 0.16, depthWrite: false,
            blending: THREE.AdditiveBlending
        })));
    },

    _buildASI() {
        const grp = new THREE.Group();
        grp.add(new THREE.Mesh(
            new THREE.SphereGeometry(60, 20, 16),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        ));
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this._glowTex, color: 0xa78bfa, transparent: true,
            opacity: 0.34, depthWrite: false, blending: THREE.AdditiveBlending
        }));
        glow.scale.set(460, 460, 1);
        grp.add(glow);
        this._asiRings = [];
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(120 + i * 40, 2.5, 8, 64),
                new THREE.MeshBasicMaterial({
                    color: 0xc4b5fd, transparent: true,
                    opacity: 0.42 - i * 0.1, depthWrite: false, blending: THREE.AdditiveBlending
                })
            );
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = i * 0.2;
            grp.add(ring);
            this._asiRings.push(ring);
        }
        this._galaxy.add(grp);
        this._asi = grp;

        this._addLabel(new THREE.Vector3(0, 300, 0), 'ASI', 'Artificial Superintelligence', '#c4b5fd', 640, true);

        // The five things standing between the labs and the core.
        const BARRIERS = ['Compute Costs', 'Energy Bottleneck', 'Alignment Problem', 'Data Scarcity', 'Regulation'];
        this._barriers = BARRIERS.map((txt, i) => {
            const tex = textTexture(txt, '', '#f87171', false);
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, transparent: true, opacity: 0.55, depthWrite: false
            }));
            spr.scale.set(520, 98, 1);
            this._galaxy.add(spr);
            this._labels.push({ spr, tex });
            return { spr, idx: i, n: BARRIERS.length };
        });
    },

    _addLabel(posV, title, sub, hex, width, big) {
        const tex = textTexture(title, sub, hex, big);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tex, transparent: true, opacity: 0.95, depthWrite: false
        }));
        const h = width * ((sub ? 160 : 96) / 512);
        spr.scale.set(width, h, 1);
        spr.position.copy(posV);
        this._galaxy.add(spr);
        this._labels.push({ spr, tex });
        return spr;
    },

    /* Labs are ranked by roster size, top ELO and average benchmark, then laid
       out on a golden-angle spiral: the closer to the ASI, the stronger. */
    _buildNebulae() {
        const models = holomapModels();
        this._models = models;
        const count = {}, maxElo = {}, sumAvg = {};
        for (const m of models) {
            if (!m.lab || !LABS || !LABS[m.lab]) continue;
            count[m.lab] = (count[m.lab] || 0) + 1;
            if (m.elo > (maxElo[m.lab] || 0)) maxElo[m.lab] = m.elo;
            sumAvg[m.lab] = (sumAvg[m.lab] || 0) + m.avg;
        }
        const keys = Object.keys(count);
        if (!keys.length) { this._nebulae = []; return; }
        let maxCount = 1;
        for (const k of keys) if (count[k] > maxCount) maxCount = count[k];
        const score = {};
        for (const k of keys) {
            score[k] = (count[k] / maxCount) * 40 + (maxElo[k] || 0) / 50 + (sumAvg[k] / count[k]) * 0.3;
        }
        keys.sort((a, b) => score[b] - score[a]);

        const innerR = 420;
        const outerR = GALAXY_R * 0.92;
        const hi = score[keys[0]] || 1;
        const lo = score[keys[keys.length - 1]] || 0;
        const range = Math.max(hi - lo, 1);

        const cloudPos = [];
        const cloudCol = [];
        const c = new THREE.Color();

        this._nebulae = keys.map((key, i) => {
            const t = (score[key] - lo) / range;
            let orbitR = outerR - t * (outerR - innerR);
            orbitR += Math.sin(i * 7.3) * 0.07 * orbitR;
            const a = i * GOLDEN;
            const hex = displayHex((LABS[key] || {}).color);
            const n = {
                key, name: (LABS[key] || {}).name || key, hex,
                baseAngle: a, orbitR, yOffset: Math.sin(i * 3.7) * 60,
                count: count[key], score: score[key],
                pos: new THREE.Vector3(Math.cos(a) * orbitR, Math.sin(i * 3.7) * 60, Math.sin(a) * orbitR),
                group: new THREE.Group()
            };
            n.group.position.copy(n.pos);
            this._galaxy.add(n.group);
            n.label = this._addLabel(new THREE.Vector3(), n.name, `${n.count} models`, hex, 560, false);

            // Local haze puff, folded into the shared cloud buffer.
            c.set(hex);
            const spread = Math.min(360, 110 + n.count * 12);
            for (let v = 0; v < 10; v++) {
                cloudPos.push(0, 0, 0);                       // filled per frame from n.pos
                cloudCol.push(c.r, c.g, c.b);
                n.cloudIdx = n.cloudIdx || [];
                n.cloudIdx.push(cloudPos.length / 3 - 1);
                n.cloudOff = n.cloudOff || [];
                n.cloudOff.push(new THREE.Vector3(
                    (Math.random() - 0.5) * spread,
                    (Math.random() - 0.5) * spread * 0.6,
                    (Math.random() - 0.5) * spread
                ));
            }
            return n;
        });

        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(cloudPos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(cloudCol, 3));
        this._labClouds = new THREE.Points(g, new THREE.PointsMaterial({
            size: 320 * GSCALE, map: this._glowTex, sizeAttenuation: true, vertexColors: true,
            transparent: true, opacity: 0.22, depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this._labClouds.frustumCulled = false;
        this._galaxy.add(this._labClouds);
    },

    _buildStars() {
        const nebByKey = new Map((this._nebulae || []).map(n => [n.key, n]));
        const models = (this._models || []).filter(m => nebByKey.has(m.lab));
        const stars = [];

        // Frontier = the best living model each lab has shipped. It sits at the
        // nebula core instead of orbiting, and it is the one that gets a name.
        const frontier = {};
        for (const m of models) {
            const stg = stageOf(m);
            const s = (stg !== 'retired' ? 1000 : 0) + m.elo + m.avg;
            if (!frontier[m.lab] || s > frontier[m.lab].s) frontier[m.lab] = { id: m.id, s };
        }

        const placed = {};
        for (const m of models) {
            const neb = nebByKey.get(m.lab);
            const stg = stageOf(m);
            const retired = stg === 'retired';
            const isFrontier = frontier[m.lab] && frontier[m.lab].id === m.id;
            let orbitR = 0, angle = 0;
            if (!isFrontier) {
                placed[m.lab] = (placed[m.lab] || 0) + 1;
                const idx = placed[m.lab];
                orbitR = 150 + Math.sqrt(idx) * 105;
                angle = idx * GOLDEN;
            }
            stars.push({
                m, neb, stg, retired, isFrontier,
                mag: magnitudeOf(m, stg) * (isFrontier ? 1.5 : 1),
                orbitR, angle,
                orbitSpeed: retired ? 0 : (isFrontier ? 0 : 0.10 + (m.name.length % 5) * 0.035),
                bob: (stars.length % 7) * 1.1,
                hex: retired ? '#7d8ea3' : displayHex((LABS[m.lab] || {}).color),
                pos: new THREE.Vector3()
            });
        }
        this._stars = stars;
        if (!stars.length) return;

        const n = stars.length;
        const geo = new THREE.SphereGeometry(1, 12, 10);
        const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.98
        }), n);
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        const c = new THREE.Color();
        for (let i = 0; i < n; i++) im.setColorAt(i, c.set(stars[i].hex));
        this._galaxy.add(im);
        this._starMesh = im;

        // Aura + hit target in one: the glow cloud is what the crosshair
        // raycasts against, because Points support a pick threshold and a
        // 2-unit sphere at ten metres does not.
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            c.set(stars[i].hex);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
        this._starGlow = new THREE.Points(gg, new THREE.PointsMaterial({
            size: 300, map: this._glowTex, sizeAttenuation: true, vertexColors: true,
            transparent: true, opacity: 0.42, depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this._starGlow.frustumCulled = false;
        this._galaxy.add(this._starGlow);

        // Tethers from each nebula core to its orbiting stars.
        const tp = new Float32Array(n * 6);
        const tc = new Float32Array(n * 6);
        for (let i = 0; i < n; i++) {
            c.set(stars[i].hex);
            for (let k = 0; k < 2; k++) {
                tc[i * 6 + k * 3] = c.r; tc[i * 6 + k * 3 + 1] = c.g; tc[i * 6 + k * 3 + 2] = c.b;
            }
        }
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
        tg.setAttribute('color', new THREE.BufferAttribute(tc, 3));
        this._tethers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false
        }));
        this._tethers.frustumCulled = false;
        this._galaxy.add(this._tethers);

        // Name plates only for frontier models — 50 billboards of text would
        // out-cost the entire galaxy.
        for (const s of stars) {
            if (!s.isFrontier) continue;
            s.label = this._addLabel(new THREE.Vector3(), s.m.name, '', s.hex, 420, false);
        }
    },

    /* "You are here": the old district plate, parked under the galaxy. */
    _buildCityPlate() {
        let geo;
        try { geo = buildHolomapGeometry(G.placements, 0.035); } catch (e) { geo = null; }
        if (!geo) geo = new THREE.BoxGeometry(80, 4, 60);
        this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
            color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.4, depthWrite: false
        }));
        // The plate is authored in world units, the galaxy in galaxy units.
        this.mesh.scale.setScalar(1 / GSCALE * 0.16);
        this.mesh.position.set(0, -GALAXY_R * 0.75, 0);
        this._galaxy.add(this.mesh);
        this._addLabel(new THREE.Vector3(0, -GALAXY_R * 0.62, 0), 'SINGULARITY CITY', 'you are here', '#22d3ee', 620, false);
    },

    /* ── DOM (tooltip + HUD) ──────────────────────────────────────────────── */
    _buildDom() {
        const mk = (id, css) => {
            const el = document.createElement('div');
            el.id = id;
            el.style.cssText = css;
            document.body.appendChild(el);
            return el;
        };
        this._tip = mk('holoTip', [
            'position:fixed', 'z-index:61', 'pointer-events:none', 'display:none',
            'max-width:290px', 'transform:translate(-50%,-100%)',
            'font:11px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace',
            'color:#cbd5e1', 'background:rgba(6,8,24,.93)',
            'border:1px solid rgba(167,139,250,.45)', 'border-radius:5px',
            'padding:9px 12px', 'box-shadow:0 10px 30px rgba(0,0,0,.6)'
        ].join(';'));
        this._hud = mk('holoHud', [
            'position:fixed', 'left:18px', 'bottom:22px', 'z-index:60',
            'pointer-events:none', 'display:none',
            'font:11px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace',
            'color:#94a3b8', 'background:rgba(6,8,24,.86)',
            'border:1px solid rgba(167,139,250,.32)', 'border-left:2px solid #a78bfa',
            'border-radius:4px', 'padding:9px 13px', 'min-width:186px',
            'box-shadow:0 8px 26px rgba(0,0,0,.55)'
        ].join(';'));
    },

    _showDom(on) {
        if (this._hud) {
            this._hud.style.display = on ? 'block' : 'none';
            if (on) {
                const alive = (this._stars || []).filter(s => !s.retired).length;
                this._hud.innerHTML =
                    `<div style="color:#a78bfa;font-weight:700;letter-spacing:2px">HOLOMAP · AI GALAXY</div>
                     <div style="height:1px;background:rgba(167,139,250,.3);margin:6px 0"></div>
                     <div>${(this._stars || []).length} model stars · <b style="color:#4ade80">${alive} active</b></div>
                     <div>${(this._nebulae || []).length} lab nebulae orbiting the ASI core</div>
                     <div style="color:#475569;margin-top:5px">aim at a star · H to close</div>`;
            }
        }
        if (this._tip && !on) this._tip.style.display = 'none';
    },

    /* ── frame ────────────────────────────────────────────────────────────── */
    update(dt) {
        if (!this.active || !this.group) return;
        const cam = G.camera;
        if (!cam) return;
        this._t += dt;

        // Anchor: project it once, ahead of the eye, and leave it in the world
        // so you can walk around it. Re-project only if the player wanders off.
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
        fwd.normalize();
        if (!this._anchor || this._anchor.distanceTo(cam.position) > RE_ANCHOR) {
            this._anchor = cam.position.clone().add(fwd.multiplyScalar(ANCHOR_DIST));
            this._anchor.y = cam.position.y + BUBBLE_R * 0.22;
        }
        this.group.position.copy(this._anchor);

        if (!this._built || !this._galaxy) return;

        this._spin += dt * 0.045;
        this._galaxy.rotation.y = this._spin;

        // Nebulae keep Kepler-ish time: the closer to the core, the faster.
        const cloudAttr = this._labClouds?.geometry.attributes.position;
        for (const n of (this._nebulae || [])) {
            const speed = 0.024 * (1200 / Math.max(n.orbitR, 400));
            const a = n.baseAngle + this._t * speed;
            n.pos.set(Math.cos(a) * n.orbitR, n.yOffset, Math.sin(a) * n.orbitR);
            n.group.position.copy(n.pos);
            if (n.label) n.label.position.set(n.pos.x, n.pos.y + 300, n.pos.z);
            if (cloudAttr && n.cloudIdx) {
                for (let i = 0; i < n.cloudIdx.length; i++) {
                    const k = n.cloudIdx[i], o = n.cloudOff[i];
                    cloudAttr.array[k * 3] = n.pos.x + o.x;
                    cloudAttr.array[k * 3 + 1] = n.pos.y + o.y;
                    cloudAttr.array[k * 3 + 2] = n.pos.z + o.z;
                }
            }
        }
        if (cloudAttr) cloudAttr.needsUpdate = true;

        for (let i = 0; i < (this._asiRings || []).length; i++) {
            const r = this._asiRings[i];
            r.rotation.x = Math.PI / 2 + Math.sin(this._t + i) * 0.2;
            r.rotation.z += dt * 0.6 * (i % 2 === 0 ? 1 : -1);
        }
        for (const b of (this._barriers || [])) {
            const a = this._t * 0.25 + b.idx * (Math.PI * 2 / b.n);
            b.spr.position.set(Math.cos(a) * 260, 20, Math.sin(a) * 260);
            b.spr.material.opacity = 0.25 + Math.abs(Math.sin(a)) * 0.4;
        }

        this._stepStars(dt);
        this._pick();
    },

    _stepStars(dt) {
        const stars = this._stars;
        if (!stars || !stars.length || !this._starMesh) return;
        const d = new THREE.Object3D();
        const gp = this._starGlow?.geometry.attributes.position;
        const tp = this._tethers?.geometry.attributes.position;
        const hover = this._hover;
        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            s.angle += s.orbitSpeed * dt;
            const n = s.neb.pos;
            s.pos.set(
                n.x + Math.cos(s.angle) * s.orbitR,
                n.y + Math.sin(s.angle + s.bob) * 30,
                n.z + Math.sin(s.angle) * s.orbitR
            );
            const pulse = s.isFrontier ? 1 + Math.sin(this._t * 2 + s.bob) * 0.08 : 1;
            const m = s.mag * pulse * (hover === s ? 1.7 : 1);
            d.position.copy(s.pos);
            d.scale.set(m, m, m);
            d.rotation.set(0, 0, 0);
            d.updateMatrix();
            this._starMesh.setMatrixAt(i, d.matrix);
            if (gp) { gp.array[i * 3] = s.pos.x; gp.array[i * 3 + 1] = s.pos.y; gp.array[i * 3 + 2] = s.pos.z; }
            if (tp) {
                tp.array[i * 6] = n.x; tp.array[i * 6 + 1] = n.y; tp.array[i * 6 + 2] = n.z;
                tp.array[i * 6 + 3] = s.pos.x; tp.array[i * 6 + 4] = s.pos.y; tp.array[i * 6 + 5] = s.pos.z;
            }
            if (s.label) s.label.position.set(s.pos.x, s.pos.y + s.mag * 2.4 + 90, s.pos.z);
        }
        this._starMesh.instanceMatrix.needsUpdate = true;
        if (gp) gp.needsUpdate = true;
        if (tp) tp.needsUpdate = true;
    },

    /* ── picking ──────────────────────────────────────────────────────────── */
    _pick() {
        const tip = this._tip;
        if (!tip || !this._starGlow || !this._ray) return;
        const cam = G.camera;
        // Under pointer lock the crosshair IS the cursor, so aim from screen
        // centre; otherwise follow the real mouse.
        const nd = G.player?.locked ? { x: 0, y: 0 } : this._ndc;
        this._ray.setFromCamera(nd, cam);
        /* The pick threshold is compared in the Points' local space, and the
           galaxy group scales that space down by GSCALE — so ask for a ~4 world
           unit grab radius in galaxy units. */
        this._ray.params.Points.threshold = 4 / GSCALE;
        const hits = this._ray.intersectObject(this._starGlow, false);
        const s = hits.length ? this._stars[hits[0].index] : null;
        this._hover = s;
        if (!s) { tip.style.display = 'none'; return; }

        const v = s.pos.clone().applyMatrix4(this._galaxy.matrixWorld).project(cam);
        if (v.z > 1) { tip.style.display = 'none'; return; }
        tip.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
        tip.style.top = ((v.y * -0.5 + 0.5) * innerHeight - 18) + 'px';
        tip.style.display = 'block';
        tip.style.borderColor = s.hex;
        if (this._tipId !== s.m.id) {
            this._tipId = s.m.id;
            tip.innerHTML = this._tipHtml(s);
        }
    },

    _tipHtml(s) {
        const m = s.m;
        const lab = (LABS && LABS[m.lab]) || { name: m.lab || '—' };
        const stage = (STAGES && STAGES[s.stg]) || null;
        const rows = [];
        rows.push(`<div style="font-weight:700;font-size:13px;color:${s.hex}">${m.name}</div>`);
        rows.push(`<div style="color:${s.hex};opacity:.8">${lab.name}${s.isFrontier ? ' · ★ FRONTIER' : ''}</div>`);
        const bits = [stage ? (stage.label || s.stg) : s.stg];
        if (m.elo) bits.push(`<span style="color:#4ade80">ELO ${Math.round(m.elo)}</span>`);
        if (m.avg) bits.push(`avg ${m.avg.toFixed(0)}%`);
        rows.push(`<div style="color:#7d8ea3;margin:3px 0">${bits.join(' · ')}</div>`);
        const keys = Object.keys(m.bm || {}).filter(k => k !== 'ELO').slice(0, 6);
        if (keys.length) {
            rows.push(keys.map(k => {
                const meta = (BM_M && BM_M[k]) || { l: k, c: '#8899aa' };
                const v = Math.max(0, Math.min(100, m.bm[k]));
                return `<div style="display:flex;align-items:center;gap:6px">
                    <span style="width:64px;color:#64748b">${meta.l}</span>
                    <span style="flex:1;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">
                      <span style="display:block;height:4px;width:${v}%;background:${meta.c}"></span></span>
                    <span style="width:26px;text-align:right">${v.toFixed(0)}</span></div>`;
            }).join(''));
        }
        if (m.desc) rows.push(`<div style="color:#64748b;margin-top:4px">${m.desc}</div>`);
        return rows.join('');
    },

    /* ── teardown ─────────────────────────────────────────────────────────── */
    dispose() {
        if (this.active) this.exit();
        if (!this._built) return;
        this.group.traverse(o => {
            o.geometry?.dispose?.();
            const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
            for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
        });
        this._glowTex?.dispose?.();
        if (this.group.parent) this.group.parent.remove(this.group);
        this._tip?.remove?.();
        this._hud?.remove?.();
        this.group = null; this._galaxy = null; this._tip = null; this._hud = null;
        this._stars = null; this._nebulae = null; this._labels = null;
        this._starMesh = null; this._starGlow = null; this._tethers = null;
        this.mesh = null;
        this._built = false;
    },

    snapshot() {
        return {
            active: this.active,
            visible: !!(this.group && this.group.visible),
            hasMesh: !!this.mesh,
            stars: (this._stars || []).length,
            nebulae: (this._nebulae || []).length,
            hover: this._hover ? this._hover.m.id : null
        };
    }
};
