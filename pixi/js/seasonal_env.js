/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SEASONAL ENVIRONMENT (v2.0.0)
   Visual overlays for seasonal events — snow on roofs, fairy lights, jack-o-lanterns, fireworks,
   regional festivals: Diwali diyas, Holi colors, Ramadan crescents, Balinese penjor, and more.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SeasonalEnv = {

    fxLayer: null,
    bldLayer: null,
    _overlayGfx: null,       // persistent Graphics for building overlays
    _fireworks: [],           // active firework particles
    _fairyLights: [],         // fairy light positions for twinkle
    _diyas: [],               // Diwali diya flame positions for flicker
    _floatingLanterns: [],    // Mid-Autumn / Obon floating lanterns
    _waterDrops: [],          // Songkran water splash particles
    _lastEvent: null,         // cache to avoid rebuilding every frame
    _builtForTick: -9999,

    init(layers) {
        this.bldLayer = layers.bldLayer;
        this.fxLayer = layers.fxGfx;
        this._ensureGfx();
    },

    /* ─── Ensure overlay Graphics exists (it gets destroyed by buildBuildings) ─── */
    _ensureGfx() {
        if (!this._overlayGfx || this._overlayGfx.destroyed) {
            this._overlayGfx = new PIXI.Graphics();
            this._overlayGfx.zIndex = 9999;
        }
        // Parent the overlay to the top-level world container, placed AFTER groundGfx
        // so Easter eggs and the bunny render on top of the ground and building trees
        // (the bldLayer is drawn BEFORE groundGfx, so overlays there get covered).
        const world = (typeof G !== 'undefined') ? G.world : null;
        if (world && this._overlayGfx.parent !== world) {
            world.addChild(this._overlayGfx);
        } else if (world) {
            // Re-add to move to top of child list
            world.addChild(this._overlayGfx);
        } else if (this.bldLayer && !this._overlayGfx.parent) {
            this.bldLayer.addChild(this._overlayGfx);
        }
    },

    /* ─── BUILD OVERLAYS ON BUILDINGS ─── */
    buildOverlays() {
        if (typeof Seasonal === 'undefined') return;
        this._ensureGfx();
        const evts = Seasonal.getActiveEvents();
        const evtIds = evts.map(e => e.id).join(',');
        if (evtIds === this._lastEvent) return; // don't rebuild if same events
        this._lastEvent = evtIds;

        this._overlayGfx.clear();
        this._fairyLights = [];
        this._diyas = [];
        this._floatingLanterns = [];
        if (evts.length === 0) return;
        if (!window.BLDS) return;

        const gy = G.groundY;
        const isWinter    = evts.some(e => e.id === 'winter_holiday');
        const isHalloween = evts.some(e => e.id === 'halloween');
        const isEaster    = evts.some(e => e.id === 'easter');
        const isLunar     = evts.some(e => e.id === 'lunar_new_year');
        const isDiwali    = evts.some(e => e.id === 'diwali');
        const isHoli      = evts.some(e => e.id === 'holi');
        const isRamadan   = evts.some(e => e.id === 'ramadan');
        const isEidFitr   = evts.some(e => e.id === 'eid_fitr');
        const isEidAdha   = evts.some(e => e.id === 'eid_adha');
        const isNyepi     = evts.some(e => e.id === 'nyepi');
        const isGalungan  = evts.some(e => e.id === 'galungan');
        const isMidAutumn = evts.some(e => e.id === 'mid_autumn');
        const isObon      = evts.some(e => e.id === 'obon');
        const isSongkran  = evts.some(e => e.id === 'songkran');
        const isDiaMuertos = evts.some(e => e.id === 'dia_muertos');
        const isHanukkah  = evts.some(e => e.id === 'hanukkah');
        const g = this._overlayGfx;

        BLDS.forEach(b => {
            if (!b.x || !b.w || !b.fl) return;
            if (b.id === 'forest_0' || b.id === 'forest_1' || b.id === 'forest_space') return;
            if (b.id.startsWith('port_') || b.type === 'launchpad') return;

            const bx = b.x, bw = b.w, flH = b.fl * 18 + 24;
            const roofY = gy - flH;

            /* ── WINTER: Snow caps + fairy lights ── */
            if (isWinter) {
                g.beginFill(0xffffff, 0.85);
                g.drawRoundedRect(bx - 2, roofY - 4, bw + 4, 6, 3);
                g.endFill();
                for (let ix = bx + 8; ix < bx + bw - 5; ix += 12 + Math.floor(Math.random() * 8)) {
                    const iH = 4 + Math.floor(Math.random() * 6);
                    g.beginFill(0xd4eeff, 0.7);
                    g.moveTo(ix, roofY + 2); g.lineTo(ix + 2, roofY + 2); g.lineTo(ix + 1, roofY + 2 + iH); g.closePath();
                    g.endFill();
                }
                for (let lx = bx + 5; lx < bx + bw - 5; lx += 10) {
                    const colors = [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff];
                    const col = colors[Math.floor(Math.random() * colors.length)];
                    this._fairyLights.push({ x: lx, y: roofY + 1, color: col, phase: Math.random() * Math.PI * 2 });
                }
            }

            /* ── HALLOWEEN: Jack-o-lanterns beside doors ── */
            if (isHalloween) {
                const px = bx + bw * 0.15 + Math.random() * bw * 0.2;
                g.beginFill(0xff8c00);
                g.drawEllipse(px, gy - 5, 5, 4);
                g.endFill();
                g.beginFill(0x2d5016);
                g.drawRect(px - 1, gy - 10, 2, 3);
                g.endFill();
                g.beginFill(0xffcc00, 0.9);
                g.drawRect(px - 3, gy - 7, 2, 2);
                g.drawRect(px + 1, gy - 7, 2, 2);
                g.drawRect(px - 2, gy - 4, 4, 1);
                g.endFill();
            }

            /* ── LUNAR NEW YEAR: Red lanterns ── */
            if (isLunar) {
                const lnx = bx + bw * 0.5;
                g.lineStyle(1, 0x888888, 0.5);
                g.moveTo(lnx, roofY); g.lineTo(lnx, roofY + 10);
                g.lineStyle(0);
                g.beginFill(0xee2222, 0.9);
                g.drawEllipse(lnx, roofY + 15, 5, 6);
                g.endFill();
                g.beginFill(0xffcc00, 0.8);
                g.drawRect(lnx - 3, roofY + 10, 6, 2);
                g.drawRect(lnx - 3, roofY + 19, 6, 2);
                g.endFill();
                g.lineStyle(1, 0xffcc00, 0.6);
                g.moveTo(lnx, roofY + 21); g.lineTo(lnx, roofY + 26);
                g.lineStyle(0);
            }

            /* ── DIWALI: Diyas (oil lamps) along roofline + rangoli at entrance ── */
            if (isDiwali) {
                // Diyas along roofline
                for (let dx = bx + 6; dx < bx + bw - 6; dx += 14) {
                    // Clay lamp base
                    g.beginFill(0xcc6633);
                    g.moveTo(dx - 3, roofY + 2); g.lineTo(dx + 3, roofY + 2);
                    g.lineTo(dx + 2, roofY - 1); g.lineTo(dx - 2, roofY - 1);
                    g.closePath();
                    g.endFill();
                    // Oil
                    g.beginFill(0xdaa520, 0.6);
                    g.drawRect(dx - 2, roofY - 1, 4, 1);
                    g.endFill();
                    this._diyas.push({ x: dx, y: roofY - 3, phase: Math.random() * Math.PI * 2 });
                }
                // Rangoli pattern at building entrance
                const rx = bx + bw * 0.5, ry = gy - 2;
                const rangColors = [0xff1493, 0xff8c00, 0x00bfff, 0x32cd32, 0xffdd44, 0xc71585];
                for (let ri = 0; ri < 8; ri++) {
                    const angle = (Math.PI * 2 / 8) * ri;
                    const col = rangColors[ri % rangColors.length];
                    // Petal
                    g.beginFill(col, 0.8);
                    g.drawEllipse(rx + Math.cos(angle) * 5, ry + Math.sin(angle) * 3, 2.5, 1.5);
                    g.endFill();
                }
                // Center dot
                g.beginFill(0xffdd44);
                g.drawCircle(rx, ry, 1.5);
                g.endFill();
            }

            /* ── HOLI: Colorful splashes / powder marks on building walls ── */
            if (isHoli) {
                const holiColors = [0xff1493, 0xff4500, 0xffdd00, 0x00dd00, 0x6600ff, 0x00bfff, 0xff69b4];
                // Splashes on facade
                for (let si = 0; si < 5; si++) {
                    const sx = bx + 8 + Math.random() * (bw - 16);
                    const sy = roofY + 8 + Math.random() * (flH - 10);
                    const col = holiColors[Math.floor(Math.random() * holiColors.length)];
                    const r = 3 + Math.random() * 4;
                    g.beginFill(col, 0.5);
                    g.drawEllipse(sx, sy, r, r * 0.7);
                    g.endFill();
                    // Drip
                    g.beginFill(col, 0.35);
                    g.drawEllipse(sx, sy + r + 2, r * 0.3, r * 0.6);
                    g.endFill();
                }
                // Powder poof at ground level
                const px = bx + bw * 0.3 + Math.random() * bw * 0.4;
                const pcol = holiColors[Math.floor(Math.random() * holiColors.length)];
                g.beginFill(pcol, 0.3);
                g.drawEllipse(px, gy - 3, 8, 4);
                g.endFill();
            }

            /* ── RAMADAN / EID: Crescent moon & star lanterns ── */
            if (isRamadan || isEidFitr || isEidAdha) {
                const lnx = bx + bw * 0.5;
                // String
                g.lineStyle(1, 0x888888, 0.4);
                g.moveTo(lnx, roofY); g.lineTo(lnx, roofY + 8);
                g.lineStyle(0);
                // Ornate lantern body (fanous shape)
                g.beginFill(0xffd700, 0.85);
                g.drawRect(lnx - 3, roofY + 8, 6, 2);  // top cap
                g.endFill();
                g.beginFill(0x228b22, 0.8);
                g.moveTo(lnx - 4, roofY + 10); g.lineTo(lnx + 4, roofY + 10);
                g.lineTo(lnx + 3, roofY + 22); g.lineTo(lnx - 3, roofY + 22);
                g.closePath();
                g.endFill();
                // Inner glow
                g.beginFill(0xffee88, 0.4);
                g.drawRect(lnx - 2, roofY + 12, 4, 8);
                g.endFill();
                // Bottom cap + tassel
                g.beginFill(0xffd700, 0.85);
                g.drawRect(lnx - 3, roofY + 22, 6, 2);
                g.endFill();
                g.lineStyle(1, 0xffd700, 0.5);
                g.moveTo(lnx, roofY + 24); g.lineTo(lnx, roofY + 28);
                g.lineStyle(0);
                // Crescent + star at ground level (for Eid, or if Ramadan)
                if (isEidFitr || isEidAdha) {
                    const cx = bx + bw * 0.8, cy = gy - 6;
                    // Crescent
                    g.beginFill(0xffd700, 0.9);
                    g.drawCircle(cx, cy, 4);
                    g.endFill();
                    g.beginFill(0x1a1a2e);
                    g.drawCircle(cx + 2, cy - 1, 3.5);
                    g.endFill();
                    // Star
                    g.beginFill(0xffd700, 0.9);
                    this._drawStar(g, cx + 6, cy - 2, 1.5, 5);
                    g.endFill();
                }
            }

            /* ── NYEPI: Dark/muted tones, candles, ogoh-ogoh shadow ── */
            if (isNyepi) {
                // Dim overlay on building (day of silence — subdued feel)
                g.beginFill(0x1a1a2e, 0.25);
                g.drawRect(bx, roofY, bw, flH + 10);
                g.endFill();
                // Single candle at entrance
                const cx = bx + bw * 0.5;
                g.beginFill(0xfaf0e6);
                g.drawRect(cx - 1, gy - 8, 2, 6); // candle
                g.endFill();
                this._diyas.push({ x: cx, y: gy - 10, phase: Math.random() * Math.PI * 2 });
            }

            /* ── GALUNGAN / KUNINGAN: Penjor poles (tall curved bamboo) ── */
            if (isGalungan) {
                const px = bx + bw + 3; // right side of building
                // Bamboo pole (tall, slightly curved)
                g.lineStyle(2, 0x8b7d3c);
                g.moveTo(px, gy);
                g.bezierCurveTo(px, gy - 30, px - 2, gy - 50, px - 8, gy - 60);
                g.lineStyle(0);
                // Decorative hanging — woven coconut leaf (janur)
                g.beginFill(0xdaa520, 0.7);
                g.drawEllipse(px - 10, gy - 55, 3, 6);
                g.endFill();
                // Offerings hanging from tip
                for (let oi = 0; oi < 3; oi++) {
                    const ox = px - 9 - oi * 3, oy = gy - 48 + oi * 6;
                    g.lineStyle(0.5, 0x8b7d3c, 0.5);
                    g.moveTo(px - 8 + oi, gy - 55 + oi * 3); g.lineTo(ox, oy);
                    g.lineStyle(0);
                    g.beginFill(0xffd700, 0.7);
                    g.drawCircle(ox, oy, 2);
                    g.endFill();
                }
                // Small offering (canang sari) at base
                g.beginFill(0x228b22, 0.6);
                g.drawRect(px - 5, gy - 3, 6, 2);
                g.endFill();
                g.beginFill(0xff69b4, 0.8);
                g.drawCircle(px - 3, gy - 4, 1);
                g.drawCircle(px, gy - 4, 1);
                g.endFill();
                g.beginFill(0xffdd44, 0.8);
                g.drawCircle(px - 1.5, gy - 5, 0.8);
                g.endFill();
            }

            /* ── MID-AUTUMN FESTIVAL: Paper lanterns hanging from roofline ── */
            if (isMidAutumn) {
                const lanternColors = [0xff4444, 0xff8800, 0xffcc00, 0xff6666];
                for (let li = 0; li < 2; li++) {
                    const lx = bx + bw * (0.3 + li * 0.4);
                    const col = lanternColors[Math.floor(Math.random() * lanternColors.length)];
                    // String
                    g.lineStyle(0.8, 0x888888, 0.4);
                    g.moveTo(lx, roofY); g.lineTo(lx, roofY + 7);
                    g.lineStyle(0);
                    // Round lantern body
                    g.beginFill(col, 0.85);
                    g.drawEllipse(lx, roofY + 13, 4, 5);
                    g.endFill();
                    // Horizontal ribs
                    g.lineStyle(0.5, 0x000000, 0.15);
                    g.moveTo(lx - 4, roofY + 12); g.lineTo(lx + 4, roofY + 12);
                    g.moveTo(lx - 4, roofY + 14); g.lineTo(lx + 4, roofY + 14);
                    g.lineStyle(0);
                    // Inner glow
                    g.beginFill(0xffee88, 0.3);
                    g.drawEllipse(lx, roofY + 13, 2, 3);
                    g.endFill();
                    this._floatingLanterns.push({ x: lx, y: roofY + 13, color: col, phase: Math.random() * Math.PI * 2 });
                }
            }

            /* ── OBON: Chochin paper lanterns ── */
            if (isObon) {
                const lx = bx + bw * 0.5;
                // Hanging string
                g.lineStyle(0.8, 0x444444, 0.5);
                g.moveTo(lx, roofY); g.lineTo(lx, roofY + 6);
                g.lineStyle(0);
                // Chochin body (white with red band)
                g.beginFill(0xfff5ee, 0.9);
                g.drawEllipse(lx, roofY + 12, 4, 5);
                g.endFill();
                g.beginFill(0xcc3333, 0.7);
                g.drawRect(lx - 4, roofY + 11, 8, 2);
                g.endFill();
                // Top/bottom rims
                g.beginFill(0x222222, 0.6);
                g.drawRect(lx - 2, roofY + 7, 4, 1);
                g.drawRect(lx - 2, roofY + 17, 4, 1);
                g.endFill();
                this._floatingLanterns.push({ x: lx, y: roofY + 12, color: 0xffddaa, phase: Math.random() * Math.PI * 2 });
            }

            /* ── SONGKRAN: Water splashes on buildings ── */
            if (isSongkran) {
                const splashColors = [0x4fc3f7, 0x29b6f6, 0x81d4fa, 0x039be5];
                for (let si = 0; si < 4; si++) {
                    const sx = bx + 8 + Math.random() * (bw - 16);
                    const sy = roofY + 10 + Math.random() * (flH - 8);
                    const col = splashColors[Math.floor(Math.random() * splashColors.length)];
                    // Water splash mark
                    g.beginFill(col, 0.35);
                    g.drawEllipse(sx, sy, 4 + Math.random() * 3, 3 + Math.random() * 2);
                    g.endFill();
                    // Drip
                    g.beginFill(col, 0.25);
                    g.drawEllipse(sx, sy + 4, 1, 2.5);
                    g.endFill();
                }
                // Puddle at base
                g.beginFill(0x4fc3f7, 0.2);
                g.drawEllipse(bx + bw * 0.5, gy - 1, bw * 0.3, 2);
                g.endFill();
            }

            /* ── DIA DE LOS MUERTOS: Marigold garlands + sugar skull ── */
            if (isDiaMuertos) {
                // Marigold garland draping from roof
                const marigold = 0xff8c00;
                for (let fi = 0; fi < Math.floor(bw / 12); fi++) {
                    const fx = bx + 6 + fi * 12;
                    const fy = roofY + 3 + Math.sin(fi * 1.2) * 2;
                    g.beginFill(marigold, 0.85);
                    g.drawCircle(fx, fy, 2.5);
                    g.endFill();
                    g.beginFill(0xffaa33, 0.6);
                    g.drawCircle(fx, fy, 1.2);
                    g.endFill();
                }
                // String connecting them
                g.lineStyle(0.8, 0x228b22, 0.4);
                g.moveTo(bx + 4, roofY + 3); g.lineTo(bx + bw - 4, roofY + 3);
                g.lineStyle(0);
                // Small sugar skull at entrance
                const sx = bx + bw * 0.2, sy = gy - 5;
                g.beginFill(0xffffff);
                g.drawEllipse(sx, sy, 4, 5);
                g.endFill();
                // Eye sockets
                g.beginFill(0x222222);
                g.drawCircle(sx - 1.5, sy - 1, 1.2);
                g.drawCircle(sx + 1.5, sy - 1, 1.2);
                g.endFill();
                // Flower in eyes
                g.beginFill(0xff1493, 0.8);
                g.drawCircle(sx - 1.5, sy - 1, 0.6);
                g.drawCircle(sx + 1.5, sy - 1, 0.6);
                g.endFill();
                // Nose
                g.beginFill(0x222222);
                g.drawEllipse(sx, sy + 0.5, 0.6, 0.8);
                g.endFill();
                // Grin
                g.lineStyle(0.8, 0x222222);
                g.moveTo(sx - 2, sy + 2.5); g.lineTo(sx + 2, sy + 2.5);
                for (let ti = -1.5; ti <= 1.5; ti += 1) {
                    g.moveTo(sx + ti, sy + 2); g.lineTo(sx + ti, sy + 3);
                }
                g.lineStyle(0);
                // Flower crown
                const crownColors = [0xff1493, 0xff8c00, 0xff4500, 0xffdd00];
                for (let ci = 0; ci < 5; ci++) {
                    const ca = (Math.PI / 5) * ci + Math.PI;
                    g.beginFill(crownColors[ci % crownColors.length], 0.9);
                    g.drawCircle(sx + Math.cos(ca) * 3.5, sy - 3.5 + Math.sin(ca) * 1.5, 1.5);
                    g.endFill();
                }
            }

            /* ── HANUKKAH: Menorah on windowsill ── */
            if (isHanukkah) {
                const mx = bx + bw * 0.5, my = roofY + Math.min(flH * 0.4, 20);
                // Base
                g.beginFill(0xdaa520, 0.9);
                g.drawRect(mx - 8, my + 2, 16, 2);
                g.drawRect(mx - 1, my - 2, 2, 4);
                g.endFill();
                // 9 branches
                for (let bi = -4; bi <= 4; bi++) {
                    const bxp = mx + bi * 2;
                    const bh = bi === 0 ? 10 : 7; // shamash is taller
                    g.beginFill(0xdaa520, 0.8);
                    g.drawRect(bxp - 0.5, my - bh, 1, bh);
                    g.endFill();
                    // Candle
                    g.beginFill(0x4488cc, 0.9);
                    g.drawRect(bxp - 1, my - bh - 4, 2, 4);
                    g.endFill();
                    // Flame
                    this._diyas.push({ x: bxp, y: my - bh - 6, phase: Math.random() * Math.PI * 2 });
                }
            }
        });

        /* ─── EASTER: scatter eggs, bunnies, and pastel bunting across social spots ─── */
        if (isEaster) this._buildEasterOverlays(g, gy);

        /* ─── NYEPI: Ogoh-ogoh statue in Pine Reserve ─── */
        if (isNyepi) this._buildOgohOgoh(g, gy);

        /* ─── DIA DE LOS MUERTOS: Ofrenda altar at open_square ─── */
        if (isDiaMuertos) this._buildOfrenda(g, gy);
    },

    /* ─── OGOH-OGOH (Nyepi demon statue) in Pine Reserve ─── */
    _buildOgohOgoh(g, gy) {
        const forest = (G.bldById && G.bldById['forest_0']) || BLDS.find(x => x.id === 'forest_0');
        if (!forest || !forest.x) return;
        const ox = forest.x + forest.w * 0.6, oy = gy;

        // Carrying platform (wooden base)
        g.beginFill(0x8b4513, 0.8);
        g.drawRect(ox - 12, oy - 4, 24, 4);
        g.endFill();
        g.beginFill(0xa0522d, 0.6);
        g.drawRect(ox - 14, oy - 5, 28, 2);
        g.endFill();

        // Body (dark, imposing)
        g.beginFill(0x2d1b0e);
        g.drawEllipse(ox, oy - 14, 8, 10);
        g.endFill();

        // Head
        g.beginFill(0x3d2b1e);
        g.drawCircle(ox, oy - 26, 6);
        g.endFill();

        // Wild hair/headdress
        g.beginFill(0x1a0f00);
        for (let hi = -4; hi <= 4; hi += 2) {
            g.drawEllipse(ox + hi, oy - 33, 2, 4);
        }
        g.endFill();

        // Fierce eyes (red)
        g.beginFill(0xff2200);
        g.drawEllipse(ox - 3, oy - 27, 1.8, 1.2);
        g.drawEllipse(ox + 3, oy - 27, 1.8, 1.2);
        g.endFill();

        // Fangs
        g.beginFill(0xffffff);
        g.moveTo(ox - 2, oy - 23); g.lineTo(ox - 1, oy - 20); g.lineTo(ox, oy - 23); g.closePath();
        g.moveTo(ox + 1, oy - 23); g.lineTo(ox + 2, oy - 20); g.lineTo(ox + 3, oy - 23); g.closePath();
        g.endFill();

        // Arms outstretched
        g.beginFill(0x2d1b0e);
        g.drawRoundedRect(ox - 18, oy - 18, 10, 4, 2);
        g.drawRoundedRect(ox + 8, oy - 18, 10, 4, 2);
        g.endFill();

        // Claws
        g.beginFill(0x1a0f00);
        for (let ci = 0; ci < 3; ci++) {
            g.drawRect(ox - 19 + ci * 2, oy - 19, 1, 3);
            g.drawRect(ox + 17 + ci * 2, oy - 19, 1, 3);
        }
        g.endFill();

        // Ornamental sash (gold + red)
        g.beginFill(0xffd700, 0.7);
        g.drawRect(ox - 6, oy - 12, 12, 2);
        g.endFill();
        g.beginFill(0xcc2222, 0.6);
        g.drawRect(ox - 4, oy - 10, 8, 2);
        g.endFill();
    },

    /* ─── OFRENDA (Día de los Muertos altar) at open_square ─── */
    _buildOfrenda(g, gy) {
        const square = (G.bldById && G.bldById['open_square']) || BLDS.find(x => x.id === 'open_square');
        if (!square || !square.x) return;
        const ax = square.x + square.w * 0.5, ay = gy;

        // Table / altar base (2 tiers)
        g.beginFill(0x8b4513);
        g.drawRect(ax - 14, ay - 6, 28, 6);    // bottom tier
        g.endFill();
        g.beginFill(0xa0522d);
        g.drawRect(ax - 10, ay - 14, 20, 8);   // top tier
        g.endFill();

        // Papel picado banner (cut paper)
        const picadoColors = [0xff69b4, 0x9b59b6, 0xff8c00, 0x00bcd4, 0xffdd00];
        for (let pi = 0; pi < 7; pi++) {
            const px = ax - 12 + pi * 4;
            const col = picadoColors[pi % picadoColors.length];
            g.beginFill(col, 0.8);
            g.drawRect(px, ay - 20, 3, 4);
            g.endFill();
            // Cut-out triangles
            g.beginFill(0x000000, 0.0);
            g.drawRect(px + 0.5, ay - 18, 1, 1);
            g.endFill();
        }
        // String
        g.lineStyle(0.8, 0x888888, 0.5);
        g.moveTo(ax - 14, ay - 20); g.lineTo(ax + 14, ay - 20);
        g.lineStyle(0);

        // Candles on altar
        for (const cx of [ax - 7, ax + 7]) {
            g.beginFill(0xfaf0e6);
            g.drawRect(cx - 1, ay - 18, 2, 4);
            g.endFill();
            this._diyas.push({ x: cx, y: ay - 20, phase: Math.random() * Math.PI * 2 });
        }

        // Marigold pile
        g.beginFill(0xff8c00, 0.9);
        g.drawEllipse(ax, ay - 10, 6, 2);
        g.endFill();
        g.beginFill(0xffaa33, 0.7);
        g.drawEllipse(ax, ay - 10, 3, 1);
        g.endFill();

        // Sugar skull on top tier
        g.beginFill(0xffffff);
        g.drawEllipse(ax, ay - 16, 2.5, 3);
        g.endFill();
        g.beginFill(0x222222);
        g.drawCircle(ax - 1, ay - 16.5, 0.7);
        g.drawCircle(ax + 1, ay - 16.5, 0.7);
        g.endFill();
    },

    _buildEasterOverlays(g, gy) {
        const eggColors = [0xff6b9d, 0x7dd3fc, 0xa5f3c0, 0xfde68a, 0xc4b5fd, 0xfb923c];
        const socialIds = ['forest_0', 'cafe', 'open_square', 'gym', 'arena', 'convention_center', 'bld_1'];
        const spots = socialIds
            .map(id => (G.bldById && G.bldById[id]) || BLDS.find(x => x.id === id))
            .filter(b => b && b.x && b.w);
        if (spots.length === 0) return;

        spots.forEach(b => {
            const eggCount = 10 + Math.floor(Math.random() * 5);
            for (let ei = 0; ei < eggCount; ei++) {
                const ex = b.x + 6 + (ei / eggCount) * (b.w - 12) + (Math.random() - 0.5) * 8;
                const ey = gy - 3 - Math.floor(Math.random() * 4);
                const col = eggColors[Math.floor(Math.random() * eggColors.length)];
                g.beginFill(0x000000, 0.25);
                g.drawEllipse(ex, ey + 4, 4, 1.2);
                g.endFill();
                g.beginFill(col);
                g.drawEllipse(ex, ey, 4, 5);
                g.endFill();
                g.beginFill(0xffffff, 0.5);
                g.drawEllipse(ex - 1, ey - 2, 1.2, 1.8);
                g.endFill();
                const pattern = ei % 3;
                if (pattern === 0) {
                    g.beginFill(0xffffff, 0.7);
                    g.drawRect(ex - 3, ey - 1, 6, 1);
                    g.drawRect(ex - 3, ey + 1, 6, 1);
                    g.endFill();
                } else if (pattern === 1) {
                    g.beginFill(0xffffff, 0.6);
                    g.drawCircle(ex - 1, ey, 0.8);
                    g.drawCircle(ex + 1, ey + 1, 0.8);
                    g.endFill();
                }
            }
        });

        // Easter Bunny on Pine Reserve
        const forest = (G.bldById && G.bldById['forest_0']) || BLDS.find(x => x.id === 'forest_0');
        if (forest && forest.x) {
            const bx = forest.x + forest.w * 0.35;
            const by = gy - 5;
            g.beginFill(0xfafafa);
            g.drawEllipse(bx, by, 7, 5);
            g.endFill();
            g.beginFill(0xfafafa);
            g.drawCircle(bx + 6, by - 3, 3.5);
            g.endFill();
            g.beginFill(0xfafafa);
            g.drawRoundedRect(bx + 3, by - 13, 1.8, 8, 0.8);
            g.drawRoundedRect(bx + 6, by - 13, 1.8, 8, 0.8);
            g.endFill();
            g.beginFill(0xff9ab5);
            g.drawRect(bx + 3.5, by - 11, 0.8, 5);
            g.drawRect(bx + 6.5, by - 11, 0.8, 5);
            g.endFill();
            g.beginFill(0x2c1810);
            g.drawCircle(bx + 7, by - 3, 0.7);
            g.endFill();
            g.beginFill(0xff6b9d);
            g.drawCircle(bx + 8.5, by - 2, 0.8);
            g.endFill();
            g.beginFill(0xffffff);
            g.drawCircle(bx - 6, by - 1, 1.8);
            g.endFill();
            const kx = bx + 14, ky = by;
            g.beginFill(0x8b4513);
            g.drawRoundedRect(kx - 4, ky - 2, 8, 5, 1);
            g.endFill();
            g.lineStyle(0.5, 0x5c2d0c);
            g.moveTo(kx - 4, ky - 2); g.lineTo(kx + 4, ky - 2);
            g.lineStyle(0);
            g.lineStyle(1, 0x8b4513);
            g.moveTo(kx - 3, ky - 2); g.bezierCurveTo(kx - 3, ky - 8, kx + 3, ky - 8, kx + 3, ky - 2);
            g.lineStyle(0);
            g.beginFill(0xff6b9d); g.drawEllipse(kx - 2, ky - 2, 1.3, 1.8); g.endFill();
            g.beginFill(0x7dd3fc); g.drawEllipse(kx,     ky - 3, 1.3, 1.8); g.endFill();
            g.beginFill(0xfde68a); g.drawEllipse(kx + 2, ky - 2, 1.3, 1.8); g.endFill();
        }

        // Pastel egg bunting
        const sortedByX = spots.slice().sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedByX.length - 1; i++) {
            const a = sortedByX[i], c = sortedByX[i + 1];
            const gap = c.x - (a.x + a.w);
            if (gap < 20 || gap > 500) continue;
            const startX = a.x + a.w;
            const endX = c.x;
            const anchorY = gy - Math.max((a.fl || 1), (c.fl || 1)) * 22 - 28;
            const flagCount = Math.floor((endX - startX) / 18);
            for (let fi = 0; fi < flagCount; fi++) {
                const t = fi / Math.max(1, flagCount - 1);
                const fx = startX + t * (endX - startX);
                const droop = Math.sin(t * Math.PI) * 12;
                const fy = anchorY + droop;
                const col = eggColors[fi % eggColors.length];
                g.beginFill(col, 0.95);
                g.drawEllipse(fx, fy, 3, 4);
                g.endFill();
                g.beginFill(0xffffff, 0.5);
                g.drawCircle(fx - 0.8, fy - 1.2, 0.8);
                g.endFill();
                if (fi < flagCount - 1) {
                    const nt = (fi + 1) / Math.max(1, flagCount - 1);
                    const nfx = startX + nt * (endX - startX);
                    const nfy = anchorY + Math.sin(nt * Math.PI) * 12;
                    g.lineStyle(0.8, 0xa0a0a0, 0.6);
                    g.moveTo(fx, fy - 4); g.lineTo(nfx, nfy - 4);
                    g.lineStyle(0);
                }
            }
        }
    },

    /* ─── HELPER: draw a 5-pointed star ─── */
    _drawStar(g, cx, cy, r, points) {
        points = points || 5;
        const inner = r * 0.4;
        for (let i = 0; i < points * 2; i++) {
            const angle = (Math.PI * 2 / (points * 2)) * i - Math.PI / 2;
            const rad = i % 2 === 0 ? r : inner;
            const px = cx + Math.cos(angle) * rad;
            const py = cy + Math.sin(angle) * rad;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
        g.closePath();
    },

    /* ─── PER-FRAME UPDATE ─── */
    update() {
        if (typeof Seasonal === 'undefined') return;
        const evts = Seasonal.getActiveEvents();
        if (evts.length === 0) return;

        // Recreate overlay if destroyed by buildBuildings(), and rebuild content
        if (!this._overlayGfx || this._overlayGfx.destroyed) {
            this._lastEvent = null;  // force rebuild
            this.buildOverlays();
        }

        // Rebuild overlays periodically (in case buildings moved or events changed)
        if (G.tick % 300 === 0) this.buildOverlays();

        // Twinkle fairy lights
        this._fairyLights.forEach(fl => {
            const alpha = 0.3 + Math.abs(Math.sin(G.tick * 0.08 + fl.phase)) * 0.7;
            this.fxLayer.beginFill(fl.color, alpha);
            this.fxLayer.drawCircle(fl.x, fl.y, 1.5);
            this.fxLayer.endFill();
        });

        // Flicker diya / candle flames
        this._diyas.forEach(d => {
            const flicker = 0.5 + Math.abs(Math.sin(G.tick * 0.12 + d.phase)) * 0.5;
            const sway = Math.sin(G.tick * 0.06 + d.phase) * 0.5;
            // Outer glow
            this.fxLayer.beginFill(0xff8800, flicker * 0.3);
            this.fxLayer.drawCircle(d.x + sway, d.y, 4);
            this.fxLayer.endFill();
            // Flame core
            this.fxLayer.beginFill(0xffdd44, flicker * 0.9);
            this.fxLayer.drawEllipse(d.x + sway, d.y, 1.2, 2);
            this.fxLayer.endFill();
            // Bright tip
            this.fxLayer.beginFill(0xffffff, flicker * 0.6);
            this.fxLayer.drawCircle(d.x + sway, d.y - 1, 0.6);
            this.fxLayer.endFill();
        });

        // Floating lantern glow (Mid-Autumn / Obon)
        this._floatingLanterns.forEach(l => {
            const pulse = 0.3 + Math.abs(Math.sin(G.tick * 0.04 + l.phase)) * 0.4;
            this.fxLayer.beginFill(0xffee88, pulse);
            this.fxLayer.drawCircle(l.x, l.y, 3);
            this.fxLayer.endFill();
        });

        // Songkran: animated water drops
        if (evts.some(e => e.id === 'songkran')) {
            this._updateWaterDrops();
        }

        // Fireworks
        if (Seasonal.hasFireworks()) {
            this._updateFireworks();
        }
    },

    /* ─── SONGKRAN WATER DROP PARTICLES ─── */
    _updateWaterDrops() {
        // Spawn new drops periodically
        if (G.tick % 20 === 0 && this._waterDrops.length < 40) {
            const x = Math.random() * G.cityW;
            const colors = [0x4fc3f7, 0x29b6f6, 0x81d4fa];
            this._waterDrops.push({
                x: x, y: 10 + Math.random() * 20,
                vx: (Math.random() - 0.5) * 2,
                vy: 1 + Math.random() * 2,
                life: 60 + Math.floor(Math.random() * 40),
                maxLife: 100,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 1 + Math.random() * 2
            });
        }
        for (let i = this._waterDrops.length - 1; i >= 0; i--) {
            const p = this._waterDrops[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life--;
            const alpha = Math.max(0, p.life / p.maxLife) * 0.6;
            if (p.life <= 0 || p.y > G.groundY) {
                // Splash on landing
                if (p.y >= G.groundY) {
                    this.fxLayer.beginFill(p.color, 0.3);
                    this.fxLayer.drawEllipse(p.x, G.groundY - 1, p.size * 2, 1);
                    this.fxLayer.endFill();
                }
                this._waterDrops.splice(i, 1);
            } else {
                this.fxLayer.beginFill(p.color, alpha);
                this.fxLayer.drawEllipse(p.x, p.y, p.size * 0.6, p.size);
                this.fxLayer.endFill();
            }
        }
    },

    /* ─── FIREWORKS SYSTEM ─── */
    _updateFireworks() {
        if (G.tick % 40 === 0 && this._fireworks.length < 80) {
            const cx = Math.random() * G.cityW;
            const cy = 20 + Math.random() * (G.vpH * 0.3);
            const burstColors = [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff, 0x44ffff, 0xffffff];
            const col = burstColors[Math.floor(Math.random() * burstColors.length)];
            const count = 12 + Math.floor(Math.random() * 7);
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
                const speed = 1.5 + Math.random() * 2;
                this._fireworks.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 60 + Math.floor(Math.random() * 40),
                    maxLife: 100,
                    color: col,
                    size: 1.5 + Math.random()
                });
            }
        }

        for (let i = this._fireworks.length - 1; i >= 0; i--) {
            const p = this._fireworks[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.03;
            p.vx *= 0.98;
            p.life--;
            const alpha = Math.max(0, p.life / p.maxLife);

            if (p.life <= 0) {
                this._fireworks.splice(i, 1);
            } else {
                this.fxLayer.beginFill(p.color, alpha);
                this.fxLayer.drawCircle(p.x, p.y, p.size * alpha);
                this.fxLayer.endFill();
            }
        }
    }
};
