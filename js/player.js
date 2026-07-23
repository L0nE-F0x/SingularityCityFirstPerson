/* ══════════════════════════════════════════════════════════════════════════
   FIRST-PERSON CONTROLLER — pointer lock, WASD, sprint, jump, AABB collision
   with axis-separated sliding, gentle head-bob and footstep hooks.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H, WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, GRAVITY, JUMP_VEL, SEA_X, CITY_W, CITY_D } from './state.js';

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

    init() {
        const p = G.bldById['visitor_monument'];
        if (p) this.spawn = { x: p.worldX + 120, z: p.worldZ + 140 };

        document.addEventListener('keydown', e => {
            if (G.panelOpen) return;
            this.keys[e.code] = true;
            if (e.code === 'Space' && this.locked) e.preventDefault();
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
                // released without a panel → treat as pause
                G.ui.showPause();
            }
        });
    },

    lock() {
        if (document.pointerLockElement === G.canvas) return;
        try {
            const p = G.canvas.requestPointerLock({ unadjustedMovement: true });
            if (p && p.catch) p.catch(() => { try { G.canvas.requestPointerLock(); } catch (e) { /* denied */ } });
        } catch (e) {
            try { G.canvas.requestPointerLock(); } catch (e2) { /* denied */ }
        }
    },
    unlock() { if (document.pointerLockElement) document.exitPointerLock(); },

    teleport(x, z, yaw) {
        G.camera.position.set(x, G.floorY + EYE_H, z);
        if (yaw !== undefined) this.yaw = yaw;
        this.vel.set(0, 0, 0);
    },

    placeAtSpawn() { this.teleport(this.spawn.x, this.spawn.z, Math.PI * 0.75); },

    update(dt) {
        if (!this.enabled || G.tourMode || G.orbitMode || G.terminalOpen) return;
        const cam = G.camera;

        const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
        const speed = sprint ? SPRINT_SPEED : WALK_SPEED;

        let fx = 0, fz = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) fz += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) fz -= 1;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) fx -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) fx += 1;

        const moving = (fx !== 0 || fz !== 0) && this.locked;
        if (moving) {
            const len = Math.hypot(fx, fz); fx /= len; fz /= len;
            const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
            const wx = (fx * cos - fz * sin) * speed;
            const wz = (-fz * cos - fx * sin) * speed;
            this.vel.x = wx; this.vel.z = wz;
        } else {
            // friction
            this.vel.x *= Math.max(0, 1 - dt * 10);
            this.vel.z *= Math.max(0, 1 - dt * 10);
        }

        // gravity + jump
        this.vel.y -= GRAVITY * dt;
        if (moving === false) { /* idle */ }
        if ((this.keys['Space']) && this.grounded && this.locked) {
            this.vel.y = JUMP_VEL;
            this.grounded = false;
            G.audio?.sfx('jump');
        }

        // integrate + collide (axis separated for wall sliding)
        let nx = cam.position.x + this.vel.x * dt;
        let nz = cam.position.z + this.vel.z * dt;
        let ny = cam.position.y + this.vel.y * dt;

        nx = this._collideAxis(nx, cam.position.z, true) ? cam.position.x : nx;
        nz = this._collideAxis(nx, nz, false) ? cam.position.z : nz;

        // ground — G.floorY moves with you when you step inside a building
        const floor = G.floorY + EYE_H;
        if (ny <= floor) { ny = floor; this.vel.y = 0; this.grounded = true; }

        // world bounds (sea to the west, hills elsewhere) — indoors the walls
        // are the bounds, so skip the city clamp
        if (!G.inside) {
            nx = Math.max(SEA_X - 60, Math.min(CITY_W / 2 + 480, nx));
            nz = Math.max(-CITY_D / 2 - 480, Math.min(CITY_D / 2 + 480, nz));
        }

        cam.position.set(nx, ny, nz);

        // head bob
        const hSpeed = Math.hypot(this.vel.x, this.vel.z);
        if (this.grounded && hSpeed > 20) {
            this.bobPhase += dt * (hSpeed / WALK_SPEED) * 7;
            this.bobAmp = Math.min(1, this.bobAmp + dt * 6);
            this.stepAcc += hSpeed * dt;
            if (this.stepAcc > 42) {
                this.stepAcc = 0;
                G.audio?.sfx(sprint ? 'step_run' : 'step');
            }
        } else {
            this.bobAmp = Math.max(0, this.bobAmp - dt * 6);
        }
        const bobY = Math.sin(this.bobPhase * 2) * 0.5 * this.bobAmp;
        const bobX = Math.cos(this.bobPhase) * 0.3 * this.bobAmp;

        cam.rotation.order = 'YXZ';
        cam.rotation.y = this.yaw;
        cam.rotation.x = this.pitch;
        cam.rotation.z = bobX * 0.01;
        cam.position.y = ny + bobY * 0.35;
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
