/* ══════════════════════════════════════════════════════════════════════════
   METRO — 3 lines (from data TRAM_LINES) shuttling between metro stations.
   Trains are instanced cars on polyline paths between stop buildings.
   Stations remain enterable via Interior; this module is the rolling stock.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { TRAM_LINES } from './data.js';

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
    // dwell at stops
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
        train.dwellT = 1.2;
        train.atStop = b.bid;
        // snap to stop
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
    box(48, 18, 16, 0, 12, 0, hex);
    box(44, 8, 14, 0, 22, 0, 0x88ccee); // windows
    box(10, 4, 10, -18, 28, 0, 0xffffff); // pantograph base
    return mergeGeometries(parts, false);
}

export const Metro = {
    routes: [],
    trains: [],
    mesh: null,
    _dummy: new THREE.Object3D(),
    active: true,

    init(scene) {
        this.routes = buildMetroRoutes(id => G.bldById[id]);
        this.trains = [];
        for (let i = 0; i < this.routes.length; i++) {
            const r = this.routes[i];
            this.trains.push({
                routeIdx: i,
                seg: 0,
                segProgress: i * 0.3,
                speed: 140,
                x: r.pts[0].x,
                z: r.pts[0].z,
                dirX: 1, dirZ: 0,
                y: -22,             // below street — subway
                atStop: null,
                dwellT: 0,
                laps: 0,
                color: r.color
            });
            // second car staggered
            this.trains.push({
                routeIdx: i,
                seg: Math.floor(r.pts.length / 2),
                segProgress: 0.1,
                speed: 140,
                x: r.pts[0].x,
                z: r.pts[0].z,
                dirX: 1, dirZ: 0,
                y: -22,
                atStop: null,
                dwellT: 0,
                laps: 0,
                color: r.color
            });
        }
        // one mesh per line colour bucket — simplify to one grey+tint mesh
        const N = this.trains.length;
        this.mesh = new THREE.InstancedMesh(
            carGeo(0x334155),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            Math.max(1, N)
        );
        this.mesh.frustumCulled = false;
        // station entrance markers (glow pillars) — merged one mesh
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
        this._write();
    },

    update(dt) {
        if (!this.active || !this.mesh) return;
        for (const t of this.trains) stepTrain(t, dt, this.routes);
        this._write();
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
            positions: this.trains.map(t => ({ x: t.x, z: t.z, at: t.atStop }))
        };
    }
};
