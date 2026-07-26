/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   VC ROW ENVIRONMENT (v1.3.0)
   Money particles and market arrows. Tickers now handled by environment.js (same as HQ tickers).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const VCRowEnv = {
    _built: false,
    moneyParts: [],
    arrowGfx: null,
    _arrowTimer: 0,

    buildAnimations(charLayer) {
        if (this._built || typeof VCRow === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── MONEY PARTICLES (floating coins/bills during business hours) ───
        VCRow.BLDS.forEach(def => {
            const bld = G.bldById[def.id];
            if (!bld) return;
            const bldH = (bld.fl || 3) * 18 + 24;
            for (let p = 0; p < 3; p++) {
                const g = new PIXI.Graphics();
                const isGold = Math.random() > 0.5;
                g.beginFill(isGold ? 0xfbbf24 : 0x4ade80, 0.7);
                if (isGold) {
                    g.drawCircle(0, 0, 2);
                } else {
                    g.drawRect(-2, -1, 4, 2);
                }
                g.endFill();
                // Anchor to building so coins respawn over the right VC HQ even after
                // re-zoning pushes VC Row east (new labs arriving, tech district growing).
                g._bld = bld;
                g._offX = 20 + Math.random() * (bld.w - 40);
                g.x = bld.x + g._offX;
                g.y = gy - bldH - 10;
                g._startY = g.y;
                g._driftX = (Math.random() - 0.5) * 0.3;
                g._speed = 0.2 + Math.random() * 0.3;
                g._phase = Math.random() * Math.PI * 2;
                g.alpha = 0;
                charLayer.addChild(g);
                this.moneyParts.push(g);
            }
        });

        // ─── GREEN/RED MARKET ARROWS on building facades ───
        this.arrowGfx = new PIXI.Graphics();
        this.arrowGfx.zIndex = 0;
        charLayer.addChild(this.arrowGfx);

        // ─── CRYPTEX: Giant neon ₿ logo on the facade (orange glow, pulses at night) ───
        const cryptex = G.bldById['vcrow_cryptex'];
        if (cryptex) {
            const bldH = (cryptex.fl || 8) * 18 + 24;
            const logo = new PIXI.Text('₿', {
                fontFamily: 'Arial, sans-serif', fontSize: 72, fontWeight: '900',
                fill: 0xf7931a, stroke: 0xffa940, strokeThickness: 2,
                dropShadow: true, dropShadowColor: 0xf7931a, dropShadowBlur: 18, dropShadowDistance: 0
            });
            logo.anchor.set(0.5, 0.5);
            logo.x = cryptex.x + cryptex.w / 2;
            logo.y = gy - bldH / 2 - 6;
            logo.blendMode = PIXI.BLEND_MODES.ADD;
            logo._basePulse = Math.random() * Math.PI * 2;
            charLayer.addChild(logo);
            this.cryptexLogo = logo;
        }

        // ─── CRYPTO BILLBOARD: big elevated LED board in the Cryptex→Embassy gap ───
        this._buildBillboard(charLayer);
    },

    // Panel geometry (local coords; container origin sits on the ground at gap centre).
    // Sized to fit inside the ~140px Cryptex→Embassy gap without overlapping either
    // neighbour; a single slim centre pylon keeps the sidewalk footprint minimal.
    _BB: { panelW: 124, panelH: 60, poleH: 92 },

    // Build the standalone billboard structure once. Position is re-synced every frame
    // in _updateBillboard() so it tracks the gap even after the city re-zones.
    _buildBillboard(charLayer) {
        if (this.billboard) return;
        const { panelW, panelH, poleH } = this._BB;
        const topY = -(poleH + panelH);   // panel top edge, local
        const botY = -poleH;              // panel bottom edge, local

        const cont = new PIXI.Container();
        cont.zIndex = Math.round(G.groundY) - 1;   // people walk in front of the poles
        // Seed position so frame 1 looks right (update() keeps it synced thereafter).
        const cryptex = G.bldById['vcrow_cryptex'];
        const seedL = cryptex ? cryptex.x + cryptex.w : (VCRow.zoneEndX - 40);
        const seedR = (typeof EmbassyRow !== 'undefined' && EmbassyRow.zoneStartX) ? EmbassyRow.zoneStartX : (VCRow.zoneEndX + 120);
        cont.x = (seedL + seedR) / 2;
        cont.y = G.groundY;
        charLayer.addChild(cont);
        this.billboard = cont;

        // Soft night glow behind the panel (ADD; alpha driven in _updateBillboard).
        // Kept narrower than the gap half-width so the halo never bleeds onto neighbours.
        const glow = new PIXI.Graphics();
        glow.beginFill(0xf7931a, 0.5);
        glow.drawEllipse(0, topY + panelH / 2, panelW * 0.56, panelH * 0.95);
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        glow.alpha = 0;
        cont.addChild(glow);
        this.bbGlow = glow;

        // Single central monopole (small sidewalk footprint) + base plate.
        const poles = new PIXI.Graphics();
        poles.beginFill(0x2a2f3a);
        poles.drawRect(-6, botY + 2, 12, poleH - 2);
        poles.endFill();
        poles.beginFill(0x3a4150);            // subtle highlight edge down the pole
        poles.drawRect(-6, botY + 2, 3, poleH - 2);
        poles.endFill();
        poles.beginFill(0x14161c);            // base plate planted on the ground
        poles.drawRect(-13, -5, 26, 5);
        poles.endFill();
        cont.addChild(poles);

        // Panel backing + neon (bitcoin-orange) frame.
        const panel = new PIXI.Graphics();
        panel.beginFill(0x0a0a12, 0.96);
        panel.drawRoundedRect(-panelW / 2, topY, panelW, panelH, 6);
        panel.endFill();
        panel.lineStyle(2, 0xf7931a, 0.95);
        panel.drawRoundedRect(-panelW / 2, topY, panelW, panelH, 6);
        cont.addChild(panel);

        // Hover label (matches the app's tip-on-everything convention).
        panel.eventMode = 'static';
        panel.cursor = 'help';
        panel.hitArea = new PIXI.Rectangle(-panelW / 2, topY, panelW, panelH);
        panel.on('pointerover', (e) => { if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, 'Crypto Ticker', 'Live top-5 by market cap · CoinGecko'); });
        panel.on('pointerout', () => { if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip(); });

        // Header row: pulsing LIVE dot + title + divider.
        const dot = new PIXI.Graphics();
        dot.beginFill(0xff3b3b); dot.drawCircle(0, 0, 3); dot.endFill();
        dot.x = -panelW / 2 + 12; dot.y = topY + 11;
        cont.addChild(dot); this.bbDot = dot;

        const title = new PIXI.Text('LIVE · TOP 5', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fontWeight: '900',
            fill: 0xf7931a, letterSpacing: 0.5
        });
        title.anchor.set(0, 0.5);
        title.x = -panelW / 2 + 20; title.y = topY + 11;
        cont.addChild(title);

        const divider = new PIXI.Graphics();
        divider.beginFill(0xf7931a, 0.35);
        divider.drawRect(-panelW / 2 + 8, topY + 19, panelW - 16, 1);
        divider.endFill();
        cont.addChild(divider);

        // Masked marquee window. The strip holds per-coin coloured segments (built below).
        const winX = -panelW / 2 + 8, winY = topY + 23, winW = panelW - 16, winH = panelH - 29;
        const mask = new PIXI.Graphics();
        mask.beginFill(0xffffff); mask.drawRect(winX, winY, winW, winH); mask.endFill();
        cont.addChild(mask);

        const strip = new PIXI.Container();
        strip.mask = mask;
        cont.addChild(strip);
        this.bbStrip = strip;
        this.bbWin = { x: winX, y: winY, w: winW, h: winH };
        this.bbUnitW = 0;
        this.bbHasData = false;

        this._rebuildBillboardStrip();
        strip.x = winX + winW;   // start just off the right edge
    },

    // (Re)build the marquee from live top-5 data. Two identical copies are laid
    // back-to-back so the scroll loops seamlessly; prices refresh on each wrap.
    _rebuildBillboardStrip() {
        const strip = this.bbStrip;
        if (!strip || strip.destroyed) return;
        strip.removeChildren().forEach(c => c.destroy());

        const coins = (typeof VCRow !== 'undefined' && VCRow.getTopCoins) ? VCRow.getTopCoins(5) : [];
        const midY = this.bbWin.y + this.bbWin.h / 2;

        if (coins.length === 0) {
            const t = new PIXI.Text('◉ AWAITING MARKET FEED…', {
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: '700', fill: 0x888888
            });
            t.anchor.set(0, 0.5); t.x = 0; t.y = midY;
            strip.addChild(t);
            this.bbUnitW = t.width + 40;
            this.bbHasData = false;
            return;
        }
        this.bbHasData = true;

        const buildSet = (offsetX) => {
            let x = offsetX;
            coins.forEach(c => {
                const up = c.change >= 0;
                const sym = c.symbol.toUpperCase();
                const price = c.price >= 1000 ? c.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
                            : c.price >= 1    ? c.price.toFixed(2)
                            :                   c.price.toFixed(4);
                const chg = (up ? '+' : '') + c.change.toFixed(2) + '%';
                const col = up ? 0x4ade80 : 0xf87171;
                const seg = new PIXI.Text(`${up ? '▲' : '▼'} ${sym}  $${price}  ${chg}`, {
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: '900',
                    fill: col, dropShadow: true, dropShadowColor: col, dropShadowBlur: 6, dropShadowDistance: 0, padding: 6
                });
                seg.anchor.set(0, 0.5);
                seg.x = x; seg.y = midY;
                seg.blendMode = PIXI.BLEND_MODES.ADD;
                strip.addChild(seg);
                x += seg.width + 28;   // gap between coins
            });
            return x - offsetX;        // width of one full set incl. trailing gap
        };

        const unit = buildSet(0);
        this.bbUnitW = unit;
        buildSet(unit);                // second copy, seamless loop
    },

    // Per-frame billboard update: re-anchor to the gap, scroll the marquee, pulse lights.
    // Runs 24/7 (crypto never sleeps) — kept out of the business-hours arrow block below.
    _updateBillboard(dp) {
        if (!this.billboard || this.billboard.destroyed) return;

        const cryptex = G.bldById['vcrow_cryptex'];
        if (cryptex) {
            const leftEdge = cryptex.x + cryptex.w;
            const rightEdge = (typeof EmbassyRow !== 'undefined' && EmbassyRow.zoneStartX)
                ? EmbassyRow.zoneStartX : (VCRow.zoneEndX + 120);
            this.billboard.x = (leftEdge + rightEdge) / 2;
            this.billboard.y = G.groundY;
        }

        const strip = this.bbStrip, win = this.bbWin;
        if (strip && !strip.destroyed && win && this.bbUnitW > 0) {
            strip.x -= 0.65;
            if (this.bbHasData) {
                if (strip.x <= win.x - this.bbUnitW) {
                    strip.x += this.bbUnitW;        // seamless wrap (shift by old unit)
                    this._rebuildBillboardStrip();  // then refresh prices for the next lap
                }
            } else {
                // Awaiting data — retry the build until coins arrive, then relaunch.
                if (G.tick % 60 === 0) {
                    this._rebuildBillboardStrip();
                    if (this.bbHasData) strip.x = win.x + win.w;
                }
                if (strip.x + this.bbUnitW < win.x) strip.x = win.x + win.w;
            }
        }

        if (this.bbDot && !this.bbDot.destroyed) {
            this.bbDot.alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(G.tick * 0.12));
        }
        if (this.bbGlow && !this.bbGlow.destroyed) {
            const isNight = dp < 0.25 || dp > 0.83;
            this.bbGlow.alpha = (isNight ? 0.5 : 0.14) * (0.82 + 0.18 * Math.sin(G.tick * 0.04));
        }
    },

    update() {
        if (!this._built || typeof VCRow === 'undefined') return;
        const dp = G.getDayPhase();
        const isBusinessHours = dp >= 0.33 && dp < 0.75;

        // ─── MONEY PARTICLES (float upward, reset — x re-anchors to live building on respawn) ───
        this.moneyParts.forEach(p => {
            if (!p || p.destroyed) return;
            if (!isBusinessHours) { p.alpha = 0; return; }
            p.y -= p._speed;
            p.x += p._driftX + Math.sin(G.tick * 0.05 + p._phase) * 0.15;
            p.alpha = Math.min(0.7, p.alpha + 0.01);
            p.rotation += 0.02;
            if (p.y < p._startY - 80) {
                p.y = p._startY;
                // Re-anchor to current building x (handles re-zoning)
                if (p._bld) p.x = p._bld.x + p._offX;
                p.alpha = 0;
                p._driftX = (Math.random() - 0.5) * 0.3;
            }
        });

        // ─── CRYPTEX LOGO PULSE (brighter at night, gentle throb always) ───
        // Re-sync x/y every frame so the logo tracks the Cryptex building even if
        // the city re-zones later (new labs pushing VC Row rightward, etc.). Using
        // absolute world coords set at buildAnimations time caused the logo to land
        // on whatever building happened to occupy the stale x after re-zoning.
        if (this.cryptexLogo && !this.cryptexLogo.destroyed) {
            const cryptex = G.bldById['vcrow_cryptex'];
            if (cryptex) {
                const bldH = (cryptex.fl || 8) * 18 + 24;
                this.cryptexLogo.x = cryptex.x + cryptex.w / 2;
                this.cryptexLogo.y = G.groundY - bldH / 2 - 6;
            }
            const isNight = dp < 0.25 || dp > 0.83;
            const throb = 0.85 + Math.sin(G.tick * 0.05 + this.cryptexLogo._basePulse) * 0.15;
            this.cryptexLogo.alpha = (isNight ? 1.0 : 0.65) * throb;
        }

        // ─── CRYPTO BILLBOARD (24/7 — scrolls + glows regardless of business hours) ───
        this._updateBillboard(dp);

        // ─── MARKET ARROWS (redraw every 120 frames) ───
        this._arrowTimer++;
        if (this._arrowTimer % 120 === 0 && this.arrowGfx && !this.arrowGfx.destroyed) {
            this.arrowGfx.clear();
            if (!isBusinessHours) return;
            const gy = G.groundY;

            VCRow.BLDS.forEach(def => {
                const bld = G.bldById[def.id];
                if (!bld) return;
                const bldH = (bld.fl || 3) * 18 + 24;
                const isUp = Math.random() > 0.35;
                const color = isUp ? 0x4ade80 : 0xef4444;
                const ax = bld.x + bld.w - 18;
                const ay = gy - bldH + 10;

                this.arrowGfx.beginFill(color, 0.6);
                if (isUp) {
                    this.arrowGfx.moveTo(ax, ay + 8);
                    this.arrowGfx.lineTo(ax + 5, ay);
                    this.arrowGfx.lineTo(ax + 10, ay + 8);
                } else {
                    this.arrowGfx.moveTo(ax, ay);
                    this.arrowGfx.lineTo(ax + 5, ay + 8);
                    this.arrowGfx.lineTo(ax + 10, ay);
                }
                this.arrowGfx.closePath();
                this.arrowGfx.endFill();

                this.arrowGfx.beginFill(color, 0.5);
                this.arrowGfx.drawRect(ax - 2, ay + (isUp ? 10 : -6), 14, 6);
                this.arrowGfx.endFill();
            });
        }
    }
};
