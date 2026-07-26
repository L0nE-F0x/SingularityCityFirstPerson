/* ══════════════════════════════════════════════════════════════════════════
   RAIN WETNESS — puddles near the camera, ground splash sparks, neon
   reflections: boosts World.neonMat + window emissives under wet weather.
   Weather owns the night window/neon base each frame; we only LAYER boost
   while wet and never stomp dry-state materials.
   Pool-bounded planes (flat cost). No shadow maps / post / log-depth.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

const WET_STATES = new Set(['rain', 'drizzle', 'thunderstorm']);
const PUDDLES = 12;
const SPLASH_N = 100;
const _coolGlass = new THREE.Color(0xc8e8ff);
const _cyanNeon = new THREE.Color(0x66f0ff);

export function isWetWeather(state) {
    return WET_STATES.has(state);
}

export function puddleLayout(camX, camZ, n = PUDDLES, seed = 0) {
    const out = [];
    // deterministic-ish ring around camera so puddles feel placed, not random noise
    let s = (seed * 1103515245 + 12345) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seed * 0.37 + rnd() * 0.4;
        const r = 28 + (i % 6) * 26 + rnd() * 18;
        out.push({
            x: camX + Math.cos(a) * r,
            z: camZ + Math.sin(a) * r,
            s: 10 + (i % 5) * 5 + rnd() * 4,
            rot: rnd() * Math.PI
        });
    }
    return out;
}

/**
 * Apply neonBoost on top of Weather's current night ramp.
 * Window emissive: base = Weather.winGlow (or current), then + wet gleam.
 * Neon: multiplies current opacity (already night-adjusted by Weather).
 * Puddles: cyan/magenta neon reflection tint.
 */
export function applyNeonBoost(world, neonBoost, puddles = [], winGlowBase = null) {
    const boost = Math.max(0, neonBoost || 0);
    let windows = 0, neon = 0;
    const baseWin = winGlowBase != null
        ? winGlowBase
        : (G.weatherSys?.winGlow ?? 0);

    for (const m of world?.windowMats || []) {
        if (!m) continue;
        // re-apply base then wet layer so we never accumulate across frames
        m.emissiveIntensity = Math.min(1.85, baseWin + boost * 1.15);
        if (m.emissive && boost > 0.05) {
            // slight cool rim under rain so wet glass reads different from dry night
            m.emissive.lerp(_coolGlass, Math.min(0.22, boost * 0.5));
        }
        windows++;
    }

    if (world?.neonMat) {
        const nm = world.neonMat;
        // Weather already set night opacity this frame — punch it up, don't cache a stale base
        const nightOp = nm.opacity != null ? nm.opacity : 1;
        if (boost > 0) {
            if (!nm.userData._wetColorBase) {
                nm.userData._wetColorBase = nm.color ? nm.color.clone() : new THREE.Color(0xffffff);
            }
            nm.transparent = true;
            nm.opacity = Math.min(1, nightOp * (1 + boost * 0.85));
            if (nm.color && nm.userData._wetColorBase) {
                // lean toward cyan neon reflection under rain
                nm.color.copy(nm.userData._wetColorBase).lerp(_cyanNeon, Math.min(0.48, boost * 1.1));
            }
        } else if (nm.userData._wetColorBase && nm.color) {
            nm.color.copy(nm.userData._wetColorBase);
            nm.userData._wetColorBase = null;
        }
        neon = 1;
    }

    // puddles pick up neon cyan/magenta when wet (ground neon reflections)
    for (let i = 0; i < puddles.length; i++) {
        const p = puddles[i];
        if (!p?.material?.color) continue;
        if (boost > 0) {
            // alternate cyan / magenta so street reads like wet cyberpunk asphalt
            const mag = (i % 3 === 0);
            if (mag) {
                p.material.color.setRGB(
                    0.22 + boost * 0.55,
                    0.08 + boost * 0.12,
                    0.32 + boost * 0.55
                );
            } else {
                p.material.color.setRGB(
                    0.06 + boost * 0.12,
                    0.22 + boost * 0.55,
                    0.35 + boost * 0.65
                );
            }
            p.material.opacity = Math.min(0.78, 0.3 + boost * 0.58);
        } else {
            p.material.color.setHex(0x1a3048);
            p.material.opacity = 0.35;
        }
    }

    // streetlamp heads: slightly cooler/brighter wet glint (Weather resets color first)
    if (world?.lampHeadMat && boost > 0) {
        const c = world.lampHeadMat.color;
        if (c) {
            c.offsetHSL(-0.04, 0.08, Math.min(0.12, boost * 0.22));
        }
    }
    return { windows, neon, boost, baseWin };
}

