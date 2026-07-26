/* ══════════════════════════════════════════════════════════════════════════
   TRAFFIC & AMBIENT LIFE — cars (instanced, road-grid circuits), ambient life, ad blimps, a news helicopter, and Space Zone rocket launches.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { TRAM_LINES, SPACE_ORGS, NEWS, FOUNDERS, LAB_HQ, LABS } from './data.js';
import * as TEX from './textures.js';
import { City, LANE_W } from './city.js';

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

/** Shared materials for glass (see-through to show occupants). */
function glassMat(opacity = 0.22) {
    return new THREE.MeshStandardMaterial({
        color: 0xa8c8e8,
        metalness: 0.15,
        roughness: 0.08,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}

/** Build a readable sedan. Forward = +X. */
function buildSedan(bodyHex, opts = {}) {
    const g = new THREE.Group();
    const paintM = new THREE.MeshStandardMaterial({
        color: bodyHex, roughness: 0.32, metalness: 0.55
    });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.6, metalness: 0.3 });
    const chromeM = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, roughness: 0.25, metalness: 0.85 });
    const tireM = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.9, metalness: 0.1 });

    // chassis / lower body
    const body = new THREE.Mesh(new THREE.BoxGeometry(48, 10, 20), paintM);
    body.position.set(0, 9, 0);
    // cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 18), paintM);
    cabin.position.set(-3, 18.5, 0);
    // nose taper
    const nose = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 18), paintM);
    nose.position.set(22, 8.5, 0);
    // clear glass panes (not filled boxes) — windows as thin planes you look through
    const gw = glassMat(opts.glassOpacity ?? 0.28);
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), gw);
    wind.position.set(8.2, 18.5, 0); wind.rotation.y = Math.PI / 2;
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(14, 6.5), gw);
    rear.position.set(-14.2, 18.5, 0); rear.rotation.y = -Math.PI / 2;
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(18, 6.5), gw);
    sideL.position.set(-2, 18.8, 9.2);
    const sideR = sideL.clone(); sideR.position.z = -9.2; sideR.rotation.y = Math.PI;

    // wheels
    const wheels = new THREE.Group();
    for (const dx of [14, -14]) for (const dz of [9.5, -9.5]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 4, 12), tireM);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(dx, 5.5, dz);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.2, 10), chromeM);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(dx, 5.5, dz);
        wheels.add(tire, hub);
    }
    // lights
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    const tailM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), lampM);
        h.position.set(26, 9, s * 6); g.add(h);
        const t = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 3.5), tailM);
        t.position.set(-25, 10, s * 6.5); g.add(t);
    }
    // bumpers
    const fb = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 19), chromeM); fb.position.set(25.5, 6.5, 0);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 19), chromeM); rb.position.set(-25.5, 6.5, 0);

    g.add(body, cabin, nose, wind, rear, sideL, sideR, wheels, fb, rb);
    g.userData.paintM = paintM;
    return g;
}

/** VIP limousine with visible CEO figure in rear seat + name plate. */
function buildVipLimo(founder) {
    const labCol = new THREE.Color(founder.color || '#334155');
    // use lab colour; Elon white -> light silver
    const hex = labCol.getHex() === 0xffffff ? 0xd8dde6 : labCol.getHex();
    const g = buildSedan(hex, { glassOpacity: 0.2 });
    // stretch body slightly (limo cue)
    g.scale.set(1.15, 1.05, 1.08);

    // CEO seated in cabin (rear), large enough to read through glass
    const seat = new THREE.Group();
    seat.position.set(-6, 12, 0);
    const torso = new THREE.Mesh(
        new THREE.BoxGeometry(6, 8, 7),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
    );
    torso.position.y = 6;
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xe8b98e, roughness: 0.65 })
    );
    head.position.y = 12;
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(3.4, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 })
    );
    hair.position.set(0, 13.2, -0.4);
    hair.scale.set(1, 0.55, 1.05);
    // lab-coloured lapel pin / jacket accent
    const pin = new THREE.Mesh(
        new THREE.BoxGeometry(2, 3, 0.5),
        new THREE.MeshBasicMaterial({ color: hex })
    );
    pin.position.set(3.2, 7, 0);
    seat.add(torso, head, hair, pin);
    g.add(seat);

    // floating name tag above car
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(8, 8, 240, 48, 8); ctx.fill(); } else { ctx.fillRect(8, 8, 240, 48); }
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 28px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(founder.name, 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    spr.scale.set(40, 10, 1);
    spr.position.set(0, 36, 0);
    g.add(spr);
    g.userData.nameSprite = spr;
    g.userData.founder = founder;
    return g;
}

