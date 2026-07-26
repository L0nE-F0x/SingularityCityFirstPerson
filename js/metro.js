/* ──────────────────────────────────────────────────────────────────────────
   METRO — underground rolling stock + board / ride / alight.
   Riding: sealed cabin with real window glass, continuous tunnel tubes +
   station halls, surface city hidden, fog/background locked every frame so
   weather cannot flash a blue void under the slab. Alight restores surface.
   ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { TRAM_LINES } from './data.js';
import { City } from './city.js';

const TUNNEL_Y = -48;       // track height
const CABIN_EYE = 12;       // eye height above track inside car
const DWELL_SHORT = 4.2;    // seconds at stop (enough to notice + board)
const DWELL_LONG = 8.0;     // when player is riding / nearby
const DWELL_NEAR = 5.5;     // hold while player stands at station

const RIDE_FOG = 0x0a1018;
const RIDE_BG = 0x05070c;

export function buildMetroRoutes(bldAt, lines = TRAM_LINES) {
    return lines.map(line => {
        const stops = line.stops.map(id => bldAt(id)).filter(Boolean);
        if (stops.length < 2) return null;
        const pts = [];
        for (let i = 0; i < stops.length; i++) {
            const s = stops[i];
            pts.push({ x: s.worldX, z: s.worldZ, bid: line.stops[i] });
        }
        for (let i = stops.length - 2; i >= 0; i--) {
            pts.push({ x: stops[i].worldX, z: stops[i].worldZ, bid: line.stops[i] });
        }
        return { id: line.id, color: line.color, stops: line.stops, pts, length: pts.length };
    }).filter(Boolean);
}

export function stepTrain(train, dt, routes) {
    const route = routes[train.routeIdx];
    if (!route || route.pts.length < 2) return;
    if (train.dwellT > 0) {
        train.dwellT -= dt;
        return;
    }
    const a = route.pts[train.seg % route.pts.length];
    const b = route.pts[(train.seg + 1) % route.pts.length];
    const dx = b.x - a.x, dz = b.z - a.z;
    const dist = Math.hypot(dx, dz) || 1;
    train.segProgress += (train.speed * dt) / dist;
    while (train.segProgress >= 1) {
        train.segProgress -= 1;
        train.seg = (train.seg + 1) % route.pts.length;
        if (train.seg === 0) train.laps++;
        train.dwellT = train._longDwell ? DWELL_LONG : DWELL_SHORT;
        train.atStop = b.bid;
        train.x = b.x; train.z = b.z;
        return;
    }
    const u = train.segProgress;
    train.x = a.x + dx * u;
    train.z = a.z + dz * u;
    train.dirX = dx / dist;
    train.dirZ = dz / dist;
    train.atStop = null;
}

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

/** Premium exterior metro car — silver body, line-colour stripe, windows, lights. */
function carGeo(hex) {
    const parts = [];
    const box = (w, h, d, x, y, z, c) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(paint(g, c));
    };
    box(56, 14, 18, 0, 10, 0, 0xc5ced8);
    box(54, 3, 16, 0, 18.5, 0, 0x94a3b8);
    box(54, 3, 16, 0, 2.5, 0, 0x1e293b);
    box(54, 3, 18.4, 0, 8, 0, hex);
    box(6, 12, 16, 28, 11, 0, 0xb0bac6);
    box(6, 12, 16, -28, 11, 0, 0xb0bac6);
    box(1.5, 8, 14, 31.2, 13, 0, 0x0c4a6e);
    box(1.5, 7, 14, -31.2, 13, 0, 0x0c4a6e);
    for (let i = 0; i < 4; i++) {
        const wx = -16 + i * 10;
        box(7, 6, 0.8, wx, 13, 9.1, 0x0c4a6e);
        box(7, 6, 0.8, wx, 13, -9.1, 0x0c4a6e);
    }
    for (const s of [-1, 1]) {
        box(8, 12, 0.6, 4, 10, s * 9.15, 0x334155);
        box(8, 12, 0.6, -10, 10, s * 9.15, 0x334155);
    }
    box(1.5, 2.5, 3, 31.5, 6, 5, 0xfff2cc);
    box(1.5, 2.5, 3, 31.5, 6, -5, 0xfff2cc);
    box(1.5, 2.2, 3, -31.5, 6, 5, 0xff3344);
    box(1.5, 2.2, 3, -31.5, 6, -5, 0xff3344);
    box(10, 2, 8, -8, 21, 0, 0x64748b);
    box(1.5, 6, 1.5, -8, 25, 0, 0x94a3b8);
    for (const bx of [16, -16]) box(10, 3, 14, bx, 1.5, 0, 0x0f172a);
    return mergeGeometries(parts, false);
}

