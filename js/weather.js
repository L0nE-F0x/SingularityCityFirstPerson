/* ══════════════════════════════════════════════════════════════════════════
   SKY + WEATHER — cinematic but cheap atmosphere for street-level FP.
   Gradient sky dome (horizon band + sun warm glow), sun/moon arc, soft
   stars, drifting clouds, recycled precipitation Points, fog, thunderstorm
   light flash, rare multi-ribbon aurora. No shadow maps / post / log-depth.
   Window emissive night ramp is owned here; Wetness layers wet neon on top.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import * as TEX from './textures.js';

// 10 weather states, matching the production app (clear · partly cloudy ·
// overcast · fog · drizzle · rain · thunderstorm · snow · cherry blossom ·
// autumn leaves). `cloudy` is the light "partly cloudy"; `overcast` is heavier.
const WEATHERS = ['clear', 'cloudy', 'overcast', 'fog', 'drizzle', 'rain', 'thunderstorm', 'snow', 'cherry', 'autumn'];
const SUN_MAX_EL = 0.80;   // sin(~53°) — highest the key light is allowed to climb

const DIM = {
    clear: 1, cloudy: 0.78, overcast: 0.55, fog: 0.58, drizzle: 0.62,
    rain: 0.48, thunderstorm: 0.34, snow: 0.78, cherry: 0.95, autumn: 0.85
};
/* Aerial perspective, not a haze wall. These used to top out at 2900 with the
   fog colour locked to the (very light) horizon, so on a CLEAR day everything
   past ~1.5 km bleached to near-white and the distant hills — which sit at
   3900-5300 — were 100% fog, i.e. invisible. There was no landmass on the
   horizon at all. Clear weather now carries most of the way to the camera far
   plane so distance reads as distance rather than as a wall. */
const FOG_FAR = {
    clear: 7000, cloudy: 5200, overcast: 3200, fog: 420, drizzle: 3000,
    rain: 2200, thunderstorm: 1500, snow: 1800, cherry: 5600, autumn: 5000
};
const CLOUD_OP = {
    clear: 0.42, cloudy: 0.88, overcast: 1, fog: 0.35, drizzle: 0.94,
    rain: 0.96, thunderstorm: 0.99, snow: 0.88, cherry: 0.55, autumn: 0.82
};
const PRECIP = {
    rain: 1, thunderstorm: 1, drizzle: 0.42, snow: 1, cherry: 0.7, autumn: 0.6
};

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

/* Climate zones — lightweight timezone → biome bias. Override with
   localStorage.setItem('sc_climate', 'polar'). */
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

