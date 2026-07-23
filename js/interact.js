/* ══════════════════════════════════════════════════════════════════════════
   INTERACTION — crosshair look-detection for buildings & citizens (pure
   math, no raycasts), E-to-inspect, district-entry detection with banners,
   and clickable sky objects (blimps, the moon).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { ACTS } from './data.js';
import { Interior } from './interior.js';

export const Interact = {
    target: null,        // { kind: 'building'|'citizen', ref }
    _timer: 0,
    _raycaster: new THREE.Raycaster(),
    _mouse: new THREE.Vector2(),
    _lastDistrict: null,

    init() {
        document.addEventListener('keydown', e => {
            if (e.code !== 'KeyE' || !G.started || G.panelOpen) return;
            // inside a building, E at the doorway is the way out
            if (G.inside) {
                if (Interior.atExit()) Interior.exit();
                return;
            }
            if (!this.target) return;
            if (this.target.kind === 'citizen') { G.ui.showCitizen(this.target.ref); G.audio?.sfx('open'); return; }
            // close enough to the door to walk in, otherwise just read the plaque
            const p = this.target.ref;
            const cam = G.camera.position;
            const near = Math.hypot(p.x - cam.x, p.z - cam.z) < Math.max(p.w, p.d) / 2 + 60;
            if (near && Interior.canEnter(p.b)) Interior.enter(p.b);
            else { G.ui.showBuilding(p.b); G.audio?.sfx('open'); }
        });
        // clicks — moon (caturday) & blimps
        document.addEventListener('mousedown', e => {
            if (!G.started || G.panelOpen || !G.player.locked) return;
            this._mouse.set(0, 0);
            this._raycaster.setFromCamera(this._mouse, G.camera);
            // blimps
            const blimpObjs = G.traffic.blimps.map(b => b.obj);
            const hits = this._raycaster.intersectObjects(blimpObjs, true);
            if (hits.length) {
                let o = hits[0].object;
                while (o && !o.userData.headline) o = o.parent;
                if (o && o.userData.headline) {
                    G.ui.addToast(`▲ ${o.userData.headline.headline}`);
                    G.progress.unlock('hn_read');
                    G.audio?.sfx('blip');
                    return;
                }
            }
            // moon
            const moon = G.weatherSys.moonSpr;
            if (moon && moon.material.opacity > 0.15) {
                const mh = this._raycaster.intersectObject(moon);
                if (mh.length) {
                    G.stats.moonClicks++;
                    G.audio?.sfx('blip');
                    if (G.stats.moonClicks >= 5) { G.progress.caturday(); G.stats.moonClicks = 0; }
                    else G.ui.addToast(`🌙 ...${5 - G.stats.moonClicks} more`);
                }
            }
        });
    },

    update(dt) {
        this._timer -= dt;
        if (this._timer > 0) return;
        this._timer = 0.12;

        const cam = G.camera;
        const px = cam.position.x, pz = cam.position.z;

        // indoors: the only interaction is the way out
        if (G.inside) {
            this.target = null;
            G.ui.lookLabel(null);
            G.ui.prompt(Interior.atExit() ? '<b>E</b> — step outside' : null);
            return;
        }

        // ── district tracking ──
        const d = G.districtAt(px, pz);
        const dId = d ? d.id : null;
        if (dId !== this._lastDistrict) {
            this._lastDistrict = dId;
            if (d) {
                G.ui.setDistrict(d.label);
                G.ui.banner(d.label, d.biomeDef.label + ' district');
                G.progress.visitDistrict(d.id);
                G.audio?.sfx('district');
            } else {
                G.ui.setDistrict('🛣️ City Streets');
            }
        }

        // ── look target ──
        const fwd = { x: -Math.sin(G.player.yaw), z: -Math.cos(G.player.yaw) };
        let best = null, bestScore = 0.75;   // min dot product ~ facing

        for (const p of G.placements) {
            const dx = p.x - px, dz = p.z - pz;
            const dist = Math.hypot(dx, dz);
            if (dist > 260) continue;
            const reach = Math.max(p.w, p.d) / 2 + 26;
            if (dist > reach + 160) continue;
            const dot = (dx * fwd.x + dz * fwd.z) / (dist || 1);
            if (dot < 0.55) continue;
            // nearer & more centred wins
            const score = dot * 2 - dist / 300;
            if (score > bestScore - 0.75 && (!best || score > best.score)) {
                best = { kind: 'building', ref: p, score };
            }
        }
        // citizens (closer range)
        const cz = G.citizens.nearest(px + fwd.x * 26, pz + fwd.z * 26, 34);
        if (cz) {
            const dx = cz.x - px, dzz = cz.z - pz;
            const dist = Math.hypot(dx, dzz);
            const dot = (dx * fwd.x + dzz * fwd.z) / (dist || 1);
            if (dot > 0.6) best = { kind: 'citizen', ref: cz, score: 10 };   // citizens take priority
        }

        this.target = best;
        if (!best) { G.ui.prompt(null); G.ui.lookLabel(null); return; }

        if (best.kind === 'building') {
            const b = best.ref.b;
            const p = best.ref;
            const near = Math.hypot(p.x - px, p.z - pz) < Math.max(p.w, p.d) / 2 + 60;
            const verb = (near && Interior.canEnter(b)) ? 'enter' : '';
            G.ui.prompt(`<b>E</b> — ${verb ? verb + ' ' : ''}${b.emoji || '🏢'} ${b.name}`);
            G.ui.lookLabel(null);
        } else {
            const c = best.ref;
            G.ui.prompt(`<b>E</b> — meet ${c.model.name}`);
            G.ui.lookLabel(G.citizens.describe(c));
        }
    }
};
