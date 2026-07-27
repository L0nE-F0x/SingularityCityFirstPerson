/* ══════════════════════════════════════════════════════════════════════════
   X-RAY MODE — data-spine diagnostic overlay. Toggle with X, cycle the metric
   with B while it is up.

   The 2D city's x-ray strips the art away and redraws every building as a neon
   data card: population heat, a benchmark bar, a model-count badge, packets
   flowing along inter-lab links. In 3D we do not need to redraw anything — the
   buildings are already instanced boxes with a per-instance colour attribute,
   so the metric IS the city. We overwrite `instanceColor`, float a bar over
   each roof, and hang the relationship graph in the air above the streets.

   The one hard rule: the per-instance colours we overwrite are the facade tints
   world.js computed at build time and never recomputes. They are captured
   verbatim on first activation and memcpy'd back on exit — anything less and
   the city stays radioactive after you press X again.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, CITY_W, CITY_D } from './state.js';
import { LABS, SEED, ROSTER } from './data.js';

/* ── wireframe pass (unchanged contract — parity harness drives this) ─────── */
export function applyXray(root, on) {
    let count = 0;
    root.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
            if (!m) continue;
            // Overlay geometry we authored is already diagrammatic; wireframing
            // a bar chart just turns it into noise.
            if (m.userData && m.userData._xraySkip) continue;
            if (on) {
                if (m.userData._xrayPrev == null) m.userData._xrayPrev = m.wireframe;
                m.wireframe = true;
                count++;
            } else if (m.userData._xrayPrev != null) {
                m.wireframe = m.userData._xrayPrev;
                delete m.userData._xrayPrev;
                count++;
            }
        }
    });
    return count;
}

/* ── metric registry ──────────────────────────────────────────────────────── */
export const XRAY_METRICS = [
    { id: 'pop',   label: 'POPULATION', hint: 'live citizens routed to each building' },
    { id: 'bench', label: 'BENCHMARK',  hint: 'frontier score of the owning lab' },
    { id: 'lab',   label: 'LAB',        hint: 'ownership across the industry' }
];