/**
 * Sealed ride cabin — solid shell with real window cutouts + transparent glass
 * so tunnel exterior reads through, but no open floor/ceiling/ends to the void.
 */
function buildCabin() {
    const g = new THREE.Group();
    const shell = [], glow = [];
    const push = (arr, w, h, d, x, y, z, hex) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(x, y, z);
        arr.push(paint(geo, hex));
    };

    const L = 78, W = 30, H = 34;
    push(shell, L, 2.2, W, 0, 0, 0, 0x1e293b);
    push(shell, L, 2.2, W, 0, H, 0, 0x0f172a);
    push(shell, L - 4, 0.4, 8, 0, 1.3, 0, 0x334155);
    push(shell, 2.5, H, W, -L / 2, H / 2, 0, 0x1e293b);
    push(shell, 2.5, H, W, L / 2, H / 2, 0, 0x1e293b);
    push(glow, 0.5, 22, 10, L / 2 - 0.2, 12, 0, 0x22d3ee);
    push(glow, 0.5, 22, 10, -L / 2 + 0.2, 12, 0, 0x22d3ee);

    const winH = 11, winY = 18;
    const sillH = winY - winH / 2;
    const headH = H - (winY + winH / 2);
    const wallZ = W / 2;
    const winW = 10, gap = 3.5, nWin = 5;
    const totalWinSpan = nWin * winW + (nWin - 1) * gap;
    const startX = -totalWinSpan / 2;

    for (const side of [-1, 1]) {
        const z = side * wallZ;
        push(shell, L, sillH, 2.2, 0, sillH / 2, z, 0x334155);
        push(shell, L, headH, 2.2, 0, winY + winH / 2 + headH / 2, z, 0x334155);
        const edge = totalWinSpan / 2 + 2;
        push(shell, L / 2 - edge, winH, 2.2, -(edge + (L / 2 - edge) / 2), winY, z, 0x334155);
        push(shell, L / 2 - edge, winH, 2.2, edge + (L / 2 - edge) / 2, winY, z, 0x334155);
        for (let i = 0; i < nWin - 1; i++) {
            const mx = startX + (i + 1) * winW + i * gap + gap / 2;
            push(shell, gap, winH, 2.2, mx, winY, z, 0x475569);
        }
        push(glow, 12, 22, 0.5, 0, 12, z * 0.98, 0x0ea5e9);
    }

    const glassM = new THREE.MeshStandardMaterial({
        color: 0x7dd3fc, metalness: 0.15, roughness: 0.05,
        transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide
    });
    for (const side of [-1, 1]) {
        for (let i = 0; i < nWin; i++) {
            const wx = startX + i * (winW + gap) + winW / 2;
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(winW - 0.6, winH - 0.6), glassM);
            plane.position.set(wx, winY, side * (wallZ - 0.6));
            if (side < 0) plane.rotation.y = Math.PI;
            g.add(plane);
        }
    }

    for (let i = 0; i < 5; i++) {
        const sx = -28 + i * 14;
        push(shell, 11, 7, 6.5, sx, 4.5, -9, 0x1e3a5f);
        push(shell, 11, 7, 6.5, sx, 4.5, 9, 0x1e3a5f);
        push(shell, 2, 10, 6.5, sx - 4, 10, -9, 0x1e3a5f);
        push(shell, 2, 10, 6.5, sx - 4, 10, 9, 0x1e3a5f);
    }
    for (const x of [-24, -8, 8, 24]) push(glow, 1.2, 28, 1.2, x, 16, 0, 0xcbd5e1);
    push(glow, 60, 1.0, 3.5, 0, H - 2.5, 0, 0xfde68a);
    push(glow, 60, 0.6, 1.5, 0, H - 2.2, -6, 0xfef3c7);
    push(glow, 60, 0.6, 1.5, 0, H - 2.2, 6, 0xfef3c7);
    push(glow, 50, 3.5, 0.4, 0, 28, -wallZ + 1.2, 0x0ea5e9);
    push(glow, 50, 3.5, 0.4, 0, 28, wallZ - 1.2, 0x0ea5e9);
    push(glow, L - 10, 0.3, 1.2, 0, 1.5, 0, 0x22d3ee);

    for (const [px, pz] of [[-18, -5], [12, 5], [-6, 4]]) {
        push(shell, 4, 12, 3.5, px, 8, pz, 0x334155);
        push(shell, 3.2, 3.2, 3.2, px, 16, pz, 0xe8b98e);
    }

    g.add(
        new THREE.Mesh(
            mergeGeometries(shell, false),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.18 })
        ),
        new THREE.Mesh(
            mergeGeometries(glow, false),
            new THREE.MeshBasicMaterial({ vertexColors: true })
        )
    );
    g.visible = false;
    return g;
}

