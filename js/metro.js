/* ──────────────────────────────────────────────────────────────────────────
   METRO — underground rolling stock + player board / ride / alight.
   Trains shuttle between metro stations on TRAM_LINES polylines.
   Boarding: from a station platform (Interior floor max on type metro) or
   from street when a train is dwelling at the nearest station and you are
   close enough to its entrance. While riding, the camera follows the car;
   E alights at the next dwell.
   ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, EYE_H } from './state.js';
import { TRAM_LINES } from './data.js';
import { City } from './city.js';

export function buildMetroRoutes(bldAt, lines = TRAM_LINES) {
    return lines.map(line => {
        const stops = line.stops.map(id => bldAt(id)).filter(Boolean);
        if (stops.length < 2) return null;
        const pts = [];
        for (let i = 0; i < stops.length; i++) {
            const s = stops[i];
            pts.push({ x: s.worldX, z: s.worldZ, bid: line.stops[i] });
        }
        // ping-pong path
        for (let i = stops.length - 2; i >= 0; i--) {
            pts.push({ x: stops[i].worldX, z: stops[i].worldZ, bid: line.stops[i] });
        }
        return { id: line.id, color: line.color, stops: line.stops, pts, length: pts.length };
    }).filter(Boolean);
}

export function stepTrain(train, dt, routes) {
    const route = routes[train.routeIdx];
    if (!route || route.pts.length < 2) return;
    // dwell at stops (longer when player might board / alight)
    if (train.dwellT > 0) {
        train.dwellT -= dt;
        if (train.dwellT <= 0) train.atStop = train.atStop; // keep last stop id until move starts
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
    // richer car silhouette (still one merged mesh)
    box(52, 16, 18, 0, 11, 0, hex);           // body
    box(48, 10, 16, 0, 22, 0, 0x6ab0d0);      // upper windows band
    box(14, 12, 16, 22, 12, 0, 0x1a2230);     // cab nose
    box(8, 6, 14, 28, 14, 0, 0x88ccee);       // windscreen
    box(12, 3, 12, -18, 28, 0, 0xffffff);     // pantograph base
    box(2, 8, 2, -18, 34, 0, 0xcccccc);
    for (const s of [-1, 1]) {
        box(10, 2, 1.5, 0, 8, s * 9.2, 0x0ea5e9); // door stripe
    }
    return mergeGeometries(parts, false);
}

/** Simple train-car cabin for the ride camera (parked in scene, follows train). */
function buildCabin() {
    const g = new THREE.Group();
    const shell = [];
    const glow = [];
    const push = (arr, w, h, d, x, y, z, hex) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        geo.translate(x, y, z);
        arr.push(paint(geo, hex));
    };
    // floor / walls / ceiling of car cabin (local, camera sits inside)
    push(shell, 70, 2, 28, 0, 0, 0, 0x1e293b);
    push(shell, 70, 2, 28, 0, 32, 0, 0x0f172a);
    push(shell, 2, 32, 28, -35, 16, 0, 0x334155);
    push(shell, 2, 32, 28, 35, 16, 0, 0x334155);
    push(shell, 70, 32, 2, 0, 16, -14, 0x475569);
    // open side toward city cutaway feel
    push(glow, 60, 1, 1, 0, 30, 0, 0xfde68a);
    for (let i = 0; i < 4; i++) {
        push(shell, 12, 8, 6, -24 + i * 16, 5, -8, 0x1e3a5f); // seats
        push(shell, 12, 8, 6, -24 + i * 16, 5, 8, 0x1e3a5f);
    }
    // poles
    for (const x of [-18, 0, 18]) push(glow, 1.2, 28, 1.2, x, 14, 0, 0x94a3b8);
    // windows (emissive night tunnel glow)
    for (let i = 0; i < 5; i++) push(glow, 10, 10, 0.5, -24 + i * 12, 18, -13.6, 0x0b111b);

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const shellM = new THREE.Mesh(mergeGeometries(shell, false), mat);
    const glowM = new THREE.Mesh(mergeGeometries(glow, false),
        new THREE.MeshBasicMaterial({ vertexColors: true }));
    g.add(shellM, glowM);
    g.visible = false;
    return g;
}

