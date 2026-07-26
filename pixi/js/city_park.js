/* ════════��═══════════════════════════════════════════════════════════════════���═══════════════════════
   CENTRAL PARK (v1.0.0)
   Green space between AI Court and Tech District — benches, fountain, trees, jogging paths
   NPCs come here to socialize, relax, and jog during lunch and evening hours.
   ══════════════════════════════��═════════════════════════════════════════════════════════════════════ */

const CityPark = {

    BLDS: [
        { id: 'city_park', name: 'Central Park', w: 500, fl: 1, emoji: '🌳', type: 'park', desc: 'A sprawling green oasis in the heart of the city. Benches, fountains, jogging paths, and ancient oaks invite weary models to recharge.' },
    ],

    _zoneStartX: 0,
    _zoneEndX: 0,
    _fountainTick: 0,
    _joggers: [],         // animated jogger sprites
    _particles: [],       // fountain spray + leaf particles
    _birdPerches: [],     // spots where birds can land (used by bird flock system)

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    positionZone(startX) {
        let cx = startX + 60;
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 60; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    // Called from environment.js to draw the park
    drawPark(gfx, container, b, h) {
        const w = b.w;

        // ── GRASS GROUND ──
        // Main grass
        gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 14, w, 14); gfx.endFill();
        // Lighter grass stripe
        gfx.beginFill(0x3a7d5e); gfx.drawRect(0, h - 14, w, 5); gfx.endFill();
        // Grass texture dots
        for (let gx = 4; gx < w - 4; gx += 7) {
            const shade = (gx * 31) % 3 === 0 ? 0x408a63 : 0x357a56;
            gfx.beginFill(shade, 0.5);
            gfx.drawRect(gx, h - 10 + ((gx * 7) % 4), 2, 2);
            gfx.endFill();
        }

        // ── COBBLESTONE PATHS ──
        // Main horizontal path
        const pathY = h - 8;
        gfx.beginFill(0x8b8678); gfx.drawRect(20, pathY, w - 40, 5); gfx.endFill();
        for (let px = 22; px < w - 42; px += 6) {
            gfx.beginFill(0x9a9588); gfx.drawRect(px, pathY + 1, 4, 3); gfx.endFill();
        }
        // Diagonal jogging path (top-left to center)
        for (let step = 0; step < 12; step++) {
            const jx = 30 + step * 8;
            const jy = h - 30 + step * 1.5;
            gfx.beginFill(0x7a7668, 0.6); gfx.drawRect(jx, jy, 5, 3); gfx.endFill();
        }
        // Diagonal path (center to bottom-right)
        for (let step = 0; step < 12; step++) {
            const jx = w / 2 + 20 + step * 8;
            const jy = h - 22 + step * 1.2;
            gfx.beginFill(0x7a7668, 0.6); gfx.drawRect(jx, jy, 5, 3); gfx.endFill();
        }

        // ── CENTRAL FOUNTAIN ──
        const fx = w / 2;
        const fy = h - 16;
        // Basin (elliptical pool)
        gfx.beginFill(0x2a4a6a, 0.7); gfx.drawEllipse(fx, fy, 32, 8); gfx.endFill();
        gfx.beginFill(0x3a6a8a, 0.5); gfx.drawEllipse(fx, fy, 28, 6); gfx.endFill();
        // Water shimmer
        gfx.beginFill(0x60a0c8, 0.3); gfx.drawEllipse(fx - 5, fy - 1, 12, 3); gfx.endFill();
        // Pedestal
        gfx.beginFill(0x6a6a7a); gfx.drawRect(fx - 4, fy - 20, 8, 14); gfx.endFill();
        gfx.beginFill(0x7a7a8a); gfx.drawRect(fx - 6, fy - 22, 12, 4); gfx.endFill();
        // Fountain top bowl
        gfx.beginFill(0x7a7a8a); gfx.drawEllipse(fx, fy - 22, 10, 3); gfx.endFill();

        // Animated fountain spray (container for update loop)
        const sprayContainer = new PIXI.Container();
        sprayContainer.x = fx; sprayContainer.y = fy - 24;
        container.addChild(sprayContainer);
        b._sprayContainer = sprayContainer;
        b._fountainBaseY = fy;

        // ── TREES ──
        const treePositions = [
            { x: 25, type: 'oak' },
            { x: 70, type: 'maple' },
            { x: 135, type: 'oak' },
            { x: w - 130, type: 'maple' },
            { x: w - 70, type: 'oak' },
            { x: w - 25, type: 'maple' },
        ];
        b._treePositions = [];
        treePositions.forEach(t => {
            this._drawTree(gfx, t.x, h, t.type);
            b._treePositions.push({ x: t.x, y: h - 50 });
        });

        // ── BENCHES ──
        const benchPositions = [100, w / 2 - 60, w / 2 + 50, w - 100];
        benchPositions.forEach(bx => {
            // Bench legs
            gfx.beginFill(0x5c4033); gfx.drawRect(bx - 8, h - 14, 2, 6); gfx.endFill();
            gfx.beginFill(0x5c4033); gfx.drawRect(bx + 6, h - 14, 2, 6); gfx.endFill();
            // Bench seat
            gfx.beginFill(0x8b6b4a); gfx.drawRect(bx - 10, h - 16, 20, 3); gfx.endFill();
            // Bench back
            gfx.beginFill(0x7a5c3d); gfx.drawRect(bx - 9, h - 20, 18, 2); gfx.endFill();
        });

        // ── FLOWER BEDS ──
        const flowerColors = [0xff6b8a, 0xffaa44, 0xff55cc, 0xffdd44, 0xaa88ff];
        for (let fi = 0; fi < 18; fi++) {
            const ffx = 40 + fi * 25 + ((fi * 17) % 8);
            if (Math.abs(ffx - fx) < 38) continue; // skip near fountain
            const ffy = h - 12 - ((fi * 13) % 6);
            const fc = flowerColors[fi % flowerColors.length];
            gfx.beginFill(fc, 0.7); gfx.drawCircle(ffx, ffy, 2); gfx.endFill();
            gfx.beginFill(0x2d8a4f, 0.5); gfx.drawRect(ffx - 0.5, ffy + 1, 1, 3); gfx.endFill();
        }

        // ── SMALL POND (right side) ──
        const px = w - 55;
        const py = h - 12;
        gfx.beginFill(0x1a3a5a, 0.6); gfx.drawEllipse(px, py, 22, 6); gfx.endFill();
        gfx.beginFill(0x2a5a7a, 0.4); gfx.drawEllipse(px - 3, py - 1, 14, 4); gfx.endFill();
        // Cattails
        gfx.beginFill(0x4a5a3a); gfx.drawRect(px + 14, py - 16, 1, 14); gfx.endFill();
        gfx.beginFill(0x6a5a3a); gfx.drawEllipse(px + 14.5, py - 17, 2, 4); gfx.endFill();
        gfx.beginFill(0x4a5a3a); gfx.drawRect(px + 18, py - 12, 1, 10); gfx.endFill();
        gfx.beginFill(0x6a5a3a); gfx.drawEllipse(px + 18.5, py - 13, 2, 3); gfx.endFill();

        // ── LAMP POSTS ──
        const lampPositions = [55, w / 2 - 80, w / 2 + 80, w - 55];
        b._lamps = [];
        lampPositions.forEach(lx => {
            // Pole
            gfx.beginFill(0x3a3a4a); gfx.drawRect(lx - 1, h - 38, 2, 26); gfx.endFill();
            // Lamp bracket
            gfx.beginFill(0x4a4a5a); gfx.drawRect(lx - 3, h - 40, 6, 3); gfx.endFill();
            b._lamps.push({ x: lx, y: h - 42 });
        });

        // ── PICKET FENCE (entrance sides) ──
        // Left entrance gap
        for (let fenceX = 0; fenceX < 16; fenceX += 4) {
            gfx.beginFill(0xd4c9a8, 0.5); gfx.drawRect(fenceX, h - 16, 2, 6); gfx.endFill();
        }
        gfx.beginFill(0xc4b998, 0.4); gfx.drawRect(0, h - 14, 18, 1); gfx.endFill();
        // Right entrance gap
        for (let fenceX = w - 18; fenceX < w; fenceX += 4) {
            gfx.beginFill(0xd4c9a8, 0.5); gfx.drawRect(fenceX, h - 16, 2, 6); gfx.endFill();
        }
        gfx.beginFill(0xc4b998, 0.4); gfx.drawRect(w - 18, h - 14, 18, 1); gfx.endFill();

        // Store bird-perch positions for the bird flock system
        this._birdPerches = treePositions.map(t => ({
            x: t.x,
            y: h - 55,
            worldX: 0  // filled after positioning
        }));

        // Tooltip
        b.tip = `🌳 Central Park<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">A green oasis in the city center.<br>Benches • Fountain • Jogging paths<br>Open to all AI citizens.</span>`;
    },

    _drawTree(gfx, x, groundH, type) {
        if (type === 'oak') {
            // Thick trunk
            gfx.beginFill(0x5c3a1e); gfx.drawRect(x - 3, groundH - 45, 6, 33); gfx.endFill();
            // Branch stubs
            gfx.beginFill(0x4a2e16); gfx.drawRect(x - 7, groundH - 38, 5, 2); gfx.endFill();
            gfx.beginFill(0x4a2e16); gfx.drawRect(x + 3, groundH - 42, 5, 2); gfx.endFill();
            // Canopy (large, round)
            gfx.beginFill(0x1b6a35, 0.85); gfx.drawEllipse(x, groundH - 50, 18, 14); gfx.endFill();
            gfx.beginFill(0x238a42, 0.6); gfx.drawEllipse(x - 4, groundH - 52, 10, 8); gfx.endFill();
            gfx.beginFill(0x166a30, 0.5); gfx.drawEllipse(x + 5, groundH - 48, 8, 6); gfx.endFill();
        } else {
            // Maple — thinner trunk, wider crown
            gfx.beginFill(0x6a4422); gfx.drawRect(x - 2, groundH - 42, 4, 30); gfx.endFill();
            // Crown layers
            gfx.beginFill(0x1a7a38, 0.8); gfx.drawEllipse(x, groundH - 48, 16, 12); gfx.endFill();
            gfx.beginFill(0x22994a, 0.5); gfx.drawEllipse(x - 3, groundH - 52, 8, 7); gfx.endFill();
            gfx.beginFill(0x2aaa52, 0.4); gfx.drawEllipse(x + 4, groundH - 46, 7, 5); gfx.endFill();
        }
    },

    update() {
        const b = G.bldById['city_park'];
        if (!b || !b._sprayContainer) return;

        this._fountainTick++;

        // ── FOUNTAIN SPRAY ANIMATION ──
        const spray = b._sprayContainer;
        // Remove old particles
        while (spray.children.length > 12) {
            spray.removeChildAt(0);
        }
        // Add new spray droplets
        if (this._fountainTick % 3 === 0) {
            const drop = new PIXI.Graphics();
            const angle = (Math.random() - 0.5) * 1.2;
            const speed = 0.8 + Math.random() * 0.6;
            drop.beginFill(0x88ccee, 0.6 + Math.random() * 0.3);
            drop.drawCircle(0, 0, 1 + Math.random());
            drop.endFill();
            drop._vx = Math.sin(angle) * speed;
            drop._vy = -(1.5 + Math.random() * 1.5);
            drop._life = 0;
            spray.addChild(drop);
        }
        // Animate droplets
        for (let i = spray.children.length - 1; i >= 0; i--) {
            const d = spray.children[i];
            d.x += d._vx || 0;
            d.y += (d._vy || 0);
            d._vy = (d._vy || 0) + 0.12; // gravity
            d._life = (d._life || 0) + 1;
            d.alpha = Math.max(0, 1 - d._life / 20);
            if (d._life > 20) {
                spray.removeChildAt(i);
            }
        }

        // ── LAMP GLOW (night only) ──
        const dp = G.getDayPhase();
        const night = dp > 0.83 || dp < 0.25;
        if (b._lamps && b._lampGlows) {
            b._lampGlows.forEach(lg => {
                lg.alpha = night ? 0.4 + Math.sin(this._fountainTick * 0.05) * 0.1 : 0;
            });
        }
    },

    // Initialize lamp glows after environment renders the building
    initLampGlows(container, b) {
        if (!b._lamps || b._lampGlows) return;
        b._lampGlows = [];
        b._lamps.forEach(lamp => {
            const glow = new PIXI.Graphics();
            glow.beginFill(0xffdd88, 0.4);
            glow.drawCircle(lamp.x, lamp.y, 8);
            glow.endFill();
            glow.alpha = 0;
            container.addChild(glow);
            b._lampGlows.push(glow);
        });
    },

    // Bird perches for the bird flock system
    getBirdPerches() {
        const b = G.bldById['city_park'];
        if (!b) return [];
        return this._birdPerches.map(p => ({
            x: b.x + p.x,
            y: p.y
        }));
    }
};