export const Wetness = {
    active: false,
    group: null,
    puddles: [],
    splash: null,
    _t: 0,
    _seed: 0,
    neonBoost: 0,
    applied: null,
    _splashVel: null,

    init(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        // soft-edged puddle disc (radial alpha) so wet ground doesn't look like hard coins
        const can = document.createElement('canvas');
        can.width = can.height = 64;
        const ctx = can.getContext('2d');
        const rg = ctx.createRadialGradient(32, 32, 3, 32, 32, 32);
        rg.addColorStop(0, 'rgba(200,230,255,0.9)');
        rg.addColorStop(0.35, 'rgba(100,170,220,0.5)');
        rg.addColorStop(0.7, 'rgba(40,80,120,0.18)');
        rg.addColorStop(1, 'rgba(20,40,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, 64, 64);
        // subtle ripple rings
        ctx.strokeStyle = 'rgba(180,220,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(32, 32, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(32, 32, 22, 0, Math.PI * 2); ctx.stroke();
        const puddleMap = new THREE.CanvasTexture(can);
        const mat = new THREE.MeshBasicMaterial({
            map: puddleMap,
            color: 0xa8d4ff,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        for (let i = 0; i < PUDDLES; i++) {
            const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat.clone());
            m.rotation.x = -Math.PI / 2;
            m.position.y = 0.42;
            m.visible = false;
            m.renderOrder = 1;
            this.group.add(m);
            this.puddles.push(m);
        }
        // splash points with soft disc + vertical velocity for spark hops
        const N = SPLASH_N;
        const pos = new Float32Array(N * 3);
        const vel = new Float32Array(N);
        for (let i = 0; i < N; i++) {
            pos[i * 3 + 1] = -10;
            vel[i] = 0;
        }
        this.splashGeo = new THREE.BufferGeometry();
        this.splashGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const sc = document.createElement('canvas');
        sc.width = sc.height = 16;
        const sx = sc.getContext('2d');
        const sg = sx.createRadialGradient(8, 8, 0, 8, 8, 8);
        sg.addColorStop(0, 'rgba(220,240,255,1)');
        sg.addColorStop(1, 'rgba(180,210,255,0)');
        sx.fillStyle = sg; sx.fillRect(0, 0, 16, 16);
        const splashMap = new THREE.CanvasTexture(sc);
        this.splash = new THREE.Points(
            this.splashGeo,
            new THREE.PointsMaterial({
                map: splashMap, color: 0xc8e8ff, size: 4.5,
                transparent: true, opacity: 0.75, depthWrite: false,
                depthWrite: false, sizeAttenuation: true, alphaTest: 0.05
            })
        );
        this.splash.visible = false;
        this.splash.frustumCulled = false;
        scene.add(this.splash);
        this._splashPos = pos;
        this._splashVel = vel;
        this._splashN = N;
    },

    update(dt) {
        const wx = G.weatherSys?.state || 'clear';
        const intens = G.weatherSys?.intensity || 0;
        // Surface-only: never draw wet ground / splash under metro slab or indoors
        const surface = !G.inside && !G.ridingMetro;
        this.active = surface && isWetWeather(wx);
        // thunderstorm gets the strongest neon bounce; drizzle is subtle
        const wetScale = wx === 'thunderstorm' ? 1.0 : wx === 'rain' ? 0.85 : 0.45;
        this.neonBoost = this.active ? (0.12 + intens * 0.28) * wetScale : 0;

        for (const p of this.puddles) p.visible = this.active;
        if (this.splash) this.splash.visible = this.active;
        if (this.group) this.group.visible = surface;

        const winBase = G.weatherSys?.winGlow ?? 0;

        // Always re-base materials (Weather set night ramp first this frame)
        // Skip neon wet-boost while underground/indoors so we don't fight restored mats
        this.applied = applyNeonBoost(
            G.world,
            surface ? this.neonBoost : 0,
            this.puddles,
            winBase
        );

        if (!this.active) return;

        this._t += dt;
        // reshuffle puddle ring every few seconds so walking city feels lived-in
        if (Math.floor(this._t / 3.5) !== this._seed) {
            this._seed = Math.floor(this._t / 3.5);
        }
        const cam = G.camera;
        if (!cam) return;

        const layout = puddleLayout(cam.position.x, cam.position.z, PUDDLES, this._seed);
        for (let i = 0; i < this.puddles.length; i++) {
            const L = layout[i];
            const m = this.puddles[i];
            m.position.x = L.x;
            m.position.z = L.z;
            m.scale.setScalar(L.s * (0.92 + this.neonBoost * 0.2));
            m.rotation.z = L.rot;
            // shimmer — neon reflection pulse on wet asphalt
            const pulse = Math.sin(this._t * 2.2 + i * 1.3) * 0.07
                + Math.sin(this._t * 5.1 + i) * 0.03;
            m.material.opacity = Math.min(0.8, 0.32 + this.neonBoost * 0.52 + pulse);
        }

        // ground splash: hop particles that reseed near camera (premium rain impact feel)
        const intensity = Math.max(0.15, intens);
        const spawnRate = wx === 'thunderstorm' ? 0.55 : wx === 'drizzle' ? 0.2 : 0.4;
        for (let i = 0; i < this._splashN; i++) {
            this._splashVel[i] -= 120 * dt;
            this._splashPos[i * 3 + 1] += this._splashVel[i] * dt;
            if (this._splashPos[i * 3 + 1] < 0.5 || Math.random() < spawnRate * dt * 8) {
                const a = Math.random() * Math.PI * 2;
                const r = Math.random() * 95;
                this._splashPos[i * 3] = cam.position.x + Math.cos(a) * r;
                this._splashPos[i * 3 + 1] = 0.6 + Math.random() * 1.2;
                this._splashPos[i * 3 + 2] = cam.position.z + Math.sin(a) * r;
                this._splashVel[i] = 18 + Math.random() * 40 * intensity;
            }
        }
        this.splash.material.opacity = 0.45 + this.neonBoost * 0.4;
        this.splash.material.size = 3.5 + intensity * 2.5;
        this.splashGeo.attributes.position.needsUpdate = true;
    },

    snapshot() {
        return {
            active: this.active,
            weather: G.weatherSys?.state || null,
            puddles: this.puddles.length,
            neonBoost: this.neonBoost,
            applied: this.applied
        };
    }
};
