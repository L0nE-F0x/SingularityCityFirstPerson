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
   a handful of draw calls (merged shell + glow + floor + sign).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, EYE_H } from './state.js';
import { LABS } from './data.js';
import * as TEX from './textures.js';
import { resolveRoom, floorLabel } from './interiors/rooms.js';
import { seeded, P as PROP } from './interiors/kit.js';

export const FLOOR_Y = -4000;          // where interiors live

/* Interiors were authored roughly 3x human scale and it showed: a 9.6 m
   ceiling, a 9 m wide doorway and a 6.2 m door opening around a 1.7 m player,
   which read as being an ant in a normal building. The exterior disagreed too —
   a storey outside is FLOOR_H 24 (2.4 m), so inside and outside were 4x apart.

   Rather than re-author every prop position in this file and in every bespoke
   room under js/interiors/, the whole interior group is scaled by ROOM_SCALE
   and the few places where interior-local units meet WORLD units (colliders,
   teleports, proximity checks) convert through `S()`. At 1/3 the numbers land
   where they should: 3.2 m ceiling, 2.07 m door opening, 1.2 m handrails. */
export const ROOM_SCALE = 1 / 3;
const S = (v) => v * ROOM_SCALE;

const ROOM_W = 560, ROOM_D = 460, ROOM_H = 96;
const WALL = 12;                        // wall thickness
const DOOR_W = 90;

/* The working lift car. The bank draws three sets of doors for looks, but one
   of them is a real room you stand inside while it travels — which is the only
   way a floor change reads as a journey rather than a teleport. */
