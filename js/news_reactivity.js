/* ══════════════════════════════════════════════════════════════════════════
   NEWS REACTIVITY — the city reacts to what is actually happening in AI.

   The 2D app's best trick: a live headline arrives, gets routed to a lab by
   keyword and classified by sentiment, and then the CITY does something about
   it. FP had the same live news feed wired into CityStore and did nothing with
   it — headlines only ever appeared as text on a blimp.

   Four reactions, anchored on the lab's own HQ so you can see which company
   the news is about without reading a word:

     🎉 celebrate  — fireworks over the HQ
     😰 crisis     — the HQ facade flickers red
     🚨 emergency  — crisis flicker plus the CEO's helicopter scrambling in
     ⚖️  regulatory — a pulse runs from the HQ to the courthouse

   Opt out with localStorage 'sc_news_reactivity_off' = '1'.
   For testing: NewsReactivity.test('celebrate', 'openai').
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { LABS, LAB_HQ } from './data.js';
import { CityStore } from './store/city_store.js';

const OFF_KEY = 'sc_news_reactivity_off';

/* Which lab a headline is about. Ordered: the first match wins, so put the
   unambiguous names first. `o2` is deliberately absent from the OpenAI pattern
   — it matches "O2 Arena". */
const LAB_KEYWORDS = [
    ['anthropic', /\b(anthropic|claude|dario amodei|amodei)\b/i],
    ['openai',    /\b(openai|chatgpt|sam altman|altman|gpt-?\d|sora|o1|o3|o4)\b/i],
    ['google',    /\b(google|deepmind|gemini|hassabis|pichai|alphabet)\b/i],
    ['xai',       /\b(xai|x\.ai|grok|elon musk|musk)\b/i],
    ['meta',      /\b(meta|llama|zuckerberg)\b/i],
    ['mistral',   /\b(mistral|arthur mensch|mensch|mixtral)\b/i],
    ['deepseek',  /\b(deepseek|liang wenfeng)\b/i]
];

/* Multi-class, checked in this order: emergency > regulatory > crisis >
   celebrate. A lawsuit that "launches" is an emergency, not a celebration. */
const SENTIMENT = [
    ['emergency',  /\b(fired|lawsuit|sued|breach(es|ed)?|hack(ed|s)?|leak(ed|s)?|exposed|whistleblow|resigns|stepping down|class action|criminal|fraud)\b/i],
    ['regulatory', /\b(regulation|regulat(es|ed|ing)|ban(ned)?|eu ai act|congress|senate|ftc|doj|antitrust|hearing|subpoena|investig(ation|ates)|fines?|copyright suit)\b/i],
    ['crisis',     /\b(controversy|criticized|under fire|backlash|outage|crash|recall|apologi[sz]e|delays?|deprecat(es|ed|ing)|shut(s|ting)? down)\b/i],
    ['celebrate',  /\b(raises?|releases?|launches?|launched|ships?|shipped|announces?|unveils?|debuts?|tops?|beats?|sets record|breakthrough|introduces?|open[- ]?sources?|funded|partnership|acquires?|valuation|ipo)\b/i]
];

/** Pure: classify a headline into { lab, sentiment } (either may be null). */
export function classifyHeadline(title = '') {
    let lab = null;
    for (const [id, re] of LAB_KEYWORDS) if (re.test(title)) { lab = id; break; }
    let sentiment = null;
    for (const [kind, re] of SENTIMENT) if (re.test(title)) { sentiment = kind; break; }
    return { lab, sentiment };
}

const TOAST = {
    celebrate:  { emoji: '🎉', line: 'is celebrating' },
    crisis:     { emoji: '😰', line: 'is under pressure' },
    emergency:  { emoji: '🚨', line: 'has called an emergency huddle' },
    regulatory: { emoji: '⚖️', line: 'has been summoned to the AI Court' }
};

