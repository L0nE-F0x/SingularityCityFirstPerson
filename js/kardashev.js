/* ══════════════════════════════════════════════════════════════════════════
   KARDASHEV / AI-INDEX BILLBOARD — richer street billboard + HUD scale.
   Maps AI index onto a playful K0–K1 civilizational ladder.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

export function kardashevScale(aiIndex) {
    const n = Math.max(0, Number(aiIndex) || 0);
    // playful mapping: 0–2000 index → K0.0 – K1.0
    const k = Math.min(1, n / 2000);
    let tier = 'K0.0 Planetary';
    if (k >= 0.85) tier = 'K0.9 Near Type-I';
    else if (k >= 0.65) tier = 'K0.7 Continental AI';
    else if (k >= 0.45) tier = 'K0.5 Industrial AI';
    else if (k >= 0.25) tier = 'K0.3 Digital';
    else tier = 'K0.1 Proto-AGI';
    return { k: Math.round(k * 1000) / 1000, tier, index: n };
}

function billboardTexture(scale) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0e1a';
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 6;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = '#22d3ee';
    g.font = 'bold 28px monospace';
    g.fillText('KARDASHEV AI INDEX', 40, 60);
    g.fillStyle = '#fbbf24';
    g.font = 'bold 48px monospace';
    g.fillText(String(Math.round(scale.index)), 40, 130);
    g.fillStyle = '#e2e8f0';
    g.font = '22px monospace';
    g.fillText(scale.tier, 40, 175);
    g.fillStyle = '#f472b6';
    g.fillRect(40, 200, Math.max(8, scale.k * 420), 18);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export const Kardashev = {
    scale: null,
    mesh: null,
    _t: 0,

    init(scene) {
        const idx = G.ui?.aiIndex ?? 512;
        this.scale = kardashevScale(idx);
        const tex = billboardTexture(this.scale);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), mat);
        // plant near visitor monument / public square
        const m = G.bldById['visitor_monument'] || G.bldById['open_square'];
        if (m) {
            this.mesh.position.set(m.worldX + 80, 60, m.worldZ + 100);
        } else {
            this.mesh.position.set(200, 60, 300);
        }
        // back face twin
        this.mesh2 = this.mesh.clone();
        this.mesh2.rotation.y = Math.PI;
        scene.add(this.mesh);
        scene.add(this.mesh2);
    },

    update(dt) {
        this._t += dt;
        if (this._t < 5) return;
        this._t = 0;
        const idx = G.ui?.aiIndex ?? 512;
        this.scale = kardashevScale(idx);
        if (this.mesh?.material?.map) {
            this.mesh.material.map.dispose();
            const tex = billboardTexture(this.scale);
            this.mesh.material.map = tex;
            if (this.mesh2?.material) this.mesh2.material.map = tex;
        }
        // face camera roughly
        if (G.camera && this.mesh) {
            const p = G.camera.position;
            this.mesh.lookAt(p.x, this.mesh.position.y, p.z);
        }
    },

    snapshot() {
        return { ...this.scale, hasBillboard: !!this.mesh };
    }
};
