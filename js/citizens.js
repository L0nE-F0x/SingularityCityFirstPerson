/* ══════════════════════════════════════════════════════════════════════════
   CITIZENS — every AI model is a pedestrian. One InstancedMesh (merged
   body geometry, per-instance lab colour), the production getAct() daily
   schedule, Manhattan routing along the road grid, staggered updates.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, EYE_H } from './state.js';
import { LABS, SEED, ROSTER, FOUNDERS, STAGES, ACTS, getStage, getAct } from './data.js';
import { City, KERB_H } from './city.js';

const LAB_HQ = { openai: 'bld_o', anthropic: 'bld_a', google: 'bld_g', meta: 'bld_m', mistral: 'bld_mi', xai: 'bld_x', deepseek: 'bld_ds', other: 'open_square' };

/* Goal-driven archetypes (ported from the 2D app): ~20% of citizens have a
   lifestyle that pulls them to a favourite venue during their free time — a
   gym rat always at the gym, a bar regular at the neon bar, a jogger in the
   park. `acts` are the schedule slots the pull applies to. */
const ARCHETYPES = [
    { id: 'gym_rat',      venue: 'gym',          acts: ['lunch', 'play', 'socialize'] },
    { id: 'foodie',       venue: 'cafe',         acts: ['lunch', 'socialize'] },
    { id: 'bar_regular',  venue: 'neon_bar',     acts: ['socialize', 'play'] },
    { id: 'bookworm',     venue: 'uni_main',     acts: ['socialize', 'play', 'lunch'] },
    { id: 'jogger',       venue: 'central_park', acts: ['play', 'socialize', 'lunch'] },
    { id: 'coffee_addict', venue: 'cafe',        acts: ['lunch', 'play'] },
    { id: 'night_owl',    venue: 'neon_bar',     acts: ['socialize', 'play', 'arena'] }
];

/* A person, ~17.5 units tall (1.75 m). Every vertex carries extra
   attributes so one InstancedMesh can still draw the whole population:

     aLimb  1 = left leg · 2 = right leg · 3 = left arm · 4 = right arm
     aTint  0 = trousers/shoes · 1 = clothing · 2 = skin · 3 = hair
     aPart  0 = body · 1 = head · 2 = hair · 3 = prop (pacifier / backpack / aura)
     aStage per-instance: 0 adult · 1 baby · 2 kid · 3 rumored · 4 retired
              — babies get oversized heads + pacifier, kids a backpack,
                rumored a translucent purple aura (not size-only). */
const SKIN = [0xe8b98e, 0xd79a6a, 0xb87d52, 0x8d5a3b, 0xf0c9a4];
const HAIR = [0x2a2118, 0x4a3524, 0x6b4a2f, 0x1a1a1e, 0x8a6a3a];
export const STAGE_CODE = { adult: 0, baby: 1, kid: 2, rumored: 3, retired: 4 };

function personGeometry() {
    const parts = [];
    const limbs = [];
    const tints = [];
    const partsId = [];
    const box = (w, h, d, x, y, z, hex, limb, tint, part = 0) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        const n = g.attributes.position.count;
        const col = new THREE.Color(hex);
        const c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
        for (let i = 0; i < n; i++) { limbs.push(limb); tints.push(tint); partsId.push(part); }
        parts.push(g);
    };
    // legs + shoes swing together as one limb
    box(2.7, 7.2, 2.5, -1.7, 3.6, 0, 0x39414f, 1, 0);   // left leg
    box(2.7, 7.2, 2.5, 1.7, 3.6, 0, 0x39414f, 2, 0);    // right leg
    box(2.9, 1.1, 3.6, -1.7, 0.55, 0.5, 0x17191d, 1, 0); // left shoe
    box(2.9, 1.1, 3.6, 1.7, 0.55, 0.5, 0x17191d, 2, 0);  // right shoe
    box(6.4, 7.2, 3.4, 0, 10.6, 0, 0xffffff, 0, 1);      // torso — lab colour
    box(1.7, 6.4, 2.0, -4.0, 10.9, 0, 0xffffff, 3, 1);   // left arm
    box(1.7, 6.4, 2.0, 4.0, 10.9, 0, 0xffffff, 4, 1);    // right arm
    box(4.3, 4.3, 4.1, 0, 16.4, 0, 0xffffff, 0, 2, 1);   // head — skin
    box(4.5, 1.3, 4.3, 0, 18.7, -0.1, 0xffffff, 0, 3, 2); // hair
    // stage props: aLimb 10=pacifier, 11=backpack, 12=aura (keeps attribute count low)
    box(1.4, 1.0, 1.4, 0, 15.2, 2.4, 0xff6bb5, 10, 0, 1);  // pacifier (baby)
    box(3.6, 4.2, 2.0, 0, 11.0, -2.8, 0x2563eb, 11, 0, 0); // backpack (kid)
    box(7.2, 7.2, 7.2, 0, 12.0, 0, 0xa78bfa, 12, 0, 0);    // rumored aura shell
    const geo = mergeGeometries(parts, false);
    geo.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(limbs), 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(tints), 1));
    // aPart packed: 0 body · 1 head · 2 hair (props use aLimb ≥ 10)
    geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(partsId), 1));
    return geo;
}