export const NewsReactivity = {
    enabled: true,
    queue: [],
    active: [],
    _seen: new Set(),
    _cool: 0,

    init(scene) {
        this.scene = scene;
        try { this.enabled = localStorage.getItem(OFF_KEY) !== '1'; } catch (e) { /* no storage */ }

        this._initFireworks(scene);
        this._initPulse(scene);

        // Seed `_seen` from whatever is already in the store, so booting the
        // game doesn't fire twenty reactions for headlines the player never
        // "saw arrive".
        const snap = CityStore.getSnapshot?.();
        for (const n of (snap?.news || [])) this._seen.add(this._key(n));

        CityStore.subscribe?.((patch) => {
            if (!patch || !patch.news) return;
            this._ingest(patch.news);
        });
    },

    _key(n) { return (n.headline || n.title || '') + '|' + (n.url || ''); },

    _ingest(news) {
        if (!this.enabled) return;
        for (const n of news) {
            const k = this._key(n);
            if (!k || this._seen.has(k)) continue;
            this._seen.add(k);
            const title = n.headline || n.title || '';
            const { lab, sentiment } = classifyHeadline(title);
            // No lab and no sentiment means there is nothing to anchor a
            // reaction to — the headline still shows on the blimps and in the
            // paper, it just doesn't move the city.
            if (!lab || !sentiment) continue;
            this.queue.push({ lab, sentiment, title });
        }
        // Feeds arrive in batches of dozens; a queue plus a cooldown turns that
        // into a paced sequence instead of the whole city convulsing at once.
        if (this.queue.length > 6) this.queue.length = 6;
    },

    /** Force a reaction — used by the terminal and for manual testing. */
    test(sentiment = 'celebrate', lab = 'openai', title = 'Test headline') {
        this.queue.push({ lab, sentiment, title });
        this._cool = 0;
    },

    // ── reaction plumbing ────────────────────────────────────────────────────
    _hqOf(lab) {
        const b = G.bldById?.[LAB_HQ?.[lab]];
        if (!b || !Number.isFinite(b.worldX)) return null;
        return b;
    },

    _fire(r) {
        const hq = this._hqOf(r.lab);
        if (!hq) return;
        const name = LABS[r.lab]?.name || r.lab;
        const t = TOAST[r.sentiment];
        G.ui?.addToast?.(`${t.emoji} <b>${name}</b> ${t.line} — ${r.title}`, 'info');

        switch (r.sentiment) {
            case 'celebrate':
                // three staggered shells so it reads as a celebration, not a pop
                for (let i = 0; i < 3; i++) {
                    this.active.push({ kind: 'burst', at: i * 0.9, hq, colour: LABS[r.lab]?.color || '#ffd166' });
                }
                break;
            case 'emergency':
                this._scrambleHeli(hq);
                // fall through — an emergency is also a crisis
            case 'crisis':
                this.active.push({ kind: 'flicker', t: 0, dur: 9, hq });
                break;
            case 'regulatory':
                this._pulseToCourt(hq);
                break;
        }
    },

    /** Send the nearest CEO helicopter to circle the HQ. */
    _scrambleHeli(hq) {
        const heli = G.traffic?.helis?.[0] || G.traffic?.helicopters?.[0];
        if (heli && heli.obj) {
            heli.emergencyX = hq.worldX;
            heli.emergencyZ = hq.worldZ;
            heli.emergencyT = 24;
        }
    },

    // ── fireworks over the HQ ────────────────────────────────────────────────
    _initFireworks(scene) {
        const N = 420;
        const pos = new Float32Array(N * 3);
        const col = new Float32Array(N * 3);
        const alpha = new Float32Array(N);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
        const c = document.createElement('canvas'); c.width = c.height = 32;
        const cx = c.getContext('2d');
        const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = g; cx.fillRect(0, 0, 32, 32);
        const map = new THREE.CanvasTexture(c);
        map.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Points(geo, new THREE.ShaderMaterial({
            uniforms: { map: { value: map } },
            vertexShader: `attribute float aAlpha; varying vec3 vC; varying float vA;
                void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
                gl_PointSize=8.0*(420.0/max(40.0,-mv.z))*6.0; gl_Position=projectionMatrix*mv; }`,
            fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
                void main(){ float a=texture2D(map,gl_PointCoord).a*vA; if(a<0.01) discard;
                gl_FragColor=vec4(vC,a); }`,
            transparent: true, depthWrite: false, vertexColors: true,
            blending: THREE.AdditiveBlending, fog: false
        }));
        mesh.frustumCulled = false;
        mesh.name = 'newsFireworks';
        scene.add(mesh);
        this._fw = { mesh, pos, col, alpha, vel: new Float32Array(N * 3), N, next: 0, geo };
    },

    _burst(hq, colour) {
        const F = this._fw;
        if (!F) return;
        const base = new THREE.Color(colour);
        const ox = hq.worldX + (Math.random() - 0.5) * 140;
        const oz = hq.worldZ + (Math.random() - 0.5) * 140;
        const oy = (hq.worldH || 200) + 150 + Math.random() * 160;
        const tmp = new THREE.Color();
        for (let k = 0; k < 90; k++) {
            const i = F.next; F.next = (F.next + 1) % F.N;
            const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
            // wide speed spread so the shell has a bright core and a thin fringe
            const sp = 45 + Math.pow(Math.random(), 0.6) * 150;
            F.pos[i * 3] = ox; F.pos[i * 3 + 1] = oy; F.pos[i * 3 + 2] = oz;
            // brand colour, jittered toward white so the shell has a hot core
            tmp.copy(base).lerp(_white, Math.random() * 0.4);
            F.col[i * 3] = tmp.r; F.col[i * 3 + 1] = tmp.g; F.col[i * 3 + 2] = tmp.b;
            F.alpha[i] = 1;
            F.vel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
            F.vel[i * 3 + 1] = Math.cos(ph) * sp;
            F.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
        }
        G.audio?.sfx?.('chime', 0.2);
    },

    // ── regulatory pulse: HQ → courthouse ────────────────────────────────────
    _initPulse(scene) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        this._pulse = new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: 0xffc857, transparent: true, opacity: 0, fog: false
        }));
        this._pulse.frustumCulled = false;
        this._pulse.name = 'newsPulse';
        scene.add(this._pulse);
    },

    _pulseToCourt(hq) {
        const court = G.bldById?.['court_senate'] || G.bldById?.['court_hearing'];
        if (!court || !Number.isFinite(court.worldX)) return;
        const p = this._pulse.geometry.attributes.position;
        p.setXYZ(0, hq.worldX, (hq.worldH || 200) + 30, hq.worldZ);
        p.setXYZ(1, court.worldX, (court.worldH || 120) + 30, court.worldZ);
        p.needsUpdate = true;
        this.active.push({ kind: 'pulse', t: 0, dur: 6 });
    },

    update(dt) {
        if (!this.enabled) return;

        // pace the queue
        this._cool -= dt;
        if (this._cool <= 0 && this.queue.length) {
            this._fire(this.queue.shift());
            this._cool = 7 + Math.random() * 6;
        }

        // step reactions
        for (let i = this.active.length - 1; i >= 0; i--) {
            const a = this.active[i];
            if (a.kind === 'burst') {
                a.at -= dt;
                if (a.at <= 0) { this._burst(a.hq, a.colour); this.active.splice(i, 1); }
                continue;
            }
            a.t += dt;
            if (a.kind === 'flicker') {
                /* Tint the whole scene's window emissive toward red while the
                   crisis runs. Weather rewrites emissive every frame, so this
                   has to be applied after it — main.js calls us later in the
                   frame, which is what makes the override stick. */
                const k = 1 - a.t / a.dur;
                const pulse = Math.abs(Math.sin(a.t * 5.5)) * k;
                for (const m of (G.world?.windowMats || [])) {
                    if (m.emissive) m.emissive.lerp(_red, pulse * 0.5);
                }
            } else if (a.kind === 'pulse') {
                const k = a.t / a.dur;
                this._pulse.material.opacity = Math.sin(k * Math.PI) * 0.9;
            }
            if (a.t >= a.dur) {
                if (a.kind === 'pulse') this._pulse.material.opacity = 0;
                this.active.splice(i, 1);
            }
        }

        // step fireworks
        const F = this._fw;
        if (!F) return;
        let live = false;
        for (let i = 0; i < F.N; i++) {
            if (F.alpha[i] <= 0) continue;
            live = true;
            F.vel[i * 3 + 1] -= 44 * dt;
            F.pos[i * 3] += F.vel[i * 3] * dt;
            F.pos[i * 3 + 1] += F.vel[i * 3 + 1] * dt;
            F.pos[i * 3 + 2] += F.vel[i * 3 + 2] * dt;
            F.alpha[i] = Math.max(0, F.alpha[i] - 0.42 * dt);
        }
        if (live) {
            F.geo.attributes.position.needsUpdate = true;
            F.geo.attributes.color.needsUpdate = true;
            F.geo.attributes.aAlpha.needsUpdate = true;
        }
        F.mesh.visible = live && !G.inside && !G.ridingMetro;
    }
};

const _red = new THREE.Color(0xff2a2a);
const _white = new THREE.Color(0xffffff);
