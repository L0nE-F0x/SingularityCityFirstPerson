/* ══════════════════════════════════════════════════════════════════════════
   COURT SYSTEM — docket of alignment hearings at court_hearing / court_senate.
   Cases cycle through queued → hearing → ruled.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';

export const COURT_BIDS = ['court_hearing', 'court_senate'];
const CASE_TYPES = [
    'alignment audit', 'safety review', 'compute export license',
    'open-weights hearing', 'data provenance case', 'agent liability'
];

export function createCourtState() {
    return {
        docket: [],
        rulings: 0,
        current: null,
        hearingT: 0
    };
}

export function enqueueCase(state, title, defendant = 'Unknown Model') {
    state.docket.push({
        id: 'case_' + (state.rulings + state.docket.length + 1),
        title,
        defendant,
        status: 'queued'
    });
    return state.docket[state.docket.length - 1];
}

export function stepCourt(state, dt) {
    if (!state.current) {
        const next = state.docket.find(c => c.status === 'queued');
        if (next) {
            next.status = 'hearing';
            state.current = next;
            state.hearingT = 6 + Math.random() * 4;
        }
        return null;
    }
    state.hearingT -= dt;
    if (state.hearingT <= 0) {
        state.current.status = 'ruled';
        state.rulings++;
        const done = state.current;
        state.current = null;
        // prune finished
        state.docket = state.docket.filter(c => c.status !== 'ruled').concat([done]);
        if (state.docket.length > 20) state.docket = state.docket.slice(-12);
        return done;
    }
    return null;
}

export const Court = {
    state: createCourtState(),
    gavel: null,
    _spawnT: 0,
    active: true,

    init(scene) {
        this.state = createCourtState();
        // seed docket
        for (let i = 0; i < 4; i++) {
            enqueueCase(this.state, CASE_TYPES[i % CASE_TYPES.length], 'Model-' + (10 + i));
        }
        const b = G.bldById['court_hearing'] || G.bldById['court_senate'];
        if (b && scene) {
            const geo = new THREE.CylinderGeometry(8, 10, 6, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
            this.gavel = new THREE.Mesh(geo, mat);
            this.gavel.position.set(b.worldX + 30, 30, b.worldZ + 30);
            scene.add(this.gavel);
        }
    },

    update(dt) {
        if (!this.active) return;
        this._spawnT += dt;
        if (this._spawnT > 14) {
            this._spawnT = 0;
            const t = CASE_TYPES[Math.floor(Math.random() * CASE_TYPES.length)];
            const def = G.citizens?.list?.[Math.floor(Math.random() * (G.citizens.list.length || 1))];
            enqueueCase(this.state, t, def?.model?.name || 'Citizen');
        }
        const ruled = stepCourt(this.state, dt);
        if (ruled && G.ui) {
            // soft toast only occasionally
            if (this.state.rulings % 3 === 0) {
                G.ui.banner?.('⚖️ Court Ruling', `${ruled.defendant}: ${ruled.title}`);
            }
        }
        if (this.gavel) {
            this.gavel.rotation.y += dt * 0.4;
            this.gavel.position.y = 28 + (this.state.current ? Math.sin(G.time * 6) * 3 : 0);
        }
    },

    snapshot() {
        return {
            docket: this.state.docket.length,
            rulings: this.state.rulings,
            current: this.state.current ? this.state.current.title : null,
            venues: COURT_BIDS.filter(id => G.bldById?.[id])
        };
    }
};
