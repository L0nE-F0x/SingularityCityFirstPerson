/* ══════════════════════════════════════════════════════════════════════════
   INTERIORS — walk-in lobbies. One reusable room, re-dressed for whichever
   building you entered, parked well below the city and swapped in by moving
   the player rather than by building a second scene.

   Why underground and not a separate THREE.Scene: the weather system, fog,
   lights and the main loop all reference G.scene. Keeping one scene means an
   interior costs nothing but its own geometry, and the same sun/hemi/ambient
   light it — a HemisphereLight shades by normal direction, so it works just
   as well 3000 units down as it does on the street.

   The city meshes are hidden while you are inside, so an interior renders in
   about six draw calls.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, EYE_H } from './state.js';
import { LABS } from './data.js';
import * as TEX from './textures.js';

export const FLOOR_Y = -4000;          // where interiors live
const ROOM_W = 560, ROOM_D = 460, ROOM_H = 96;
const WALL = 12;                        // wall thickness
const DOOR_W = 90;

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

export const Interior = {
    group: null,
    building: null,          // the building you are inside, or null
    floor: 0,                // multi-floor: 0 lobby, 1+ upper / special
    maxFloor: 0,
    _shell: null,            // static merged mesh (rebuilt per dressing)
    _signMesh: null,
    _cityHidden: [],
    _savedColliders: null,
    _exit: { x: 0, z: ROOM_D / 2 - 40 },
    _liftZones: [],

    init(scene) {
        this.group = new THREE.Group();
        this.group.position.set(0, FLOOR_Y, 0);
        this.group.visible = false;
        scene.add(this.group);
        // modest quality lift: warm fill light for interiors only
        this._fillLight = new THREE.PointLight(0xfff0dd, 0.85, 900, 2);
        this._fillLight.position.set(0, 70, 0);
        this._fillLight.visible = false;
        scene.add(this._fillLight);
        document.addEventListener('keydown', e => {
            if (!this.building || G.panelOpen || G.ridingMetro) return;
            // F cycles floors from anywhere indoors; digits work at the lift
            if (e.code === 'KeyF' && this.maxFloor > 0) {
                this.setFloor((this.floor + 1) % (this.maxFloor + 1));
                return;
            }
            const dig = e.code.match(/^Digit(\d)$/);
            if (dig && this.maxFloor > 0 && this.atLift()) {
                const n = parseInt(dig[1], 10);
                if (n <= this.maxFloor) this.rideElevator(n);
            }
        });
    },

    // Each building type gets its own palette + light mood, so entering a
    // datacenter feels nothing like entering a bar. Overrides by district
    // catch robotics/longevity, whose buildings are generic-typed.
    _theme(b) {
        const t = b.type, d = b.district, id = b.id || '';
        // Route mirrors pixi interior_manager destinations (FP one-room dress).
        if (id === 'black_market')
            return { cat: 'underground', wall: 0x1a1020, ceil: 0x0a0610, floor: 0x2a1830, lamp: 0xf472b6, accent: '#f472b6', dim: true };
        if (id.includes('jail'))
            return { cat: 'jail', wall: 0x2a2e36, ceil: 0x14181e, floor: 0x3a4048, lamp: 0xff6a6a, accent: '#f472b6', dim: true };
        if (id.startsWith('court_') || id === 'court_senate' || id === 'court_hearing' || t === 'court')
            return { cat: 'court', wall: 0xe8e0d0, ceil: 0xd8d0c0, floor: 0x8a7048, lamp: 0xfff0d0, accent: '#fbbf24' };
        if (t === 'embassy' || id.startsWith('embassy_'))
            return { cat: 'embassy', wall: 0xf0f4f8, ceil: 0xe2e8f0, floor: 0xb0b8c4, lamp: 0xfff6e2, accent: '#3b82f6' };
        if (t === 'launchpad' || id === 'mission_control' || t === 'dish' || id === 'tracking_station' || id === 'space_assembly')
            return { cat: 'mission', wall: 0x1a2230, ceil: 0x0e141e, floor: 0x2a3444, lamp: 0x5affc8, accent: '#22d3ee', dim: true };
        if (id.startsWith('power_') || t === 'nuclear' || t === 'coal' || t === 'solar' || t === 'wind' || t === 'dam')
            return { cat: 'power', wall: 0x3a4048, ceil: 0x242a30, floor: 0x5a6068, lamp: 0xffd23a, accent: '#fbbf24' };
        if (t === 'datacenter' || t === 'chipfab' || t === 'fab' || id.startsWith('dc_') || id.startsWith('fab_'))
            return { cat: 'datacenter', wall: 0x2a3038, ceil: 0x1b2028, floor: 0x7f8a99, lamp: 0x9fd0ff, accent: '#4aa0ff' };
        if (t === 'bar' || id === 'neon_bar')
            return { cat: 'bar', wall: 0x241826, ceil: 0x140a18, floor: 0x3a2a44, lamp: 0x8a2a6a, accent: '#e879f9', dim: true };
        if (id.startsWith('vcrow_') || t === 'vcrow' || d === 'vc')
            return { cat: 'vc', wall: 0x0f172a, ceil: 0x020617, floor: 0x1e293b, lamp: 0xfbbf24, accent: '#fbbf24', dim: true };
        if (id.startsWith('agents_') || t === 'agents' || d === 'agents')
            return { cat: 'agents', wall: 0x1e1b4b, ceil: 0x0f0a2a, floor: 0x312e81, lamp: 0xa78bfa, accent: '#a78bfa', dim: true };
        if (t === 'cabin' || d === 'alignment' || t === 'alignment' || id.startsWith('align_'))
            return { cat: 'alignment', wall: 0x2d3b2e, ceil: 0x1a241c, floor: 0x3f4f3a, lamp: 0x86efac, accent: '#4ade80', dim: true };
        if (t === 'arena' || id === 'arena')
            return { cat: 'arena', wall: 0x1a1a22, ceil: 0x0c0c12, floor: 0x2a2a36, lamp: 0xf97316, accent: '#f97316', dim: true };
        if (id === 'cafe')
            return { cat: 'cafe', wall: 0xf5e6d3, ceil: 0xe8d5bc, floor: 0xc4a574, lamp: 0xffe4ac, accent: '#d97706' };
        if (id === 'gym')
            return { cat: 'gym', wall: 0x374151, ceil: 0x1f2937, floor: 0x4b5563, lamp: 0x38bdf8, accent: '#0ea5e9' };
        if (id === 'nursery')
            return { cat: 'nursery', wall: 0xfce7f3, ceil: 0xfbcfe8, floor: 0xf9a8d4, lamp: 0xfda4af, accent: '#f472b6' };
        if (id === 'convention_center' || t === 'conference')
            return { cat: 'conference', wall: 0xe0e7ff, ceil: 0xc7d2fe, floor: 0x818cf8, lamp: 0xe0e7ff, accent: '#6366f1' };
        if (id === 'backbone_ixp' || id.includes('backbone') || t === 'backbone')
            return { cat: 'backbone', wall: 0x164e63, ceil: 0x083344, floor: 0x0e7490, lamp: 0x22d3ee, accent: '#06b6d4', dim: true };
        if (t === 'housing' || t === 'villa' || d === 'residential' || d === 'embassy_q' || id.startsWith('res_') || id.startsWith('diplomat_villa_'))
            return { cat: 'home', wall: 0xdcc9a8, ceil: 0xe8dcc4, floor: 0xb08652, lamp: 0xffe4ac, accent: '#c8955a' };
        if (d === 'robotics' || t === 'robotics')
            return { cat: 'robotics', wall: 0x8a8072, ceil: 0x46423c, floor: 0x9a9488, lamp: 0xffd090, accent: '#ff8a3a' };
        if (d === 'longevity' || t === 'longevity')
            return { cat: 'longevity', wall: 0xeaf2f4, ceil: 0xdce8ea, floor: 0xcfe0e2, lamp: 0xd6fbff, accent: '#22d3cc' };
        if (t === 'university' || d === 'university')
            return { cat: 'academic', wall: 0xe2d8c4, ceil: 0xd6cab2, floor: 0x8a6a45, lamp: 0xfff0d0, accent: '#b8863a' };
        if (t === 'newspaper' || id === 'times_hq')
            return { cat: 'press', wall: 0xd6d0c2, ceil: 0xc8c2b2, floor: 0x9a9488, lamp: 0xfff2d0, accent: '#5a5148' };
        if (t === 'metro' || id.startsWith('metro_'))
            return { cat: 'metro', wall: 0x1e293b, ceil: 0x0f172a, floor: 0x334155, lamp: 0x22d3ee, accent: '#22d3ee', dim: true };
        if (t === 'warehouse')
            return { cat: 'warehouse', wall: 0x9aa0a8, ceil: 0x686e76, floor: 0x8a9098, lamp: 0xffe6b0, accent: '#7a8590' };
        // Lab HQs and generic offices
        return { cat: 'office', wall: 0xe6eaf0, ceil: 0xd2d7df, floor: 0xb9bec7, lamp: 0xfff6e2, accent: '#4a6fa5' };
    },

    _floorsFor(b) {
        const th = this._theme(b);
        // Metro: ticket hall (0) + platform (1) — board trains from platform
        if (th.cat === 'metro' || b.type === 'metro') return 1;
        // Real elevators: use building storeys (capped for perf / playability)
        const storeys = Math.max(1, Math.min(b.fl || 1, 14));
        if (storeys <= 1) {
            // multi-room feel for special destinations even if fl=1 in data
            if (['court','mission','power','vc','agents','conference','backbone','datacenter'].includes(th.cat)) return 1;
            return 0;
        }
        // floors 0..storeys-1 (lobby through top floor)
        return storeys - 1;
    },

    // ── the room ─────────────────────────────────────────────────────────────
    _build(b, floorIdx = 0) {
        // clear the previous dressing
        for (const m of [...this.group.children]) {
            this.group.remove(m);
            m.geometry?.dispose();
            if (m.material?.map) m.material.map.dispose();
            m.material?.dispose();
        }

        this.floor = floorIdx;
        this.maxFloor = this._floorsFor(b);
        const th = this._theme(b);
        // floor re-skins: lobby / mid / top feel different
        const top = this.maxFloor > 0 && floorIdx === this.maxFloor;
        if (th.cat === 'metro' && floorIdx >= 1) {
            th.cat = 'platform';
            th.wall = 0x0f172a; th.ceil = 0x020617; th.floor = 0x1e293b; th.lamp = 0xfbbf24; th.dim = true;
        } else if (floorIdx > 0 && th.cat === 'office') {
            th.cat = top ? 'boardroom' : 'office';
            if (top) { th.wall = 0x1e293b; th.ceil = 0x0f172a; th.floor = 0x334155; th.lamp = 0x38bdf8; th.dim = true; }
        } else if (floorIdx > 0 && th.cat === 'embassy') {
            th.accent = top ? '#ef4444' : '#3b82f6';
        } else if (floorIdx > 0 && th.cat === 'datacenter') {
            th.cat = top ? 'datacenter' : 'datacenter';
        } else if (floorIdx > 0 && th.cat === 'home') {
            th.cat = top ? 'home' : 'home';
        }
        const parts = [];     // lit surfaces (lambert, vertex-coloured)
        const glow = [];      // self-lit surfaces (basic, vertex-coloured)
        const box = (w, h, d, x, y, z, hex, arr = parts) => {
            const g = new THREE.BoxGeometry(w, h, d);
            g.translate(x, y, z);
            arr.push(paint(g, hex));
        };
        const lit = (w, h, d, x, y, z, hex) => box(w, h, d, x, y, z, hex, glow);

        const lab = b.lab && LABS[b.lab];
        const accent = new THREE.Color(lab ? lab.color : th.accent);
        const accentHex = '#' + accent.getHexString();

        // ceiling
        box(ROOM_W, 4, ROOM_D, 0, ROOM_H, 0, th.ceil);
        // walls — front wall is split either side of the doorway
        box(WALL, ROOM_H, ROOM_D, -ROOM_W / 2, ROOM_H / 2, 0, th.wall);
        box(WALL, ROOM_H, ROOM_D, ROOM_W / 2, ROOM_H / 2, 0, th.wall);
        box(ROOM_W, ROOM_H, WALL, 0, ROOM_H / 2, -ROOM_D / 2, th.wall);
        const sideW = (ROOM_W - DOOR_W) / 2;
        for (const s of [-1, 1]) {
            box(sideW, ROOM_H, WALL, s * (DOOR_W / 2 + sideW / 2), ROOM_H / 2, ROOM_D / 2, th.wall);
        }
        box(DOOR_W, ROOM_H - 62, WALL, 0, ROOM_H - (ROOM_H - 62) / 2, ROOM_D / 2, th.wall);
        // skirting + accent band at head height
        box(ROOM_W - WALL, 5, 2, 0, 2.5, -ROOM_D / 2 + WALL / 2 + 1, 0x000000);
        lit(ROOM_W - WALL, 6, 2, 0, 62, -ROOM_D / 2 + WALL / 2 + 1, accent.getHex());

        // ceiling light panels — colour + density set the mood
        const panels = th.dim ? [[-1, -1], [1, 1]] : [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
        for (const [ix, iz] of panels) lit(120, 2, 70, ix * 175, ROOM_H - 3, iz * 140, th.lamp);

        this._dress(b, box, lit, th, accent, floorIdx);
        this._enrichRoom(box, lit, th, accent);

        // floor indicator plaque
        lit(60, 18, 2, 200, 50, -ROOM_D / 2 + WALL / 2 + 2, 0x111827);
        this._floorLabel = `F${floorIdx}${this.maxFloor ? '/' + this.maxFloor : ''}`;

        const shell = new THREE.Mesh(mergeGeometries(parts, false),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.04 }));
        shell.matrixAutoUpdate = false;
        this.group.add(shell);

        if (glow.length) {
            const glowMesh = new THREE.Mesh(mergeGeometries(glow, false),
                new THREE.MeshBasicMaterial({ vertexColors: true }));
            glowMesh.matrixAutoUpdate = false;
            this.group.add(glowMesh);
        }

        // floor — one polished-stone texture tinted per theme
        const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
        floorGeo.rotateX(-Math.PI / 2);
        const fuv = floorGeo.attributes.uv;
        for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 7, fuv.getY(i) * 6);
        const floor = new THREE.Mesh(floorGeo,
            new THREE.MeshStandardMaterial({ map: TEX.lobbyFloor(), color: th.floor, roughness: 0.55, metalness: 0.08 }));
        floor.matrixAutoUpdate = false;
        this.group.add(floor);

        // name board on the back wall
        const signTex = TEX.lobbySign(b.name, (b.emoji || '🏢'), accentHex,
            lab ? lab.name : (b.type || '').toUpperCase());
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(320, 80),
            new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
        sign.position.set(0, 74, -ROOM_D / 2 + WALL / 2 + 3);
        this.group.add(sign);

        // colliders, in interior-local coords offset to world
        this._colliders = [];
        const wall = (x0, z0, x1, z1) => this._colliders.push({ x0, z0, x1, z1 });
        wall(-ROOM_W / 2 - 20, -ROOM_D / 2 - 20, -ROOM_W / 2 + WALL / 2, ROOM_D / 2 + 20);
        wall(ROOM_W / 2 - WALL / 2, -ROOM_D / 2 - 20, ROOM_W / 2 + 20, ROOM_D / 2 + 20);
        wall(-ROOM_W / 2 - 20, -ROOM_D / 2 - 20, ROOM_W / 2 + 20, -ROOM_D / 2 + WALL / 2);
        for (const s of [-1, 1]) {
            const cx = s * (DOOR_W / 2 + sideW / 2);
            wall(cx - sideW / 2, ROOM_D / 2 - WALL / 2, cx + sideW / 2, ROOM_D / 2 + 20);
        }
        for (const c of this._propColliders || []) this._colliders.push(c);
    },

    // Signature contents per theme. Everything merges into the shell (lit) or
    // glow (self-lit) buckets, so a richer room costs triangles, not draw calls.
    _dress(b, box, lit, th, accent, floor = 0) {
        this._propColliders = [];
        this._liftZones = [];
        const solid = (x, z, w, d) => this._propColliders.push(
            { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        const accentHex = '#' + accent.getHexString();
        const cat = th.cat;
        let liftBank = true;

        if (cat === 'jail') {
            // cell block: bars + bench
            for (let i = 0; i < 4; i++) {
                const cx = -180 + i * 100;
                box(80, 70, 60, cx, 35, -120, 0x1a1e24); solid(cx, -120, 80, 60);
                for (let bar = 0; bar < 5; bar++) lit(2, 60, 2, cx - 30 + bar * 15, 35, -88, 0x94a3b8);
            }
            box(200, 40, 40, 0, 20, 80, 0x2a3038); solid(0, 80, 200, 40);
            lit(120, 30, 2, 0, 50, -ROOM_D / 2 + 20, 0xff4466);
            liftBank = false;
        } else if (cat === 'court') {
            // bench, witness stand, gallery
            box(220, 50, 50, 0, 25, -160, 0x6b5136); solid(0, -160, 220, 50);
            box(40, 40, 40, -160, 20, -60, 0x8a7048); solid(-160, -60, 40, 40);
            for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
                box(28, 18, 28, -100 + c * 40, 9, 40 + r * 40, 0x5a4634);
            }
            lit(80, 20, 2, 0, 70, -130, 0xfbbf24);
            liftBank = true;
        } else if (cat === 'embassy') {
            // flag wall + reception + seals
            const flagCols = [0x3b82f6, 0xef4444, 0xfbbf24, 0x22c55e];
            for (let i = 0; i < 4; i++) lit(50, 34, 2, -120 + i * 70, 60, -ROOM_D / 2 + 14, flagCols[i]);
            box(160, 34, 46, 0, 17, -100, 0xc0a070); solid(0, -100, 160, 46);
            box(40, 60, 40, 200, 30, 100, 0xe2e8f0); solid(200, 100, 40, 40);
            liftBank = true;
        } else if (cat === 'mission') {
            // mission control: curved console wall + big screen
            box(400, 40, 50, 0, 20, -140, 0x1e293b); solid(0, -140, 400, 50);
            for (let i = 0; i < 8; i++) lit(40, 24, 2, -140 + i * 40, 48, -160, [0x22d3ee, 0x5affc8, 0xfbbf24][i % 3]);
            lit(280, 90, 2, 0, 50, -ROOM_D / 2 + 14, 0x0a2030);
            for (let i = 0; i < 6; i++) lit(36, 28, 2, -100 + i * 40, 50, -ROOM_D / 2 + 16, 0x1a4a60);
            liftBank = true;
        } else if (cat === 'power') {
            // control room: turbines panel + warning stripes
            box(300, 60, 40, 0, 30, -150, 0x2a3038); solid(0, -150, 300, 40);
            for (let i = 0; i < 5; i++) lit(30, 30, 2, -100 + i * 50, 50, -128, 0xffd23a);
            for (const s of [-1, 1]) lit(ROOM_W - 40, 1, 8, 0, 1, s * 120, 0xfbbf24);
            box(80, 80, 80, 200, 40, 40, 0x4a5058); solid(200, 40, 80, 80);
            liftBank = true;
        } else if (cat === 'boardroom') {
            box(240, 30, 100, 0, 15, -40, 0x1e293b); solid(0, -40, 240, 100);
            for (let i = -3; i <= 3; i++) box(20, 24, 20, i * 32, 12, -100, 0x334155);
            lit(160, 60, 2, 0, 50, -ROOM_D / 2 + 14, 0x38bdf8);
            liftBank = true;
        } else if (cat === 'datacenter') {
            // NOC desk with monitors, then cold rows of blinking server racks
            box(160, 34, 44, -150, 17, -150, 0x1c2128);
            for (const mx of [-190, -150, -110]) lit(34, 22, 2, mx, 44, -168, 0x2aa0ff);
            for (let row = 0; row < 2; row++) {
                for (let i = 0; i < 6; i++) {
                    const rx = -150 + i * 62, rz = -60 + row * 70;
                    box(46, 84, 34, rx, 42, rz, 0x14181e);
                    box(40, 72, 1.5, rx, 44, rz + 17.5, 0x0a0d12);
                    // LED columns
                    const col = [0x39ff88, 0x2aa0ff, 0xffd23a][(i + row) % 3];
                    for (let l = 0; l < 6; l++) lit(3, 3, 1, rx - 14 + (l % 3) * 14, 22 + Math.floor(l / 3) * 30, rz + 18, col);
                    solid(rx, rz, 46, 34);
                }
                // overhead cable tray
                box(400, 4, 10, -90, 82, -60 + row * 70, 0x3a4048);
            }
            liftBank = true;
        } else if (cat === 'bar') {
            // long bar, back-bar shelf of glowing bottles, stools, neon strips
            box(320, 40, 40, 0, 20, -150, 0x2a1c14);
            box(326, 5, 46, 0, 42, -150, 0x5a3a22);
            solid(0, -150, 326, 46);
            for (let i = 0; i < 14; i++) {
                const bx = -150 + i * 23;
                lit(7, 20, 7, bx, 60, -172, [0xff5a8a, 0x5affc8, 0xffd23a, 0x8a5aff][i % 4]);
            }
            box(300, 26, 6, 0, 70, -176, 0x160e12);       // back-bar wall
            for (let i = -4; i <= 4; i++) {                // stools
                box(16, 26, 16, i * 34, 13, -108, 0x241a20);
                box(20, 4, 20, i * 34, 27, -108, 0x8a2a6a);
                solid(i * 34, -108, 16, 16);
            }
            // neon strips down the side walls + a small dance floor
            for (const s of [-1, 1]) lit(2, 4, 300, s * (ROOM_W / 2 - WALL), 66, -20, s > 0 ? 0xe879f9 : 0x5affc8);
            for (let gx = -1; gx <= 1; gx++) for (let gz = 0; gz <= 2; gz++)
                lit(44, 1, 44, gx * 60, 1.5, 60 + gz * 50, [0xe879f9, 0x5affc8, 0x8a5aff][(gx + gz + 2) % 3]);
            liftBank = false;
        } else if (cat === 'home') {
            box(190, 26, 78, 96, 13, -140, 0x8a6a4a);       // sofa
            box(190, 30, 18, 96, 30, -170, 0x9a785a);
            solid(96, -140, 190, 78);
            box(120, 6, 68, 96, 22, -46, 0x6d5238);         // coffee table
            box(150, 84, 8, -150, 42, -172, 0x5a4634);      // media wall
            lit(96, 54, 2, -150, 46, -167, 0x1a2a3a);       // TV screen (off-ish)
            for (let sh = 0; sh < 4; sh++) box(90, 4, 24, -150, 14 + sh * 22, -150, 0x7a5c40);  // shelves
            box(30, 60, 30, 250, 30, 150, 0x3a6b3a);        // big plant
            lit(10, 44, 10, -250, 46, 150, 0xffe0a0);       // floor lamp
            box(230, 2, 150, 60, 1.5, 40, 0x9a4a4a);        // rug
            liftBank = true;
        } else if (cat === 'robotics') {
            // conveyor belt, an articulated robot arm, crates, safety line
            box(360, 22, 60, -20, 11, -140, 0x3a3f46);
            box(360, 3, 56, -20, 24, -140, 0x1a1c20);
            for (let i = 0; i < 9; i++) box(4, 26, 60, -190 + i * 42, 13, -140, 0x2a2e34);
            solid(-20, -140, 360, 60);
            // robot arm
            box(40, 14, 40, 150, 7, -60, 0x2a2e34); solid(150, -60, 40, 40);
            box(20, 44, 20, 150, 32, -60, 0xff8a3a);
            box(58, 14, 14, 175, 54, -60, 0xffa85a);
            box(14, 30, 14, 200, 40, -60, 0x2a2e34);
            for (const [cx, cz] of [[-230, 40], [-190, 40], [-210, 76]]) {   // crates
                box(36, 30, 36, cx, 15, cz, 0x8a6a3a); solid(cx, cz, 36, 36);
            }
            box(6, 60, 6, 240, 30, -60, 0x2a2e34);           // tool post
            for (const s of [-1, 1]) lit(ROOM_W - 40, 1, 6, 0, 1, s * 100, 0xffb020);  // safety lines
            lit(70, 30, 2, 250, 46, -150, 0x39ff88);         // status board
            liftBank = false;
        } else if (cat === 'longevity') {
            // clinical benches, vial racks, sequencer cabinets, a DNA helix
            for (const bx of [-200, 200]) {
                box(60, 30, 180, bx, 15, -40, 0xdfe8ea); solid(bx, -40, 60, 180);
                for (let i = 0; i < 8; i++) lit(5, 12, 5, bx - 20 + (i % 4) * 13, 36, -100 + Math.floor(i / 4) * 24, [0x39ffcc, 0xff6ab0, 0xffe23a, 0x6aa0ff][i % 4]);
            }
            for (const sx of [-150, 150]) {                  // sequencer cabinets
                box(50, 78, 30, sx, 39, -172, 0xeef4f6); solid(sx, -172, 50, 30);
                for (let l = 0; l < 8; l++) lit(4, 4, 1, sx - 16 + (l % 4) * 11, 30 + Math.floor(l / 4) * 24, -156, 0x22d3cc);
            }
            // DNA double helix centrepiece
            for (let i = 0; i < 22; i++) {
                const y = 8 + i * 4, a = i * 0.5;
                lit(7, 5, 7, 40 + Math.cos(a) * 26, y, 40, 0x4aa0ff);
                lit(7, 5, 7, 40 - Math.cos(a) * 26, y, 40, 0xff6ab0);
                if (i % 2 === 0) box(52, 2, 2, 40, y, 40, 0xcfe0e2, undefined);
            }
            solid(40, 40, 20, 20);
            liftBank = true;
        } else if (cat === 'academic') {
            // library: bookshelves lining the walls + reading tables
            for (const sx of [-235, 235]) {
                box(30, 96, 260, sx, 48, -20, 0x6b5136); solid(sx, -20, 30, 260);
                for (let sh = 0; sh < 5; sh++) box(26, 4, 250, sx, 18 + sh * 20, -20, 0x8a6a45);
                for (let sh = 0; sh < 5; sh++) for (let bk = 0; bk < 20; bk++)
                    box(3, 14, 11, sx + (sx > 0 ? -13 : 13), 26 + sh * 20, -140 + bk * 13, [0x9a3a3a, 0x3a5a9a, 0x3a7a4a, 0xb8863a][bk % 4]);
            }
            for (const [tx, tz] of [[-70, -40], [70, -40], [-70, 60], [70, 60]]) {
                box(80, 30, 44, tx, 15, tz, 0x6d5238); solid(tx, tz, 80, 44);
                lit(14, 22, 8, tx, 40, tz, 0xffe6a0);        // desk lamp
            }
            box(50, 40, 34, 0, 20, -160, 0x5a4634);          // lectern
            liftBank = true;
        } else if (cat === 'press') {
            // printing press: big machine with roller faces + paper stacks
            box(280, 70, 90, -20, 35, -140, 0x3a4048); solid(-20, -140, 280, 90);
            for (let i = 0; i < 5; i++) box(84, 26, 8, -140 + i * 60, 40, -95, 0x22262c);  // roller housings
            for (const [px, pz] of [[180, 40], [220, 40], [180, 90]]) {   // paper stacks
                box(50, 40, 60, px, 20, pz, 0xe8e4d8); solid(px, pz, 50, 60);
            }
            lit(120, 24, 2, -20, 52, -94, 0x39ff88);         // control panel
            liftBank = false;
        } else if (cat === 'metro') {
            // ticket hall: barriers, ticket machines, escalator well to platform
            for (const gx of [-50, 50]) {
                box(18, 40, 70, gx, 20, 20, 0x64748b); solid(gx, 20, 18, 70);
            }
            for (const mx of [-200, -140, 140, 200]) {
                box(40, 50, 24, mx, 25, -140, 0x1e293b); solid(mx, -140, 40, 24);
                lit(30, 20, 1, mx, 40, -127, 0x22d3ee);
            }
            // escalator down well (visual)
            box(80, 4, 120, 180, 2, 40, 0x0ea5e9);
            for (let i = 0; i < 8; i++) box(70, 3, 12, 180, 4 + i * 6, 80 - i * 12, 0x334155);
            lit(100, 24, 2, 0, 60, -ROOM_D / 2 + 14, 0x22d3ee);
            box(200, 40, 8, 0, 50, -ROOM_D / 2 + 20, 0x0f172a); // departure board frame
            liftBank = true;
        } else if (cat === 'platform') {
            // underground platform: tracks void, yellow line, benches, train indicator
            box(ROOM_W - 40, 2, 40, 0, 1, -160, 0xfbbf24); // safety line
            lit(ROOM_W - 80, 1, 6, 0, 1.5, -150, 0xfde68a);
            // track pit (dark)
            box(ROOM_W - 20, 18, 80, 0, -6, -200, 0x020617);
            for (const rail of [-12, 12]) box(ROOM_W - 40, 2, 3, 0, 1, -200 + rail, 0x64748b);
            // platform benches
            for (const bx of [-180, -60, 60, 180]) {
                box(50, 12, 18, bx, 6, -40, 0x334155); solid(bx, -40, 50, 18);
            }
            // pillars
            for (const px of [-200, 0, 200]) {
                box(16, ROOM_H - 8, 16, px, ROOM_H / 2, -20, 0x475569); solid(px, -20, 16, 16);
            }
            // next-train board
            lit(140, 28, 2, 0, 55, -ROOM_D / 2 + 14, 0x22d3ee);
            lit(ROOM_W - 60, 2, 2, 0, ROOM_H - 8, 0, 0xfbbf24); // strip lights
            liftBank = true;
        } else if (cat === 'underground') {
            // Black Market speakeasy: neon, bar, shadowy booths, weight crates
            box(200, 36, 50, 0, 18, -140, 0x3b1f3a); solid(0, -140, 200, 50);
            lit(180, 8, 2, 0, 50, -140, 0xf472b6);
            for (const bx of [-180, -60, 60, 180]) {
                box(50, 40, 40, bx, 20, 40, 0x1a1020); solid(bx, 40, 50, 40);
                lit(40, 20, 1, bx, 36, 20, 0xa855f7);
            }
            for (const [cx, cz] of [[-200, 120], [200, 120], [0, 140]]) {
                box(40, 30, 40, cx, 15, cz, 0x4a3040); solid(cx, cz, 40, 40);
            }
            lit(ROOM_W - 40, 2, 2, 0, ROOM_H - 6, 0, 0xf472b6);
            liftBank = false;
        } else if (cat === 'vc') {
            // VC partner office: glass table, pitch screen, champagne, money plant
            box(200, 28, 90, 0, 14, -40, 0x0f172a); solid(0, -40, 200, 90);
            for (let i = -2; i <= 2; i++) box(18, 22, 18, i * 36, 11, -100, 0x1e293b);
            lit(200, 70, 2, 0, 50, -ROOM_D / 2 + 14, 0xfbbf24);
            for (let i = 0; i < 6; i++) lit(28, 18, 1, -100 + i * 40, 48, -ROOM_D / 2 + 16, 0x22c55e);
            box(30, 50, 30, 220, 25, 100, 0x166534); solid(220, 100, 30, 30);
            lit(12, 20, 12, -220, 30, 80, 0xfde68a);
            liftBank = true;
        } else if (cat === 'agents') {
            // Agent ops: tool racks, sandboxes, message bus strip
            for (let i = 0; i < 5; i++) {
                box(40, 70, 30, -200 + i * 90, 35, -140, 0x312e81); solid(-200 + i * 90, -140, 40, 30);
                lit(30, 20, 1, -200 + i * 90, 50, -124, [0xa78bfa, 0x22d3ee, 0xf472b6][i % 3]);
            }
            box(360, 8, 40, 0, 4, 40, 0x1e1b4b); // bus
            for (let i = 0; i < 12; i++) lit(16, 4, 4, -160 + i * 28, 10, 40, 0xa78bfa);
            lit(160, 50, 2, 0, 50, -ROOM_D / 2 + 14, 0x6366f1);
            liftBank = true;
        } else if (cat === 'alignment') {
            // Forest research cabin: wood beams, chalkboards, safety whiteboards
            box(ROOM_W - 40, 8, 8, 0, ROOM_H - 10, 0, 0x5c4033);
            box(200, 60, 8, 0, 40, -ROOM_D / 2 + 16, 0x3f4f3a);
            lit(180, 40, 1, 0, 42, -ROOM_D / 2 + 18, 0x86efac);
            for (const [tx, tz] of [[-120, -40], [120, -40], [0, 60]]) {
                box(70, 28, 40, tx, 14, tz, 0x6b5136); solid(tx, tz, 70, 40);
            }
            box(40, 50, 40, 200, 25, 100, 0x2f6b3a); solid(200, 100, 40, 40);
            lit(8, 40, 8, -220, 40, 80, 0xfde68a);
            liftBank = false;
        } else if (cat === 'arena') {
            // LMSYS arena bowl: central ring, stands, jumbotron
            box(180, 8, 180, 0, 4, -20, 0xf97316); // ring
            box(160, 2, 160, 0, 8, -20, 0x1a1a22);
            for (let r = 0; r < 3; r++) for (let a = 0; a < 8; a++) {
                const ang = a * Math.PI / 4;
                box(40, 12 + r * 8, 30, Math.cos(ang) * (100 + r * 40), 6 + r * 10, -20 + Math.sin(ang) * (100 + r * 40), 0x374151);
            }
            lit(200, 60, 2, 0, 55, -ROOM_D / 2 + 14, 0xfbbf24);
            for (let i = 0; i < 4; i++) lit(40, 30, 1, -90 + i * 60, 50, -ROOM_D / 2 + 16, 0x22d3ee);
            liftBank = false;
        } else if (cat === 'cafe') {
            box(160, 34, 50, -100, 17, -120, 0x8b5a2b); solid(-100, -120, 160, 50);
            for (const [sx, sz] of [[80, -80], [140, -80], [80, -20], [140, -20], [80, 40], [140, 40]]) {
                box(28, 16, 28, sx, 8, sz, 0x6d5238); solid(sx, sz, 28, 28);
            }
            lit(60, 40, 2, -100, 48, -145, 0xffe4ac);
            box(40, 50, 40, 220, 25, 100, 0x2f6b3a); solid(220, 100, 40, 40);
            for (let i = 0; i < 5; i++) lit(8, 8, 8, -200 + i * 20, 50, 100, 0xfbbf24);
            liftBank = false;
        } else if (cat === 'gym') {
            for (const gx of [-180, 0, 180]) {
                box(50, 20, 120, gx, 10, -40, 0x1f2937); solid(gx, -40, 50, 120);
                for (let i = 0; i < 4; i++) box(40, 8, 8, gx, 18 + i * 12, -80 + i * 30, 0x6b7280);
            }
            box(100, 4, 100, 0, 2, 100, 0x0ea5e9); // mat
            lit(80, 30, 2, 0, 50, -ROOM_D / 2 + 14, 0x38bdf8);
            liftBank = false;
        } else if (cat === 'nursery') {
            for (const cx of [-160, -40, 80, 200]) {
                box(50, 30, 40, cx, 15, -100, 0xf9a8d4); solid(cx, -100, 50, 40);
                box(40, 20, 30, cx, 12, -40, 0xfbcfe8); // crib
            }
            lit(100, 40, 2, 0, 50, -ROOM_D / 2 + 14, 0xf472b6);
            box(60, 40, 40, 0, 20, 80, 0xfde68a); solid(0, 80, 60, 40);
            liftBank = false;
        } else if (cat === 'conference') {
            box(280, 30, 120, 0, 15, -40, 0x4338ca); solid(0, -40, 280, 120);
            for (let i = -4; i <= 4; i++) box(20, 22, 20, i * 30, 11, -120, 0x6366f1);
            lit(240, 80, 2, 0, 50, -ROOM_D / 2 + 14, 0xa5b4fc);
            for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
                box(24, 16, 24, -140 + c * 40, 8, 40 + r * 40, 0x4f46e5);
            }
            liftBank = true;
        } else if (cat === 'backbone') {
            // IXP / backbone: fiber racks, blinkenlights, globe screen
            for (let i = 0; i < 8; i++) {
                box(30, 80, 40, -210 + i * 55, 40, -120, 0x0e7490); solid(-210 + i * 55, -120, 30, 40);
                for (let l = 0; l < 6; l++) lit(4, 4, 1, -210 + i * 55, 20 + l * 12, -98, [0x22d3ee, 0x4ade80, 0xfbbf24][l % 3]);
            }
            lit(160, 70, 2, 0, 50, -ROOM_D / 2 + 14, 0x06b6d4);
            box(80, 50, 80, 0, 25, 80, 0x164e63); solid(0, 80, 80, 80);
            liftBank = true;
        } else if (cat === 'warehouse') {
            // shelving racks + pallets
            for (const sx of [-200, 0, 200]) {
                box(50, 88, 220, sx, 44, -30, 0x5a6068); solid(sx, -30, 50, 220);
                for (let sh = 0; sh < 4; sh++) box(46, 4, 210, sx, 20 + sh * 22, -30, 0x7a828c);
                for (let sh = 0; sh < 4; sh++) for (let cr = 0; cr < 3; cr++)
                    box(40, 16, 40, sx, 30 + sh * 22, -110 + cr * 70, [0x8a6a3a, 0x6a7a8a, 0x7a5a4a][cr % 3]);
            }
            liftBank = false;
        } else {
            // office lobby: reception, lounge, coffee bar, art, turnstiles, planters
            box(150, 34, 46, -110, 17, -120, 0x8b6f4e);
            box(158, 5, 52, -110, 36, -120, 0xa9885f);
            lit(40, 18, 1, -110, 42, -145, 0x1a2a3a); // desk monitors
            solid(-110, -120, 158, 52);
            for (const [sx, sz] of [[130, -90], [190, -90], [130, -30], [190, -30], [130, 40], [190, 40]]) {
                box(38, 10, 38, sx, 16, sz, 0x3f4a5c);
                box(38, 26, 10, sx, 29, sz - 14, 0x36404f);
                solid(sx, sz, 38, 38);
            }
            // coffee / espresso bar
            box(90, 36, 40, -200, 18, 40, 0x5c4033); solid(-200, 40, 90, 40);
            lit(20, 8, 20, -200, 42, 40, 0xffe4ac);
            // wall art panels
            for (let i = 0; i < 3; i++) lit(36, 28, 1.5, -80 + i * 50, 55, -ROOM_D / 2 + 14, [0x4aa0ff, 0xe879f9, 0x22d3cc][i]);
            // rug + coffee table
            box(160, 1.5, 100, 40, 1, 80, 0x4a5568);
            box(60, 14, 40, 40, 8, 80, 0x6d5238);
            for (const px of [-240, 240]) {
                box(34, 26, 34, px, 13, 150, 0x6b7280);
                box(30, 46, 30, px, 48, 150, 0x2f6b3a);
                solid(px, 150, 34, 34);
            }
            for (const gx of [-40, 40]) {
                box(16, 34, 60, gx, 17, -30, 0x767f8c);
                solid(gx, -30, 16, 60);
            }
            // directory totem
            box(18, 70, 18, 230, 35, -40, 0x2a3340); solid(230, -40, 18, 18);
            lit(14, 40, 1, 230, 40, -30, 0x38bdf8);
        }

        // lift bank on the left wall (skipped for factory/bar/press/warehouse)
        if (liftBank) {
            const lwx = -ROOM_W / 2 + WALL / 2;
            for (const lz of [-120, -40, 40]) {
                // brushed metal door frame + dark door + lit call lantern
                box(6, 80, 60, lwx + 3, 40, lz, 0x8a939e);
                box(2, 72, 52, lwx + 6, 40, lz, 0x1f2937);
                lit(4, 5, 24, lwx + 7, 84, lz, accent.getHex());
                // floor indicator strip above door
                lit(20, 6, 2, lwx + 10, 88, lz, 0x0ea5e9);
                // call button plate
                box(4, 14, 10, lwx + 12, 48, lz + 28, 0x374151);
                lit(2, 3, 3, lwx + 13, 50, lz + 28, 0x4ade80);
                this._liftZones.push({ x: lwx + 30, z: lz, r: 70 });
            }
            // wall directory of floors next to bank
            box(8, 90, 50, lwx + 18, 50, 120, 0x111827);
            lit(2, 70, 36, lwx + 22, 50, 120, 0x38bdf8);
        }
        // door frame + a slab of daylight in the opening (else it's a black hole)
        box(DOOR_W + 16, 6, 6, 0, 62, ROOM_D / 2 - WALL / 2, accent.getHex());
        lit(DOOR_W + 2, 60, 2, 0, 30, ROOM_D / 2 + WALL / 2 + 1, 0xcfe0f2);
    },

    // ── enter / exit ─────────────────────────────────────────────────────────
    canEnter(b) {
        if (!b) return false;
        // Outdoor-only props stay blocked; launchpads use mission/space interiors (2D parity).
        const NO = new Set(['park', 'crane', 'graveyard', 'billboard', 'monument']);
        return !NO.has(b.type);
    },

    setFloor(n) {
        if (!this.building) return;
        const f = Math.max(0, Math.min(this.maxFloor, n | 0));
        if (f === this.floor && this.group.children.length > 2) return;
        const from = this.floor;
        this._build(this.building, f);
        G.colliders = this._colliders.map(c => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }));
        // arrive near the lift bank after a ride (not the street door)
        const nearLift = this._liftZones[0];
        if (nearLift) G.player.teleport(nearLift.x + 30, nearLift.z, Math.PI / 2);
        else G.player.teleport(0, ROOM_D / 2 - 70, 0);
        const top = f === this.maxFloor ? ' · TOP' : '';
        const plat = this.building.type === 'metro' && f === this.maxFloor ? ' · platform — board trains with E' : '';
        G.ui?.banner?.(`🛗 Floor ${f}/${this.maxFloor}${top}`, `elevator${plat || (this.maxFloor ? ' · 0–9 jump · F next' : '')}`);
        G.audio?.sfx?.(f > from ? 'open' : 'close');
    },

    /** Ride elevator to a floor (same as setFloor; named for clarity / tests). */
    rideElevator(n) { this.setFloor(n); },

    atLift() {
        if (!this.building || !this._liftZones?.length) return false;
        const p = G.camera.position;
        return this._liftZones.some(z => Math.hypot(p.x - z.x, p.z - z.z) < z.r);
    },

    enter(b) {
        if (this.building || !this.canEnter(b)) return;
        this._build(b, 0);
        this.building = b;
        this.group.visible = true;
        if (this._fillLight) { this._fillLight.visible = true; this._fillLight.intensity = 0.85; }

        // hide the city so an interior costs almost nothing to draw
        this._cityHidden = [];
        for (const o of G.scene.children) {
            if (o === this.group || !o.visible) continue;
            if (o.isLight) continue;
            o.visible = false;
            this._cityHidden.push(o);
        }

        this._savedColliders = G.colliders;
        this._savedPos = G.camera.position.clone();
        this._savedYaw = G.player.yaw;
        G.colliders = this._colliders.map(c => ({
            x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1
        }));
        G.floorY = FLOOR_Y;
        G.inside = b;
        G.player.teleport(0, ROOM_D / 2 - 70, 0);   // just inside the door, facing the room
        const multi = this.maxFloor > 0 ? ` · ELEVATOR: F / E at lift / 0–${this.maxFloor}` : '';
        G.ui.banner(`${b.emoji || '🏢'} ${b.name}`, 'press E at the door to leave' + multi);
        G.audio?.sfx('open');
        G.progress?.unlock('went_inside');
    },

    exit() {
        if (!this.building) return;
        this.group.visible = false;
        if (this._fillLight) this._fillLight.visible = false;
        for (const o of this._cityHidden) o.visible = true;
        this._cityHidden = [];
        G.colliders = this._savedColliders;
        G.floorY = 0;
        G.inside = null;
        this.building = null;
        this.floor = 0;
        this.maxFloor = 0;
        if (this._savedPos) {
            G.player.teleport(this._savedPos.x, this._savedPos.z, this._savedYaw);
        }
        G.audio?.sfx('close');
    },

    // distance from the player to the way out (interior-local)
    atExit() {
        if (!this.building) return false;
        const p = G.camera.position;
        return Math.abs(p.x) < DOOR_W / 2 + 30 && Math.abs(p.z - (ROOM_D / 2 - 30)) < 55;
    },

    snapshot() {
        return {
            inside: this.building?.id || null,
            floor: this.floor,
            maxFloor: this.maxFloor,
            theme: this.building ? this._theme(this.building).cat : null,
            atLift: this.atLift(),
            elevators: this.maxFloor > 0,
            specialCats: ['jail','court','embassy','mission','power','boardroom','metro','platform','underground','vc','agents','alignment','arena','cafe','gym','nursery','conference','backbone']
        };
    }
};
