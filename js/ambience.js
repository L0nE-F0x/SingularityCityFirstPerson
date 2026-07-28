/* ══════════════════════════════════════════════════════════════════════════
   DISTRICT AMBIENCE — the per-zone micro-life the 2D city has and the
   first-person port had none of.

   In the 2D app every zone animates something of its own: fibre pulses along
   the backbone cables, diamond data-flow between the agent buildings, a
   double-helix drifting over Longevity, welding sparks on the robotics line,
   smoke plumes off the power stacks, coins falling over VC Row. Walk those
   districts in FP and they were static boxes — the buildings changed but
   nothing in them was alive, which is most of why the districts read as
   interchangeable.

   Everything here is deliberately cheap: ALL of the particle life is one
   Points cloud with per-particle behaviour, and the street furniture is two
   InstancedMeshes. Four draw calls for the whole system.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { City, CARRIAGE } from './city.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rng = mulberry32(20260727);

// Particle kinds. Each one is a tiny closure over (particle, t) in _step.
const FLOW = 0;    // data packet travelling A→B along a lane
const HELIX = 1;   // double-helix strand orbiting a point
const SPARK = 2;   // welding spark: fast up, gravity down, short life
const PLUME = 3;   // smoke rising and spreading from a stack
const COIN = 4;    // coin falling and flipping over a VC office
const STEAM = 5;   // manhole vent, night-biased

/** Soft round sprite so particles read as glow, not as squares. */
function dotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.62)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export const Ambience = {
    parts: [],
    points: null,

    init(scene) {
        const byDistrict = new Map();
        for (const p of G.placements) {
            if (!byDistrict.has(p.district)) byDistrict.set(p.district, []);
            byDistrict.get(p.district).push(p);
        }
        const of = id => byDistrict.get(id) || [];

        // ── data flow: backbone + agents trade packets between their buildings ──
        for (const [did, hue] of [['backbone', 0.45], ['agents', 0.86], ['compute', 0.55]]) {
            const list = of(did);
            if (list.length < 2) continue;
            for (let i = 0; i < 46; i++) {
                const a = list[Math.floor(rng() * list.length)];
                let b = list[Math.floor(rng() * list.length)];
                if (a === b) b = list[(list.indexOf(a) + 1) % list.length];
                this.parts.push({
                    kind: FLOW, t: rng(),
                    speed: 0.10 + rng() * 0.22,
                    ax: a.x, az: a.z, ay: a.h * (0.45 + rng() * 0.4),
                    bx: b.x, bz: b.z, by: b.h * (0.45 + rng() * 0.4),
                    sag: 18 + rng() * 40,
                    hue, sat: 0.85, lum: 0.62, size: 3.2 + rng() * 2.2
                });
            }
        }

        // ── longevity: a double helix drifting above each lab ──
        for (const p of of('longevity')) {
            // Read as a helix up close and as a faint shimmer from the skyline;
            // denser/brighter than this and it was rainbow confetti from a
            // rooftop view.
            for (let i = 0; i < 16; i++) {
                this.parts.push({
                    kind: HELIX, t: i / 16,
                    speed: 0.13, cx: p.x, cz: p.z, base: p.h + 22,
                    radius: 22 + rng() * 6, rise: 78, strand: i % 2,
                    // A=green T=blue C=yellow G=red, as in the 2D helix
                    hue: [0.33, 0.58, 0.14, 0.02][i % 4], sat: 0.75, lum: 0.55,
                    size: 2.6
                });
            }
        }

        // ── robotics: welding sparks off the assembly line ──
        for (const p of of('robotics')) {
            for (let i = 0; i < 22; i++) {
                this.parts.push({
                    kind: SPARK, t: rng(),
                    speed: 1.5 + rng() * 1.6,
                    ox: p.x + (rng() - 0.5) * p.w * 0.7,
                    oz: p.z + (rng() - 0.5) * p.d * 0.7,
                    oy: 10 + rng() * 16,
                    vx: (rng() - 0.5) * 26, vz: (rng() - 0.5) * 26, vy: 34 + rng() * 30,
                    hue: 0.11, sat: 1, lum: 0.72, size: 2.6
                });
            }
        }

        // ── power + compute: smoke and cooling vapour off the stacks ──
        for (const did of ['power', 'compute']) {
            for (const p of of(did)) {
                if (!/coal|nuclear|fusion|datacenter|fab/.test(p.b.type)) continue;
                /* 16 per building meant 320 additive plumes across Compute and
                   Power; stacked over a district of 20 stacks they saturated
                   the whole sky white. Six reads as a plume; twenty reads as
                   fog. */
                for (let i = 0; i < 6; i++) {
                    this.parts.push({
                        kind: PLUME, t: rng(),
                        speed: 0.10 + rng() * 0.10,
                        ox: p.x + (rng() - 0.5) * p.w * 0.4,
                        oz: p.z + (rng() - 0.5) * p.d * 0.4,
                        oy: p.h + 6, rise: 130 + rng() * 90,
                        drift: (rng() - 0.5) * 60,
                        hue: 0.58, sat: 0.05, lum: 0.82, size: 7 + rng() * 6
                    });
                }
            }
        }

        // ── VC Row: money falling over the firms ──
        for (const p of of('vc')) {
            for (let i = 0; i < 12; i++) {
                this.parts.push({
                    kind: COIN, t: rng(),
                    speed: 0.16 + rng() * 0.14,
                    ox: p.x + (rng() - 0.5) * p.w * 1.5,
                    oz: p.z + (rng() - 0.5) * p.d * 1.5,
                    oy: p.h + 40, fall: p.h + 40,
                    hue: 0.13, sat: 0.95, lum: 0.6, size: 4.2
                });
            }
        }

        // ── manhole steam on the avenues (mostly a night-time read) ──
        const vents = [];
        for (const ax of City.avenueXs) {
            for (let z = -CITY_D / 2 + 260; z < CITY_D / 2; z += 520) {
                vents.push({ x: ax + (rng() < 0.5 ? -1 : 1) * 34, z: z + rng() * 90 });
            }
        }
        for (const sz of City.streetZs) {
            for (let x = -CITY_W / 2 + 300; x < CITY_W / 2; x += 560) {
                vents.push({ x: x + rng() * 90, z: sz + (rng() < 0.5 ? -1 : 1) * 34 });
            }
        }
        for (const v of vents) {
            for (let i = 0; i < 4; i++) {
                this.parts.push({
                    kind: STEAM, t: rng(),
                    speed: 0.16 + rng() * 0.12,
                    ox: v.x, oz: v.z, oy: 1.5, rise: 46 + rng() * 30,
                    drift: (rng() - 0.5) * 14,
                    hue: 0.58, sat: 0.04, lum: 0.9, size: 7 + rng() * 6
                });
            }
        }

        this._buildPoints(scene);
        this._buildFurniture(scene, vents);
    },

    _buildPoints(scene) {
        const n = this.parts.length;
        if (!n) return;
        const pos = new Float32Array(n * 3);
        const col = new Float32Array(n * 3);
        const siz = new Float32Array(n);
        const c = new THREE.Color();
        this.parts.forEach((p, i) => {
            c.setHSL(p.hue, p.sat, p.lum);
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            siz[i] = p.size;
        });
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
        this._alpha = new Float32Array(n);
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(this._alpha, 1));

        // Per-particle size and alpha need a shader; PointsMaterial only has
        // one of each for the whole cloud, and a smoke plume and a welding
        // spark cannot share either.
        const mat = new THREE.ShaderMaterial({
            uniforms: { map: { value: dotTexture() }, uOpacity: { value: 1 } },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aAlpha;
                varying vec3 vCol;
                varying float vA;
                void main() {
                    vCol = color;
                    vA = aAlpha;
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * (420.0 / max(40.0, -mv.z)) * 6.0;
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: /* glsl */`
                uniform sampler2D map;
                uniform float uOpacity;
                varying vec3 vCol;
                varying float vA;
                void main() {
                    float a = texture2D(map, gl_PointCoord).a * vA * uOpacity;
                    if (a < 0.01) discard;
                    gl_FragColor = vec4(vCol, a);
                }`,
            transparent: true, depthWrite: false, vertexColors: true,
            blending: THREE.AdditiveBlending, fog: false
        });
        this.points = new THREE.Points(geo, mat);
        this.points.name = 'ambience';
        this.points.frustumCulled = false;   // spread city-wide; bounds are useless
        this.points.renderOrder = 3;
        scene.add(this.points);
        this._pos = geo.attributes.position;
        this._alphaAttr = geo.attributes.aAlpha;
        this._mat = mat;
    },

    /** Hydrants on the pavement and manhole covers on the tarmac. */
    _buildFurniture(scene, vents) {
        const d = new THREE.Object3D();

        // hydrants — one merged body, instanced along the sidewalks
        const hydrant = mergeGeometries([
            new THREE.CylinderGeometry(3.2, 3.8, 11, 8).translate(0, 5.5, 0),
            new THREE.SphereGeometry(3.2, 8, 6).translate(0, 11.5, 0),
            new THREE.CylinderGeometry(1.5, 1.5, 8, 6).rotateZ(Math.PI / 2).translate(0, 7.5, 0)
        ], false);
        const spots = [];
        for (const ax of City.avenueXs) {
            for (let z = -CITY_D / 2 + 180; z < CITY_D / 2; z += 470) {
                spots.push({ x: ax + CARRIAGE.main / 2 + 22, z });
            }
        }
        for (const sz of City.streetZs) {
            for (let x = -CITY_W / 2 + 220; x < CITY_W / 2; x += 470) {
                spots.push({ x, z: sz + CARRIAGE.main / 2 + 22 });
            }
        }
        if (spots.length) {
            const im = new THREE.InstancedMesh(hydrant,
                new THREE.MeshStandardMaterial({ color: 0xb2402f, roughness: 0.62, metalness: 0.2 }),
                spots.length);
            spots.forEach((s, i) => {
                d.position.set(s.x, 1.8, s.z);
                d.rotation.set(0, rng() * Math.PI, 0);
                d.updateMatrix();
                im.setMatrixAt(i, d.matrix);
            });
            im.instanceMatrix.needsUpdate = true;
            scene.add(im);
        }

        // manhole covers, sitting exactly where the steam vents from
        if (vents.length) {
            const cover = new THREE.CylinderGeometry(11, 11, 1.2, 14);
            const im = new THREE.InstancedMesh(cover,
                new THREE.MeshStandardMaterial({ color: 0x3a3d44, roughness: 0.85, metalness: 0.35 }),
                vents.length);
            vents.forEach((v, i) => {
                d.position.set(v.x, 1.0, v.z);
                d.rotation.set(0, rng() * Math.PI, 0);
                d.updateMatrix();
                im.setMatrixAt(i, d.matrix);
            });
            im.instanceMatrix.needsUpdate = true;
            im.userData.shadowReceiveOnly = true;
            scene.add(im);
        }
    },

    update(dt, t) {
        if (!this.points) return;
        // Nothing here is visible from inside a lobby or a metro tunnel.
        const show = !G.inside && !G.ridingMetro;
        this.points.visible = show;
        if (!show) return;

        const night = G.weatherSys?.night ?? 0;
        const pos = this._pos.array;
        const alpha = this._alpha;

        for (let i = 0; i < this.parts.length; i++) {
            const p = this.parts[i];
            p.t += dt * p.speed;
            if (p.t > 1) p.t -= 1;
            const k = p.t;
            let x, y, z, a = 1;

            switch (p.kind) {
                case FLOW: {
                    x = p.ax + (p.bx - p.ax) * k;
                    z = p.az + (p.bz - p.az) * k;
                    // arc between rooftops rather than clipping through them
                    y = p.ay + (p.by - p.ay) * k + Math.sin(k * Math.PI) * p.sag;
                    a = Math.sin(k * Math.PI) * 0.9 + 0.1;
                    break;
                }
                case HELIX: {
                    const ang = k * Math.PI * 4 + p.strand * Math.PI;
                    x = p.cx + Math.cos(ang) * p.radius;
                    z = p.cz + Math.sin(ang) * p.radius;
                    y = p.base + k * p.rise;
                    a = 0.5;
                    break;
                }
                case SPARK: {
                    // ballistic, then dies — k is normalised flight time
                    const ft = k * 1.1;
                    x = p.ox + p.vx * ft;
                    z = p.oz + p.vz * ft;
                    y = p.oy + p.vy * ft - 90 * ft * ft;
                    a = Math.max(0, 1 - k * 1.35);
                    if (y < 2) a = 0;
                    break;
                }
                case PLUME: {
                    x = p.ox + p.drift * k;
                    z = p.oz + p.drift * 0.4 * k;
                    y = p.oy + k * p.rise;
                    a = Math.sin(k * Math.PI) * 0.13;
                    break;
                }
                case COIN: {
                    x = p.ox;
                    z = p.oz;
                    y = p.oy - k * p.fall;
                    // flicker as it flips end over end
                    a = (0.45 + 0.55 * Math.abs(Math.sin(t * 6 + i))) * (1 - k * 0.5);
                    break;
                }
                default: { // STEAM
                    x = p.ox + p.drift * k;
                    z = p.oz + p.drift * 0.5 * k;
                    y = p.oy + k * p.rise;
                    // barely there by day, unmistakable at night under a lamp
                    a = Math.sin(k * Math.PI) * (0.10 + night * 0.34);
                    break;
                }
            }
            pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
            alpha[i] = a;
        }
        this._pos.needsUpdate = true;
        this._alphaAttr.needsUpdate = true;
    }
};
