/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AGENT DISTRICT ENVIRONMENT (v1.0.0)
   Renders agentic AI animations: data flow particles between buildings, workflow pulses,
   status LEDs, and autonomous bot sprites patrolling the district.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AgentsEnv = {
    _built: false,
    flowParticles: [],     // Data flow particles traveling between buildings
    statusLEDs: [],        // Blinking status LEDs on building facades
    botSprites: [],        // Small autonomous bot sprites walking the district
    pulseBars: [],         // Pulsing workflow bars on the orchestrator

    buildAnimations(charLayer) {
        if (this._built || typeof AgentsZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── DATA FLOW PARTICLES (travel between buildings — agent-to-agent comms) ───
        const orch = BLDS.find(b => b.id === 'agents_orchestrator');
        if (orch) {
            const flowCols = [0xf43f5e, 0x22d3ee, 0x4ade80, 0x8b5cf6, 0xfbbf24, 0xa855f7];
            for (let i = 0; i < 20; i++) {
                const p = new PIXI.Graphics();
                const col = flowCols[i % flowCols.length];
                // Diamond-shaped particles (distinguish from backbone's round dots)
                p.beginFill(col, 0.6 + Math.random() * 0.4);
                p.drawPolygon([-2, 0, 0, -2, 2, 0, 0, 2]);
                p.endFill();
                p.x = AgentsZone.zoneStartX + Math.random() * (AgentsZone.zoneEndX - AgentsZone.zoneStartX);
                p.y = gy - 10 - Math.random() * 60;
                p._speed = (1.0 + Math.random() * 2.0) * (Math.random() > 0.5 ? 1 : -1);
                p._baseY = p.y;
                p._amplitude = 3 + Math.random() * 5;
                p._phase = Math.random() * Math.PI * 2;
                charLayer.addChild(p);
                this.flowParticles.push(p);
            }
        }

        // ─── AUTONOMOUS BOT SPRITES (small bots walking the district with purpose) ───
        const allBlds = AgentsZone.BLDS.map(d => BLDS.find(b => b.id === d.id)).filter(Boolean);
        if (allBlds.length >= 2) {
            const botCols = [0xf43f5e, 0x22d3ee, 0x4ade80, 0x8b5cf6, 0xfbbf24];
            for (let i = 0; i < 6; i++) {
                const bot = new PIXI.Container();
                const col = botCols[i % botCols.length];

                const body = new PIXI.Graphics();
                // Smaller than human NPCs — blocky robot silhouette
                body.beginFill(0x94a3b8);
                body.drawRect(-3, -12, 6, 8);    // torso
                body.endFill();
                body.beginFill(0xc0c0d0);
                body.drawRect(-3, -16, 6, 4);    // head
                body.endFill();
                body.beginFill(col);
                body.drawRect(-2, -14, 2, 2);    // left eye (colored)
                body.drawRect(1, -14, 2, 2);     // right eye (colored)
                body.endFill();
                body.beginFill(0x607080);
                body.drawRect(-2, -4, 2, 4);     // left leg
                body.drawRect(1, -4, 2, 4);      // right leg
                body.endFill();
                // Antenna
                body.beginFill(0x64748b);
                body.drawRect(0, -18, 1, 3);
                body.endFill();
                body.beginFill(col, 0.8);
                body.drawCircle(0, -19, 1.5);
                body.endFill();

                bot.addChild(body);
                bot.x = AgentsZone.zoneStartX + 40 + i * 80;
                bot.y = gy - 2;
                bot._dir = Math.random() > 0.5 ? 1 : -1;
                bot._speed = 0.2 + Math.random() * 0.3;
                // Bounds derived live from AgentsZone.zoneStartX/endX in update()
                bot._wobblePhase = Math.random() * Math.PI * 2;
                bot._col = col;
                bot.scale.x = bot._dir;

                charLayer.addChild(bot);
                this.botSprites.push(bot);
            }
        }

        // ─── STATUS LEDs (on building facades — agent heartbeats) ───
        allBlds.forEach(bld => {
            const floors = bld.fl || 4;
            const h = floors * 18 + 24;
            for (let li = 0; li < 10; li++) {
                const led = new PIXI.Graphics();
                const ledCol = [0xf43f5e, 0x4ade80, 0x22d3ee, 0xfbbf24][Math.floor(Math.random() * 4)];
                led.beginFill(ledCol, 0.8);
                led.drawRect(0, 0, 2, 2);
                led.endFill();
                led._bld = bld;
                led._offX = 8 + Math.random() * (bld.w - 16);
                led.x = bld.x + led._offX;
                led.y = gy - 24 - h + 20 + Math.random() * (h - 40);
                led._phase = Math.random() * 200;
                led._rate = 20 + Math.random() * 60;
                charLayer.addChild(led);
                this.statusLEDs.push(led);
            }
        });

        // ─── PULSE BARS (workflow progress indicators on orchestrator roof) ───
        if (orch) {
            const orchH = orch.fl * 18 + 24;
            for (let i = 0; i < 4; i++) {
                const bar = new PIXI.Graphics();
                const col = [0xf43f5e, 0x22d3ee, 0x4ade80, 0x8b5cf6][i];
                bar.beginFill(col, 0.5);
                bar.drawRect(0, 0, 30, 2);
                bar.endFill();
                bar._bld = orch;
                bar._offX = 20 + i * 45;
                bar.x = orch.x + bar._offX;
                bar.y = gy - orchH - 6;
                bar._phase = i * 1.2;
                bar._col = col;
                charLayer.addChild(bar);
                this.pulseBars.push(bar);
            }
        }
    },

    update() {
        if (!this._built) return;
        const fc = G.tick;

        // ─── Flow particles: travel between buildings with sine wave path ───
        this.flowParticles.forEach(p => {
            if (!p || p.destroyed) return;
            p.x += p._speed;
            p.y = p._baseY + Math.sin(fc * 0.03 + p._phase) * p._amplitude;
            const margin = 300;
            if (p._speed > 0 && p.x > AgentsZone.zoneEndX + margin) {
                p.x = AgentsZone.zoneStartX - margin * 0.3;
            } else if (p._speed < 0 && p.x < AgentsZone.zoneStartX - margin) {
                p.x = AgentsZone.zoneEndX + margin * 0.3;
            }
            // Pulse alpha
            p.alpha = 0.4 + Math.sin(fc * 0.05 + p._phase) * 0.3;
        });

        // ─── Bot sprites: walk back and forth with wobble (bounds live-track zone) ───
        const botMinX = AgentsZone.zoneStartX + 10;
        const botMaxX = AgentsZone.zoneEndX - 10;
        this.botSprites.forEach(bot => {
            if (!bot || bot.destroyed) return;
            bot.x += bot._speed * bot._dir;
            bot._wobblePhase += 0.1;
            bot.y = G.groundY - 2 + Math.sin(bot._wobblePhase) * 1;

            if (bot.x > botMaxX) { bot.x = botMaxX; bot._dir = -1; bot.scale.x = -1; }
            if (bot.x < botMinX) { bot.x = botMinX; bot._dir = 1; bot.scale.x = 1; }
        });

        // ─── Status LEDs: stochastic blinking (re-anchor x to live building) ───
        this.statusLEDs.forEach(led => {
            if (!led || led.destroyed) return;
            if (led._bld) led.x = led._bld.x + led._offX;
            led.visible = ((fc + led._phase) % led._rate) < led._rate * 0.6;
        });

        // ─── Pulse bars: width oscillation (re-anchor x to live building) ───
        this.pulseBars.forEach(bar => {
            if (!bar || bar.destroyed) return;
            if (bar._bld) bar.x = bar._bld.x + bar._offX;
            bar.scale.x = 0.5 + Math.abs(Math.sin(fc * 0.02 + bar._phase)) * 0.8;
            bar.alpha = 0.3 + Math.abs(Math.sin(fc * 0.015 + bar._phase)) * 0.5;
        });
    }
};
