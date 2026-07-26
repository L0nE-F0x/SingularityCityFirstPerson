/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER ZONE INTERIORS (v1.0.0)
   Self-contained interior module for power grid facilities.
   Nuclear: Control Room, Reactor Hall, Turbine Floor, Waste Storage
   Coal: Boiler Room, Control Deck, Conveyor Level, Ash Pit
   Others: simplified 2-floor layouts
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorPower = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false,

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];

        // Sky — use shared helper for consistency with InteriorCity
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const floorH = 80, startX = 60, bldW = G.vpW - 120;
        const layouts = {
            'power_nuclear': { floors: ['Waste Storage', 'Turbine Hall', 'Reactor Core', 'Control Room'], roofLabel: 'CRANE CLEAN ENERGY', col: 0x4ade80, npcs: ['Reactor Tech', 'Grid Operator'] },
            'power_coal':    { floors: ['Fuel Skids', 'Turbine Gensets', 'Exhaust Deck', 'Control Deck'], roofLabel: 'GAS TURBINE ARRAY', col: 0xf59e0b, npcs: ['Turbine Foreman'] },
            'power_hydro':   { floors: ['Turbine Hall', 'Generator Room', 'Control Room'], roofLabel: 'COLUMBIA HYDRO', col: 0x06b6d4, npcs: ['Dam Keeper'] },
            'power_solar':   { floors: ['Battery Vault', 'Inverter Room', 'Monitoring Station'], roofLabel: 'SOLAR + STORAGE', col: 0xfbbf24, npcs: ['Solar Engineer'] },
            'power_wind':    { floors: ['Nacelle Access', 'Monitoring Hub'], roofLabel: 'SUNZIA WIND', col: 0x60a5fa, npcs: ['Turbine Tech'] },
            'power_smr':     { floors: ['TRISO Fuel Bay', 'Reactor Cell', 'Control Room'], roofLabel: 'HERMES 2 · KAIROS', col: 0x2dd4bf, npcs: ['SMR Engineer'] },
            'power_fusion':  { floors: ['Capacitor Vault', 'Fusion Chamber', 'Pulse Control'], roofLabel: 'POLARIS · HELION', col: 0xc084fc, npcs: ['Plasma Physicist'] }
        };
        const layout = layouts[bld.id] || { floors: ['Operations'], roofLabel: bld.name.toUpperCase(), col: 0x94a3b8, npcs: [] };
        const numFloors = layout.floors.length;
        const roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH;

        // Roof sign
        const rc = new PIXI.Container();
        const bW = 200, bH = 28, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, layout.col, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        rc.addChild(sg);
        const lt = new PIXI.Text(layout.roofLabel, { fontFamily:'JetBrains Mono', fontSize:11, fontWeight:'bold', fill:'#' + layout.col.toString(16).padStart(6,'0'), letterSpacing:2 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt); this.scene.addChild(rc);

        // Real-world deal strip under the roof sign (operator → offtaker)
        const src = bld._powerSrc;
        if (src && (src.operator || src.offtaker)) {
            const dealTxt = [src.operator, src.offtaker].filter(Boolean).join('  →  ');
            const dt = new PIXI.Text(dealTxt, { fontFamily:'JetBrains Mono', fontSize:7, fill:0x94a3b8, letterSpacing:1 });
            dt.anchor.set(0.5,0); dt.x = bX+bW/2; dt.y = bY+bH+3;
            if (dt.width > bW + 60) dt.scale.set((bW + 60)/dt.width);
            if (typeof UI !== 'undefined') UI.tip(dt, 'The Deal', src.milestone || 'Real 2026 AI-energy deal');
            this.scene.addChild(dt);
        }

        // Floors — with punched-out window cutouts above ground
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
            // Side walls (columns)
            rg.beginFill(0x1a2030); rg.drawRect(startX-6, fy, 6, floorH); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wc = isB ? 0x10161e : 0x151c28;
            if (isB) {
                // Basement: solid wall (underground)
                rg.beginFill(wc); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            } else {
                // Above-ground: punched window cutout — DOM sky shows through
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                InteriorCity._drawWallWithWindowCutout(
                    rg, wc,
                    startX, fy, bldW, floorH,
                    winX, winY, winW, winH_px,
                    mullionPitch, mullionW
                );
                // Window frame lines
                rg.lineStyle(1.5, 0x2a3448, 0.9);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.moveTo(winX, winY + winH_px * 0.5);
                rg.lineTo(winX + winW, winY + winH_px * 0.5);
                rg.lineStyle(0);
                // Industrial glazing tint
                rg.beginFill(layout.col, 0.04);
                rg.drawRect(winX, winY, winW, winH_px);
                rg.endFill();
            }
            rg.beginFill(0x0f1520); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x222a38); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            this.scene.addChild(rg);
            // Floor props FIRST, label LAST — so text always reads over the equipment
            const fc = new PIXI.Container(); this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, bldW, pY, fy, floorH, floorName, layout.col, bld.id);
            // Floor label (with a dark backing chip so it stays legible over props)
            const fl = new PIXI.Text(floorName.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:7, fill:layout.col, letterSpacing:2 });
            fl.anchor.set(0.5,0); fl.x = startX+bldW/2; fl.y = fy+6;
            const flBg = new PIXI.Graphics();
            flBg.beginFill(0x0a0f18, 0.75);
            flBg.drawRoundedRect(fl.x - fl.width/2 - 5, fl.y - 2, fl.width + 10, fl.height + 4, 3);
            flBg.endFill();
            this.scene.addChild(flBg, fl);
        }

        // Earth + data cables
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX-6, floorH); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX-6, 6); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY-2, startX-6, 6); earth.drawRect(startX+bldW+6, groundY-2, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY-4, startX-6, 4); earth.drawRect(startX+bldW+6, groundY-4, G.vpW-startX-bldW-6, 4); earth.endFill();
        this.scene.addChild(earth);
        const vmY = roofH + (numFloors+1) * floorH;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, vmY-4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, vmY+6, G.vpW, 3000); vm.endFill();
        const cc = [0xef4444,0x22d3ee,0x4ade80,0xfbbf24,0xa855f7];
        for (let cy = vmY+20; cy < vmY+120; cy += 6) { vm.beginFill(cc[Math.floor(Math.random()*cc.length)], 0.15+Math.random()*0.25); vm.drawRect(0, cy+Math.random()*3, G.vpW, 1+Math.random()*2); vm.endFill(); }
        for (let px = 80; px < G.vpW; px += 150) { vm.beginFill(0x111115); vm.drawRect(px, vmY+6, 20, 100); vm.endFill(); }
        this.scene.addChild(vm);

        // Position + scroll
        const bp = 56; this.scene.y = G.vpH-bp-this.totalH+floorH;
        this.minY = this.scene.y - floorH*3; this.maxY = this.scene.y + floorH*3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorPower.isDragging || !InteriorPower.scene || InteriorPower.scene.destroyed) return; let ny=InteriorPower._startSceneY+(e.clientY-InteriorPower._startY); ny=Math.max(InteriorPower.minY,Math.min(ny,InteriorPower.maxY)); InteriorPower.scene.y=ny; };
        this._onUp = () => { InteriorPower.isDragging=false; if(InteriorPower.layer) InteriorPower.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    _drawFloorProps(c, sx, bw, pY, fy, fh, floorName, col, bldId) {
        const fn = floorName.toLowerCase();
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        UI.tip(g, floorName, 'Power plant floor');
        // Add the equipment graphics FIRST so NPCs spawned by the branches
        // below render on top of consoles/desks instead of behind them.
        c.addChild(g);

        if (fn.includes('control')) {
            // Control room: monitor wall, desks, operator chairs
            for (let mx = sx+40; mx < sx+bw-60; mx += 70) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 50, 30); g.endFill();
                g.beginFill(col, 0.2); g.drawRect(mx+2, fy+16, 46, 26); g.endFill();
                for (let ly = fy+18; ly < fy+40; ly += 6) { g.beginFill(col, 0.15); g.drawRect(mx+4, ly, 42, 2); g.endFill(); }
            }
            for (let dx = sx+60; dx < sx+bw-80; dx += 90) {
                g.beginFill(0x334155); g.drawRect(dx, pY-16, 50, 16); g.endFill();
                g.beginFill(0x475569); g.drawRect(dx, pY-18, 50, 3); g.endFill();
                g.beginFill(0x334155); g.drawRect(dx+15, pY-8, 14, 8); g.endFill();
            }
            this._npc(c, sx+bw/2, pY, 'Operator', col);
        } else if (fn.includes('reactor') || fn.includes('core')) {
            // Reactor vessel
            const rx = sx + bw/2;
            g.beginFill(0x334155); g.drawEllipse(rx, pY-25, 50, 25); g.endFill();
            g.beginFill(0x475569); g.drawEllipse(rx, pY-28, 45, 8); g.endFill();
            g.beginFill(col, 0.15); g.drawEllipse(rx, pY-25, 35, 18); g.endFill();
            g.beginFill(0xfbbf24); g.drawRect(rx-20, pY-12, 40, 3); g.endFill(); // hazard line
            // Pipes
            for (let px = sx+40; px < sx+bw-40; px += 80) {
                g.beginFill(0x94a3b8); g.drawRect(px, fy+10, 6, fh-16); g.endFill();
                g.beginFill(0x475569); g.drawRect(px-1, fy+20, 8, 4); g.drawRect(px-1, fy+50, 8, 4); g.endFill();
            }
        } else if (fn.includes('turbine')) {
            // Turbine generators
            for (let tx = sx+60; tx < sx+bw-60; tx += 100) {
                g.beginFill(0x334155); g.drawEllipse(tx+25, pY-15, 30, 15); g.endFill();
                g.beginFill(0x475569); g.drawEllipse(tx+25, pY-18, 25, 5); g.endFill();
                g.beginFill(col, 0.2); g.drawCircle(tx+25, pY-15, 8); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(tx+50, pY-20, 8, 20); g.endFill(); // shaft
            }
        } else if (fn.includes('boiler')) {
            // Boiler drums
            for (let bx = sx+50; bx < sx+bw-50; bx += 80) {
                g.beginFill(0x78582e); g.drawEllipse(bx+20, pY-20, 25, 20); g.endFill();
                g.beginFill(0xef4444, 0.2); g.drawEllipse(bx+20, pY-20, 18, 14); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(bx+10, fy+10, 4, fh-16); g.drawRect(bx+30, fy+10, 4, fh-16); g.endFill();
            }
            this._npc(c, sx+100, pY, 'Stoker', 0xf59e0b);
        } else if (fn.includes('conveyor')) {
            g.beginFill(0x334155); g.drawRect(sx+30, pY-8, bw-60, 8); g.endFill();
            for (let cx = sx+40; cx < sx+bw-40; cx += 20) { g.beginFill(0x1e293b); g.drawRect(cx, pY-10, 8, 10); g.endFill(); }
            for (let cx = sx+50; cx < sx+bw-50; cx += 30) { g.beginFill(0x444444); g.drawRect(cx, pY-12, 14, 6); g.endFill(); } // coal lumps
        } else if (fn.includes('waste') || fn.includes('ash')) {
            // Storage drums/containers
            for (let dx = sx+40; dx < sx+bw-40; dx += 35) {
                const dc = fn.includes('waste') ? 0xfbbf24 : 0x666666;
                g.beginFill(dc, 0.5); g.drawRect(dx, pY-22, 18, 22); g.endFill();
                g.beginFill(0x000000, 0.2); g.drawRect(dx+2, pY-20, 14, 18); g.endFill();
                if (fn.includes('waste')) { g.beginFill(0xfbbf24); g.drawRect(dx+5, pY-18, 8, 2); g.drawRect(dx+7, pY-16, 4, 6); g.endFill(); } // hazard symbol
            }
        } else if (fn.includes('fusion')) {
            // Polaris FRC machine — horizontal cylinder, magnet coil rings, glowing plasma core
            const mx = sx + bw/2;
            g.beginFill(0x1f2430); g.drawRect(mx - 90, pY - 32, 180, 24); g.endFill();
            g.beginFill(0x374151); g.drawRect(mx - 96, pY - 30, 8, 20); g.drawRect(mx + 88, pY - 30, 8, 20); g.endFill();
            // Divertor cones at both ends
            g.beginFill(0x4b5563);
            g.drawPolygon([mx - 96, pY - 28, mx - 112, pY - 22, mx - 96, pY - 14]);
            g.drawPolygon([mx + 96, pY - 28, mx + 112, pY - 22, mx + 96, pY - 14]);
            g.endFill();
            // Magnet coil rings along the machine
            for (let cx2 = mx - 80; cx2 <= mx + 80; cx2 += 20) {
                g.beginFill(0xc084fc, 0.55); g.drawRect(cx2 - 2, pY - 34, 4, 28); g.endFill();
            }
            // Plasma core glow (brightest at center — where the FRCs collide)
            g.beginFill(0xe879f9, 0.35); g.drawEllipse(mx, pY - 20, 60, 6); g.endFill();
            g.beginFill(0x22d3ee, 0.45); g.drawEllipse(mx, pY - 20, 30, 4); g.endFill();
            g.beginFill(0xffffff, 0.6); g.drawEllipse(mx, pY - 20, 10, 2.5); g.endFill();
        } else if (fn.includes('capacitor')) {
            // Capacitor bank cabinets + overhead busbars
            g.beginFill(0xf59e0b, 0.5); g.drawRect(sx + 30, fy + 10, bw - 60, 3); g.endFill();
            for (let cx3 = sx + 40; cx3 < sx + bw - 60; cx3 += 55) {
                g.beginFill(0x374151); g.drawRect(cx3, pY - 34, 40, 34); g.endFill();
                g.beginFill(0x4b5563); g.drawRect(cx3, pY - 34, 40, 4); g.endFill();
                g.beginFill(0xc084fc, 0.5);
                for (let ly = pY - 26; ly < pY - 6; ly += 6) g.drawRect(cx3 + 4, ly, 32, 2);
                g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(cx3 + 18, fy + 13, 3, fy + 40 - (fy + 13)); g.endFill();
                g.beginFill(0xfbbf24); g.drawCircle(cx3 + 35, pY - 30, 1.6); g.endFill();
            }
        } else if (fn.includes('triso')) {
            // TRISO pebble fuel hoppers (Kairos)
            for (let hx = sx + 50; hx < sx + bw - 70; hx += 90) {
                g.beginFill(0x475569); g.drawRect(hx, fy + 12, 44, 24); g.endFill();
                g.beginFill(0x334155); g.drawPolygon([hx, fy + 36, hx + 44, fy + 36, hx + 28, pY - 12, hx + 16, pY - 12]); g.endFill();
                g.beginFill(0x2dd4bf, 0.7);
                for (let pi = 0; pi < 8; pi++) g.drawCircle(hx + 8 + (pi % 4) * 10, fy + 18 + Math.floor(pi / 4) * 9, 3);
                g.endFill();
                g.beginFill(0x1f2937); g.drawRect(hx + 18, pY - 12, 8, 12); g.endFill();
            }
        } else if (fn.includes('fuel')) {
            // Gas fuel skids — pipe manifolds, valves, bottle rack
            g.beginFill(0xb45309); g.drawRect(sx + 30, pY - 22, bw - 60, 4); g.endFill();
            g.beginFill(0xd97706, 0.6); g.drawRect(sx + 30, pY - 21, bw - 60, 1.5); g.endFill();
            for (let vx = sx + 60; vx < sx + bw - 60; vx += 70) {
                g.beginFill(0x374151); g.drawRect(vx, pY - 28, 14, 14); g.endFill();
                g.beginFill(0xef4444); g.drawCircle(vx + 7, pY - 30, 3); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(vx + 5, pY - 14, 4, 14); g.endFill();
            }
            for (let bx2 = sx + bw - 120; bx2 < sx + bw - 60; bx2 += 12) {
                g.beginFill(0x9ca3af); g.drawRoundedRect(bx2, pY - 26, 8, 26, 3); g.endFill();
                g.beginFill(0xef4444, 0.7); g.drawRect(bx2 + 2, pY - 28, 4, 3); g.endFill();
            }
        } else if (fn.includes('battery')) {
            // Grid battery racks with state-of-charge bars
            for (let bx3 = sx + 40; bx3 < sx + bw - 60; bx3 += 60) {
                g.beginFill(0xe5e7eb, 0.9); g.drawRect(bx3, pY - 32, 44, 32); g.endFill();
                g.beginFill(0xcbd5e1); g.drawRect(bx3, pY - 32, 44, 4); g.endFill();
                const soc = 0.4 + ((bx3 * 7) % 50) / 100;
                g.beginFill(0x1f2937); g.drawRect(bx3 + 5, pY - 24, 34, 6); g.endFill();
                g.beginFill(0x4ade80, 0.9); g.drawRect(bx3 + 6, pY - 23, 32 * soc, 4); g.endFill();
                g.beginFill(0x6b7280, 0.6);
                for (let vy = pY - 14; vy < pY - 4; vy += 4) g.drawRect(bx3 + 5, vy, 34, 1.5);
                g.endFill();
            }
        } else if (fn.includes('exhaust')) {
            // Exhaust ducting + silencer boxes
            g.beginFill(0x6b7280); g.drawRect(sx + 30, fy + 14, bw - 60, 10); g.endFill();
            g.beginFill(0x9ca3af, 0.5); g.drawRect(sx + 30, fy + 15, bw - 60, 3); g.endFill();
            for (let dx2 = sx + 70; dx2 < sx + bw - 70; dx2 += 90) {
                g.beginFill(0x4b5563); g.drawRect(dx2, fy + 24, 34, pY - fy - 28); g.endFill();
                g.beginFill(0x374151, 0.8);
                for (let ly2 = fy + 30; ly2 < pY - 10; ly2 += 7) g.drawRect(dx2 + 4, ly2, 26, 2.5);
                g.endFill();
                g.beginFill(0xfbbf24, 0.6); g.drawRect(dx2, fy + 24, 34, 2); g.endFill();
            }
        } else if (fn.includes('generator') || fn.includes('inverter')) {
            for (let gx = sx+50; gx < sx+bw-50; gx += 60) {
                g.beginFill(0x334155); g.drawRect(gx, pY-30, 40, 30); g.endFill();
                g.beginFill(col, 0.15); g.drawRect(gx+4, pY-26, 32, 10); g.endFill();
                g.beginFill(0x4ade80); g.drawCircle(gx+10, pY-8, 2); g.endFill();
                g.beginFill(0xef4444); g.drawCircle(gx+20, pY-8, 2); g.endFill();
            }
        } else if (fn.includes('monitor') || fn.includes('nacelle')) {
            for (let mx = sx+60; mx < sx+bw-60; mx += 80) {
                g.beginFill(0x0a0a18); g.drawRect(mx, pY-30, 30, 20); g.endFill();
                g.beginFill(col, 0.25); g.drawRect(mx+2, pY-28, 26, 16); g.endFill();
            }
            this._npc(c, sx+bw/2, pY, 'Technician', col);
        } else {
            // Generic: crates and equipment
            for (let ex = sx+40; ex < sx+bw-40; ex += 50) {
                g.beginFill(0x334155); g.drawRect(ex, pY-20, 30, 20); g.endFill();
            }
        }
        // Warning stripes on basement
        if (fn.includes('waste') || fn.includes('ash') || fn.includes('storage')) {
            for (let sx2 = sx; sx2 < sx+bw; sx2 += 16) { g.beginFill(0xfbbf24, 0.15); g.drawRect(sx2, fy+2, 8, 3); g.endFill(); }
        }
    },

    _npc(c, x, y, name, col) {
        const cont = new PIXI.Container(); cont.x=x; cont.y=y; cont.zIndex=5;
        const bw=16, h=32, headH=12;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill();
        const lw = Math.max(2, bw*0.25);
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,4); legL.endFill(); legL.x=-bw*0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,4); legR.endFill(); legR.x=bw*0.15;
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2,0,bw,14,bw*0.1); body.endFill(); body.y=-h+headH;
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,1); head.drawCircle(bw*0.1,headH*0.38,1); head.endFill(); head.y=-h;
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-6;
        cont.addChild(sh,legL,legR,body,head,dot);
        cont.eventMode='static'; cont.cursor='pointer'; cont.hitArea=new PIXI.Rectangle(-bw,-h-12,bw*2,h+16);
        const pzNpcId = 'npc_'+name.toLowerCase().replace(/\s/g,'_');
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel({ id:pzNpcId, name, isNPC:true, role:name+' — Power Grid', lab:'other', desc:'Power Grid facility staff.' }); });
        cont.on('pointerover', (e) => { if(typeof UI!=='undefined') UI.showTooltip(e, name, 'Power Grid Staff'); });
        cont.on('pointerout', () => { if(typeof UI!=='undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({ cont, head, legL, legR, _minX:x-40, _maxX:x+40, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 });
    },

    update() {
        if (!this.scene) return;
        // Paint DOM sky gradient + celestial gfx + twinkle stars (shared helper)
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        this.avatars.forEach((av,ci) => { if(!av.cont||av.cont.destroyed) return; av._walkTimer--; if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;} const nx=av.cont.x+av._walkDir*0.3; if(nx>av._minX&&nx<av._maxX)av.cont.x=nx; if(av.head)av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5; if(av.legL)av.legL.y=Math.sin(G.tick*0.2+ci)*3; if(av.legR)av.legR.y=-Math.sin(G.tick*0.2+ci)*3; });
    }
};
