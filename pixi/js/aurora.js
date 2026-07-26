/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AURORA BOREALIS & COMET EVENTS (v1.0.0)
   Rare celestial events — shimmering aurora curtains and streaking comets
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Aurora = {

    _active: false,
    _cometActive: false,
    _duration: 0,
    _elapsed: 0,
    _cometDuration: 0,
    _cometElapsed: 0,
    _nextCheck: 0,
    _ribbons: [],           // aurora ribbon definitions
    _comet: null,           // active comet object
    _gfx: null,             // dedicated PIXI.Graphics for aurora (additive blend)
    _achieved: false,

    init() {
        this._gfx = new PIXI.Graphics();
        this._gfx.blendMode = PIXI.BLEND_MODES.ADD;
        if (G.starsLayer) G.starsLayer.parent.addChild(this._gfx);
        this._nextCheck = G.tick + 600; // first check after 10 seconds
    },

    /* ─── CHECK IF WE SHOULD TRIGGER AN EVENT ─── */
    check(night) {
        if (G.tick < this._nextCheck) return;
        this._nextCheck = G.tick + 2000 + Math.floor(Math.random() * 2000); // check every 33-66 seconds

        if (!night) return;
        if (this._active || this._cometActive) return;

        // Weather must be clear or only lightly cloudy for aurora to be visible.
        const weather = (typeof Environment !== 'undefined') ? Environment.weather : 'clear';
        if (weather !== 'clear' && weather !== 'partly_cloudy') return;

        const roll = Math.random();

        // 1.5% chance aurora, 2% chance comet
        if (roll < 0.015) {
            this._triggerAurora();
        } else if (roll < 0.035) {
            this._triggerComet();
        }
    },

    _triggerAurora() {
        this._active = true;
        this._duration = 800 + Math.floor(Math.random() * 600); // 13-23 seconds
        this._elapsed = 0;

        // Generate 4-6 ribbon curves
        this._ribbons = [];
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            this._ribbons.push({
                baseY: 15 + i * 18 + Math.random() * 10,
                amplitude: 8 + Math.random() * 15,
                frequency: 0.003 + Math.random() * 0.004,
                speed: 0.015 + Math.random() * 0.02,
                phase: Math.random() * Math.PI * 2,
                width: 6 + Math.random() * 10,
                // Green-to-purple gradient
                color: [0x00ff88, 0x22ffaa, 0x44ddff, 0x8866ff, 0xaa44ff, 0x00ffcc][i % 6],
                alpha: 0.06 + Math.random() * 0.06,
            });
        }

        // Achievement
        if (!this._achieved) {
            this._achieved = true;
            if (typeof G !== 'undefined') G.unlockAchieve('stargazer');
        }

        if (typeof UI !== 'undefined') UI.addToast('✨ Aurora Borealis is lighting up the sky!');
        if (typeof SND !== 'undefined') SND.uiClick();
    },

    _triggerComet() {
        this._cometActive = true;
        this._cometDuration = 250 + Math.floor(Math.random() * 150); // 4-7 seconds
        this._cometElapsed = 0;

        // Comet travels from upper-right to lower-left (or reverse)
        const goLeft = Math.random() > 0.5;
        this._comet = {
            startX: goLeft ? G.cityW * 0.9 : G.cityW * 0.1,
            startY: 10 + Math.random() * 30,
            endX: goLeft ? G.cityW * 0.05 : G.cityW * 0.85,
            endY: 50 + Math.random() * 60,
            tailLen: 8,
            size: 2.5 + Math.random() * 1.5,
        };

        if (!this._achieved) {
            this._achieved = true;
            if (typeof G !== 'undefined') G.unlockAchieve('stargazer');
        }

        if (typeof UI !== 'undefined') UI.addToast('☄️ A comet is streaking across the sky!');
    },

    /* ─── DRAW AURORA + COMET ─── */
    draw(night) {
        if (!this._gfx) return;

        // Check for new events (throttled internally)
        this.check(night);

        if (!night) {
            if (this._active || this._cometActive) this._gfx.clear();
            this._active = false;
            this._cometActive = false;
            return;
        }

        // Throttle aurora redraw to every 3rd frame
        if (G.tick % 3 !== 0 && !this._cometActive) return;
        this._gfx.clear();

        /* ── AURORA BOREALIS ── */
        if (this._active) {
            this._elapsed += 3; // compensate for throttle
            const fadeIn = Math.min(1, this._elapsed / 120);
            const fadeOut = Math.min(1, (this._duration - this._elapsed) / 120);
            const envelope = Math.min(fadeIn, fadeOut);

            if (this._elapsed >= this._duration) {
                this._active = false;
            } else {
                const t = G.tick;
                // Camera offset so aurora stays fixed on screen
                const camOff = (typeof Camera !== 'undefined') ? -Camera.x / (Camera.zoom || 1) : 0;
                this._ribbons.forEach(r => {
                    const g = this._gfx;
                    g.beginFill(r.color, r.alpha * envelope);

                    // Draw ribbon as connected quads — use larger step for performance
                    const step = 16;
                    for (let x = 0; x < G.vpW + step; x += step) {
                        // World-space x for wave calculation (smooth continuity)
                        const wx = x + camOff;
                        const screenX = x + camOff;
                        const y1 = r.baseY + Math.sin(wx * r.frequency + t * r.speed + r.phase) * r.amplitude;
                        const y2 = y1 + r.width + Math.sin(wx * r.frequency * 1.3 + t * r.speed * 0.7) * (r.width * 0.4);
                        g.drawRect(screenX, y1, step + 1, y2 - y1);
                    }
                    g.endFill();
                });
            }
        }

        /* ── COMET ── */
        if (this._cometActive && this._comet) {
            this._cometElapsed++;
            const progress = this._cometElapsed / this._cometDuration;

            if (progress >= 1) {
                this._cometActive = false;
                this._comet = null;
            } else {
                const c = this._comet;
                const cOff = (typeof Camera !== 'undefined') ? -Camera.x / (Camera.zoom || 1) : 0;
                const cx = c.startX + (c.endX - c.startX) * progress + cOff;
                const cy = c.startY + (c.endY - c.startY) * progress;
                const g = this._gfx;

                // Tail trail (fading circles behind comet)
                for (let ti = c.tailLen; ti > 0; ti--) {
                    const tp = Math.max(0, progress - ti * 0.008);
                    const tx = c.startX + (c.endX - c.startX) * tp + cOff;
                    const ty = c.startY + (c.endY - c.startY) * tp;
                    const ta = (1 - ti / c.tailLen) * 0.4;
                    const ts = c.size * (1 - ti / c.tailLen) * 0.7;
                    g.beginFill(0xccddff, ta);
                    g.drawCircle(tx, ty, ts);
                    g.endFill();
                }

                // Comet head — bright white core
                g.beginFill(0xffffff, 0.95);
                g.drawCircle(cx, cy, c.size);
                g.endFill();
                // Warm glow
                g.beginFill(0xffeedd, 0.3);
                g.drawCircle(cx, cy, c.size * 2.5);
                g.endFill();
            }
        }
    }
};
