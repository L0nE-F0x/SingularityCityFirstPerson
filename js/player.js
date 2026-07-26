/* ══════════════════════════════════════════════════════════════════════════
   FIRST-PERSON CONTROLLER — pointer lock, WASD, sprint, jump, AABB collision
   with axis-separated sliding, accel/friction, head-bob, land dip, coyote jump.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H, WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, GRAVITY, JUMP_VEL, SEA_X, CITY_W, CITY_D } from './state.js';

// Feel constants (units/s and 1/s rates). Tuned for ~150 walk / ~320 sprint.
const ACCEL_GROUND = 18;       // approach wish-speed
const ACCEL_AIR = 4.5;         // limited air strafe
const FRICTION = 14;           // stop rate when no input on ground
const STOP_SPEED = 12;         // snap-to-zero under this horizontal speed
const COYOTE_T = 0.11;         // jump shortly after leaving ledge
const JUMP_BUFFER_T = 0.12;    // press jump slightly early
const LAND_DIP_MAX = 1.15;     // eye dip on hard landings
const BOB_WALK = 9.2;          // phase speed multiplier at walk
const BOB_AMP_Y = 0.55;
const BOB_AMP_X = 0.32;
const BOB_PITCH = 0.012;

export const Player = {
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    grounded: true,
    keys: {},
    locked: false,
    bobPhase: 0, bobAmp: 0,
    stepAcc: 0,
    enabled: false,
    spawn: { x: 200, z: 300 },   // Public Square, near the Visitor Monument side
    // Logical eye position (no bob / land cosmetics) — physics source of truth
    eyeY: EYE_H,
    _coyote: 0,
    _jumpBuf: 0,
    _landDip: 0,

    init() {
        const p = G.bldById['visitor_monument'];
        if (p) this.spawn = { x: p.worldX + 120, z: p.worldZ + 140 };

        document.addEventListener('keydown', e => {
            if (G.panelOpen) return;
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.locked) {
                e.preventDefault();
                this._jumpBuf = JUMP_BUFFER_T;
            }
        });
        document.addEventListener('keyup', e => { this.keys[e.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });

        document.addEventListener('mousemove', e => {
            if (!this.locked || !this.enabled) return;
            const s = 0.0021 * (G.settings.sensitivity || 1);
            this.yaw -= e.movementX * s;
            this.pitch -= e.movementY * s * (G.settings.invertY ? -1 : 1);
            this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
        });

        // Click the world to recapture the mouse — the convention every FPS
        // has. Without it the only way back from a lost lock was the pause
        // menu, and a stray click on the canvas did nothing at all.
        G.canvas.addEventListener('mousedown', () => {
            if (G.started && !G.panelOpen && !G.paused && !G.tourMode && !this.locked) this.lock();
        });

        document.addEventListener('pointerlockchange', () => {
            this.locked = document.pointerLockElement === G.canvas;
            if (!this.locked && G.started && !G.panelOpen && !G.tourMode) {
                if (G._suppressPauseOnUnlock) {
                    G._suppressPauseOnUnlock = false;
                    return;
                }
                // released without a panel — treat as pause (ESC frees the mouse)
                G.ui.showPause();
            }
        });
    },

    lock() {
        try { G.audio?.resume?.(); } catch (_) {}
        if (!G.canvas || document.pointerLockElement === G.canvas) return;
        // Autostart / no-gesture paths must never throw NotAllowedError into the console.
        const tryLock = (opts) => {
            try {
                const req = G.canvas.requestPointerLock;
                if (typeof req !== 'function') return null;
                const p = opts ? req.call(G.canvas, opts) : req.call(G.canvas);
                if (p && typeof p.then === 'function') {
                    p.then(() => {}).catch(() => {});
                }
                return p;
            } catch (_) {
                return null;
            }
        };
        // Prefer raw mouse input; fall back if the browser rejects the option bag.
        const p = tryLock({ unadjustedMovement: true });
        if (p && typeof p.then === 'function') {
            p.catch(() => { tryLock(); });
        } else if (p == null) {
            tryLock();
        }
    },
    unlock() {
        try { G.audio?.resume?.(); } catch (_) {}
        try {
            if (document.pointerLockElement) document.exitPointerLock();
        } catch (_) { /* ignore */ }
    },

    teleport(x, z, yaw) {
        this.eyeY = G.floorY + EYE_H;
        G.camera.position.set(x, this.eyeY, z);
        if (yaw !== undefined) this.yaw = yaw;
        this.vel.set(0, 0, 0);
        this._landDip = 0;
        this._coyote = 0;
        this._jumpBuf = 0;
        this.bobAmp = 0;
        this.grounded = true;
    },

    placeAtSpawn() { this.teleport(this.spawn.x, this.spawn.z, Math.PI * 0.75); },

    update(dt) {
        if (!this.enabled || G.tourMode || G.orbitMode || G.terminalOpen) return;
        // Metro ride: look only — Metro attaches position each frame
        if (G.ridingMetro) {
            G.camera.rotation.order = 'YXZ';
            G.camera.rotation.y = this.yaw;
            G.camera.rotation.x = this.pitch;
            return;
        }
        const cam = G.camera;
        // Cap huge hitches so accel integrators don't fling the player
        if (dt > 0.05) dt = 0.05;

        const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const maxSpeed = sprint ? SPRINT_SPEED : WALK_SPEED;

        let fx = 0, fz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) fz += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) fz -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) fx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) fx += 1;

        const hasInput = (fx !== 0 || fz !== 0) && this.locked;
        let wishX = 0, wishZ = 0;
        if (hasInput) {
            const len = Math.hypot(fx, fz); fx /= len; fz /= len;
            const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
            wishX = (fx * cos - fz * sin) * maxSpeed;
            wishZ = (-fz * cos - fx * sin) * maxSpeed;
        }

        // Accelerate toward wish velocity (smooth start/stop — not instant set)
        const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
        if (hasInput) {
            this.vel.x += (wishX - this.vel.x) * Math.min(1, accel * dt);
            this.vel.z += (wishZ - this.vel.z) * Math.min(1, accel * dt);
        } else if (this.grounded) {
            const fr = Math.max(0, 1 - FRICTION * dt);
            this.vel.x *= fr;
            this.vel.z *= fr;
            if (Math.hypot(this.vel.x, this.vel.z) < STOP_SPEED) {
                this.vel.x = 0;
                this.vel.z = 0;
            }
        } else {
            // light air drag so you don't slide forever after a sprint-jump
            this.vel.x *= Math.max(0, 1 - dt * 0.6);
            this.vel.z *= Math.max(0, 1 - dt * 0.6);
        }

        // gravity on logical eye height (bob never feeds back into physics)
        this.vel.y -= GRAVITY * dt;

        // coyote + buffered jump
        if (this.grounded) this._coyote = COYOTE_T;
        else this._coyote = Math.max(0, this._coyote - dt);
        this._jumpBuf = Math.max(0, this._jumpBuf - dt);

        const wantJump = this._jumpBuf > 0 || this.keys['Space'];
        if (wantJump && this._coyote > 0 && this.locked) {
            this.vel.y = JUMP_VEL;
            this.grounded = false;
            this._coyote = 0;
            this._jumpBuf = 0;
            G.audio?.sfx('jump');
        }

        // integrate + collide (axis separated for wall sliding)
        let nx = cam.position.x + this.vel.x * dt;
        let nz = cam.position.z + this.vel.z * dt;
        let ny = this.eyeY + this.vel.y * dt;
        const floor = G.floorY + EYE_H;

        nx = this._collideAxis(nx, cam.position.z, true) ? cam.position.x : nx;
        nz = this._collideAxis(nx, nz, false) ? cam.position.z : nz;

        let justLanded = false;
        if (ny <= floor) {
            if (!this.grounded && this.vel.y < -40) {
                justLanded = true;
                const impact = Math.min(1, (-this.vel.y - 40) / 420);
                this._landDip = Math.max(this._landDip, LAND_DIP_MAX * (0.35 + impact * 0.65));
                if (impact > 0.25) G.audio?.sfx('step');
            }
            ny = floor;
            this.vel.y = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
        this.eyeY = ny;

        // world bounds (sea to the west, hills elsewhere) — indoors the walls
        // are the bounds, so skip the city clamp
        if (!G.inside) {
            nx = Math.max(SEA_X - 60, Math.min(CITY_W / 2 + 480, nx));
            nz = Math.max(-CITY_D / 2 - 480, Math.min(CITY_D / 2 + 480, nz));
        }

        // head bob + land settle (pure cosmetics on top of eyeY)
        const hSpeed = Math.hypot(this.vel.x, this.vel.z);
        if (this.grounded && hSpeed > 18 && this.locked) {
            const pace = hSpeed / WALK_SPEED;
            this.bobPhase += dt * pace * BOB_WALK * (sprint ? 1.22 : 1);
            this.bobAmp = Math.min(1, this.bobAmp + dt * 7);
            this.stepAcc += hSpeed * dt;
            const stepLen = sprint ? 52 : 40;
            if (this.stepAcc > stepLen) {
                this.stepAcc = 0;
                G.audio?.sfx(sprint ? 'step_run' : 'step');
            }
        } else {
            this.bobAmp = Math.max(0, this.bobAmp - dt * 8);
            if (this.grounded) this.stepAcc = 0;
        }
        if (this._landDip > 0) {
            this._landDip = Math.max(0, this._landDip - dt * (justLanded ? 0.5 : 6.5));
        }

        const bobY = Math.sin(this.bobPhase * 2) * BOB_AMP_Y * this.bobAmp;
        const bobX = Math.cos(this.bobPhase) * BOB_AMP_X * this.bobAmp;
        const bobPitch = Math.sin(this.bobPhase * 2) * BOB_PITCH * this.bobAmp;

        cam.position.set(nx, this.eyeY + bobY * 0.4 - this._landDip, nz);

        cam.rotation.order = 'YXZ';
        cam.rotation.y = this.yaw;
        cam.rotation.x = this.pitch + bobPitch;
        cam.rotation.z = bobX * 0.014;
    },

    // circle-vs-AABB in XZ; returns true if the move should be cancelled
    _collideAxis(nx, nz, isX) {
        const r = PLAYER_RADIUS;
        for (const c of G.colliders) {
            if (nx + r < c.x0 || nx - r > c.x1 || nz + r < c.z0 || nz - r > c.z1) continue;
            return true;
        }
        return false;
    }
};
