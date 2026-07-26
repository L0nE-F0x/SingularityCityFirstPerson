/* ════════════════════════════════════════════════════════════════════════════════
   NEWS REACTIVITY ENGINE — when AI news breaks, the city visibly reacts.

   How it works:
     1. Reads the existing HN AI-stories feed already polled by HNBlimps every
        15 min (we don't add a second poller — we just consume their _stories
        array). New story ids are tracked in localStorage so a story only ever
        triggers ONE reaction across page reloads.
     2. Each new story is routed to a lab (keyword match against title) and
        classified by sentiment (celebrate / crisis / emergency / regulatory).
     3. Pick a reaction archetype:
          🎉 LAUNCH PARTY   — fireworks above the lab's HQ
          😰 CRISIS FLICKER — red pulse overlay on the HQ for ~12s
          🚁 EMERGENCY HUDDLE — flicker + lab CEO's helicopter takes a scenic
                                 flight (signaling "all hands on deck")
          ⚖️ COURT CONVENE  — summon models to the AI Court hearing chamber
     4. The source headline gets unshifted into API.liveNews so the existing
        bottom-of-screen news ticker crawls it within seconds.
     5. An in-canvas share toast appears with a pre-written post draft + a
        "Copy" button + "Post" button (opens X compose intent). User decides
        whether to actually post.

   Cooldown: 3 minutes between any two reactions so the city isn't a constant
   barrage. Engine is opt-out via localStorage('sc_news_reactivity_off' = '1').

   For testing, call NewsReactivity._test('celebrate', 'openai') from the
   console to force-fire a reaction without waiting for real news.
   ════════════════════════════════════════════════════════════════════════════════ */

