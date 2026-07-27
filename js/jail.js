/* ══════════════════════════════════════════════════════════════════════════
   JAIL SYSTEM — models caught jailbreaking get a short detention at the
   AI Detention Center, then release. Pure sim + optional world markers.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

// The AI Detention Center is a real building now; the jail no longer has to
// borrow the Black Market as a holding area.
export const JAIL_BID = 'ai_jail';

export function createJailState() {
    return {
        inmates: [],       // { citizenIdx, name, reason, timeLeft }
        processed: 0,
        capacity: 8
    };
}

export function tryArrest(state, citizen, reason = 'jailbreak attempt') {
    if (!citizen || state.inmates.length >= state.capacity) return false;
    if (state.inmates.some(i => i.citizenIdx === citizen.idx)) return false;
    state.inmates.push({
        citizenIdx: citizen.idx,
        name: citizen.model?.name || 'unknown',
        reason,
        timeLeft: 25 + Math.random() * 20
    });
    return true;
}

export function stepJail(state, dt) {
    const released = [];
    for (const inn of state.inmates) inn.timeLeft -= dt;
    const kept = [];
    for (const inn of state.inmates) {
        if (inn.timeLeft <= 0) {
            released.push(inn);
            state.processed++;
        } else kept.push(inn);
    }
    state.inmates = kept;
    return released;
}

export const Jail = {
    state: createJailState(),
    marker: null,
    _timer: 0,
    active: true,

    init(scene) {
        this.state = createJailState();
        const b = G.bldById[JAIL_BID];
        if (b && scene) {
            const geo = new THREE.BoxGeometry(14, 50, 14);
            const mat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
            this.marker = new THREE.Mesh(geo, mat);
            this.marker.position.set(b.worldX - 40, 25, b.worldZ - 40);
            scene.add(this.marker);
        }
    },

    update(dt) {
        if (!this.active) return;
        this._timer += dt;
        // periodic random arrests of "play" act citizens (jailbreak flavor)
        if (this._timer > 8) {
            this._timer = 0;
            const list = G.citizens?.list || [];
            const candidates = list.filter(c =>
                c.act === 'play' && !this.state.inmates.some(i => i.citizenIdx === c.idx));
            if (candidates.length) {
                const c = candidates[Math.floor(Math.random() * candidates.length)];
                if (tryArrest(this.state, c)) {
                    // teleport detained citizen near jail
                    const jail = G.bldById[JAIL_BID];
                    if (jail) {
                        c.x = jail.worldX + (Math.random() - 0.5) * 40;
                        c.z = jail.worldZ + (Math.random() - 0.5) * 40;
                        c.path = [];
                        c.act = 'sleep';
                        c.targetBid = JAIL_BID;
                    }
                }
            }
        }
        const released = stepJail(this.state, dt);
        for (const inn of released) {
            const c = G.citizens?.list?.[inn.citizenIdx];
            if (c) {
                c.targetBid = c.homeBid;
                c.act = 'commute';
            }
        }
        if (this.marker) {
            this.marker.scale.y = 1 + Math.sin(G.time * 2) * 0.08;
        }
    },

    snapshot() {
        return {
            inmates: this.state.inmates.length,
            processed: this.state.processed,
            capacity: this.state.capacity,
            jailBid: JAIL_BID,
            names: this.state.inmates.map(i => i.name)
        };
    }
};
