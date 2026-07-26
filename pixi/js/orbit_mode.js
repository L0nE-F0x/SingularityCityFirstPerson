/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ORBIT MODE (v3.0.0 — Three.js 3D Earth + Real Inclined Satellite Orbits)
   Activated via minimap 🛰️ Orbit button. Full 3D WebGL scene: stylized holographic Earth,
   fresnel atmosphere glow, day/night terminator from real sun direction, 3D-inclined orbits,
   glowing satellite sprites, rotatable via OrbitControls. Satellite data comes from CelesTrak
   (Starlink, OneWeb), supplemented with hardcoded ISS/GPS/Galileo. DOM-based HUD + tooltip.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const OrbitMode = {
    active: false,
    _built: false,
    _transitioning: false,
    _exiting: false,
    _transitionProgress: 0,

    satellites: [],
    _satGroups: {},

    // ─── Three.js ───
    scene: null, camera: null, renderer: null, controls: null,
    raycaster: null, pointer: null,
    canvas: null, hudEl: null, infoPanelEl: null,
    earthGroup: null, earthMesh: null, atmosphereMesh: null, cloudMesh: null,
    gridGroup: null, starField: null, orbitLinesGroup: null,
    satGroup: null, satSprites: [],
    youMarker: null, sunDir: null,
    _dayTex: null, _nightTex: null, _cloudTex: null, _texturesLoaded: false,
    _satTextures: {},
    _selectedSprite: null,
    _tick: 0,
    _lastUpdateMs: 0,

    // Animation timescale: 1 = real time (ISS completes an orbit in ~90 minutes of
    // viewing, Earth rotates in 24h). Bump this if you want sped-up motion.
    TIMESCALE: 1,

    // Saved PixiJS camera state (engine keeps ticking underneath)
    _savedCamX: 0, _savedCamY: 0, _savedCamZoom: 1,

    // Scene scale (Earth radius in scene units; real km → scene via /6371 * this)
    EARTH_R: 100,

    CACHE_KEY: 'sc_orbit_sats_v2',
    CACHE_TTL: 60 * 60 * 1000,

    // ═══════════════════════════════════════════════
    //   SATELLITE DATA (preserved from v2)
    // ═══════════════════════════════════════════════

    async fetchSatellites() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
                this.satellites = cached.data;
                this._groupSatellites();
                return;
            }
        } catch (_) {}

        const userLon = this._getUserLongitude();
        const isProd = typeof location !== 'undefined'
            && location.hostname
            && location.hostname !== 'localhost'
            && location.hostname !== '127.0.0.1';

        let starlinkSamples = [];
        let onewebSamples = [];

        // Primary path: Netlify Function does the heavy 4 MB Starlink fetch server-side
        // and returns a small pre-sampled payload. Much more reliable than shipping the
        // full response to the browser.
        try {
            const r = await fetch(
                `/api/orbit-sats?lon=${userLon}&starlink=80&oneweb=20`,
                { signal: AbortSignal.timeout(25000) }
            );
            if (r.ok) {
                const data = await r.json();
                starlinkSamples = data.starlink || [];
                onewebSamples = data.oneweb || [];
                console.log(`[Orbit] fetched ${starlinkSamples.length} starlink, ${onewebSamples.length} oneweb via function`);
            } else {
                console.warn('[Orbit] orbit-sats function →', r.status);
            }
        } catch (err) {
            console.warn('[Orbit] orbit-sats function failed:', err.message);
        }

        // Fallback: direct CelesTrak (used in dev without Netlify CLI, or if the
        // function is down). Keeps OneWeb working even if Starlink's big response fails.
        if (starlinkSamples.length === 0 && onewebSamples.length === 0) {
            const base = isProd
                ? '/api/celestrak/NORAD/elements/gp.php'
                : 'https://celestrak.org/NORAD/elements/gp.php';
            const results = await Promise.allSettled([
                fetch(`${base}?GROUP=starlink&FORMAT=json`, { signal: AbortSignal.timeout(25000) }).then(r => r.ok ? r.json() : []),
                fetch(`${base}?GROUP=oneweb&FORMAT=json`, { signal: AbortSignal.timeout(25000) }).then(r => r.ok ? r.json() : [])
            ]);
            const starlinkRaw = results[0].status === 'fulfilled' ? results[0].value : [];
            const onewebRaw = results[1].status === 'fulfilled' ? results[1].value : [];
            const filterByRegion = (arr) => arr.filter(s => {
                const diff = Math.abs((((s.RA_OF_ASC_NODE || 0) - userLon + 540) % 360) - 180);
                return diff < 90;
            });
            const regionStar = filterByRegion(starlinkRaw);
            const regionOne = filterByRegion(onewebRaw);
            starlinkSamples = this._sampleArray(regionStar.length ? regionStar : starlinkRaw, 80)
                .map(s => this._compactRaw(s, 'starlink'));
            onewebSamples = this._sampleArray(regionOne.length ? regionOne : onewebRaw, 20)
                .map(s => this._compactRaw(s, 'oneweb'));
        }

        const sats = [
            ...starlinkSamples.map(s => this._parseSat(s, 'starlink')),
            ...onewebSamples.map(s => this._parseSat(s, 'oneweb'))
        ];

        sats.push({
            name: 'ISS (ZARYA)', group: 'iss', noradId: 25544,
            inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5,
            altitude: 420, phase: Math.random() * 360, raan: Math.random() * 360
        });
        sats.push(
            { name: 'GPS BIIR-2', group: 'gps', noradId: 28474, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 45 },
            { name: 'GPS BIIR-3', group: 'gps', noradId: 28874, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 120 },
            { name: 'GALILEO-1', group: 'galileo', noradId: 37846, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 90 },
            { name: 'GALILEO-2', group: 'galileo', noradId: 38857, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 270 }
        );

        if (starlinkSamples.length === 0 && onewebSamples.length === 0) {
            console.warn('[Orbit] both sources failed — using procedural fallback');
            this._generateFallbackSatellites();
        } else {
            this.satellites = sats;
            this._groupSatellites();
            // Only cache if we actually got Starlink data. An all-OneWeb cache would
            // stick around for an hour and make the HUD look broken.
            if (starlinkSamples.length > 0) {
                try {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sats }));
                } catch (_) {}
            }
        }
    },

    // Normalize a raw CelesTrak record (capital-case fields) into the compact shape
    // the function endpoint already returns. Keeps the downstream code uniform.
    _compactRaw(raw, group) {
        return {
            name: raw.OBJECT_NAME || 'Unknown',
            group,
            noradId: raw.NORAD_CAT_ID || 0,
            inclination: raw.INCLINATION || 0,
            eccentricity: raw.ECCENTRICITY || 0,
            meanMotion: raw.MEAN_MOTION || 0,
            raan: raw.RA_OF_ASC_NODE || 0,
            phase: raw.MEAN_ANOMALY || 0
        };
    },

    _getUserLongitude() {
        const offsetMin = new Date().getTimezoneOffset();
        return -offsetMin / 4;
    },

    _parseSat(s, group) {
        // Input is already compact (meanMotion/inclination/etc.). Kepler's 3rd gives
        // altitude from mean motion: a_km = 42241.08 / mean_motion^(2/3).
        const mm = s.meanMotion || 0;
        const altitude = mm ? (42241.08 / Math.pow(mm, 2/3)) - 6371 : 550;
        return {
            name: s.name || 'Unknown',
            group,
            noradId: s.noradId || 0,
            inclination: s.inclination || 53,
            eccentricity: s.eccentricity || 0.0001,
            meanMotion: mm || 15.0,
            altitude,
            phase: s.phase || Math.random() * 360,
            raan: s.raan || Math.random() * 360
        };
    },

    _sampleArray(arr, n) {
        if (arr.length <= n) return arr;
        const step = arr.length / n;
        const result = [];
        for (let i = 0; i < n; i++) result.push(arr[Math.floor(i * step)]);
        return result;
    },

    _groupSatellites() {
        this._satGroups = { starlink: [], oneweb: [], iss: [], gps: [], galileo: [], other: [] };
        this.satellites.forEach(s => {
            const g = this._satGroups[s.group] || this._satGroups.other;
            g.push(s);
        });
    },

    _generateFallbackSatellites() {
        const sats = [];
        for (let i = 0; i < 60; i++) {
            sats.push({
                name: `STARLINK-${1000 + i}`, group: 'starlink', noradId: 50000 + i,
                inclination: 53 + Math.random() * 4, eccentricity: 0.0001,
                meanMotion: 15.0 + Math.random() * 0.5, altitude: 540 + Math.random() * 30,
                phase: Math.random() * 360, raan: Math.random() * 360
            });
        }
        sats.push({ name: 'ISS (ZARYA)', group: 'iss', noradId: 25544, inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5, altitude: 420, phase: Math.random() * 360, raan: 0 });
        sats.push({ name: 'GPS BIIR-2', group: 'gps', noradId: 28474, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 45 });
        sats.push({ name: 'GALILEO-1', group: 'galileo', noradId: 37846, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 90 });
        this.satellites = sats;
        this._groupSatellites();
    },

    registerPull() {},

    // ═══════════════════════════════════════════════
    //   ENTER / EXIT
    // ═══════════════════════════════════════════════

    async enter() {
        if (this.active || this._transitioning) return;
        if (typeof THREE === 'undefined') {
            console.warn('[Orbit] Three.js not loaded');
            return;
        }
        this._transitioning = true;
        this._exiting = false;
        this._transitionProgress = 0;

        if (typeof Camera !== 'undefined') {
            this._savedCamX = Camera.targetX;
            this._savedCamY = Camera.targetY;
            this._savedCamZoom = Camera.targetZoom;
        }

        if (typeof G !== 'undefined' && G.tracking) G.stopTracking();
        if (this.satellites.length === 0) await this.fetchSatellites();
        if (!this._texturesLoaded) await this._loadTextures();
        if (!this._built) this._build();
        else this._rebuildSatellites();

        this.active = true;
        if (this.canvas) {
            this.canvas.style.display = 'block';
            this.canvas.style.opacity = '0';
        }
        if (this.hudEl) this.hudEl.style.display = 'block';

        this._showExitBtn();
        this._hideGameUI();

        if (typeof SND !== 'undefined') SND.setAmbient('orbit');
        if (typeof UI !== 'undefined') UI.addToast('🛰️ Entering orbit view...');
    },

    exit() {
        if (!this.active) return;
        this._transitioning = true;
        this._exiting = true;
        this._transitionProgress = 1;
        if (typeof SND !== 'undefined') SND.setAmbient('outside');
    },

    _completeExit() {
        this.active = false;
        this._transitioning = false;
        this._exiting = false;
        this._transitionProgress = 0;
        this._selectedSprite = null;

        if (this.canvas) this.canvas.style.display = 'none';
        if (this.hudEl) this.hudEl.style.display = 'none';
        this._hideInfoPanel();

        this._restoreGameUI();

        const exitBtn = document.getElementById('btnExitOrbit');
        if (exitBtn) exitBtn.style.display = 'none';

        if (typeof Camera !== 'undefined') {
            Camera.targetX = this._savedCamX || 0;
            Camera.targetY = this._savedCamY || 0;
            Camera.targetZoom = this._savedCamZoom || 1;
            Camera.x = Camera.targetX;
            Camera.y = Camera.targetY;
            Camera.zoom = Camera.targetZoom;
        }
    },

    _hideGameUI() {
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = 'none';
        document.querySelectorAll('.bld-tip, .ship-tip, .tooltip, [id*="tooltip"], [id*="Tip"]')
            .forEach(t => { t.style.display = 'none'; });
    },

    _restoreGameUI() {
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = '';
    },

    // ═══════════════════════════════════════════════
    //   BUILD THREE.JS SCENE
    // ═══════════════════════════════════════════════

    // Load the 8K Earth textures (day, night, clouds) once, with
    // procedural fallbacks if any fail.
    _loadTextures() {
        if (this._texturesLoaded) return Promise.resolve();
        const loader = new THREE.TextureLoader();
        const load = (url) => new Promise((resolve) => {
            loader.load(url, resolve, undefined, (err) => {
                console.warn(`[Orbit] texture ${url} failed — falling back procedural`, err);
                resolve(null);
            });
        });
        return Promise.all([
            load('textures/8k_earth_daymap.jpg'),
            load('textures/8k_earth_nightmap.jpg'),
            load('textures/8k_earth_clouds.jpg')
        ]).then(([day, night, clouds]) => {
            const finalize = (tex, fallback) => {
                if (!tex) return fallback();
                tex.anisotropy = 8;
                tex.minFilter = THREE.LinearMipmapLinearFilter;
                tex.magFilter = THREE.LinearFilter;
                return tex;
            };
            this._dayTex = finalize(day, () => this._makeDayTextureProcedural());
            this._nightTex = finalize(night, () => this._makeNightTextureProcedural());
            this._cloudTex = clouds ? finalize(clouds, null) : null;
            this._texturesLoaded = true;
        });
    },

    _build() {
        this.canvas = document.getElementById('orbitCv');
        this.hudEl = document.getElementById('orbit-hud');
        this.infoPanelEl = document.getElementById('orbitInfoPanel');
        if (!this.canvas) {
            console.warn('[Orbit] #orbitCv canvas not found');
            return;
        }

        const W = window.innerWidth, H = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020208);

        this.camera = new THREE.PerspectiveCamera(45, W / H, 1, 10000);
        this.camera.position.set(0, 80, 320);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.rotateSpeed = 0.5;
        this.controls.minDistance = this.EARTH_R * 1.3;
        this.controls.maxDistance = this.EARTH_R * 9;
        this.controls.target.set(0, 0, 0);

        // Subtle ambient fill — most lighting happens in the earth shader
        this.scene.add(new THREE.AmbientLight(0x334455, 0.6));

        this.raycaster = new THREE.Raycaster();
        // Sprite raycasting default threshold is 0; we need to enable it
        this.pointer = new THREE.Vector2();

        this._buildStars();
        this._buildEarthGroup();
        this._buildOrbitLines();
        this._buildSatellites();
        this._buildHUD();

        this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        this.canvas.addEventListener('click', (e) => this._onClick(e));

        window.addEventListener('resize', () => this.resize());

        this._built = true;
    },

    _buildStars() {
        const geo = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        for (let i = 0; i < 5000; i++) {
            const r = 3000 + Math.random() * 1500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            // Slight color variation — warm/cool mix
            const warm = Math.random() < 0.3;
            if (warm) { colors.push(1.0, 0.85, 0.7); }
            else { colors.push(0.75, 0.85, 1.0); }
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.85
        });
        this.starField = new THREE.Points(geo, mat);
        this.scene.add(this.starField);
    },

    _buildEarthGroup() {
        this.earthGroup = new THREE.Group();
        this.scene.add(this.earthGroup);

        this._buildEarthSphere();
        this._buildClouds();
        this._buildAtmosphere();
        this._buildGrid();
        this._buildYouMarker();
    },

    _buildEarthSphere() {
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                dayMap:   { value: this._dayTex },
                nightMap: { value: this._nightTex },
                sunDir:   { value: new THREE.Vector3(1, 0.2, 0.3).normalize() }
            },
            vertexShader: `
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayMap;
                uniform sampler2D nightMap;
                uniform vec3 sunDir;
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    float d = dot(vNormalW, sunDir);
                    float mixFactor = smoothstep(-0.18, 0.30, d);
                    vec3 day = texture2D(dayMap, vUv).rgb;
                    vec3 night = texture2D(nightMap, vUv).rgb;
                    // Boost night lights slightly to make cities pop
                    night *= 1.25;
                    vec3 color = mix(night, day, mixFactor);
                    // Subtle atmospheric scatter on the sunlit limb
                    float rim = smoothstep(0.0, 0.4, d) * (1.0 - abs(d));
                    color += vec3(0.08, 0.15, 0.25) * rim;
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        const geo = new THREE.SphereGeometry(this.EARTH_R, 96, 64);
        this.earthMesh = new THREE.Mesh(geo, mat);
        this.earthGroup.add(this.earthMesh);
    },

    // Thin transparent cloud shell, lit by sun so clouds disappear on the night side
    _buildClouds() {
        if (!this._cloudTex) return;
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                cloudMap: { value: this._cloudTex },
                sunDir:   { value: new THREE.Vector3(1, 0.2, 0.3).normalize() }
            },
            vertexShader: `
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D cloudMap;
                uniform vec3 sunDir;
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    vec3 c = texture2D(cloudMap, vUv).rgb;
                    float lum = max(c.r, max(c.g, c.b));
                    float d = dot(vNormalW, sunDir);
                    float sunlit = smoothstep(-0.20, 0.30, d);
                    // Day: bright white clouds. Night: dim blue-grey clouds
                    vec3 color = mix(vec3(0.25, 0.30, 0.45), vec3(1.0), sunlit);
                    float alpha = lum * mix(0.35, 0.80, sunlit);
                    if (alpha < 0.02) discard;
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            transparent: true,
            depthWrite: false
        });
        const geo = new THREE.SphereGeometry(this.EARTH_R * 1.008, 96, 64);
        this.cloudMesh = new THREE.Mesh(geo, mat);
        // Child of earthGroup: inherits earth rotation; local rotation below adds drift.
        this.earthGroup.add(this.cloudMesh);
    },

    _buildAtmosphere() {
        const mat = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vPosition = mv.xyz;
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    float intensity = pow(0.72 - dot(vNormal, normalize(-vPosition)), 4.0);
                    vec3 color = vec3(0.26, 0.55, 1.0);
                    gl_FragColor = vec4(color, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const geo = new THREE.SphereGeometry(this.EARTH_R * 1.18, 64, 32);
        this.atmosphereMesh = new THREE.Mesh(geo, mat);
        this.earthGroup.add(this.atmosphereMesh);
    },

    _buildGrid() {
        this.gridGroup = new THREE.Group();
        const r = this.EARTH_R * 1.002;
        const mat = new THREE.LineBasicMaterial({
            color: 0x44aaff, transparent: true, opacity: 0.12
        });
        // Latitudes
        for (let lat = -75; lat <= 75; lat += 15) {
            const pts = [];
            const phi = (lat / 180) * Math.PI;
            const rr = r * Math.cos(phi);
            const y = r * Math.sin(phi);
            for (let lon = 0; lon <= 360; lon += 3) {
                const theta = (lon / 180) * Math.PI;
                pts.push(new THREE.Vector3(rr * Math.cos(theta), y, rr * Math.sin(theta)));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            this.gridGroup.add(new THREE.Line(geo, mat));
        }
        // Longitudes
        for (let lon = 0; lon < 360; lon += 15) {
            const pts = [];
            const theta = (lon / 180) * Math.PI;
            for (let lat = -90; lat <= 90; lat += 3) {
                const phi = (lat / 180) * Math.PI;
                pts.push(new THREE.Vector3(
                    r * Math.cos(phi) * Math.cos(theta),
                    r * Math.sin(phi),
                    r * Math.cos(phi) * Math.sin(theta)
                ));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            this.gridGroup.add(new THREE.Line(geo, mat));
        }
        this.earthGroup.add(this.gridGroup);
    },

    _buildYouMarker() {
        const userLon = this._getUserLongitude();
        const lat = 0;
        const pos = this._latLonToVec3(lat, userLon, this.EARTH_R * 1.015);

        const mat = new THREE.SpriteMaterial({
            map: this._getGlowDotTexture(),
            color: 0x4ade80,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(8, 8, 1);
        sprite.position.copy(pos);
        sprite.userData.isYou = true;
        this.earthGroup.add(sprite);
        this.youMarker = sprite;
    },

    _getGlowDotTexture() {
        if (this._glowDotTex) return this._glowDotTex;
        const s = 64;
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0.0, 'rgba(255,255,255,1.0)');
        g.addColorStop(0.25, 'rgba(255,255,255,0.7)');
        g.addColorStop(0.55, 'rgba(200,230,255,0.25)');
        g.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        const tex = new THREE.CanvasTexture(c);
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearFilter;
        this._glowDotTex = tex;
        return tex;
    },

    // Procedural fallback — stylized continents on deep blue ocean.
    // Used only when the real 8K texture fails to load.
    _makeDayTextureProcedural() {
        const w = 1024, h = 512;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Ocean gradient (deep to shallower)
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, '#0a1630');
        g.addColorStop(0.5, '#0d2350');
        g.addColorStop(1.0, '#06122a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Subtle ocean "noise" to avoid perfectly flat look
        for (let i = 0; i < 1400; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const a = 0.04 + Math.random() * 0.08;
            ctx.fillStyle = `rgba(100,180,255,${a})`;
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
        }

        // Continents — coarse hand-placed blobs in equirectangular space
        // UV convention: U=0 at lon=-180, U=1 at lon=+180; V=0 at lat=+90, V=1 at lat=-90
        const continents = [
            { cx: 0.23, cy: 0.30, rx: 0.11, ry: 0.17 }, // North America
            { cx: 0.27, cy: 0.48, rx: 0.03, ry: 0.05 }, // Central America
            { cx: 0.32, cy: 0.66, rx: 0.05, ry: 0.14 }, // South America
            { cx: 0.50, cy: 0.28, rx: 0.06, ry: 0.07 }, // Europe
            { cx: 0.55, cy: 0.52, rx: 0.07, ry: 0.16 }, // Africa
            { cx: 0.58, cy: 0.38, rx: 0.04, ry: 0.04 }, // Middle East
            { cx: 0.72, cy: 0.28, rx: 0.15, ry: 0.11 }, // Asia (continental mass)
            { cx: 0.70, cy: 0.44, rx: 0.03, ry: 0.06 }, // India
            { cx: 0.80, cy: 0.50, rx: 0.05, ry: 0.05 }, // SE Asia
            { cx: 0.86, cy: 0.66, rx: 0.06, ry: 0.05 }, // Australia
            { cx: 0.43, cy: 0.14, rx: 0.05, ry: 0.06 }, // Greenland
            { cx: 0.50, cy: 0.96, rx: 0.50, ry: 0.05 }  // Antarctica
        ];

        continents.forEach((cn, idx) => {
            const cx = cn.cx * w;
            const cy = cn.cy * h;
            const rx = cn.rx * w;
            const ry = cn.ry * h;
            ctx.fillStyle = '#1e3f22';
            ctx.beginPath();
            const steps = 72;
            for (let i = 0; i <= steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                // Layered jitter so each continent has unique jagged coastline
                const seed = idx * 3.7;
                const j = 0.72
                    + 0.25 * Math.abs(Math.sin(a * 3.1 + seed))
                    + 0.18 * Math.abs(Math.sin(a * 7.3 + seed * 2.1))
                    + 0.10 * Math.abs(Math.cos(a * 11.7 + seed * 0.7));
                const x = cx + Math.cos(a) * rx * j;
                const y = cy + Math.sin(a) * ry * j;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        });

        // Land texture — darker splotches + lighter terrain variation
        ctx.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 6 + Math.random() * 30;
            const dark = Math.random() < 0.6;
            ctx.fillStyle = dark
                ? `rgba(0,0,0,${0.08 + Math.random() * 0.12})`
                : `rgba(90,130,70,${0.10 + Math.random() * 0.15})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // Desert/arid bands — Sahara, Arabian, Gobi, Australian interior
        const arid = [
            { cx: 0.55, cy: 0.45, rx: 0.06, ry: 0.03 },
            { cx: 0.60, cy: 0.40, rx: 0.03, ry: 0.02 },
            { cx: 0.72, cy: 0.33, rx: 0.05, ry: 0.02 },
            { cx: 0.86, cy: 0.66, rx: 0.03, ry: 0.02 }
        ];
        arid.forEach(a => {
            ctx.fillStyle = 'rgba(180,140,80,0.35)';
            ctx.beginPath();
            ctx.ellipse(a.cx * w, a.cy * h, a.rx * w, a.ry * h, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        // Polar ice — brighten Antarctica + Greenland
        ctx.fillStyle = 'rgba(220,235,255,0.55)';
        ctx.fillRect(0, h * 0.93, w, h * 0.07);
        ctx.beginPath();
        ctx.ellipse(0.43 * w, 0.14 * h, 0.05 * w, 0.06 * h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        return tex;
    },

    // Procedural fallback — dark background with city-light clusters on land.
    // Used only when the real 8K texture fails to load.
    _makeNightTextureProcedural() {
        const w = 1024, h = 512;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Nearly black base with deep-blue ocean tint
        ctx.fillStyle = '#02040c';
        ctx.fillRect(0, 0, w, h);

        // City-light clusters placed at approximate major metro areas
        // [cx, cy, radius, density, intensity]
        const cities = [
            // North America — East Coast megalopolis, Chicago, West Coast
            [0.26, 0.33, 0.04, 60, 0.9],   // US NE corridor
            [0.24, 0.32, 0.03, 40, 0.8],   // Midwest
            [0.18, 0.35, 0.02, 30, 0.8],   // CA
            [0.22, 0.38, 0.02, 25, 0.7],   // Texas
            [0.27, 0.47, 0.015, 20, 0.7],  // Mexico City
            // South America
            [0.32, 0.62, 0.02, 25, 0.8],   // São Paulo / Rio
            [0.31, 0.70, 0.015, 15, 0.6],  // Buenos Aires
            // Europe (very dense)
            [0.50, 0.26, 0.03, 70, 0.95],  // Western Europe
            [0.52, 0.23, 0.025, 45, 0.85], // UK/Germany
            [0.55, 0.29, 0.02, 30, 0.8],   // Italy/Greece
            // Middle East
            [0.59, 0.36, 0.025, 25, 0.75], // Turkey
            [0.60, 0.40, 0.02, 20, 0.75],  // Gulf
            [0.62, 0.43, 0.015, 15, 0.7],  // Iran
            // Africa (sparse, brighter on coast/Nile)
            [0.56, 0.44, 0.015, 12, 0.7],  // Nile/Egypt
            [0.55, 0.60, 0.015, 10, 0.6],  // South Africa
            [0.54, 0.52, 0.01, 8, 0.5],    // West Africa
            // India (dense)
            [0.69, 0.43, 0.03, 55, 0.85],  // India
            // Asia (very dense)
            [0.78, 0.34, 0.035, 80, 0.95], // China/Korea/Japan
            [0.82, 0.35, 0.02, 40, 0.9],   // Japan
            [0.75, 0.40, 0.02, 25, 0.8],   // Southern China
            [0.80, 0.49, 0.02, 30, 0.75],  // SE Asia / Singapore
            [0.82, 0.53, 0.015, 15, 0.7],  // Indonesia/Philippines
            // Australia
            [0.87, 0.66, 0.015, 12, 0.7],  // SE Australia
            [0.82, 0.64, 0.01, 6, 0.6]     // Perth
        ];

        cities.forEach(([cx, cy, radius, count, intensity]) => {
            const px = cx * w;
            const py = cy * h;
            const pr = radius * w;
            for (let i = 0; i < count; i++) {
                // Gaussian-ish distribution around the center
                let dx, dy, d;
                do {
                    dx = (Math.random() - 0.5) * pr * 2;
                    dy = (Math.random() - 0.5) * pr * 2 * (h / w);
                    d = Math.sqrt(dx * dx + dy * dy);
                } while (d > pr);
                const x = px + dx;
                const y = py + dy;
                const a = intensity * (0.5 + Math.random() * 0.5) * (1 - d / pr);
                // Warm yellow-orange city light
                ctx.fillStyle = `rgba(255,${180 + Math.random() * 50},${100 + Math.random() * 80},${a})`;
                ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
                // Occasionally a brighter pixel
                if (Math.random() < 0.12) {
                    ctx.fillStyle = `rgba(255,230,150,${a * 0.8})`;
                    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
                }
            }
        });

        // Soft glow pass over dense cities
        ctx.globalCompositeOperation = 'lighter';
        cities.forEach(([cx, cy, radius, count, intensity]) => {
            if (count < 40) return;
            const px = cx * w;
            const py = cy * h;
            const pr = radius * w * 1.4;
            const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
            g.addColorStop(0, `rgba(255,180,100,${0.12 * intensity})`);
            g.addColorStop(1, 'rgba(255,180,100,0)');
            ctx.fillStyle = g;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        });
        ctx.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        return tex;
    },

    // ═══════════════════════════════════════════════
    //   SATELLITES + ORBIT LINES
    // ═══════════════════════════════════════════════

    _buildOrbitLines() {
        this.orbitLinesGroup = new THREE.Group();

        const groupOpacity = {
            starlink: 0.04, oneweb: 0.05, iss: 0.45, gps: 0.25, galileo: 0.25, other: 0.1
        };
        const groupColors = {
            starlink: 0x44aaff, oneweb: 0xff8844, iss: 0xffff00,
            gps: 0x44ff88, galileo: 0xaa88ff, other: 0x888888
        };

        this.satellites.forEach(sat => {
            const pts = [];
            const radius = this._satRadius(sat);
            const steps = sat.group === 'starlink' || sat.group === 'oneweb' ? 48 : 96;
            for (let i = 0; i <= steps; i++) {
                const u = (i / steps) * Math.PI * 2;
                pts.push(this._orbitPosition(sat, u, radius));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({
                color: groupColors[sat.group] || 0x888888,
                transparent: true,
                opacity: groupOpacity[sat.group] || 0.1,
                depthWrite: false
            });
            this.orbitLinesGroup.add(new THREE.Line(geo, mat));
        });

        this.scene.add(this.orbitLinesGroup);
    },

    _buildSatellites() {
        this.satGroup = new THREE.Group();
        this.satSprites = [];

        const groupColors = {
            starlink: 0x66bbff, oneweb: 0xffaa66, iss: 0xffffaa,
            gps: 0x88ffaa, galileo: 0xccaaff, other: 0xffffff
        };
        // Sprite height in scene units. Earth radius = 100 units, so these are small —
        // zoom in to see pixel-art detail; zoomed out they read as tiny dots with shape.
        // ISS is deliberately largest (it's the biggest object on orbit at ~109m).
        const groupScale = {
            starlink: 3.0, oneweb: 3.2, iss: 5.0, gps: 3.5, galileo: 3.5, other: 2.5
        };

        this.satellites.forEach(sat => {
            const color = groupColors[sat.group] || 0xffffff;
            const { tex, aspect } = this._getSatTexture(sat.group);
            const scale = groupScale[sat.group] || 10;
            const mat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
                depthTest: true
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(scale * aspect, scale, 1);
            sprite.userData.sat = sat;
            sprite.userData.orbitAngle = (sat.phase / 180) * Math.PI;
            // Real-time angular speed in radians per second: (rev/day ÷ 86400) × 2π.
            // Applied via delta-time in update() so framerate doesn't affect motion speed.
            sprite.userData.orbitSpeedPerSec = (sat.meanMotion / 86400) * Math.PI * 2;
            sprite.userData.baseScaleX = scale * aspect;
            sprite.userData.baseScaleY = scale;
            sprite.userData.baseColor = color;
            sprite.userData.radius = this._satRadius(sat);

            const pos = this._orbitPosition(sat, sprite.userData.orbitAngle, sprite.userData.radius);
            sprite.position.copy(pos);

            this.satGroup.add(sprite);
            this.satSprites.push(sprite);
        });

        this.scene.add(this.satGroup);
    },

    // scene.remove() alone strands GPU buffers — dispose geometries and
    // materials of the outgoing group (runs on every orbit re-entry, ~100 sat
    // sprites + orbit line geometries per rebuild). Textures are NOT disposed:
    // sat bitmaps live in the shared _satTextures cache and must survive.
    _disposeGroup(group) {
        if (!group) return;
        group.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
            for (const m of mats) m.dispose();
        });
    },

    _rebuildSatellites() {
        if (this.satGroup) { this.scene.remove(this.satGroup); this._disposeGroup(this.satGroup); this.satGroup = null; }
        if (this.orbitLinesGroup) { this.scene.remove(this.orbitLinesGroup); this._disposeGroup(this.orbitLinesGroup); this.orbitLinesGroup = null; }
        this.satSprites = [];
        this._buildOrbitLines();
        this._buildSatellites();
    },

    // Returns { tex, aspect } for a satellite group. Bitmaps are cached per group and drawn
    // with NearestFilter to preserve the chunky pixel-art aesthetic at any zoom level.
    _getSatTexture(group) {
        if (this._satTextures[group]) return this._satTextures[group];
        const { canvas, aspect } = this._drawPixelSat(group);
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        const entry = { tex, aspect };
        this._satTextures[group] = entry;
        return entry;
    },

    // Paint a chunky pixel-art sprite for a given satellite class. Each bitmap has
    // a soft additive glow layer baked in so the sat reads against both bright and dark
    // backgrounds. Returns { canvas, aspect } — aspect = width/height of the canvas.
    _drawPixelSat(group) {
        const PIXEL = 4;
        let cols, rows, draw;

        if (group === 'iss') {
            // Wide truss + 4 pairs of solar arrays + radiators + modules
            cols = 20; rows = 10;
            draw = (px) => {
                // Solar arrays (cobalt blue, slight gradient per pair)
                const panel1 = '#1a3380', panel2 = '#2347b0', edge = '#0c1c4a';
                // Pair 1 (far left)
                px(0, 3, panel1); px(1, 3, panel1); px(2, 3, panel1);
                px(0, 6, panel1); px(1, 6, panel1); px(2, 6, panel1);
                px(0, 2, edge); px(0, 7, edge); px(2, 2, edge); px(2, 7, edge);
                // Pair 2
                px(4, 3, panel2); px(5, 3, panel2); px(6, 3, panel2);
                px(4, 6, panel2); px(5, 6, panel2); px(6, 6, panel2);
                px(4, 2, edge); px(6, 2, edge); px(4, 7, edge); px(6, 7, edge);
                // Pair 3
                px(13, 3, panel2); px(14, 3, panel2); px(15, 3, panel2);
                px(13, 6, panel2); px(14, 6, panel2); px(15, 6, panel2);
                px(13, 2, edge); px(15, 2, edge); px(13, 7, edge); px(15, 7, edge);
                // Pair 4 (far right)
                px(17, 3, panel1); px(18, 3, panel1); px(19, 3, panel1);
                px(17, 6, panel1); px(18, 6, panel1); px(19, 6, panel1);
                px(17, 2, edge); px(19, 2, edge); px(17, 7, edge); px(19, 7, edge);
                // Central truss (horizontal beam, aluminium silver)
                for (let x = 3; x <= 16; x++) {
                    px(x, 4, '#b8c4d0');
                    px(x, 5, '#8896a8');
                }
                // Pressurized modules (white/pearl) — central cluster
                px(8, 4, '#f0f4f8'); px(9, 4, '#f0f4f8'); px(10, 4, '#f0f4f8'); px(11, 4, '#f0f4f8');
                px(8, 5, '#d0d8e0'); px(9, 5, '#d0d8e0'); px(10, 5, '#d0d8e0'); px(11, 5, '#d0d8e0');
                px(8, 3, '#d0d8e0'); px(11, 3, '#d0d8e0');
                px(9, 6, '#aab4c0'); px(10, 6, '#aab4c0');
                // Cupola + docking node (bright white)
                px(9, 7, '#ffffff'); px(10, 7, '#ffffff');
                // Radiator panels (bright silver verticals between panel pairs)
                px(3, 3, '#dce4ec'); px(3, 4, '#dce4ec'); px(3, 5, '#dce4ec'); px(3, 6, '#dce4ec');
                px(16, 3, '#dce4ec'); px(16, 4, '#dce4ec'); px(16, 5, '#dce4ec'); px(16, 6, '#dce4ec');
                px(12, 4, '#dce4ec'); px(12, 5, '#dce4ec');
                px(7, 4, '#dce4ec'); px(7, 5, '#dce4ec');
                // Red warning nav light
                px(9, 2, '#ff4455');
            };
        } else if (group === 'starlink') {
            // Flat body + single large solar wing (the iconic Starlink silhouette)
            cols = 16; rows = 6;
            draw = (px) => {
                // Body (dark grey, compact rectangle)
                px(1, 2, '#444a52'); px(2, 2, '#444a52'); px(3, 2, '#444a52'); px(4, 2, '#444a52');
                px(1, 3, '#2e3238'); px(2, 3, '#2e3238'); px(3, 3, '#2e3238'); px(4, 3, '#2e3238');
                // Highlight edge
                px(1, 2, '#5a6068'); px(4, 2, '#5a6068');
                // Phased-array antenna (bottom of body)
                px(2, 4, '#888e96'); px(3, 4, '#888e96');
                // Large single solar panel extending right
                const panel = '#1a3a98', panelDark = '#0e2570', panelHi = '#2e5ad8';
                for (let x = 5; x < 16; x++) {
                    px(x, 2, panel);
                    px(x, 3, panelDark);
                }
                // Panel cell grid lines
                for (let x = 6; x < 16; x += 2) {
                    px(x, 2, panelHi);
                }
                // Top + bottom edges of panel
                for (let x = 5; x < 16; x++) {
                    px(x, 1, '#0a1640');
                }
                // Nav light
                px(0, 3, '#ff5566');
            };
        } else if (group === 'oneweb') {
            // Box body with two symmetric solar wings
            cols = 14; rows = 8;
            draw = (px) => {
                // Body (amber-copper tint to visually differ from Starlink)
                px(6, 3, '#a86844'); px(7, 3, '#a86844');
                px(6, 4, '#8a5030'); px(7, 4, '#8a5030');
                px(6, 2, '#c88860'); px(7, 2, '#c88860');
                // Antenna
                px(6, 1, '#d4d8dc'); px(7, 1, '#d4d8dc');
                px(6, 0, '#eef0f2');
                // Left wing
                for (let x = 0; x <= 5; x++) {
                    px(x, 3, '#1a3380');
                    px(x, 4, '#0e1f5a');
                }
                px(0, 3, '#2347b0');
                px(2, 3, '#2347b0');
                px(4, 3, '#2347b0');
                // Right wing
                for (let x = 8; x <= 13; x++) {
                    px(x, 3, '#1a3380');
                    px(x, 4, '#0e1f5a');
                }
                px(9, 3, '#2347b0');
                px(11, 3, '#2347b0');
                px(13, 3, '#2347b0');
                // Wing edges
                for (let x = 0; x <= 13; x++) {
                    if (x < 6 || x > 7) px(x, 2, '#0a1640');
                    if (x < 6 || x > 7) px(x, 5, '#0a1640');
                }
                // Status light
                px(7, 5, '#4affaa');
            };
        } else if (group === 'gps') {
            // Blocky body + 2 side panels + hi-gain dish
            cols = 14; rows = 10;
            draw = (px) => {
                // Body (white-cream, GPS-Block-style)
                for (let y = 4; y <= 6; y++) {
                    for (let x = 5; x <= 8; x++) {
                        px(x, y, '#e8e8d8');
                    }
                }
                // Body shading
                px(5, 4, '#c0c0b0'); px(8, 4, '#c0c0b0');
                px(5, 6, '#a8a898'); px(6, 6, '#a8a898'); px(7, 6, '#a8a898'); px(8, 6, '#a8a898');
                // Solar panels (darker blue)
                for (let y = 4; y <= 6; y++) {
                    for (let x = 0; x <= 3; x++) { px(x, y, '#163e6a'); }
                    for (let x = 10; x <= 13; x++) { px(x, y, '#163e6a'); }
                }
                // Panel highlights
                for (let x = 0; x <= 3; x++) { px(x, 4, '#2a6cb0'); }
                for (let x = 10; x <= 13; x++) { px(x, 4, '#2a6cb0'); }
                // Panel cell lines
                px(1, 5, '#0a2650'); px(2, 5, '#0a2650');
                px(11, 5, '#0a2650'); px(12, 5, '#0a2650');
                // Connecting booms
                px(4, 5, '#888'); px(9, 5, '#888');
                // Hi-gain antenna dish on top
                px(6, 3, '#f8f8e8'); px(7, 3, '#f8f8e8');
                px(5, 3, '#d8d8c8'); px(8, 3, '#d8d8c8');
                px(6, 2, '#e8e8d8'); px(7, 2, '#e8e8d8');
                // Feed boom
                px(6, 1, '#aaa'); px(7, 1, '#aaa');
                // Bottom antenna
                px(6, 7, '#888'); px(7, 7, '#888');
                // Green status LED
                px(7, 5, '#4affaa');
            };
        } else if (group === 'galileo') {
            // Similar to GPS but with distinct purple accents + different panel layout
            cols = 14; rows = 10;
            draw = (px) => {
                // Body (pearl white with purple accent band)
                for (let y = 4; y <= 6; y++) {
                    for (let x = 5; x <= 8; x++) {
                        px(x, y, '#eae6f2');
                    }
                }
                // Purple accent stripe (Galileo liveries often have purple/violet)
                px(5, 5, '#8868c0'); px(6, 5, '#8868c0'); px(7, 5, '#8868c0'); px(8, 5, '#8868c0');
                // Body shading
                px(5, 6, '#a098b0'); px(6, 6, '#a098b0'); px(7, 6, '#a098b0'); px(8, 6, '#a098b0');
                // Solar panels (navy blue)
                for (let y = 4; y <= 6; y++) {
                    for (let x = 0; x <= 3; x++) { px(x, y, '#1a2f70'); }
                    for (let x = 10; x <= 13; x++) { px(x, y, '#1a2f70'); }
                }
                // Panel highlights
                for (let x = 0; x <= 3; x++) { px(x, 4, '#3050a8'); }
                for (let x = 10; x <= 13; x++) { px(x, 4, '#3050a8'); }
                // Cell grid
                px(1, 5, '#0a1850'); px(3, 5, '#0a1850');
                px(10, 5, '#0a1850'); px(12, 5, '#0a1850');
                // Booms
                px(4, 5, '#888'); px(9, 5, '#888');
                // Top antenna (L-band horn + dish)
                px(6, 3, '#eae6f2'); px(7, 3, '#eae6f2');
                px(6, 2, '#d8d0e8'); px(7, 2, '#d8d0e8');
                px(6, 1, '#bbb');
                // Violet status LED
                px(7, 5, '#cc88ff');
            };
        } else {
            // Generic fallback
            cols = 8; rows = 6;
            draw = (px) => {
                px(3, 2, '#cccccc'); px(4, 2, '#cccccc');
                px(3, 3, '#888888'); px(4, 3, '#888888');
                for (let x = 0; x <= 2; x++) { px(x, 2, '#1a3380'); px(x, 3, '#0e1f5a'); }
                for (let x = 5; x <= 7; x++) { px(x, 2, '#1a3380'); px(x, 3, '#0e1f5a'); }
            };
        }

        const w = cols * PIXEL;
        const h = rows * PIXEL;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Tight glow hugs the body so the sprite stays compact at low zoom
        const glowR = Math.min(w, h) * 0.35;
        const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, glowR);
        glow.addColorStop(0.0, 'rgba(255,255,255,0.18)');
        glow.addColorStop(0.5, 'rgba(180,210,255,0.06)');
        glow.addColorStop(1.0, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        // Pixel plotter closure — snaps to integer grid
        const px = (x, y, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
        };
        draw(px);

        return { canvas: c, aspect: cols / rows };
    },

    _satRadius(sat) {
        // km → scene units. Earth radius = 6371km maps to EARTH_R scene units.
        return this.EARTH_R * (1 + sat.altitude / 6371);
    },

    // Position of a satellite in 3D given orbital elements + phase angle u.
    // Equatorial plane is XZ (Y-up). Orbital plane = equatorial, rotated by inclination
    // about the line of nodes, which is itself rotated by RAAN about Y.
    _orbitPosition(sat, u, radius) {
        const p = new THREE.Vector3(Math.cos(u) * radius, 0, Math.sin(u) * radius);
        p.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(sat.inclination));
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(sat.raan));
        return p;
    },

    _latLonToVec3(lat, lon, radius) {
        const phi = (lat / 180) * Math.PI;
        const theta = (lon / 180) * Math.PI;
        return new THREE.Vector3(
            radius * Math.cos(phi) * Math.cos(theta),
            radius * Math.sin(phi),
            radius * Math.cos(phi) * Math.sin(theta)
        );
    },

    // ═══════════════════════════════════════════════
    //   HUD (DOM)
    // ═══════════════════════════════════════════════

    _buildHUD() {
        if (!this.hudEl) return;
        const userLon = this._getUserLongitude();
        const tzOffset = new Date().getTimezoneOffset();
        const tzHours = -tzOffset / 60;
        const tzStr = `UTC${tzHours >= 0 ? '+' : ''}${tzHours}`;
        const g = this._satGroups;
        const gpsCount = (g.gps ? g.gps.length : 0) + (g.galileo ? g.galileo.length : 0);

        this.hudEl.innerHTML = `
            <div class="orbit-hud-title">ORBIT VIEW</div>
            <div class="orbit-hud-stats">
                Tracking <b>${this.satellites.length}</b> satellites<br>
                Starlink: ${g.starlink ? g.starlink.length : 0} · OneWeb: ${g.oneweb ? g.oneweb.length : 0} · GPS+Galileo: ${gpsCount} · ISS: ${g.iss ? g.iss.length : 0}
            </div>
            <div class="orbit-hud-loc">📍 Observer at ${tzStr} · lon ≈ ${userLon.toFixed(0)}°</div>
            <div class="orbit-hud-legend">
                <div><span class="orbit-dot" style="background:#44aaff"></span>Starlink — LEO ~550 km</div>
                <div><span class="orbit-dot" style="background:#ff8844"></span>OneWeb — ~1,200 km</div>
                <div><span class="orbit-dot" style="background:#ffff00"></span>ISS — ~420 km</div>
                <div><span class="orbit-dot" style="background:#44ff88"></span>GPS — ~20,200 km</div>
                <div><span class="orbit-dot" style="background:#aa88ff"></span>Galileo — ~23,200 km</div>
            </div>
            <div class="orbit-hud-hint">Drag to rotate · Scroll to zoom · Click satellite</div>
        `;
    },

    // ═══════════════════════════════════════════════
    //   INTERACTION
    // ═══════════════════════════════════════════════

    _onPointerMove(e) {
        if (!this.active) return;
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this._lastPointerEv = e;
    },

    _onClick(e) {
        if (!this.active) return;
        // Refresh pointer NDC on the click event — taps may not fire pointermove first.
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const hit = this._pickSatellite();
        if (hit) {
            this._selectedSprite = hit;
            this._showInfoPanel(hit);
            if (typeof SND !== 'undefined') SND.uiClick();
        }
    },

    // Screen-space picking with earth occlusion.
    // Sprites are small (3–5 scene units) so Three.js's default raycast is fiddly to
    // click. We project each sat into NDC and pick the nearest one to the cursor
    // within a comfortable threshold, skipping any occluded by the Earth sphere.
    _pickSatellite() {
        if (!this.satSprites.length || !this.camera) return null;

        const CLICK_RADIUS_NDC = 0.035;           // ~3.5% of half-viewport — forgiving
        const EARTH_OCC_R_SQ = (this.EARTH_R * 0.985) * (this.EARTH_R * 0.985);
        const camPos = this.camera.position;
        const camDistSq = camPos.lengthSq();
        const ndcX = this.pointer.x;
        const ndcY = this.pointer.y;

        const _dir = new THREE.Vector3();
        const _proj = new THREE.Vector3();
        let best = null;
        let bestD2 = CLICK_RADIUS_NDC * CLICK_RADIUS_NDC;

        for (const sp of this.satSprites) {
            // Earth occlusion: does the ray from camera to sprite pass through the
            // Earth sphere before reaching the sprite? If so, skip.
            _dir.copy(sp.position).sub(camPos);
            const len = _dir.length();
            if (len > 0) {
                _dir.multiplyScalar(1 / len);
                const t = -camPos.dot(_dir);            // closest-approach param
                if (t > 0 && t < len) {
                    const closestSq = camDistSq - t * t;
                    if (closestSq < EARTH_OCC_R_SQ) continue; // blocked by Earth
                }
            }

            // Screen-space distance
            _proj.copy(sp.position).project(this.camera);
            if (_proj.z < -1 || _proj.z > 1) continue;
            const dx = _proj.x - ndcX;
            const dy = _proj.y - ndcY;
            const d2 = dx * dx + dy * dy;

            // Prefer the closest to cursor; break ties by nearer-to-camera (in front).
            if (d2 < bestD2) {
                bestD2 = d2;
                best = sp;
            }
        }
        return best;
    },

    _showInfoPanel(sprite) {
        if (!this.infoPanelEl) return;
        const sat = sprite.userData.sat;
        const R_EARTH = 6371;
        const altStr = sat.altitude < 1000
            ? `${Math.round(sat.altitude)} km`
            : `${(sat.altitude / 1000).toFixed(1)}K km`;
        const periodMin = sat.meanMotion > 0 ? (1440 / sat.meanMotion) : 0;
        const periodStr = periodMin >= 60
            ? `${(periodMin / 60).toFixed(1)} h`
            : `${periodMin.toFixed(1)} min`;
        const orbitalVel = (2 * Math.PI * (R_EARTH + sat.altitude) * sat.meanMotion) / 86400;
        let regime = 'LEO';
        if (sat.altitude > 2000 && sat.altitude < 35000) regime = 'MEO';
        else if (sat.altitude >= 35000) regime = 'GEO';
        const meta = {
            starlink: { op: 'SpaceX', purpose: 'Broadband internet', country: 'USA', launched: '2019–present' },
            oneweb:   { op: 'OneWeb / Eutelsat', purpose: 'Broadband internet', country: 'UK', launched: '2019–present' },
            iss:      { op: 'NASA · Roscosmos · ESA · JAXA · CSA', purpose: 'Crewed space station', country: 'International', launched: '1998' },
            gps:      { op: 'US Space Force', purpose: 'Positioning / navigation', country: 'USA', launched: '1978–present' },
            galileo:  { op: 'EU / ESA', purpose: 'Positioning / navigation', country: 'European Union', launched: '2011–present' },
            other:    { op: '—', purpose: '—', country: '—', launched: '—' }
        }[sat.group] || { op: '—', purpose: '—', country: '—', launched: '—' };

        const accent = '#' + (sprite.userData.baseColor || 0x44aaff).toString(16).padStart(6, '0');

        this.infoPanelEl.innerHTML = `
            <button class="orbit-panel-x" aria-label="Close">✕</button>
            <div class="orbit-panel-top">
                <div class="orbit-panel-name" style="color:${accent}">${sat.name}</div>
                <div class="orbit-panel-badges">
                    <span class="orbit-panel-badge" style="color:${accent};border-color:${accent}55;background:${accent}15">${sat.group.toUpperCase()}</span>
                    <span class="orbit-panel-badge">${regime}</span>
                </div>
            </div>
            <div class="orbit-panel-desc">${meta.purpose}</div>
            <div class="orbit-panel-stats">
                <div class="orbit-stat"><span class="orbit-stat-lbl">Operator</span><span class="orbit-stat-val">${meta.op}</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Country</span><span class="orbit-stat-val">${meta.country}</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">First launched</span><span class="orbit-stat-val">${meta.launched}</span></div>
            </div>
            <div class="orbit-panel-section-h">ORBIT</div>
            <div class="orbit-panel-stats">
                <div class="orbit-stat"><span class="orbit-stat-lbl">Altitude</span><span class="orbit-stat-val">${altStr}</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Inclination</span><span class="orbit-stat-val">${sat.inclination.toFixed(2)}°</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Eccentricity</span><span class="orbit-stat-val">${sat.eccentricity.toFixed(5)}</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Period</span><span class="orbit-stat-val">${periodStr}</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Velocity</span><span class="orbit-stat-val">${orbitalVel.toFixed(2)} km/s</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">Mean motion</span><span class="orbit-stat-val">${sat.meanMotion.toFixed(3)} rev/day</span></div>
                <div class="orbit-stat"><span class="orbit-stat-lbl">NORAD ID</span><span class="orbit-stat-val">${sat.noradId}</span></div>
            </div>
        `;
        this.infoPanelEl.style.borderColor = accent + '80';
        this.infoPanelEl.classList.add('on');
        const closeBtn = this.infoPanelEl.querySelector('.orbit-panel-x');
        if (closeBtn) closeBtn.onclick = () => {
            if (typeof SND !== 'undefined') SND.uiClick();
            this._selectedSprite = null;
            this._hideInfoPanel();
        };
    },

    _hideInfoPanel() {
        if (this.infoPanelEl) this.infoPanelEl.classList.remove('on');
    },

    _showExitBtn() {
        let btn = document.getElementById('btnExitOrbit');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btnExitOrbit';
            btn.innerHTML = '🌍 RETURN TO CITY';
            btn.style.cssText = 'position:absolute;top:0;right:20px;z-index:9999;background:linear-gradient(135deg,#1a3a5c,#0d2240);color:#66bbff;border:none;border-bottom:3px solid #44aaff;padding:12px 20px;border-radius:0 0 6px 6px;cursor:pointer;font-size:12px;font-weight:bold;font-family:"Press Start 2P",monospace;box-shadow:0 4px 12px rgba(68,170,255,0.3);transition:background 0.2s;';
            btn.onmouseover = () => { btn.style.background = 'linear-gradient(135deg,#234b6e,#153050)'; };
            btn.onmouseout = () => { btn.style.background = 'linear-gradient(135deg,#1a3a5c,#0d2240)'; };
            btn.onclick = () => { if (typeof SND !== 'undefined') SND.uiClick(); this.exit(); };
            document.body.appendChild(btn);
        }
        btn.style.display = 'block';
    },

    // ═══════════════════════════════════════════════
    //   FRAME UPDATE (called by engine)
    // ═══════════════════════════════════════════════

    update() {
        if (!this.active && !this._transitioning) return;
        if (!this._built) return;
        this._tick++;

        // Delta-time in seconds (capped so a tab-switch doesn't cause a huge jump).
        const nowMs = performance.now();
        const dt = this._lastUpdateMs
            ? Math.min((nowMs - this._lastUpdateMs) / 1000, 0.1)
            : 0;
        this._lastUpdateMs = nowMs;
        const nowSec = nowMs / 1000;

        // Transition (crossfade) — kept frame-based, it's a short 0.4s animation
        if (this._transitioning) {
            if (!this._exiting) {
                this._transitionProgress = Math.min(1, this._transitionProgress + 0.04);
                if (this.canvas) this.canvas.style.opacity = String(this._transitionProgress);
                if (typeof G !== 'undefined' && G.world) G.world.alpha = 1 - this._transitionProgress;
                if (this._transitionProgress >= 1) {
                    this._transitioning = false;
                    if (typeof G !== 'undefined' && G.world) G.world.visible = false;
                }
            } else {
                this._transitionProgress = Math.max(0, this._transitionProgress - 0.05);
                if (this.canvas) this.canvas.style.opacity = String(this._transitionProgress);
                if (typeof G !== 'undefined' && G.world) {
                    G.world.visible = true;
                    G.world.alpha = 1 - this._transitionProgress;
                }
                if (this._transitionProgress <= 0) {
                    this._completeExit();
                    if (typeof G !== 'undefined' && G.world) G.world.alpha = 1;
                    return;
                }
            }
        }

        if (!this.active) return;

        // Update sun direction (drives the Earth day/night terminator)
        const dp = (typeof G !== 'undefined' && G.getDayPhase) ? G.getDayPhase() : 0.5;
        const angle = (dp - 0.5) * Math.PI * 2 + Math.PI;
        const sx = Math.cos(angle), sy = 0.25, sz = Math.sin(angle);
        if (this.earthMesh) {
            this.earthMesh.material.uniforms.sunDir.value.set(sx, sy, sz).normalize();
        }
        if (this.cloudMesh) {
            this.cloudMesh.material.uniforms.sunDir.value.set(sx, sy, sz).normalize();
        }

        // Real-time rotation rates (radians per second). TIMESCALE=1 is 1:1 real time —
        // Earth takes 24h to rotate, ISS takes ~90min to orbit. Bump TIMESCALE to speed
        // everything up proportionally without changing relative motion.
        const EARTH_ROT_PER_SEC = (Math.PI * 2) / 86400;                   // 1 rev / 24h
        const CLOUD_DIFFERENTIAL_PER_SEC = EARTH_ROT_PER_SEC * 0.05;       // +5% drift
        const ts = this.TIMESCALE;

        if (this.earthGroup) this.earthGroup.rotation.y += EARTH_ROT_PER_SEC * ts * dt;
        if (this.cloudMesh) this.cloudMesh.rotation.y += CLOUD_DIFFERENTIAL_PER_SEC * ts * dt;

        // Animate satellites at real orbital speed
        this.satSprites.forEach(sp => {
            sp.userData.orbitAngle += sp.userData.orbitSpeedPerSec * ts * dt;
            const pos = this._orbitPosition(
                sp.userData.sat,
                sp.userData.orbitAngle,
                sp.userData.radius
            );
            sp.position.copy(pos);
            // ISS blink — time-based so it stays ~1.3s period regardless of framerate
            if (sp.userData.sat.group === 'iss') {
                const p = 1 + Math.sin(nowSec * 4.8) * 0.15;
                sp.scale.set(sp.userData.baseScaleX * p, sp.userData.baseScaleY * p, 1);
            }
        });

        // You-marker pulse (~1.5s period)
        if (this.youMarker) {
            const p = 1 + Math.sin(nowSec * 4.2) * 0.3;
            this.youMarker.scale.set(8 * p, 8 * p, 1);
        }

        // Selected satellite — brighter quick pulse (~0.7s) to draw the eye
        if (this._selectedSprite) {
            const sp = this._selectedSprite;
            const p = 1.25 + Math.sin(nowSec * 9) * 0.2;
            sp.scale.set(sp.userData.baseScaleX * p, sp.userData.baseScaleY * p, 1);
        }

        // Star twinkle (~3.5s period)
        if (this.starField) {
            this.starField.material.opacity = 0.78 + Math.sin(nowSec * 1.8) * 0.08;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    },

    resize() {
        if (!this._built) return;
        const W = window.innerWidth, H = window.innerHeight;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    }
};
