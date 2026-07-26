/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   HOLOMAP — 3D Galaxy Visualization of the AI Industry (Three.js r128)
   Adapted from Singularity Atlas for Singularity City's macro view
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Holomap = {

    // ─── State ───
    active: false,
    scene: null, camera: null, renderer: null, controls: null,
    raycaster: null, mouse: null, animId: null, tick: 0,

    // ─── 3D Objects ───
    galaxyGroup: null, asiGroup: null, bgStarsMesh: null, glowTex: null,
    nebulae: [], stars: [], barrierLabels: [],
    meshToStarMap: new Map(), orbitAngles: {},

    // ─── Interaction ───
    hover: null, selected: null,

    // ─── DOM ───
    canvas: null, labelsContainer: null, tooltip: null, infoPanel: null,
    W: 0, H: 0,

    // ═══════════════════════════════════════════════
    //   INITIALIZATION
    // ═══════════════════════════════════════════════

    init() {
        this.canvas = document.getElementById('holomapCv');
        this.labelsContainer = document.getElementById('holomap-labels');
        this.tooltip = document.getElementById('holomapTooltip');
        this.infoPanel = document.getElementById('holomapInfoPanel');
        if (!this.canvas || !this.labelsContainer) return;

        this.W = window.innerWidth;
        this.H = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#04040e');
        this.scene.fog = new THREE.FogExp2('#04040e', 0.00010);
        
        // Simple ambient light (BasicMaterial doesn't need directional lights)
        var ambLight = new THREE.AmbientLight(0x444466, 0.8);
        this.scene.add(ambLight);

        this.camera = new THREE.PerspectiveCamera(45, this.W / this.H, 1, 20000);
        this.camera.position.set(0, 2000, 3500);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setSize(this.W, this.H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 10000;
        this.controls.minDistance = 200;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.setupInput();

        window.addEventListener('resize', () => {
            if (!this.active) return;
            this.W = window.innerWidth; this.H = window.innerHeight;
            this.camera.aspect = this.W / this.H;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.W, this.H);
        });
    },

    // ═══════════════════════════════════════════════
    //   SHOW / HIDE
    // ═══════════════════════════════════════════════

    show() {
        if (!this.scene) return;
        this.active = true;
        this.canvas.style.display = 'block';
        this.labelsContainer.style.display = 'block';
        if (this.tooltip) this.tooltip.style.display = 'none';

        this.W = window.innerWidth; this.H = window.innerHeight;
        this.camera.aspect = this.W / this.H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.W, this.H);

        this.buildUniverse();
        this.tick = 0;
        this.loop();

        // Sound: warp-in sweep + deep space ambient
        if (typeof SND !== 'undefined') {
            SND.playTone(200, 'sine', 0.6, 0.06, 800);
            setTimeout(function() { SND.playTone(400, 'triangle', 0.4, 0.04, 1200); }, 150);
            setTimeout(function() { SND.setAmbient('holomap'); }, 300);
        }
        if (typeof G !== 'undefined') G.unlockAchieve('galactic_tourist');
    },

    hide() {
        this.active = false;
        this.canvas.style.display = 'none';
        this.labelsContainer.style.display = 'none';
        if (this.tooltip) { this.tooltip.classList.remove('on'); this.tooltip.style.display = 'none'; }
        if (this.infoPanel) this.infoPanel.classList.remove('on');
        if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
        this.hover = null; this.selected = null;

        // Sound: warp-out sweep + restore city ambient
        if (typeof SND !== 'undefined') {
            SND.playTone(800, 'sine', 0.5, 0.05, 200);
            setTimeout(function() { SND.playTone(600, 'triangle', 0.3, 0.03, 100); }, 100);
            setTimeout(function() { SND.setAmbient('outside'); }, 400);
        }
    },

    // ═══════════════════════════════════════════════
    //   HELPERS
    // ═══════════════════════════════════════════════

    getGlowTex() {
        if (this.glowTex) return this.glowTex;
        var c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        var ctx = c.getContext('2d');
        var grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 128, 128);
        this.glowTex = new THREE.CanvasTexture(c);
        return this.glowTex;
    },

    cleanHex(c) {
        if (!c) return '#ffffff';
        if (c.startsWith('hsl') || c.startsWith('rgb')) return c;
        if (c.length === 4 && c.startsWith('#')) return '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3];
        return c;
    },

    // Lab brand colours can be near-black (e.g. xAI's black), which vanishes
    // against the #04040e holomap void — the nebula's additive glow contributes
    // nothing and the panel/label text is unreadable. Lift any colour below a
    // luminance floor toward soft slate-white, proportional to how dark it is.
    // Generic (not xAI-specific) so any future dark lab stays legible too.
    displayHex(c) {
        var hex = this.cleanHex(c);
        if (hex.charAt(0) !== '#' || hex.length !== 7) return hex;   // skip rgb()/hsl()/malformed
        var r = parseInt(hex.substr(1, 2), 16),
            g = parseInt(hex.substr(3, 2), 16),
            b = parseInt(hex.substr(5, 2), 16);
        var lum = 0.299 * r + 0.587 * g + 0.114 * b;   // perceived brightness 0..255
        var MIN = 130;
        if (lum >= MIN) return hex;
        // Blend toward #e2e8f0; t=0 at the floor, →0.9 for pure black (keeps a hint).
        var t = Math.min(0.9, (MIN - lum) / MIN);
        r = Math.round(r + (226 - r) * t);
        g = Math.round(g + (232 - g) * t);
        b = Math.round(b + (240 - b) * t);
        var hx = function (v) { return ('0' + (v & 0xff).toString(16)).slice(-2); };
        return '#' + hx(r) + hx(g) + hx(b);
    },

    getStageForModel(m) {
        const rel = m.rel || m.released;
        const ret = m.ret || m.retired;
        if (typeof getStage === 'function' && rel) {
            return getStage(rel, ret, m.phase);
        }
        if (ret && new Date(ret) < new Date()) return 'retired';
        if (m.phase === 'rumored') return 'rumored';
        if (m.phase === 'pre_training') return 'baby';
        if (m.phase === 'training') return 'kid';
        return 'adult';
    },

    getMagnitude(m) {
        var bm = avgBM(m.id);
        var stg = this.getStageForModel(m);
        if (stg === 'retired') return 4 + ((m.id.length * 7) % 3) * 0.5;
        if (stg === 'rumored') return 3;
        if (stg === 'baby') return 4;
        if (stg === 'kid') return 5;

        var rel = (m.rel || m.released) ? new Date(m.rel || m.released).getTime() : Date.now();
        var age = (Date.now() - rel) / (1e3 * 60 * 60 * 24 * 30);
        var recency = Math.max(0, 1 - age / 48);
        var bmScore = (bm || 35) / 100;
        return 4 + (bmScore * 18) + (recency * 0.3 * 5);
    },

    // ═══════════════════════════════════════════════
    //   BUILD UNIVERSE
    // ═══════════════════════════════════════════════

    // scene.remove() alone strands GPU buffers — Three.js needs explicit
    // dispose() on geometries and materials. The universe is rebuilt on EVERY
    // show(), with two 3000-point starfields plus a mesh per model (~1000), so
    // skipping this leaks a full universe per open/close cycle. Textures are
    // deliberately NOT disposed: the only one in play is the shared cached
    // glowTex, which must survive rebuilds.
    disposeGroup(group) {
        if (!group) return;
        group.traverse(function (obj) {
            if (obj.geometry) obj.geometry.dispose();
            var mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
            for (var i = 0; i < mats.length; i++) mats[i].dispose();
        });
    },

    buildUniverse() {
        var self = this;
        if (this.galaxyGroup) {
            this.scene.remove(this.galaxyGroup);
            this.disposeGroup(this.galaxyGroup);
        }
        this.galaxyGroup = new THREE.Group();
        this.scene.add(this.galaxyGroup);
        this.meshToStarMap.clear();
        this.nebulae = []; this.stars = []; this.barrierLabels = [];

        // Grid
        var grid = new THREE.GridHelper(14000, 60, 0x222233, 0x11111a);
        grid.position.y = -200;
        this.galaxyGroup.add(grid);

        // ─── COSMIC BACKGROUND ───

        // Layer 1: Dense distant starfield (warm + cool mix)
        var bgGeo1 = new THREE.BufferGeometry();
        var bgPos1 = [], bgCol1 = [];
        for (var i = 0; i < 3000; i++) {
            bgPos1.push((Math.random()-.5)*14000, (Math.random()-.5)*14000, (Math.random()-.5)*14000);
            var temp = Math.random();
            if (temp < 0.6) { bgCol1.push(0.6, 0.65, 1.0); }        // cool blue-white
            else if (temp < 0.85) { bgCol1.push(1.0, 0.9, 0.7); }   // warm gold
            else { bgCol1.push(1.0, 0.7, 0.85); }                    // soft pink
        }
        bgGeo1.setAttribute('position', new THREE.Float32BufferAttribute(bgPos1, 3));
        bgGeo1.setAttribute('color', new THREE.Float32BufferAttribute(bgCol1, 3));
        this.galaxyGroup.add(new THREE.Points(bgGeo1, new THREE.PointsMaterial({
            size: 3, sizeAttenuation: true, transparent: true, opacity: 0.5, vertexColors: true
        })));

        // Layer 2: Bright nearby stars (fewer, larger, vivid)
        var bgGeo2 = new THREE.BufferGeometry();
        var bgPos2 = [], bgCol2 = [];
        for (var j = 0; j < 500; j++) {
            bgPos2.push((Math.random()-.5)*10000, (Math.random()-.5)*5000, (Math.random()-.5)*10000);
            var t2 = Math.random();
            if (t2 < 0.4) { bgCol2.push(0.8, 0.85, 1.0); }          // blue-white
            else if (t2 < 0.7) { bgCol2.push(1.0, 1.0, 0.9); }      // bright white
            else if (t2 < 0.9) { bgCol2.push(1.0, 0.8, 0.5); }      // amber
            else { bgCol2.push(0.9, 0.6, 1.0); }                      // lavender
        }
        bgGeo2.setAttribute('position', new THREE.Float32BufferAttribute(bgPos2, 3));
        bgGeo2.setAttribute('color', new THREE.Float32BufferAttribute(bgCol2, 3));
        this.galaxyGroup.add(new THREE.Points(bgGeo2, new THREE.PointsMaterial({
            size: 6, sizeAttenuation: true, transparent: true, opacity: 0.7, vertexColors: true
        })));

        // Layer 3: Deep-space nebula clouds — BRIGHT colors, low opacity
        var glowTex = this.getGlowTex();
        var cosmicClouds = [
            { x: -3000, y:  800, z: -2000, scale: 3000, color: '#7744cc', opacity: 0.035 },  // purple nebula
            { x:  2800, y: -400, z: -3500, scale: 3500, color: '#3366bb', opacity: 0.03 },   // blue nebula
            { x: -1500, y:  300, z:  3000, scale: 2500, color: '#aa3388', opacity: 0.025 },   // magenta nebula
            { x:  4000, y:  500, z:  1500, scale: 3200, color: '#2288aa', opacity: 0.025 },   // teal nebula
            { x:   200, y: -500, z: -4500, scale: 4000, color: '#6644aa', opacity: 0.03 },    // violet nebula
            { x: -4500, y: -200, z:  1200, scale: 2800, color: '#4477aa', opacity: 0.025 },   // steel blue
            { x:  1800, y:  900, z:  4500, scale: 3000, color: '#993366', opacity: 0.025 },    // wine nebula
            { x: -2500, y: -700, z: -1800, scale: 2200, color: '#5533aa', opacity: 0.035 },   // indigo nebula
            { x:  3500, y:  200, z: -1000, scale: 2600, color: '#227799', opacity: 0.02 },    // cyan drift
            { x: -800,  y:  600, z: -3500, scale: 3800, color: '#884488', opacity: 0.02 },    // orchid haze
        ];
        cosmicClouds.forEach(function(cc) {
            var cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: glowTex, color: cc.color,
                transparent: true, opacity: cc.opacity, blending: THREE.AdditiveBlending
            }));
            cloud.scale.set(cc.scale, cc.scale, 1);
            cloud.position.set(cc.x, cc.y, cc.z);
            self.galaxyGroup.add(cloud);
        });

        // Layer 4: Galactic dust plane (wide, faint, along the equator)
        var dustPlane = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: '#6644aa',
            transparent: true, opacity: 0.02, blending: THREE.AdditiveBlending
        }));
        dustPlane.scale.set(14000, 800, 1);
        dustPlane.position.set(0, -50, 0);
        this.galaxyGroup.add(dustPlane);

        // Layer 5: Central galactic core glow
        var coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: '#8855cc',
            transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending
        }));
        coreGlow.scale.set(2200, 2200, 1);
        coreGlow.position.set(0, 0, 0);
        this.galaxyGroup.add(coreGlow);

        // Layer 6: Secondary warm core halo
        var coreWarm = new THREE.Sprite(new THREE.SpriteMaterial({
            map: glowTex, color: '#aa6633',
            transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending
        }));
        coreWarm.scale.set(3000, 3000, 1);
        coreWarm.position.set(0, 0, 0);
        this.galaxyGroup.add(coreWarm);

        // ASI Black Hole
        this.asiGroup = new THREE.Group();
        this.galaxyGroup.add(this.asiGroup);
        this.asiGroup.add(new THREE.Mesh(
            new THREE.SphereGeometry(60, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x000000 })
        ));
        var asiGlow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.getGlowTex(), color: 0xa78bfa,
            transparent: true, blending: THREE.AdditiveBlending, opacity: 0.5
        }));
        asiGlow.scale.set(400, 400, 1);
        this.asiGroup.add(asiGlow);

        for (var ri = 0; ri < 3; ri++) {
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(120 + ri*40, 2, 16, 100),
                new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.4 - ri*0.1, blending: THREE.AdditiveBlending })
            );
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = ri * 0.2;
            this.asiGroup.add(ring);
        }

        // Clear HTML labels
        this.labelsContainer.innerHTML = '';

        // ASI label
        var asiLabel = document.createElement('div');
        asiLabel.className = 'holo-asi-label';
        asiLabel.innerHTML = '<div>ASI</div><div class="holo-asi-sub">Artificial Superintelligence</div>';
        this.asiHtmlLabel = asiLabel;
        this.labelsContainer.appendChild(asiLabel);

        // Barrier Labels
        var barriers = ["Compute Costs", "Energy Bottleneck", "Alignment Problem", "Data Scarcity", "Regulation"];
        barriers.forEach(function(txt, i) {
            var bLabel = document.createElement('div');
            bLabel.className = 'holo-barrier-label';
            bLabel.textContent = txt;
            self.barrierLabels.push({ text: txt, idx: i, dom: bLabel });
            self.labelsContainer.appendChild(bLabel);
        });

        // ─── Only create nebulae for labs that have models ───
        var allModels = G.models || [];
        var labModelCounts = {};
        var labMaxElo = {};
        var labAvgBm = {};
        allModels.forEach(function(m) {
            if (m.lab && LABS[m.lab]) {
                labModelCounts[m.lab] = (labModelCounts[m.lab] || 0) + 1;
                var elo = (BM[m.id] && BM[m.id].ELO) ? BM[m.id].ELO : 0;
                if (!labMaxElo[m.lab] || elo > labMaxElo[m.lab]) labMaxElo[m.lab] = elo;
                var bm = avgBM(m.id) || 0;
                labAvgBm[m.lab] = (labAvgBm[m.lab] || 0) + bm;
            }
        });
        // Finalize averages
        Object.keys(labAvgBm).forEach(function(k) {
            labAvgBm[k] = labModelCounts[k] ? labAvgBm[k] / labModelCounts[k] : 0;
        });

        // Calculate proximity score: higher = closer to ASI
        var labScores = {};
        var maxModels = 1;
        Object.keys(labModelCounts).forEach(function(k) { if (labModelCounts[k] > maxModels) maxModels = labModelCounts[k]; });
        Object.keys(labModelCounts).forEach(function(k) {
            var modelScore = (labModelCounts[k] / maxModels) * 40;       // 0-40 pts for model count
            var eloScore = (labMaxElo[k] || 0) / 50;                     // 0-30 pts for top ELO
            var bmScore = (labAvgBm[k] || 0) * 0.3;                      // 0-30 pts for avg benchmarks
            labScores[k] = modelScore + eloScore + bmScore;
        });

        var labKeys = Object.keys(labModelCounts).sort(function(a, b) { return labScores[b] - labScores[a]; });
        if (labKeys.length === 0) return;

        // ─── Variable orbit radii: top labs close to ASI, small labs far away ───
        var innerR = 400;                                          // closest to black hole
        var outerR = Math.max(2500, labKeys.length * 60);         // farthest
        var maxScore = labScores[labKeys[0]] || 1;
        var minScore = labScores[labKeys[labKeys.length - 1]] || 0;
        var scoreRange = Math.max(maxScore - minScore, 1);

        // Camera based on outer radius
        this.camera.position.set(0, outerR * 0.6, outerR * 1.0);
        this.controls.maxDistance = outerR * 3;

        // Golden angle (137.508°) for angular spread — avoids clumping
        var goldenAngle = 2.399963;

        this.nebulae = labKeys.map(function(key, i) {
            // Map score to orbit radius: high score = small radius (close to ASI)
            var t = (labScores[key] - minScore) / scoreRange;  // 0 (worst) to 1 (best)
            var orbitR = outerR - t * (outerR - innerR);       // invert: best → innerR, worst → outerR
            // Add slight jitter so same-tier labs don't overlap
            orbitR += (Math.sin(i * 7.3) * 0.08 * orbitR);

            // Golden angle spiral for angular placement
            var a = i * goldenAngle;

            // Slight Y variation so it's not perfectly flat
            var yOffset = (Math.sin(i * 3.7) * 40);

            return {
                key: key, lab: LABS[key], baseAngle: a, orbitR: orbitR,
                yOffset: yOffset, modelCount: labModelCounts[key],
                score: labScores[key], group: new THREE.Group()
            };
        });

        var glowTex = this.getGlowTex();
        this.nebulae.forEach(function(n) {
            n.group.position.set(
                Math.cos(n.baseAngle) * n.orbitR,
                n.yOffset,
                Math.sin(n.baseAngle) * n.orbitR
            );
            self.galaxyGroup.add(n.group);

            var cHex = self.displayHex(n.lab.color);

            // Nebula glow clouds — scale to model count
            var cloudCount = Math.min(6, 2 + Math.floor(n.modelCount / 5));
            var cloudSpread = Math.min(350, 80 + n.modelCount * 10);
            for (var v = 0; v < cloudCount; v++) {
                var cloud = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: glowTex, color: cHex,
                    transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending
                }));
                var scale = 200 + Math.random() * cloudSpread;
                cloud.scale.set(scale, scale, 1);
                cloud.position.set(
                    (Math.random()-.5) * cloudSpread * 0.6,
                    (Math.random()-.5) * cloudSpread * 0.6,
                    (Math.random()-.5) * cloudSpread * 0.6
                );
                n.group.add(cloud);
            }

            // Nebula HTML label
            var nLabel = document.createElement('div');
            nLabel.className = 'holo-neb-label';
            nLabel.innerHTML = '<span style="color:' + cHex + ';">' + n.lab.name + '</span>';
            n.htmlLabel = nLabel;
            self.labelsContainer.appendChild(nLabel);
        });

        this.buildStars();
    },

    // ═══════════════════════════════════════════════
    //   BUILD STARS — ALL models, no aggressive filter
    // ═══════════════════════════════════════════════

    buildStars() {
        var self = this;
        // Remove old stars
        this.nebulae.forEach(function(n) {
            var toRemove = [];
            n.group.children.forEach(function(c) {
                if (c.userData && (c.userData.isStar || c.userData.isTether)) toRemove.push(c);
            });
            toRemove.forEach(function(c) { n.group.remove(c); });
        });
        this.meshToStarMap.clear();
        this.stars = [];
        document.querySelectorAll('.holo-star-label').forEach(function(el) { el.remove(); });

        var allModels = G.models || [];
        if (allModels.length === 0) return;

        // Include ALL models that have a lab with a nebula
        var nebKeySet = {};
        this.nebulae.forEach(function(n) { nebKeySet[n.key] = true; });
        var visibleModels = allModels.filter(function(m) { return m.lab && nebKeySet[m.lab]; });

        // Find frontier per lab
        var labFrontiers = {};
        this.nebulae.forEach(function(n) {
            var labModels = visibleModels.filter(function(m) { return m.lab === n.key; });
            var frontier = null, maxScore = -1;
            labModels.forEach(function(m) {
                var stg = self.getStageForModel(m);
                var isActive = stg !== 'retired';
                var elo = (BM[m.id] && BM[m.id].ELO) ? BM[m.id].ELO : 0;
                var bm = avgBM(m.id) || 0;
                var score = (isActive ? 1000 : 0) + elo + bm;
                if (score > maxScore) { maxScore = score; frontier = m; }
            });
            labFrontiers[n.key] = frontier;
        });

        // Shared geometry
        var geo = new THREE.SphereGeometry(1, 16, 16);
        var glowTex = this.getGlowTex();
        var labPlaceIdx = {};

        visibleModels.forEach(function(m, mi) {
            var neb = self.nebulae.find(function(n) { return n.key === m.lab; });
            if (!neb) return;

            var isFrontier = labFrontiers[m.lab] && labFrontiers[m.lab].id === m.id;
            var mag = self.getMagnitude(m);
            var stg = self.getStageForModel(m);
            var retired = stg === 'retired';

            // Golden-angle spiral layout
            var orbitR = 0;
            if (!isFrontier) {
                if (!labPlaceIdx[m.lab]) labPlaceIdx[m.lab] = 0;
                labPlaceIdx[m.lab]++;
                var idx = labPlaceIdx[m.lab];
                orbitR = 40 + Math.sqrt(idx) * 35;
            }

            if (self.orbitAngles[m.id] === undefined) {
                var pidx = labPlaceIdx[m.lab] || 0;
                self.orbitAngles[m.id] = pidx * 2.399963; // golden angle
            }
            var orbitSpeed = retired ? 0 : (isFrontier ? 0 : (0.0008 + (m.id.length % 5) * 0.0003));
            var cHex = self.displayHex((LABS[m.lab] || { color: '#888888' }).color);
            var cInt = parseInt(cHex.replace('#',''), 16);

            // Star group
            var starGroup = new THREE.Group();
            starGroup.userData = { isStar: true };

            // Core sphere — clean solid color
            var coreMat;
            if (retired) {
                coreMat = new THREE.MeshBasicMaterial({ color: 0x667788, transparent: true, opacity: 0.35 });
            } else {
                coreMat = new THREE.MeshBasicMaterial({ color: cInt, transparent: true, opacity: 1.0 });
            }
            var core = new THREE.Mesh(geo, coreMat);
            core.scale.set(mag, mag, mag);
            starGroup.add(core);

            // Glow aura
            if (!retired) {
                var aura = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: glowTex, color: cHex,
                    transparent: true, opacity: isFrontier ? 0.6 : 0.3,
                    blending: THREE.AdditiveBlending
                }));
                var auraSize = mag * (isFrontier ? 14 : 9);
                aura.scale.set(auraSize, auraSize, 1);
                starGroup.add(aura);
            }

            // Tether lines (only for smaller labs)
            var line = null;
            if (!isFrontier && !retired && neb.modelCount < 30) {
                var lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
                line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: cHex, transparent: true, opacity: 0.1 }));
                line.userData = { isTether: true, starTarget: starGroup };
                neb.group.add(line);
            }

            // HTML label — ONLY for frontier models (perf: 700+ DOM labels kills fps)
            var labelDiv = null;
            if (isFrontier) {
                labelDiv = document.createElement('div');
                labelDiv.className = 'holo-star-label';
                var lblHtml = '<div class="holo-star-name" style="font-size:13px;font-weight:600;color:' + cHex + ';">' + (m.name || m.id) + '</div>';
                labelDiv.innerHTML = lblHtml;
                self.labelsContainer.appendChild(labelDiv);
            }

            // Initial position
            var a = self.orbitAngles[m.id];
            starGroup.position.set(Math.cos(a) * orbitR, Math.sin(a + mi) * 15, Math.sin(a) * orbitR);

            neb.group.add(starGroup);

            var starData = {
                m: m, neb: neb, mag: mag, retired: retired, isFrontier: isFrontier,
                orbitR: orbitR, orbitSpeed: orbitSpeed, color: cHex, mi: mi,
                meshGroup: starGroup, htmlLabel: labelDiv, tetherMesh: line
            };
            self.stars.push(starData);
            self.meshToStarMap.set(core.uuid, starData);
            if (!retired && starGroup.children[1]) {
                self.meshToStarMap.set(starGroup.children[1].uuid, starData);
            }
        });
    },

    // ═══════════════════════════════════════════════
    //   INPUT
    // ═══════════════════════════════════════════════

    setupInput() {
        var self = this;
        var cv = this.canvas;

        var updateRaycaster = function(clientX, clientY) {
            if (!self.active) return;
            self.mouse.x = (clientX / self.W) * 2 - 1;
            self.mouse.y = -(clientY / self.H) * 2 + 1;
            self.raycaster.setFromCamera(self.mouse, self.camera);

            var interactables = [];
            self.stars.forEach(function(s) { s.meshGroup.children.forEach(function(c) { interactables.push(c); }); });

            var intersects = self.raycaster.intersectObjects(interactables);
            if (intersects.length > 0) {
                var prevHoverId = self.hover ? self.hover.m.id : null;
                self.hover = self.meshToStarMap.get(intersects[0].object.uuid);
                cv.style.cursor = 'pointer';
                // Sound: soft blip on new hover target
                if (self.hover && self.hover.m.id !== prevHoverId && typeof SND !== 'undefined') {
                    SND.playTone(1200 + self.hover.mag * 40, 'sine', 0.06, 0.02);
                }
                if (self.hover && self.tooltip) {
                    var m = self.hover.m;
                    var lab = LABS[m.lab] || { name: '?' };
                    var bm = avgBM(m.id);
                    var elo = (BM[m.id] && BM[m.id].ELO) ? BM[m.id].ELO : null;
                    var stg = self.getStageForModel(m);
                    var ttH = '<div class="htt-name" style="color:' + self.hover.color + '">' + (m.name || m.id) + '</div>';
                    ttH += '<div class="htt-lab" style="color:' + self.hover.color + '">' + lab.name + '</div>';
                    ttH += '<div class="htt-stat"><span>' + (STAGES[stg] ? STAGES[stg].label : stg) + '</span>';
                    if (elo) ttH += ' · <span style="color:#4ade80">ELO ' + elo + '</span>';
                    if (bm) ttH += ' · <span>Avg ' + bm + '%</span>';
                    ttH += '</div>';
                    if (m.desc) ttH += '<div class="htt-desc">' + m.desc + '</div>';
                    self.tooltip.innerHTML = ttH;
                    self.tooltip.style.left = Math.min(clientX + 20, self.W - 290) + 'px';
                    self.tooltip.style.top = Math.min(clientY - 20, self.H - 120) + 'px';
                    self.tooltip.style.display = 'block';
                    self.tooltip.classList.add('on');
                }
            } else {
                self.hover = null;
                cv.style.cursor = 'default';
                if (self.tooltip) self.tooltip.classList.remove('on');
            }
        };

        window.addEventListener('mousemove', function(e) { if (self.active) updateRaycaster(e.clientX, e.clientY); });

        cv.addEventListener('click', function(e) {
            if (!self.active) return;
            if (self.hover) {
                if (typeof SND !== 'undefined') SND.uiClick();
                self.selected = self.hover; self.showStarInfo(self.hover);
            } else {
                if (self.infoPanel && self.infoPanel.classList.contains('on')) {
                    if (typeof SND !== 'undefined') SND.playTone(600, 'sine', 0.06, 0.03, 300);
                }
                if (self.infoPanel) self.infoPanel.classList.remove('on'); self.selected = null;
            }
        });

        var touchStartX = 0, touchStartY = 0;
        cv.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
        }, { passive: true });
        cv.addEventListener('touchend', function(e) {
            if (!self.active || e.changedTouches.length !== 1) return;
            var dx = Math.abs(e.changedTouches[0].clientX - touchStartX);
            var dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
            if (dx < 10 && dy < 10) {
                updateRaycaster(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
                if (self.hover) {
                    if (typeof SND !== 'undefined') SND.uiClick();
                    self.selected = self.hover; self.showStarInfo(self.hover); if (self.tooltip) self.tooltip.classList.remove('on');
                }
                else {
                    if (self.infoPanel && self.infoPanel.classList.contains('on') && typeof SND !== 'undefined') SND.playTone(600, 'sine', 0.06, 0.03, 300);
                    if (self.infoPanel) self.infoPanel.classList.remove('on'); self.selected = null;
                }
            }
        });
    },

    // ═══════════════════════════════════════════════
    //   STAR INFO PANEL
    // ═══════════════════════════════════════════════

    showStarInfo: function(s) {
        if (!this.infoPanel || !s) return;
        // Sound: panel slide-in (ascending digital chime)
        if (typeof SND !== 'undefined') {
            SND.playTone(500, 'sine', 0.12, 0.04, 1000);
            setTimeout(function() { SND.playTone(750, 'triangle', 0.08, 0.03, 1500); }, 60);
        }
        var m = s.m, lab = LABS[m.lab] || { name:'?', color:'#888' };
        var bm = BM[m.id] || {}, stg = this.getStageForModel(m);
        var avg = avgBM(m.id), cHex = this.displayHex(lab.color);

        var h = '<button class="holo-panel-x" onclick="Holomap.closeInfo()">✕</button>';
        h += '<div class="holo-panel-top"><div class="holo-panel-name" style="color:'+cHex+'">'+(m.name||m.id)+'</div>';
        h += '<div class="holo-panel-lab" style="color:'+cHex+'cc">'+lab.name+'</div>';
        if (s.isFrontier && !s.retired) h += '<div class="holo-panel-badge">★ FRONTIER</div>';
        h += '</div>';
        h += '<div class="holo-panel-desc">'+(m.desc||m.personality||'No description.')+'</div>';

        h += '<div class="holo-panel-stats">';
        h += '<div class="holo-stat"><span class="holo-stat-lbl">Status</span><span class="holo-stat-val">'+(STAGES[stg]?STAGES[stg].emoji+' '+STAGES[stg].label:stg)+'</span></div>';
        if (bm.ELO) h += '<div class="holo-stat"><span class="holo-stat-lbl">ELO</span><span class="holo-stat-val" style="color:#4ade80">'+bm.ELO+'</span></div>';
        if (avg) h += '<div class="holo-stat"><span class="holo-stat-lbl">Avg Benchmark</span><span class="holo-stat-val" style="color:'+(avg>80?'#4ade80':avg>50?'#facc15':'#f87171')+'">'+avg+'%</span></div>';
        var relDate = m.rel || m.released;
        if (relDate) h += '<div class="holo-stat"><span class="holo-stat-lbl">Released</span><span class="holo-stat-val">'+relDate+'</span></div>';

        var bmKeys = ['MMLU','HumanEval','MATH','GPQA','ARC','MGSM'];
        if (bmKeys.some(function(k){ return bm[k] !== undefined; })) {
            h += '<div class="holo-bm-section">';
            bmKeys.forEach(function(k) {
                var v = bm[k]; if (v === undefined) return;
                var meta = BM_M[k] || { l: k, c: '#888' };
                h += '<div class="holo-bm-row"><span class="holo-bm-lbl">'+meta.l+'</span>';
                h += '<div class="holo-bm-bar"><div class="holo-bm-fill" style="width:'+v+'%;background:'+meta.c+'"></div></div>';
                h += '<span class="holo-bm-val">'+v+'</span></div>';
            });
            h += '</div>';
        }

        var cost = COSTS[m.id];
        if (cost) {
            h += '<div class="holo-panel-cost">';
            if (cost.input) h += '<span>Input: $'+cost.input+'/1M</span>';
            if (cost.output) h += '<span>Output: $'+cost.output+'/1M</span>';
            h += '</div>';
        }
        h += '</div>';
        h += '<div class="holo-panel-actions"><button class="holo-action-btn" onclick="Holomap.zoomToStar(\''+m.id+'\')">🔭 Focus</button>';
        h += '<button class="holo-action-btn" onclick="Holomap.closeInfo()">Close</button></div>';

        this.infoPanel.innerHTML = h;
        this.infoPanel.classList.add('on');
    },

    closeInfo: function() {
        if (typeof SND !== 'undefined') SND.playTone(800, 'sine', 0.08, 0.03, 400);
        if (this.infoPanel) this.infoPanel.classList.remove('on'); this.selected = null;
    },

    zoomToStar: function(id) {
        var target = this.stars.find(function(s) { return s.m.id === id; });
        if (target) {
            // Sound: focus zoom (scanning sweep)
            if (typeof SND !== 'undefined') {
                SND.playTone(300, 'triangle', 0.3, 0.04, 900);
                setTimeout(function() { SND.playTone(600, 'sine', 0.2, 0.03, 1200); }, 100);
            }
            var p = new THREE.Vector3();
            target.meshGroup.getWorldPosition(p);
            this.controls.target.copy(p);
            this.camera.position.set(p.x, p.y + 400, p.z + 400);
        }
    },

    // ═══════════════════════════════════════════════
    //   ANIMATION LOOP
    // ═══════════════════════════════════════════════

    loop: function() {
        if (!this.active) return;
        var self = this;
        this.tick++;

        // 1. Nebulae orbit ASI (inner labs orbit faster)
        this.nebulae.forEach(function(n) {
            var speed = 0.0004 * (1200 / Math.max(n.orbitR, 400)); // Kepler-ish: closer = faster
            var ca = n.baseAngle + (self.tick * speed);
            n.group.position.x = Math.cos(ca) * n.orbitR;
            n.group.position.y = n.yOffset || 0;
            n.group.position.z = Math.sin(ca) * n.orbitR;
        });

        // 2. ASI ring wobble
        if (this.asiGroup) {
            this.asiGroup.children.forEach(function(c, i) {
                if (i > 1) { c.rotation.x = Math.PI/2 + Math.sin(self.tick*0.01+i)*0.2; c.rotation.z += 0.01*(i%2===0?1:-1); }
            });
        }

        // 3. Stars orbit their nebulae
        this.stars.forEach(function(s) {
            if (s.orbitSpeed === 0) return;
            var oa = self.orbitAngles[s.m.id] || 0;
            oa += s.orbitSpeed;
            self.orbitAngles[s.m.id] = oa;
            s.meshGroup.position.set(Math.cos(oa)*s.orbitR, Math.sin(oa+s.mi)*15, Math.sin(oa)*s.orbitR);
        });

        // 4. Tether lines (every 3rd frame)
        if (this.tick % 3 === 0) {
            this.nebulae.forEach(function(n) {
                n.group.children.forEach(function(c) {
                    if (c.userData && c.userData.isTether) {
                        c.geometry.setFromPoints([new THREE.Vector3(), c.userData.starTarget.position]);
                    }
                });
            });
        }

        // 5. Hover/select highlighting
        if (this.hover || this.selected) {
            this.stars.forEach(function(s) {
                var isSel = self.selected && self.selected.m.id === s.m.id;
                var isHov = self.hover && self.hover.m.id === s.m.id;
                if (s.meshGroup.children[1] && !s.retired) {
                    s.meshGroup.children[1].material.opacity = (isSel||isHov) ? 1.0 : (s.isFrontier ? 0.9 : 0.55);
                    s.meshGroup.children[1].scale.setScalar(s.mag * (isSel ? 25 : isHov ? 20 : (s.isFrontier ? 16 : 10)));
                }
            });
        }

        // 6. HTML Projections
        var tempV = new THREE.Vector3();

        // ASI label
        if (this.asiGroup && this.asiHtmlLabel) {
            this.asiGroup.getWorldPosition(tempV); tempV.project(this.camera);
            if (tempV.z < 1) {
                this.asiHtmlLabel.style.display = 'block';
                this.asiHtmlLabel.style.left = ((tempV.x*.5+.5)*this.W)+'px';
                this.asiHtmlLabel.style.top = ((tempV.y*-.5+.5)*this.H)+'px';
            } else this.asiHtmlLabel.style.display = 'none';
        }

        // Barriers
        this.barrierLabels.forEach(function(b) {
            var angle = (self.tick*0.004) + (b.idx*(Math.PI*2/self.barrierLabels.length));
            tempV.set(Math.cos(angle)*240, 0, Math.sin(angle)*240);
            if (self.asiGroup) tempV.applyMatrix4(self.asiGroup.matrixWorld);
            tempV.project(self.camera);
            if (tempV.z < 1) {
                b.dom.style.display = 'block';
                b.dom.style.left = ((tempV.x*.5+.5)*self.W)+'px';
                b.dom.style.top = ((tempV.y*-.5+.5)*self.H)+'px';
                b.dom.style.opacity = Math.max(0.1, Math.abs(Math.sin(angle*2)));
            } else b.dom.style.display = 'none';
        });

        // Frontier labels
        this.stars.forEach(function(s) {
            if (!s.htmlLabel) return;
            s.meshGroup.getWorldPosition(tempV); tempV.project(self.camera);
            if (tempV.z > 1) { s.htmlLabel.style.display = 'none'; return; }
            s.htmlLabel.style.display = 'block';
            s.htmlLabel.style.left = ((tempV.x*.5+.5)*self.W)+'px';
            s.htmlLabel.style.top = ((tempV.y*-.5+.5)*self.H - 25)+'px';
        });

        // Nebula labels
        this.nebulae.forEach(function(n) {
            n.group.getWorldPosition(tempV); tempV.project(self.camera);
            if (tempV.z > 1) { n.htmlLabel.style.display = 'none'; return; }
            n.htmlLabel.style.display = 'block';
            n.htmlLabel.style.left = ((tempV.x*.5+.5)*self.W)+'px';
            n.htmlLabel.style.top = ((tempV.y*-.5+.5)*self.H - 60)+'px';
        });

        // 7. HUD (throttled)
        if (this.tick % 30 === 0) {
            var hudInfo = document.getElementById('holoHudInfo');
            if (hudInfo) {
                var alive = this.stars.filter(function(s){ return !s.retired; }).length;
                var dist = this.camera.position.distanceTo(this.controls.target);
                hudInfo.innerHTML = '<span>'+this.stars.length+' Models</span><span style="color:#4ade80">'+alive+' Active</span><span>'+this.nebulae.length+' Nebulae</span><span style="opacity:.5">Zoom '+(2500/dist).toFixed(1)+'x</span>';
            }
        }

        // 8. Render
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.animId = requestAnimationFrame(function() { self.loop(); });
    }
};
