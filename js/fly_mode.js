/* ══════════════════════════════════════════════════════════════════════════
   FREE-FLY / BIRDS-EYE CAMERA — unlock from street FP and soar over the city.
   Toggle with C. WASD strafe, Space/Q up, Ctrl/E down, Shift boost, mouse look.
   Restores exact street position on exit (same contract as Orbit mode).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H, CITY_W, CITY_D, SEA_X } from './state.js';

const FLY_SPEED = 520;       // base cruise (u/s)
const FLY_BOOST = 1600;      // Shift
const FLY_SLOW = 180;        // Alt — precision
const MIN_Y = 8;
const MAX_Y = 4200;
const FAR_FLY = 14000;
const NEAR_FLY = 2;

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export const FlyMode = {
    active: false,
    _saved: null,
    _farSave: 8000,
    _nearSave: 4,

    init() {
        document.addEventListener('keydown', e => {
            if (!G.started || G.panelOpen || G.terminalOpen) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'KeyC' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.toggle();
            }
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (this.active) return;
        if (G.tourMode || G.orbitMode || G.xrayMode || G.holomapMode || G.ridingMetro || G.inside) {
            G.ui?.addToast?.('Free-fly unavailable in this mode', 'info');
            return;
        }
        const cam = G.camera;
        const p = G.player;
        this._saved = {
            x: cam.position.x, y: cam.position.y, z: cam.position.z,
            yaw: p.yaw, pitch: p.pitch,
            fov: cam.fov, far: cam.far, near: cam.near,
            eyeY: p.eyeY
        };
        this._farSave = cam.far;
        this._nearSave = cam.near;
        this.active = true;
        G.flyMode = true;

        // Lift off a little so the first frame isn't ground-clipped
        cam.position.y = Math.max(cam.position.y + 40, 80);
        cam.near = NEAR_FLY;
        cam.far = FAR_FLY;
        cam.updateProjectionMatrix();

        // Keep pointer lock for mouse look; suppress the pause-on-unlock path
        // only if lock is lost mid-flight (handled via G.flyMode in player.js).
        if (!p.locked) p.lock();

        G.ui?.banner('🦅 FREE FLY', 'WASD · Space/Q up · Ctrl/E down · Shift boost · C to land');
        G.ui?.addToast?.('Free-fly — bird\'s-eye tour of the city', 'info');
    },

    exit() {
        if (!this.active) return;
        this.active = false;
        G.flyMode = false;
        const cam = G.camera;
        const p = G.player;
        if (this._saved) {
            // Land under the camera, clamped to the walkable city pad
            let x = cam.position.x;
            let z = cam.position.z;
            x = Math.max(SEA_X + 40, Math.min(CITY_W / 2 + 400, x));
            z = Math.max(-CITY_D / 2 - 400, Math.min(CITY_D / 2 + 400, z));
            p.yaw = this._saved.yaw;
            p.pitch = Math.max(-0.4, Math.min(0.15, this._saved.pitch));
            p.eyeY = G.floorY + EYE_H;
            p.vel.set(0, 0, 0);
            p.grounded = true;
            cam.position.set(x, p.eyeY, z);
            cam.fov = this._saved.fov;
            cam.near = this._saved.near;
            cam.far = this._saved.far;
            cam.updateProjectionMatrix();
            cam.rotation.order = 'YXZ';
            cam.rotation.y = p.yaw;
            cam.rotation.x = p.pitch;
            cam.rotation.z = 0;
        }
        this._saved = null;
        // Reset idle timer so landing doesn't immediately trigger screensaver
        if (G.tour?._lastInputAt != null) G.tour._lastInputAt = performance.now();
        if (G.ui) G.ui.banner('🏙️ Street level', 'first-person restored');
    },

    update(dt) {
        if (!this.active) return;
        if (dt > 0.05) dt = 0.05;
        const cam = G.camera;
        const p = G.player;
        const keys = p.keys || {};

        // Mouse look is owned by Player while locked; keep rotation in sync.
        cam.rotation.order = 'YXZ';
        cam.rotation.y = p.yaw;
        cam.rotation.x = p.pitch;
        cam.rotation.z = 0;

        const sprint = keys['ShiftLeft'] || keys['ShiftRight'];
        const slow = keys['AltLeft'] || keys['AltRight'];
        const speed = sprint ? FLY_BOOST : (slow ? FLY_SLOW : FLY_SPEED);

        let mx = 0, my = 0, mz = 0;
        if (keys['KeyW'] || keys['ArrowUp']) mz += 1;
        if (keys['KeyS'] || keys['ArrowDown']) mz -= 1;
        if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
        if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
        if (keys['Space'] || keys['KeyQ']) my += 1;
        if (keys['ControlLeft'] || keys['ControlRight'] || keys['KeyE']) my -= 1;

        if (mx === 0 && my === 0 && mz === 0) return;

        // Full 6DOF relative to look direction (pitch affects forward climb).
        _fwd.set(0, 0, -1).applyEuler(cam.rotation);
        _right.set(1, 0, 0).applyEuler(cam.rotation);
        const len = Math.hypot(mx, my, mz) || 1;
        mx /= len; my /= len; mz /= len;

        cam.position.addScaledVector(_right, mx * speed * dt);
        cam.position.y += my * speed * dt;
        cam.position.addScaledVector(_fwd, mz * speed * dt);

        // Soft world bounds — larger than street clamp so you can overfly sea/hills
        const halfW = CITY_W / 2 + 2800;
        const halfD = CITY_D / 2 + 2800;
        cam.position.x = Math.max(SEA_X - 3500, Math.min(halfW, cam.position.x));
        cam.position.z = Math.max(-halfD, Math.min(halfD, cam.position.z));
        cam.position.y = Math.max(MIN_Y, Math.min(MAX_Y, cam.position.y));
    },

    snapshot() {
        return { active: this.active };
    }
};
