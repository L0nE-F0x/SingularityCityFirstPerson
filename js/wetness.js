/* ══════════════════════════════════════════════════════════════════════════
   RAIN WETNESS — puddles near the camera, ground splash sparks, neon
   reflections: boosts World.neonMat + window emissives under wet weather.
   Pool-bounded planes (flat cost).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

const WET_STATES = new Set(['rain', 'drizzle', 'thunderstorm']);
const PUDDLES = 10;

export function isWetWeather(state) {
    return WET_STATES.has(state);
}

export function puddleLayout(camX, camZ, n = PUDDLES, seed = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + seed;
        const r = 40 + (i % 5) * 28;
        out.push({
            x: camX + Math.cos(a) * r,
            z: camZ + Math.sin(a) * r,
            s: 12 + (i % 4) * 6
        });
    }
    return out;
}

/** Apply neonBoost to real scene materials (windows + neon signs + puddle tint). */
export function applyNeonBoost(world, neonBoost, puddles = []) {
    const boost = Math.max(0, neonBoost || 0);
    let windows = 0, neon = 0;
    // window emissives — weather already set a night base; we layer wet gleam
    for (const m of world?.windowMats || []) {
        if (!m) continue;
        m.emissiveIntensity = Math.min(1.8, (m.emissiveIntensity || 0) + boost * 1.2);
        windows++;
    }
    // neon sign material (MeshBasic) — punch up opacity + cyan lean
    if (world?.neonMat) {
        const nm = world.neonMat;
        if (nm.userData._wetBaseOpacity == null) {
            nm.userData._wetBaseOpacity = nm.opacity != null ? nm.opacity : 1;
            nm.userData._wetBaseColor = nm.color ? nm.color.clone() : new THREE.Color(0xffffff);
            nm.transparent = true;
        }
        nm.opacity = Math.min(1, nm.userData._wetBaseOpacity * (1 + boost * 0.9));
        if (nm.color && nm.userData._wetBaseColor) {
            // lean toward cyan neon reflection under rain
            nm.color.copy(nm.userData._wetBaseColor).lerp(new THREE.Color(0x66f0ff), Math.min(0.45, boost));
        }
        neon = 1;
    }
    // puddles pick up neon cyan/magenta when wet (ground neon reflections)
    for (const p of puddles) {
        if (!p?.material?.color) continue;
        if (boost > 0) {
            p.material.color.setRGB(
                0.08 + boost * 0.15,
                0.22 + boost * 0.55,
                0.35 + boost * 0.65
            );
            p.material.opacity = Math.min(0.72, 0.32 + boost * 0.55);
        } else {
            p.material.color.setHex(0x1a3048);
        }
    }
    // streetlamp heads: slightly cooler/brighter wet glint
    if (world?.lampHeadMat && boost > 0) {
        const c = world.lampHeadMat.color;
        if (c) c.offsetHSL(0, 0, Math.min(0.15, boost * 0.25));
    }
    return { windows, neon, boost };
}

export const Wetness = {
    active: false,
    group: null,
    puddles: [],
    splash: null,
    _t: 0,
    neonBoost: 0,
    applied: null,

    init(scene) {
        this.group = new THREE.Group();
        scene.add(this.group);
        // soft-edged puddle disc (radial alpha) so wet ground doesn't look like hard coins
        const can = document.createElement('canvas');
        can.width = can.height = 64;
        const ctx = can.getContext('2d');
        const rg = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
        rg.addColorStop(0, 'rgba(180,220,255,0.85)');
        rg.addColorStop(0.45, 'rgba(80,140,200,0.45)');
        rg.addColorStop(1, 'rgba(20,40,60,0)');
        ctx.fillStyle = rg; ctx.fillRect(0, 0, 64, 64);
        const puddleMap = new THREE.CanvasTexture(can);
        const mat = new THREE.MeshBasicMaterial({
            map: puddleMap,
            color: 0xa8d4ff,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        for (let i = 0; i < PUDDLES; i++) {
            const m = new THREE.Mesh(new THREE.CircleGeometry(1, 16), mat.clone());
            m.rotation.x = -Math.PI / 2;
            m.position.y = 0.45;
            m.visible = false;
            this.group.add(m);
            this.puddles.push(m);
        }
        // splash points
        const N = 80;
        const pos = new Float32Array(N * 3);
        this.splashGeo = new THREE.BufferGeometry();
        this.splashGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.splash = new THREE.Points(
            this.splashGeo,
            new THREE.PointsMaterial({ color: 0xaaccff, size: 3, transparent: true, opacity: 0.7 })
        );
        this.splash.visible = false;
        scene.add(this.splash);
        this._splashPos = pos;
        this._splashN = N;
    },

    update(dt) {
        const wx = G.weatherSys?.state || 'clear';
        this.active = isWetWeather(wx);
        this.neonBoost = this.active ? 0.15 + (G.weatherSys?.intensity || 0) * 0.25 : 0;

        for (const p of this.puddles) p.visible = this.active;
        if (this.splash) this.splash.visible = this.active;

        // Always call apply so dry weather restores neon base when leaving rain
        this.applied = applyNeonBoost(G.world, this.neonBoost, this.puddles);

        if (!this.active) {
            // restore neon material base when dry
            const nm = G.world?.neonMat;
            if (nm?.userData?._wetBaseOpacity != null) {
                nm.opacity = nm.userData._wetBaseOpacity;
                if (nm.color && nm.userData._wetBaseColor) nm.color.copy(nm.userData._wetBaseColor);
            }
            return;
        }

        this._t += dt;
        const cam = G.camera;
        if (!cam) return;
        const layout = puddleLayout(cam.position.x, cam.position.z, PUDDLES, Math.floor(this._t / 3));
        for (let i = 0; i < this.puddles.length; i++) {
            const L = layout[i];
            const m = this.puddles[i];
            m.position.x = L.x;
            m.position.z = L.z;
            m.scale.setScalar(L.s);
            // shimmer — neon reflection pulse on wet asphalt
            m.material.opacity = Math.min(0.75, 0.35 + this.neonBoost * 0.5 + Math.sin(this._t * 2 + i) * 0.08);
        }
        // ground splash near camera
        for (let i = 0; i < this._splashN; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 90;
            this._splashPos[i * 3] = cam.position.x + Math.cos(a) * r;
            this._splashPos[i * 3 + 1] = 1 + Math.random() * 8;
            this._splashPos[i * 3 + 2] = cam.position.z + Math.sin(a) * r;
        }
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
