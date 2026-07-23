/* ══════════════════════════════════════════════════════════════════════════
   AUTO-TOUR — cinematic flying circuit of the city's landmarks (T key).
   Glide → dwell → glide… Any input hands the camera back to the player.
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

    toggle() {
        this.active ? this.stop() : this.start();
    },

    start() {
        if (this.active) return;
        this.active = true;
        G.tourMode = true;
        this._idx = 0;
        this._stopsVisited = 0;
        G.player.unlock();
        G.ui.els.tourCaption.classList.remove('hidden');
        G.ui.addToast('🎬 Auto-tour started — any key to exit');
        this._beginLeg(true);
        this._keyHandler = () => { if (this.active) this.stop(); };
        document.addEventListener('keydown', this._keyHandler);
        document.addEventListener('mousedown', this._keyHandler);
    },

    stop() {
        if (!this.active) return;
        this.active = false;
        G.tourMode = false;
        G.ui.els.tourCaption.classList.add('hidden');
        document.removeEventListener('keydown', this._keyHandler);
        document.removeEventListener('mousedown', this._keyHandler);
        // hand the camera back at ground level near the last stop
        const p = G.camera.position;
        G.player.teleport(p.x, p.z, G.player.yaw);
        G.player.lock();
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
                    this.stop();
                } else this._beginLeg();
            }
        }
    }
};
