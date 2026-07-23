/* ══════════════════════════════════════════════════════════════════════════
   TRAFFIC & AMBIENT LIFE — cars (instanced, road-grid circuits), elevated
   trams, ad blimps, a news helicopter, and Space Zone rocket launches.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { TRAM_LINES, SPACE_ORGS, NEWS } from './data.js';
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

const CAR_GAP = 62;          // bumper-to-bumper minimum in a queue
const STOP_LINE = 26;        // how far back from the junction a red light holds you
const SIGNAL_PERIOD = 26;    // seconds for a full two-phase signal cycle
const TRAM_Y = 86;        // deck height (8.6 m) — a real elevated line
const DECK_W = 26, DECK_H = 5, PYLON_W = 13, PYLON_GAP = 190;

export const Traffic = {
    cars: null, carDetail: null, carLamps: null, lampMat: null, carData: [], truck: null,
    trams: [],
    blimps: [],
    heli: null,
    rocket: null, rocketT: 0, nextLaunch: 45,
    onBlimpClick: null,

    init(scene) {
        this._initCars(scene);
        this._initTruck(scene);
        this._initTrams(scene);
        this._initBlimps(scene);
        this._initHeli(scene);
    },

    // ── SUPPLY-CHAIN TRUCK ────────────────────────────────────────────────────
    // The production city runs ONE meaningful vehicle: an Nvidia delivery truck
    // hauling GPUs Port → fab → HQ. Ported faithfully as a single articulated
    // truck (cab + green cargo box) following a road-grid polyline loop through
    // those three stops.
    _initTruck(scene) {
        const port = G.placements.find(p => p.district === 'port' && /port|dock|warehouse|crane/i.test(p.b.name))
            || G.placements.find(p => p.district === 'port');
        const fab = G.placements.find(p => /nvidia|fab/i.test(p.b.name) && p.b.type === 'fab')
            || G.placements.find(p => p.b.type === 'fab');
        const hq = G.placements.find(p => p.b.lab === 'nvidia')
            || G.placements.find(p => p.district === 'compute' && p.b.type === 'datacenter');
        const stops = [port, fab, hq].filter(Boolean);
        if (stops.length < 2) return;

        // build a road-grid polyline that visits each stop's nearest intersection
        const path = [];
        for (const s of stops) {
            const i = City.nearestIntersection(s.x, s.z);
            const lane = City.laneCentre(i.x, true, 1, 0);
            path.push({ x: lane, z: i.z });
            path.push({ x: lane, z: s.z });
        }
        // close the loop
        path.push({ ...path[0] });
        const segs = [];
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
            segs.push(len); total += len;
        }

        const green = [];
        const g = (w, h, d, x, y, z, hex) => {
            const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z);
            green.push(paint(b, hex));
        };
        g(20, 16, 20, 22, 12, 0, 0x2f6f3a);        // cab
        g(6, 9, 17, 33, 14, 0, 0x0f1218);          // windscreen
        g(58, 24, 22, -12, 16, 0, 0x3a8a48);       // cargo box
        g(60, 3, 24, -12, 29, 0, 0x2f6f3a);        // box roof rail
        for (const dx of [26, -6, -30]) for (const s of [-1, 1]) {
            const w = new THREE.CylinderGeometry(5.5, 5.5, 5, 10);
            w.rotateX(Math.PI / 2); w.translate(dx, 5, s * 11);
            green.push(paint(w, 0x15171c));
        }
        const mesh = new THREE.Mesh(mergeGeometries(green, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        scene.add(mesh);
        this.truck = { obj: mesh, path, segs, total, dist: 0, speed: 108 };
    },

    _updateTruck(dt) {
        const tr = this.truck;
        if (!tr) return;
        tr.dist = (tr.dist + tr.speed * dt) % tr.total;
        let rem = tr.dist;
        for (let i = 0; i < tr.segs.length; i++) {
            if (rem <= tr.segs[i] || i === tr.segs.length - 1) {
                const t = tr.segs[i] ? rem / tr.segs[i] : 0;
                const a = tr.path[i], b = tr.path[i + 1];
                tr.obj.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
                tr.obj.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
                break;
            }
            rem -= tr.segs[i];
        }
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
        this.cars = mk(geo.body, new THREE.MeshLambertMaterial());
        this.carDetail = mk(geo.detail, new THREE.MeshLambertMaterial({ vertexColors: true }));
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

    // ── TRAMS (elevated maglev, follows the road grid) ───────────────────────
    // TRAM_Y used to be 10 — 1 m at this project's scale (10 u = 1 m), i.e.
    // street level, with the cars ploughing down the middle of the road and
    // nothing holding them up. Now it's a real elevated line: deck + pylons,
    // merged/instanced into 2 extra draw calls for the whole network.
    _initTrams(scene) {
        const deckParts = [];
        const pylonSpots = [];

        for (const line of TRAM_LINES) {
            const s1 = G.bldById[line.stops[0]], s2 = G.bldById[line.stops[1]];
            if (!s1 || !s2) continue;
            const tram = new THREE.Group();
            const parts = [];
            for (let i = 0; i < 3; i++) {
                const car = new THREE.BoxGeometry(46, 13, 12); car.translate(i * 50 - 50, 8, 0);
                paint(car, 0x1e293b);
                const win = new THREE.BoxGeometry(38, 5, 12.5); win.translate(i * 50 - 50, 9, 0);
                paint(win, 0xfff5b6);
                const stripe = new THREE.BoxGeometry(46, 2, 12.6); stripe.translate(i * 50 - 50, 14, 0);
                paint(stripe, line.color);
                parts.push(car, win, stripe);
            }
            const mesh = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
            tram.add(mesh);
            scene.add(tram);

            // route along roads: station → nearest intersection → street → avenue → station
            const i1 = City.nearestIntersection(s1.worldX, s1.worldZ);
            const i2 = City.nearestIntersection(s2.worldX, s2.worldZ);
            const path = [
                { x: s1.worldX, z: i1.z },
                { x: i1.x, z: i1.z },
                { x: i2.x, z: i1.z },
                { x: i2.x, z: i2.z },
                { x: s2.worldX, z: i2.z }
            ];
            // arc lengths
            const segs = [];
            let total = 0;
            for (let i = 0; i < path.length - 1; i++) {
                const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
                segs.push(len); total += len;
            }
            this.trams.push({
                obj: tram, line, path, segs, total,
                dist: Math.random() * total, dir: 1, wait: 0, wasWaiting: true,
                speed: 130,
                endX: [path[0].x, path[path.length - 1].x],
                endZ: [path[0].z, path[path.length - 1].z]
            });

            // viaduct under this route: one deck box per straight segment,
            // pylons every PYLON_GAP along it
            for (let i = 0; i < path.length - 1; i++) {
                const a = path[i], b = path[i + 1];
                const len = Math.hypot(b.x - a.x, b.z - a.z);
                if (len < 1) continue;
                const deck = new THREE.BoxGeometry(len + DECK_W, DECK_H, DECK_W);
                deck.rotateY(Math.atan2(b.z - a.z, b.x - a.x) * -1);
                deck.translate((a.x + b.x) / 2, TRAM_Y - 11, (a.z + b.z) / 2);
                deckParts.push(paint(deck, 0x4a5364));
                for (let d = PYLON_GAP / 2; d < len; d += PYLON_GAP) {
                    const t = d / len;
                    pylonSpots.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
                }
            }
        }

        if (deckParts.length) {
            const deckMesh = new THREE.Mesh(
                mergeGeometries(deckParts, false),
                new THREE.MeshLambertMaterial({ vertexColors: true }));
            deckMesh.matrixAutoUpdate = false;
            scene.add(deckMesh);
        }
        if (pylonSpots.length) {
            const pg = new THREE.BoxGeometry(PYLON_W, TRAM_Y - 11, PYLON_W);
            pg.translate(0, (TRAM_Y - 11) / 2, 0);
            const pylons = new THREE.InstancedMesh(pg,
                new THREE.MeshLambertMaterial({ color: 0x515a6b }), pylonSpots.length);
            const d = new THREE.Object3D();
            pylonSpots.forEach((s, i) => {
                d.position.set(s.x, 0, s.z);
                d.updateMatrix();
                pylons.setMatrixAt(i, d.matrix);
                // solid to the player — walking through a visible pillar reads
                // worse than the occasional car clipping one in the median
                G.colliders.push({
                    x0: s.x - PYLON_W / 2, x1: s.x + PYLON_W / 2,
                    z0: s.z - PYLON_W / 2, z1: s.z + PYLON_W / 2
                });
            });
            pylons.instanceMatrix.needsUpdate = true;
            scene.add(pylons);
        }
    },

    _updateTrams(dt) {
        for (const tr of this.trams) {
            if (tr.wait > 0) {
                tr.wait -= dt;
                tr.wasWaiting = true;
                continue;
            }
            if (tr.wasWaiting) {
                tr.wasWaiting = false;
                // departing — award train spotter if the player is close to either end
                const p = G.camera.position;
                const near = Math.min(
                    Math.hypot(p.x - tr.endX[0], p.z - tr.endZ[0]),
                    Math.hypot(p.x - tr.endX[1], p.z - tr.endZ[1]));
                if (near < 240) G.ui?.event('tram_depart');
            }
            tr.dist += tr.dir * tr.speed * dt;
            if (tr.dist >= tr.total) { tr.dist = tr.total; tr.dir = -1; tr.wait = 6; }
            else if (tr.dist <= 0) { tr.dist = 0; tr.dir = 1; tr.wait = 6; }
            // walk the polyline
            let rem = tr.dist;
            for (let i = 0; i < tr.segs.length; i++) {
                if (rem <= tr.segs[i] || i === tr.segs.length - 1) {
                    const t = tr.segs[i] ? rem / tr.segs[i] : 0;
                    const a = tr.path[i], b = tr.path[i + 1];
                    tr.obj.position.set(a.x + (b.x - a.x) * t, TRAM_Y, a.z + (b.z - a.z) * t);
                    tr.obj.rotation.y = Math.atan2((b.x - a.x) * tr.dir, (b.z - a.z) * tr.dir) - Math.PI / 2;
                    break;
                }
                rem -= tr.segs[i];
            }
        }
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
        const heli = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(26, 12, 12), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
        const tail = new THREE.Mesh(new THREE.BoxGeometry(24, 5, 5), new THREE.MeshLambertMaterial({ color: 0x922b21 }));
        tail.position.x = -22;
        const rotor = new THREE.Mesh(new THREE.BoxGeometry(52, 1, 4), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
        rotor.position.y = 8;
        heli.add(body, tail, rotor);
        heli.userData.rotor = rotor;
        scene.add(heli);
        this.heli = { obj: heli, angle: 0 };
    },

    _updateHeli(dt, t) {
        if (!this.heli) return;
        const h = this.heli;
        h.angle += dt * 0.09;
        const r = 1400;
        h.obj.position.set(Math.cos(h.angle) * r - 500, 360 + Math.sin(t * 0.5) * 20, Math.sin(h.angle) * r);
        h.obj.rotation.y = -h.angle;
        h.obj.userData.rotor.rotation.y += dt * 30;
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

    update(dt, t) {
        this._updateCars(dt);
        this._updateTruck(dt);
        this._updateTrams(dt);
        this._updateBlimps(dt, t);
        this._updateHeli(dt, t);
        this._updateRockets(dt, t);
    }
};
