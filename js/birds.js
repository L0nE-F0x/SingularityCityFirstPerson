/* ══════════════════════════════════════════════════════════════════════════
   BIRD FLOCKS — up to 3 flocks of ~6 birds drift over the city in a loose
   V, wings flapping, and scatter upward when the camera gets near (ported in
   spirit from the 2D app's bird_flocks.js). One InstancedMesh, one draw call;
   the wing flap runs in the vertex shader off a per-instance phase, and the
   flock formations are just per-instance matrix updates for ~18 birds.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';

const FLOCKS = 3, PER = 6;
const N = FLOCKS * PER;
const CRUISE_Y = 260;            // cruising altitude

function birdGeometry() {
    // body + two wings; aWing marks the wing verts so the shader can flap them
    const parts = [], wing = [];
    const body = new THREE.BoxGeometry(6, 2.2, 2.6);
    parts.push(body); for (let i = 0; i < body.attributes.position.count; i++) wing.push(0);
    const mk = (sx) => {
        const w = new THREE.BoxGeometry(1.4, 0.6, 11);
        w.translate(0, 0, sx * 6.5);            // pivot at the shoulder (z=0)
        parts.push(w);
        const n = w.attributes.position.count;
        for (let i = 0; i < n; i++) wing.push(sx > 0 ? 1 : 2);
    };
    mk(1); mk(-1);
    const geo = mergeGeometries(parts, false);
    geo.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
    return geo;
}

function flapMaterial() {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2b2f38 });
    mat.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = { value: 0 };
        mat.userData.sh = sh;
        sh.vertexShader = 'attribute float aWing;\nattribute float aPhase;\nuniform float uTime;\n' + sh.vertexShader;
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
            vec3 transformed = vec3( position );
            if ( aWing > 0.5 ) {
                float flap = sin( uTime * 9.0 + aPhase ) * 0.6;
                float side = ( aWing < 1.5 ) ? 1.0 : -1.0;   // +z wing vs -z wing
                float ang = flap * side;
                float ca = cos( ang ), sa = sin( ang );
                // rotate the wing about the body axis (x), pivot at z=0
                float y = transformed.y, z = transformed.z;
                transformed.y = y * ca - z * sa;
                transformed.z = y * sa + z * ca;
            }
        `);
    };
    mat.customProgramCacheKey = () => 'bird-flap';
    return mat;
}

export const Birds = {
    mesh: null,
    flocks: [],
    _dummy: new THREE.Object3D(),

    init(scene) {
        this.mat = flapMaterial();
        this.mesh = new THREE.InstancedMesh(birdGeometry(), this.mat, N);
        this.mesh.frustumCulled = false;
        const phase = new Float32Array(N);
        for (let i = 0; i < N; i++) phase[i] = Math.random() * 6.28;
        this.mesh.geometry.setAttribute('aPhase',
            new THREE.InstancedBufferAttribute(phase, 1));
        scene.add(this.mesh);
        for (let f = 0; f < FLOCKS; f++) this.flocks.push(this._newFlock(f));
        this._write();
    },

    _newFlock(f) {
        const edge = CITY_W / 2 + 400;
        const dir = Math.random() < 0.5 ? 1 : -1;
        return {
            base: f * PER,
            x: dir > 0 ? -edge : edge,
            z: (Math.random() - 0.5) * CITY_D,
            y: CRUISE_Y + (Math.random() - 0.5) * 80,
            vx: dir * (60 + Math.random() * 40),
            vz: (Math.random() - 0.5) * 30,
            scatter: 0
        };
    },

    update(dt, t) {
        if (!this.mesh) return;
        if (this.mat.userData.sh) this.mat.userData.sh.uniforms.uTime.value = t;
        const cam = G.camera.position;

        for (let fi = 0; fi < this.flocks.length; fi++) {
            const fl = this.flocks[fi];
            fl.x += fl.vx * dt;
            fl.z += fl.vz * dt;
            // scatter upward when the camera is close to the flock centre
            const near = Math.hypot(cam.x - fl.x, cam.z - fl.z) < 260 &&
                Math.abs(cam.y - fl.y) < 400;
            fl.scatter += ((near ? 1 : 0) - fl.scatter) * Math.min(1, dt * 3);
            fl.y += (near ? 60 : 0) * dt;
            // recycle when it flies off the map
            const edge = CITY_W / 2 + 500;
            if (fl.x > edge || fl.x < -edge) this.flocks[fi] = this._newFlock(fi);
        }
        this._write();
    },

    _write() {
        const d = this._dummy;
        for (const fl of this.flocks) {
            const heading = Math.atan2(fl.vx, fl.vz);
            for (let i = 0; i < PER; i++) {
                // V-formation: pairs peel back and out from the leader
                const rank = Math.ceil(i / 2);
                const sidez = (i % 2 === 0 ? 1 : -1);
                const back = -rank * 20 * Math.sign(fl.vx || 1);
                const outz = sidez * rank * 16;
                // scatter spreads birds apart along a fixed per-bird direction
                const sx = Math.sin(i * 2.4) * 46 * fl.scatter;
                const sz = Math.cos(i * 1.7) * 46 * fl.scatter;
                d.position.set(fl.x + back + sx, fl.y + fl.scatter * rank * 9, fl.z + outz + sz);
                d.rotation.set(0, heading, 0);
                d.scale.setScalar(1);
                d.updateMatrix();
                this.mesh.setMatrixAt(fl.base + i, d.matrix);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
};
