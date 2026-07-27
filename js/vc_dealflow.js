/* ══════════════════════════════════════════════════════════════════════════
   VC DEAL-FLOW — partners leave VC Row offices, travel to lab HQs, hold a
   handshake beat, then return. Pure simulation is separable from draw setup
   so routes and beats can be exercised without WebGL.
   Perf: one InstancedMesh for all partners + one for handshake sparkles.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { City, KERB_H } from './city.js';

export const VC_OFFICES = [
    'vcrow_apex', 'vcrow_horizon', 'vcrow_launchpad',
    'vcrow_titan', 'vcrow_exchange', 'vcrow_cryptex',
    'vcrow_thrive', 'vcrow_foundersfund', 'vcrow_mgx'
];
export const HQ_TARGETS = [
    'bld_o', 'bld_a', 'bld_g', 'bld_m', 'bld_mi', 'bld_ds', 'bld_x'
];

/** Deterministic partner roster for a given seed (testable without scene). */
export function buildPartners(seed = 1) {
    const list = [];
    for (let i = 0; i < VC_OFFICES.length; i++) {
        const hq = HQ_TARGETS[(i * 3 + seed) % HQ_TARGETS.length];
        list.push({
            id: 'vc_partner_' + i,
            homeBid: VC_OFFICES[i],
            targetBid: hq,
            phase: 'travel',       // travel | handshake | return | wait
            handshakeT: 0,
            waitT: 2 + (i % 4),
            x: 0, z: 0,
            path: [], wp: 0,
            speed: 70 + (i % 3) * 8,
            dirX: 0, dirZ: 1,
            bob: i * 1.7,
            deals: 0
        });
    }
    return list;
}

export function routeAlongSidewalk(fromX, fromZ, toX, toZ) {
    const i1 = City.nearestIntersection(fromX, fromZ);
    const i2 = City.nearestIntersection(toX, toZ);
    const sideZ = (fromZ >= i1.z) ? 1 : -1;
    const sideX = (toX >= i2.x) ? 1 : -1;
    const walkZ = City.sidewalkCentre(i1.z, false, sideZ);
    const walkX = City.sidewalkCentre(i2.x, true, sideX);
    return [
        { x: fromX, z: walkZ },
        { x: walkX, z: walkZ },
        { x: walkX, z: toZ },
        { x: toX, z: toZ }
    ];
}

/** Advance one partner one step. Returns true if a deal completed this step. */
export function stepPartner(p, dt, bldAt) {
    let dealDone = false;
    const home = bldAt(p.homeBid);
    const target = bldAt(p.targetBid);
    if (!home || !target) return false;

    if (p.phase === 'wait') {
        p.waitT -= dt;
        if (p.waitT <= 0) {
            p.phase = 'travel';
            p.targetBid = HQ_TARGETS[Math.floor(Math.abs(Math.sin(p.bob + p.deals)) * HQ_TARGETS.length) % HQ_TARGETS.length];
            const t = bldAt(p.targetBid) || target;
            p.path = routeAlongSidewalk(p.x, p.z, t.worldX + 40, t.worldZ + 50);
            p.wp = 0;
        }
        return false;
    }

    if (p.phase === 'handshake') {
        p.handshakeT -= dt;
        p.bob += dt * 8;
        if (p.handshakeT <= 0) {
            p.deals++;
            dealDone = true;
            p.phase = 'return';
            p.path = routeAlongSidewalk(p.x, p.z, home.worldX + 30, home.worldZ + 40);
            p.wp = 0;
        }
        return dealDone;
    }

    // travel / return — walk path
    if (!p.path.length || p.wp >= p.path.length) {
        if (p.phase === 'travel') {
            p.phase = 'handshake';
            p.handshakeT = 2.2;
        } else if (p.phase === 'return') {
            p.phase = 'wait';
            p.waitT = 4 + (p.deals % 5);
        }
        return false;
    }
    const t = p.path[p.wp];
    const dx = t.x - p.x, dz = t.z - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 8) { p.wp++; return false; }
    const v = p.speed * dt;
    p.x += (dx / dist) * v;
    p.z += (dz / dist) * v;
    p.dirX = dx / dist; p.dirZ = dz / dist;
    p.bob += dt * (p.speed / 14);
    return false;
}

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

