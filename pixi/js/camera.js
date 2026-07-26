/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CAMERA LAYER (v9.5.5 - Horizontal Scroll Panning & Y-Axis Expanded Deep Strata)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const Camera = {
    x: 0, 
    y: 0, 
    targetX: 0, 
    targetY: 0, 
    zoom: 0.80,
    targetZoom: 0.80,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    // Inertia/momentum state
    _velX: 0, _velY: 0, _lastMoveTime: 0,
    _momentumX: 0, _momentumY: 0, _friction: 0.90,
    // Double-tap zoom detection
    _lastTapTime: 0, _lastTapX: 0, _lastTapY: 0,

    init() {
        const vp = document.getElementById('viewport');
        vp.addEventListener('pointerdown', this.onDown.bind(this));
        window.addEventListener('pointermove', this.onMove.bind(this));
        window.addEventListener('pointerup', this.onUp.bind(this));
        vp.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        // Desktop-only zoom buttons (pill to the left of minimap)
        this._buildZoomButtons();

        // Mobile pinch-to-zoom
        this._pinchDist = 0;
        vp.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                this._pinchDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: true });
        vp.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (this._pinchDist > 0) {
                    const scale = dist / this._pinchDist;
                    this.targetZoom = Math.max(0.5, Math.min(3, this.targetZoom * scale));
                }
                this._pinchDist = dist;
                e.preventDefault();
            }
        }, { passive: false });
        vp.addEventListener('touchend', () => { this._pinchDist = 0; }, { passive: true });

        // ─── Default underground view ─────────────────────────────────────
        // Show the underground metro tunnel, water pipes, and the orange
        // electric/sewer pipes beneath the city when the app first loads.
        // Users can pan up to see the city/sky normally — this just makes
        // the underground infrastructure visible by default instead of
        // hidden off-screen.
        //
        // Anchor the orange electric pipe (its bottom edge sits at gy+247)
        // just above the news ticker so the pipes are the lowest visible
        // feature. Solving for screen_y(gy+247) = vpH - tickerH:
        //   targetY = (vpH - tickerH) / zoom - (groundY + 247)
        // The ~31 world-px between the pipe and the canvas bottom gets
        // hidden by the ticker overlay, so there's no visible black void.
        if (typeof G !== 'undefined' && G.groundY) {
            const z = this.targetZoom;
            const tickerH = 25; // approx news ticker height in screen px
            const orangePipeBottom = G.groundY + 247;
            const undergroundY = ((G.vpH - tickerH) / z) - orangePipeBottom;
            this.targetY = undergroundY;
            this.y = undergroundY;
        }
    },

    onDown(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        // Double-tap zoom detection
        const now = performance.now();
        if (now - this._lastTapTime < 300 &&
            Math.abs(e.clientX - this._lastTapX) < 30 &&
            Math.abs(e.clientY - this._lastTapY) < 30) {
            this.targetZoom = this.targetZoom < 1.5 ? 2.0 : 1.0;
            this._lastTapTime = 0;
            this._momentumX = 0; this._momentumY = 0;
            return;
        }
        this._lastTapTime = now;
        this._lastTapX = e.clientX;
        this._lastTapY = e.clientY;

        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this._lastMoveTime = now;
        this._momentumX = 0; this._momentumY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.add('dragging');
        // Manual camera drag cancels tracking
        if (typeof G !== 'undefined' && G.tracking) {
            G.stopTracking();
        }
    },

    onMove(e) {
        if(!this.isDragging) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;

        const now = performance.now();
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.targetX += dx / this.zoom;
        this.targetY += dy / this.zoom;

        // Track velocity for inertia on release
        const dt = now - this._lastMoveTime;
        if (dt > 0 && dt < 100) {
            const factor = (16.67 / dt) * 0.6;
            this._velX = (dx / this.zoom) * factor;
            this._velY = (dy / this.zoom) * factor;
        }

        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this._lastMoveTime = now;
    },

    onUp() {
        if (this.isDragging && (Math.abs(this._velX) > 0.5 || Math.abs(this._velY) > 0.5)) {
            this._momentumX = this._velX;
            this._momentumY = this._velY;
        }
        this.isDragging = false;
        this._velX = 0; this._velY = 0;
        const vpEl = document.getElementById('viewport');
        if (vpEl) vpEl.classList.remove('dragging');
    },

    onWheel(e) {
        if (e.target.closest('.ctrls-scroll') || e.target.closest('.ov')) return;
        if (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus)) return;
        // Block wheel input while in orbit mode
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) { e.preventDefault(); return; }

        e.preventDefault();
        this.targetX -= e.deltaY * 0.5;
    },

    update() {
        if (typeof G === 'undefined') return;

        // ─── Zoom pill visibility ───
        if (G.tick % 15 === 0) this._updateZoomPill();

        // ─── INERTIA: apply momentum from drag release ───
        if (!this.isDragging && (Math.abs(this._momentumX) > 0.1 || Math.abs(this._momentumY) > 0.1)) {
            this.targetX += this._momentumX;
            this.targetY += this._momentumY;
            this._momentumX *= this._friction;
            this._momentumY *= this._friction;
            if (Math.abs(this._momentumX) < 0.1) this._momentumX = 0;
            if (Math.abs(this._momentumY) < 0.1) this._momentumY = 0;
        }

        // ─── TRACKING MODE: override camera position to follow entity ───
        // Runs even during interiors so the camera target stays in sync for
        // seamless fade-transitions when the tracked entity enters/exits buildings.
        if (G.tracking) {
            let entityX = null;
            let entityY = null;
            
            if (G.tracking.type === 'model') {
                const refs = G.charRefs[G.tracking.id];
                if (refs && refs.c) {
                    entityX = refs.c.x;
                    entityY = refs.c.y;
                }
            } else if (G.tracking.type === 'ceo') {
                const ceo = G.ceoRefs ? G.ceoRefs[G.tracking.lab] : null;
                if (ceo) {
                    const heli = (typeof Entities !== 'undefined' && Entities.heliRefs) ? Entities.heliRefs[G.tracking.lab] : null;
                    const heliActive = heli && heli.state !== 'hidden';

                    if (heliActive && heli.cont && heli.cont.visible) {
                        // Helicopter is flying/landing/taking off — follow it
                        entityX = heli.cont.x;
                        entityY = heli.cont.y;
                    } else if (heliActive && !heli.cont.visible) {
                        // Helicopter grounded (hidden inside building) — follow building position
                        const bld = ceo.bld ? G.bldById[ceo.bld] : null;
                        if (bld) {
                            entityX = bld.x + bld.w / 2;
                            entityY = G.groundY;
                        } else {
                            entityX = heli.logicalX;
                            entityY = heli.logicalY;
                        }
                    } else {
                        // No helicopter — follow car/walking position
                        entityX = ceo.logicalX;
                        entityY = G.groundY + 20;
                    }
                }
            } else if (G.tracking.type === 'npc') {
                const cm = typeof NPCHousing !== 'undefined' && NPCHousing.commuters.find(c => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.c.visible) {
                        entityX = cm.c.x;
                        entityY = cm.c.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            } else if (G.tracking.type === 'vendor') {
                const vm = typeof StreetVendors !== 'undefined' && StreetVendors.vendors.find(v => v.def.id === G.tracking.id);
                if (vm) {
                    if (vm.c.visible) {
                        entityX = vm.c.x;
                        entityY = vm.c.y;
                    } else if (vm.bld) {
                        const bld = G.bldById[vm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            } else if (G.tracking.type === 'vc_commuter') {
                const cm = typeof VCRow !== 'undefined' && VCRow.carCommuters.find(c => c.npc.id === G.tracking.id);
                if (cm) {
                    if (cm.carCont.visible) {
                        entityX = cm.carCont.x;
                        entityY = cm.carCont.y;
                    } else if (cm.bld) {
                        const bld = G.bldById[cm.bld];
                        if (bld) { entityX = bld.x + bld.w / 2; entityY = G.groundY; }
                    }
                }
            }
            
            if (entityX !== null) {
                this.targetX = -(entityX) + (G.vpW / 2) / this.zoom;
                // Center entity vertically: offset so entityY lands at ~60% down the screen
                this.targetY = -(entityY) + (G.vpH * 0.6) / this.zoom;
                this.targetZoom = 1.3;
            }
        }

        // ─── TRAIN FOCUS: "boarded" a train — zoom in and follow it through the
        //     real world. Frames the car at ~62% down so the real city above it
        //     (and the tunnel/pipes below) stay in view, going past as it moves. ───
        if (G.trainFocus && typeof Entities !== 'undefined' && Entities[G.trainFocus]) {
            const t = Entities[G.trainFocus];
            this.targetZoom = (typeof InteriorTrain !== 'undefined' && InteriorTrain.ZOOM) ? InteriorTrain.ZOOM : 2.0;
            const fx = t.x;
            const fy = G.groundY + 120;            // tunnelY — the train's world centre
            this.targetX = -(fx) + (G.vpW / 2) / this.zoom;
            this.targetY = -(fy) + (G.vpH * 0.62) / this.zoom;
        }

        // Cache maxBldHeight — only recalculate every 300 frames (~5s)
        if (!this._maxBldH || G.tick % 300 === 0) {
            this._maxBldH = 0;
            if (typeof BLDS !== 'undefined') {
                for (let i = 0; i < BLDS.length; i++) {
                    const h = (BLDS[i].dynamicFl || 3) * 45;
                    if (h > this._maxBldH) this._maxBldH = h;
                }
            }
        }
        let maxBldHeight = this._maxBldH;

        const groundAnchor = G.groundY * (1 / this.targetZoom - 1);

        // ─── CAMERA LOCK UPDATE ───
        // Lower bound (most-negative targetY = camera looking deepest down):
        // hard-clamp to the orange electric pipe (gy+247) sitting just above
        // the news ticker. Anything past that is empty deep earth — no reason
        // to let users drag the camera into a black void.
        // Solving: screen_y(gy+247) = vpH - tickerH
        //   minY = (vpH - tickerH) / zoom - (groundY + 247)
        const tickerH = 25;
        const minY = ((G.vpH - tickerH) / this.targetZoom) - (G.groundY + 247);

        let maxY = groundAnchor;
        const visibleHeight = G.vpH / this.targetZoom;

        if (maxBldHeight > visibleHeight - 100) {
            maxY = groundAnchor + (maxBldHeight - visibleHeight + 150);
        }

        // Clamp camera boundaries (skip during tracking / train focus — the
        // followed entity's position takes priority over city-edge limits)
        if (!G.tracking && !G.trainFocus) {
            this.targetY = Math.max(minY, Math.min(this.targetY, maxY));
        }

        const minX = -G.cityW + G.vpW / this.zoom;
        const maxX = 0;

        if (!G.tracking && !G.trainFocus) {
            this.targetX = Math.max(minX, Math.min(this.targetX, maxX));
        }
        
        // Very slow, cinematic lerp during Auto-Tour — every transition (scenic pan,
        // zoom-in to tracked entity, zoom-out afterwards) should glide over ~4 seconds
        // so the tour feels like a screensaver drift, not a slideshow.
        const _cinematic = (typeof AutoTour !== 'undefined' && AutoTour.active);
        const _zoomLerp = _cinematic ? 0.010 : 0.08;
        // Follow the boarded train tightly so it stays near-centred while the city
        // scrolls past (a looser lerp lets a moving train drift off-screen).
        const _xyLerp   = _cinematic ? 0.015 : (G.trainFocus ? 0.32 : 0.12);
        this.zoom += (this.targetZoom - this.zoom) * _zoomLerp;
        this.x += (this.targetX - this.x) * _xyLerp;
        this.y += (this.targetY - this.y) * _xyLerp;
        
        if (!G.tracking && !G.trainFocus) {
            if (this.x < minX) { this.x = minX; }
            if (this.x > maxX) { this.x = maxX; }
        }

        if (G.world) {
            G.world.scale.set(this.zoom);
            G.world.x = this.x * this.zoom;
            // Viewport compensation: groundY was set at init and never changes.
            // When viewport height changes, offset world.y to keep ground at bottom.
            const vpCompensation = (G.vpH - 56) - G.groundY;
            G.world.y = this.y * this.zoom + vpCompensation;
            
            // Store for external use (minimap, etc)
            this._vpCompensation = vpCompensation;
        }
    },

    /* ── Desktop-only horizontal zoom ± pill (left of minimap) ─ */
    _buildZoomButtons() {
        // Skip on mobile / narrow screens — pinch-to-zoom handles it
        if (window.innerWidth < 769) return;

        const pill = document.createElement('div');
        pill.id = 'zoomPill';
        pill.style.cssText = [
            'position:fixed',
            'bottom:44px',
            'right:100px',
            'z-index:100',
            'display:flex',
            'flex-direction:row',
            'align-items:center',
            'border-radius:10px',
            'overflow:hidden',
            'background:rgba(6,6,16,0.92)',
            'border:1px solid var(--bd,#1e293b)',
            'box-shadow:0 2px 12px rgba(0,0,0,0.4)',
            'backdrop-filter:blur(6px)',
            '-webkit-backdrop-filter:blur(6px)',
            'pointer-events:all',
            'user-select:none',
            'transition:right 0.3s ease',
        ].join(';');

        const mkBtn = (label, delta) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.style.cssText = [
                'width:22px',
                'height:20px',
                'background:transparent',
                'border:none',
                'color:#8ba4b8',
                'font-family:"JetBrains Mono",monospace',
                'font-size:13px',
                'font-weight:bold',
                'cursor:pointer',
                'display:flex',
                'align-items:center',
                'justify-content:center',
                'transition:color 0.15s,background 0.15s',
                'line-height:1',
                'padding:0',
            ].join(';');
            b.addEventListener('mouseenter', () => { b.style.color = '#fff'; b.style.background = 'rgba(255,255,255,0.08)'; });
            b.addEventListener('mouseleave', () => { b.style.color = '#8ba4b8'; b.style.background = 'transparent'; });

            let holdTimer = null;
            const step = () => {
                this.targetZoom = Math.max(0.5, Math.min(3, this.targetZoom + delta));
            };
            const startHold = () => { step(); holdTimer = setInterval(step, 100); };
            const stopHold = () => { if (holdTimer) { clearInterval(holdTimer); holdTimer = null; } };
            b.addEventListener('pointerdown', (e) => { e.preventDefault(); startHold(); });
            b.addEventListener('pointerup', stopHold);
            b.addEventListener('pointerleave', stopHold);
            return b;
        };

        const zoomOut = mkBtn('−', -0.10);
        const sep = document.createElement('div');
        sep.style.cssText = 'width:1px;height:12px;background:var(--bd,#1e293b);';
        const zoomIn = mkBtn('+', 0.10);

        pill.appendChild(zoomOut);
        pill.appendChild(sep);
        pill.appendChild(zoomIn);
        document.body.appendChild(pill);

        this._zoomPill = pill;
    },

    /** Called from engine.update() or self — hide pill when inappropriate */
    _updateZoomPill() {
        if (!this._zoomPill) return;
        const hide = (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus || G.viewMode === 'macro'))
            || (typeof OrbitMode !== 'undefined' && OrbitMode.active)
            || (typeof XRayMode !== 'undefined' && XRayMode.active);
        this._zoomPill.style.display = hide ? 'none' : 'flex';
        if (!hide) {
            // Stick to the left edge of the minimap (gap 6px)
            const mm = document.getElementById('minimap');
            const mmW = mm && mm.classList.contains('collapsed') ? 80 : 290;
            this._zoomPill.style.right = (12 + mmW + 6) + 'px';
        }
    }
};

