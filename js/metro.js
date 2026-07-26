/* ──────────────────────────────────────────────────────────────────────────
   METRO — underground rolling stock + board / ride / alight.
   Trains run in real tunnel tubes; boarding puts you in a sealed cabin with
   tunnel exterior visible through windows (no looking up through the city slab).
   ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { TRAM_LINES } from './data.js';
import { City } from './city.js';

const TUNNEL_Y = -48;       // track height
const CABIN_EYE = 12;       // eye height above track inside car

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
        train.dwellT = train._longDwell ? 5.5 : 2.4;
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

function carGeo(hex) {
    const parts = [];
    const box = (w, h, d, x, y, z, c) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(paint(g, c));
    };
    box(52, 16, 18, 0, 11, 0, hex);
    box(48, 10, 16, 0, 22, 0, 0x6ab0d0);
    box(14, 12, 16, 22, 12, 0, 0x1a2230);
    box(8, 6, 14, 28, 14, 0, 0x88ccee);
    box(12, 3, 12, -18, 28, 0, 0xffffff);
    box(2, 8, 2, -18, 34, 0, 0xcccccc);
    for (const s of [-1, 1]) box(10, 2, 1.5, 0, 8, s * 9.2, 0x0ea5e9);
    return mergeGeometries(parts, false);
}

/** Sealed metro car cabin — full shell so you never see the void under the city. */
function buildCabin() {
    const g = new THREE.Group();
    const shell = [], glow = [];
    const push = (arr, w, h, d, x, y, z, hex) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(x, y, z);
        arr.push(paint(geo, hex));
    };
    // Floor, ceiling, both side walls, both end walls — fully sealed
    push(shell, 80, 2, 32, 0, 0, 0, 0x1e293b);          // floor
    push(shell, 80, 2, 32, 0, 36, 0, 0x0f172a);          // ceiling
    push(shell, 80, 36, 2, 0, 18, -16, 0x334155);        // left wall
    push(shell, 80, 36, 2, 0, 18, 16, 0x334155);         // right wall
    push(shell, 2, 36, 32, -40, 18, 0, 0x1e293b);        // rear bulkhead
    push(shell, 2, 36, 32, 40, 18, 0, 0x1e293b);         // front bulkhead

    // Window openings as dark glass panels on both sides
    for (let i = 0; i < 5; i++) {
        const wx = -28 + i * 14;
        push(glow, 11, 10, 0.6, wx, 20, -15.6, 0x0c4a6e); // left windows
        push(glow, 11, 10, 0.6, wx, 20, 15.6, 0x0c4a6e);  // right windows
    }
    // seats
    for (let i = 0; i < 5; i++) {
        push(shell, 12, 8, 7, -28 + i * 14, 5, -10, 0x1e3a5f);
        push(shell, 12, 8, 7, -28 + i * 14, 5, 10, 0x1e3a5f);
    }
    // poles + strip lights
    for (const x of [-20, 0, 20]) push(glow, 1.4, 30, 1.4, x, 16, 0, 0x94a3b8);
    push(glow, 60, 1.2, 4, 0, 34, 0, 0xfde68a);
    // door stripe
    push(glow, 14, 24, 0.5, 0, 14, -15.7, 0x22d3ee);
    push(glow, 14, 24, 0.5, 0, 14, 15.7, 0x22d3ee);
    // route map strip
    push(glow, 50, 4, 0.4, 0, 30, -15.5, 0x0ea5e9);

    const shellM = new THREE.Mesh(
        mergeGeometries(shell, false),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 })
    );
    const glowM = new THREE.Mesh(
        mergeGeometries(glow, false),
        new THREE.MeshBasicMaterial({ vertexColors: true })
    );
    g.add(shellM, glowM);
    g.visible = false;
    return g;
}