/* ── procedural textures (kept local: textures.js belongs to another module) ─ */
function packetTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0.0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    rg.addColorStop(1.0, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function labelTexture(title, sub, hex) {
    const W = 512, H = 128;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(2,8,14,0.72)';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = hex;
    g.globalAlpha = 0.75;
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    g.globalAlpha = 1;
    g.font = 'bold 40px ui-monospace, monospace';
    g.fillStyle = hex;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(title).slice(0, 26), W / 2, 44);
    g.font = '28px ui-monospace, monospace';
    g.fillStyle = '#7d8ea3';
    g.fillText(String(sub).slice(0, 34), W / 2, 92);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/* ── colour helpers ───────────────────────────────────────────────────────── */
const HEAT = ['#1e3a8a', '#0891b2', '#22c55e', '#facc15', '#f97316', '#ef4444'];

function ramp(t) {
    const x = Math.max(0, Math.min(1, t)) * (HEAT.length - 1);
    const i = Math.min(HEAT.length - 2, Math.floor(x));
    const a = new THREE.Color(HEAT[i]);
    const b = new THREE.Color(HEAT[i + 1]);
    return a.lerp(b, x - i);
}

function labHexOf(b) {
    if (b && b.lab && LABS && LABS[b.lab] && LABS[b.lab].color) return LABS[b.lab].color;
    const id = (b && b.id) || '';
    const type = (b && b.type) || '';
    if (type === 'robotics') return '#f59e0b';
    if (type === 'longevity') return '#22c55e';
    if (type === 'backbone') return '#06b6d4';
    if (type === 'court') return '#ef4444';
    if (type === 'jail') return '#ea580c';
    if (type === 'university') return '#8b5cf6';
    if (type === 'launchpad') return '#f97316';
    if (id.startsWith('dc_') || id.startsWith('fab_')) return '#3b82f6';
    if (id.startsWith('power_')) return '#fbbf24';
    if (id.startsWith('port_')) return '#06b6d4';
    if (id.startsWith('vcrow_')) return '#10b981';
    if (id.startsWith('house_')) return '#a855f7';
    if (id.startsWith('res_')) return '#64748b';
    return '#2f6f57';
}

/* ── static industry aggregates (guarded: data.js keys move around) ───────── */
function labAggregates() {
    const now = Date.now();
    const pop = {};
    const best = {};
    const add = (lab) => { if (lab) pop[lab] = (pop[lab] || 0) + 1; };
    for (const m of (Array.isArray(SEED) ? SEED : [])) {
        if (m.ret && Date.parse(m.ret) <= now) continue;
        add(m.lab);
        const bm = m.benchmarks || {};
        let score = 0;
        if (typeof bm.ELO === 'number' && bm.ELO > 0) {
            score = (bm.ELO - 900) / 450;                     // 900..1350 → 0..1
        } else {
            const vals = Object.entries(bm)
                .filter(([k, v]) => k !== 'ELO' && typeof v === 'number' && v > 0)
                .map(([, v]) => v);
            if (vals.length) score = (vals.reduce((a, c) => a + c, 0) / vals.length) / 100;
        }
        if (m.lab && score > (best[m.lab] || 0)) best[m.lab] = score;
    }
    for (const r of (Array.isArray(ROSTER) ? ROSTER : [])) add(r.lab);
    return { pop, best };
}

/* ── the mode ─────────────────────────────────────────────────────────────── */
export const XrayMode = {
    active: false,
    meshesTouched: 0,
    metricIdx: 0,

    _built: false,
    group: null,
    _recs: null,           // Map<buildingId, record>
    _recList: null,
    _binds: null,          // [{ mesh, saved:Float32Array, recs:Array<record|null> }]
    _bars: null,
    _links: null,
    _packets: null,
    _packetArcs: null,
    _labels: null,
    _scan: null,
    _hud: null,
    _savedEnv: null,
    _popT: 0,
    _scanY: 0,
    _maxPop: 1,
    _maxFloors: 1,

    get metric() { return XRAY_METRICS[this.metricIdx].id; },

    init() {
        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            if (e.code === 'KeyX' && !e.repeat) this.toggle();
            // B only means anything while the overlay is up, so it cannot
            // collide with anything the city binds at street level.
            else if (e.code === 'KeyB' && !e.repeat && this.active) this.cycleMetric();
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (G.orbitMode || G.holomapMode) return;
        this.active = true;
        G.xrayMode = true;
        this._dimSave();
        try { this._build(); } catch (e) { console.warn('[xray] build failed', e); }
        this.meshesTouched = applyXray(G.scene, true);
        this._refreshPop();
        this._paint();
        this._dimApply();
        if (this.group) this.group.visible = true;
        this._showHud(true);
        G.ui?.banner('🔬 X-RAY', `${XRAY_METRICS[this.metricIdx].label} · B cycles metric · X exits`);
    },

    exit() {
        this.active = false;
        G.xrayMode = false;
        this._restoreColors();
        this._dimRestore();
        applyXray(G.scene, false);
        if (this.group) this.group.visible = false;
        this._showHud(false);
        G.ui?.banner('🏙️ Solid view', 'x-ray off');
    },

    cycleMetric() {
        this.metricIdx = (this.metricIdx + 1) % XRAY_METRICS.length;
        this._paint();
        this._syncHud();
        G.ui?.banner('🔬 X-RAY', `${XRAY_METRICS[this.metricIdx].label} — ${XRAY_METRICS[this.metricIdx].hint}`);
    },

    /* ── build (lazy, once) ───────────────────────────────────────────────── */
    _build() {
        if (this._built) return;
        this._built = true;
        this.group = new THREE.Group();
        this.group.visible = false;
        this.group.renderOrder = 6;
        G.scene?.add(this.group);

        this._buildRecords();
        this._bindInstances();
        this._buildGrid();
        this._buildBars();
        this._buildLinks();
        this._buildPackets();
        this._buildLabels();
        this._buildScanPlane();
        this._buildHud();
    },

    _buildRecords() {
        const { pop: labPop, best } = labAggregates();
        const recs = new Map();
        const list = [];
        let maxFloors = 1;
        for (const p of (G.placements || [])) {
            if (!p || p.x == null) continue;
            const b = p.b || G.bldById?.[p.id] || {};
            const hex = labHexOf(b);
            const lab = b.lab || null;
            const rec = {
                id: p.id || b.id || ('p' + list.length),
                name: b.name || p.id || '—',
                lab,
                x: p.x, z: p.z,
                h: p.h || b.worldH || 40,
                floors: p.floors || b.worldFloors || 1,
                hex,
                color: new THREE.Color(hex),
                models: lab ? (labPop[lab] || 0) : 0,
                bench: lab ? Math.max(0, Math.min(1, best[lab] || 0)) : 0,
                pop: 0
            };
            if (rec.floors > maxFloors) maxFloors = rec.floors;
            recs.set(rec.id, rec);
            list.push(rec);
        }
        this._maxFloors = maxFloors;
        this._recs = recs;
        this._recList = list;
    },

    /* world.js does not record which instance is which building, so recover the
       mapping from the instance matrices. Setback masses share their base's
       footprint, which is exactly what we want: the whole tower recolours. */
    _bindInstances() {
        const binds = [];
        const meshes = G.world?.bldMeshes || [];
        const key = (x, z) => `${Math.round(x / 8)}:${Math.round(z / 8)}`;
        const byPos = new Map();
        for (const rec of (this._recList || [])) byPos.set(key(rec.x, rec.z), rec);

        const m4 = new THREE.Matrix4();
        const v = new THREE.Vector3();
        for (const mesh of meshes) {
            if (!mesh || !mesh.isInstancedMesh || !mesh.instanceColor) continue;
            const n = mesh.count;
            const recs = new Array(n);
            for (let i = 0; i < n; i++) {
                mesh.getMatrixAt(i, m4);
                v.setFromMatrixPosition(m4);
                recs[i] = byPos.get(key(v.x, v.z)) || null;
            }
            binds.push({
                mesh,
                saved: Float32Array.from(mesh.instanceColor.array),
                recs
            });
        }
        this._binds = binds;
    },

    _buildGrid() {
        const step = 200;
        const hw = CITY_W / 2 + 300, hd = CITY_D / 2 + 300;
        const pts = [];
        for (let x = -hw; x <= hw; x += step) { pts.push(x, 2, -hd, x, 2, hd); }
        for (let z = -hd; z <= hd; z += step) { pts.push(-hw, 2, z, hw, 2, z); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
            color: 0x00ff88, transparent: true, opacity: 0.10, depthWrite: false
        }));
        this.group.add(line);
        this._grid = line;
    },

    _buildBars() {
        const n = (this._recList || []).length;
        if (!n) return;
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshBasicMaterial({
            transparent: true, opacity: 0.72, depthWrite: false
        });
        mat.userData._xraySkip = true;
        const im = new THREE.InstancedMesh(geo, mat, n);
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(im);
        this._bars = im;
    },

    /* Same-lab chains plus infrastructure chains — the relationship graph the
       2D overlay draws, lifted onto arcs so it reads from street level. */
    _linkPairs() {
        const pairs = [];
        const groups = new Map();
        const push = (k, rec) => {
            if (!groups.has(k)) groups.set(k, []);
            groups.get(k).push(rec);
        };
        for (const rec of (this._recList || [])) {
            if (rec.lab) push('lab:' + rec.lab, rec);
            for (const pre of ['dc_', 'fab_', 'power_', 'port_', 'robotics_', 'longevity_', 'backbone_', 'vcrow_']) {
                if (rec.id.startsWith(pre)) { push('zone:' + pre, rec); break; }
            }
        }
        for (const [k, arr] of groups) {
            if (arr.length < 2) continue;
            arr.sort((a, b) => (a.x - b.x) || (a.z - b.z));
            const hex = k.startsWith('lab:') ? arr[0].hex : '#22d3ee';
            for (let i = 0; i < arr.length - 1; i++) pairs.push({ a: arr[i], b: arr[i + 1], hex });
        }
        return pairs;
    },

    _arcPoint(arc, t, out) {
        const u = 1 - t;
        out.set(
            u * u * arc.a.x + 2 * u * t * arc.c.x + t * t * arc.b.x,
            u * u * arc.a.y + 2 * u * t * arc.c.y + t * t * arc.b.y,
            u * u * arc.a.z + 2 * u * t * arc.c.z + t * t * arc.b.z
        );
        return out;
    },

    _buildLinks() {
        const pairs = this._linkPairs();
        if (!pairs.length) { this._packetArcs = []; return; }
        const SEG = 14;
        const pos = [];
        const col = [];
        const arcs = [];
        const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
        const c = new THREE.Color();
        for (const pr of pairs) {
            const ay = pr.a.h + 26, by = pr.b.h + 26;
            const dist = Math.hypot(pr.b.x - pr.a.x, pr.b.z - pr.a.z);
            const arc = {
                a: new THREE.Vector3(pr.a.x, ay, pr.a.z),
                b: new THREE.Vector3(pr.b.x, by, pr.b.z),
                c: new THREE.Vector3(
                    (pr.a.x + pr.b.x) / 2,
                    Math.max(ay, by) + Math.min(dist * 0.28, 420),
                    (pr.a.z + pr.b.z) / 2
                ),
                hex: pr.hex
            };
            arcs.push(arc);
            c.set(pr.hex);
            for (let s = 0; s < SEG; s++) {
                this._arcPoint(arc, s / SEG, p0);
                this._arcPoint(arc, (s + 1) / SEG, p1);
                pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
                for (let k = 0; k < 2; k++) col.push(c.r, c.g, c.b);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        const line = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
            vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false
        }));
        line.frustumCulled = false;
        this.group.add(line);
        this._links = line;
        this._packetArcs = arcs;
    },

    _buildPackets() {
        const arcs = this._packetArcs || [];
        if (!arcs.length) return;
        const N = Math.min(180, arcs.length * 2);
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);
        const st = [];
        const c = new THREE.Color();
        for (let i = 0; i < N; i++) {
            const arc = arcs[i % arcs.length];
            st.push({
                arc,
                t: (i * 0.137) % 1,
                speed: 0.06 + ((i * 13) % 9) * 0.012,
                dir: (i % 2) ? 1 : -1
            });
            c.set(arc.hex);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const tex = packetTexture();
        const pts = new THREE.Points(g, new THREE.PointsMaterial({
            size: 26, map: tex, vertexColors: true, transparent: true,
            opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending,
            sizeAttenuation: true, alphaTest: 0.02
        }));
        pts.frustumCulled = false;
        this.group.add(pts);
        this._packets = pts;
        this._packetState = st;
        this._packetTex = tex;
    },

    /* Text is the expensive part of a diagnostic overlay, so only the buildings
       that actually carry industry weight get a plate. */
    _buildLabels() {
        const list = [...(this._recList || [])]
            .sort((a, b) => (b.lab ? 1 : 0) - (a.lab ? 1 : 0) || b.floors - a.floors)
            .slice(0, 34);
        this._labels = [];
        for (const rec of list) {
            const sub = rec.lab
                ? `${rec.models} models · ${rec.floors}F`
                : `${rec.floors}F`;
            const tex = labelTexture(rec.name, sub, rec.hex);
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, transparent: true, depthWrite: false, opacity: 0.92
            }));
            spr.scale.set(190, 47, 1);
            spr.position.set(rec.x, rec.h + 300, rec.z);
            spr.renderOrder = 7;
            this.group.add(spr);
            this._labels.push({ spr, tex, rec });
        }
    },

    _buildScanPlane() {
        const g = new THREE.PlaneGeometry(CITY_W + 900, CITY_D + 900);
        g.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x00ff88, transparent: true, opacity: 0.045,
            depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
        });
        mat.userData._xraySkip = true;
        const m = new THREE.Mesh(g, mat);
        m.frustumCulled = false;
        this.group.add(m);
        this._scan = m;
        this._scanY = 0;
    },

    /* ── painting ─────────────────────────────────────────────────────────── */
    _valueOf(rec) {
        if (!rec) return 0;
        switch (this.metric) {
            /* Occupancy is wildly long-tailed — the residential blocks hold
               hundreds while a fab holds four — so a linear ramp paints the
               entire city the same cold blue. Log spreads the interesting end. */
            case 'pop':   return Math.log1p(rec.pop) / Math.log1p(Math.max(1, this._maxPop));
            case 'bench': return rec.bench;
            default:      return Math.min(1, rec.floors / Math.max(1, this._maxFloors));
        }
    },

    _colorOf(rec, out) {
        if (!rec) return out.setRGB(0.06, 0.10, 0.12);
        if (this.metric === 'lab') {
            out.copy(rec.color);
            if (!rec.lab) out.multiplyScalar(0.45);
            return out;
        }
        const v = this._valueOf(rec);
        if (this.metric === 'bench' && rec.bench <= 0) return out.setRGB(0.05, 0.08, 0.11);
        return out.copy(ramp(v));
    },

    _paint() {
        if (!this._built) return;
        const c = new THREE.Color();
        for (const b of (this._binds || [])) {
            const arr = b.mesh.instanceColor?.array;
            if (!arr) continue;
            for (let i = 0; i < b.recs.length; i++) {
                this._colorOf(b.recs[i], c);
                arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
            }
            b.mesh.instanceColor.needsUpdate = true;
        }
        this._layoutBars();
        this._syncHud();
    },

    _layoutBars() {
        const im = this._bars;
        if (!im) return;
        const d = new THREE.Object3D();
        const c = new THREE.Color();
        const list = this._recList || [];
        for (let i = 0; i < list.length; i++) {
            const rec = list[i];
            const v = this._valueOf(rec);
            const bh = 24 + v * 240;
            d.position.set(rec.x, rec.h + 40 + bh / 2, rec.z);
            d.scale.set(13, bh, 13);
            d.rotation.set(0, 0, 0);
            d.updateMatrix();
            im.setMatrixAt(i, d.matrix);
            im.setColorAt(i, this._colorOf(rec, c));
        }
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
    },

    _restoreColors() {
        for (const b of (this._binds || [])) {
            const ic = b.mesh.instanceColor;
            if (!ic || !b.saved) continue;
            ic.array.set(b.saved);
            ic.needsUpdate = true;
        }
    },

    /* ── live data ────────────────────────────────────────────────────────── */
    _refreshPop() {
        const list = G.citizens?.list;
        if (!list || !this._recs) return;
        for (const rec of this._recList) rec.pop = 0;
        let max = 1;
        for (const cz of list) {
            const rec = cz && cz.targetBid ? this._recs.get(cz.targetBid) : null;
            if (!rec) continue;
            rec.pop++;
            if (rec.pop > max) max = rec.pop;
        }
        this._maxPop = max;
    },

    /* ── backdrop ─────────────────────────────────────────────────────────────
       A wireframe city against a bright sky is unreadable, so x-ray drops the
       world to near-black. `scene.background` and `scene.fog` are live objects
       weather.js rewrites every frame, so we mutate them in place after weather
       has had its turn (mode updates run last) and put the exact saved values
       back on exit rather than nulling anything. */
    _dimSave() {
        const sc = G.scene;
        if (!sc || this._savedEnv) return;
        this._savedEnv = {
            bg: sc.background && sc.background.isColor ? sc.background.getHex() : null,
            fogC: sc.fog ? sc.fog.color.getHex() : null,
            fogN: sc.fog ? sc.fog.near : null,
            fogF: sc.fog ? sc.fog.far : null
        };
    },

    _dimApply() {
        const sc = G.scene;
        if (!sc) return;
        if (sc.background && sc.background.isColor) sc.background.setHex(0x02060a);
        if (sc.fog) {
            sc.fog.color.setHex(0x04131a);
            sc.fog.far = Math.max(sc.fog.far, (G.preset?.far || 3400) * 1.6);
            sc.fog.near = sc.fog.far * 0.03;
        }
    },

    _dimRestore() {
        const s = this._savedEnv, sc = G.scene;
        this._savedEnv = null;
        if (!s || !sc) return;
        if (s.bg != null && sc.background && sc.background.isColor) sc.background.setHex(s.bg);
        if (sc.fog) {
            if (s.fogC != null) sc.fog.color.setHex(s.fogC);
            if (s.fogN != null) sc.fog.near = s.fogN;
            if (s.fogF != null) sc.fog.far = s.fogF;
        }
    },

    /* ── HUD ──────────────────────────────────────────────────────────────── */
    _buildHud() {
        const el = document.createElement('div');
        el.id = 'xrayHud';
        el.style.cssText = [
            'position:fixed', 'left:18px', 'bottom:22px', 'z-index:60',
            'pointer-events:none', 'display:none',
            'font:11px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace',
            'color:#94a3b8', 'background:rgba(2,10,15,.86)',
            'border:1px solid rgba(0,255,136,.32)', 'border-left:2px solid #00ff88',
            'border-radius:4px', 'padding:9px 13px', 'min-width:186px',
            'box-shadow:0 8px 26px rgba(0,0,0,.55)'
        ].join(';');
        document.body.appendChild(el);
        this._hud = el;
    },

    _syncHud() {
        const el = this._hud;
        if (!el) return;
        const m = XRAY_METRICS[this.metricIdx];
        const list = this._recList || [];
        const labs = new Set(list.filter(r => r.lab).map(r => r.lab));
        const top = list.reduce((a, r) => (this._valueOf(r) > this._valueOf(a) ? r : a), list[0] || null);
        const row = (k, v, col) =>
            `<div style="display:flex;justify-content:space-between;gap:14px">
               <span style="color:#475569">${k}</span>
               <b style="color:${col}">${v}</b></div>`;
        const swatch = (col, txt) =>
            `<div><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${col};margin-right:6px"></span>${txt}</div>`;
        el.innerHTML =
            `<div style="color:#00ff88;font-weight:700;letter-spacing:2px">X-RAY DIAGNOSTIC</div>
             <div style="height:1px;background:rgba(0,255,136,.3);margin:6px 0"></div>
             ${row('METRIC', m.label, '#22d3ee')}
             ${row('BUILDINGS', String(list.length), '#00ff88')}
             ${row('LABS', String(labs.size), '#fbbf24')}
             ${row('PEAK POP', String(this._maxPop), '#f472b6')}
             ${row('TOP', top ? top.name.slice(0, 18) : '—', '#ef4444')}
             <div style="height:1px;background:rgba(0,255,136,.3);margin:6px 0"></div>
             ${swatch('#1e3a8a', 'low')}${swatch('#22c55e', 'mid')}${swatch('#ef4444', 'high')}
             ${swatch('#22d3ee', 'data packet / link')}
             <div style="color:#475569;margin-top:5px">B cycle · X exit</div>`;
    },

    _showHud(on) {
        if (!this._hud) return;
        this._hud.style.display = on ? 'block' : 'none';
        if (on) this._syncHud();
    },

    /* ── frame ────────────────────────────────────────────────────────────── */
    update(dt) {
        if (!this.active || !this._built) return;
        this._dimApply();

        // Population is a schedule-driven number; re-sampling it every frame
        // buys nothing and costs a full pass over the citizen list.
        this._popT -= dt;
        if (this._popT <= 0) {
            this._popT = 1.5;
            this._refreshPop();
            if (this.metric === 'pop') this._paint();
            else this._syncHud();
        }

        const st = this._packetState;
        if (st && this._packets) {
            const arr = this._packets.geometry.attributes.position.array;
            const v = new THREE.Vector3();
            for (let i = 0; i < st.length; i++) {
                const p = st[i];
                p.t += p.speed * p.dir * dt;
                if (p.t > 1) p.t -= 1;
                if (p.t < 0) p.t += 1;
                this._arcPoint(p.arc, p.t, v);
                arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
            }
            this._packets.geometry.attributes.position.needsUpdate = true;
        }

        if (this._scan) {
            this._scanY += dt * 180;
            if (this._scanY > 1100) this._scanY = -40;
            this._scan.position.y = this._scanY;
        }

        // Plates always read: sprites face the camera on their own, but the
        // hover height tracks the eye so they never sink into the roofline.
        const camY = G.camera?.position.y || 0;
        for (const l of (this._labels || [])) {
            l.spr.position.y = Math.max(l.rec.h + 300, camY * 0.25 + l.rec.h + 200);
        }
    },

    /* ── teardown ─────────────────────────────────────────────────────────── */
    dispose() {
        if (this.active) this.exit();
        if (!this._built) return;
        const kill = (o) => {
            if (!o) return;
            o.geometry?.dispose?.();
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) { m?.map?.dispose?.(); m?.dispose?.(); }
        };
        kill(this._grid); kill(this._bars); kill(this._links); kill(this._packets); kill(this._scan);
        for (const l of (this._labels || [])) { kill(l.spr); l.tex?.dispose?.(); }
        this._packetTex?.dispose?.();
        if (this.group?.parent) this.group.parent.remove(this.group);
        this._hud?.remove?.();
        this.group = null; this._hud = null; this._labels = null;
        this._bars = this._links = this._packets = this._scan = this._grid = null;
        this._binds = null; this._recs = null; this._recList = null;
        this._built = false;
    },

    snapshot() {
        return {
            active: this.active,
            meshesTouched: this.meshesTouched,
            metric: this.metric,
            buildings: (this._recList || []).length,
            packets: (this._packetState || []).length,
            links: (this._packetArcs || []).length
        };
    }
};
