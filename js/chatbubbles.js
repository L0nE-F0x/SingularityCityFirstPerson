/* ══════════════════════════════════════════════════════════════════════════
   CHAT BUBBLES — the production city's signature "alive" touch: citizens
   speak. A small pool of world-space sprites floats a line from CHAT_MSGS
   above nearby citizens' heads, sized by what they're currently doing.

   Kept to a fixed pool (each sprite is a draw call) and only assigned to
   citizens within a readable band of the camera, so the cost is bounded no
   matter how big the crowd is.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { CHAT_MSGS } from './data.js';
import { CitizenOfDay } from './citizen_of_day.js';
import { City, KERB_H } from './city.js';

const POOL = 9;
const NEAR = 40, FAR = 300;      // only bubble citizens in this distance band
const LIFE = [3.2, 5.5];         // seconds a bubble lingers

export const ChatBubbles = {
    pool: [],
    _timer: 0,

    init(scene) {
        for (let i = 0; i < POOL; i++) {
            const cv = document.createElement('canvas');
            cv.width = 256; cv.height = 96;
            const tex = new THREE.CanvasTexture(cv);
            tex.colorSpace = THREE.SRGBColorSpace;
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({
                map: tex, transparent: true, depthWrite: false, depthTest: true
            }));
            spr.visible = false;
            spr.renderOrder = 20;
            scene.add(spr);
            this.pool.push({ spr, cv, ctx: cv.getContext('2d'), tex, cz: null, ttl: 0, w: 1 });
        }
    },

    _draw(b, text) {
        const x = b.ctx, W = b.cv.width, H = b.cv.height;
        x.clearRect(0, 0, W, H);
        // fixed bubble filling the canvas so every speech balloon is the same
        // size on screen and the sprite has no dead space
        const bw = W - 16, bh = 60, x0 = 8, y0 = 6;
        x.fillStyle = 'rgba(14,18,26,0.92)';
        x.strokeStyle = 'rgba(120,200,255,0.55)';
        x.lineWidth = 2.5;
        roundRect(x, x0, y0, bw, bh, 12); x.fill(); x.stroke();
        // tail
        x.fillStyle = 'rgba(14,18,26,0.92)';
        x.beginPath();
        x.moveTo(W / 2 - 9, y0 + bh - 1); x.lineTo(W / 2 + 9, y0 + bh - 1); x.lineTo(W / 2, y0 + bh + 16);
        x.closePath(); x.fill();
        // text, shrinking font until it fits
        x.fillStyle = '#e8f2ff';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        let fs = 26;
        do { x.font = `${fs}px Silkscreen, monospace`; fs -= 2; }
        while (x.measureText(text).width > bw - 20 && fs > 12);
        x.fillText(text, W / 2, y0 + bh / 2);
        b.tex.needsUpdate = true;
    },

    _assign(b, c) {
        // COTD (and anyone walking near them during paparazzi hours) speak press lines
        let pool;
        if (CitizenOfDay.isCotd(c.model?.id) && CHAT_MSGS.press) {
            pool = CHAT_MSGS.press;
        } else if (CitizenOfDay.isCotd(c.model?.id) === false
            && CitizenOfDay.paparazzi?.length
            && CitizenOfDay.citizen
            && Math.hypot(c.x - CitizenOfDay.citizen.x, c.z - CitizenOfDay.citizen.z) < 70
            && CHAT_MSGS.press
            && Math.random() < 0.45) {
            pool = CHAT_MSGS.press;
        } else {
            pool = CHAT_MSGS[c.act] || CHAT_MSGS.work;
        }
        // A running festival occasionally displaces the routine line — it is
        // what makes Diwali or Obon feel like the city noticed, not just decor.
        let text = null;
        if (Math.random() < 0.3) text = G.seasonal?.chatLine?.() ?? null;
        if (!text) text = pool[(Math.random() * pool.length) | 0];
        this._draw(b, text);
        b.cz = c;
        b.ttl = LIFE[0] + Math.random() * (LIFE[1] - LIFE[0]);
        b.spr.visible = true;
    },

    update(dt) {
        if (G.inside || G.panelOpen) { this._hideAll(); return; }
        const cam = G.camera.position;

        // age out and follow the speaker
        for (const b of this.pool) {
            if (!b.spr.visible) continue;
            b.ttl -= dt;
            const c = b.cz;
            if (b.ttl <= 0 || !c) { b.spr.visible = false; b.cz = null; continue; }
            const gy = City.onSidewalk(c.x, c.z) ? KERB_H : 0;
            b.spr.position.set(c.x, gy + 23, c.z);
            // grow slightly with distance so far bubbles stay legible; the
            // canvas is 256×96, so keep the sprite at that aspect
            const d = Math.hypot(c.x - cam.x, c.z - cam.z);
            if (d > FAR + 60) { b.spr.visible = false; b.cz = null; continue; }
            const h = 11 + d * 0.014;
            b.spr.scale.set(h * (256 / 96), h, 1);
        }

        // top the pool back up a few times a second
        this._timer -= dt;
        if (this._timer > 0) return;
        this._timer = 0.45;

        const free = this.pool.filter(b => !b.spr.visible);
        if (!free.length) return;
        const busy = new Set(this.pool.map(b => b.cz).filter(Boolean));
        // candidates: citizens in the readable band, not already speaking
        const cands = [];
        for (const c of G.citizens.list) {
            if (busy.has(c)) continue;
            const d = Math.hypot(c.x - cam.x, c.z - cam.z);
            if (d < NEAR || d > FAR) continue;
            cands.push(c);
        }
        if (!cands.length) return;
        // fill one bubble per tick so they pop in gradually
        const c = cands[(Math.random() * cands.length) | 0];
        this._assign(free[0], c);
    },

    _hideAll() {
        for (const b of this.pool) { b.spr.visible = false; b.cz = null; }
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
