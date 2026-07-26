/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOTICS FACTORY ENVIRONMENT (v1.0.0 — Welding Sparks, Conveyor Belts, Walking Robots)
   Visual effects and ambient animations for the Robotics Factory Zone.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const RoboticsEnv = {
    _built: false,
    sparks: [],           // Welding spark particles
    conveyorDots: [],     // Moving conveyor belt indicators
    statusLights: [],     // Operation status LEDs
    robots: [],           // Walking robot sprites in the testing ground
    smokePuffs: [],       // Exhaust from deployment dock trucks

    buildAnimations(charLayer) {
        if (this._built || typeof RoboticsZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        const assembly = BLDS.find(b => b.id === 'robotics_assembly');
        const testing = BLDS.find(b => b.id === 'robotics_testing');
        const deploy = BLDS.find(b => b.id === 'robotics_deploy');

        // ─── WELDING SPARKS on Assembly Line ───
        if (assembly) {
            for (let i = 0; i < 20; i++) {
                const p = new PIXI.Graphics();
                const col = [0xfbbf24, 0xfb923c, 0xfef08a, 0xffffff][Math.floor(Math.random() * 4)];
                p.beginFill(col, 0.9);
                p.drawCircle(0, 0, 0.5 + Math.random() * 1.2);
                p.endFill();
                // Anchor to building so respawn origin tracks re-zoning
                p._bld = assembly;
                p._offX = 30 + Math.random() * (assembly.w - 60);
                p.x = assembly.x + p._offX;
                p.y = gy - 30 - Math.random() * 50;
                p._vy = 0.3 + Math.random() * 1.0;
                p._vx = (Math.random() - 0.5) * 1.5;
                p._life = 60 + Math.random() * 80;
                p._maxLife = p._life;
                p._originY = p.y;
                charLayer.addChild(p);
                this.sparks.push(p);
            }
        }

        // ─── CONVEYOR BELT dots between buildings ───
        if (assembly && testing) {
            const beltY = gy - 8;
            for (let i = 0; i < 12; i++) {
                const dot = new PIXI.Graphics();
                dot.beginFill(0x64748b, 0.6);
                dot.drawRect(0, 0, 6, 3);
                dot.endFill();
                dot.x = assembly.x + i * ((testing.x + testing.w - assembly.x) / 12);
                dot.y = beltY;
                dot._speed = 0.4;
                // Store refs — min/max recomputed each frame so belt spans the live buildings
                dot._assBld = assembly;
                dot._testBld = testing;
                charLayer.addChild(dot);
                this.conveyorDots.push(dot);
            }
        }

        // ─── WALKING ROBOT SPRITES in Testing Ground ───
        // One walker per real company — the actual 2026 flagship humanoids,
        // drawn from the shared RobotModels silhouette lib. Hover for identity.
        if (testing) {
            const keys = (typeof RobotModels !== 'undefined' && typeof ROBOTICS_COMPANIES !== 'undefined')
                ? Object.keys(ROBOTICS_COMPANIES).filter(k => RobotModels.ROBOTS[k])
                : [];
            const count = keys.length || 5;
            for (let i = 0; i < count; i++) {
                const r = new PIXI.Container();
                const key = keys[i] || null;
                const co = key ? ROBOTICS_COMPANIES[key] : null;
                const col = co ? parseInt(co.color.slice(1), 16) : 0x8890a0;

                const body = new PIXI.Graphics();
                if (key && typeof RobotModels !== 'undefined') {
                    RobotModels.draw(body, key, 0.72);
                } else {
                    body.beginFill(0xc0c0d0); body.drawRect(-3, -18, 6, 6); body.endFill();
                    body.beginFill(0x8890a0); body.drawRect(-4, -12, 8, 8); body.endFill();
                    body.beginFill(0x607080); body.drawRect(-3, -4, 2, 5); body.drawRect(1, -4, 2, 5); body.endFill();
                }
                r.addChild(body);

                r.x = testing.x + 14 + i * ((testing.w - 28) / count);
                r.y = gy - 2;
                r._dir = Math.random() > 0.5 ? 1 : -1;
                r._speed = 0.12 + Math.random() * 0.25;
                // Track the testing building — min/max derived live in update
                r._bld = testing;
                r._wobblePhase = Math.random() * Math.PI * 2;
                r._col = col;
                r.scale.x = r._dir;

                // Hover identity + tap for the company's latest milestone
                if (co) {
                    const rh = (typeof RobotModels !== 'undefined') ? RobotModels.height(key) * 0.72 : 20;
                    r.eventMode = 'static';
                    r.cursor = 'pointer';
                    r.hitArea = new PIXI.Rectangle(-8, -rh - 4, 16, rh + 8);
                    r.on('pointerover', e => {
                        if (typeof UI !== 'undefined') UI.showTooltip(e, `${co.icon} ${co.robot} — ${co.name}`, co.program || '');
                    });
                    r.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
                    r.on('pointertap', () => {
                        if (typeof UI !== 'undefined') UI.addToast(`${co.icon} ${co.robot}: ${co.milestone}`);
                    });
                }

                charLayer.addChild(r);
                this.robots.push(r);
            }
        }

        // ─── STATUS LIGHTS on all buildings ───
        const allBlds = RoboticsZone.BLDS.map(d => BLDS.find(b => b.id === d.id)).filter(Boolean);
        allBlds.forEach(bld => {
            const bldH = bld.fl * 18 + 24;
            for (let li = 0; li < 8; li++) {
                const light = new PIXI.Graphics();
                const col = [0x4ade80, 0x22d3ee, 0xfbbf24, 0xf43f5e][Math.floor(Math.random() * 4)];
                light.beginFill(col, 0.8);
                light.drawCircle(0, 0, 1.5);
                light.endFill();
                light._bld = bld;
                light._offX = 8 + Math.random() * (bld.w - 16);
                light.x = bld.x + light._offX;
                light.y = gy - bldH + 16 + Math.random() * (bldH - 30);
                light._phase = Math.random() * 200;
                light._rate = 20 + Math.random() * 60;
                charLayer.addChild(light);
                this.statusLights.push(light);
            }
        });

        // ─── SMOKE PUFFS from Deployment Dock ───
        if (deploy) {
            for (let i = 0; i < 6; i++) {
                const puff = new PIXI.Graphics();
                puff.beginFill(0x94a3b8, 0.3);
                puff.drawCircle(0, 0, 2 + Math.random() * 3);
                puff.endFill();
                puff._bld = deploy;
                puff._offX = deploy.w - 20 + Math.random() * 30;
                puff.x = deploy.x + puff._offX;
                puff.y = gy - 5 - Math.random() * 15;
                puff._vy = -0.2 - Math.random() * 0.3;
                puff._vx = 0.1 + Math.random() * 0.2;
                puff._life = 80 + Math.random() * 60;
                puff._maxLife = puff._life;
                puff._originY = puff.y;
                charLayer.addChild(puff);
                this.smokePuffs.push(puff);
            }
        }
    },

    update() {
        if (!this._built) return;
        const fc = G.tick;

        // ─── SPARKS: drift down, fade, respawn (respawn tracks live building) ───
        this.sparks.forEach(p => {
            if (!p || p.destroyed) return;
            p.x += p._vx;
            p.y += p._vy;
            p._life--;
            p.alpha = Math.max(0, (p._life / p._maxLife) * 0.9);
            if (p._life <= 0) {
                // Respawn at live building position
                const originX = (p._bld ? p._bld.x : 0) + p._offX;
                p.x = originX + (Math.random() - 0.5) * 20;
                p.y = p._originY;
                p._life = p._maxLife;
                p._vx = (Math.random() - 0.5) * 1.5;
                p._vy = 0.3 + Math.random() * 1.0;
                p.alpha = 0.9;
            }
        });

        // ─── CONVEYOR BELT: move right, wrap (span tracks live buildings) ───
        this.conveyorDots.forEach(dot => {
            if (!dot || dot.destroyed) return;
            dot.x += dot._speed;
            const minX = dot._assBld ? dot._assBld.x : 0;
            const maxX = dot._testBld ? (dot._testBld.x + dot._testBld.w) : minX + 1;
            if (dot.x > maxX) dot.x = minX;
            // If a re-zone put the dot behind the assembly line, snap it back
            if (dot.x < minX) dot.x = minX;
        });

        // ─── ROBOTS: walk back and forth with wobble (bounds track live building) ───
        this.robots.forEach(r => {
            if (!r || r.destroyed) return;
            r.x += r._speed * r._dir;
            r._wobblePhase += 0.08;
            // Leg wobble effect via slight Y oscillation
            r.y = G.groundY - 2 + Math.sin(r._wobblePhase) * 1.5;

            // Reverse at boundaries (re-derived each frame so bounds survive re-zoning)
            const minX = r._bld ? (r._bld.x + 10) : -Infinity;
            const maxX = r._bld ? (r._bld.x + r._bld.w - 10) : Infinity;
            if (r.x > maxX) { r.x = maxX; r._dir = -1; r.scale.x = -1; }
            if (r.x < minX) { r.x = minX; r._dir = 1; r.scale.x = 1; }
        });

        // ─── STATUS LIGHTS: blink (re-anchor x to live building) ───
        this.statusLights.forEach(light => {
            if (!light || light.destroyed) return;
            if (light._bld) light.x = light._bld.x + light._offX;
            light.visible = ((fc + light._phase) % light._rate) < light._rate * 0.6;
        });

        // ─── SMOKE PUFFS: rise, fade, respawn (respawn tracks live building) ───
        this.smokePuffs.forEach(puff => {
            if (!puff || puff.destroyed) return;
            puff.x += puff._vx;
            puff.y += puff._vy;
            puff._life--;
            puff.alpha = Math.max(0, (puff._life / puff._maxLife) * 0.3);
            if (puff._life <= 0) {
                const originX = (puff._bld ? puff._bld.x : 0) + puff._offX;
                puff.x = originX + (Math.random() - 0.5) * 10;
                puff.y = puff._originY;
                puff._life = puff._maxLife;
                puff.alpha = 0.3;
            }
        });
    }
};