const CAR_LZ = -120;          // which of the three bays is the live car
const CAR_HALF = 30;          // half-width of the mouth, in z
const CAR_DEPTH = 96;         // how far the car extends behind the wall plane
const CAR_H = 78;             // car ceiling (26 world units ≈ 2.6 m)
const LIFT_WX = -ROOM_W / 2 + WALL / 2;   // the wall plane the doors sit in
const CAR_BACK = LIFT_WX - CAR_DEPTH;
const CAR_CX = LIFT_WX - CAR_DEPTH / 2;   // car centre, where the rider stands
const DOOR_SECS = 1.1;        // open / close time
const RIDE_PER_FLOOR = 1.15;  // travel seconds per storey
const RIDE_MIN = 1.8, RIDE_MAX = 5.5;

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
    // doors: 1 = fully open, 0 = shut. phase drives the ride state machine.
    _lift: { phase: 'idle', t: 0, doors: 1, from: 0, to: 0, dur: 0 },
    _carParts: null,

    init(scene) {
        this.group = new THREE.Group();
        this.group.position.set(0, FLOOR_Y, 0);
        this.group.scale.setScalar(ROOM_SCALE);
        this.group.visible = false;
        scene.add(this.group);
        // warm fill for interiors (tinted per-theme on enter/build)
        this._fillLight = new THREE.PointLight(0xfff0dd, 0.95, 1100, 2);
        this._fillLight.position.set(0, 72, 0);
        this._fillLight.visible = false;
        scene.add(this._fillLight);
        // secondary cool rim so metal/lift doors read
        this._rimLight = new THREE.PointLight(0xb8d4ff, 0.35, 700, 2);
        this._rimLight.position.set(-200, 50, 0);
        this._rimLight.visible = false;
        scene.add(this._rimLight);
        document.addEventListener('keydown', e => {
            if (!this.building || G.panelOpen || G.ridingMetro) return;
            // F cycles floors from anywhere indoors; digits work at the lift
            if (e.code === 'KeyF' && this.maxFloor > 0) {
                this.setFloor((this.floor + 1) % (this.maxFloor + 1));
                return;
            }
            // Interactive props (the Times printing press, exhibit terminals).
            // interact.js already owns E for lifts / exits / boarding, so we only
            // claim the key when none of those apply — no double handling.
            if (e.code === 'KeyE' && !this.atLift() && !this.atExit()) {
                const hs = this.atHotspot();
                if (hs) { this.useHotspot(hs); return; }
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
        // A bespoke layout owns its own storey count — the room list is the
        // truth, not the exterior model's fl. (Metro keeps 0=hall, 1=platform,
        // which interact.js relies on for boarding.)
        const spec = resolveRoom(b);
        if (spec) return Math.max(0, spec.floors.length - 1);
        const th = this._theme(b);
        // Metro: ticket hall (0) + platform (1) — board trains from platform
        if (th.cat === 'metro' || b.type === 'metro') return 1;
        // Real elevators: use building storeys (capped for perf / playability)
        const storeys = Math.max(1, Math.min(b.fl || 1, 14));
        if (storeys <= 1) {
            // multi-room feel for special destinations even if fl=1 in data
            if (['court', 'mission', 'power', 'vc', 'agents', 'conference', 'backbone', 'datacenter'].includes(th.cat)) return 1;
            return 0;
        }
        // floors 0..storeys-1 (lobby through top floor)
        return storeys - 1;
    },

    // ── the room ─────────────────────────────────────────────────────────────
    _build(b, floorIdx = 0) {
        // clear the previous dressing (all maps here are per-build, not shared caches)
        for (const m of [...this.group.children]) {
            this.group.remove(m);
            m.geometry?.dispose();
            if (m.material?.map) m.material.map.dispose();
            m.material?.dispose();
        }

        this.floor = floorIdx;
        this.maxFloor = this._floorsFor(b);
        const th = this._theme(b);
        const spec = resolveRoom(b);
        this._spec = spec;
        // floor re-skins: lobby / mid / top feel different
        const top = this.maxFloor > 0 && floorIdx === this.maxFloor;
        if (spec) {
            // bespoke rooms set their own per-floor mood before the shell is built
            spec.theme?.(b, floorIdx, th, this.maxFloor);
        } else if (th.cat === 'metro' && floorIdx >= 1) {
            th.cat = 'platform';
            th.wall = 0x0f172a; th.ceil = 0x020617; th.floor = 0x1e293b; th.lamp = 0xfbbf24; th.dim = true;
        } else if (floorIdx > 0 && th.cat === 'office') {
            if (top) {
                th.cat = 'boardroom';
                th.wall = 0x1e293b; th.ceil = 0x0f172a; th.floor = 0x334155; th.lamp = 0x38bdf8; th.dim = true;
            } else {
                th.cat = 'openplan'; // mid-floor cubicle farm
            }
        } else if (floorIdx > 0 && th.cat === 'embassy') {
            th.accent = top ? '#ef4444' : '#3b82f6';
            if (top) th.cat = 'boardroom';
        } else if (floorIdx > 0 && th.cat === 'vc') {
            th.cat = top ? 'boardroom' : 'vc';
            if (top) { th.wall = 0x0f172a; th.ceil = 0x020617; th.floor = 0x1e293b; th.lamp = 0xfbbf24; th.dim = true; }
        } else if (floorIdx > 0 && th.cat === 'agents') {
            th.cat = top ? 'agents' : 'agents';
        } else if (floorIdx > 0 && th.cat === 'datacenter') {
            // denser hall upstairs — same cat, dress uses floorIdx
        } else if (floorIdx > 0 && th.cat === 'bar') {
            th.cat = top ? 'bar' : 'bar'; // VIP tint on top
            if (top) { th.lamp = 0xfbbf24; th.accent = '#fbbf24'; }
        } else if (floorIdx > 0 && th.cat === 'home') {
            // keep home
        }
        const parts = [];     // lit surfaces (standard, vertex-coloured)
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
        /* Left wall. When there is a working lift the wall has to be cut open
           at the car mouth — the collider was already split there, but the
           GEOMETRY was not, so riders stood inside the car staring at the back
           face of a solid wall instead of at the doors. */
        if (this.maxFloor > 0) {
            const zA0 = -ROOM_D / 2, zA1 = CAR_LZ - CAR_HALF;
            const zB0 = CAR_LZ + CAR_HALF, zB1 = ROOM_D / 2;
            box(WALL, ROOM_H, zA1 - zA0, -ROOM_W / 2, ROOM_H / 2, (zA0 + zA1) / 2, th.wall);
            box(WALL, ROOM_H, zB1 - zB0, -ROOM_W / 2, ROOM_H / 2, (zB0 + zB1) / 2, th.wall);
            // lintel over the opening
            box(WALL, ROOM_H - CAR_H, CAR_HALF * 2, -ROOM_W / 2, CAR_H + (ROOM_H - CAR_H) / 2, CAR_LZ, th.wall);
        } else {
            box(WALL, ROOM_H, ROOM_D, -ROOM_W / 2, ROOM_H / 2, 0, th.wall);
        }
        box(WALL, ROOM_H, ROOM_D, ROOM_W / 2, ROOM_H / 2, 0, th.wall);
        box(ROOM_W, ROOM_H, WALL, 0, ROOM_H / 2, -ROOM_D / 2, th.wall);
        const sideW = (ROOM_W - DOOR_W) / 2;
        for (const s of [-1, 1]) {
            box(sideW, ROOM_H, WALL, s * (DOOR_W / 2 + sideW / 2), ROOM_H / 2, ROOM_D / 2, th.wall);
        }
        box(DOOR_W, ROOM_H - 62, WALL, 0, ROOM_H - (ROOM_H - 62) / 2, ROOM_D / 2, th.wall);
        // skirting + chair rail + accent band at head height
        box(ROOM_W - WALL, 5, 2, 0, 2.5, -ROOM_D / 2 + WALL / 2 + 1, 0x1a1a1a);
        box(ROOM_W - WALL, 3, 1.5, 0, 36, -ROOM_D / 2 + WALL / 2 + 1, 0x2a2a2a);
        lit(ROOM_W - WALL, 6, 2, 0, 62, -ROOM_D / 2 + WALL / 2 + 1, accent.getHex());
        // side-wall accent rails
        for (const sx of [-1, 1]) {
            lit(2, 4, ROOM_D - 40, sx * (ROOM_W / 2 - WALL / 2 - 1), 62, 0, accent.getHex());
            box(2, 4, ROOM_D - 40, sx * (ROOM_W / 2 - WALL / 2 - 1), 2.5, 0, 0x1a1a1a);
        }

        // ceiling light panels — colour + density set the mood
        const panels = th.dim
            ? [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]
            : [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
        // th.noPanels lets a bespoke room own its ceiling (cellars, tunnels)
        if (!th.noPanels) {
            for (const [ix, iz] of panels) lit(120, 2, 70, ix * 175, ROOM_H - 3, iz * 140, th.lamp);
            // cove LEDs along ceiling perimeter
            lit(ROOM_W - 30, 1.5, 3, 0, ROOM_H - 5, -ROOM_D / 2 + 18, th.lamp);
            lit(ROOM_W - 30, 1.5, 3, 0, ROOM_H - 5, ROOM_D / 2 - 18, th.lamp);
        }

        this._propColliders = [];
        this._liftZones = [];
        this._hotspots = [];
        if (spec) {
            this._buildRoom(spec, b, box, lit, th, accent, floorIdx);
        } else {
            this._dress(b, box, lit, th, accent, floorIdx);
            if (typeof this._enrichRoom === 'function') this._enrichRoom(box, lit, th, accent, floorIdx);
        }
        // The car is live geometry (its doors slide), so it is built after the
        // merged shell rather than into it.
        this._buildCar(th, accent);

        // lift bank + street doorway are shared furniture: every room, bespoke
        // or generic, needs them for the F / 0–9 / E contract to stay honest.
        this._liftBank(box, lit, accent);
        this._doorway(box, lit, accent);

        // floor indicator plaque (back wall)
        lit(60, 18, 2, 200, 50, -ROOM_D / 2 + WALL / 2 + 2, 0x111827);
        this._floorLabel = (spec && floorLabel(spec, floorIdx))
            || `F${floorIdx}${this.maxFloor ? '/' + this.maxFloor : ''}`;

        if (parts.length) {
            const shell = new THREE.Mesh(mergeGeometries(parts, false),
                new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.82,
                    metalness: 0.06,
                    flatShading: false
                }));
            shell.matrixAutoUpdate = false;
            this.group.add(shell);
            this._shell = shell;
        }

        if (glow.length) {
            const glowMesh = new THREE.Mesh(mergeGeometries(glow, false),
                new THREE.MeshBasicMaterial({ vertexColors: true }));
            glowMesh.matrixAutoUpdate = false;
            this.group.add(glowMesh);
        }

        // floor — polished stone, tinted per theme
        const floorGeo = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
        floorGeo.rotateX(-Math.PI / 2);
        const fuv = floorGeo.attributes.uv;
        for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * 7, fuv.getY(i) * 6);
        const floorMat = new THREE.MeshStandardMaterial({
            map: TEX.lobbyFloor(),
            color: th.floor,
            roughness: th.dim ? 0.72 : 0.48,
            metalness: th.dim ? 0.12 : 0.08
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.matrixAutoUpdate = false;
        this.group.add(floor);

        // name board on the back wall
        const signTex = TEX.lobbySign(b.name, (b.emoji || '🏢'), accentHex,
            lab ? lab.name : (b.type || '').toUpperCase());
        // Bespoke rooms dress their own back wall, so their name board goes over
        // the street door instead — you read it on the way out, not on the way in.
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(spec ? 250 : 320, spec ? 62 : 80),
            new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
        if (spec) {
            sign.position.set(0, ROOM_H - 18, ROOM_D / 2 - WALL / 2 - 3);
            sign.rotation.y = Math.PI;
        } else {
            sign.position.set(0, 74, -ROOM_D / 2 + WALL / 2 + 3);
        }
        this.group.add(sign);
        this._signMesh = sign;

        // theme-tinted fill lights
        if (this._fillLight) {
            this._fillLight.color.setHex(th.lamp);
            this._fillLight.intensity = th.dim ? 0.7 : 1.05;
            this._fillLight.position.set(0, 72, 0);
        }
        if (this._rimLight) {
            this._rimLight.color.setHex(accent.getHex());
            this._rimLight.intensity = this.maxFloor > 0 ? 0.55 : 0.3;
            this._rimLight.position.set(-ROOM_W / 2 + 40, 48, 0);
        }

        // colliders, in interior-local coords offset to world
        this._colliders = [];
        const wall = (x0, z0, x1, z1) => this._colliders.push({ x0, z0, x1, z1 });
        // Left wall — split around the car mouth when there is a working lift,
        // otherwise the player can never step into the car.
        if (this.maxFloor > 0) {
            wall(-ROOM_W / 2 - 20, -ROOM_D / 2 - 20, LIFT_WX, CAR_LZ - CAR_HALF);
            wall(-ROOM_W / 2 - 20, CAR_LZ + CAR_HALF, LIFT_WX, ROOM_D / 2 + 20);
        } else {
            wall(-ROOM_W / 2 - 20, -ROOM_D / 2 - 20, LIFT_WX, ROOM_D / 2 + 20);
        }
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
        const cat = th.cat;
        const top = this.maxFloor > 0 && floor === this.maxFloor;

        // ── small helpers (all merge into parts/glow) ───────────────────────
        const desk = (x, z, rot = 0) => {
            // simple axis-aligned desk + chair (rot ignored for merge simplicity)
            box(70, 28, 36, x, 14, z, 0x5c4033); solid(x, z, 70, 36);
            lit(24, 14, 1, x - 10, 30, z - 16, 0x1e293b);
            lit(10, 6, 8, x + 18, 30, z - 8, 0x94a3b8); // keyboard glow-ish
            box(22, 22, 22, x, 11, z + 28, 0x374151); // chair
        };
        const booth = (x, z, col = 0x3b1f3a) => {
            box(70, 36, 50, x, 18, z, col); solid(x, z, 70, 50);
            box(70, 28, 8, x, 32, z - 20, col);
            lit(50, 14, 1, x, 34, z - 10, 0x1a1020);
        };
        const plant = (x, z, h = 40) => {
            box(18, 12, 18, x, 6, z, 0x4b5563); solid(x, z, 18, 18);
            box(14, h * 0.55, 14, x, 12 + h * 0.28, z, 0x166534);
            box(20, h * 0.35, 20, x, 12 + h * 0.55, z, 0x15803d);
        };
        const screenWall = (x, y, z, w, h, col) => {
            box(w + 6, h + 6, 3, x, y, z, 0x111827);
            lit(w, h, 1.5, x, y, z + 1, col);
        };
        const rack = (x, z, ledCol) => {
            box(46, 84, 34, x, 42, z, 0x14181e); solid(x, z, 46, 34);
            box(40, 72, 1.5, x, 44, z + 17.5, 0x0a0d12);
            for (let l = 0; l < 8; l++) {
                lit(3, 3, 1, x - 14 + (l % 4) * 10, 18 + Math.floor(l / 4) * 28, z + 18, ledCol);
            }
            // front status bar
            lit(30, 2, 1, x, 78, z + 18, ledCol);
        };

        if (cat === 'jail') {
            for (let i = 0; i < 4; i++) {
                const cx = -180 + i * 100;
                box(80, 70, 60, cx, 35, -120, 0x1a1e24); solid(cx, -120, 80, 60);
                for (let bar = 0; bar < 6; bar++) lit(2, 60, 2, cx - 32 + bar * 12, 35, -88, 0x94a3b8);
                box(60, 8, 30, cx, 8, -120, 0x2a3038); // bunk
            }
            box(200, 40, 40, 0, 20, 80, 0x2a3038); solid(0, 80, 200, 40);
            box(40, 90, 40, 200, 45, -40, 0x374151); solid(200, -40, 40, 40); // guard post
            lit(120, 30, 2, 0, 50, -ROOM_D / 2 + 20, 0xff4466);
            lit(ROOM_W - 60, 2, 2, 0, ROOM_H - 8, 0, 0xff4466);
        } else if (cat === 'court') {
            box(240, 54, 54, 0, 27, -160, 0x6b5136); solid(0, -160, 240, 54);
            box(80, 8, 40, 0, 56, -160, 0x8a7048); // bench top
            box(40, 40, 40, -160, 20, -60, 0x8a7048); solid(-160, -60, 40, 40);
            box(40, 40, 40, 160, 20, -60, 0x8a7048); solid(160, -60, 40, 40);
            for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
                box(28, 18, 28, -120 + c * 40, 9, 30 + r * 38, 0x5a4634);
            }
            box(50, 50, 30, 0, 25, -100, 0x4a3828); // witness
            solid(0, -100, 50, 30);
            lit(100, 24, 2, 0, 72, -130, 0xfbbf24);
            plant(-220, 140); plant(220, 140);
        } else if (cat === 'embassy') {
            const flagCols = [0x3b82f6, 0xef4444, 0xfbbf24, 0x22c55e, 0xa855f7];
            for (let i = 0; i < 5; i++) lit(44, 32, 2, -140 + i * 60, 58, -ROOM_D / 2 + 14, flagCols[i]);
            box(170, 34, 48, 0, 17, -100, 0xc0a070); solid(0, -100, 170, 48);
            lit(50, 20, 1, 0, 42, -122, 0x1e293b);
            box(40, 60, 40, 200, 30, 100, 0xe2e8f0); solid(200, 100, 40, 40);
            box(40, 60, 40, -200, 30, 100, 0xe2e8f0); solid(-200, 100, 40, 40);
            // lounge set
            for (const [sx, sz] of [[120, 20], [180, 20], [120, 70], [180, 70]]) {
                box(36, 14, 36, sx, 7, sz, 0x64748b); solid(sx, sz, 36, 36);
            }
            box(80, 12, 40, 150, 6, 45, 0x94a3b8);
            plant(-220, 40); plant(220, -40);
            screenWall(0, 50, -ROOM_D / 2 + 16, 120, 40, 0x3b82f6);
        } else if (cat === 'mission') {
            box(400, 40, 50, 0, 20, -140, 0x1e293b); solid(0, -140, 400, 50);
            for (let i = 0; i < 10; i++) lit(36, 22, 2, -160 + i * 36, 48, -160, [0x22d3ee, 0x5affc8, 0xfbbf24][i % 3]);
            lit(300, 90, 2, 0, 50, -ROOM_D / 2 + 14, 0x0a2030);
            for (let i = 0; i < 8; i++) lit(32, 26, 2, -120 + i * 36, 50, -ROOM_D / 2 + 16, 0x1a4a60);
            // operator chairs
            for (let i = -3; i <= 3; i++) box(22, 20, 22, i * 40, 10, -90, 0x334155);
            // telemetry racks
            for (const rx of [-220, 220]) {
                box(40, 80, 30, rx, 40, 40, 0x1e293b); solid(rx, 40, 40, 30);
                for (let l = 0; l < 6; l++) lit(4, 4, 1, rx, 20 + l * 12, 56, 0x5affc8);
            }
            lit(ROOM_W - 80, 2, 2, 0, ROOM_H - 8, 0, 0x22d3ee);
        } else if (cat === 'power') {
            box(300, 60, 40, 0, 30, -150, 0x2a3038); solid(0, -150, 300, 40);
            for (let i = 0; i < 6; i++) lit(28, 28, 2, -120 + i * 48, 50, -128, 0xffd23a);
            for (const s of [-1, 1]) lit(ROOM_W - 40, 1, 8, 0, 1, s * 120, 0xfbbf24);
            box(80, 80, 80, 200, 40, 40, 0x4a5058); solid(200, 40, 80, 80);
            box(80, 80, 80, -200, 40, 40, 0x4a5058); solid(-200, 40, 80, 80);
            // hazard posts (striped)
            for (const px of [-100, 0, 100]) {
                box(10, 50, 10, px, 25, 100, 0x1a1a1a);
                for (let s = 0; s < 4; s++) lit(11, 6, 11, px, 12 + s * 12, 100, 0xfbbf24);
            }
            screenWall(0, 55, -ROOM_D / 2 + 16, 160, 50, 0xffd23a);
        } else if (cat === 'boardroom') {
            box(260, 30, 110, 0, 15, -40, 0x1e293b); solid(0, -40, 260, 110);
            lit(200, 2, 80, 0, 31, -40, 0x334155); // glass top sheen
            for (let i = -4; i <= 4; i++) {
                box(20, 24, 20, i * 28, 12, -110, 0x334155);
                box(20, 24, 20, i * 28, 12, 30, 0x334155);
            }
            screenWall(0, 50, -ROOM_D / 2 + 14, 200, 70, 0x38bdf8);
            for (let i = 0; i < 5; i++) lit(30, 20, 1, -80 + i * 40, 48, -ROOM_D / 2 + 16, 0x22c55e);
            plant(-230, 120); plant(230, 120);
            box(50, 40, 30, 200, 20, 100, 0x0f172a); solid(200, 100, 50, 30); // sideboard
            lit(12, 20, 12, -200, 28, 80, 0xfde68a);
        } else if (cat === 'openplan') {
            // mid-floor cubicle farm — dense intentional office
            for (let row = 0; row < 3; row++) {
                for (let col = 0; col < 4; col++) {
                    const x = -160 + col * 90, z = -100 + row * 80;
                    box(70, 40, 4, x, 20, z - 18, 0xcbd5e1); // partition
                    box(4, 40, 50, x - 32, 20, z, 0xcbd5e1);
                    desk(x, z);
                }
            }
            // printer / pantry
            box(50, 40, 40, 220, 20, -140, 0x64748b); solid(220, -140, 50, 40);
            lit(30, 10, 1, 220, 36, -118, 0x38bdf8);
            box(80, 36, 40, -220, 18, 120, 0x5c4033); solid(-220, 120, 80, 40);
            lit(20, 8, 20, -220, 40, 120, 0xffe4ac);
            screenWall(0, 55, -ROOM_D / 2 + 14, 140, 40, 0x4aa0ff);
            plant(240, 140); plant(-240, 140);
        } else if (cat === 'datacenter') {
            // NOC + cold-aisle racks
            box(180, 34, 48, -150, 17, -160, 0x1c2128); solid(-150, -160, 180, 48);
            for (const mx of [-200, -150, -100]) lit(36, 24, 2, mx, 44, -180, 0x2aa0ff);
            const rows = floor > 0 ? 3 : 2;
            for (let row = 0; row < rows; row++) {
                for (let i = 0; i < 6; i++) {
                    const rx = -150 + i * 62, rz = -50 + row * 70;
                    const col = [0x39ff88, 0x2aa0ff, 0xffd23a][(i + row) % 3];
                    rack(rx, rz, col);
                }
                box(400, 4, 12, -90, 82, -50 + row * 70, 0x3a4048); // cable tray
                lit(380, 1, 2, -90, 84, -50 + row * 70, 0x2aa0ff);
            }
            // cold aisle floor strips
            for (let row = 0; row < rows; row++) lit(360, 1, 8, -90, 1.2, -50 + row * 70, 0x0ea5e9);
            // CRAC units
            for (const cx of [-240, 240]) {
                box(36, 70, 40, cx, 35, 140, 0x475569); solid(cx, 140, 36, 40);
                lit(20, 8, 1, cx, 60, 160, 0x22d3ee);
            }
            screenWall(120, 50, -ROOM_D / 2 + 14, 100, 50, 0x2aa0ff);
        } else if (cat === 'bar') {
            // long bar + bottles + stools + booths + dance floor
            box(340, 40, 42, 0, 20, -150, 0x2a1c14);
            box(346, 5, 48, 0, 42, -150, 0x5a3a22);
            solid(0, -150, 346, 48);
            for (let i = 0; i < 16; i++) {
                const bx = -170 + i * 22;
                lit(7, 22, 7, bx, 62, -172, [0xff5a8a, 0x5affc8, 0xffd23a, 0x8a5aff][i % 4]);
            }
            box(320, 28, 6, 0, 72, -176, 0x160e12);
            for (let i = -5; i <= 5; i++) {
                box(16, 26, 16, i * 30, 13, -108, 0x241a20);
                box(20, 4, 20, i * 30, 27, -108, 0x8a2a6a);
                solid(i * 30, -108, 16, 16);
            }
            // booths along right
            for (let i = 0; i < 3; i++) booth(200, -40 + i * 70, 0x2a1830);
            // stage / karaoke left-back
            box(100, 12, 80, -200, 6, 80, 0x1a1020); solid(-200, 80, 100, 80);
            lit(80, 40, 2, -200, 50, 40, top ? 0xfbbf24 : 0xe879f9);
            for (const s of [-1, 1]) lit(2, 4, 320, s * (ROOM_W / 2 - WALL), 66, -10, s > 0 ? 0xe879f9 : 0x5affc8);
            for (let gx = -1; gx <= 1; gx++) for (let gz = 0; gz <= 2; gz++)
                lit(44, 1, 44, gx * 55, 1.5, 50 + gz * 48, [0xe879f9, 0x5affc8, 0x8a5aff][(gx + gz + 2) % 3]);
            // DJ booth
            box(60, 30, 40, 0, 15, 140, 0x1a1020); solid(0, 140, 60, 40);
            lit(40, 16, 1, 0, 34, 120, 0xf472b6);
        } else if (cat === 'home') {
            box(190, 26, 78, 96, 13, -140, 0x8a6a4a);
            box(190, 30, 18, 96, 30, -170, 0x9a785a);
            solid(96, -140, 190, 78);
            box(120, 6, 68, 96, 22, -46, 0x6d5238);
            box(150, 84, 8, -150, 42, -172, 0x5a4634);
            lit(96, 54, 2, -150, 46, -167, 0x1a2a3a);
            for (let sh = 0; sh < 4; sh++) box(90, 4, 24, -150, 14 + sh * 22, -150, 0x7a5c40);
            // kitchen island
            box(100, 36, 50, -180, 18, 40, 0xd4c4a8); solid(-180, 40, 100, 50);
            lit(16, 10, 16, -180, 40, 40, 0xffe4ac);
            plant(250, 150, 50);
            lit(10, 44, 10, -250, 46, 150, 0xffe0a0);
            box(230, 2, 150, 60, 1.5, 40, 0x9a4a4a);
            // dining
            box(90, 28, 50, 160, 14, 100, 0x6d5238); solid(160, 100, 90, 50);
            for (const s of [-1, 1]) box(18, 22, 18, 160 + s * 40, 11, 100, 0x5a4634);
        } else if (cat === 'robotics') {
            box(360, 22, 60, -20, 11, -140, 0x3a3f46);
            box(360, 3, 56, -20, 24, -140, 0x1a1c20);
            for (let i = 0; i < 9; i++) box(4, 26, 60, -190 + i * 42, 13, -140, 0x2a2e34);
            solid(-20, -140, 360, 60);
            // robot arm
            box(40, 14, 40, 150, 7, -60, 0x2a2e34); solid(150, -60, 40, 40);
            box(20, 44, 20, 150, 32, -60, 0xff8a3a);
            box(58, 14, 14, 175, 54, -60, 0xffa85a);
            box(14, 30, 14, 200, 40, -60, 0x2a2e34);
            for (const [cx, cz] of [[-230, 40], [-190, 40], [-210, 76], [-150, 60]]) {
                box(36, 30, 36, cx, 15, cz, 0x8a6a3a); solid(cx, cz, 36, 36);
            }
            box(6, 60, 6, 240, 30, -60, 0x2a2e34);
            for (const s of [-1, 1]) lit(ROOM_W - 40, 1, 6, 0, 1, s * 100, 0xffb020);
            lit(70, 30, 2, 250, 46, -150, 0x39ff88);
            // workbench
            box(120, 32, 50, 0, 16, 80, 0x4a453c); solid(0, 80, 120, 50);
            for (let i = 0; i < 4; i++) lit(8, 8, 8, -30 + i * 20, 36, 70, 0xff8a3a);
        } else if (cat === 'longevity') {
            for (const bx of [-200, 200]) {
                box(60, 30, 180, bx, 15, -40, 0xdfe8ea); solid(bx, -40, 60, 180);
                for (let i = 0; i < 10; i++) lit(5, 12, 5, bx - 20 + (i % 5) * 10, 36, -100 + Math.floor(i / 5) * 28, [0x39ffcc, 0xff6ab0, 0xffe23a, 0x6aa0ff][i % 4]);
            }
            for (const sx of [-150, 0, 150]) {
                box(50, 78, 30, sx, 39, -172, 0xeef4f6); solid(sx, -172, 50, 30);
                for (let l = 0; l < 8; l++) lit(4, 4, 1, sx - 16 + (l % 4) * 11, 30 + Math.floor(l / 4) * 24, -156, 0x22d3cc);
            }
            for (let i = 0; i < 22; i++) {
                const y = 8 + i * 4, a = i * 0.5;
                lit(7, 5, 7, 40 + Math.cos(a) * 26, y, 40, 0x4aa0ff);
                lit(7, 5, 7, 40 - Math.cos(a) * 26, y, 40, 0xff6ab0);
                if (i % 2 === 0) box(52, 2, 2, 40, y, 40, 0xcfe0e2);
            }
            solid(40, 40, 20, 20);
            // centrifuge + fridge
            box(30, 40, 30, -80, 20, 120, 0xcbd5e1); solid(-80, 120, 30, 30);
            lit(16, 6, 1, -80, 36, 136, 0x22d3cc);
            box(40, 70, 30, 120, 35, 130, 0xe2e8f0); solid(120, 130, 40, 30);
            lit(4, 50, 1, 120, 40, 146, 0x4ade80);
        } else if (cat === 'academic') {
            for (const sx of [-235, 235]) {
                box(30, 96, 280, sx, 48, -10, 0x6b5136); solid(sx, -10, 30, 280);
                for (let sh = 0; sh < 5; sh++) box(26, 4, 270, sx, 18 + sh * 18, -10, 0x8a6a45);
                for (let sh = 0; sh < 5; sh++) for (let bk = 0; bk < 22; bk++)
                    box(3, 14, 11, sx + (sx > 0 ? -13 : 13), 26 + sh * 18, -140 + bk * 12, [0x9a3a3a, 0x3a5a9a, 0x3a7a4a, 0xb8863a][bk % 4]);
            }
            for (const [tx, tz] of [[-70, -40], [70, -40], [-70, 60], [70, 60], [0, 10]]) {
                box(80, 30, 44, tx, 15, tz, 0x6d5238); solid(tx, tz, 80, 44);
                lit(14, 22, 8, tx, 40, tz, 0xffe6a0);
            }
            box(50, 40, 34, 0, 20, -160, 0x5a4634);
            plant(0, 140);
        } else if (cat === 'press') {
            box(280, 70, 90, -20, 35, -140, 0x3a4048); solid(-20, -140, 280, 90);
            for (let i = 0; i < 5; i++) box(84, 26, 8, -140 + i * 60, 40, -95, 0x22262c);
            for (const [px, pz] of [[180, 40], [220, 40], [180, 90], [220, 90]]) {
                box(50, 40, 60, px, 20, pz, 0xe8e4d8); solid(px, pz, 50, 60);
            }
            lit(120, 24, 2, -20, 52, -94, 0x39ff88);
            // newsroom desks
            for (let i = 0; i < 3; i++) desk(-100 + i * 90, 80);
            screenWall(0, 55, -ROOM_D / 2 + 14, 160, 40, 0xfbbf24);
        } else if (cat === 'metro') {
            // ticket hall
            for (const gx of [-60, -20, 20, 60]) {
                box(14, 40, 70, gx, 20, 10, 0x64748b); solid(gx, 10, 14, 70);
            }
            for (const mx of [-210, -140, 140, 210]) {
                box(42, 52, 26, mx, 26, -140, 0x1e293b); solid(mx, -140, 42, 26);
                lit(32, 22, 1, mx, 42, -126, 0x22d3ee);
            }
            // escalator well
            box(90, 4, 130, 180, 2, 40, 0x0ea5e9);
            for (let i = 0; i < 10; i++) box(80, 3, 12, 180, 3 + i * 5.5, 90 - i * 12, 0x334155);
            lit(4, 50, 4, 140, 30, 40, 0xfbbf24); // handrail glow posts
            lit(4, 50, 4, 220, 30, 40, 0xfbbf24);
            // departure board
            box(220, 50, 8, 0, 55, -ROOM_D / 2 + 20, 0x0f172a);
            lit(200, 40, 2, 0, 55, -ROOM_D / 2 + 14, 0x22d3ee);
            for (let i = 0; i < 4; i++) lit(40, 8, 1, -75 + i * 50, 40, -ROOM_D / 2 + 16, 0x4ade80);
            // map kiosk
            box(30, 60, 20, -180, 30, 100, 0x334155); solid(-180, 100, 30, 20);
            lit(24, 40, 1, -180, 36, 112, 0x38bdf8);
            plant(240, 140, 30);
        } else if (cat === 'platform') {
            box(ROOM_W - 40, 2, 40, 0, 1, -160, 0xfbbf24);
            lit(ROOM_W - 80, 1, 6, 0, 1.5, -150, 0xfde68a);
            box(ROOM_W - 20, 18, 80, 0, -6, -200, 0x020617);
            for (const rail of [-12, 12]) box(ROOM_W - 40, 2, 3, 0, 1, -200 + rail, 0x64748b);
            // sleepers
            for (let i = 0; i < 12; i++) box(40, 2, 8, -220 + i * 40, 0.5, -200, 0x3f3f46);
            for (const bx of [-200, -100, 0, 100, 200]) {
                box(50, 12, 18, bx, 6, -40, 0x334155); solid(bx, -40, 50, 18);
                box(50, 8, 4, bx, 14, -48, 0x475569); // backrest
            }
            for (const px of [-220, -70, 70, 220]) {
                box(16, ROOM_H - 8, 16, px, ROOM_H / 2, -20, 0x475569); solid(px, -20, 16, 16);
            }
            // ad panels + next train
            for (let i = 0; i < 4; i++) lit(50, 30, 1.5, -150 + i * 100, 48, -ROOM_D / 2 + 14, [0x22d3ee, 0xf472b6, 0xfbbf24, 0x4ade80][i]);
            lit(160, 32, 2, 0, 62, -ROOM_D / 2 + 14, 0x22d3ee);
            lit(ROOM_W - 60, 2, 2, 0, ROOM_H - 8, 0, 0xfbbf24);
            // vending
            box(30, 50, 24, 220, 25, 80, 0x1e293b); solid(220, 80, 30, 24);
            lit(20, 30, 1, 220, 30, 93, 0xf472b6);
            // tunnel mouth dark
            box(120, 50, 20, -ROOM_W / 2 + 40, 25, -200, 0x020617);
            box(120, 50, 20, ROOM_W / 2 - 40, 25, -200, 0x020617);
        } else if (cat === 'underground') {
            // speakeasy black market
            box(220, 36, 50, 0, 18, -140, 0x3b1f3a); solid(0, -140, 220, 50);
            lit(200, 10, 2, 0, 52, -140, 0xf472b6);
            for (let i = 0; i < 14; i++) lit(6, 18, 6, -130 + i * 20, 58, -162, [0xf472b6, 0xa855f7, 0x22d3ee][i % 3]);
            for (const bx of [-200, -70, 70, 200]) booth(bx, 40, 0x1a1020);
            for (const [cx, cz] of [[-200, 130], [200, 130], [0, 150], [-100, 150], [100, 150]]) {
                box(40, 30, 40, cx, 15, cz, 0x4a3040); solid(cx, cz, 40, 40);
            }
            lit(ROOM_W - 40, 2, 2, 0, ROOM_H - 6, 0, 0xf472b6);
            // velvet rope posts
            for (const px of [-80, 80]) {
                box(6, 40, 6, px, 20, -60, 0xfbbf24);
                lit(4, 4, 4, px, 42, -60, 0xf472b6);
            }
            screenWall(0, 50, -ROOM_D / 2 + 14, 140, 40, 0xa855f7);
        } else if (cat === 'vc') {
            box(210, 28, 95, 0, 14, -40, 0x0f172a); solid(0, -40, 210, 95);
            lit(180, 2, 70, 0, 29, -40, 0x334155);
            for (let i = -3; i <= 3; i++) box(18, 22, 18, i * 32, 11, -105, 0x1e293b);
            for (let i = -2; i <= 2; i++) box(18, 22, 18, i * 36, 11, 30, 0x1e293b);
            screenWall(0, 50, -ROOM_D / 2 + 14, 220, 70, 0xfbbf24);
            for (let i = 0; i < 7; i++) lit(28, 16, 1, -105 + i * 36, 48, -ROOM_D / 2 + 16, 0x22c55e);
            plant(220, 100, 48); plant(-220, 100, 48);
            lit(12, 20, 12, -220, 30, 40, 0xfde68a);
            // champagne sideboard + deal wall
            box(60, 36, 30, 200, 18, -140, 0x1e293b); solid(200, -140, 60, 30);
            lit(8, 16, 8, 190, 40, -140, 0xfde68a);
            lit(8, 16, 8, 210, 40, -140, 0xfde68a);
            box(40, 70, 8, -200, 35, -160, 0x0f172a);
            lit(30, 50, 1, -200, 40, -155, 0x22c55e);
        } else if (cat === 'agents') {
            for (let i = 0; i < 6; i++) {
                box(42, 74, 32, -210 + i * 80, 37, -140, 0x312e81); solid(-210 + i * 80, -140, 42, 32);
                lit(32, 22, 1, -210 + i * 80, 52, -123, [0xa78bfa, 0x22d3ee, 0xf472b6][i % 3]);
            }
            // message bus
            box(400, 8, 44, 0, 4, 40, 0x1e1b4b);
            for (let i = 0; i < 14; i++) lit(18, 4, 4, -180 + i * 28, 10, 40, [0xa78bfa, 0x22d3ee][i % 2]);
            screenWall(0, 50, -ROOM_D / 2 + 14, 180, 55, 0x6366f1);
            // sandbox pods
            for (const sx of [-160, 0, 160]) {
                box(70, 50, 50, sx, 25, 120, 0x1e1b4b); solid(sx, 120, 70, 50);
                lit(50, 30, 1, sx, 40, 96, 0xa78bfa);
            }
            // operator desks
            desk(-100, -40); desk(100, -40);
        } else if (cat === 'alignment') {
            box(ROOM_W - 40, 8, 8, 0, ROOM_H - 10, 0, 0x5c4033);
            box(ROOM_W - 80, 6, 6, 0, ROOM_H - 10, -80, 0x5c4033);
            box(220, 60, 8, 0, 40, -ROOM_D / 2 + 16, 0x3f4f3a);
            lit(200, 44, 1, 0, 42, -ROOM_D / 2 + 18, 0x86efac);
            for (const [tx, tz] of [[-120, -40], [120, -40], [0, 60], [-120, 80], [120, 80]]) {
                box(70, 28, 40, tx, 14, tz, 0x6b5136); solid(tx, tz, 70, 40);
            }
            box(40, 50, 40, 200, 25, 140, 0x2f6b3a); solid(200, 140, 40, 40);
            lit(8, 40, 8, -220, 40, 80, 0xfde68a);
            // chalkboards side
            lit(60, 40, 1, ROOM_W / 2 - 20, 48, -40, 0x1a2e1a);
            lit(60, 40, 1, ROOM_W / 2 - 20, 48, 40, 0x1a2e1a);
            plant(-200, 140); plant(0, 150);
        } else if (cat === 'arena') {
            box(180, 8, 180, 0, 4, -20, 0xf97316);
            box(160, 2, 160, 0, 8, -20, 0x1a1a22);
            for (let r = 0; r < 3; r++) for (let a = 0; a < 10; a++) {
                const ang = a * Math.PI / 5;
                const rad = 100 + r * 38;
                box(36, 12 + r * 8, 28, Math.cos(ang) * rad, 6 + r * 10, -20 + Math.sin(ang) * rad, 0x374151);
            }
            lit(220, 60, 2, 0, 55, -ROOM_D / 2 + 14, 0xfbbf24);
            for (let i = 0; i < 5; i++) lit(36, 28, 1, -100 + i * 50, 50, -ROOM_D / 2 + 16, 0x22d3ee);
            // score pylons
            for (const sx of [-1, 1]) {
                box(20, 70, 20, sx * 200, 35, 120, 0x1f2937); solid(sx * 200, 120, 20, 20);
                lit(14, 20, 1, sx * 200, 60, 132, 0xf97316);
            }
        } else if (cat === 'cafe') {
            box(170, 34, 52, -100, 17, -120, 0x8b5a2b); solid(-100, -120, 170, 52);
            for (let i = 0; i < 8; i++) lit(6, 14, 6, -160 + i * 18, 48, -145, [0xfbbf24, 0xd97706][i % 2]);
            for (const [sx, sz] of [[80, -80], [140, -80], [80, -20], [140, -20], [80, 40], [140, 40], [80, 100], [140, 100], [-40, 80], [20, 80]]) {
                box(28, 16, 28, sx, 8, sz, 0x6d5238); solid(sx, sz, 28, 28);
                box(12, 20, 12, sx, 18, sz + 18, 0x5a4634);
            }
            lit(70, 40, 2, -100, 48, -148, 0xffe4ac);
            plant(220, 100); plant(-220, 100);
            for (let i = 0; i < 6; i++) lit(8, 8, 8, -200 + i * 18, 50, 100, 0xfbbf24);
            // pastry case
            box(80, 40, 30, 200, 20, -120, 0xe2e8f0); solid(200, -120, 80, 30);
            lit(60, 20, 1, 200, 36, -104, 0xffe4ac);
        } else if (cat === 'gym') {
            for (const gx of [-180, 0, 180]) {
                box(50, 20, 130, gx, 10, -40, 0x1f2937); solid(gx, -40, 50, 130);
                for (let i = 0; i < 5; i++) box(40, 8, 8, gx, 18 + i * 12, -90 + i * 28, 0x6b7280);
            }
            box(120, 4, 120, 0, 2, 110, 0x0ea5e9);
            lit(90, 30, 2, 0, 50, -ROOM_D / 2 + 14, 0x38bdf8);
            // mirrors
            lit(2, 50, 100, ROOM_W / 2 - 16, 40, -40, 0xbae6fd);
            // bike row
            for (let i = 0; i < 4; i++) {
                box(30, 30, 60, -150 + i * 50, 15, 80, 0x374151); solid(-150 + i * 50, 80, 30, 60);
            }
        } else if (cat === 'nursery') {
            for (const cx of [-180, -60, 60, 180]) {
                box(50, 30, 40, cx, 15, -100, 0xf9a8d4); solid(cx, -100, 50, 40);
                box(40, 20, 30, cx, 12, -40, 0xfbcfe8);
                lit(20, 10, 1, cx, 28, -55, 0xfda4af);
            }
            lit(120, 40, 2, 0, 50, -ROOM_D / 2 + 14, 0xf472b6);
            box(60, 40, 40, 0, 20, 80, 0xfde68a); solid(0, 80, 60, 40);
            // toys / mats
            for (let i = 0; i < 5; i++) lit(20, 4, 20, -80 + i * 40, 2, 130, [0xf472b6, 0x38bdf8, 0x4ade80, 0xfbbf24, 0xa78bfa][i]);
            plant(-230, 140, 30); plant(230, 140, 30);
        } else if (cat === 'conference') {
            box(300, 30, 130, 0, 15, -40, 0x4338ca); solid(0, -40, 300, 130);
            for (let i = -5; i <= 5; i++) box(20, 22, 20, i * 28, 11, -125, 0x6366f1);
            for (let i = -4; i <= 4; i++) box(20, 22, 20, i * 30, 11, 40, 0x6366f1);
            lit(260, 80, 2, 0, 50, -ROOM_D / 2 + 14, 0xa5b4fc);
            for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
                box(24, 16, 24, -140 + c * 40, 8, 70 + r * 36, 0x4f46e5);
            }
            // AV booth
            box(50, 40, 40, 220, 20, -140, 0x312e81); solid(220, -140, 50, 40);
            lit(30, 16, 1, 220, 36, -118, 0x818cf8);
            plant(-230, 140);
        } else if (cat === 'backbone') {
            for (let i = 0; i < 9; i++) {
                box(30, 80, 40, -220 + i * 52, 40, -120, 0x0e7490); solid(-220 + i * 52, -120, 30, 40);
                for (let l = 0; l < 7; l++) lit(4, 4, 1, -220 + i * 52, 16 + l * 11, -98, [0x22d3ee, 0x4ade80, 0xfbbf24][l % 3]);
            }
            lit(180, 70, 2, 0, 50, -ROOM_D / 2 + 14, 0x06b6d4);
            box(90, 55, 90, 0, 28, 90, 0x164e63); solid(0, 90, 90, 90);
            lit(50, 30, 1, 0, 50, 136, 0x22d3ee);
            // fiber spools
            for (const fx of [-180, 180]) {
                box(40, 30, 40, fx, 15, 120, 0x0e7490); solid(fx, 120, 40, 40);
                lit(20, 6, 1, fx, 32, 140, 0x22d3ee);
            }
        } else if (cat === 'warehouse') {
            for (const sx of [-200, 0, 200]) {
                box(50, 88, 240, sx, 44, -20, 0x5a6068); solid(sx, -20, 50, 240);
                for (let sh = 0; sh < 4; sh++) box(46, 4, 230, sx, 20 + sh * 22, -20, 0x7a828c);
                for (let sh = 0; sh < 4; sh++) for (let cr = 0; cr < 4; cr++)
                    box(40, 16, 40, sx, 30 + sh * 22, -120 + cr * 60, [0x8a6a3a, 0x6a7a8a, 0x7a5a4a, 0x5a6a4a][cr % 4]);
            }
            // forklift silhouette
            box(50, 40, 70, 0, 20, 140, 0xfbbf24); solid(0, 140, 50, 70);
            box(20, 50, 20, 0, 45, 160, 0xf59e0b);
        } else {
            // office lobby: reception, lounge, coffee, art, turnstiles, planters
            box(160, 34, 48, -110, 17, -120, 0x8b6f4e);
            box(168, 5, 54, -110, 36, -120, 0xa9885f);
            lit(44, 18, 1, -110, 42, -145, 0x1a2a3a);
            solid(-110, -120, 168, 54);
            for (const [sx, sz] of [[130, -90], [190, -90], [130, -30], [190, -30], [130, 40], [190, 40], [130, 100], [190, 100]]) {
                box(38, 12, 38, sx, 16, sz, 0x3f4a5c);
                box(38, 26, 10, sx, 29, sz - 14, 0x36404f);
                solid(sx, sz, 38, 38);
            }
            box(100, 36, 42, -200, 18, 40, 0x5c4033); solid(-200, 40, 100, 42);
            lit(22, 8, 22, -200, 42, 40, 0xffe4ac);
            for (let i = 0; i < 4; i++) lit(36, 28, 1.5, -100 + i * 50, 55, -ROOM_D / 2 + 14, [0x4aa0ff, 0xe879f9, 0x22d3cc, 0xfbbf24][i]);
            box(180, 1.5, 110, 40, 1, 70, 0x4a5568);
            box(70, 14, 44, 40, 8, 70, 0x6d5238);
            for (const px of [-240, 240]) {
                box(34, 26, 34, px, 13, 150, 0x6b7280);
                box(30, 46, 30, px, 48, 150, 0x2f6b3a);
                solid(px, 150, 34, 34);
            }
            for (const gx of [-40, 40]) {
                box(16, 34, 60, gx, 17, -30, 0x767f8c);
                solid(gx, -30, 16, 60);
            }
            box(18, 70, 18, 230, 35, -40, 0x2a3340); solid(230, -40, 18, 18);
            lit(14, 40, 1, 230, 40, -30, 0x38bdf8);
            // waiting chairs row
            for (let i = 0; i < 5; i++) box(28, 18, 28, -180 + i * 36, 9, 140, 0x475569);
        }

    },

    /** Signature contents for a registry room. Wraps the merge buckets in the
     *  richer context room builders speak (plates, NPCs, seeded randomness). */
    _buildRoom(spec, b, box, lit, th, accent, floorIdx) {
        const self = this;
        const solid = (x, z, w, d) => this._propColliders.push(
            { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        const ctx = {
            box, lit, solid,
            /** Textured quad (canvas art). Kept out of the merge buckets because
             *  each one carries its own map; rooms use them sparingly. */
            plate(tex, w, h, x, y, z, rotY = 0) {
                const m = new THREE.Mesh(
                    new THREE.PlaneGeometry(w, h),
                    new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
                m.position.set(x, y, z);
                if (rotY) m.rotation.y = rotY;
                self.group.add(m);
                return m;
            },
            /** A named staffer — geometry merges, nameplate is a plate. */
            npc(c, x, z, def, facing = 1) { PROP.npc(c, x, z, def, facing); },
            /** Press-E point of interest (printing press, exhibits, terminals). */
            hotspot(x, z, r, label, action) { self._hotspots.push({ x, z, r, label, action }); },
            W: ROOM_W, D: ROOM_D, H: ROOM_H, WALL, DOOR_W,
            // staff rosters rotate on the city clock exactly like the 2D app's do
            night: (G.dayPhase == null) ? false : (G.dayPhase > 0.83 || G.dayPhase < 0.25),
            b, th, floor: floorIdx, maxFloor: this.maxFloor,
            accent: accent.getHex(), accentCss: '#' + accent.getHexString(),
            rnd: seeded(`${b.id || 'x'}:${floorIdx}`)
        };
        const f = spec.floors[Math.max(0, Math.min(spec.floors.length - 1, floorIdx))];
        f.build(ctx);
    },

    /** Monumental lift bank on the left wall — only when multi-floor, so the
     *  F / E / 0–9 controls and their prompts never promise a lift that isn't
     *  there. Shared by generic and bespoke rooms alike. */
    _liftBank(box, lit, accent) {
        if (this.maxFloor > 0) {
            const lwx = -ROOM_W / 2 + WALL / 2;
            // full-height brushed steel alcove behind all three cars
            box(14, ROOM_H - 6, 280, lwx + 8, ROOM_H / 2, -40, 0x6b7280);
            box(4, ROOM_H - 10, 270, lwx + 14, ROOM_H / 2, -40, 0x374151);
            // glowing LIFTS header plaque
            lit(10, 18, 90, lwx + 16, 88, -40, accent.getHex());
            lit(6, 10, 70, lwx + 18, 88, -40, 0x0ea5e9);
            // wayfinding floor stripe to the bank
            lit(80, 1.2, 8, lwx + 55, 1.1, -40, accent.getHex());
            lit(8, 1.2, 220, lwx + 55, 1.1, -40, 0x0ea5e9);
            // mat in front of bank
            box(70, 1.5, 240, lwx + 48, 0.8, -40, 0x1f2937);

            for (const lz of [-120, -40, 40]) {
                // outer frame (chrome)
                box(10, 86, 64, lwx + 10, 43, lz, 0x9ca3af);
                // inner dark doors with center seam
                box(3, 78, 28, lwx + 15, 42, lz - 14, 0x111827);
                box(3, 78, 28, lwx + 15, 42, lz + 14, 0x111827);
                lit(2, 70, 2, lwx + 16, 42, lz, 0x38bdf8); // door seam glow
                // call lantern (hall lantern) above
                lit(8, 6, 28, lwx + 18, 90, lz, accent.getHex());
                // digital floor display
                lit(22, 10, 3, lwx + 20, 82, lz, 0x0ea5e9);
                // call button plate
                box(5, 18, 12, lwx + 20, 48, lz + 30, 0x1f2937);
                lit(3, 4, 4, lwx + 22, 52, lz + 30, 0x4ade80);
                lit(3, 4, 4, lwx + 22, 44, lz + 30, 0xfbbf24);
                // car interior glow bleed under doors
                lit(4, 4, 40, lwx + 18, 4, lz, 0xfef3c7);
                this._liftZones.push({ x: lwx + 36, z: lz, r: 78 });
            }
            // floor directory panel next to bank
            box(10, 100, 56, lwx + 22, 50, 120, 0x0f172a);
            lit(3, 84, 44, lwx + 26, 50, 120, 0x38bdf8);
            for (let i = 0; i <= Math.min(this.maxFloor, 9); i++) {
                lit(2, 5, 30, lwx + 28, 20 + i * 8, 120, i === this.floor ? 0x4ade80 : 0x1e3a5f);
            }
            // chrome handrail along approach
            box(4, 4, 200, lwx + 70, 36, -40, 0x9ca3af);
        }
    },

    /** Street doorway surround + the daylight slab that marks the way out. */
    _doorway(box, lit, accent) {
        box(DOOR_W + 16, 6, 6, 0, 62, ROOM_D / 2 - WALL / 2, accent.getHex());
        box(6, 62, 6, -DOOR_W / 2 - 4, 31, ROOM_D / 2 - WALL / 2, accent.getHex());
        box(6, 62, 6, DOOR_W / 2 + 4, 31, ROOM_D / 2 - WALL / 2, accent.getHex());
        lit(DOOR_W + 2, 60, 2, 0, 30, ROOM_D / 2 + WALL / 2 + 1, 0xcfe0f2);
    },

    // ── enter / exit ─────────────────────────────────────────────────────────

    /** Extra prop density — theme-aware dressing layer for every room. */
    _enrichRoom(box, lit, th, accent, floor = 0) {
        if (!this._propColliders) this._propColliders = [];
        const solid = (x, z, w, d) => this._propColliders.push(
            { x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
        const acc = (accent && accent.getHex) ? accent.getHex() : 0x4a6fa5;
        const cat = th?.cat || 'office';
        const industrial = ['robotics', 'datacenter', 'platform', 'warehouse', 'arena', 'gym', 'power', 'backbone'].includes(cat);
        const nightlife = ['bar', 'underground'].includes(cat);

        // corner structural columns
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            box(12, ROOM_H - 8, 12, sx * (ROOM_W / 2 - 26), ROOM_H / 2, sz * (ROOM_D / 2 - 26), th.wall);
            lit(4, 8, 4, sx * (ROOM_W / 2 - 26), 70, sz * (ROOM_D / 2 - 26), th.lamp);
        }

        // centre area rug (skip tracks / industrial)
        if (!['platform', 'warehouse', 'arena', 'gym', 'datacenter'].includes(cat)) {
            const rug = nightlife ? 0x4a1942 : industrial ? 0x374151 : 0x3b4558;
            box(220, 1.2, 150, 30, 0.7, 10, rug);
            box(200, 1.3, 8, 30, 0.9, -60, acc); // accent edge
        }

        // planter pair near entrance (not platform)
        if (cat !== 'platform' && cat !== 'jail') {
            for (const px of [-250, 250]) {
                box(24, 16, 24, px, 8, 170, 0x4b5563); solid(px, 170, 24, 24);
                box(18, 34, 18, px, 34, 170, 0x166534);
                box(26, 16, 26, px, 48, 170, 0x15803d);
            }
        }

        // wall sconces — denser on dim themes
        const sconceY = 52;
        for (const sx of [-1, 1]) {
            lit(8, 6, 5, sx * 180, sconceY, -ROOM_D / 2 + 18, th.lamp);
            lit(8, 6, 5, sx * 80, sconceY, -ROOM_D / 2 + 18, th.lamp);
            lit(5, 8, 6, sx * (ROOM_W / 2 - 18), sconceY, -80, th.lamp);
            lit(5, 8, 6, sx * (ROOM_W / 2 - 18), sconceY, 60, th.lamp);
        }

        // pendant cluster
        for (const px of [-120, 0, 120]) {
            box(2, 14, 2, px, ROOM_H - 16, -20, 0x64748b);
            lit(16, 4, 16, px, ROOM_H - 10, -20, th.lamp);
        }

        // side console / info desk — skip heavy industrial
        if (!industrial) {
            box(110, 28, 38, 200, 14, 10, nightlife ? 0x3b1f3a : 0x5c4033); solid(200, 10, 110, 38);
            lit(48, 18, 1, 200, 32, -8, 0x1e293b);
            box(16, 34, 16, 235, 17, 50, 0x374151);
            lit(10, 6, 10, 235, 36, 50, th.lamp);
        }

        // art / poster frames on right wall
        for (let i = 0; i < 4; i++) {
            box(34, 42, 2.5, ROOM_W / 2 - WALL / 2 - 5, 48, -100 + i * 60, 0x1e293b);
            lit(28, 36, 1.5, ROOM_W / 2 - WALL / 2 - 4, 48, -100 + i * 60, [acc, th.lamp, 0x22d3ee, 0xf472b6][i % 4]);
        }

        // bin + water cooler near door
        box(14, 18, 14, 90, 9, ROOM_D / 2 - 52, 0x475569);
        box(16, 42, 16, -90, 21, ROOM_D / 2 - 55, 0xcbd5e1); solid(-90, ROOM_D / 2 - 55, 16, 16);
        lit(12, 8, 12, -90, 44, ROOM_D / 2 - 55, 0x7dd3fc);

        // baseboard glow ticks (theme pulse line)
        for (let i = -3; i <= 3; i++) {
            lit(16, 2, 2, i * 70, 4, -ROOM_D / 2 + 16, acc);
        }

        // theme-specific extras
        if (cat === 'office' || cat === 'openplan') {
            // magazine table + brochure rack
            box(50, 16, 40, -40, 8, 100, 0x6d5238); solid(-40, 100, 50, 40);
            box(20, 50, 12, 60, 25, 150, 0x334155); solid(60, 150, 20, 12);
            lit(16, 36, 1, 60, 30, 157, 0x38bdf8);
        } else if (cat === 'bar' || cat === 'underground') {
            for (let i = 0; i < 6; i++) lit(10, 2, 10, -100 + i * 40, 2, -20, [0xe879f9, 0x5affc8, 0x8a5aff][i % 3]);
        } else if (cat === 'datacenter' || cat === 'backbone') {
            // floor tile LEDs
            for (let i = 0; i < 8; i++) lit(8, 1, 8, -140 + i * 40, 1.2, 150, 0x22d3ee);
        } else if (cat === 'metro' || cat === 'platform') {
            // safety posts
            for (const px of [-160, -80, 80, 160]) {
                box(6, 36, 6, px, 18, 120, 0xfbbf24);
            }
        } else if (cat === 'vc' || cat === 'boardroom') {
            box(40, 50, 20, -210, 25, -20, 0x1e293b); solid(-210, -20, 40, 20);
            lit(20, 30, 1, -210, 35, -8, 0xfbbf24);
        } else if (cat === 'agents') {
            for (let i = 0; i < 5; i++) lit(12, 3, 12, -80 + i * 40, 2, -80, 0xa78bfa);
        } else if (cat === 'home' || cat === 'cafe') {
            // extra cushions / side tables already dense; add lamp pair
            lit(8, 30, 8, 240, 30, -80, 0xffe4ac);
            lit(8, 30, 8, -240, 30, -80, 0xffe4ac);
        } else if (cat === 'court' || cat === 'embassy' || cat === 'conference') {
            // ceremonial plants already; add rope posts
            for (const px of [-60, 60]) {
                box(5, 36, 5, px, 18, -80, 0xfbbf24);
            }
        }

        // floor number glow ticks near lift when multi-floor
        if (this.maxFloor > 0) {
            const lwx = -ROOM_W / 2 + WALL / 2;
            lit(30, 8, 2, lwx + 40, 70, 120, 0x0ea5e9);
        }

        // silence unused floor param lint
        void floor;
    },

    canEnter(b) {
        if (!b) return false;
        // Outdoor-only props stay blocked; launchpads use mission/space interiors (2D parity).
        const NO = new Set(['park', 'crane', 'graveyard', 'billboard', 'monument']);
        return !NO.has(b.type);
    },

    /* Public entry point: F / 0-9 / E all ride the lift now. Kept as setFloor
       so existing callers keep working, but a floor change is a journey. */
    setFloor(n) { this.rideElevator(n); },

    /** Jump to a floor with no ride — boot params (`?inside=`), tests, and any
     *  caller that wants the room without the journey. */
    setFloorInstant(n) { this._setFloor(n); },

    /** Rebuild the room for floor `n` with no ride. Used by the ride itself
     *  once the car has arrived, and by setFloorInstant. */
    _setFloor(n) {
        if (!this.building) return;
        const f = Math.max(0, Math.min(this.maxFloor, n | 0));
        if (f === this.floor && this.group.children.length > 2) return;
        const from = this.floor;
        this._build(this.building, f);
        G.colliders = this._colliders.map(c => ({ x0: S(c.x0), x1: S(c.x1), z0: S(c.z0), z1: S(c.z1) }));
        /* If this rebuild is the arrival half of a ride, the player is inside
           the car and must stay there — the doors have not opened yet. Only a
           direct (test / boot-param) floor set drops them at the bank. */
        if (this._lift.phase === 'moving') {
            const spot = this.carSpot();
            G.player.teleport(spot.x, spot.z, Math.PI / 2);
            this._sealCar(true);
        } else {
            const nearLift = this._liftZones[0];
            if (nearLift) G.player.teleport(S(nearLift.x + 30), S(nearLift.z), Math.PI / 2);
            else G.player.teleport(0, S(ROOM_D / 2 - 70), 0);
            const top = f === this.maxFloor ? ' · TOP' : '';
            const plat = this.building.type === 'metro' && f === this.maxFloor ? ' · platform — board trains with E' : '';
            G.ui?.banner?.(`🛗 Floor ${f}/${this.maxFloor}${top}`, `elevator${plat || (this.maxFloor ? ' · 0–9 jump · F next' : '')}`);
            G.audio?.sfx?.(f > from ? 'open' : 'close');
        }
    },


    /* ── the working lift car ────────────────────────────────────────────────
       A real chamber behind the wall plane with two sliding leaves. Built as
       live meshes (the shell is merged and immutable) and rebuilt on every
       floor change, restoring whatever door state the ride is currently in
       rather than snapping open. */
    _buildCar(th, accent) {
        this._carParts = null;
        if (this.maxFloor <= 0) return;

        const grp = new THREE.Group();
        const mk = (w, h, d, x, y, z, hex, glow) => {
            const m = new THREE.Mesh(
                new THREE.BoxGeometry(w, h, d),
                glow ? new THREE.MeshBasicMaterial({ color: hex })
                     : new THREE.MeshStandardMaterial({ color: hex, roughness: 0.42, metalness: 0.45 })
            );
            m.position.set(x, y, z);
            grp.add(m);
            return m;
        };

        // shaft-side shell: back, sides, floor, ceiling
        mk(10, CAR_H, CAR_HALF * 2 + 20, CAR_BACK, CAR_H / 2, CAR_LZ, 0x2b3038);
        mk(CAR_DEPTH, CAR_H, 10, CAR_CX, CAR_H / 2, CAR_LZ - CAR_HALF - 5, 0x353b45);
        mk(CAR_DEPTH, CAR_H, 10, CAR_CX, CAR_H / 2, CAR_LZ + CAR_HALF + 5, 0x353b45);
        mk(CAR_DEPTH, 3, CAR_HALF * 2, CAR_CX, 1.5, CAR_LZ, 0x1d2128);
        mk(CAR_DEPTH, 4, CAR_HALF * 2, CAR_CX, CAR_H, CAR_LZ, 0x22262d);
        // ceiling panel — the only light source inside a shut car
        mk(CAR_DEPTH - 24, 2, CAR_HALF, CAR_CX, CAR_H - 3, CAR_LZ, 0xfff4d6, true);
        // rear mirror + handrails: both land at ~1.1 m and are strong scale cues
        mk(2, 30, CAR_HALF * 1.5, CAR_BACK + 6, 40, CAR_LZ, 0x7f8b9c);
        mk(CAR_DEPTH - 20, 3, 3, CAR_CX, 33, CAR_LZ - CAR_HALF - 1, 0x9ca3af);
        mk(CAR_DEPTH - 20, 3, 3, CAR_CX, 33, CAR_LZ + CAR_HALF + 1, 0x9ca3af);

        /* Floor indicator above the DOORS, which is where you actually look
           while riding — on the back wall it sat behind the rider's head. */
        const ind = mk(3, 9, 40, LIFT_WX - 4, CAR_H - 11, CAR_LZ, accent.getHex(), true);
        mk(5, 15, 50, LIFT_WX - 2, CAR_H - 11, CAR_LZ, 0x11151b);   // bezel behind it

        /* Two leaves that part in z. Brushed steel, not the pale blue-grey the
           first pass used — at interior light levels that rendered as a flat
           slab almost exactly the colour of the sky background, so the shut
           doors read as a hole rather than as doors. Each leaf gets an inset
           panel and the pair gets a dark centre seam, which is what makes the
           parting read at all. */
        const leafW = CAR_HALF + 2;
        const leaf = (sign) => {
            const g = new THREE.Group();
            const face = new THREE.Mesh(
                new THREE.BoxGeometry(6, CAR_H - 6, leafW),
                new THREE.MeshStandardMaterial({ color: 0x5b6472, roughness: 0.34, metalness: 0.72 })
            );
            g.add(face);
            const inset = new THREE.Mesh(
                new THREE.BoxGeometry(1.5, CAR_H - 26, leafW - 10),
                new THREE.MeshStandardMaterial({ color: 0x6f7a8a, roughness: 0.28, metalness: 0.8 })
            );
            inset.position.set(3.4, 0, 0);
            g.add(inset);
            // seam edge: a dark lip on the closing face
            const lip = new THREE.Mesh(
                new THREE.BoxGeometry(6.4, CAR_H - 6, 2),
                new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.6, metalness: 0.3 })
            );
            lip.position.set(0, 0, sign * (leafW / 2 - 1));
            g.add(lip);
            g.position.set(LIFT_WX, (CAR_H - 6) / 2, 0);
            grp.add(g);
            return g;
        };
        const left = leaf(1);
        const right = leaf(-1);

        this.group.add(grp);
        this._carParts = { grp, left, right, ind, leafW, accent: accent.getHex() };
        this._applyDoors(this._lift.doors);
    },

    /** Slide the leaves. 1 = retracted into the jambs, 0 = shut. */
    _applyDoors(open) {
        this._lift.doors = open;
        const c = this._carParts;
        if (!c) return;
        const slide = c.leafW * open;
        c.left.position.z = CAR_LZ - c.leafW / 2 - slide;
        c.right.position.z = CAR_LZ + c.leafW / 2 + slide;
        c.left.position.x = LIFT_WX;
        c.right.position.x = LIFT_WX;
        // the mouth is only solid while the doors are actually shut
        this._sealCar(open < 0.06);
    },

    /** Add/remove the invisible barrier across the car mouth. */
    _sealCar(on) {
        if (!Array.isArray(G.colliders)) return;
        const i = G.colliders.findIndex(c => c.id === 'liftDoor');
        if (on && i < 0) {
            G.colliders.push({
                id: 'liftDoor',
                x0: S(LIFT_WX - 6), x1: S(LIFT_WX + 6),
                z0: S(CAR_LZ - CAR_HALF), z1: S(CAR_LZ + CAR_HALF)
            });
        } else if (!on && i >= 0) {
            G.colliders.splice(i, 1);
        }
    },

    /** Where the rider stands inside the car, in WORLD units. */
    carSpot() { return { x: S(CAR_CX), z: S(CAR_LZ) }; },

    /** Standing inside the car. The lift-bank zone is centred out in the lobby
     *  and does NOT cover the car interior, so without this you could never
     *  press a button from where the lift just delivered you. */
    inCar() {
        if (!this.building || this.maxFloor <= 0) return false;
        const p = G.camera.position;
        const spot = this.carSpot();
        return Math.hypot(p.x - spot.x, p.z - spot.z) < S(CAR_DEPTH * 0.75);
    },

    /* Ride to a floor. Unlike the old setFloor this is a journey: the doors
       shut, the car moves with you inside it, and it opens somewhere else. */
    rideElevator(n) {
        if (!this.building || this.maxFloor <= 0) return;
        if (this._lift.phase !== 'idle') return;          // already travelling
        const to = Math.max(0, Math.min(this.maxFloor, n | 0));
        if (to === this.floor) {
            G.ui?.addToast?.('Already on floor ' + to, 'info');
            return;
        }
        if (!this.atLift() && !this.inCar()) {
            G.ui?.addToast?.('Walk to the lift bank to ride', 'info');
            return;
        }
        const spot = this.carSpot();
        G.player.teleport(spot.x, spot.z, Math.PI / 2);   // step in, face the doors
        G.player.enabled = false;
        this._lift.from = this.floor;
        this._lift.to = to;
        this._lift.dur = Math.max(RIDE_MIN,
            Math.min(RIDE_MAX, Math.abs(to - this.floor) * RIDE_PER_FLOOR));
        this._lift.t = 0;
        this._lift._shown = null;
        this._lift.phase = 'closing';
        G.audio?.sfx?.('close');
    },

    update(dt) {
        if (!this.building) return;
        const L = this._lift;
        if (L.phase === 'idle') return;
        L.t += dt;

        if (L.phase === 'closing') {
            this._applyDoors(Math.max(0, 1 - L.t / DOOR_SECS));
            if (L.t >= DOOR_SECS) { L.phase = 'moving'; L.t = 0; }
        } else if (L.phase === 'moving') {
            const k = Math.min(1, L.t / L.dur);
            /* Hold the rider in the car and give it the float of a real cab: a
               lurch as it takes up, a settle as it arrives, faint sway between.
               The travel itself is sold by the indicator ticking past floors —
               a sealed box has no parallax to move against. */
            const spot = this.carSpot();
            const dir = L.to > L.from ? 1 : -1;
            const lurch = Math.sin(Math.min(1, L.t / 0.45) * Math.PI) * 0.9 * -dir;
            const settle = k > 0.85
                ? Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.6 * dir : 0;
            G.camera.position.set(
                spot.x + Math.sin(L.t * 7.3) * 0.12,
                // player.eyeY is already absolute (G.floorY + EYE_H) — adding
                // FLOOR_Y again put the camera 4000 units under the world.
                (G.player.eyeY ?? (FLOOR_Y + EYE_H)) + lurch + settle,
                spot.z + Math.cos(L.t * 5.9) * 0.1
            );
            const at = Math.round(L.from + (L.to - L.from) * k);
            if (at !== L._shown) {
                L._shown = at;
                if (this._carParts) {
                    this._carParts.ind.material.color.setHex(
                        at === L.to ? 0x4ade80 : this._carParts.accent);
                }
                G.ui?.banner?.('🛗 ' + at, L.from + ' → ' + L.to);
            }
            if (k >= 1) {
                this._setFloor(L.to);      // rebuild the destination around the shut car
                L.phase = 'opening';
                L.t = 0;
                G.audio?.sfx?.('open');
            }
        } else if (L.phase === 'opening') {
            this._applyDoors(Math.min(1, L.t / DOOR_SECS));
            if (L.t >= DOOR_SECS) {
                L.phase = 'idle';
                L.t = 0;
                G.player.enabled = true;
                const top = this.floor === this.maxFloor ? ' · TOP' : '';
                const home = this.floor === 0
                    ? ' · the street door is on this floor'
                    : ' · ride down to floor 0 to leave';
                G.ui?.banner?.('🛗 ' + (this._floorLabel || 'Floor ' + this.floor) + top,
                    'floor ' + this.floor + '/' + this.maxFloor + home);
            }
        }
    },

    /** Lift zone `i` in WORLD units. Interior geometry is authored in local
     *  units and scaled by ROOM_SCALE, so anything outside this module that
     *  needs to stand at a lift must go through here rather than reading
     *  `_liftZones` raw. */
    liftZoneWorld(i = 0) {
        const z = this._liftZones?.[i];
        if (!z) return null;
        return { x: S(z.x), z: S(z.z), r: S(z.r) };
    },

    atLift() {
        if (!this.building || !this._liftZones?.length) return false;
        const p = G.camera.position;
        return this._liftZones.some(z => Math.hypot(p.x - S(z.x), p.z - S(z.z)) < S(z.r));
    },

    /** The interactive prop the player is standing at, if any. Exposed so a
     *  HUD module can prompt for it the way interact.js prompts for the lift. */
    atHotspot() {
        if (!this.building || !this._hotspots?.length) return null;
        const p = G.camera.position;
        let best = null, bestD = Infinity;
        for (const h of this._hotspots) {
            const d = Math.hypot(p.x - S(h.x), p.z - S(h.z));
            if (d < S(h.r) && d < bestD) { best = h; bestD = d; }
        }
        return best;
    },

    useHotspot(h) {
        if (!h) return;
        if (h.action === 'newspaper') {
            G.progress?.unlock?.('news_read');
            G.ui?.showPanel?.('newspaper');
        } else if (typeof h.action === 'function') {
            h.action(this);
        }
        G.audio?.sfx?.('open');
    },

    enter(b) {
        if (this.building || !this.canEnter(b)) return;
        this.building = b;
        try {
            this._build(b, 0);
        } catch (err) {
            console.error('[Interior] build failed', b?.id, err);
            this.building = null;
            G.ui?.addToast?.('Could not enter building — try another', 'warn');
            return;
        }
        this.group.visible = true;
        if (this._fillLight) { this._fillLight.visible = true; }
        if (this._rimLight) { this._rimLight.visible = true; }

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
        G.colliders = (this._colliders || []).map(c => ({
            x0: S(c.x0), x1: S(c.x1), z0: S(c.z0), z1: S(c.z1)
        }));
        G.floorY = FLOOR_Y;
        G.inside = b;
        G.player.teleport(0, S(ROOM_D / 2 - 70), 0);
        const multi = this.maxFloor > 0 ? ` · ELEVATOR: F / E at lift / 0–${this.maxFloor}` : '';
        G.ui?.banner?.(`${b.emoji || '🏢'} ${b.name}`, 'press E at the door to leave' + multi);
        G.audio?.sfx?.('open');
        G.progress?.unlock?.('went_inside');
    },

    exit(force = false) {
        if (!this.building) return;
        /* You cannot step off the 7th floor into the street. Riding back down
           is the whole reason the lift exists — without this the floors are
           just a skin on one room. Teardown paths (metro boarding, tests) pass
           force, because they are not the player walking out of a door. */
        if (!force && this.floor !== 0) {
            G.ui?.addToast?.('🛗 Take the lift down to the lobby to leave', 'info');
            return;
        }
        if (this._lift.phase !== 'idle') return;   // mid-ride: doors are shut
        this.group.visible = false;
        if (this._fillLight) this._fillLight.visible = false;
        if (this._rimLight) this._rimLight.visible = false;
        for (const o of this._cityHidden) o.visible = true;
        this._cityHidden = [];
        G.colliders = this._savedColliders;
        G.floorY = 0;
        G.inside = null;
        this.building = null;
        this.floor = 0;
        this.maxFloor = 0;
        this._lift = { phase: 'idle', t: 0, doors: 1, from: 0, to: 0, dur: 0 };
        this._carParts = null;
        G.player.enabled = true;
        if (this._savedPos) {
            G.player.teleport(this._savedPos.x, this._savedPos.z, this._savedYaw);
        }
        G.audio?.sfx('close');
    },

    // distance from the player to the way out (interior-local)
    atExit() {
        if (!this.building) return false;
        const p = G.camera.position;
        return Math.abs(p.x) < S(DOOR_W / 2 + 30) && Math.abs(p.z - S(ROOM_D / 2 - 30)) < S(55);
    },

    snapshot() {
        return {
            inside: this.building?.id || null,
            floor: this.floor,
            maxFloor: this.maxFloor,
            theme: this.building ? this._theme(this.building).cat : null,
            atLift: this.atLift(),
            elevators: this.maxFloor > 0,
            specialCats: ['jail', 'court', 'embassy', 'mission', 'power', 'boardroom', 'openplan', 'metro', 'platform', 'underground', 'vc', 'agents', 'alignment', 'arena', 'cafe', 'gym', 'nursery', 'conference', 'backbone']
        };
    }
};
