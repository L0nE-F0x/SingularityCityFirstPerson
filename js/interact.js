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

            // Riding metro: E alights when train is dwelling
            if (G.ridingMetro && G.metro) {
                const t = G.metro.trains[G.metro.riding];
                if (t && t.atStop && t.dwellT > 0.2) G.metro.alight();
                else G.ui?.addToast?.('Wait for the next station…', 'info');
                return;
            }

            // Inside a building
            if (G.inside) {
                // Elevator call when standing at lift
                if (Interior.atLift() && Interior.maxFloor > 0) {
                    Interior.setFloor((Interior.floor + 1) % (Interior.maxFloor + 1));
                    return;
                }
                // Platform boarding (metro upper floor)
                if (G.inside.type === 'metro' && Interior.floor === Interior.maxFloor && G.metro) {
                    const hit = G.metro.trainAtStop(G.inside.id);
                    if (hit) { G.metro.board(hit.index); return; }
                    G.ui?.addToast?.('No train at the platform — wait a moment', 'info');
                    return;
                }
                if (Interior.atExit()) Interior.exit();
                return;
            }

            // Street: board if a train is dwelling at the nearest station
            if (G.metro) {
                const cam = G.camera.position;
                const board = G.metro.canBoardNear(cam.x, cam.z);
                if (board) { G.metro.board(board.index); return; }
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

        // riding metro
        if (G.ridingMetro && G.metro) {
            this.target = null;
            G.ui.lookLabel(null);
            const t = G.metro.trains[G.metro.riding];
            if (t && t.atStop && t.dwellT > 0.2) {
                const st = G.bldById[t.atStop];
                G.ui.prompt(`<b>E</b> — alight at ${st?.name || t.atStop}`);
            } else {
                G.ui.prompt('Metro — next stop soon…');
            }
            return;
        }

        // indoors: exit, elevator, or board from platform
        if (G.inside) {
            this.target = null;
            const flLabel = Interior.maxFloor > 0 ? ` · Floor ${Interior.floor}/${Interior.maxFloor}` : '';
            G.ui.lookLabel(G.inside.name + flLabel);
            if (Interior.maxFloor > 0 && Interior.atLift()) {
                G.ui.prompt(`<b>E</b> ride lift · <b>F</b> next · <b>0–${Interior.maxFloor}</b> jump  (now F${Interior.floor})`);
            } else if (Interior.maxFloor > 0) {
                G.ui.prompt(`Walk to the <b>lift bank</b> (left wall) · F${Interior.floor}/${Interior.maxFloor} · or press <b>F</b>`);
            } else if (G.inside.type === 'metro' && Interior.floor === Interior.maxFloor && G.metro) {
                const hit = G.metro.trainAtStop(G.inside.id);
                G.ui.prompt(hit ? '<b>E</b> — board the train' : 'Platform — waiting for a train…');
            } else if (Interior.atExit()) {
                G.ui.prompt('<b>E</b> — step outside');
            } else {
                G.ui.prompt(null);
            }
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

                // Street metro board opportunity (takes priority when train is dwelling)
        if (G.metro && !G.inside) {
            const board = G.metro.canBoardNear(px, pz);
            if (board) {
                this.target = null;
                G.ui.lookLabel(null);
                G.ui.prompt(`<b>E</b> — board metro at ${board.station.name}`);
                return;
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
