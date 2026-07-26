/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER ENVIRONMENT (v1.0.0)
   Renders power grid buildings, animations (turbines, steam, solar tracking), HUD, and panel.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PowerEnv = {
    steamParts: [], smokeParts: [], _built: false,
    turbineBlades: [], solarPanels: [], waterFlows: [], fusionGlows: [],

    buildAnimations(charLayer) {
        if (this._built || typeof PowerZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── NUCLEAR STEAM PARTICLES ───
        const nucBld = BLDS.find(b => b.id === 'power_nuclear');
        if (nucBld) {
            for (let i = 0; i < 20; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(0xffffff, 0.15 + Math.random() * 0.15);
                p.drawCircle(0, 0, 3 + Math.random() * 5); p.endFill();
                // Store offset relative to building so particles stay locked even if
                // recalculateZoning moves Power Zone after buildAnimations ran.
                p._bld = nucBld;
                p._offX = nucBld.w / 2 + (Math.random() - 0.5) * 20;
                p.x = nucBld.x + p._offX;
                p.y = gy - 80 - Math.random() * 40;
                p._speed = 0.3 + Math.random() * 0.4; p._phase = Math.random() * Math.PI * 2;
                p._resetY = gy - 60;
                charLayer.addChild(p);
                this.steamParts.push(p);
            }
        }
        // ─── GAS TURBINE EXHAUST (light heat-haze plumes off each genset stack) ───
        const gasBld = BLDS.find(b => b.id === 'power_coal');
        if (gasBld) {
            for (let i = 0; i < 16; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(0x9ca3af, 0.10 + Math.random() * 0.10);
                p.drawCircle(0, 0, 2 + Math.random() * 3); p.endFill();
                p._bld = gasBld;
                // One plume per exhaust stack (stacks sit at x ≈ 26 + n·30)
                p._offX = 26 + (i % 4) * 30 + (Math.random() - 0.5) * 4;
                p.x = gasBld.x + p._offX;
                p.y = gy - 66 - Math.random() * 25;
                p._speed = 0.25 + Math.random() * 0.35; p._phase = Math.random() * Math.PI * 2;
                p._resetY = gy - 66;
                charLayer.addChild(p);
                this.smokeParts.push(p);
            }
        }
        // ─── WIND TURBINE BLADES (PIXI containers for rotation) ───
        const windBld = BLDS.find(b => b.id === 'power_wind');
        if (windBld) {
            for (let ti = 0; ti < 3; ti++) {
                const bladeC = new PIXI.Container();
                bladeC._bld = windBld;
                bladeC._offX = 40 + ti * 45;
                bladeC.x = windBld.x + bladeC._offX;
                bladeC.y = gy - 72;
                // 3 blades
                const bg = new PIXI.Graphics();
                for (let a = 0; a < 3; a++) {
                    const angle = (a * Math.PI * 2) / 3;
                    bg.beginFill(0xf1f5f9, 0.8);
                    bg.moveTo(0, 0);
                    bg.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
                    bg.lineTo(Math.cos(angle + 0.15) * 22, Math.sin(angle + 0.15) * 22);
                    bg.closePath(); bg.endFill();
                }
                bg.beginFill(0x94a3b8); bg.drawCircle(0, 0, 3); bg.endFill();
                bladeC.addChild(bg);
                charLayer.addChild(bladeC);
                this.turbineBlades.push({ cont: bladeC, speed: 0.02 + ti * 0.005 });
            }
        }
    },

    update() {
        if (typeof PowerZone === 'undefined') return;
        PowerZone.update();
        const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
        const windMult = w === 'thunderstorm' ? 3.2 : (w === 'rain' || w === 'drizzle') ? 2.5 : w === 'snow' ? 1.8 : w === 'sandstorm' ? 3.0 : w === 'fog' ? 0.4 : 1.0;

        // Steam particles rise and reset (x tracks live building x — survives re-zoning)
        this.steamParts.forEach(p => {
            if (!p || p.destroyed) return;
            p.y -= p._speed;
            const baseX = (p._bld ? p._bld.x : 0) + p._offX;
            p.x = baseX + Math.sin(G.tick * 0.02 + p._phase) * 8;
            p.alpha = Math.max(0, 0.25 - (p._resetY - p.y) * 0.002);
            if (p.y < p._resetY - 80) { p.y = p._resetY; p.alpha = 0.25; }
        });
        // Smoke particles
        this.smokeParts.forEach(p => {
            if (!p || p.destroyed) return;
            p.y -= p._speed * 0.8;
            const baseX = (p._bld ? p._bld.x : 0) + p._offX;
            p.x = baseX + Math.sin(G.tick * 0.015 + p._phase) * 12;
            p.alpha = Math.max(0, 0.2 - (p._resetY - p.y) * 0.002);
            if (p.y < p._resetY - 60) { p.y = p._resetY; p.alpha = 0.2; }
        });
        // Wind turbine rotation (also re-anchor x in case Power Zone was re-zoned)
        this.turbineBlades.forEach(tb => {
            if (!tb.cont || tb.cont.destroyed) return;
            if (tb.cont._bld) tb.cont.x = tb.cont._bld.x + tb.cont._offX;
            tb.cont.rotation += tb.speed * windMult;
        });
        // Polaris plasma halo — pulses with each fusion shot (matches getOutput cadence)
        if (this.fusionGlows && this.fusionGlows.length) {
            const pulse = Math.max(0, Math.sin(G.tick * 0.01));
            const a = 0.15 + pulse * pulse * 0.85;
            for (let i = this.fusionGlows.length - 1; i >= 0; i--) {
                const fg = this.fusionGlows[i];
                if (!fg || fg.destroyed) { this.fusionGlows.splice(i, 1); continue; }
                fg.alpha = a;
                fg.scale.set(0.8 + pulse * 0.5);
            }
        }
    },

    // ─── POWER GRID PANEL (v3.0 — live global data from OSM Overpass + city sim fallback) ───
    showGridPanel() {
        const p = document.getElementById('infoPanel');
        if (!p || typeof PowerZone === 'undefined') return;
        const pz = PowerZone;
        const live = typeof API !== 'undefined' ? API._gridData : null;

        let html = '<button class="ipanel-x" onclick="UI.closePanel()">✕</button>';
        html += '<div style="text-align:center;margin-bottom:12px"><span style="font-size:20px">⚡</span><br><span style="color:var(--cy);font-size:11px;letter-spacing:2px">POWER GRID STATUS</span></div>';

        // ─── REAL-WORLD GLOBAL GRID (from Overpass) ───
        if (live && live.sources.length > 0) {
            const ageH = Math.round((Date.now() - API._gridTs) / 3600000);
            const twGW = (live.totalMW / 1000).toFixed(1);
            const renewTypes = new Set(['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Tidal']);

            html += '<div style="background:linear-gradient(135deg,rgba(34,211,238,0.06),transparent);border:1px solid #22d3ee33;border-radius:8px;padding:10px;margin-bottom:10px">';
            // Header
            html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
            html += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:7px;background:#22d3ee;color:#000;padding:2px 6px;border-radius:10px;font-weight:bold">REAL-WORLD</span><span style="font-size:10px;color:#fff;font-weight:bold">Global Power Grid</span></div>';
            html += '<div style="font-size:7px;color:var(--t3)">' + live.regionsScanned + '/' + live.regionsTotal + ' regions · ' + (ageH < 1 ? '<1h ago' : ageH + 'h ago') + '</div></div>';

            // Summary cards
            html += '<div style="display:flex;gap:6px;margin-bottom:8px">';
            html += '<div style="flex:1;background:var(--cd);border:1px solid var(--bd);border-radius:4px;padding:6px;text-align:center">';
            html += '<div style="font-size:7px;color:var(--t3);margin-bottom:2px">PLANTS MAPPED</div>';
            html += '<div style="font-size:14px;font-weight:bold;color:#fff">' + live.plantCount.toLocaleString() + '</div>';
            html += '<div style="font-size:7px;color:var(--t3)">' + live.sources.length + ' source types</div></div>';
            html += '<div style="flex:1;background:var(--cd);border:1px solid var(--bd);border-radius:4px;padding:6px;text-align:center">';
            html += '<div style="font-size:7px;color:var(--t3);margin-bottom:2px">TOTAL CAPACITY</div>';
            html += '<div style="font-size:14px;font-weight:bold;color:#22d3ee">' + twGW + ' GW</div>';
            html += '<div style="font-size:7px;color:var(--t3)">' + Math.round(live.totalMW).toLocaleString() + ' MW</div></div>';
            html += '<div style="flex:1;background:var(--cd);border:1px solid var(--bd);border-radius:4px;padding:6px;text-align:center">';
            html += '<div style="font-size:7px;color:var(--t3);margin-bottom:2px">RENEWABLE</div>';
            html += '<div style="font-size:14px;font-weight:bold;color:#4ade80">' + live.renewPct.toFixed(1) + '%</div>';
            html += '<div style="font-size:7px;color:var(--t3)">fossil: ' + live.fossilPct.toFixed(1) + '%</div></div></div>';

            // Stacked bar chart
            html += '<div style="display:flex;height:18px;border-radius:4px;overflow:hidden;margin-bottom:6px">';
            live.sources.forEach(s => {
                const pct = live.totalMW > 0 ? (s.totalMW / live.totalMW) * 100 : 0;
                if (pct < 0.5) return;
                html += '<div style="width:' + pct + '%;background:' + s.color + ';display:flex;align-items:center;justify-content:center;min-width:12px" title="' + s.type + ' ' + pct.toFixed(1) + '%">';
                html += '<span style="font-size:6px;color:#000;font-weight:bold">' + (pct >= 5 ? Math.round(pct) : '') + '</span></div>';
            });
            html += '</div>';

            // Source table
            html += '<table style="width:100%;border-collapse:collapse;font-size:8px;font-family:\'JetBrains Mono\',monospace">';
            html += '<tr style="color:var(--t3);border-bottom:1px solid var(--bd)"><th style="text-align:left;padding:3px">Source</th><th style="text-align:right;padding:3px">Plants</th><th style="text-align:right;padding:3px">Capacity</th><th style="text-align:left;padding:3px;width:30%">Share</th></tr>';
            live.sources.forEach(s => {
                const pct = live.totalMW > 0 ? (s.totalMW / live.totalMW) * 100 : 0;
                const gwStr = s.totalMW >= 1000 ? (s.totalMW / 1000).toFixed(1) + ' GW' : Math.round(s.totalMW) + ' MW';
                const isRenew = renewTypes.has(s.type);
                html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
                html += '<td style="padding:3px">' + s.emoji + ' ' + s.type + '</td>';
                html += '<td style="text-align:right;padding:3px;color:var(--t3)">' + s.count.toLocaleString() + '</td>';
                html += '<td style="text-align:right;padding:3px;color:' + (isRenew ? '#4ade80' : '#fff') + ';font-weight:bold">' + gwStr + '</td>';
                html += '<td style="padding:3px"><div style="background:rgba(255,255,255,0.06);border-radius:2px;height:6px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:' + s.color + ';border-radius:2px"></div></div></td></tr>';
            });
            html += '</table>';

            // Regional breakdown
            if (live.byRegion.length > 0) {
                html += '<div style="margin-top:8px;font-size:7px;color:var(--t3)">';
                html += '<b style="color:var(--t2)">BY REGION:</b><br>';
                live.byRegion.forEach(r => {
                    const gwStr = r.totalMW >= 1000 ? (r.totalMW / 1000).toFixed(1) + ' GW' : Math.round(r.totalMW) + ' MW';
                    html += r.region + ': ' + r.count.toLocaleString() + ' plants · ' + gwStr + '<br>';
                });
                html += '</div>';
            }

            // Attribution
            html += '<div style="text-align:right;font-size:6px;color:var(--t3);margin-top:4px">Data: <a href="https://www.openstreetmap.org" target="_blank" style="color:#22d3ee;text-decoration:none">OpenStreetMap</a> via Overpass API · <a href="https://openinframap.org" target="_blank" style="color:#22d3ee;text-decoration:none">OpenInfraMap</a></div>';
            html += '</div>';

            // Divider
            html += '<div style="text-align:center;font-size:7px;color:var(--t3);margin:6px 0;border-top:1px dashed var(--bd);padding-top:6px">🎮 SINGULARITY CITY GRID</div>';
        } else {
            // Loading or failed — show retry
            html += '<div style="text-align:center;font-size:7px;color:var(--t3);margin-bottom:8px;padding:6px;background:var(--cd);border:1px solid var(--bd);border-radius:4px">🌍 Global grid data loading from OpenStreetMap… <span style="cursor:pointer;color:var(--cy);text-decoration:underline" onclick="if(typeof API!==\'undefined\')API.fetchGlobalGrid().then(()=>PowerEnv.showGridPanel())">retry</span></div>';
        }

        // ─── IN-GAME CITY SIMULATION ───
        const supply = pz.getTotalSupply();
        const demand = pz.getTotalDemand();
        const balance = supply - demand;
        const balCol = balance >= 0 ? '#4ade80' : '#ef4444';
        const balIcon = balance >= 0 ? '✅' : '⚠️';
        const balLabel = balance >= 0 ? 'SURPLUS' : 'DEFICIT';
        const pct = demand > 0 ? Math.round((supply / demand) * 100) : 100;

        html += '<div style="background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:8px;margin-bottom:10px;text-align:center">';
        html += '<div style="font-size:9px;color:var(--t3);margin-bottom:4px">CITY GRID BALANCE</div>';
        html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px">';
        html += '<span style="font-size:16px;color:' + balCol + '">' + balIcon + '</span>';
        html += '<span style="font-size:14px;color:#fff;font-weight:bold">' + supply.toLocaleString() + ' MW</span>';
        html += '<span style="font-size:9px;color:var(--t3)">/ ' + demand.toLocaleString() + ' MW demand</span>';
        html += '</div>';
        html += '<div style="margin-top:6px;background:rgba(255,255,255,0.05);border-radius:4px;height:8px;overflow:hidden">';
        const barW = Math.min(100, pct);
        html += '<div style="width:' + barW + '%;height:100%;background:' + balCol + ';border-radius:4px"></div></div>';
        html += '<div style="margin-top:4px;font-size:8px;color:' + balCol + ';font-weight:bold">' + balLabel + ' ' + (balance >= 0 ? '+' : '') + balance.toLocaleString() + ' MW (' + pct + '%)</div></div>';

        // Source table
        html += '<table style="width:100%;border-collapse:collapse;font-size:8px;font-family:\'JetBrains Mono\',monospace">';
        html += '<tr style="color:var(--t3);border-bottom:1px solid var(--bd)"><th style="text-align:left;padding:4px">Source</th><th style="text-align:right;padding:4px">Output</th><th style="text-align:right;padding:4px">Capacity</th><th style="text-align:right;padding:4px">$/MWh</th><th style="text-align:center;padding:4px">Type</th></tr>';
        pz.SOURCES.forEach(s => {
            const output = pz.getOutput(s.id);
            const capFactor = Math.round((output / s.mw) * 100);
            const typeCol = s.type === 'renewable' ? '#4ade80' : s.type === 'baseload' ? '#22d3ee' : s.type === 'experimental' ? '#c084fc' : '#f59e0b';
            const outCell = s.status === 'construction'
                ? '<span style="color:#f59e0b">🚧 2030</span>'
                : output.toLocaleString() + ' MW' + (s.id === 'power_fusion' ? ' <span style="color:#c084fc">⚡pulse</span>' : '');
            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
            html += '<td style="padding:4px">' + s.emoji + ' ' + s.name + '</td>';
            html += '<td style="text-align:right;padding:4px;color:#fff">' + outCell + '</td>';
            html += '<td style="text-align:right;padding:4px;color:var(--t3)">' + capFactor + '%</td>';
            html += '<td style="text-align:right;padding:4px;color:#fbbf24">$' + s.costMWh + '</td>';
            html += '<td style="text-align:center;padding:4px"><span style="color:' + typeCol + ';font-size:7px;font-weight:bold">' + s.type.toUpperCase() + '</span></td></tr>';
        });
        html += '</table>';
        let dcDemand = 0;
        if (typeof DC_FACILITIES !== 'undefined') DC_FACILITIES.forEach(dc => { if (dc.power_mw) dcDemand += dc.power_mw; });
        html += '<div style="margin-top:8px;padding:6px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:7px;color:var(--t3)">';
        html += '<b style="color:var(--t2)">DEMAND BREAKDOWN:</b><br>';
        html += '🖥️ Data Centers & Fabs: ' + dcDemand.toLocaleString() + ' MW<br>';
        html += '🏙️ City Infrastructure: 200 MW (metro, lighting, buildings)</div>';

        p.innerHTML = html;
        p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
    }
};
