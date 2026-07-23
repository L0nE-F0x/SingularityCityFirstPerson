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
        document.addEventListener('keydown', e => {
            if (!this.building || e.code !== 'KeyF' || G.panelOpen) return;
            if (this.maxFloor > 0) this.setFloor((this.floor + 1) % (this.maxFloor + 1));
        });
    },

    // Each building type gets its own palette + light mood, so entering a
    // datacenter feels nothing like entering a bar. Overrides by district
    // catch robotics/longevity, whose buildings are generic-typed.
    _theme(b) {
        const t = b.type, d = b.district, id = b.id || '';
        // specialized rooms (parity nuance)
        if (id === 'black_market' || id.includes('jail'))
            return { cat: 'jail', wall: 0x2a2e36, ceil: 0x14181e, floor: 0x3a4048, lamp: 0xff6a6a, accent: '#f472b6', dim: true };
        if (id.startsWith('court_') || id === 'court_senate' || id === 'court_hearing')
            return { cat: 'court', wall: 0xe8e0d0, ceil: 0xd8d0c0, floor: 0x8a7048, lamp: 0xfff0d0, accent: '#fbbf24' };
        if (t === 'embassy' || id.startsWith('embassy_'))
            return { cat: 'embassy', wall: 0xf0f4f8, ceil: 0xe2e8f0, floor: 0xb0b8c4, lamp: 0xfff6e2, accent: '#3b82f6' };
        if (id === 'mission_control' || t === 'dish' || id === 'tracking_station' || id === 'space_assembly')
            return { cat: 'mission', wall: 0x1a2230, ceil: 0x0e141e, floor: 0x2a3444, lamp: 0x5affc8, accent: '#22d3ee', dim: true };
        if (id.startsWith('power_') || t === 'nuclear' || t === 'coal' || t === 'solar' || t === 'wind' || t === 'dam')
            return { cat: 'power', wall: 0x3a4048, ceil: 0x242a30, floor: 0x5a6068, lamp: 0xffd23a, accent: '#fbbf24' };
        if (t === 'datacenter' || t === 'chipfab' || t === 'fab')
            return { cat: 'datacenter', wall: 0x2a3038, ceil: 0x1b2028, floor: 0x7f8a99, lamp: 0x9fd0ff, accent: '#4aa0ff' };
        if (t === 'bar')
            return { cat: 'bar', wall: 0x241826, ceil: 0x140a18, floor: 0x3a2a44, lamp: 0x8a2a6a, accent: '#e879f9', dim: true };
        if (t === 'housing' || t === 'villa' || t === 'cabin' || d === 'residential' || d === 'embassy_q')
            return { cat: 'home', wall: 0xdcc9a8, ceil: 0xe8dcc4, floor: 0xb08652, lamp: 0xffe4ac, accent: '#c8955a' };
        if (d === 'robotics')
            return { cat: 'robotics', wall: 0x8a8072, ceil: 0x46423c, floor: 0x9a9488, lamp: 0xffd090, accent: '#ff8a3a' };
        if (d === 'longevity')
            return { cat: 'longevity', wall: 0xeaf2f4, ceil: 0xdce8ea, floor: 0xcfe0e2, lamp: 0xd6fbff, accent: '#22d3cc' };
        if (t === 'university' || d === 'university')
            return { cat: 'academic', wall: 0xe2d8c4, ceil: 0xd6cab2, floor: 0x8a6a45, lamp: 0xfff0d0, accent: '#b8863a' };
        if (t === 'newspaper')
            return { cat: 'press', wall: 0xd6d0c2, ceil: 0xc8c2b2, floor: 0x9a9488, lamp: 0xfff2d0, accent: '#5a5148' };
        if (t === 'warehouse' || t === 'metro')
            return { cat: 'warehouse', wall: 0x9aa0a8, ceil: 0x686e76, floor: 0x8a9098, lamp: 0xffe6b0, accent: '#7a8590' };
        return { cat: 'office', wall: 0xe6eaf0, ceil: 0xd2d7df, floor: 0xb9bec7, lamp: 0xfff6e2, accent: '#4a6fa5' };
    },

    _floorsFor(b) {
        const th = this._theme(b);
        // multi-floor nuance for towers / civic / mission
        if (th.cat === 'office' || th.cat === 'datacenter' || th.cat === 'embassy') return 2;
        if (th.cat === 'court' || th.cat === 'mission' || th.cat === 'power') return 1;
        if ((b.fl || 0) >= 5) return 2;
        return 0;
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
        // upper floors re-skin: boardroom / residential wing flavor
        if (floorIdx > 0 && th.cat === 'office') {
            th.cat = 'boardroom';
            th.wall = 0x1e293b; th.ceil = 0x0f172a; th.floor = 0x334155; th.lamp = 0x38bdf8; th.dim = true;
        }
        if (floorIdx > 0 && th.cat === 'embassy') {
            th.accent = '#ef4444';
        }
        if (floorIdx > 0 && th.cat === 'datacenter') {
            th.cat = 'datacenter'; // NOC upper
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

        // floor indicator plaque
        lit(60, 18, 2, 200, 50, -ROOM_D / 2 + WALL / 2 + 2, 0x111827);
        this._floorLabel = `F${floorIdx}${this.maxFloor ? '/' + this.maxFloor : ''}`;

        const shell = new THREE.Mesh(mergeGeometries(parts, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
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
            new THREE.MeshLambertMaterial({ map: TEX.lobbyFloor(), color: th.floor }));
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
            // office lobby: reception desk, seating, planters, turnstiles
            box(150, 34, 46, -110, 17, -120, 0x8b6f4e);
            box(158, 5, 52, -110, 36, -120, 0xa9885f);
            solid(-110, -120, 158, 52);
            for (const [sx, sz] of [[130, -90], [190, -90], [130, -30], [190, -30]]) {
                box(38, 10, 38, sx, 16, sz, 0x3f4a5c);
                box(38, 26, 10, sx, 29, sz - 14, 0x36404f);
                solid(sx, sz, 38, 38);
            }
            for (const px of [-240, 240]) {
                box(34, 26, 34, px, 13, 150, 0x6b7280);
                box(30, 46, 30, px, 48, 150, 0x2f6b3a);
                solid(px, 150, 34, 34);
            }
            for (const gx of [-40, 40]) {
                box(16, 34, 60, gx, 17, -30, 0x767f8c);
                solid(gx, -30, 16, 60);
            }
        }

        // lift bank on the left wall (skipped for factory/bar/press/warehouse)
        if (liftBank) {
            const lwx = -ROOM_W / 2 + WALL / 2;
            for (const lz of [-120, -40, 40]) {
                box(4, 74, 56, lwx + 2, 37, lz, 0x707a88);
                box(2, 68, 50, lwx + 4.5, 37, lz, 0x39414f);
                lit(3, 4, 22, lwx + 5, 80, lz, accent.getHex());
                this._liftZones.push({ x: lwx + 20, z: lz, r: 40 });
            }
        }
        // door frame + a slab of daylight in the opening (else it's a black hole)
        box(DOOR_W + 16, 6, 6, 0, 62, ROOM_D / 2 - WALL / 2, accent.getHex());
        lit(DOOR_W + 2, 60, 2, 0, 30, ROOM_D / 2 + WALL / 2 + 1, 0xcfe0f2);
    },

    // ── enter / exit ─────────────────────────────────────────────────────────
    canEnter(b) {
        if (!b) return false;
        // power / dish now allowed for specialized control-room interiors
        const NO = new Set(['park', 'launchpad', 'crane', 'graveyard', 'billboard', 'monument']);
        return !NO.has(b.type);
    },

    setFloor(n) {
        if (!this.building) return;
        const f = Math.max(0, Math.min(this.maxFloor, n | 0));
        this._build(this.building, f);
        G.colliders = this._colliders.map(c => ({ x0: c.x0, x1: c.x1, z0: c.z0, z1: c.z1 }));
        G.player.teleport(0, ROOM_D / 2 - 70, 0);
        G.ui?.banner?.(`🛗 Floor ${f}`, this.maxFloor ? 'press F for next floor' : '');
    },

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
        const multi = this.maxFloor > 0 ? ' · F next floor' : '';
        G.ui.banner(`${b.emoji || '🏢'} ${b.name}`, 'press E at the door to leave' + multi);
        G.audio?.sfx('open');
        G.progress?.unlock('went_inside');
    },

    exit() {
        if (!this.building) return;
        this.group.visible = false;
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
            specialCats: ['jail', 'court', 'embassy', 'mission', 'power', 'boardroom']
        };
    }
};
