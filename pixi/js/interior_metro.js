/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO STATION INTERIOR (v1.4.0 — Avatar parity with exterior: paramScale, lifecycle stage, MoE)
   Renders a station cross-section: ticket hall above + glass elevator shaft + platform + tracks + tunnels.
   Mirrors real-time state of BOTH AI models (G.models/charRefs) AND worker NPCs
   (NPCHousing.commuters) so every entity using this station is visible inside.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorMetroStation = {
    scene: null,
    layer: null,
    bld: null,
    avatarLayer: null,
    avatarPool: null,
    trainGfx: null,
    _tunnelLightsCont: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _noYScroll: false,
    _startY: 0,
    _startSceneY: 0,
    minY: 0,
    maxY: 0,
    STATION_THEME: {
        'metro_dc':        { col: 0x06b6d4, label: 'COMPUTE DISTRICT',   sub: 'Line 1 · Westbound Terminus' },
        'metro_res':       { col: 0x38bdf8, label: 'RESIDENTIAL SECTOR', sub: 'Line 1 · Residential' },
        'metro_hq':        { col: 0xfacc15, label: 'TECH DISTRICT',      sub: 'Line 1 · Lab Row Interchange' },
        'metro_mid':       { col: 0xf97316, label: 'CENTRAL LINE',       sub: 'Line 2 · Mid-Tech' },
        'metro_east':      { col: 0xa855f7, label: 'EASTERN HUB',        sub: 'Line 2 · Neon Quarter' },
        'metro_longevity': { col: 0x22c55e, label: 'INNOVATION LINE',    sub: 'Line 2 · Innovation Corridor Terminus' }
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.avatarPool = new Map();
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.STATION_THEME[bld.id] || { col: 0x22d3ee, label: bld.name ? bld.name.toUpperCase() : 'METRO STATION', sub: '' };

        // Scene container (scrollable)
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── SKY LAYER ───
        this.skyContainer = new PIXI.Container();
        this.skyContainer.eventMode = 'none';
        this.scene.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 40; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff);
            s.drawCircle(0, 0, 0.5 + Math.random() * 1.2);
            s.endFill();
            s.x = Math.random() * W;
            s.y = Math.random() * 30;
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);

        // ─── Layout bands ───
        const hallH = 140;
        const stairH = 110;
        const platH = 240;
        const deepH = 300;   // extended deep strata for full city stack
        const totalH = hallH + stairH + platH + deepH;

        this.totalH = totalH;
        this.maxY = 80;                       // allow scrolling up to see sky above roof
        this.minY = Math.min(0, H - totalH);

        // ─── STATION CANOPY / ROOF (y=0..30) ───
        const canopy = new PIXI.Graphics();
        // Steel canopy structure — dark base
        canopy.beginFill(0x0f172a);
        canopy.drawRect(0, 0, W, 30);
        canopy.endFill();
        // Sloped overhang fascia
        canopy.beginFill(0x1e293b);
        canopy.drawRect(0, 0, W, 6);
        canopy.endFill();
        canopy.beginFill(theme.col, 0.6);
        canopy.drawRect(0, 0, W, 3);   // coloured accent strip at top edge
        canopy.endFill();
        // Steel I-beam supports
        canopy.beginFill(0x334155);
        for (let bx = 40; bx < W; bx += 80) {
            canopy.drawRect(bx - 2, 6, 4, 24);
            canopy.drawRect(bx - 6, 6, 12, 3);   // top flange
            canopy.drawRect(bx - 6, 27, 12, 3);   // bottom flange
        }
        canopy.endFill();
        // Glass skylight panels between beams (semi-transparent)
        for (let lx = 40; lx < W - 40; lx += 80) {
            canopy.beginFill(0x94a3b8, 0.08);
            canopy.drawRect(lx + 8, 8, 60, 18);
            canopy.endFill();
            canopy.lineStyle(1, 0x475569, 0.4);
            canopy.drawRect(lx + 8, 8, 60, 18);
            canopy.moveTo(lx + 38, 8);
            canopy.lineTo(lx + 38, 26);
            canopy.lineStyle(0);
        }
        // Underside lip with warm LED strip
        canopy.beginFill(0x1a2538);
        canopy.drawRect(0, 28, W, 2);
        canopy.endFill();
        canopy.beginFill(0xfbbf24, 0.25);
        canopy.drawRect(0, 28, W, 1);
        canopy.endFill();
        // Station name on canopy
        const canopyName = new PIXI.Text('M', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 14,
            fill: theme.col, fontWeight: 'bold'
        });
        canopyName.anchor.set(0.5, 0.5);
        canopyName.x = W / 2;
        canopyName.y = 15;
        canopy.addChild(canopyName);
        this.scene.addChild(canopy);

        // ─── STREET / SIDEWALK LEVEL ───
        const street = new PIXI.Graphics();
        street.beginFill(0x2a2a3a);
        street.drawRect(0, 30, W, 8);
        street.endFill();
        street.beginFill(0x3a3a4a);
        street.drawRect(0, 36, W, 2);
        street.endFill();
        street.beginFill(0xfbbf24, 0.5);
        for (let dx = 0; dx < W; dx += 30) street.drawRect(dx, 33, 14, 1);
        street.endFill();
        this.scene.addChild(street);

        // ─── TICKET HALL ───
        const hallTop = 38;
        const hallBottom = hallH;
        const hallH_total = hallBottom - hallTop;
        const hall = new PIXI.Graphics();
        const hallX = 40, hallW = W - 80;
        const headerH = 26;
        const winY = hallTop + headerH;
        const winH_px = 22;
        const winX = hallX + 24;
        const winW = hallW - 48;
        const mullionPitch = 90;
        const mullionW = 8;

        InteriorCity._drawWallWithWindowCutout(
            hall, 0xf5f5f5,
            hallX, hallTop, hallW, hallH_total,
            winX, winY, winW, winH_px,
            mullionPitch, mullionW
        );
        // Header accent
        hall.beginFill(theme.col, 0.18);
        hall.drawRect(hallX, hallTop, hallW, headerH);
        hall.endFill();
        hall.beginFill(theme.col, 0.85);
        hall.drawRect(hallX, hallTop, hallW, 3);
        hall.endFill();
        // Window frames
        hall.lineStyle(1.5, 0x64748b, 0.9);
        hall.drawRect(winX, winY, winW, winH_px);
        hall.moveTo(winX, winY + winH_px * 0.55);
        hall.lineTo(winX + winW, winY + winH_px * 0.55);
        hall.lineStyle(0);
        hall.beginFill(0xe0f2fe, 0.12);
        hall.drawRect(winX, winY, winW, winH_px);
        hall.endFill();
        // Floor tiles
        hall.beginFill(0xe2e8f0);
        hall.drawRect(hallX, hallBottom - 10, hallW, 10);
        hall.endFill();
        hall.beginFill(0xcbd5e1, 0.5);
        for (let tx = 50; tx < W - 50; tx += 24) hall.drawRect(tx, hallBottom - 10, 22, 1);
        hall.endFill();
        this.scene.addChild(hall);

        // ─── Ceiling light fixtures in ticket hall ───
        const ceilLights = new PIXI.Graphics();
        for (let lx = hallX + 60; lx < hallX + hallW - 40; lx += 120) {
            // Fixture bar
            ceilLights.beginFill(0x1e293b);
            ceilLights.drawRect(lx - 8, hallTop + 2, 16, 4);
            ceilLights.endFill();
            // Warm glow cone
            ceilLights.beginFill(0xfbbf24, 0.05);
            ceilLights.drawPolygon([lx - 4, hallTop + 6, lx + 4, hallTop + 6, lx + 30, hallBottom - 12, lx - 30, hallBottom - 12]);
            ceilLights.endFill();
            // Fixture highlight
            ceilLights.beginFill(0xfef3c7, 0.7);
            ceilLights.drawRect(lx - 5, hallTop + 2, 10, 2);
            ceilLights.endFill();
        }
        this.scene.addChild(ceilLights);

        // Station name
        const nameTxt = new PIXI.Text(theme.label, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 9,
            fill: theme.col, letterSpacing: 2
        });
        nameTxt.anchor.set(0.5, 0);
        nameTxt.x = W / 2;
        nameTxt.y = hallTop + 4;
        if (nameTxt.width > hallW - 16) nameTxt.scale.set((hallW - 16) / nameTxt.width);
        this.scene.addChild(nameTxt);

        // Subtitle
        const subTxt = new PIXI.Text(theme.sub, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0x475569
        });
        subTxt.anchor.set(0.5, 0);
        subTxt.x = W / 2;
        subTxt.y = hallTop + 16;
        if (subTxt.width > hallW - 16) subTxt.scale.set((hallW - 16) / subTxt.width);
        this.scene.addChild(subTxt);

        // Ticket machines
        for (let i = 0; i < 5; i++) {
            const tm = new PIXI.Graphics();
            tm.beginFill(0x1e293b);
            tm.drawRect(0, 0, 22, 44);
            tm.endFill();
            tm.beginFill(theme.col, 0.85);
            tm.drawRect(3, 6, 16, 10);
            tm.endFill();
            tm.beginFill(0x0f172a);
            tm.drawRect(5, 22, 12, 8);
            tm.endFill();
            tm.beginFill(0xfbbf24);
            tm.drawRect(6, 32, 10, 2);
            tm.endFill();
            tm.x = 80 + i * 80;
            tm.y = hallBottom - 54;
            UI.tip(tm, 'Ticket Machine'); this.scene.addChild(tm);
        }

        // Turnstile row
        for (let i = 0; i < 6; i++) {
            const ts = new PIXI.Graphics();
            ts.beginFill(0x64748b);
            ts.drawRect(0, 0, 6, 28);
            ts.endFill();
            ts.beginFill(theme.col, 0.7);
            ts.drawCircle(3, 8, 3);
            ts.endFill();
            ts.beginFill(0x94a3b8);
            ts.drawRect(6, 12, 18, 2);
            ts.endFill();
            ts.x = W * 0.35 + i * 36;
            ts.y = hallBottom - 34;
            UI.tip(ts, 'Turnstile'); this.scene.addChild(ts);
        }

        // ─── EARTH/BEDROCK flanking the glass elevator shaft ───
        const platTop = hallBottom + stairH;
        const platFloorY = platTop + 130;

        const shaftW = 60;
        const shaftLeft = W / 2 - shaftW / 2;
        const shaftRight = W / 2 + shaftW / 2;
        const shaftTop = hallBottom;
        const shaftBottom = platFloorY;   // lift descends flush with platform

        // Seeded rng
        let rs = (bld.x || 0) + 101;
        const rr = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };

        // Rock flanks
        const rock = new PIXI.Graphics();
        rock.beginFill(0x2a1a10);
        rock.drawRect(0, shaftTop, shaftLeft, shaftBottom - shaftTop);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, shaftBottom - shaftTop);
        rock.endFill();
        rock.beginFill(0x3a2218);
        rock.drawRect(0, shaftTop, shaftLeft, 4);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, 4);
        rock.endFill();
        for (let i = 0; i < 260; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 2 && rx < shaftRight + 2) continue;
            rock.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            rock.drawRect(rx, shaftTop + rr() * (shaftBottom - shaftTop), 2 + rr() * 3, 2);
            rock.endFill();
        }
        // Rock texture details — mineral veins
        for (let i = 0; i < 30; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 5 && rx < shaftRight + 5) continue;
            rock.beginFill(rr() > 0.5 ? 0xb45309 : 0xfacc15, 0.3);
            rock.drawRect(rx, shaftTop + rr() * (shaftBottom - shaftTop), 1 + rr() * 3, 1);
            rock.endFill();
        }
        // Cable conduit zone running through the rock (matches exterior: cables sit above the metro tunnel)
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
        const cableZoneY = shaftTop + 10;
        const cableZoneH = 25;
        rock.beginFill(0x0a0a0f, 0.7);
        rock.drawRect(0, cableZoneY, shaftLeft - 2, cableZoneH);
        rock.drawRect(shaftRight + 2, cableZoneY, W - shaftRight - 2, cableZoneH);
        rock.endFill();
        for (let ci = 0; ci < 18; ci++) {
            const cy = cableZoneY + 3 + rr() * (cableZoneH - 6);
            const col = cableCols[Math.floor(rr() * cableCols.length)];
            const cLen = 40 + rr() * 120;
            const cx = rr() * (W - cLen);
            // Skip shaft region
            if (cx + cLen > shaftLeft && cx < shaftRight) continue;
            rock.beginFill(col, 0.3 + rr() * 0.4);
            rock.drawRect(cx, cy, cLen, 1 + rr() * 1.5);
            rock.endFill();
        }
        this.scene.addChild(rock);

        // ─── GLASS ELEVATOR SHAFT (upper section: hall to platform top) ───
        const glassShaft = new PIXI.Graphics();
        glassShaft.beginFill(0x050510, 0.85);
        glassShaft.drawRect(shaftLeft + 2, shaftTop + 2, shaftW - 4, shaftBottom - shaftTop - 4);
        glassShaft.endFill();
        glassShaft.beginFill(0x22d3ee, 0.10);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.endFill();
        glassShaft.lineStyle(2, 0x22d3ee, 0.4);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.lineStyle(0);
        // Vertical divider
        glassShaft.beginFill(0x22d3ee, 0.15);
        glassShaft.drawRect(shaftLeft + shaftW / 2 - 1, shaftTop + 4, 2, shaftBottom - shaftTop - 8);
        glassShaft.endFill();
        // Horizontal glass segments
        glassShaft.beginFill(0x22d3ee, 0.18);
        for (let sy = shaftTop + 30; sy < shaftBottom - 6; sy += 30) {
            glassShaft.drawRect(shaftLeft + 2, sy, shaftW - 4, 1);
        }
        glassShaft.endFill();
        this.scene.addChild(glassShaft);

        // Floor indicator
        const floorInd = new PIXI.Graphics();
        floorInd.beginFill(0x0f172a);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.endFill();
        floorInd.lineStyle(1, 0x22d3ee, 0.7);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.lineStyle(0);
        this.scene.addChild(floorInd);
        const floorTxt = new PIXI.Text('⇅ LIFT', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0x22d3ee
        });
        floorTxt.anchor.set(0.5, 0.5);
        floorTxt.x = (shaftLeft + shaftRight) / 2;
        floorTxt.y = shaftTop - 8;
        this.scene.addChild(floorTxt);
        this._liftFloorTxt = floorTxt;

        // ─── Elevator car ───
        const liftCar = new PIXI.Graphics();
        const carW = shaftW - 14;
        const carH = 6;
        const cable = new PIXI.Graphics();
        cable.beginFill(0x22d3ee, 0.35);
        cable.drawRect((shaftLeft + shaftRight) / 2 - 1, shaftTop + 2, 2, 10);
        cable.endFill();
        this.scene.addChild(cable);
        this._liftCable = cable;
        liftCar.beginFill(0x94a3b8);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.endFill();
        liftCar.lineStyle(1, 0x22d3ee, 0.6);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.lineStyle(0);
        liftCar.beginFill(0xe2e8f0, 0.6);
        liftCar.drawRect(-carW / 2 + 1, -carH / 2 + 1, carW - 2, 1);
        liftCar.endFill();
        liftCar.beginFill(0x22d3ee, 0.5);
        liftCar.drawRect(-carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.drawRect(carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.endFill();
        liftCar.x = (shaftLeft + shaftRight) / 2;
        liftCar.y = shaftTop + 20;
        this.scene.addChild(liftCar);
        this._liftCar = liftCar;
        this._liftCarH = carH;
        this._liftTop = { x: liftCar.x, y: shaftTop + 12 };
        this._liftBot = { x: liftCar.x, y: shaftBottom - 2 };

        // ─── PLATFORM LEVEL (back wall + deck) ───
        const platW = W;
        const backWallH = platFloorY - platTop;

        const backWall = new PIXI.Graphics();
        backWall.beginFill(0x0a0a12);
        backWall.drawRect(0, platTop, platW, backWallH);
        backWall.endFill();
        backWall.lineStyle(1, 0x1e1e2f, 0.5);
        for (let wx = 0; wx <= platW; wx += 20) {
            backWall.moveTo(wx, platTop);
            backWall.lineTo(wx, platFloorY);
        }
        backWall.lineStyle(0);
        // Side pillars
        backWall.beginFill(0x11111a);
        backWall.drawRect(0, platTop, 30, backWallH);
        backWall.drawRect(platW - 30, platTop, 30, backWallH);
        backWall.endFill();
        this.scene.addChild(backWall);

        // ─── Glass shaft OVERLAY in the platform zone (drawn AFTER back wall) ───
        const shaftOverlay = new PIXI.Graphics();
        // Dark backing inside shaft through platform zone
        shaftOverlay.beginFill(0x050510, 0.85);
        shaftOverlay.drawRect(shaftLeft + 2, platTop, shaftW - 4, backWallH);
        shaftOverlay.endFill();
        // Cyan glass tint
        shaftOverlay.beginFill(0x22d3ee, 0.10);
        shaftOverlay.drawRect(shaftLeft, platTop, shaftW, backWallH);
        shaftOverlay.endFill();
        // Cyan frame continuing through platform zone
        shaftOverlay.lineStyle(2, 0x22d3ee, 0.4);
        shaftOverlay.moveTo(shaftLeft, platTop);
        shaftOverlay.lineTo(shaftLeft, platFloorY);
        shaftOverlay.moveTo(shaftRight, platTop);
        shaftOverlay.lineTo(shaftRight, platFloorY);
        shaftOverlay.lineStyle(0);
        // Center divider continues
        shaftOverlay.beginFill(0x22d3ee, 0.15);
        shaftOverlay.drawRect(shaftLeft + shaftW / 2 - 1, platTop, 2, backWallH);
        shaftOverlay.endFill();
        // Horizontal glass segments continue
        shaftOverlay.beginFill(0x22d3ee, 0.18);
        for (let sy = platTop + 15; sy < platFloorY - 6; sy += 30) {
            shaftOverlay.drawRect(shaftLeft + 2, sy, shaftW - 4, 1);
        }
        shaftOverlay.endFill();
        // Shaft exit opening at bottom (where passengers step out)
        shaftOverlay.beginFill(0x22d3ee, 0.3);
        shaftOverlay.drawRect(shaftLeft, platFloorY - 2, shaftW, 2);
        shaftOverlay.endFill();
        this.scene.addChild(shaftOverlay);

        // Neon signs
        const signBg = new PIXI.Graphics();
        const signXOff = shaftW / 2 + 80;
        signBg.beginFill(0x05050a);
        signBg.lineStyle(1, theme.col, 0.5);
        signBg.drawRect(W / 2 - signXOff - 70, platTop + 20, 140, 16);
        signBg.drawRect(W / 2 + signXOff - 70, platTop + 20, 140, 16);
        signBg.endFill();
        signBg.lineStyle(0);
        this.scene.addChild(signBg);
        const signL = new PIXI.Text(theme.label, {
            fontFamily: 'Silkscreen, monospace', fontSize: 8, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
        });
        signL.anchor.set(0.5, 0.5);
        signL.x = W / 2 - signXOff;
        signL.y = platTop + 28;
        this.scene.addChild(signL);
        const signR = new PIXI.Text(theme.label, {
            fontFamily: 'Silkscreen, monospace', fontSize: 8, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
        });
        signR.anchor.set(0.5, 0.5);
        signR.x = W / 2 + signXOff;
        signR.y = platTop + 28;
        this.scene.addChild(signR);

        // ─── Platform ceiling lights (fluorescent strips) ───
        const platLights = new PIXI.Graphics();
        for (let lx = 50; lx < W - 30; lx += 100) {
            if (lx > shaftLeft - 15 && lx < shaftRight + 15) continue;
            // Fluorescent tube
            platLights.beginFill(0xe2e8f0, 0.6);
            platLights.drawRect(lx - 15, platTop + 4, 30, 2);
            platLights.endFill();
            // Diffused glow cone
            platLights.beginFill(0xcbd5e1, 0.03);
            platLights.drawPolygon([lx - 12, platTop + 6, lx + 12, platTop + 6, lx + 35, platFloorY - 5, lx - 35, platFloorY - 5]);
            platLights.endFill();
        }
        this.scene.addChild(platLights);

        // ─── Route map boards on back wall ───
        const mapBoard = new PIXI.Graphics();
        for (const mx of [W * 0.2, W * 0.8]) {
            mapBoard.beginFill(0x1e293b);
            mapBoard.drawRect(mx - 20, platTop + 50, 40, 30);
            mapBoard.endFill();
            mapBoard.beginFill(0x0f172a);
            mapBoard.drawRect(mx - 17, platTop + 53, 34, 24);
            mapBoard.endFill();
            // Fake route lines on the map
            mapBoard.beginFill(0x22d3ee, 0.7);
            mapBoard.drawRect(mx - 14, platTop + 62, 28, 2);
            mapBoard.endFill();
            mapBoard.beginFill(0xf97316, 0.7);
            mapBoard.drawRect(mx - 14, platTop + 68, 28, 2);
            mapBoard.endFill();
            // "MAP" label
            mapBoard.beginFill(0x94a3b8, 0.5);
            mapBoard.drawRect(mx - 8, platTop + 54, 16, 3);
            mapBoard.endFill();
        }
        this.scene.addChild(mapBoard);

        // ─── CCTV cameras ───
        const cctv = new PIXI.Graphics();
        for (const cx of [60, W - 60]) {
            cctv.beginFill(0x1e293b);
            cctv.drawRect(cx - 3, platTop + 2, 6, 8);
            cctv.endFill();
            cctv.beginFill(0xef4444, 0.8);
            cctv.drawCircle(cx, platTop + 12, 1.5);
            cctv.endFill();
        }
        this.scene.addChild(cctv);

        // Platform deck slab
        const slab = new PIXI.Graphics();
        slab.beginFill(0x2a2a3e);
        slab.drawRect(0, platFloorY, platW, 15);
        slab.endFill();
        slab.beginFill(0xfacc15);
        slab.drawRect(0, platFloorY + 13, platW, 2);
        slab.endFill();
        slab.beginFill(0xd97706);
        for (let sx = 0; sx < platW; sx += 6) {
            slab.drawRect(sx, platFloorY + 11, 4, 2);
        }
        slab.endFill();
        this.scene.addChild(slab);

        // Benches
        for (let bx = 120; bx < W - 120; bx += 220) {
            if (bx > shaftLeft - 70 && bx < shaftRight + 10) continue;
            const bench = new PIXI.Graphics();
            bench.beginFill(0x78350f);
            bench.drawRect(0, 0, 60, 3);
            bench.endFill();
            bench.beginFill(0x64748b);
            bench.drawRect(4, 3, 4, 8);
            bench.drawRect(52, 3, 4, 8);
            bench.endFill();
            bench.x = bx;
            bench.y = platFloorY - 12;
            UI.tip(bench, 'Bench'); this.scene.addChild(bench);
        }

        // ─── Trash cans ───
        for (const tx of [W * 0.15, W * 0.85]) {
            const trash = new PIXI.Graphics();
            trash.beginFill(0x475569);
            trash.drawRect(tx - 5, platFloorY - 14, 10, 14);
            trash.endFill();
            trash.beginFill(0x64748b);
            trash.drawRect(tx - 6, platFloorY - 14, 12, 2);
            trash.endFill();
            UI.tip(trash, 'Trash Can'); this.scene.addChild(trash);
        }

        // Store platform anchors
        this._platFloorY = platFloorY;
        this._platStandY = platFloorY;
        this._hallFloorY = hallBottom - 2;
        this._platLeft = 40;         // left pillar + margin
        this._platRight = W - 40;    // right pillar + margin
        this._platW = W;

        // ─── TRACK BED + TRAIN CORRIDOR ───
        const trainCenterY = platFloorY + 8;
        const trainBodyH = 65;
        const trainTopY = trainCenterY - 35;
        const trainBottomY = trainCenterY + 40;
        const trackBottom = platTop + platH - 10;

        const tbedTop = platFloorY + 18;
        const tbed = new PIXI.Graphics();
        tbed.beginFill(0x050510);
        tbed.drawRect(0, tbedTop, W, trackBottom - tbedTop);
        tbed.endFill();
        // Rails
        const railY = trainBottomY - 4;
        tbed.beginFill(0xd4d4d4);
        tbed.drawRect(0, railY, W, 2);
        tbed.drawRect(0, railY + 10, W, 2);
        tbed.endFill();
        // Track sleepers
        tbed.beginFill(0x3a2218);
        for (let sx = 0; sx < W; sx += 20) tbed.drawRect(sx, railY - 2, 14, 16);
        tbed.endFill();
        // Ballast
        for (let i = 0; i < 120; i++) {
            tbed.beginFill(0x1a1a24, 0.7);
            tbed.drawRect(rr() * W, railY + 14 + rr() * (trackBottom - railY - 16), 2, 2);
            tbed.endFill();
        }
        // Power rail
        tbed.beginFill(0xfbbf24, 0.4);
        tbed.drawRect(0, trackBottom - 8, W, 2);
        tbed.endFill();
        this.scene.addChild(tbed);

        // Tunnel mouths
        const tunnelTop = trainTopY;
        const tunnelBottom = trainBottomY;
        const tmouthL = new PIXI.Graphics();
        tmouthL.beginFill(0x000000, 0.9);
        tmouthL.drawRect(0, tunnelTop, 40, tunnelBottom - tunnelTop);
        tmouthL.endFill();
        tmouthL.beginFill(0x050510, 0.6);
        tmouthL.drawRect(40, tunnelTop, 30, tunnelBottom - tunnelTop);
        tmouthL.endFill();
        this.scene.addChild(tmouthL);

        const tmouthR = new PIXI.Graphics();
        tmouthR.beginFill(0x000000, 0.9);
        tmouthR.drawRect(W - 40, tunnelTop, 40, tunnelBottom - tunnelTop);
        tmouthR.endFill();
        tmouthR.beginFill(0x050510, 0.6);
        tmouthR.drawRect(W - 70, tunnelTop, 30, tunnelBottom - tunnelTop);
        tmouthR.endFill();
        this.scene.addChild(tmouthR);

        // ─── Tunnel receding lights (depth cue) ───
        this._tunnelLightsCont = new PIXI.Graphics();
        for (let d = 0; d < 5; d++) {
            const alpha = 0.5 - d * 0.08;
            // Left tunnel
            this._tunnelLightsCont.beginFill(0xef4444, alpha);
            this._tunnelLightsCont.drawCircle(35 - d * 6, tunnelTop + 10, 1.5 - d * 0.2);
            this._tunnelLightsCont.endFill();
            // Right tunnel
            this._tunnelLightsCont.beginFill(0xef4444, alpha);
            this._tunnelLightsCont.drawCircle(W - 35 + d * 6, tunnelTop + 10, 1.5 - d * 0.2);
            this._tunnelLightsCont.endFill();
        }
        this.scene.addChild(this._tunnelLightsCont);

        this._trackY = trainCenterY;
        this._trainBodyH = trainBodyH;
        this._trackTop = trainTopY;
        this._trackBottom = trackBottom;

        // ─── DEEP STRATA (below tracks — matches exterior layer order) ───
        // Exterior order below metro tunnel: earth → water pipe → sewer → rock → deep void
        // (Cables are ABOVE the platform in the rock section, not down here)
        const deepTop = platTop + platH;
        const deep = new PIXI.Graphics();

        // Solid dark base fill to prevent bleed-through
        deep.beginFill(0x050508);
        deep.drawRect(0, deepTop, W, deepH + 100);
        deep.endFill();

        // Layer 1: Earth transition (0-40px)
        deep.beginFill(0x2a1a10);
        deep.drawRect(0, deepTop, W, 40);
        deep.endFill();
        deep.beginFill(0x3a2218);
        deep.drawRect(0, deepTop, W, 3);
        deep.endFill();

        // Layer 2: Water main (50-58px)
        deep.beginFill(0x0369a1);
        deep.drawRect(0, deepTop + 50, W, 8);
        deep.endFill();
        deep.beginFill(0x0284c7);
        deep.drawRect(0, deepTop + 52, W, 4);
        deep.endFill();
        for (let px = 80; px < W; px += 200) {
            deep.beginFill(0x0ea5e9, 0.5);
            deep.drawRect(px, deepTop + 48, 12, 12);
            deep.endFill();
        }

        // Layer 3: Sewer trunk (70-82px)
        deep.beginFill(0xb45309);
        deep.drawRect(0, deepTop + 70, W, 12);
        deep.endFill();
        deep.beginFill(0xd97706);
        deep.drawRect(0, deepTop + 72, W, 8);
        deep.endFill();

        // Layer 4: Rock strata (95-220px)
        deep.beginFill(0x2d1a11);
        deep.drawRect(0, deepTop + 95, W, 125);
        deep.endFill();
        deep.beginFill(0x1f100a, 0.6);
        deep.drawRect(0, deepTop + 115, W, 4);
        deep.drawRect(0, deepTop + 155, W, 3);
        deep.drawRect(0, deepTop + 195, W, 5);
        deep.endFill();
        for (let i = 0; i < 180; i++) {
            deep.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            deep.drawRect(rr() * W, deepTop + 95 + rr() * 125, 2 + rr() * 3, 2);
            deep.endFill();
        }
        for (let i = 0; i < 15; i++) {
            deep.beginFill(rr() > 0.5 ? 0xb45309 : 0xfacc15, 0.4);
            deep.drawRect(rr() * W, deepTop + 100 + rr() * 110, 1 + rr() * 2, 1);
            deep.endFill();
        }

        // Layer 5: Deep void (220px+)
        deep.beginFill(0x050508);
        deep.drawRect(0, deepTop + 220, W, deepH - 220 + 100);
        deep.endFill();
        for (let i = 0; i < 40; i++) {
            deep.beginFill(0x1a100a, 0.4);
            deep.drawRect(rr() * W, deepTop + 220 + rr() * 70, 2 + rr() * 4, 2);
            deep.endFill();
        }
        this.scene.addChild(deep);

        // ─── AVATAR LAYER (behind train so arriving trains cover platform workers) ───
        this.avatarLayer = new PIXI.Container();
        this.avatarLayer.sortableChildren = true;
        this.scene.addChild(this.avatarLayer);

        // ─── TRAIN LAYER (on top — covers platform-level avatars when at station) ───
        this.trainGfx = new PIXI.Container();
        this.trainGfx.sortableChildren = true;
        this.scene.addChild(this.trainGfx);
        this._trainG = new PIXI.Graphics();
        this.trainGfx.addChild(this._trainG);

        // ─── METRO WORKER NPCs (always visible, 24/7 staff) ───
        this._spawnStationWorkers(theme, W, hallTop, hallH, platTop, this._platStandY);

        // Initial position
        this.scene.y = 0;

        // ─── SCROLL HANDLERS (window-level like all other interiors) ───
        this._noYScroll = false;
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';
        this.layer.hitArea = new PIXI.Rectangle(0, 0, W, H);
        // Remove any stale listeners
        if (this._onMove) window.removeEventListener('pointermove', this._onMove);
        if (this._onUp) window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorMetroStation.isDragging || !InteriorMetroStation.scene || InteriorMetroStation.scene.destroyed) return;
            let ny = InteriorMetroStation._startSceneY + (e.clientY - InteriorMetroStation._startY);
            ny = Math.max(InteriorMetroStation.minY, Math.min(ny, InteriorMetroStation.maxY));
            InteriorMetroStation.scene.y = ny;
        };
        this._onUp = () => {
            InteriorMetroStation.isDragging = false;
            if (InteriorMetroStation.layer) InteriorMetroStation.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);

        // Auto-scroll so platform is visible
        const focusY = platTop + platH * 0.3;
        if (focusY > H * 0.5 && totalH > H) {
            this.scene.y = Math.max(this.minY, -(focusY - H * 0.4));
        }

        this.update();
    },

    update() {
        if (!this.scene || !this.bld || !this.avatarLayer) return;

        // Dynamic sky
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(null, this.starsLayer);
        }

        const stationX = this.bld.x + this.bld.w / 2;
        const W = G.vpW;
        const tick = (typeof G !== 'undefined' && G.tick) || 0;

        // ─── Draw real exterior trains ───
        const g = this._trainG;
        if (g) {
            g.clear();
            const trainCenterY = this._trackY;
            const trainHalfW = 180;
            const offscreenCut = W / 2 + trainHalfW + 10;

            const trains = [];
            if (typeof Entities !== 'undefined') {
                if (Entities.trainWest)      trains.push(Entities.trainWest);
                if (Entities.trainEast)      trains.push(Entities.trainEast);
                if (Entities.trainMid)       trains.push(Entities.trainMid);
                if (Entities.trainDC)        trains.push(Entities.trainDC);
                if (Entities.trainLongevity) trains.push(Entities.trainLongevity);
            }

            for (const t of trains) {
                if (!t || t.st1 === undefined || t.st2 === undefined) continue;
                const servesThisStation =
                    Math.abs(t.st1 - stationX) < 8 || Math.abs(t.st2 - stationX) < 8;
                if (!servesThisStation) continue;

                const cxOffset = t.x - stationX;
                if (Math.abs(cxOffset) > offscreenCut) continue;

                const cx = W / 2 + cxOffset;
                const bob = (t.state === 'moving') ? Math.sin(tick * 0.5) * 1.5 : 0;
                const cy = trainCenterY + bob;
                const atStation = Math.abs(cxOffset) < 5;
                this._drawExteriorTrain(g, cx, cy, atStation, t.dir);
            }
        }

        // ─── Drive the LIFT ───
        const groundY = G.groundY || 0;
        const surfaceY = groundY - 20;
        const exteriorPlatY = groundY + 112;
        const descentRange = exteriorPlatY - surfaceY;
        const shaftTopY = this._liftTop ? this._liftTop.y : 0;
        const shaftBotY = this._liftBot ? this._liftBot.y : 0;
        const shaftRange = shaftBotY - shaftTopY;

        let liftTarget = shaftTopY;
        let liftActive = false;

        if (G && G.charRefs && G.models) {
            for (let mi = 0; mi < G.models.length; mi++) {
                const m = G.models[mi];
                const refs = G.charRefs[m.id];
                if (!refs) continue;
                if (refs._metroState !== 'entering' && refs._metroState !== 'exiting') continue;
                if (!refs._metroLegs) continue;
                const legX = refs._metroLegs[refs._currentLeg];
                if (Math.abs(legX - stationX) > 8) continue;
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                liftTarget = shaftTopY + progress * shaftRange;
                liftActive = true;
                break;
            }
        }

        if (this._liftCar) {
            const cur = this._liftCar.y;
            this._liftCar.y = cur + (liftTarget - cur) * 0.25;
            if (this._liftCable) {
                this._liftCable.clear();
                this._liftCable.beginFill(0x22d3ee, 0.35);
                this._liftCable.drawRect(this._liftCar.x - 1, shaftTopY - 12, 2, (this._liftCar.y - 3) - (shaftTopY - 12));
                this._liftCable.endFill();
            }
            if (this._liftFloorTxt) {
                const p = shaftRange > 0 ? (this._liftCar.y - shaftTopY) / shaftRange : 0;
                this._liftFloorTxt.text = liftActive
                    ? (p > 0.5 ? '▼ PLATFORM' : '▲ HALL')
                    : '⇅ LIFT';
            }
        }

        // ─── Mirror real-time avatars ───
        if (typeof G === 'undefined' || !G.charRefs || !G.models) return;

        const seen = new Set();
        const platStandY = this._platStandY;
        const hallFloorY = this._hallFloorY || 127;

        for (let mi = 0; mi < G.models.length; mi++) {
            const m = G.models[mi];
            const refs = G.charRefs[m.id];
            if (!refs) continue;
            if (!refs._metroState || refs._metroState === 'none') continue;
            if (!refs._metroLegs || refs._metroLegs.length === 0) continue;

            let legIdx = -1;
            for (let li = 0; li < refs._metroLegs.length; li++) {
                if (Math.abs(refs._metroLegs[li] - stationX) < 8) { legIdx = li; break; }
            }
            if (legIdx === -1) continue;

            const currentLegX = refs._metroLegs[refs._currentLeg];
            const atThisStation = Math.abs(currentLegX - stationX) < 8;

            const isRiding = refs._metroState === 'riding';
            const nextLegX = refs._metroLegs[refs._currentLeg + 1];
            const passingThrough = isRiding && nextLegX !== undefined &&
                                   ((currentLegX <= stationX && stationX <= nextLegX) ||
                                    (nextLegX <= stationX && stationX <= currentLegX));

            if (!atThisStation && !passingThrough) continue;

            seen.add(m.id);

            let ix, iy;
            const spread = ((m.id.charCodeAt(0) * 31 + mi * 7) % 240) - 120;

            if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                if (progress < 0.02) {
                    const dxExt = (refs.c && refs.c.x != null) ? (refs.c.x - stationX) : 0;
                    const clampedDx = Math.max(-W / 2 + 80, Math.min(W / 2 - 80, dxExt));
                    ix = W / 2 + clampedDx;
                    iy = hallFloorY;
                } else if (progress > 0.98) {
                    ix = this._liftCar.x;
                    iy = platStandY;
                } else {
                    ix = this._liftCar.x;
                    iy = this._liftCar.y - 3;
                }
            } else if (refs._metroState === 'waiting_train') {
                // Spread across the full platform with idle milling
                const platRange = (this._platRight - this._platLeft);
                const hash = (m.id.charCodeAt(0) * 2654435761 + mi * 131) >>> 0;
                const baseX = this._platLeft + (hash % Math.floor(platRange));
                const mill = Math.sin(tick * 0.012 + hash * 0.001) * 18;
                ix = Math.max(this._platLeft, Math.min(this._platRight, baseX + mill));
                iy = platStandY;
            } else if (refs._metroState === 'riding') {
                let ridingX = null;
                if (refs._ridingTrain && refs._ridingTrain.x != null) {
                    ridingX = refs._ridingTrain.x;
                }
                if (ridingX == null) {
                    ix = W / 2 + spread * 0.3;
                } else {
                    const rideOffset = Math.max(-140, Math.min(140, spread));
                    ix = W / 2 + (ridingX - stationX) + rideOffset;
                }
                iy = this._trackY - 8;
            } else {
                // Fallback — spread across platform
                const platRange = (this._platRight - this._platLeft);
                const hash = (m.id.charCodeAt(0) * 2654435761 + mi * 131) >>> 0;
                ix = this._platLeft + (hash % Math.floor(platRange));
                iy = platStandY;
            }

            let av = this.avatarPool.get(m.id);
            if (!av) {
                av = this._makeAvatarSprite(m);
                this.avatarLayer.addChild(av.cont);
                this.avatarPool.set(m.id, av);
            }
            av.cont.x = ix;
            av.cont.y = iy;
            av.cont.visible = true;
            av.cont.zIndex = Math.round(iy);

            const isWalking = (refs._metroState === 'entering' || refs._metroState === 'exiting');
            if (av.legL && av.legR) {
                const phase = isWalking ? Math.sin(tick * 0.25 + (m.id.charCodeAt(0) * 0.3)) : 0;
                const baseLegX = av._baseLegX != null ? av._baseLegX : 2.4;
                const legSwing = av._legSwing != null ? av._legSwing : 1.2;
                av.legL.x = -baseLegX + phase * legSwing;
                av.legR.x =  baseLegX - phase * legSwing;
            }
            // Subtle idle sway for standing/waiting avatars
            if (!isWalking && av.body) {
                av.body.rotation = Math.sin(tick * 0.04 + m.id.charCodeAt(0) * 0.5) * 0.02;
            }

            const isTracked = G.tracking && G.tracking.type === 'model' && G.tracking.id === m.id;
            if (av.highlight) av.highlight.visible = !!isTracked;
        }

        // ─── Mirror worker NPCs (NPCHousing commuters) using this station ───
        if (typeof NPCHousing !== 'undefined' && NPCHousing.commuters) {
            for (const cm of NPCHousing.commuters) {
                if (!cm || !cm.npc) continue;
                const st = cm.state;
                if (st !== 'walk_to_metro' && st !== 'riding_metro' && st !== 'walk_from_metro') continue;

                // Is this commuter using THIS station?
                const entryMatch = cm._metroEntryX != null && Math.abs(cm._metroEntryX - stationX) < 8;
                const exitMatch = cm._metroExitX != null && Math.abs(cm._metroExitX - stationX) < 8;
                if (!entryMatch && !exitMatch) continue;

                const npcId = 'npc_' + cm.npc.id;
                seen.add(npcId);

                let ix, iy;
                if (st === 'walk_to_metro' && entryMatch) {
                    // Walking toward this station — animate descent via elevator
                    const dxExt = cm.c.x - stationX;
                    const distToStation = Math.abs(dxExt);
                    if (distToStation > 30) {
                        // Still walking to entrance — show in hall
                        ix = W / 2 + Math.max(-W / 2 + 80, Math.min(W / 2 - 80, dxExt));
                        iy = hallFloorY;
                    } else {
                        // Close to station — show riding elevator down
                        if (!cm._liftProgress) cm._liftProgress = 0;
                        cm._liftProgress = Math.min(1, cm._liftProgress + 0.015);
                        ix = this._liftCar ? this._liftCar.x : W / 2;
                        iy = hallFloorY + cm._liftProgress * (platStandY - hallFloorY);
                    }
                } else if (st === 'riding_metro') {
                    // Underground — spread across the full platform with milling
                    cm._liftProgress = 0; // reset for next time
                    const hash = (cm.npc.id.charCodeAt(0) * 2654435761 + cm.npc.id.charCodeAt(Math.min(1, cm.npc.id.length - 1)) * 131) >>> 0;
                    const platRange = (this._platRight - this._platLeft);
                    const baseX = this._platLeft + (hash % Math.floor(platRange));
                    const mill = Math.sin(tick * 0.015 + hash * 0.001) * 15;
                    ix = Math.max(this._platLeft, Math.min(this._platRight, baseX + mill));
                    iy = platStandY;
                } else if (st === 'walk_from_metro' && exitMatch) {
                    // Exiting — animate ascent via elevator then walk away
                    if (!cm._liftProgress) cm._liftProgress = 1;
                    cm._liftProgress = Math.max(0, cm._liftProgress - 0.015);
                    if (cm._liftProgress > 0.02) {
                        ix = this._liftCar ? this._liftCar.x : W / 2;
                        iy = hallFloorY + cm._liftProgress * (platStandY - hallFloorY);
                    } else {
                        cm._liftProgress = 0;
                        const dxExt = cm.c.x - stationX;
                        ix = W / 2 + Math.max(-W / 2 + 80, Math.min(W / 2 - 80, dxExt));
                        iy = hallFloorY;
                    }
                } else {
                    continue;
                }

                let av = this.avatarPool.get(npcId);
                if (!av) {
                    // Build avatar using NPC data
                    const fakeModel = {
                        id: cm.npc.id,
                        name: cm.npc.name,
                        lab: 'other',
                        _npcColor: cm.npc.color
                    };
                    av = this._makeAvatarSprite(fakeModel);
                    this.avatarLayer.addChild(av.cont);
                    this.avatarPool.set(npcId, av);
                }
                av.cont.x = ix;
                av.cont.y = iy;
                av.cont.visible = true;
                av.cont.zIndex = Math.round(iy);

                // Leg animation when walking
                const isWalking = (st === 'walk_to_metro' || st === 'walk_from_metro');
                if (av.legL && av.legR) {
                    const phase = isWalking ? Math.sin(tick * 0.25 + (cm.npc.id.charCodeAt(0) * 0.3)) : 0;
                    const baseLegX = av._baseLegX != null ? av._baseLegX : 2.4;
                    const legSwing = av._legSwing != null ? av._legSwing : 1.2;
                    av.legL.x = -baseLegX + phase * legSwing;
                    av.legR.x =  baseLegX - phase * legSwing;
                }
                if (!isWalking && av.body) {
                    av.body.rotation = Math.sin(tick * 0.04 + cm.npc.id.charCodeAt(0) * 0.5) * 0.02;
                }

                // Highlight if tracked
                const isTracked = G.tracking && G.tracking.type === 'npc' && G.tracking.id === cm.npc.id;
                if (av.highlight) av.highlight.visible = !!isTracked;
            }
        }

        // ─── Station worker shift visibility + idle animation ───
        const dp = G.getDayPhase();
        const isNightShift = dp > 0.83 || dp < 0.25;
        const activeShift = isNightShift
            ? (this._stationWorkers ? this._stationWorkers.night : [])
            : (this._stationWorkers ? this._stationWorkers.day : []);
        const inactiveShift = isNightShift
            ? (this._stationWorkers ? this._stationWorkers.day : [])
            : (this._stationWorkers ? this._stationWorkers.night : []);

        // Show active shift workers, hide inactive ones
        for (const w of activeShift) {
            const key = 'worker_' + w.id;
            seen.add(key);
            const av = this.avatarPool.get(key);
            if (!av) continue;
            av.cont.visible = true;
            // Idle patrol: wander near their post, then return
            av._walkTimer--;
            if (av._walkTimer <= 0) {
                av._walkTarget = av._deskX + (Math.random() - 0.5) * av._walkRange * 2;
                av._walkTimer = 150 + Math.floor(Math.random() * 300);
            }
            const dx = av._walkTarget - av.cont.x;
            if (Math.abs(dx) > 1) {
                av.cont.x += Math.sign(dx) * av._speed;
                // Walking leg animation
                if (av.legL && av.legR) {
                    const phase = Math.sin(tick * 0.25 + w.id.charCodeAt(0) * 0.3);
                    const baseLegX = av._baseLegX != null ? av._baseLegX : 2.4;
                    const legSwing = av._legSwing != null ? av._legSwing : 1.2;
                    av.legL.x = -baseLegX + phase * legSwing;
                    av.legR.x =  baseLegX - phase * legSwing;
                }
            } else {
                // Idle sway
                if (av.legL && av.legR) {
                    const baseLegX = av._baseLegX != null ? av._baseLegX : 2.4;
                    av.legL.x = -baseLegX; av.legR.x = baseLegX;
                }
                if (av.body) av.body.rotation = Math.sin(tick * 0.04 + w.id.charCodeAt(0) * 0.5) * 0.02;
            }
            av.cont.zIndex = Math.round(av.cont.y);
        }
        for (const w of inactiveShift) {
            const key = 'worker_' + w.id;
            const av = this.avatarPool.get(key);
            if (av) av.cont.visible = false;
        }

        // Hide commuter/model avatars no longer present
        this.avatarPool.forEach((av, id) => {
            if (!seen.has(id)) av.cont.visible = false;
        });
    },

    // ─────────────────────────────────────────────────────────────
    //  STATION WORKER NPCs (day/night shift rotation like all zones)
    // ─────────────────────────────────────────────────────────────
    _spawnStationWorkers(theme, W, hallTop, hallH, platTop, platStandY) {
        // Day shift (roughly 06:00–18:00) and night shift (18:00–06:00)
        // rotate just like every other zone's interior NPCs.
        const hallStandY = hallH - 2;          // feet on hall floor tiles (matches _hallFloorY)
        const DAY_WORKERS = [
            { id: 'metro_ticket',    name: 'Ticket Agent',       role: 'Ticket Agent',       x: W * 0.22, y: hallStandY,  col: 0x3b82f6 },
            { id: 'metro_guard_d',   name: 'Station Guard',      role: 'Station Guard',      x: W * 0.78, y: hallStandY,  col: 0xef4444 },
            { id: 'metro_attend_d',  name: 'Platform Attendant', role: 'Platform Attendant',  x: W * 0.35, y: platStandY, col: 0xfbbf24 },
            { id: 'metro_dispatch',  name: 'Train Dispatcher',   role: 'Dispatcher',         x: W * 0.65, y: platStandY, col: 0x22c55e },
            { id: 'metro_info',      name: 'Info Desk',          role: 'Info Desk',          x: W * 0.50, y: hallStandY,  col: 0x06b6d4 },
        ];
        const NIGHT_WORKERS = [
            { id: 'metro_guard_n',   name: 'Night Guard',        role: 'Night Guard',        x: W * 0.75, y: hallStandY,  col: 0xef4444 },
            { id: 'metro_maint',     name: 'Maintenance Tech',   role: 'Maintenance',        x: W * 0.40, y: platStandY, col: 0x22c55e },
            { id: 'metro_signal',    name: 'Signal Operator',    role: 'Signal Ops',         x: W * 0.85, y: platStandY, col: 0x06b6d4 },
        ];
        this._stationWorkers = { day: DAY_WORKERS, night: NIGHT_WORKERS };
        // Create avatar sprites for ALL workers (both shifts), hide inactive ones
        for (const list of [DAY_WORKERS, NIGHT_WORKERS]) {
            for (const w of list) {
                const fakeModel = { id: w.id, name: w.name, lab: 'other', role: w.role, _npcColor: w.col };
                const av = this._makeAvatarSprite(fakeModel);
                av.cont.x = w.x;
                av.cont.y = w.y;
                av._isStationWorker = true;
                av._deskX = w.x;
                av._floorY = w.y;
                av._speed = 0.5 + Math.random() * 0.3;
                av._walkTarget = w.x;
                av._walkTimer = 120 + Math.floor(Math.random() * 300);
                av._walkRange = 40;
                this.avatarLayer.addChild(av.cont);
                this.avatarPool.set('worker_' + w.id, av);
            }
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  EXTERIOR-MATCHING TRAIN VISUAL
    // ─────────────────────────────────────────────────────────────
    _drawExteriorTrain(g, cx, cy, atStation, dir) {
        // Body
        g.beginFill(0x1e293b);
        g.drawRoundedRect(cx - 180, cy - 35, 360, 65, 8);
        g.endFill();
        g.beginFill(0x0284c7);
        g.drawRect(cx - 175, cy + 4, 350, 8);
        g.endFill();
        g.beginFill(0x94a3b8);
        for (let px = -160; px <= 160; px += 45) {
            g.drawRect(cx + px - 1, cy - 25, 2, 29);
        }
        g.endFill();
        // Front overlay
        g.beginFill(0xcbd5e1);
        g.drawRoundedRect(cx - 180, cy - 35, 360, 15, 8);
        g.endFill();
        g.beginFill(0x94a3b8);
        g.drawRect(cx - 180, cy - 4, 360, 34);
        g.endFill();
        g.beginFill(0x94a3b8);
        for (let px = -180; px <= 180; px += 45) {
            g.drawRect(cx + px - 5, cy - 20, 10, 16);
        }
        g.endFill();
        // Windows
        g.beginFill(0x64748b);
        g.drawRect(cx - 100, cy - 28, 20, 50);
        g.drawRect(cx + 0,   cy - 28, 20, 50);
        g.drawRect(cx + 100, cy - 28, 20, 50);
        g.endFill();
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(cx - 96, cy - 18, 12, 16);
        g.drawRect(cx + 4,  cy - 18, 12, 16);
        g.drawRect(cx + 104, cy - 18, 12, 16);
        g.endFill();
        // Skirt
        g.beginFill(0x1e293b);
        g.drawRect(cx - 175, cy + 30, 350, 10);
        g.endFill();
        // Accent line
        g.beginFill(0x0ea5e9);
        g.drawRect(cx - 180, cy - 2, 360, 4);
        g.endFill();
        // Glass tint
        g.beginFill(0xe0f2fe, 0.15);
        g.drawRect(cx - 180, cy - 20, 360, 16);
        g.endFill();
        // Headlights
        const dirSign = dir || 1;
        const leftCol  = dirSign > 0 ? 0xef4444 : 0x4ade80;
        const rightCol = dirSign > 0 ? 0x4ade80 : 0xef4444;
        g.beginFill(leftCol);
        g.drawCircle(cx - 175, cy, 4);
        g.endFill();
        g.beginFill(rightCol);
        g.drawCircle(cx + 175, cy, 4);
        g.endFill();
        // Door highlights when at station
        if (atStation) {
            g.beginFill(0xfef08a, 0.4);
            for (const px of [-100, 0, 100]) {
                g.drawRect(cx + px - 1, cy - 28, 1, 50);
                g.drawRect(cx + px + 20, cy - 28, 1, 50);
            }
            g.endFill();
        }
    },

    _makeAvatarSprite(m) {
        const cont = new PIXI.Container();
        const isNPC = !!m._npcColor;

        // ─── Lab/suit color (same logic as exterior) ───
        let suitHex = 0x22d3ee;
        if (isNPC) {
            const c = m._npcColor;
            if (typeof c === 'string') suitHex = parseInt(c.replace('#', ''), 16);
            else if (typeof c === 'number') suitHex = c;
        } else if (typeof LABS !== 'undefined' && LABS[m.lab]) {
            const c = LABS[m.lab].color || LABS[m.lab].col;
            if (typeof c === 'string') suitHex = parseInt(c.replace('#', '0x'));
            else if (typeof c === 'number') suitHex = c;
        }

        // ─── Lifecycle stage + paramScale (only meaningful for real models) ───
        // NPCs always render at adult/default scale.
        let stg = 'adult';
        let sd = { size: 1, headR: 0.4 };
        let paramScale = 1;
        let isMoE = false;
        if (!isNPC) {
            if (typeof getStage === 'function') stg = getStage(m.rel, m.ret, m.phase);
            if (typeof STAGES !== 'undefined' && STAGES[stg]) sd = STAGES[stg];
            let paramCount = 100;
            if (m.arch) {
                if (m.arch.type && m.arch.type.includes('MoE')) isMoE = true;
                if (m.arch.params) {
                    let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
                    if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
                    else if (pStr.includes('B')) paramCount = parseFloat(pStr);
                }
            }
            paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));
        }
        const finalSc = sd.size * paramScale;

        // ─── Proportions (mirror exterior updateCharStateVisuals) ───
        const bw = Math.round(16 * finalSc);
        const h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR);
        const bodyH = h - headH - Math.round(4 * finalSc);
        const legH = Math.max(2, Math.round(4 * finalSc));
        const eyeS = Math.max(1, bw * 0.08);

        const isR = stg === 'retired';
        const isRm = stg === 'rumored';
        const suitCol = isR ? 0x667799 : suitHex;
        const babySkin = 0xffe4c4;
        const kidSkin  = 0xfde0b8;
        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : stg === 'baby' ? babySkin : stg === 'kid' ? kidSkin : 0xfdd8b5;
        const eyeCol = isR ? 0xaaccff : isRm ? 0xa78bfa : stg === 'baby' ? 0x1a1a2e : 0x2c1810;
        const ageEyeS = stg === 'baby' ? eyeS * 1.4 : eyeS;
        const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : stg === 'baby' ? 0xfdd8b5 : stg === 'kid' ? 0x2a2a3a : 0x3d2914;

        // ─── Shadow ───
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();
        cont.addChild(shadow);

        // ─── Spectral glow for retired models ───
        const ghostGlow = new PIXI.Graphics();
        if (isR) {
            ghostGlow.beginFill(0x6688ff, 0.15);
            ghostGlow.drawEllipse(0, -h * 0.4, bw * 1.2, h * 0.6);
            ghostGlow.endFill();
            ghostGlow.beginFill(0x88aaff, 0.08);
            ghostGlow.drawEllipse(0, -h * 0.4, bw * 1.8, h * 0.8);
            ghostGlow.endFill();
            ghostGlow.blendMode = PIXI.BLEND_MODES.ADD;
        }
        cont.addChild(ghostGlow);

        // ─── Tracking highlight ring ───
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -h / 2, h * 0.65);
        highlight.visible = false;
        cont.addChild(highlight);

        // ─── MoE ghost bodies (Mixture of Experts) ───
        const ghostL = new PIXI.Graphics();
        const ghostR = new PIXI.Graphics();
        ghostL.visible = false;
        ghostR.visible = false;
        if (isMoE && !isR) {
            ghostL.beginFill(suitCol, 0.5);
            ghostL.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
            ghostL.endFill();
            ghostR.beginFill(suitCol, 0.5);
            ghostR.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
            ghostR.endFill();
            ghostL.blendMode = PIXI.BLEND_MODES.ADD;
            ghostR.blendMode = PIXI.BLEND_MODES.ADD;
            ghostL.visible = true;
            ghostR.visible = true;
            ghostL.y = -h + headH;
            ghostR.y = -h + headH;
            ghostL.x = -bw * 0.2;
            ghostR.x = bw * 0.2;
            ghostL.alpha = 0.4;
            ghostR.alpha = 0.4;
        }
        cont.addChild(ghostL, ghostR);

        // ─── Legs ───
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol, isR ? 0.25 : 1);
        legL.drawRect(-lw / 2, 0, lw, legH);
        legL.endFill();
        legL.x = -bw * 0.15;
        cont.addChild(legL);
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol, isR ? 0.25 : 1);
        legR.drawRect(-lw / 2, 0, lw, legH);
        legR.endFill();
        legR.x = bw * 0.15;
        cont.addChild(legR);

        // ─── Body (age-specific) ───
        const body = new PIXI.Graphics();
        if (stg === 'baby') {
            body.beginFill(suitCol, isRm ? 0.4 : 0.85);
            body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.25);
            body.endFill();
            body.beginFill(0xffffff, 0.5);
            for (let bi = 0; bi < Math.min(2, bodyH / 4); bi++) {
                body.drawCircle(0, 2 + bi * 3, 0.8);
            }
            body.endFill();
        } else if (stg === 'kid') {
            const shirtH = Math.max(bodyH * 0.6, 3);
            body.beginFill(suitCol, isRm ? 0.4 : 1);
            body.drawRoundedRect(-bw / 2, 0, bw, shirtH, bw * 0.1);
            body.endFill();
            body.beginFill(0x2a2a3a, 0.8);
            body.drawRect(-bw / 2, shirtH, bw, Math.max(bodyH - shirtH, 2));
            body.endFill();
        } else {
            body.beginFill(suitCol, isR ? 0.4 : isRm ? 0.4 : 1);
            body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
            body.endFill();
            body.beginFill(0xffffff, 0.08);
            body.drawRoundedRect(-bw / 2 + 2, bodyH * 0.55, Math.max(bw - 4, 1), 3, 2);
            body.endFill();
        }
        body.y = -h + headH;
        cont.addChild(body);

        // ─── Head with age-specific accessories ───
        const head = new PIXI.Graphics();
        head.beginFill(skinCol, isR ? 0.3 : isRm ? 0.5 : 1);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(eyeCol);
        head.drawCircle(-bw * 0.12, headH * 0.38, isR ? eyeS * 1.5 : ageEyeS);
        head.drawCircle( bw * 0.12, headH * 0.38, isR ? eyeS * 1.5 : ageEyeS);
        head.endFill();
        if (stg === 'baby') {
            // Cute eye sparkles
            head.beginFill(0xffffff, 0.7);
            head.drawCircle(-bw * 0.12 + 1, headH * 0.35, ageEyeS * 0.4);
            head.drawCircle( bw * 0.12 + 1, headH * 0.35, ageEyeS * 0.4);
            head.endFill();
            // Small 'o' mouth
            head.beginFill(0xdd8888, 0.6);
            head.drawCircle(0, headH * 0.65, bw * 0.06);
            head.endFill();
            // Tuft of hair
            head.beginFill(eyeCol, 0.7);
            head.drawEllipse(-bw * 0.1, -1, bw * 0.12, 3);
            head.drawEllipse( bw * 0.05, -2, bw * 0.10, 2.5);
            head.endFill();
            // Pacifier
            head.beginFill(0xff88aa, 0.8); head.drawCircle(0, headH * 0.72, bw * 0.1); head.endFill();
            head.beginFill(0xffaacc, 0.9); head.drawCircle(0, headH * 0.72, bw * 0.06); head.endFill();
        } else {
            // Neutral mouth line
            head.beginFill(0x000000, 0.4);
            head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
            head.endFill();
        }
        if (stg === 'kid') {
            // Baseball cap
            head.beginFill(suitCol, 0.9);
            head.drawRect(-bw * 0.45, -1, bw * 0.9, 3);
            head.endFill();
            head.beginFill(suitCol, 0.85);
            head.drawRoundedRect(-bw * 0.38, -4, bw * 0.76, 5, 2);
            head.endFill();
            head.beginFill(0xffffff, 0.4); head.drawCircle(0, -3, 1); head.endFill();
        }
        if (isRm) {
            // Floating question mark
            head.beginFill(0xa78bfa, 0.7);
            head.drawRect(-1, -8, 2, 4);
            head.drawCircle(0, -10, 2.5);
            head.drawCircle(0, -3, 1);
            head.endFill();
        }
        head.y = -h;
        cont.addChild(head);

        // ─── Status dot ───
        const dot = new PIXI.Graphics();
        const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : stg === 'kid' ? 0x22d3ee : 0x4ade80;
        dot.beginFill(dotCol);
        dot.drawCircle(0, 0, stg === 'baby' ? 2.5 : 2);
        dot.endFill();
        dot.y = -h - 6;
        cont.addChild(dot);

        // Lifecycle alpha + blend (matches exterior)
        if (!isNPC) {
            cont.alpha = isR ? 0.6 : isRm ? 0.8 : 1.0;
            cont.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
        }

        // Click/hover handlers — same as exterior NPCs
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined') {
                if (isNPC) {
                    UI.selectModel({ id: m.id, name: m.name, isNPC: true, _trackType: 'npc', role: m.role || 'Worker', lab: 'other', desc: (m.role || 'Worker') + '. Commuting via metro.' });
                } else {
                    UI.selectModel(m);
                }
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, m.name || m.id, isNPC ? (m.role || 'Worker NPC') : (m.lab || ''));
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined') UI.hideTooltip();
        });

        // Store scaled leg base/swing so the leg-walk animation in update()
        // works correctly regardless of avatar size.
        return {
            cont, body, head, legL, legR, dot, highlight,
            _baseLegX: bw * 0.15,
            _legSwing: Math.max(0.6, bw * 0.075)
        };
    },

    cleanup() {
        // Remove window-level listeners
        if (this._onMove) window.removeEventListener('pointermove', this._onMove);
        if (this._onUp) window.removeEventListener('pointerup', this._onUp);
        if (this.avatarPool) {
            this.avatarPool.forEach(av => { if (av.cont && av.cont.destroy) av.cont.destroy({ children: true }); });
            this.avatarPool.clear();
        }
        this.avatarPool = null;
        this.scene = null;
        this.layer = null;
        this.bld = null;
        this.trainGfx = null;
        this._trainG = null;
        this._liftCar = null;
        this._liftCable = null;
        this._liftFloorTxt = null;
        this._liftTop = null;
        this._liftBot = null;
        this._hallFloorY = null;
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this._tunnelLightsCont = null;
        this.isDragging = false;
    }
};
