/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENTITIES LAYER (v16.4.0 - Dynamic Metro Pathing & Tracking)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Entities = {
    charLayer: null, carLayer: null, reflectionLayer: null, lightLayer: null, _headlightAlpha: 0,
    undergroundLayer: null, trainLayer: null,
    trainWest: null, trainEast: null, trainMid: null, trainDC: null, trainLongevity: null,
    dataCubes: [],
    heliRefs: {},

    init(layers) {
        this.charLayer = layers.charLayer;
        this.carLayer = layers.carLayer; 
        this.reflectionLayer = layers.reflectionLayer; 
        this.lightLayer = layers.lightLayer;
        this.undergroundLayer = layers.undergroundLayer;
        this.trainLayer = layers.trainLayer; 

        if (this.undergroundLayer && this.trainLayer) {
            const trains = EntitiesGfx.initMetro(this.undergroundLayer, this.charLayer, this.carLayer, this.trainLayer);
            this.trainWest = trains.trainWest;
            this.trainEast = trains.trainEast;
            this.trainMid = trains.trainMid;
            this.trainDC = trains.trainDC;
            this.trainLongevity = trains.trainLongevity;
            this.metroRiderCont = trains.riderCont;
            this.stationVisuals = trains.stationVisuals;
            this.bunkerGfx = trains.bunkerGfx;
            this.bunkerTxts = trains.bunkerTxts;
            this.lastCityW = typeof G !== 'undefined' ? G.cityW : 3400;
        }
        
        if (!G.ceoRefs) {
            G.ceoRefs = {};
            if (typeof REAL_FOUNDERS !== 'undefined') {
                const dp = G.getDayPhase();
                const night = dp > .83 || dp < .25;
                // On init, place CEOs based on current time:
                // Weekday work hours → HQ, otherwise → home
                const dayOfWeek = new Date().getDay();
                const isWeekendNow = dayOfWeek === 0 || dayOfWeek === 6;
                const atWork = !isWeekendNow && !night && dp >= 0.33 && dp <= 0.80;

                REAL_FOUNDERS.forEach(f => {
                    const ceoObj = EntitiesGfx.initCEO(f, this.carLayer, this.reflectionLayer);
                    
                    const hq = (G.bldsByLab[f.lab] || []).find(b => !b.id.startsWith('house_'));
                    const home = G.bldById['house_' + f.lab]; 
                    let destBld = atWork ? hq : home;

                    if (destBld) {
                        ceoObj.bld = destBld.id;
                        ceoObj.logicalX = destBld.x + destBld.w / 2;
                        ceoObj.carCont.visible = false;
                        ceoObj.refCont.visible = false;
                    }

                    G.ceoRefs[f.lab] = ceoObj;
                });
            }
        }
        
        // ─── HELICOPTERS: One per CEO, hidden until weekend Silicon Woods trips ───
        if (!this.heliRefs || Object.keys(this.heliRefs).length === 0) {
            this.heliRefs = {};
            if (typeof REAL_FOUNDERS !== 'undefined') {
                REAL_FOUNDERS.forEach(f => {
                    const heli = EntitiesGfx.initHelicopter(f, this.carLayer);
                    const home = G.bldById['house_' + f.lab];
                    if (home) {
                        heli.homeX = home.x + home.w / 2;
                        heli.homeY = G.groundY - 220;
                    }
                    this.heliRefs[f.lab] = heli;
                });
            }
        }
    },

    updateTrain() {
        const mResX = G.bldById['metro_res'] ? G.bldById['metro_res'].x + (G.bldById['metro_res'].w / 2) : 1350;
        const mHqX = G.bldById['metro_hq'] ? G.bldById['metro_hq'].x + (G.bldById['metro_hq'].w / 2) : 4700;
        const mEastX = G.bldById['metro_east'] ? G.bldById['metro_east'].x + (G.bldById['metro_east'].w / 2) : 7000;
        const mDcX = G.bldById['metro_dc'] ? G.bldById['metro_dc'].x + (G.bldById['metro_dc'].w / 2) : null;
        const mMidX = G.bldById['metro_mid'] ? G.bldById['metro_mid'].x + (G.bldById['metro_mid'].w / 2) : null;
        const mLongX = G.bldById['metro_longevity'] ? G.bldById['metro_longevity'].x + (G.bldById['metro_longevity'].w / 2) : null;

        // 1. Shift all station graphics to follow dynamically moving buildings
        if (this.stationVisuals) {
            this.stationVisuals.forEach(sv => {
                if (sv && sv.statCont && sv._bldId) {
                    const bld = G.bldById[sv._bldId];
                    if (bld) {
                        const cx = bld.x + bld.w / 2;
                        sv.statCont.x = cx;
                        sv.backCutout.x = cx;
                        sv.glassFront.x = cx;
                    }
                }
            });
        }

        // 2. Redraw silos if the city width updates (HQs expanding/pushing houses)
        if (G.cityW !== this.lastCityW) {
            this.lastCityW = G.cityW;
            if (this.bunkerGfx && this.bunkerTxts) {
                EntitiesGfx.drawBunkers(this.bunkerGfx, this.charLayer, this.bunkerTxts);
            }
        }

        // 3. Update the Train Routes to accurately connect to the new coordinates
        if (this.trainWest) {
            this.trainWest.st1 = mResX;
            this.trainWest.st2 = mHqX;
            if (this.trainWest.state === 'waiting') {
                if (Math.abs(this.trainWest.x - this.trainWest.st1) < 100) this.trainWest.x = this.trainWest.st1;
                else if (Math.abs(this.trainWest.x - this.trainWest.st2) < 100) this.trainWest.x = this.trainWest.st2;
                this.trainWest.c.x = this.trainWest.x;
            }
        }

        if (this.trainEast) {
            this.trainEast.st1 = mHqX;
            this.trainEast.st2 = mMidX || mEastX;
            if (this.trainEast.state === 'waiting') {
                if (Math.abs(this.trainEast.x - this.trainEast.st1) < 100) this.trainEast.x = this.trainEast.st1;
                else if (Math.abs(this.trainEast.x - this.trainEast.st2) < 100) this.trainEast.x = this.trainEast.st2;
                this.trainEast.c.x = this.trainEast.x;
            }
        }

        if (this.trainMid && mMidX) {
            this.trainMid.st1 = mMidX;
            this.trainMid.st2 = mEastX;
            if (this.trainMid.state === 'waiting') {
                if (Math.abs(this.trainMid.x - this.trainMid.st1) < 100) this.trainMid.x = this.trainMid.st1;
                else if (Math.abs(this.trainMid.x - this.trainMid.st2) < 100) this.trainMid.x = this.trainMid.st2;
                this.trainMid.c.x = this.trainMid.x;
            }
        }

        if (this.trainDC && mDcX) {
            this.trainDC.st1 = mDcX;
            this.trainDC.st2 = mResX;
            if (this.trainDC.state === 'waiting') {
                if (Math.abs(this.trainDC.x - this.trainDC.st1) < 100) this.trainDC.x = this.trainDC.st1;
                else if (Math.abs(this.trainDC.x - this.trainDC.st2) < 100) this.trainDC.x = this.trainDC.st2;
                this.trainDC.c.x = this.trainDC.x;
            }
        }

        if (this.trainLongevity && mLongX) {
            this.trainLongevity.st1 = mEastX;
            this.trainLongevity.st2 = mLongX;
            if (this.trainLongevity.state === 'waiting') {
                if (Math.abs(this.trainLongevity.x - this.trainLongevity.st1) < 100) this.trainLongevity.x = this.trainLongevity.st1;
                else if (Math.abs(this.trainLongevity.x - this.trainLongevity.st2) < 100) this.trainLongevity.x = this.trainLongevity.st2;
                this.trainLongevity.c.x = this.trainLongevity.x;
            }
        }

        // 4. Standard Train Logic Loop
        [this.trainWest, this.trainEast, this.trainMid, this.trainDC, this.trainLongevity].forEach(t => {
            if (!t) return;
            if (t.state === 'waiting') {
                t.timer--;
                if (t.timer <= 0) {
                    t.state = 'moving';
                    G._trainsDeparted++; if (G._trainsDeparted >= 10) G.unlockAchieve('train_spotter');
                    t.targetX = (t.x === t.st1) ? t.st2 : t.st1;
                    t.dir = Math.sign(t.targetX - t.x);
                    
                    t.lightL.clear(); t.lightR.clear();
                    if (t.dir > 0) {
                        t.lightL.beginFill(0xef4444); t.lightL.drawCircle(-175, 0, 4); t.lightL.endFill();
                        t.lightR.beginFill(0x4ade80); t.lightR.drawCircle(175, 0, 4); t.lightR.endFill();
                    } else {
                        t.lightL.beginFill(0x4ade80); t.lightL.drawCircle(-175, 0, 4); t.lightL.endFill();
                        t.lightR.beginFill(0xef4444); t.lightR.drawCircle(175, 0, 4); t.lightR.endFill();
                    }
                }
            } else if (t.state === 'moving') {
                t.x += t.speed * t.dir;
                t.c.x = t.x;
                t.c.y = t.y + Math.sin(G.tick * 0.5) * 1.5;
                
                if (Math.abs(t.x - t.targetX) < t.speed) {
                    t.x = t.targetX;
                    t.c.x = t.x;
                    t.c.y = t.y; 
                    t.state = 'waiting';
                    t.timer = 180; 
                }
            }
            t.front.x = t.c.x;
            t.front.y = t.c.y;
        });
    },

    createChar(m) {
        EntitiesGfx.createChar(m, this.charLayer);
    },

    spawnCar() {
        if (G.cars.some(c => c.isTruck)) return;
        // Route truck between meaningful Nvidia locations: Port → Nvidia FAB/DC → Nvidia HQ (or reverse)
        let portBld = null, nvFab = null, nvHQ = null;
        if (typeof BLDS !== 'undefined') {
            portBld = BLDS.find(b => b.id === 'port_warehouse' || b.id.startsWith('port_'));
            nvFab = BLDS.find(b => b.id === 'fab_nvidia_design');
            nvHQ = BLDS.find(b => b.lab === 'nvidia' && !b.id.startsWith('fab_') && !b.id.startsWith('dc_'));
        }
        // Build waypoints array (x positions to stop at)
        const stops = [];
        if (portBld) stops.push(portBld.x + (portBld.w || 100) / 2);
        if (nvFab) stops.push(nvFab.x + (nvFab.w || 100) / 2);
        if (nvHQ) stops.push(nvHQ.x + (nvHQ.w || 100) / 2);
        // If we found stops, pick a direction that makes sense; otherwise random
        let dir;
        if (stops.length >= 2) {
            dir = Math.random() > 0.5 ? 1 : -1;
            stops.sort((a, b) => dir > 0 ? a - b : b - a);
        } else {
            dir = Math.random() > 0.5 ? 1 : -1;
        }
        const carObj = EntitiesGfx.spawnCar(this.carLayer, this.reflectionLayer, dir);
        carObj._stops = stops.length >= 2 ? stops : null;
        carObj._stopIdx = 0;
        carObj._waitTimer = 0;
        carObj._delivering = stops.length >= 2;
        G.cars.push(carObj);
    },

    updateChatBubbles(dp) {
      if (G.tick % 150 !== 0) return;
      const maxBubbles = Math.min(15, Math.floor(G.models.length / 3)); let count = Object.keys(G.chatBubbles).length;
      G.models.forEach((m, i) => {
        if (count >= maxBubbles) return; if (G.chatBubbles[m.id] || Math.random() > 0.12) return;
        
        const refs = G.charRefs[m.id];
        if (refs && refs._streetState === 'chatting') return;

        const stg = getStage(m.rel, m.ret, m.phase); 
        const { act } = getAct(stg, dp, i, m); 
        
        const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : { indoor: true }; 
        if (!ai || ai.indoor) return; 
        
        // Citizen of the Day: ~50% of chat picks are "press" lines so the
        // spotlight feels harassed by the paparazzi entourage trailing them.
        const isCotd = (typeof CitizenOfDay !== 'undefined' && CitizenOfDay.isCotd && CitizenOfDay.isCotd(m.id));
        const pool = (isCotd && CHAT_MSGS && CHAT_MSGS.press && Math.random() < 0.5)
            ? CHAT_MSGS.press
            : ((CHAT_MSGS && CHAT_MSGS[act]) ? CHAT_MSGS[act] : (CHAT_MSGS ? CHAT_MSGS.work : ['...']));

        // Occasionally inject personalized messages using model's actual data
        let msg;
        // Seasonal/conference chat override (20% chance)
        if (Math.random() < 0.20) {
            if (typeof Seasonal !== 'undefined') { const sc = Seasonal.getSeasonalChat(); if (sc) { msg = sc; } }
            if (!msg && typeof ConferenceData !== 'undefined' && ConferenceData.isActive()) { msg = ConferenceData.getConferenceChat(); }
            if (!msg && typeof CourtData !== 'undefined' && CourtData.isModelSummoned(m.id)) { msg = CourtData.CHAT_MSGS[Math.floor(Math.random() * CourtData.CHAT_MSGS.length)]; }
        }
        const personalRoll = Math.random();
        // Goal-driven archetype quip (25% chance for archetype-tagged NPCs, null for others)
        if (!msg && typeof Goals !== 'undefined' && personalRoll < 0.25) {
            const goalMsg = Goals.getGoalChat(m);
            if (goalMsg) msg = goalMsg;
        }
        if (msg) { /* seasonal/conference/goal override already set */ }
        else if (personalRoll < 0.15 && m.name) {
            // Name-based quip
            const nameQuips = [
                `I'm ${m.name.split(' ')[0]}. Ask me anything.`,
                `${m.name} at your service.`,
                `They call me ${m.name.split(' ')[0]}.`
            ];
            msg = nameQuips[Math.floor(Math.random() * nameQuips.length)];
        } else if (personalRoll < 0.25 && BM[m.id]) {
            // Real benchmark flex
            const bm = BM[m.id];
            if (bm.ELO) msg = `ELO: ${bm.ELO} 💪`;
            else if (bm.MMLU) msg = `MMLU: ${bm.MMLU}% 📊`;
            else if (bm.HumanEval) msg = `HumanEval: ${bm.HumanEval}% ✓`;
            else msg = pool[Math.floor(Math.random() * pool.length)];
        } else if (personalRoll < 0.32 && act === 'arena') {
            // Arena trash talk referencing a rival lab
            const myLab = m.lab;
            const rivals = Object.keys(LABS).filter(l => l !== myLab);
            if (rivals.length > 0) {
                const rival = LABS[rivals[Math.floor(Math.random() * rivals.length)]];
                const trash = [
                    `${rival.name}? cute model.`,
                    `outscored ${rival.name} again`,
                    `${rival.name} wishes they had my weights`,
                    `ELO diff vs ${rival.name}: massive`
                ];
                msg = trash[Math.floor(Math.random() * trash.length)];
            } else {
                msg = pool[Math.floor(Math.random() * pool.length)];
            }
        } else if (typeof Personality !== 'undefined') {
            // Personality-flavoured chat (30% chance from trait system)
            msg = Personality.getTraitChat(m) || pool[Math.floor(Math.random() * pool.length)];
        } else {
            msg = pool[Math.floor(Math.random() * pool.length)];
        }

        const lifespan = 240 + Math.random() * 240;
        G.chatBubbles[m.id] = { msg: msg, expire: G.tick + lifespan }; count++;
      });
    },

    update(dp, night) {
      // Headlight alpha — on at night or during rain/snow, off otherwise
      // Headlights trigger for any precipitation that darkens the sky (rain, drizzle, storm, snow, thick fog).
      const badWeather = typeof Environment !== 'undefined' && (
        Environment.isRainy?.() || Environment.weather === 'snow' ||
        Environment.weather === 'overcast' || Environment.weather === 'fog'
      );
      const headlightTarget = night ? 1 : (badWeather ? 0.5 : 0);
      this._headlightAlpha += (headlightTarget - this._headlightAlpha) * 0.05;

      // Port zone bounds — cached (only changes on city rebuild)
      if (!this._portBoundsCache || this._portBoundsCity !== G.cityW) {
          const pb = BLDS ? BLDS.filter(b => b.id.startsWith('port_')) : [];
          this._portMinX = pb.length ? pb.reduce((m, b) => Math.min(m, b.x), Infinity) - 80 : -9999;
          this._portMaxX = pb.length ? pb.reduce((m, b) => Math.max(m, b.x + b.w), 0) + 40 : -9999;
          this._portBoundsCache = true;
          this._portBoundsCity = G.cityW;
      }
      const portMinX = this._portMinX;
      const portMaxX = this._portMaxX;
      if (this.updateTrain) this.updateTrain(); 

      // Cache weekend check once per update (used by both CEO and model loops)
      if (!this._weekendCache || G.tick % 3600 === 0) {
          const d = new Date().getDay();
          this._isWeekendVal = d === 0 || d === 6;
          this._weekendCache = true;
      }
      const _isWeekend = this._isWeekendVal;

      if (G.ceoRefs) {
          // CEO Schedule — More dynamic than AI models.
          // They pop in/out of HQ during the day, drive around, grab meals at home.
          // Must be at HQ toward end of shift. Weekends: home or cruising.
          const block = Math.floor(dp * 48); // 30-min blocks for finer granularity
          
          Object.values(G.ceoRefs).forEach(ceo => {
              const hq = (G.bldsByLab[ceo.f.lab] || []).find(b => !b.id.startsWith('house_'));
              const home = G.bldById['house_' + ceo.f.lab]; 
              
              if (!hq) return;

              // ─── If CEO is in a helicopter, freeze all ground-level decisions ───
              if (ceo._inHeli) {
                  ceo.carCont.visible = false;
                  ceo.refCont.visible = false;
                  return; // Helicopter loop handles everything
              }

              // Per-CEO deterministic seed so they don't all move in lockstep
              const ceoSeed = Array.from(ceo.f.lab).reduce((a, c) => a + c.charCodeAt(0), 0);
              const blockHash = Math.abs(Math.sin(ceoSeed * 7.3 + block * 13.7)) * 100;

              let destBld;
              let useHeli = false; // Flag: this CEO should fly to Silicon Woods

              if (_isWeekend) {
                  const siliconWoods = G.bldById['forest_1'];
                  if (dp < 0.30 || dp > 0.90) {
                      destBld = home; // sleeping
                  } else if (blockHash < 25 && siliconWoods) {
                      destBld = siliconWoods; // fly to Silicon Woods!
                      useHeli = true;
                  } else if (blockHash < 40) {
                      destBld = null; // out for a drive
                  } else {
                      destBld = home; // relaxing at home
                  }
              } else if (night) {
                  destBld = home; // night → go home to sleep
              } else if (dp < 0.30) {
                  // Early morning — still at home, getting ready
                  destBld = home;
              } else if (dp >= 0.30 && dp < 0.42) {
                  // Morning arrival — head to HQ
                  destBld = hq;
              } else if (dp >= 0.42 && dp < 0.55) {
                  // Late morning / lunch — some pop out for a meal at home
                  if (blockHash < 25) destBld = home;
                  else if (blockHash < 35) destBld = null; // quick drive
                  else destBld = hq;
              } else if (dp >= 0.55 && dp < 0.70) {
                  // Core afternoon — mostly at HQ, occasional errand
                  if (blockHash < 15) destBld = null; // quick drive
                  else destBld = hq;
              } else if (dp >= 0.70 && dp < 0.82) {
                  // End of shift — must be at HQ wrapping up
                  destBld = hq;
              } else {
                  // Evening departure → head home
                  destBld = home;
              }

              let targetX = destBld ? (destBld.x + destBld.w / 2) : (ceo.dir > 0 ? G.cityW + 600 : -600);
              
              // Track helicopter trip state across frames
              if (useHeli && destBld && destBld.id === 'forest_1') {
                  ceo._heliTrip = true;
              } else if (!useHeli || !destBld || destBld.id !== 'forest_1') {
                  ceo._heliTrip = false;
              }

              if (ceo.bld !== null && (!destBld || ceo.bld !== destBld.id)) {
                  ceo.wantsToLeave = true;
                  ceo.wantsToEnter = false;
                  
                  if (!G.activeInterior || G.activeInterior !== ceo.bld) {
                      const oldBld = G.bldById[ceo.bld];
                      if (oldBld) ceo.logicalX = oldBld.x + oldBld.w / 2;
                      ceo.bld = null;
                      ceo.wantsToLeave = false;
                  }
              } 
              else if (ceo.bld === null) {
                  if (destBld && ceo._heliTrip) {
                      // Helicopter handles travel — hide the car, the heli update loop moves the CEO
                      ceo.carCont.visible = false;
                      ceo.refCont.visible = false;
                      
                      const heli = Entities.heliRefs[ceo.f.lab];
                      if (heli && heli.state === 'grounded' && destBld.id === 'forest_1') {
                          // Helicopter has landed — CEO enters the woods
                          ceo.wantsToEnter = true;
                          ceo.bld = destBld.id;
                          ceo.logicalX = targetX;
                      }
                  } else if (destBld) {
                      ceo.carCont.visible = true;
                      ceo.refCont.visible = true;
                      ceo.dir = Math.sign(targetX - ceo.logicalX) || 1;
                      ceo.logicalX += ceo.dir * ceo.speed;

                      if (Math.abs(ceo.logicalX - targetX) < 15) {
                          ceo.wantsToEnter = true;
                          ceo.bld = destBld.id;
                          ceo.carCont.visible = false;
                          ceo.refCont.visible = false;
                      }
                  } 
                  else {
                      ceo.carCont.visible = true;
                      ceo.refCont.visible = true;
                      ceo.dir = Math.sign(targetX - ceo.logicalX) || ceo.dir;
                      ceo.logicalX += ceo.dir * ceo.speed;
                      
                      if (ceo.logicalX < -500 || ceo.logicalX > G.cityW + 500) {
                          ceo.carCont.visible = false;
                          ceo.refCont.visible = false;
                      }
                  }
              }

              // CEO car is NEVER visible while their helicopter is active
              const ceoHeli = Entities.heliRefs ? Entities.heliRefs[ceo.f.lab] : null;
              if (ceoHeli && ceoHeli.state !== 'hidden') {
                  ceo.carCont.visible = false;
                  ceo.refCont.visible = false;
              }

              // Hide CEO car in port/ocean zone
              const ceoInPort = ceo.logicalX > portMinX && ceo.logicalX < portMaxX;
              if (ceoInPort) { ceo.carCont.visible = false; ceo.refCont.visible = false; }
              if (ceo.carCont.visible) {
                  const laneY = ceo.dir > 0 ? 26 : 12;
                  ceo.carCont.x = ceo.logicalX;
                  ceo.carCont.y = G.groundY + laneY;
                  ceo.carCont.scale.x = ceo.dir;
                  ceo.carCont.zIndex = Math.round(ceo.carCont.y);
                  
                  ceo.refCont.x = ceo.logicalX;
                  ceo.refCont.y = ceo.carCont.y;
                  ceo.refCont.scale.x = ceo.dir;
                  ceo.refCont.scale.y = -1;

                  ceo.beam.alpha = this._headlightAlpha;
              }
          });
      }

      // ─── HELICOPTER UPDATE LOOP ───
      if (this.heliRefs) {
          const siliconWoods = G.bldById['forest_1'];
          const helipadX = siliconWoods ? siliconWoods.x + siliconWoods.w / 2 : 0;
          const swH = siliconWoods ? ((siliconWoods.dynamicFl || siliconWoods.fl || 1) * 18 + 24) : 42;
          const helipadY = G.groundY - 24 - swH + 6; // land inside the forest canopy, not on the street
          
          Object.entries(this.heliRefs).forEach(([lab, heli]) => {
              const ceo = G.ceoRefs ? G.ceoRefs[lab] : null;
              if (!ceo) return;
              
              // Rotor spin animation (always when visible)
              if (heli.cont.visible && heli.rotor) {
                  heli.rotor.rotation += (heli.state === 'grounded' ? 0.05 : 0.4);
                  heli.rotorBlur.visible = heli.state !== 'grounded';
              }
              
              // Shadow management
              if (!heli._shadow) {
                  heli._shadow = new PIXI.Graphics();
                  heli._shadow.beginFill(0x000000, 0.15);
                  heli._shadow.drawEllipse(0, 0, 20, 6);
                  heli._shadow.endFill();
                  heli._shadow.visible = false;
                  if (this.carLayer) this.carLayer.addChild(heli._shadow);
              }
              
              // Update shadow position for all flying states
              const isFlying = heli.state === 'flying_to' || heli.state === 'flying_home' || heli.state === 'scenic_flight' || heli.state === 'flying_to_hq';
              if (isFlying && heli.cont.visible) {
                  heli._shadow.visible = true;
                  heli._shadow.x = heli.cont.x;
                  heli._shadow.y = G.groundY + 4;
                  // Shadow size scales with altitude
                  const alt = G.groundY - heli.cont.y;
                  const sc = Math.max(0.5, Math.min(2.0, alt / 60));
                  heli._shadow.scale.set(sc, sc);
                  heli._shadow.alpha = Math.max(0.05, 0.2 - alt * 0.001);
              } else {
                  heli._shadow.visible = false;
              }
              
              switch (heli.state) {
                  case 'hidden':
                      heli.cont.visible = false;
                      // Regular trip: CEO wants to go to Silicon Woods
                      if (ceo._heliTrip && ceo.bld === null && siliconWoods) {
                          const home = G.bldById['house_' + lab];
                          heli.logicalX = home ? home.x + home.w / 2 : ceo.logicalX;
                          heli.logicalY = G.groundY - 220;
                          heli.targetX = helipadX;
                          heli.targetY = helipadY;
                          heli.state = 'flying_to';
                          heli.cont.visible = true;
                          heli.cont.x = heli.logicalX;
                          heli.cont.y = heli.logicalY;
                          ceo._inHeli = true;
                          ceo.carCont.visible = false;
                          ceo.refCont.visible = false;
                      }
                      // Scenic flyover OR heli-to-HQ OR space visit: only when CEO is inside a building
                      // and it's daytime — no chopper sorties at 3am, even for an imminent launch.
                      else if (!ceo._heliTrip && !heli._scenicCooldown && ceo.bld !== null && dp > 0.30 && dp < 0.85) {
                          // ─── SPACE VISIT: CEO flies to space zone for imminent launches ───
                          const CEO_SPACE_MAP = { xai: 'spacex', amazon: 'blue_origin' };
                          const spaceOrg = CEO_SPACE_MAP[lab];
                          let spaceTrip = false;

                          if (spaceOrg && typeof SpaceData !== 'undefined' && SpaceData.launches) {
                              const now = Date.now();
                              const imminent = SpaceData.launches.find(l => {
                                  const org = SpaceData.getOrgForProvider(l.provider);
                                  return org === spaceOrg && new Date(l.net).getTime() - now < 7200000 && new Date(l.net).getTime() - now > 0;
                              });
                              // Reset visit flag when no launch is imminent (so CEO can visit next launch)
                              if (!imminent && heli._spaceVisitDone) heli._spaceVisitDone = false;
                              if (imminent && !heli._spaceVisitDone) {
                                  // Fly to mission control in the space zone
                                  const mcBld = G.bldById['mission_control'];
                                  if (mcBld) {
                                      const oldBld = G.bldById[ceo.bld];
                                      const startX = oldBld ? oldBld.x + oldBld.w / 2 : ceo.logicalX;
                                      ceo.bld = null;
                                      ceo.wantsToLeave = false;
                                      ceo.wantsToEnter = false;
                                      ceo._inHeli = true;
                                      ceo.carCont.visible = false;
                                      ceo.refCont.visible = false;
                                      
                                      heli.logicalX = startX;
                                      heli.logicalY = G.groundY - 240;
                                      const mcH = ((mcBld.dynamicFl || mcBld.fl || 3) * 18 + 24);
                                      heli.targetX = mcBld.x + mcBld.w / 2;
                                      heli.targetY = G.groundY - 24 - mcH;
                                      heli._landingBld = mcBld;
                                      heli.state = 'flying_to_hq';
                                      heli.cont.visible = true;
                                      heli.cont.x = heli.logicalX;
                                      heli.cont.y = heli.logicalY;
                                      heli._spaceVisitDone = true;
                                      spaceTrip = true;
                                      
                                      if (typeof UI !== 'undefined') UI.addToast(`🚁 ${ceo.f.name} is heading to Mission Control for an upcoming ${SPACE_ORGS[spaceOrg].name} launch!`);
                                  }
                              }
                          }
                          
                          // ─── SCENIC FLYOVER / HQ COMMUTE ───
                          if (!spaceTrip && Math.random() < 0.002 && dp > 0.3 && dp < 0.8) {
                              // Pull CEO out of current building
                              const oldBld = G.bldById[ceo.bld];
                              const startX = oldBld ? oldBld.x + oldBld.w / 2 : ceo.logicalX;
                              ceo.bld = null;
                              ceo.wantsToLeave = false;
                              ceo.wantsToEnter = false;
                              ceo._inHeli = true;
                              ceo.carCont.visible = false;
                              ceo.refCont.visible = false;
                              
                              heli.logicalX = startX;
                              heli.logicalY = G.groundY - 240;
                              heli.cont.visible = true;
                              heli.cont.x = heli.logicalX;
                              heli.cont.y = heli.logicalY;
                              
                              // 60% chance: fly to HQ rooftop helipad, 40%: scenic tour
                              const hqBld = (G.bldsByLab[lab] || []).find(b2 => !b2.id.startsWith('house_'));
                              if (Math.random() < 0.6 && hqBld && oldBld && oldBld.id !== hqBld.id) {
                                  // Helicopter commute to HQ rooftop helipad
                                  const hqH = ((hqBld.dynamicFl || hqBld.fl || 3) * 18 + 24);
                                  heli.targetX = hqBld.x + hqBld.w - 35; // align with helipad X (w-35 from env rendering)
                                  heli.targetY = G.groundY - 24 - hqH; // rooftop world Y
                                  heli._landingBld = hqBld;
                                  heli.state = 'flying_to_hq';
                              } else {
                                  // Scenic flyover
                                  heli.targetX = Math.random() > 0.5 ? 100 : G.cityW - 100;
                                  heli.targetY = heli.logicalY + (Math.random() - 0.5) * 40;
                                  heli._scenicReturnX = startX;
                                  heli.state = 'scenic_flight';
                              }
                              
                              heli._scenicCooldown = true;
                              setTimeout(() => { heli._scenicCooldown = false; }, (60 + Math.random() * 60) * 1000);
                          }
                      }
                      break;
                      
                  case 'scenic_flight': {
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      const scenicSpeed = heli.speed * 0.6;
                      
                      if (dist < scenicSpeed) {
                          heli.targetX = heli._scenicReturnX || heli.homeX;
                          heli.targetY = G.groundY - 220;
                          heli.logicalY = heli.cont.y;
                          heli.state = 'flying_home';
                      } else {
                          heli.logicalX += (dx / dist) * scenicSpeed;
                          heli.logicalY += (dy / dist) * scenicSpeed;
                          heli.logicalY += Math.sin(G.tick * 0.015) * 0.3;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.06) * 4;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
                  
                  case 'flying_to_hq': {
                      // Flying to HQ rooftop helipad
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      
                      if (dist < heli.speed) {
                          heli.logicalX = heli.targetX;
                          heli.logicalY = heli.targetY;
                          heli.state = 'landing_hq';
                          heli.timer = 60;
                      } else {
                          heli.logicalX += (dx / dist) * heli.speed;
                          heli.logicalY += (dy / dist) * heli.speed;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.08) * 3;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
                  
                  case 'landing_hq':
                      heli.timer--;
                      heli.cont.y = heli.logicalY + (60 - heli.timer) * 0.15;
                      if (heli.timer <= 0) {
                          // CEO enters HQ from rooftop
                          const hqBld = heli._landingBld;
                          if (hqBld && ceo) {
                              ceo._inHeli = false;
                              ceo.bld = hqBld.id;
                              ceo.wantsToEnter = true;
                              ceo.logicalX = hqBld.x + hqBld.w / 2;
                          }
                          heli.state = 'parked_hq';
                          heli.timer = 300 + Math.random() * 600; // Park 5-15 seconds
                      }
                      break;
                      
                  case 'parked_hq':
                      heli.timer--;
                      if (heli.timer <= 0) {
                          // Take off and fly home empty
                          heli.state = 'takeoff';
                          heli.timer = 60;
                          heli.logicalX = heli.cont.x;
                          heli.logicalY = heli.cont.y;
                      }
                      break;
                      
                  case 'flying_to': {
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      
                      if (dist < heli.speed) {
                          heli.logicalX = heli.targetX;
                          heli.logicalY = heli.targetY;
                          heli.state = 'landing';
                          heli.timer = 60;
                      } else {
                          heli.logicalX += (dx / dist) * heli.speed;
                          heli.logicalY += (dy / dist) * heli.speed;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.08) * 3;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
                  
                  case 'landing':
                      heli.timer--;
                      // Gentle descent
                      heli.cont.y = heli.logicalY + (60 - heli.timer) * 0.3;
                      if (heli.timer <= 0) {
                          heli.state = 'grounded';
                          // Helicopter disappears inside Silicon Woods (lands on interior helipad)
                          heli.cont.visible = false;
                          heli.cont.x = helipadX;
                          heli.cont.y = helipadY + 18;
                          // Clear _inHeli so CEO schedule can enter Silicon Woods
                          if (ceo) ceo._inHeli = false;
                      }
                      break;

                  case 'grounded':
                      // Helicopter is parked INSIDE Silicon Woods — hidden from street view
                      heli.cont.visible = false;
                      heli.logicalX = helipadX;
                      heli.logicalY = helipadY + 18;
                      // Wait for CEO to leave Silicon Woods
                      if (!ceo._heliTrip || ceo.bld !== 'forest_1') {
                          heli.state = 'takeoff';
                          heli.timer = 60;
                          heli.logicalX = helipadX;
                          heli.logicalY = helipadY + 18;
                          // Helicopter reappears as it lifts off
                          heli.cont.visible = true;
                          heli.cont.x = helipadX;
                          heli.cont.y = helipadY + 18;
                      }
                      break;
                      
                  case 'takeoff':
                      heli.timer--;
                      heli.cont.y = heli.logicalY - (60 - heli.timer) * 0.5;
                      if (heli.timer <= 0) {
                          const home = G.bldById['house_' + lab];
                          heli.targetX = home ? home.x + home.w / 2 : heli.homeX;
                          heli.targetY = G.groundY - 220;
                          heli.logicalY = heli.cont.y;
                          heli.state = 'flying_home';
                      }
                      break;
                      
                  case 'flying_home': {
                      heli.cont.visible = true;
                      const dx = heli.targetX - heli.logicalX;
                      const dy = heli.targetY - heli.logicalY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      
                      if (dist < heli.speed) {
                          heli.state = 'hidden';
                          heli.cont.visible = false;
                          // Return CEO to ground — place them at home if they were on a scenic/heli trip
                          if (ceo && ceo._inHeli) {
                              ceo._inHeli = false;
                              const home = G.bldById['house_' + lab];
                              if (home) {
                                  ceo.logicalX = home.x + home.w / 2;
                                  ceo.bld = home.id;
                                  ceo.wantsToEnter = true;
                              }
                          }
                      } else {
                          heli.logicalX += (dx / dist) * heli.speed;
                          heli.logicalY += (dy / dist) * heli.speed;
                      }
                      
                      heli.cont.x = heli.logicalX;
                      heli.cont.y = heli.logicalY + Math.sin(G.tick * 0.08) * 3;
                      heli.cont.scale.x = dx > 0 ? 1 : -1;
                      break;
                  }
              }
          });
      }

      // Port zone bounds for skipping vehicles

      G.cars = G.cars.filter(c => {
        // Delivery truck with waypoints: stop at each location
        if (c._delivering && c._stops && c._stops.length > 0) {
            if (c._waitTimer > 0) {
                c._waitTimer--;
                // Idle at stop: flash headlights gently (only at night or bad weather)
                if (c.beam) c.beam.alpha = this._headlightAlpha > 0.01 ? ((G.tick % 40 < 20) ? 0.2 : 0.05) : 0;
                return true;
            }
            const target = c._stops[c._stopIdx];
            const dx = target - c.gfx.x;
            if (Math.abs(dx) < 3) {
                // Arrived at stop
                c.gfx.x = target;
                c._waitTimer = 120 + Math.random() * 80; // pause ~2-3 sec
                c._stopIdx++;
                if (c._stopIdx >= c._stops.length) {
                    // All stops done — drive off screen
                    c._delivering = false;
                }
            } else {
                // Drive toward next stop
                const moveDir = Math.sign(dx);
                c.gfx.x += moveDir * c.speed;
                c.gfx.scale ? (c.gfx.scale.x = moveDir) : null;
            }
        } else {
            c.gfx.x += c.dir * c.speed;
        }
        if (c.ref) c.ref.x = c.gfx.x;
        if (c.beam && !c._waitTimer) c.beam.alpha = this._headlightAlpha;
        const laneY = c.dir > 0 ? 26 : 12; c.gfx.y = G.groundY + laneY;
        if (c.ref) c.ref.y = c.gfx.y;
        // Hide in port/ocean zone (unless delivering TO port)
        const inPort = c.gfx.x > portMinX && c.gfx.x < portMaxX;
        const goingToPort = c._delivering && c._stops && c._stops[c._stopIdx] > portMinX && c._stops[c._stopIdx] < portMaxX;
        c.gfx.visible = goingToPort || !inPort;
        if (c.ref) c.ref.visible = c.gfx.visible;
        if (c.gfx.x < -80 || c.gfx.x > G.cityW + 80) {
            c.gfx.destroy();
            if (c.ref) c.ref.destroy();
            return false;
        }
        return true;
      });
      
      const occ = {}; if (!G.familyDestinations) G.familyDestinations = {}; if (!G.lastBlock) G.lastBlock = -1;

      // Viewport culling boundaries (with generous margin)
      const camLeft = -Camera.x - 400;
      const camRight = -Camera.x + G.vpW / Camera.zoom + 400;

      // ─── PERF: for-loop avoids closure allocation per model (500+ iterations/frame) ───
      const models = G.models;
      const modelsLen = models.length;
      const charRefs = G.charRefs;
      const tick = G.tick;
      const groundY = G.groundY;
      const bldById = G.bldById;
      const bldsByLab = G.bldsByLab;
      const chatBubbles = G.chatBubbles;
      const hasEnv = typeof Environment !== 'undefined';
      const envWeather = hasEnv ? Environment.weather : null;
      // Any rain-family weather that should slow commutes and pop umbrellas.
      const envIsRainy = hasEnv && Environment.isRainy ? Environment.isRainy() : (envWeather === 'rain');
      const hasPers = typeof Personality !== 'undefined';

      // ─── PERF: Hoist metro station lookups (same for every entity) ───
      const _mRes = bldById['metro_res'];
      const _mHq = bldById['metro_hq'];
      const _mEast = bldById['metro_east'];
      const _mDc = bldById['metro_dc'];
      const _mMid = bldById['metro_mid'];
      const _mLong = bldById['metro_longevity'];
      const mResX = _mRes ? _mRes.x + (_mRes.w / 2) : 1350;
      const mHqX = _mHq ? _mHq.x + (_mHq.w / 2) : 4700;
      const mEastX = _mEast ? _mEast.x + (_mEast.w / 2) : 7000;
      const mDcX = _mDc ? _mDc.x + (_mDc.w / 2) : null;
      const mMidX = _mMid ? _mMid.x + (_mMid.w / 2) : null;
      const mLongX = _mLong ? _mLong.x + (_mLong.w / 2) : null;

      // 5 regions: 0=DC/Space (left of res), 1=Residential, 2=Tech, 3=East, 4=Longevity terminus
      const getRegion = (x) => {
          if (mDcX && x < (mDcX + mResX) / 2) return 0;
          if (x < (mResX + mHqX) / 2) return 1;
          if (mMidX && x < (mMidX + mEastX) / 2) return 2;
          if (x < (mHqX + mEastX) / 2) return 2;
          if (mLongX && x > (mEastX + mLongX) / 2) return 4;
          return 3;
      };

      // ─── Phase 5: build spatial hash of visible outdoor walkers for local avoidance ───
      if (typeof CrowdSeparation !== 'undefined') {
          CrowdSeparation.rebuild(models, charRefs, camLeft, camRight);
      }

      for (let i = 0; i < modelsLen; i++) {
        const m = models[i];
        // Cache stage/act — only recalculate once per second (60 frames)
        if (!m._cachedTick || tick - m._cachedTick >= 60) {
            m._cachedStg = getStage(m.rel, m.ret, m.phase);
            m._cachedSd = STAGES[m._cachedStg];
            const result = getAct(m._cachedStg, dp, i, m);
            m._cachedAct = result.act;
            m._cachedBid = result.bid;
            m._cachedTick = tick;
        }
        const stg = m._cachedStg; const sd = m._cachedSd; const sc = sd.size; 
        const act = m._cachedAct; const bid = m._cachedBid;
        
        const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : ((typeof ACTS !== 'undefined' && ACTS['work']) ? ACTS['work'] : { indoor: true, icon: '💻', label: 'Processing' });
        
        // Pick the lab's HQ — NOT a data center or chip fab. DC/fab buildings
        // carry `lab: operator`, so without this filter Microsoft's Phi models
        // would all route to Stargate Abilene (which is still under construction)
        // instead of Microsoft HQ.
        const labBlds = bldsByLab[m.lab] || [];
        let defaultHq = labBlds.find(x => !x.id.startsWith('house_') && !x.id.startsWith('dc_') && !x.id.startsWith('fab_'))
                     || labBlds.find(x => !x.id.startsWith('house_'))
                     || labBlds[0];
        let tBld = bid ? bldById[bid] : defaultHq || bldById['uni_dorm'];
        const isSocial = act === 'lunch' || act === 'socialize' || act === 'play' || act === 'benchmark' || act === 'share' || act === 'train' || act === 'arena'; const block = Math.floor(dp * 24);
  
        if (isSocial && !night) {
          if (m._sb !== block) { 
              m._sb = block; 
              const r = Math.abs(Math.sin(i * 12.3 + block * 4.5)); 
              if (G.lastBlock !== block) { G.familyDestinations = {}; G.lastBlock = block; } 
              const fk = m.lab + '_' + act; 
              if (r <= .8 && G.familyDestinations[fk]) m._sid = G.familyDestinations[fk]; 
              else { 
                  // FIX: On weekdays, completely exclude Pine Reserve (forest_0).
                  // It's only available as a weekend/holiday camping destination.
                  let sp = G.socialSpots;
                  if (sp && sp.length > 0) {
                      if (!_isWeekend) {
                          sp = sp.filter(b => b.id !== 'forest_0');
                      }
                      
                      if (sp.length > 0) {
                          let ch = sp[Math.floor(Math.abs(Math.sin(i * 2.1 + block)) * sp.length)]; 
                          if (ch) { m._sid = ch.id; if (r <= .8) G.familyDestinations[fk] = ch.id; }
                      }
                  }
              } 
          }
          if (m._sid) { const o = bldById[m._sid]; if (o) tBld = o; }
        } else m._sb = -1;

        if (tBld && tBld.id === 'park') {
            tBld = bldById['open_square'] || bldById['cafe'] || defaultHq;
            m._sid = tBld ? tBld.id : null;
        }

        if (!tBld && BLDS && BLDS.length > 0) tBld = BLDS[0];
        if (!tBld) continue;

        // BUG FIX (v352): Sleeping models MUST go to residential buildings.
        // This is the authoritative catch-all — no matter what upstream logic
        // resolved tBld to, if the schedule says sleep, redirect to residential.
        if (act === 'sleep' && tBld && !tBld.id.startsWith('res_') && tBld.id !== 'graveyard' && !tBld.id.startsWith('uni_')) {
            const _region = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
            const _resBld = bldById['res_' + _region];
            if (_resBld) tBld = _resBld;
        }

        // BUG FIX (v388): Night-at-park catch-all. Central Park is an outdoor
        // zone with no interior-enter flow. At night lingerOK is false, so any
        // non-sleep act pointing at city_park would fall through the atBuilding
        // else-branch below and get marooned invisible (refs.bld='city_park',
        // visible=false). Redirect home instead — they'll sleep like everyone else.
        if (tBld && tBld.id === 'city_park' && night) {
            const _region = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
            const _resBld = bldById['res_' + _region];
            if (_resBld) tBld = _resBld;
        }

        const isIn = ai.indoor; const isR = stg === 'retired';
        const isRm = stg === 'rumored';
        if (isIn && !isR) { if (!occ[tBld.id]) occ[tBld.id] = [];
        occ[tBld.id].push({ name: m.name, lab: m.lab, act }); }

        const refs = charRefs[m.id];
        if (!refs) continue;

        if (typeof refs._metroState === 'undefined') refs._metroState = 'none';
        if (typeof refs._logicalY === 'undefined') refs._logicalY = groundY - 20;

        // ─── VIEWPORT CULLING: Skip expensive updates for off-screen characters ───
        // Only 'riding' metro state needs frame-perfect sync (position relative to train).
        // All other states (walking, waiting_train, entering, exiting) can be culled when off-screen.
        // Indoor (invisible) NPCs update every 120 frames; off-screen outdoor at ~10fps (every 6).
        const isOnScreen = refs.c.x >= camLeft && refs.c.x <= camRight;
        const isRiding = refs._metroState === 'riding';
        if (!isOnScreen && !isRiding) {
            if (refs.bld !== null && refs.c.visible === false) {
                // Off-screen + inside a building — rarely update (every 120 frames)
                if (tick % 120 !== (i % 120)) continue;
            } else {
                // Off-screen + outdoor or at station — throttle to ~10fps
                // Walking distance per update is unchanged; only frame cadence drops
                if (tick % 6 !== (i % 6)) continue;
            }
        }
        // Kept for downstream compatibility (line 1095 chat detection uses isOnScreen)

        const bldSpread = Math.max(tBld.w - 10, 30); 
        const pseudoRandomOffset = ((i * 73) % bldSpread) - (bldSpread / 2);
        let buildingTargetX = tBld.x + (tBld.w / 2) + pseudoRandomOffset;

        if (!refs._initPos) {
            // Recalculate target X in case the sleep catch-all above changed tBld
            buildingTargetX = tBld.x + (tBld.w / 2) + pseudoRandomOffset;
            refs.c.x = buildingTargetX;
            refs._logicalY = groundY - 20;
            refs._initPos = true;
            refs._metroState = 'none';
            refs._metroLegs = null;
            refs.bld = (isR || tBld.id === 'city_park') ? null : tBld.id;
        }

        const isInside = refs.bld !== null;

        if (refs.bld !== tBld.id) {
            if (isInside) {
                refs.wantsToLeave = true;
                if (G.activeInterior !== refs.bld) {
                    const b = bldById[refs.bld];
                    if (b) refs.c.x = b.x + (b.w / 2);
                    refs.bld = null;
                    refs.wantsToLeave = false;
                    refs.c.visible = true;
                    refs._stuckTimer = 0;
                } else {
                    // Safety net: if model is trapped for >30s while interior is open
                    // (elevator bottleneck), force-teleport it out on the next exterior tick
                    refs._stuckTimer = (refs._stuckTimer || 0) + 1;
                    if (refs._stuckTimer > 1800) {
                        const b = bldById[refs.bld];
                        if (b) refs.c.x = b.x + (b.w / 2);
                        refs.bld = null;
                        refs.wantsToLeave = false;
                        refs.c.visible = true;
                        refs._stuckTimer = 0;
                    } else {
                        refs.c.visible = false;
                    }
                }
            } else {
                refs.c.visible = true;
                
                let finalTargetX = buildingTargetX;
                let finalTargetY = groundY - 20;
                let freezeX = false;

                if (refs._metroState === 'none' && !refs._metroLegs && !isR) {
                    let myReg = getRegion(refs.c.x);
                    let dstReg = getRegion(buildingTargetX);
                    
                    if (myReg !== dstReg) {
                        // Build route through stations
                        // Station order: metro_dc (0) → metro_res (1) → metro_hq (2) → metro_mid → metro_east (3) → metro_longevity (4)
                        const stations = [];
                        if (mDcX) stations.push({ reg: 0, x: mDcX });
                        stations.push({ reg: 1, x: mResX });
                        stations.push({ reg: 2, x: mHqX });
                        if (mMidX) stations.push({ reg: 2.5, x: mMidX }); // mid-tech
                        stations.push({ reg: 3, x: mEastX });
                        if (mLongX) stations.push({ reg: 4, x: mLongX });
                        
                        // Find nearest station to current position and destination
                        const nearestStation = (x) => stations.reduce((best, s) => Math.abs(s.x - x) < Math.abs(best.x - x) ? s : best);
                        const startSt = nearestStation(refs.c.x);
                        const endSt = nearestStation(buildingTargetX);
                        
                        if (startSt.x !== endSt.x) {
                            const startIdx = stations.indexOf(startSt);
                            const endIdx = stations.indexOf(endSt);
                            const legs = [];
                            if (startIdx < endIdx) {
                                for (let si = startIdx; si <= endIdx; si++) legs.push(stations[si].x);
                            } else {
                                for (let si = startIdx; si >= endIdx; si--) legs.push(stations[si].x);
                            }
                            if (legs.length >= 2) {
                                refs._metroLegs = legs;
                                refs._currentLeg = 0;
                                refs._metroState = 'entering';
                            }
                        }
                    }
                }

                const platformMaxSpread = 120;
                const stationSpread = Math.max(-platformMaxSpread, Math.min(platformMaxSpread, pseudoRandomOffset * 1.2)); 
                const platformY = groundY + 112;

                if (refs._metroLegs && refs._metroLegs.length > 0) {
                    let s1 = refs._metroLegs[refs._currentLeg];
                    let s2 = refs._metroLegs[refs._currentLeg + 1];
                    
                    let activeTrain = null;
                    if ((s1 === mResX && s2 === mHqX) || (s1 === mHqX && s2 === mResX)) activeTrain = this.trainWest;
                    else if (mMidX && ((s1 === mHqX && s2 === mMidX) || (s1 === mMidX && s2 === mHqX))) activeTrain = this.trainEast;
                    else if (mMidX && ((s1 === mMidX && s2 === mEastX) || (s1 === mEastX && s2 === mMidX))) activeTrain = this.trainMid;
                    else if ((s1 === mHqX && s2 === mEastX) || (s1 === mEastX && s2 === mHqX)) activeTrain = this.trainEast;
                    else if (mDcX && ((s1 === mDcX && s2 === mResX) || (s1 === mResX && s2 === mDcX))) activeTrain = this.trainDC;
                    else if (mLongX && ((s1 === mEastX && s2 === mLongX) || (s1 === mLongX && s2 === mEastX))) activeTrain = this.trainLongevity;

                    if (refs._metroState === 'entering') {
                        finalTargetX = s1;
                        if (Math.abs(refs.c.x - s1) < 5) {
                            refs.c.x = s1;
                            freezeX = true; 
                            finalTargetY = platformY;
                            if (refs._logicalY >= platformY - 5) refs._metroState = 'waiting_train';
                        } else {
                            finalTargetY = groundY - 20;
                        }
                    } else if (refs._metroState === 'waiting_train') {
                        finalTargetX = s1 + stationSpread;
                        finalTargetY = platformY;
                        
                        // If train is here, push non-boarding characters to back of platform
                        // so they don't overlap the train body visually
                        if (activeTrain && activeTrain.state === 'waiting' && Math.abs(activeTrain.x - s1) < 5) {
                            // Cap raised from 30→80 to prevent rush-hour platform pile-up
                            if (activeTrain.passengers < 80) {
                                activeTrain.passengers++;
                                refs._metroState = 'riding';
                                refs._ridingTrain = activeTrain;
                            } else {
                                // Train is full — stand at back of platform (above train body)
                                finalTargetY = platformY - 35;
                            }
                        }
                    } else if (refs._metroState === 'riding') {
                        freezeX = true;
                        let t = refs._ridingTrain;
                        if (t) {
                            // Clamp offset to stay inside the train body (±150px)
                            var rideOffset = Math.max(-150, Math.min(150, pseudoRandomOffset * 1.2));
                            refs.c.x = t.x + rideOffset;
                            if (t.state === 'waiting' && Math.abs(t.x - s2) < 5) {
                                t.passengers = Math.max(0, t.passengers - 1);
                                refs.c.x = s2;
                                refs._currentLeg++;
                                if (refs._currentLeg >= refs._metroLegs.length - 1) {
                                    refs._metroState = 'exiting';
                                } else {
                                    refs._metroState = 'waiting_train';
                                }
                                refs._ridingTrain = null;
                            }
                        } else {
                            refs._metroState = 'none';
                            refs._metroLegs = null;
                        }
                    } else if (refs._metroState === 'exiting') {
                        let currentStationX = refs._metroLegs[refs._currentLeg];
                        finalTargetX = currentStationX;
                        finalTargetY = groundY - 20;
                        refs.c.x = currentStationX;
                        freezeX = true; 
                        if (refs._logicalY <= finalTargetY + 5) {
                            refs._metroState = 'none';
                            refs._metroLegs = null;
                        }
                    }
                }

                let atBuilding = Math.abs(refs.c.x - buildingTargetX) < 40;

                if (atBuilding && refs._metroState === 'none' && !isR) {
                    // BUG FIX (v338): only let models linger visibly at Central Park when
                    // they actually have a "hang out" act. Sleep/commute traffic that just
                    // happens to be near the park's centroid was getting stuck and forming
                    // a permanent overnight cluster.
                    const lingerOK = !night && (act === 'socialize' || act === 'lunch' || act === 'play' || act === 'share');
                    if (act === 'commute') {
                        // Commuting: entity walks toward HQ but stays on the street
                        // (visible, not entered). They'll enter once schedule flips to 'work'.
                        refs.bld = null;
                        refs.c.visible = true;
                    } else if (tBld.id === 'city_park' && lingerOK) {
                        // Open-air zone: NPCs stay visible, just linger here
                        refs.bld = null;
                        refs.c.visible = true;
                    } else if (tBld.id === 'city_park') {
                        // Defense-in-depth (v388): city_park has no interior.
                        // If we reach here, upstream redirect failed — stay visible
                        // at the park edge rather than ghosting into a non-building.
                        refs.bld = null;
                        refs.c.visible = true;
                    } else {
                        refs.bld = tBld.id;
                        refs.wantsToEnter = true;
                        refs.c.visible = false;
                    }
                }

                if (refs.c.visible) {
                    if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                        if (!refs.elev) {
                            EntitiesGfx.createElevatorPlatform(refs);
                        }
                        refs.elev.visible = true;
                    } else if (refs.elev) {
                        refs.elev.visible = false;
                    }

                    // BUG FIX (v338): suppress street-chat finder for sleep/commute and
                    // at night. Models heading home shouldn't stop to chat — that traffic
                    // jam was the main feeder for the persistent Central Park cluster.
                    const chatBlocked = night || act === 'sleep' || act === 'commute';
                    if (chatBlocked && refs._streetState === 'chatting') {
                        // Force-end any in-progress chat so the model can resume walking
                        refs._streetState = 'walking';
                        refs._chatTimer = 0;
                    }
                    if (!isR && !chatBlocked && refs._streetState === 'walking' && isOnScreen && tick % 30 === (i % 30)) {
                        const myId = m.id;
                        const myX = refs.c.x;
                        // Only search a limited window of models, not all 730
                        let partnerObj = null;
                        for (let si = Math.max(0, i - 25); si < Math.min(modelsLen, i + 25); si++) {
                            const otherM = models[si];
                            if (otherM.id === myId) continue;
                            const otherRefs = charRefs[otherM.id];
                            if (!otherRefs || !otherRefs.c.visible || otherRefs._streetState !== 'walking' || otherRefs._chatTimer > 0) continue;
                            // BUG FIX (v338): don't drag a sleeping/commuting neighbor into a chat
                            const otherAct = otherM._cachedAct;
                            if (otherAct === 'sleep' || otherAct === 'commute') continue;
                            if (Math.abs(otherRefs.c.x - myX) < 30) { partnerObj = otherM; break; }
                        }
                        if (partnerObj && Math.random() < 0.05) {
                            const partnerRefs = charRefs[partnerObj.id];
                            refs._streetState = 'chatting';
                            partnerRefs._streetState = 'chatting';
                            refs._chatTimer = 180 + Math.random() * 120;
                            partnerRefs._chatTimer = refs._chatTimer;
                            refs.c.scale.x = Math.sign(partnerRefs.c.x - refs.c.x) || 1;
                            partnerRefs.c.scale.x = Math.sign(refs.c.x - partnerRefs.c.x) || -1;
                            const streetTopics = ["Going to HQ?", "Did you see the benchmarks?", "Market is volatile.", "I need an update.", "Heading to the cafe."];
                            chatBubbles[m.id] = { msg: streetTopics[Math.floor(Math.random() * streetTopics.length)], expire: tick + 100 };
                            setTimeout(() => {
                                if (!G.activeInterior && partnerRefs._streetState === 'chatting') {
                                    const replies = ["Yeah.", "I know right?", "See you later.", "Compute is scarce.", "Indeed."];
                                    G.chatBubbles[partnerObj.id] = { msg: replies[Math.floor(Math.random() * replies.length)], expire: G.tick + 100 };
                                }
                            }, 1500);
                        }
                    }

                    let wobble = 0;
                    const weatherSpeedMod = envWeather === 'snow' ? 0.6 : 1;
                    const pScale = refs.paramScale || 1.0;
                    const personalitySpd = hasPers ? Personality.getSpeedMod(m) : 1;
                    const pSpeedMod = (1.4 - (pScale * 0.3)) * personalitySpd;

                    if (refs._metroState === 'none' && !refs._metroLegs) {
                        const ws = .0015 * sd.speed * weatherSpeedMod * pSpeedMod * (envIsRainy && act === 'commute' ? 1.5 : 1);
                        const wAmt = (act === 'commute' ? (envIsRainy ? 120 : 80) : (isSocial ? 50 : 20)) * pScale;
                        wobble = Math.sin(i * 1.7 + tick * ws) * wAmt;
                    }

                    const currentTargetX = finalTargetX + wobble;
                    const distX = currentTargetX - refs.c.x;
                    
                    let currentDir = 1;
                    let bobY = isR ? (Math.sin(tick * 0.05 + i) * 8 + 15) : (Math.sin(tick * 0.06) * 2);
                    let legA = isR ? 0 : Math.sin(tick * .12 * weatherSpeedMod * pSpeedMod) * 2 * pScale;
                    let depthOffset = (i * 37) % 24;
                    if (refs._metroState !== 'none' && refs._metroState !== 'riding') {
                        depthOffset = (i * 37) % 6;
                    }

                    let isSitting = false;

                    if (refs._metroState === 'riding') {
                        currentDir = refs._ridingTrain ? refs._ridingTrain.dir : 1;
                        bobY = 0;
                        legA = 0;
                        depthOffset = 0;
                        isSitting = true;
                        refs._logicalY = groundY + 120 + 4;
                    } else if (refs._streetState === 'chatting') {
                        refs._chatTimer--;
                        if (refs._chatTimer <= 0) {
                            refs._streetState = 'walking';
                            refs._chatTimer = 100;
                        }
                        currentDir = refs.c.scale.x;
                        bobY = Math.sin(tick * 0.02 + i) * 1;
                        legA = 0;
                    } else {
                        const walkSpeed = sd.speed * weatherSpeedMod * pSpeedMod * (act === 'commute' ? 1.5 : 1);

                        if (!freezeX) {
                            if (Math.abs(distX) > walkSpeed) {
                                refs.c.x += Math.sign(distX) * walkSpeed;
                                currentDir = Math.sign(distX);
                                legA = isR ? 0 : Math.sin(tick * 0.15 * weatherSpeedMod * pSpeedMod) * 2 * pScale;
                            } else {
                                refs.c.x = currentTargetX;
                                currentDir = Math.sign(distX) || 1;
                                if (wobble !== 0) {
                                    const ws = .0015 * sd.speed * weatherSpeedMod * pSpeedMod * (envIsRainy && act === 'commute' ? 1.5 : 1);
                                    currentDir = Math.cos(i * 1.7 + tick * ws) > 0 ? 1 : -1;
                                }
                            }
                            // ─── Phase 5: local crowd avoidance ─────────────────────────
                            // Small lateral nudge if standing too close to another walker.
                            // Breaks up sidewalk clumps without disrupting target-seeking.
                            if (typeof CrowdSeparation !== 'undefined') {
                                refs.c.x += CrowdSeparation.nudge(refs, i);
                            }
                        }

                        const distY = finalTargetY - refs._logicalY;
                        if (Math.abs(distY) > 3) {
                            refs._logicalY += Math.sign(distY) * 3;
                            bobY = 0; legA = 0;
                        } else {
                            refs._logicalY = finalTargetY;
                        }
                    }

                    refs.c.y = refs._logicalY - bobY + depthOffset;
                    refs.c.scale.x = currentDir;
                    // Only update zIndex when y actually changed (avoids marking container sort-dirty)
                    const newZ = Math.round(refs.c.y);
                    if (refs.c.zIndex !== newZ) refs.c.zIndex = newZ;
                    // Layer-swap: move to metroRiderCont when underground so models render
                    // behind groundGfx (only visible through tunnel cavity) and INSIDE trains
                    // (riderCont sits between train body and front panel in trainLayer)
                    const isUnderground = refs._metroState !== 'none' && refs._logicalY > groundY;
                    const riderLayer = this.metroRiderCont || this.trainLayer;
                    if (isUnderground && !refs._inTrainLayer) {
                        riderLayer.addChild(refs.c);
                        refs._inTrainLayer = true;
                    } else if (!isUnderground && refs._inTrainLayer) {
                        this.charLayer.addChild(refs.c);
                        refs._inTrainLayer = false;
                    }
                    // Restore visibility for models that left a building
                    if (refs.bld === null && !refs.c.visible) {
                        refs.c.visible = true;
                    }
                    
                    if (isSitting) {
                        refs.legL.rotation = -Math.PI / 2;
                        refs.legR.rotation = -Math.PI / 2;
                        refs.legL.y = -2 * (sc * pScale);
                        refs.legR.y = -2 * (sc * pScale);
                        const h = Math.round(32 * sc * pScale);
                        const headH = Math.round(h * sd.headR);
                        refs.body.y = -h + headH + (4 * sc * pScale);
                        refs.head.y = -h + (4 * sc * pScale);
                    } else {
                        refs.legL.rotation = 0;
                        refs.legR.rotation = 0;
                        refs.legL.y = legA;
                        refs.legR.y = -legA;
                        const h = Math.round(32 * sc * pScale);
                        const headH = Math.round(h * sd.headR);
                        refs.body.y = -h + headH;
                        refs.head.y = -h;
                    }
                    
                    refs.c.alpha = isR ? (0.35 + Math.abs(Math.sin(tick * 0.03 + i)) * 0.45) : isRm ? .55 : 1;
                    if (isR) { if (refs.c.blendMode !== PIXI.BLEND_MODES.ADD) refs.c.blendMode = PIXI.BLEND_MODES.ADD; }
                    else { if (refs.c.blendMode !== PIXI.BLEND_MODES.NORMAL) refs.c.blendMode = PIXI.BLEND_MODES.NORMAL; }
                    // Ghost glow pulse
                    if (isR && refs.ghostGlow && refs.ghostGlow.visible) {
                        refs.ghostGlow.alpha = 0.08 + Math.abs(Math.sin(tick * 0.025 + i * 0.7)) * 0.12;
                    }

                    if (refs.isMoE && refs.c.visible && refs._metroState === 'none' && !isR) {
                        refs.ghostL.visible = true;
                        refs.ghostR.visible = true;
                        const bw = Math.round(16 * sc * pScale);
                        const splitAmt = Math.abs(distX) > 0.5 ? (bw * 0.7) : (bw * 0.2);

                        refs.ghostL.x = -splitAmt + Math.sin(tick * 0.1 + i) * 3;
                        refs.ghostR.x = splitAmt + Math.cos(tick * 0.1 + i) * 3;
                        refs.ghostL.alpha = 0.4 + Math.sin(tick * 0.05 + i) * 0.2;
                        refs.ghostR.alpha = 0.4 + Math.cos(tick * 0.05 + i) * 0.2;

                        refs.ghostL.y = refs.body.y + Math.sin(tick * 0.2) * 2;
                        refs.ghostR.y = refs.body.y + Math.cos(tick * 0.2) * 2;
                    } else {
                        refs.ghostL.visible = false;
                        refs.ghostR.visible = false;
                    }

                    const isOutside = !isIn && !isR && refs._metroState === 'none' && refs.c.visible;

                    if (isOutside && envIsRainy) {
                        refs.umbrella.visible = true;
                        refs.umbrella.rotation = (currentDir === 1 ? 0.1 : -0.1) + Math.sin(tick * 0.1 + i) * 0.05;
                    } else {
                        refs.umbrella.visible = false;
                    }

                    if (!m.os && isOutside && act === 'commute') {
                        refs.briefcase.visible = true;
                        refs.briefcase.rotation = Math.sin(tick * 0.15 * (1.4 - (pScale*0.3))) * 0.2;
                    } else {
                        refs.briefcase.visible = false;
                    }

                    if (refs.summonIcon) {
                        const summoned = m._summoned === true;
                        refs.summonIcon.visible = summoned && isOutside;
                        if (summoned && isOutside) {
                            refs.summonIcon.y = refs.head.y - 2 + Math.sin(tick * 0.1 + i) * 1.2;
                        }
                    }
                }
            }
        } else {
            refs.wantsToLeave = false;
            if (isInside) {
                refs.c.visible = false;
                if (G.activeInterior !== refs.bld) refs.wantsToEnter = false;
            } else {
                refs.c.visible = true;
            }
        }

        if (m.os && act === 'share' && Math.random() < 0.05 && refs.c.visible && !isR) {
            EntitiesGfx.spawnDataCube(m, refs, this.charLayer, this.dataCubes);
        }

        const bub = chatBubbles[m.id];
        const hasBub = bub && bub.expire > tick;
        if (hasBub && refs._chatMsg !== bub.msg) {
            EntitiesGfx.updateChatBubbleVisuals(refs, bub.msg);
            refs.chat.visible = true;
            refs.chat.y = -32 * sc * (refs.paramScale||1) - 14;
            refs._chatMsg = bub.msg;
        } else if (!hasBub && refs._chatMsg) {
            refs.chat.visible = false;
            refs._chatMsg = null;
            delete chatBubbles[m.id];
        }
        
        refs.chat.scale.x = refs.c.scale.x > 0 ? 1 : -1;
        
        const stateKey = stg + '|' + act + '|' + m.lab + '|' + (refs.paramScale||1);
        if (refs._state !== stateKey) {
            refs._state = stateKey;
            const lab = LABS[m.lab] || LABS.other || {color: '#64748b'}; 
            const colHex = parseInt(lab.color.slice(1), 16);
            EntitiesGfx.updateCharStateVisuals(m, refs, stg, isR, isRm, sc, sd, colHex);
        }
      }
      
      if (this.dataCubes) {
          for (let i = this.dataCubes.length - 1; i >= 0; i--) {
              let c = this.dataCubes[i];
              c.x += c.vx;
              c.y += c.vy;
              c.vy += 0.15;
              c.life--;
              c.alpha = Math.min(1, c.life / 20);
              c.rotation += c.vx * 0.05;
              
              if (c.y > G.groundY - 2) {
                  c.y = G.groundY - 2;
                  c.vy = 0;
                  c.vx *= 0.8;
              }
              
              if (c.life <= 0) {
                  c.destroy();
                  this.dataCubes.splice(i, 1);
              }
          }
      }
      
      return occ;
    }
};
