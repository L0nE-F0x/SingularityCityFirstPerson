/* ══════════════════════════════════════════════════════════════════════════
   HOLOMAP — floating 3D district hologram near the player (toggle H).
   One merged low-poly city plate + district dots.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { DISTRICTS } from './data.js';

export function buildHolomapGeometry(placements, scale = 0.04) {
    const parts = [];
    const base = new THREE.BoxGeometry(CITY_W * scale, 2, CITY_D * scale);
    parts.push(base);
    for (const p of placements || []) {
        if (!p || p.worldX == null) continue;
        const w = Math.max(4, (p.worldW || 40) * scale * 0.8);
        const d = Math.max(4, (p.worldD || 40) * scale * 0.8);
        const h = Math.max(3, (p.h || 40) * scale * 0.35);
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(p.worldX * scale, h / 2 + 1, p.worldZ * scale);
        parts.push(g);
    }
    // district markers
    for (const dist of DISTRICTS) {
        // approximate cell centre from col/row if present
        if (dist.col == null) continue;
        const cx = (dist.col - 2) * (800 + 200) * scale;
        const cz = (dist.row - 1.5) * (800 + 200) * scale;
        const m = new THREE.BoxGeometry(8, 10, 8);
        m.translate(cx, 12, cz);
        parts.push(m);
    }
    return mergeGeometries(parts, false);
}

export const Holomap = {
    active: false,
    group: null,
    mesh: null,

    init(scene) {
        this.group = new THREE.Group();
        this.group.visible = false;
        try {
            const geo = buildHolomapGeometry(G.placements, 0.035);
            this.mesh = new THREE.Mesh(
                geo,
                new THREE.MeshBasicMaterial({
                    color: 0x22d3ee,
                    transparent: true,
                    opacity: 0.55,
                    wireframe: true
                })
            );
            this.group.add(this.mesh);
        } catch (e) {
            // empty map still toggles
            this.mesh = new THREE.Mesh(
                new THREE.BoxGeometry(80, 4, 60),
                new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true })
            );
            this.group.add(this.mesh);
        }
        // ring frame
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(90, 1.5, 6, 32),
            new THREE.MeshBasicMaterial({ color: 0xf472b6 })
        );
        ring.rotation.x = Math.PI / 2;
        this.group.add(ring);
        scene.add(this.group);

        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            if (e.code === 'KeyH' && !e.repeat) this.toggle();
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (G.orbitMode) return;
        this.active = true;
        G.holomapMode = true;
        this.group.visible = true;
        G.ui?.banner('🗺️ HOLOMAP', 'district hologram · press H to close');
    },

    exit() {
        this.active = false;
        G.holomapMode = false;
        if (this.group) this.group.visible = false;
    },

    update(dt) {
        if (!this.active || !this.group) return;
        const cam = G.camera;
        // float in front of player
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        fwd.y = 0;
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
        fwd.normalize();
        this.group.position.copy(cam.position).add(fwd.multiplyScalar(90));
        this.group.position.y = cam.position.y - 10;
        this.group.rotation.y += dt * 0.25;
    },

    snapshot() {
        return {
            active: this.active,
            visible: !!(this.group && this.group.visible),
            hasMesh: !!this.mesh
        };
    }
};
