/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   NEWSPAPER INTERIOR — Singularity City Times HQ
   ────────────────────────────────────────────────────────────────────────────────────────────────
   3-floor building: Lobby + Printing Press (ground), Newsroom (2nd), Editor's Office (3rd).
   Clickable printing press on the ground floor opens the newspaper overlay.
   Day/night shift rotation with animated NPC avatars.
   Matches the visual style of all other interiors: sky + window cutouts + underground layers.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorNewspaper = {
    scene: null,
    layer: null,
    bld: null,
    avatarLayer: null,
    avatarPool: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    _lift: null,
    _staff: null,
    _inited: false,
    indoorLights: [],
    isDragging: false,
    _noYScroll: false,
    _startY: 0,
    _startSceneY: 0,
    minY: 0,
    maxY: 80,

    // ─── STAFF NPC ROSTER (single source of truth) ──────────────────────────────────
    // Same shape as AgentsZone.NPCS / RoboticsZone.NPCS / etc — registered with
    // NPCHousing.REGISTRY at init() time so these workers commute from worker
    // housing → metro → Times HQ → metro → home like every other zone's NPCs.
    // The interior renderer (_spawnStaff) reads the same list to draw them at
    // their desks when the player is inside the building.
    NPCS: [
        // ── Day shift ────────────────────────────────────────────────────────────────
        { id: 'np_editor',     name: 'Editor-in-Chief',  role: 'Editor-in-Chief',         workplace: 'times_hq', shift: 'day',   floor: 2, xOff: 0.20, color: '#fbbf24',
          desc: 'Runs the editorial floor. Decides which AI release leads the front page and which obituary gets a column inch. Veteran of three model graveyard expansions.' },
        { id: 'np_reporter1',  name: 'Senior Reporter',  role: 'Senior Reporter',         workplace: 'times_hq', shift: 'day',   floor: 1, xOff: 0.15, color: '#3b82f6',
          desc: 'Files the daily AI Industry Watch column. Has the founders of every major lab on speed-dial and the receipts to prove it.' },
        { id: 'np_journalist', name: 'Journalist',       role: 'General Reporter',        workplace: 'times_hq', shift: 'day',   floor: 1, xOff: 0.35, color: '#22c55e',
          desc: 'Covers benchmarks, releases, and the occasional CEO helicopter mishap. Working on a long-form piece about what models do at lunch.' },
        { id: 'np_journalist2',name: 'Investigative',    role: 'Investigative Reporter',  workplace: 'times_hq', shift: 'day',   floor: 1, xOff: 0.60, color: '#06b6d4',
          desc: 'Specializes in the Black Market beat. Has been refused entry to three AI Court hearings and never seen smiling.' },
        { id: 'np_photog',     name: 'Photographer',     role: 'Photographer',            workplace: 'times_hq', shift: 'day',   floor: 1, xOff: 0.75, color: '#a855f7',
          desc: 'Camera always at the ready for rocket launches, conference signings, and the Apex Beacon transferring labs.' },
        { id: 'np_copyedit',   name: 'Copy Editor',      role: 'Copy Editor',             workplace: 'times_hq', shift: 'day',   floor: 1, xOff: 0.50, color: '#f97316',
          desc: 'The reason the Times never publishes "GPT-4" when it means "GPT-4o". Defender of the en-dash and the Oxford comma.' },
        { id: 'np_reception',  name: 'Receptionist',     role: 'Receptionist',            workplace: 'times_hq', shift: 'day',   floor: 0, xOff: 0.18, color: '#fb7185',
          desc: 'First point of contact for tipsters, founders, and the occasional model citizen demanding a correction. Knows everyone in the city by name.' },
        // ── Night shift ──────────────────────────────────────────────────────────────
        { id: 'np_nightedit',  name: 'Night Editor',     role: 'Night Editor',            workplace: 'times_hq', shift: 'night', floor: 2, xOff: 0.20, color: '#fbbf24',
          desc: 'Steers the paper through the late hours. Owns the call on whether a midnight HackerNews drop is worth waking the front page for.' },
        { id: 'np_breaking',   name: 'Breaking News',    role: 'Breaking News Desk',      workplace: 'times_hq', shift: 'night', floor: 1, xOff: 0.30, color: '#ef4444',
          desc: 'Watches the news ticker and the arena leaderboard simultaneously. First to know when a frontier model lands at 3am UTC.' },
        { id: 'np_printop',    name: 'Print Operator',   role: 'Print Operator',          workplace: 'times_hq', shift: 'night', floor: 0, xOff: 0.55, color: '#22c55e',
          desc: 'Runs the press through the night so the morning Daily Brief is ready by 06:00. Knows every quirk of every roller.' },
    ],

    // Register staff with NPCHousing so commuter routines run on city boot. Same
    // pattern as AgentsZone.init / RoboticsZone.init / etc. Safe to call multiple
    // times — the existence check prevents duplicates.
    init() {
        if (this._inited) return;
        this._inited = true;
        if (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) {
            for (const npc of this.NPCS) {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            }
        }
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.avatarPool = new Map();
        this.indoorLights = [];
        layer.removeChildren();

        const W = G.vpW;
        const numFloors = 3;
        const floorH = 80;
        const roofH = 80;
        const bldW = Math.min(W, 800);
        const startX = Math.round((W - bldW) / 2);
        const totalH = roofH + (numFloors + 1) * floorH; // +1 for basement
        this.totalH = totalH;
        this.bldW = bldW;
        this.startX = startX;
        this.maxY = 80;
        this.minY = Math.min(0, G.vpH - totalH);

        // Scene container (scrollable)
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── SKY LAYER (stars + celestial body — same pattern as InteriorCity) ───
        this.skyContainer = new PIXI.Container();
        this.skyContainer.eventMode = 'none';
        this.scene.addChild(this.skyContainer);

        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff);
            s.drawCircle(0, 0, 0.5 + Math.random() * 1.2);
            s.endFill();
            s.x = Math.random() * W;
            s.y = Math.random() * roofH;
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);

        // ─── ELEVATOR LAYOUT ───
        const shaftW = 60;
        const elevatorX = startX + bldW - 26;
        const usableW = bldW - shaftW - 20;

        // ─── ROOF / PARAPET ───
        const roof = new PIXI.Graphics();
        roof.beginFill(0x3a2a18);
        roof.drawRect(startX, roofH - 18, bldW, 20);
        roof.endFill();
        roof.beginFill(0x4a3828);
        roof.drawRect(startX - 4, roofH - 20, bldW + 8, 4);
        roof.endFill();
        // Sign backplate
        roof.beginFill(0x0f172a);
        roof.drawRect(startX + bldW / 2 - 100, roofH - 16, 200, 12);
        roof.endFill();
        roof.beginFill(0xfbbf24, 0.15);
        roof.drawRect(startX + bldW / 2 - 100, roofH - 16, 200, 12);
        roof.endFill();
        this.scene.addChild(roof);

        const signTxt = new PIXI.Text('SINGULARITY CITY TIMES', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: 0xfbbf24, letterSpacing: 1
        });
        signTxt.anchor.set(0.5, 0.5);
        signTxt.x = startX + bldW / 2;
        signTxt.y = roofH - 10;
        this.scene.addChild(signTxt);

        // Satellite dish + antenna
        const antenna = new PIXI.Graphics();
        antenna.beginFill(0x64748b);
        antenna.drawRect(startX + bldW - 50, roofH - 34, 3, 16);
        antenna.endFill();
        antenna.beginFill(0x94a3b8);
        antenna.drawEllipse(startX + bldW - 48, roofH - 36, 8, 5);
        antenna.endFill();
        antenna.beginFill(0x22d3ee, 0.4);
        antenna.drawEllipse(startX + bldW - 48, roofH - 36, 5, 3);
        antenna.endFill();
        antenna.beginFill(0xef4444);
        antenna.drawCircle(startX + bldW - 48, roofH - 42, 1.5);
        antenna.endFill();
        this.scene.addChild(antenna);
        this._antennaLight = antenna;

        // ─── FLOORS (top to bottom, including basement) ───
        const floors = {};
        for (let f = numFloors - 1; f >= -1; f--) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;
            this.scene.addChild(floorCont);

            const pY = fy + floorH - 4; // standing Y
            floors[f] = { fy, pY, cont: floorCont };

            // ─── WALL WITH WINDOW CUTOUTS (shows sky through) ───
            const wallCol = f === 2 ? 0x2a2218 : f === 1 ? 0x1e1e2e : f === 0 ? 0x222230 : 0x1a1a24;
            const rg = new PIXI.Graphics();

            if (f >= 0) {
                // Window band: horizontal strip across the wall
                const winY = fy + 8;
                const winH = 26;
                const winX = startX + 20;
                const winW = usableW - 20;
                const mullionPitch = 90;
                const mullionW = 8;

                InteriorCity._drawWallWithWindowCutout(
                    rg, wallCol,
                    startX, fy, bldW, floorH,
                    winX, winY, winW, winH,
                    mullionPitch, mullionW
                );

                // Window frame outlines
                rg.lineStyle(1, 0x64748b, 0.4);
                rg.drawRect(winX, winY, winW, winH);
                rg.lineStyle(0);

                // Horizontal sash across mid-window
                rg.beginFill(wallCol);
                rg.drawRect(winX, winY + winH * 0.55, winW, 2);
                rg.endFill();
            } else {
                // Basement: solid wall, no windows
                rg.beginFill(wallCol);
                rg.drawRect(startX, fy, bldW, floorH);
                rg.endFill();
            }

            // Floor tiles
            rg.beginFill(f === 0 ? 0x3a3a4a : f === -1 ? 0x2a2a2a : 0x2d2d3d);
            rg.drawRect(startX, pY, bldW, 4);
            rg.endFill();
            // Ceiling accent line
            rg.beginFill(0x4a4a5a, 0.4);
            rg.drawRect(startX, fy, bldW, 2);
            rg.endFill();
            floorCont.addChild(rg);

            // ─── CEILING LIGHTS ───
            if (f >= 0) {
                for (let lx = startX + 50; lx < startX + usableW - 20; lx += 120) {
                    const fixture = new PIXI.Graphics();
                    fixture.beginFill(0xfef3c7, 0.6);
                    fixture.drawRect(lx - 12, fy + 2, 24, 2);
                    fixture.endFill();
                    floorCont.addChild(fixture);
                    const glow = new PIXI.Graphics();
                    glow.beginFill(0xfbbf24, 0.04);
                    glow.drawPolygon([lx - 8, fy + 4, lx + 8, fy + 4, lx + 30, pY - 4, lx - 30, pY - 4]);
                    glow.endFill();
                    floorCont.addChild(glow);
                    this.indoorLights.push({ g: glow, maxA: 0.06, type: 'warm' });
                }
            }

            // ─── FLOOR-SPECIFIC PROPS ───
            if (f === 2) this._drawEditorFloor(floorCont, startX, usableW, fy, pY, floorH);
            else if (f === 1) this._drawNewsroomFloor(floorCont, startX, usableW, fy, pY, floorH);
            else if (f === 0) this._drawLobbyFloor(floorCont, startX, usableW, fy, pY, floorH);
            else if (f === -1) this._drawBasement(floorCont, startX, usableW, fy, pY, floorH);
        }

        // ─── ELEVATOR SHAFT + CAR ───
        const shaftBg = new PIXI.Graphics();
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            shaftBg.beginFill(0x0a0a14);
            shaftBg.drawRect(elevatorX - 24, fy, 48, floorH);
            shaftBg.endFill();
            shaftBg.lineStyle(1, 0x333344, 0.4);
            shaftBg.drawRect(elevatorX - 24, fy, 48, floorH);
            shaftBg.lineStyle(0);
        }
        this.scene.addChild(shaftBg);

        const ec = new PIXI.Container();
        ec.y = roofH + numFloors * floorH + floorH;
        this.scene.addChild(ec);
        const em = new PIXI.Graphics();
        em.beginFill(0xffffff);
        em.drawRect(startX, roofH, bldW, (numFloors + 1) * floorH);
        em.endFill();
        this.scene.addChild(em);
        ec.mask = em;
        this._lift = new CityElevator(ec, numFloors, floorH, elevatorX);

        // ─── UNDERGROUND LAYERS (earth, pipes, rock — matches other interiors) ───
        const surfaceY = roofH + numFloors * floorH;
        const belowY = roofH + (numFloors + 1) * floorH;
        this._drawUnderground(startX, bldW, surfaceY, belowY, floorH, W);

        // ─── AVATAR LAYER ───
        this.avatarLayer = new PIXI.Container();
        this.avatarLayer.sortableChildren = true;
        this.scene.addChild(this.avatarLayer);

        // ─── STAFF NPCs ───
        this._spawnStaff(startX, usableW, floors);

        // ─── INITIAL POSITION + SCROLL HANDLERS ───
        const bottomPad = 40;
        const undergroundDepth = (typeof Underground !== 'undefined') ? Underground.FULL_STACK_DEPTH + 6 : 244;
        this.scene.y = G.vpH - bottomPad - totalH + floorH;
        this.minY = Math.min(this.scene.y - floorH * 3, G.vpH - bottomPad - totalH - undergroundDepth);
        this.maxY = Math.max(this.scene.y + floorH * 3, G.vpH - bottomPad);
        this._noYScroll = false;
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';

        window.removeEventListener('pointermove', this.onMove);
        window.removeEventListener('pointerup', this.onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        window.addEventListener('pointermove', this.onMove);
        window.addEventListener('pointerup', this.onUp);
    },

    // ═══════════════════════════════════════════════════════════════
    //  UNDERGROUND LAYERS — delegates to Underground module (city profile)
    // ═══════════════════════════════════════════════════════════════
    _drawUnderground(startX, bldW, surfaceY, belowY, floorH, W) {
        const g = new PIXI.Graphics();
        const seed = (this.bld && this.bld.x | 0) || 0;

        // Earth walls flanking the building at basement depth
        g.beginFill(0x2a2218);
        g.drawRect(0, surfaceY, startX - 2, floorH);
        g.drawRect(startX + bldW + 2, surfaceY, W - startX - bldW - 2, floorH);
        g.endFill();
        // Topsoil accent
        g.beginFill(0x3a3020);
        g.drawRect(0, surfaceY, startX - 2, 6);
        g.drawRect(startX + bldW + 2, surfaceY, W - startX - bldW - 2, 6);
        g.endFill();

        // Grass/sidewalk trim at surface
        g.beginFill(0x2d5a3f);
        g.drawRect(0, surfaceY - 4, startX, 4);
        g.drawRect(startX + bldW, surfaceY - 4, W - startX - bldW, 4);
        g.endFill();
        g.beginFill(0x3a3a4a);
        g.drawRect(0, surfaceY - 2, startX, 2);
        g.drawRect(startX + bldW, surfaceY - 2, W - startX - bldW, 2);
        g.endFill();

        // Foundation slab
        g.beginFill(0x2a2a34);
        g.drawRect(startX - 8, belowY, bldW + 16, 4);
        g.endFill();

        // ─── BELOW-BASEMENT STACK — delegate to Underground (city profile) ───
        if (typeof Underground !== 'undefined') {
            const undergroundY = belowY + 6;
            const undergroundH = Underground.FULL_STACK_DEPTH;
            Underground.drawBasementStack(g, 0, undergroundY, W, undergroundH, 'city', seed);
            // Deep void below
            g.beginFill(0x050508);
            g.drawRect(0, undergroundY + undergroundH, W, 500);
            g.endFill();
            this.scene.addChild(g);
            // Live trains overlay
            if (this._liveTrains) this._liveTrains.destroy();
            this._liveTrains = Underground.attachLiveTrains(
                this.scene, this.bld.x + (this.bld.w || bldW) / 2, 0,
                undergroundY + Underground.H_CABLE_TRAY, W, 1200);
            return;
        }

        // ─── FALLBACK: legacy inline rendering (only used if Underground module is missing) ───
        g.beginFill(0x0a0a0f);
        g.drawRect(0, belowY, W, 260);
        g.endFill();
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
        let cr = 101;
        const cr2 = () => { cr = (cr * 16807) % 2147483647; return (cr - 1) / 2147483646; };

        for (let ci = 0; ci < 20; ci++) {
            const cy = belowY + 3 + cr2() * 28;
            const col = cableCols[Math.floor(cr2() * cableCols.length)];
            const alpha = 0.3 + cr2() * 0.5;
            const thickness = 1 + cr2() * 1.5;
            g.lineStyle(thickness, col, alpha);
            g.moveTo(0, cy);
            let currentY = cy;
            for (let cx = 0; cx < W; cx += 60) {
                currentY += (cr2() * 8 - 4);
                if (currentY < belowY + 3) currentY = belowY + 3;
                if (currentY > belowY + 31) currentY = belowY + 31;
                g.lineTo(cx, currentY);
            }
            g.lineTo(W, currentY);
            g.lineStyle(0);
        }
        // Junction dots
        for (let ji = 0; ji < 80; ji++) {
            const jx = cr2() * W;
            const jy = belowY + 3 + cr2() * 28;
            g.beginFill(cableCols[Math.floor(cr2() * cableCols.length)], 0.5);
            g.drawCircle(jx, jy, 1 + cr2() * 1);
            g.endFill();
        }

        // ─── METRO TUNNEL CAVITY ───
        g.beginFill(0x0a0a10, 0.85);
        g.drawRect(0, belowY + 30, W, 100);
        g.endFill();
        // Support pillars
        for (let px = 40; px < W; px += 150) {
            g.beginFill(0x1a1a24);
            g.drawRect(px, belowY + 35, 8, 90);
            g.endFill();
            g.beginFill(0x2a2a3a);
            g.drawRect(px, belowY + 35, 2, 90);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(px + 4, belowY + 50, 1.5);
            g.endFill();
        }
        // Metro tracks on tunnel floor
        g.beginFill(0x2a2a3e);
        g.drawRect(0, belowY + 120, W, 10);
        g.endFill();
        g.beginFill(0xfacc15);
        g.drawRect(0, belowY + 131, W, 1);
        g.endFill();
        // Cross ties
        g.beginFill(0xd97706);
        for (let tx = 0; tx < W; tx += 16) {
            g.drawRect(tx, belowY + 122, 8, 6);
        }
        g.endFill();

        // ─── DEEP INFRASTRUCTURE LAYER ───
        g.beginFill(0x0a0a0f);
        g.drawRect(0, belowY + 135, W, 30);
        g.endFill();

        // ─── WATER PIPE (matches exterior: 0x0369a1 + 0x0284c7) ───
        g.beginFill(0x0369a1);
        g.drawRect(0, belowY + 180, W, 8);
        g.endFill();
        g.beginFill(0x0284c7);
        g.drawRect(0, belowY + 182, W, 4);
        g.endFill();

        // ─── SEWER TRUNK (matches exterior: 0xb45309 + 0xd97706) ───
        g.beginFill(0xb45309);
        g.drawRect(0, belowY + 195, W, 12);
        g.endFill();
        g.beginFill(0xd97706);
        g.drawRect(0, belowY + 197, W, 8);
        g.endFill();

        // ─── JUNCTION BOXES ───
        for (let jx = 40; jx < W; jx += 180) {
            g.beginFill(0x334155);
            g.drawRect(jx, belowY + 140, 12, 36);
            g.endFill();
            g.beginFill(0x0ea5e9);
            g.drawRect(jx + 40, belowY + 183, 8, 10);
            g.endFill();
            g.beginFill(0xf59e0b);
            g.drawRect(jx + 80, belowY + 198, 8, 14);
            g.endFill();
        }

        // ─── DEEP VOID ───
        g.beginFill(0x050508);
        g.drawRect(0, belowY + 215, W, 500);
        g.endFill();

        this.scene.addChild(g);
    },

    // ═══════════════════════════════════════════════════════════════
    //  BASEMENT — Archives & Storage
    // ═══════════════════════════════════════════════════════════════
    _drawBasement(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Dark basement background
        g.beginFill(0x0a0a10);
        g.drawRect(startX, fy, usableW + 54, floorH);
        g.endFill();
        g.beginFill(0x121220);
        g.drawRect(startX, fy, usableW + 54, floorH);
        g.endFill();

        // Filing cabinets (newspaper archives)
        for (let i = 0; i < 5; i++) {
            const cx = startX + 20 + i * 55;
            g.beginFill(0x334155);
            g.drawRect(cx, pY - 50, 30, 50);
            g.endFill();
            g.beginFill(0x475569);
            g.drawRect(cx, pY - 50, 30, 3);
            g.endFill();
            // Drawer handles
            for (let d = 0; d < 3; d++) {
                g.beginFill(0x64748b);
                g.drawRect(cx + 10, pY - 45 + d * 16, 10, 2);
                g.endFill();
            }
            // Label
            g.beginFill(0xfbbf24, 0.3);
            g.drawRect(cx + 8, pY - 42, 14, 6);
            g.endFill();
        }

        // Storage boxes
        const boxCols = [0x78350f, 0x5c3a1e, 0x4a2e16];
        for (let i = 0; i < 4; i++) {
            const bx = startX + usableW - 100 + i * 22;
            const bh = 14 + Math.floor(i * 3.7) % 8;
            g.beginFill(boxCols[i % boxCols.length]);
            g.drawRect(bx, pY - bh, 18, bh);
            g.endFill();
        }

        // Bare hanging light bulb
        g.beginFill(0x64748b);
        g.drawRect(startX + usableW / 2, fy + 2, 1, 12);
        g.endFill();
        const bulbGlow = new PIXI.Graphics();
        bulbGlow.beginFill(0xfbbf24, 0.06);
        bulbGlow.drawCircle(startX + usableW / 2, fy + 18, 30);
        bulbGlow.endFill();
        cont.addChild(bulbGlow);
        this.indoorLights.push({ g: bulbGlow, maxA: 0.08, type: 'warm' });
        g.beginFill(0xfef3c7, 0.8);
        g.drawCircle(startX + usableW / 2, fy + 16, 3);
        g.endFill();

        // Parking lines (shared pattern from InteriorCity basements)
        g.beginFill(0xfacc15, 0.15);
        for (let px = startX + 30; px < startX + usableW - 30; px += 80) {
            g.drawRect(px, pY - 2, 40, 2);
        }
        g.endFill();

        cont.addChild(g);

        const label = new PIXI.Text('ARCHIVES', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x64748b, letterSpacing: 1
        });
        label.x = startX + 8;
        label.y = fy + 4;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 2 — EDITOR'S OFFICE (top floor)
    // ═══════════════════════════════════════════════════════════════
    _drawEditorFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Large executive desk
        const deskX = startX + 60;
        g.beginFill(0x5c3a1e);
        g.drawRect(deskX, pY - 16, 50, 16);
        g.endFill();
        g.beginFill(0x4a2e16);
        g.drawRect(deskX, pY - 16, 50, 3);
        g.endFill();
        // Monitor
        g.beginFill(0x0f172a);
        g.drawRect(deskX + 15, pY - 30, 18, 14);
        g.endFill();
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(0xfbbf24, 0.4);
        screenGlow.drawRect(deskX + 17, pY - 28, 14, 10);
        screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(screenGlow);
        this.indoorLights.push({ g: screenGlow, maxA: 0.5, type: 'screen' });

        // Executive chair
        g.beginFill(0x1e293b);
        g.drawRect(deskX + 20, pY - 8, 12, 8);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRect(deskX + 18, pY - 18, 16, 10);
        g.endFill();

        // Bookshelf against back wall
        const shelfX = startX + usableW - 70;
        g.beginFill(0x5c3a1e);
        g.drawRect(shelfX, fy + 36, 50, pY - fy - 36);
        g.endFill();
        for (let sy = fy + 48; sy < pY - 8; sy += 16) {
            g.beginFill(0x4a2e16);
            g.drawRect(shelfX + 2, sy, 46, 2);
            g.endFill();
            for (let bx = shelfX + 4; bx < shelfX + 46; bx += 6) {
                const bookCol = [0x3b82f6, 0xef4444, 0x22c55e, 0xfbbf24, 0xa855f7, 0x06b6d4][Math.floor(Math.random() * 6)];
                g.beginFill(bookCol, 0.7);
                g.drawRect(bx, sy - 12, 4, 12);
                g.endFill();
            }
        }

        // Framed front page on wall
        const frameX = startX + usableW / 2;
        g.beginFill(0x5c3a1e);
        g.drawRect(frameX, fy + 38, 24, 30);
        g.endFill();
        g.beginFill(0xf4ecd6);
        g.drawRect(frameX + 2, fy + 40, 20, 26);
        g.endFill();
        g.beginFill(0x1a1308, 0.3);
        for (let ly = fy + 44; ly < fy + 64; ly += 4) g.drawRect(frameX + 4, ly, 16, 1);
        g.endFill();

        // Potted plant
        g.beginFill(0x5c3a1e);
        g.drawRect(startX + 20, pY - 12, 12, 12);
        g.endFill();
        g.beginFill(0x22c55e);
        g.drawCircle(startX + 26, pY - 18, 8);
        g.endFill();
        g.beginFill(0x16a34a);
        g.drawCircle(startX + 22, pY - 20, 5);
        g.endFill();

        cont.addChild(g);
        const label = new PIXI.Text('EDITOR\'S OFFICE', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x94a3b8, letterSpacing: 1
        });
        label.x = startX + 8;
        label.y = fy + 36;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 1 — NEWSROOM (middle floor)
    // ═══════════════════════════════════════════════════════════════
    _drawNewsroomFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Reporter desks with PCs
        for (let i = 0; i < 4; i++) {
            const dx = startX + 30 + i * (usableW / 4.5);
            g.beginFill(0x3a3a4a);
            g.drawRect(dx, pY - 14, 30, 14);
            g.endFill();
            g.beginFill(0x0f172a);
            g.drawRect(dx + 8, pY - 26, 14, 12);
            g.endFill();
            const glow = new PIXI.Graphics();
            glow.beginFill(0x22d3ee, 0.35);
            glow.drawRect(dx + 9, pY - 25, 12, 10);
            glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            cont.addChild(glow);
            this.indoorLights.push({ g: glow, maxA: 0.4, type: 'screen' });
        }

        // Bulletin board
        const bbX = startX + usableW - 55;
        g.beginFill(0x78350f);
        g.drawRect(bbX, fy + 38, 40, 30);
        g.endFill();
        g.beginFill(0x92400e);
        g.drawRect(bbX + 2, fy + 40, 36, 26);
        g.endFill();
        const pinCols = [0xf4ecd6, 0xfef3c7, 0xfde68a, 0xffffff];
        for (let pi = 0; pi < 6; pi++) {
            const px = bbX + 4 + (pi % 3) * 11;
            const py = fy + 42 + Math.floor(pi / 3) * 13;
            g.beginFill(pinCols[pi % pinCols.length], 0.8);
            g.drawRect(px, py, 8, 10);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(px + 4, py, 1.5);
            g.endFill();
        }

        // "BREAKING NEWS" wall monitor
        const bnX = startX + usableW / 2 - 25;
        g.beginFill(0x0f172a);
        g.drawRect(bnX, fy + 38, 50, 28);
        g.endFill();
        g.beginFill(0x1e293b);
        g.drawRect(bnX + 2, fy + 40, 46, 24);
        g.endFill();
        const bnGlow = new PIXI.Graphics();
        bnGlow.beginFill(0xef4444, 0.3);
        bnGlow.drawRect(bnX + 4, fy + 42, 42, 20);
        bnGlow.endFill();
        bnGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(bnGlow);
        this.indoorLights.push({ g: bnGlow, maxA: 0.35, type: 'screen' });

        const bnText = new PIXI.Text('BREAKING', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 5, fill: 0xef4444
        });
        bnText.anchor.set(0.5, 0.5);
        bnText.x = bnX + 25;
        bnText.y = fy + 52;
        cont.addChild(bnText);

        // Coffee machine
        g.beginFill(0x1e293b);
        g.drawRect(startX + 15, pY - 20, 14, 20);
        g.endFill();
        g.beginFill(0xef4444, 0.6);
        g.drawCircle(startX + 22, pY - 14, 2);
        g.endFill();

        cont.addChild(g);
        const label = new PIXI.Text('NEWSROOM', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x94a3b8, letterSpacing: 1
        });
        label.x = startX + 8;
        label.y = fy + 36;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 0 — LOBBY + PRINT ROOM (ground floor)
    // ═══════════════════════════════════════════════════════════════
    _drawLobbyFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Reception desk
        const rxX = startX + 30;
        g.beginFill(0x5c3a1e);
        g.drawRect(rxX, pY - 18, 60, 18);
        g.endFill();
        g.beginFill(0x4a2e16);
        g.drawRect(rxX, pY - 18, 60, 3);
        g.endFill();
        g.beginFill(0x0f172a);
        g.drawRect(rxX + 22, pY - 30, 14, 12);
        g.endFill();
        const rxGlow = new PIXI.Graphics();
        rxGlow.beginFill(0x22d3ee, 0.3);
        rxGlow.drawRect(rxX + 23, pY - 29, 12, 10);
        rxGlow.endFill();
        rxGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(rxGlow);
        this.indoorLights.push({ g: rxGlow, maxA: 0.4, type: 'screen' });

        // ─── PRINTING PRESS (interactive!) ───
        const pressX = startX + usableW / 2 + 20;
        const pressW = 90;
        const pressH = 50;
        const pressY = pY - pressH;

        g.beginFill(0x1e293b);
        g.drawRect(pressX, pressY, pressW, pressH);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRect(pressX, pressY, pressW, 4);
        g.endFill();
        // Rollers
        g.beginFill(0x64748b);
        g.drawCircle(pressX + 20, pressY + 20, 8);
        g.drawCircle(pressX + 45, pressY + 20, 8);
        g.drawCircle(pressX + 70, pressY + 20, 8);
        g.endFill();
        g.beginFill(0x475569);
        g.drawCircle(pressX + 20, pressY + 20, 4);
        g.drawCircle(pressX + 45, pressY + 20, 4);
        g.drawCircle(pressX + 70, pressY + 20, 4);
        g.endFill();
        // Paper output
        g.beginFill(0xf4ecd6, 0.7);
        g.drawRect(pressX + pressW - 5, pressY + 30, 18, 2);
        g.drawRect(pressX + pressW - 3, pressY + 33, 14, 2);
        g.drawRect(pressX + pressW - 1, pressY + 36, 10, 2);
        g.endFill();
        // Status lights
        g.beginFill(0x22c55e);
        g.drawCircle(pressX + 10, pressY + 8, 2);
        g.endFill();
        g.beginFill(0xfbbf24);
        g.drawCircle(pressX + 18, pressY + 8, 2);
        g.endFill();
        cont.addChild(g);

        // Press glow
        const pressGlow = new PIXI.Graphics();
        pressGlow.beginFill(0xfbbf24, 0.08);
        pressGlow.drawRect(pressX - 4, pressY - 4, pressW + 8, pressH + 8);
        pressGlow.endFill();
        pressGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(pressGlow);
        this.indoorLights.push({ g: pressGlow, maxA: 0.12, type: 'warm' });

        // Click zone
        const pressHit = new PIXI.Graphics();
        pressHit.beginFill(0xffffff, 0.001);
        pressHit.drawRect(pressX - 4, pressY - 4, pressW + 8, pressH + 8);
        pressHit.endFill();
        pressHit.eventMode = 'static';
        pressHit.cursor = 'pointer';
        pressHit.on('pointertap', () => {
            if (typeof Newspaper !== 'undefined') Newspaper.open();
        });
        cont.addChild(pressHit);

        const pressLabel = new PIXI.Text('CLICK PRESS TO READ', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 5,
            fill: 0xfbbf24, letterSpacing: 0.5
        });
        // Anchor bottom-center so the label hovers just above the press
        // machine instead of crossing into the basement wall.
        pressLabel.anchor.set(0.5, 1);
        pressLabel.x = pressX + pressW / 2;
        pressLabel.y = pressY - 4;
        cont.addChild(pressLabel);
        this._pressLabel = pressLabel;

        // Newspaper stacks
        for (let si = 0; si < 3; si++) {
            const sx = pressX + pressW + 18 + si * 12;
            const stackG = new PIXI.Graphics();
            for (let p = 0; p < 4 - si; p++) {
                stackG.beginFill(0xf4ecd6, 0.6 + p * 0.1);
                stackG.drawRect(sx, pY - 3 - p * 3, 10, 3);
                stackG.endFill();
            }
            cont.addChild(stackG);
        }

        // Delivery dolly
        const dollyG = new PIXI.Graphics();
        dollyG.beginFill(0x64748b);
        dollyG.drawRect(startX + 15, pY - 6, 18, 2);
        dollyG.endFill();
        dollyG.beginFill(0x475569);
        dollyG.drawCircle(startX + 19, pY, 3);
        dollyG.drawCircle(startX + 29, pY, 3);
        dollyG.endFill();
        cont.addChild(dollyG);

        const label = new PIXI.Text('LOBBY & PRESS ROOM', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x94a3b8, letterSpacing: 1
        });
        label.x = startX + 8;
        label.y = fy + 36;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  STAFF NPCs — day/night shift rotation
    // ═══════════════════════════════════════════════════════════════
    _spawnStaff(startX, usableW, floors) {
        const day   = this.NPCS.filter(n => n.shift === 'day');
        const night = this.NPCS.filter(n => n.shift === 'night');
        this._staff = { day, night };

        for (const w of this.NPCS) {
            const floorData = floors[w.floor];
            if (!floorData) continue;
            const wx = startX + usableW * w.xOff;
            const wy = floorData.pY;

            // Model object shaped to match what UI.selectModel + UI.showTooltip expect
            // for an NPC. isNPC:true routes the panel to the NPC layout; phase 'released'
            // keeps it out of any "training/rumored" code paths.
            const colHex = typeof w.color === 'string' ? parseInt(w.color.replace('#', ''), 16) : (w.color || 0x22d3ee);
            const npcModel = {
                id: w.id, name: w.name, role: w.role,
                isNPC: true, phase: 'released', lab: 'other',
                desc: w.desc, _npcColor: colHex
            };
            const av = this._makeAvatarSprite(npcModel);
            av.cont.x = wx;
            av.cont.y = wy;
            av._isStaff = true;
            av._deskX = wx;
            av._floorY = wy;
            av._speed = 0.4 + Math.random() * 0.3;
            av._walkTarget = wx;
            av._walkTimer = 120 + Math.floor(Math.random() * 300);
            av._walkRange = 35;

            // Hover tooltip + click-to-open profile, matching the rest of the city.
            // hitArea makes the small head clickable from a forgiving rectangle around
            // the whole sprite — same pattern as interior_legacy / interior_npc.
            av.cont.hitArea = new PIXI.Rectangle(-12, -42, 24, 46);
            av.cont.on('pointertap', () => {
                if (typeof UI !== 'undefined') UI.selectModel(npcModel);
            });
            av.cont.on('pointerover', (e) => {
                if (typeof UI !== 'undefined') UI.showTooltip(e, w.name, 'Times Staff · ' + w.role);
            });
            av.cont.on('pointerout', () => {
                if (typeof UI !== 'undefined') UI.hideTooltip();
            });

            this.avatarLayer.addChild(av.cont);
            this.avatarPool.set('staff_' + w.id, av);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  AVATAR SPRITE FACTORY
    // ═══════════════════════════════════════════════════════════════
    _makeAvatarSprite(m) {
        const cont = new PIXI.Container();
        let suitHex = 0x22d3ee;
        if (m._npcColor) {
            suitHex = typeof m._npcColor === 'number' ? m._npcColor : parseInt(String(m._npcColor).replace('#', ''), 16);
        }

        const bw = 16, h = 32, headH = Math.round(h * 0.4), bodyH = h - headH - 4;

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();
        cont.addChild(shadow);

        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -h / 2, h * 0.65);
        highlight.visible = false;
        cont.addChild(highlight);

        const lw = Math.max(2, bw * 0.25), lh = Math.max(4, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x3d2914); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill();
        legL.x = -bw * 0.15;
        cont.addChild(legL);
        const legR = new PIXI.Graphics();
        legR.beginFill(0x3d2914); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill();
        legR.x = bw * 0.15;
        cont.addChild(legR);

        const body = new PIXI.Graphics();
        body.beginFill(suitHex);
        body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1);
        body.endFill();
        body.beginFill(0xffffff, 0.08);
        body.drawRoundedRect(-bw / 2 + 2, bodyH * 0.55, bw - 4, 3, 2);
        body.endFill();
        body.y = -h + headH;
        cont.addChild(body);

        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, 1.2);
        head.drawCircle(bw * 0.1, headH * 0.38, 1.2);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;
        cont.addChild(head);

        const dot = new PIXI.Graphics();
        dot.beginFill(suitHex); dot.drawCircle(0, 0, 2); dot.endFill();
        dot.y = -h - 6;
        cont.addChild(dot);

        cont.eventMode = 'static';
        cont.cursor = 'pointer';

        return { cont, body, head, legL, legR, dot, highlight };
    },

    // ═══════════════════════════════════════════════════════════════
    //  UPDATE — sky, shifts, patrol, lights
    // ═══════════════════════════════════════════════════════════════
    update() {
        if (!this.scene || !this.bld || !this.avatarPool) return;
        const tick = G.tick || 0;
        const dp = G.getDayPhase();
        const night = dp > 0.83 || dp < 0.25;

        // ─── Sky gradient (DOM background — exact match with InteriorCity) ───
        const vp = document.getElementById('viewport');
        if (vp) {
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
            // Weather overrides (matches InteriorCity exactly)
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
            vp.style.background = sky;
        }

        // ─── Celestial body (moon/sun) ───
        if (this.celestialGfx) {
            this.celestialGfx.clear();
            const W = G.vpW;
            if (night) {
                let np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42;
                this.celestialGfx.beginFill(0xe8e8d0);
                this.celestialGfx.drawCircle(W * np, 40 + Math.sin(np * Math.PI) * 30, 12);
                this.celestialGfx.endFill();
            } else {
                let dayP = (dp - 0.25) / (0.83 - 0.25);
                this.celestialGfx.beginFill(0xffe066);
                this.celestialGfx.drawCircle(W * dayP, 40 + Math.sin(dayP * Math.PI) * 30, 15);
                this.celestialGfx.endFill();
            }
        }

        // ─── Stars twinkling ───
        if (this.starsLayer) {
            this.starsLayer.visible = night;
            if (night) {
                this.starsLayer.children.forEach(s => {
                    s.alpha = 0.15 + Math.abs(Math.sin(tick * 0.03 + s._phase)) * 0.5;
                });
            }
        }
        // Live trains visible in basement tunnel slice
        if (this._liveTrains) this._liveTrains.update();

        // ─── Day/night shift rotation ───
        const isNightShift = night;
        const activeShift = isNightShift
            ? (this._staff ? this._staff.night : [])
            : (this._staff ? this._staff.day : []);
        const inactiveShift = isNightShift
            ? (this._staff ? this._staff.day : [])
            : (this._staff ? this._staff.night : []);

        for (const w of activeShift) {
            const av = this.avatarPool.get('staff_' + w.id);
            if (!av) continue;
            av.cont.visible = true;
            av._walkTimer--;
            if (av._walkTimer <= 0) {
                av._walkTarget = av._deskX + (Math.random() - 0.5) * av._walkRange * 2;
                av._walkTimer = 150 + Math.floor(Math.random() * 300);
            }
            const dx = av._walkTarget - av.cont.x;
            if (Math.abs(dx) > 1) {
                av.cont.x += Math.sign(dx) * av._speed;
                if (av.legL && av.legR) {
                    const phase = Math.sin(tick * 0.15 + (w.id.charCodeAt(3) || 0) * 0.3);
                    av.legL.y = phase * 2.5;
                    av.legR.y = -phase * 2.5;
                }
            } else {
                if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                if (av.body) av.body.rotation = Math.sin(tick * 0.04 + (w.id.charCodeAt(3) || 0) * 0.5) * 0.02;
            }
            av.cont.zIndex = Math.round(av.cont.y);
        }
        for (const w of inactiveShift) {
            const av = this.avatarPool.get('staff_' + w.id);
            if (av) av.cont.visible = false;
        }

        // ─── Indoor lights ───
        for (const l of this.indoorLights) {
            if (!l.g || l.g.destroyed) continue;
            const flicker = 0.85 + Math.sin(tick * 0.08 + (l.g.x || 0) * 0.1) * 0.15;
            l.g.alpha = l.maxA * flicker * (night ? 1.2 : 0.6);
        }

        // ─── Antenna blink + press label pulse ───
        if (this._antennaLight) this._antennaLight.alpha = Math.sin(tick * 0.15) > 0 ? 1 : 0.3;
        if (this._pressLabel) this._pressLabel.alpha = 0.5 + Math.sin(tick * 0.08) * 0.4;
    },

    // ═══════════════════════════════════════════════════════════════
    //  SCROLL HANDLERS
    // ═══════════════════════════════════════════════════════════════
    onMove: (e) => {
        if (!InteriorNewspaper.isDragging || !InteriorNewspaper.scene || InteriorNewspaper.scene.destroyed) return;
        let newY = InteriorNewspaper._startSceneY + (e.clientY - InteriorNewspaper._startY);
        if (newY < InteriorNewspaper.minY) newY = InteriorNewspaper.minY;
        if (newY > InteriorNewspaper.maxY) newY = InteriorNewspaper.maxY;
        InteriorNewspaper.scene.y = newY;
    },
    onUp: () => {
        InteriorNewspaper.isDragging = false;
        if (InteriorNewspaper.layer) InteriorNewspaper.layer.cursor = 'grab';
    },

    // ═══════════════════════════════════════════════════════════════
    //  CLEANUP
    // ═══════════════════════════════════════════════════════════════
    cleanup() {
        this.avatarPool = null;
        this._staff = null;
        this._lift = null;
        this._antennaLight = null;
        this._pressLabel = null;
        this.indoorLights = [];
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
    },
};
