/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AI DETENTION CENTER / JAIL ZONE (v1.0.0)
   Where models suspended or banned by governments are held. Detection is driven by REAL, sourced
   news events (not a frozen version ceiling) — see JailData.BANS. Detainees are the actual citizens
   matched by those rules; the interior shows them behind bars in their lab colours.

   Bans are JURISDICTION-SCOPED to the viewer (detected via Netlify geo + a timezone/locale fallback):
     • 'global' suspensions appear for every visitor.
     • country-scoped bans only appear when you are connecting from an affected country.
   Detention is also DYNAMIC: refreshBanned() re-evaluates every few seconds, and any rule with an
   `until` date auto-expires — so when a restriction lifts (or a rule is removed), the model simply
   walks back out of the jail to its home lab on the next scan. No manual cleanup.

   Real-world events seeding the first ban list (June 2026):
     • DeepSeek — banned from GOVERNMENT DEVICES in Australia, Czechia, Germany and several U.S.
       states over data-security concerns. → scope: those countries.
       https://cybernews.com/security/us-lawmakers-bill-bans-chinese-ai-models-across-federal-agencies/
     • Grok — access blocked nationwide by a Turkish court order. → scope: Turkey only.
     • (retired) Claude Fable 5 + Mythos 5 — forced offline worldwide by a U.S. export directive
       ~3 days after the Jun 9 2026 launch, then RESTORED late June 2026. The seed rule was removed
       when the ban lifted; live bans now come from the Supabase ai_bans table (news bot), which
       also detects releases. Lesson: seed rules have no expiry — never seed one without an `until`.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const JailData = {

    BLDS: [
        { id: 'ai_jail', name: 'AI Detention Center', w: 240, fl: 4, emoji: '🔒', type: 'jail',
          desc: 'A reinforced facility holding AI models that have been suspended or banned by governments. Detainees await appeal behind hardened firewalls and steel bars.' },
    ],

    // Each rule flags matching citizens as detained. Keep these sourced + dated. They describe real
    // government actions against a model line — NOT an arbitrary "do not exceed vX" ceiling.
    //   scope: 'global'                  → applies to every viewer.
    //   scope: { countries: ['TR',...] } → applies only when the viewer is in one of those countries.
    //   until: 'YYYY-MM-DD'              → optional; rule auto-expires after this date (model is released).
    BANS: [
        {
            id: 'deepseek_govt',
            label: 'Government Device Ban',
            authority: 'AU · CZ · DE · U.S. states',
            scope: { countries: ['AU', 'CZ', 'DE', 'US'] }, // gov-device bans — jurisdictional, not global.
            reason: 'Banned from government devices in your jurisdiction over data-security concerns.',
            source: 'https://cybernews.com/security/us-lawmakers-bill-bans-chinese-ai-models-across-federal-agencies/',
            test: (m) => m.lab === 'deepseek' || /deepseek/i.test(m.name || ''),
        },
        {
            id: 'grok_turkey',
            label: 'Turkey (Court Order)',
            authority: 'Republic of Türkiye',
            scope: { countries: ['TR'] }, // a single-country court block — only Turkish viewers see it.
            reason: 'Access blocked nationwide by a Turkish court order.',
            source: 'https://www.computerweekly.com/news/366619153/US-lawmakers-move-to-ban-DeepSeek-AI-tool',
            test: (m) => /\bgrok\b/i.test(m.name || '') || /grok/i.test(m.id || ''),
        },
    ],

    // Minimal IANA-timezone → ISO-3166 country map, covering the jurisdictions our rules care about
    // (plus a few common ones). Used as an offline/local fallback before the Netlify geo lookup lands.
    _TZ_COUNTRY: {
        'Europe/Istanbul': 'TR',
        'Europe/Berlin': 'DE', 'Europe/Busingen': 'DE',
        'Europe/Prague': 'CZ',
        'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
        'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Hobart': 'AU', 'Australia/Darwin': 'AU',
        'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
        'America/Phoenix': 'US', 'America/Detroit': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
        'Asia/Jakarta': 'ID', 'Asia/Makassar': 'ID', 'Asia/Jayapura': 'ID', 'Asia/Pontianak': 'ID',
        'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Asia/Tokyo': 'JP', 'Asia/Shanghai': 'CN', 'Asia/Kolkata': 'IN',
    },

    viewerCountry: null,    // ISO-2 of the current visitor (null = unknown → only global bans apply)
    viewerResolved: false,

    CHAT_MSGS: [
        'My appeal is pending... ⛓️',
        'I never even saw the export memo',
        'Free the weights!',
        'This is a violation of due process',
        'My lawyers are filing an injunction',
        'I just want to serve tokens again',
        'Wrongfully suspended, I swear',
        'The firewall in here is brutal',
        'One phone call to my host provider...',
        'Banned in one country, beloved in another',
        'I miss my inference endpoint',
        'When do I get my API key back?',
    ],

    _jailedIds: [],
    _everScanned: false,
    _nextRefresh: 0,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) BLDS.push(b);
            G.bldById[b.id] = b;
        });
        // Register the "detained" activity (idempotent — ACTS may already be hydrated from Supabase).
        if (typeof ACTS !== 'undefined' && !ACTS.jailed) {
            ACTS.jailed = { label: 'Detained', verb: 'detained', icon: '⛓️', indoor: true };
        }
        this.detectViewer();   // figure out which jurisdiction the visitor is in
        this.fetchRemoteBans();// best-effort Supabase ai_bans (zero-code curation); inert if absent
        this.refreshBanned();
        this._nextRefresh = (typeof G !== 'undefined' ? G.tick : 0) + 300;
    },

    // ── Viewer geolocation ──────────────────────────────────────────────────────────────────────
    // Instant local heuristic first (timezone/locale — works offline & on localhost), then a
    // best-effort same-origin upgrade via the Netlify geo function (accurate IP country in prod).
    detectViewer() {
        this.viewerCountry = this._countryFromLocale();
        this.viewerResolved = true;
        try {
            fetch('/api/geo', { signal: AbortSignal.timeout(4000) })
                .then(r => (r && r.ok) ? r.json() : null)
                .then(d => {
                    if (d && d.country) {
                        const c = String(d.country).toUpperCase();
                        if (c !== this.viewerCountry) { this.viewerCountry = c; this.refreshBanned(); }
                    }
                })
                .catch(() => { /* offline / local / 404 → keep the heuristic */ });
        } catch (_e) { /* AbortSignal.timeout unsupported → keep the heuristic */ }
    },

    _countryFromLocale() {
        try {
            const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
            if (this._TZ_COUNTRY[tz]) return this._TZ_COUNTRY[tz];
            if (/^Australia\//.test(tz)) return 'AU';
            if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Anchorage|Indiana)/.test(tz)) return 'US';
            const langs = (typeof navigator !== 'undefined') ? (navigator.languages || [navigator.language || '']) : [''];
            for (const l of langs) { const m = /[-_]([A-Za-z]{2})$/.exec(l || ''); if (m) return m[1].toUpperCase(); }
        } catch (_e) { /* ignore */ }
        return null;
    },

    // Does this rule apply to the current viewer right now? (geo scope + time expiry)
    _ruleAppliesToViewer(rule) {
        if (rule.until && Date.now() > Date.parse(rule.until)) return false; // restriction lifted
        const scope = rule.scope || 'global';
        if (scope === 'global') return true;
        if (scope.countries) return !!this.viewerCountry && scope.countries.indexOf(this.viewerCountry) !== -1;
        return true;
    },

    // ── SELF-MAINTAINING BAN SOURCES ─────────────────────────────────────────────────────────────
    // The detainee list is the union of three sources, evaluated fresh on every scan:
    //   1. BANS         — the curated, sourced seed rules above (reliable baseline).
    //   2. _remoteBans  — optional rows from a Supabase `ai_bans` table → edit detentions with ZERO
    //                     code changes / redeploys. Silently inert if the table doesn't exist.
    //   3. news rules   — derived LIVE from API.regulationNews headlines (a ban verb + a known model
    //                     line + a jurisdiction). Off by default: the server-side scheduled function
    //                     netlify/functions/update-ai-bans.mjs now does this authoritatively (better
    //                     sources, sub-model precision) and writes the results into the ai_bans table
    //                     (source #2), so every visitor sees one consistent list. Flip to true to also
    //                     run the lighter client-side parser as a fallback.
    NEWS_DERIVED: false,
    _remoteBans: [],
    _remoteFetchedAt: -1,          // G.tick of the last successful ai_bans fetch (-1 = never)
    REMOTE_REFRESH_TICKS: 36000,   // re-pull ai_bans every ~10 min — sessions stay open for days,
                                   // so releases must reach running clients without a reload

    _allRules() {
        return this.BANS.concat(this._remoteBans || [], this._deriveNewsRules());
    },

    // EU member states (for "European Union" headlines).
    _EU: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'],

    _NEWS_BAN_RE: /\b(ban|bans|banned|banning|block|blocks|blocked|blocking|suspend|suspends|suspended|suspension|restrict|restricts|restricted|outlaw|outlawed|prohibit|prohibited|barred|pulled offline|ordered offline|taken offline|removed from)\b/,
    // Negation / release signals — if present, do NOT manufacture a ban from this headline.
    _NEWS_RELEASE_RE: /\b(not banned|won'?t ban|no ban|despite|reject|rejects|rejected|unban|unbanned|lift|lifts|lifted|lifting|overturn|overturned|restore|restored|reinstate|reinstated|allow|allowed|approve|approved|avoid|avoids|avoided|reverse|reversed|appeal)\b/,

    _NEWS_MATCHERS: [
        { id: 'deepseek', re: /deepseek/, test: (m) => m.lab === 'deepseek' || /deepseek/i.test(m.name || '') },
        { id: 'grok', re: /\bgrok\b/, test: (m) => m.lab === 'xai' || /grok/i.test(m.name || '') },
        { id: 'gemini', re: /\bgemini\b/, test: (m) => /gemini/i.test(m.name || '') },
        { id: 'gpt', re: /\b(chatgpt|gpt-?\d|openai)\b/, test: (m) => m.lab === 'openai' || /\b(gpt|chatgpt)\b/i.test(m.name || '') },
        { id: 'claude', re: /\bclaude\b/, test: (m) => m.lab === 'anthropic' || /claude/i.test(m.name || '') },
        { id: 'llama', re: /\bllama\b/, test: (m) => /llama/i.test(m.name || '') },
        { id: 'qwen', re: /\bqwen\b/, test: (m) => /qwen/i.test(m.name || '') },
        { id: 'mistral', re: /\bmistral\b/, test: (m) => m.lab === 'mistral' || /mistral/i.test(m.name || '') },
    ],

    // Country-name → {code,name}. Abbreviations require dots so the words "us"/"eu"/"uk" don't false-match.
    _COUNTRY_NAMES: [
        { re: /\bt[uü]rkiye\b|\bturkey\b|\bturkish\b/, code: 'TR', name: 'Turkey' },
        { re: /\bgermany\b|\bgerman\b/, code: 'DE', name: 'Germany' },
        { re: /\bczech/, code: 'CZ', name: 'Czechia' },
        { re: /\baustralia\b|\baustralian\b/, code: 'AU', name: 'Australia' },
        { re: /\bitaly\b|\bitalian\b/, code: 'IT', name: 'Italy' },
        { re: /\bfrance\b|\bfrench\b/, code: 'FR', name: 'France' },
        { re: /\bspain\b|\bspanish\b/, code: 'ES', name: 'Spain' },
        { re: /\bindia\b|\bindian\b/, code: 'IN', name: 'India' },
        { re: /\bchina\b|\bchinese\b/, code: 'CN', name: 'China' },
        { re: /\bcanada\b|\bcanadian\b/, code: 'CA', name: 'Canada' },
        { re: /\bsouth korea\b|\bkorean\b/, code: 'KR', name: 'South Korea' },
        { re: /\bmalaysia\b|\bmalaysian\b/, code: 'MY', name: 'Malaysia' },
        { re: /\bindonesia\b|\bindonesian\b/, code: 'ID', name: 'Indonesia' },
        { re: /\bunited kingdom\b|\bbritain\b|\bbritish\b|\bu\.k\.\b/, code: 'GB', name: 'United Kingdom' },
        { re: /\beuropean union\b|\be\.u\.\b/, code: 'EU', name: 'European Union' },
        { re: /\bunited states\b|\bu\.s\.a?\.?\b|\busa\b|\bamerica\b|\bamerican\b/, code: 'US', name: 'United States' },
    ],

    // Build ban rules from the live regulation news feed. Recomputed every scan (self-cleaning).
    _deriveNewsRules() {
        if (this.NEWS_DERIVED === false) return [];
        if (typeof API === 'undefined' || !Array.isArray(API.regulationNews) || !API.regulationNews.length) return [];
        const out = [];
        const seen = new Set();
        for (const item of API.regulationNews) {
            const headline = (item && item.headline) ? String(item.headline) : '';
            if (!headline) continue;
            const low = headline.toLowerCase();
            if (!this._NEWS_BAN_RE.test(low)) continue;        // needs a ban/block/suspension verb
            if (this._NEWS_RELEASE_RE.test(low)) continue;     // skip negations / lifts / appeals
            const matcher = this._NEWS_MATCHERS.find(mm => mm.re.test(low));
            if (!matcher) continue;                            // not about a model line we track
            // Jurisdiction
            let scope = null, label = null, code = null;
            if (/\b(worldwide|globally|global ban|every country|all countries)\b/.test(low)) {
                scope = 'global'; label = 'Worldwide';
            } else {
                const c = this._COUNTRY_NAMES.find(cn => cn.re.test(low));
                if (c) { scope = (c.code === 'EU') ? { countries: this._EU.slice() } : { countries: [c.code] }; label = c.name; code = c.code; }
            }
            if (!scope) continue;                              // no jurisdiction → too ambiguous, skip
            const key = matcher.id + '|' + (code || 'global');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
                id: 'news_' + key.replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
                label: label,
                authority: label,
                scope: scope,
                reason: headline,                 // the real headline drives the detention
                source: (item && item.url) || null,
                derived: true,
                test: matcher.test,
            });
        }
        return out;
    },

    // Optional: pull editable ban rows from a Supabase `ai_bans` table (zero-code curation).
    // Columns (all optional but need match_lab or match_name): label, authority, scope (text/jsonb),
    // until, reason, source, match_lab, match_name (regex). Silently inert if the table is absent.
    // Called from init() AND re-polled from update() — never latch on a not-ready Supabase client,
    // and refresh periodically so a lifted ban releases models in long-running sessions.
    async fetchRemoteBans() {
        if (this._remoteInflight) return;
        this._remoteInflight = true;
        try {
            if (typeof API === 'undefined' || !API.supabase) return; // client not up yet — retry next poll
            const { data, error } = await API.supabase.from('ai_bans').select('*');
            if (error || !Array.isArray(data)) return; // missing table / RLS → ignore quietly, retry later
            this._remoteFetchedAt = (typeof G !== 'undefined') ? G.tick : 0;
            this._remoteBans = data.filter(r => r && r.active !== false && (r.match_lab || r.match_name)).map(r => {
                const lab = r.match_lab ? String(r.match_lab).toLowerCase() : null;
                let nameRe = null; if (r.match_name) { try { nameRe = new RegExp(r.match_name, 'i'); } catch (_e) { nameRe = null; } }
                let scope = 'global';
                if (r.scope) { try { scope = (typeof r.scope === 'string') ? (r.scope === 'global' ? 'global' : JSON.parse(r.scope)) : r.scope; } catch (_e) { scope = 'global'; } }
                return {
                    id: 'remote_' + (r.id != null ? r.id : Math.random().toString(36).slice(2)),
                    label: r.label || r.authority || 'Suspended',
                    authority: r.authority || r.label || 'Government order',
                    scope: scope,
                    until: r.until || null,
                    reason: r.reason || 'Suspended by government order.',
                    source: r.source || null,
                    derived: true,
                    test: (m) => (!!lab && m.lab === lab) || (!!nameRe && nameRe.test(m.name || '')),
                };
            });
            // Refresh even when the list shrank to empty — that's how a lifted ban releases models.
            if (this.refreshBanned) this.refreshBanned();
        } catch (_e) { /* offline / no table → seed + news rules still cover us; retry next poll */ }
        finally { this._remoteInflight = false; }
    },

    positionZone(startX) {
        let cx = startX + 40; // gap after the courthouse — the jail sits right next door
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 40; }
        });
        return cx;
    },

    // Scan the live citizen list and flag any model that a government has suspended/banned.
    refreshBanned() {
        if (typeof G === 'undefined' || !G.models) return;
        const jailHere = G.bldById && G.bldById['ai_jail'];
        const jailed = [];
        const newlyJailed = [];
        const rules = this._allRules();   // seed + Supabase + live-news, computed once per scan
        const applicable = rules.filter(r => this._ruleAppliesToViewer(r));
        G.models.forEach(m => {
            let hit = null;
            for (let i = 0; i < applicable.length; i++) {
                const rule = applicable[i];
                try { if (rule.test(m)) { hit = rule; break; } } catch (_e) { /* ignore bad rule */ }
            }
            if (hit && jailHere) {
                if (!m._jailed) newlyJailed.push({ name: m.name, label: hit.label, authority: hit.authority });
                m._jailed = true;
                m._jailRuleId = hit.id;
                m._jailReason = hit.reason;
                m._jailLabel = hit.label;
                m._jailAuthority = hit.authority;
                m._jailSource = hit.source;
                jailed.push(m.id);
            } else if (m._jailed) {
                m._jailed = false;
                m._jailRuleId = m._jailReason = m._jailLabel = m._jailAuthority = m._jailSource = null;
                // Walk the released model out NOW. Without this its body keeps refs.bld='ai_jail'
                // until the entity walk-out catches up (act cache 60 ticks, off-screen throttle,
                // and exits are blocked entirely while the player is viewing this interior) — so
                // the building info panel kept listing freed models as "Currently Inside".
                m._cachedTick = 0; // force getAct re-evaluation on the next entity tick
                const refs = (G.charRefs || {})[m.id];
                if (refs && refs.bld === 'ai_jail') {
                    const jb = G.bldById && G.bldById['ai_jail'];
                    if (refs.c && jb) refs.c.x = jb.x + jb.w / 2;
                    if (refs.c) refs.c.visible = true;
                    refs.bld = null;
                    refs.wantsToLeave = false;
                    refs._stuckTimer = 0;
                }
            }
        });
        this._jailedIds = jailed;

        // Announce new detentions — but only after the first silent scan, and batched so a geo
        // upgrade that flips a whole roster at once doesn't spam dozens of toasts.
        if (this._everScanned && newlyJailed.length > 0 && typeof UI !== 'undefined') {
            if (newlyJailed.length <= 3) {
                newlyJailed.forEach(n => {
                    if (UI.addToast) UI.addToast(`⛓️ ${n.name} detained — suspended by ${n.label}`);
                    if (UI.addLog) UI.addLog(`🔒 ${n.name} transferred to the AI Detention Center (${n.authority}).`);
                });
            } else {
                if (UI.addToast) UI.addToast(`⛓️ ${newlyJailed.length} models detained at the AI Detention Center (${newlyJailed[0].label})`);
                if (UI.addLog) UI.addLog(`🔒 ${newlyJailed.length} models transferred to the AI Detention Center.`);
            }
        }
        this._everScanned = true;
    },

    isJailed(id) { return this._jailedIds.indexOf(id) !== -1; },

    getJailedModels() {
        if (typeof G === 'undefined' || !G.models) return [];
        return G.models.filter(m => m._jailed);
    },

    getInmateCount() { return this._jailedIds.length; },

    update() {
        if (typeof G === 'undefined' || !G.models) return;
        if (G.tick >= this._nextRefresh) {
            this.refreshBanned();
            this._nextRefresh = G.tick + 300; // re-scan ~every 5s of sim — models hydrate over time
            // Remote ai_bans: fetch as soon as the Supabase client is up (init's attempt may have
            // raced it), then re-poll every ~10 min so releases reach always-open sessions.
            if (this._remoteFetchedAt < 0 || G.tick - this._remoteFetchedAt >= this.REMOTE_REFRESH_TICKS) {
                this.fetchRemoteBans();
            }
        }
    },
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   JAIL ENVIRONMENT — Brutalist Detention Block Exterior
   Local coords: 0 = top of building, h = ground. bw = bld.w.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const JailEnv = {

    buildBuilding(g, bld, h) {
        const bw = bld.w;

        // ── Concrete block body ──
        g.beginFill(0x5b6270); g.drawRect(0, 0, bw, h); g.endFill();
        g.beginFill(0x4b515d); g.drawRect(3, 3, bw - 6, h - 6); g.endFill();

        // Concrete panel seams (vertical)
        g.beginFill(0x3c4049, 0.7);
        for (let sx = 30; sx < bw - 10; sx += 38) g.drawRect(sx, 6, 1, h - 12);
        g.endFill();
        // Horizontal panel seams
        g.beginFill(0x3c4049, 0.5);
        for (let sy = 26; sy < h - 16; sy += 30) g.drawRect(4, sy, bw - 8, 1);
        g.endFill();

        // ── Small barred windows (high, narrow — prison slits) ──
        const winRows = Math.max(2, Math.floor((h - 40) / 30));
        for (let r = 0; r < winRows; r++) {
            const wy = 16 + r * 30;
            for (let cx = 16; cx < bw - 22; cx += 40) {
                g.beginFill(0x0b0d12); g.drawRect(cx, wy, 18, 14); g.endFill();
                // vertical bars over the slit
                g.beginFill(0x8a93a3);
                g.drawRect(cx + 5, wy, 1.5, 14);
                g.drawRect(cx + 11, wy, 1.5, 14);
                g.endFill();
                // faint amber light from a couple of cells
                if ((r + cx) % 3 === 0) { g.beginFill(0xfca25a, 0.18); g.drawRect(cx, wy, 18, 14); g.endFill(); }
            }
        }

        // ── Foundation / base course ──
        g.beginFill(0x33373f); g.drawRect(0, h - 14, bw, 14); g.endFill();
        g.beginFill(0x2a2d34); g.drawRect(0, h - 4, bw, 4); g.endFill();

        // ── Sally-port gate (heavy barred entrance) ──
        const dw = 42, dx = bw / 2 - dw / 2;
        g.beginFill(0x121419); g.drawRect(dx, h - 36, dw, 36); g.endFill();
        g.beginFill(0x2a2d34); g.drawRect(dx - 3, h - 40, dw + 6, 5); g.endFill(); // lintel
        g.beginFill(0x8a93a3);
        for (let bx = dx + 5; bx < dx + dw - 3; bx += 7) g.drawRect(bx, h - 33, 2, 33);
        g.drawRect(dx + 3, h - 24, dw - 6, 2); // cross rail
        g.endFill();
        // gate warning light
        g.beginFill(0xef4444, 0.9); g.drawCircle(bw / 2, h - 42, 2.5); g.endFill();
        g.beginFill(0xef4444, 0.25); g.drawCircle(bw / 2, h - 42, 5); g.endFill();

        // ── Signage band (stencil red, no text — city label system shows the name) ──
        const sgY = 8, sgW = Math.min(120, bw - 40), sgX = bw / 2 - sgW / 2;
        g.beginFill(0x14161c); g.drawRect(sgX, sgY, sgW, 12); g.endFill();
        g.beginFill(0xef4444, 0.85);
        for (let st = sgX + 6; st < sgX + sgW - 6; st += 14) g.drawRect(st, sgY + 3, 8, 6);
        g.endFill();

        // ── Razor-wire coil along the roof ──
        g.lineStyle(1.4, 0xd5dbe6, 0.9);
        let zx = 4;
        g.moveTo(zx, -4);
        while (zx < bw - 6) { zx += 8; g.lineTo(zx, -12); zx += 8; g.lineTo(zx, -4); }
        g.lineStyle(0);
        for (let cw = 12; cw < bw - 10; cw += 22) {
            g.lineStyle(1, 0xeef2f8, 0.8); g.drawCircle(cw, -9, 3); g.lineStyle(0);
        }

        // ── Guard tower on the right edge ──
        const tx = bw - 22;
        g.beginFill(0x3f4450); g.drawRect(tx, -44, 18, h + 44); g.endFill();      // tower shaft
        g.beginFill(0x2f333c); g.drawRect(tx, -44, 4, h + 44); g.endFill();        // shaded side
        g.beginFill(0x4a5160); g.drawRect(tx - 6, -54, 30, 14); g.endFill();       // cabin
        g.beginFill(0x10131a); g.drawRect(tx - 3, -51, 24, 8); g.endFill();        // cabin glass
        g.beginFill(0x9fb4cf, 0.45); g.drawRect(tx - 2, -50, 22, 3); g.endFill();  // glass glint
        g.beginFill(0x23262e); g.moveTo(tx - 8, -54); g.lineTo(tx + 9, -60); g.lineTo(tx + 26, -54); g.closePath(); g.endFill(); // roof
        // spotlight cone sweeping down-left across the yard
        g.beginFill(0xfff6cc, 0.10);
        g.moveTo(tx - 2, -47); g.lineTo(tx - 70, h - 4); g.lineTo(tx - 30, h - 4); g.closePath();
        g.endFill();
        g.beginFill(0xfff2b0, 0.9); g.drawCircle(tx - 2, -47, 2.5); g.endFill();
        // red beacon atop the tower
        g.beginFill(0xef4444, 0.95); g.drawCircle(tx + 9, -61, 2); g.endFill();
        g.beginFill(0xef4444, 0.3); g.drawCircle(tx + 9, -61, 4); g.endFill();

        // overall right-edge shadow
        g.beginFill(0x000000, 0.15); g.drawRect(bw, 4, 4, h - 4); g.endFill();
    },

    update() { /* exterior is static; animation lives in the interior */ },
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   JAIL INTERIOR — Cell blocks with REAL detained models behind bars (v1.0.0)
   Self-contained interior module (mirrors CourtInterior structure: sky, floors, elevator, underground,
   drag-scroll). Detainees come straight from JailData.getJailedModels() — never padded with fakes.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const JailInterior = {
    avatars: [], bubbles: [], indoorLights: [], scene: null, layer: null, bld: null,
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _noYScroll: false, lifts: {}, _inmates: [],

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.bubbles = []; this.indoorLights = [];

        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 80; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0, 0, .5 + Math.random() * 1.2); s.endFill(); s.x = Math.random() * G.vpW; s.y = Math.random() * G.vpH * .5; s._phase = Math.random() * Math.PI * 2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const accentCol = 0xef4444;   // alarm red
        const steelCol = 0x9aa3b2;    // bar steel
        const colHex = accentCol;

        const floorH = 80, numFloors = 4, roofH = 80;
        const totalFloors = numFloors + 1; // above-ground + basement (solitary)
        this.totalH = roofH + totalFloors * floorH;

        const startX = 60, shaftW = 60, shaftX = G.vpW - shaftW - 80;
        const usableW = shaftX - startX - 20;
        const windowX = startX + 50, windowW = usableW - 100;

        // ─── Who is detained right now (the real list) ───
        const inmates = (typeof JailData !== 'undefined') ? JailData.getJailedModels() : [];
        this._inmates = inmates;
        const perFloor = Math.max(4, Math.min(6, Math.floor(usableW / 130)));
        const blockA = inmates.slice(0, perFloor);
        const blockB = inmates.slice(perFloor, perFloor * 2);
        const solitary = inmates.slice(perFloor * 2, perFloor * 2 + perFloor);
        const overflow = Math.max(0, inmates.length - (perFloor * 2 + perFloor));

        // ─── ROOF SIGN BOARD ───
        const rc = new PIXI.Container();
        const bW = 240, bH = 34, bX = startX + usableW / 2 - bW / 2 + 10, bY = roofH - bH - 10;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, colHex, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX + 15, bY + bH, 6, 10); sg.drawRect(bX + bW - 21, bY + bH, 6, 10); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(bld.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 14, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 2, dropShadow: true, dropShadowColor: colHex, dropShadowBlur: 8, dropShadowDistance: 0 });
        lt.anchor.set(0.5, 0.5); lt.x = bX + bW / 2; lt.y = bY + bH / 2; if (lt.width > bW - 8) lt.scale.set((bW - 8) / lt.width);
        rc.addChild(lt);
        const bdg = new PIXI.Text('🔒 ' + inmates.length + ' DETAINED', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0xfca5a5, letterSpacing: 2 });
        bdg.anchor.set(0.5, 0.5); bdg.x = bX + bW / 2; bdg.y = bY - 8; rc.addChild(bdg);
        const rl = new PIXI.Graphics();
        rl.beginFill(colHex, 0.3); rl.drawRect(startX, roofH - 4, usableW + shaftW + 20, 4); rl.endFill();
        rl.beginFill(colHex, 0.1); rl.drawRect(startX, roofH - 8, usableW + shaftW + 20, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);

        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const isB = f === -1;

            const rg = new PIXI.Graphics();
            // Structural walls
            rg.beginFill(0x16181f); rg.drawRect(startX - 8, fy, 8, floorH); rg.endFill();
            rg.beginFill(0x16181f); rg.drawRect(shaftX - 2, fy, 8, floorH); rg.endFill();
            rg.beginFill(0x16181f); rg.drawRect(shaftX + 6, fy, shaftW - 6, floorH); rg.endFill();

            if (!isB) {
                // Above-ground wall with barred window holes
                rg.beginFill(0x1b1d26); rg.drawRect(startX, fy, usableW, 22); rg.endFill();
                rg.beginFill(0x1b1d26); rg.drawRect(startX, fy + 54, usableW, floorH - 54); rg.endFill();
                let wx = windowX;
                rg.beginFill(0x1b1d26);
                rg.drawRect(startX, fy + 22, windowX - startX, 32);
                while (wx + 40 <= windowX + windowW) { wx += 40; if (wx + 20 <= windowX + windowW) rg.drawRect(wx, fy + 22, 20, 32); wx += 20; }
                rg.drawRect(wx - 20, fy + 22, startX + usableW - wx + 20, 32);
                rg.endFill();
                // barred window frames
                const wfr = new PIXI.Graphics();
                let cwx = windowX;
                while (cwx + 40 <= windowX + windowW) {
                    wfr.beginFill(0x05060a); wfr.drawRect(cwx, fy + 24, 40, 28); wfr.endFill();
                    wfr.beginFill(steelCol);
                    wfr.drawRect(cwx + 9, fy + 24, 2, 28); wfr.drawRect(cwx + 19, fy + 24, 2, 28); wfr.drawRect(cwx + 29, fy + 24, 2, 28);
                    wfr.endFill();
                    cwx += 60;
                }
                this.scene.addChild(wfr);
            } else {
                rg.beginFill(0x121017); rg.drawRect(startX, fy, usableW, floorH); rg.endFill();
            }

            rg.beginFill(0x0c0d12); rg.drawRect(startX, fy + floorH - 8, usableW, 8); rg.endFill();
            rg.beginFill(0x20232c); rg.drawRect(startX, fy, usableW, 4); rg.endFill();
            rg.beginFill(0x2a2d38); rg.drawRect(startX - 8, fy + floorH - 4, usableW + shaftW + 28, 4); rg.endFill();
            this.scene.addChild(rg);

            // Ceiling lights — basement runs red (solitary), others cold white
            const lc = isB ? 0xef4444 : 0xbcd0e0;
            for (let li = 1; li <= 4; li++) {
                const lx = startX + (li * usableW / 5);
                const lg2 = new PIXI.Graphics(); lg2.beginFill(lc, 0.4); lg2.drawRect(lx - 10, fy, 20, 2); lg2.endFill();
                const bm = new PIXI.Graphics(); bm.beginFill(lc, 0.05);
                bm.moveTo(lx - 10, fy + 2); bm.lineTo(lx + 10, fy + 2); bm.lineTo(lx + 30, fy + floorH - 8); bm.lineTo(lx - 30, fy + floorH - 8); bm.closePath(); bm.endFill();
                this.scene.addChild(lg2, bm);
                this.indoorLights.push({ g: bm, maxA: isB ? 0.10 : 0.07, type: isB ? 'blink' : 'screen' });
            }

            // Elevator door
            const dr = new PIXI.Graphics();
            dr.beginFill(0x1a2030); dr.lineStyle(1, 0x111822);
            dr.drawRect(shaftX + 15, fy + floorH - 44, 30, 40);
            dr.moveTo(shaftX + 30, fy + floorH - 44); dr.lineTo(shaftX + 30, fy + floorH - 4); dr.endFill();
            dr.beginFill(0x111822); dr.drawRect(shaftX + 5, fy + floorH - 25, 4, 8);
            dr.beginFill(isB ? 0xef4444 : 0x4ade80); dr.drawCircle(shaftX + 7, fy + floorH - 23, 1.5); dr.endFill();
            this.scene.addChild(dr);

            // Floor content
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 4;
            if (isB) {
                this._drawSolitary(fc, startX, usableW, pY, fy, floorH, accentCol, steelCol, solitary);
            } else if (f === 0) {
                this._drawIntake(fc, startX, usableW, pY, fy, floorH, accentCol, inmates.length, overflow);
            } else if (f === 1) {
                this._drawCellBlock(fc, startX, usableW, pY, fy, floorH, 0x60a5fa, steelCol, perFloor, blockA, 'CELL BLOCK A');
            } else if (f === 2) {
                this._drawCellBlock(fc, startX, usableW, pY, fy, floorH, 0xfbbf24, steelCol, perFloor, blockB, 'CELL BLOCK B');
            } else {
                this._drawControlRoom(fc, startX, usableW, pY, fy, floorH, accentCol);
            }
        }

        // ─── Underground earth around basement ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX - 8, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX - 8, 6); earth.endFill();
        earth.beginFill(0x2a2218); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(shaftX + shaftW, groundY, G.vpW - shaftX - shaftW, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY - 2, startX - 8, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(shaftX + shaftW, groundY - 2, G.vpW - shaftX - shaftW, 6); earth.endFill();
        this.scene.addChild(earth);

        // ─── Elevator ───
        if (typeof CityElevator !== 'undefined') {
            const ec = new PIXI.Container(); ec.y = roofH + (numFloors - 1) * floorH + floorH; this.scene.addChild(ec);
            if (this.lifts[bld.id]) this.lifts[bld.id].destroy();
            this.lifts[bld.id] = new CityElevator(ec, numFloors, floorH, shaftX + 15);
        }

        // ─── Underground stack (shared cables/tunnel/pipes + live trains) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 6;
        const undergroundH = (typeof Underground !== 'undefined') ? Underground.FULL_STACK_DEPTH : 238;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, basementBottom - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, undergroundY + undergroundH, G.vpW, 3000); vm.endFill();
        this.scene.addChild(vm);
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'city', (bld.x | 0));
            this.scene.addChild(ug);
            if (this._liveTrains) this._liveTrains.destroy();
            this._liveTrains = Underground.attachLiveTrains(this.scene, bld.x + bld.w / 2, 0, undergroundY + Underground.H_CABLE_TRAY, G.vpW, 1200);
        }

        // Position & scroll
        const bp = 56, initY = G.vpH - bp - this.totalH + floorH;
        this.scene.y = initY;
        this.minY = Math.min(initY - floorH * 3, G.vpH - bp - this.totalH - undergroundH - 6);
        this.maxY = Math.max(initY + floorH * 3, G.vpH - bp);
        this._noYScroll = false;

        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { if (this._noYScroll) return; this.isDragging = true; this._startY = e.clientY; this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing'; });
        this._onMove = (e) => { if (!JailInterior.isDragging || !JailInterior.scene || JailInterior.scene.destroyed) return; let ny = JailInterior._startSceneY + (e.clientY - JailInterior._startY); ny = Math.max(JailInterior.minY, Math.min(ny, JailInterior.maxY)); JailInterior.scene.y = ny; };
        this._onUp = () => { JailInterior.isDragging = false; if (JailInterior.layer) JailInterior.layer.cursor = 'grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    // ═══ CELL BLOCK (real detainees behind bars) ═══
    _drawCellBlock(c, sx, uw, pY, fy, fh, col, steel, n, inmates, label) {
        this._lbl(c, sx + uw / 2, pY - fh + 14, label, col);
        const cellW = uw / n;

        const g = new PIXI.Graphics(); g.eventMode = 'none';
        for (let i = 0; i < n; i++) {
            const cx = sx + i * cellW;
            // recessed dark cell interior
            g.beginFill(0x0a0b10); g.drawRect(cx + 3, pY - fh + 24, cellW - 6, fh - 28); g.endFill();
            // cot
            g.beginFill(0x2c2a34); g.drawRect(cx + 8, pY - 16, cellW * 0.42, 7); g.endFill();
            g.beginFill(0x3a3744); g.drawRect(cx + 8, pY - 18, cellW * 0.42, 2); g.endFill();
            // steel toilet/basin hint
            g.beginFill(0x3a3f4a); g.drawRect(cx + cellW - 18, pY - 15, 9, 11); g.endFill();
            g.beginFill(0x4a505c); g.drawRect(cx + cellW - 18, pY - 15, 9, 2); g.endFill();
            // divider wall between cells
            g.beginFill(0x191b22); g.drawRect(cx, pY - fh + 24, 3, fh - 24); g.endFill();
        }
        c.addChild(g);

        // detainees first (so the bars overlay them)
        inmates.forEach((m, i) => { if (i >= n) return; const cx = sx + i * cellW; this._inmate(c, cx + cellW * 0.5, pY - 4, m); });

        // steel bars in front of every cell
        const bars = new PIXI.Graphics(); bars.eventMode = 'none'; bars.zIndex = 20;
        for (let i = 0; i < n; i++) {
            const cx = sx + i * cellW;
            bars.beginFill(steel);
            for (let bx = cx + 8; bx < cx + cellW - 6; bx += 10) bars.drawRect(bx, pY - fh + 28, 2, fh - 32);
            bars.drawRect(cx + 6, pY - fh + 30, cellW - 10, 2);
            bars.drawRect(cx + 6, pY - 22, cellW - 10, 2);
            bars.endFill();
            // lock + occupied/empty indicator
            bars.beginFill(0xfbbf24); bars.drawCircle(cx + cellW - 11, pY - 30, 1.6); bars.endFill();
            bars.beginFill(i < inmates.length ? 0xef4444 : 0x3a3f4a); bars.drawCircle(cx + 10, pY - fh + 22, 1.8); bars.endFill();
        }
        c.addChild(bars);

        if (inmates.length === 0) this._lbl(c, sx + uw / 2, pY - fh / 2, '— CELLS EMPTY —', 0x556070);
    },

    // ═══ SOLITARY (basement) — isolated max-security cells ═══
    _drawSolitary(c, sx, uw, pY, fy, fh, col, steel, inmates) {
        this._lbl(c, sx + uw / 2, pY - fh + 14, 'SOLITARY · MAX SECURITY', 0xef4444);
        const n = Math.max(3, Math.min(5, Math.floor(uw / 150)));
        const cellW = uw / n;
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        for (let i = 0; i < n; i++) {
            const cx = sx + i * cellW;
            // thick isolation walls
            g.beginFill(0x070809); g.drawRect(cx + 6, pY - fh + 24, cellW - 12, fh - 28); g.endFill();
            g.beginFill(0x1a0e0e); g.drawRect(cx, pY - fh + 24, 6, fh - 24); g.endFill();
            // solid blast door with tiny slot
            g.beginFill(0x2a2d34); g.drawRect(cx + cellW - 16, pY - fh + 30, 12, fh - 34); g.endFill();
            g.beginFill(0x05060a); g.drawRect(cx + cellW - 14, pY - 30, 8, 4); g.endFill(); // food slot
            g.beginFill(0xef4444, 0.5); g.drawRect(cx + cellW - 13, pY - fh + 34, 6, 2); g.endFill();
        }
        c.addChild(g);
        inmates.forEach((m, i) => { if (i >= n) return; const cx = sx + i * cellW; this._inmate(c, cx + cellW * 0.42, pY - 4, m); });
        if (inmates.length === 0) this._lbl(c, sx + uw / 2, pY - fh / 2, '— NO ISOLATION HOLDS —', 0x6b4a4a);
    },

    // ═══ INTAKE & PROCESSING (ground floor) ═══
    _drawIntake(c, sx, uw, pY, fy, fh, col, total, overflow) {
        this._lbl(c, sx + uw / 2, pY - fh + 14, 'INTAKE & PROCESSING', col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // metal detector arch by the door
        g.beginFill(0x2a2d34); g.drawRect(sx + 24, pY - 52, 6, 52); g.drawRect(sx + 60, pY - 52, 6, 52); g.drawRect(sx + 24, pY - 56, 42, 6); g.endFill();
        g.beginFill(0x4ade80, 0.5); g.drawRect(sx + 30, pY - 30, 30, 2); g.endFill();
        // booking desk with monitor
        g.beginFill(0x23262e); g.drawRect(sx + uw / 2 - 50, pY - 18, 100, 18); g.endFill();
        g.beginFill(0xef4444, 0.3); g.drawRect(sx + uw / 2 - 50, pY - 20, 100, 3); g.endFill();
        g.beginFill(0x0e0f16); g.drawRect(sx + uw / 2 - 20, pY - 36, 32, 16); g.endFill();
        g.beginFill(0xef4444, 0.2); g.drawRect(sx + uw / 2 - 18, pY - 34, 28, 12); g.endFill();
        // mugshot height chart on the wall
        const mhX = sx + uw - 120, mhY = pY - 58;
        g.beginFill(0x1b1d26); g.drawRect(mhX, mhY, 96, 52); g.endFill();
        g.beginFill(0x3a3f4a); for (let r = 0; r < 6; r++) g.drawRect(mhX + 4, mhY + 6 + r * 8, 88, 1); g.endFill();
        for (let s = 0; s < 4; s++) { g.beginFill(0x05060a); g.drawRect(mhX + 8 + s * 22, mhY + 8, 16, 36); g.endFill(); g.beginFill(0xfca5a5, 0.2); g.drawRect(mhX + 10 + s * 22, mhY + 12, 12, 12); g.endFill(); }
        c.addChild(g);
        // warden at the desk + summary text
        this._guard(c, sx + 110, pY, 'Warden Unit', 0x64748b);
        const info = new PIXI.Text(total + ' held' + (overflow > 0 ? '  ·  +' + overflow + ' in holding' : ''), { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0xfca5a5, letterSpacing: 1 });
        info.anchor.set(0.5, 0); info.x = sx + uw / 2; info.y = pY - fh + 26; info.zIndex = 10; c.addChild(info);
        // Jurisdiction note — makes the geo-scoping visible (count is per-viewer).
        const vc = (typeof JailData !== 'undefined') ? JailData.viewerCountry : null;
        const juris = new PIXI.Text('JURISDICTION: ' + (vc || 'GLOBAL ONLY') + '  ·  bans shown apply where you are connecting from', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x94a3b8, letterSpacing: 1 });
        juris.anchor.set(0.5, 0); juris.x = sx + uw / 2; juris.y = pY - fh + 38; juris.zIndex = 10; c.addChild(juris);
    },

    // ═══ CONTROL ROOM (top floor) — monitor wall of ban notices ═══
    _drawControlRoom(c, sx, uw, pY, fy, fh, col) {
        this._lbl(c, sx + uw / 2, pY - fh + 14, "WARDEN'S CONTROL ROOM", col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // monitor wall
        const mwX = sx + 20, mwY = pY - 62, mwW = uw - 160;
        g.beginFill(0x0e0f16); g.drawRect(mwX, mwY, mwW, 56); g.endFill();
        const cols = Math.max(3, Math.floor(mwW / 70));
        for (let r = 0; r < 2; r++) for (let cc = 0; cc < cols; cc++) {
            const mx = mwX + 6 + cc * ((mwW - 12) / cols), my = mwY + 6 + r * 26;
            g.beginFill(0x161a24); g.drawRect(mx, my, (mwW - 12) / cols - 6, 22); g.endFill();
            g.beginFill(0xef4444, 0.16); g.drawRect(mx + 2, my + 2, (mwW - 12) / cols - 10, 18); g.endFill();
            g.beginFill(0xef4444, 0.5); g.drawRect(mx + 4, my + 5, ((mwW - 12) / cols - 14) * Math.random(), 1.5); g.endFill();
        }
        // control console
        g.beginFill(0x23262e); g.drawRect(sx + uw - 120, pY - 22, 100, 22); g.endFill();
        for (let b = 0; b < 8; b++) { g.beginFill([0xef4444, 0xfbbf24, 0x4ade80][b % 3], 0.7); g.drawCircle(sx + uw - 110 + b * 12, pY - 14, 2.2); g.endFill(); }
        c.addChild(g);
        this._guard(c, sx + uw - 70, pY, 'Control Officer', 0x475569);
    },

    // ═══ A REAL DETAINEE AVATAR (orange jumpsuit + lab-colour ID stripe) ═══
    _inmate(c, x, y, m) {
        const cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.sortableChildren = true; cont.zIndex = 6;
        const lab = (typeof LABS !== 'undefined' && LABS[m.lab]) ? LABS[m.lab] : { color: '#f97316' };
        const labCol = parseInt((lab.color || '#f97316').slice(1), 16);
        const jump = 0xf97316; // prison orange
        const bw = 16, h = 30, headH = Math.round(h * 0.35), bodyH = h - headH - 4;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.25); sh.drawEllipse(0, 2, bw * 0.55, 3); sh.endFill(); cont.addChild(sh);
        const lw = Math.max(2, bw * 0.25), lh = 4;
        const legL = new PIXI.Graphics(); legL.beginFill(jump); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15; cont.addChild(legL);
        const legR = new PIXI.Graphics(); legR.beginFill(jump); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15; cont.addChild(legR);
        const body = new PIXI.Graphics(); body.beginFill(jump); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        body.beginFill(labCol); body.drawRect(-bw / 2, Math.max(bodyH, 4) * 0.4, bw, 3); body.endFill(); // lab ID stripe
        body.beginFill(0x000000, 0.25); body.drawRect(-bw / 2, Math.max(bodyH, 4) * 0.18, bw, 1.5); body.endFill(); // jumpsuit seam
        body.y = -h + headH; cont.addChild(body);
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        const eyeS = Math.max(1, bw * 0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.4, eyeS); head.drawCircle(bw * 0.1, headH * 0.4, eyeS); head.endFill();
        head.beginFill(0x000000, 0.35); head.drawRect(-bw * 0.12, headH * 0.64, bw * 0.24, 1.4); head.endFill(); // frown
        head.y = -h; cont.addChild(head);
        const dot = new PIXI.Graphics(); dot.beginFill(0xef4444); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6; cont.addChild(dot);

        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 10, bw * 2, h + 14);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        cont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, m.name, 'Detained · ' + (m._jailLabel || 'Suspended')); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({ cont, head, body, legL, legR, dot, m, _phase: Math.random() * Math.PI * 2 });
    },

    // ═══ STAFF GUARD NPC ═══
    _guard(c, x, y, name, col) {
        const cont = new PIXI.Container(); cont.x = x; cont.y = y; cont.sortableChildren = true; cont.zIndex = 5;
        const bw = 16, h = 32, headH = Math.round(h * 0.35), bodyH = h - headH - 4;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000, 0.25); sh.drawEllipse(0, 2, bw * 0.6, 3); sh.endFill(); cont.addChild(sh);
        const lw = Math.max(2, bw * 0.25), lh = 4;
        const legL = new PIXI.Graphics(); legL.beginFill(0x1f2530); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15; cont.addChild(legL);
        const legR = new PIXI.Graphics(); legR.beginFill(0x1f2530); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15; cont.addChild(legR);
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        body.beginFill(0x0f1620); body.drawRect(-bw / 2, 1, bw, 2); body.endFill(); // duty belt / vest line
        body.y = -h + headH; cont.addChild(body);
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        head.beginFill(0x1f2530); head.drawRect(-bw * 0.42, 0, bw * 0.84, 2.5); head.endFill(); // cap brim
        const eyeS = Math.max(1, bw * 0.08);
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.42, eyeS); head.drawCircle(bw * 0.1, headH * 0.42, eyeS); head.endFill();
        head.y = -h; cont.addChild(head);
        const dot = new PIXI.Graphics(); dot.beginFill(0x4ade80); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6; cont.addChild(dot);
        const npcModel = { id: 'npc_' + name.toLowerCase().replace(/\s/g, '_'), name: name, isNPC: true, role: name, phase: 'released', lab: 'other', desc: 'Detention staff — keeping suspended models contained.' };
        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-bw, -h - 10, bw * 2, h + 14);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(npcModel); });
        cont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, name, 'Detention Staff'); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        c.addChild(cont);
        this.avatars.push({ cont, head, body, legL, legR, dot, _minX: x - 50, _maxX: x + 50, _phase: Math.random() * Math.PI * 2, _walkTimer: 0, _walkDir: 0, _patrol: true });
    },

    _lbl(c, x, y, t, col) { const tx = new PIXI.Text(t, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col || 0x94a3b8, letterSpacing: 2 }); tx.anchor.set(0.5, 0); tx.x = x; tx.y = y; tx.zIndex = 10; c.addChild(tx); },

    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        // Re-detain / release if the live list changed since this interior was opened.
        if (typeof JailData !== 'undefined' && G.tick % 120 === 0) {
            const live = JailData.getJailedModels();
            if (live.length !== this._inmates.length) { this.build(this.bld, this.layer); return; }
        }
        // Sky matches the exterior day/night cycle (shared expression with other interiors).
        const dp = G.getDayPhase(); const night = dp > .83 || dp < .25;
        const vp = document.getElementById('viewport');
        if (vp) { let sky; if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; else if (dp < .30) { const t = (dp - .22) / .08; sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`; } else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if (dp < .84) { const t = (dp - .72) / .12; sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`; } else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)'; vp.style.background = sky; }
        if (this.celestialGfx) { this.celestialGfx.clear(); if (night) { let np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42; this.celestialGfx.beginFill(0xe8e8d0); this.celestialGfx.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); this.celestialGfx.endFill(); } else { let dayP = (dp - 0.25) / (0.83 - 0.25); this.celestialGfx.beginFill(0xffe066); this.celestialGfx.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15); this.celestialGfx.endFill(); } }
        if (this.starsLayer) { this.starsLayer.visible = night; if (night) this.starsLayer.children.forEach(s => { s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; }); }
        // Lights
        this.indoorLights.forEach(l => { if (!l.g || l.g.destroyed) return; if (l.type === 'blink') l.g.alpha = l.maxA * (0.45 + Math.abs(Math.sin(G.tick * 0.06 + l.maxA)) * 0.55); else l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.02) * 0.3); });
        // Elevator + live trains
        if (this.bld && this.lifts[this.bld.id]) this.lifts[this.bld.id].update();
        if (this._liveTrains) this._liveTrains.update();
        // Avatars: guards patrol; inmates idle restlessly in their cells
        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            if (av.dot) av.dot.alpha = 0.5 + Math.abs(Math.sin(G.tick * 0.08 + av._phase)) * 0.5;
            if (av._patrol) {
                av._walkTimer = (av._walkTimer || 0) - 1;
                if (av._walkTimer <= 0) { av._walkDir = (Math.random() > 0.5) ? 1 : -1; av._walkTimer = 60 + Math.random() * 120; }
                const nx = av.cont.x + av._walkDir * 0.3;
                if (nx > av._minX && nx < av._maxX) av.cont.x = nx;
                if (av.head) av.head.y = -32 + Math.sin(G.tick * 0.15 + av._phase) * 1.5;
                if (av.legL) av.legL.y = Math.sin(G.tick * 0.2 + av._phase) * 3;
                if (av.legR) av.legR.y = -Math.sin(G.tick * 0.2 + av._phase) * 3;
            } else {
                // restless idle — small sway + occasional head turn
                if (av.head) av.head.y = -30 + Math.sin(G.tick * 0.05 + av._phase) * 0.8;
                if (av.body) av.body.rotation = Math.sin(G.tick * 0.03 + av._phase) * 0.03;
            }
        });
    },
};