/** Tunnel segments + station boxes along routes (one merged mesh). */
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
            // tube: floor, ceiling, two walls
            const tw = 44, th = 36;
            const floor = new THREE.BoxGeometry(tw, 3, len + 8);
            floor.rotateY(ang); floor.translate(mx, TUNNEL_Y - 2, mz);
            parts.push(paint(floor, 0x1a1f28));
            const ceil = new THREE.BoxGeometry(tw, 3, len + 8);
            ceil.rotateY(ang); ceil.translate(mx, TUNNEL_Y + th, mz);
            parts.push(paint(ceil, 0x0f131a));
            // walls
            for (const side of [-1, 1]) {
                const wall = new THREE.BoxGeometry(3, th, len + 8);
                wall.rotateY(ang);
                // offset perpendicular to path
                const px = mx + Math.cos(ang) * side * (tw / 2);
                const pz = mz - Math.sin(ang) * side * (tw / 2);
                wall.translate(px, TUNNEL_Y + th / 2, pz);
                parts.push(paint(wall, 0x252b36));
            }
            // track rails
            for (const side of [-1, 1]) {
                const rail = new THREE.BoxGeometry(1.5, 1.2, len);
                rail.rotateY(ang);
                const px = mx + Math.cos(ang) * side * 6;
                const pz = mz - Math.sin(ang) * side * 6;
                rail.translate(px, TUNNEL_Y + 0.5, pz);
                parts.push(paint(rail, 0x64748b));
            }
            // tunnel lights every ~120u
            const nLights = Math.max(1, Math.floor(len / 120));
            for (let k = 0; k < nLights; k++) {
                const t = (k + 0.5) / nLights;
                const lx = a.x + dx * t, lz = a.z + dz * t;
                box(8, 2, 8, lx, TUNNEL_Y + th - 4, lz, 0xfbbf24, lights);
            }
        }
    }

    // station chambers
    const stationIds = new Set();
    for (const r of routes) for (const id of r.stops) stationIds.add(id);
    for (const id of stationIds) {
        const b = G.bldById[id];
        if (!b) continue;
        const sx = b.worldX, sz = b.worldZ;
        // platform hall
        box(160, 4, 90, sx, TUNNEL_Y - 1, sz, 0x334155);
        box(160, 4, 90, sx, TUNNEL_Y + 40, sz, 0x1e293b);
        for (const s of [-1, 1]) {
            box(160, 44, 4, sx, TUNNEL_Y + 20, sz + s * 46, 0x1e293b);
            box(4, 44, 90, sx + s * 82, TUNNEL_Y + 20, sz, 0x1e293b);
        }
        // platform edge yellow
        box(140, 1.5, 6, sx, TUNNEL_Y + 1, sz + 28, 0xfbbf24);
        box(140, 1.5, 6, sx, TUNNEL_Y + 1, sz - 28, 0xfbbf24);
        // pillars
        for (const ox of [-50, 0, 50]) {
            box(8, 40, 8, sx + ox, TUNNEL_Y + 20, sz, 0x475569);
        }
        // station lights
        for (const ox of [-40, 0, 40]) {
            box(20, 3, 20, sx + ox, TUNNEL_Y + 38, sz, 0xe2e8f0, lights);
        }
        // name glow strip
        box(80, 10, 2, sx, TUNNEL_Y + 32, sz - 44, 0x22d3ee, lights);
    }

    const group = new THREE.Group();
    group.name = 'metroUnderground';
    if (parts.length) {
        group.add(new THREE.Mesh(
            mergeGeometries(parts, false),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 })
        ));
    }
    if (lights.length) {
        group.add(new THREE.Mesh(
            mergeGeometries(lights, false),
            new THREE.MeshBasicMaterial({ vertexColors: true })
        ));
    }
    // ambient fill so tunnels aren't pitch black
    const pl = new THREE.PointLight(0x88aacc, 0.55, 400, 2);
    pl.position.set(0, TUNNEL_Y + 20, 0);
    group.userData.rideLight = pl;
    group.add(pl);
    return group;
}

