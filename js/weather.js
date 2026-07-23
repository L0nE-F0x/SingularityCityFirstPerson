/* ══════════════════════════════════════════════════════════════════════════
   SKY + WEATHER — gradient sky dome shader, sun/moon arc, stars, drifting
   clouds, recycled particle precipitation (rain / snow / cherry blossom),
   fog, thunderstorms with lightning, and rare night auroras.
   One Points system is reused for every precipitation type.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import * as TEX from './textures.js';

// 10 weather states, matching the production app (clear · partly cloudy ·
// overcast · fog · drizzle · rain · thunderstorm · snow · cherry blossom ·
// autumn leaves). `cloudy` is the light "partly cloudy"; `overcast` is heavier.
const WEATHERS = ['clear', 'cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'thunderstorm', 'snow', 'cherry', 'autumn'];
const SUN_MAX_EL = 0.80;   // sin(~53°) — highest the key light is allowed to climb
// Markov-ish transition table (what can follow what)
const NEXT = {
    clear: ['clear', 'clear', 'cloudy', 'cherry', 'fog'],
    cloudy: ['cloudy', 'clear', 'overcast', 'drizzle', 'autumn'],
    overcast: ['overcast', 'cloudy', 'rain', 'drizzle', 'fog'],
    fog: ['fog', 'clear', 'cloudy', 'drizzle'],
    drizzle: ['drizzle', 'rain', 'overcast', 'clear'],
    rain: ['rain', 'drizzle', 'thunderstorm', 'overcast'],
    thunderstorm: ['thunderstorm', 'rain', 'overcast'],
    snow: ['snow', 'snow', 'overcast', 'clear'],
    cherry: ['cherry', 'clear', 'cloudy'],
    autumn: ['autumn', 'cloudy', 'clear', 'overcast']
};

/* Climate zones — a lightweight version of the production app's timezone →
   biome detection. A climate biases which states get injected and what the day
   opens with. Override with localStorage.setItem('sc_climate', 'polar'). */
const CLIMATES = {
    tropical:    { favor: ['clear', 'rain', 'thunderstorm', 'cherry', 'overcast'], start: 'clear' },
    arid:        { favor: ['clear', 'clear', 'clear', 'cloudy', 'overcast'], start: 'clear' },
    temperate:   { favor: ['clear', 'cloudy', 'cherry', 'drizzle', 'autumn'], start: 'cloudy' },
    continental: { favor: ['clear', 'cloudy', 'autumn', 'snow', 'overcast'], start: 'cloudy' },
    polar:       { favor: ['snow', 'snow', 'overcast', 'fog', 'cloudy'], start: 'snow' }
};

function detectClimate() {
    try {
        const o = localStorage.getItem('sc_climate');
        if (o && CLIMATES[o]) return o;
        const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
        if (/honolulu|bangkok|jakarta|singapore|manila|kolkata|mumbai|lagos|nairobi|sao_paulo|bogota/.test(tz)) return 'tropical';
        if (/phoenix|riyadh|dubai|cairo|karachi|las_vegas|denver/.test(tz)) return 'arid';
        if (/reykjavik|anchorage|helsinki|tromso|nuuk|murmansk/.test(tz)) return 'polar';
        if (/chicago|toronto|moscow|warsaw|kiev|winnipeg|almaty|novosibirsk|minneapolis/.test(tz)) return 'continental';
    } catch (e) { /* no Intl / storage — fall through */ }
    return 'temperate';
}