/* Swings the limbs in the vertex shader. `transformed` is in model space here
   — the instance matrix is applied afterwards in project_vertex — so a plain
   rotation about the hip/shoulder is all that's needed. */
function applyWalkShader(mat) {
    mat.onBeforeCompile = (shader) => {
        // Pack instance floats into one vec3 (aAnim = phase, walk, stage) to stay
        // under WebGL attribute limits (aSkin + aHair already cost 6 slots).
        shader.vertexShader = `
            attribute float aLimb;
            attribute float aTint;
            attribute float aPart;
            attribute vec3 aAnim;
            attribute vec3 aSkin;
            attribute vec3 aHair;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
            vec3 transformed = vec3( position );
            float aPhase = aAnim.x;
            float aWalk  = aAnim.y;
            float aStage = aAnim.z;
            // stage props via aLimb codes 10/11/12
            if ( aLimb > 9.5 ) {
                bool show = false;
                if ( aLimb < 10.5 && aStage > 0.5 && aStage < 1.5 ) show = true;
                else if ( aLimb > 10.5 && aLimb < 11.5 && aStage > 1.5 && aStage < 2.5 ) show = true;
                else if ( aLimb > 11.5 && aStage > 2.5 && aStage < 3.5 ) show = true;
                if ( !show ) transformed *= 0.0;
            }
            // baby: oversized head + hair
            if ( aStage > 0.5 && aStage < 1.5 && aPart > 0.5 && aPart < 2.5 ) {
                transformed.xyz = (transformed.xyz - vec3(0.0, 16.4, 0.0)) * 1.45 + vec3(0.0, 15.6, 0.0);
            }
            // kid: slightly larger head
            if ( aStage > 1.5 && aStage < 2.5 && aPart > 0.5 && aPart < 2.5 ) {
                transformed.xyz = (transformed.xyz - vec3(0.0, 16.4, 0.0)) * 1.18 + vec3(0.0, 16.1, 0.0);
            }
            if ( aLimb > 0.5 && aLimb < 5.0 ) {
                float s = sin( aPhase );
                float ang, pivot;
                if ( aLimb < 1.5 )      { ang =  s; pivot = 7.2; }
                else if ( aLimb < 2.5 ) { ang = -s; pivot = 7.2; }
                else if ( aLimb < 3.5 ) { ang = -s; pivot = 14.0; }
                else                    { ang =  s; pivot = 14.0; }
                ang *= aWalk * 0.6;
                float ca = cos( ang ), sa = sin( ang );
                float py = transformed.y - pivot;
                transformed.y = py * ca - transformed.z * sa + pivot;
                transformed.z = py * sa + transformed.z * ca;
            }
            // rumored: slight float bob
            if ( aStage > 2.5 && aStage < 3.5 ) {
                transformed.y += sin( aPhase * 0.7 ) * 1.2;
            }
        `);
        // route each vertex to the right colour source
        shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', `
            vColor = color;
            float aStageC = aAnim.z;
            if ( aTint > 2.5 )      vColor = aHair;
            else if ( aTint > 1.5 ) vColor = aSkin;
            #ifdef USE_INSTANCING_COLOR
                else if ( aTint > 0.5 ) vColor *= instanceColor.xyz;
            #endif
            if ( aStageC > 0.5 && aStageC < 1.5 && aTint > 0.5 && aTint < 1.5 )
                vColor = mix(vColor, vec3(1.0, 0.72, 0.86), 0.55);
            if ( aStageC > 1.5 && aStageC < 2.5 && aTint > 0.5 && aTint < 1.5 )
                vColor = mix(vColor, vec3(0.35, 0.65, 1.0), 0.4);
            if ( aStageC > 2.5 && aStageC < 3.5 )
                vColor = mix(vColor, vec3(0.66, 0.55, 0.98), 0.45);
            if ( aLimb > 11.5 ) vColor = vec3(0.66, 0.55, 0.98);
            if ( aLimb > 9.5 && aLimb < 10.5 ) vColor = vec3(1.0, 0.42, 0.71);
            if ( aLimb > 10.5 && aLimb < 11.5 ) vColor = vec3(0.15, 0.39, 0.92);
        `);
    };
    mat.customProgramCacheKey = () => 'citizen-walk-stage-v3';
    return mat;
}

export const Citizens = {
    list: [],
    mesh: null,
    _dummy: new THREE.Object3D(),
    _slice: 0,
    _schedTimer: 0,

    init(scene) {
        const target = G.preset.citizens;
        const roster = [];

        // Named famous models
        for (const m of SEED) roster.push({ model: m, named: true });
        // Real-roster models
        for (const r of ROSTER) roster.push({ model: { id: 'r_' + r.name, name: r.name, lab: r.lab, os: r.os, phase: 'released', rel: '2024-01-01' }, named: false });
        // Founders
        for (const f of FOUNDERS) roster.push({ model: { id: 'f_' + f.name, name: f.name, lab: f.lab, os: false, phase: 'released', rel: '2020-01-01', founder: f }, named: true });
        // Generated fillers
        const labKeys = Object.keys(LABS);
        let gi = 0;
        while (roster.length < target) {
            const lab = labKeys[gi % labKeys.length];
            roster.push({
                model: {
                    id: 'gen_' + gi, lab, os: Math.random() < 0.35, phase: 'released', rel: '2024-06-01',
                    name: `${LABS[lab].name.split(' ')[0]}-${['nano', 'mini', 'base', 'plus', 'pro', 'max'][gi % 6]}-${(gi * 7 % 90) + 10}`
                },
                named: false
            });
            gi++;
        }

        this.list = roster.map((r, i) => {
            const m = r.model;
            const stage = m.founder ? 'adult' : getStage(m.rel, m.ret, m.phase);
            const seed = (i * 37 % 100) / 100;
            const region = (LABS[m.lab] && LABS[m.lab].region) || 'us';
            const home = G.bldById['res_' + region] || G.bldById['res_us'];
            // ~20% get a lifestyle archetype (deterministic from the index so
            // it's stable across reschedules)
            const arche = (i % 5 === 0) ? ARCHETYPES[Math.floor(i / 5) % ARCHETYPES.length] : null;
            const c = {
                idx: i, model: m, named: r.named, stage, seed, arche,
                lab: m.lab, homeBid: 'res_' + region,
                x: home.worldX + (Math.random() - 0.5) * 80,
                z: home.worldZ + (Math.random() - 0.5) * 80,
                path: [], wp: 0, speed: (55 + Math.random() * 40) * (STAGES[stage]?.speed || 1),
                act: 'sleep', targetBid: null, idleT: Math.random() * 4,
                dirX: 0, dirZ: 1, bob: Math.random() * 6, walkAmt: 0,
                color: m.founder ? new THREE.Color('#fbbf24')
                    : stage === 'retired' ? new THREE.Color('#6a7280')
                    : stage === 'rumored' ? new THREE.Color('#a78bfa')
                    : new THREE.Color(LABS[m.lab]?.color || '#94a3b8')
            };
            return c;
        });

        const geo = personGeometry();
        const N = this.list.length;
        // per-instance: aAnim.xyz = phase, walk, stageCode; plus skin + hair
        this.anim = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
        const skin = new Float32Array(N * 3), hair = new Float32Array(N * 3);
        const tmp = new THREE.Color();
        this.list.forEach((c, i) => {
            tmp.set(SKIN[Math.floor(c.seed * 100) % SKIN.length]);
            skin[i * 3] = tmp.r; skin[i * 3 + 1] = tmp.g; skin[i * 3 + 2] = tmp.b;
            tmp.set(HAIR[Math.floor(c.seed * 37) % HAIR.length]);
            hair[i * 3] = tmp.r; hair[i * 3 + 1] = tmp.g; hair[i * 3 + 2] = tmp.b;
            this.anim.array[i * 3 + 2] = STAGE_CODE[c.stage] ?? 0;
        });
        geo.setAttribute('aAnim', this.anim);
        geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3));
        geo.setAttribute('aHair', new THREE.InstancedBufferAttribute(hair, 3));

        const mat = applyWalkShader(new THREE.MeshLambertMaterial({ vertexColors: true }));
        this.mesh = new THREE.InstancedMesh(geo, mat, N);
        this.mesh.frustumCulled = false; // spread over the whole city; skip per-frame bounds cost
        this.list.forEach((c, i) => {
            this._writeMatrix(c);
            this.mesh.setColorAt(i, c.color);
        });
        this.mesh.instanceMatrix.needsUpdate = true;
        scene.add(this.mesh);
        this._assignAll();
    },

    _writeMatrix(c) {
        const d = this._dummy;
        const s = STAGES[c.stage]?.size || 1;
        // stand ON the kerb, not sunk into it
        const ground = City.onSidewalk(c.x, c.z) ? KERB_H : 0;
        d.position.set(c.x, ground + Math.abs(Math.sin(c.bob)) * 0.35 * c.walkAmt, c.z);
        d.rotation.y = Math.atan2(c.dirX, c.dirZ);
        d.scale.setScalar(s);
        d.updateMatrix();
        this.mesh.setMatrixAt(c.idx, d.matrix);
        this.anim.array[c.idx * 3] = c.bob;
        this.anim.array[c.idx * 3 + 1] = c.walkAmt;
        this.anim.array[c.idx * 3 + 2] = STAGE_CODE[c.stage] ?? 0;
    },

    _assignAll() {
        this._bidCount = new Map();
        for (const c of this.list) this._assign(c, true);
    },

    /* The ported schedule sends everyone to a single named venue — 45% of the
       city to `cafe`, the whole US roster to `res_us`. That reads fine in the
       2D app; at street level it is 100 people standing on one doormat. Each
       citizen gets its own spot on a golden-angle spiral around the venue, so
       a crowd spreads down the street instead of stacking up. */
    _venueSpot(c, tb) {
        const k = c.venueSlot || 0;
        const r = Math.max(tb.worldW, tb.worldD) / 2 + 26 + 22 * Math.sqrt(k);
        const a = k * 2.39996;                       // golden angle
        return City.offRoad(tb.worldX + Math.cos(a) * r, tb.worldZ + Math.sin(a) * r);
    },

    _assign(c, snap) {
        const { act, bid } = getAct(c.stage, G.dayPhase, c.seed, c.model);
        c.act = act;
        // resolve target building
        let targetBid = bid;
        if (!targetBid) {
            if (act === 'work' || act === 'train') targetBid = LAB_HQ[c.lab] || 'open_square';
            else if (act === 'commute') targetBid = c.homeBid;
            else targetBid = LAB_HQ[c.lab] || c.homeBid;
        }
        if (c.stage === 'retired') targetBid = 'graveyard';
        if (c.model.founder) targetBid = act === 'sleep' ? c.homeBid : (LAB_HQ[c.lab] || c.homeBid);
        // archetype pull: during free time, head to your favourite haunt
        if (c.arche && c.arche.acts.includes(act) && G.bldById[c.arche.venue]) {
            targetBid = c.arche.venue;
        }
        c.targetBid = targetBid;
        const tb = G.bldById[targetBid];
        if (!tb) return;

        // claim a spot at this venue for the walk in
        if (!this._bidCount) this._bidCount = new Map();
        const k = this._bidCount.get(targetBid) || 0;
        this._bidCount.set(targetBid, k + 1);
        c.venueSlot = k;

        if (snap) {
            // scatter: some already at their building, some en route
            if (Math.random() < 0.6) {
                const p = this._venueSpot(c, tb);
                c.x = p.x; c.z = p.z;
                c.path = [];
            } else {
                this._routeTo(c, tb);
            }
        } else if (c.targetBid !== c._lastBid) {
            this._routeTo(c, tb);
        }
        c._lastBid = targetBid;
    },

    // Route on the SIDEWALKS, not down the middle of the carriageway. The old
    // version offset the whole path by one random "lane" value, which put most
    // of the population on the tarmac walking through traffic. Each leg now
    // picks the pavement on the side nearest where the walker is coming from,
    // and the corner turns happen on that pavement.
    _routeTo(c, tb) {
        const spot = this._venueSpot(c, tb);
        const tx = spot.x, tz = spot.z;
        const i1 = City.nearestIntersection(c.x, c.z);
        const i2 = City.nearestIntersection(tx, tz);
        // walk the x-leg along the street at i1.z, then the z-leg up i2.x
        const sideZ = (c.z >= i1.z) ? 1 : -1;          // pavement of the street
        const sideX = (tx >= i2.x) ? 1 : -1;           // pavement of the avenue
        const walkZ = City.sidewalkCentre(i1.z, false, sideZ);
        const walkX = City.sidewalkCentre(i2.x, true, sideX);
        c.path = [];
        c.path.push({ x: c.x, z: walkZ });              // step out to the kerb
        c.path.push({ x: walkX, z: walkZ });            // along the street
        c.path.push({ x: walkX, z: tz });               // up the avenue
        c.path.push({ x: tx, z: tz });                  // in to the door
        c.wp = 0;
    },

    update(dt) {
        if (!this.mesh) return;
        // re-schedule every ~20s of real time
        this._schedTimer += dt;
        if (this._schedTimer > 20) {
            this._schedTimer = 0;
            this._bidCount = new Map();      // re-deal the venue spots
            for (const c of this.list) this._assign(c, false);
        }

        // staggered movement: half the roster per frame
        const n = this.list.length;
        const half = Math.ceil(n / 2);
        const start = this._slice * half;
        this._slice = (this._slice + 1) % 2;
        const step = dt * 2;

        for (let k = 0; k < half; k++) {
            const c = this.list[(start + k) % n];
            if (c.path.length && c.wp < c.path.length) {
                const t = c.path[c.wp];
                const dx = t.x - c.x, dz = t.z - c.z;
                const dist = Math.hypot(dx, dz);
                if (dist < 6) { c.wp++; continue; }
                const v = c.speed * step;
                c.x += (dx / dist) * v;
                c.z += (dz / dist) * v;
                c.dirX = dx / dist; c.dirZ = dz / dist;
                // stride rate follows walking speed; the shader swings the
                // limbs off this phase
                c.bob += step * (c.speed / 12);
                c.walkAmt = Math.min(1, c.walkAmt + step * 4);
            } else {
                // idle wander near target
                c.idleT -= step;
                if (c.idleT <= 0) {
                    c.idleT = 2 + Math.random() * 5;
                    const tb = G.bldById[c.targetBid];
                    if (tb) {
                        // shuffle about near your own spot, never into traffic
                        const s = this._venueSpot(c, tb);
                        c.path = [City.offRoad(s.x + (Math.random() - 0.5) * 44,
                            s.z + (Math.random() - 0.5) * 44)];
                        c.wp = 0;
                    }
                }
                c.walkAmt = Math.max(0, c.walkAmt - step * 4);
            }
            this._writeMatrix(c);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        this.anim.needsUpdate = true;
    },

    // nearest citizen within maxDist of a point (for interaction)
    nearest(x, z, maxDist) {
        let best = null, bd = maxDist;
        for (const c of this.list) {
            const d = Math.hypot(c.x - x, c.z - z);
            if (d < bd) { bd = d; best = c; }
        }
        return best;
    },

    describe(c) {
        const a = ACTS[c.act] || ACTS.sleep;
        const st = STAGES[c.stage] || STAGES.adult;
        return `${st.emoji} ${c.model.name} — ${a.verb}`;
    },

    /** Counts by visual stage code — used by parity harness. */
    stageBreakdown() {
        const out = { baby: 0, kid: 0, adult: 0, rumored: 0, retired: 0 };
        for (const c of this.list) {
            if (out[c.stage] != null) out[c.stage]++;
            else out.adult++;
        }
        return out;
    },

    /** True when non-adult stages get props / morphs beyond size alone. */
    hasDistinctAgingLooks() {
        return !!(this.mesh && this.mesh.geometry.getAttribute('aAnim')
            && this.mesh.geometry.getAttribute('aPart')
            && this.mesh.geometry.getAttribute('aLimb'));
    }
};
