/* ════════════════════════════════════════════════════════════════════════════════
   CITIZEN OF THE DAY — daily-rotating spotlight on one model NPC.

   Each UTC day, one model is picked as the day's spotlight. They get:
     • A small gold crown sprite floating above their head (24/7)
     • 3 paparazzi NPCs trailing them with cameras (morning + early afternoon
       commute windows only — that's when the streets are busy and the show
       is most visible)
     • Camera-flash sparkles fired periodically by the paparazzi
     • Biased "press" chat bubbles (no comment, off the record, etc.)
       — see entities.js chat injection
     • A small 👑 button next to the multiplayer-reactions emoji bar that
       opens an info card → "Track" button camera-locks onto them

   Pick logic (deterministic across visitors on the same UTC date):
     1. Read the news-engine event log for yesterday (sc_news_events_v1).
        If any lab was mentioned, pick the highest-scored active model from
        that lab — gives the city a faint "yesterday's hero is today's star"
        narrative.
     2. Otherwise, hash the UTC date and modulo into the active models list.
        Same answer for every visitor on the same day.

   Result is cached in localStorage so reloads don't re-roll, AND so visitors
   who open the app after midnight see today's pick even if their machine was
   off all night.
   ════════════════════════════════════════════════════════════════════════════════ */

window.CitizenOfDay = (function() {

    const STATE = {
        cotdId: null,
        cotdName: null,
        cotdLab: null,
        cotdDate: null,         // UTC date string "YYYY-MM-DD"
        crown: null,            // PIXI.Container attached to citizen
        paparazzi: [],          // [{ cont, headG, bodyG, camG, lagX, lagY, flashTick, lastDir, anim }]
        flashFx: [],            // [{ x, y, life, maxLife }]
        card: null,             // DOM card element (built lazily)
        button: null,           // DOM button element
        attachAttempts: 0
    };

    const LS_PICK_KEY = 'sc_cotd_pick_v1';
    const LS_NEWS_KEY = 'sc_news_events_v1';   // shared with news_reactivity (we
                                                // also write to this from
                                                // recordReaction)

    // ─── DATE UTIL ───────────────────────────────────────────────────────────
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

    // ─── PICK LOGIC ──────────────────────────────────────────────────────────
    function pickActive() {
        if (typeof G === 'undefined' || !Array.isArray(G.models)) return [];
        return G.models.filter(m =>
            m && m.id && m.phase !== 'retired' && m.phase !== 'rumored' && !m.ret
        );
    }

    function tryPickFromNewsLab(active, today) {
        // Find which lab was most-mentioned in yesterday's events. Pick the
        // alphabetically-first active model from that lab so the choice is
        // still deterministic across visitors.
        try {
            const yest = yesterdayUtcDateString();
            // Prefer the merged cloud + local lookup if API is available so
            // server-accumulated events count even when the user's local log
            // is empty. Falls back to raw localStorage if API isn't loaded.
            let events = [];
            if (typeof API !== 'undefined' && typeof API.getEventsByDate === 'function') {
                events = API.getEventsByDate(yest);
            } else {
                const log = JSON.parse(localStorage.getItem(LS_NEWS_KEY) || '[]');
                events = (log || []).filter(e => e && e.date === yest);
            }
            const labCounts = {};
            for (const ev of events) {
                if (!ev || !ev.lab) continue;
                labCounts[ev.lab] = (labCounts[ev.lab] || 0) + 1;
            }
            const labIds = Object.keys(labCounts);
            if (!labIds.length) return null;
            // Top lab — break ties deterministically by lab id sort
            labIds.sort((a, b) => labCounts[b] - labCounts[a] || a.localeCompare(b));
            const topLab = labIds[0];
            const candidates = active.filter(m => m.lab === topLab).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
            if (!candidates.length) return null;
            // Date-deterministic offset within the lab so multi-day mention runs
            // don't re-pick the same model
            const idx = hashStr(today + '|' + topLab) % candidates.length;
            return candidates[idx];
        } catch (_e) { return null; }
    }

    function pickToday() {
        const today = utcDateString();
        // Cached result for today?
        try {
            const raw = localStorage.getItem(LS_PICK_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached && cached.date === today && cached.id) {
                    // Validate the cached model is still in the city
                    const active = pickActive();
                    const found = active.find(m => m.id === cached.id);
                    if (found) {
                        return { model: found, date: today, source: 'cache' };
                    }
                    // else fall through to re-pick (model might have retired)
                }
            }
        } catch (_e) { /* ignore */ }

        const active = pickActive();
        if (!active.length) return null;

        // Try news-derived pick first
        let model = tryPickFromNewsLab(active, today);
        let source = 'news';
        if (!model) {
            const idx = hashStr(today) % active.length;
            model = active[idx];
            source = 'hash';
        }
        if (!model) return null;

        try {
            localStorage.setItem(LS_PICK_KEY, JSON.stringify({ date: today, id: model.id, source }));
        } catch (_e) { /* ignore */ }

        return { model, date: today, source };
    }

    // ─── CROWN SPRITE ────────────────────────────────────────────────────────
    function buildCrown() {
        const c = new PIXI.Container();
        c.zIndex = 50;
        const g = new PIXI.Graphics();
        // Tiny 3-spike pixel crown (gold)
        const gold = 0xfbbf24;
        const goldHi = 0xffd97a;
        const goldShd = 0xb45309;
        // Base band
        g.beginFill(goldShd); g.drawRect(-5, 0, 10, 1); g.endFill();
        g.beginFill(gold);    g.drawRect(-5, -1, 10, 2); g.endFill();
        // 3 spikes
        g.beginFill(gold);
        g.drawRect(-5, -3, 2, 2);
        g.drawRect(-1, -4, 2, 3);
        g.drawRect(3, -3, 2, 2);
        g.endFill();
        // Spike highlights
        g.beginFill(goldHi);
        g.drawRect(-5, -3, 1, 1);
        g.drawRect(-1, -4, 1, 1);
        g.drawRect(3, -3, 1, 1);
        // Center jewel
        g.beginFill(0xef4444);
        g.drawRect(-1, -1, 2, 1);
        g.endFill();
        c.addChild(g);
        c.y = -16; // sit just above the head
        return c;
    }

    function attachCrown() {
        if (STATE.crown) return;
        if (!STATE.cotdId) return;
        const refs = G.charRefs && G.charRefs[STATE.cotdId];
        if (!refs || !refs.c) return;
        const crown = buildCrown();
        refs.c.addChild(crown);
        STATE.crown = crown;
    }

    // ─── PAPARAZZI SPRITES ───────────────────────────────────────────────────
    function buildPaparazzo(palette) {
        const c = new PIXI.Container();
        c.zIndex = 14;

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(palette.coat);
        body.drawRect(-3, -10, 6, 8);   // torso
        body.endFill();
        // Pants
        body.beginFill(0x1f2937);
        body.drawRect(-3, -2, 3, 4);
        body.drawRect(0, -2, 3, 4);
        body.endFill();
        c.addChild(body);

        // Head
        const head = new PIXI.Graphics();
        head.beginFill(palette.skin);
        head.drawRect(-2, -16, 4, 5);
        head.endFill();
        c.addChild(head);

        // Camera (dark body + flash square)
        const cam = new PIXI.Graphics();
        cam.beginFill(0x111111);
        cam.drawRect(2, -13, 5, 3);
        cam.endFill();
        cam.beginFill(0xf5f5f5, 0.85);
        cam.drawRect(5, -13, 1, 1); // lens highlight
        cam.endFill();
        c.addChild(cam);

        return { cont: c, body, head, cam, palette };
    }

    function spawnPaparazzi() {
        if (STATE.paparazzi.length) return;
        if (!G.charLayer) return;
        const palettes = [
            { coat: 0x2563eb, skin: 0xf4c89e },   // blue jacket
            { coat: 0x9333ea, skin: 0xc89c7c },   // purple jacket
            { coat: 0x16a34a, skin: 0xf2d8b6 }    // green jacket
        ];
        const lags = [
            { x: -28, y: 0,  speed: 1.4 },
            { x: -46, y: -2, speed: 1.2 },
            { x: -62, y: 1,  speed: 1.1 }
        ];
        for (let i = 0; i < 3; i++) {
            const p = buildPaparazzo(palettes[i]);
            p.lagX = lags[i].x;
            p.lagY = lags[i].y;
            p.speed = lags[i].speed;
            p.flashTick = Math.floor(Math.random() * 90);
            p.lastDir = 1;
            p.anim = Math.random() * Math.PI * 2;
            p.cont.visible = false;
            G.charLayer.addChild(p.cont);
            STATE.paparazzi.push(p);
        }
    }

    function despawnPaparazzi() {
        for (const p of STATE.paparazzi) {
            if (p.cont && p.cont.parent) p.cont.parent.removeChild(p.cont);
            if (p.cont) p.cont.destroy({ children: true });
        }
        STATE.paparazzi = [];
    }

    // ─── COMMUTE WINDOW DETECTION ────────────────────────────────────────────
    function inCommuteWindow() {
        if (typeof G === 'undefined' || typeof G.getDayPhase !== 'function') return false;
        const dp = G.getDayPhase();
        // Morning commute (7:12am–1:12pm) and early afternoon (3:36pm–6:43pm)
        return (dp >= 0.30 && dp <= 0.55) || (dp >= 0.65 && dp <= 0.78);
    }

    // ─── UPDATE TICK ─────────────────────────────────────────────────────────
    function update() {
        if (typeof G === 'undefined' || !G.app) return;

        // First-time pick + crown attach (retry until citizens spawn)
        if (!STATE.cotdId || STATE.cotdDate !== utcDateString()) {
            tryPickAndAttach();
        }
        if (STATE.cotdId && !STATE.crown) {
            // Crown wasn't attached yet (citizen not ready) — keep retrying for a few seconds
            STATE.attachAttempts++;
            if (STATE.attachAttempts < 600) attachCrown();
        }

        // Paparazzi commute logic — runs each frame
        if (!STATE.cotdId) return;
        const refs = G.charRefs[STATE.cotdId];
        const cotdVisible = refs && refs.c && refs.c.visible;
        const showShow = cotdVisible && inCommuteWindow();

        if (showShow && !STATE.paparazzi.length) spawnPaparazzi();
        if (!showShow && STATE.paparazzi.length) despawnPaparazzi();

        if (showShow && STATE.paparazzi.length && refs && refs.c) {
            const targetX = refs.c.x;
            const targetY = refs.c.y;
            // Direction: walk same direction as COTD (if we can read it). Use
            // refs.c.scale.x sign as a hint, default to last direction.
            const facing = refs.c.scale && refs.c.scale.x < 0 ? -1 : 1;

            for (let i = 0; i < STATE.paparazzi.length; i++) {
                const p = STATE.paparazzi[i];
                const desiredX = targetX + p.lagX * facing;
                const desiredY = targetY + p.lagY;

                // Smooth lerp toward target
                p.cont.x += (desiredX - p.cont.x) * 0.18;
                p.cont.y += (desiredY - p.cont.y) * 0.22;
                p.cont.visible = true;

                // Mirror to face the COTD's direction
                p.cont.scale.x = facing < 0 ? -1 : 1;

                // Walking bob animation
                p.anim += 0.18;
                const bob = Math.sin(p.anim + i) * 0.6;
                if (p.body) p.body.y = bob;
                if (p.head) p.head.y = bob;
                if (p.cam)  p.cam.y  = bob;

                // Camera flash trigger
                p.flashTick--;
                if (p.flashTick <= 0) {
                    p.flashTick = 70 + Math.floor(Math.random() * 90);
                    STATE.flashFx.push({
                        x: p.cont.x + 6 * facing,
                        y: p.cont.y - 12,
                        life: 8,
                        maxLife: 8
                    });
                }
                p.lastDir = facing;
            }
        }

        // Draw camera flashes — short bright bursts on G.fxGfx
        if (G.fxGfx && STATE.flashFx.length) {
            const gfx = G.fxGfx;
            for (let i = STATE.flashFx.length - 1; i >= 0; i--) {
                const f = STATE.flashFx[i];
                f.life--;
                if (f.life <= 0) { STATE.flashFx.splice(i, 1); continue; }
                const t = f.life / f.maxLife;
                gfx.beginFill(0xffffff, 0.85 * t);
                gfx.drawCircle(f.x, f.y, 7 * (1 - t * 0.5));
                gfx.endFill();
                gfx.beginFill(0xffffff, 0.45 * t);
                gfx.drawCircle(f.x, f.y, 14 * (1 - t * 0.4));
                gfx.endFill();
            }
        }
    }

    function tryPickAndAttach() {
        const result = pickToday();
        if (!result) return false;
        const m = result.model;
        STATE.cotdId = m.id;
        STATE.cotdName = m.name;
        STATE.cotdLab = m.lab;
        STATE.cotdDate = result.date;
        STATE.attachAttempts = 0;
        attachCrown();
        // Update the button if it already exists
        if (STATE.button) refreshButton();
        return true;
    }

    // ─── INFO CARD UI ────────────────────────────────────────────────────────
    function buildButton() {
        if (STATE.button) return;
        const bar = document.getElementById('mpReactions');
        if (!bar) return; // multiplayer hasn't built its UI yet — retry later
        const btn = document.createElement('button');
        btn.id = 'cotd-btn';
        btn.className = 'mp-react-btn cotd-btn';
        btn.title = 'Citizen of the Day';
        btn.textContent = '👑';
        btn.onclick = openCard;
        bar.appendChild(btn);
        STATE.button = btn;
        refreshButton();
    }

    function refreshButton() {
        if (!STATE.button) return;
        if (STATE.cotdId) STATE.button.title = `Citizen of the Day: ${STATE.cotdName}`;
    }

    function bioFor(m) {
        if (!m) return '';
        const lab = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].name) || m.lab || 'an independent';
        const phase = m.phase ? m.phase[0].toUpperCase() + m.phase.slice(1) : '';
        const tal = m.talent || m.tal || '';
        const per = m.personality || m.per || '';
        const rel = m.released || m.rel || null;

        const parts = [];
        const archetype = tal ? `${tal} model` : 'frontier model';
        parts.push(`${m.name} is a ${archetype} from ${lab}`);
        if (per) parts.push(`with a ${per.toLowerCase()} personality`);
        if (rel) parts.push(`released ${rel}`);
        let line = parts.join(' ') + '.';

        // Optional benchmark flex
        if (typeof BM !== 'undefined' && BM[m.id]) {
            const b = BM[m.id];
            if (b.ELO) line += ` Arena ELO: ${b.ELO}.`;
            else if (b.MMLU) line += ` MMLU: ${b.MMLU}%.`;
        }
        if (phase) line += ` Currently ${phase.toLowerCase()}.`;
        return line;
    }

    function openCard() {
        if (!STATE.cotdId) return;
        const m = G.models.find(x => x.id === STATE.cotdId);
        if (!m) return;
        if (STATE.card) closeCard();

        const lab = (typeof LABS !== 'undefined' && LABS[m.lab]) || { name: m.lab, color: '#22d3ee', icon: '🏢' };
        const card = document.createElement('div');
        card.id = 'cotd-card';
        card.innerHTML = `
            <div class="cotd-card-head">
                <div class="cotd-card-portrait" style="background:${escapeAttr(lab.color)}1a;border-color:${escapeAttr(lab.color)};">
                    <span class="cotd-card-crown">👑</span>
                    <span class="cotd-card-icon">${escapeHtml(lab.icon || '🏢')}</span>
                </div>
                <div class="cotd-card-titles">
                    <div class="cotd-card-tag">CITIZEN OF THE DAY</div>
                    <div class="cotd-card-name">${escapeHtml(m.name)}</div>
                    <div class="cotd-card-lab" style="color:${escapeAttr(lab.color)};">${escapeHtml(lab.name || m.lab)}</div>
                </div>
                <button class="cotd-card-close" aria-label="Close">×</button>
            </div>
            <div class="cotd-card-bio">${escapeHtml(bioFor(m))}</div>
            <div class="cotd-card-actions">
                <button class="cotd-card-btn cotd-card-track">🎥 Track</button>
                <button class="cotd-card-btn cotd-card-share">𝕏 Share</button>
            </div>
        `;
        document.body.appendChild(card);
        STATE.card = card;
        requestAnimationFrame(() => card.classList.add('cotd-card-in'));

        card.querySelector('.cotd-card-close').onclick = closeCard;
        card.querySelector('.cotd-card-track').onclick = () => {
            try {
                if (typeof G !== 'undefined') G.tracking = { type: 'model', id: STATE.cotdId };
            } catch (_e) { /* ignore */ }
            closeCard();
        };
        card.querySelector('.cotd-card-share').onclick = () => {
            const text = `👑 Today's Citizen of the Day in Singularity City: ${m.name} from ${lab.name || m.lab}.\n\nWatch: https://singularitycity.net`;
            const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(text);
            window.open(intent, '_blank', 'noopener');
        };

        // Achievement
        try { if (typeof G !== 'undefined' && typeof G.unlockAchieve === 'function') G.unlockAchieve('cotd_seen'); } catch (_e) { /* ignore */ }

        // Click-outside to close
        setTimeout(() => {
            const onDocClick = (e) => {
                if (!STATE.card) { document.removeEventListener('click', onDocClick); return; }
                if (!STATE.card.contains(e.target) && e.target !== STATE.button) {
                    closeCard();
                    document.removeEventListener('click', onDocClick);
                }
            };
            document.addEventListener('click', onDocClick);
        }, 0);
    }

    function closeCard() {
        if (!STATE.card) return;
        STATE.card.classList.remove('cotd-card-in');
        const c = STATE.card;
        STATE.card = null;
        setTimeout(() => { if (c && c.parentNode) c.parentNode.removeChild(c); }, 240);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function escapeAttr(s) { return escapeHtml(s); }

    // ─── BUTTON BOOT (poll for multiplayer bar) ──────────────────────────────
    function tryAttachButton(retries) {
        retries = retries || 0;
        if (STATE.button) return;
        if (document.getElementById('mpReactions')) {
            buildButton();
            return;
        }
        if (retries > 100) return; // give up after ~10s
        setTimeout(() => tryAttachButton(retries + 1), 100);
    }

    // ─── INIT ────────────────────────────────────────────────────────────────
    function init() {
        // Try to pick now (might fail if models haven't loaded yet — that's
        // fine, update() will retry every frame).
        tryPickAndAttach();
        tryAttachButton();
    }

    // ─── PUBLIC: report which model is COTD (used by entities.js for chat injection) ───
    function isCotd(modelId) {
        return STATE.cotdId && modelId === STATE.cotdId;
    }
    function getId() { return STATE.cotdId; }

    return { init, update, isCotd, getId, _state: STATE, _pickToday: pickToday };
})();

// Auto-init on DOM ready
(function() {
    function tryInit() {
        if (typeof CitizenOfDay !== 'undefined') CitizenOfDay.init();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
})();
