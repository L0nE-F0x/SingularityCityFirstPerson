/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR AVATAR STATES (v16.5.0 - Extracted from interior_city_core.js)
   Mixin providing avatar state machine logic for building interiors.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorAvatarStates = {

    updateAvatarStates(leftWall, rightWall, numFloors) {
        this.avatars.forEach((av, i) => {
            // Tracking highlight pulse
            if (av._trackGlow) {
                av._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15;
                if (av._trackArrow) av._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2;
            }

            if (av.isStaticRole) {
                const bob = Math.sin(G.tick * 0.15 + i) * 1.5;
                av.head.y = -32 + 4 + bob;
                av.body.y = -32 + 12 + 4 + (bob * 0.5);
                if (av.legL && av.legR) {
                    av.legL.y = 0;
                    av.legR.y = 0;
                }
                return;
            }

            if (av.propGfx) av.propGfx.visible = false;

            // ─── SCHEDULE CHANGE: poll wantsToLeave so models exit when their activity changes ───
            // BUG FIX (v349): Without this, models that enter a building (e.g. cafe at lunch)
            // remain trapped forever because the state machine never checked whether their
            // schedule had moved on. This caused 100+ models to pile up overnight with zzz icons.
            if (!av.m.isCeo && av.state !== 'gone') {
                const _refs = G.charRefs[av.m.id];
                if (_refs && _refs.wantsToLeave) {
                    const _exitStates = ['walking_to_elevator_down', 'calling_lift', 'waiting_lift',
                                         'delay_enter_lift', 'entering_lift', 'riding_lift', 'walking_out'];
                    if (!_exitStates.includes(av.state)) {
                        // Stagger departures with a random delay so models don't all stampede
                        // to the elevator at once (0-3 seconds spread)
                        if (typeof av._exitDelay === 'undefined') av._exitDelay = Math.floor(Math.random() * 180);
                        if (av._exitDelay > 0) { av._exitDelay--; }
                        else {
                            if (av.floorIdx === 0) {
                                av.state = 'walking_out';
                                av.targetX = this.startX + (this.bld.id === 'forest_0' ? this.bldW / 2 : this.usableW / 2);
                            } else {
                                av.state = 'walking_to_elevator_down';
                                av.targetX = this.floors[av.floorIdx].elevatorX;
                            }
                        }
                    }
                } else {
                    // Reset exit delay when model no longer wants to leave (re-entered legitimately)
                    av._exitDelay = undefined;
                }
            }

            if ((av.state === 'walking_to_prop' || av.state === 'returning') && av.timer <= 0 && !av.m.isCeo) {
                let partner = this.avatars.find(other =>
                    other !== av &&
                    !other.isStaticRole &&
                    !other.m.isCeo &&
                    (other.state === 'walking_to_prop' || other.state === 'returning') &&
                    other.floorIdx === av.floorIdx &&
                    Math.abs(other.cont.x - av.cont.x) < 25 &&
                    other.timer <= 0
                );

                if (partner && Math.random() < 0.1) {
                    av.resumeState = av.state;
                    partner.resumeState = partner.state;
                    av.state = 'chatting';
                    partner.state = 'chatting';

                    av.timer = 180 + Math.random() * 120;
                    partner.timer = av.timer;

                    av.cont.scale.x = Math.sign(partner.cont.x - av.cont.x) || 1;
                    partner.cont.scale.x = Math.sign(av.cont.x - partner.cont.x) || -1;

                    const topics = ["AGI timelines?", "Need more H100s.", "My loss curve...", "Open weights?", "Synthetic data is key.", "RLHF is tedious."];
                    this.spawnBubble(av, topics[Math.floor(Math.random() * topics.length)]);

                    setTimeout(() => {
                        if (!this.layer || !this.layer.visible || G.activeInterior !== this.bld.id) return;
                        if (partner.state === 'chatting') {
                            const replies = ["Agreed.", "Not scalable.", "Pfft, closed source.", "Compute is king.", "Data wall approaching."];
                            this.spawnBubble(partner, replies[Math.floor(Math.random() * replies.length)]);
                        }
                    }, 1500);
                }
            }

            switch (av.state) {

                case 'ceo_entering': {
                    this.animateWalk(av);
                    const dxEnter = this.floors[-1].elevatorX - av.cont.x;
                    if (Math.abs(dxEnter) < av.speed) {
                        av.cont.x = this.floors[-1].elevatorX;
                        av.state = 'ceo_calling_up';
                    } else {
                        av.cont.x += Math.sign(dxEnter) * av.speed;
                        av.cont.scale.x = Math.sign(dxEnter);
                    }
                    break;
                }
                case 'ceo_calling_up': {
                    const cLiftUp = this.getLift(this.bld.id);
                    if (cLiftUp) { cLiftUp.call(-1); av.state = 'ceo_waiting_up'; }
                    break;
                }
                case 'ceo_waiting_up': {
                    const wLiftUp = this.getLift(this.bld.id);
                    if (wLiftUp && wLiftUp.currentFloor === -1 && wLiftUp.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_up';
                    }
                    break;
                }
                case 'ceo_delay_up': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_up';
                    break;
                }
                case 'ceo_riding_up': {
                    const rLiftUp = this.getLift(this.bld.id);
                    if (rLiftUp) {
                        av.cont.visible = false;
                        rLiftUp.call(numFloors - 1);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftUp.car.y;
                        if (rLiftUp.currentFloor === numFloors - 1 && rLiftUp.state === 'open') {
                            av.cont.y = this.floors[numFloors - 1].y;
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_desk';
                            av.floorIdx = numFloors - 1;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_desk': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av);
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) {
                        av.cont.x = av.deskX;
                        const refs = G.charRefs[av.m.id];
                        if (refs) refs.wantsToEnter = false;
                        av.state = 'ceo_working';
                    } else {
                        av.cont.x += Math.sign(dx) * av.speed;
                        av.cont.scale.x = Math.sign(dx);
                    }
                    break;
                }
                case 'ceo_working': {
                    if (Math.random() < 0.005) {
                        av.state = 'ceo_wandering';
                        av.targetX = leftWall + Math.random() * (rightWall - leftWall);
                    } else {
                        av.cont.rotation = 0;
                        av.cont.x = av.deskX;
                        av.cont.scale.x = 1;
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.1) * 1.5;
                        av.body.y = -32 + 12 + 4;
                        if (av.legL && av.legR) {
                            av.legL.rotation = -Math.PI / 2;
                            av.legR.rotation = -Math.PI / 2;
                            av.legL.y = -4;
                            av.legR.y = -4;
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 5) {
                            this.spawnBubble(av, ["Reviewing the benchmarks.", "Check the stock price.", "We need more compute."][Math.floor(Math.random()*3)]);
                        }
                    }
                    break;
                }
                case 'ceo_wandering': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av);
                    const dxWander = av.targetX - av.cont.x;
                    if (Math.abs(dxWander) < av.speed) {
                        av.cont.x = av.targetX;
                        av.state = 'ceo_standing';
                        av.timer = 150 + Math.random() * 150;
                    } else {
                        av.cont.x += Math.sign(dxWander) * av.speed;
                        av.cont.scale.x = Math.sign(dxWander);
                    }
                    break;
                }
                case 'ceo_standing': {
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05) * 1.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    av.timer--;
                    if (av.timer <= 0) {
                        if (Math.random() < 0.5) {
                            av.state = 'ceo_walking_to_desk';
                        } else {
                            av.state = 'ceo_wandering';
                            av.targetX = leftWall + Math.random() * (rightWall - leftWall);
                        }
                    }
                    if (Math.random() < 0.005 && this.bubbles.length < 5) {
                        this.spawnBubble(av, ["Looking good.", "The city is growing.", "Need to align the models."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                case 'ceo_leaving': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av);
                    const dxLeave = this.floors[numFloors - 1].elevatorX - av.cont.x;
                    if (Math.abs(dxLeave) < av.speed) {
                        av.cont.x = this.floors[numFloors - 1].elevatorX;
                        av.state = 'ceo_calling_down';
                    } else {
                        av.cont.x += Math.sign(dxLeave) * av.speed;
                        av.cont.scale.x = Math.sign(dxLeave);
                    }
                    break;
                }
                case 'ceo_calling_down': {
                    const cLiftDn = this.getLift(this.bld.id);
                    if (cLiftDn) { cLiftDn.call(numFloors - 1); av.state = 'ceo_waiting_down'; }
                    break;
                }
                case 'ceo_waiting_down': {
                    const wLiftDn = this.getLift(this.bld.id);
                    if (wLiftDn && wLiftDn.currentFloor === numFloors - 1 && wLiftDn.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_down';
                    }
                    break;
                }
                case 'ceo_delay_down': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_down';
                    break;
                }
                case 'ceo_riding_down': {
                    const rLiftDn = this.getLift(this.bld.id);
                    if (rLiftDn) {
                        av.cont.visible = false;
                        rLiftDn.call(-1);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftDn.car.y;
                        if (rLiftDn.currentFloor === -1 && rLiftDn.state === 'open') {
                            av.cont.y = this.totalH - 80 - 4;
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_car';
                            av.floorIdx = -1;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_car': {
                    this.animateWalk(av);
                    const dxCar = (this.startX + 180) - av.cont.x;
                    if (Math.abs(dxCar) < av.speed) {
                        av.cont.visible = false;
                        av.state = 'ceo_driving_out';
                        av._driveOutTick = 0;
                        if (this.ceoCarGfx) {
                            this.ceoCarGfx._origX = this.ceoCarGfx.x;
                            this.ceoCarGfx._origAlpha = this.ceoCarGfx.alpha;
                        }
                    } else {
                        av.cont.x += Math.sign(dxCar) * av.speed;
                        av.cont.scale.x = Math.sign(dxCar);
                    }
                    break;
                }
                case 'ceo_driving_out': {
                    av._driveOutTick++;
                    if (this.ceoCarGfx) {
                        const t = av._driveOutTick / 90;
                        this.ceoCarGfx.x = this.ceoCarGfx._origX + (t * t * 300);
                        this.ceoCarGfx.alpha = Math.max(0, 1 - t * 1.2);
                    }
                    if (av._driveOutTick >= 90) {
                        av.state = 'gone';
                        if (this.ceoCarGfx) {
                            this.ceoCarGfx.visible = false;
                            this.ceoCarGfx.x = this.ceoCarGfx._origX;
                            this.ceoCarGfx.alpha = this.ceoCarGfx._origAlpha || 1;
                        }
                        const ceoRef = G.ceoRefs[av.m.lab];
                        if (ceoRef) {
                            ceoRef.bld = null;
                            ceoRef.wantsToLeave = false;
                        }
                    }
                    break;
                }

                case 'entering_lobby': {
                    if (av.floorIdx === 0) {
                        this.animateWalk(av);
                        const dx = av.deskX - av.cont.x;
                        if (Math.abs(dx) < av.speed) {
                            av.cont.x = av.deskX;
                            const refs = G.charRefs[av.m.id];
                            if (refs) refs.wantsToEnter = false;
                            av.state = 'working';
                        } else {
                            av.cont.x += Math.sign(dx) * av.speed;
                            av.cont.scale.x = Math.sign(dx);
                        }
                    } else {
                        av.targetX = this.floors[0].elevatorX;
                        this.animateWalk(av);
                        const dx = av.targetX - av.cont.x;
                        if (Math.abs(dx) < av.speed) {
                            av.cont.x = av.targetX;
                            av.state = 'calling_lift_up';
                        } else {
                            av.cont.x += Math.sign(dx) * av.speed;
                            av.cont.scale.x = Math.sign(dx);
                        }
                    }
                    break;
                }
                case 'calling_lift_up': {
                    const lift = this.getLift(this.bld.id);
                    if (lift) { lift.call(0); av.state = 'waiting_lift_up'; }
                    break;
                }
                case 'waiting_lift_up': {
                    const lift = this.getLift(this.bld.id);
                    if (lift && lift.currentFloor === 0 && lift.state === 'open') {
                        av.timer = 20 + Math.random() * 20;
                        av.state = 'delay_enter_lift_up';
                    }
                    break;
                }
                case 'delay_enter_lift_up': {
                    av.timer--;
                    if (av.timer <= 0) av.state = 'riding_lift_up';
                    break;
                }
                case 'riding_lift_up': {
                    const lift = this.getLift(this.bld.id);
                    if (lift) {
                        av.cont.visible = false;
                        lift.call(av.floorIdx);
                        av.cont.y = (this.totalH - 80 - 4) + lift.car.y;
                        if (lift.currentFloor === av.floorIdx && lift.state === 'open') {
                            av.cont.y = av.floorY;
                            av.cont.visible = true;
                            av.state = 'walking_to_desk';
                        }
                    }
                    break;
                }
                case 'walking_to_desk': {
                    this.animateWalk(av);
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) {
                        av.cont.x = av.deskX;
                        const refs = G.charRefs[av.m.id];
                        if (refs) refs.wantsToEnter = false;
                        av.state = 'working';
                    } else {
                        av.cont.x += Math.sign(dx) * av.speed;
                        av.cont.scale.x = Math.sign(dx);
                    }
                    break;
                }

                // ─── CAMPING STATES ───
                case 'camping': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (!av.propGfx) {
                        av.propGfx = new PIXI.Graphics();
                        av.cont.addChild(av.propGfx);
                    }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x4a2e1a);
                    av.propGfx.moveTo(0, -10);
                    av.propGfx.lineTo(15, -5);
                    av.propGfx.lineStyle(0);
                    av.propGfx.beginFill(0xffffff);
                    av.propGfx.drawCircle(15, -5, 2);
                    av.propGfx.endFill();

                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Perfect marshmallow.", "Campfire vibes.", "Nature is optimal."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'fishing': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (!av.propGfx) {
                        av.propGfx = new PIXI.Graphics();
                        av.cont.addChild(av.propGfx);
                    }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x111111);
                    av.propGfx.moveTo(0, -15);
                    av.propGfx.lineTo(25, -25);
                    av.propGfx.lineStyle(0);
                    av.propGfx.lineStyle(0.5, 0xffffff, 0.5);
                    av.propGfx.moveTo(25, -25);
                    av.propGfx.lineTo(25, 10);
                    av.propGfx.lineStyle(0);

                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Got a bite!", "Fishing for data.", "So peaceful."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                case 'picnicking': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 8 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Great sandwich.", "Lovely weather.", "Pass the potato salad."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                // ─── SILICON WOODS: CEO RETREAT ACTIVITIES ───
                case 'sipping_whiskey': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = -1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.03 + i) * 0.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.beginFill(0xfbbf24, 0.6); av.propGfx.drawRect(6, -10, 4, 6); av.propGfx.endFill();
                    av.propGfx.beginFill(0xffffff, 0.3); av.propGfx.drawRect(6, -12, 4, 2); av.propGfx.endFill();

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Smooth.", "Peaty. Perfect.", "To AGI.", "Another round.", "Single malt only."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'putting': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    const pStroke = Math.sin(G.tick * 0.04 + i * 3);
                    av.cont.scale.x = 1;
                    av.head.y = -32 + 6 + Math.abs(pStroke) * 2;
                    av.body.y = -32 + 12 + 4 + Math.abs(pStroke);
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x94a3b8);
                    av.propGfx.moveTo(4, -8);
                    av.propGfx.lineTo(4 + pStroke * 10, 4);
                    av.propGfx.lineStyle(0);

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Under par.", "Fore!", "Hole in one.", "Nice lie.", "Needs more backspin."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'soaking_hottub': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY + 4;
                    av.cont.scale.x = Math.sign(Math.sin(i * 2.3)) || 1;
                    av.head.y = -32 + 14 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 20;
                    if (av.legL && av.legR) {
                        av.legL.visible = false;
                        av.legR.visible = false;
                    }

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Ahhh...", "This is the life.", "108°F, perfect.", "Should've IPO'd sooner.", "Pure bliss."][Math.floor(Math.random()*5)]);
                    }
                    break;
                }
                case 'stargazing_firepit': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = Math.sign(Math.sin(i)) || 1;
                    av.head.y = -32 + 8 + Math.sin(G.tick * 0.015 + i) * 1;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) {
                        av.legL.rotation = -0.3;
                        av.legR.rotation = -0.3;
                        av.legL.y = 2;
                        av.legR.y = 2;
                    }

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["See that star?", "The embers...", "When's the singularity?", "I can smell the pines.", "Compute under the stars."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 60));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                // ─── FRONTIER PINES: LAUNCH VIEWING ACTIVITIES ───
                case 'watching_telescope': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY - 4;
                    av.cont.scale.x = 1;
                    av.head.y = -32 + 6 + Math.sin(G.tick * 0.015 + i) * 0.5;
                    av.body.y = -32 + 12 + 6;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["I see the rocket!", "Tracking the trajectory.", "Starlink visible!", "Is that a satellite?", "Beautiful orbit."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.001) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 60));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'launch_picnic': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) {
                        av.legL.rotation = -0.3;
                        av.legR.rotation = -0.3;
                        av.legL.y = 2;
                        av.legR.y = 2;
                    }

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Great spot to watch!", "Pass the coffee.", "T-minus vibes.", "The countdown board says soon!", "Love launch days."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'scanning_sky': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY - 4;
                    av.head.y = -32 + 2 + Math.sin(G.tick * 0.01 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.005 + i)) || 1;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["There it goes!", "Max-Q!", "Booster separation!", "Look at that plume!", "Godspeed!"][Math.floor(Math.random()*5)]);
                    }
                    break;
                }
                case 'getting_snacks': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = -1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }

                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.beginFill(0x22d3ee, 0.6); av.propGfx.drawRect(6, -10, 4, 7); av.propGfx.endFill();

                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Hot cocoa time.", "Need more popcorn.", "Best snack stand.", "Fuel for the countdown."][Math.floor(Math.random()*4)]);
                    }
                    if (Math.random() < 0.001) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 100));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                case 'working': {
                    if (av.jobTheme === 'server_core') {
                        av.cont.x = av.deskX + Math.sin(G.tick * 0.02 + i) * 15;
                        av.cont.y = av.floorY;
                        av.cont.scale.x = Math.sign(Math.cos(G.tick * 0.02 + i)) || 1;
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.15) * 1.5;
                        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.15)) * 1.5;
                        if (av.legL && av.legR) {
                            av.legL.y = Math.sin(G.tick * 0.15) * 2;
                            av.legR.y = -Math.sin(G.tick * 0.15) * 2;
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["Temps stable.", "Coolant optimal.", "Checking nodes.", "Hardware healthy."][Math.floor(Math.random()*4)]);
                        }
                    } else if (av.jobTheme === 'zen_garden') {
                        av.cont.x = av.deskX;
                        av.cont.y = av.floorY;
                        av.cont.scale.x = 1;
                        av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                        av.body.y = -32 + 14;
                        if (av.legL && av.legR) {
                            av.legL.y = 0;
                            av.legR.y = 0;
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["...", "Clearing cache.", "Watching the gecko.", "Peace."][Math.floor(Math.random()*4)]);
                        }
                    } else if (av.jobTheme === 'arcade') {
                        av.cont.x = av.deskX;
                        av.cont.y = av.floorY;
                        av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                        av.head.y = -32 + 6 + Math.sin(G.tick * 0.1 + i) * 1.5;
                        av.body.y = -32 + 13 + Math.abs(Math.sin(G.tick * 0.1 + i)) * 1;
                        if (av.legL && av.legR) {
                            av.legL.y = 0;
                            av.legR.y = 0;
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["Leveling my starter...", "Match point.", "Decompressing.", "High score!"][Math.floor(Math.random()*4)]);
                        }
                    } else {
                        // Default 'general' (cubicle) workspace — avatar sits at their desk.
                        av.cont.x = av.deskX;
                        av.cont.y = av.floorY;
                        av.cont.scale.x = 1; // face the monitors to the right

                        if (av.isSeated) {
                            // Sit pose: body lower, legs folded back like CEO seated pose.
                            av.head.y = -32 + 6 + Math.sin(G.tick * 0.10 + i) * 1.2;
                            av.body.y = -32 + 14;
                            if (av.legL && av.legR) {
                                av.legL.rotation = -Math.PI / 2;
                                av.legR.rotation = -Math.PI / 2;
                                av.legL.y = -4;
                                av.legR.y = -4;
                            }
                        } else {
                            // Standing fallback for non-seat floors / leftover avatars.
                            av.head.y = -32 + 4 + Math.sin(G.tick * 0.15 + i) * 1.5;
                            av.body.y = -32 + 12 + 4 + (Math.sin(G.tick * 0.15 + i) * 1.5 * 0.5);
                            if (av.legL && av.legR) {
                                av.legL.rotation = 0;
                                av.legR.rotation = 0;
                                av.legL.y = 0;
                                av.legR.y = 0;
                            }
                        }

                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av);
                        }

                        // Scheduled break: every ~30–90s, get up and head somewhere fun
                        // (water cooler / canteen / collab pod / lounge nook). The
                        // nextBreakTick is set when the avatar is created and re-rolled
                        // each time they return from a break.
                        if (typeof av.nextBreakTick === 'number' && G.tick >= av.nextBreakTick) {
                            const props = this.floors[av.floorIdx] && this.floors[av.floorIdx].breakSpots;
                            av.targetX = (props && props.length > 0)
                                ? props[Math.floor(Math.random() * props.length)]
                                : leftWall + Math.random() * (rightWall - leftWall);
                            // Reset seated leg rotation BEFORE walking, otherwise legs
                            // remain folded sideways and the avatar moonwalks to coffee.
                            if (av.legL && av.legR) {
                                av.legL.rotation = 0;
                                av.legR.rotation = 0;
                                av.legL.y = 0;
                                av.legR.y = 0;
                            }
                            av.state = 'walking_to_prop';
                            av.nextBreakTick = G.tick + 9999999; // re-rolled in 'returning'
                        }
                    }
                    break;
                }

                case 'chatting': {
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.1 + i) * 1.5;
                    av.body.y = -32 + 12 + 4 + (Math.sin(G.tick * 0.1 + i) * 1.5 * 0.5);
                    if (av.legL && av.legR) {
                        av.legL.y = 0;
                        av.legR.y = 0;
                    }

                    if (Math.random() < 0.01 && this.bubbles.length < 15) {
                        const chats = ["Interesting.", "Hmm...", "Parameter count?", "Check my benchmarks."];
                        this.spawnBubble(av, chats[Math.floor(Math.random() * chats.length)]);
                    }

                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = av.resumeState || 'returning';
                        av.timer = 60;
                    }
                    break;
                }

                case 'resting': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) {
                        av.legL.y = 0;
                        av.legR.y = 0;
                    }
                    if (Math.random() < 0.001 && this.bubbles.length < 5) {
                        this.spawnBubble(av, ["Zzz...", "Legacy code...", "Deprecated."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }

                case 'collaborating': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.05 + i) * 15));
                    av.cont.y = av.floorY;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.2 + i) * 1.5;
                    av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 1.5;
                    if (av.legL && av.legR) {
                        av.legL.y = Math.sin(G.tick * 0.2 + i) * 2;
                        av.legR.y = -Math.sin(G.tick * 0.2 + i) * 2;
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Merging PR...", "Open weights!", "LGTM!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }

                case 'chilling': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) {
                        av.legL.y = 0;
                        av.legR.y = 0;
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Great coffee.", "Need more compute.", "Resting."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                case 'working_out': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 4;
                    av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 4;
                    if (av.legL && av.legR) {
                        av.legL.y = Math.sin(G.tick * 0.4 + i) * 3;
                        av.legR.y = -Math.sin(G.tick * 0.4 + i) * 3;
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Feel the burn!", "Optimizing...", "Heavy weights!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }

                case 'fighting': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.1 + i) * 30));
                    av.cont.y = av.floorY - Math.abs(Math.sin(G.tick * 0.3 + i)) * 10;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 4;
                    av.body.y = -32 + 12 + 4;
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Take that!", "My ELO!", "Dodge!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }

                case 'playing': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.03 + i) * 30));
                    let floatY = Math.sin(G.tick * 0.04 + i) * 20;
                    av.cont.y = av.floorY - 25 + floatY;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 12 + Math.sin(G.tick * 0.1 + i) * 2;
                    av.body.y = -32 + 18;
                    if (av.legL && av.legR) {
                        av.legL.y = 0;
                        av.legR.y = 0;
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Absorbing data...", "Epoch 1...", "Loss dropping..."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }

                case 'at_prop': {
                    // Standing at a break spot (water cooler, canteen, lounge, collab pod).
                    // Idle bob, occasional speech bubble, then head back.
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) {
                        av.legL.rotation = 0;
                        av.legR.rotation = 0;
                        av.legL.y = 0;
                        av.legR.y = 0;
                    }
                    if (Math.random() < 0.003 && this.bubbles.length < 10) {
                        const breakChats = [
                            "\u2615 Refilling.", "Brain reset.", "Quick stretch.",
                            "Need caffeine.", "Hot take incoming.", "Did you see the leaderboard?",
                            "Compute is up today.", "Back in five."
                        ];
                        this.spawnBubble(av, breakChats[Math.floor(Math.random() * breakChats.length)]);
                    }
                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = 'returning';
                        av.targetX = av.deskX;
                    }
                    break;
                }

                case 'walking_to_prop':
                case 'returning': {
                    this.animateWalk(av);
                    const distProp = av.targetX - av.cont.x;
                    if (Math.abs(distProp) < av.speed) {
                        av.cont.x = av.targetX;
                        if (av.state === 'walking_to_prop') {
                            av.state = 'at_prop';
                            av.timer = 150 + Math.random() * 200;
                            if (Math.random() > 0.5 && this.bld.id !== 'graveyard') {
                                this.spawnBubble(av, "\u2615 Refreshing.");
                            }
                        } else if (av.state === 'returning') {
                            av.state = this.bld.id === 'cafe' ? 'chilling' :
                                       this.bld.id === 'gym' ? 'working_out' :
                                       this.bld.id === 'arena' ? 'fighting' :
                                       this.bld.id === 'graveyard' ? 'resting' :
                                       (this.bld.id === 'open_square' || this.bld.id === 'os_hub') ? 'collaborating' :
                                       'working';
                            // Re-roll the next break: sit for another 30s\u201390s.
                            av.nextBreakTick = G.tick + 1800 + Math.floor(Math.random() * 3600);
                        }
                    } else {
                        av.cont.x += Math.sign(distProp) * av.speed;
                        av.cont.scale.x = Math.sign(distProp);
                    }
                    break;
                }

                case 'walking_to_elevator_down': {
                    if (av.floorIdx === 0) {
                        av.state = 'walking_out';
                        av.targetX = this.startX + (this.bld.id === 'forest_0' ? this.bldW / 2 : this.usableW / 2);
                    } else {
                        av.cont.rotation = 0;
                        this.animateWalk(av);
                        const distDown = av.targetX - av.cont.x;
                        if (Math.abs(distDown) < av.speed) {
                            av.cont.x = av.targetX;
                            av.state = 'calling_lift';
                            if (av.legL && av.legR) {
                                av.legL.y = 0;
                                av.legR.y = 0;
                            }
                        } else {
                            av.cont.x += Math.sign(distDown) * av.speed;
                            av.cont.scale.x = Math.sign(distDown);
                        }
                    }
                    break;
                }

                case 'calling_lift': {
                    const cLift = this.getLift(this.bld.id);
                    if (cLift) {
                        cLift.call(av.floorIdx);
                        av.state = 'waiting_lift';
                    }
                    break;
                }

                case 'waiting_lift': {
                    const wLift = this.getLift(this.bld.id);
                    if (wLift && wLift.currentFloor === av.floorIdx && wLift.state === 'open') {
                        av.timer = 20 + Math.random() * 20;
                        av.state = 'delay_enter_lift';
                    }
                    break;
                }

                case 'delay_enter_lift': {
                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = 'entering_lift';
                    }
                    break;
                }

                case 'entering_lift': {
                    const eLift = this.getLift(this.bld.id);
                    if (eLift) {
                        av.cont.visible = false;
                        eLift.call(0);
                        av.state = 'riding_lift';
                    }
                    break;
                }

                case 'riding_lift': {
                    const rLift = this.getLift(this.bld.id);
                    if (rLift) {
                        const groundFloorY = this.totalH - 80 - 4;
                        av.cont.y = groundFloorY + rLift.car.y;

                        if (rLift.currentFloor === 0 && rLift.state === 'open') {
                            av.state = 'walking_out';
                            av.cont.y = groundFloorY;
                            av.cont.visible = true;
                            av.targetX = this.startX + this.usableW / 2;
                        }
                    }
                    break;
                }

                case 'walking_out': {
                    this.animateWalk(av);
                    const outDist = av.targetX - av.cont.x;
                    if (Math.abs(outDist) < av.speed) {
                        av.state = 'gone';
                        av.cont.visible = false;

                        const refs = G.charRefs[av.m.id];
                        if (refs) {
                            refs.bld = null;
                            refs.wantsToLeave = false;
                            refs.c.x = G.bldById[this.bld.id].x + (G.bldById[this.bld.id].w / 2);
                            refs.c.visible = true;
                        }
                    } else {
                        av.cont.x += Math.sign(outDist) * av.speed;
                        av.cont.scale.x = Math.sign(outDist);
                    }
                    break;
                }
            }
        });
    }
};
