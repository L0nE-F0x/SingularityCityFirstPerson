/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE ENTITIES (v1.0.0 — Phase 2: Launch Animations & Real-Time Triggers)
   Handles animated rocket entities, launch sequences, smoke/flame particles, and countdown displays.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceEntities = {
    rockets: {},      // keyed by pad building id
    particles: [],    // smoke/flame particles
    particlePool: [], // recycled particle graphics
    countdownTexts: {},
    layer: null,      // PIXI container for all space entities
    
    init(carLayer) {
        this.layer = new PIXI.Container();
        carLayer.addChild(this.layer);
        
        // Create a rocket entity for each launch pad
        BLDS.forEach(b => {
            if (b.type === 'launchpad' && b.org) {
                this.createRocket(b);
            }
        });
        
    },
    
    createRocket(padBld) {
        const org = SPACE_ORGS[padBld.org];
        if (!org) return;
        
        const colHex = parseInt(org.color.slice(1), 16);
        const cont = new PIXI.Container();
        cont.sortableChildren = true;
        
        // Rocket body — the org's real-world flagship vehicle (shared silhouette lib)
        const body = new PIXI.Graphics();
        if (typeof SpaceRockets !== 'undefined') {
            SpaceRockets.draw(body, padBld.org, 1);
        } else {
            body.beginFill(0xf1f5f9);
            body.drawRect(-4, -45, 8, 45);
            body.endFill();
            body.beginFill(colHex);
            body.drawPolygon([-4, -45, 0, -58, 4, -45]);
            body.endFill();
        }
        body.zIndex = 10;
        cont.addChild(body);
        const vehHeight = (typeof SpaceRockets !== 'undefined') ? SpaceRockets.height(padBld.org) : 58;
        
        // Flame container (visible during ignition/liftoff)
        const flame = new PIXI.Container();
        flame.visible = false;
        flame.zIndex = 5;
        cont.addChild(flame);

        // Pre-launch beacon (rotating red light at top of tower) — drawn in pad-relative space
        const beacon = new PIXI.Graphics();
        beacon.visible = false;
        beacon.zIndex = 12;
        cont.addChild(beacon);

        // Spotlight cone behind rocket — visible during prep/countdown/ignition
        const spotlight = new PIXI.Graphics();
        spotlight.visible = false;
        spotlight.zIndex = 2;
        spotlight.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(spotlight);

        // Countdown text — bigger, with stroke for readability, floats above the rocket nose
        const countdownTxt = new PIXI.Text('', {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11,
            fill: 0x22d3ee,
            fontWeight: 'bold',
            align: 'center',
            stroke: 0x000000,
            strokeThickness: 3
        });
        countdownTxt.anchor.set(0.5, 1);
        countdownTxt.y = -(vehHeight + 10); // above rocket nose
        countdownTxt.zIndex = 20;
        cont.addChild(countdownTxt);

        // Position on pad
        const towerX = padBld.w / 2 - 8;
        const rocketLocalX = towerX + 28;

        cont.x = padBld.x + rocketLocalX;
        cont.y = G.groundY - 24 - 8; // sits on pad surface

        this.layer.addChild(cont);

        const rocket = {
            padId: padBld.id,
            org: padBld.org,
            cont,
            body,
            flame,
            beacon,
            spotlight,
            countdownTxt,
            vehH: vehHeight,
            // idle | preparation | countdown | ignition | liftoff | ascending | orbit | resetting
            state: 'idle',
            timer: 0,
            launchData: null, // matched launch from API
            baseY: cont.y,
            baseX: cont.x,
            ascentSpeed: 0,
            shakeIntensity: 0,
            trailParticles: []
        };

        this.rockets[padBld.id] = rocket;
        this.countdownTexts[padBld.id] = countdownTxt;
    },
    
    // ─── Match real launches to pads ───
    matchLaunchesToPads() {
        if (typeof SpaceData === 'undefined' || !SpaceData.launches.length) return;

        const now = new Date();

        Object.values(this.rockets).forEach(r => {
            // Skip if mid-flight — don't reassign once a launch is in progress
            const inFlight = ['ignition', 'liftoff', 'ascending', 'orbit', 'resetting'].includes(r.state);
            if (inFlight) return;

            const orgKey = r.org;
            const match = SpaceData.launches.find(l => {
                const provider = SpaceData.getOrgForProvider(l.provider);
                const diff = new Date(l.net) - now;
                return provider === orgKey && diff > -300000; // future or within 5 min past
            });

            if (!match) {
                // No match — return to idle baseline
                if (r.state !== 'idle') r.state = 'idle';
                r.launchData = null;
                return;
            }

            r.launchData = match;
            const diff = new Date(match.net) - now;

            // Already-launched (NET in past, within 5 min): trigger if we haven't for THIS launch id
            if (diff <= 0 && diff > -300000 && r._launchTriggered !== match.id) {
                r._launchTriggered = match.id;
                this.triggerLaunch(r.padId);
                return;
            }

            // T-1:00 → countdown state (final 60 seconds, intense shake, smoke begins)
            if (diff > 0 && diff <= 60000 && r.state !== 'countdown') {
                r.state = 'countdown';
                r.timer = Math.floor(diff / 1000) * 60;
                this.notifyImminent(match, '1 minute');
                return;
            }

            // T-5:00 → preparation state (visible zone activity, vapor, beacon)
            if (diff > 60000 && diff <= 300000 && r.state !== 'preparation' && r.state !== 'countdown') {
                r.state = 'preparation';
                r.timer = 0;
                this.notifyImminent(match, '5 minutes');
                return;
            }
        });
    },

    // ─── Toast user about imminent launch (deduped per launch id + label) ───
    notifyImminent(launch, label) {
        if (!this._notified) this._notified = {};
        const key = launch.id + '|' + label;
        if (this._notified[key]) return;
        this._notified[key] = true;
        if (typeof UI !== 'undefined') {
            UI.addToast(`🚀 T-${label} · ${launch.name} · head to Space Zone`);
        }
    },
    
    // ─── Manual launch trigger (for demo / when API reports T-0) ───
    triggerLaunch(padId) {
        const r = this.rockets[padId];
        if (!r) return;
        // Only block if mid-flight; allow from idle/preparation/countdown
        const blocked = ['ignition', 'liftoff', 'ascending', 'orbit', 'resetting'].includes(r.state);
        if (blocked) return;

        r.state = 'ignition';
        r.timer = 180; // 3 seconds of ignition before liftoff
        r.shakeIntensity = 2;

        const org = SPACE_ORGS[r.org];
        if (typeof UI !== 'undefined') {
            const name = r.launchData ? r.launchData.name : `${org.name} Launch`;
            UI.addToast(`🚀 LAUNCH: ${name}`);
        }
    },
    
    // ─── Simulate a launch on a random pad (for visual testing / demo) ───
    triggerRandomLaunch() {
        const idle = Object.values(this.rockets).filter(r => r.state === 'idle');
        if (idle.length === 0) return;
        const pick = idle[Math.floor(Math.random() * idle.length)];
        this.triggerLaunch(pick.padId);
    },
    
    // ─── Spawn a particle ───
    spawnParticle(x, y, type, color) {
        let g;
        if (this.particlePool.length > 0) {
            g = this.particlePool.pop();
            g.clear();
            g.visible = true;
        } else {
            g = new PIXI.Graphics();
            this.layer.addChild(g);
        }
        
        const size = type === 'smoke' ? 3 + Math.random() * 6 : 2 + Math.random() * 4;
        const alpha = type === 'smoke' ? 0.3 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
        
        g.beginFill(color, alpha);
        g.drawCircle(0, 0, size);
        g.endFill();
        if (type === 'flame') {
            g.blendMode = PIXI.BLEND_MODES.ADD;
        } else {
            g.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
        
        g.x = x;
        g.y = y;
        g.zIndex = type === 'smoke' ? 1 : 3;
        
        const particle = {
            g,
            vx: (Math.random() - 0.5) * (type === 'smoke' ? 3 : 1.5),
            vy: type === 'smoke' ? 0.5 + Math.random() * 1.5 : -1 - Math.random() * 2,
            life: type === 'smoke' ? 60 + Math.random() * 60 : 20 + Math.random() * 30,
            maxLife: 0,
            type
        };
        particle.maxLife = particle.life;
        
        this.particles.push(particle);
    },
    
    // ─── Draw animated flame on rocket ───
    drawFlame(rocket, intensity) {
        const f = rocket.flame;
        f.visible = true;

        // Reuse a single Graphics object instead of creating new one every frame
        if (!rocket._flameGfx) {
            rocket._flameGfx = new PIXI.Graphics();
            rocket._flameGfx.blendMode = PIXI.BLEND_MODES.ADD;
            f.addChild(rocket._flameGfx);
        }
        const flameGfx = rocket._flameGfx;
        flameGfx.clear();
        const h = 10 + intensity * 15;

        // Outer flame (orange-red)
        flameGfx.beginFill(0xef4444, 0.8);
        flameGfx.drawPolygon([
            -6 - intensity * 2, 0,
            0, h + Math.sin(G.tick * 0.3) * 5,
            6 + intensity * 2, 0
        ]);
        flameGfx.endFill();

        // Inner flame (yellow-white)
        flameGfx.beginFill(0xfbbf24, 0.9);
        flameGfx.drawPolygon([
            -3 - intensity, 0,
            0, h * 0.6 + Math.sin(G.tick * 0.5) * 3,
            3 + intensity, 0
        ]);
        flameGfx.endFill();

        // Core (white hot)
        flameGfx.beginFill(0xffffff, 0.7);
        flameGfx.drawPolygon([
            -1, 0,
            0, h * 0.3 + Math.sin(G.tick * 0.7) * 2,
            1, 0
        ]);
        flameGfx.endFill();
    },
    
    // ─── Main update loop — called every frame ───
    update() {
        if (!this.layer) return;

        // Match launches every ~1 second (was 5s — speeds up trigger when NET crosses)
        if (G.tick % 60 === 0) {
            this.matchLaunchesToPads();
        }

        // Sweep the tracking-station scan dishes across the sky (side-view radar).
        if (!this._trackBlds) this._trackBlds = (window.BLDS || []).filter(b => b.type === 'tracking');
        for (let i = 0; i < this._trackBlds.length; i++) {
            const tb = this._trackBlds[i];
            if (tb._scanDish && !tb._scanDish.destroyed) {
                tb._scanDish.rotation = Math.sin(G.tick * 0.012 + tb.x * 0.01) * 0.6;
            }
        }
        
        // Update each rocket
        Object.values(this.rockets).forEach(r => {
            switch (r.state) {
                case 'idle': {
                    r.cont.x = r.baseX;
                    r.cont.y = r.baseY;
                    r.cont.scale.set(1);
                    r.cont.alpha = 1;
                    r.cont.visible = true;
                    r.body.visible = true;
                    r.flame.visible = false;
                    r.beacon.visible = false;
                    r.spotlight.visible = false;

                    if (r.launchData) {
                        const cd = SpaceData.getCountdown(r.launchData);
                        if (cd) {
                            r.countdownTxt.text = cd;
                            r.countdownTxt.style.fill = cd.startsWith('T-0') ? 0xef4444 : 0x22d3ee;
                            r.countdownTxt.visible = true;
                        }
                    } else {
                        r.countdownTxt.text = '';
                        r.countdownTxt.visible = false;
                    }
                    break;
                }

                case 'preparation': {
                    r.timer++;
                    r.cont.x = r.baseX;
                    r.cont.y = r.baseY;
                    r.cont.scale.set(1);
                    r.cont.alpha = 1;
                    r.body.visible = true;
                    r.flame.visible = false;

                    // Live countdown text — yellow during preparation
                    const cd = r.launchData ? SpaceData.getCountdown(r.launchData) : null;
                    r.countdownTxt.text = cd || 'PREP';
                    r.countdownTxt.style.fill = 0xfbbf24;

                    // Rotating beacon at top of tower (red, slow strobe)
                    r.beacon.visible = true;
                    const pulse = 0.4 + 0.6 * Math.abs(Math.sin(G.tick * 0.06));
                    r.beacon.clear();
                    r.beacon.beginFill(0xef4444, pulse);
                    r.beacon.drawCircle(-12, -(r.vehH + 8), 3);
                    r.beacon.endFill();
                    r.beacon.beginFill(0xef4444, pulse * 0.3);
                    r.beacon.drawCircle(-12, -(r.vehH + 8), 6);
                    r.beacon.endFill();

                    // Soft spotlight halo around rocket base
                    r.spotlight.visible = true;
                    r.spotlight.clear();
                    r.spotlight.beginFill(0xfbbf24, 0.08 + 0.04 * Math.sin(G.tick * 0.05));
                    r.spotlight.drawEllipse(0, 4, 30, 14);
                    r.spotlight.endFill();

                    // Vapor venting at base — slow, sparse white puffs
                    if (G.tick % 25 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 10, r.baseY - 6, 'smoke', 0xe2e8f0);
                    }

                    // Transition to countdown if NET drops under 60 sec
                    if (r.launchData) {
                        const diff = new Date(r.launchData.net) - new Date();
                        if (diff <= 60000 && diff > 0) {
                            r.state = 'countdown';
                            r.timer = Math.floor(diff / 1000) * 60;
                            this.notifyImminent(r.launchData, '1 minute');
                        } else if (diff <= 0 && diff > -300000 && r._launchTriggered !== r.launchData.id) {
                            r._launchTriggered = r.launchData.id;
                            this.triggerLaunch(r.padId);
                        }
                    }
                    break;
                }

                case 'countdown': {
                    r.timer--;
                    const secs = Math.max(0, Math.ceil(r.timer / 60));
                    r.countdownTxt.text = `T-${secs}s`;
                    r.countdownTxt.style.fill = secs < 10 ? 0xef4444 : 0xfbbf24;

                    // Shake increases as we approach zero
                    const shake = (60 - secs) * 0.06;
                    r.cont.x = r.baseX + (Math.random() - 0.5) * shake;
                    r.cont.alpha = 1;

                    // Fast strobe beacon
                    r.beacon.visible = true;
                    const stroboscope = (G.tick % 20 < 10) ? 1 : 0.2;
                    r.beacon.clear();
                    r.beacon.beginFill(0xef4444, stroboscope);
                    r.beacon.drawCircle(-12, -(r.vehH + 8), 4);
                    r.beacon.endFill();

                    // Glowing red spotlight
                    r.spotlight.visible = true;
                    r.spotlight.clear();
                    r.spotlight.beginFill(0xef4444, 0.15 + 0.1 * Math.sin(G.tick * 0.2));
                    r.spotlight.drawEllipse(0, 4, 36, 16);
                    r.spotlight.endFill();

                    // Heavier vapor + occasional flame puff at base
                    if (G.tick % 5 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 14, r.baseY - 4, 'smoke', 0xcbd5e1);
                    }
                    if (secs < 15 && G.tick % 8 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 6, r.baseY, 'flame', 0xfbbf24);
                    }

                    if (r.timer <= 0) {
                        r.state = 'ignition';
                        r.timer = 180;
                        r.shakeIntensity = 2;
                    }
                    break;
                }

                case 'ignition': {
                    r.timer--;
                    r.countdownTxt.text = 'IGNITION';
                    r.countdownTxt.style.fill = 0xef4444;

                    r.cont.x = r.baseX + (Math.random() - 0.5) * r.shakeIntensity;
                    r.shakeIntensity = Math.min(4, r.shakeIntensity + 0.02);

                    const ignitionProgress = 1 - (r.timer / 180);
                    this.drawFlame(r, ignitionProgress * 2.2);

                    // Massive smoke plume + flame jets
                    if (G.tick % 2 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 18, r.baseY + 4, 'smoke', 0x94a3b8);
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 8, r.baseY, 'flame', 0xfbbf24);
                    }
                    if (G.tick % 3 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 24, r.baseY + 2, 'smoke', 0xe5e7eb);
                    }

                    // Spotlight blazing
                    r.spotlight.visible = true;
                    r.spotlight.clear();
                    r.spotlight.beginFill(0xef4444, 0.4 + 0.2 * Math.sin(G.tick * 0.4));
                    r.spotlight.drawEllipse(0, 4, 40, 18);
                    r.spotlight.endFill();
                    r.beacon.visible = false;

                    if (r.timer <= 0) {
                        r.state = 'liftoff';
                        r.timer = 0;
                        r.ascentSpeed = 0.4;
                        r.spotlight.visible = false;
                        if (typeof G !== 'undefined') G.unlockAchieve('rocket_scientist');
                    }
                    break;
                }

                case 'liftoff': {
                    r.timer++;
                    r.countdownTxt.text = `T+${Math.floor(r.timer / 60)}s`;
                    r.countdownTxt.style.fill = 0x4ade80;

                    // Steady acceleration upward
                    r.ascentSpeed = Math.min(6, r.ascentSpeed + 0.04);
                    r.cont.y -= r.ascentSpeed;

                    r.shakeIntensity = Math.max(0, r.shakeIntensity - 0.02);
                    r.cont.x = r.baseX + (Math.random() - 0.5) * r.shakeIntensity;

                    this.drawFlame(r, 2.4 + Math.sin(G.tick * 0.2) * 0.5);

                    // Heavy smoke at pad + flame at exhaust
                    if (G.tick % 2 === 0) {
                        this.spawnParticle(r.baseX + (Math.random() - 0.5) * 16, r.baseY + 4, 'smoke', 0x94a3b8);
                        this.spawnParticle(r.cont.x + (Math.random() - 0.5) * 6, r.cont.y + 4, 'flame',
                            Math.random() > 0.5 ? 0xfbbf24 : 0xef4444);
                    }
                    if (G.tick % 3 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random() - 0.5) * 4, r.cont.y + 2, 'smoke', 0xffffff);
                    }

                    // Switch to ascending once clear of the gantry
                    if (r.cont.y < r.baseY - 200) {
                        r.state = 'ascending';
                    }
                    break;
                }

                case 'ascending': {
                    r.timer++;
                    r.countdownTxt.text = `T+${Math.floor(r.timer / 60)}s`;

                    // Keep accelerating, no shrinking — feels like it's leaving Earth
                    r.ascentSpeed = Math.min(16, r.ascentSpeed + 0.06);
                    r.cont.y -= r.ascentSpeed;

                    const altitude = r.baseY - r.cont.y;

                    // Only fade out very late — when the rocket is unambiguously off-screen
                    if (altitude > 1800) {
                        r.cont.alpha = Math.max(0, 1 - (altitude - 1800) / 400);
                    }

                    // Persistent flame + exhaust trail
                    this.drawFlame(r, 2 + Math.sin(G.tick * 0.2) * 0.4);
                    if (G.tick % 3 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random() - 0.5) * 4, r.cont.y + 4, 'smoke', 0xffffff);
                    }
                    if (G.tick % 5 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random() - 0.5) * 6, r.cont.y + 6, 'flame', 0xfbbf24);
                    }

                    if (altitude > 2200 || r.cont.alpha < 0.02) {
                        r.state = 'orbit';
                        r.timer = 600;
                        r.cont.visible = false;
                        r.flame.visible = false;

                        const org = SPACE_ORGS[r.org];
                        if (typeof UI !== 'undefined') {
                            const name = r.launchData ? r.launchData.name : `${org.name} mission`;
                            UI.addToast(`🛰️ ${name} — Orbit achieved!`);
                        }
                    }
                    break;
                }

                case 'orbit': {
                    r.timer--;
                    r.countdownTxt.text = '';
                    if (r.timer <= 0) {
                        r.state = 'resetting';
                        r.timer = 120;
                    }
                    break;
                }

                case 'resetting': {
                    r.timer--;
                    r.cont.x = r.baseX;
                    r.cont.y = r.baseY;
                    r.cont.scale.set(1);
                    r.cont.visible = true;
                    r.cont.alpha = 1 - (r.timer / 120);
                    r.flame.visible = false;
                    r.beacon.visible = false;
                    r.spotlight.visible = false;
                    r.countdownTxt.text = '';
                    r.countdownTxt.visible = false;

                    if (r.timer <= 0) {
                        r.cont.alpha = 1;
                        r.state = 'idle';
                        r.launchData = null;
                        r.shakeIntensity = 0;
                        // Note: don't clear _launchTriggered — keep it scoped to the
                        // last-fired launch.id so the same launch isn't re-triggered,
                        // but a new launch (different id) will trigger fine.
                    }
                    break;
                }
            }
        });
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.g.x += p.vx;
            p.g.y += p.vy;
            p.life--;
            
            // Smoke drifts and expands
            if (p.type === 'smoke') {
                p.vx *= 0.98;
                p.vy *= 0.97;
                p.g.scale.set(1 + (1 - p.life / p.maxLife) * 1.5);
            }
            
            p.g.alpha = (p.life / p.maxLife) * 0.6;
            
            if (p.life <= 0) {
                p.g.visible = false;
                this.particlePool.push(p.g);
                this.particles.splice(i, 1);
            }
        }
    }
};