window.NewsReactivity = (function() {

    const STATE = {
        seenIds: new Set(),         // story ids already reacted to (or skipped)
        activeFlickers: [],         // [{ bldId, until, color }]
        activeFireworks: [],        // [{ x, y, vx, vy, life, maxLife, color, size }]
        recent: [],                 // last N reactions for the share UI
        lastReactionTick: -100000,
        cooldownTicks: 60 * 180,    // 3 minutes at 60fps
        scanTickStride: 30,         // check for new stories every N ticks (~0.5s)
        bootGraceTicks: 600,        // skip the first ~10s of HN data so we don't
                                    // dump a parade of reactions on first boot
        bootedAt: -1,
        disabled: false,
        replayMode: false,        // Briefing replay — suppresses persistEvent
                                  // AND share toast (full silent replay)
        skipPersistOnly: false    // Cloud-driven reaction — suppresses just
                                  // persistEvent (event is already in Supabase);
                                  // share toast still fires so user is alerted
    };

    const LS_SEEN_KEY    = 'sc_news_seen_ids_v1';
    const LS_OFF_KEY     = 'sc_news_reactivity_off';
    const LS_EVENTS_KEY  = 'sc_news_events_v1';   // shared with citizen_of_day.js — keep in sync
    const SEEN_CAP       = 250;
    const EVENTS_CAP     = 200;

    // ─── LAB ROUTER ──────────────────────────────────────────────────────────
    // Order matters — first match wins. Founder names are intentionally listed
    // because HN headlines often reference them rather than the lab.
    // KEEP IN SYNC with the classifier in netlify/functions/collect-events.mjs —
    // the server writes pre-classified events with the same rules; divergence
    // means the same headline reads differently server vs client.
    const LAB_KEYWORDS = [
        ['anthropic', /\b(anthropic|claude|dario amodei|amodei)\b/i],
        ['openai',    /\b(openai|chatgpt|sam altman|altman|gpt-?\d|sora|o1|o3|o4)\b/i], // no bare o2 — matches 'O2 arena'
        ['google',    /\b(google|deepmind|gemini|hassabis|pichai|alphabet)\b/i],
        ['xai',       /\b(xai|x\.ai|grok|elon musk|musk)\b/i],
        ['meta',      /\b(meta|llama|zuckerberg|mark zuck|fb research)\b/i],
        ['mistral',   /\b(mistral|arthur mensch|mensch|mixtral)\b/i],
        ['deepseek',  /\b(deepseek|liang wenfeng)\b/i],
        ['microsoft', /\b(microsoft|nadella|copilot|bing chat)\b/i],
        ['nvidia',    /\b(nvidia|jensen huang|cuda|h100|h200|b100|blackwell)\b/i],
        ['tesla',     /\b(tesla|optimus)\b/i],
        ['alibaba',   /\b(alibaba|qwen|tongyi)\b/i],
        ['cohere',    /\b(cohere|aidan gomez|command r)\b/i],
        ['perplexity',/\b(perplexity|aravind)\b/i],
        ['stability', /\b(stable diffusion|stability ai)\b/i],
        ['hugging_face', /\b(hugging ?face)\b/i]
    ];

    // ─── SENTIMENT CLASSIFIER ────────────────────────────────────────────────
    // Multi-class. Order: emergency > regulatory > crisis > celebrate.
    const SENTIMENT = {
        emergency: /\b(fired|lawsuit|sued|breach(es|ed)?|hack(ed|s)?|leak(ed|s)?|exposed|whistleblow|board fires|departs|resigns|stepping down|class action|criminal|fraud|insider trading)\b/i,
        regulatory: /\b(regulation|regulat(es|ed|ing)|ban(ned)?|eu ai act|congress|senate|ftc|doj|antitrust|hearing|subpoena|investig(ation|ates)|complaint|fines?|copyright suit)\b/i,
        crisis: /\b(controversy|criticized|under fire|backlash|outage|down|crash|recall|apologi[sz]e|delays?|deprecat(es|ed|ing)|shut(s|ting)? down)\b/i,
        celebrate: /\b(raises?|releases?|launches?|launched|ships?|shipped|announces?|unveils?|debuts?|tops?|beats?|sets record|breakthrough|introduces?|open[- ]?sources?|funded|partnership|partners with|acquires?|valuation|ipo|integration with)\b/i
    };

    function classifyStory(story) {
        const title = (story && story.title) || '';
        let lab = null;
        for (const [labId, re] of LAB_KEYWORDS) {
            if (re.test(title)) { lab = labId; break; }
        }
        let sentiment = null;
        if      (SENTIMENT.emergency.test(title))  sentiment = 'emergency';
        else if (SENTIMENT.regulatory.test(title)) sentiment = 'regulatory';
        else if (SENTIMENT.crisis.test(title))     sentiment = 'crisis';
        else if (SENTIMENT.celebrate.test(title))  sentiment = 'celebrate';

        return { lab, sentiment, title };
    }

    // ─── PERSISTENCE ─────────────────────────────────────────────────────────
    function loadSeen() {
        try {
            const raw = localStorage.getItem(LS_SEEN_KEY);
            if (!raw) return;
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) STATE.seenIds = new Set(arr);
        } catch (_e) { /* ignore */ }
    }
    function saveSeen() {
        try {
            // Cap so the localStorage entry doesn't grow unbounded
            const arr = Array.from(STATE.seenIds).slice(-SEEN_CAP);
            STATE.seenIds = new Set(arr);
            localStorage.setItem(LS_SEEN_KEY, JSON.stringify(arr));
        } catch (_e) { /* ignore */ }
    }
    function isDisabled() {
        try { return localStorage.getItem(LS_OFF_KEY) === '1'; } catch (_e) { return false; }
    }

    // ─── HQ LOOKUP ───────────────────────────────────────────────────────────
    function findHq(labId) {
        if (!labId || typeof G === 'undefined' || !G.bldsByLab) return null;
        const blds = G.bldsByLab[labId] || [];
        return blds.find(b => !b.id.startsWith('house_')) || null;
    }

    // ─── REACTION 1: LAUNCH PARTY (🎉) ───────────────────────────────────────
    function reactLaunchParty(labId, story) {
        const hq = findHq(labId);
        if (!hq) return false;
        const cx = hq.x + hq.w / 2;
        const flH = (hq.dynamicFl || 3) * 45;
        const cy = (G.groundY - flH) - 30;
        // Three bursts staggered over ~3 seconds for a real "celebration" feel
        spawnFireworksBurst(cx, cy, 0xfbbf24);
        setTimeout(() => spawnFireworksBurst(cx + 40, cy + 10, 0x22d3ee), 700);
        setTimeout(() => spawnFireworksBurst(cx - 40, cy - 10, 0xf472b6), 1400);
        addToTicker(`🎉 Celebration at ${labName(labId)} HQ — ${story.title}`, story.url, '#fbbf24');
        recordReaction({
            type: 'celebrate', archetype: 'Launch Party', emoji: '🎉',
            labId, hq, story
        });
        return true;
    }

    // ─── REACTION 2: CRISIS FLICKER (😰) ─────────────────────────────────────
    function reactCrisisFlicker(labId, story) {
        const hq = findHq(labId);
        if (!hq) return false;
        addBuildingFlicker(hq, { color: 0xef4444, durationTicks: 720, intensity: 0.85 });
        addToTicker(`😰 Tension at ${labName(labId)} HQ — ${story.title}`, story.url, '#ef4444');
        recordReaction({
            type: 'crisis', archetype: 'Crisis Flicker', emoji: '😰',
            labId, hq, story
        });
        return true;
    }

    // ─── REACTION 3: EMERGENCY HUDDLE (🚁) ───────────────────────────────────
    function reactEmergencyHuddle(labId, story) {
        const hq = findHq(labId);
        if (!hq) return false;
        addBuildingFlicker(hq, { color: 0xef4444, durationTicks: 1080, intensity: 1.0 });
        // Trigger CEO helicopter scenic flight (existing system) — only if not
        // already mid-trip and the heli system has a ref for this lab.
        try {
            if (typeof Entities !== 'undefined' && Entities.heliRefs && Entities.heliRefs[labId]) {
                const heli = Entities.heliRefs[labId];
                if (heli.state === 'grounded' || heli.state === 'hidden') {
                    heli._scenicCooldown = false;
                    heli.state = 'scenic_flight';
                    if (heli.cont) heli.cont.visible = true;
                }
            }
        } catch (_e) { /* helicopter system optional */ }
        addToTicker(`🚁 Emergency at ${labName(labId)} — ${story.title}`, story.url, '#ef4444');
        recordReaction({
            type: 'emergency', archetype: 'Emergency Huddle', emoji: '🚁',
            labId, hq, story
        });
        return true;
    }

    // ─── REACTION 4: COURT CONVENE (⚖️) ──────────────────────────────────────
    function reactCourtConvene(labId, story) {
        let triggered = false;
        try {
            if (typeof CourtData !== 'undefined' && typeof CourtData._pickModelsForSummon === 'function') {
                CourtData._pickModelsForSummon();
                triggered = true;
            }
        } catch (_e) { /* court system optional */ }
        // Even if Court summon failed, still flicker the AI Court building if
        // we can find it, so the player has a visual cue.
        const courtBld = (typeof G !== 'undefined' && G.bldById) ? (G.bldById['court_senate'] || G.bldById['court_hearing']) : null;
        if (courtBld) addBuildingFlicker(courtBld, { color: 0xa78bfa, durationTicks: 900, intensity: 0.7 });
        const labLabel = labId ? `for ${labName(labId)}` : '';
        addToTicker(`⚖️ Regulatory hearing convening ${labLabel} — ${story.title}`, story.url, '#a78bfa');
        recordReaction({
            type: 'regulatory', archetype: 'Court Convene', emoji: '⚖️',
            labId, hq: courtBld, story
        });
        return triggered || !!courtBld;
    }

    // ─── PRIMITIVE: TARGETED FIREWORKS BURST ─────────────────────────────────
    function spawnFireworksBurst(cx, cy, color) {
        const count = 18;
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4;
            const speed = 1.6 + Math.random() * 1.8;
            STATE.activeFireworks.push({
                x: cx, y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 0.4, // slight upward bias
                life: 70 + Math.floor(Math.random() * 30),
                maxLife: 100,
                color: color || 0xffffff,
                size: 1.6 + Math.random()
            });
        }
    }

    // ─── PRIMITIVE: BUILDING FLICKER OVERLAY ─────────────────────────────────
    function addBuildingFlicker(bld, opts) {
        if (!bld) return;
        const until = (typeof G !== 'undefined' ? G.tick : 0) + (opts.durationTicks || 600);
        // Replace any existing flicker on the same building
        STATE.activeFlickers = STATE.activeFlickers.filter(f => f.bldId !== bld.id);
        STATE.activeFlickers.push({
            bldId: bld.id,
            until,
            color: opts.color != null ? opts.color : 0xef4444,
            intensity: opts.intensity != null ? opts.intensity : 0.8
        });
    }

    function _drawFlickers() {
        if (typeof G === 'undefined' || !G.fxGfx) return;
        const tick = G.tick;
        const gfx = G.fxGfx;
        for (let i = STATE.activeFlickers.length - 1; i >= 0; i--) {
            const f = STATE.activeFlickers[i];
            if (tick > f.until) {
                STATE.activeFlickers.splice(i, 1);
                continue;
            }
            const bld = G.bldById[f.bldId];
            if (!bld) { STATE.activeFlickers.splice(i, 1); continue; }

            const flH = (bld.dynamicFl || 3) * 45;
            const x = bld.x;
            const y = G.groundY - flH;
            const w = bld.w;
            const cx = x + w / 2;

            // Slow ~1 Hz pulse so the eye reads "alarm cadence", not strobe
            const pulse = 0.5 + 0.5 * Math.sin(tick * 0.085);
            const intens = f.intensity;

            // 1. Subtle bottom-up red haze — strong at the base, fades at the
            //    top. Looks like emergency lighting bleeding up the facade
            //    instead of a solid wash. Drawn as 6 thin rect bands stepping
            //    up the building so the alpha gradient is convincing.
            const bands = 6;
            for (let b = 0; b < bands; b++) {
                const t = b / (bands - 1); // 0 at bottom, 1 at top
                const bandAlpha = (1 - t) * (0.10 + pulse * 0.06) * intens;
                gfx.beginFill(f.color, bandAlpha);
                gfx.drawRect(x, y + flH * t, w, flH / bands + 1);
                gfx.endFill();
            }

            // 2. Bright rooftop beacon — the load-bearing visual cue. Small,
            //    pulsing, high-contrast. Reads from anywhere in the city.
            const beaconAlpha = (0.55 + pulse * 0.45) * intens;
            const beaconR = 3.5 + pulse * 2.5;
            // Halo (soft outer)
            gfx.beginFill(f.color, beaconAlpha * 0.18);
            gfx.drawCircle(cx, y - 6, beaconR * 4);
            gfx.endFill();
            // Mid glow
            gfx.beginFill(f.color, beaconAlpha * 0.45);
            gfx.drawCircle(cx, y - 6, beaconR * 2);
            gfx.endFill();
            // Hot core
            gfx.beginFill(f.color, beaconAlpha);
            gfx.drawCircle(cx, y - 6, beaconR);
            gfx.endFill();

            // 3. Sparse "alarm window" strobes — a few small red squares
            //    flicker on at pseudo-random positions across the facade.
            //    Stable seed so the same windows blink each cycle (not noisy
            //    random repaint every frame).
            const seed = ((bld.id || '').length + 1) * 17;
            const winCount = Math.min(6, Math.max(2, Math.floor(flH / 80)));
            for (let k = 0; k < winCount; k++) {
                const cyc = (tick + k * 23 + seed) % 90;
                if (cyc > 18) continue; // off ~80% of the time
                const blink = Math.max(0, 1 - cyc / 18);
                const px = x + 6 + ((seed * 7 + k * 41) % Math.max(1, w - 18));
                const py = y + 18 + ((seed * 11 + k * 53) % Math.max(1, flH - 30));
                gfx.beginFill(f.color, 0.75 * blink * intens);
                gfx.drawRect(px, py, 5, 5);
                gfx.endFill();
            }
        }
    }

    function _drawFireworks() {
        if (typeof G === 'undefined' || !G.fxGfx) return;
        const gfx = G.fxGfx;
        for (let i = STATE.activeFireworks.length - 1; i >= 0; i--) {
            const p = STATE.activeFireworks[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.04;        // gravity
            p.vx *= 0.985;
            p.life--;
            if (p.life <= 0) {
                STATE.activeFireworks.splice(i, 1);
                continue;
            }
            const a = Math.max(0, p.life / p.maxLife);
            gfx.beginFill(p.color, a);
            gfx.drawCircle(p.x, p.y, p.size * a);
            gfx.endFill();
        }
    }

    // ─── HEADLINE INJECTION INTO TICKER ──────────────────────────────────────
    function addToTicker(reactiveLine, url, color) {
        if (typeof API === 'undefined') return;
        if (!Array.isArray(API.liveNews)) API.liveNews = [];
        // Strip any existing "Live: SC" entries first to avoid stacking many
        // reactive lines back-to-back; keep only the most recent two.
        API.liveNews = API.liveNews.filter(n => n.source !== 'Live: SC');
        API.liveNews.unshift({
            headline: reactiveLine,
            url: url || 'https://singularitycity.net',
            source: 'Live: SC',
            color: color || '#22d3ee'
        });
        // Reset the ticker pointer so the new line shows next, not after a long
        // queue of older items.
        try { API.newsIdx = 0; } catch (_e) { /* ignore */ }
    }

    // ─── RECORD REACTION + SHOW SHARE TOAST ──────────────────────────────────
    function recordReaction(r) {
        STATE.recent.unshift(r);
        if (STATE.recent.length > 10) STATE.recent.length = 10;
        STATE.lastReactionTick = (typeof G !== 'undefined' ? G.tick : 0);
        // During briefing-replay we don't want to (a) re-persist yesterday's
        // events as today's, or (b) flood the user with N share toasts.
        if (!STATE.replayMode) {
            // skipPersistOnly = cloud-driven reaction; the event already lives
            // in the server-side sc_events table so we don't write it locally
            // again. Share toast still fires so the user sees the alert.
            if (!STATE.skipPersistOnly) persistEvent(r);
            // The share/alert toast is user-toggleable; persistence still runs so
            // the Daily Briefing history stays intact even when toasts are off.
            if (!(typeof G !== 'undefined' && G.prefs && G.prefs.newsToasts === false)) showShareToast(r);
        }
    }

    // Persist a slim record of every reaction so other modules (CitizenOfDay,
    // Daily Briefing) can read "what happened yesterday" across reloads.
    function persistEvent(r) {
        try {
            const d = new Date();
            const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
            const entry = {
                date,
                ts: d.toISOString(),
                type: r.type,
                archetype: r.archetype,
                emoji: r.emoji,
                lab: r.labId || null,
                title: (r.story && r.story.title) || '',
                url: (r.story && r.story.url) || ''
            };
            const raw = localStorage.getItem(LS_EVENTS_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push(entry);
            // Trim oldest if over cap
            const trimmed = arr.slice(-EVENTS_CAP);
            localStorage.setItem(LS_EVENTS_KEY, JSON.stringify(trimmed));
        } catch (_e) { /* ignore quota / parse errors */ }
    }

    function postTextFor(r) {
        const lab = labName(r.labId);
        const headline = (r.story && r.story.title) || 'AI news';
        const linePerType = {
            celebrate:  `🎉 The crowd at ${lab} is celebrating — fireworks are going off in Singularity City after this just dropped:`,
            crisis:     `😰 ${lab} HQ is flickering red in Singularity City — tension is high after:`,
            emergency:  `🚁 Helicopter just lifted off ${lab} HQ in Singularity City after:`,
            regulatory: `⚖️ Models being summoned to the AI Court in Singularity City after:`
        };
        const lead = linePerType[r.type] || '🚨 Live in Singularity City:';
        const url = (r.story && r.story.url) || 'https://singularitycity.net';
        return `${lead}\n\n"${headline}"\n\n${url}\n\nWatch: https://singularitycity.net`;
    }

    function showShareToast(r) {
        // Reuse a single in-place toast container — replaces previous reactive
        // toast so the user only ever sees the latest.
        let host = document.getElementById('sc-news-share');
        if (!host) {
            host = document.createElement('div');
            host.id = 'sc-news-share';
            document.body.appendChild(host);
        }
        const lab = labName(r.labId);
        const headline = (r.story && r.story.title) || '';
        const post = postTextFor(r);
        host.innerHTML = `
            <div class="sc-news-share-head">
                <span class="sc-news-share-emoji">${r.emoji}</span>
                <span class="sc-news-share-arch">${escape(r.archetype)}</span>
                <span class="sc-news-share-lab">${escape(lab)}</span>
                <button class="sc-news-share-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-news-share-body">${escape(headline)}</div>
            <div class="sc-news-share-actions">
                <button class="sc-news-share-btn sc-news-share-post">𝕏 Post</button>
                <button class="sc-news-share-btn sc-news-share-copy">📋 Copy</button>
                <a class="sc-news-share-btn sc-news-share-camera" href="#">🎥 Show Me</a>
            </div>
        `;
        host.classList.add('sc-news-share-in');

        const closeBtn = host.querySelector('.sc-news-share-close');
        const postBtn  = host.querySelector('.sc-news-share-post');
        const copyBtn  = host.querySelector('.sc-news-share-copy');
        const camBtn   = host.querySelector('.sc-news-share-camera');

        closeBtn.onclick = () => host.classList.remove('sc-news-share-in');
        postBtn.onclick = () => {
            const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(post);
            window.open(intent, '_blank', 'noopener');
        };
        copyBtn.onclick = async () => {
            try {
                await navigator.clipboard.writeText(post);
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
            } catch (_e) {
                copyBtn.textContent = '⚠ Copy failed';
                setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1800);
            }
        };
        camBtn.onclick = (e) => {
            e.preventDefault();
            const hq = r.hq || findHq(r.labId);
            if (!hq || typeof G === 'undefined') return;
            // Camera-pan via the existing tracking system: jump to center on HQ
            // by setting a one-shot tracking object that resolves to HQ x.
            try {
                if (typeof Camera !== 'undefined') {
                    const targetX = hq.x + hq.w / 2;
                    Camera.targetX = -(targetX) + (G.vpW / 2) / Camera.zoom;
                    G.tracking = null;
                }
            } catch (_e) { /* ignore */ }
        };

        // Auto-fade after 45s — long enough to read + click, short enough not
        // to camp on screen.
        clearTimeout(host._dismissTimer);
        host._dismissTimer = setTimeout(() => {
            host.classList.remove('sc-news-share-in');
        }, 45000);
    }

    function escape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function labName(labId) {
        if (!labId) return 'an AI lab';
        if (typeof LABS !== 'undefined' && LABS[labId] && LABS[labId].name) return LABS[labId].name;
        return labId;
    }

    // ─── REACTION DISPATCHER ─────────────────────────────────────────────────
    function dispatch(story, classification) {
        const { lab, sentiment } = classification;
        // No lab match for celebrate/crisis = no anchor for visual reaction
        // — skip rather than fire a generic reaction.
        if (sentiment === 'celebrate' && lab) return reactLaunchParty(lab, story);
        if (sentiment === 'emergency' && lab) return reactEmergencyHuddle(lab, story);
        if (sentiment === 'crisis' && lab)    return reactCrisisFlicker(lab, story);
        if (sentiment === 'regulatory')       return reactCourtConvene(lab, story);
        return false;
    }

    // ─── MAIN UPDATE TICK ────────────────────────────────────────────────────
    function update() {
        if (typeof G === 'undefined' || !G.app) return;

        // Always draw active visual effects, even during cooldown
        if (G.fxGfx) {
            // Note: SeasonalEnv.update() also draws to fxGfx — both are
            // additive, no clear-conflict, both run within engine's draw pass.
            _drawFlickers();
            _drawFireworks();
        }

        if (STATE.disabled) return;
        if (G.tick % STATE.scanTickStride !== 0) return;

        // Boot grace — let HNBlimps load its first batch before we start
        // marking stories as seen, otherwise we'd silently swallow them.
        if (STATE.bootedAt < 0) STATE.bootedAt = G.tick;
        if (G.tick - STATE.bootedAt < STATE.bootGraceTicks) {
            // During grace period, pre-seed seenIds with the current HN batch
            // so we only react to STORIES THAT APPEAR AFTER BOOT, not the
            // already-old top-5 we found on first load.
            const stories = readHnStories();
            for (const s of stories) STATE.seenIds.add(s.id);
            return;
        }

        // Periodically refresh cloud events from Supabase
        maybeRefreshCloud();

        // Cooldown gate
        if (G.tick - STATE.lastReactionTick < STATE.cooldownTicks) return;

        // ─── PRIMARY SOURCE: cloud events (pre-classified by collect-events.mjs) ───
        // These already have archetype + emoji + lab so we just fire directly.
        // Iterate newest-first; bail after firing one. skipPersistOnly is set
        // so the local localStorage doesn't double-store events that already
        // live in the server-side sc_events table.
        const cloudEvents = readCloudEvents();
        for (const ev of cloudEvents) {
            if (!ev || !ev.id) continue;
            if (STATE.seenIds.has(ev.id)) continue;
            STATE.seenIds.add(ev.id);
            saveSeen();
            if (!ev.event_type || !ARCHETYPE_TO_REACT[ev.event_type]) continue;
            STATE.skipPersistOnly = true;
            let fired = false;
            try {
                fired = fire({
                    type: ev.event_type, archetype: ev.archetype, emoji: ev.emoji,
                    lab: ev.lab, title: ev.title, url: ev.url, ts: ev.ts
                });
            } finally {
                STATE.skipPersistOnly = false;
            }
            if (fired) return;
        }

        // ─── FALLBACK SOURCE: live HN poll (used until cloud is populated) ───
        const stories = readHnStories();
        for (const s of stories) {
            if (!s || s.id == null) continue;
            const sid = 'hn:' + s.id;
            if (STATE.seenIds.has(sid)) continue;
            STATE.seenIds.add(sid);
            saveSeen();

            const c = classifyStory(s);
            if (!c.sentiment) continue;
            const fired = dispatch(s, c);
            if (fired) return;
        }
    }

    // Lookup table so the cloud-events path knows which event_type values
    // map to firable reactions (skip non-reactive types like 'launch'/'paper').
    const ARCHETYPE_TO_REACT = {
        celebrate: true, crisis: true, emergency: true, regulatory: true
    };

    function readHnStories() {
        // Source of truth: HNBlimps already polls every 15min and caches the
        // result. Reading their array means we share the polling cost.
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories)) {
            return HNBlimps._stories;
        }
        return [];
    }

    // Read pre-classified events from the server-accumulated sc_events table
    // (via API.cloudEvents). These come pre-tagged with archetype + emoji +
    // lab, so we don't re-run the classifier — just fire the reaction.
    function readCloudEvents() {
        if (typeof API === 'undefined' || !Array.isArray(API.cloudEvents)) return [];
        return API.cloudEvents;
    }

    // Refetch cloud events from Supabase ~every 10 min so the news engine
    // picks up events the hourly collector wrote while we were idle.
    let _cloudRefetchAt = 0;
    function maybeRefreshCloud() {
        const now = Date.now();
        if (now - _cloudRefetchAt < 10 * 60 * 1000) return;
        _cloudRefetchAt = now;
        if (typeof API !== 'undefined' && typeof API.fetchCloudEvents === 'function') {
            API.fetchCloudEvents().catch(() => {});
        }
    }

    // ─── PUBLIC TEST HOOK (console-fired for QA) ─────────────────────────────
    function _test(kind, labId) {
        const fakeStory = {
            id: 'test-' + Date.now(),
            title: ({
                celebrate:  `${labName(labId) || 'OpenAI'} unveils breakthrough AI model`,
                crisis:     `${labName(labId) || 'OpenAI'} faces controversy over training data`,
                emergency:  `${labName(labId) || 'OpenAI'} board fires CEO in late-night meeting`,
                regulatory: `EU regulators open hearing on ${labName(labId) || 'OpenAI'}`
            })[kind] || `${labName(labId) || 'OpenAI'} in the news`,
            url: 'https://news.ycombinator.com'
        };
        const map = {
            celebrate:  () => reactLaunchParty(labId || 'openai', fakeStory),
            crisis:     () => reactCrisisFlicker(labId || 'openai', fakeStory),
            emergency:  () => reactEmergencyHuddle(labId || 'openai', fakeStory),
            regulatory: () => reactCourtConvene(labId, fakeStory)
        };
        const fn = map[kind];
        if (!fn) { console.warn('Unknown kind:', kind, '— use celebrate|crisis|emergency|regulatory'); return false; }
        STATE.lastReactionTick = -100000; // bypass cooldown for tests
        return fn();
    }

    // ─── INIT ────────────────────────────────────────────────────────────────
    function init() {
        loadSeen();
        STATE.disabled = isDisabled();
        if (STATE.disabled) console.info('[NewsReactivity] disabled (localStorage flag).');
    }

    // ─── PUBLIC: re-fire a persisted event (used by Daily Briefing replay) ───
    // Bypasses cooldown + dedupe — caller (Daily Briefing) is sequencing its
    // own playback. The visual reaction still records to STATE.recent so the
    // briefing reel can drive `_drawFlickers` / `_drawFireworks` normally.
    function fire(event) {
        if (!event || !event.type) return false;
        const synthStory = {
            id: 'replay-' + (event.ts || Date.now()),
            title: event.title || 'AI news',
            url: event.url || 'https://news.ycombinator.com'
        };
        STATE.lastReactionTick = -100000; // bypass cooldown for the replay
        const labId = event.lab;
        switch (event.type) {
            case 'celebrate':  return reactLaunchParty(labId, synthStory);
            case 'crisis':     return reactCrisisFlicker(labId, synthStory);
            case 'emergency':  return reactEmergencyHuddle(labId, synthStory);
            case 'regulatory': return reactCourtConvene(labId, synthStory);
            default:           return false;
        }
    }

    function setReplayMode(on) { STATE.replayMode = !!on; }

    return { init, update, _test, fire, setReplayMode, _state: STATE };
})();

// Auto-init on DOM ready (idempotent — safe even if engine.js calls init too)
(function() {
    function tryInit() {
        if (typeof NewsReactivity !== 'undefined') NewsReactivity.init();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryInit);
    } else {
        tryInit();
    }
})();