/**
 * Back-face dark shell that follows the train — any tunnel gap or sky leak
 * resolves to subway black, never open blue void under the city.
 */
function buildVoidShell() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
        color: RIDE_BG, side: THREE.BackSide, depthWrite: true
    });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(900, 160, 900), mat);
    shell.position.y = 20;
    g.add(shell);
    const inner = new THREE.Mesh(
        new THREE.BoxGeometry(220, 70, 220),
        new THREE.MeshBasicMaterial({ color: 0x080b12, side: THREE.BackSide })
    );
    inner.position.y = 18;
    g.add(inner);
    g.visible = false;
    g.name = 'metroVoidShell';
    return g;
}

/** Tunnel tubes + rails + station halls (merged). */
function buildUnderground(routes) {
    const parts = [];
    const lights = [];
    const box = (w, h, d, x, y, z, hex, arr = parts) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        arr.push(paint(g, hex));
    };

    const seenSeg = new Set();
    for (const r of routes) {
        for (let i = 0; i < r.pts.length - 1; i++) {
            const a = r.pts[i], b = r.pts[i + 1];
            const key = [Math.min(a.x, b.x), Math.min(a.z, b.z), Math.max(a.x, b.x), Math.max(a.z, b.z)]
                .map(v => Math.round(v / 10)).join(':');
            if (seenSeg.has(key)) continue;
            seenSeg.add(key);

            const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
            const dx = b.x - a.x, dz = b.z - a.z;
            const len = Math.hypot(dx, dz) || 1;
            const ang = Math.atan2(dx, dz);
            const tw = 48, th = 40;

            const floor = new THREE.BoxGeometry(tw, 4, len + 24);
            floor.rotateY(ang); floor.translate(mx, TUNNEL_Y - 2.5, mz);
            parts.push(paint(floor, 0x1a1f28));
            const ceil = new THREE.BoxGeometry(tw, 4, len + 24);
            ceil.rotateY(ang); ceil.translate(mx, TUNNEL_Y + th, mz);
            parts.push(paint(ceil, 0x0c1018));
            for (const side of [-1, 1]) {
                const wall = new THREE.BoxGeometry(4, th + 4, len + 24);
                wall.rotateY(ang);
                const px = mx + Math.cos(ang) * side * (tw / 2);
                const pz = mz - Math.sin(ang) * side * (tw / 2);
                wall.translate(px, TUNNEL_Y + th / 2, pz);
                parts.push(paint(wall, 0x222833));
            }
            for (const side of [-1, 1]) {
                const tray = new THREE.BoxGeometry(3, 2, len);
                tray.rotateY(ang);
                const px = mx + Math.cos(ang) * side * (tw / 2 - 6);
                const pz = mz - Math.sin(ang) * side * (tw / 2 - 6);
                tray.translate(px, TUNNEL_Y + th - 6, pz);
                parts.push(paint(tray, 0x3f4a5a));
            }
            for (const side of [-1, 1]) {
                const rail = new THREE.BoxGeometry(1.6, 1.4, len);
                rail.rotateY(ang);
                const px = mx + Math.cos(ang) * side * 6.5;
                const pz = mz - Math.sin(ang) * side * 6.5;
                rail.translate(px, TUNNEL_Y + 0.6, pz);
                parts.push(paint(rail, 0x94a3b8));
            }
            const nSleep = Math.max(2, Math.floor(len / 18));
            for (let k = 0; k < nSleep; k++) {
                const t = (k + 0.5) / nSleep;
                const sx = a.x + dx * t, sz = a.z + dz * t;
                const sleep = new THREE.BoxGeometry(16, 1, 3);
                sleep.rotateY(ang);
                sleep.translate(sx, TUNNEL_Y + 0.2, sz);
                parts.push(paint(sleep, 0x3d2b1f));
            }
            const third = new THREE.BoxGeometry(1.2, 1.5, len);
            third.rotateY(ang);
            {
                const px = mx + Math.cos(ang) * 11;
                const pz = mz - Math.sin(ang) * 11;
                third.translate(px, TUNNEL_Y + 0.8, pz);
                parts.push(paint(third, 0xfbbf24));
            }
            const nLights = Math.max(2, Math.floor(len / 90));
            for (let k = 0; k < nLights; k++) {
                const t = (k + 0.5) / nLights;
                const lx = a.x + dx * t, lz = a.z + dz * t;
                box(10, 2.5, 6, lx, TUNNEL_Y + th - 5, lz, 0xfde68a, lights);
                box(2, 4, 2, lx + Math.cos(ang) * 18, TUNNEL_Y + 16, lz - Math.sin(ang) * 18, 0x38bdf8, lights);
            }
        }
    }

    const stationIds = new Set();
    for (const r of routes) for (const id of r.stops) stationIds.add(id);
    for (const id of stationIds) {
        const b = G.bldById[id];
        if (!b) continue;
        const sx = b.worldX, sz = b.worldZ;
        box(180, 5, 110, sx, TUNNEL_Y - 1.5, sz, 0x2a3344);
        box(180, 5, 110, sx, TUNNEL_Y + 44, sz, 0x0f172a);
        for (const s of [-1, 1]) {
            box(180, 50, 5, sx, TUNNEL_Y + 22, sz + s * 56, 0x1a2230);
            box(5, 50, 110, sx + s * 92, TUNNEL_Y + 22, sz, 0x1a2230);
        }
        box(160, 3, 28, sx, TUNNEL_Y + 2, sz + 30, 0x475569);
        box(160, 3, 28, sx, TUNNEL_Y + 2, sz - 30, 0x475569);
        box(150, 1.2, 4, sx, TUNNEL_Y + 3.5, sz + 18, 0xfbbf24);
        box(150, 1.2, 4, sx, TUNNEL_Y + 3.5, sz - 18, 0xfbbf24);
        for (const ox of [-55, -20, 20, 55]) {
            box(7, 42, 7, sx + ox, TUNNEL_Y + 22, sz + 30, 0x64748b);
            box(7, 42, 7, sx + ox, TUNNEL_Y + 22, sz - 30, 0x64748b);
        }
        for (const ox of [-40, 0, 40]) {
            box(22, 6, 8, sx + ox, TUNNEL_Y + 6, sz + 38, 0x334155);
            box(22, 6, 8, sx + ox, TUNNEL_Y + 6, sz - 38, 0x334155);
        }
        for (const ox of [-50, -15, 15, 50]) {
            box(24, 3, 18, sx + ox, TUNNEL_Y + 41, sz, 0xf1f5f9, lights);
        }
        box(90, 12, 2.5, sx, TUNNEL_Y + 34, sz - 54, 0x22d3ee, lights);
        box(90, 12, 2.5, sx, TUNNEL_Y + 34, sz + 54, 0x22d3ee, lights);
        for (const s of [-1, 1]) {
            box(40, 36, 8, sx + s * 70, TUNNEL_Y + 18, sz, 0x252b36);
        }
    }

    const group = new THREE.Group();
    group.name = 'metroUnderground';
    if (parts.length) {
        group.add(new THREE.Mesh(
            mergeGeometries(parts, false),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.08 })
        ));
    }
    if (lights.length) {
        group.add(new THREE.Mesh(
            mergeGeometries(lights, false),
            new THREE.MeshBasicMaterial({ vertexColors: true })
        ));
    }
    const pl = new THREE.PointLight(0x99b8d8, 0.65, 420, 2);
    pl.position.set(0, TUNNEL_Y + 20, 0);
    group.userData.rideLight = pl;
    group.add(pl);
    const pl2 = new THREE.PointLight(0xfde68a, 0.35, 180, 2);
    pl2.position.set(0, TUNNEL_Y + 24, 0);
    group.userData.rideLight2 = pl2;
    group.add(pl2);
    return group;
}

