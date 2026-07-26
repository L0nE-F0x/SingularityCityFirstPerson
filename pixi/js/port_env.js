/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PORT ENVIRONMENT (v2.0.0)
   Renders cargo ships and the supply chain manifest panel.
   Ocean/coastline terrain is handled by environment.js ground rendering.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PortEnv = {
    shipConts: [], _builtShips: false, fishSchools: [], algaeStrands: [], _builtOceanLife: false,

    buildOceanLife(charLayer) {
        if (this._builtOceanLife || typeof PortZone === 'undefined') return;
        const portBlds = BLDS ? BLDS.filter(b => b.id.startsWith('port_')) : [];
        if (!portBlds.length) return;
        this._builtOceanLife = true;
        const pMinX = Math.min(...portBlds.map(b => b.x)) - 60;
        const pMaxX = Math.max(...portBlds.map(b => b.x + b.w)) + 40;
        const gy = G.groundY;

        // Fish schools (animated groups)
        const fishCols = [0x4ade80, 0x22d3ee, 0xfbbf24, 0xff69b4, 0x60a5fa, 0xf59e0b];
        for (let si = 0; si < 6; si++) {
            const school = new PIXI.Container();
            const baseX = pMinX + 60 + Math.random() * (pMaxX - pMinX - 120);
            const baseY = gy + 50 + Math.random() * 130;
            const col = fishCols[si % fishCols.length];
            const dir = Math.random() > 0.5 ? 1 : -1;
            for (let fi = 0; fi < 6 + Math.floor(Math.random() * 6); fi++) {
                const fish = new PIXI.Graphics();
                fish.beginFill(col, 0.5 + Math.random() * 0.3);
                fish.moveTo(0, 0); fish.lineTo(-5 * dir, -2); fish.lineTo(-5 * dir, 2); fish.closePath(); // body
                fish.drawEllipse(0, 0, 3, 1.5);
                fish.endFill();
                fish.x = (Math.random() - 0.5) * 40;
                fish.y = (Math.random() - 0.5) * 20;
                school.addChild(fish);
            }
            school.x = baseX; school.y = baseY;
            charLayer.addChild(school);
            this.fishSchools.push({ cont: school, baseX, baseY, speed: 0.2 + Math.random() * 0.3, dir, minX: pMinX + 20, maxX: pMaxX - 20, phase: Math.random() * Math.PI * 2 });
        }

        // Algae strands (swaying)
        for (let ai = 0; ai < 12; ai++) {
            const ax = pMinX + 30 + Math.random() * (pMaxX - pMinX - 60);
            const strand = new PIXI.Graphics();
            const sh = 15 + Math.random() * 30;
            strand.x = ax; strand.y = gy + 220;
            strand._baseX = ax; strand._h = sh; strand._phase = Math.random() * Math.PI * 2;
            strand._col = Math.random() > 0.5 ? 0x166534 : 0x2d8a4e;
            charLayer.addChild(strand);
            this.algaeStrands.push(strand);
        }
    },

    buildShips(charLayer) {
        if (this._builtShips || typeof PortZone === 'undefined' || !PortZone.ships.length) return;
        this._builtShips = true;

        PortZone.ships.forEach((ship, si) => {
            const sc = new PIXI.Container();
            const hull = new PIXI.Container(); // Flippable hull
            const g = new PIXI.Graphics();
            const sw = 150, sh = 45;
            // Hull
            g.beginFill(0x1e293b);
            g.moveTo(0, 0); g.lineTo(sw - 15, 0); g.lineTo(sw + 5, sh * 0.4); g.lineTo(sw - 5, sh);
            g.lineTo(-10, sh); g.lineTo(-20, sh * 0.6); g.lineTo(-8, 0); g.closePath(); g.endFill();
            g.beginFill(ship.color, 0.5); g.drawRect(-8, sh * 0.5, sw + 8, 3); g.endFill();
            g.beginFill(0xef4444, 0.35); g.drawRect(-12, sh - 6, sw + 12, 2); g.endFill();
            // Deck
            g.beginFill(0x334155); g.drawRect(2, -2, sw - 20, 4); g.endFill();
            if (ship.special === 'euv') {
                // ── THE $380M LIFT — one giant white ASML crate, nothing else on deck ──
                g.beginFill(0xf8fafc); g.drawRect(18, -30, 78, 28); g.endFill();
                g.beginFill(0xe2e8f0); g.drawRect(18, -30, 78, 4); g.endFill();
                g.beginFill(0x1d4ed8, 0.9); g.drawRect(18, -18, 78, 5); g.endFill(); // ASML blue band
                g.beginFill(0x94a3b8); // crate ribs
                for (let rx = 26; rx < 92; rx += 12) g.drawRect(rx, -30, 1.5, 28);
                g.endFill();
                // FRAGILE / this-way-up markings
                g.beginFill(0xef4444); g.drawRect(24, -27, 8, 6); g.endFill();
                g.beginFill(0x1f2937); g.drawPolygon([84, -22, 87, -27, 90, -22]); g.endFill();
                // Climate-control unit humming on top
                g.beginFill(0x475569); g.drawRect(72, -35, 16, 5); g.endFill();
                g.beginFill(0x4ade80); g.drawCircle(86, -32.5, 1.2); g.endFill();
                // Escort railing
                g.beginFill(0xfbbf24, 0.5); g.drawRect(12, -33, 92, 1.5); g.endFill();
            } else {
                // Containers (3 rows × 6 cols) — biased toward the cargo line's color
                const cc = [ship.color, 0xef4444, 0x3b82f6, ship.color, 0x22d3ee, 0xf59e0b, ship.color, 0x4ade80, 0xa855f7];
                for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
                    g.beginFill(cc[(c + r * 3 + si) % cc.length]); g.drawRect(15 + c * 16, -6 - r * 9, 14, 7); g.endFill();
                    g.beginFill(0x000000, 0.12); g.drawRect(15 + c * 16, -6 - r * 9, 14, 1); g.endFill();
                    g.beginFill(0xffffff, 0.08); g.drawRect(15 + c * 16, -1 - r * 9, 14, 1); g.endFill();
                }
            }
            // Bridge (stern)
            g.beginFill(0xf1f5f9); g.drawRect(sw - 40, -36, 28, 32); g.endFill();
            g.beginFill(0x22d3ee, 0.4); for (let wi = 0; wi < 3; wi++) g.drawRect(sw - 38 + wi * 9, -30, 7, 5); g.endFill();
            g.beginFill(0x94a3b8); g.drawRect(sw - 28, -44, 2, 10); g.endFill();
            g.beginFill(0x475569); g.drawRect(sw - 32, -44, 10, 2); g.endFill();
            // Smokestack
            g.beginFill(0x1e293b); g.drawRect(sw - 44, -28, 7, 22); g.endFill();
            g.beginFill(ship.color); g.drawRect(sw - 44, -30, 7, 3); g.endFill();
            hull.addChild(g);
            sc.addChild(hull);
            
            // Wake trail (separate, redrawn per frame)
            const wake = new PIXI.Graphics(); sc.addChild(wake);
            
            // Name + origin flag (doesn't flip)
            const nm = new PIXI.Text((ship.flag ? ship.flag + ' ' : '') + ship.label, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: 0xffffff, fontWeight: 'bold' });
            nm.anchor.set(0.5, 1); nm.x = sw / 2; nm.y = -40; sc.addChild(nm);
            const comm = PortZone.COMMODITIES.find(c => c.id === ship.cargo);
            if (comm) { const cl = new PIXI.Text(comm.emoji + ' ' + comm.name, { fontFamily: 'JetBrains Mono', fontSize: 6, fill: ship.color }); cl.anchor.set(0.5, 0); cl.x = sw / 2; cl.y = sh + 4; sc.addChild(cl); }

            sc.y = G.groundY - 26; sc.x = ship.x;
            sc.eventMode = 'static'; sc.cursor = 'pointer';
            sc.hitArea = new PIXI.Rectangle(-30, -48, sw + 60, sh + 56);
            sc.on('pointertap', () => {
                if (typeof UI !== 'undefined' && ship.story) UI.addToast(`${ship.flag || '🚢'} ${ship.label}: ${ship.story}`);
                if (typeof PortEnv !== 'undefined') PortEnv.showManifest();
            });
            sc.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, `${ship.flag || ''} ${ship.label} — ex ${ship.origin || 'high seas'}`, ship.story || ('Carrying: ' + (comm ? comm.name : ship.cargo))); });
            sc.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
            charLayer.addChild(sc);
            this.shipConts.push({ cont: sc, hull, wake, sw, sh });
        });
    },

    update() {
        if (typeof PortZone === 'undefined') return;
        // Ship positions + bob + wake
        if (this.shipConts.length) {
            PortZone.update();
            PortZone.ships.forEach((ship, si) => {
                const s = this.shipConts[si];
                if (!s || !s.cont || s.cont.destroyed) return;
                s.cont.x = ship.x;
                s.cont.y = G.groundY - 26 + Math.sin(G.tick * 0.04 + ship.bobPhase) * 3;
                // Direction-aware wake trail
                s.wake.clear();
                if (ship.state === 'sailing_in' || ship.state === 'sailing_out') {
                    const moving = ship.state === 'sailing_in';
                    const wx = moving ? -12 : s.sw + 12; // wake behind the ship
                    const wdir = moving ? -1 : 1;
                    s.wake.beginFill(0xffffff, 0.06);
                    s.wake.moveTo(wx, s.sh - 2); s.wake.lineTo(wx + wdir * 30, s.sh + 6); s.wake.lineTo(wx + wdir * 25, s.sh - 4); s.wake.closePath();
                    s.wake.moveTo(wx + wdir * 5, s.sh + 2); s.wake.lineTo(wx + wdir * 45, s.sh + 10); s.wake.lineTo(wx + wdir * 40, s.sh); s.wake.closePath();
                    s.wake.endFill();
                }
            });
            // Crane animation — trolley tracks toward docked ship
            this._animateCrane();
        }
        // Animated fish schools
        this.fishSchools.forEach(fs => {
            if (!fs.cont || fs.cont.destroyed) return;
            fs.cont.x += fs.dir * fs.speed;
            fs.cont.y = fs.baseY + Math.sin(G.tick * 0.03 + fs.phase) * 8;
            if (fs.cont.x > fs.maxX) { fs.dir = -1; fs.cont.scale.x = -1; }
            if (fs.cont.x < fs.minX) { fs.dir = 1; fs.cont.scale.x = 1; }
        });
        // Swaying algae
        this.algaeStrands.forEach(a => {
            if (!a || a.destroyed) return;
            a.clear();
            const sway = Math.sin(G.tick * 0.025 + a._phase) * 6;
            a.beginFill(a._col, 0.4);
            a.moveTo(0, 0); a.lineTo(sway * 0.3, -a._h * 0.4); a.lineTo(sway, -a._h); a.lineTo(sway + 3, -a._h); a.lineTo(sway * 0.3 + 2, -a._h * 0.4); a.lineTo(2, 0);
            a.closePath(); a.endFill();
            a.beginFill(a._col, 0.3); a.drawEllipse(sway + 1, -a._h - 2, 4, 3); a.endFill();
        });
    },

    _animateCrane() {
        // Find the cargo crane building and animate its trolley toward the nearest docked ship
        const craneBld = BLDS ? BLDS.find(b => b.id === 'port_crane') : null;
        if (!craneBld || !craneBld._container || craneBld._container.destroyed) return;
        const docked = PortZone.ships.find(s => s.state === 'docked');
        if (!craneBld._craneGfx || craneBld._craneGfx.destroyed) {
            craneBld._craneGfx = new PIXI.Graphics();
            craneBld._container.addChild(craneBld._craneGfx);
            craneBld._trolleyX = craneBld.w / 2;
        }
        const cg = craneBld._craneGfx;
        if (!cg || cg.destroyed) return;
        cg.clear();
        const floors = craneBld.dynamicFl || craneBld.fl || 1;
        const h = 28 + floors * 18;
        // Trolley target: track docked ship X relative to crane building
        let targetX = craneBld.w / 2;
        let cableLen = 40;
        if (docked) {
            targetX = docked.x - craneBld.x + 40;
            targetX = Math.max(10, Math.min(craneBld.w - 10, targetX));
            cableLen = 55; // Lower cable when loading
        }
        craneBld._trolleyX += (targetX - craneBld._trolleyX) * 0.02;
        const tx = craneBld._trolleyX;
        // Trolley
        cg.beginFill(0xef4444); cg.drawRect(tx - 6, h - 76, 12, 5); cg.endFill();
        // Cable
        cg.beginFill(0x888888); cg.drawRect(tx - 1, h - 71, 2, cableLen); cg.endFill();
        // Hook/spreader
        cg.beginFill(0xfbbf24); cg.drawRect(tx - 6, h - 71 + cableLen, 12, 3); cg.endFill();
        // Container being lifted (when docked)
        if (docked && Math.sin(G.tick * 0.02) > 0) {
            cg.beginFill([0xef4444, 0x3b82f6, 0x4ade80][Math.floor(G.tick / 200) % 3]);
            cg.drawRect(tx - 8, h - 71 + cableLen + 3, 16, 10); cg.endFill();
        }
    },

    showManifest() {
        const p = document.getElementById('infoPanel');
        if (!p) return;
        const pz = typeof PortZone !== 'undefined' ? PortZone : null;
        if (!pz) return;
        
        let html = '<button class="ipanel-x" onclick="UI.closePanel()">✕</button>';
        html += '<div style="text-align:center;margin-bottom:12px"><span style="font-size:20px">🚢</span><br><span style="color:var(--cy);font-size:11px;letter-spacing:2px">SINGULARITY CITY PORT</span><br><span style="color:var(--t3);font-size:8px">Global AI Supply Chain Manifest</span></div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:8px;font-family:\'JetBrains Mono\',monospace">';
        html += '<tr style="color:var(--t3);border-bottom:1px solid var(--bd)"><th style="text-align:left;padding:4px">Resource</th><th style="text-align:right;padding:4px">Price</th><th style="text-align:right;padding:4px">Change</th><th style="text-align:center;padding:4px">Supply</th></tr>';
        pz.COMMODITIES.forEach(c => {
            const pr = pz.prices[c.id];
            const price = pr ? (pr.price >= 1e6 ? '$' + (pr.price/1e6).toFixed(pr.price >= 1e8 ? 0 : 1) + 'M' : pr.price >= 10000 ? '$' + (pr.price/1000).toFixed(1) + 'K' : '$' + pr.price.toLocaleString()) : '—';
            const chg = pr ? pr.change_pct : 0;
            const arrow = chg > 0 ? '▲' : chg < 0 ? '▼' : '—';
            const chgCol = chg > 10 ? '#ef4444' : chg > 0 ? '#f59e0b' : chg < -5 ? '#4ade80' : '#94a3b8';
            const supCol = pz.supplyColor(c.id); const supLbl = pz.supplyLabel(c.id);
            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
            html += '<td style="padding:4px" title="' + c.desc + '">' + c.emoji + ' ' + c.name + '<br><span style="color:var(--t3);font-size:6px">per ' + c.unit + '</span></td>';
            html += '<td style="text-align:right;padding:4px;color:#fff">' + price + '</td>';
            html += '<td style="text-align:right;padding:4px;color:' + chgCol + '">' + arrow + ' ' + Math.abs(chg).toFixed(1) + '%</td>';
            html += '<td style="text-align:center;padding:4px"><span style="color:' + supCol + ';font-size:7px;font-weight:bold">' + supLbl + '</span></td></tr>';
        });
        html += '</table>';
        html += '<div style="text-align:center;margin-top:10px;color:var(--t3);font-size:7px">Prices are estimated market rates · Updated ' + (pz.prices.gpu_h100?.updated || 'N/A') + '</div>';
        
        p.innerHTML = html;
        p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
    }
};
