/* ──────────────────────────────────────────────────────────────────────────
   KARDASHEV / AI-INDEX BILLBOARD — grounded street monument (not free-floating
   crossed planes). Single solid structure: posts + frame + front display.
   ────────────────────────────────────────────────────────────────────────── */
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
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d');
    // panel
    const bg = g.createLinearGradient(0, 0, 0, 512);
    bg.addColorStop(0, '#0c1220');
    bg.addColorStop(1, '#060910');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 512);
    // cyan frame
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 10;
    g.shadowColor = '#22d3ee';
    g.shadowBlur = 18;
    g.strokeRect(16, 16, 992, 480);
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.lineWidth = 2;
    g.strokeRect(28, 28, 968, 456);

    g.fillStyle = '#22d3ee';
    g.font = 'bold 42px monospace, Consolas, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText('KARDASHEV AI INDEX', 56, 90);

    g.fillStyle = '#fbbf24';
    g.font = 'bold 120px monospace, Consolas, sans-serif';
    g.fillText(String(Math.round(scale.index)), 56, 230);

    g.fillStyle = '#e2e8f0';
    g.font = 'bold 36px monospace, Consolas, sans-serif';
    g.fillText(scale.tier, 56, 300);

    // progress bar track + fill
    g.fillStyle = '#1e293b';
    g.fillRect(56, 360, 900, 36);
    g.fillStyle = '#f472b6';
    g.shadowColor = '#f472b6';
    g.shadowBlur = 12;
    g.fillRect(56, 360, Math.max(12, scale.k * 900), 36);
    g.shadowBlur = 0;
    g.fillStyle = '#94a3b8';
    g.font = '22px monospace, Consolas, sans-serif';
    g.fillText(`K-scale  ${(scale.k * 100).toFixed(1)}%  ·  live composite`, 56, 440);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
}

export const Kardashev = {
    scale: null,
    root: null,
    screen: null,
    _t: 0,

    init(scene) {
        const idx = G.ui?.aiIndex ?? 512;
        this.scale = kardashevScale(idx);

        // Prefer the dedicated ai_index billboard footprint; fall back to monument plaza
        const site = G.bldById['ai_index']
            || G.bldById['visitor_monument']
            || G.bldById['open_square'];
        const x = site ? site.worldX : 200;
        const z = site ? site.worldZ : 300;
        // Face the open plaza / visitor approach when possible
        const face = G.bldById['visitor_monument']
            ? Math.atan2(
                (G.bldById['visitor_monument'].worldX - x),
                (G.bldById['visitor_monument'].worldZ - z)
            )
            : 0;

        this.root = new THREE.Group();
        this.root.name = 'kardashevBillboard';
        this.root.position.set(x, 0, z);
        this.root.rotation.y = face;

        const steel = new THREE.MeshStandardMaterial({
            color: 0x6a7280, metalness: 0.55, roughness: 0.4
        });
        const dark = new THREE.MeshStandardMaterial({
            color: 0x1a1f28, metalness: 0.35, roughness: 0.55
        });
        const accent = new THREE.MeshStandardMaterial({
            color: 0x22d3ee, metalness: 0.4, roughness: 0.35,
            emissive: 0x0e7490, emissiveIntensity: 0.35
        });

        // Ground plinth
        const plinth = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 28), steel);
        plinth.position.set(0, 3, 0);
        this.root.add(plinth);
        // Two main posts
        for (const sx of [-28, 28]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(6, 88, 6), steel);
            post.position.set(sx, 44, 0);
            this.root.add(post);
            // base flange
            const flange = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), dark);
            flange.position.set(sx, 6, 0);
            this.root.add(flange);
        }
        // Crossbeam
        const beam = new THREE.Mesh(new THREE.BoxGeometry(64, 5, 5), steel);
        beam.position.set(0, 86, 0);
        this.root.add(beam);

        // Cabinet / housing (solid box — panel sits on front face only)
        const cabinet = new THREE.Mesh(new THREE.BoxGeometry(100, 52, 8), dark);
        cabinet.position.set(0, 58, 2);
        this.root.add(cabinet);
        // Accent rim around cabinet
        const rim = new THREE.Mesh(new THREE.BoxGeometry(104, 56, 1.5), accent);
        rim.position.set(0, 58, 6.2);
        this.root.add(rim);

        // Single front screen (NOT a free-floating double plane)
        const tex = billboardTexture(this.scale);
        const screenMat = new THREE.MeshBasicMaterial({
            map: tex,
            toneMapped: false,
            side: THREE.FrontSide
        });
        this.screen = new THREE.Mesh(new THREE.PlaneGeometry(96, 48), screenMat);
        this.screen.position.set(0, 58, 6.8);
        this.root.add(this.screen);

        // Small rear ID plate (fixed text, not a second full billboard)
        const rear = new THREE.Mesh(
            new THREE.PlaneGeometry(40, 12),
            new THREE.MeshBasicMaterial({ color: 0x0f172a, side: THREE.FrontSide })
        );
        rear.position.set(0, 58, -2.2);
        rear.rotation.y = Math.PI;
        this.root.add(rear);

        scene.add(this.root);
        this.mesh = this.root; // snapshot compat
        this.mesh2 = null;     // no twin

        // Collider so player doesn't walk through posts
        G.colliders.push({
            x0: x - 36, z0: z - 16, x1: x + 36, z1: z + 16, id: 'kardashev_board'
        });
    },

    update(dt) {
        this._t += dt;
        if (this._t < 4) return;
        this._t = 0;
        const idx = G.ui?.aiIndex ?? 512;
        this.scale = kardashevScale(idx);
        if (this.screen?.material?.map) {
            this.screen.material.map.dispose();
            const tex = billboardTexture(this.scale);
            this.screen.material.map = tex;
            this.screen.material.needsUpdate = true;
        }
        // Do NOT lookAt camera — structure stays fixed to the street
    },

    snapshot() {
        return { ...this.scale, hasBillboard: !!this.root };
    }
};