/** Proper helicopter: fuselage, boom, skids, spinning rotors. Nose = +X. */
function buildHelicopter(colHex) {
    const g = new THREE.Group();
    const col = new THREE.Color(colHex);
    const bodyM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.55 });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });
    const glassM = glassMat(0.28);

    const body = new THREE.Mesh(new THREE.BoxGeometry(28, 11, 14), bodyM);
    body.position.set(2, 10, 0);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(24, 4, 12), bodyM);
    belly.position.set(2, 4.5, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(6.5, 14, 12), bodyM);
    nose.position.set(16, 10, 0);
    nose.scale.set(1.15, 0.9, 0.95);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(6.2, 14, 12), glassM);
    canopy.position.set(12, 12, 0);
    canopy.scale.set(1.15, 0.9, 1.0);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, 30, 8), bodyM);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(-22, 12, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 1.5), bodyM);
    fin.position.set(-36, 16, 0);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 10), bodyM);
    stab.position.set(-34, 12, 0);
    const tailRotor = new THREE.Group();
    tailRotor.position.set(-37, 16, 3);
    for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 2.5), darkM);
        b.rotation.z = i * Math.PI / 2;
        tailRotor.add(b);
    }
    for (const s of [-1, 1]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(28, 1.2, 1.2), darkM);
        skid.position.set(2, 1.2, s * 7.5);
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), darkM);
        leg1.position.set(10, 4.5, s * 7.5);
        const leg2 = leg1.clone(); leg2.position.x = -8;
        g.add(skid, leg1, leg2);
    }
    const rotor = new THREE.Group();
    rotor.position.set(0, 18, 0);
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 4, 12), darkM));
    for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(56, 0.55, 3.5),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.65 })
        );
        blade.rotation.y = (i * Math.PI) / 2;
        blade.position.y = 2;
        // slight pitch
        blade.rotation.z = 0.04;
        rotor.add(blade);
    }
    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(28, 40),
        new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2.1;
    rotor.add(disc);
    const pilot = new THREE.Mesh(
        new THREE.SphereGeometry(2.5, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8b98e, roughness: 0.7 })
    );
    pilot.position.set(11, 11.5, 0);
    g.add(body, belly, nose, canopy, boom, fin, stab, tailRotor, rotor, pilot);
    g.userData.rotor = rotor;
    g.userData.tailRotor = tailRotor;
    return g;
}

/** Nvidia-style supply truck (cab + green container). */
function buildSupplyTruck() {
    const g = new THREE.Group();
    const green = new THREE.MeshStandardMaterial({ color: 0x3a8a48, roughness: 0.45, metalness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.6, metalness: 0.3 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 20), green);
    cab.position.set(28, 13, 0);
    const wind = new THREE.Mesh(new THREE.BoxGeometry(2, 10, 16), glassMat(0.35));
    wind.position.set(39, 15, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(58, 26, 22), green);
    box.position.set(-12, 17, 0);
    // NVIDIA-ish mark strip
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(50, 6, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x76b900 })
    );
    stripe.position.set(-12, 20, 11.2);
    const stripe2 = stripe.clone(); stripe2.position.z = -11.2;
    for (const dx of [26, -6, -30]) for (const s of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 5, 12), dark);
        w.rotation.x = Math.PI / 2;
        w.position.set(dx, 5.5, s * 11);
        g.add(w);
    }
    g.add(cab, wind, box, stripe, stripe2);
    return g;
}


const CAR_GAP = 62;          // bumper-to-bumper minimum in a queue
const STOP_LINE = 26;        // how far back from the junction a red light holds you
const SIGNAL_PERIOD = 26;    // seconds for a full two-phase signal cycle

