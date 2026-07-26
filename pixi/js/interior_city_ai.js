/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY AI (v16.4.1 - Pathing & Visual Consistency Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCityAI = {
    layer: null,
    bld: null,
    workers: [],

    init(models, bld, layer) {
        this.layer = layer;
        this.bld = bld;
        this.workers = [];
        const dp = G.getDayPhase();

        models.forEach((m, i) => {
            const stg = getStage(m.rel, m.ret, m.phase);
            const { act } = getAct(stg, dp, i, m);
            
            if (!ACTS[act] || !ACTS[act].indoor) return;
            if (stg === 'retired') return; 

            let desk = InteriorCityCore.desks.length > 0 ? InteriorCityCore.desks[i % InteriorCityCore.desks.length] : null;
            let floorIdx = desk ? desk.floor : Math.floor(Math.random() * (this.bld.dynamicFl || this.bld.fl));

            // ─── FIX: Check if they just arrived so they can walk through the lobby! ───
            let refs = G.charRefs[m.id];
            let isEntering = false;
            let isLeaving = false;

            if (refs) {
                if (refs.wantsToLeave) {
                    isLeaving = true;
                    refs._indoorArrived = false;
                } else if (refs.wantsToEnter) {
                    if (!refs._indoorArrived) {
                        isEntering = true;
                        refs._indoorArrived = true;
                    }
                }
            }

            let startFloor = floorIdx;
            let startX = desk ? desk.x : 50 + Math.random() * (bld.w - 100);

            if (isEntering) {
                startFloor = 0; 
                startX = bld.w / 2; 
            } else if (isLeaving) {
                startFloor = floorIdx;
                startX = desk ? desk.x : 50 + Math.random() * (bld.w - 100);
            }

            const w = this.createWorker(m, startX, InteriorCityCore.floorY(startFloor), startFloor);
            w.desk = desk;
            w.targetFloor = floorIdx;

            if (isEntering) {
                w.state = floorIdx === 0 ? 'moving_to_desk' : 'moving_to_elev_up';
            } else if (isLeaving) {
                w.state = floorIdx === 0 ? 'leaving_lobby' : 'moving_to_elev_down';
            } else {
                w.state = 'working';
            }

            this.workers.push(w);
        });
    },

    createWorker(m, x, y, floorIdx) {
        const c = new PIXI.Container();
        c.x = x; 
        c.y = y;

        const shadow = new PIXI.Graphics();
        const head = new PIXI.Graphics();
        const body = new PIXI.Graphics();
        const legL = new PIXI.Graphics();
        const legR = new PIXI.Graphics();
        const dot = new PIXI.Graphics(); // ─── FIX: Restored the status dot! ───

        c.addChild(shadow, legL, legR, body, head, dot); 

        const wObj = {
            m: m,
            c: c,
            shadow, head, body, legL, legR, dot,
            floorIdx: floorIdx,
            targetFloor: floorIdx,
            desk: null,
            speed: 1.5 + Math.random(),
            state: 'working',
            paramScale: 1
        };

        let paramCount = 100;
        if (m.arch && m.arch.params) {
            let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
            if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
            else if (pStr.includes('B')) paramCount = parseFloat(pStr);
        }
        wObj.paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));

        this.updateWorkerVisuals(wObj);

        // Tracking highlight for followed entity
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(c, m, false);
            if (hl) { wObj._trackGlow = hl.glow; wObj._trackArrow = hl.arrow; }
        }

        this.layer.addChild(c);
        return wObj;
    },

    updateWorkerVisuals(w) {
        const stg = getStage(w.m.rel, w.m.ret, w.m.phase);
        const sd = STAGES[stg];
        const finalSc = sd.size * w.paramScale;

        const bw = Math.round(16 * finalSc);
        const h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR);
        const bodyH = h - headH - Math.round(4 * finalSc);
        const legH = Math.round(4 * finalSc);

        const isR = stg === 'retired';
        const isRm = stg === 'rumored';

        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : 0xfdd8b5;
        const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : 0x3d2914;
        const colHex = parseInt((LABS[w.m.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        const suitCol = isR ? 0x667799 : colHex;
        const eyeS = Math.max(1, bw * .08);

        w.shadow.clear(); 
        w.shadow.beginFill(0x000000, 0.25); 
        w.shadow.drawEllipse(0, 2, bw * 0.6, 3); 
        w.shadow.endFill();
        
        w.head.clear();
        w.head.beginFill(skinCol, isR ? .3 : isRm ? .5 : 1);
        w.head.drawRoundedRect(-bw * .4, 0, bw * .8, headH, headH * .25); 
        w.head.endFill();
        w.head.beginFill(isR ? 0x88aaff : isRm ? 0xa78bfa : 0x2c1810); 
        w.head.drawCircle(-bw * .1, headH * .38, eyeS);
        w.head.drawCircle(bw * .1, headH * .38, eyeS); 
        w.head.endFill(); 
        w.head.beginFill(0x000000, 0.4); 
        w.head.drawRect(-bw * .08, headH * .6, bw * .16, 1.5);
        w.head.endFill();
        w.head.y = -h;
        
        w.body.clear(); 
        w.body.beginFill(suitCol, isR ? .4 : isRm ? .4 : 1);
        w.body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1); 
        w.body.endFill(); 
        w.body.y = -h + headH;
        
        const lw = Math.max(2, bw * .25), lh = Math.max(legH, 2); 
        w.legL.clear(); w.legL.beginFill(legCol, isR ? .25 : 1); w.legL.drawRect(-lw / 2, 0, lw, lh); w.legL.endFill(); w.legL.x = -bw * .15; 
        w.legR.clear(); w.legR.beginFill(legCol, isR ? .25 : 1); w.legR.drawRect(-lw / 2, 0, lw, lh); w.legR.endFill(); w.legR.x = bw * .15;
        
        w.dot.clear(); 
        const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : 0x4ade80; 
        w.dot.beginFill(dotCol); 
        w.dot.drawCircle(0, 0, 2); 
        w.dot.endFill();
        w.dot.y = -h - 6;

        w.c.alpha = isR ? (0.25 + Math.abs(Math.sin(G.tick * 0.03)) * 0.4) : isRm ? .55 : 1;
        w.c.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
    },

    update(dp) {
        this.workers.forEach(w => {
            if (!w.c.visible) return;

            let bob = 0;
            let isWalking = false;

            if (w.state === 'working') {
                if (w.desk) w.c.scale.x = w.desk.dir || 1;
                bob = Math.sin(G.tick * 0.05 + w.c.x) * 1; 
            }
            else if (w.state === 'moving_to_elev_up' || w.state === 'moving_to_elev_down') {
                isWalking = true;
                let targetX = InteriorCityCore.shaftX;
                let dir = Math.sign(targetX - w.c.x);
                w.c.scale.x = dir || 1;
                w.c.x += dir * w.speed;
                
                if (Math.abs(w.c.x - targetX) <= w.speed) {
                    w.c.x = targetX;
                    w.state = w.state === 'moving_to_elev_up' ? 'waiting_elev_up' : 'waiting_elev_down';
                    let callFloor = w.state === 'waiting_elev_up' ? 0 : w.floorIdx;
                    let lift = InteriorCityProps.getLift(this.bld.id);
                    if (lift) lift.call(callFloor);
                }
            }
            else if (w.state === 'waiting_elev_up' || w.state === 'waiting_elev_down') {
                w.c.scale.x = -1; 
                let lift = InteriorCityProps.getLift(this.bld.id);
                let waitFloor = w.state === 'waiting_elev_up' ? 0 : w.floorIdx;
                
                if (lift && lift.currentFloor === waitFloor && lift.state === 'open') {
                    w.state = w.state === 'waiting_elev_up' ? 'riding_elev_up' : 'riding_elev_down';
                    let targetFloor = w.state === 'riding_elev_up' ? w.targetFloor : 0;
                    lift.call(targetFloor);
                }
            }
            else if (w.state === 'riding_elev_up' || w.state === 'riding_elev_down') {
                w.c.scale.x = 1; 
                let lift = InteriorCityProps.getLift(this.bld.id);
                
                if (lift) {
                    w.c.y = G.groundY - 20 + lift.car.y; 
                    let destFloor = w.state === 'riding_elev_up' ? w.targetFloor : 0;
                    
                    if (lift.currentFloor === destFloor && lift.state === 'open') {
                        w.floorIdx = destFloor;
                        w.state = w.state === 'riding_elev_up' ? 'moving_to_desk' : 'leaving_lobby';
                        w.c.y = InteriorCityCore.floorY(w.floorIdx); 
                    }
                }
            }
            else if (w.state === 'moving_to_desk') {
                isWalking = true;
                let destX = w.desk ? w.desk.x : (InteriorCityCore.bldW / 2);
                let dir = Math.sign(destX - w.c.x);
                w.c.scale.x = dir || 1;
                w.c.x += dir * w.speed;
                
                if (Math.abs(w.c.x - destX) <= w.speed) {
                    w.c.x = destX;
                    w.state = 'working';
                }
            }
            else if (w.state === 'leaving_lobby') {
                isWalking = true;
                let destX = InteriorCityCore.bldW / 2; 
                let dir = Math.sign(destX - w.c.x);
                w.c.scale.x = dir || 1;
                w.c.x += dir * w.speed;
                
                if (Math.abs(w.c.x - destX) <= w.speed) {
                    w.c.visible = false;
                }
            }

            if (w.state !== 'riding_elev_up' && w.state !== 'riding_elev_down') {
                if (isWalking) bob = Math.sin(G.tick * 0.2) * 2;
                w.c.y = InteriorCityCore.floorY(w.floorIdx) - bob;
            }

            if (isWalking) {
                let legA = Math.sin(G.tick * 0.15) * 2.5;
                w.legL.y = legA;
                w.legR.y = -legA;
            } else {
                w.legL.y = 0;
                w.legR.y = 0;
            }

            // Tracking highlight pulse
            if (w._trackGlow) {
                w._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15;
                if (w._trackArrow) w._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2;
            }
        });
    },

    destroy() {
        this.workers.forEach(w => w.c.destroy({ children: true }));
        this.workers = [];
    },

    // ─── AVATAR FACTORY (required by InteriorCityCore.build) ───
    // Renders characters pixel-identical to exterior updateCharStateVisuals.
    drawAvatar(m, x, y, container, floorIdx, isStatic = false, isCeo = false) {
        // ─── CEOs/Founders render as humans, not AI bots ───
        // Routes through HumanAvatar so each founder is recognizable inside their HQ
        // (per-founder fingerprints in HumanAvatar.FOUNDER_LOOKS).
        if (isCeo && m.founderData && typeof HumanAvatar !== 'undefined') {
            return this._drawCeoAvatar(m, x, y, container, floorIdx, isStatic);
        }

        const cont = new PIXI.Container();
        const stg = getStage(m.rel, m.ret, m.phase);
        const sd = STAGES[stg] || STAGES.adult;
        const sc = sd.size;

        let paramCount = 100;
        let isMoE = false;
        if (m.arch) {
            if (m.arch.type && m.arch.type.includes('MoE')) isMoE = true;
            if (m.arch.params) {
                let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
                if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
                else if (pStr.includes('B')) paramCount = parseFloat(pStr);
            }
        }
        const paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));
        const finalSc = sc * paramScale;

        // ─── Proportions: identical to exterior updateCharStateVisuals ───
        const bw = Math.round(16 * finalSc);
        const h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR);
        const bodyH = h - headH - Math.round(4 * finalSc);
        const legH = Math.round(4 * finalSc);
        const eyeS = Math.max(1, bw * 0.08);

        const lab = LABS[m.lab] || LABS.other || { color: '#64748b' };
        const colHex = (isCeo && m.founderData && m.founderData.color)
            ? parseInt(m.founderData.color.slice(1), 16)
            : parseInt(lab.color.slice(1), 16);

        const isR = stg === 'retired';
        const isRm = stg === 'rumored';
        const suitCol = isR ? 0x667799 : colHex;
        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : 0xfdd8b5;
        const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : 0x3d2914;

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();

        // Head — stage-based headR, proportional corners, eyes + mouth
        const head = new PIXI.Graphics();
        head.beginFill(skinCol, isR ? 0.3 : isRm ? 0.5 : 1);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(isR ? 0x88aaff : isRm ? 0xa78bfa : 0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, eyeS);
        head.drawCircle(bw * 0.1, headH * 0.38, eyeS);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(suitCol, isR ? 0.4 : isRm ? 0.4 : 1);
        body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
        body.endFill();
        body.y = -h + headH;

        // Legs
        const lw = Math.max(2, bw * 0.25);
        const lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol, isR ? 0.25 : 1);
        legL.drawRect(-lw / 2, 0, lw, lh);
        legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol, isR ? 0.25 : 1);
        legR.drawRect(-lw / 2, 0, lw, lh);
        legR.endFill();
        legR.x = bw * 0.15;

        // Status dot — color-coded by lifecycle stage
        const dot = new PIXI.Graphics();
        const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : 0x4ade80;
        dot.beginFill(dotCol);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;

        // MoE ghost bodies (Mixture of Experts split visual)
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
            ghostL.y = body.y;
            ghostR.y = body.y;
            ghostL.x = -bw * 0.2;
            ghostR.x = bw * 0.2;
            ghostL.alpha = 0.4;
            ghostR.alpha = 0.4;
        }

        cont.addChild(shadow, ghostL, ghostR, legL, legR, body, head, dot);
        cont.x = x;
        cont.y = y;

        cont.alpha = isR ? 0.6 : isRm ? 0.8 : 1.0;
        cont.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;

        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        cont.on('pointerover', (e) => {
            if (typeof UI === 'undefined') return;
            const stg = getStage(m.rel, m.ret, m.phase); const sd = STAGES[stg] || STAGES.adult;
            const dp = G.getDayPhase(); const idx = G.models.indexOf(m);
            const ai = (typeof ACTS !== 'undefined' && ACTS[getAct(stg, dp, idx, m).act]) ? ACTS[getAct(stg, dp, idx, m).act] : { icon: '💻', label: 'Processing' };
            UI.showTooltip(e, `${m.name}${m.phase === 'rumored' ? ' 🔮' : ''}`, `${ai.icon} ${ai.label} · ${sd.label}`, true);
        });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        container.addChild(cont);

        const agent = {
            m, cont, head, body, legL, legR, dot, shadow, ghostL, ghostR, isMoE,
            state: 'working', timer: 0, deskX: x, floorIdx, speed: 1.5,
            floorY: y, targetX: x, jobTheme: null, propGfx: null,
            isStaticRole: isStatic, isCeo: isCeo,
            bedX: 0, bedY: 0, resumeState: null
        };

        // Tracking highlight for followed entity
        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(cont, m, isCeo);
            if (hl) { agent._trackGlow = hl.glow; agent._trackArrow = hl.arrow; }
        }

        this.avatars.push(agent);
        return agent;
    },

    // ─── CEO/Founder pixel-art via HumanAvatar ──────────────────────────────
    // Returns the same agent shape as drawAvatar() (head/body/legL/legR/dot/shadow,
    // plus the city-only floorY/targetX/jobTheme/propGfx fields), so the existing
    // animation, click and visibility logic in interior_city_core.js works unchanged.
    _drawCeoAvatar(m, x, y, container, floorIdx, isStatic) {
        const av = HumanAvatar.drawFounder(container, m.founderData, {
            x, y,
            showTag: false,    // interiors render their own role labels above CEOs
            showDot: true,
            seed: 'founder_' + (m.founderData && m.founderData.name)
        });

        av.cont.eventMode = 'static';
        av.cont.cursor = 'pointer';
        av.cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        av.cont.on('pointerover', (e) => {
            if (typeof UI === 'undefined') return;
            const role = (m.founderData && m.founderData.role) ? m.founderData.role : 'Founder';
            UI.showTooltip(e, m.name, role, true);
        });
        av.cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        const agent = {
            m, cont: av.cont, head: av.head, body: av.body,
            legL: av.legL, legR: av.legR, dot: av.dot, shadow: av.shadow,
            // Humans don't render MoE ghost bodies — left null so the existing
            // `if (av.ghostL)` guards skip them cleanly.
            ghostL: null, ghostR: null, isMoE: false,
            state: 'working', timer: 0, deskX: x, floorIdx, speed: 1.5,
            floorY: y, targetX: x, jobTheme: null, propGfx: null,
            isStaticRole: isStatic, isCeo: true,
            bedX: 0, bedY: 0, resumeState: null
        };

        if (typeof G !== 'undefined' && G.tracking && G._addTrackHighlight) {
            const hl = G._addTrackHighlight(av.cont, m, true);
            if (hl) { agent._trackGlow = hl.glow; agent._trackArrow = hl.arrow; }
        }

        this.avatars.push(agent);
        return agent;
    },

    animateWalk(av) {
        av.head.y = -32 + 4 + Math.sin(G.tick * 0.12) * 1.5;
        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.12)) * 1.5;
        if (av.legL && av.legR) {
            // Always clear seated leg rotation before walking, otherwise an avatar
            // that gets up from a desk drags folded legs sideways.
            av.legL.rotation = 0;
            av.legR.rotation = 0;
            av.legL.y = Math.sin(G.tick * 0.15) * 2.5;
            av.legR.y = -Math.sin(G.tick * 0.15) * 2.5;
        }
    },

    spawnBubble(av, msgOverride = null) {
        if (!this.layer || !this.layer.visible) return;

        const msgs = [
            "Calculating...", "Optimizing...", "Compiling...",
            "Data incoming.", "Adjusting weights.", "Processing."
        ];
        const msg = msgOverride || msgs[Math.floor(Math.random() * msgs.length)];

        const bCont = new PIXI.Container();
        const bg = new PIXI.Graphics();
        const txt = new PIXI.Text(msg, {
            fontFamily: 'JetBrains Mono', fontSize: 9, fill: 0x000000, fontWeight: 'bold'
        });

        txt.anchor.set(0.5, 1);
        txt.y = -6;

        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.beginFill(0xffffff);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();

        bCont.addChild(bg, txt);

        const stg = getStage(av.m.rel, av.m.ret, av.m.phase);
        const finalSc = STAGES[stg]?.size || 1;
        const h = Math.round(32 * finalSc);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - h - 10;

        if (this.scene) this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    }
};
