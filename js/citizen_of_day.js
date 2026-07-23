/* ══════════════════════════════════════════════════════════════════════════
   CITIZEN OF THE DAY — daily spotlight on one named model NPC.

   Ported from the production 2D app (ApexForge/SingularityCity/js/citizen_of_day.js)
   into first-person Three.js. Each UTC day one active model gets:

     • A gold crown sprite above their head (all day)
     • 3 paparazzi trailing them during commute windows
     • Camera-flash sparkles from the paparazzi
     • Biased "press" chat bubbles (see chatbubbles.js)
     • A HUD crown button → info card → Track (teleport + face them)

   Pick is deterministic across visitors on the same UTC date (hash of the
   date into the active SEED roster), cached in localStorage.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { SEED, LABS } from './data.js';
import { City, KERB_H } from './city.js';

const LS_PICK_KEY = 'sc_fp_cotd_pick_v1';
const LS_NEWS_KEY = 'sc_news_events_v1';

function utcDateString(d) {
    d = d || new Date();
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function yesterdayUtcDateString() {
    return utcDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
}
function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
}

function pickActive() {
    return SEED.filter(m =>
        m && m.id && m.phase !== 'retired' && m.phase !== 'rumored' && !m.ret
    );
}

function tryPickFromNewsLab(active, today) {
    try {
        const yest = yesterdayUtcDateString();
        const log = JSON.parse(localStorage.getItem(LS_NEWS_KEY) || '[]');
        const events = (log || []).filter(e => e && e.date === yest);
        const labCounts = {};
        for (const ev of events) {
            if (!ev || !ev.lab) continue;
            labCounts[ev.lab] = (labCounts[ev.lab] || 0) + 1;
        }
        const labIds = Object.keys(labCounts);
        if (!labIds.length) return null;
        labIds.sort((a, b) => labCounts[b] - labCounts[a] || a.localeCompare(b));
        const topLab = labIds[0];
        const candidates = active
            .filter(m => m.lab === topLab)
            .sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        if (!candidates.length) return null;
        const idx = hashStr(today + '|' + topLab) % candidates.length;
        return candidates[idx];
    } catch (_e) { return null; }
}

function pickToday() {
    const today = utcDateString();
    try {
        const raw = localStorage.getItem(LS_PICK_KEY);
        if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.date === today && cached.id) {
                const found = pickActive().find(m => m.id === cached.id);
                if (found) return { model: found, date: today, source: 'cache' };
            }
        }
    } catch (_e) { /* ignore */ }

    const active = pickActive();
    if (!active.length) return null;

    let model = tryPickFromNewsLab(active, today);
    let source = 'news';
    if (!model) {
        model = active[hashStr(today) % active.length];
        source = 'hash';
    }
    if (!model) return null;
    try {
        localStorage.setItem(LS_PICK_KEY, JSON.stringify({ date: today, id: model.id, source }));
    } catch (_e) { /* ignore */ }
    return { model, date: today, source };
}

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

function paparazzoGeometry(coatHex) {
    const parts = [];
    const box = (w, h, d, x, y, z, hex) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        parts.push(paint(g, hex));
    };
    box(2.4, 6.5, 2.2, 0, 7.5, 0, coatHex);
    box(2.2, 5.5, 2.0, -1.0, 2.75, 0, 0x1f2937);
    box(2.2, 5.5, 2.0, 1.0, 2.75, 0, 0x1f2937);
    box(2.6, 2.8, 2.6, 0, 12.4, 0, 0xf0c9a4);
    box(3.4, 1.8, 2.0, 2.6, 10.5, 1.2, 0x111111);
    box(0.7, 0.7, 0.7, 4.5, 10.7, 1.6, 0xf5f5f5);
    return mergeGeometries(parts, false);
}

