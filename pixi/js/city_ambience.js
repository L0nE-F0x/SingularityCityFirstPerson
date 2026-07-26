/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CITY AMBIENCE (v1.1.0 — Atmosphere Pass)
   Time-of-day color grading, night street lighting,
   street furniture (lamps, benches, hydrants, crosswalks, manholes + steam),
   and micro-vignettes (window cleaner, radar sweeps, seasonal biome particles).
   NOTE: parallax background skylines were tried in v515 and removed by design
   decision in v516 — do not re-add them.

   Design constraints honored:
   - Buildings are cacheAsBitmap → all life happens in layers AROUND them.
   - Labs/zones re-position on re-zoning → static layers rebuild when G.cityW changes,
     animated objects re-anchor to live building refs every frame.
   - Everything is deterministic-seeded so the city doesn't reshuffle between rebuilds.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CityAmbience = {
    _built: false,
    _builtCityW: 0,

    // Layers / objects
    furnGfx: null,          // static street furniture (one Graphics)
    glowLayer: null,        // additive night glow pools (container alpha = nightness)
    trafficA: null,         // traffic-light state A (NS green)
    trafficB: null,         // traffic-light state B (NS red)
    gradeFilter: null,

    steamVents: [],         // manhole steam spawn points
    steamParts: [],
    cleaner: null,          // window-washer vignette state
    sweeps: [],             // rotating radar sweeps
    leaves: [], fireflies: [], butterflies: [],
    _bioRanges: [],         // forest/park x-ranges for biome particles

    // Deterministic noise (same trick as Environment._labNoise)
    _noise(seed) {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    },

    // Smooth 0..1 "how night is it" — drives lamp glow, steam, fireflies
    _nightness(dp) {
        if (dp >= 0.86 || dp < 0.20) return 1;
        if (dp >= 0.80) return (dp - 0.80) / 0.06;       // dusk ramp-up
        if (dp < 0.28) return 1 - (dp - 0.20) / 0.08;    // dawn ramp-down
        return 0;
    },

    // Real lunar phase 0..1 (0 = new, 0.5 = full) from the synodic month.
    // Epoch: new moon 2000-01-06 18:14 UTC. Accuracy mandate: even the sky is real.
    getMoonPhase(date) {
        const SYNODIC = 29.530588853 * 86400000;
        const epoch = 947182440000;
        const t = (date ? date.getTime() : Date.now()) - epoch;
        return ((t % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC;
    },

    init() {
        if (this._built || typeof G === 'undefined' || !G.world) return;
        this._built = true;
        this._buildGrading();
        this._buildStatics();
        this._buildVignettes();
    },

    // ═══════════════════════════════════════════════
    //   STATIC LAYERS (rebuilt when the city re-zones)
    // ═══════════════════════════════════════════════
    _buildStatics() {
        this._builtCityW = G.cityW;
        this._buildFurniture();
    },

    _rebuildStaticsIfRezoned() {
        if (G.cityW !== this._builtCityW) this._buildStatics();
    },

    // ─── 2. TIME-OF-DAY COLOR GRADING ───
    // One core-PIXI ColorMatrixFilter on the world, lerped through keyframes.
    // Subtle on purpose — the DOM sky already shifts hue; this makes the CITY follow it.
    GRADE_KEYS: [
        // [dayPhase, r, g, b]
        [0.00, 0.80, 0.88, 1.10],   // deep night — cool blue
        [0.20, 0.82, 0.88, 1.08],   // late night
        [0.26, 1.10, 0.94, 0.88],   // sunrise — warm gold
        [0.34, 1.02, 1.00, 0.98],   // morning
        [0.55, 1.00, 1.00, 1.00],   // noon — neutral
        [0.72, 1.04, 0.99, 0.94],   // afternoon
        [0.79, 1.16, 0.94, 0.84],   // golden hour — amber
        [0.86, 0.86, 0.88, 1.06],   // dusk fades to cool
        [1.00, 0.80, 0.88, 1.10],   // wraps to night
    ],

    _buildGrading() {
        if (this.gradeFilter || typeof PIXI === 'undefined') return;
        this.gradeFilter = new PIXI.ColorMatrixFilter();
        const existing = G.world.filters || [];
        G.world.filters = [...existing, this.gradeFilter];
    },

    _applyGrading(dp) {
        const keys = this.GRADE_KEYS;
        let i = 0;
        while (i < keys.length - 1 && keys[i + 1][0] < dp) i++;
        const a = keys[i], b2 = keys[Math.min(i + 1, keys.length - 1)];
        const span = Math.max(0.0001, b2[0] - a[0]);
        const t = Math.max(0, Math.min(1, (dp - a[0]) / span));
        const r = a[1] + (b2[1] - a[1]) * t;
        const g = a[2] + (b2[2] - a[2]) * t;
        const bl = a[3] + (b2[3] - a[3]) * t;
        const m = this.gradeFilter.matrix;
        m[0] = r; m[6] = g; m[12] = bl;
    },

    // ─── 3 + 10. STREET FURNITURE & NIGHT LIGHTING ───
    // Lamps / benches / hydrants in the gaps between buildings, crosswalks at metro
    // stations, manholes along the road (venting steam at night), traffic lights.
    // Skips the Space desert and the Port ocean — those biomes own their ground.
    _buildFurniture() {
        const gy = G.groundY;
        if (!this.furnGfx) {
            this.furnGfx = new PIXI.Graphics();
            this.furnGfx.zIndex = 1;
            G.charLayer.addChild(this.furnGfx);
            this.glowLayer = new PIXI.Container();
            this.glowLayer.zIndex = 0;
            G.charLayer.addChild(this.glowLayer);
            this.trafficA = new PIXI.Graphics(); this.trafficA.zIndex = 2;
            this.trafficB = new PIXI.Graphics(); this.trafficB.zIndex = 2;
            G.charLayer.addChild(this.trafficA, this.trafficB);
        }
        const fg = this.furnGfx;
        fg.clear();
        this.glowLayer.removeChildren();
        this.trafficA.clear(); this.trafficB.clear();
        this.steamVents = [];
        this.steamParts.forEach(p => { if (p.g && !p.g.destroyed) p.g.destroy(); });
        this.steamParts = [];

        // Exclusion ranges: space desert + port ocean/quay approach
        const excl = [];
        const pads = (typeof BLDS !== 'undefined') ? BLDS.filter(b => b.type === 'launchpad') : [];
        if (pads.length) excl.push([Math.min(...pads.map(b => b.x)) - 400, Math.max(...pads.map(b => b.x + b.w)) + 400]);
        if (typeof PortZone !== 'undefined' && PortZone.oceanStartX !== undefined) excl.push([PortZone.oceanStartX - 400, PortZone.coastlineX + 40]);
        const excluded = (x) => excl.some(([a, b]) => x >= a && x <= b);

        // Building footprints (incl. forests) block placement
        const blocks = BLDS.map(b => [b.x - 14, b.x + b.w + 14]).sort((a, b) => a[0] - b[0]);
        const inBlock = (x) => blocks.some(([a, b]) => x >= a && x <= b);

        const sw = gy - 24; // sidewalk top
        let placed = 0;
        for (let x = 120; x < G.cityW - 80; x += 90) {
            const jitter = (this._noise(x) - 0.5) * 40;
            const px = x + jitter;
            if (excluded(px) || inBlock(px)) continue;
            const kind = Math.floor(this._noise(px * 1.7) * 10);
            if (kind < 4) {
                // ── Streetlamp ──
                fg.beginFill(0x2b3444); fg.drawRect(px - 1.5, sw - 34, 3, 34); fg.endFill();
                fg.beginFill(0x2b3444); fg.drawRect(px - 1.5, sw - 34, 9, 2); fg.endFill();
                fg.beginFill(0x3d4a5f); fg.drawRect(px - 3, sw - 2, 6, 2); fg.endFill();
                fg.beginFill(0x475569); fg.drawRoundedRect(px + 4, sw - 37, 7, 4, 1.5); fg.endFill();
                // Night bulb + ground pool (additive, driven by container alpha)
                const glow = new PIXI.Graphics();
                glow.beginFill(0xffd98a, 0.85); glow.drawRoundedRect(px + 4.5, sw - 36.5, 6, 3, 1.5); glow.endFill();
                glow.beginFill(0xffcf70, 0.16); glow.drawCircle(px + 7.5, sw - 34, 9); glow.endFill();
                glow.beginFill(0xffc860, 0.10); glow.drawPolygon([px + 2, sw - 33, px + 13, sw - 33, px + 20, sw, px - 5, sw]); glow.endFill();
                glow.beginFill(0xffc860, 0.13); glow.drawEllipse(px + 7.5, sw + 1, 15, 4); glow.endFill();
                glow.blendMode = PIXI.BLEND_MODES.ADD;
                this.glowLayer.addChild(glow);
            } else if (kind < 6) {
                // ── Bench ──
                fg.beginFill(0x6b4a2f); fg.drawRect(px - 8, sw - 7, 16, 2.5); fg.endFill();
                fg.beginFill(0x5a3d26); fg.drawRect(px - 8, sw - 12, 16, 2); fg.endFill();
                fg.beginFill(0x2b3444); fg.drawRect(px - 7, sw - 5, 2, 5); fg.drawRect(px + 5, sw - 5, 2, 5); fg.endFill();
            } else if (kind < 7) {
                // ── Hydrant ──
                fg.beginFill(0xb91c1c); fg.drawRoundedRect(px - 2.5, sw - 8, 5, 8, 2); fg.endFill();
                fg.beginFill(0xdc2626); fg.drawCircle(px, sw - 9, 2); fg.endFill();
                fg.beginFill(0x991b1b); fg.drawRect(px - 4, sw - 6, 8, 1.5); fg.endFill();
            } else if (kind < 8 && placed % 3 === 0) {
                // ── Traffic light (animated via A/B overlays) ──
                fg.beginFill(0x1f2733); fg.drawRect(px - 1.5, sw - 30, 3, 30); fg.endFill();
                fg.beginFill(0x141a24); fg.drawRoundedRect(px - 4, sw - 40, 8, 12, 2); fg.endFill();
                this.trafficB.beginFill(0xef4444, 0.95); this.trafficB.drawCircle(px, sw - 36.5, 1.8); this.trafficB.endFill();
                this.trafficA.beginFill(0x4ade80, 0.95); this.trafficA.drawCircle(px, sw - 31.5, 1.8); this.trafficA.endFill();
            }
            placed++;
        }

        // ── Manholes along the road (+ some vent steam at night) ──
        for (let x = 600; x < G.cityW - 200; x += 1400) {
            const px = x + (this._noise(x * 0.7) - 0.5) * 300;
            if (excluded(px)) continue;
            fg.beginFill(0x11161f); fg.drawEllipse(px, gy + 10, 7, 2.6); fg.endFill();
            fg.beginFill(0x3a4456, 0.8); fg.drawEllipse(px, gy + 9.4, 5.5, 1.8); fg.endFill();
            fg.beginFill(0x11161f, 0.6);
            fg.drawRect(px - 3.5, gy + 8.6, 7, 0.6); fg.drawRect(px - 3.5, gy + 9.8, 7, 0.6);
            fg.endFill();
            if (this._noise(px * 3.3) > 0.45) this.steamVents.push({ x: px, y: gy + 8 });
        }
        // Pre-spawn steam particle pool (animated only at night)
        this.steamVents.slice(0, 14).forEach((v, i) => {
            for (let k = 0; k < 2; k++) {
                const g = new PIXI.Graphics();
                g.beginFill(0xcfd8e3, 0.16); g.drawCircle(0, 0, 2.5 + this._noise(i * 9 + k) * 2.5); g.endFill();
                g.x = v.x; g.y = v.y; g.alpha = 0;
                g.zIndex = 2;
                G.charLayer.addChild(g);
                this.steamParts.push({ g, vent: v, life: this._noise(i * 3 + k * 7) * 80, maxLife: 90 + k * 30 });
            }
        });

        // ── Crosswalk zebra stripes at metro stations ──
        BLDS.filter(b => b.id.startsWith('metro_')).forEach(mb => {
            const cx = mb.x + mb.w / 2;
            if (excluded(cx)) return;
            fg.beginFill(0xd7dde6, 0.5);
            for (let s2 = 0; s2 < 6; s2++) fg.drawRect(cx - 21 + s2 * 7.5, gy + 2, 4.5, 26);
            fg.endFill();
        });
    },

    // ─── 11. MICRO-VIGNETTES ───
    _buildVignettes() {
        // Window-cleaner platform (one active at a time, picks a random lab HQ)
        const c = new PIXI.Container();
        c.zIndex = 3;
        const ropes = new PIXI.Graphics();
        const plat = new PIXI.Graphics();
        plat.beginFill(0x8a94a3); plat.drawRect(-14, 0, 28, 3); plat.endFill();
        plat.beginFill(0x64748b); plat.drawRect(-14, -2, 2, 2); plat.drawRect(12, -2, 2, 2); plat.endFill();
        // two tiny washers
        plat.beginFill(0x2563eb); plat.drawRect(-8, -6, 4, 6); plat.endFill();
        plat.beginFill(0xf59e0b); plat.drawRect(4, -6, 4, 6); plat.endFill();
        plat.beginFill(0xfdd8b5); plat.drawRect(-7.5, -8, 3, 2.5); plat.drawRect(4.5, -8, 3, 2.5); plat.endFill();
        c.addChild(ropes, plat);
        c.visible = false;
        G.charLayer.addChild(c);
        this.cleaner = { cont: c, ropes, bld: null, y: 0, timer: 600, state: 'idle' };

        // Radar sweeps: Port Authority mast + Backbone ground station
        this.sweeps = [];
        [['port_authority', -46, 26, 0x22d3ee], ['backbone_ground', 4, 20, 0xa855f7]].forEach(([id, dy, len, col]) => {
            const g = new PIXI.Graphics();
            g.beginFill(col, 0.28);
            g.drawPolygon([0, 0, len, -3, len, 3]);
            g.endFill();
            g.beginFill(col, 0.7); g.drawCircle(0, 0, 1.5); g.endFill();
            g.blendMode = PIXI.BLEND_MODES.ADD;
            g.zIndex = 3;
            g.visible = false;
            G.charLayer.addChild(g);
            this.sweeps.push({ g, id, dy, speed: 0.008 + this.sweeps.length * 0.004 });
        });

        // Biome particle pools (leaves / fireflies / butterflies) — activated by season/time
        this.leaves = []; this.fireflies = []; this.butterflies = [];
        for (let i = 0; i < 14; i++) {
            const g = new PIXI.Graphics();
            const col = [0xd97706, 0xb45309, 0x92400e, 0xca8a04][i % 4];
            g.beginFill(col, 0.85); g.drawRect(-1.5, -1, 3, 2); g.endFill();
            g.zIndex = 4; g.alpha = 0;
            G.charLayer.addChild(g);
            this.leaves.push({ g, p: this._noise(i * 13), sway: this._noise(i * 29) * Math.PI * 2 });
        }
        for (let i = 0; i < 10; i++) {
            const g = new PIXI.Graphics();
            g.beginFill(0xd9f99d, 0.9); g.drawCircle(0, 0, 1.1); g.endFill();
            g.blendMode = PIXI.BLEND_MODES.ADD;
            g.zIndex = 4; g.alpha = 0;
            G.charLayer.addChild(g);
            this.fireflies.push({ g, ph: this._noise(i * 7) * Math.PI * 2, ox: this._noise(i * 3), oy: this._noise(i * 5) });
        }
        for (let i = 0; i < 4; i++) {
            const cont = new PIXI.Container();
            const wing = new PIXI.Graphics();
            const col = [0xf97316, 0x38bdf8, 0xfbbf24, 0xc084fc][i];
            wing.beginFill(col, 0.9); wing.drawEllipse(-1.5, 0, 1.8, 1.2); wing.drawEllipse(1.5, 0, 1.8, 1.2); wing.endFill();
            cont.addChild(wing);
            cont.zIndex = 4; cont.alpha = 0;
            G.charLayer.addChild(cont);
            this.butterflies.push({ g: cont, wing, ph: this._noise(i * 11) * Math.PI * 2 });
        }
        this._refreshBioRanges();
    },

    _refreshBioRanges() {
        this._bioRanges = BLDS
            .filter(b => b.id === 'forest_0' || b.id === 'forest_1' || b.id === 'city_park')
            .map(b => [b.x + 20, b.x + b.w - 20]);
        if (!this._bioRanges.length) this._bioRanges = [[G.cityW * 0.4, G.cityW * 0.4 + 300]];
    },

    _bioSpot(n) {
        const r = this._bioRanges[Math.floor(n * this._bioRanges.length) % this._bioRanges.length];
        return r[0] + (n * 7919 % 1) * (r[1] - r[0]);
    },

    // ═══════════════════════════════════════════════
    //   PER-FRAME UPDATE (called on tick % 2 from engine)
    // ═══════════════════════════════════════════════
    update(dp, night) {
        if (!this._built) return;
        const tick = G.tick;
        if (tick % 120 === 0) { this._rebuildStaticsIfRezoned(); this._refreshBioRanges(); }

        const nightness = this._nightness(dp);

        // 1. Color grading (cheap matrix write, throttled)
        if (this.gradeFilter && tick % 6 === 0) this._applyGrading(dp);

        // 2. Night glow pools + traffic lights + manhole steam
        if (this.glowLayer) this.glowLayer.alpha = nightness;
        if (this.trafficA && tick % 240 === 0) {
            const phase = Math.floor(tick / 240) % 2 === 0;
            this.trafficA.visible = phase;
            this.trafficB.visible = !phase;
        }
        if (nightness > 0.05) {
            for (let i = 0; i < this.steamParts.length; i++) {
                const p = this.steamParts[i];
                if (!p.g || p.g.destroyed) continue;
                p.life += 1;
                if (p.life >= p.maxLife) { p.life = 0; p.g.y = p.vent.y; p.g.x = p.vent.x; }
                const t = p.life / p.maxLife;
                p.g.y = p.vent.y - t * 26;
                p.g.x = p.vent.x + Math.sin(tick * 0.02 + i) * 3 * t;
                p.g.scale.set(0.6 + t * 1.3);
                p.g.alpha = nightness * 0.5 * Math.sin(t * Math.PI);
            }
        } else if (this.steamParts.length && this.steamParts[0].g.alpha > 0) {
            this.steamParts.forEach(p => { if (p.g && !p.g.destroyed) p.g.alpha = 0; });
        }

        // 11a. Window-cleaner platform
        this._updateCleaner(dp);
        // 11b. Radar sweeps
        this._updateSweeps();
        // 11c. Biome particles
        this._updateBiome(dp, night, nightness, tick);
    },

    _updateCleaner(dp) {
        const cl = this.cleaner;
        if (!cl || !cl.cont || cl.cont.destroyed) return;
        const workHours = dp > 0.3 && dp < 0.72;
        if (cl.state === 'idle') {
            cl.timer--;
            if (cl.timer <= 0 && workHours) {
                // Pick a random lab HQ tall enough to be worth washing
                const hqs = BLDS.filter(b => b.lab && !b.id.startsWith('house_') && !b.id.startsWith('res_')
                    && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && (b.dynamicFl || b.fl) >= 4);
                if (hqs.length) {
                    cl.bld = hqs[Math.floor(Math.random() * hqs.length)];
                    const h = (cl.bld.dynamicFl || cl.bld.fl) * 18 + 24;
                    cl.roofY = G.groundY - 24 - h + 6;
                    cl.y = cl.roofY + 8;
                    cl.state = 'descending';
                    cl.cont.visible = true;
                }
                cl.timer = 5200 + Math.random() * 4000;
            }
            return;
        }
        if (!cl.bld || !BLDS.includes(cl.bld)) { cl.state = 'idle'; cl.cont.visible = false; return; }
        // Re-anchor to the live building (survives re-zoning) and descend slowly
        cl.cont.x = cl.bld.x + cl.bld.w * 0.72;
        cl.y += 0.045;
        cl.cont.y = cl.y;
        if (G.tick % 4 === 0) {
            cl.ropes.clear();
            cl.ropes.beginFill(0x94a3b8, 0.7);
            const ropeLen = cl.y - cl.roofY;
            cl.ropes.drawRect(-12, -ropeLen, 1, ropeLen);
            cl.ropes.drawRect(11, -ropeLen, 1, ropeLen);
            cl.ropes.endFill();
        }
        if (cl.y > G.groundY - 40) { cl.state = 'idle'; cl.cont.visible = false; }
    },

    _updateSweeps() {
        for (const s of this.sweeps) {
            if (!s.g || s.g.destroyed) continue;
            if (!s._bld || G.tick % 300 === 0) s._bld = BLDS.find(b => b.id === s.id);
            const b = s._bld;
            if (!b) { s.g.visible = false; continue; }
            const h = (b.dynamicFl || b.fl) * 18 + 24;
            s.g.visible = true;
            s.g.x = b.x + b.w / 2;
            s.g.y = G.groundY - 24 - h + s.dy;
            s.g.rotation += s.speed;
        }
    },

    _updateBiome(dp, night, nightness, tick) {
        const autumn = (typeof Environment !== 'undefined' && Environment.season === 'autumn');
        const gy = G.groundY;
        // Autumn leaves — drift down over forests/park
        for (let i = 0; i < this.leaves.length; i++) {
            const L = this.leaves[i];
            if (!L.g || L.g.destroyed) continue;
            if (!autumn) { L.g.alpha = 0; continue; }
            L.p += 0.0016 + i * 0.00004;
            if (L.p > 1) L.p -= 1;
            L.g.x = this._bioSpot(this._noise(i * 5)) + Math.sin(tick * 0.015 + L.sway) * 18 + L.p * 30;
            L.g.y = gy - 120 + L.p * 96;
            L.g.rotation = Math.sin(tick * 0.03 + L.sway) * 0.9;
            L.g.alpha = Math.sin(L.p * Math.PI) * 0.85;
        }
        // Fireflies — night blink near forests/park
        for (let i = 0; i < this.fireflies.length; i++) {
            const F = this.fireflies[i];
            if (!F.g || F.g.destroyed) continue;
            if (nightness < 0.3) { F.g.alpha = 0; continue; }
            F.g.x = this._bioSpot(F.ox) + Math.sin(tick * 0.006 + F.ph) * 26;
            F.g.y = gy - 18 - F.oy * 46 + Math.sin(tick * 0.011 + F.ph * 2) * 9;
            F.g.alpha = nightness * Math.max(0, Math.sin(tick * 0.05 + F.ph * 5)) * 0.9;
        }
        // Butterflies — daytime flutter near the park
        for (let i = 0; i < this.butterflies.length; i++) {
            const B = this.butterflies[i];
            if (!B.g || B.g.destroyed) continue;
            const daytime = dp > 0.3 && dp < 0.72;
            if (!daytime) { B.g.alpha = 0; continue; }
            B.g.x = this._bioSpot(0.9 - i * 0.13) + Math.sin(tick * 0.008 + B.ph) * 34;
            B.g.y = gy - 20 - Math.abs(Math.sin(tick * 0.013 + B.ph * 3)) * 30;
            B.wing.scale.x = 0.4 + Math.abs(Math.sin(tick * 0.32 + B.ph)) * 0.6;
            B.g.alpha = 0.9;
        }
    }
};
