/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AGENT DISTRICT INTERIORS (v1.0.0)
   Self-contained interior module for autonomous AI agent buildings.
   Orchestration Hub: Workflow graphs, swarm control, agent status walls
   Tool Registry: API rack walls, integration panels
   Sandbox Arena: Benchmark screens, eval dashboards
   Deployment Gateway: Pipeline monitors, guardrail panels
   Memory Vault: Knowledge graph visualizations, vector store racks
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorAgents = {
    scene: null, layer: null, bld: null, avatars: [], bubbles: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = [];

        // Sky — use shared helper for consistency
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const floorH = 80, startX = 60, bldW = G.vpW - 120;
        const layouts = {
            'agents_orchestrator': { floors: ['Agent Bus', 'Swarm Control', 'Workflow Engine', 'Task Queue', 'Ops Deck', 'Command Bridge'],
                                     roofLabel: 'ORCHESTRATION HUB', col: 0xf43f5e, npcs: ['Architect', 'Ops Lead'] },
            'agents_toolshop':     { floors: ['API Vault', 'Integration Lab', 'Auth Proxy', 'Registry Floor'],
                                     roofLabel: 'TOOL REGISTRY', col: 0xfbbf24, npcs: ['Tool Eng', 'API Ops'] },
            'agents_sandbox':      { floors: ['Eval Pit', 'Benchmark Hall', 'Replay Room', 'Observation Deck', 'Arena Floor'],
                                     roofLabel: 'SANDBOX ARENA', col: 0x4ade80, npcs: ['Sandbox Eng', 'Eval Lead'] },
            'agents_deploy':       { floors: ['Staging', 'Guardrail Room', 'Pipeline Floor', 'Release Deck'],
                                     roofLabel: 'DEPLOYMENT GATEWAY', col: 0xef4444, npcs: ['Deploy SRE', 'Guard Eng'] },
            'agents_memory':       { floors: ['Vector Store', 'Embedding Lab', 'Knowledge Graph', 'Episodic Cache', 'Archive'],
                                     roofLabel: 'MEMORY VAULT', col: 0xa855f7, npcs: ['Memory Eng', 'Graph Ops'] }
        };
        const layout = layouts[bld.id] || { floors: ['Operations'], roofLabel: bld.name.toUpperCase(), col: 0xf43f5e, npcs: [] };
        const numFloors = layout.floors.length;
        const roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH + 220;

        // Roof sign
        const rc = new PIXI.Container();
        const bW = 220, bH = 28, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0f1a); sg.lineStyle(2, layout.col, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(layout.col, 0.05); sg.drawRect(bX, bY, bW, bH); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(layout.roofLabel, { fontFamily:'JetBrains Mono', fontSize:11, fontWeight:'bold', fill:'#' + layout.col.toString(16).padStart(6,'0'), letterSpacing:2 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt); this.scene.addChild(rc);

        // Floors
        const winMarginX = 50;
        const winY_off = 16;
        const winH_px = floorH - 28;
        const mullionPitch = 60;
        const mullionW = 6;

        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f) * floorH;
            const isB = f === -1;
            const floorName = isB ? layout.floors[0] : layout.floors[numFloors - 1 - f] || 'Operations';
            const rg = new PIXI.Graphics();
            // Side walls
            rg.beginFill(0x0a1020); rg.drawRect(startX-6, fy, 6, floorH); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wc = isB ? 0x080e18 : 0x0c1424;
            if (isB) {
                rg.beginFill(wc); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            } else {
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                InteriorCity._drawWallWithWindowCutout(
                    rg, wc,
                    startX, fy, bldW, floorH,
                    winX, winY, winW, winH_px,
                    mullionPitch, mullionW
                );
                rg.lineStyle(1.5, 0x1a2a40, 0.9);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.moveTo(winX, winY + winH_px * 0.5);
                rg.lineTo(winX + winW, winY + winH_px * 0.5);
                rg.lineStyle(0);
                // Rose-tinted glazing for agent district theme
                rg.beginFill(layout.col, 0.03);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.endFill();
            }
            // Floor slab
            rg.beginFill(0x0a1018); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x1a2538); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            // Accent line
            rg.beginFill(layout.col, 0.08); rg.drawRect(startX, fy, bldW, 2); rg.endFill();
            this.scene.addChild(rg);
            // Floor label
            const fl = new PIXI.Text(floorName.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:7, fill:layout.col, letterSpacing:2 });
            fl.anchor.set(0.5,0); fl.x = startX+bldW/2; fl.y = fy+6; this.scene.addChild(fl);
            // Floor props
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, bldW, pY, fy, floorH, floorName, layout.col, bld.id);
            // Spawn NPCs on this floor (night: only essential ops roles)
            const _dpNow = G.getDayPhase();
            const _isNight = _dpNow > 0.83 || _dpNow < 0.25;
            const _nightRoles = ['Ops Lead','Guard Eng','Deploy SRE'];
            const floorNpcs = this._getNPCsForFloor(floorName, layout, f, numFloors);
            floorNpcs.forEach(npcDef => {
                if (_isNight && !_nightRoles.includes(npcDef.role)) return;
                this.drawNPC(fc, startX + npcDef.xOff, pY, npcDef.role, npcDef.col);
            });
            // ─── Lobby receptionist (always present) ────────────────
            // Floor 0 is the ground-floor lobby. A receptionist sits behind
            // a small desk near the entrance so any tracked entity walking
            // in has someone to walk past.
            if (f === 0) {
                this._drawReceptionDesk(fc, startX + 80, pY, layout.col);
                this.drawNPC(fc, startX + 95, pY, 'Receptionist', layout.col);
            }
        }

        // ─── GROUND ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x0a1020); earth.drawRect(0, groundY, startX-6, floorH); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, floorH); earth.endFill();
        earth.beginFill(0x141e30); earth.drawRect(0, groundY, startX-6, 6); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x1a2a3a); earth.drawRect(0, groundY-2, startX-6, 4); earth.drawRect(startX+bldW+6, groundY-2, G.vpW-startX-bldW-6, 4); earth.endFill();
        this.scene.addChild(earth);

        // ─── ZONE-AWARE UNDERGROUND ───
        const surfaceY = groundY;
        const belowBasementY = roofH + (numFloors + 1) * floorH;
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── ELEVATOR ───
        const elevatorX = startX + bldW - 26;
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container();
            ec.y = groundY;
            this.scene.addChild(ec);
            const em = new PIXI.Graphics();
            em.beginFill(0xffffff);
            em.drawRect(startX, -numFloors * floorH, bldW, (numFloors + 1) * floorH);
            em.endFill();
            ec.addChild(em);
            ec.mask = em;
            this._lift = new CityElevator(ec, numFloors, floorH, elevatorX);
        }

        // Position + scroll
        const bp = 56;
        this.scene.y = G.vpH - bp - this.totalH + floorH;
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + floorH * 3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        this.layer.hitArea = new PIXI.Rectangle(0, 0, G.vpW, G.vpH);
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            this.isDragging = true; this._startY = e.clientY;
            this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorAgents.isDragging || !InteriorAgents.scene || InteriorAgents.scene.destroyed) return;
            let ny = InteriorAgents._startSceneY + (e.clientY - InteriorAgents._startY);
            ny = Math.max(InteriorAgents.minY, Math.min(ny, InteriorAgents.maxY));
            InteriorAgents.scene.y = ny;
        };
        this._onUp = () => {
            InteriorAgents.isDragging = false;
            if (InteriorAgents.layer) InteriorAgents.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    // Compact reception desk for the lobby floor — a slab with a counter,
    // a monitor screen and a small clipboard prop. Sits next to the
    // Receptionist NPC so tracked entities visibly walk past it.
    _drawReceptionDesk(c, x, y, col) {
        const g = new PIXI.Graphics();
        g.beginFill(0x1a2540); g.drawRect(x, y - 14, 60, 14); g.endFill();
        g.beginFill(0x0f1a2d); g.drawRect(x, y - 14, 60, 2); g.endFill();
        g.beginFill(col, 0.4); g.drawRect(x + 4, y - 12, 52, 1); g.endFill();
        // Monitor on the desk
        g.beginFill(0x0a0f1a); g.drawRect(x + 36, y - 24, 18, 10); g.endFill();
        g.beginFill(col, 0.45); g.drawRect(x + 38, y - 22, 14, 6); g.endFill();
        g.beginFill(0x222a40); g.drawRect(x + 43, y - 14, 4, 2); g.endFill();
        // Clipboard
        g.beginFill(0xfbbf24); g.drawRect(x + 8, y - 18, 8, 6); g.endFill();
        g.beginFill(0xffffff, 0.6); g.drawRect(x + 9, y - 17, 6, 4); g.endFill();
        UI.tip(g, 'Reception Desk');
        c.addChild(g);
    },

    _drawFloorProps(c, sx, bw, pY, fy, fh, floorName, col, bldId) {
        const fn = floorName.toLowerCase();
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        UI.tip(g, floorName, 'Agent ops floor');
        c.addChild(g);

        if (fn.includes('registry')) {
            // ─── FRAMEWORK REGISTRY — every real 2026 agent framework as a card ───
            const fws = (typeof AGENT_FRAMEWORKS !== 'undefined') ? Object.values(AGENT_FRAMEWORKS) : [];
            if (fws.length) {
                const perRow = Math.ceil(fws.length / 2);
                const cardW = (bw - 40) / perRow;
                fws.forEach((fw, i) => {
                    const row = Math.floor(i / perRow), coln = i % perRow;
                    const cx = sx + 20 + coln * cardW, cyy = fy + 14 + row * ((fh - 24) / 2);
                    const card = new PIXI.Container();
                    const cg = new PIXI.Graphics();
                    const fc = parseInt(fw.color.slice(1), 16);
                    cg.beginFill(0x0a0a18, 0.9); cg.drawRoundedRect(cx, cyy, cardW - 8, (fh - 30) / 2, 3); cg.endFill();
                    cg.lineStyle(1, fc, 0.55); cg.drawRoundedRect(cx, cyy, cardW - 8, (fh - 30) / 2, 3); cg.lineStyle(0);
                    cg.beginFill(fc, 0.18); cg.drawRect(cx, cyy, cardW - 8, 8); cg.endFill();
                    // A little "agent node" glyph
                    cg.beginFill(fc); cg.drawCircle(cx + 8, cyy + 20, 3); cg.endFill();
                    cg.lineStyle(1, fc, 0.6); cg.drawCircle(cx + 8, cyy + 20, 6); cg.lineStyle(0);
                    card.addChild(cg);
                    const nm = new PIXI.Text(fw.name, { fontFamily: 'JetBrains Mono', fontSize: 6, fill: fc, fontWeight: 'bold' });
                    nm.x = cx + 4; nm.y = cyy + 1.5; if (nm.width > cardW - 14) nm.scale.set((cardW - 14) / nm.width);
                    card.addChild(nm);
                    const pr = new PIXI.Text(fw.product || '', { fontFamily: 'JetBrains Mono', fontSize: 5.5, fill: 0xcbd5e1 });
                    pr.x = cx + 16; pr.y = cyy + 16; if (pr.width > cardW - 24) pr.scale.set((cardW - 24) / pr.width);
                    card.addChild(pr);
                    if (typeof UI !== 'undefined') UI.tip(card, `${fw.icon} ${fw.name} — ${fw.ceo}`, fw.milestone);
                    c.addChild(card);
                });
            }
            return;
        }

        if (fn.includes('command bridge') || fn.includes('ops deck') || fn.includes('swarm control')) {
            // ── Wall of agent status screens ──
            for (let mx = sx+30; mx < sx+bw-50; mx += 55) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+12, 42, 28); g.endFill();
                g.beginFill(col, 0.12); g.drawRect(mx+2, fy+14, 38, 24); g.endFill();
                // Workflow graph lines on screen
                g.lineStyle(1, col, 0.2);
                for (let ni = 0; ni < 3; ni++) {
                    const nx = mx+8+ni*12, ny = fy+20+ni*4;
                    g.drawCircle(nx, ny, 2);
                    if (ni < 2) { g.moveTo(nx+2, ny); g.lineTo(nx+12, ny+4); }
                }
                g.lineStyle(0);
                // Status dot
                const dotCol = Math.random() > 0.15 ? 0x4ade80 : 0xef4444;
                g.beginFill(dotCol, 0.8); g.drawCircle(mx+38, fy+16, 2); g.endFill();
            }
            // Operator desks
            for (let dx = sx+50; dx < sx+bw-80; dx += 100) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 60, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 60, 3); g.endFill();
                g.beginFill(0x334155); g.drawCircle(dx+30, pY-4, 6); g.endFill();
            }
        } else if (fn.includes('workflow') || fn.includes('task queue') || fn.includes('agent bus')) {
            // ── Workflow pipeline visualization — nodes connected by lines ──
            const nodeColors = [0xf43f5e, 0x22d3ee, 0x4ade80, 0x8b5cf6, 0xfbbf24, 0xef4444];
            const nodeY = fy + fh/2;
            const startNodeX = sx + 40;
            const nodeSpacing = (bw - 80) / 7;
            for (let ni = 0; ni < 7; ni++) {
                const nx = startNodeX + ni * nodeSpacing;
                const nc = nodeColors[ni % nodeColors.length];
                // Connection line to next node
                if (ni < 6) {
                    g.lineStyle(1, 0x334155, 0.5);
                    g.moveTo(nx + 8, nodeY);
                    g.lineTo(nx + nodeSpacing - 8, nodeY);
                    g.lineStyle(0);
                    // Arrow head
                    g.beginFill(0x334155, 0.4);
                    g.drawPolygon([nx+nodeSpacing-10, nodeY-3, nx+nodeSpacing-8, nodeY, nx+nodeSpacing-10, nodeY+3]);
                    g.endFill();
                }
                // Node circle
                g.beginFill(0x0a0a18); g.drawCircle(nx, nodeY, 10); g.endFill();
                g.beginFill(nc, 0.2); g.drawCircle(nx, nodeY, 10); g.endFill();
                g.lineStyle(1.5, nc, 0.4); g.drawCircle(nx, nodeY, 10); g.lineStyle(0);
                // Inner icon (small filled circle)
                g.beginFill(nc, 0.6); g.drawCircle(nx, nodeY, 3); g.endFill();
            }
            // Floor-level server racks
            for (let rx = sx+30; rx < sx+bw-40; rx += 50) {
                g.beginFill(0x111825); g.drawRect(rx, pY-22, 30, 22); g.endFill();
                g.beginFill(0x1a2540); g.drawRect(rx, pY-22, 30, 3); g.endFill();
                for (let ru = 0; ru < 3; ru++) {
                    const uy = pY - 18 + ru * 6;
                    const ledCol = Math.random() > 0.3 ? 0x4ade80 : 0xfbbf24;
                    g.beginFill(ledCol, 0.5); g.drawRect(rx+3, uy+1, 2, 2); g.endFill();
                }
            }
        } else if (fn.includes('api vault') || fn.includes('registry') || fn.includes('integration')) {
            // ── Tool/API racks — tall panels with colored connection ports ──
            for (let rx = sx+25; rx < sx+bw-40; rx += 40) {
                g.beginFill(0x111825); g.drawRect(rx, fy+12, 28, fh-22); g.endFill();
                g.beginFill(0x1a2540); g.drawRect(rx, fy+12, 28, 3); g.endFill();
                // Ports/connectors
                for (let pi = 0; pi < 6; pi++) {
                    const py = fy + 18 + pi * 8;
                    g.beginFill(0x0d1220); g.drawRect(rx+2, py, 24, 6); g.endFill();
                    // Color-coded connector
                    const portCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e, 0xa855f7, 0x3b82f6][pi];
                    g.beginFill(portCol, 0.5);
                    g.drawRect(rx+4, py+2, 4, 2); g.endFill();
                    // Activity indicator
                    if (Math.random() > 0.3) {
                        g.beginFill(portCol, 0.2);
                        g.drawRect(rx+10, py+2, 12, 2); g.endFill();
                    }
                }
            }
        } else if (fn.includes('auth') || fn.includes('guardrail') || fn.includes('staging')) {
            // ── Security/guardrail panels — shield icons, warning displays ──
            for (let mx = sx+35; mx < sx+bw-45; mx += 65) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 50, 26); g.endFill();
                g.beginFill(col, 0.08); g.drawRect(mx+2, fy+16, 46, 22); g.endFill();
                // Shield icon
                g.beginFill(col, 0.25);
                g.drawPolygon([mx+25, fy+18, mx+35, fy+22, mx+35, fy+32, mx+25, fy+36, mx+15, fy+32, mx+15, fy+22]);
                g.endFill();
            }
            // Rate limit bars
            for (let bx = sx+40; bx < sx+bw-60; bx += 80) {
                g.beginFill(0x1a2540); g.drawRect(bx, pY-12, 50, 12); g.endFill();
                const fill = 0.3 + Math.random() * 0.6;
                g.beginFill(fill > 0.7 ? 0xef4444 : 0x4ade80, 0.4);
                g.drawRect(bx+2, pY-10, (50-4) * fill, 8); g.endFill();
            }
        } else if (fn.includes('eval') || fn.includes('benchmark') || fn.includes('arena')) {
            // ── Benchmark leaderboard screens ──
            for (let mx = sx+30; mx < sx+bw-50; mx += 70) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+12, 55, 32); g.endFill();
                g.beginFill(0x4ade80, 0.08); g.drawRect(mx+2, fy+14, 51, 28); g.endFill();
                // Bar chart bars
                for (let bi = 0; bi < 5; bi++) {
                    const barH = 4 + Math.random() * 16;
                    const barCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e, 0x8b5cf6][bi];
                    g.beginFill(barCol, 0.35);
                    g.drawRect(mx+6+bi*9, fy+42-barH, 6, barH); g.endFill();
                }
            }
            // Testing pods
            for (let px = sx+50; px < sx+bw-80; px += 100) {
                g.beginFill(0x111825); g.drawRect(px, pY-18, 60, 18); g.endFill();
                g.beginFill(0x1a2540); g.drawRect(px, pY-20, 60, 3); g.endFill();
                // Status light
                g.beginFill(Math.random() > 0.2 ? 0x4ade80 : 0xfbbf24, 0.6);
                g.drawCircle(px+50, pY-10, 3); g.endFill();
            }
        } else if (fn.includes('replay') || fn.includes('observation')) {
            // ── Replay room — log screens showing agent traces ──
            for (let mx = sx+25; mx < sx+bw-40; mx += 60) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 48, 30); g.endFill();
                g.beginFill(0x0d1525); g.drawRect(mx+2, fy+16, 44, 26); g.endFill();
                // Scrolling log lines
                for (let li = 0; li < 6; li++) {
                    const lineCol = [0x4ade80, 0x22d3ee, 0xfbbf24, 0x64748b][Math.floor(Math.random()*4)];
                    const lineW = 10 + Math.random() * 28;
                    g.beginFill(lineCol, 0.15 + Math.random() * 0.15);
                    g.drawRect(mx+4, fy+18+li*4, lineW, 2); g.endFill();
                }
            }
        } else if (fn.includes('vector') || fn.includes('embedding') || fn.includes('archive')) {
            // ── Memory store racks — tall units with pulsing indicators ──
            for (let rx = sx+20; rx < sx+bw-30; rx += 50) {
                g.beginFill(0x0d1525); g.drawRect(rx, fy+14, 35, fh-24); g.endFill();
                g.beginFill(0x141e30); g.drawRect(rx, fy+14, 35, 3); g.endFill();
                for (let ru = 0; ru < 8; ru++) {
                    const uy = fy+20+ru*6;
                    g.beginFill(0x0a0f1a); g.drawRect(rx+2, uy, 31, 4); g.endFill();
                    for (let li = 0; li < 4; li++) {
                        const on = Math.random() > 0.25;
                        g.beginFill(on ? 0xa855f7 : 0x1a2530, on ? 0.5 : 0.2);
                        g.drawRect(rx+4+li*7, uy+1, 2, 2); g.endFill();
                    }
                }
            }
        } else if (fn.includes('knowledge graph')) {
            // ── Knowledge graph visualization — interconnected nodes ──
            const nodes = [];
            for (let ni = 0; ni < 12; ni++) {
                const nx = sx + 40 + Math.random() * (bw - 80);
                const ny = fy + 16 + Math.random() * (fh - 36);
                const nc = [0xa855f7, 0x22d3ee, 0x4ade80, 0xf43f5e][Math.floor(Math.random()*4)];
                nodes.push({x:nx, y:ny, col:nc});
                g.beginFill(nc, 0.3); g.drawCircle(nx, ny, 4); g.endFill();
                g.beginFill(nc, 0.6); g.drawCircle(nx, ny, 2); g.endFill();
            }
            // Connect nearby nodes
            g.lineStyle(1, 0x334155, 0.2);
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i+1; j < nodes.length; j++) {
                    const dx = nodes[j].x - nodes[i].x, dy = nodes[j].y - nodes[i].y;
                    if (Math.sqrt(dx*dx + dy*dy) < 100) {
                        g.moveTo(nodes[i].x, nodes[i].y);
                        g.lineTo(nodes[j].x, nodes[j].y);
                    }
                }
            }
            g.lineStyle(0);
        } else if (fn.includes('pipeline') || fn.includes('release') || fn.includes('deploy')) {
            // ── Deployment pipeline — horizontal stages ──
            const stages = ['Build', 'Test', 'Stage', 'Guard', 'Ship'];
            const stageW = (bw - 100) / stages.length;
            for (let si = 0; si < stages.length; si++) {
                const stX = sx + 40 + si * stageW;
                // Pipeline box
                g.beginFill(0x111825); g.drawRect(stX, fy+16, stageW-10, 28); g.endFill();
                const stCol = si < 3 ? 0x4ade80 : si === 3 ? 0xfbbf24 : 0x22d3ee;
                g.beginFill(stCol, 0.1); g.drawRect(stX+2, fy+18, stageW-14, 24); g.endFill();
                // Arrow connector
                if (si < stages.length - 1) {
                    g.beginFill(0x334155, 0.4);
                    g.drawPolygon([stX+stageW-8, fy+27, stX+stageW-2, fy+30, stX+stageW-8, fy+33]);
                    g.endFill();
                }
                // Status bar
                const fill = 0.4 + Math.random() * 0.6;
                g.beginFill(stCol, 0.3);
                g.drawRect(stX+4, fy+36, (stageW-18) * fill, 4); g.endFill();
            }
        } else {
            // ── Generic ops floor ──
            for (let dx = sx+50; dx < sx+bw-60; dx += 80) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 50, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 50, 3); g.endFill();
            }
        }
        // g was already added to c at the top so NPCs/cards layer above it
    },

    // ════════════════════════════════════════════════════
    //   NPC FLOOR ASSIGNMENT
    // ════════════════════════════════════════════════════

    _getNPCsForFloor(floorName, layout, floorIdx, numFloors) {
        const fn = floorName.toLowerCase();
        const bw = G.vpW - 120;

        if (fn.includes('command bridge') || fn.includes('ops deck')) {
            return [
                { role: 'Agent Architect', col: 0xf43f5e, xOff: bw * 0.25 },
                { role: 'Ops Lead', col: 0x22d3ee, xOff: bw * 0.6 }
            ];
        } else if (fn.includes('swarm control') || fn.includes('workflow')) {
            return [
                { role: 'Swarm Lead', col: 0x8b5cf6, xOff: bw * 0.35 },
                { role: 'Flow Eng', col: 0x22d3ee, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('task queue') || fn.includes('agent bus')) {
            return [{ role: 'Queue Ops', col: 0xfbbf24, xOff: bw * 0.5 }];
        } else if (fn.includes('api vault') || fn.includes('registry') || fn.includes('integration')) {
            return [
                { role: 'Tool Eng', col: 0xfbbf24, xOff: bw * 0.3 },
                { role: 'API Ops', col: 0x3b82f6, xOff: bw * 0.65 }
            ];
        } else if (fn.includes('auth') || fn.includes('guardrail')) {
            return [{ role: 'Guard Eng', col: 0xef4444, xOff: bw * 0.5 }];
        } else if (fn.includes('eval') || fn.includes('benchmark') || fn.includes('arena')) {
            return [
                { role: 'Sandbox Eng', col: 0x4ade80, xOff: bw * 0.3 },
                { role: 'Eval Lead', col: 0x22d3ee, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('replay') || fn.includes('observation')) {
            return [{ role: 'Trace Analyst', col: 0x94a3b8, xOff: bw * 0.5 }];
        } else if (fn.includes('vector') || fn.includes('embedding') || fn.includes('knowledge') || fn.includes('archive')) {
            return [
                { role: 'Memory Eng', col: 0xa855f7, xOff: bw * 0.35 },
                { role: 'Graph Ops', col: 0x64748b, xOff: bw * 0.65 }
            ];
        } else if (fn.includes('pipeline') || fn.includes('release') || fn.includes('staging')) {
            return [
                { role: 'Deploy SRE', col: 0xf97316, xOff: bw * 0.3 },
                { role: 'Release Eng', col: 0x4ade80, xOff: bw * 0.65 }
            ];
        } else {
            return [{ role: 'Technician', col: 0x64748b, xOff: bw * 0.5 }];
        }
    },

    // ════════════════════════════════════════════════════
    //   PIXEL ART NPC — agentic style (visor + antenna)
    // ════════════════════════════════════════════════════

    drawNPC(c, x, y, role, col) {
        const colHex = col || 0x64748b;
        const bw = 16, h = 32, headH = Math.round(32 * 0.4), bodyH = h - headH - 4, legH = 4;
        const cont = new PIXI.Container();

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        // Head — slightly angular (agent engineer vibe)
        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.2); head.endFill();
        // Visor/goggles instead of plain eyes — distinguishes from regular NPCs
        head.beginFill(colHex, 0.6); head.drawRect(-bw * 0.35, headH * 0.28, bw * 0.7, 3); head.endFill();
        // Visor lens dots
        head.beginFill(0xffffff, 0.7); head.drawRect(-bw * 0.15, headH * 0.32, 2, 2); head.drawRect(bw * 0.05, headH * 0.32, 2, 2); head.endFill();
        head.y = -h;

        // Antenna — small antenna on head (agent/comms motif)
        const antenna = new PIXI.Graphics();
        antenna.beginFill(0x64748b); antenna.drawRect(-0.5, -4, 1, 4); antenna.endFill();
        antenna.beginFill(colHex, 0.8); antenna.drawCircle(0, -5, 1.5); antenna.endFill();
        antenna.y = -h;

        // Body — lab coat / tech vest style
        const body = new PIXI.Graphics();
        body.beginFill(colHex); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        // Chest stripe (data band)
        body.beginFill(0xffffff, 0.15); body.drawRect(-bw / 2 + 1, 3, bw - 2, 2); body.endFill();
        body.y = -h + headH;

        // Legs
        const lw = Math.max(2, bw * 0.25), lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x1e293b); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x1e293b); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15;

        // Color dot above head
        const dot = new PIXI.Graphics();
        dot.beginFill(colHex); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 8;

        cont.addChild(shadow, legL, legR, body, head, antenna, dot);
        cont.x = x; cont.y = y;

        // No name label — hover tooltip + click info panel only
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.selectModel) {
                UI.selectModel({ id: 'agent_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true, _trackType: 'npc', role: role, lab: 'agents', desc: role + '. Agent District.' });
            }
        });
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined' && UI.showTooltip) UI.showTooltip(e, role, 'Agent District');
        });
        cont.on('pointerout', () => {
            if (typeof UI !== 'undefined' && UI.hideTooltip) UI.hideTooltip();
        });

        const npcId = 'agent_' + role.replace(/\s/g, '_').toLowerCase();
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            G._addTrackHighlight(cont, { id: npcId }, false);
        }

        c.addChild(cont);

        const agent = {
            m: { id: npcId, name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, antenna,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.8,
            role, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   NPC ANIMATION STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const AGENT_MSGS = [
            "Tool call succeeded.", "Workflow complete.", "Swarm synced.",
            "Memory indexed.", "Guardrail passed.", "Agent spawned.",
            "Task decomposed.", "Eval score: 94.2%.", "Context window full.",
            "Handoff to agent-3.", "Rollback triggered.", "All agents green.",
            "Vector search: 3ms.", "Pipeline deployed.", "Loop detected — pruning.",
            "Embedding batch done.", "Human-in-loop needed.", "Retry attempt 2/3."
        ];

        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            // Antenna pulse
            if (av.antenna) {
                av.antenna.alpha = 0.7 + Math.sin(G.tick * 0.08 + av.deskX) * 0.3;
            }

            switch (av.state) {
                case 'working': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.03 + av.deskX)) * 0.3;
                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.3) {
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 120;
                            av.targetX = Math.max(30, Math.min(G.vpW - 30, av.targetX));
                        } else if (r < 0.5) {
                            av.state = 'chatting';
                            av.timer = 80 + Math.floor(Math.random() * 60);
                            this.spawnBubble(av, AGENT_MSGS[Math.floor(Math.random() * AGENT_MSGS.length)]);
                        } else {
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.3) {
                                this.spawnBubble(av, AGENT_MSGS[Math.floor(Math.random() * AGENT_MSGS.length)]);
                            }
                        }
                    }
                    break;
                }
                case 'walking': {
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < 2) {
                        av.cont.x = av.targetX;
                        av.cont.scale.x = 1;
                        if (av.dot) av.dot.scale.x = 1;
                        av.state = 'working';
                        av.timer = 100 + Math.floor(Math.random() * 200);
                    } else {
                        const dir = dx > 0 ? 1 : -1;
                        av.cont.x += dir * av.speed;
                        av.cont.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    av.head.y = -av._h + Math.sin(G.tick * 0.12) * 1.5;
                    av.body.y = -av._h + av._h * 0.4 + Math.abs(Math.sin(G.tick * 0.12)) * 1.5;
                    av.legL.y = Math.sin(G.tick * 0.15) * 2.5;
                    av.legR.y = -Math.sin(G.tick * 0.15) * 2.5;
                    break;
                }
                case 'chatting': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.06) * 1;
                    av.body.y = -av._h + av._h * 0.36;
                    if (av.timer <= 0) {
                        av.state = 'working';
                        av.timer = 80 + Math.floor(Math.random() * 150);
                    }
                    break;
                }
            }
        });

        // Update speech bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 20);
            if (b.life <= 0) {
                if (b.cont.parent) b.cont.parent.removeChild(b.cont);
                b.cont.destroy({ children: true });
                this.bubbles.splice(i, 1);
            }
        }
    },

    spawnBubble(av, msg) {
        if (!this.scene || this.scene.destroyed) return;
        const bCont = new PIXI.Container();
        const txt = new PIXI.Text(msg, { fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        txt.anchor.set(0.5, 1); txt.y = -6;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.beginFill(0xffffff);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        bCont.addChild(bg, txt);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - av._h - 10;
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    },

    // ════════════════════════════════════════════════════
    //   UPDATE LOOP
    // ════════════════════════════════════════════════════

    update() {
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        if (this._lift && !this._lift.destroyed) this._lift.update();
        // Live trains attached by InteriorCity._drawZoneUnderground (agents profile)
        if (typeof InteriorCity !== 'undefined' && InteriorCity._liveTrains) InteriorCity._liveTrains.update();
        this.updateAvatars();
    }
};