export const Metro = {
    routes: [],
    trains: [],
    mesh: null,
    cabin: null,
    underground: null,
    pillars: null,
    _dummy: new THREE.Object3D(),
    active: true,
    riding: null,
    _rideSaved: null,
    _fogSave: null,
    _bgSave: null,

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
        scene.add(this.mesh);

        // street-level station markers
        const pillars = [];
        const stationIds = new Set();
        for (const r of this.routes) for (const id of r.stops) stationIds.add(id);
        for (const id of stationIds) {
            const b = G.bldById[id];
            if (!b) continue;
            const g = new THREE.BoxGeometry(6, 40, 6);
            g.translate(b.worldX + 50, 20, b.worldZ + 50);
            pillars.push(paint(g, 0x22d3ee));
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
        // always in scene (cheap when above ground via frustum / fog); boost when riding
        scene.add(this.underground);

        this.cabin = buildCabin();
        scene.add(this.cabin);
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

    board(index) {
        const t = this.trains[index];
        if (!t || this.riding != null) return false;
        this.riding = index;
        t._longDwell = true;
        if (t.dwellT < 1.2) t.dwellT = 1.2;

        if (G.inside && G.interior) {
            try { G.interior.exit(); } catch (_) { /* */ }
        }

        this._rideSaved = {
            pos: G.camera.position.clone(),
            yaw: G.player.yaw,
            pitch: G.player.pitch,
            floorY: G.floorY
        };

        // Enter underground presentation
        G.floorY = TUNNEL_Y;
        G.ridingMetro = true;
        this._justBoarded = true;
        G.player.vel.set(0, 0, 0);

        // Darken sky / fog for subway feel
        this._fogSave = G.scene.fog ? {
            color: G.scene.fog.color.clone(),
            near: G.scene.fog.near,
            far: G.scene.fog.far
        } : null;
        this._bgSave = G.scene.background;
        G.scene.background = new THREE.Color(0x05070c);
        if (G.scene.fog) {
            G.scene.fog.color.set(0x0a1018);
            G.scene.fog.near = 20;
            G.scene.fog.far = 280;
        }

        // Hide surface city while riding (keep lights + underground + cabin + trains)
        this._cityHidden = [];
        for (const o of G.scene.children) {
            if (!o.visible) continue;
            if (o.isLight) continue;
            if (o === this.cabin || o === this.underground || o === this.mesh) continue;
            if (o === this.pillars) continue;
            // keep weather sky sphere? hide it too for sealed feel
            o.visible = false;
            this._cityHidden.push(o);
        }
        if (this.underground) this.underground.visible = true;
        if (this.mesh) this.mesh.visible = true;
        if (this.cabin) this.cabin.visible = true;

        // ride light follows cabin
        const rl = this.underground?.userData?.rideLight;
        if (rl) { rl.intensity = 1.2; rl.distance = 220; }

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
        this.riding = null;
        G.ridingMetro = false;
        if (this.cabin) this.cabin.visible = false;
        G.floorY = 0;

        // restore city
        for (const o of this._cityHidden) o.visible = true;
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
        const rl = this.underground?.userData?.rideLight;
        if (rl) rl.position.set(t.x, t.y + 18, t.z);
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
                    if (t.dwellT < 2.5) t.dwellT = 2.5;
                }
            }
            stepTrain(t, dt, this.routes);
        }
        this._write();

        if (this.riding != null) {
            const t = this.trains[this.riding];
            if (t) this._attachCamera(t);
            this._annTimer = (this._annTimer || 0) - dt;
            if (this._annTimer <= 0) {
                this._annTimer = 2.2;
                if (t?.atStop) {
                    const st = G.bldById[t.atStop];
                    G.ui?.prompt?.(`<b>E</b> — alight at ${st?.name || t.atStop}`);
                } else if (t) {
                    const route = this.routes[t.routeIdx];
                    const next = route?.pts[(t.seg + 1) % route.pts.length];
                    const nb = next && G.bldById[next.bid];
                    G.ui?.lookLabel?.(nb ? `Next: ${nb.name}` : 'Tunnel — next stop soon…');
                    G.ui?.prompt?.('METRO — riding…');
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
            d.scale.set(1, 1, 1);
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
            positions: this.trains.map(t => ({ x: t.x, z: t.z, at: t.atStop, dwell: t.dwellT }))
        };
    }
};