export const Traffic = {
    cars: null, carDetail: null, carLamps: null, lampMat: null, carData: [], truck: null,
    trams: [],
    blimps: [],
    heli: null,
    rocket: null, rocketT: 0, nextLaunch: 45,
    onBlimpClick: null,

    init(scene) {
        this._initCars(scene);
        this._initVipCars(scene);
        this._initTruck(scene);
        this._initTrams(scene);
        this._initBlimps(scene);
        this._initHeli(scene);
        this._initFounderHelis(scene);
    },

    // ── SUPPLY-CHAIN TRUCK ────────────────────────────────────────────────────
    // The production city runs ONE meaningful vehicle: an Nvidia delivery truck
    // hauling GPUs Port → fab → HQ. Ported faithfully as a single articulated
    // truck (cab + green cargo box) following a road-grid polyline loop through
    // those three stops.
    _initTruck(scene) {
        // Always place a supply truck on a road loop (Nvidia route when buildings exist).
        const port = G.placements.find(p => p.district === 'port')
            || G.placements[0];
        const fab = G.placements.find(p => /nvidia|fab|chipfab|datacenter/i.test(p.b?.name + p.b?.type + p.b?.id))
            || G.placements.find(p => p.district === 'compute')
            || G.placements[Math.min(3, G.placements.length - 1)];
        const hq = G.placements.find(p => p.b?.lab === 'nvidia' || p.b?.id === 'bld_o')
            || G.placements.find(p => p.district === 'tech')
            || G.placements[Math.min(5, G.placements.length - 1)];
        const stops = [port, fab, hq].filter(Boolean);
        if (stops.length < 2) {
            // fallback: ring road loop
            const xs = City.avenueXs?.length ? City.avenueXs : [0, 400];
            const zs = City.streetZs?.length ? City.streetZs : [0, 400];
            const path = [
                { x: xs[0], z: zs[0] }, { x: xs[xs.length - 1], z: zs[0] },
                { x: xs[xs.length - 1], z: zs[zs.length - 1] }, { x: xs[0], z: zs[zs.length - 1] },
                { x: xs[0], z: zs[0] }
            ];
            this._registerTruck(scene, path);
            return;
        }
        const path = [];
        for (const s of stops) {
            const sx = s.x ?? s.worldX, sz = s.z ?? s.worldZ;
            const i = City.nearestIntersection(sx, sz);
            const lane = City.laneCentre(i.x, true, 1, 0);
            path.push({ x: lane, z: i.z });
            path.push({ x: lane, z: sz });
        }
        path.push({ ...path[0] });
        this._registerTruck(scene, path);
    },

    _registerTruck(scene, path) {
        const segs = [];
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z) || 1;
            segs.push(len); total += len;
        }
        const mesh = buildSupplyTruck();
        scene.add(mesh);
        this.truck = { obj: mesh, path, segs, total: total || 1, dist: 0, speed: 115 };
        // extra delivery vans (city logistics parity)
        this.vans = [];
        const vanCols = [0x2563eb, 0xdc2626, 0xf59e0b];
        for (let v = 0; v < 3; v++) {
            const van = buildSedan(vanCols[v], { glassOpacity: 0.25 });
            van.scale.set(1.05, 1.15, 1.1);
            // cargo hump
            const hump = new THREE.Mesh(
                new THREE.BoxGeometry(20, 10, 18),
                new THREE.MeshStandardMaterial({ color: vanCols[v], roughness: 0.4, metalness: 0.4 })
            );
            hump.position.set(-6, 20, 0);
            van.add(hump);
            scene.add(van);
            // offset path start
            this.vans.push({
                obj: van, path, segs, total: total || 1,
                dist: (v + 1) * (total || 1) / 4,
                speed: 95 + v * 8
            });
        }
    },

    _stepPathVehicle(v, dt) {
        if (!v || !v.total) return;
        v.dist = (v.dist + v.speed * dt) % v.total;
        let rem = v.dist;
        for (let i = 0; i < v.segs.length; i++) {
            if (rem <= v.segs[i] || i === v.segs.length - 1) {
                const t = v.segs[i] ? rem / v.segs[i] : 0;
                const a = v.path[i], b = v.path[i + 1];
                if (!a || !b) break;
                v.obj.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
                v.obj.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
                break;
            }
            rem -= v.segs[i];
        }
    },

    _updateTruck(dt) {
        this._stepPathVehicle(this.truck, dt);
        if (this.vans) for (const v of this.vans) this._stepPathVehicle(v, dt);
    },

    // ── CARS ─────────────────────────────────────────────────────────────────
    // Built as three instanced meshes sharing one transform: painted body,
    // fixed-colour details (glass, wheels, bumpers) and lamps. Three draw
    // calls for all traffic, and a red car doesn't get red wheels — which is
    // what happens if you drive the whole model from one instance colour.
    _carGeometry() {
        const body = [], detail = [], lamp = [];
        const push = (arr, g, hex) => arr.push(paint(g, hex));
        // body: lower box + tapered roof, painted white so instanceColor shows
        const lower = new THREE.BoxGeometry(44, 11, 19); lower.translate(0, 9.5, 0);
        push(body, lower, 0xffffff);
        const roof = new THREE.BoxGeometry(24, 10, 17); roof.translate(-2, 19.5, 0);
        push(body, roof, 0xffffff);
        const nose = new THREE.BoxGeometry(8, 6, 18); nose.translate(20, 8, 0);
        push(body, nose, 0xffffff);
        // glazing — windscreen, rear, sides
        const wind = new THREE.BoxGeometry(1.5, 8, 15.4); wind.translate(9.6, 19.5, 0);
        push(detail, wind, 0x121822);
        const rear = new THREE.BoxGeometry(1.5, 7.5, 15.4); rear.translate(-13.6, 19.5, 0);
        push(detail, rear, 0x121822);
        for (const s of [-1, 1]) {
            const side = new THREE.BoxGeometry(20, 7, 1.4); side.translate(-2, 19.8, s * 8.4);
            push(detail, side, 0x141b26);
        }
        // wheels
        for (const dx of [14, -13]) for (const s of [-1, 1]) {
            const w = new THREE.CylinderGeometry(6.2, 6.2, 4.5, 10);
            w.rotateX(Math.PI / 2); w.translate(dx, 6, s * 9.2);
            push(detail, w, 0x15171c);
        }
        // bumpers / sills
        for (const dx of [21.5, -21.5]) {
            const b = new THREE.BoxGeometry(2.5, 4, 18); b.translate(dx, 6.5, 0);
            push(detail, b, 0x2a2f38);
        }
        // lamps
        for (const s of [-1, 1]) {
            const h = new THREE.BoxGeometry(2, 3.5, 4.5); h.translate(24, 9.5, s * 6);
            push(lamp, h, 0xfff3d0);
            const t = new THREE.BoxGeometry(2, 3, 4); t.translate(-22.5, 10.5, s * 6.5);
            push(lamp, t, 0xff3b30);
        }
        return {
            body: mergeGeometries(body, false),
            detail: mergeGeometries(detail, false),
            lamp: mergeGeometries(lamp, false)
        };
    },

    _initCars(scene) {
        const N = G.preset.cars;
        const geo = this._carGeometry();
        const mk = (g, mat) => {
            const m = new THREE.InstancedMesh(g, mat, N);
            m.frustumCulled = false;
            scene.add(m);
            return m;
        };
        this.cars = mk(geo.body, new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.45 }));
        this.carDetail = mk(geo.detail, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.25 }));
        this.lampMat = new THREE.MeshLambertMaterial({
            vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0
        });
        this.carLamps = mk(geo.lamp, this.lampMat);

        const cols = [0xb3352a, 0x27618f, 0xa9b0b8, 0x232833, 0xc08a1e, 0x158a72, 0x6f3f9e, 0xdfe3e6, 0x30414f];
        const color = new THREE.Color();
        const xs = [...City.avenueXs, ...City.ringX].sort((a, b) => a - b);
        const zs = [...City.streetZs, ...City.ringZ].sort((a, b) => a - b);
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        for (let i = 0; i < N; i++) {
            // a circuit of four real road centrelines, always a proper loop
            let x0 = pick(xs), x1 = pick(xs), z0 = pick(zs), z1 = pick(zs);
            if (x0 === x1) x1 = xs[(xs.indexOf(x0) + 1) % xs.length];
            if (z0 === z1) z1 = zs[(zs.indexOf(z0) + 1) % zs.length];
            if (x0 > x1) [x0, x1] = [x1, x0];
            if (z0 > z1) [z0, z1] = [z1, z0];

            // Drive on the right. Going A→B→C→D (+x, +z, -x, -z) the nearside
            // is always the inside of the loop, so the whole rectangle shrinks
            // by the lane offset; the other direction expands. Oncoming
            // traffic therefore sits on the far side of the centreline.
            const dir = Math.random() < 0.5 ? 1 : -1;
            const lane = Math.random() < 0.62 ? 0 : 1;
            const off = (lane * LANE_W + LANE_W / 2) * dir;
            const rect = [
                { x: x0 + off, z: z0 + off }, { x: x1 - off, z: z0 + off },
                { x: x1 - off, z: z1 - off }, { x: x0 + off, z: z1 - off }
            ];
            if (dir < 0) rect.reverse();
            const perimeter = rect.reduce((s, p, j) => {
                const q = rect[(j + 1) % 4];
                return s + Math.hypot(q.x - p.x, q.z - p.z);
            }, 0);
            this.carData.push({
                rect, perimeter,
                dist: Math.random() * perimeter,
                // lane discipline: the outer lane runs a little quicker
                speed: (lane ? 132 : 104) + Math.random() * 26
            });
            this.cars.setColorAt(i, color.set(cols[i % cols.length]));
        }
        this._dummy = new THREE.Object3D();
    },

    // Where a car is on its circuit right now, without moving it.
    _carPose(c) {
        let rem = c.dist, seg = 0;
        while (seg < 4) {
            const p = c.rect[seg], q = c.rect[(seg + 1) % 4];
            const len = Math.hypot(q.x - p.x, q.z - p.z);
            if (rem <= len || seg === 3) {
                const t = len ? Math.min(1, rem / len) : 0;
                const alongX = Math.abs(q.x - p.x) > Math.abs(q.z - p.z);
                return {
                    x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
                    dx: q.x - p.x, dz: q.z - p.z,
                    toCorner: len - rem, alongX
                };
            }
            rem -= len; seg++;
        }
        return null;
    },

    _updateCars(dt) {
        if (!this.cars) return;
        const d = this._dummy;
        const N = this.carData.length;

        // ── pass 1: where is everyone, and how far to the next junction ──
        const pose = new Array(N);
        const lanes = new Map();
        for (let i = 0; i < N; i++) {
            const c = this.carData[i];
            const p = this._carPose(c);
            pose[i] = p;
            if (!p) continue;
            // one queue per (axis, lane centreline, direction of travel)
            const perp = p.alongX ? Math.round(p.z / 6) : Math.round(p.x / 6);
            const fwd = p.alongX ? Math.sign(p.dx) : Math.sign(p.dz);
            const key = `${p.alongX ? 'x' : 'z'}:${perp}:${fwd}`;
            const along = (p.alongX ? p.x : p.z) * fwd;
            let q = lanes.get(key);
            if (!q) { q = []; lanes.set(key, q); }
            q.push({ i, along });
        }
        // ── pass 2: how close is the car in front? ──
        const gapAllowed = new Float32Array(N).fill(Infinity);
        for (const q of lanes.values()) {
            q.sort((a, b) => a.along - b.along);
            for (let k = 0; k < q.length - 1; k++) {
                // q[k+1] is directly ahead in the same lane
                gapAllowed[q[k].i] = Math.max(0, q[k + 1].along - q[k].along - CAR_GAP);
            }
        }

        // ── pass 3: signals, braking, movement ──
        // one city-wide two-phase cycle: north-south, then east-west
        const cycle = (G.time % SIGNAL_PERIOD) / SIGNAL_PERIOD;
        const greenAlongX = cycle < 0.5;
        const amber = Math.abs(cycle % 0.5 - 0.5) < 0.06;
        this.signalGreenX = greenAlongX;

        for (let i = 0; i < N; i++) {
            const c = this.carData[i];
            const p = pose[i];
            if (!p) continue;

            let advance = c.speed * dt;
            // stop line: hold at a red (or a late amber) light
            const green = p.alongX ? greenAlongX : !greenAlongX;
            if ((!green || amber) && p.toCorner < 150) {
                advance = Math.min(advance, Math.max(0, p.toCorner - STOP_LINE));
            }
            // never drive into the back of the car ahead
            advance = Math.min(advance, gapAllowed[i]);

            c.dist = (c.dist + advance) % c.perimeter;
            const np = this._carPose(c) || p;
            d.position.set(np.x, 0, np.z);
            d.rotation.y = Math.atan2(np.dx, np.dz) - Math.PI / 2;
            d.updateMatrix();
            this.cars.setMatrixAt(i, d.matrix);
            this.carDetail.setMatrixAt(i, d.matrix);
            this.carLamps.setMatrixAt(i, d.matrix);
        }
        this.cars.instanceMatrix.needsUpdate = true;
        this.carDetail.instanceMatrix.needsUpdate = true;
        this.carLamps.instanceMatrix.needsUpdate = true;
        // headlights come on as the light goes
        const h = G.dayPhase * 24;
        const dark = (h < 6.5 || h > 18.5) ? 1 : (h < 7.5 ? 7.5 - h : h > 17.5 ? h - 17.5 : 0);
        this.lampMat.emissiveIntensity = Math.min(1, Math.max(0, dark)) * 0.95;
    },

    // ── METRO ROLLING STOCK ──────────────────────────────────────────────────
    // Production 2D metro is UNDERGROUND. Elevated trams + pylons were a mistaken
    // FP flourish and broke parity (trains floating over streets). Rolling stock
    // lives in metro.js below the ground plane. Traffic only keeps empty hooks
    // so older callers / tests that poke Traffic.trams still work.
    _initTrams(scene) {
        this.trams = [];
        // no elevated deck / pylons
    },

    _updateTrams(dt) {
        // metro.js owns train motion
    },
    // ── BLIMPS with news panels ──────────────────────────────────────────────
    _initBlimps(scene) {
        const headlines = NEWS.slice(0, 3);
        headlines.forEach((h, i) => {
            const blimp = new THREE.Group();
            const envelope = new THREE.Mesh(
                new THREE.SphereGeometry(40, 14, 10),
                new THREE.MeshLambertMaterial({ color: [0xd8b23a, 0x9a4ae0, 0x3aa0d8][i] })
            );
            envelope.scale.set(1.9, 0.62, 0.62);
            blimp.add(envelope);
            const gondola = new THREE.Mesh(
                new THREE.BoxGeometry(30, 10, 10),
                new THREE.MeshLambertMaterial({ color: 0x2a2e36 })
            );
            gondola.position.y = -30;
            blimp.add(gondola);
            const panelTex = TEX.blimpPanel(h.headline);
            const panel = new THREE.Mesh(
                new THREE.PlaneGeometry(90, 22),
                new THREE.MeshBasicMaterial({ map: panelTex, side: THREE.DoubleSide })
            );
            panel.position.y = -2;
            blimp.add(panel);
            blimp.userData.headline = h;
            blimp.position.set((i - 1) * 1500, 420 + i * 60, -800 + i * 700);
            scene.add(blimp);
            this.blimps.push({ obj: blimp, speed: 14 + i * 4, phase: i * 2.4 });
        });
    },

    _updateBlimps(dt, t) {
        for (const b of this.blimps) {
            b.obj.position.x += b.speed * dt;
            b.obj.position.y += Math.sin(t * 0.4 + b.phase) * dt * 6;
            if (b.obj.position.x > CITY_W / 2 + 800) b.obj.position.x = -CITY_W / 2 - 800;
        }
    },

    // ── NEWS HELICOPTER ──────────────────────────────────────────────────────
    _initHeli(scene) {
        const heli = buildHelicopter(0xc0392b);
        heli.scale.setScalar(1.5);
        scene.add(heli);
        this.heli = { obj: heli, angle: 0 };
    },

    _updateHeli(dt, t) {
        if (!this.heli) return;
        const h = this.heli;
        h.angle += dt * 0.09;
        const r = 1400;
        const x = Math.cos(h.angle) * r - 500;
        const z = Math.sin(h.angle) * r;
        h.obj.position.set(x, 380 + Math.sin(t * 0.5) * 20, z);
        const vx = -Math.sin(h.angle), vz = Math.cos(h.angle);
        h.obj.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;
        h.obj.rotation.z = -0.1;
        if (h.obj.userData.rotor) h.obj.userData.rotor.rotation.y += dt * 32;
        if (h.obj.userData.tailRotor) h.obj.userData.tailRotor.rotation.x += dt * 48;
    },

    // ── ROCKET LAUNCHES ──────────────────────────────────────────────────────
    _buildRocket(orgColor) {
        const g = new THREE.Group();
        const parts = [];
        const body = new THREE.CylinderGeometry(6, 6, 60, 10); body.translate(0, 30, 0); paint(body, 0xf2f2f0);
        const nose = new THREE.ConeGeometry(6, 14, 10); nose.translate(0, 67, 0); paint(nose, orgColor);
        const stripe = new THREE.CylinderGeometry(6.3, 6.3, 8, 10); stripe.translate(0, 6, 0); paint(stripe, orgColor);
        parts.push(body, nose, stripe);
        g.add(new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true })));
        const flame = new THREE.Mesh(
            new THREE.ConeGeometry(5, 34, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.9, depthWrite: false })
        );
        flame.rotation.x = Math.PI;
        flame.position.y = -12;
        g.add(flame);
        g.userData.flame = flame;
        return g;
    },

    _updateRockets(dt, t) {
        if (!this.rocket) {
            this.nextLaunch -= dt;
            if (this.nextLaunch <= 0) {
                const pads = ['pad_spacex', 'pad_blue_origin', 'pad_nasa', 'pad_cnsa', 'pad_esa', 'pad_ula', 'pad_rocketlab']
                    .map(id => G.bldById[id]).filter(Boolean);
                const pad = pads[Math.floor(Math.random() * pads.length)];
                const org = SPACE_ORGS[pad.org] || { color: 0xffffff, name: 'Space' };
                this.rocket = this._buildRocket(org.color);
                this.rocket.position.set(pad.worldX, 90, pad.worldZ);
                this.rocketT = 0;
                G.scene.add(this.rocket);
                this.nextLaunch = 60 + Math.random() * 120;
                G.ui?.addToast(`🚀 ${org.name} launch from ${pad.name}!`);
                G.ui?.event('rocket_launch', { x: pad.worldX, z: pad.worldZ });
                G.audio?.sfx('rocket');
            }
            return;
        }
        this.rocketT += dt;
        const p = this.rocketT / 14;
        if (p >= 1) {
            G.scene.remove(this.rocket);
            this.rocket = null;
            return;
        }
        this.rocket.position.y = 90 + 2600 * p * p;
        const fl = this.rocket.userData.flame;
        fl.scale.set(1 + Math.sin(t * 40) * 0.15, 0.8 + Math.random() * 0.4, 1 + Math.cos(t * 37) * 0.15);
    },
    // ── VIP / FOUNDER CARS ──────────────────────────────────────────────────
    // Clear-glass limos with a seated CEO figure + name tag you can read.
    _initVipCars(scene) {
        this.vipCars = [];
        this.vipGroup = new THREE.Group();
        scene.add(this.vipGroup);
        const founders = FOUNDERS || [];
        founders.forEach((f, i) => {
            const hq = G.bldById[LAB_HQ[f.lab]];
            const home = G.bldById['res_' + ((LABS[f.lab] && LABS[f.lab].region) || 'us')] || G.bldById['res_us'];
            if (!hq || !home) return;
            const limo = buildVipLimo(f);
            this.vipGroup.add(limo);

            const hx = hq.worldX, hz = hq.worldZ;
            const i1 = City.nearestIntersection(hx, hz);
            const i2 = City.nearestIntersection(home.worldX, home.worldZ);
            const lane1 = City.laneCentre(i1.x, true, 1, 0);
            const lane2 = City.laneCentre(i2.x, true, 1, 0);
            // rectangular circuit home ↔ HQ on real lanes
            const path = [
                { x: lane1, z: i1.z },
                { x: lane2, z: i1.z },
                { x: lane2, z: i2.z },
                { x: lane1, z: i2.z },
                { x: lane1, z: i1.z }
            ];
            const segs = [];
            let total = 0;
            for (let k = 0; k < path.length - 1; k++) {
                const len = Math.hypot(path[k + 1].x - path[k].x, path[k + 1].z - path[k].z) || 1;
                segs.push(len); total += len;
            }
            this.vipCars.push({
                obj: limo, founder: f, path, segs, total: total || 1,
                dist: (i / Math.max(1, founders.length)) * total,
                speed: 100 + i * 5
            });
        });
    },

    _vipActive() {
        // CEOs on the road most of the business day so you can actually spot them
        const dp = G.dayPhase;
        return dp >= 0.28 && dp < 0.92;
    },

    _updateVipCars(dt) {
        if (!this.vipCars?.length) return;
        const on = this._vipActive();
        for (const v of this.vipCars) {
            v.obj.visible = on;
            if (!on) continue;
            this._stepPathVehicle(v, dt);
            // name tags face camera
            const spr = v.obj.userData.nameSprite;
            if (spr && G.camera) spr.quaternion.copy(G.camera.quaternion);
        }
    },

    // ── FOUNDER HELICOPTERS ─────────────────────────────────────────────────
    // Readable choppers, nose into direction of travel (not flying backward).
    _initFounderHelis(scene) {
        this.founderHelis = [];
        const founders = FOUNDERS || [];
        founders.forEach((f, i) => {
            const hq = G.bldById[LAB_HQ[f.lab]];
            if (!hq) return;
            const col = f.color && f.color !== '#ffffff' ? f.color : (LABS[f.lab]?.color || '#c0392b');
            const heli = buildHelicopter(col);
            // scale up so readable from street
            heli.scale.setScalar(1.35);
            scene.add(heli);
            this.founderHelis.push({
                obj: heli,
                founder: f,
                hq,
                angle: (i / founders.length) * Math.PI * 2,
                phase: i * 1.7,
                radius: 280 + i * 55,
                alt: 320 + i * 35
            });
        });
    },

    _updateFounderHelis(dt, t) {
        if (!this.founderHelis?.length) return;
        const dp = G.dayPhase;
        const flying = dp > 0.28 && dp < 0.9;
        const woods = G.bldById['align_miri'] || G.bldById['pine_reserve'];
        const day = new Date().getDate();
        const weekendTrip = (day % 2 === 0) && dp > 0.42 && dp < 0.62;
        for (const h of this.founderHelis) {
            h.obj.visible = flying;
            if (!flying) continue;
            const da = dt * (0.14 + (h.phase % 1) * 0.05);
            h.angle += da;
            let cx = h.hq.worldX, cz = h.hq.worldZ;
            if (weekendTrip && woods) {
                const u = Math.sin((dp - 0.42) / 0.2 * Math.PI);
                cx = h.hq.worldX + (woods.worldX - h.hq.worldX) * Math.max(0, u);
                cz = h.hq.worldZ + (woods.worldZ - h.hq.worldZ) * Math.max(0, u);
            }
            const x = cx + Math.cos(h.angle) * h.radius;
            const z = cz + Math.sin(h.angle) * h.radius;
            h.obj.position.set(x, h.alt + Math.sin(t * 0.7 + h.phase) * 14, z);
            // Travel dir for increasing angle: (-sin, cos) — nose is +X
            const vx = -Math.sin(h.angle), vz = Math.cos(h.angle);
            h.obj.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;
            // slight bank into turn
            h.obj.rotation.z = -0.12;
            h.obj.rotation.x = 0.04;
            if (h.obj.userData.rotor) h.obj.userData.rotor.rotation.y += dt * 32;
            if (h.obj.userData.tailRotor) h.obj.userData.tailRotor.rotation.x += dt * 48;
        }
    },

    update(dt, t) {
        this._updateCars(dt);
        this._updateVipCars(dt);
        this._updateTruck(dt);
        this._updateTrams(dt);
        this._updateBlimps(dt, t);
        this._updateHeli(dt, t);
        this._updateFounderHelis(dt, t);
        this._updateRockets(dt, t);
    }
};


