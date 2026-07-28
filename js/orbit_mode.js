/* ══════════════════════════════════════════════════════════════════════════
   ORBIT MODE — LEO-style satellite overview. Toggle with O. Saves/restores
   first-person camera. Not the primary camera (FP remains default).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H } from './state.js';

export function createOrbitState() {
    return {
        active: false,
        angle: 0,
        radius: 3200,
        height: 2200,
        saved: null
    };
}

export function enterOrbit(state, camera, player) {
    if (state.active) return state;
    state.saved = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
        yaw: player.yaw,
        pitch: player.pitch,
        fov: camera.fov
    };
    state.active = true;
    state.angle = player.yaw || 0;
    G.orbitMode = true;
    return state;
}

export function exitOrbit(state, camera, player) {
    if (!state.active) return state;
    state.active = false;
    G.orbitMode = false;
    if (state.saved) {
        camera.position.set(state.saved.x, state.saved.y, state.saved.z);
        player.yaw = state.saved.yaw;
        player.pitch = state.saved.pitch;
        camera.fov = state.saved.fov;
        camera.updateProjectionMatrix();
        camera.rotation.set(0, 0, 0);
        camera.quaternion.identity();
    }
    state.saved = null;
    return state;
}

export function updateOrbitCamera(state, camera, dt) {
    if (!state.active) return;
    state.angle += dt * 0.12;
    const x = Math.cos(state.angle) * state.radius;
    const z = Math.sin(state.angle) * state.radius;
    camera.position.set(x, state.height, z);
    camera.lookAt(0, 0, 0);
    camera.fov = 55;
    camera.updateProjectionMatrix();
}

export const OrbitMode = {
    state: createOrbitState(),

    init() {
        this.state = createOrbitState();
        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            if (e.code === 'KeyO' && !e.repeat) this.toggle();
        });
    },

    toggle() {
        if (this.state.active) this.exit();
        else this.enter();
    },

    enter() {
        if (G.xrayMode || G.holomapMode || G.terminalOpen || G.tourMode || G.flyMode) return;
        // free-fly and LEO are mutually exclusive camera hijacks
        enterOrbit(this.state, G.camera, G.player);
        G.player.enabled = false;
        G.ui?.banner('🛰️ ORBIT MODE', 'LEO view · press O to return');
    },

    exit() {
        exitOrbit(this.state, G.camera, G.player);
        G.player.enabled = true;
        // re-apply FP look matrix next frame via player update
        if (G.ui) G.ui.banner('🏙️ Street level', 'first-person restored');
    },

    update(dt) {
        updateOrbitCamera(this.state, G.camera, dt);
    },

    snapshot() {
        return { active: this.state.active, radius: this.state.radius, height: this.state.height };
    }
};