function partnerGeo() {
    const parts = [];
    const box = (w, h, d, x, y, z, hex) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(paint(g, hex));
    };
    box(2.6, 6.8, 2.4, -1.5, 3.4, 0, 0x1e293b);
    box(2.6, 6.8, 2.4, 1.5, 3.4, 0, 0x1e293b);
    box(6.2, 7.0, 3.2, 0, 10.4, 0, 0x0f172a);     // suit
    box(4.2, 4.2, 4.0, 0, 16.2, 0, 0xf0c9a4);       // head
    box(4.4, 1.2, 4.2, 0, 18.5, 0, 0x111827);       // hair
    box(2.2, 1.4, 0.6, 0, 12.2, 1.8, 0xfbbf24);     // gold tie
    return mergeGeometries(parts, false);
}

export const VCDealFlow = {
    partners: [],
    mesh: null,
    spark: null,
    dealsCompleted: 0,
    _dummy: new THREE.Object3D(),
    active: true,

    init(scene) {
        this.partners = buildPartners(7);
        for (const p of this.partners) {
            const home = G.bldById[p.homeBid];
            if (home) {
                p.x = home.worldX + 35;
                p.z = home.worldZ + 45;
            }
            const t = G.bldById[p.targetBid];
            if (t) {
                p.path = routeAlongSidewalk(p.x, p.z, t.worldX + 40, t.worldZ + 50);
                p.wp = 0;
            }
        }
        const N = this.partners.length;
        this.mesh = new THREE.InstancedMesh(
            partnerGeo(),
            new THREE.MeshLambertMaterial({ vertexColors: true }),
            N
        );
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        // handshake sparkles (tiny gold cubes, one per partner)
        this.spark = new THREE.InstancedMesh(
            new THREE.BoxGeometry(3, 3, 3),
            new THREE.MeshBasicMaterial({ color: 0xfbbf24 }),
            N
        );
        this.spark.frustumCulled = false;
        scene.add(this.spark);
        this._write();
    },

    _bld(id) { return G.bldById[id]; },

    update(dt) {
        if (!this.active || !this.mesh) return;
        for (const p of this.partners) {
            if (stepPartner(p, dt, (id) => this._bld(id))) this.dealsCompleted++;
        }
        this._write();
    },

    _write() {
        const d = this._dummy;
        for (let i = 0; i < this.partners.length; i++) {
            const p = this.partners[i];
            const ground = City.onSidewalk?.(p.x, p.z) ? KERB_H : 0;
            d.position.set(p.x, ground, p.z);
            d.rotation.y = Math.atan2(p.dirX, p.dirZ);
            // handshake: slight lean / bob
            const s = p.phase === 'handshake' ? 1.05 + Math.sin(p.bob) * 0.04 : 1;
            d.scale.setScalar(s);
            d.updateMatrix();
            this.mesh.setMatrixAt(i, d.matrix);

            if (p.phase === 'handshake') {
                d.position.set(p.x, ground + 14 + Math.sin(p.bob * 2) * 2, p.z);
                d.scale.setScalar(0.6 + Math.sin(p.bob * 3) * 0.2);
                d.updateMatrix();
                this.spark.setMatrixAt(i, d.matrix);
            } else {
                d.position.set(0, -9999, 0);
                d.scale.setScalar(0.01);
                d.updateMatrix();
                this.spark.setMatrixAt(i, d.matrix);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.spark.instanceMatrix.needsUpdate = true;
    },

    /** Snapshot for tests / HUD. */
    snapshot() {
        return {
            partners: this.partners.length,
            dealsCompleted: this.dealsCompleted,
            phases: this.partners.map(p => p.phase),
            nearHq: this.partners.filter(p => p.phase === 'handshake' || p.phase === 'travel').length
        };
    }
};
