/* ══════════════════════════════════════════════════════════════════════════
   X-RAY MODE — wireframe diagnostic overlay on city meshes. Toggle with X.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

export function applyXray(root, on) {
    let count = 0;
    root.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
            if (!m) continue;
            if (on) {
                if (m.userData._xrayPrev == null) m.userData._xrayPrev = m.wireframe;
                m.wireframe = true;
                count++;
            } else if (m.userData._xrayPrev != null) {
                m.wireframe = m.userData._xrayPrev;
                delete m.userData._xrayPrev;
                count++;
            }
        }
    });
    return count;
}

export const XrayMode = {
    active: false,
    meshesTouched: 0,

    init() {
        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            if (e.code === 'KeyX' && !e.repeat) this.toggle();
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (G.orbitMode || G.holomapMode) return;
        this.active = true;
        G.xrayMode = true;
        this.meshesTouched = applyXray(G.scene, true);
        G.ui?.banner('🔬 X-RAY', 'wireframe diagnostics · press X to exit');
    },

    exit() {
        this.active = false;
        G.xrayMode = false;
        applyXray(G.scene, false);
        G.ui?.banner('🏙️ Solid view', 'x-ray off');
    },

    update(_dt) { /* static overlay */ },

    snapshot() {
        return { active: this.active, meshesTouched: this.meshesTouched };
    }
};
