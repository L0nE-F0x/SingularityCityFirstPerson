/* ══════════════════════════════════════════════════════════════════════════
   STREET VENDORS — the food carts from the production city, at street level.
   Each is a merged static cart (body, striped canopy, posts, wheels, counter)
   plus a small canvas sign with the emoji + item, and a vendor figure behind
   it. Carts merge into one mesh; signs share one atlas → ~2 draw calls total.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { BLDS } from './data.js';
import { City } from './city.js';

const VENDORS = [
    { emoji: '🌮', name: 'Taco Bot',      item: 'Street Tacos',  body: 0xb85a2e, canopy: 0xd8663a },
    { emoji: '☕', name: 'Byte Brew',     item: 'Artisan Coffee', body: 0x6b4a2e, canopy: 0x8b5a2e },
    { emoji: '🍜', name: 'Ramen-san',     item: 'Hot Noodles',    body: 0xa8324a, canopy: 0xc8425e },
    { emoji: '🍦', name: 'Gelato GPU',    item: 'Gelato',         body: 0xc86a9a, canopy: 0xe07ab0 },
    { emoji: '🥨', name: 'Pretzel Net',   item: 'Fresh Pretzels', body: 0xa8842e, canopy: 0xc8a040 },
    { emoji: '📚', name: 'PageRank Books', item: 'Used Books',     body: 0x2e7a3a, canopy: 0x3a9048 }
];

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

export const Vendors = {
    build(scene) {
        // Carts stand on the inner-road sidewalk of busy districts, facing the
        // road — that's the open strip between the road and the building
        // clusters, so they never end up buried inside a building footprint.
        const hosts = G.placements.filter(p =>
            ['tech', 'public', 'vc', 'agents', 'university', 'longevity', 'robotics'].includes(p.district) &&
            !['park', 'graveyard', 'arena', 'monument'].includes(p.b.type));
        if (!hosts.length) return;

        const clear = (x, z) => City.onSidewalk(x, z) &&
            !G.colliders.some(c => x > c.x0 - 10 && x < c.x1 + 10 && z > c.z0 - 10 && z < c.z1 + 10);

        // find a clear sidewalk spot next to a host, trying the vertical inner
        // road first, then the horizontal one
        const spotFor = (host) => {
            const d = City.districts.find(x => x.id === host.district);
            if (!d) return null;
            const sideX = Math.sign(host.x - d.cx) || 1;
            let x = City.sidewalkCentre(d.cx, true, sideX), z = host.z;
            if (clear(x, z)) return { x, z, ang: Math.atan2(d.cx - x, 0) };
            const sideZ = Math.sign(host.z - d.cz) || 1;
            x = host.x; z = City.sidewalkCentre(d.cz, false, sideZ);
            if (clear(x, z)) return { x, z, ang: Math.atan2(0, d.cz - z) };
            return null;
        };

        const cartGeos = [];
        const signGeos = [];
        const { texture, cell } = this._signAtlas();
        let placed = 0;
        const used = new Set();

        for (let i = 0; i < VENDORS.length; i++) {
            const v = VENDORS[i];
            // scan hosts for one with a clear spot we haven't used
            let spot = null;
            for (let j = 0; j < hosts.length; j++) {
                const host = hosts[(i * 7 + j * 3) % hosts.length];
                const key = host.id;
                if (used.has(key)) continue;
                const s = spotFor(host);
                if (s) { spot = s; used.add(key); break; }
            }
            if (!spot) continue;
            const nx = Math.sin(spot.ang), nz = Math.cos(spot.ang);
            this._cart(cartGeos, v, spot.x, spot.z, spot.ang);
            this._sign(signGeos, cell[i], spot.x + nx * 2, spot.z + nz * 2, spot.ang);
            placed++;
        }
        if (!placed) return;

        const cart = new THREE.Mesh(mergeGeometries(cartGeos, false),
            new THREE.MeshLambertMaterial({ vertexColors: true }));
        cart.matrixAutoUpdate = false;
        scene.add(cart);

        const signMesh = new THREE.Mesh(mergeGeometries(signGeos, false),
            new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
        signMesh.matrixAutoUpdate = false;
        scene.add(signMesh);
    },

    _cart(out, v, x, z, ang) {
        const b = (w, h, dp, dx, dy, dz, hex) => {
            const g = new THREE.BoxGeometry(w, h, dp);
            g.rotateY(ang);
            g.translate(x + Math.cos(ang) * dx - Math.sin(ang) * dz,
                dy, z + Math.sin(ang) * dx + Math.cos(ang) * dz);
            out.push(paint(g, hex));
        };
        // body + counter
        b(40, 20, 22, 0, 10, 0, v.body);
        b(44, 4, 26, 0, 21, 0, 0xcfd4da);
        // striped canopy (two halves)
        b(48, 3, 30, 0, 40, 0, v.canopy);
        b(48, 3, 10, 0, 40.4, -8, 0xf2f2ee);
        b(48, 3, 10, 0, 40.4, 8, 0xf2f2ee);
        // corner posts
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
            b(2.5, 20, 2.5, sx * 21, 30, sz * 13, 0x7a8088);
        }
        // wheels
        for (const sx of [-1, 1]) {
            const wg = new THREE.CylinderGeometry(6, 6, 3, 10);
            wg.rotateZ(Math.PI / 2); wg.rotateY(ang);
            wg.translate(x + Math.cos(ang) * (sx * 16), 6, z + Math.sin(ang) * (sx * 16));
            out.push(paint(wg, 0x1a1c20));
        }
    },

    _sign(out, r, x, z, ang) {
        const g = new THREE.PlaneGeometry(30, 15);
        const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0));
        }
        g.rotateY(ang);
        g.translate(x, 52, z);
        out.push(g);
    },

    // one small atlas, one cell per vendor: emoji + item name
    _signAtlas() {
        const COLS = 2, ROWS = 3, CW = 256, CH = 128;
        const cv = document.createElement('canvas');
        cv.width = COLS * CW; cv.height = ROWS * CH;
        const x = cv.getContext('2d');
        const cell = [];
        VENDORS.forEach((v, i) => {
            const col = i % COLS, row = (i / COLS) | 0;
            const px = col * CW, py = row * CH;
            x.fillStyle = 'rgba(12,16,22,0.9)';
            roundRect(x, px + 8, py + 8, CW - 16, CH - 16, 12); x.fill();
            x.strokeStyle = '#ffd36e'; x.lineWidth = 3; x.stroke();
            x.textAlign = 'center'; x.textBaseline = 'middle';
            x.font = '58px serif';
            x.fillText(v.emoji, px + CW / 2, py + 44);
            x.fillStyle = '#ffe6a8';
            x.font = '22px Silkscreen, monospace';
            x.fillText(v.item.toUpperCase(), px + CW / 2, py + 96);
            cell.push({
                u0: px / cv.width, u1: (px + CW) / cv.width,
                v0: 1 - (py + CH) / cv.height, v1: 1 - py / cv.height
            });
        });
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return { texture: tex, cell };
    }
};

function roundRect(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
}
