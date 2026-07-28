/* ══════════════════════════════════════════════════════════════════════════
   DAILY BRIEFING — a ~30-second camera reel of the labs that are in today's
   news, recorded off the WebGL canvas and handed back as a .webm download.

   Ported from pixi/js/daily_briefing.js. Two things had to change for 3D:

   1. The shot list. The 2D app replayed a persisted log of news *events*; here
      we read the live headlines straight out of CityStore and run each through
      classifyHeadline() — the same classifier news_reactivity.js uses to decide
      which HQ reacts — so the reel visits exactly the labs the wire is talking
      about, one shot per lab, most recent first.

   2. The captions. MediaRecorder sees the canvas and nothing else: a DOM
      caption is invisible to captureStream, which is why the 2D version drew
      its banners into the Pixi stage. The equivalent here is one textured quad
      pinned in front of the camera with depth testing off — letterbox bars,
      kicker, headline and title cards are painted into a 2D canvas and blitted
      through it, so what you watch and what you download are the same frames.
      The quad is added to G.scene (main.js renders that) and removed on stop.

   Recording is entirely optional: MediaRecorder and captureStream are both
   feature-detected, and without them the reel still plays as a camera tour.

   Everything borrowed from the rest of the app — camera transform, player
   controller, tourMode, HUD visibility — is snapshotted on start and restored
   on stop, including on abort.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { LABS, LAB_HQ } from './data.js';
import { CityStore } from './store/city_store.js';
import { classifyHeadline } from './news_reactivity.js';
import { subjectFraming } from './tutorial.js';

const $ = id => document.getElementById(id);

const MAX_SHOTS = 6;
const T_INTRO = 2.8;
const T_SHOT = 4.2;         // 2.6 s of travel + 1.6 s of hold
const T_FLY = 2.6;
const T_OUTRO = 3.0;
const FPS = 30;

const SENTIMENT_LINE = {
    celebrate:  'CELEBRATING',
    crisis:     'UNDER PRESSURE',
    emergency:  'EMERGENCY',
    regulatory: 'IN COURT'
};

function todayStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickMimeType() {
    const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const m of candidates) {
        if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
}

export const DailyBriefing = {
    active: false,
    shots: [],
    _phase: 'idle',          // 'intro' | 'shot' | 'outro'
    _t: 0,
    _shotIdx: 0,
    _saved: null,
    _rec: null,
    _chunks: [],
    _blob: null,
    _url: null,
    _mime: '',
    _from: null,

    init() {
        G.dailyBriefing = this;   // console/debug reach, same as every other system
    },

    /** Both halves of the recording path — either missing just means no file. */
    canRecord() {
        try {
            return typeof MediaRecorder === 'function' &&
                typeof G.renderer?.domElement?.captureStream === 'function';
        } catch (e) { return false; }
    },

    // ── shot list ───────────────────────────────────────────────────────────
    /** One shot per lab that today's wire actually mentions, newest first. */
    buildShots() {
        const snap = CityStore.getSnapshot?.() || {};
        const news = Array.isArray(snap.news) ? snap.news : [];
        const seen = new Set();
        const shots = [];
        for (const n of news) {
            const title = n.headline || n.title || '';
            if (!title) continue;
            const { lab, sentiment } = classifyHeadline(title);
            if (!lab || seen.has(lab)) continue;
            const b = G.bldById?.[LAB_HQ[lab]];
            if (!b || !Number.isFinite(b.worldX)) continue;
            seen.add(lab);
            shots.push({ lab, sentiment, title, source: n.source || '', b });
            if (shots.length >= MAX_SHOTS) break;
        }
        // A quiet news day still deserves a reel — fall back to a skyline tour
        // of the HQs, captioned as such rather than faking a headline.
        if (!shots.length) {
            for (const [lab, bid] of Object.entries(LAB_HQ)) {
                if (lab === 'other') continue;
                const b = G.bldById?.[bid];
                if (!b || !Number.isFinite(b.worldX)) continue;
                shots.push({ lab, sentiment: null, title: '', source: '', b, quiet: true });
                if (shots.length >= 4) break;
            }
        }
        return shots;
    },

    // ── lifecycle ───────────────────────────────────────────────────────────
    start() {
        if (this.active || !G.started) return;
        if (G.inside || G.ridingMetro) {
            G.ui?.addToast?.('📽 Step outside first — the briefing flies over the city', 'info');
            return;
        }
        if (G.tutorial?.active) return;

        const shots = this.buildShots();
        if (!shots.length) {
            G.ui?.addToast?.('📽 No lab HQs to film — briefing unavailable', 'info');
            return;
        }

        this.active = true;
        this.shots = shots;
        this._phase = 'intro';
        this._t = 0;
        this._shotIdx = -1;
        this._blob = null;
        this._cancelled = false;
        this.date = todayStamp();

        const cam = G.camera;
        this._saved = {
            enabled: G.player.enabled,
            tourMode: G.tourMode,
            yaw: G.player.yaw, pitch: G.player.pitch,
            x: cam.position.x, y: cam.position.y, z: cam.position.z,
            hudHidden: !!G.ui?.els?.hud?.classList.contains('hidden')
        };
        // tourMode: the camera stops belonging to the player, and an unlocked
        // pointer stops being read as "open the pause menu".
        G.tourMode = true;
        G.player.enabled = false;
        G.player.unlock();
        G.paused = false;
        G.ui?.els?.pauseMenu?.classList.add('hidden');
        // Neither the HUD nor the shell bar is in the capture, but both sit on
        // top of the frame the viewer is watching — the shell bar in
        // particular covers the branding line the caption draws.
        G.ui?.els?.hud?.classList.add('hidden');
        const shell = $('scShell');
        if (shell) { this._saved.shellDisplay = shell.style.display; shell.style.display = 'none'; }

        this._buildCaption();
        this._buildChrome();
        this._setCard('SINGULARITY CITY', 'DAILY BRIEFING · ' + this.date,
            `${shots.length} lab${shots.length === 1 ? '' : 's'} in today's wire`);
        this._from = { px: cam.position.x, py: cam.position.y, pz: cam.position.z, lx: 0, ly: 0, lz: 0 };
        this._aimFromCamera();

        this._bindKeys();
        // One frame of the intro card must exist before capture opens, or the
        // first chunk is whatever the player was looking at.
        setTimeout(() => { if (this.active) this._startRecording(); }, 80);
    },

    /** User pressed Stop/ESC — tear down and throw the recording away. */
    abort() { this._finish(true); },

    stop() { this._finish(false); },

    _finish(cancelled) {
        if (!this.active) return;
        this.active = false;
        this._cancelled = cancelled;
        this._stopRecording();
        this._unbindKeys();
        this._destroyCaption();
        this._destroyChrome();

        const s = this._saved;
        this._saved = null;
        if (s) {
            if (!s.hudHidden) G.ui?.els?.hud?.classList.remove('hidden');
            const shell = $('scShell');
            if (shell) shell.style.display = s.shellDisplay || '';
            G.player.yaw = s.yaw;
            G.player.pitch = s.pitch;
            G.player.teleport(s.x, s.z, s.yaw);
            G.camera.position.set(s.x, s.y, s.z);
            G.camera.rotation.order = 'YXZ';
            G.camera.rotation.set(s.pitch, s.yaw, 0);
            G.tourMode = s.tourMode;
            G.player.enabled = s.enabled;
            if (!G.panelOpen && !G.paused && !G.tourMode) G.player.lock();
        }
        // MediaRecorder.onstop lands a tick later, after shots are cleared —
        // keep what the share card needs to describe the clip.
        this._lastLabs = this.shots.map(s => LABS[s.lab]?.name || s.lab);
        this.shots = [];
        this._phase = 'idle';
        if (cancelled) G.ui?.addToast?.('📽 Briefing cancelled', 'info');
    },

    // ── frame loop ──────────────────────────────────────────────────────────
    update(dt) {
        if (!this.active) return;
        this._t += dt;

        if (this._phase === 'intro') {
            this._holdOrbit(dt);
            this._setAlpha(this._fade(this._t, T_INTRO, 0.4), Math.min(1, this._t / 0.4));
            if (this._t >= T_INTRO) { this._t = 0; this._nextShot(); }
        } else if (this._phase === 'shot') {
            const shot = this.shots[this._shotIdx];
            if (this._t < T_FLY) {
                const k = this._t / T_FLY;
                const e = k * k * (3 - 2 * k);            // smoothstep, no overshoot
                const f = this._from, to = shot.cam;
                G.camera.position.set(
                    f.px + (to.px - f.px) * e,
                    f.py + (to.py - f.py) * e,
                    f.pz + (to.pz - f.pz) * e
                );
                G.camera.lookAt(
                    f.lx + (to.lx - f.lx) * e,
                    f.ly + (to.ly - f.ly) * e,
                    f.lz + (to.lz - f.lz) * e
                );
            } else {
                this._holdOrbit(dt, shot);
            }
            // Bars stay solid across shot boundaries — only the copy crossfades.
            this._setAlpha(this._fade(this._t, T_SHOT, 0.35), 1);
            if (this._t >= T_SHOT) {
                this._t = 0;
                if (this._shotIdx >= this.shots.length - 1) {
                    this._phase = 'outro';
                    this._setCard('SINGULARITY CITY', this.date,
                        this.canRecord() ? 'saving your briefing…' : 'singularitycity.net');
                } else this._nextShot();
            }
        } else if (this._phase === 'outro') {
            this._holdOrbit(dt);
            this._setAlpha(this._fade(this._t, T_OUTRO, 0.5), Math.max(0, (T_OUTRO - this._t) / 0.5));
            if (this._t >= T_OUTRO) this.stop();
        }

        this._placeCaption();
    },

    // 0→1 in, flat, 1→0 out — one curve for every phase's cross-fade
    _fade(t, dur, edge) {
        return Math.max(0, Math.min(1, Math.min(t / edge, (dur - t) / edge)));
    },

    _nextShot() {
        this._shotIdx++;
        const shot = this.shots[this._shotIdx];
        if (!shot) { this._phase = 'outro'; return; }
        this._phase = 'shot';
        this._from = {
            px: G.camera.position.x, py: G.camera.position.y, pz: G.camera.position.z,
            lx: this._aim.x, ly: this._aim.y, lz: this._aim.z
        };
        const b = shot.b;
        // Framing is derived from the subject (see subjectFraming) — a 32-floor
        // HQ and a squat data centre must not be shot from the same altitude.
        const f = subjectFraming(b);
        const ang = this._shotIdx * 2.4;                  // spread the approach angles
        const r = f.dist * (1 + (this._shotIdx % 3) * 0.06);
        shot.cam = {
            px: b.worldX + Math.cos(ang) * r, py: f.camY, pz: b.worldZ + Math.sin(ang) * r,
            lx: b.worldX, ly: f.lookY, lz: b.worldZ
        };
        shot.orbit = ang;

        const lab = LABS[shot.lab] || LABS.other;
        if (shot.quiet) {
            this._setCaption(`${lab.icon} ${lab.name}`, 'Quiet on the wire today — skyline check.', '');
        } else {
            const kicker = `${lab.icon} ${lab.name}` +
                (shot.sentiment ? ` · ${SENTIMENT_LINE[shot.sentiment] || ''}` : '');
            this._setCaption(kicker, shot.title, shot.source);
            // Re-fire the city's own reaction so the shot has something to
            // watch: fireworks, a crisis flicker, a pulse to the courthouse.
            // test() zeroes the cooldown, so each shot lands on its own beat.
            if (shot.sentiment) G.newsReactivity?.test?.(shot.sentiment, shot.lab, shot.title);
        }
    },

    /** Slow arc around the current subject so held frames are never static. */
    _holdOrbit(dt, shot) {
        const cam = G.camera;
        if (shot) {
            shot.orbit += dt * 0.18;
            const b = shot.b;
            const r = Math.hypot(shot.cam.px - b.worldX, shot.cam.pz - b.worldZ);
            cam.position.set(
                b.worldX + Math.cos(shot.orbit) * r,
                shot.cam.py,
                b.worldZ + Math.sin(shot.orbit) * r
            );
            cam.lookAt(shot.cam.lx, shot.cam.ly, shot.cam.lz);
            this._aim.set(shot.cam.lx, shot.cam.ly, shot.cam.lz);
        } else {
            // intro / outro: drift on the spot, keeping the current heading
            this._aimFromCamera();
        }
    },

    _aim: new THREE.Vector3(),
    _aimFromCamera() {
        const cam = G.camera;
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        this._aim.copy(cam.position).add(f.multiplyScalar(300));
    },

    // ── in-frame caption quad ───────────────────────────────────────────────
    /* A plane pinned to the camera with depthTest off. It lives in G.scene
       because that is what main.js renders; the camera itself is not in the
       graph, so parenting to it would never draw. */
    _buildCaption() {
        if (this._cap) { this._cap.visible = true; return; }
        const cv = document.createElement('canvas');
        cv.width = 1280; cv.height = 720;
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        /* opacity stays pinned at 1 for the life of the quad. Fading the
           material would fade the letterbox bars too, and translucent bars
           with the city showing through them read as a rendering fault rather
           than a frame. The fades are painted into the canvas instead, with
           separate alphas for the copy and the bars. */
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, depthTest: false, depthWrite: false,
            fog: false, toneMapped: false, opacity: 1
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 9999;
        mesh.name = 'briefingCaption';
        G.scene.add(mesh);
        this._cap = mesh;
        this._capCv = cv;
        this._capCtx = cv.getContext('2d');
        this._capTex = tex;
        this._card = null;
        this._cur = null;
        this._alphaT = 0;
        this._alphaB = 0;
        this._drawCaption();
    },

    _destroyCaption() {
        if (!this._cap) return;
        G.scene.remove(this._cap);
        this._cap.geometry.dispose();
        this._cap.material.map?.dispose();
        this._cap.material.dispose();
        this._cap = null;
        this._capCtx = null;
        this._capTex = null;
    },

    /* Quantised so a two-frame fade does not re-upload a 3 MB texture 60 times
       a second — 1/12 steps are below the perceptual threshold at these
       durations. */
    _setAlpha(text, bars) {
        const q = v => Math.round(Math.max(0, Math.min(1, v)) * 12) / 12;
        const t = q(text), b = q(bars);
        if (t === this._alphaT && b === this._alphaB) return;
        this._alphaT = t;
        this._alphaB = b;
        this._drawCaption();
    },

    _setCaption(kicker, headline, source) {
        this._card = null;
        this._cur = { kicker, headline, source };
        this._drawCaption();
    },
    _setCard(title, sub, note) {
        this._card = { title, sub, note };
        this._drawCaption();
    },

    /** Keep the quad exactly filling the frustum, whatever the FOV/aspect. */
    _placeCaption() {
        const mesh = this._cap;
        if (!mesh) return;
        const cam = G.camera;
        // near is 4; 12 units out clears it with room for float error.
        const dist = 12;
        const h = 2 * dist * Math.tan((cam.fov * Math.PI / 180) / 2);
        mesh.scale.set(h * cam.aspect, h, 1);
        mesh.quaternion.copy(cam.quaternion);
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        mesh.position.copy(cam.position).add(f.multiplyScalar(dist));

        // Re-letterbox when the window aspect changes, so text never stretches.
        const want = Math.max(400, Math.round(1280 / Math.max(0.4, cam.aspect)));
        if (Math.abs(want - this._capCv.height) > 8) {
            this._capCv.height = want;
            this._drawCaption();
        }
    },

    _drawCaption() {
        const c = this._capCtx;
        if (!c) return;
        const W = this._capCv.width, H = this._capCv.height;
        const aT = this._alphaT ?? 0, aB = this._alphaB ?? 0;
        c.globalAlpha = 1;
        c.clearRect(0, 0, W, H);

        if (this._card) {
            c.globalAlpha = aT;
            c.fillStyle = 'rgba(4,7,15,0.86)';
            c.fillRect(0, 0, W, H);
            c.textAlign = 'center';
            c.fillStyle = '#ffffff';
            c.font = '700 42px "Press Start 2P", monospace';
            c.shadowColor = 'rgba(34,211,238,0.85)';
            c.shadowBlur = 26;
            c.fillText(this._card.title, W / 2, H * 0.45);
            c.shadowBlur = 0;
            c.fillStyle = '#22d3ee';
            c.font = '700 22px Silkscreen, monospace';
            c.fillText(this._card.sub, W / 2, H * 0.56);
            if (this._card.note) {
                c.fillStyle = '#7c8db0';
                c.font = '18px "JetBrains Mono", monospace';
                c.fillText(this._card.note, W / 2, H * 0.63);
            }
            c.globalAlpha = 1;
            this._capTex.needsUpdate = true;
            return;
        }

        // Cinematic bars — fully opaque so the frame reads as letterboxed film
        // rather than a translucent tint over the skyline.
        const bar = Math.round(H * 0.09);
        c.globalAlpha = aB;
        c.fillStyle = '#05070d';
        c.fillRect(0, 0, W, bar);
        c.fillRect(0, H - bar, W, bar);

        const cur = this._cur;
        if (!cur) { c.globalAlpha = 1; this._capTex.needsUpdate = true; return; }

        /* Scrim above the lower bar. Shots are framed on sunlit glass towers,
           and white text with a drop shadow alone loses the kicker line
           against them. */
        const scrimH = Math.round(H * 0.32);
        const grad = c.createLinearGradient(0, H - bar - scrimH, 0, H - bar);
        grad.addColorStop(0, 'rgba(5,7,13,0)');
        grad.addColorStop(1, 'rgba(5,7,13,0.72)');
        c.globalAlpha = aB;
        c.fillStyle = grad;
        c.fillRect(0, H - bar - scrimH, W, scrimH);

        c.globalAlpha = aT;

        const lab = this.shots[this._shotIdx];
        const accent = (lab && LABS[lab.lab]?.color) || '#22d3ee';
        c.textAlign = 'center';
        c.fillStyle = accent;
        c.font = '700 20px Silkscreen, monospace';
        c.shadowColor = '#000'; c.shadowBlur = 8;
        c.fillText(cur.kicker.toUpperCase(), W / 2, H - bar - 132);

        c.fillStyle = '#ffffff';
        c.font = '700 24px "Press Start 2P", monospace';
        const lines = this._wrap(c, cur.headline, W * 0.78, 3);
        lines.forEach((ln, i) => c.fillText(ln, W / 2, H - bar - 88 + i * 34));

        if (cur.source) {
            c.fillStyle = '#9db0cf';
            c.font = '16px "JetBrains Mono", monospace';
            c.fillText(cur.source, W / 2, H - bar - 88 + lines.length * 34 + 10);
        }
        c.shadowBlur = 0;

        // Branding in the top bar so a downloaded clip is self-identifying.
        c.textAlign = 'left';
        c.fillStyle = '#7c8db0';
        c.font = '14px Silkscreen, monospace';
        c.fillText('SINGULARITY CITY · DAILY BRIEFING', 26, bar - 10);
        c.textAlign = 'right';
        c.fillText(this.date || '', W - 26, bar - 10);

        c.globalAlpha = 1;
        this._capTex.needsUpdate = true;
    },

    /** Greedy wrap; the last allowed line swallows the remainder and elides. */
    _wrap(c, text, maxW, maxLines) {
        const words = String(text).split(/\s+/).filter(Boolean);
        const out = [];
        let line = '';
        for (let i = 0; i < words.length; i++) {
            const next = line ? line + ' ' + words[i] : words[i];
            if (line && c.measureText(next).width > maxW) {
                out.push(line);
                if (out.length === maxLines - 1) {
                    let rest = words.slice(i).join(' ');
                    const full = rest;
                    while (rest.length > 1 && c.measureText(rest + '…').width > maxW) rest = rest.slice(0, -1);
                    out.push(rest === full ? rest : rest.replace(/\s*\S*$/, '') + '…');
                    return out;
                }
                line = words[i];
            } else line = next;
        }
        if (line) out.push(line);
        return out;
    },

    // ── on-screen chrome (never captured — it must not be in the video) ─────
    _buildChrome() {
        let ov = $('briefOverlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'briefOverlay';
            ov.innerHTML = `<div class="brief-rec" id="briefRec"><i></i>REC</div>
                <button id="briefStop">✕ Stop briefing</button>`;
            document.body.appendChild(ov);
            $('briefStop').onclick = () => this.abort();
        }
        ov.classList.remove('hidden');
        $('briefRec').style.display = this.canRecord() ? '' : 'none';
    },
    _destroyChrome() { $('briefOverlay')?.classList.add('hidden'); },

    _bindKeys() {
        if (this._keyHandler) return;
        this._keyHandler = (e) => {
            if (!this.active) return;
            if (e.code !== 'Escape' && e.code !== 'Tab') return;
            e.preventDefault();
            e.stopPropagation();
            this.abort();
        };
        window.addEventListener('keydown', this._keyHandler, true);
    },
    _unbindKeys() {
        if (this._keyHandler) window.removeEventListener('keydown', this._keyHandler, true);
        this._keyHandler = null;
    },

    // ── recording ───────────────────────────────────────────────────────────
    _startRecording() {
        if (!this.canRecord()) {
            G.ui?.addToast?.('📽 Recording is not supported here — playing the tour only', 'info');
            return;
        }
        let stream;
        try { stream = G.renderer.domElement.captureStream(FPS); }
        catch (e) { stream = null; }
        if (!stream) { G.ui?.addToast?.('📽 Canvas capture unavailable — playing the tour only', 'info'); return; }

        this._chunks = [];
        this._mime = pickMimeType();
        let rec = null;
        try {
            rec = new MediaRecorder(stream, this._mime
                ? { mimeType: this._mime, videoBitsPerSecond: 8000000 }
                : { videoBitsPerSecond: 8000000 });
        } catch (e) {
            try { rec = new MediaRecorder(stream); } catch (e2) { rec = null; }
        }
        if (!rec) { G.ui?.addToast?.('📽 Recorder refused this canvas — playing the tour only', 'info'); return; }

        rec.ondataavailable = (e) => { if (e.data && e.data.size) this._chunks.push(e.data); };
        rec.onstop = () => this._onRecordingStop();
        rec.onerror = () => { this._rec = null; this._chunks = []; };
        try { rec.start(250); } catch (e) { return; }
        this._rec = rec;
    },

    _stopRecording() {
        if (this._rec && this._rec.state !== 'inactive') {
            try { this._rec.stop(); } catch (e) { /* already gone */ }
        }
    },

    _onRecordingStop() {
        const chunks = this._chunks;
        this._rec = null;
        this._chunks = [];
        if (this._cancelled || !chunks.length) return;
        const type = (this._mime || 'video/webm').split(';')[0];
        this._blob = new Blob(chunks, { type });
        this._download();
        this._showShare();
    },

    _download() {
        if (!this._blob) return;
        if (this._url) URL.revokeObjectURL(this._url);
        this._url = URL.createObjectURL(this._blob);
        const a = document.createElement('a');
        a.href = this._url;
        a.download = `singularity-city-briefing-${this.date}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    },

    shareText() {
        return `Today in Singularity City — ${this.date}\n${(this._lastLabs || []).join(' · ')}\n\nsingularitycity.net`;
    },

    _showShare() {
        const labs = this._lastLabs || [];
        const kb = Math.round(this._blob.size / 1024);
        let el = $('briefShare');
        if (!el) {
            el = document.createElement('div');
            el.id = 'briefShare';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <div class="bs-h">📽 Briefing saved<button type="button" aria-label="Dismiss">×</button></div>
            <div class="bs-b">${kb >= 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb + ' KB'} ·
                ${labs.length} shot${labs.length === 1 ? '' : 's'} — ${labs.join(' · ') || 'skyline'}.
                Check your downloads folder.</div>
            <div class="bs-a">
                <button type="button" class="btn" data-act="save">⬇ Save again</button>
                <button type="button" class="btn" data-act="copy">📋 Copy caption</button>
            </div>`;
        el.classList.remove('hidden');
        const close = () => el.classList.add('hidden');
        el.querySelector('.bs-h button').onclick = close;
        el.querySelector('[data-act="save"]').onclick = () => this._download();
        el.querySelector('[data-act="copy"]').onclick = async (e) => {
            try { await navigator.clipboard.writeText(this.shareText()); } catch (_) { /* denied */ }
            e.target.textContent = '✓ Copied';
            setTimeout(() => { e.target.textContent = '📋 Copy caption'; }, 1500);
        };
        clearTimeout(this._shareT);
        this._shareT = setTimeout(close, 45000);
    }
};