export const Metro = {
    routes: [],
    trains: [],
    mesh: null,
    cabin: null,
    pillars: null,
    _dummy: new THREE.Object3D(),
    active: true,
    riding: null,          // train index or null
    _rideSaved: null,
    _cityHidden: [],

    init(scene) {
        this.routes = buildMetroRoutes(id => G.bldById[id]);
        this.trains = [];
        for (let i = 0; i < this.routes.length; i++) {
            const r = this.routes[i];
            for (const [seg, prog] of [[0, i * 0.25], [Math.floor(r.pts.length / 2), 0.1]]) {
                this.trains.push({
                    routeIdx: i,
                    seg,
                    segProgress: prog,
                    speed: 155,
                    x: r.pts[0].x,
                    z: r.pts[0].z,
                    dirX: 1, dirZ: 0,
                    y: -52,             // subway depth
                    atStop: null,
                    dwellT: 0,
                    laps: 0,
                    color: r.color,
                    _longDwell: false
                });
            }
        }
        const N = this.trains.length;
        this.mesh = new THREE.InstancedMesh(
            carGeo(0x334155),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            Math.max(1, N)
        );
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // station entrance markers
        const pillars = [];
        const stationIds = new Set();
        for (const r of this.routes) for (const id of r.stops) stationIds.add(id);
        for (const id of stationIds) {
            const b = G.bldById[id];
            if (!b) continue;
            const g = new THREE.BoxGeometry(6, 40, 6);
            g.translate(b.worldX + 50, 20, b.worldZ + 50);
            const c = new THREE.Color(0x22d3ee);
            const n = g.attributes.position.count;
            const col = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
            g.setAttribute('color', new THREE.BufferAttribute(col, 3));
            pillars.push(g);
        }
        if (pillars.length) {
            this.pillars = new THREE.Mesh(
                mergeGeometries(pillars, false),
                new THREE.MeshBasicMaterial({ vertexColors: true })
            );
            this.pillars.matrixAutoUpdate = false;
            scene.add(this.pillars);
        }
        scene.add(this.mesh);

        this.cabin = buildCabin();
        scene.add(this.cabin);
        this._write();
    },

    /** Nearest metro station building id within radius of world xz. */
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

    /** Train currently dwelling at station id, or null. */
    trainAtStop(bid) {
        if (!bid) return null;
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            if (t.atStop === bid && t.dwellT > 0.15) return { train: t, index: i };
        }
        return null;
    },

    /** True if player can board from street / platform near this station. */
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
        // stretch current dwell so boarding feels intentional
        if (t.dwellT < 1.2) t.dwellT = 1.2;

        // leave interior if we boarded from platform
        if (G.inside && G.interior) {
            try { G.interior.exit(); } catch (_) { /* */ }
        }

        this._rideSaved = {
            pos: G.camera.position.clone(),
            yaw: G.player.yaw,
            pitch: G.player.pitch,
            floorY: G.floorY
        };

        // Hide city surface clutter but keep trains / cabin / weather lights
        this._cityHidden = [];
        // Stay in world — dim far fog while underground
        G.floorY = t.y;
        G.ridingMetro = true;
        this._justBoarded = true;
        G.player.vel.set(0, 0, 0);

        if (this.cabin) this.cabin.visible = true;
        this._attachCamera(t);
        G.ui?.banner?.('🚇 Metro', 'riding — press E at a station to alight');
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

        if (stop) {
            // emerge on sidewalk by the station entrance
            const side = City.offRoad
                ? City.offRoad(stop.worldX + 70, stop.worldZ + 70)
                : { x: stop.worldX + 70, z: stop.worldZ + 70 };
            G.player.teleport(side.x, side.z, Math.atan2(stop.worldX - side.x, stop.worldZ - side.z));
            G.ui?.banner?.(stop.emoji + ' ' + stop.name, 'you have arrived');
        } else if (this._rideSaved) {
            G.player.teleport(this._rideSaved.pos.x, this._rideSaved.pos.z, this._rideSaved.yaw);
        }
        this._rideSaved = null;
        G.audio?.sfx?.('close');
        G.ui?.addToast?.('Alighted from metro', 'info');
        return true;
    },

    _attachCamera(t) {
        // stand inside cabin; player yaw/pitch still free for looking around
        const eye = t.y + 14;
        G.camera.position.set(t.x, eye, t.z);
        // seed forward once when boarding; thereafter keep player yaw
        if (this._justBoarded) {
            G.player.yaw = Math.atan2(t.dirX, t.dirZ);
            G.player.pitch = 0;
            this._justBoarded = false;
        }
        G.camera.rotation.order = 'YXZ';
        G.camera.rotation.y = G.player.yaw;
        G.camera.rotation.x = G.player.pitch;
        if (this.cabin) {
            this.cabin.position.set(t.x, t.y + 2, t.z);
            this.cabin.rotation.y = Math.atan2(t.dirX, t.dirZ);
        }
    },

    update(dt) {
        if (!this.active || !this.mesh) return;
        // while player rides, force long dwell at stops for alighting
        if (this.riding != null) {
            const t = this.trains[this.riding];
            if (t) t._longDwell = true;
        }
        // Hold trains longer if player is near the station (easier boarding)
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
            if (this.cabin && t) {
                this.cabin.position.y = t.y + 2 + Math.sin(G.time * 6) * 0.35;
            }
            // periodic stop announcement
            this._annTimer = (this._annTimer || 0) - dt;
            if (this._annTimer <= 0) {
                this._annTimer = 2.5;
                if (t?.atStop) {
                    const st = G.bldById[t.atStop];
                    G.ui?.prompt?.(`<b>E</b> — alight at ${st?.name || t.atStop}`);
                } else if (t) {
                    const route = this.routes[t.routeIdx];
                    const next = route?.pts[(t.seg + 1) % route.pts.length];
                    const nb = next && G.bldById[next.bid];
                    G.ui?.lookLabel?.(nb ? `Next: ${nb.name}` : 'Metro in transit');
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
            positions: this.trains.map(t => ({ x: t.x, z: t.z, at: t.atStop, dwell: t.dwellT }))
        };
    }
};