/** Soft circular particle map (rain drop / snow flake / petal-ish). */
function softParticleMap(kind) {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const x = c.getContext('2d');
    if (kind === 'rain') {
        const g = x.createLinearGradient(16, 2, 16, 30);
        g.addColorStop(0, 'rgba(200,230,255,0)');
        g.addColorStop(0.25, 'rgba(190,220,255,0.85)');
        g.addColorStop(1, 'rgba(160,200,255,0)');
        x.fillStyle = g;
        x.fillRect(13, 2, 6, 28);
    } else if (kind === 'snow') {
        const g = x.createRadialGradient(16, 16, 1, 16, 16, 14);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(240,248,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    } else if (kind === 'cherry') {
        x.fillStyle = 'rgba(255,160,190,0.95)';
        x.beginPath(); x.ellipse(16, 14, 9, 7, 0.3, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,120,160,0.55)';
        x.beginPath(); x.ellipse(14, 16, 6, 5, -0.4, 0, Math.PI * 2); x.fill();
    } else { // autumn
        x.fillStyle = 'rgba(210,120,40,0.95)';
        x.beginPath(); x.ellipse(16, 16, 10, 6, 0.6, 0, Math.PI * 2); x.fill();
        x.strokeStyle = 'rgba(120,60,20,0.7)'; x.lineWidth = 1;
        x.beginPath(); x.moveTo(8, 16); x.lineTo(24, 16); x.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    // Canvas content is authored in sRGB. Left as the default NoColorSpace the
    // values are consumed un-converted — harmless for white, but it visibly
    // over-saturated the cherry-blossom pink and autumn orange particles.
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
}

function cloudTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    for (let i = 0; i < 18; i++) {
        const cx = 28 + Math.random() * 200, cy = 40 + Math.random() * 48, r = 18 + Math.random() * 36;
        const g = x.createRadialGradient(cx, cy, 1, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,0.62)');
        g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = g;
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// Reused Color temps (avoid per-frame alloc in hot path)
const _cDayTop = new THREE.Color(0x2f6fc4);
const _cDayBot = new THREE.Color(0xcfe8f7);
const _cDayMid = new THREE.Color(0x7eb6e8);
const _cNightTop = new THREE.Color(0x050812);
const _cNightBot = new THREE.Color(0x0c1428);
const _cNightMid = new THREE.Color(0x0a1838);
const _cDuskTop = new THREE.Color(0x2a2860);
const _cDuskBot = new THREE.Color(0xe8825a);
const _cDuskMid = new THREE.Color(0xc45a78);
const _cStorm = new THREE.Color(0x1a2230);
const _cTmp = new THREE.Color();
const _cTmp2 = new THREE.Color();
const _ambDay = new THREE.Color(0x8a97ac);
const _ambNight = new THREE.Color(0x3a2a55);

export const Weather = {
    state: 'clear',
    intensity: 0,          // ramps 0→1 on transitions
    climate: null,
    // public so Wetness can layer without fighting the night ramp
    winGlow: 0,
    night: 0,
    day: 1,
    _timer: 60,
    _lightningT: 5,
    _flash: 0,             // 0..1 scene lightning residual
    _auroraT: 240,
    _wind: 1,
    _pKind: 'rain',
    _climate: null,

    init(scene) {
        // ── sky dome: horizon band + sun-warmed sky (still one draw) ──
        this.skyU = {
            top: { value: new THREE.Color(0x3d78c8) },
            mid: { value: new THREE.Color(0x7eb6e8) },
            bottom: { value: new THREE.Color(0xcfe8f7) },
            sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.2).normalize() },
            sunGlow: { value: 0.55 },
            haze: { value: 0.35 }
        };
        const skyMat = new THREE.ShaderMaterial({
            uniforms: this.skyU,
            vertexShader: /* glsl */`
                varying vec3 vW;
                void main(){
                    vec4 w = modelMatrix * vec4(position, 1.0);
                    vW = normalize(position);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: /* glsl */`
                uniform vec3 top, mid, bottom, sunDir;
                uniform float sunGlow, haze;
                varying vec3 vW;
                void main(){
                    vec3 n = normalize(vW);
                    float h = n.y * 0.5 + 0.5;                 // 0 horizon → 1 zenith
                    // three-stop gradient: ground haze → mid sky → zenith
                    float tLow = smoothstep(0.0, 0.42, h);
                    float tHigh = smoothstep(0.38, 1.0, h);
                    vec3 col = mix(bottom, mid, tLow);
                    col = mix(col, top, tHigh);
                    // soft horizon brightening (atmosphere thickness)
                    float hor = exp(-abs(n.y) * 6.5) * haze;
                    col += vec3(0.12, 0.10, 0.06) * hor;
                    // sun-side warm glow (cheap mie stand-in)
                    float sunAmt = pow(max(0.0, dot(n, normalize(sunDir))), 8.0) * sunGlow;
                    col += vec3(1.0, 0.72, 0.38) * sunAmt * 0.55;
                    // broader coronal wash around sun
                    float corona = pow(max(0.0, dot(n, normalize(sunDir))), 2.2) * sunGlow * 0.22;
                    col += vec3(1.0, 0.85, 0.6) * corona;
                    // Ordered-ish dither. A smooth low-contrast gradient across
                    // ~1000px of 8-bit output bands visibly, especially in blue;
                    // a sub-LSB noise floor hides it for one hash.
                    float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
                    col += (d - 0.5) / 255.0;
                    gl_FragColor = vec4(col, 1.0);
                }`,
            side: THREE.BackSide, depthWrite: false, fog: false
        });
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 24, 14), skyMat);
        this.sky.frustumCulled = false;
        scene.add(this.sky);

        // fog (matching horizon)
        scene.fog = new THREE.Fog(0xcfe8f7, 200, G.preset.far);
        /* The sky is a dome parked on the camera, so anything that moves the
           camera between positioning the dome and drawing the frame — a
           teleport, a mode switch, a debug camera — punches a hole straight
           through to the clear colour, which is black. A background colour that
           tracks the fog costs nothing (it IS the clear colour) and makes such
           a gap invisible instead of a black wedge in the sky. */
        scene.background = new THREE.Color(0xcfe8f7);

        // ── sun / moon sprites ──
        this.sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({
            map: TEX.sunSprite(), transparent: true, fog: false, depthWrite: false,
            blending: THREE.AdditiveBlending
        }));
        this.sunSpr.scale.setScalar(900);
        this.sunSpr.renderOrder = -10;
        scene.add(this.sunSpr);
        this.moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({
            map: TEX.moonSprite(), transparent: true, fog: false, depthWrite: false
        }));
        this.moonSpr.scale.setScalar(520);
        this.moonSpr.renderOrder = -10;
        scene.add(this.moonSpr);

        // stars — soft circular sprites + slight size variety for depth
        const starN = 1800;
        const pos = new Float32Array(starN * 3);
        const sizes = new Float32Array(starN);
        for (let i = 0; i < starN; i++) {
            const a = Math.random() * Math.PI * 2;
            const e = Math.pow(Math.random(), 0.68) * Math.PI * 0.48 + 0.02;
            const r = 6000 + Math.random() * 900;
            pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
            pos[i * 3 + 1] = Math.sin(e) * r;
            pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
            // a few brighter "foreground" stars
            sizes[i] = Math.random() < 0.04 ? 1.8 + Math.random() * 1.2 : 0.55 + Math.random() * 0.9;
        }
        const sg = new THREE.BufferGeometry();
        sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        sg.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
        const starCan = document.createElement('canvas');
        starCan.width = starCan.height = 64;
        const sctx = starCan.getContext('2d');
        const sgrad = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        sgrad.addColorStop(0, 'rgba(255,255,255,1)');
        sgrad.addColorStop(0.22, 'rgba(230,238,255,0.92)');
        sgrad.addColorStop(0.5, 'rgba(180,200,255,0.28)');
        sgrad.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = sgrad; sctx.fillRect(0, 0, 64, 64);
        const starMap = new THREE.CanvasTexture(starCan);
        starMap.colorSpace = THREE.SRGBColorSpace;
        // ShaderMaterial so aSize + twinkle stay cheap (one material, no per-star CPU)
        this.starU = { opacity: { value: 0 }, twinkle: { value: 0 }, map: { value: starMap } };
        const starMat = new THREE.ShaderMaterial({
            uniforms: this.starU,
            vertexShader: /* glsl */`
                attribute float aSize;
                uniform float twinkle;
                varying float vA;
                void main(){
                    float phase = fract(position.x * 0.0013 + position.z * 0.0011);
                    float tw = 0.72 + 0.28 * sin(twinkle * 2.1 + phase * 6.2831);
                    vA = tw;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    // dome sits ~6k units out — large scale so points read as stars, not dust
                    gl_PointSize = aSize * 170.0 * (420.0 / max(80.0, -mv.z));
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D map;
                uniform float opacity;
                varying float vA;
                void main(){
                    vec4 t = texture2D(map, gl_PointCoord);
                    float a = t.a * opacity * vA;
                    if (a < 0.02) discard;
                    gl_FragColor = vec4(t.rgb * 1.05, a);
                }`,
            transparent: true, depthWrite: false, fog: false,
            blending: THREE.AdditiveBlending
        });
        this.stars = new THREE.Points(sg, starMat);
        this.stars.frustumCulled = false;
        scene.add(this.stars);

        // ── clouds (billboard sprites, camera-relative wrap) ──
        const cloudTex = cloudTexture();
        this.clouds = [];
        for (let i = 0; i < 16; i++) {
            const s = new THREE.Sprite(new THREE.SpriteMaterial({
                map: cloudTex, transparent: true, opacity: 0.75, depthWrite: false, fog: false
            }));
            s.scale.set(650 + Math.random() * 700, 240 + Math.random() * 220, 1);
            s.userData.baseY = 700 + Math.random() * 550;
            s.userData.speed = 6 + Math.random() * 10;
            s.userData.phase = Math.random() * Math.PI * 2;
            s.position.set((Math.random() - 0.5) * 9000, s.userData.baseY, (Math.random() - 0.5) * 9000);
            s.renderOrder = -8;
            scene.add(s);
            this.clouds.push(s);
        }

        // ── precipitation particles (one recycled system + soft maps) ──
        const N = G.preset.particles;
        this.pGeo = new THREE.BufferGeometry();
        const pp = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            pp[i * 3] = (Math.random() - 0.5) * 900;
            pp[i * 3 + 1] = Math.random() * 500;
            pp[i * 3 + 2] = (Math.random() - 0.5) * 900;
        }
        this.pGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
        this._pMaps = {
            rain: softParticleMap('rain'),
            snow: softParticleMap('snow'),
            cherry: softParticleMap('cherry'),
            autumn: softParticleMap('autumn')
        };
        this.pMat = new THREE.PointsMaterial({
            color: 0xaaccee, size: 3.2, map: this._pMaps.rain,
            transparent: true, opacity: 0.7, sizeAttenuation: true,
            depthWrite: false, alphaTest: 0.02
        });
        this.points = new THREE.Points(this.pGeo, this.pMat);
        this.points.visible = false;
        this.points.frustumCulled = false;
        scene.add(this.points);

        // ── aurora: two additive ribbons (green + magenta), warped mesh ──
        this.auroraGroup = new THREE.Group();
        this.auroraGroup.visible = false;
        this._auroraRibbons = [];
        const ribbonDefs = [
            { color: 0x35ffa0, y: 1400, z: -4200, w: 5200, h: 780, amp: 140, hue: 0.38 },
            { color: 0x8866ff, y: 1650, z: -3900, w: 4800, h: 520, amp: 100, hue: 0.72 },
            { color: 0x44ddff, y: 1250, z: -4500, w: 4000, h: 420, amp: 90, hue: 0.48 }
        ];
        for (const d of ribbonDefs) {
            const ag = new THREE.PlaneGeometry(d.w, d.h, 48, 2);
            const mat = new THREE.MeshBasicMaterial({
                color: d.color, transparent: true, opacity: 0,
                side: THREE.DoubleSide, depthWrite: false, fog: false,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(ag, mat);
            mesh.position.set(0, d.y, d.z);
            mesh.rotation.x = -0.12;
            this.auroraGroup.add(mesh);
            this._auroraRibbons.push({
                mesh, mat, base: ag.attributes.position.array.slice(),
                amp: d.amp, hue: d.hue, phase: Math.random() * Math.PI * 2
            });
        }
        scene.add(this.auroraGroup);
        // legacy single-handle for any external refs
        this.aurora = this.auroraGroup;
        this.auroraMat = this._auroraRibbons[0].mat;

        /* Image-based lighting from the sky itself. Every metallic surface in
           the city (spires, mullions, shopfront glass, car bodies) needs
           something to reflect or it renders as dead grey. Rather than ship a
           cubemap asset, render the sky dome we already have into a small
           PMREM: the reflections then track the real time of day and weather
           for free — warm at dusk, blue at noon, slate in a storm.
           A second sphere sharing the same ShaderMaterial keeps the live dome
           out of the capture scene. */
        this._envScene = new THREE.Scene();
        this._envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 14), skyMat);
        this._envScene.add(this._envSky);
        this._envPhase = -1;
        this._envDirty = true;

        // scratch
        this._sunDir = new THREE.Vector3();
        G.weatherIntensity = 0;

        // climate once at boot so shell/store can read it immediately
        this.climate = detectClimate();
        this._climate = CLIMATES[this.climate];
        if (this._climate?.start && !G._wxForced) {
            this.state = this._climate.start;
        }
    },

    /* Re-bake scene.environment from the current sky. Called from update()
       only when the sun has actually moved enough to matter (or the weather
       changed), because fromScene costs a few ms — far too much for a frame
       budget, and completely invisible if run every ~1/100th of a day. */
    _refreshEnvironment() {
        const renderer = G.renderer;
        if (!renderer) return;
        if (!this._pmrem) {
            this._pmrem = new THREE.PMREMGenerator(renderer);
            this._pmrem.compileEquirectangularShader();
        }
        const prev = G.scene.environment;
        const rt = this._pmrem.fromScene(this._envScene, 0, 1, 500);
        G.scene.environment = rt.texture;
        if (prev) prev.dispose();
        this._envDirty = false;
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
        const cam = G.camera.position;

        // ── weather state machine (climate-biased) ──
        this._timer -= dt;
        if (this._timer <= 0) {
            if (!this._climate) {
                this.climate = detectClimate();
                this._climate = CLIMATES[this.climate];
            }
            // half the time follow the Markov chain, half pull a climate favourite
            const pool = Math.random() < 0.5 ? NEXT[this.state] : this._climate.favor;
            this.set(pool[Math.floor(Math.random() * pool.length)]);
            this._timer = 180 + Math.random() * 300;
            this._envDirty = true;
        }
        this.intensity = Math.min(1, this.intensity + dt / 6);
        G.weatherIntensity = ['rain', 'thunderstorm', 'snow', 'drizzle'].includes(this.state)
            ? this.intensity * (this.state === 'drizzle' ? 0.45 : 1)
            : 0;

        // wind leans harder in storms
        const windTarget = this.state === 'thunderstorm' ? 1.8
            : this.state === 'rain' ? 1.25
            : this.state === 'snow' ? 0.7
            : this.state === 'fog' ? 0.25 : 0.85;
        this._wind += (windTarget - this._wind) * Math.min(1, dt * 0.4);

        // ── sun / moon arc ──
        const sunAng = (dp - 0.25) * Math.PI * 2;         // 0.25 sunrise · 0.5 noon
        const sunEl = Math.sin(sunAng);                    // -1..1
        const az = Math.cos(sunAng);

        this.sunSpr.position.set(cam.x + az * 5200, sunEl * 4200, cam.z - 2600);
        this.moonSpr.position.set(cam.x - az * 5200, -sunEl * 3800, cam.z - 2600);

        const day = Math.max(0, Math.min(1, sunEl * 3 + 0.25));        // daylight factor
        const dusk = Math.max(0, 1 - Math.abs(sunEl) * 4) * (sunEl > -0.15 ? 1 : 0); // golden hour
        const night = 1 - day;
        this.day = day;
        this.night = night;

        // sun/moon visibility & scale — cinematic without extra draws
        const sunVis = Math.max(0, Math.min(1, sunEl * 4 + 0.55));
        const moonVis = Math.max(0, Math.min(1, -sunEl * 3.2 + 0.35));
        this.sunSpr.material.opacity = sunVis * (0.75 + dusk * 0.35) * (0.55 + DIM[this.state] * 0.45);
        this.moonSpr.material.opacity = moonVis * (this.state === 'clear' || this.state === 'cloudy' ? 0.95 : 0.55);
        this.sunSpr.scale.setScalar(780 + dusk * 280 + sunVis * 120);
        this.moonSpr.scale.setScalar(480 + night * 80);
        this.sunSpr.visible = sunVis > 0.02;
        this.moonSpr.visible = moonVis > 0.02;

        // sky colours (skip when konami owns the palette — only top/bottom are driven
        // by progress.js; keep mid as a soft blend so the 3-stop shader still looks alive)
        const top = this.skyU.top.value, mid = this.skyU.mid.value, bot = this.skyU.bottom.value;
        const dim = DIM[this.state];
        if (G.flags?.konami) {
            mid.copy(top).lerp(bot, 0.5);
        } else {
            top.copy(_cDayTop).lerp(_cNightTop, night);
            mid.copy(_cDayMid).lerp(_cNightMid, night);
            bot.copy(_cDayBot).lerp(_cNightBot, night);
            if (dusk > 0) {
                top.lerp(_cDuskTop, dusk * 0.72);
                mid.lerp(_cDuskMid, dusk * 0.78);
                bot.lerp(_cDuskBot, dusk * 0.85);
            }
            // storm / overcast desaturate toward slate
            if (dim < 0.7) {
                const stormMix = (0.7 - dim) / 0.7;
                top.lerp(_cStorm, stormMix * 0.55);
                mid.lerp(_cStorm, stormMix * 0.4);
                bot.lerp(_cStorm, stormMix * 0.25);
            }
            top.multiplyScalar(dim);
            mid.multiplyScalar(0.55 + dim * 0.45);
            bot.multiplyScalar(0.65 + dim * 0.35);
            // fog weather: wash sky toward cool grey
            if (this.state === 'fog') {
                _cTmp.set(0x9aa8b8);
                top.lerp(_cTmp, 0.45 * this.intensity);
                mid.lerp(_cTmp, 0.55 * this.intensity);
                bot.lerp(_cTmp, 0.65 * this.intensity);
            }
        }

        // sun direction into sky shader (world-ish, relative to dome center)
        this._sunDir.set(az * 0.75, Math.max(0.02, sunEl), -0.45).normalize();
        this.skyU.sunDir.value.copy(this._sunDir);
        this.skyU.sunGlow.value = (0.15 + day * 0.55 + dusk * 0.85) * dim * (1 - (this.state === 'fog' ? 0.5 : 0) * this.intensity);
        this.skyU.haze.value = 0.22 + day * 0.2 + dusk * 0.35
            + (this.state === 'fog' ? 0.45 * this.intensity : 0)
            + (this.state === 'overcast' ? 0.15 : 0);

        // Re-bake the IBL when the sky has visibly changed. 1/140th of a day is
        // ~10 in-game minutes — fast enough that sunset reflections keep up,
        // rare enough that the cost never lands on a frame that matters.
        if (this._envDirty || Math.abs(dp - this._envPhase) > 1 / 140) {
            this._envPhase = dp;
            this._refreshEnvironment();
        }

        // fog follows horizon colour; distance follows weather.
        // Skip while metro/interior own the fog volume (they save/restore on exit).
        // NEVER write fog/background while riding — metro re-locks after us each frame,
        // but a single weather write can still flash if update order ever shifts.
        const fogFarTarget = FOG_FAR[this.state] ?? G.preset.far;
        const surfaceAtmo = !G.inside && !G.ridingMetro;
        if (G.scene.fog && surfaceAtmo) {
            G.scene.fog.color.copy(bot);
            if (G.scene.background?.isColor) G.scene.background.copy(bot);
            // lightning flash bleaches fog briefly
            if (this._flash > 0) {
                G.scene.fog.color.lerp(_cTmp2.set(0xddeeff), this._flash * 0.85);
            }
            G.scene.fog.far += (fogFarTarget - G.scene.fog.far) * Math.min(1, dt * 0.5);
            // fog weather: near plane creeps in so streets drown
            const nearMul = this.state === 'fog' ? 0.02 + 0.04 * (1 - this.intensity)
                : this.state === 'thunderstorm' ? 0.05
                : 0.03;
            G.scene.fog.near = G.scene.fog.far * nearMul;
        }

        // lights
        const W = G.world;
        let flashBoost = this._flash * this._flash;
        // With sun shadows on, the fill can (and must) come down hard: the old
        // hemi+ambient budget existed purely to keep unshadowed geometry from
        // going black, and it flattened every surface in the city. `fill` scales
        // the whole indirect budget so the `low` (no-shadow) preset keeps the
        // original generous values and everything else gets real contrast.
        // 0.72 is the point where a shadowed façade still reads as blue shade
        // rather than a black hole, while sunlit faces keep real contrast.
        const fill = W.shadows ? 0.72 : 1;
        if (W.sun) {
            // Keep the light off the zenith. A vertical wall gets almost no
            // direct light from an overhead sun (N·L → 0), and the old arc
            // peaked at ~72°, so at noon every façade fell back to ambient and
            // the city read as dusk at midday. Cap the elevation and swing the
            // arc wide so the horizontal component stays strong all day.
            const el = Math.min(sunEl, SUN_MAX_EL);
            const horiz = Math.sqrt(Math.max(0.05, 1 - el * el));
            // Direction the light TRAVELS (sun → ground). World.aimSun keeps the
            // light and its shadow frustum locked to this vector wherever the
            // player stands, so the sun angle no longer drifts across the city.
            W.aimSun(
                -az * 2200 * horiz,
                -Math.max(320, el * 1800),
                -1400 * horiz,
                cam.x, cam.z
            );
            W.sun.intensity = (W.shadows ? 2.2 : 1.7) * day * dim + 0.12 + flashBoost * 2.8;
            W.sun.color.setHSL(0.1, dusk > 0.3 ? 0.7 : 0.35, dusk > 0.3 ? 0.6 : 0.92);
            if (flashBoost > 0.05) {
                W.sun.color.lerp(_cTmp2.set(0xc8e0ff), flashBoost * 0.7);
            }
            // A shadow map that still renders at night is pure cost — the sun
            // contributes nothing below the horizon.
            if (W.shadows) W.sun.castShadow = day > 0.06 && !G.inside && !G.ridingMetro;
        }
        if (W.hemi) {
            // Carries every surface the key light misses.
            W.hemi.intensity = (0.54 + 1.32 * day * dim) * fill + flashBoost * 0.9;
            W.hemi.color.copy(top).lerp(_cTmp2.set(0xffffff), 0.4);
        }
        if (W.ambient) W.ambient.intensity = (0.45 + 0.45 * day) * fill;

        // Indoors the sky is irrelevant — hold a steady interior level so a
        // lobby doesn't go pitch black at 3am. Metro cabin uses its own lights.
        /* Interior levels were tuned against a NoToneMapping pipeline. ACES
           rolls the top end off, so the same numbers left every lobby and bar
           reading as a blackout — the rooms are lit almost entirely by ambient
           and hemi, with no key light to survive the curve. */
        if (G.inside) {
            if (W.hemi) W.hemi.intensity = 2.0;
            if (W.ambient) W.ambient.intensity = 1.35;
            if (W.sun) W.sun.intensity = 0.55;
            if (W.ambient) W.ambient.color.setHex(0x9aa6bc);
        } else if (G.ridingMetro) {
            if (W.hemi) W.hemi.intensity = 0.45;
            if (W.ambient) W.ambient.intensity = 0.34;
            if (W.sun) W.sun.intensity = 0.08;
        }

        // stars (shader opacity + twinkle clock) — never show under the slab
        const starOp = night * night * (this.state === 'clear' ? 1.0
            : this.state === 'cloudy' ? 0.4
            : this.state === 'cherry' || this.state === 'autumn' ? 0.55
            : 0.12);
        this.starU.opacity.value = starOp;
        this.starU.twinkle.value = t;
        this.stars.position.set(cam.x, 0, cam.z);
        this.stars.visible = starOp > 0.02 && !G.inside && !G.ridingMetro;
        this.sky.position.copy(cam);
        if (G.ridingMetro || G.inside) {
            this.sky.visible = false;
            this.sunSpr.visible = false;
            this.moonSpr.visible = false;
        } else {
            this.sky.visible = true;
            // sun/moon visibility already set from sunVis/moonVis above
        }

        // clouds drift + camera wrap + storm tint
        const cloudOp = CLOUD_OP[this.state];
        const stormCloud = this.state === 'thunderstorm' || this.state === 'overcast' || this.state === 'rain';
        const showSkyBits = !G.inside && !G.ridingMetro;
        for (const c of this.clouds) {
            c.visible = showSkyBits;
            if (!showSkyBits) continue;
            c.position.x += dt * c.userData.speed * this._wind;
            c.position.y = c.userData.baseY + Math.sin(t * 0.15 + c.userData.phase) * 18;
            // wrap in camera-relative ring so sky never empties
            if (c.position.x > cam.x + 5000) c.position.x -= 10000;
            if (c.position.x < cam.x - 5000) c.position.x += 10000;
            if (c.position.z > cam.z + 5000) c.position.z -= 10000;
            if (c.position.z < cam.z - 5000) c.position.z += 10000;
            c.material.opacity = cloudOp * (0.32 + day * 0.55 + night * 0.18) * (0.7 + dim * 0.3);
            if (stormCloud) {
                c.material.color.setRGB(0.35 + day * 0.2, 0.38 + day * 0.22, 0.42 + day * 0.2);
            } else if (dusk > 0.2) {
                c.material.color.setRGB(0.55 + dusk * 0.3, 0.4 + dusk * 0.15, 0.38);
            } else {
                const s = 0.5 + day * 0.5 * dim;
                c.material.color.setRGB(s, s, s * 1.02);
            }
        }

        // ── precipitation ──
        // Hide indoors AND while riding metro (board only snapshots currently-visible
        // objects — rain that starts mid-ride would otherwise fall in the tunnel).
        const precip = (PRECIP[this.state] || 0) * this.intensity;
        this.points.visible = precip > 0.04 && !G.inside && !G.ridingMetro;
        if (this.points.visible) {
            const kind = this.state === 'snow' ? 'snow'
                : this.state === 'cherry' ? 'cherry'
                : this.state === 'autumn' ? 'autumn' : 'rain';
            if (this._pKind !== kind) {
                this._pKind = kind;
                this.pMat.map = this._pMaps[kind];
                this.pMat.needsUpdate = true;
            }
            this.pMat.color.set(kind === 'snow' ? 0xffffff
                : kind === 'cherry' ? 0xf7b8d0
                : kind === 'autumn' ? 0xc8863a
                : 0xb0d4f5);
            // rain: tall thin streaks; snow/petals: larger soft discs
            this.pMat.size = kind === 'rain' ? (this.state === 'drizzle' ? 5.5 : 7.5)
                : kind === 'snow' ? 5.2
                : 5.5;
            this.pMat.opacity = (kind === 'rain' ? 0.48 : 0.82) * this.intensity
                * (this.state === 'drizzle' ? 0.7 : 1);
            const posA = this.pGeo.attributes.position.array;
            const fall = kind === 'snow' ? 55
                : (kind === 'cherry' || kind === 'autumn') ? 28
                : (this.state === 'drizzle' ? 180 : 380);
            const driftX = (kind === 'rain' ? -55 : 18) * this._wind;
            const sway = kind === 'rain' ? 12 : 32;
            const n = posA.length / 3;
            // only sim a density slice so heavy rain still feels dense without full N cost on low
            const live = Math.min(n, Math.floor(n * (0.35 + precip * 0.65)));
            for (let i = 0; i < live; i++) {
                posA[i * 3 + 1] -= fall * dt * (0.7 + (i % 5) * 0.12);
                posA[i * 3] += Math.sin(t * 1.4 + i * 0.37) * sway * dt + driftX * dt;
                if (kind !== 'rain') {
                    posA[i * 3 + 2] += Math.cos(t * 0.9 + i * 0.21) * sway * 0.6 * dt;
                }
                if (posA[i * 3 + 1] < 0) {
                    posA[i * 3] = cam.x + (Math.random() - 0.5) * 880;
                    posA[i * 3 + 1] = 360 + Math.random() * 140;
                    posA[i * 3 + 2] = cam.z + (Math.random() - 0.5) * 880;
                }
            }
            // park unused particles under ground so density can thin
            for (let i = live; i < n; i++) {
                if (posA[i * 3 + 1] > -10) posA[i * 3 + 1] = -50;
            }
            this.pGeo.attributes.position.needsUpdate = true;
            this.points.position.set(0, 0, 0);
        }

        // ── thunderstorm lightning ──
        if (this._flash > 0) this._flash = Math.max(0, this._flash - dt * 2.4);
        if (this.state === 'thunderstorm') {
            this._lightningT -= dt;
            if (this._lightningT <= 0) {
                this._lightningT = 2.5 + Math.random() * 8;
                this._flash = 0.85 + Math.random() * 0.15;
                // double-flicker residual
                const flash = document.getElementById('flash');
                if (flash) {
                    flash.style.transition = 'none'; flash.style.opacity = 0.78;
                    requestAnimationFrame(() => {
                        flash.style.transition = 'opacity .08s';
                        flash.style.opacity = 0.15;
                        setTimeout(() => {
                            flash.style.transition = 'none';
                            flash.style.opacity = 0.55;
                            requestAnimationFrame(() => {
                                flash.style.transition = 'opacity .55s';
                                flash.style.opacity = 0;
                            });
                        }, 70);
                    });
                }
                G.audio?.sfx('thunder', 0.4 + Math.random() * 1.2);
            }
        } else if (this._flash > 0.01 && this.state !== 'thunderstorm') {
            this._flash *= 0.9;
        }

        // ── aurora (rare, clear / lightly cloudy nights) ──
        const auroraOk = night > 0.72 && (this.state === 'clear' || this.state === 'cloudy');
        if (auroraOk) {
            this._auroraT -= dt;
            if (this._auroraT <= 0 && !this.auroraGroup.visible) {
                this.auroraGroup.visible = true;
                for (const r of this._auroraRibbons) r.mat.opacity = 0;
                G.ui?.event('aurora');
                G.ui?.addToast('✨ An aurora shimmers over the city!');
                G.flags.auroraSeen = true;
            }
        }
        if (this.auroraGroup.visible) {
            this.auroraGroup.position.set(cam.x, 0, cam.z);
            let maxOp = 0;
            for (let ri = 0; ri < this._auroraRibbons.length; ri++) {
                const r = this._auroraRibbons[ri];
                const targetOp = auroraOk ? 0.22 + ri * 0.06 : 0;
                r.mat.opacity += (targetOp - r.mat.opacity) * Math.min(1, dt * (auroraOk ? 0.35 : 0.8));
                maxOp = Math.max(maxOp, r.mat.opacity);
                const posR = r.mesh.geometry.attributes.position;
                const base = r.base;
                for (let i = 0; i < posR.count; i++) {
                    const bx = base[i * 3];
                    const by = base[i * 3 + 1];
                    const wave = Math.sin(t * 0.65 + bx * 0.0018 + r.phase) * r.amp
                        + Math.sin(t * 1.1 + bx * 0.0035 + ri) * r.amp * 0.35;
                    posR.setY(i, by + wave);
                }
                posR.needsUpdate = true;
                r.mat.color.setHSL(r.hue + Math.sin(t * 0.18 + ri) * 0.05, 0.95, 0.55);
            }
            if (maxOp < 0.01 && !auroraOk) {
                this.auroraGroup.visible = false;
                this._auroraT = 280 + Math.random() * 420;
            }
        }

        // ── night effects on the city ──
        // Stronger lit windows + neon so night reads like the 2D city, not grey boxes.
        // Wetness.update runs after us and adds wet neon boost on top of winGlow.
        /* Nyepi is the Balinese day of silence — the island genuinely turns its
           lights off. If it's running, the city does too, which is a far
           stronger read than any decoration could be. */
        const blackout = G.seasonal?.blackout ? 0.08 : 1;
        const winGlow = (night * night * 0.35 + night * 1.15) * blackout; // ease-in toward full night
        this.winGlow = winGlow;
        for (const m of W.windowMats || []) {
            m.emissiveIntensity = Math.min(1.65, winGlow);
            if (m.emissive) {
                // warm tungsten at full night; cooler dusk glass
                if (night > 0.55) m.emissive.setHex(0xffe0a8);
                else if (night > 0.2) m.emissive.setHex(0xffd9a0);
                else m.emissive.setHex(0xfff0d0);
            }
        }
        if (W.lampHeadMat) {
            W.lampHeadMat.color.setScalar((0.12 + night * 1.05) * blackout + flashBoost * 0.5);
        }
        // Halo + ground pool follow the same ramp. Hidden entirely by day and
        // indoors so neither costs a blended draw when it can't be seen.
        {
            const lit = Math.max(0, night * night * 1.25 - 0.05) * (surfaceAtmo ? 1 : 0) * blackout;
            if (W.lampGlowMat) {
                W.lampGlowMat.opacity = Math.min(0.5, lit * 0.46);
                W.lampGlowMat.visible = lit > 0.01;
            }
            if (W.lampPoolMat) {
                // Wet tarmac throws the pool further, so let rain push it up.
                W.lampPoolMat.opacity = Math.min(0.6, lit * (0.34 + G.weatherIntensity * 0.3));
                W.lampPoolMat.visible = lit > 0.01;
            }
        }
        // Neon signs punch up after dusk (Wetness multiplies further when raining)
        if (W.neonMat) {
            if (W.neonMat.userData._baseOpacity == null) {
                W.neonMat.userData._baseOpacity = W.neonMat.opacity != null ? W.neonMat.opacity : 1;
            }
            W.neonMat.opacity = Math.min(1, W.neonMat.userData._baseOpacity * (0.72 + night * 0.58));
            W.neonMat.transparent = true;
        }
        // Soft magenta/cyan fill so neon "bounces" without shadow maps.
        // This used to run unconditionally and silently undid the interior /
        // metro light overrides set above, so a lobby at 03:00 was lit by the
        // night sky budget rather than its own.
        if (surfaceAtmo) {
            if (W.ambient) {
                W.ambient.color.copy(_ambDay).lerp(_ambNight, Math.min(1, night * 1.1));
                W.ambient.intensity = (0.45 + 0.35 * day + night * 0.28) * fill + flashBoost * 0.35;
            }
            if (W.hemi) {
                W.hemi.intensity = (0.5 + 0.9 * day * dim + night * 0.22) * fill + flashBoost * 0.9;
            }
        }
    }
};
