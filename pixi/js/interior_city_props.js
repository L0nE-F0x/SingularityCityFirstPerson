/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY PROPS (v16.4.4 - Avatar Signature Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCityProps = {
    lifts: {},

    _parseCol(col) {
        if (typeof col === 'number') return col;
        if (typeof col === 'string') return parseInt(col.replace('#', ''), 16);
        if (col && typeof col === 'object' && col.color) return parseInt(col.color.replace('#', ''), 16);
        return 0x64748b; 
    },

    initLift(layer, bldId, numFloors, floorHeight, shaftX) {
        if (this.lifts[bldId]) {
            this.lifts[bldId].destroy();
            delete this.lifts[bldId];
        }
        const lift = new CityElevator(layer, numFloors, floorHeight, shaftX);
        this.lifts[bldId] = lift;
        return lift;
    },

    updateLifts() {
        Object.values(this.lifts).forEach(lift => {
            if (!lift.destroyed) lift.update();
        });
    },
    
    getLift(bldId) {
        return this.lifts[bldId];
    },

    drawRoof(roofH, startX, usableW, colHex, lab, bld) {
        const cHex = this._parseCol(colHex);
        const roofCont = new PIXI.Container();
        const boardW = 220; 
        const boardH = 34; 
        const boardX = startX + usableW / 2 - boardW / 2; 
        const boardY = roofH - boardH - 10;
        
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0x111111); 
        gfx.lineStyle(2, cHex, 0.8); 
        gfx.drawRect(boardX, boardY, boardW, boardH); 
        gfx.endFill(); 
        gfx.lineStyle(0);
        
        gfx.beginFill(0x333333); 
        gfx.drawRect(boardX + 15, boardY + boardH, 6, 10); 
        gfx.drawRect(boardX + boardW - 21, boardY + boardH, 6, 10); 
        gfx.endFill();
        roofCont.addChild(gfx);
        
        const safeLabName = lab ? (lab.name || bld.name) : (bld.name || 'HQ');
        const textToDisplay = bld.lab ? safeLabName.toUpperCase() : `${bld.emoji || ''} ${(bld.name || 'HQ').toUpperCase()}`.trim();
        
        const logoTxt = new PIXI.Text(textToDisplay, { 
            fontFamily: 'JetBrains Mono', 
            fontSize: 14, 
            fontWeight: 'bold', 
            fill: 0xffffff, 
            letterSpacing: 2, 
            dropShadow: true, 
            dropShadowColor: cHex, 
            dropShadowBlur: 8, 
            dropShadowDistance: 0 
        });
        logoTxt.anchor.set(0.5, 0.5); 
        logoTxt.x = startX + usableW / 2; 
        logoTxt.y = boardY + boardH / 2; 
        roofCont.addChild(logoTxt);
        
        if (bld.lab && lab.ticker) {
            this.bldTickerSym = lab.ticker;
            
            const tickBg = new PIXI.Graphics();
            tickBg.beginFill(0x000000, 0.9); 
            tickBg.drawRect(this.startX, roofH - 12, this.bldW, 12); 
            tickBg.endFill();
            roofCont.addChild(tickBg);

            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff); 
            mask.drawRect(this.startX, roofH - 12, this.bldW, 12); 
            mask.endFill();
            roofCont.addChild(mask); 
            
            const tickCont = new PIXI.Container();
            tickCont.mask = mask;
            
            this.tickerTxt = new PIXI.Text(`     ${lab.ticker} AWAITING DATA     `, { 
                fontFamily: 'monospace', 
                fontSize: 9, 
                fontWeight: 'bold', 
                fill: 0x888888 
            });
            this.tickerTxt.y = roofH - 11; 
            this.tickerTxt.x = this.startX + this.bldW; 
            tickCont.addChild(this.tickerTxt);
            roofCont.addChild(tickCont);
        }
        
        this.scene.addChild(roofCont);
    },

    // ────────────────────────────────────────────────────────────────
    //  SHARED SKY + CELESTIAL HELPERS (for all interior modules)
    //  Call from your update() loop so viewport shows the DOM sky
    //  through window cutouts, and the sun/moon/stars animate.
    // ────────────────────────────────────────────────────────────────
    _applyDynamicSky(celestialGfx, starsLayer) {
        if (typeof G === 'undefined' || typeof G.getDayPhase !== 'function') return;
        const dp = G.getDayPhase();
        const night = dp > .83 || dp < .25;
        const vp = document.getElementById('viewport');
        let sky;
        if (dp < .22) {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        } else if (dp < .30) {
            const t = (dp - .22) / .08;
            sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`;
        } else if (dp < .72) {
            sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        } else if (dp < .84) {
            const t = (dp - .72) / .12;
            sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`;
        } else {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        }
        if (typeof Environment !== 'undefined' && !night && dp > .3 && dp < .72) {
            const _ew = Environment.weather;
            if (_ew === 'rain' || _ew === 'drizzle')   sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
            else if (_ew === 'thunderstorm')           sky = 'linear-gradient(180deg,#1a1f2a,#2d3340 50%,#444a55)';
            else if (_ew === 'overcast')               sky = 'linear-gradient(180deg,#4a5568,#64748b 50%,#94a3b8)';
            else if (_ew === 'fog')                    sky = 'linear-gradient(180deg,#8a9099,#a8b1bb 50%,#c0c8d0)';
            else if (_ew === 'partly_cloudy')          sky = 'linear-gradient(180deg,#355088,#6a9abf 50%,#93b9d8)';
        }
        if (typeof Environment !== 'undefined' && Environment.weather === 'snow') {
            sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        }
        if (vp) vp.style.background = sky;

        if (celestialGfx) {
            celestialGfx.clear();
            if (night) {
                const np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42;
                celestialGfx.beginFill(0xe8e8d0);
                celestialGfx.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12);
                celestialGfx.endFill();
            } else {
                const dayP = (dp - 0.25) / (0.83 - 0.25);
                celestialGfx.beginFill(0xffe066);
                celestialGfx.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15);
                celestialGfx.endFill();
            }
        }
        if (starsLayer) {
            starsLayer.visible = night;
            if (night) {
                starsLayer.children.forEach(s => {
                    s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + (s._phase || 0))) * .5;
                });
            }
        }
    },

    // Build a skyContainer (stars + celestial gfx) and add it as the
    // bottom-most layer of `layer`. Returns { skyContainer, starsLayer, celestialGfx }.
    _createSkyLayer(layer, numStars = 70) {
        const skyContainer = new PIXI.Container();
        skyContainer.eventMode = 'none';
        layer.addChild(skyContainer);
        const starsLayer = new PIXI.Container();
        for (let i = 0; i < numStars; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff);
            s.drawCircle(0, 0, 0.5 + Math.random() * 1.2);
            s.endFill();
            s.x = Math.random() * G.vpW;
            s.y = Math.random() * G.vpH * 0.5;
            s._phase = Math.random() * Math.PI * 2;
            starsLayer.addChild(s);
        }
        const celestialGfx = new PIXI.Graphics();
        skyContainer.addChild(starsLayer, celestialGfx);
        return { skyContainer, starsLayer, celestialGfx };
    },

    // Draws a solid wall rectangle with a rectangular window CUTOUT (no fill in the
    // window region — so the DOM sky shows through the transparent canvas).
    // winY/winH give the vertical band of the window; winX/winW give horizontal extent.
    // mullionPitch=0 → single storefront pane. mullionPitch>0 → vertical pillars every N px.
    _drawWallWithWindowCutout(gfx, wallCol, x, y, w, h, winX, winY, winW, winH, mullionPitch = 0, mullionW = 8) {
        gfx.beginFill(wallCol);
        // Top strip (above window)
        if (winY > y) gfx.drawRect(x, y, w, winY - y);
        // Bottom strip (below window)
        if (y + h > winY + winH) gfx.drawRect(x, winY + winH, w, (y + h) - (winY + winH));
        // Left side of window
        if (winX > x) gfx.drawRect(x, winY, winX - x, winH);
        // Right side of window
        if (x + w > winX + winW) gfx.drawRect(winX + winW, winY, (x + w) - (winX + winW), winH);
        // Mullion pillars between panes
        if (mullionPitch > 0) {
            let mx = winX + mullionPitch;
            while (mx + mullionW <= winX + winW) {
                gfx.drawRect(mx, winY, mullionW, winH);
                mx += mullionPitch;
            }
        }
        gfx.endFill();
    },

    drawNegativeSpaceWall(gfx, wallColor, x, y, w, h, isCeo, windowX, windowW) {
        gfx.beginFill(wallColor);
        if (isCeo) {
            gfx.drawRect(x, y, w, 15); 
            gfx.drawRect(x, y + 60, w, h - 60); 
            gfx.drawRect(x, y + 15, windowX - x, 45); 
            gfx.drawRect(windowX + windowW, y + 15, x + w - (windowX + windowW), 45); 
        } else {
            gfx.drawRect(x, y, w, 25); 
            gfx.drawRect(x, y + 55, w, h - 55); 
            gfx.drawRect(x, y + 25, windowX - x, 30); 
            let currX = windowX;
            while (currX + 40 <= windowX + windowW) {
                currX += 40; 
                let pillarW = Math.min(20, windowX + windowW - currX);
                if (pillarW > 0) gfx.drawRect(currX, y + 25, pillarW, 30);
                currX += 20; 
            }
            if (currX < windowX + windowW) gfx.drawRect(currX, y + 25, (windowX + windowW) - currX, 30);
            gfx.drawRect(windowX + windowW, y + 25, x + w - (windowX + windowW), 30);
        }
        gfx.endFill();
    },

    drawRoomInterior(gfx, x, y, w, h, colHex, isCeo, windowX, windowW, theme = 'general') {
        
        if (theme === 'campsite') {
            gfx.beginFill(0x080a1e); 
            gfx.drawRect(x, y, w, h);
            gfx.endFill();
            
            for(let s=0; s<40; s++) {
                gfx.beginFill(0xffffff, 0.2 + Math.random()*0.8);
                gfx.drawCircle(x + Math.random()*w, y + Math.random()*(h-20), Math.random()*1.5);
                gfx.endFill();
            }
            
            gfx.beginFill(0x0a1a10); 
            gfx.drawRect(x, y + h - 8, w, 8); 
            gfx.endFill(); 
            return;
        }

        let wallCol = 0x1a1a2e;
        let floorCol = 0x11111a;
        let lightCol = 0xffffff;
        let beamAlpha = 0.15;
        let ceilingLightA = 0.8;
        
        if (theme === 'server_core') { 
            wallCol = 0x050510; floorCol = 0x0a0a15; lightCol = 0x00ffff; beamAlpha = 0.05; ceilingLightA = 0.3; 
        } else if (theme === 'zen_garden') { 
            wallCol = 0x2a2a3e; floorCol = 0x1a1a2e; lightCol = 0xffeebb; beamAlpha = 0.25; 
        } else if (theme.startsWith('gym_')) {
            wallCol = 0x151b22; floorCol = 0x0f172a;
            if (theme === 'gym_yoga') { wallCol = 0x1a1a2e; floorCol = 0x151520; lightCol = 0xa855f7; beamAlpha = 0.08; }
            if (theme === 'gym_pool') { wallCol = 0x0f1a2e; floorCol = 0x0a1520; lightCol = 0x38bdf8; beamAlpha = 0.12; }
        } else if (theme.startsWith('arena_')) {
            wallCol = 0x111115; floorCol = 0x0a0a0f;
            if (theme === 'arena_commentary') { wallCol = 0x0f1020; floorCol = 0x0a0a15; }
            if (theme === 'arena_trophy') { wallCol = 0x1a1510; floorCol = 0x100e08; lightCol = 0xfbbf24; beamAlpha = 0.15; }
        } else if (theme === 'cafe' || theme.startsWith('cafe_')) {
            wallCol = 0x271e1a; floorCol = 0x17120f;
            if (theme === 'cafe_rooftop') { wallCol = 0x1a2030; floorCol = 0x0f1520; lightCol = 0xfbbf24; beamAlpha = 0.1; }
            if (theme === 'cafe_kitchen') { wallCol = 0x1e2025; floorCol = 0x14161a; }
        } else if (theme.startsWith('os_')) {
            wallCol = 0x0f172a; floorCol = 0x0a1020;
            if (theme === 'os_garden') { wallCol = 0x1a2a1a; floorCol = 0x0f1a0f; lightCol = 0x86efac; beamAlpha = 0.1; }
            if (theme === 'os_server') { wallCol = 0x050510; floorCol = 0x0a0a15; lightCol = 0x4ade80; beamAlpha = 0.08; }
        } else if (theme.startsWith('bar_')) {
            wallCol = 0x12081e; floorCol = 0x0a0512; lightCol = 0xff00ff; beamAlpha = 0.08; ceilingLightA = 0.3;
        }
        
        this.drawNegativeSpaceWall(gfx, wallCol, x, y, w, h, isCeo, windowX, windowW);
        
        gfx.beginFill(floorCol); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill(); 
        
        gfx.lineStyle(1, 0x000000, 0.15);
        for(let i = x; i < x + w; i += 20) { 
            if (i > windowX && i < windowX + windowW) {
                if (isCeo) continue; 
                let offset = i - windowX;
                if (offset % 60 < 40) continue; 
            }
            gfx.moveTo(i, y); 
            gfx.lineTo(i, y + h - 8); 
        }
        gfx.lineStyle(0);
        
        let trimCol = theme === 'server_core' ? 0x111122 : 0x222233;
        gfx.beginFill(trimCol); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill(); 
        
        if (theme === 'server_core') { lightCol = 0x38bdf8; beamAlpha = 0.1; }
        else if (theme.startsWith('arena')) { lightCol = 0xef4444; beamAlpha = 0.25; }
        else if (theme === 'zen_garden') { lightCol = 0x86efac; beamAlpha = 0.1; }
        else if (isCeo) { lightCol = 0xfde047; beamAlpha = 0.25; }
        
        const lightZones = 3; 
        const spacing = w / (lightZones + 1);
        for(let i = 1; i <= lightZones; i++) {
            const lx = x + (i * spacing);
            gfx.beginFill(lightCol, ceilingLightA); 
            gfx.drawRect(lx - 12, y, 24, 2); 
            gfx.endFill();
            
            const beam = new PIXI.Graphics();
            beam.beginFill(lightCol, beamAlpha);
            beam.moveTo(lx - 12, y + 2); 
            beam.lineTo(lx + 12, y + 2); 
            beam.lineTo(lx + 50, y + h - 8); 
            beam.lineTo(lx - 50, y + h - 8); 
            beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD;
            gfx.addChild(beam);
            
            if (!this.indoorLights) this.indoorLights = [];
            this.indoorLights.push({ g: beam, maxA: beamAlpha, type: 'ceiling' });
        }
    },

    drawLake(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0f172a); g.drawEllipse(x, y-5, 90, 18); g.endFill();
        g.beginFill(0x0284c7, 0.6); g.drawEllipse(x, y-4, 85, 14); g.endFill();
        g.beginFill(0xffffff, 0.1); 
        g.drawRect(x-20, y-10, 40, 2); 
        g.drawRect(x-10, y-6, 20, 2); 
        g.endFill();
        c.addChild(g);
    },

    drawTent(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex); g.drawPolygon([x, y-40, x-30, y-5, x+30, y-5]); g.endFill();
        g.beginFill(0x11111a); g.drawPolygon([x, y-30, x-10, y-5, x+10, y-5]); g.endFill(); 
        g.lineStyle(2, 0xffffff, 0.5); g.moveTo(x-30, y-5); g.lineTo(x-35, y); g.moveTo(x+30, y-5); g.lineTo(x+35, y); g.lineStyle(0);
        c.addChild(g);
    },

    drawCampfire(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x4a2e1a); 
        g.drawPolygon([x-12, y-5, x+12, y-5, x+8, y-2, x-8, y-2]);
        g.drawPolygon([x-6, y-8, x+6, y-8, x+12, y-2, x-12, y-2]);
        g.endFill();
        g.beginFill(0xf97316); g.drawPolygon([x-8, y-5, x, y-18, x+8, y-5]); g.endFill(); 
        g.beginFill(0xfacc15); g.drawPolygon([x-4, y-5, x, y-12, x+4, y-5]); g.endFill(); 
        c.addChild(g);
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xf97316, 0.3); glow.drawCircle(x, y-10, 35); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'fire' });
    },

    drawPunchingBag(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-15, y-80, 30, 6); g.endFill(); 
        g.beginFill(0x888888); g.drawRect(x-1, y-74, 2, 20); g.endFill(); 
        g.beginFill(0xef4444); g.drawRoundedRect(x-12, y-54, 24, 45, 6); g.endFill(); 
        g.beginFill(0x991b1b); g.drawRect(x-12, y-40, 24, 15); g.endFill(); 
        c.addChild(g);
    },

    drawWeightBench(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); g.drawRoundedRect(x-20, y-15, 40, 6, 2); g.endFill();
        g.beginFill(0x444444); g.drawRect(x-15, y-9, 4, 9); g.drawRect(x+11, y-9, 4, 9); g.endFill();
        g.beginFill(0x555555); g.drawRect(x-25, y-30, 4, 30); g.drawRect(x+21, y-30, 4, 30); g.endFill();
        g.beginFill(0xcccccc); g.drawRect(x-30, y-30, 60, 3); g.endFill();
        g.beginFill(0x222222); g.drawRect(x-30, y-38, 6, 19); g.drawRect(x+24, y-38, 6, 19); g.endFill();
        c.addChild(g);
    },

    drawTreadmill(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawPolygon([x-25, y, x+20, y, x+25, y-8, x-20, y-8]); g.endFill();
        g.beginFill(0x111111); g.drawPolygon([x-23, y-1, x+18, y-1, x+23, y-7, x-18, y-7]); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x+15, y-35, 6, 30); g.endFill();
        g.beginFill(0x111111); g.drawRect(x+10, y-45, 12, 12); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.8); glow.drawRect(x+12, y-43, 8, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawServerWeights(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xaaaaaa); g.drawRect(x-25, y-10, 50, 2); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-20, y-20, 10, 20); g.drawRect(x+10, y-20, 10, 20); g.endFill();
        g.beginFill(0x4ade80); g.drawCircle(x-18, y-15, 1); g.drawCircle(x+12, y-15, 1); g.endFill(); 
        c.addChild(g);
    },

    drawRing(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-60, y-10, 120, 10); g.endFill(); 
        g.beginFill(0x0ea5e9, 0.4); g.drawRect(x-60, y-10, 120, 2); g.endFill(); 
        g.beginFill(0x33334a); g.drawRect(x-60, y-40, 4, 30); g.drawRect(x+56, y-40, 4, 30); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-60, y-35, 120, 2); g.endFill(); 
        g.beginFill(0xffffff); g.drawRect(x-60, y-25, 120, 2); g.endFill(); 
        g.beginFill(0x3b82f6); g.drawRect(x-60, y-15, 120, 2); g.endFill(); 
        c.addChild(g);
    },

    drawServerRack(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawRect(x-10, y-30, 20, 30); g.endFill(); 
        g.beginFill(0x222233); 
        for(let sy=y-26; sy<y-4; sy+=6) g.drawRect(x-8, sy, 16, 4); 
        g.beginFill(cHex); 
        for(let sy=y-25; sy<y-4; sy+=6) { g.drawCircle(x-5, sy+1, 1); g.drawCircle(x-1, sy+1, 1); } 
        g.endFill(); c.addChild(g); 
        const glow = new PIXI.Graphics(); glow.beginFill(cHex, 0.8);
        for(let sy=y-25; sy<y-4; sy+=6) { glow.drawCircle(x-5, sy+1, 1.5); glow.drawCircle(x-1, sy+1, 1.5); }
        glow.endFill(); glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 1.0, type: 'server' });
    },

    drawPlant(c, x, y) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0x8b5cf6); g.drawRect(x-6,y-10,12,10); g.endFill(); 
        g.beginFill(0x4ade80); g.drawCircle(x,y-16,6); g.drawCircle(x-5,y-12,5); g.drawCircle(x+5,y-12,5); g.endFill(); 
        c.addChild(g); 
    },

    // ─── FIX: Flexible Signature for drawAvatar to prevent crashes ───
    drawAvatar(arg1, arg2, arg3, arg4) {
        let container, x, y, col;
        
        if (arg1 && typeof arg1.addChild === 'function') {
            container = arg1; 
            x = arg2; 
            y = arg3; 
            col = arg4;
        } else {
            container = this.scene || (typeof InteriorCityCore !== 'undefined' ? InteriorCityCore.scene : null);
            x = arg1; 
            y = arg2; 
            col = arg3;
        }

        if (!container) return; 

        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex); g.drawRoundedRect(x - 6, y - 12, 12, 12, 2); g.endFill();
        g.beginFill(0xfdd8b5); g.drawCircle(x, y - 16, 5); g.endFill();
        container.addChild(g);
    },

    drawLiquidCooledServer(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawRect(x-15, y-40, 30, 40); g.endFill();
        g.beginFill(0x222233); g.drawRect(x-12, y-38, 24, 36); g.endFill();
        g.beginFill(0x06b6d4); g.drawRect(x-8, y-36, 4, 32); g.drawRect(x+4, y-36, 4, 32); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x06b6d4, 0.4); glow.drawRect(x-8, y-36, 4, 32); glow.drawRect(x+4, y-36, 4, 32); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'server' });
    },

    drawReceptionDesk(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x2a2a3e); g.drawRect(x-15, y-22, 50, 22); g.endFill(); 
        g.beginFill(cHex, 0.8); g.drawRect(x-17, y-22, 54, 4); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x+5, y-32, 6, 10); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x+4, y-31, 2, 8); g.endFill(); 
        c.addChild(g); 
    },
    
    drawCouches(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.5); g.drawRect(x-20, y-10, 40, 10); 
        g.beginFill(cHex, 0.3); g.drawRect(x-24, y-16, 6, 16); g.drawRect(x+18, y-16, 6, 16); g.drawRect(x-20, y-20, 40, 10); 
        g.endFill(); c.addChild(g); 
    },

    drawWaterCooler(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xdddddd); g.drawRect(x-5, y-18, 10, 18); g.endFill(); 
        g.beginFill(0x3b82f6, 0.6); g.drawRoundedRect(x-4, y-32, 8, 14, 2); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-3, y-14, 6, 4); g.endFill(); 
        g.beginFill(0xff3333); g.drawRect(x-3, y-17, 2, 2); 
        g.beginFill(0x3b82f6); g.drawRect(x+1, y-17, 2, 2); g.endFill(); 
        c.addChild(g); 
    },

    drawChair(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,4,12); g.drawRect(x-5,y-8,12,3); 
        g.beginFill(0x33334a); g.drawRect(x+1,y-5,2,3); g.drawRect(x-3,y-2,10,2); g.endFill(); 
        c.addChild(g); 
    },

    drawBeanbagAndHandheld(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xf472b6); g.drawEllipse(x, y-5, 12, 5); g.drawCircle(x, y-8, 7); g.endFill();
        g.beginFill(0x11111a); g.drawRect(x-12, y-15, 6, 10); g.endFill();
        g.beginFill(0x22d3ee); g.drawRect(x-11, y-14, 4, 6); g.endFill();
        c.addChild(g);
    },

    drawPingPongTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-15, y-15, 4, 15); g.drawRect(x+11, y-15, 4, 15); g.endFill();
        g.beginFill(0x10b981); g.drawRect(x-20, y-17, 40, 4); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x-1, y-22, 2, 5); g.endFill();
        c.addChild(g);
    },

    drawIndoorPool(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-30, y-4, 60, 4); g.endFill();
        g.beginFill(0x0284c7, 0.6); g.drawRect(x-28, y-3, 56, 3); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.3); glow.drawRect(x-28, y-15, 56, 12); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'pool' });
    },

    drawGeckoTerrarium(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-12, y-8, 24, 8); g.endFill(); 
        g.beginFill(0x111111, 0.5); g.drawRect(x-10, y-20, 20, 12); g.endFill(); 
        g.lineStyle(1, 0xffffff, 0.2); g.drawRect(x-10, y-20, 20, 12); g.lineStyle(0);
        g.beginFill(0x22c55e); g.drawCircle(x-5, y-12, 3); g.drawCircle(x+4, y-14, 2); g.endFill(); 
        g.beginFill(0xfacc15); g.drawRect(x-1, y-10, 2, 1); g.endFill(); 
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.2); glow.drawRect(x-10, y-20, 20, 12); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
    },

    drawBiophilicDivider(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-8, y-10, 16, 10); g.endFill();
        g.beginFill(0x166534); g.drawCircle(x-4, y-15, 8); g.drawCircle(x+4, y-12, 6); g.drawCircle(x, y-20, 7); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x-2, y-16, 4); g.drawCircle(x+2, y-14, 3); g.endFill();
        c.addChild(g);
    },

    drawCanteen(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-25, y-15, 4, 15); g.drawRect(x+21, y-15, 4, 15); g.endFill();
        g.beginFill(0xf1f5f9); g.drawRect(x-30, y-18, 60, 4); g.endFill();
        g.beginFill(0xd97706); g.drawRect(x-20, y-8, 8, 3); g.drawRect(x, y-8, 8, 3); g.drawRect(x+12, y-8, 8, 3); g.endFill();
        c.addChild(g);
    },

    drawDeskAndPC(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';

        // Deterministic per-desk seed so a given cubicle keeps the same monitor content / clutter.
        const seed  = (Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)) % 1;
        const cSeed = (Math.abs(Math.sin(x * 31.41   + y * 27.18 ) * 19283.1   )) % 1;

        // ─── Desk slab + fascia ───
        g.beginFill(0x1e293b); g.drawRect(x - 18, y - 20, 36, 4); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x - 18, y - 16, 36, 1); g.endFill();
        // Front desk legs
        g.beginFill(0x33334a);
        g.drawRect(x - 16, y - 15, 2, 13);
        g.drawRect(x + 14, y - 15, 2, 13);
        g.endFill();

        // ─── Drawer pedestal under desk (right) ───
        g.beginFill(0x252538); g.drawRect(x + 5, y - 15, 11, 13); g.endFill();
        g.beginFill(0x1a1a2a);
        g.drawRect(x + 5, y - 11, 11, 1);
        g.drawRect(x + 5, y - 7,  11, 1);
        g.endFill();
        g.beginFill(0xcbd5e1);
        g.drawRect(x + 9, y - 13, 3, 1);
        g.drawRect(x + 9, y - 9,  3, 1);
        g.endFill();

        // ─── Dual monitor stands ───
        g.beginFill(0x0f172a);
        g.drawRect(x - 8, y - 22, 6, 2);
        g.drawRect(x + 2, y - 22, 6, 2);
        g.endFill();
        g.beginFill(0x33334a);
        g.drawRect(x - 6, y - 24, 2, 2);
        g.drawRect(x + 4, y - 24, 2, 2);
        g.endFill();

        // ─── Monitor bezels ───
        g.beginFill(0x0a0a14);
        g.drawRect(x - 14, y - 33, 12, 11);
        g.drawRect(x + 2,  y - 33, 12, 11);
        g.endFill();
        g.beginFill(0x000005);
        g.drawRect(x - 13, y - 32, 10, 9);
        g.drawRect(x + 3,  y - 32, 10, 9);
        g.endFill();

        // ─── Screen content (chart / code / dashboard) ───
        const mode = seed < 0.34 ? 'chart' : seed < 0.67 ? 'code' : 'dashboard';

        if (mode === 'chart') {
            // Left: bar chart in lab color
            for (let i = 0; i < 5; i++) {
                const bh = 1 + ((i * 17 + Math.floor(seed * 100)) % 7);
                g.beginFill(cHex, 0.75);
                g.drawRect(x - 12 + i * 2, y - 24 - bh, 1, bh);
                g.endFill();
            }
            // Right: tiny line graph
            g.lineStyle(1, 0x4ade80, 0.7);
            let pX = x + 4, pY = y - 27;
            for (let i = 1; i < 7; i++) {
                const nX = x + 4 + i * 1.4;
                const nY = y - 24 - ((i * 3 + Math.floor(seed * 17)) % 6);
                g.moveTo(pX, pY); g.lineTo(nX, nY);
                pX = nX; pY = nY;
            }
            g.lineStyle(0);
        } else if (mode === 'code') {
            // Left: indented code lines (blue / green / yellow tokens)
            for (let i = 0; i < 6; i++) {
                const lw = 3 + ((i * 7 + Math.floor(seed * 50)) % 6);
                const indent = (i % 3) * 1.5;
                const lcol = i % 3 === 0 ? 0x60a5fa : i % 3 === 1 ? 0x86efac : 0xfde68a;
                g.beginFill(lcol, 0.65);
                g.drawRect(x - 12 + indent, y - 31 + i * 1.5, lw, 0.8);
                g.endFill();
            }
            // Right: side panel + code
            g.beginFill(0x1e293b, 0.6); g.drawRect(x + 3, y - 31, 2.5, 8); g.endFill();
            for (let i = 0; i < 5; i++) {
                const lw = 3 + ((i * 11 + Math.floor(seed * 40)) % 5);
                g.beginFill(0xc4b5fd, 0.6);
                g.drawRect(x + 6.5, y - 30 + i * 1.6, lw, 0.8);
                g.endFill();
            }
        } else {
            // Left: terminal prompt rows
            for (let i = 0; i < 5; i++) {
                g.beginFill(0x22c55e, 0.6);
                g.drawRect(x - 12, y - 30 + i * 1.7, 1, 0.8);
                g.drawRect(x - 10, y - 30 + i * 1.7, 3 + ((i + Math.floor(seed * 13)) % 5), 0.8);
                g.endFill();
            }
            // Right: dashboard tiles
            const tCols = [cHex, 0xf472b6, 0x22d3ee, 0xfacc15];
            for (let i = 0; i < 4; i++) {
                g.beginFill(tCols[i], 0.55);
                g.drawRect(x + 4 + (i % 2) * 5, y - 31 + Math.floor(i / 2) * 4, 4, 3);
                g.endFill();
            }
        }

        // ─── Keyboard + key dots ───
        g.beginFill(0x0f172a); g.drawRect(x - 9, y - 22, 12, 2); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x - 9, y - 22, 12, 0.5); g.endFill();
        for (let kx = -8; kx < 3; kx += 2) {
            g.beginFill(0x475569, 0.7);
            g.drawRect(x + kx, y - 21, 1, 0.5);
            g.endFill();
        }

        // ─── Mousepad + mouse ───
        g.beginFill(0x33334a, 0.6); g.drawRect(x + 4,  y - 22, 8, 2  ); g.endFill();
        g.beginFill(0x0f172a);      g.drawRect(x + 7,  y - 22, 3, 1.5); g.endFill();

        // ─── Clutter (deterministic per-desk) ───
        if (cSeed > 0.30) {
            // Mug — red / amber / white ceramic
            const mugCol = cSeed > 0.66 ? 0xe11d48 : cSeed > 0.45 ? 0xf59e0b : 0xf1f5f9;
            g.beginFill(mugCol);          g.drawRect(x - 17, y - 23, 3, 3); g.endFill();
            g.beginFill(0x000000, 0.35);  g.drawRect(x - 14, y - 22, 1, 1.5); g.endFill();
            if (cSeed > 0.7) {
                g.beginFill(0xffffff, 0.3); g.drawCircle(x - 15.5, y - 26, 0.8); g.endFill();
            }
        }
        if (cSeed > 0.55) {
            // Sticky note on monitor edge
            g.beginFill(0xfde68a); g.drawRect(x - 2, y - 26, 2.5, 2); g.endFill();
        }
        if (cSeed > 0.40 && cSeed < 0.70) {
            // Paper stack
            g.beginFill(0xf1f5f9); g.drawRect(x - 5, y - 21, 5, 1); g.endFill();
            g.beginFill(0x94a3b8, 0.55); g.drawRect(x - 4, y - 20.5, 3, 0.4); g.endFill();
        }
        if (cSeed > 0.62) {
            // Tiny desk plant on right corner
            g.beginFill(0x854d0e); g.drawRect (x + 14, y - 22, 3, 2  ); g.endFill();
            g.beginFill(0x166534); g.drawCircle(x + 15, y - 23, 1.5); g.endFill();
            g.beginFill(0x22c55e); g.drawCircle(x + 16, y - 24, 1.2); g.endFill();
        }
        if (cSeed > 0.85) {
            // Headphones hanging on left monitor
            g.lineStyle(1, 0x1e293b, 1);
            g.drawCircle(x - 8, y - 33, 2);
            g.lineStyle(0);
            g.beginFill(0x1e293b); g.drawCircle(x - 8, y - 31, 1); g.endFill();
        }

        // ─── Cable to floor ───
        g.beginFill(0x111118, 0.6); g.drawRect(x - 4, y - 22, 0.6, 6); g.endFill();

        // ─── Screen glow (lab-color tinted, ties to indoor light system) ───
        const glow = new PIXI.Graphics();
        glow.beginFill(cHex, 0.35);
        glow.drawRect(x - 13, y - 32, 10, 9);
        glow.drawRect(x + 3,  y - 32, 10, 9);
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;

        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'screen' });
    },

    // Cubicle privacy divider — sits between adjacent desks to make a row of desks
    // read as a proper bullpen of cubicles. Drawn in a cool office-fabric tone.
    drawCubicleDivider(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Panel
        g.beginFill(0x3a4a5e); g.drawRect(x - 1, y - 28, 2, 28); g.endFill();
        // Top trim
        g.beginFill(0x64748b); g.drawRect(x - 2, y - 29, 4, 2); g.endFill();
        // Subtle vertical fabric texture
        g.beginFill(0x2a3647, 0.6);
        for (let dy = -26; dy < 0; dy += 4) {
            g.drawRect(x - 1, y + dy, 0.5, 2);
        }
        g.endFill();
        // Foot/base
        g.beginFill(0x1e293b); g.drawRect(x - 3, y - 1, 6, 1); g.endFill();
        c.addChild(g);
    },

    drawCollaborationPod(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawEllipse(x, y-15, 20, 15); g.endFill();
        g.beginFill(cHex, 0.3); g.drawEllipse(x, y-15, 18, 13); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-10, y-18, 20, 6); g.endFill();
        g.beginFill(cHex); g.drawRect(x-8, y-17, 16, 4); g.endFill();
        c.addChild(g);
    },

    drawLoungeNook(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.4); g.drawRect(x-20, y-10, 20, 10); g.drawRect(x-20, y-20, 10, 20); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x-5, y-12, 15, 12); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x+2, y-16, 6); g.endFill();
        c.addChild(g);
    },

    drawTrophy(c, x, y, isGold) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const col = isGold ? 0xfacc15 : 0x94a3b8;
        g.beginFill(0x111111); g.drawRect(x-8, y-10, 16, 10); g.endFill();
        g.beginFill(col); g.drawPolygon([x-10, y-30, x+10, y-30, x+4, y-10, x-4, y-10]); g.endFill();
        g.beginFill(col); g.drawCircle(x-12, y-25, 4); g.drawCircle(x+12, y-25, 4); g.endFill();
        g.beginFill(0x000000); g.drawCircle(x-12, y-25, 2); g.drawCircle(x+12, y-25, 2); g.endFill();
        c.addChild(g);
    },

    drawExecutiveLounge(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.2); g.drawEllipse(x, y-2, 30, 4); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(x-25, y-12, 15, 12); g.drawRect(x+10, y-12, 15, 12); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-8, y-8, 16, 8); g.endFill();
        g.beginFill(0xffffff, 0.8); g.drawRect(x-5, y-10, 4, 2); g.drawRect(x+1, y-10, 4, 2); g.endFill();
        c.addChild(g);
    },

    drawCommandCenter(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-20, y-15, 40, 15); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-18, y-35, 10, 10); g.drawRect(x-4, y-38, 12, 12); g.drawRect(x+10, y-35, 10, 10); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(cHex, 0.5); glow.drawRect(x-17, y-34, 8, 8); glow.drawRect(x-3, y-37, 10, 10); glow.drawRect(x+11, y-34, 8, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawPrivateOasis(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-15, y-8, 30, 8); g.endFill();
        g.beginFill(0x0284c7); g.drawRect(x-12, y-6, 24, 4); g.endFill();
        g.beginFill(0x166534); g.drawCircle(x-15, y-15, 10); g.drawCircle(x+15, y-12, 8); g.endFill();
        c.addChild(g);
    },

    drawBossDesk(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-25,y-18,50,18); g.endFill(); 
        g.beginFill(cHex); g.drawRect(x-28,y-18,56,5); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-5,y-30,6,12); g.drawRect(x+5,y-30,6,12); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x-4,y-29,2,10); g.drawRect(x+4,y-29,2,10); g.endFill(); 
        c.addChild(g); 
    },

    drawDataVat(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawEllipse(x, y, 40, 10); g.endFill();
        g.beginFill(0x222233); g.drawRect(x - 40, y - 10, 80, 10); g.endFill();
        g.beginFill(0x22d3ee, 0.15); g.lineStyle(2, 0x22d3ee, 0.4);
        g.drawRect(x - 35, y - 80, 70, 70); g.endFill(); g.lineStyle(0);
        g.beginFill(0x0ea5e9, 0.4); g.drawRect(x - 30, y - 75, 60, 65); g.endFill();
        g.beginFill(0x222233); g.drawRect(x - 40, y - 90, 80, 10); g.endFill();
        g.beginFill(0x11111a); g.drawEllipse(x, y - 90, 40, 10); g.endFill();
        c.addChild(g);
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.3); glow.drawCircle(x, y - 45, 50); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'server' });
    },
    
    drawBrokenServer(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x222233); g.drawRect(x-12, y-28, 24, 28); g.endFill();
        g.beginFill(0x11111a); g.drawRect(x-10, y-26, 20, 24); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x-5, y-20, 1); g.endFill();
        g.beginFill(0x555566); g.drawRect(x-8, y-10, 16, 2); g.rotation = 0.1; g.endFill(); 
        c.addChild(g);
        const glow = new PIXI.Graphics();
        glow.beginFill(0xef4444, 0.8); glow.drawCircle(x-5, y-20, 2); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.9, type: 'error' });
    },
    
    drawTombstone(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x555566); g.drawRoundedRect(x-12, y-25, 24, 25, 10); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x-14, y-4, 28, 4); g.endFill();
        g.beginFill(0x222233); g.drawRect(x-1, y-18, 2, 8); g.drawRect(x-3, y-16, 6, 2); g.endFill(); 
        c.addChild(g);
    },

    drawCafeTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-2, y-15, 4, 15); g.endFill();
        g.beginFill(0xf1f5f9); g.drawEllipse(x, y-15, 20, 4); g.endFill();
        g.beginFill(0xd97706); g.drawRect(x-18, y-8, 6, 8); g.drawRect(x+12, y-8, 6, 8); g.endFill();
        c.addChild(g);
    },

    drawBaristaCounter(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-30, y-25, 60, 25); g.endFill();
        g.beginFill(0xb45309); g.drawRect(x-32, y-25, 64, 4); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(x-20, y-40, 15, 15); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-18, y-35, 11, 10); g.endFill();
        g.beginFill(0xcbd5e1); g.drawRect(x-15, y-30, 2, 4); g.drawRect(x-10, y-30, 2, 4); g.endFill();
        g.beginFill(0x334155); g.drawPolygon([x+10, y-25, x+25, y-25, x+22, y-35, x+13, y-35]); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x4ade80, 0.8); glow.drawRect(x+14, y-33, 7, 5); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawPicnicTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x78350f); 
        g.drawRect(x-25, y-15, 50, 4);
        g.drawRect(x-30, y-8, 12, 3);
        g.drawRect(x+18, y-8, 12, 3);
        g.drawPolygon([x-15, y, x-10, y, x, y-15, x-5, y-15]);
        g.drawPolygon([x+15, y, x+10, y, x, y-15, x+5, y-15]);
        g.endFill();
        c.addChild(g);
    },

    drawTree(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x4a2e1a); g.drawRect(x-3, y-30, 6, 30); g.endFill();
        g.beginFill(0x1b4332); g.drawCircle(x, y-35, 15); g.drawCircle(x-10, y-25, 12); g.drawCircle(x+10, y-25, 12); g.endFill();
        g.beginFill(0x2d6a4f); g.drawCircle(x, y-40, 12); g.drawCircle(x-8, y-32, 10); g.drawCircle(x+8, y-32, 10); g.endFill();
        c.addChild(g);
    },

    drawArcadeCabinet(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); g.drawPolygon([x-10,y, x-10,y-30, x-8,y-35, x+8,y-35, x+10,y-30, x+10,y]); g.endFill();
        g.beginFill(0x222222); g.drawRect(x-8, y-32, 16, 12); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-12, y-20, 24, 4); g.endFill(); 
        const glow = new PIXI.Graphics();
        glow.beginFill(0x00ffff, 0.6); glow.drawRect(x-6, y-30, 12, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawCar(c, x, y, col) {
        const cHex = this._parseCol(col);
        const gfx = new PIXI.Graphics();
        gfx.beginFill(cHex); gfx.drawRoundedRect(-22, -18, 44, 18, 4); gfx.endFill();
        gfx.beginFill(cHex, 0.8); gfx.drawRoundedRect(-12, -28, 24, 12, 4); gfx.endFill();
        gfx.beginFill(0x333333); gfx.drawCircle(-12, -1, 4); gfx.drawCircle(12, -1, 4); gfx.endFill();
        gfx.beginFill(0xffffff, 1.0); gfx.drawRect(20, -8, 4, 6); gfx.endFill();
        gfx.beginFill(0xff3333, 1.0); gfx.drawRect(-26, -10, 4, 4); gfx.endFill();
        gfx.x = x; gfx.y = y;
        c.addChild(gfx);
        return gfx;
    },

    // ════════════════════════════════════════════════════════
    //   SILICON WOODS — Billionaire CEO Retreat Props
    // ════════════════════════════════════════════════════════

    drawGlampingDome(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Geodesic dome shell — translucent hexagonal pod
        g.beginFill(0x1e293b, 0.6);
        g.lineStyle(1, 0x38bdf8, 0.4);
        g.drawCircle(x, y - 20, 22);
        g.endFill();
        // Internal geodesic lines
        g.lineStyle(1, 0x38bdf8, 0.2);
        g.moveTo(x - 18, y - 10); g.lineTo(x, y - 40); g.lineTo(x + 18, y - 10);
        g.moveTo(x - 20, y - 20); g.lineTo(x + 20, y - 20);
        g.moveTo(x - 12, y - 35); g.lineTo(x + 12, y - 35);
        g.lineStyle(0);
        // Warm interior glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfbbf24, 0.15); glow.drawCircle(x, y - 18, 16); glow.endFill();
        glow.beginFill(0xfbbf24, 0.3); glow.drawCircle(x, y - 16, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Base platform
        g.beginFill(0x334155); g.drawRect(x - 24, y - 2, 48, 4); g.endFill();
        // Door slit
        g.beginFill(0xfbbf24, 0.4); g.drawRect(x - 3, y - 12, 6, 12); g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'dome' });
    },

    drawFirePitLounge(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Sunken stone pit ring
        g.beginFill(0x1e293b); g.drawEllipse(x, y - 4, 35, 8); g.endFill();
        g.beginFill(0x334155); g.drawEllipse(x, y - 5, 30, 6); g.endFill();
        g.beginFill(0x0f172a); g.drawEllipse(x, y - 5, 22, 4); g.endFill();
        // Ember bed
        g.beginFill(0xef4444, 0.8); g.drawEllipse(x, y - 5, 12, 3); g.endFill();
        g.beginFill(0xfbbf24, 0.6); g.drawEllipse(x, y - 6, 8, 2); g.endFill();
        // Flame particles
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfbbf24, 0.3); glow.drawEllipse(x, y - 12, 14, 10); glow.endFill();
        glow.beginFill(0xef4444, 0.15); glow.drawEllipse(x, y - 16, 20, 14); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Designer Adirondack chairs (4 around the pit)
        const chairCol = 0x78350f;
        [-30, -20, 20, 30].forEach(ox => {
            g.beginFill(chairCol); g.drawRect(x + ox - 4, y - 10, 8, 8); g.endFill();
            g.beginFill(0x92400e); g.drawRect(x + ox - 3, y - 14, 6, 4); g.endFill();
        });
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'firepit' });
    },

    drawWhiskeyBar(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Dark wood bar counter
        g.beginFill(0x3d2914); g.drawRect(x - 30, y - 20, 60, 20); g.endFill();
        g.beginFill(0x4a3520); g.drawRect(x - 32, y - 22, 64, 4); g.endFill();
        // Bar surface shine
        g.beginFill(0xfbbf24, 0.08); g.drawRect(x - 28, y - 20, 56, 2); g.endFill();
        // Backlit bottle shelves
        g.beginFill(0x1a1a2e); g.drawRect(x - 28, y - 40, 56, 18); g.endFill();
        const backlight = new PIXI.Graphics();
        backlight.beginFill(0xfbbf24, 0.2); backlight.drawRect(x - 26, y - 38, 52, 14); backlight.endFill();
        backlight.blendMode = PIXI.BLEND_MODES.ADD;
        // Bottles
        const bottleCols = [0x92400e, 0xfbbf24, 0x7c2d12, 0xd97706, 0x451a03];
        for (let i = 0; i < 5; i++) {
            const bx = x - 20 + i * 10;
            g.beginFill(bottleCols[i]); g.drawRect(bx, y - 38, 4, 12); g.endFill();
            g.beginFill(bottleCols[i], 0.7); g.drawRect(bx + 1, y - 42, 2, 4); g.endFill();
        }
        // Bar stools
        [-20, -8, 8, 20].forEach(ox => {
            g.beginFill(0x111111); g.drawRect(x + ox - 2, y - 4, 4, 4); g.endFill();
            g.beginFill(0x1e293b); g.drawCircle(x + ox, y - 6, 4); g.endFill();
        });
        c.addChild(g, backlight);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: backlight, maxA: 0.3, type: 'bar' });
    },

    drawInfinityHotTub(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Stone surround
        g.beginFill(0x334155); g.drawEllipse(x, y - 6, 32, 10); g.endFill();
        g.beginFill(0x1e293b); g.drawEllipse(x, y - 7, 28, 8); g.endFill();
        // Water
        g.beginFill(0x0ea5e9, 0.6); g.drawEllipse(x, y - 7, 24, 6); g.endFill();
        g.beginFill(0x38bdf8, 0.3); g.drawEllipse(x, y - 8, 18, 4); g.endFill();
        // Steam glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.12); glow.drawEllipse(x, y - 18, 28, 16); glow.endFill();
        glow.beginFill(0xffffff, 0.06); glow.drawEllipse(x - 8, y - 22, 10, 8); glow.drawEllipse(x + 6, y - 20, 8, 6); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Rim lights
        g.beginFill(0x0ea5e9, 0.8);
        g.drawCircle(x - 26, y - 6, 2); g.drawCircle(x + 26, y - 6, 2);
        g.drawCircle(x, y - 14, 1.5);
        g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'pool' });
    },

    drawPuttingGreen(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Manicured green
        g.beginFill(0x166534); g.drawEllipse(x, y - 4, 40, 8); g.endFill();
        g.beginFill(0x15803d); g.drawEllipse(x, y - 5, 36, 6); g.endFill();
        // Putting hole
        g.beginFill(0x0f172a); g.drawCircle(x + 15, y - 5, 3); g.endFill();
        // Flag pin
        g.beginFill(0x94a3b8); g.drawRect(x + 15, y - 28, 2, 23); g.endFill();
        g.beginFill(0xef4444); g.drawPolygon([x + 17, y - 28, x + 27, y - 24, x + 17, y - 20]); g.endFill();
        // Golf ball
        g.beginFill(0xffffff); g.drawCircle(x - 10, y - 4, 2); g.endFill();
        // Sand trap
        g.beginFill(0xfbbf24, 0.3); g.drawEllipse(x - 25, y - 3, 10, 4); g.endFill();
        c.addChild(g);
    },

    drawHelipad(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Concrete pad
        g.beginFill(0x334155); g.drawRect(x - 30, y - 6, 60, 6); g.endFill();
        g.beginFill(0x475569); g.drawRect(x - 28, y - 5, 56, 4); g.endFill();
        // Circle marking
        g.lineStyle(2, 0xfacc15, 0.8); g.drawCircle(x, y - 3, 18); g.lineStyle(0);
        // H marking
        const hTxt = new PIXI.Text('H', { fontFamily: 'Arial', fontSize: 14, fill: 0xfacc15, fontWeight: 'bold' });
        hTxt.anchor.set(0.5, 0.5); hTxt.x = x; hTxt.y = y - 3;
        // Landing lights (corners)
        g.beginFill(0xfacc15, 0.9);
        g.drawCircle(x - 26, y - 1, 2); g.drawCircle(x + 26, y - 1, 2);
        g.drawCircle(x - 26, y - 5, 2); g.drawCircle(x + 26, y - 5, 2);
        g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.1); glow.drawRect(x - 30, y - 10, 60, 14); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow, hTxt);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.15, type: 'helipad' });
    },

    drawStarlinkDish(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tripod base
        g.beginFill(0x64748b); g.drawRect(x - 1, y - 18, 2, 18); g.endFill();
        g.beginFill(0x475569); g.drawRect(x - 6, y - 2, 12, 2); g.endFill();
        // Dish
        g.beginFill(0xf1f5f9);
        g.drawPolygon([x - 12, y - 22, x, y - 30, x + 12, y - 22]);
        g.endFill();
        g.beginFill(0xe2e8f0); g.drawEllipse(x, y - 22, 12, 4); g.endFill();
        // Antenna pip
        g.beginFill(0x22d3ee); g.drawCircle(x, y - 28, 2); g.endFill();
        // Signal glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.3); glow.drawCircle(x, y - 28, 4); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Blinking LEDs on base
        g.beginFill(0x4ade80); g.drawCircle(x - 4, y - 16, 1); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x + 4, y - 16, 1); g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'signal' });
    },

    drawZenGardenProp(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Raked sand base
        g.beginFill(0xd6d3d1, 0.3); g.drawEllipse(x, y - 3, 35, 8); g.endFill();
        // Rake lines
        g.lineStyle(1, 0xa8a29e, 0.3);
        for (let i = -3; i <= 3; i++) {
            g.drawEllipse(x, y - 3, 15 + i * 3, 3 + Math.abs(i));
        }
        g.lineStyle(0);
        // Stones
        g.beginFill(0x44403c); g.drawEllipse(x - 12, y - 4, 6, 4); g.endFill();
        g.beginFill(0x57534e); g.drawEllipse(x + 14, y - 3, 5, 3); g.endFill();
        g.beginFill(0x78716c); g.drawCircle(x + 4, y - 5, 3); g.endFill();
        // Bonsai tree
        g.beginFill(0x4a2e1a); g.drawRect(x + 20, y - 16, 3, 12); g.endFill();
        g.beginFill(0x166534); g.drawEllipse(x + 21, y - 20, 8, 6); g.endFill();
        g.beginFill(0x15803d); g.drawEllipse(x + 18, y - 16, 5, 4); g.drawEllipse(x + 25, y - 17, 5, 3); g.endFill();
        // Ceramic pot
        g.beginFill(0x78350f); g.drawRect(x + 17, y - 6, 8, 6); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x + 16, y - 6, 10, 2); g.endFill();
        c.addChild(g);
    },

    drawLuxuryRedwood(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Massive trunk
        g.beginFill(0x4a2e1a); g.drawRect(x - 5, y - 50, 10, 50); g.endFill();
        g.beginFill(0x3d2514); g.drawRect(x - 4, y - 50, 3, 50); g.endFill();
        // Deep canopy layers
        g.beginFill(0x064e3b); g.drawEllipse(x, y - 55, 22, 14); g.endFill();
        g.beginFill(0x065f46); g.drawEllipse(x - 5, y - 60, 16, 10); g.drawEllipse(x + 8, y - 58, 14, 9); g.endFill();
        g.beginFill(0x047857); g.drawEllipse(x, y - 65, 12, 8); g.endFill();
        // Fairy lights strung in canopy
        const lights = new PIXI.Graphics();
        lights.beginFill(0xfbbf24, 0.8);
        [-14, -8, -2, 4, 10, 16].forEach(ox => {
            lights.drawCircle(x + ox, y - 52 + Math.sin(ox) * 3, 1);
        });
        lights.endFill();
        lights.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, lights);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: lights, maxA: 0.9, type: 'fairy' });
    },

    // ════════════════════════════════════════════════════════
    //   FRONTIER PINES — Launch Viewing Area Props
    // ════════════════════════════════════════════════════════

    drawTelescope(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tripod legs
        g.beginFill(0x475569);
        g.drawPolygon([x - 2, y - 20, x - 12, y, x - 8, y]);
        g.drawPolygon([x + 2, y - 20, x + 12, y, x + 8, y]);
        g.drawRect(x - 1, y - 22, 2, 6);
        g.endFill();
        // Telescope tube
        g.beginFill(0x1e293b);
        g.drawRoundedRect(x - 14, y - 30, 28, 8, 4);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRoundedRect(x - 12, y - 29, 24, 6, 3);
        g.endFill();
        // Lens
        g.beginFill(0x38bdf8, 0.6);
        g.drawCircle(x + 14, y - 26, 4);
        g.endFill();
        // Lens glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.15);
        glow.drawCircle(x + 14, y - 26, 7);
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Eyepiece
        g.beginFill(0x111118);
        g.drawRect(x - 16, y - 28, 4, 4);
        g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'signal' });
    },

    drawViewingPlatform(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Elevated wooden platform
        g.beginFill(0x78350f);
        g.drawRect(x, y - 4, w, 4);
        g.endFill();
        g.beginFill(0x92400e);
        g.drawRect(x, y - 6, w, 3);
        g.endFill();
        // Support posts
        g.beginFill(0x78350f);
        g.drawRect(x + 4, y - 2, 4, 6);
        g.drawRect(x + w - 8, y - 2, 4, 6);
        g.endFill();
        // Railing
        g.beginFill(0x92400e);
        g.drawRect(x, y - 18, 2, 14);
        g.drawRect(x + w - 2, y - 18, 2, 14);
        g.drawRect(x, y - 18, w, 2);
        g.endFill();
        // Railing posts
        for (let rx = x + 10; rx < x + w - 5; rx += 12) {
            g.beginFill(0x92400e);
            g.drawRect(rx, y - 16, 2, 12);
            g.endFill();
        }
        c.addChild(g);
    },

    drawRefreshmentStand(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Cart body
        g.beginFill(0xef4444);
        g.drawRoundedRect(x - 18, y - 28, 36, 22, 3);
        g.endFill();
        g.beginFill(0xb91c1c);
        g.drawRoundedRect(x - 16, y - 26, 32, 18, 2);
        g.endFill();
        // Striped awning
        g.beginFill(0xef4444);
        g.drawRect(x - 22, y - 34, 44, 8);
        g.endFill();
        for (let sx = x - 20; sx < x + 22; sx += 8) {
            g.beginFill(0xffffff, 0.3);
            g.drawRect(sx, y - 34, 4, 8);
            g.endFill();
        }
        // Counter shelf
        g.beginFill(0x4a2e1a);
        g.drawRect(x - 20, y - 8, 40, 3);
        g.endFill();
        // Drinks / items on counter
        g.beginFill(0xfbbf24); g.drawRect(x - 10, y - 14, 4, 6); g.endFill();
        g.beginFill(0x22d3ee); g.drawRect(x - 2, y - 14, 4, 6); g.endFill();
        g.beginFill(0xef4444); g.drawRect(x + 6, y - 14, 4, 6); g.endFill();
        // Wheels
        g.beginFill(0x333333);
        g.drawCircle(x - 12, y, 3);
        g.drawCircle(x + 12, y, 3);
        g.endFill();
        // Sign
        const sign = new PIXI.Text('SNACKS', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 5, fill: 0xffffff, fontWeight: 'bold'
        });
        sign.anchor.set(0.5, 0.5);
        sign.x = x; sign.y = y - 31;
        c.addChild(g, sign);
    },

    drawBinoculars(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Coin-operated viewfinder on a pole
        g.beginFill(0x475569);
        g.drawRect(x - 2, y - 30, 4, 30);
        g.endFill();
        // Viewfinder body
        g.beginFill(0x334155);
        g.drawRoundedRect(x - 10, y - 38, 20, 10, 3);
        g.endFill();
        // Eyepieces
        g.beginFill(0x111118);
        g.drawCircle(x - 5, y - 33, 3);
        g.drawCircle(x + 5, y - 33, 3);
        g.endFill();
        // Lenses
        g.beginFill(0x38bdf8, 0.5);
        g.drawCircle(x - 5, y - 33, 2);
        g.drawCircle(x + 5, y - 33, 2);
        g.endFill();
        // Coin slot indicator
        g.beginFill(0xfbbf24);
        g.drawCircle(x + 8, y - 28, 1.5);
        g.endFill();
        // Base
        g.beginFill(0x475569);
        g.drawRect(x - 6, y - 2, 12, 2);
        g.endFill();
        c.addChild(g);
    },

    drawCountdownBoard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pole
        g.beginFill(0x475569);
        g.drawRect(x - 2, y - 50, 4, 50);
        g.endFill();
        // Screen
        g.beginFill(0x0a0a15);
        g.drawRect(x - 28, y - 54, 56, 22);
        g.endFill();
        g.beginFill(0x111120);
        g.drawRect(x - 26, y - 52, 52, 18);
        g.endFill();
        // Border glow
        g.lineStyle(1, 0xef4444, 0.4);
        g.drawRect(x - 28, y - 54, 56, 22);
        g.lineStyle(0);
        // Static text
        const txt = new PIXI.Text('NEXT LAUNCH', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: 0xef4444, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 0.5);
        txt.x = x; txt.y = y - 46;
        const countTxt = new PIXI.Text('STANDBY', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x22d3ee, fontWeight: 'bold'
        });
        countTxt.anchor.set(0.5, 0.5);
        countTxt.x = x; countTxt.y = y - 38;
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(0xef4444, 0.06);
        screenGlow.drawRect(x - 28, y - 54, 56, 22);
        screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, screenGlow, txt, countTxt);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: screenGlow, maxA: 0.1, type: 'screen' });
    },

    drawBlanketArea(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Picnic blanket on ground
        g.beginFill(0xef4444, 0.4);
        g.drawRect(x - 15, y - 3, 30, 6);
        g.endFill();
        g.beginFill(0xffffff, 0.15);
        for (let bx = x - 13; bx < x + 15; bx += 6) {
            g.drawRect(bx, y - 2, 3, 4);
        }
        g.endFill();
        // Thermos
        g.beginFill(0x475569);
        g.drawRect(x + 14, y - 8, 4, 8);
        g.endFill();
        g.beginFill(0xef4444);
        g.drawRect(x + 14, y - 10, 4, 3);
        g.endFill();
        c.addChild(g);
    },

    drawFrontierPine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rugged pine — darker than luxury redwoods
        g.beginFill(0x3d2514);
        g.drawRect(x - 3, y - 40, 6, 40);
        g.endFill();
        g.beginFill(0x064e3b);
        g.drawPolygon([x, y - 55, x - 16, y - 25, x + 16, y - 25]);
        g.endFill();
        g.beginFill(0x065f46);
        g.drawPolygon([x, y - 48, x - 12, y - 30, x + 12, y - 30]);
        g.endFill();
        g.beginFill(0x047857);
        g.drawPolygon([x, y - 42, x - 8, y - 32, x + 8, y - 32]);
        g.endFill();
        c.addChild(g);
    },

    // ─── NEW SOCIAL BUILDING PROPS ───

    drawCoffeeMachine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-12, y-30, 24, 30); g.endFill();
        g.beginFill(0x334155); g.drawRect(x-14, y-32, 28, 4); g.endFill();
        // Steam vent
        g.beginFill(0x94a3b8, 0.3); g.drawRect(x-2, y-38, 4, 6); g.endFill();
        // Buttons
        g.beginFill(0x4ade80); g.drawCircle(x-5, y-20, 2); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x+5, y-20, 2); g.endFill();
        // Cup slot
        g.beginFill(0x0f172a); g.drawRect(x-6, y-12, 12, 10); g.endFill();
        // Cup
        g.beginFill(0xf8fafc); g.drawRect(x-4, y-10, 8, 8); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x-3, y-9, 6, 5); g.endFill();
        c.addChild(g);
    },

    drawMenuBoard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Board
        g.beginFill(0x1c1917); g.drawRect(x-25, y-45, 50, 35); g.endFill();
        g.beginFill(0x78350f); g.lineStyle(2, 0x78350f); g.drawRect(x-27, y-47, 54, 39); g.endFill(); g.lineStyle(0);
        // Menu lines (chalk style)
        g.beginFill(0xf8fafc, 0.7);
        g.drawRect(x-18, y-40, 30, 2);
        g.drawRect(x-18, y-34, 22, 1.5);
        g.drawRect(x-18, y-29, 26, 1.5);
        g.drawRect(x-18, y-24, 18, 1.5);
        g.drawRect(x-18, y-19, 24, 1.5);
        g.endFill();
        // Price column
        g.beginFill(0xfbbf24, 0.6);
        g.drawRect(x+10, y-34, 10, 1.5);
        g.drawRect(x+10, y-29, 10, 1.5);
        g.drawRect(x+10, y-24, 10, 1.5);
        g.endFill();
        c.addChild(g);
    },

    drawScoreboard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Screen frame
        g.beginFill(0x0f172a); g.drawRect(x-40, y-40, 80, 30); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x-38, y-38, 76, 26); g.endFill();
        // Score bars
        g.beginFill(0xef4444, 0.6); g.drawRect(x-34, y-34, 30, 8); g.endFill();
        g.beginFill(0x38bdf8, 0.6); g.drawRect(x-34, y-22, 22, 8); g.endFill();
        // VS text area
        g.beginFill(0xfbbf24, 0.8); g.drawRect(x+5, y-30, 12, 12); g.endFill();
        // Mount
        g.beginFill(0x334155); g.drawRect(x-2, y-10, 4, 10); g.endFill();
        // Glow
        const glow = new PIXI.Graphics(); glow.eventMode = 'none';
        glow.beginFill(0xef4444, 0.04); glow.drawRect(x-50, y-45, 100, 40); glow.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'screen' });
    },

    drawVendingMachine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-14, y-40, 28, 40); g.endFill();
        g.beginFill(0x334155); g.drawRect(x-12, y-38, 24, 28); g.endFill();
        // Product display
        for (var vy=y-35; vy<y-12; vy+=8) {
            for (var vx2=x-9; vx2<x+9; vx2+=7) {
                g.beginFill(Math.random() > 0.5 ? 0x22d3ee : 0x4ade80, 0.6);
                g.drawRect(vx2, vy, 5, 5); g.endFill();
            }
        }
        // Coin slot
        g.beginFill(0x0f172a); g.drawRect(x-4, y-8, 8, 4); g.endFill();
        // Brand light
        g.beginFill(0x38bdf8, 0.3); g.drawRect(x-10, y-38, 20, 3); g.endFill();
        c.addChild(g);
    },

    drawMirrorWall(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const mw = w || 80;
        g.beginFill(0x94a3b8, 0.15); g.drawRect(x - mw/2, y-50, mw, 46); g.endFill();
        g.lineStyle(1, 0xffffff, 0.2); g.drawRect(x - mw/2, y-50, mw, 46); g.lineStyle(0);
        // Reflection streaks
        g.beginFill(0xffffff, 0.08);
        g.drawRect(x - mw/2 + 5, y-48, 3, 42);
        g.drawRect(x - mw/2 + 15, y-46, 2, 38);
        g.drawRect(x + mw/4, y-48, 3, 42);
        g.endFill();
        c.addChild(g);
    },

    drawSpotlight(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Fixture
        g.beginFill(0x1e293b); g.drawRect(x-6, y-55, 12, 6); g.endFill();
        // Beam
        g.beginFill(col || 0xfbbf24, 0.06);
        g.drawPolygon([x-4, y-49, x+4, y-49, x+30, y, x-30, y]);
        g.endFill();
        c.addChild(g);
    },

    drawBarStool(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x334155); g.drawRect(x-1.5, y-18, 3, 18); g.endFill();
        g.beginFill(0x475569); g.drawRect(x-5, y, 10, 2); g.endFill();
        g.beginFill(0x78350f); g.drawEllipse(x, y-18, 7, 3); g.endFill();
        c.addChild(g);
    },

    // ════════════════════════════════════════════════════════
    //   EXPANDED CAFÉ PROPS
    // ════════════════════════════════════════════════════════

    drawCafeCouch(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const cHex = col || 0x8b4513;
        // Seat
        g.beginFill(cHex, 0.6); g.drawRoundedRect(x-22, y-12, 44, 12, 3); g.endFill();
        // Back
        g.beginFill(cHex, 0.4); g.drawRoundedRect(x-22, y-24, 44, 14, 3); g.endFill();
        // Arms
        g.beginFill(cHex, 0.5); g.drawRoundedRect(x-26, y-20, 6, 20, 2); g.drawRoundedRect(x+20, y-20, 6, 20, 2); g.endFill();
        // Cushions
        g.beginFill(0xfbbf24, 0.3); g.drawCircle(x-8, y-14, 4); g.drawCircle(x+8, y-14, 4); g.endFill();
        c.addChild(g);
    },

    drawCafeBookshelf(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Shelf frame
        g.beginFill(0x3d2914); g.drawRect(x-18, y-50, 36, 50); g.endFill();
        g.beginFill(0x2a1f0e); g.drawRect(x-16, y-48, 32, 46); g.endFill();
        // Shelves
        g.beginFill(0x4a3520); g.drawRect(x-16, y-36, 32, 2); g.drawRect(x-16, y-22, 32, 2); g.drawRect(x-16, y-8, 32, 2); g.endFill();
        // Books (random colors)
        const bookCols = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0x06b6d4];
        for (let shelf = 0; shelf < 3; shelf++) {
            const shelfY = y - 47 + shelf * 14;
            let bx = x - 14;
            while (bx < x + 14) {
                const bw = 3 + Math.random() * 3;
                const bh = 8 + Math.random() * 4;
                g.beginFill(bookCols[Math.floor(Math.random() * bookCols.length)]);
                g.drawRect(bx, shelfY + (12 - bh), bw, bh);
                g.endFill();
                bx += bw + 1;
            }
        }
        c.addChild(g);
    },

    drawPastryDisplay(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass case
        g.beginFill(0x1e293b); g.drawRect(x-20, y-18, 40, 18); g.endFill();
        g.lineStyle(1, 0xffffff, 0.15); g.drawRect(x-18, y-30, 36, 14); g.lineStyle(0);
        g.beginFill(0x111118, 0.4); g.drawRect(x-18, y-30, 36, 14); g.endFill();
        // Pastries inside
        g.beginFill(0xd97706); g.drawEllipse(x-8, y-22, 5, 3); g.endFill();
        g.beginFill(0xca8a04); g.drawEllipse(x+4, y-23, 4, 3); g.endFill();
        g.beginFill(0xfbbf24); g.drawCircle(x+12, y-22, 3); g.endFill();
        g.beginFill(0x92400e); g.drawEllipse(x-2, y-20, 6, 2); g.endFill();
        // Top counter
        g.beginFill(0xf1f5f9); g.drawRect(x-22, y-18, 44, 3); g.endFill();
        c.addChild(g);
    },

    drawKitchenOven(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Oven body
        g.beginFill(0x475569); g.drawRect(x-16, y-35, 32, 35); g.endFill();
        // Oven door
        g.beginFill(0x334155); g.drawRect(x-12, y-28, 24, 16); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x-10, y-26, 20, 12); g.endFill();
        // Window
        g.beginFill(0xf97316, 0.2); g.drawRect(x-8, y-24, 16, 8); g.endFill();
        // Handle
        g.beginFill(0xcbd5e1); g.drawRect(x-10, y-12, 20, 2); g.endFill();
        // Burner dials
        g.beginFill(0x111118); g.drawCircle(x-8, y-32, 2); g.drawCircle(x, y-32, 2); g.drawCircle(x+8, y-32, 2); g.endFill();
        // Warm glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0xf97316, 0.15); glow.drawRect(x-8, y-24, 16, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'fire' });
    },

    drawPrepStation(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Counter
        g.beginFill(0x475569); g.drawRect(x-20, y-18, 40, 18); g.endFill();
        g.beginFill(0xe2e8f0); g.drawRect(x-22, y-18, 44, 3); g.endFill();
        // Cutting board
        g.beginFill(0x78350f); g.drawRect(x-12, y-22, 16, 2); g.endFill();
        // Knife
        g.beginFill(0xcbd5e1); g.drawRect(x+6, y-24, 1, 6); g.endFill();
        g.beginFill(0x4a2e1a); g.drawRect(x+5, y-19, 3, 4); g.endFill();
        // Ingredients
        g.beginFill(0xef4444); g.drawCircle(x-8, y-22, 2); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x-3, y-23, 2); g.endFill();
        c.addChild(g);
    },

    drawOutdoorTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Umbrella pole
        g.beginFill(0x888888); g.drawRect(x-1, y-45, 2, 30); g.endFill();
        // Umbrella canopy
        g.beginFill(0xef4444, 0.7); g.drawPolygon([x, y-48, x-24, y-38, x+24, y-38]); g.endFill();
        g.beginFill(0xffffff, 0.15); g.drawPolygon([x, y-48, x-8, y-38, x+8, y-38]); g.endFill();
        // Table
        g.beginFill(0xf1f5f9); g.drawEllipse(x, y-15, 18, 4); g.endFill();
        g.beginFill(0x888888); g.drawRect(x-1, y-15, 2, 15); g.endFill();
        // Chairs
        g.beginFill(0x475569); g.drawRect(x-16, y-8, 6, 8); g.drawRect(x+10, y-8, 6, 8); g.endFill();
        c.addChild(g);
    },

    drawStringLights(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.lineStyle(1, 0x888888, 0.4);
        // Wire
        const segments = Math.floor(w / 20);
        for (let i = 0; i <= segments; i++) {
            const lx = x + (i / segments) * w;
            const ly = y + Math.sin(i * 0.5) * 3;
            if (i === 0) g.moveTo(lx, ly);
            else g.lineTo(lx, ly);
        }
        g.lineStyle(0);
        // Bulbs
        const bulbCols = [0xfbbf24, 0xef4444, 0x22c55e, 0x3b82f6, 0xf97316];
        for (let i = 0; i <= segments; i++) {
            const lx = x + (i / segments) * w;
            const ly = y + Math.sin(i * 0.5) * 3 + 2;
            g.beginFill(bulbCols[i % bulbCols.length], 0.8);
            g.drawCircle(lx, ly, 1.5);
            g.endFill();
        }
        const glow = new PIXI.Graphics();
        for (let i = 0; i <= segments; i++) {
            const lx = x + (i / segments) * w;
            const ly = y + Math.sin(i * 0.5) * 3 + 2;
            glow.beginFill(bulbCols[i % bulbCols.length], 0.15);
            glow.drawCircle(lx, ly, 4);
            glow.endFill();
        }
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'fairy' });
    },

    // ════════════════════════════════════════════════════════
    //   EXPANDED GYM PROPS
    // ════════════════════════════════════════════════════════

    drawYogaMat(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const cols = [0xa855f7, 0x06b6d4, 0x22c55e, 0xf472b6];
        const col = cols[Math.floor(Math.random() * cols.length)];
        // Mat
        g.beginFill(col, 0.5); g.drawRoundedRect(x-20, y-3, 40, 3, 1); g.endFill();
        g.beginFill(col, 0.3); g.drawEllipse(x, y-2, 20, 2); g.endFill();
        // Rolled edge
        g.beginFill(col, 0.7); g.drawEllipse(x+20, y-3, 2, 2); g.endFill();
        c.addChild(g);
    },

    drawExerciseBall(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const cols = [0x3b82f6, 0xef4444, 0xa855f7];
        const col = cols[Math.floor(Math.random() * cols.length)];
        g.beginFill(col, 0.6); g.drawCircle(x, y-10, 10); g.endFill();
        g.beginFill(0xffffff, 0.15); g.drawEllipse(x-3, y-14, 4, 3); g.endFill();
        // Shadow
        g.beginFill(0x000000, 0.15); g.drawEllipse(x, y, 10, 3); g.endFill();
        c.addChild(g);
    },

    drawPoolLane(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pool edge
        g.beginFill(0x1e293b); g.drawRect(x-50, y-4, 100, 4); g.endFill();
        g.beginFill(0xe2e8f0); g.drawRect(x-52, y-5, 104, 2); g.endFill();
        // Water
        g.beginFill(0x0284c7, 0.5); g.drawRect(x-48, y-3, 96, 3); g.endFill();
        // Lane dividers
        g.beginFill(0xfbbf24, 0.4); g.drawRect(x-48, y-3, 96, 1); g.endFill();
        // Water shimmer
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.2); glow.drawRect(x-48, y-15, 96, 12); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.3, type: 'signal' });
    },

    drawSteamRoom(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Room box
        g.beginFill(0x3d2914); g.drawRect(x-25, y-35, 50, 35); g.endFill();
        g.beginFill(0x2a1f0e); g.drawRect(x-22, y-32, 44, 30); g.endFill();
        // Wooden bench
        g.beginFill(0x78350f); g.drawRect(x-18, y-12, 36, 4); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x-16, y-8, 4, 8); g.drawRect(x+12, y-8, 4, 8); g.endFill();
        // Door
        g.beginFill(0x4a3520); g.drawRect(x-4, y-28, 8, 26); g.endFill();
        g.beginFill(0xcbd5e1); g.drawCircle(x+2, y-14, 1.5); g.endFill();
        // Steam wisps
        const steam = new PIXI.Graphics();
        steam.beginFill(0xffffff, 0.08);
        steam.drawEllipse(x-8, y-20, 8, 4);
        steam.drawEllipse(x+6, y-24, 6, 3);
        steam.drawEllipse(x-2, y-28, 5, 3);
        steam.endFill();
        c.addChild(g, steam);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: steam, maxA: 0.12, type: 'fire' });
    },

    drawLockerRow(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        for (let i = 0; i < 5; i++) {
            const lx = x + i * 12;
            g.beginFill(0x334155); g.drawRect(lx, y-35, 10, 35); g.endFill();
            g.beginFill(0x475569); g.drawRect(lx+1, y-33, 8, 31); g.endFill();
            // Handle
            g.beginFill(0xcbd5e1); g.drawRect(lx+6, y-18, 2, 4); g.endFill();
            // Vent
            g.lineStyle(1, 0x555555, 0.3);
            g.moveTo(lx+2, y-30); g.lineTo(lx+7, y-30);
            g.moveTo(lx+2, y-28); g.lineTo(lx+7, y-28);
            g.lineStyle(0);
        }
        c.addChild(g);
    },

    // ════════════════════════════════════════════════════════
    //   EXPANDED ARENA PROPS
    // ════════════════════════════════════════════════════════

    drawCommentaryDesk(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Long desk
        g.beginFill(0x1e293b); g.drawRect(x-40, y-18, 80, 18); g.endFill();
        g.beginFill(0x334155); g.drawRect(x-42, y-18, 84, 4); g.endFill();
        // Monitors (3)
        for (let i = -1; i <= 1; i++) {
            g.beginFill(0x0f172a); g.drawRect(x + i*26 - 10, y-35, 20, 14); g.endFill();
            const glow = new PIXI.Graphics();
            glow.beginFill(0x38bdf8, 0.4); glow.drawRect(x + i*26 - 8, y-33, 16, 10); glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            c.addChild(glow);
            if (!this.indoorLights) this.indoorLights = [];
            this.indoorLights.push({ g: glow, maxA: 0.5, type: 'ceiling' });
        }
        // Microphones
        g.beginFill(0x555555); g.drawRect(x-20, y-24, 1, 6); g.drawRect(x+20, y-24, 1, 6); g.endFill();
        g.beginFill(0x222222); g.drawCircle(x-20, y-25, 2); g.drawCircle(x+20, y-25, 2); g.endFill();
        // Chairs
        g.beginFill(0x1e293b); g.drawRect(x-18, y-8, 8, 8); g.drawRect(x+10, y-8, 8, 8); g.endFill();
        c.addChild(g);
    },

    drawTrophyCase(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Glass case
        g.beginFill(0x1e293b); g.drawRect(x-18, y-45, 36, 45); g.endFill();
        g.lineStyle(1, 0xffffff, 0.1); g.drawRect(x-16, y-42, 32, 38); g.lineStyle(0);
        g.beginFill(0x111118, 0.3); g.drawRect(x-16, y-42, 32, 38); g.endFill();
        // Shelves
        g.beginFill(0x334155); g.drawRect(x-16, y-28, 32, 2); g.drawRect(x-16, y-14, 32, 2); g.endFill();
        // Trophies
        const tCols = [0xfbbf24, 0xcbd5e1, 0xcd7f32];
        for (let s = 0; s < 3; s++) {
            const sy = y - 40 + s * 14;
            g.beginFill(tCols[s]);
            g.drawPolygon([x-4, sy+10, x+4, sy+10, x+2, sy+4, x-2, sy+4]);
            g.drawCircle(x-5, sy+6, 2); g.drawCircle(x+5, sy+6, 2);
            g.endFill();
        }
        // Warm glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfbbf24, 0.1); glow.drawRect(x-16, y-42, 32, 38); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.15, type: 'signal' });
    },

    drawAudienceStands(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const hw = w || 80;
        // Tiered seating
        for (let row = 0; row < 3; row++) {
            const ry = y - 4 - row * 10;
            const rw = hw - row * 12;
            g.beginFill(0x1e293b); g.drawRect(x - rw/2, ry - 6, rw, 6); g.endFill();
            g.beginFill(0x334155); g.drawRect(x - rw/2, ry - 8, rw, 3); g.endFill();
        }
        c.addChild(g);
    },

    drawJumbotron(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Frame
        g.beginFill(0x0f172a); g.drawRect(x-35, y-45, 70, 35); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x-37, y-47, 74, 2); g.drawRect(x-37, y-10, 74, 2); g.endFill();
        // Screen content (ELO display)
        const glow = new PIXI.Graphics();
        glow.beginFill(0xef4444, 0.25); glow.drawRect(x-30, y-42, 28, 28); glow.endFill();
        glow.beginFill(0x3b82f6, 0.25); glow.drawRect(x+2, y-42, 28, 28); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // VS text
        const vs = new PIXI.Text('VS', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0xffffff, fontWeight: 'bold' });
        vs.anchor.set(0.5); vs.x = x; vs.y = y - 28;
        // Stand
        g.beginFill(0x334155); g.drawRect(x-2, y-10, 4, 10); g.endFill();
        c.addChild(g, glow, vs);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.35, type: 'ceiling' });
    },

    drawLeaderboard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Board
        g.beginFill(0x0f172a); g.drawRect(x-22, y-50, 44, 46); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x-24, y-52, 48, 2); g.endFill();
        // Rows
        const rowCols = [0xfbbf24, 0xcbd5e1, 0xcd7f32, 0x64748b, 0x64748b];
        for (let i = 0; i < 5; i++) {
            g.beginFill(rowCols[i], 0.4); g.drawRect(x-18, y-46 + i*8, 36, 6); g.endFill();
        }
        // Glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.1); glow.drawRect(x-22, y-50, 44, 46); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.15, type: 'signal' });
    },

    // ════════════════════════════════════════════════════════
    //   OPEN SOURCE HUB PROPS
    // ════════════════════════════════════════════════════════

    drawContributorWall(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Large wall panel
        g.beginFill(0x1e293b); g.drawRect(x-40, y-45, 80, 42); g.endFill();
        // Git contribution graph style grid
        const cols = [0x0e4429, 0x006d32, 0x26a641, 0x39d353];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 12; col++) {
                const intensity = Math.random();
                const fillCol = intensity < 0.3 ? 0x161b22 : cols[Math.floor(intensity * cols.length)];
                g.beginFill(fillCol);
                g.drawRect(x - 36 + col * 6, y - 42 + row * 6, 4, 4);
                g.endFill();
            }
        }
        // Title
        const title = new PIXI.Text('CONTRIBUTORS', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x8b949e });
        title.anchor.set(0.5); title.x = x; title.y = y - 46;
        c.addChild(g, title);
    },

    drawHackathonDesk(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Long shared desk
        g.beginFill(0x1e293b); g.drawRect(x-30, y-18, 60, 18); g.endFill();
        g.beginFill(0x334155); g.drawRect(x-32, y-18, 64, 3); g.endFill();
        // Multiple laptops
        for (let i = -1; i <= 1; i++) {
            const lx = x + i * 20;
            // Laptop base
            g.beginFill(0x475569); g.drawRect(lx-7, y-20, 14, 2); g.endFill();
            // Laptop screen
            g.beginFill(0x0f172a); g.drawRect(lx-6, y-30, 12, 10); g.endFill();
            const glow = new PIXI.Graphics();
            const sc = [0x22c55e, 0x06b6d4, 0xa855f7][i+1];
            glow.beginFill(sc, 0.4); glow.drawRect(lx-5, y-29, 10, 8); glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            c.addChild(glow);
            if (!this.indoorLights) this.indoorLights = [];
            this.indoorLights.push({ g: glow, maxA: 0.4, type: 'ceiling' });
        }
        // Energy drinks
        g.beginFill(0xef4444); g.drawRect(x+22, y-24, 4, 6); g.endFill();
        g.beginFill(0x22c55e); g.drawRect(x-26, y-23, 4, 5); g.endFill();
        c.addChild(g);
    },

    drawWhiteboard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Board
        g.beginFill(0xf1f5f9); g.drawRect(x-30, y-45, 60, 35); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(x-32, y-47, 64, 3); g.drawRect(x-32, y-10, 64, 3); g.endFill();
        // Scribbles (architecture diagrams)
        g.lineStyle(1, 0x3b82f6, 0.6);
        g.drawRect(x-20, y-38, 12, 8);
        g.moveTo(x-8, y-34); g.lineTo(x+2, y-34);
        g.drawRect(x+2, y-38, 12, 8);
        g.lineStyle(1, 0xef4444, 0.4);
        g.moveTo(x-15, y-25); g.lineTo(x+15, y-25);
        g.moveTo(x-15, y-22); g.lineTo(x+10, y-22);
        g.lineStyle(1, 0x22c55e, 0.5);
        g.drawCircle(x-10, y-16, 3); g.moveTo(x-7, y-16); g.lineTo(x+5, y-16); g.drawCircle(x+8, y-16, 3);
        g.lineStyle(0);
        // Markers in tray
        g.beginFill(0xef4444); g.drawRect(x-25, y-9, 8, 2); g.endFill();
        g.beginFill(0x3b82f6); g.drawRect(x-15, y-9, 8, 2); g.endFill();
        g.beginFill(0x22c55e); g.drawRect(x-5, y-9, 8, 2); g.endFill();
        c.addChild(g);
    },

    drawOpenServerRack(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Open frame rack (no doors)
        g.beginFill(0x222233); g.drawRect(x-14, y-45, 28, 45); g.endFill();
        // Rails
        g.beginFill(0x475569); g.drawRect(x-14, y-45, 2, 45); g.drawRect(x+12, y-45, 2, 45); g.endFill();
        // Server units
        for (let i = 0; i < 5; i++) {
            const sy = y - 42 + i * 8;
            g.beginFill(0x1a1a2e); g.drawRect(x-12, sy, 24, 6); g.endFill();
            // Status LEDs
            g.beginFill(0x4ade80); g.drawCircle(x-8, sy+3, 1); g.endFill();
            g.beginFill(Math.random() > 0.5 ? 0x4ade80 : 0xfbbf24); g.drawCircle(x-4, sy+3, 1); g.endFill();
        }
        // Activity glow
        const glow = new PIXI.Graphics();
        for (let i = 0; i < 5; i++) {
            glow.beginFill(0x4ade80, 0.15); glow.drawCircle(x-8, y-39+i*8, 2); glow.endFill();
        }
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'signal' });
    },

    drawGardenPlanter(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Planter box
        g.beginFill(0x78350f); g.drawRect(x-15, y-10, 30, 10); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x-17, y-10, 34, 3); g.endFill();
        // Soil
        g.beginFill(0x3d2914); g.drawRect(x-13, y-12, 26, 4); g.endFill();
        // Plants
        g.beginFill(0x166534); g.drawCircle(x-6, y-18, 5); g.drawCircle(x+4, y-16, 4); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x-4, y-20, 3); g.drawCircle(x+6, y-18, 3); g.endFill();
        // Flowers
        g.beginFill(0xfbbf24); g.drawCircle(x-8, y-22, 2); g.endFill();
        g.beginFill(0xf472b6); g.drawCircle(x+2, y-20, 2); g.endFill();
        c.addChild(g);
    },

    drawHammock(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Poles
        g.beginFill(0x4a2e1a); g.drawRect(x-25, y-30, 3, 30); g.drawRect(x+22, y-30, 3, 30); g.endFill();
        // Hammock fabric (catenary curve)
        g.beginFill(0x06b6d4, 0.4);
        g.moveTo(x-24, y-25);
        g.bezierCurveTo(x-10, y-10, x+10, y-10, x+24, y-25);
        g.lineTo(x+24, y-22);
        g.bezierCurveTo(x+10, y-8, x-10, y-8, x-24, y-22);
        g.closePath();
        g.endFill();
        // Rope lines
        g.lineStyle(1, 0x888888, 0.4);
        g.moveTo(x-24, y-28); g.lineTo(x-24, y-25);
        g.moveTo(x+24, y-28); g.lineTo(x+24, y-25);
        g.lineStyle(0);
        c.addChild(g);
    }
};