export const Weather = {
    state: 'clear',
    intensity: 0,          // ramps 0→1 on transitions
    _timer: 60,
    _lightningT: 5,
    _auroraT: 240,

    init(scene) {
        // ── sky dome ──
        this.skyU = {
            top: { value: new THREE.Color(0x3d78c8) },
            bottom: { value: new THREE.Color(0xcfe8f7) }
        };
        const skyMat = new THREE.ShaderMaterial({
            uniforms: this.skyU,
            vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
            fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
                void main(){ float h = normalize(vP).y*0.5+0.5; gl_FragColor = vec4(mix(bottom, top, pow(max(h,0.0),0.75)), 1.0); }`,
            side: THREE.BackSide, depthWrite: false, fog: false
        });
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 20, 12), skyMat);
        scene.add(this.sky);

        // fog (matching horizon)
        scene.fog = new THREE.Fog(0xcfe8f7, 200, G.preset.far);

        // ── sun / moon sprites ──
        this.sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.sunSprite(), transparent: true, fog: false, depthWrite: false }));
        this.sunSpr.scale.setScalar(900);
        scene.add(this.sunSpr);
        this.moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.moonSprite(), transparent: true, fog: false, depthWrite: false }));
        this.moonSpr.scale.setScalar(520);
        scene.add(this.moonSpr);

        // ── stars ──
        const starN = 1100, pos = new Float32Array(starN * 3);
        for (let i = 0; i < starN; i++) {
            const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * 0.48 + 0.03;
            const r = 6400;
            pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
            pos[i * 3 + 1] = Math.sin(e) * r;
            pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 9, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
        scene.add(this.stars);

        // ── clouds (billboard sprites) ──
        const cloudTex = (() => {
            const c = document.createElement('canvas'); c.width = 256; c.height = 128;
            const x = c.getContext('2d');
            for (let i = 0; i < 14; i++) {
                const cx = 40 + Math.random() * 176, cy = 50 + Math.random() * 40, r = 22 + Math.random() * 30;
                const g = x.createRadialGradient(cx, cy, 2, cx, cy, r);
                g.addColorStop(0, 'rgba(255,255,255,0.55)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                x.fillStyle = g;
                x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
            }
            const t = new THREE.CanvasTexture(c);
            return t;
        })();
        this.clouds = [];
        for (let i = 0; i < 14; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false }));
            s.scale.set(700 + Math.random() * 600, 260 + Math.random() * 200, 1);
            s.position.set((Math.random() - 0.5) * 8000, 800 + Math.random() * 500, (Math.random() - 0.5) * 8000);
            scene.add(s);
            this.clouds.push(s);
        }

        // ── precipitation particles (one recycled system) ──
        const N = G.preset.particles;
        this.pGeo = new THREE.BufferGeometry();
        const pp = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pp[i * 3] = (Math.random() - 0.5) * 900;
            pp[i * 3 + 1] = Math.random() * 500;
            pp[i * 3 + 2] = (Math.random() - 0.5) * 900;
        }
        this.pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
        this.pMat = new THREE.PointsMaterial({ color: 0xaaccee, size: 3.2, transparent: true, opacity: 0.7, sizeAttenuation: true, depthWrite: false });
        this.points = new THREE.Points(this.pGeo, this.pMat);
        this.points.visible = false;
        this.points.frustumCulled = false;
        scene.add(this.points);

        // ── aurora ribbon ──
        const ag = new THREE.PlaneGeometry(5000, 700, 40, 1);
        this.auroraMat = new THREE.MeshBasicMaterial({ color: 0x35ffa0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
        this.aurora = new THREE.Mesh(ag, this.auroraMat);
        this.aurora.position.set(0, 1500, -4500);
        this.aurora.visible = false;
        scene.add(this.aurora);
        this._auroraBase = ag.attributes.position.array.slice();

        G.weatherIntensity = 0;
    },

    // public: force a weather (used by konami egg / tests)
    set(state) {
        if (!WEATHERS.includes(state)) return;
        this.state = state;
        this.intensity = 0;
        G.ui?.setWeather(this._label());
        G.ui?.event('weather_' + state);
    },

    _label() {
        return {
            clear: '☀️ Clear', cloudy: '⛅ Partly Cloudy', overcast: '☁️ Overcast',
            fog: '🌫️ Fog', drizzle: '🌦️ Drizzle', rain: '🌧️ Rain',
            thunderstorm: '⛈️ Thunderstorm', snow: '❄️ Snow',
            cherry: '🌸 Cherry Blossom', autumn: '🍂 Autumn Leaves'
        }[this.state];
    },

    update(dt, t) {
        const dp = G.dayPhase;

        // ── weather state machine (climate-biased) ──
        this._timer -= dt;
        if (this._timer <= 0) {
            if (!this._climate) this._climate = CLIMATES[detectClimate()];
            // half the time follow the Markov chain, half pull a climate favourite
            const pool = Math.random() < 0.5 ? NEXT[this.state] : this._climate.favor;
            this.set(pool[Math.floor(Math.random() * pool.length)]);
            this._timer = 180 + Math.random() * 300;
        }
        this.intensity = Math.min(1, this.intensity + dt / 6);
        G.weatherIntensity = ['rain', 'thunderstorm', 'snow'].includes(this.state) ? this.intensity : 0;

        // ── sun / moon arc ──
        const sunAng = (dp - 0.25) * Math.PI * 2;         // 0.25 sunrise · 0.5 noon
        const sunEl = Math.sin(sunAng);                    // -1..1
        const az = Math.cos(sunAng);
        const cam = G.camera.position;
        this.sunSpr.position.set(cam.x + az * 5200, sunEl * 4200, cam.z - 2600);
        this.moonSpr.position.set(cam.x - az * 5200, -sunEl * 3800, cam.z - 2600);

        const day = Math.max(0, Math.min(1, sunEl * 3 + 0.25));        // daylight factor
        const dusk = Math.max(0, 1 - Math.abs(sunEl) * 4) * (sunEl > -0.15 ? 1 : 0); // golden hour
        const night = 1 - day;

        // sky colours
        const top = this.skyU.top.value, bot = this.skyU.bottom.value;
        const dayTop = 0x2f6fc4, dayBot = 0xcfe8f7;
        const nightTop = 0x060a18, nightBot = 0x101a30;
        const duskTop = 0x3a3a72, duskBot = 0xe8825a;
        top.set(dayTop).lerp(new THREE.Color(nightTop), night);
        bot.set(dayBot).lerp(new THREE.Color(nightBot), night);
        if (dusk > 0) {
            top.lerp(new THREE.Color(duskTop), dusk * 0.7);
            bot.lerp(new THREE.Color(duskBot), dusk * 0.8);
        }
        // weather dimming
        const dim = { clear: 1, cloudy: 0.78, overcast: 0.58, fog: 0.6, drizzle: 0.62, rain: 0.5, thunderstorm: 0.38, snow: 0.8, cherry: 0.95, autumn: 0.85 }[this.state];
        top.multiplyScalar(dim); bot.multiplyScalar(dim);

        // fog follows horizon colour; distance follows weather
        const fogFar = { clear: G.preset.far, cloudy: 2900, overcast: 2100, fog: 380, drizzle: 2000, rain: 1500, thunderstorm: 1100, snow: 1200, cherry: 3000, autumn: 2800 }[this.state];
        G.scene.fog.color.copy(bot);
        G.scene.fog.far += (fogFar - G.scene.fog.far) * Math.min(1, dt * 0.5);
        G.scene.fog.near = G.scene.fog.far * 0.08;

        // lights
        const W = G.world;
        if (W.sun) {
            // Keep the light off the zenith. A vertical wall gets almost no
            // direct light from an overhead sun (N·L → 0), and the old arc
            // peaked at ~72°, so at noon every façade fell back to ambient and
            // the city read as dusk at midday. Cap the elevation and swing the
            // arc wide so the horizontal component stays strong all day.
            const el = Math.min(sunEl, SUN_MAX_EL);
            const horiz = Math.sqrt(Math.max(0.05, 1 - el * el));
            W.sun.position.set(cam.x + az * 2200 * horiz, Math.max(120, el * 1800), cam.z + 1400 * horiz);
            W.sun.intensity = 1.7 * day * dim + 0.12;
            W.sun.color.setHSL(0.1, dusk > 0.3 ? 0.7 : 0.35, dusk > 0.3 ? 0.6 : 0.92);
        }
        if (W.hemi) {
            // Carries every surface the key light misses. With no shadow maps
            // the shade side of a building is hemi + ambient and nothing else,
            // so this has to be generous or half the city sits in the dark.
            W.hemi.intensity = 0.54 + 1.32 * day * dim;
            W.hemi.color.copy(top).lerp(new THREE.Color(0xffffff), 0.4);
        }
        if (W.ambient) W.ambient.intensity = 0.45 + 0.45 * day;

        // Indoors the sky is irrelevant — hold a steady interior level so a
        // lobby doesn't go pitch black at 3am.
        if (G.inside) {
            if (W.hemi) W.hemi.intensity = 1.15;
            if (W.ambient) W.ambient.intensity = 0.85;
            if (W.sun) W.sun.intensity = 0.35;
        }

        // stars
        this.stars.material.opacity = night * (this.state === 'clear' ? 0.95 : 0.35);
        this.stars.position.set(cam.x, 0, cam.z);
        this.sky.position.copy(cam);

        // clouds drift + tint
        const cloudOp = { clear: 0.5, cloudy: 0.9, overcast: 1, fog: 0.4, drizzle: 0.95, rain: 0.95, thunderstorm: 0.98, snow: 0.9, cherry: 0.6, autumn: 0.85 }[this.state];
        for (const c of this.clouds) {
            c.position.x += dt * 9;
            if (c.position.x > cam.x + 4500) c.position.x = cam.x - 4500;
            c.material.opacity = cloudOp * 0.8 * (0.35 + day * 0.65);
            c.material.color.setScalar(0.45 + day * 0.55 * dim);
        }

        // ── precipitation ──
        const precip = { rain: 1, thunderstorm: 1, drizzle: 0.45, snow: 1, cherry: 0.7, autumn: 0.6 }[this.state] || 0;
        this.points.visible = precip > 0 && this.intensity > 0.05;
        if (this.points.visible) {
            const kind = this.state === 'snow' ? 'snow' : this.state === 'cherry' ? 'cherry'
                : this.state === 'autumn' ? 'autumn' : 'rain';
            this.pMat.color.set(kind === 'snow' ? 0xffffff : kind === 'cherry' ? 0xf7b8d0
                : kind === 'autumn' ? 0xc8863a : 0x9fc8ee);
            this.pMat.size = kind === 'snow' ? 4.5 : (kind === 'cherry' || kind === 'autumn') ? 4 : 3;
            this.pMat.opacity = (kind === 'rain' ? 0.55 : 0.85) * this.intensity;
            const pos = this.pGeo.attributes.position.array;
            const fall = kind === 'snow' ? 65 : (kind === 'cherry' || kind === 'autumn') ? 30 : 340;
            const drift = kind === 'rain' ? 40 : 26;
            const n = pos.length / 3;
            for (let i = 0; i < n; i++) {
                pos[i * 3 + 1] -= fall * dt * (0.7 + (i % 5) * 0.12);
                pos[i * 3] += Math.sin(t * 1.5 + i) * drift * dt + (kind === 'rain' ? -30 * dt : 0);
                if (pos[i * 3 + 1] < 0) {
                    pos[i * 3] = cam.x + (Math.random() - 0.5) * 900;
                    pos[i * 3 + 1] = 380 + Math.random() * 120;
                    pos[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 900;
                }
            }
            this.pGeo.attributes.position.needsUpdate = true;
        }

        // ── thunderstorm lightning ──
        if (this.state === 'thunderstorm') {
            this._lightningT -= dt;
            if (this._lightningT <= 0) {
                this._lightningT = 3 + Math.random() * 9;
                const flash = document.getElementById('flash');
                if (flash) {
                    flash.style.transition = 'none'; flash.style.opacity = 0.75;
                    requestAnimationFrame(() => { flash.style.transition = 'opacity .5s'; flash.style.opacity = 0; });
                }
                G.audio?.sfx('thunder', 0.4 + Math.random() * 1.2);
            }
        }

        // ── aurora (rare, clear nights) ──
        if (night > 0.7 && this.state === 'clear') {
            this._auroraT -= dt;
            if (this._auroraT <= 0 && !this.aurora.visible) {
                this.aurora.visible = true;
                G.ui?.event('aurora');
                G.ui?.addToast('✨ An aurora shimmers over the city!');
            }
        }
        if (this.aurora.visible) {
            this.auroraMat.opacity = Math.min(0.4, this.auroraMat.opacity + dt * 0.05);
            const posA = this.aurora.geometry.attributes.position;
            for (let i = 0; i < posA.count; i++) {
                posA.setY(i, this._auroraBase[i * 3 + 1] + Math.sin(t * 0.7 + this._auroraBase[i * 3] * 0.002) * 130);
            }
            posA.needsUpdate = true;
            this.auroraMat.color.setHSL(0.38 + Math.sin(t * 0.2) * 0.08, 1, 0.6);
            if (night < 0.5 || this.state !== 'clear') {
                this.auroraMat.opacity -= dt * 0.1;
                if (this.auroraMat.opacity <= 0) { this.aurora.visible = false; this._auroraT = 300 + Math.random() * 400; }
            }
        }

        // ── night effects on the city ──
        for (const m of W.windowMats || []) m.emissiveIntensity = night * 0.9;
        if (W.lampHeadMat) W.lampHeadMat.color.setScalar(0.15 + night * 0.95);
    }
};