function makeCrownSprite() {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 48;
    const x = cv.getContext('2d');
    x.clearRect(0, 0, 64, 48);
    x.fillStyle = '#b45309';
    x.fillRect(10, 30, 44, 6);
    x.fillStyle = '#fbbf24';
    x.fillRect(10, 26, 44, 8);
    const spikes = [[12, 14, 10, 18], [27, 8, 10, 24], [42, 14, 10, 18]];
    for (const [sx, sy, sw, sh] of spikes) {
        x.fillStyle = '#fbbf24';
        x.fillRect(sx, sy, sw, sh);
        x.fillStyle = '#ffd97a';
        x.fillRect(sx, sy, 3, 4);
    }
    x.fillStyle = '#ef4444';
    x.fillRect(29, 28, 6, 4);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: true
    }));
    spr.scale.set(10, 7.5, 1);
    spr.renderOrder = 25;
    spr.visible = false;
    return spr;
}

function makeFlashSprite() {
    const cv = document.createElement('canvas');
    cv.width = 32; cv.height = 32;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,240,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, depthTest: true,
        blending: THREE.AdditiveBlending
    }));
    spr.scale.set(14, 14, 1);
    spr.renderOrder = 30;
    spr.visible = false;
    return spr;
}

function inCommuteWindow(dp) {
    return (dp >= 0.30 && dp <= 0.55) || (dp >= 0.65 && dp <= 0.78);
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export const CitizenOfDay = {
    cotdId: null,
    cotdName: null,
    cotdLab: null,
    cotdDate: null,
    citizen: null,
    crown: null,
    paparazzi: [],
    flashPool: [],
    card: null,
    button: null,
    _scene: null,
    _attachTries: 0,

    init(scene) {
        this._scene = scene;
        this.crown = makeCrownSprite();
        scene.add(this.crown);
        for (let i = 0; i < 4; i++) {
            const f = makeFlashSprite();
            scene.add(f);
            this.flashPool.push({ spr: f, life: 0, max: 0.18 });
        }
        this._tryPick();
        this._buildButton();
    },

    isCotd(modelId) {
        return !!(this.cotdId && modelId === this.cotdId);
    },
    getId() { return this.cotdId; },

    _tryPick() {
        const result = pickToday();
        if (!result) return false;
        this.cotdId = result.model.id;
        this.cotdName = result.model.name;
        this.cotdLab = result.model.lab;
        this.cotdDate = result.date;
        this._attachTries = 0;
        this._resolveCitizen();
        if (this.button) this.button.title = `Citizen of the Day: ${this.cotdName}`;
        return true;
    },

    _resolveCitizen() {
        if (!G.citizens || !G.citizens.list) return null;
        const c = G.citizens.list.find(x => x.model && x.model.id === this.cotdId);
        this.citizen = c || null;
        return this.citizen;
    },

    _buildButton() {
        if (this.button) return;
        const host = document.getElementById('hudRight') || document.getElementById('hud');
        if (!host) return;
        const btn = document.createElement('button');
        btn.id = 'cotdBtn';
        btn.type = 'button';
        btn.title = this.cotdName ? `Citizen of the Day: ${this.cotdName}` : 'Citizen of the Day';
        btn.textContent = '\uD83D\uDC51';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openCard();
        });
        host.appendChild(btn);
        this.button = btn;
    },

    bioFor(m) {
        if (!m) return '';
        const lab = LABS[m.lab]?.name || m.lab || 'an independent';
        const tal = m.talent || '';
        const per = m.personality || '';
        const rel = m.rel || m.released || null;
        const parts = [];
        parts.push(`${m.name} is a ${tal ? tal.toLowerCase() + ' model' : 'frontier model'} from ${lab}`);
        if (per) parts.push(`with a ${per.toLowerCase()} personality`);
        if (rel) parts.push(`released ${rel}`);
        let line = parts.join(' ') + '.';
        if (m.benchmarks?.ELO) line += ` Arena ELO: ${m.benchmarks.ELO}.`;
        else if (m.benchmarks?.MMLU) line += ` MMLU: ${m.benchmarks.MMLU}%.`;
        if (m.phase) line += ` Currently ${m.phase}.`;
        return line;
    },

    openCard() {
        if (!this.cotdId) return;
        const m = SEED.find(x => x.id === this.cotdId);
        if (!m) return;
        if (this.card) this.closeCard();

        const lab = LABS[m.lab] || { name: m.lab, color: '#22d3ee', icon: '\uD83C\uDFE2' };
        const card = document.createElement('div');
        card.id = 'cotdCard';
        card.innerHTML = `
            <div class="cotd-head">
                <div class="cotd-portrait" style="background:${escapeHtml(lab.color)}22;border-color:${escapeHtml(lab.color)};">
                    <span class="cotd-crown">\uD83D\uDC51</span>
                    <span class="cotd-icon">${escapeHtml(lab.icon || '\uD83C\uDFE2')}</span>
                </div>
                <div class="cotd-titles">
                    <div class="cotd-tag">CITIZEN OF THE DAY</div>
                    <div class="cotd-name">${escapeHtml(m.name)}</div>
                    <div class="cotd-lab" style="color:${escapeHtml(lab.color)};">${escapeHtml(lab.name || m.lab)}</div>
                </div>
                <button class="cotd-close" type="button" aria-label="Close">\u00D7</button>
            </div>
            <div class="cotd-bio">${escapeHtml(this.bioFor(m))}</div>
            <div class="cotd-actions">
                <button class="cotd-btn cotd-track" type="button">\uD83C\uDFA5 Track</button>
                <button class="cotd-btn cotd-share" type="button">\uD835\uDD4F Share</button>
            </div>
        `;
        document.body.appendChild(card);
        this.card = card;
        requestAnimationFrame(() => card.classList.add('cotd-in'));

        try { document.exitPointerLock?.(); } catch (_e) { /* ignore */ }
        G.paused = true;

        card.querySelector('.cotd-close').onclick = () => this.closeCard();
        card.querySelector('.cotd-track').onclick = () => {
            this.track();
            this.closeCard();
        };
        card.querySelector('.cotd-share').onclick = () => {
            const text = `\uD83D\uDC51 Today's Citizen of the Day in Singularity City: ${m.name} from ${lab.name || m.lab}.\n\nWalk the city: https://singularitycity.net`;
            window.open('https://x.com/intent/post?text=' + encodeURIComponent(text), '_blank', 'noopener');
        };

        try { G.progress?.unlock('cotd_seen'); } catch (_e) { /* ignore */ }

        setTimeout(() => {
            const onDoc = (e) => {
                if (!this.card) { document.removeEventListener('click', onDoc); return; }
                if (!this.card.contains(e.target) && e.target !== this.button) {
                    this.closeCard();
                    document.removeEventListener('click', onDoc);
                }
            };
            document.addEventListener('click', onDoc);
        }, 0);
    },

    closeCard() {
        if (!this.card) return;
        const c = this.card;
        this.card = null;
        c.classList.remove('cotd-in');
        G.paused = false;
        setTimeout(() => { if (c.parentNode) c.parentNode.removeChild(c); }, 220);
        if (G.started && G.player?.lock) {
            try { G.player.lock(); } catch (_e) { /* ignore */ }
        }
    },

    track() {
        if (!this._resolveCitizen()) return;
        const c = this.citizen;
        const fx = c.dirX || 0, fz = c.dirZ || 1;
        const behindX = c.x - fx * 55;
        const behindZ = c.z - fz * 55;
        const yaw = Math.atan2(c.x - behindX, c.z - behindZ);
        G.player.teleport(behindX, behindZ, yaw);
        G.ui?.banner?.('\uD83D\uDC51 TRACKING', this.cotdName || 'Citizen of the Day');
    },

    _spawnPaparazzi() {
        if (this.paparazzi.length || !this._scene) return;
        const coats = [0x2563eb, 0x9333ea, 0x16a34a];
        const lags = [
            { x: -22, z: 8,  speed: 1.35 },
            { x: -38, z: -6, speed: 1.15 },
            { x: -52, z: 4,  speed: 1.05 }
        ];
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
        for (let i = 0; i < 3; i++) {
            const geo = paparazzoGeometry(coats[i]);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.frustumCulled = true;
            this._scene.add(mesh);
            const c = this.citizen;
            if (c) mesh.position.set(c.x + lags[i].x, 0, c.z + lags[i].z);
            this.paparazzi.push({
                mesh, mat, geo,
                lagX: lags[i].x, lagZ: lags[i].z, speed: lags[i].speed,
                flashT: 0.4 + Math.random() * 1.2,
                anim: Math.random() * Math.PI * 2
            });
        }
    },

    _despawnPaparazzi() {
        for (const p of this.paparazzi) {
            this._scene?.remove(p.mesh);
            p.geo?.dispose?.();
        }
        if (this.paparazzi[0]?.mat) this.paparazzi[0].mat.dispose();
        this.paparazzi = [];
        for (const f of this.flashPool) { f.spr.visible = false; f.life = 0; }
    },

    _fireFlash(x, y, z) {
        const f = this.flashPool.find(s => s.life <= 0);
        if (!f) return;
        f.life = f.max;
        f.spr.visible = true;
        f.spr.position.set(x, y, z);
        f.spr.scale.set(14, 14, 1);
        f.spr.material.opacity = 1;
    },

    update(dt) {
        if (!this.cotdId || this.cotdDate !== utcDateString()) this._tryPick();
        if (!this.cotdId) return;

        if (!this.citizen || this.citizen.model?.id !== this.cotdId) {
            this._attachTries++;
            if (this._attachTries < 600) this._resolveCitizen();
        }
        const c = this.citizen;
        if (!c) {
            this.crown.visible = false;
            if (this.paparazzi.length) this._despawnPaparazzi();
            return;
        }

        const gy = City.onSidewalk(c.x, c.z) ? KERB_H : 0;
        const headY = gy + 24;
        this.crown.visible = !G.inside;
        this.crown.position.set(c.x, headY + Math.sin(G.time * 3) * 0.6, c.z);

        const showShow = !G.inside && !G.panelOpen && inCommuteWindow(G.dayPhase);
        if (showShow && !this.paparazzi.length) this._spawnPaparazzi();
        if (!showShow && this.paparazzi.length) this._despawnPaparazzi();

        if (showShow && this.paparazzi.length) {
            const len = Math.hypot(c.dirX || 0, c.dirZ || 0) || 1;
            const fX = (c.dirX || 0) / len;
            const fZ = (c.dirZ || 1) / len;
            const backX = -fX, backZ = -fZ;
            const sideX = -fZ, sideZ = fX;

            for (let i = 0; i < this.paparazzi.length; i++) {
                const p = this.paparazzi[i];
                const desiredX = c.x + backX * Math.abs(p.lagX) + sideX * p.lagZ;
                const desiredZ = c.z + backZ * Math.abs(p.lagX) + sideZ * p.lagZ;
                const k = Math.min(1, 0.18 * p.speed * 60 * dt);
                const mx = p.mesh.position.x + (desiredX - p.mesh.position.x) * k;
                const mz = p.mesh.position.z + (desiredZ - p.mesh.position.z) * Math.min(1, 0.22 * p.speed * 60 * dt);
                const pgy = City.onSidewalk(mx, mz) ? KERB_H : 0;
                p.anim += dt * 10;
                const bob = Math.sin(p.anim + i) * 0.45;
                p.mesh.position.set(mx, pgy + bob, mz);
                p.mesh.rotation.y = Math.atan2(c.x - mx, c.z - mz);

                p.flashT -= dt;
                if (p.flashT <= 0) {
                    p.flashT = 1.1 + Math.random() * 1.6;
                    this._fireFlash(mx + fX * 3, pgy + 12, mz + fZ * 3);
                }
            }
        }

        for (const f of this.flashPool) {
            if (f.life <= 0) { f.spr.visible = false; continue; }
            f.life -= dt;
            const t = Math.max(0, f.life / f.max);
            f.spr.visible = t > 0;
            f.spr.scale.set(10 + (1 - t) * 22, 10 + (1 - t) * 22, 1);
            f.spr.material.opacity = t;
        }
    }
};