export const Metro = {
    routes: [],
    trains: [],
    mesh: null,
    cabin: null,
    voidShell: null,
    underground: null,
    pillars: null,
    _dummy: new THREE.Object3D(),
    active: true,
    riding: null,
    _rideSaved: null,
    _fogSave: null,
    _bgSave: null,
    _rideBgColor: null,

    init(scene) {
        this.routes = buildMetroRoutes(id => G.bldById[id]);
        this.trains = [];
        for (let i = 0; i < this.routes.length; i++) {
            const r = this.routes[i];
            for (const [seg, prog] of [[0, i * 0.25], [Math.floor(r.pts.length / 2), 0.1]]) {
                this.trains.push({
                    routeIdx: i, seg, segProgress: prog, speed: 155,
                    x: r.pts[0].x, z: r.pts[0].z, dirX: 1, dirZ: 0,
                    y: TUNNEL_Y, atStop: null, dwellT: 0, laps: 0,
                    color: r.color, _longDwell: false
                });
            }
        }
        const N = Math.max(1, this.trains.length);
        this.mesh = new THREE.InstancedMesh(
            carGeo(0x334155),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            N
        );
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        for (let i = 0; i < N; i++) {
            this.mesh.setColorAt(i, new THREE.Color(this.trains[i]?.color || 0x334155));
        }
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        scene.add(this.mesh);

        const pillars = [];
        const stationIds = new Set();
        for (const r of this.routes) for (const id of r.stops) stationIds.add(id);
        for (const id of stationIds) {
            const b = G.bldById[id];
            if (!b) continue;
            const g = new THREE.BoxGeometry(6, 40, 6);
            g.translate(b.worldX + 50, 20, b.worldZ + 50);
            pillars.push(paint(g, 0x22d3ee));
            const cap = new THREE.BoxGeometry(28, 3, 16);
            cap.translate(b.worldX + 50, 42, b.worldZ + 50);
            pillars.push(paint(cap, 0x0ea5e9));
        }
        if (pillars.length) {
            this.pillars = new THREE.Mesh(
                mergeGeometries(pillars, false),
                new THREE.MeshBasicMaterial({ vertexColors: true })
            );
            this.pillars.matrixAutoUpdate = false;
            scene.add(this.pillars);
        }

        this.underground = buildUnderground(this.routes);
        scene.add(this.underground);

        this.cabin = buildCabin();
        scene.add(this.cabin);

        this.voidShell = buildVoidShell();
        scene.add(this.voidShell);

        this._rideBgColor = new THREE.Color(RIDE_BG);
        this._write();
    },

    nearestStation(x, z, maxDist = 220) {
        let best = null, bd = maxDist;
        for (const id of ['metro_west', 'metro_central', 'metro_east', 'metro_innovation']) {
            const b = G.bldById[id];
            if (!b) continue;
            const d = Math.hypot(b.worldX - x, b.worldZ - z);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    },

    trainAtStop(bid) {
        if (!bid) return null;
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            if (t.atStop === bid && t.dwellT > 0.15) return { train: t, index: i };
        }
        return null;
    },

    canBoardNear(x, z) {
        if (this.riding != null) return null;
        const st = this.nearestStation(x, z, 180);
        if (!st) return null;
        const hit = this.trainAtStop(st.id);
        if (!hit) return null;
        return { station: st, ...hit };
    },

    /** Objects allowed to stay visible while riding (everything else = surface leak risk). */
    _isRideKeep(o) {
        return o === this.cabin || o === this.underground || o === this.mesh || o === this.voidShell;
    },

    /**
     * Force subway presentation every frame.
     * Weather rewrites fog; stars/rain/clouds can become visible mid-ride if they
     * were hidden at board time and therefore never entered `_cityHidden`.
     */
    _lockRideAtmosphere() {
        if (!this._rideBgColor) this._rideBgColor = new THREE.Color(RIDE_BG);
        G.scene.background = this._rideBgColor;
        if (G.scene.fog) {
            G.scene.fog.color.setHex(RIDE_FOG);
            G.scene.fog.near = 12;
            G.scene.fog.far = 240;
        }
        // Aggressively hide ANY surface object that reappeared (stars, precip, wetness…)
        if (G.scene) {
            for (const o of G.scene.children) {
                if (!o || o.isLight) continue;
                if (this._isRideKeep(o)) {
                    o.visible = true;
                    continue;
                }
                if (o.visible) {
                    o.visible = false;
                    // Track for restore on alight if we didn't already
                    if (this._cityHidden && !this._cityHidden.includes(o)) {
                        this._cityHidden.push(o);
                    }
                }
            }
        } else if (this._cityHidden) {
            for (const o of this._cityHidden) {
                if (o && o.visible) o.visible = false;
            }
        }
        if (this.cabin) this.cabin.visible = true;
        if (this.underground) this.underground.visible = true;
        if (this.mesh) this.mesh.visible = true;
        if (this.voidShell) this.voidShell.visible = true;
        if (this.pillars) this.pillars.visible = false;
    },

    board(index) {
        const t = this.trains[index];
        if (!t || this.riding != null) return false;
        this.riding = index;
        t._longDwell = true;
        if (t.dwellT < 3.5) t.dwellT = 3.5;

        if (G.inside && G.interior) {
            try { G.interior.exit(); } catch (_) { /* */ }
        }

        this._rideSaved = {
            pos: G.camera.position.clone(),
            yaw: G.player.yaw,
            pitch: G.player.pitch,
            floorY: G.floorY
        };

        G.floorY = TUNNEL_Y;
        G.ridingMetro = true;
        this._justBoarded = true;
        G.player.vel.set(0, 0, 0);

        this._fogSave = G.scene.fog ? {
            color: G.scene.fog.color.clone(),
            near: G.scene.fog.near,
            far: G.scene.fog.far
        } : null;
        this._bgSave = G.scene.background;

        // Snapshot every currently-visible surface object for restore; then hide.
        // Mid-ride reappearances (stars/rain) are caught every frame in _lockRideAtmosphere.
        this._cityHidden = [];
        for (const o of G.scene.children) {
            if (!o || o.isLight) continue;
            if (this._isRideKeep(o)) continue;
            if (o.visible) this._cityHidden.push(o);
            o.visible = false;
        }
        if (this.underground) this.underground.visible = true;
        if (this.mesh) this.mesh.visible = true;
        if (this.cabin) this.cabin.visible = true;
        if (this.voidShell) this.voidShell.visible = true;
        if (this.pillars) this.pillars.visible = false;

        const rl = this.underground?.userData?.rideLight;
        if (rl) { rl.intensity = 1.4; rl.distance = 260; }
        const rl2 = this.underground?.userData?.rideLight2;
        if (rl2) { rl2.intensity = 0.7; rl2.distance = 200; }

        this._lockRideAtmosphere();
        this._attachCamera(t);
        G.ui?.banner?.('🚇 Metro', 'riding underground — E at a stop to alight');
        G.ui?.addToast?.('Boarded the metro', 'info');
        G.audio?.sfx?.('open');
        G.progress?.unlock?.('train_spotter');
        return true;
    },

    alight() {
        if (this.riding == null) return false;
        const t = this.trains[this.riding];
        const stopId = t?.atStop;
        const stop = stopId && G.bldById[stopId];
        if (t && (!t.atStop || t.dwellT <= 0)) {
            G.ui?.addToast?.('Wait for the next stop', 'info');
            return false;
        }
        this.riding = null;
        G.ridingMetro = false;
        if (this.cabin) this.cabin.visible = false;
        if (this.voidShell) this.voidShell.visible = false;
        G.floorY = 0;

        for (const o of this._cityHidden || []) o.visible = true;
        this._cityHidden = [];
        if (this._fogSave && G.scene.fog) {
            G.scene.fog.color.copy(this._fogSave.color);
            G.scene.fog.near = this._fogSave.near;
            G.scene.fog.far = this._fogSave.far;
        }
        if (this._bgSave !== undefined) G.scene.background = this._bgSave;
        this._fogSave = null;
        this._bgSave = null;
        const rl = this.underground?.userData?.rideLight;
        if (rl) rl.intensity = 0.55;
        const rl2 = this.underground?.userData?.rideLight2;
        if (rl2) rl2.intensity = 0.35;

        if (stop) {
            const side = City.offRoad
                ? City.offRoad(stop.worldX + 70, stop.worldZ + 70)
                : { x: stop.worldX + 70, z: stop.worldZ + 70 };
            G.player.teleport(side.x, side.z, Math.atan2(stop.worldX - side.x, stop.worldZ - side.z));
            G.ui?.banner?.((stop.emoji || '🚇') + ' ' + stop.name, 'you have arrived');
        } else if (this._rideSaved) {
            G.player.teleport(this._rideSaved.pos.x, this._rideSaved.pos.z, this._rideSaved.yaw);
        }
        this._rideSaved = null;
        G.audio?.sfx?.('close');
        G.ui?.addToast?.('Alighted from metro', 'info');
        return true;
    },

    _attachCamera(t) {
        const eye = t.y + CABIN_EYE;
        G.camera.position.set(t.x, eye, t.z);
        if (this._justBoarded) {
            G.player.yaw = Math.atan2(t.dirX, t.dirZ);
            G.player.pitch = 0;
            this._justBoarded = false;
        }
        G.camera.rotation.order = 'YXZ';
        G.camera.rotation.y = G.player.yaw;
        G.camera.rotation.x = G.player.pitch;
        if (this.cabin) {
            this.cabin.position.set(t.x, t.y, t.z);
            this.cabin.rotation.y = Math.atan2(t.dirX, t.dirZ);
        }
        if (this.voidShell) {
            this.voidShell.position.set(t.x, t.y, t.z);
            this.voidShell.rotation.y = Math.atan2(t.dirX, t.dirZ);
        }
        const rl = this.underground?.userData?.rideLight;
        if (rl) rl.position.set(t.x, t.y + 18, t.z);
        const rl2 = this.underground?.userData?.rideLight2;
        if (rl2) rl2.position.set(t.x + t.dirX * 20, t.y + 14, t.z + t.dirZ * 20);
    },

    update(dt) {
        if (!this.active || !this.mesh) return;
        if (this.riding != null) {
            const t = this.trains[this.riding];
            if (t) t._longDwell = true;
        }
        const px = G.camera?.position?.x, pz = G.camera?.position?.z;
        for (const t of this.trains) {
            if (t.dwellT > 0 && t.atStop && px != null && !G.ridingMetro) {
                const st = G.bldById[t.atStop];
                if (st && Math.hypot(st.worldX - px, st.worldZ - pz) < 220) {
                    t._longDwell = true;
                    if (t.dwellT < DWELL_NEAR) t.dwellT = DWELL_NEAR;
                }
            }
            stepTrain(t, dt, this.routes);
        }
        this._write();

        if (this.riding != null) {
            // CRITICAL: re-lock fog/bg every frame — weather.js rewrites fog continuously
            this._lockRideAtmosphere();
            const t = this.trains[this.riding];
            if (t) this._attachCamera(t);
            this._annTimer = (this._annTimer || 0) - dt;
            if (this._annTimer <= 0) {
                this._annTimer = 1.8;
                if (t?.atStop && t.dwellT > 0.2) {
                    const st = G.bldById[t.atStop];
                    G.ui?.prompt?.(`<b>E</b> — alight at ${st?.name || t.atStop}`);
                } else if (t) {
                    const route = this.routes[t.routeIdx];
                    const next = route?.pts[(t.seg + 1) % route.pts.length];
                    const nb = next && G.bldById[next.bid];
                    G.ui?.lookLabel?.(nb ? `Next: ${nb.name}` : 'Tunnel — next stop soon…');
                    G.ui?.prompt?.('METRO — riding underground…');
                }
            }
        }
    },

    _write() {
        const d = this._dummy;
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            d.position.set(t.x, t.y, t.z);
            d.rotation.y = Math.atan2(t.dirX, t.dirZ);
            // hide the car you are inside so exterior hull never clips the cabin
            if (this.riding === i) d.scale.set(0.001, 0.001, 0.001);
            else d.scale.set(1, 1, 1);
            d.updateMatrix();
            this.mesh.setMatrixAt(i, d.matrix);
            this.mesh.setColorAt(i, new THREE.Color(t.color));
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    },

    snapshot() {
        return {
            lines: this.routes.length,
            trains: this.trains.length,
            stops: [...new Set(this.routes.flatMap(r => r.stops))],
            laps: this.trains.reduce((s, t) => s + t.laps, 0),
            riding: this.riding,
            hasTunnels: !!this.underground,
            hasCabin: !!this.cabin,
            hasVoidShell: !!this.voidShell,
            positions: this.trains.map(t => ({ x: t.x, z: t.z, at: t.atStop, dwell: t.dwellT }))
        };
    }
};
