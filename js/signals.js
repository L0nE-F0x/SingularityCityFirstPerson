/* ══════════════════════════════════════════════════════════════════════════
   TRAFFIC SIGNALS — physical, readable traffic lights at every main junction.
   The city already runs one two-phase signal cycle in traffic.js (cars stop at
   reds). That cycle was invisible: nothing on the street told you why traffic
   held. This module plants real signal heads on mast arms over each approach,
   driven from the SAME clock-derived phase, so the lights and the cars agree.

   Draw-call budget: poles + mast arms + housings merge into ONE static mesh.
   The lenses are six InstancedMeshes (red/amber/green × the two road axes);
   each frame we only change six materials' emissiveIntensity — no matrix or
   geometry churn. Seven draw calls for every traffic light in the city.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { City, CARRIAGE, SIDEWALK } from './city.js';

// Must match traffic.js exactly — both derive from G.time so they stay in sync.
const SIGNAL_PERIOD = 26;   // seconds for a full two-phase cycle
const AMBER = 0.06;         // fraction of a half-phase spent on amber

const DARK = 0x14171d;      // pole / arm / housing colour

export const Signals = {
    matsX: null,   // { red, amber, green } for E-W (along-X) approaches
    matsZ: null,   // …for N-S (along-Z) approaches
    _built: false,

    init(scene) {
        if (this._built) return;
        const halfC = CARRIAGE.main / 2;             // 60 — carriageway half-width
        const sw = SIDEWALK.main;                    // 38 — sidewalk width
        const HEAD_Y = 60;                           // head centre height (~6 m)
        const ARM_Y = 70;                            // mast-arm height

        const staticGeos = [];
        // lens instances, split by colour and by which axis' phase they show
        const lensX = { red: [], amber: [], green: [] };
        const lensZ = { red: [], amber: [], green: [] };

        // base lens discs, pre-oriented so the round face points down each axis
        const lensZGeom = new THREE.CylinderGeometry(2.6, 2.6, 1.4, 12); lensZGeom.rotateX(Math.PI / 2);
        const lensXGeom = new THREE.CylinderGeometry(2.6, 2.6, 1.4, 12); lensXGeom.rotateZ(Math.PI / 2);

        const box = (w, h, d, x, y, z) => {
            const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); staticGeos.push(g);
        };

        // One signal head over an approach. `axis` is the road the head governs
        // ('x' = E-W street, 'z' = N-S avenue); `face` is which way the lenses
        // point (toward oncoming traffic). Head hangs off a corner pole via a
        // cantilevered mast arm.
        const head = (hx, hz, axis, face) => {
            const bucket = axis === 'x' ? lensX : lensZ;
            const lensGeom = axis === 'x' ? lensXGeom : lensZGeom;
            // housing: a thin slab facing along `axis`
            if (axis === 'x') box(5, 24, 9, hx, HEAD_Y, hz);
            else box(9, 24, 5, hx, HEAD_Y, hz);
            // three lenses, protruding on the approach-facing side
            const prot = 3.2 * face;
            const colours = [['red', 8], ['amber', 0], ['green', -8]];
            for (const [col, dy] of colours) {
                const g = lensGeom.clone();
                if (axis === 'x') g.translate(hx + prot, HEAD_Y + dy, hz);
                else g.translate(hx, HEAD_Y + dy, hz + prot);
                bucket[col].push(g);
            }
            // corner pole + cantilevered mast arm out to the head
            if (axis === 'z') {
                const px = hx + (halfC + sw * 0.5 + 6);   // pole on the +X sidewalk
                box(4.5, ARM_Y, 4.5, px, ARM_Y / 2, hz);  // post
                box(px - hx, 3.5, 4, (px + hx) / 2, ARM_Y - 2, hz); // arm reaching -X
                G.colliders.push({ x0: px - 4, z0: hz - 4, x1: px + 4, z1: hz + 4, id: 'signal' });
            } else {
                const pz = hz + (halfC + sw * 0.5 + 6);
                box(4.5, ARM_Y, 4.5, hx, ARM_Y / 2, pz);
                box(4, 3.5, pz - hz, hx, ARM_Y - 2, (pz + hz) / 2);
                G.colliders.push({ x0: hx - 4, z0: pz - 4, x1: hx + 4, z1: pz + 4, id: 'signal' });
            }
        };

        // A light at every avenue × street crossing — where the player actually
        // walks and drives. Ring/inner-district junctions are left clear.
        for (const { x: jx, z: jz } of City.junctions()) {
            // four approaches: two N-S (avenue), two E-W (street)
            head(jx, jz + halfC + 8, 'z', -1);   // serves +Z-bound cars
            head(jx, jz - halfC - 8, 'z', +1);   // serves -Z-bound cars
            head(jx + halfC + 8, jz, 'x', -1);   // serves +X-bound cars
            head(jx - halfC - 8, jz, 'x', +1);   // serves -X-bound cars
        }

        if (!staticGeos.length) { this._built = true; return; }

        const frame = new THREE.Mesh(mergeGeometries(staticGeos, false),
            new THREE.MeshLambertMaterial({ color: DARK }));
        frame.matrixAutoUpdate = false;
        scene.add(frame);

        // lens materials: dark tinted glass that glows when lit
        const mkMat = (base, emis) => new THREE.MeshLambertMaterial({
            color: base, emissive: emis, emissiveIntensity: 0
        });
        this.matsX = {
            red: mkMat(0x350806, 0xff2a1a),
            amber: mkMat(0x352200, 0xffb020),
            green: mkMat(0x02330f, 0x22e05a)
        };
        this.matsZ = {
            red: mkMat(0x350806, 0xff2a1a),
            amber: mkMat(0x352200, 0xffb020),
            green: mkMat(0x02330f, 0x22e05a)
        };

        const addLenses = (geos, mat) => {
            if (!geos.length) return;
            const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
            m.matrixAutoUpdate = false;
            scene.add(m);
        };
        for (const col of ['red', 'amber', 'green']) {
            addLenses(lensX[col], this.matsX[col]);
            addLenses(lensZ[col], this.matsZ[col]);
        }

        this._built = true;
        this.update(0);
    },

    // Drive the lenses from the same clock-derived two-phase cycle as the cars.
    update(dt) {
        if (!this.matsX) return;
        const cycle = (G.time % SIGNAL_PERIOD) / SIGNAL_PERIOD;
        const greenAlongX = cycle < 0.5;
        const amber = Math.abs(cycle % 0.5 - 0.5) < AMBER;   // last sliver of each half

        const LIT = 1.5;
        const setHead = (mats, state) => {
            mats.red.emissiveIntensity = state === 'red' ? LIT : 0;
            mats.amber.emissiveIntensity = state === 'amber' ? LIT : 0;
            mats.green.emissiveIntensity = state === 'green' ? LIT : 0;
        };
        // amber shows on whichever axis is currently green (it's about to end)
        if (greenAlongX) {
            setHead(this.matsX, amber ? 'amber' : 'green');
            setHead(this.matsZ, 'red');
        } else {
            setHead(this.matsZ, amber ? 'amber' : 'green');
            setHead(this.matsX, 'red');
        }
    }
};
