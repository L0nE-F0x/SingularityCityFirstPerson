/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE ENVIRONMENT (v1.0.0 — Desert Biome & Launch Pad Renderer)
   Handles the visual rendering of the space zone on the exterior map.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceEnvironment = {
    
    // Called by Environment.buildGround() to render the desert terrain
    buildDesertTerrain(g, gy, spaceStartX, spaceEndX) {
        if (spaceStartX >= spaceEndX) return;
        
        // ─── Desert sand base replacing sidewalk ───
        g.beginFill(0xc2956a);
        g.drawRect(spaceStartX, gy - 24, spaceEndX - spaceStartX, 24);
        g.endFill();
        g.beginFill(0xd4a574);
        g.drawRect(spaceStartX, gy - 24, spaceEndX - spaceStartX, 12);
        g.endFill();
        g.beginFill(0xe0b88a);
        g.drawRect(spaceStartX, gy - 24, spaceEndX - spaceStartX, 2);
        g.endFill();
        
        // Sand texture dots
        let sandSeed = 77;
        const sr = () => { sandSeed = (sandSeed * 16807) % 2147483647; return (sandSeed - 1) / 2147483646; };
        for (let i = 0; i < 300; i++) {
            const sx = spaceStartX + sr() * (spaceEndX - spaceStartX);
            const sy = gy - 22 + sr() * 18;
            g.beginFill(sr() > 0.5 ? 0xb8895e : 0xdabc8e, 0.3);
            g.drawRect(sx, sy, 1 + sr() * 2, 1);
            g.endFill();
        }
        
        // ─── Desert road (darker compacted sand/concrete) ───
        g.beginFill(0x8b7355);
        g.drawRect(spaceStartX, gy, spaceEndX - spaceStartX, 32);
        g.endFill();
        g.beginFill(0x9a8265);
        g.drawRect(spaceStartX, gy, spaceEndX - spaceStartX, 16);
        g.endFill();
        // Road markings
        for (let x = spaceStartX; x < spaceEndX; x += 40) {
            g.beginFill(0xd4a574, 0.4);
            g.drawRect(x, gy + 14, 20, 3);
            g.endFill();
        }
        
        // ─── Underground: deep desert geology replacing city infrastructure ───
        const w = spaceEndX - spaceStartX;
        
        // Upper sandstone layer (where city cables would be)
        g.beginFill(0x6b4423);
        g.drawRect(spaceStartX, gy + 32, w, 38);
        g.endFill();
        g.beginFill(0x8b6533);
        g.drawRect(spaceStartX, gy + 40, w, 8);
        g.endFill();
        g.beginFill(0x5c3a1e);
        g.drawRect(spaceStartX, gy + 55, w, 15);
        g.endFill();
        
        // Deep sedimentary rock (where metro tunnel would be)
        g.beginFill(0x4a2e14);
        g.drawRect(spaceStartX, gy + 70, w, 100);
        g.endFill();
        g.beginFill(0x3d2510);
        g.drawRect(spaceStartX, gy + 90, w, 40);
        g.endFill();
        // Darker bedrock band
        g.beginFill(0x2d1a0c);
        g.drawRect(spaceStartX, gy + 130, w, 40);
        g.endFill();
        
        // Deep bedrock (where water/sewer pipes would be)
        g.beginFill(0x231508);
        g.drawRect(spaceStartX, gy + 170, w, 200);
        g.endFill();
        g.beginFill(0x1a0f05);
        g.drawRect(spaceStartX, gy + 200, w, 200);
        g.endFill();
        
        // Absolute bottom fill — covers everything to well past screen bottom
        g.beginFill(0x110a03);
        g.drawRect(spaceStartX, gy + 300, w, 2000);
        g.endFill();
        
        // Ore/mineral deposits scattered through the strata
        for (let i = 0; i < 80; i++) {
            const ox = spaceStartX + sr() * w;
            const oy = gy + 35 + sr() * 250;
            const col = sr() > 0.7 ? 0xfbbf24 : sr() > 0.4 ? 0xa16207 : 0x78350f;
            g.beginFill(col, 0.4);
            g.drawRect(ox, oy, 2 + sr() * 3, 1 + sr() * 2);
            g.endFill();
        }
        // Fossil fragments in deeper layers
        for (let i = 0; i < 30; i++) {
            const fx = spaceStartX + sr() * w;
            const fy = gy + 100 + sr() * 150;
            g.beginFill(0xd6d3d1, 0.15);
            g.drawRect(fx, fy, 1 + sr() * 4, 1);
            g.endFill();
        }
    },
    
    // Called by Environment.buildGround() to render desert scenery (cacti, rocks, tumbleweeds)
    buildDesertScenery(g, gy, spaceStartX, spaceEndX) {
        if (spaceStartX >= spaceEndX) return;
        
        let seed = 99;
        const sr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
        
        // Check if a position overlaps with any building
        const blocked = [];
        if (window.BLDS) {
            window.BLDS.forEach(b => {
                if (b.x >= spaceStartX && b.x <= spaceEndX) {
                    blocked.push({ l: b.x, r: b.x + b.w });
                }
            });
        }
        const isClear = (x) => !blocked.some(z => x > z.l - 10 && x < z.r + 10);
        
        for (let tx = spaceStartX + 120; tx < spaceEndX - 30; tx += 50 + sr() * 40) {
            seed = tx * 11 + 7;
            if (!isClear(tx)) continue;
            
            const r = sr();
            
            if (r < 0.3) {
                // ─── Saguaro Cactus ───
                const ch = 30 + sr() * 40;
                g.beginFill(0x2d6a4f);
                g.drawRect(tx - 3, gy - 24 - ch, 6, ch);
                g.endFill();
                // Arms
                if (sr() > 0.4) {
                    const armY = gy - 24 - ch * 0.6;
                    g.beginFill(0x2d6a4f);
                    g.drawRect(tx + 3, armY, 10, 4);
                    g.drawRect(tx + 10, armY - 12, 4, 16);
                    g.endFill();
                }
                if (sr() > 0.5) {
                    const armY = gy - 24 - ch * 0.4;
                    g.beginFill(0x2d6a4f);
                    g.drawRect(tx - 13, armY, 10, 4);
                    g.drawRect(tx - 13, armY - 10, 4, 14);
                    g.endFill();
                }
                // Highlight
                g.beginFill(0x3d8a5f, 0.3);
                g.drawRect(tx - 1, gy - 24 - ch, 2, ch);
                g.endFill();
                
            } else if (r < 0.55) {
                // ─── Desert Boulder ───
                const bw = 8 + sr() * 12;
                const bh = 5 + sr() * 8;
                g.beginFill(0x78716c);
                g.drawEllipse(tx, gy - 22 - bh/2, bw, bh);
                g.endFill();
                g.beginFill(0x8b8478, 0.5);
                g.drawEllipse(tx - 2, gy - 24 - bh/2, bw * 0.7, bh * 0.7);
                g.endFill();
                // Shadow
                g.beginFill(0x000000, 0.1);
                g.drawEllipse(tx + 2, gy - 20, bw * 0.8, 3);
                g.endFill();
                
            } else if (r < 0.7) {
                // ─── Small Shrub ───
                g.beginFill(0x6b7c3f);
                g.drawEllipse(tx, gy - 26, 6 + sr() * 4, 4 + sr() * 3);
                g.endFill();
                g.beginFill(0x8b9c4f, 0.5);
                g.drawEllipse(tx - 2, gy - 28, 4, 3);
                g.endFill();
                
            } else if (r < 0.8) {
                // ─── Tumbleweed (static) ───
                g.lineStyle(1, 0x8b7355, 0.4);
                const tw = 5 + sr() * 6;
                for (let a = 0; a < Math.PI * 2; a += 0.5) {
                    g.moveTo(tx, gy - 24);
                    g.lineTo(tx + Math.cos(a) * tw, gy - 24 + Math.sin(a) * tw * 0.6);
                }
                g.lineStyle(0);
                
            } else {
                // ─── Cracked earth patch ───
                g.lineStyle(1, 0xa89070, 0.2);
                const cx = tx, cy = gy - 20;
                g.moveTo(cx - 8, cy); g.lineTo(cx, cy - 4); g.lineTo(cx + 6, cy + 2);
                g.moveTo(cx, cy - 4); g.lineTo(cx + 2, cy + 6);
                g.moveTo(cx - 3, cy + 1); g.lineTo(cx - 7, cy + 5);
                g.lineStyle(0);
            }
        }
    },
    
    // Render space-specific buildings (launch pads, assembly, tracking)
    buildSpaceBuildings(bldLayer, b, gy) {
        const org = b.org ? SPACE_ORGS[b.org] : null;
        const colHex = org ? parseInt(org.color.slice(1), 16) : 0x64748b;
        const h = (b.dynamicFl || b.fl || 1) * 18 + 24;
        const container = new PIXI.Container();
        container.x = b.x;
        container.y = gy - 24 - h;
        const gfx = new PIXI.Graphics();
        
        
        if (b.type === 'launchpad') {
            // ─── LAUNCH PAD ───
            // Concrete pad
            gfx.beginFill(0x94a3b8);
            gfx.drawRect(20, h - 8, b.w - 40, 8);
            gfx.endFill();
            gfx.beginFill(0x64748b);
            gfx.drawRect(30, h - 6, b.w - 60, 4);
            gfx.endFill();
            
            // Launch tower (gantry) — sized to the org's flagship vehicle
            const towerX = b.w / 2 - 8;
            const vehH = (typeof SpaceRockets !== 'undefined') ? SpaceRockets.height(b.org) : 58;
            const towerTop = h - 8 - vehH - 8;
            gfx.beginFill(0x475569);
            gfx.drawRect(towerX, towerTop, 6, h - 8 - towerTop);
            gfx.drawRect(towerX + 10, towerTop, 6, h - 8 - towerTop);
            gfx.endFill();
            // Cross beams
            gfx.beginFill(0x64748b);
            for (let y = towerTop + 5; y < h - 10; y += 12) {
                gfx.drawRect(towerX, y, 16, 2);
            }
            gfx.endFill();
            const rocketX = towerX + 28;
            if (b.org === 'spacex') {
                // Mechazilla "chopstick" catch arms instead of a swing arm
                gfx.beginFill(0x1f2937);
                gfx.drawRect(towerX + 16, towerTop + 14, 18, 4);
                gfx.drawRect(towerX + 16, towerTop + 22, 18, 4);
                gfx.endFill();
                gfx.beginFill(0x374151);
                gfx.drawRect(towerX + 14, towerTop + 12, 4, 16);
                gfx.endFill();
            } else {
                // Crew/payload swing arm
                gfx.beginFill(0xef4444);
                gfx.drawRect(towerX + 16, towerTop + 20, 20, 3);
                gfx.endFill();
            }

            // Flagship vehicle on pad (static default state) — shared silhouette lib
            if (typeof SpaceRockets !== 'undefined' && b.org) {
                const rkt = new PIXI.Graphics();
                SpaceRockets.draw(rkt, b.org, 1);
                rkt.x = rocketX; rkt.y = h - 8;
                container.addChild(rkt);
            } else {
                gfx.beginFill(0xf1f5f9);
                gfx.drawRect(rocketX - 4, h - 55, 8, 45);
                gfx.endFill();
                gfx.beginFill(org ? colHex : 0xef4444);
                gfx.drawPolygon([rocketX - 4, h - 55, rocketX, h - 65, rocketX + 4, h - 55]);
                gfx.endFill();
            }

            // Flame pit
            gfx.beginFill(0x1e293b);
            gfx.drawRect(rocketX - 12, h - 3, 24, 6);
            gfx.endFill();

            // Org sign — org name + flagship vehicle
            const vehName = (typeof SpaceRockets !== 'undefined' && b.org) ? SpaceRockets.vehicleName(b.org) : null;
            const signLabel = org ? (vehName ? `${org.name} · ${vehName}` : org.name) : b.name;
            const sign = new PIXI.Text(signLabel, { fontFamily: 'Silkscreen', fontSize: 7, fill: colHex, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            if (sign.width > b.w - 4) sign.scale.set((b.w - 4) / sign.width);
            container.addChild(sign);
            b._sign = sign;
            
            // Safety lights
            gfx.beginFill(0xef4444);
            gfx.drawCircle(25, h - 4, 2);
            gfx.drawCircle(b.w - 25, h - 4, 2);
            gfx.endFill();
            
        } else if (b.type === 'mission_control') {
            // ─── MISSION CONTROL ───
            gfx.beginFill(0x1e293b);
            gfx.drawRect(0, 0, b.w, h);
            gfx.endFill();
            gfx.beginFill(0x334155);
            gfx.drawRect(0, 0, b.w, 16);
            gfx.endFill();
            // Satellite dish on roof
            gfx.beginFill(0xf1f5f9);
            gfx.drawPolygon([b.w/2 - 18, -5, b.w/2, -22, b.w/2 + 18, -5]);
            gfx.endFill();
            gfx.beginFill(0x94a3b8);
            gfx.drawRect(b.w/2 - 2, -5, 4, 10);
            gfx.endFill();
            // Windows with screen glow
            for (let wx = 15; wx < b.w - 15; wx += 28) {
                gfx.beginFill(0x0ea5e9, 0.6);
                gfx.drawRect(wx, 20, 20, 14);
                gfx.endFill();
                gfx.beginFill(0x22d3ee, 0.3);
                gfx.drawRect(wx, 40, 20, 14);
                gfx.endFill();
            }
            // Door
            gfx.beginFill(0x475569);
            gfx.drawRect(b.w/2 - 10, h - 20, 20, 20);
            gfx.endFill();
            
            const sign = new PIXI.Text('MISSION CONTROL', { fontFamily: 'Silkscreen', fontSize: 7, fill: 0x0ea5e9, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            container.addChild(sign);
            b._sign = sign;
            
        } else if (b.type === 'assembly') {
            // ─── VEHICLE ASSEMBLY BUILDING ───
            gfx.beginFill(0x94a3b8);
            gfx.drawRect(0, 0, b.w, h);
            gfx.endFill();
            gfx.beginFill(0xcbd5e1);
            gfx.drawRect(0, 0, b.w, 8);
            gfx.endFill();
            // American flag stripe (homage to NASA VAB)
            gfx.beginFill(0x1e40af);
            gfx.drawRect(b.w/2 - 30, 12, 60, 40);
            gfx.endFill();
            gfx.beginFill(0xef4444);
            for (let sy = 20; sy < 50; sy += 8) {
                gfx.drawRect(b.w/2 - 28, sy, 56, 4);
            }
            gfx.endFill();
            gfx.beginFill(0xffffff);
            gfx.drawRect(b.w/2 - 28, 14, 20, 16);
            gfx.endFill();
            // Massive door
            gfx.beginFill(0x475569);
            gfx.drawRect(b.w/2 - 25, h - 50, 50, 50);
            gfx.endFill();
            gfx.beginFill(0x334155);
            gfx.drawRect(b.w/2 - 1, h - 50, 2, 50);
            gfx.endFill();
            
            const sign = new PIXI.Text('VEHICLE ASSEMBLY', { fontFamily: 'Silkscreen', fontSize: 7, fill: 0x94a3b8, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            container.addChild(sign);
            b._sign = sign;
            
        } else if (b.type === 'tracking') {
            // ─── ORBITAL TRACKING STATION ───
            gfx.beginFill(0x1e293b);
            gfx.drawRect(0, 14, b.w, h - 14);
            gfx.endFill();
            // Flanking static dishes (the centre one is a separate rotating dish below)
            [-30, 30].forEach(offset => {
                const dx = b.w/2 + offset;
                gfx.beginFill(0xf1f5f9);
                gfx.drawPolygon([dx - 12, 14, dx, -2, dx + 12, 14]);
                gfx.endFill();
                gfx.beginFill(0x94a3b8);
                gfx.drawRect(dx - 1, 2, 2, 14);
                gfx.endFill();
                // Signal arcs
                gfx.lineStyle(1, 0x22d3ee, 0.3);
                gfx.drawCircle(dx, -4, 6);
                gfx.drawCircle(dx, -4, 10);
                gfx.lineStyle(0);
            });
            // ── Centre SCAN DISH — fixed mast (in the cached gfx) with only the
            //    dish BOWL pivoting on top, so SpaceEntities.update can sweep it
            //    across the sky like it's tracking a satellite. ──
            gfx.beginFill(0x64748b); gfx.drawRect(b.w / 2 - 1.5, 0, 3, 14); gfx.endFill(); // fixed mast
            gfx.beginFill(0x475569); gfx.drawCircle(b.w / 2, 0, 2.5); gfx.endFill();        // yoke hub
            const scanDish = new PIXI.Container();
            const dg = new PIXI.Graphics();
            dg.beginFill(0xf1f5f9); dg.drawPolygon([-14, 0, 0, -16, 14, 0]); dg.endFill(); // dish bowl
            dg.beginFill(0xcbd5e1); dg.drawPolygon([-9, -1, 0, -12, 9, -1]); dg.endFill();  // inner
            dg.beginFill(0x475569); dg.drawRect(-1, -11, 2, 8); dg.endFill();       // feed strut
            dg.beginFill(0xef4444); dg.drawCircle(0, -11, 1.6); dg.endFill();       // feed horn tip
            scanDish.addChild(dg);
            scanDish.x = b.w / 2; scanDish.y = 0; // pivot at the mast top
            b._scanDish = scanDish; // attached on top after the body gfx (see below)
            // Status lights
            gfx.beginFill(0x4ade80);
            gfx.drawCircle(15, h - 8, 3);
            gfx.drawCircle(b.w - 15, h - 8, 3);
            gfx.endFill();
            
            const sign = new PIXI.Text('ORBITAL TRACKING', { fontFamily: 'Silkscreen', fontSize: 7, fill: 0x22d3ee, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            container.addChild(sign);
            b._sign = sign;
        }
        
        container.addChild(gfx);
        // Rotating scan dish sits ON TOP of the cached body gfx.
        if (b._scanDish) container.addChild(b._scanDish);

        // Tooltip + click
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.hitArea = new PIXI.Rectangle(0, 0, b.w, h + 20);
        container.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectBld(b); });
        container.on('pointerover', e => { 
            const tip = org ? `${org.icon} ${org.name} — ${b.name}` : b.name;
            if (typeof UI !== 'undefined') UI.showTooltip(e, tip, b.desc); 
        });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        bldLayer.addChild(container);
        b._container = container;
    }
};
