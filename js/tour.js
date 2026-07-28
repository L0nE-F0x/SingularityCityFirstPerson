/* ══════════════════════════════════════════════════════════════════════════
   AUTO-TOUR — cinematic flying circuit of the city's landmarks (T key).
   Glide → dwell → glide… Any input hands the camera back to the player.

   Also doubles as the AFK screensaver (ported from the 2D auto-tour):
     • After `idleTourMin` minutes of no input the tour auto-starts
       (unless disabled in Settings → Idle auto-tour).
     • Manual T toggle always works regardless of the idle preference.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, EYE_H } from './state.js';
import { TOUR_STOPS } from './data.js';

export const Tour = {
    active: false,
    _idx: 0, _phase: 'glide', _t: 0,
    _from: new THREE.Vector3(), _to: new THREE.Vector3(),
    _fromLook: new THREE.Vector3(), _toLook: new THREE.Vector3(),
    _stopsVisited: 0,
    GLIDE: 6, DWELL: 4.2,

    // Idle / screensaver
    _bootOk: false,
    _lastInputAt: 0,
    _fromIdle: false,
    IDLE_MS: 300000,   // 5 min default (overridden by G.settings.idleTourMin)

    init() {
        if (this._bootOk) return;
        this._bootOk = true;
        this._lastInputAt = performance.now();

        const bump = () => this._onUserInput();
        window.addEventListener('pointerdown', bump, true);
        window.addEventListener('pointermove', (e) => {
            if (this._lastMoveX === undefined) {
                this._lastMoveX = e.clientX;
                this._lastMoveY = e.clientY;
                return;
            }
            const dx = e.clientX - this._lastMoveX;
            const dy = e.clientY - this._lastMoveY;
            if (dx * dx + dy * dy < 16) return;
            this._lastMoveX = e.clientX;
            this._lastMoveY = e.clientY;
            bump();
        }, true);
        window.addEventListener('wheel', bump, { capture: true, passive: true });
        window.addEventListener('touchstart', bump, { capture: true, passive: true });
        // KeyT is owned by UI.toggle — don't treat it as "stop via input" or a
        // single press would stop then re-start in the same event chain.
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT') {
                this._lastInputAt = performance.now();
                return;
            }
            bump();
        }, true);
    },

    _onUserInput() {
        this._lastInputAt = performance.now();
        // Any real input cancels an active tour (manual or screensaver).
        // Grace so residual mouse motion right after start doesn't kill it.
        if (this.active && (performance.now() - (this._startedAt || 0)) > 500) {
            this.stop();
        }
    },

    toggle() {
        this.active ? this.stop() : this.start(false);
    },

    start(fromIdle = false) {
        if (this.active) return;
        if (!this._canStart()) {
            if (!fromIdle) G.ui?.addToast?.('Auto-tour unavailable in this mode', 'info');
            return;
        }
        this.active = true;
        this._fromIdle = !!fromIdle;
        this._startedAt = performance.now();
        G.tourMode = true;
        this._idx = 0;
        this._stopsVisited = 0;
        // Exit free-fly / orbit if somehow still flagged (defensive)
        if (G.flyMode && G.flyModeSys?.active) G.flyModeSys.exit();
        if (G.orbitMode && G.orbitModeSys?.state?.active) G.orbitModeSys.exit();

        G._suppressPauseOnUnlock = true;
        G.player.unlock();
        G.ui.els.tourCaption.classList.remove('hidden');
        G.ui.addToast(fromIdle
            ? '🎬 Screensaver tour — move or press a key to exit'
            : '🎬 Auto-tour started — any key to exit');
        this._beginLeg(true);
        this._showOverlay(true, fromIdle);
    },

    stop() {
        if (!this.active) return;
        this.active = false;
        G.tourMode = false;
        this._fromIdle = false;
        G.ui.els.tourCaption.classList.add('hidden');
        this._showOverlay(false);
        // hand the camera back at ground level near the last stop
        const p = G.camera.position;
        G.player.teleport(p.x, p.z, G.player.yaw);
        G.player.lock();
        this._lastInputAt = performance.now();
    },

    _canStart() {
        if (!G.started || G.paused || G.panelOpen || G.terminalOpen) return false;
        if (G.inside || G.ridingMetro || G.orbitMode || G.xrayMode || G.holomapMode) return false;
        if (G.flyMode) return false;
        if (G.tutorial?.active || G.dailyBriefing?.active) return false;
        return true;
    },

    _showOverlay(on, fromIdle) {
        if (!this._overlayEl) {
            const el = document.createElement('div');
            el.id = 'autoTourOverlay';
            el.style.cssText = [
                'position:fixed',
                'top:max(12px, env(safe-area-inset-top))',
                'right:max(12px, env(safe-area-inset-right))',
                'z-index:99998',
                'padding:5px 12px',
                'background:rgba(0,0,0,0.55)',
                'border:1px solid rgba(120,220,255,0.3)',
                'border-radius:20px',
                'color:#8df',
                'font:8px/1.4 "Press Start 2P","Courier New",monospace',
                'letter-spacing:0.5px',
                'text-shadow:0 0 4px rgba(120,220,255,0.4)',
                'pointer-events:none',
                'opacity:0',
                'transition:opacity 400ms ease',
                'user-select:none',
                'backdrop-filter:blur(2px)',
                '-webkit-backdrop-filter:blur(2px)',
                'white-space:nowrap'
            ].join(';');
            el.innerHTML =
                '<span style="color:#9fd;margin-right:6px">◆</span>' +
                '<span id="autoTourLabel" style="color:#cfe">AUTO-TOUR</span>';
            document.body.appendChild(el);
            this._overlayEl = el;
            this._labelEl = el.querySelector('#autoTourLabel');
        }
        if (this._labelEl) {
            this._labelEl.textContent = fromIdle ? 'SCREENSAVER' : 'AUTO-TOUR';
        }
        this._overlayEl.style.opacity = on ? '1' : '0';
    },

    _stopPos(i) {
        const stop = TOUR_STOPS[i % TOUR_STOPS.length];
        const b = G.bldById[stop.bid];
        if (!b) return null;
        // view from the south-east, elevated, framed on the building
        const dx = 150 + (i % 3) * 40, dz = 150 + ((i + 1) % 3) * 40;
        return {
            look: new THREE.Vector3(b.worldX, Math.min(b.worldH * 0.6, 90), b.worldZ),
            pos: new THREE.Vector3(b.worldX + dx, 60 + Math.min(b.worldH * 0.45, 110), b.worldZ + dz),
            cap: stop.cap
        };
    },

    _beginLeg(first) {
        const s = this._stopPos(this._idx);
        if (!s) { this._idx++; if (this._idx >= TOUR_STOPS.length) this.stop(); else this._beginLeg(first); return; }
        this._from.copy(G.camera.position);
        this._fromLook.copy(this._lookTarget());
        this._to.copy(s.pos);
        this._toLook.copy(s.look);
        this._phase = 'glide';
        this._t = 0;
        G.ui.els.tourCaption.textContent = s.cap;
        this._stopsVisited++;
    },

    _lookTarget() {
        const fwd = new THREE.Vector3(0, 0, -1).applyEuler(G.camera.rotation);
        return G.camera.position.clone().add(fwd.multiplyScalar(100));
    },

    update(dt) {
        // Idle watchdog — runs even when tour is inactive
        if (this._bootOk && !this.active && G.started) {
            const prefsOn = G.settings.autoTour !== false;
            if (prefsOn) {
                const idleMin = (G.settings.idleTourMin > 0) ? G.settings.idleTourMin : 5;
                const idleMs = idleMin * 60000;
                if (performance.now() - this._lastInputAt >= idleMs && this._canStart()) {
                    this.start(true);
                }
            }
        }

        if (!this.active) return;
        this._t += dt;
        const cam = G.camera;
        if (this._phase === 'glide') {
            const k = Math.min(1, this._t / this.GLIDE);
            const e = k * k * (3 - 2 * k);   // smoothstep
            cam.position.lerpVectors(this._from, this._to, e);
            const look = new THREE.Vector3().lerpVectors(this._fromLook, this._toLook, e);
            cam.lookAt(look);
            if (k >= 1) { this._phase = 'dwell'; this._t = 0; }
        } else {
            // gentle orbit while dwelling
            const look = this._toLook;
            cam.position.x = this._to.x + Math.sin(this._t * 0.25) * 14;
            cam.position.z = this._to.z + Math.cos(this._t * 0.25) * 14;
            cam.lookAt(look);
            if (this._t >= this.DWELL) {
                this._idx++;
                if (this._idx >= TOUR_STOPS.length) {
                    G.progress.unlock('tour_guide');
                    G.ui.addToast('🎬 Tour complete!');
                    // Screensaver loops forever; manual tour ends with the achievement
                    if (this._fromIdle) {
                        this._idx = 0;
                        this._beginLeg();
                    } else {
                        this.stop();
                    }
                } else this._beginLeg();
            }
        }
    }
};
