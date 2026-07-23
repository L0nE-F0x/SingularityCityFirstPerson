/* ══════════════════════════════════════════════════════════════════════════
   MULTIPLAYER GHOST CURSORS — local simulated peers (no network backend).
   Translucent avatars wander the city so the PARITY "ghost cursors" item
   has an honest offline equivalent.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, CITY_W, CITY_D } from './state.js';
import { City } from './city.js';

const GHOST_N = 6;
const NAMES = ['Nova', 'Pixel', 'Quark', 'Loom', 'Vesper', 'Cipher'];

export function createGhosts(n = GHOST_N) {
    const list = [];
    for (let i = 0; i < n; i++) {
        list.push({
            id: 'ghost_' + i,
            name: NAMES[i % NAMES.length],
            x: (Math.random() - 0.5) * CITY_W * 0.6,
            z: (Math.random() - 0.5) * CITY_D * 0.6,
            tx: 0, tz: 0,
            speed: 90 + Math.random() * 40,
            hue: i / n,
            bob: Math.random() * 10
        });
        list[i].tx = list[i].x;
        list[i].tz = list[i].z;
    }
    return list;
}

export function stepGhost(g, dt) {
    g.bob += dt;
    const dx = g.tx - g.x, dz = g.tz - g.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 20) {
        g.tx = (Math.random() - 0.5) * CITY_W * 0.7;
        g.tz = (Math.random() - 0.5) * CITY_D * 0.7;
        if (City.offRoad) {
            const p = City.offRoad(g.tx, g.tz);
            g.tx = p.x; g.tz = p.z;
        }
        return;
    }
    g.x += (dx / dist) * g.speed * dt;
    g.z += (dz / dist) * g.speed * dt;
}

export const Multiplayer = {
    ghosts: [],
    mesh: null,
    labels: [],
    _dummy: new THREE.Object3D(),
    active: true,

    init(scene) {
        this.ghosts = createGhosts(GHOST_N);
        const geo = new THREE.ConeGeometry(6, 14, 6);
        geo.translate(0, 7, 0);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.45,
            depthWrite: false
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, GHOST_N);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        // simple name sprites
        for (let i = 0; i < GHOST_N; i++) {
            const c = document.createElement('canvas');
            c.width = 128; c.height = 32;
            const ctx = c.getContext('2d');
            ctx.fillStyle = 'rgba(10,14,26,0.7)';
            ctx.fillRect(0, 0, 128, 32);
            ctx.fillStyle = '#22d3ee';
            ctx.font = '16px monospace';
            ctx.fillText(this.ghosts[i].name, 8, 22);
            const tex = new THREE.CanvasTexture(c);
            const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
            sp.scale.set(28, 7, 1);
            scene.add(sp);
            this.labels.push(sp);
        }
        this._write();
    },

    update(dt) {
        if (!this.active || !this.mesh) return;
        for (const g of this.ghosts) stepGhost(g, dt);
        this._write();
    },

    _write() {
        const d = this._dummy;
        for (let i = 0; i < this.ghosts.length; i++) {
            const g = this.ghosts[i];
            d.position.set(g.x, 2 + Math.sin(g.bob * 3) * 1.5, g.z);
            d.rotation.y = g.bob;
            d.scale.set(1, 1, 1);
            d.updateMatrix();
            this.mesh.setMatrixAt(i, d.matrix);
            this.mesh.setColorAt(i, new THREE.Color().setHSL(g.hue, 0.7, 0.55));
            if (this.labels[i]) {
                this.labels[i].position.set(g.x, 22, g.z);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    },

    snapshot() {
        return {
            count: this.ghosts.length,
            names: this.ghosts.map(g => g.name),
            simulated: true,
            positions: this.ghosts.map(g => ({ x: Math.round(g.x), z: Math.round(g.z) }))
        };
    }
};
