/* ══════════════════════════════════════════════════════════════════════════
   SEASONAL EVENTS — month-driven city accents (decor mesh + label).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';

export const SEASONS = {
    0:  { id: 'new_year',   label: 'New Year Lights',     color: 0xfbbf24 },
    1:  { id: 'valentine',  label: 'Open-Source Hearts',  color: 0xf472b6 },
    2:  { id: 'spring',     label: 'Spring Deploy',       color: 0x4ade80 },
    3:  { id: 'spring',     label: 'Spring Deploy',       color: 0x4ade80 },
    4:  { id: 'iclr_season',label: 'ICLR Season',         color: 0x4ade80 },
    5:  { id: 'summer',     label: 'Summer Compute',      color: 0xfbbf24 },
    6:  { id: 'summer',     label: 'Summer Compute',      color: 0x3b82f6 },
    7:  { id: 'back_school',label: 'Back to Pretrain',    color: 0xa78bfa },
    8:  { id: 'autumn',     label: 'Autumn Weights',      color: 0xf97316 },
    9:  { id: 'autumn',     label: 'Autumn Weights',      color: 0xf97316 },
    10: { id: 'neurips_eve',label: 'NeurIPS Eve',         color: 0xf43f5e },
    11: { id: 'holiday',    label: 'Holiday Tokens',      color: 0x22d3ee }
};

export function seasonForDate(d = new Date()) {
    return SEASONS[d.getMonth()] || SEASONS[0];
}

export const Seasonal = {
    season: null,
    mesh: null,

    init(scene) {
        const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
        const m = params.get('month');
        const d = m != null ? new Date(2026, parseInt(m, 10), 15) : new Date();
        this.season = seasonForDate(d);

        // decorative orbs near public square — placements use x/z (not worldX/worldZ)
        const spots = G.placements?.filter(p => p.type === 'monument' || p.id === 'visitor_monument') || [];
        const mon = G.bldById?.['visitor_monument'];
        const parts = [];
        const col = new THREE.Color(this.season.color);
        const centers = spots.length
            ? spots.map(p => ({ x: p.x ?? p.worldX ?? 0, z: p.z ?? p.worldZ ?? 0 }))
            : mon
                ? [{ x: mon.worldX, z: mon.worldZ }]
                : [{ x: 200, z: 300 }];
        for (const s of centers.slice(0, 3)) {
            const cx = Number.isFinite(s.x) ? s.x : 0;
            const cz = Number.isFinite(s.z) ? s.z : 0;
            for (let i = 0; i < 6; i++) {
                const g = new THREE.SphereGeometry(5, 6, 6);
                const a = (i / 6) * Math.PI * 2;
                g.translate(cx + Math.cos(a) * 60, 35 + (i % 2) * 10, cz + Math.sin(a) * 60);
                const n = g.attributes.position.count;
                const arr = new Float32Array(n * 3);
                for (let j = 0; j < n; j++) { arr[j * 3] = col.r; arr[j * 3 + 1] = col.g; arr[j * 3 + 2] = col.b; }
                g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
                parts.push(g);
            }
        }
        if (parts.length) {
            const merged = mergeGeometries(parts, false);
            // guard: never ship NaN positions (triggers computeBoundingSphere errors)
            const pos = merged?.attributes?.position?.array;
            let ok = !!pos;
            if (ok) for (let i = 0; i < pos.length; i++) if (!Number.isFinite(pos[i])) { ok = false; break; }
            if (ok) {
                this.mesh = new THREE.Mesh(
                    merged,
                    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 })
                );
                this.mesh.name = 'seasonalDecor';
                scene.add(this.mesh);
            }
        }
        this.label = this.season.label;
    },

    update(dt) {
        if (this.mesh) this.mesh.rotation.y += dt * 0.15;
    },

    snapshot() {
        return {
            id: this.season?.id,
            label: this.season?.label,
            month: new Date().getMonth(),
            hasDecor: !!this.mesh
        };
    }
};
