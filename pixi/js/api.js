/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   API & SERVICES LAYER (v16.5.0 - Dynamic Region Parameter Passing)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Single source of truth for provider default model ids — applied only when the
// user hasn't picked a model in Settings. Prefer stable aliases over dated
// snapshots so these don't rot (a 2024-dated default once shipped here and
// outlived the model's retirement). These are DEFAULTS, not ceilings — never
// turn them into version caps (see project memory: model-version-ceilings).
const PROVIDER_DEFAULT_MODELS = {
    anthropic: 'claude-opus-4-8',
    google: 'gemini-3.1-flash',
    xai: 'grok-4-latest',
    openai: 'gpt-5.4',
};

const API = {
    liveNews: [],
    regulationNews: [],
    arxivPapers: [],
    vcDeals: [],
    supplyChainNews: [],
    newsIdx: 0,
    stockPrices: {},

    // Server-accumulated AI industry events (HN + HuggingFace + Launch Library
    // + ... — written hourly by netlify/functions/collect-events.mjs). The
    // News Reactivity engine, Citizen of the Day, and Daily Briefing all read
    // from this so reactions/briefings still work even when nobody had the
    // app open during a breaking story. See sc_events_schema.sql.
    cloudEvents: [],
    cloudEventsFetchedAt: 0,

    supabase: null,
    
    // Convert any model object to Supabase-safe format (matching scan nm schema)
    _dbSafeModel(m) {
        return {
            id: m.id,
            name: m.name,
            lab: m.lab,
            rel: m.released || m.rel || null,
            ret: m.retired || m.ret || null,
            phase: m.phase || 'released',
            os: m.os || false,
            desc: m.desc || '',
            per: m.personality || m.per || 'Analytical',
            tal: m.talent || m.tal || 'General',
            fav: m.favSpot || m.fav || 'Server Room',
            _src: true,
            benchmarks: m.benchmarks || null,
            arch: m.arch || null,
            ctx: m.ctx || null,
            cost_input: m.cost_input || 0,
            cost_out: m.cost_out || 0
        };
    },

    initSupabase() {
        if (G.supabaseUrl && G.supabaseKey && typeof window.supabase !== 'undefined') {
            this.supabase = window.supabase.createClient(G.supabaseUrl, G.supabaseKey);
            console.log("Supabase Connection Established.");
        } else {
            console.warn("Supabase credentials missing or SDK not loaded. Running in local-only mode.");
        }
    },

    // ─── SERVER-SIDE WRITE GATE ──────────────────────────────────────────────
    // All shared-table writes go through /.netlify/functions/submit-data, which
    // validates rows and writes with the service key. The anon key is READ-ONLY
    // on these tables (rls_all.sql) — a direct .from(...).insert() from the
    // browser will be rejected by RLS, so never add one; extend the function's
    // per-table spec instead. Arrays are chunked to the function's row cap.
    async _cloudSubmit(table, rows, opts = {}) {
        const list = Array.isArray(rows) ? rows : [rows];
        let allOk = true;
        for (let i = 0; i < list.length; i += 25) {
            try {
                const r = await fetch('/.netlify/functions/submit-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table, rows: list.slice(i, i + 25), ...opts }),
                    signal: AbortSignal.timeout(15000)
                });
                if (!r.ok) allOk = false;
            } catch (e) { allOk = false; }
        }
        return allOk;
    },

    // ─── CORE-DATA CACHE ────────────────────────────────────────────────────
    // The curated baseline (labs, buildings, founders, clusters) lives only in
    // Supabase — with no fallback, an outage used to boot a near-empty city and
    // the installed PWA's "offline support" showed an empty shell. Instead of a
    // hand-authored seed file that would rot, snapshot the last successful
    // fetch and restore it when Supabase is unreachable. Self-maintaining: the
    // cache is exactly as fresh as the user's last online visit.
    _CORE_CACHE_KEY: 'sc_core_cache_v1',

    _saveCoreCache() {
        try {
            localStorage.setItem(this._CORE_CACHE_KEY, JSON.stringify({
                ts: Date.now(),
                labs: LABS,
                founders: REAL_FOUNDERS,
                clusters: (window.COMPUTE_DATA && window.COMPUTE_DATA.clusters) || [],
                blds: window.BLDS || [],
                acts: window.ACTS || {},
                families: window.FAMILIES || {},
                events: (window.AI_EVENTS || []).slice(0, 120)
            }));
        } catch (e) { /* quota — cache is best-effort */ }
    },

    _loadCoreCache() {
        try {
            const raw = localStorage.getItem(this._CORE_CACHE_KEY);
            if (!raw) return false;
            const c = JSON.parse(raw);
            if (!c || !c.labs || !Array.isArray(c.blds) || c.blds.length === 0) return false;
            LABS = c.labs;
            REAL_FOUNDERS = c.founders || [];
            if (!window.COMPUTE_DATA) window.COMPUTE_DATA = {};
            window.COMPUTE_DATA.clusters = c.clusters || [];
            window.BLDS = c.blds;
            window.ACTS = c.acts || {};
            window.FAMILIES = c.families || {};
            window.AI_EVENTS = c.events || [];
            const ageDays = Math.round((Date.now() - (c.ts || 0)) / 86400000);
            console.warn(`📦 Supabase unreachable — restored core data from local cache (${ageDays}d old).`);
            if (typeof UI !== 'undefined' && UI.addLog) UI.addLog(`📦 Offline: city restored from your last visit (${ageDays}d old).`);
            return true;
        } catch (e) {
            return false;
        }
    },

    async fetchCoreData() {
        if (!this.supabase) {
            console.warn("Supabase not initialized. Trying local core cache.");
            return this._loadCoreCache();
        }
        
        try {
            const [labsRes, foundersRes, computeRes, bldsRes, actsRes, famRes, evRes, dcRes] = await Promise.all([
                this.supabase.from('labs').select('*'),
                this.supabase.from('founders').select('*'),
                this.supabase.from('compute_clusters').select('*'),
                this.supabase.from('blds').select('*').order('x', { ascending: true }),
                this.supabase.from('acts').select('*'),
                this.supabase.from('families').select('*'),
                this.supabase.from('ai_events').select('*'),
                this.supabase.from('dc_facilities').select('*').then(r => r).catch(() => ({ data: null, error: null }))
            ]);

            if (labsRes.error) throw labsRes.error;
            if (foundersRes.error) throw foundersRes.error;
            if (computeRes.error) throw computeRes.error;
            if (bldsRes.error) throw bldsRes.error;
            if (actsRes.error) throw actsRes.error;
            if (famRes.error) throw famRes.error;
            if (evRes.error) throw evRes.error;

            LABS = {
                other: { name: 'Independent', color: '#64748b', icon: '🌐', ticker: null, desc: 'Independent entities and public spaces.', region: 'eu' }
            };
            
            // Colors from the shared DB flow into style="…" attributes all over the
            // UI — hex-validate them at this single ingest chokepoint so no render
            // site has to worry about attribute breakout.
            const hexOr = (c, fb) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) ? c : fb;

            labsRes.data.forEach(lab => {
                LABS[lab.id] = {
                    name: lab.name,
                    color: hexOr(lab.color, '#64748b'),
                    icon: lab.icon || '🏢',
                    ticker: lab.ticker,
                    desc: lab.lore_desc,
                    region: lab.region || 'eu'
                };
            });

            REAL_FOUNDERS = foundersRes.data.map(f => ({
                lab: f.lab_id,
                name: f.name,
                role: f.role,
                fact: f.fact,
                color: hexOr(f.color, '#64748b')
            }));

            if (!window.COMPUTE_DATA) window.COMPUTE_DATA = {};
            window.COMPUTE_DATA.clusters = computeRes.data.map(c => ({
                lab: c.lab_id,
                name: c.cluster_name,
                gpus: c.gpus,
                type: c.type,
                location: c.location
            }));

            // Merge cloud DC facilities with hardcoded fallback
            if (dcRes && dcRes.data && dcRes.data.length > 0) {
                dcRes.data.forEach(row => {
                    const existing = DC_FACILITIES.find(dc => dc.id === row.id);
                    if (existing) {
                        // Update from cloud (cloud is source of truth for mutable fields)
                        if (row.status) existing.status = row.status;
                        if (row.gpus) existing.gpus = row.gpus;
                        if (row.power_mw) existing.power_mw = row.power_mw;
                        if (row.cooling) existing.cooling = row.cooling;
                        if (row.process) existing.process = row.process;
                        if (row.products) existing.products = row.products;
                        if (row.investment) existing.investment = row.investment;
                        if (row.completion) existing.completion = row.completion;
                        if (row.description) existing.desc = row.description;
                    } else {
                        // New facility discovered from cloud — add to local array
                        DC_FACILITIES.push({
                            id: row.id, name: row.name, operator: row.operator,
                            location: row.location, type: row.type || 'datacenter',
                            status: row.status || 'operational',
                            gpus: row.gpus, power_mw: row.power_mw, cooling: row.cooling,
                            process: row.process, products: row.products,
                            investment: row.investment, completion: row.completion,
                            desc: row.description || '', w: row.width || 160, color: row.color || '#64748b'
                        });
                    }
                });

            }

            window.BLDS = bldsRes.data.map(b => ({
                id: b.id,
                name: b.name,
                w: b.w,
                x: b.x,
                fl: b.fl,
                emoji: b.emoji,
                lab: b.lab,
                desc: b.desc
            }));

            window.ACTS = {};
            actsRes.data.forEach(a => {
                window.ACTS[a.id] = {
                    label: a.label,
                    verb: a.verb,
                    icon: a.icon,
                    indoor: a.indoor
                };
            });

            window.FAMILIES = {};
            famRes.data.forEach(f => {
                window.FAMILIES[f.lab] = f.edges;
            });

            window.AI_EVENTS = evRes.data;

            this._saveCoreCache();
            return true;
        } catch (err) {
            console.error("❌ Failed to fetch core data from Supabase:", err);
            return this._loadCoreCache();
        }
    },
    
    // ─── CLOUD EVENTS (server-accumulated AI industry signal) ──────────────
    // Pulls last 14 days of events from the sc_events table. Cheap query
    // (table indexed on event_date desc). Caches result on API.cloudEvents.
    // Returns the array, or empty on failure.
    async fetchCloudEvents() {
        if (!this.supabase) return [];
        try {
            // Filter to events from the last 14 UTC days
            const since = new Date(Date.now() - 14 * 86400000);
            const sinceDate = `${since.getUTCFullYear()}-${String(since.getUTCMonth()+1).padStart(2,'0')}-${String(since.getUTCDate()).padStart(2,'0')}`;
            const { data, error } = await this.supabase
                .from('sc_events')
                .select('*')
                .gte('event_date', sinceDate)
                .order('ts', { ascending: false })
                .limit(500);
            if (error) throw error;
            this.cloudEvents = Array.isArray(data) ? data : [];
            this.cloudEventsFetchedAt = Date.now();
            console.log(`☁️  Cloud events loaded: ${this.cloudEvents.length} (last 14 days)`);
            return this.cloudEvents;
        } catch (err) {
            // Likely cause: sc_events table not created yet. Soft-fail so the
            // app still works in local-only mode.
            console.warn('[CloudEvents] fetch failed (table may not exist yet):', err && err.message || err);
            return [];
        }
    },

    // Merge cloud events + local localStorage events for a given UTC date.
    // Returns a deduplicated array sorted by ts (newest first). Used by COTD
    // and Daily Briefing as the canonical "what happened on day X" lookup.
    getEventsByDate(dateStr) {
        const out = [];
        const seen = new Set();
        // Cloud events (preferred)
        for (const e of (this.cloudEvents || [])) {
            if (!e || e.event_date !== dateStr) continue;
            if (seen.has(e.id)) continue;
            seen.add(e.id);
            // Normalize cloud shape → match local shape (lab vs labId, ts vs date+ts)
            out.push({
                id: e.id, date: e.event_date, ts: e.ts, type: e.event_type,
                archetype: e.archetype, emoji: e.emoji, lab: e.lab,
                title: e.title, url: e.url, score: e.score || 50,
                source: e.source || 'cloud'
            });
        }
        // Local fallback (older client-fired events not yet on the server)
        try {
            const raw = localStorage.getItem('sc_news_events_v1');
            if (raw) {
                const local = JSON.parse(raw);
                for (const e of (local || [])) {
                    if (!e || e.date !== dateStr) continue;
                    const lid = e.id || `local:${e.ts}:${e.lab || ''}`;
                    if (seen.has(lid)) continue;
                    seen.add(lid);
                    out.push(Object.assign({ id: lid, score: 50, source: 'local' }, e));
                }
            }
        } catch (_e) { /* ignore */ }
        // Cloud `ts` is often a number (epoch ms); local rows may use a time string.
        // Always coerce before localeCompare so mixed shapes never throw.
        out.sort((a, b) => String(b.ts ?? '').localeCompare(String(a.ts ?? '')));
        return out;
    },

    async fetchCloudModels() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('models').select('*');
            if (error) throw error;

            if (data && data.length > 0) {
                // Fuzzy name norm matches the one used by ZeroEval/OpenRouter/scan dedup —
                // strips 6+ digit date codes (so "claude-opus-4-7-20251103" collapses onto
                // "claude-opus-4-7") while preserving the "47" version digits.
                const fuzzyNorm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d{6,}/g, '');
                const existingMap = new Map(G.models.map(m => [m.id, m]));
                // Name-based lookup: prevents two Supabase rows with different IDs but the
                // same display name (e.g. scan wrote "claude-opus-4-7", OpenRouter wrote
                // "anthropic_claude-opus-4-7") from both spawning citizens on reload.
                const existingByName = new Map();
                G.models.forEach(m => { const k = fuzzyNorm(m.name); if (k) existingByName.set(k, m); });
                let added = 0, dupeSkipped = 0;

                // Build verification registry before processing cloud models
                if (!this._verifiedModelNames) this._buildVerifiedRegistry();
                const rejectIds = [];
                const rejectNames = [];
                if (!this._pendingNameDupes) this._pendingNameDupes = [];

                data.forEach(m => {
                    // Verify cloud models too — purge hallucinated data from DB
                    const verification = this._verifyModel(m);
                    if (!verification.ok) {
                        rejectIds.push(m.id);
                        rejectNames.push(m.name);
                        return;
                    }

                    if (m.benchmarks) {
                        if (!window.BM) window.BM = {};
                        if (!window.BM[m.id]) window.BM[m.id] = {};
                        Object.keys(m.benchmarks).forEach(k => {
                            window.BM[m.id][k.toUpperCase()] = m.benchmarks[k];
                        });
                    }

                    if (m.cost_input != null && m.cost_out != null) {
                        if (!window.COSTS) window.COSTS = {};
                        window.COSTS[m.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                    }
                    if (m.ctx != null) {
                        if (!window.CTX) window.CTX = {};
                        window.CTX[m.id] = parseInt(m.ctx);
                    }

                    // PASS REGION INTO ENGINE DYNAMICALLY
                    m.lab = G.ensureLabExists(m.lab, m.region);

                    if (existingMap.has(m.id)) {
                        Object.assign(existingMap.get(m.id), m);
                        return;
                    }

                    // Name collision: a different row already covers this model. Skip the
                    // extra entry so we don't spawn two citizens for the same model, and
                    // queue the losing row ID for dedupeModels() to clean up in Supabase.
                    const nameKey = fuzzyNorm(m.name);
                    if (nameKey && existingByName.has(nameKey)) {
                        this._pendingNameDupes.push(m.id);
                        dupeSkipped++;
                        return;
                    }

                    G.models.push(m);
                    if (typeof Entities !== 'undefined') Entities.createChar(m);
                    existingMap.set(m.id, m);
                    if (nameKey) existingByName.set(nameKey, m);
                    added++;
                });
                
                if (added > 0) {
                    if (typeof UI !== 'undefined') UI.addLog(`☁️ Synced ${added} models from global database.`);
                }
                if (dupeSkipped > 0) {
                    console.warn(`🔀 [Cloud] Skipped ${dupeSkipped} duplicate-name rows on load — dedupeModels() will reconcile Supabase.`);
                }
                // Log rejected models but DO NOT auto-delete from Supabase here.
                // Cloud cleanup is handled by purgeHallucinations() which runs after
                // ZeroEval+HF have loaded (giving the verifier its full registry).
                if (rejectIds.length > 0) {
                    console.warn(`🚫 [Cloud] Filtered ${rejectIds.length} hallucinated models from display: ${rejectNames.join(', ')}`);
                    // Stash for purgeHallucinations to clean up later
                    this._pendingCloudRejects = rejectIds;
                }

                // Always re-evolve: cost, benchmark, and ELO data may have updated
                // for existing models even when no new models were added.
                // This recalculates cheapestLab (SALE sign) and topLab (Apex Beacon).
                G.evolveCity();
            }
        } catch(e) {
            console.error("Cloud fetch failed:", e);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   HUGGING FACE API — Free, no-auth, 100% accurate model data
    // ═══════════════════════════════════════════════════════════════
    
    _hfOrgToLab: {
        'meta-llama': 'meta', 'google': 'google', 'mistralai': 'mistral', 'Qwen': 'alibaba',
        'microsoft': 'microsoft', 'nvidia': 'nvidia', 'deepseek-ai': 'deepseek', 'apple': 'apple',
        'amazon': 'amazon', 'stabilityai': 'stability', 'bigcode': 'bigcode', 'tiiuae': 'tii',
        'THUDM': 'zhipu_ai', '01-ai': '01_ai', 'baichuan-inc': 'baichuan', 'internlm': 'shanghai_ai_lab',
        'CohereForAI': 'cohere', 'databricks': 'databricks',
        'allenai': 'allen_ai', 'cerebras': 'cerebras', 'EleutherAI': 'eleutherai',
        'HuggingFaceH4': 'huggingface', 'bigscience': 'bigscience', 'mosaicml': 'mosaicml',
        'Salesforce': 'salesforce', 'NousResearch': 'nous_research', 'upstage': 'upstage',
        'Phind': 'phind'
    },
    
    async fetchHuggingFace() {
        try {
            const isDeployed = !['localhost','127.0.0.1'].includes(window.location.hostname);
            const url = isDeployed 
                ? '/api/hf/models?sort=likes&limit=25&pipeline_tag=text-generation'
                : 'https://huggingface.co/api/models?sort=likes&limit=25&pipeline_tag=text-generation';
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) { 
                const errBody = await res.text().catch(() => '');
                console.warn('[HF API] HTTP', res.status, errBody.substring(0, 200)); 
                return; 
            }
            const models = await res.json();
            
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            let added = 0;
            
            for (const hf of models) {
                if (!hf.id || !hf.modelId) continue;
                
                const parts = hf.modelId.split('/');
                const org = parts.length > 1 ? parts[0] : 'unknown';
                const modelName = parts.length > 1 ? parts[1] : parts[0];
                
                const displayName = modelName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                
                const safeName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (existingNames.has(safeName)) continue;
                
                const labId = this._hfOrgToLab[org] || org.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const region = ['meta-llama', 'google', 'microsoft', 'nvidia', 'apple', 'amazon', 'allenai', 'cerebras'].includes(org) ? 'us' :
                               ['Qwen', 'deepseek-ai', 'THUDM', '01-ai', 'baichuan-inc', 'internlm'].includes(org) ? 'cn' : 'eu';
                
                const nm = {
                    id: hf.modelId.replace(/\//g, '_').toLowerCase(),
                    name: displayName,
                    lab: G.ensureLabExists(labId, region),
                    region: region,
                    released: hf.createdAt ? hf.createdAt.split('T')[0] : null,
                    retired: null,
                    phase: 'released',
                    os: true,
                    desc: `Open-weights model trending on Hugging Face. ${hf.downloads ? (hf.downloads > 1000000 ? (hf.downloads/1000000).toFixed(1) + 'M downloads' : (hf.downloads/1000).toFixed(0) + 'K downloads') : ''} ${hf.likes ? hf.likes + ' likes' : ''}`.trim(),
                    personality: 'Open Source',
                    talent: (hf.tags || []).includes('code') ? 'Coding' : 'General',
                    favSpot: 'Open Square',
                    _src: 'huggingface',
                    arch: { params: 'Unknown', type: 'Unknown', tokens: 'Unknown', compute: 'Unknown' }
                };
                
                const isDupe = G.models.some(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                if (isDupe) continue;
                
                existingNames.add(safeName);
                G.models.push(nm);
                if (typeof Entities !== 'undefined') Entities.createChar(nm);
                added++;
                
                if (this.supabase) {
                    try { await this._cloudSubmit('models', this._dbSafeModel(nm)); } catch(e) { /* silent */ }
                }
                
                if (added >= 6) break;
            }
            
            if (added > 0) {

                if (typeof UI !== 'undefined') UI.addToast(`🤗 Hugging Face: ${added} new open-source models!`);
                if (typeof NOTIFY !== 'undefined') NOTIFY.send('Models Discovered!', `🤗 ${added} new open-source models from Hugging Face`);
                if (typeof UI !== 'undefined') UI.addLog(`🤗 HF API: ${added} trending models added`);
                G.evolveCity();
            }
            this._huggingfaceLoaded = true;
        } catch(e) {
            console.warn('[HF API] Fetch failed:', e.message);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   ZEROEVAL LEADERBOARD API — Free, no-auth, 100% accurate
    //   benchmarks, pricing, context windows for ALL models
    // ═══════════════════════════════════════════════════════════════
    
    _zeOrgToLab: {
        'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google', 'meta': 'meta',
        'xai': 'xai', 'mistral': 'mistral', 'deepseek': 'deepseek', 'cohere': 'cohere',
        'microsoft': 'microsoft', 'nvidia': 'nvidia', 'amazon': 'amazon', 'alibaba': 'alibaba',
        'zhipu': 'zhipu_ai', '01ai': '01_ai', 'baichuan': 'baichuan', 'apple': 'apple',
        'databricks': 'databricks', 'ai21': 'ai21', 'minimax': 'minimax', 'reka': 'reka',
        'together': 'together', 'perplexity': 'perplexity', 'inflection': 'inflection',
        'stability': 'stability'
    },
    // NOTE: maps to the city's ZONING bucket ('us'/'eu'/'cn' districts), NOT a
    // nationality — KR/JP/IN land in the 'cn' (Asia) district by design. Never
    // surface these values as country labels in UI text.
    _zeCountryToRegion: { 'US': 'us', 'CN': 'cn', 'FR': 'eu', 'CA': 'eu', 'IL': 'eu', 'UK': 'eu', 'DE': 'eu', 'FI': 'eu', 'AE': 'eu', 'KR': 'cn', 'JP': 'cn', 'IN': 'cn' },
    
    async fetchZeroEval() {
        try {
            const isDeployed = !['localhost','127.0.0.1'].includes(window.location.hostname);
            const url = isDeployed
                ? '/api/zeroeval/leaderboard/models/full?justCanonicals=true'
                : 'https://api.zeroeval.com/leaderboard/models/full?justCanonicals=true';
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) { console.warn('[ZeroEval] HTTP', res.status); return; }
            const models = await res.json();
            if (!Array.isArray(models)) return;
            
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            const _existingIds = new Set(G.models.map(m => m.id.toLowerCase().replace(/[^a-z0-9]/g, '')));
            
            // Fuzzy name normalizer — strips only 6+ digit date codes like "20250514".
            // Version numbers (e.g. the "47" in "claudeopus47") are KEPT so that minor
            // version bumps like Opus 4.6 → 4.7 are treated as distinct models, not dupes.
            const fuzzyNorm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d{6,}/g, '');
            const existingFuzzy = new Set(G.models.map(m => fuzzyNorm(m.name)));
            
            // Track how many ZeroEval-sourced models we already have (cap at 150 total)
            const zeModelsCount = G.models.filter(m => m._src === 'zeroeval').length;
            const zeCapRemaining = Math.max(0, 150 - zeModelsCount);
            
            let added = 0, benchUpdated = 0;
            
            for (const ze of models) {
                if (!ze.name || !ze.organization_id) continue;
                
                const safeName = ze.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const safeId = ze.model_id ? ze.model_id.toLowerCase().replace(/[^a-z0-9]/g, '') : safeName;
                const fuzzyName = fuzzyNorm(ze.name);
                
                // Build benchmark object from ZeroEval scores
                const bm = {};
                if (ze.gpqa_score) bm.GPQA = Math.round(ze.gpqa_score * 100);
                if (ze.mmmlu_score) bm.MMLU = Math.round(ze.mmmlu_score * 100);
                if (ze.aime_2025_score) bm.MATH = Math.round(ze.aime_2025_score * 100);
                if (ze.swe_bench_verified_score) bm.HumanEval = Math.round(ze.swe_bench_verified_score * 100);
                
                // Try to match to an existing model — use fuzzy matching to catch version variants
                const existing = G.models.find(m => {
                    const eName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eId = m.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eFuzzy = fuzzyNorm(m.name);
                    return eName === safeName || eId === safeId || eFuzzy === fuzzyName;
                });
                
                if (existing) {
                    // Backfill benchmarks, pricing, context, and correct stale data
                    let updated = false;
                    if (Object.keys(bm).length > 0) {
                        if (!window.BM) window.BM = {};
                        if (!window.BM[existing.id]) window.BM[existing.id] = {};
                        Object.entries(bm).forEach(([k, v]) => {
                            if (!window.BM[existing.id][k] || v > window.BM[existing.id][k]) {
                                window.BM[existing.id][k] = v;
                                updated = true;
                            }
                        });
                    }
                    if (ze.input_price != null && ze.output_price != null) {
                        if (!window.COSTS) window.COSTS = {};
                        window.COSTS[existing.id] = { input: ze.input_price, output: ze.output_price };
                        existing.cost_input = ze.input_price;
                        existing.cost_out = ze.output_price;
                        updated = true;
                    }
                    if (ze.context && !existing.ctx) {
                        if (!window.CTX) window.CTX = {};
                        window.CTX[existing.id] = ze.context;
                        existing.ctx = ze.context;
                        updated = true;
                    }
                    // Fix stale phase — ZeroEval only lists released models
                    if (existing.phase === 'rumored' || existing.phase === 'pre_training') {

                        existing.phase = 'released';
                        updated = true;
                    }
                    // Backfill release date if missing
                    if (ze.release_date && (!existing.rel && !existing.released)) {
                        existing.rel = ze.release_date;
                        existing.released = ze.release_date;
                        updated = true;
                    }
                    if (updated) benchUpdated++;
                    continue;
                }
                
                // New model — check fuzzy match and cap before creating
                if (existingFuzzy.has(fuzzyName)) { benchUpdated++; continue; } // fuzzy match caught a variant
                if (added >= zeCapRemaining) continue; // cap reached
                
                const orgId = ze.organization_id.toLowerCase();
                const labId = this._zeOrgToLab[orgId] || orgId.replace(/[^a-z0-9]/g, '_');
                const region = this._zeCountryToRegion[ze.organization_country] || 'us';
                
                const nm = {
                    id: ze.model_id || safeName,
                    name: ze.name,
                    lab: G.ensureLabExists(labId, region),
                    region: region,
                    released: ze.release_date || null,
                    retired: null,
                    phase: 'released',
                    os: ze.license && ze.license !== 'proprietary',
                    desc: `${ze.organization} model.${ze.params ? ' ' + (ze.params / 1e9).toFixed(0) + 'B params.' : ''}${ze.multimodal ? ' Multimodal.' : ''}`,
                    personality: ze.multimodal ? 'Multimodal' : 'Analytical',
                    talent: ze.swe_bench_verified_score > 0.5 ? 'Coding' : 'General',
                    favSpot: ze.license === 'proprietary' ? 'Server Room' : 'Open Square',
                    _src: 'zeroeval',
                    benchmarks: Object.keys(bm).length > 0 ? bm : null,
                    ctx: ze.context || null,
                    cost_input: ze.input_price || null,
                    cost_out: ze.output_price || null,
                    arch: {
                        params: ze.params ? (ze.params / 1e9).toFixed(0) + 'B' : 'Unknown',
                        type: ze.is_moe ? 'MoE' : 'Dense',
                        tokens: ze.training_tokens ? (ze.training_tokens / 1e12).toFixed(1) + 'T' : 'Unknown',
                        compute: 'Unknown'
                    }
                };
                
                // Store benchmarks
                if (Object.keys(bm).length > 0) {
                    if (!window.BM) window.BM = {};
                    window.BM[nm.id] = bm;
                }
                if (ze.input_price != null && ze.output_price != null) {
                    if (!window.COSTS) window.COSTS = {};
                    window.COSTS[nm.id] = { input: ze.input_price, output: ze.output_price };
                }
                if (ze.context) {
                    if (!window.CTX) window.CTX = {};
                    window.CTX[nm.id] = ze.context;
                }
                
                existingNames.add(safeName);
                existingFuzzy.add(fuzzyName);
                G.models.push(nm);
                if (typeof Entities !== 'undefined') Entities.createChar(nm);
                added++;
                
                if (this.supabase) {
                    try { await this._cloudSubmit('models', this._dbSafeModel(nm)); } catch(e) { /* silent */ }
                }
                
                if (added >= 8) break; // cap per fetch
            }
            
            if (added > 0 || benchUpdated > 0) {

                if (typeof UI !== 'undefined') {
                    if (added > 0) { UI.addToast(`📊 ZeroEval: ${added} new models with real benchmarks!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Benchmarks Updated!', `📊 ${added} new models with real benchmark scores`); }
                    UI.addLog(`📊 ZeroEval: +${added} models, ${benchUpdated} benchmark backfills`);
                }
                G.evolveCity();
            }
            this._zeroevalLoaded = true;
        } catch(e) {
            console.warn('[ZeroEval] Fetch failed:', e.message);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   OPENROUTER API — Free, no-auth. Catches beta/preview models
    //   that ZeroEval and HuggingFace only list after GA release.
    // ═══════════════════════════════════════════════════════════════

    _orLabMap: {
        'anthropic': 'anthropic', 'openai': 'openai', 'google': 'google',
        'meta-llama': 'meta', 'meta': 'meta',
        'mistralai': 'mistral', 'mistral': 'mistral',
        'x-ai': 'xai', 'xai': 'xai',
        'deepseek': 'deepseek', 'cohere': 'cohere', 'perplexity': 'perplexity',
        'microsoft': 'microsoft', 'nvidia': 'nvidia', 'amazon': 'amazon',
        'qwen': 'alibaba', 'alibaba': 'alibaba', 'zhipu': 'zhipu_ai',
        'apple': 'apple', 'databricks': 'databricks', 'ai21': 'ai21',
        'minimax': 'minimax', 'reka': 'reka', 'together': 'together',
        'inflection': 'inflection', 'stability': 'stability',
        '01-ai': '01_ai', 'baichuan': 'baichuan',
        'moonshotai': 'moonshot', 'moonshot': 'moonshot',
        'nousresearch': 'nous', 'liquid': 'liquid'
    },

    async fetchOpenRouter() {
        try {
            const isDeployed = !['localhost','127.0.0.1'].includes(window.location.hostname);
            const url = isDeployed
                ? '/api/openrouter/models'
                : 'https://openrouter.ai/api/v1/models';
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) { console.warn('[OpenRouter] HTTP', res.status); return; }
            const payload = await res.json();
            const models = payload && Array.isArray(payload.data) ? payload.data : [];
            if (models.length === 0) return;

            const fuzzyNorm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d{6,}/g, '');
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            const existingFuzzy = new Set(G.models.map(m => fuzzyNorm(m.name)));

            // Cap total OpenRouter-sourced models at 80 (smaller than ZeroEval's 150
            // since OpenRouter is noisier — includes community/preview variants).
            const orCount = G.models.filter(m => m._src === 'openrouter').length;
            const capRemaining = Math.max(0, 80 - orCount);

            const cnLabs = new Set(['alibaba', 'deepseek', 'zhipu_ai', '01_ai', 'baichuan', 'moonshot', 'minimax']);
            const euLabs = new Set(['mistral', 'cohere', 'ai21', 'stability', 'reka']);

            let added = 0, updated = 0;

            for (const or of models) {
                if (!or.id || !or.name) continue;

                // id format: "lab/model-name". Skip variant suffixes like :beta/:free/:nitro —
                // those are the same base model through a different OpenRouter routing tier.
                if (/:beta$|:free$|:nitro$|:extended$|:thinking$/i.test(or.id)) continue;

                const slashIdx = or.id.indexOf('/');
                if (slashIdx <= 0) continue;
                const rawLab = or.id.slice(0, slashIdx).toLowerCase();
                if (rawLab === 'openrouter' || rawLab === 'auto') continue;

                // Strip "Lab: " prefix from display name
                let displayName = or.name;
                const colonIdx = displayName.indexOf(': ');
                if (colonIdx > 0 && colonIdx < 30) displayName = displayName.slice(colonIdx + 2).trim();
                if (!displayName) continue;

                const safeName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const fuzzyName = fuzzyNorm(displayName);

                const labId = this._orLabMap[rawLab] || rawLab.replace(/[^a-z0-9]/g, '_');
                const region = cnLabs.has(labId) ? 'cn' : euLabs.has(labId) ? 'eu' : 'us';

                // OpenRouter pricing is per-token. Convert to $/1M to match ZeroEval shape.
                let costIn = null, costOut = null;
                if (or.pricing) {
                    const pIn = parseFloat(or.pricing.prompt);
                    const pOut = parseFloat(or.pricing.completion);
                    if (!isNaN(pIn) && pIn >= 0) costIn = pIn * 1e6;
                    if (!isNaN(pOut) && pOut >= 0) costOut = pOut * 1e6;
                }

                const modality = (or.architecture && or.architecture.modality) || '';
                const isMultimodal = /image|video|audio/i.test(modality);

                let releaseDate = null;
                if (or.created && typeof or.created === 'number') {
                    try { releaseDate = new Date(or.created * 1000).toISOString().split('T')[0]; } catch(e) {}
                }

                const existing = G.models.find(m => {
                    const eName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eId = m.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return eName === safeName || eId === safeName || fuzzyNorm(m.name) === fuzzyName;
                });

                if (existing) {
                    let changed = false;
                    if (or.context_length && !existing.ctx) {
                        if (!window.CTX) window.CTX = {};
                        window.CTX[existing.id] = or.context_length;
                        existing.ctx = or.context_length;
                        changed = true;
                    }
                    if (costIn != null && costOut != null && existing.cost_input == null) {
                        if (!window.COSTS) window.COSTS = {};
                        window.COSTS[existing.id] = { input: costIn, output: costOut };
                        existing.cost_input = costIn;
                        existing.cost_out = costOut;
                        changed = true;
                    }
                    if (releaseDate && !existing.rel && !existing.released) {
                        existing.rel = releaseDate;
                        existing.released = releaseDate;
                        changed = true;
                    }
                    if (existing.phase === 'rumored' || existing.phase === 'pre_training') {
                        existing.phase = 'released';
                        changed = true;
                    }
                    if (changed) updated++;
                    continue;
                }

                if (existingFuzzy.has(fuzzyName)) { updated++; continue; }
                if (added >= capRemaining) continue;

                const nm = {
                    id: or.id.replace(/\//g, '_').replace(/[^a-z0-9_]/gi, '_'),
                    name: displayName,
                    lab: G.ensureLabExists(labId, region),
                    region: region,
                    released: releaseDate,
                    retired: null,
                    phase: 'released',
                    os: false,
                    desc: `${displayName}.${isMultimodal ? ' Multimodal.' : ''}`,
                    personality: isMultimodal ? 'Multimodal' : 'Analytical',
                    talent: 'General',
                    favSpot: 'Server Room',
                    _src: 'openrouter',
                    benchmarks: null,
                    ctx: or.context_length || null,
                    cost_input: costIn,
                    cost_out: costOut,
                    arch: { params: 'Unknown', type: 'Dense', tokens: 'Unknown', compute: 'Unknown' }
                };

                if (costIn != null && costOut != null) {
                    if (!window.COSTS) window.COSTS = {};
                    window.COSTS[nm.id] = { input: costIn, output: costOut };
                }
                if (or.context_length) {
                    if (!window.CTX) window.CTX = {};
                    window.CTX[nm.id] = or.context_length;
                }

                existingNames.add(safeName);
                existingFuzzy.add(fuzzyName);
                G.models.push(nm);
                if (typeof Entities !== 'undefined') Entities.createChar(nm);
                added++;

                if (this.supabase) {
                    try { await this._cloudSubmit('models', this._dbSafeModel(nm)); } catch(e) { /* silent */ }
                }

                if (added >= 8) break; // cap per fetch
            }

            if (added > 0 || updated > 0) {
                if (typeof UI !== 'undefined') {
                    if (added > 0) {
                        UI.addToast(`🌐 OpenRouter: ${added} new model${added>1?'s':''} (incl. preview/beta)`);
                        if (typeof NOTIFY !== 'undefined') NOTIFY.send('New AI Models', `🌐 ${added} new model${added>1?'s':''} from OpenRouter`);
                    }
                    UI.addLog(`🌐 OpenRouter: +${added} models, ${updated} backfills`);
                }
                G.evolveCity();
            }
            this._openrouterLoaded = true;
        } catch(e) {
            console.warn('[OpenRouter] Fetch failed:', e.message);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   COINGECKO API — Free, no-auth crypto market telemetry.
    //   Feeds the Cryptex Exchange ticker in VC Row.
    // ═══════════════════════════════════════════════════════════════

    cryptoCoins: [], // [{ symbol, name, price, change, marketCap }]

    async fetchCoinGecko() {
        try {
            const url = 'https://api.coingecko.com/api/v3/coins/markets'
                      + '?vs_currency=usd&order=market_cap_desc&per_page=15&page=1'
                      + '&sparkline=false&price_change_percentage=24h';
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) { console.warn('[CoinGecko] HTTP', res.status); return; }
            const data = await res.json();
            if (!Array.isArray(data)) return;

            this.cryptoCoins = data
                .filter(c => c && c.symbol && typeof c.current_price === 'number')
                .map(c => ({
                    symbol: c.symbol,
                    name: c.name,
                    price: c.current_price,
                    change: typeof c.price_change_percentage_24h === 'number' ? c.price_change_percentage_24h : 0,
                    marketCap: c.market_cap || 0
                }));

            if (typeof UI !== 'undefined' && this.cryptoCoins.length > 0 && !this._cgFirstLoadLogged) {
                UI.addLog(`₿ CoinGecko: ${this.cryptoCoins.length} coins live at Cryptex Exchange`);
                this._cgFirstLoadLogged = true;
            }
        } catch(e) {
            console.warn('[CoinGecko] Fetch failed:', e.message);
        }
    },

    async fetchLiveNews() {
      let got = false;
      const allFeeds = [
        { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
        { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
        { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        { url: 'https://arstechnica.com/tag/ai/feed/', source: 'Ars Technica' }
      ];
      
      for (let i = allFeeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFeeds[i], allFeeds[j]] = [allFeeds[j], allFeeds[i]];
      }
      const selectedFeeds = allFeeds.slice(0, 2);
      
      for (const feed of selectedFeeds) {
        try {
          const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) {
              console.warn(`[News API] Skipping ${feed.source}: Server returned ${r.status}`);
              continue; 
          }

          const d = await r.json();
          if (d.status === 'ok' && d.items?.length > 0) {
            this.liveNews = [...this.liveNews.filter(n => n.source !== feed.source), ...d.items.slice(0, 12).map(i => ({ headline: i.title, url: i.link, source: feed.source }))].slice(0, 40);
            got = true;
          }
        } catch(e) {
            console.warn(`[News API] Failed to load ${feed.source}`);
        }
      }

      if (!got && this.liveNews.length === 0) {
        // Derive the fallback from the server-accumulated event log instead of
        // a hand-written list — a frozen list here once misrepresented the
        // frontier with year-old headlines whenever rss2json hiccuped.
        const fromCloud = (this.cloudEvents || [])
            .filter(ev => ev && ev.title && ev.source !== 'finnhub')
            .slice(0, 8)
            .map(ev => ({ headline: ev.title, url: ev.url || '#', source: 'Recent' }));
        this.liveNews = fromCloud.length > 0 ? fromCloud : [
          // Last resort when BOTH rss2json and Supabase are down: deliberately
          // undated, so it can't misstate the frontier.
          { headline: "Live headlines temporarily unavailable — reconnecting to news feeds", url: "#", source: "Fallback" }
        ];
      }
      
      if (this.liveNews.length > 0) {
        for (let i = this.liveNews.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.liveNews[i], this.liveNews[j]] = [this.liveNews[j], this.liveNews[i]];
        }
        this.newsIdx = 0;
        if (typeof UI !== 'undefined') UI.updateTicker();
      }
    },

    async fetchStocks() {
      if (!G.finnhubKey) return;
      const fabTickers = ['TSM', 'ASML', 'INTC']; // TSMC, ASML, Intel — public semiconductor companies
      const symbols = [...new Set([...Object.values(LABS).map(l => l.ticker).filter(Boolean), ...fabTickers])];
      
      for (const sym of symbols) {
          try {
              const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${G.finnhubKey}`, { signal: AbortSignal.timeout(8000) });
              if (!r.ok) continue;
              const d = await r.json();
              if (d) {
                  const currentPrice = d.c !== null && d.c !== undefined ? d.c.toFixed(2) : "0.00";
                  const dailyChange = d.d !== null && d.d !== undefined ? d.d.toFixed(2) : "0.00";
                  if (currentPrice !== "0.00") {
                      const changeVal = parseFloat(dailyChange);
                      const changeStr = changeVal > 0 ? '+' : '';
                      const color = changeVal >= 0 ? '#00ff00' : '#ff3333';
                      this.stockPrices[sym] = { 
                          price: currentPrice, 
                          change: `${changeStr}${dailyChange}`, 
                          color 
                      };
                  }
              }
          } catch(e) {
              console.warn(`Failed to fetch stock for ${sym}`);
          }
          await new Promise(res => setTimeout(res, 1100));
      }
    },
  
    // ═══ LIVE VC FUNDING — reads from Supabase vc_funding table ═══
    async fetchVCFunding() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('vc_funding').select('*');
            if (error || !data || data.length === 0) return;
            if (typeof VCRow !== 'undefined' && VCRow.FUNDING) {
                data.forEach(row => {
                    const code = VCRow.FUNDING[row.lab_id] || {};
                    // MAX-merge: the live table is "raise-only" vs. the curated
                    // code baseline, so a stale row can't mask a fresher curated
                    // valuation and vice-versa. Rounds stays curated-authoritative
                    // (human prose beats the table's cosmetic copy).
                    VCRow.FUNDING[row.lab_id] = {
                        total: Math.max(Number(row.total_m) || 0, code.total || 0),
                        valuation: Math.max(Number(row.valuation_m) || 0, code.valuation || 0),
                        rounds: code.rounds || row.rounds || ''
                    };
                });
                VCRow._buildTicker();

            }
        } catch (e) { console.warn('[VC Funding] Fetch failed:', e.message); }
    },

    // ═══ LIVE SUPPLY CHAIN — reads from Supabase supply_chain table ═══
    async fetchSupplyChain() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('supply_chain').select('*');
            if (error || !data || data.length === 0) return;
            if (typeof SUPPLY_CHAIN !== 'undefined') {
                const cats = { bottleneck: [], accelerator: [], foundry: [] };
                data.forEach(row => {
                    if (!row.data || typeof row.data !== 'object') return;
                    if (row.category === 'lithography' && row.data.name) {
                        SUPPLY_CHAIN.lithography = { asml_high_na: row.data };
                    } else if (row.category === 'bottleneck' && row.data.name && row.data.load != null) {
                        cats.bottleneck.push(row.data);
                    } else if (row.category === 'accelerator' && row.data.name) {
                        cats.accelerator.push(row.data);
                    } else if (row.category === 'foundry' && row.data.name) {
                        cats.foundry.push(row.data);
                    }
                });
                if (cats.bottleneck.length) SUPPLY_CHAIN.bottlenecks = cats.bottleneck;
                if (cats.accelerator.length) SUPPLY_CHAIN.accelerators = cats.accelerator;
                if (cats.foundry.length) SUPPLY_CHAIN.foundries = cats.foundry;

            }
        } catch (e) { console.warn('[Supply Chain] Fetch failed:', e.message); }
    },

    // ═══ REGULATION NEWS — filters live news for AI policy/regulation headlines ═══
    async fetchRegulationNews() {
        // Extract regulation-relevant items from the live news feed
        const regKeywords = /regulat|senate|congress|EU AI Act|compliance|safety|ban|lawsuit|copyright|FTC|antitrust|oversight|hearing|legislation|policy|GDPR|govern/i;
        const regItems = this.liveNews.filter(n => regKeywords.test(n.headline));
        if (regItems.length > 0) {
            this.regulationNews = regItems;

        }
        // Also try dedicated regulation RSS feed
        try {
            const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'), { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
                const d = await r.json();
                if (d.status === 'ok' && d.items?.length > 0) {
                    const regFiltered = d.items.filter(i => regKeywords.test(i.title));
                    regFiltered.forEach(i => {
                        if (!this.regulationNews.find(n => n.headline === i.title)) {
                            this.regulationNews.push({ headline: i.title, url: i.link, source: 'Regulation Feed' });
                        }
                    });
                }
            }
        } catch (e) { /* silent */ }
    },

    // ═══ ARXIV PAPERS — real CS/AI papers for conference poster sessions ═══
    async fetchArxivPapers() {
        const isDeployed = !['localhost', '127.0.0.1'].includes(window.location.hostname);
        const url = isDeployed
            ? '/api/arxiv/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20'
            : 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20';
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
            if (!r.ok) return;
            const text = await r.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const entries = xml.querySelectorAll('entry');
            const papers = [];
            entries.forEach(e => {
                const title = e.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ');
                const id = e.querySelector('id')?.textContent?.split('/abs/').pop() || '';
                const published = e.querySelector('published')?.textContent?.split('T')[0] || '';
                if (title) papers.push({ title, id, published });
            });
            if (papers.length > 0) {
                this.arxivPapers = papers;

            }
        } catch (e) { console.warn('[arXiv] Fetch failed:', e.message); }
    },

    // ═══ LIVE VC DEALS — parses funding headlines from venture RSS feeds ═══
    async fetchVCDealsRSS() {
        const feeds = [
            { url: 'https://techcrunch.com/category/venture/feed/', source: 'TechCrunch' },
            { url: 'https://venturebeat.com/category/business/feed/', source: 'VentureBeat' },
        ];

        // 1. Load persisted deals from Supabase first
        if (this.supabase && this.vcDeals.length === 0) {
            try {
                const { data } = await this.supabase.from('vc_deals')
                    .select('*').order('created_at', { ascending: false }).limit(20);
                if (data?.length) {
                    this.vcDeals = data.map(d => ({
                        headline: d.headline, amount: d.amount, round: d.round,
                        url: d.url, source: d.source, date: d.pub_date
                    }));
                }
            } catch (e) { /* table may not exist yet */ }
        }

        // 2. Fetch fresh from RSS
        const amtPattern = /\$\s*([\d,.]+)\s*(M|B|million|billion|mn|bn)/i;
        const fundingVerbs = /\b(raises?|raised|secures?|secured|closes?|closed|lands?|landed|gets?|got|nabs?|nabbed|bags?|bagged|grabs?|grabbed|nets?|netted|funding)\b/i;
        const roundPattern = /\b(seed|pre-seed|series\s+[a-f])\b/i;

        const existingHeadlines = new Set(this.vcDeals.map(d => d.headline));

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                for (const item of d.items) {
                    if (!amtPattern.test(item.title) || !fundingVerbs.test(item.title)) continue;
                    if (existingHeadlines.has(item.title)) continue;

                    const amtMatch = item.title.match(amtPattern);
                    const rawNum = parseFloat(amtMatch[1].replace(/,/g, ''));
                    const unit = /^b/i.test(amtMatch[2]) ? 'B' : 'M';

                    const roundMatch = item.title.match(roundPattern);

                    const deal = {
                        headline: item.title,
                        amount: `$${rawNum}${unit}`,
                        round: roundMatch ? roundMatch[1] : '',
                        url: item.link,
                        source: feed.source,
                        date: item.pubDate?.split(' ')[0] || item.pubDate?.split('T')[0] || ''
                    };

                    this.vcDeals.unshift(deal);
                    existingHeadlines.add(item.title);

                    // Persist via the server-side write gate (fire-and-forget)
                    if (this.supabase) {
                        this._cloudSubmit('vc_deals', {
                            headline: deal.headline,
                            amount: deal.amount,
                            round: deal.round || null,
                            url: deal.url,
                            source: deal.source,
                            pub_date: deal.date || null
                        });
                    }
                }
            } catch (e) { console.warn(`[VC RSS] ${feed.source}:`, e.message); }
        }

        // Keep max 30 deals
        this.vcDeals = this.vcDeals.slice(0, 30);

        if (this.vcDeals.length > 0) {

            if (typeof VCRow !== 'undefined') VCRow._buildTicker();
        }
    },

    // ═══ LIVE SUPPLY CHAIN NEWS — semiconductor industry headlines from RSS ═══
    async fetchSupplyChainNews() {
        const feeds = [
            { url: 'https://www.tomshardware.com/feeds/all', source: "Tom's Hardware" },
            { url: 'https://wccftech.com/feed/', source: 'WCCFTech' },
        ];

        const chipKeywords = /\b(TSMC|Samsung.{0,12}(?:foundry|fab|chip|semiconductor)|Intel.{0,12}(?:foundry|fab|chip)|ASML|HBM\d?|CoWoS|EUV|DUV|semiconductor|chip.{0,8}(?:shortage|supply|demand)|wafer|foundry|lithograph|advanced\s+packaging|\dnm\b|GPU.{0,8}(?:supply|shortage|production)|Nvidia.{0,8}(?:supply|production|chip)|AMD.{0,8}(?:supply|chip)|DRAM|NAND|memory.{0,8}(?:shortage|supply)|Blackwell|Rubin|B200|B100|H100|H200|MI\d{3})\b/i;

        // 1. Load persisted from Supabase
        if (this.supabase && this.supplyChainNews.length === 0) {
            try {
                const { data } = await this.supabase.from('supply_chain')
                    .select('*').order('created_at', { ascending: false }).limit(20);
                if (data?.length) {
                    this.supplyChainNews = data.map(d => ({
                        headline: d.title, url: d.source_url,
                        source: d.detail, category: d.category,
                        date: d.created_at?.split('T')[0]
                    }));
                }
            } catch (e) { /* table may not exist yet */ }
        }

        // 2. Fetch fresh from RSS
        const existing = new Set(this.supplyChainNews.map(n => n.headline));

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                for (const item of d.items) {
                    if (!chipKeywords.test(item.title) || existing.has(item.title)) continue;

                    // Auto-categorize based on headline keywords
                    const cat = /ASML|EUV|DUV|lithograph/i.test(item.title) ? 'lithography'
                        : /foundry|TSMC|Samsung.{0,6}fab|Intel.{0,6}fab|wafer|node|nanometer|\dnm/i.test(item.title) ? 'foundry'
                        : /HBM|CoWoS|packaging|memory|DRAM|NAND|shortage/i.test(item.title) ? 'bottleneck'
                        : 'accelerator';

                    const entry = {
                        headline: item.title,
                        url: item.link,
                        source: feed.source,
                        category: cat,
                        date: item.pubDate?.split(' ')[0] || item.pubDate?.split('T')[0] || ''
                    };

                    this.supplyChainNews.unshift(entry);
                    existing.add(item.title);

                    // Persist via the server-side write gate (fire-and-forget)
                    if (this.supabase) {
                        this._cloudSubmit('supply_chain', {
                            category: cat,
                            title: entry.headline.substring(0, 200),
                            detail: entry.source,
                            source_url: entry.url
                        });
                    }
                }
            } catch (e) { console.warn(`[Supply Chain RSS] ${feed.source}:`, e.message); }
        }

        this.supplyChainNews = this.supplyChainNews.slice(0, 25);

        // supplyChainNews refreshed — UI picks up changes on next tick
    },

    // ═══ AI EVENTS CALENDAR — auto-populate from tech event RSS feeds ═══
    async fetchAIEvents() {
        const feeds = [
            { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
            { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        ];

        // Keywords that indicate an event/conference/summit (not just news articles)
        const eventKeywords = /\b(conference|summit|workshop|hackathon|symposium|keynote|demo day|launch event|developer day|devday|I\/O|Build|WWDC|re:Invent|Ignite|Connect|NeurIPS|ICML|ICLR|CVPR|AAAI|SIGMOD|KDD|NAACL|ACL|EMNLP|CoRL|RSS\b|IJCAI|ECCV|ICCV|WSDM|GTC|Microsoft Build|Google I\/O|Apple WWDC|AWS re:Invent|Dreamforce|CES\s+\d{4}|MWC\s+\d{4})\b/i;

        const existing = new Set((window.AI_EVENTS || []).map(e => e.name));
        let added = 0;

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const json = await r.json();
                if (!json.items) continue;

                for (const item of json.items) {
                    if (!eventKeywords.test(item.title)) continue;
                    const name = item.title.replace(/<[^>]*>/g, '').trim();
                    if (existing.has(name) || name.length > 120) continue;

                    // Try to extract a date from the item
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                    // For event announcements, the event itself is usually in the future
                    // Use publication date as fallback — if it mentions a specific date in the title, prefer that
                    const dateMatch = item.title.match(/(\w+ \d{1,2}(?:[-–]\d{1,2})?,?\s*\d{4})/);
                    let eventDate = pubDate;
                    if (dateMatch) {
                        const parsed = new Date(dateMatch[1].replace(/[-–]\d{1,2}/, ''));
                        if (!isNaN(parsed.getTime())) eventDate = parsed;
                    }

                    const desc = (item.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
                    const ev = {
                        name,
                        date: eventDate.toISOString().split('T')[0],
                        desc: desc || `Via ${feed.source}`,
                        type: 'conference'
                    };

                    if (!window.AI_EVENTS) window.AI_EVENTS = [];
                    window.AI_EVENTS.push(ev);
                    existing.add(name);
                    added++;

                    // Persist via the server-side write gate
                    if (this.supabase) {
                        this._cloudSubmit('ai_events', ev);
                    }
                }
            } catch (e) { /* silent — RSS feeds sometimes fail */ }
        }

        // Also use the LLM scan to ask for upcoming events if API key is set
        if (added === 0 && G.authKey && this._chatHistory !== undefined) {
            await this._fetchEventsFromLLM();
        }

        if (added > 0) {

            if (typeof UI !== 'undefined') UI.addToast(`📅 Found ${added} new AI events!`);
        }
    },

    async _fetchEventsFromLLM() {
        if (!G.authKey) return;
        try {
            // Window derived from today's date — a frozen range once asked the
            // model for events "for the remainder of 2025" in mid-2026.
            const evToday = new Date().toISOString().split('T')[0];
            const evHorizon = new Date(Date.now() + 240 * 86400000).toISOString().split('T')[0];
            const prompt = `Today is ${evToday}. List 15 major upcoming AI/ML conferences, summits, and tech events between ${evToday} and ${evHorizon}. Include real events only with accurate dates. Return ONLY a JSON array, no other text. Format: [{"name":"Event Name","date":"YYYY-MM-DD","desc":"Short description","type":"conference"}]`;
            let url, hd = { 'Content-Type': 'application/json' }, pl;

            if (G.apiProvider === 'anthropic') {
                url = 'https://api.anthropic.com/v1/messages';
                hd['x-api-key'] = G.authKey; hd['anthropic-version'] = '2023-06-01'; hd['anthropic-dangerously-allow-browser'] = 'true';
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.anthropic, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            } else if (G.apiProvider === 'google') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || PROVIDER_DEFAULT_MODELS.google}:generateContent?key=${G.authKey}`;
                pl = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } };
            } else if (G.apiProvider === 'xai') {
                url = 'https://api.x.ai/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.xai, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            } else {
                url = 'https://api.openai.com/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.openai, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            }

            const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(60000) });
            const d = await r.json();

            let txt = '';
            if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || '';
            else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            else txt = d.choices?.[0]?.message?.content || '';

            // Extract JSON array from response
            const match = txt.match(/\[[\s\S]*\]/);
            if (!match) return;
            const events = JSON.parse(match[0]);
            const existing = new Set((window.AI_EVENTS || []).map(e => e.name));
            let added = 0;

            for (const ev of events) {
                if (!ev.name || !ev.date || existing.has(ev.name)) continue;
                if (!window.AI_EVENTS) window.AI_EVENTS = [];
                window.AI_EVENTS.push(ev);
                existing.add(ev.name);
                added++;
                if (this.supabase) {
                    this._cloudSubmit('ai_events', ev);
                }
            }

            if (added > 0) {

                if (typeof UI !== 'undefined') UI.addToast(`📅 Discovered ${added} upcoming AI events!`);
            }
        } catch (e) { console.warn('[Calendar LLM]', e.message); }
    },

    // ═══ NEW DATA CENTERS — LLM scan for real-world facilities not yet on the map ═══
    _dcScanning: false,
    async fetchNewDataCenters() {
        if (this._dcScanning || !G.authKey || typeof DC_FACILITIES === 'undefined' || typeof DCManager === 'undefined') return;
        this._dcScanning = true;
        try {
            const existingIds = DC_FACILITIES.map(dc => dc.id).join(', ');
            const existingNames = DC_FACILITIES.map(dc => `${dc.name} (${dc.operator})`).join('; ');
            const today = new Date().toISOString().split('T')[0];

            const prompt = `You are a real-time AI infrastructure data API. Find up to 3 REAL data centers or chip fabrication plants that are NOT already in our database.

TODAY IS ${today}. Prioritize facilities that came online or broke ground in the last 12 months (e.g. xAI Colossus 2, new Meta / Microsoft / Google / AWS / Oracle / CoreWeave mega-sites, new TSMC / Samsung / Intel fabs).

EXISTING FACILITY IDs (do NOT duplicate): ${existingIds}
EXISTING FACILITY NAMES: ${existingNames}

CRITICAL ACCURACY RULES — VIOLATIONS WILL CORRUPT A PUBLIC DATABASE:
1. ONLY return facilities that have been OFFICIALLY ANNOUNCED with a public press release, earnings call, or verifiable news coverage.
2. Do NOT invent, extrapolate, or speculate. If unsure about any field, SKIP that facility entirely.
3. "status" must be "operational" (running today), "construction" (announced but not online), or "planned".
4. "type" must be "datacenter" or "chipfab".
5. "operator" should be a lowercase lab/company id: google, microsoft, amazon, meta, xai, oracle, coreweave, tsmc, samsung, intel, asml, nvidia, apple, anthropic, openai, tesla, etc.
6. "completion" is a 4-digit year string like "2026" or "2028" for construction/planned (omit for operational).
7. "power_mw" and "gpus" should be numbers/strings with real figures. If unknown, use null.
8. "id" must be a new, unique, lowercase_snake_case string starting with "dc_" for datacenters or "fab_" for chipfabs.

Respond with ONLY minified JSON, no markdown:
{"facilities":[{"id":"dc_example","name":"Example DC","operator":"google","location":"City, State/Country","type":"datacenter","status":"operational","gpus":"50,000 H200","power_mw":400,"cooling":"Liquid cooling","desc":"One-sentence summary.","completion":null,"color":"#4285f4"}]}`;

            let url, hd = { 'Content-Type': 'application/json' }, pl;

            if (G.apiProvider === 'anthropic') {
                url = 'https://api.anthropic.com/v1/messages';
                hd['x-api-key'] = G.authKey; hd['anthropic-version'] = '2023-06-01'; hd['anthropic-dangerously-allow-browser'] = 'true';
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.anthropic, max_tokens: 2048, system: `You are a real-time AI infrastructure data API. Respond strictly in minified JSON. Today is ${today}. Only return facilities you are certain exist in the real world.`, messages: [{ role: 'user', content: prompt }] };
            } else if (G.apiProvider === 'google') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || PROVIDER_DEFAULT_MODELS.google}:generateContent?key=${G.authKey}`;
                pl = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' } };
            } else if (G.apiProvider === 'xai') {
                url = 'https://api.x.ai/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.xai, temperature: 0.1, max_tokens: 2048, messages: [{ role: 'system', content: `You are a real-time AI infrastructure data API. Today is ${today}. Respond strictly in minified JSON. Only return facilities that are real.` }, { role: 'user', content: prompt }] };
            } else {
                url = 'https://api.openai.com/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.openai, temperature: 0.1, max_tokens: 2048, messages: [{ role: 'system', content: `You are a real-time AI infrastructure data API. Today is ${today}. Respond strictly in minified JSON. Only return facilities that are real.` }, { role: 'user', content: prompt }] };
            }

            const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(60000) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const d = await r.json();

            let txt = '';
            if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || '';
            else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            else txt = d.choices?.[0]?.message?.content || '';

            const match = txt.match(/\{[\s\S]*\}/);
            if (!match) return;
            const parsed = JSON.parse(match[0]);
            if (!parsed.facilities || !Array.isArray(parsed.facilities)) return;

            let added = 0;
            for (const f of parsed.facilities) {
                if (!f.id || !f.name || !f.operator) continue;
                const safeId = String(f.id).toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (!safeId.startsWith('dc_') && !safeId.startsWith('fab_')) continue;
                if (DC_FACILITIES.find(dc => dc.id === safeId)) continue;

                const facility = {
                    id: safeId,
                    name: String(f.name).slice(0, 80),
                    operator: String(f.operator).toLowerCase().replace(/[^a-z0-9_]/g, ''),
                    location: f.location ? String(f.location).slice(0, 80) : 'Undisclosed',
                    type: f.type === 'chipfab' ? 'chipfab' : 'datacenter',
                    status: ['operational', 'construction', 'planned'].includes(f.status) ? f.status : 'operational',
                    gpus: f.gpus || null,
                    power_mw: typeof f.power_mw === 'number' ? f.power_mw : null,
                    cooling: f.cooling || null,
                    process: f.process || null,
                    products: f.products || null,
                    investment: f.investment || null,
                    completion: f.completion ? String(f.completion).slice(0, 10) : null,
                    desc: f.desc ? String(f.desc).slice(0, 240) : `${f.name} — discovered via network scan.`,
                    w: f.type === 'chipfab' ? 170 : 160,
                    color: typeof f.color === 'string' && /^#[0-9a-f]{6}$/i.test(f.color) ? f.color : '#64748b'
                };

                if (DCManager.addFacility(facility)) added++;
            }

            if (added > 0 && typeof UI !== 'undefined') {
                UI.addLog(`🛰️ Discovered ${added} new compute facility${added === 1 ? '' : 'ies'}!`);
                if (typeof NOTIFY !== 'undefined') NOTIFY.send('New Compute!', `${added} new data center${added === 1 ? '' : 's'} on the map`);
            }
        } catch (e) {
            console.warn('[DC Scan]', e.message);
        } finally {
            this._dcScanning = false;
        }
    },

    // ═══ NETWORK STATUS — cloud provider incidents + internet health for The Backbone ═══
    async fetchNetworkStatus() {
        const feeds = [
            { url: 'https://status.aws.amazon.com/rss/all.rss', source: 'AWS' },
            { url: 'https://status.cloud.google.com/feed.atom', source: 'Google Cloud' },
        ];

        const incidents = [];

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                d.items.slice(0, 5).forEach(item => {
                    const isMajor = /outage|degraded|disruption|emergency/i.test(item.title);
                    const isMinor = /elevated|latency|intermittent|delay/i.test(item.title);
                    incidents.push({
                        headline: `${feed.source}: ${item.title}`,
                        severity: isMajor ? 'major' : isMinor ? 'minor' : 'info',
                        url: item.link,
                        date: item.pubDate?.split(' ')[0] || ''
                    });
                });
            } catch (e) { /* silent — status feeds sometimes fail */ }
        }

        if (incidents.length > 0 && typeof BackboneZone !== 'undefined') {
            BackboneZone.cloudStatus = incidents;
            BackboneZone._buildTicker();

        }
    },

    // ═══ GLOBAL POWER GRID — Supabase (auto-refreshed weekly) + static fallback ═══
    _gridData: null,
    _gridTs: 0,

    async fetchGlobalGrid() {
        // Skip if already fetched this session (data changes slowly)
        if (this._gridData && (Date.now() - this._gridTs) < 6 * 3600 * 1000) return;



        // Try Supabase first (auto-refreshed weekly by scheduled function)
        try {
            const sbUrl = G.supabaseUrl;
            const sbKey = G.supabaseKey;
            if (sbUrl && sbKey) {
                const r = await fetch(
                    `${sbUrl}/rest/v1/grid_data?id=eq.global&select=data,updated_at`,
                    { headers: { 'apikey': sbKey }, signal: AbortSignal.timeout(8000) }
                );
                if (r.ok) {
                    const rows = await r.json();
                    if (rows.length > 0 && rows[0].data) {
                        this._gridData = rows[0].data;
                        this._gridData._updatedAt = rows[0].updated_at;
                        this._gridTs = Date.now();

                        if (typeof UI !== 'undefined') UI.addLog(`⚡ Grid: ${this._gridData.plantCount.toLocaleString()} plants across ${this._gridData.regionsScanned} regions (live data)`);
                        return;
                    }
                }
            }
        } catch (_e) { /* fall through to static */ }

        // Fallback: static bundled dataset
        try {
            const r = await fetch('/data/global-grid.json', { signal: AbortSignal.timeout(10000) });
            if (!r.ok) throw new Error('http-' + r.status);
            this._gridData = await r.json();
            this._gridTs = Date.now();

            if (typeof UI !== 'undefined') UI.addLog(`⚡ Grid: ${this._gridData.plantCount.toLocaleString()} power plants across ${this._gridData.regionsScanned} regions`);
        } catch (e) {
            console.debug('⚡ Grid data load failed:', e.message);
        }
    },

    _chatHistory: [],

    _mdToHtml(md) {
        return md
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;overflow-x:auto;font-size:8px;margin:6px 0;border:1px solid var(--bd)"><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;font-size:8px">$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.+?)\*/g, '<i>$1</i>')
            .replace(/^### (.+)$/gm, '<div style="font-size:10px;font-weight:bold;color:var(--ac);margin:8px 0 4px">$1</div>')
            .replace(/^## (.+)$/gm, '<div style="font-size:11px;font-weight:bold;color:var(--cy);margin:8px 0 4px">$1</div>')
            .replace(/^# (.+)$/gm, '<div style="font-size:12px;font-weight:bold;color:#fff;margin:8px 0 4px">$1</div>')
            .replace(/^[-*] (.+)$/gm, '<div style="padding-left:12px">• $1</div>')
            .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:12px">$&</div>')
            .replace(/\n{2,}/g, '<br><br>')
            .replace(/\n/g, '<br>');
    },

    async askAnalyst() {
      const input = document.getElementById('analystInput');
      if (!input) return;
      const q = input.value.trim();
      if (!q) return;
      if (!G.authKey) { if(typeof UI !== 'undefined') UI.addToast('❌ Set API key in Settings first.'); return; }

      const safeQ = q.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const chat = document.getElementById('analystChat');
      if (!chat) return;

      // Clear welcome message on first use
      if (this._chatHistory.length === 0) chat.innerHTML = '';

      chat.innerHTML += `<div style="text-align:right;margin-bottom:10px"><span style="background:var(--ac);color:#000;padding:6px 12px;border-radius:12px 12px 2px 12px;font-size:9px;display:inline-block;max-width:80%;line-height:1.5">${safeQ}</span></div>`;
      chat.innerHTML += `<div id="aL" style="font-size:9px;color:var(--cy);padding:8px">Thinking...</div>`;
      input.value = '';
      chat.scrollTop = chat.scrollHeight;

      // Add to conversation history
      this._chatHistory.push({ role: 'user', content: q });

      // System prompt with live city context
      const sysPrompt = `You are a helpful AI assistant embedded in Singularity City — a real-time simulation of the AI industry. You can answer any question the user asks, on any topic. You have access to some live city data for context but you are not limited to discussing it. Be conversational and helpful. Current city data: ${G.models ? G.models.length : 0} AI models tracked across ${Object.keys(LABS || {}).length} labs.`;

      try {
        let url, hd = { 'Content-Type': 'application/json' }, pl;

        if (G.apiProvider === 'anthropic') {
          url = 'https://api.anthropic.com/v1/messages';
          hd['x-api-key'] = G.authKey;
          hd['anthropic-version'] = '2023-06-01';
          hd['anthropic-dangerously-allow-browser'] = 'true';
          pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.anthropic, max_tokens: 4096, system: sysPrompt, messages: this._chatHistory };
        } else if (G.apiProvider === 'google') {
          url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || PROVIDER_DEFAULT_MODELS.google}:generateContent?key=${G.authKey}`;
          const contents = this._chatHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
          pl = { systemInstruction: { parts: [{ text: sysPrompt }] }, contents, generationConfig: { maxOutputTokens: 4096 } };
        } else if (G.apiProvider === 'xai') {
          url = 'https://api.x.ai/v1/chat/completions';
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.xai, max_tokens: 4096, messages: [{ role: 'system', content: sysPrompt }, ...this._chatHistory] };
        } else {
          url = 'https://api.openai.com/v1/chat/completions';
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.openai, max_tokens: 4096, messages: [{ role: 'system', content: sysPrompt }, ...this._chatHistory] };
        }

        const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(60000) });
        const d = await r.json();

        let txt = '';
        if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || d.error?.message || 'No response';
        else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || d.error?.message || 'No response';
        else txt = d.choices?.[0]?.message?.content || d.error?.message || 'No response';

        // Add assistant response to history
        this._chatHistory.push({ role: 'assistant', content: txt });

        const rendered = this._mdToHtml(txt);
        document.getElementById('aL')?.remove();
        chat.innerHTML += `<div style="margin-bottom:10px"><div style="background:var(--sf);border:1px solid var(--bd);padding:10px 14px;border-radius:2px 12px 12px 12px;font-size:9px;display:inline-block;color:var(--t2);line-height:1.7;max-width:90%">${rendered}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
      } catch(e) {
        // Remove failed message from history
        this._chatHistory.pop();
        const l = document.getElementById('aL');
        if (l) l.innerHTML = `<span style="color:#ef4444">❌ ${e.message.includes('Failed to fetch') ? 'Network error — check your connection and try again.' : e.message}</span>`;
      }
    },
  
    // ═══════════════════════════════════════════════════════════════
    //   MODEL VERIFICATION — Reject hallucinated/impossible models
    // ═══════════════════════════════════════════════════════════════

    // Floor version caps per model family — auto-raised by _buildVerifiedRegistry()
    // from live ZeroEval/HuggingFace data. These are the minimum known maxes.
    // ANY model name containing one of these families MUST have its version within cap+0.5.
    // ANY model name NOT containing one of these families is rejected unless it's in the
    // explicit knownReal registry or came from a trusted source (zeroeval/huggingface).
    // KEEP IN SYNC with netlify/functions/_shared/model-verify.mjs — that copy is
    // the authoritative server-side gate (db-maintenance purge + submit-data
    // writes); this copy only filters the LOCAL display list. Tune both together.
    _maxKnownVersions: {
        // Western
        'gemini': 3.1, 'gemma': 3, 'gpt': 5.4, 'claude': 4.6, 'llama': 4,
        'grok': 4.3, 'phi': 4, 'palm': 2, 'bard': 1, 'codellama': 1,
        'mistral': 3, 'mixtral': 2, 'codestral': 1, 'ministral': 3, 'pixtral': 1, 'devstral': 1.5,
        'mathstral': 1, 'magistral': 2,
        'command': 2, 'nova': 2, 'titan': 1, 'nemotron': 4,
        // Asian
        'deepseek': 3.2, 'qwen': 3.5, 'qwq': 3,
        'yi': 2, 'ernie': 5, 'glm': 5, 'chatglm': 4,
        'kimi': 2.5, 'moonshot': 1, 'minimax': 2.5, 'doubao': 2,
        'hunyuan': 4, 'step': 3.5, 'baichuan': 2,
        'internlm': 3, 'internvl': 3,
        // Open / specialty
        'falcon': 3, 'jais': 2, 'olmo': 2, 'olmoe': 1, 'tulu': 3, 'granite': 4, 'smollm': 3,
        'bloom': 1, 'bloomz': 1, 'starling': 1, 'vicuna': 1, 'wizard': 2, 'orca': 2,
        'dbrx': 1, 'hermes': 4, 'aya': 2, 'snowflake': 2, 'openelm': 1,
        'starcoder': 2, 'mpt': 1, 'pythia': 1, 'jamba': 2, 'stablelm': 3,
        'minicpm': 4, 'llava': 2, 'lfm': 2, 'dolphin': 3, 'nvlm': 1, 'arctic': 2
    },

    // Closed-weight frontier families NEVER appear on HuggingFace and lag weeks on
    // OpenRouter/ZeroEval, so the _autoDetectVersionCaps auto-heal path is structurally
    // broken for them — a genuinely-released new flagship (e.g. GPT-5.5 right after
    // GPT-5.4) gets rejected until an aggregator catches up. For these families we
    // allow a bounded forward step above the floor: real incremental releases pass,
    // but absurd hallucinations ("GPT-9", "Claude 8") are still rejected.
    _frontierForwardTolerance: {
        'gpt': 1.0, 'claude': 1.0, 'gemini': 1.0, 'grok': 1.0
    },

    // Open-weight families were previously STRICT (tol 0) on the assumption they
    // "self-heal from HF/OpenRouter within hours". In practice the Chinese open
    // labs (glm/minimax/qwen/deepseek/kimi/hunyuan/step/…) lag the Western
    // aggregators too, so brand-new real releases (e.g. GLM 5.1 when the floor is
    // 5, Devstral 2 when the floor is 1.5) get filtered AND eventually purged
    // before the cap auto-raises. A smaller forward step than the frontier closes
    // that gap: a real X.1/X.5 increment passes, but a full jump (GLM 7, Qwen 6)
    // is still rejected as a hallucination until an aggregator confirms it. This
    // is NOT a frozen ceiling — _maxKnownVersions still auto-raises from live data.
    _openWeightForwardTolerance: 0.5,

    // Family → known producing lab(s). Used to validate that "Cohere Command R+" really
    // is a Cohere model (lab matches family) vs a Nous-Hermes finetune of Llama (lab mismatch).
    _familyToLab: {
        'gpt': ['openai'], 'claude': ['anthropic'],
        'gemini': ['google'], 'gemma': ['google'], 'palm': ['google'], 'bard': ['google'],
        'llama': ['meta'], 'codellama': ['meta'], 'openelm': ['apple'],
        'grok': ['xai'],
        'phi': ['microsoft'],
        'mistral': ['mistral'], 'mixtral': ['mistral'], 'pixtral': ['mistral'],
        'codestral': ['mistral'], 'ministral': ['mistral'], 'devstral': ['mistral'],
        'mathstral': ['mistral'], 'magistral': ['mistral'],
        'deepseek': ['deepseek'],
        'qwen': ['alibaba'], 'qwq': ['alibaba'],
        'ernie': ['baidu'],
        'glm': ['zhipu_ai', 'zhipu', 'thudm'], 'chatglm': ['zhipu_ai', 'zhipu', 'thudm'],
        'command': ['cohere'], 'aya': ['cohere', 'cohereforai'],
        'nova': ['amazon'], 'titan': ['amazon'],
        'nemotron': ['nvidia'], 'nvlm': ['nvidia'],
        'yi': ['zerooneai', '01_ai', '01ai'],
        'kimi': ['moonshot'], 'moonshot': ['moonshot'],
        'minimax': ['minimax'],
        'doubao': ['bytedance'],
        'hunyuan': ['tencent'],
        'step': ['stepfun'],
        'baichuan': ['baichuan'],
        'internlm': ['shanghai_ai_lab'], 'internvl': ['shanghai_ai_lab'],
        'falcon': ['tii'], 'jais': ['inception'],
        'olmo': ['allen_ai', 'allenai'], 'olmoe': ['allen_ai', 'allenai'],
        'tulu': ['allen_ai', 'allenai'],
        'granite': ['ibm'], 'smollm': ['huggingface', 'huggingfaceh4'],
        'bloom': ['bigscience'], 'bloomz': ['bigscience'],
        'dbrx': ['databricks'],
        'hermes': ['nous', 'nousresearch'],
        'snowflake': ['snowflake'], 'arctic': ['snowflake'],
        'starcoder': ['bigcode', 'huggingface'],
        'mpt': ['mosaicml', 'databricks'],
        'pythia': ['eleutherai'],
        'jamba': ['ai21', 'ai21labs'],
        'stablelm': ['stabilityai', 'stability_ai'],
        'minicpm': ['openbmb'],
        'llava': ['llava', 'haotianliu'],
        'lfm': ['liquid', 'liquidai'],
        'dolphin': ['cognitivecomputations']
    },

    // Helper: scan name for the highest version number near a family token.
    // Strips date patterns first so dates like "08-2024" don't get parsed as version 8.
    // Returns { found: bool, max: number|null }.
    _extractVersionNear(name, family) {
        // Find family token (must be word-boundary delimited so "gpt" doesn't match "gptq")
        const famRegex = new RegExp(`(?:^|[\\s\\-_])${family}(?:[\\s\\-_]|\\d|$)`, 'i');
        const fm = name.match(famRegex);
        if (!fm) return { found: false };
        const idx = name.indexOf(fm[0]);
        let window = name.substring(idx, idx + 50);
        // Strip date patterns FIRST so they don't get misread as version numbers.
        // Use [-_/] (NOT dot) to preserve "2.5" / "3.1" decimal versions.
        window = window.replace(/\d{4}[-_/]\d{1,2}[-_/]\d{1,2}/g, ' '); // 2024-08-15
        window = window.replace(/\d{1,2}[-_/]\d{1,2}[-_/]\d{4}/g, ' '); // 08-15-2024
        window = window.replace(/\d{1,2}[-_/]\d{4}/g, ' ');              // 08-2024
        window = window.replace(/\d{4}[-_/]\d{1,2}/g, ' ');              // 2024-08
        window = window.replace(/\d{1,2}[-_/]\d{1,2}/g, ' ');            // 03-25 / 08_15 short date
        window = window.replace(/\(\s*\d{6,}\s*\)/g, ' ');                // (20240227)
        window = window.replace(/\b\d{6,}\b/g, ' ');                      // 20240227
        // Strip MoE expert notation: "8x7b", "8x22b", "16x6.7b" (Mixtral, etc.)
        window = window.replace(/\d+x\d+(?:\.\d+)?b\b/gi, ' ');
        // Strip dimension/size notation: "1.5b", "3b", "70b", "405b" (parameter counts)
        window = window.replace(/\d+(?:\.\d+)?b\b/gi, ' ');
        // Strip context lengths: "32k", "128k", "1m"
        window = window.replace(/\d+(?:\.\d+)?[km]\b/gi, ' ');
        // Strip quantization format codes: "fp4", "fp8", "fp16", "int4", "int8",
        // "nvfp4" (NVIDIA), "q4", "q8", "bf16", "gptq", "awq" — these are not versions
        window = window.replace(/\b(?:nv)?fp\d+\b/gi, ' ');
        window = window.replace(/\bint\d+\b/gi, ' ');
        window = window.replace(/\bbf\d+\b/gi, ' ');
        window = window.replace(/\bq\d+(?:_\w+)?\b/gi, ' ');
        // Match all remaining version-like numbers
        const matches = [...window.matchAll(/(\d+(?:\.\d+)?)([a-z]?)/g)];
        let max = -1;
        for (const mm of matches) {
            const ver = parseFloat(mm[1]);
            const suffix = (mm[2] || '').toLowerCase();
            // Skip parameter counts (7b, 70b, 405b)
            if (suffix === 'b') continue;
            // Skip residual date codes / token counts
            if (ver >= 100) continue;
            if (ver > max) max = ver;
        }
        return { found: true, max: max < 0 ? null : max };
    },

    // Phrase blacklist — telltale hallucination markers. Reject any model whose name
    // contains these regardless of family/version. Used in step 2.5 of _verifyModel.
    _hallucinationPhrases: [
        'rumored', 'leaked', 'speculated', 'speculation', 'predicted',
        'next gen', 'next-gen', 'next generation',
        'in training', 'in-training', 'in development',
        'upcoming', 'unreleased', 'forthcoming',
        'allegedly', 'reportedly', 'expected',
        'future model', 'will release', 'planned for',
        '(beta upcoming)', '(early)', 'pre-release'
    ],

    // Specific known-fake patterns — narrow regexes for combinations that DON'T exist
    // even though their components are real (e.g. "Gemini Ultra 2", "Gemini 1.5 Ultra").
    _knownFakePatterns: [
        // Gemini Ultra was 1.0 only — no 2, no 1.5 Ultra
        /gemini\s*ultra\s*[2-9]/i,
        /gemini\s*[2-9](?:\.\d+)?\s*ultra/i,
        /gemini\s*1\.5\s*ultra/i,
        // Claude rumored variants
        /claude\s+\d+\s+opus\s+[2-9]/i, // "Claude 3 Opus 2"
        /claude\s+\d+\s+sonnet\s+[2-9]/i,
        /claude\s+\d+\s+haiku\s+[2-9]/i,
        // GPT codename hallucinations (allow dash between gpt and version)
        /gpt[\s-]*[5-9][\s-]*\(orion\s*[2-9]/i,
        /gpt[\s-]*[5-9][\s-]*\(strawberry\s*[2-9]/i, // Strawberry was o1 codename
        /gpt[\s-]*[6-9](?!\.\d)/i // Bare GPT-6/7/8/9 without decimal (extra safety)
    ],

    _verifyModel(m) {
        // Returns { ok: true } or { ok: false, reason: "..." }
        if (!m.name || !m.lab) return { ok: false, reason: 'Missing name or lab' };

        const name = m.name.toLowerCase();
        const today = new Date().toISOString().split('T')[0];
        const relDate = m.released || m.rel; // Handle both DB and local formats

        // 1. Reject future release dates
        if (relDate && relDate > today) {
            return { ok: false, reason: `Future release date: ${relDate}` };
        }

        // 2. Reject impossibly old release dates for new models
        if (relDate && relDate < '2017-01-01') {
            return { ok: false, reason: `Implausibly old release date: ${relDate}` };
        }

        // 2.5. Reject hallucination phrase markers ("(Rumored)", "(In-Training)", etc.)
        // These run BEFORE family/lab bypass so even Gemini-from-Google can't slip through.
        for (const phrase of this._hallucinationPhrases) {
            if (name.includes(phrase)) {
                return { ok: false, reason: `Hallucination marker: "${phrase}"` };
            }
        }

        // 2.6. Reject known fake combinations (e.g. "Gemini Ultra 2", "Claude 3 Opus 2")
        for (const pat of this._knownFakePatterns) {
            if (pat.test(name)) {
                return { ok: false, reason: `Known fake pattern: ${pat.source}` };
            }
        }

        // 2.7. Trusted-name fast path — if normalized name (or substring) is in knownReal
        // registry, accept immediately. This protects naming-convention quirks like
        // "Aya 23" (where 23 is the model name suffix, not a version) from being killed
        // by the strict version cap check below.
        if (this._verifiedModelNames && this._verifiedModelNames.size > 0) {
            const normName = name.replace(/[^a-z0-9]/g, '');
            if (this._verifiedModelNames.has(normName)) return { ok: true };
            // Bidirectional containment with length floor 5 (curated registry, lower floor OK)
            for (const v of this._verifiedModelNames) {
                if (v.length >= 5 && (normName.includes(v) || (normName.length >= 5 && v.includes(normName)))) {
                    return { ok: true };
                }
            }
        }

        // 3. Check version numbers against known maximums.
        // This is the PRIMARY hallucination defense — uses flexible token-based matching
        // so "Claude Opus 7.5" gets caught (version after a word) and "Cohere Command R+ 08-2024"
        // doesn't (the date is filtered as a date code, not a version).
        // Open-weight families: STRICT, no buffer (they auto-raise from ZeroEval/
        // HuggingFace within hours via _autoDetectVersionCaps). Closed frontier
        // families (gpt/claude/gemini/grok) get a bounded forward tolerance because
        // their auto-heal path is structurally broken — see _frontierForwardTolerance.
        let detectedFamily = null;
        for (const [family, maxVer] of Object.entries(this._maxKnownVersions)) {
            const result = this._extractVersionNear(name, family);
            if (!result.found) continue;
            detectedFamily = family;
            const tol = this._frontierForwardTolerance[family] != null
                ? this._frontierForwardTolerance[family]
                : this._openWeightForwardTolerance;
            if (result.max != null && result.max > maxVer + tol) {
                return { ok: false, reason: `Version ${result.max} exceeds max known ${family} version ${maxVer}${tol ? ` (+${tol} forward tolerance)` : ''}` };
            }
        }

        // 4. Reject benchmark scores that are impossible (>100 for percentage-based)
        if (m.benchmarks) {
            for (const [k, v] of Object.entries(m.benchmarks)) {
                if (k !== 'ELO' && (v > 100 || v < 0)) {
                    return { ok: false, reason: `Impossible benchmark ${k}=${v}` };
                }
                if (k === 'ELO' && (v < 500 || v > 2500)) {
                    return { ok: false, reason: `Impossible ELO=${v}` };
                }
            }
        }

        // 5. Reject absurd pricing (>$1000 per 1M tokens)
        if (m.cost_input != null && m.cost_input > 1000) {
            return { ok: false, reason: `Absurd input pricing: $${m.cost_input}/1M` };
        }
        if (m.cost_out != null && m.cost_out > 1000) {
            return { ok: false, reason: `Absurd output pricing: $${m.cost_out}/1M` };
        }

        // 6. Cross-reference against verified sources (ZeroEval + HuggingFace + knownReal).
        // Trusted sources are always allowed.
        // If a known family was detected, accept ONLY if the family appears at the start
        // of the name OR the model's lab matches the family's expected lab. This rejects
        // finetune-style names like "Hermes 9 Llama" (Llama detected mid-name, lab=nous, not meta).
        const trustedSrc = m._src === 'zeroeval' || m._src === 'huggingface' || m._src === 'openrouter';
        if (trustedSrc) return { ok: true };

        if (detectedFamily) {
            const famAtStart = name.startsWith(detectedFamily);
            const expectedLabs = this._familyToLab[detectedFamily] || [];
            const labMatch = m.lab && expectedLabs.some(l =>
                String(m.lab).toLowerCase().replace(/[^a-z0-9]/g, '').includes(l.replace(/[^a-z0-9]/g, ''))
            );
            if (famAtStart || labMatch) return { ok: true };
            // Family detected mid-name with mismatched lab → fall through to registry check
        }

        // No recognized family (or mismatched lab) — must be in registry by name.
        if (this._verifiedModelNames && this._verifiedModelNames.size > 0) {
            const normName = name.replace(/[^a-z0-9]/g, '');
            const fuzzyName = normName.replace(/\d{6,}/g, '').replace(/\d+$/, '');
            let isVerified = this._verifiedModelNames.has(normName) || this._verifiedModelNames.has(fuzzyName);
            if (!isVerified) {
                // Bidirectional containment with length floor 7 (handles lab-prefixed/date-suffixed names)
                for (const v of this._verifiedModelNames) {
                    if (v.length >= 7 && (normName.includes(v) || (normName.length >= 7 && v.includes(normName)))) {
                        isVerified = true;
                        break;
                    }
                }
            }
            if (!isVerified) {
                return { ok: false, reason: `Unknown family + not in registry (likely hallucinated): ${m.name}` };
            }
        }

        return { ok: true };
    },

    // Build verified model registry from ZeroEval and HuggingFace data
    _buildVerifiedRegistry() {
        this._verifiedModelNames = new Set();
        // Add all models already in G.models that came from trusted sources
        for (const m of G.models) {
            if (m._src === 'zeroeval' || m._src === 'huggingface' || m._src === 'openrouter') {
                const norm = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                this._verifiedModelNames.add(norm);
            }
        }
        // Also add all flagship models we know are real (kept narrow — anything not here OR
        // not in ZeroEval/HuggingFace gets rejected as hallucinated)
        const knownReal = [
            // Anthropic
            'claude opus 4', 'claude opus 4.6', 'claude sonnet 4', 'claude sonnet 4.6',
            'claude haiku 4', 'claude haiku 4.5',
            'claude 3.5 sonnet', 'claude 3.5 haiku', 'claude 3 opus',
            'claude 3 sonnet', 'claude 3 haiku', 'claude 2', 'claude 2.1', 'claude instant',
            // OpenAI
            'gpt-4o', 'gpt-4o mini', 'gpt-4.1', 'gpt-4.1 mini', 'gpt-4.1 nano',
            'gpt-4', 'gpt-4 turbo', 'gpt-3.5 turbo', 'gpt-4-vision',
            'gpt-5', 'gpt-5 mini', 'gpt-5 nano', 'gpt-5.1', 'gpt-5.2', 'gpt-5.2 codex',
            'gpt-5.3 codex', 'gpt-5.3 codex spark', 'gpt-5.3 chat',
            'gpt-5.4', 'gpt-5.4 mini', 'gpt-5.4 nano',
            'o1', 'o1-mini', 'o1-pro', 'o1-preview', 'o3', 'o3-mini', 'o3-pro', 'o4-mini',
            // Google
            'gemini 2.5 pro', 'gemini 2.5 flash', 'gemini 2.5 flash lite',
            'gemini 2.0 flash', 'gemini 2.0 pro', 'gemini 2.0 flash lite',
            'gemini 1.5 pro', 'gemini 1.5 flash', 'gemini 1.0 pro', 'gemini nano',
            'gemini 3.1 pro', 'gemini 3.1 ultra', 'gemini 3.1 flash', 'gemini 3.1 flash lite',
            'gemma 3', 'gemma 2', 'gemma 7b', 'codegemma', 'recurrentgemma', 'palm 2',
            // xAI
            'grok 1', 'grok 2', 'grok 3', 'grok 3 mini', 'grok 4', 'grok 4 mini', 'grok 4.20', 'grok 4.3',
            // Meta
            'llama 4 scout', 'llama 4 maverick', 'llama 4 behemoth',
            'llama 3.3', 'llama 3.2', 'llama 3.1', 'llama 3', 'llama 2', 'codellama',
            // DeepSeek
            'deepseek-r1', 'deepseek r1', 'deepseek-v3', 'deepseek v3',
            'deepseek-v3.2', 'deepseek v3.2', 'deepseek-r2', 'deepseek r2',
            'deepseek coder', 'deepseek math', 'deepseek vl', 'deepseek prover',
            // Alibaba / Qwen
            'qwen3', 'qwen 3', 'qwen3.5', 'qwen 3.5', 'qwen2.5', 'qwen 2.5',
            'qwen2.5-max', 'qwen2.5 max', 'qwen2', 'qwq', 'qwq 32b',
            'qwen vl', 'qwen audio', 'qwen coder', 'qwen math',
            // Microsoft
            'phi-4', 'phi 4', 'phi-4-mini', 'phi 4 mini', 'phi-3', 'phi 3', 'phi-2',
            'phi-3.5', 'phi 3.5', 'phi silica',
            // Mistral
            'mistral 3', 'mistral large', 'mistral large 2', 'mistral large 3',
            'mistral medium', 'mistral medium 3',
            'mistral small', 'mistral small 3', 'mistral small 3.1', 'mistral small 3.2',
            'mistral nemo', 'mistral 7b',
            'mixtral 8x7b', 'mixtral 8x22b',
            'codestral', 'codestral 2501', 'codestral mamba',
            'ministral 3', 'ministral 3b', 'ministral 8b', 'ministral 14b',
            'ministral 3 14b', 'ministral 3 8b', 'ministral 3 3b',
            'pixtral', 'pixtral 12b', 'pixtral large',
            'devstral small', 'devstral medium', 'devstral 1.1',
            'mathstral', 'mathstral 7b',
            'magistral', 'magistral small', 'magistral medium',
            // Cohere
            'command r+', 'command r', 'command a', 'command light',
            'aya 23', 'aya 23 8b', 'aya 23 35b', 'aya expanse', 'aya 8b', 'aya 35b',
            // Amazon
            'nova pro', 'nova premier', 'nova lite', 'nova micro', 'nova canvas', 'nova reel',
            'titan text express', 'titan text lite',
            // Nvidia
            'nemotron ultra', 'nemotron-4 340b', 'nemotron-4 340b instruct',
            'nemotron-4 15b', 'nemotron-4-mini-4b-instruct',
            'llama-3.1-nemotron-ultra', 'llama 3.1 nemotron ultra',
            'nvlm', 'nvlm-d', 'nvlm 1.0',
            // Chinese labs
            'yi-lightning', 'yi lightning', 'yi-large', 'yi 34b', 'yi 6b', 'yi vl',
            'ernie 4.5', 'ernie 4', 'ernie bot', 'ernie x1',
            'glm-4', 'glm 4', 'glm-4-plus', 'glm 4 plus', 'glm-4v', 'chatglm',
            'kimi k1', 'kimi k1.5', 'kimi k2', 'kimi k2 thinking', 'kimi k2.5', 'moonshot v1',
            'minimax-01', 'minimax abab', 'minimax m1', 'minimax m2', 'minimax m2.5',
            'doubao pro', 'doubao lite', 'doubao 1.5 pro',
            'hunyuan', 'hunyuan large', 'hunyuan turbo', 'hunyuan video', 'hunyuan dit',
            'step-1', 'step-2', 'step-3', 'step-3.5', 'step-3.5-flash',
            'step3', 'step3-vl', 'step3-vl-10b', 'step-1v', 'step-1.5v',
            'baichuan', 'baichuan2', 'baichuan 3', 'baichuan 4',
            'internlm', 'internlm 2', 'internlm 2.5', 'internlm xcomposer',
            'internvl', 'internvl 2', 'internvl 2.5',
            // Open / specialty
            'falcon 180b', 'falcon 40b', 'falcon 7b', 'falcon mamba', 'falcon 3',
            'jais 13b', 'jais 30b',
            'olmo 2', 'olmo', 'olmo 7b', 'olmoe', 'olmoe 1b 7b',
            'tulu 3', 'tulu 2',
            'granite 3', 'granite 3.1', 'granite 3.2', 'granite code', 'granite vision',
            'smollm', 'smollm2', 'smollm 3',
            'bloom', 'bloomz',
            'dbrx', 'dbrx instruct', 'dbrx base',
            'hermes 2', 'hermes 3', 'hermes 4', 'nous hermes',
            'snowflake arctic', 'snowflake arctic instruct', 'arctic',
            'openelm', 'openelm 270m', 'openelm 1.1b', 'openelm 3b',
            'starcoder', 'starcoder2', 'starcoder 15b', 'starcoder2 15b',
            'mpt', 'mpt-7b', 'mpt-30b',
            'pythia', 'pythia 12b',
            'jamba', 'jamba 1.5', 'jamba 1.5 large', 'jamba 1.5 mini',
            'stablelm', 'stablelm 2', 'stablelm zephyr', 'stable code',
            'minicpm', 'minicpm v', 'minicpm 2.6', 'minicpm 3', 'minicpm 4',
            'llava', 'llava 1.5', 'llava 1.6', 'llava next',
            'lfm', 'lfm 1.3b', 'lfm 3b', 'lfm 40b', 'lfm 2',
            'dolphin', 'dolphin 2.9', 'dolphin 3',
            'wizardlm', 'wizardmath', 'wizardcoder',
            'orca 2', 'orca mini',
            'vicuna 13b', 'vicuna 7b',
            'starling 7b', 'starling lm',
            // ─── Research / specialty / historical models ──────────────────
            // Google / DeepMind
            'alphacode', 'alphacode 2', 'alphageometry', 'alphaproof', 'alphafold',
            'chinchilla', 'chinchilla 70b', 'gopher', 'gopher 280b',
            'minerva', 'minerva 62b', 'lamda', 'glam', 'ul2', 't5', 't5 11b', 'flan-t5', 'mt5',
            'project astra', 'medgemma', 'medgemma 4b', 'med-gemini',
            // OpenAI historical
            'codex', 'whisper', 'instructgpt', 'text-davinci-002', 'text-davinci-003',
            'chatgpt', 'chatgpt-4o', 'chatgpt-4o latest',
            // Meta research
            'opt', 'opt-175b', 'opt-66b', 'opt-30b', 'opt 175b', 'opt 66b', 'opt 30b',
            'galactica', 'galactica 120b', 'segment anything', 'sam', 'sam 2',
            'musicgen', 'audiogen', 'incoder', 'incoder-6.7b',
            // Microsoft research
            'turing-nlg', 'turing-nlg 17b', 'megatron-turing nlg', 'mt-nlg', 'mt-nlg 530b',
            'megatron-turing nlg 530b', 'florence', 'florence-2', 'florence-2 large',
            'mai-1', 'apple ajax',
            // Apple
            'mm1', 'ferret-ui', 'personal voice', 'mgie', 'apple vision fm',
            // AI21
            'jurassic-1', 'jurassic-1 178b', 'jurassic-1 jumbo', 'jurassic-2', 'j1-jumbo',
            // Aleph Alpha
            'luminous base', 'luminous extended', 'luminous-extended', 'luminous-supra',
            'luminous supreme', 'luminous-large-v1-0', 'luminous world',
            'pharia 1', 'pharia 1 7b', 'pharia 1 pro', 'pharia 1 pro 7b', 'pharia pro 70b',
            // Stability
            'stable audio', 'stable audio open', 'stable audio 2',
            'stable diffusion', 'stable diffusion 3', 'stable diffusion 3 medium',
            'stable beluga', 'stable beluga 7b', 'stablebeluga 70b',
            'stable code', 'stable lm', 'stablelm zephyr',
            // Cerebras
            'cerebras-gpt', 'cerebras-gpt-13b', 'cerebras-gpt-6.7b', 'cerebras-gpt-2.7b',
            'condor galaxy',
            // Salesforce Research
            'codegen', 'codegen-16b-multi', 'codegen2.5-7b-multi',
            'codet5', 'codet5+', 'codet5+ 16b',
            'xgen', 'xgen large', 'xgen 2 large', 'xgen-mm', 'xgen-mm 9b', 'xgen-mm vl',
            'magicoder', 'magicoder evolution',
            // EPFL / medical
            'meditron', 'meditron-70b', 'meditron-70b-v2', 'med42', 'med42 70b',
            'decolm', 'decolm 6.7b',
            // Phind
            'phind', 'phind-34b', 'phind-codellama', 'phind-codellama-34b',
            'phind-codellama-34b-v2', 'phind-coder', 'phind coder',
            // BigCode
            'santacoder',
            // Naver
            'hyperclova', 'hyperclova x', 'hyperclova x 2', 'hyperclova x 2.0',
            // Meituan
            'longcat', 'longcat-flash', 'longcat-flash-chat', 'longcat-flash-lite',
            'longcat-flash-thinking', 'bailing', 'bailing 7b', 'pura', 'pura 72b',
            // LG
            'exaone', 'exaone 3', 'exaone 3.0', 'exaone 3.5', 'exaone audio',
            // ByteDance
            'seed', 'doubao 1.5',
            // Allen AI
            'molmo', 'medolmo', 'medolmo 32b',
            // SarvamAI
            'sarvam', 'sarvam 1', 'sarvam-30b', 'sarvam med',
            // Inception Labs
            'mercury', 'mercury coder',
            // Xiaomi
            'mimo', 'milm', 'milm-7b', 'milm-7b-instruct', 'milm-6x7b',
            // Hugging Face
            'zephyr', 'zephyr 7b', 'zephyr-7b', 'zephyr-7b-beta', 'idefics', 'idefics2',
            'idefics2-8b', 'huggingchat', 'parler-tts', 'parler-tts mini', 'parler-tts v2',
            // DeepSeek
            'janus', 'janus-pro', 'janus-pro-7b', 'deepseekmoe', 'deepseekmoe-16b',
            // Zhipu / THUDM
            'cogvlm', 'cogvlm2', 'cogvlm2-chat', 'cogagent',
            // Alibaba
            'qvq', 'qvq-72b', 'qvq-72b-preview',
            // Databricks
            'dolly', 'dolly v2', 'dolly v2 12b', 'leopard 7b',
            // Shanghai AI Lab
            'numinamath', 'numinamath-7b', 'sealion',
            // Amazon
            'codewhisperer',
            // StepFun
            'stepcoder', 'stepcoder-7b',
            // TII / Inception
            'acegpt', 'acegpt-13b',
            // Other
            'aider polyglot', 't0', 't0++',
            'longwriter', 'longwriter 7b',
            // Real benchmark/eval names that show up as "models"
            'med-gemini', 'med-palm', 'med-palm 2'
        ];
        for (const name of knownReal) {
            this._verifiedModelNames.add(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        }

        // Auto-raise _maxKnownVersions from verified models so caps stay current
        // This scans all trusted model names and extracts version numbers
        this._autoDetectVersionCaps();
    },

    _autoDetectVersionCaps() {
        // Only consider models from TRUSTED sources (zeroeval, huggingface).
        // Anything else could be hallucinated and would corrupt the caps.
        // Use the original (lowercased but not normalized) name so decimals and dashes
        // are preserved — _extractVersionNear handles param counts and date codes.
        const trustedNames = G.models
            .filter(m => m._src === 'zeroeval' || m._src === 'huggingface' || m._src === 'openrouter')
            .map(m => m.name.toLowerCase());
        for (const name of trustedNames) {
            for (const family of Object.keys(this._maxKnownVersions)) {
                const result = this._extractVersionNear(name, family);
                if (result.found && result.max != null && result.max > this._maxKnownVersions[family]) {
                    this._maxKnownVersions[family] = result.max;
                }
            }
        }
    },

    async doScan() {
      if (this._scanning) return;
      this._scanning = true;

      if (!G.authKey) { if(typeof UI !== 'undefined') UI.addLog('❌ No API key.'); this._scanning = false; return; }
      
      const btn = document.getElementById('btnScan');
      if (btn) {
          btn.classList.add('scanning');
          btn.innerHTML = '🛰️ Scanning...';
      }
      
      if(typeof UI !== 'undefined') UI.addLog(`🛰️ Scanning via ${G.apiProvider}...`);
      if(typeof SND !== 'undefined') SND.scan();
      G.unlockAchieve('first_scan');

      // Build verified model registry for cross-referencing scan results
      this._buildVerifiedRegistry();
      
      try {
        if (!this.supabase && G.supabaseUrl && G.supabaseKey) {
            this.initSupabase();
        }

        const stockPromise = this.fetchStocks();
        
        let parsedData = null;
        let lastErr = "";
        let rawDataDump = null; 

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // ─── WEIGHTED CATEGORY SELECTION ───
                // Cutting-edge gets 50% of scans to ensure latest models arrive first
                const weightedCategories = [
                    { cat: "CUTTING-EDGE 2025-2026 Flagships (the NEWEST model from each major lab)", w: 50 },
                    { cat: "Asian Tech Latest (DeepSeek-V3.2, DeepSeek-R2, Qwen3.5, Ernie 5, GLM-5, Yi-Lightning)", w: 15 },
                    { cat: "Open-weights Latest (Llama 4, Mistral Large 2, Gemma 3, Phi-4, Command-A)", w: 15 },
                    { cat: "Specialized/Niche (Coding, Audio, Vision, Medical, Robotics — 2025-2026 releases only)", w: 10 },
                    { cat: "Rumored or In-Training (genuinely unconfirmed next-gen models)", w: 10 }
                ];
                
                let roll = Math.random() * 100, cumulative = 0;
                let focusCategory = weightedCategories[0].cat;
                for (const wc of weightedCategories) {
                    cumulative += wc.w;
                    if (roll < cumulative) { focusCategory = wc.cat; break; }
                }

                // ─── FLAGSHIP GAP: Which major labs are missing their LATEST family version? ───
                // Regenerated from the auto-raising version caps + family→lab map
                // instead of a hand-maintained model list (which rotted every few
                // months). For each frontier family, if no tracked model reaches
                // the family's current known ceiling, flag the gap — this stays
                // current for free because _maxKnownVersions auto-raises.
                const missingFlagships = [];
                for (const [family, maxVer] of Object.entries(this._maxKnownVersions)) {
                    const labs = this._familyToLab[family];
                    if (!labs || !labs.length) continue;
                    let bestSeen = -1;
                    for (const m of G.models) {
                        const r = this._extractVersionNear(m.name.toLowerCase(), family);
                        if (r.found && r.max != null && r.max > bestSeen) bestSeen = r.max;
                    }
                    if (bestSeen < maxVer) {
                        missingFlagships.push(`${family} v${maxVer} (${labs[0]}${bestSeen >= 0 ? `, we only have up to v${bestSeen}` : ', none tracked'})`);
                    }
                }
                const flagshipGap = missingFlagships.slice(0, 12).join(', ');

                // ─── FORWARD NUDGE (self-maintaining) ───
                // Derived from the auto-raising version caps so it NEVER goes stale.
                // Tells the scan model the highest version we currently know per
                // closed frontier family and explicitly asks for anything newer.
                const frontierFams = { gpt: 'OpenAI GPT', claude: 'Anthropic Claude', gemini: 'Google Gemini', grok: 'xAI Grok' };
                const forwardNudge = Object.entries(frontierFams)
                    .map(([fam, label]) => `${label}: we currently know up to v${this._maxKnownVersions[fam]} — if a NEWER one has been officially released, RETURN IT`)
                    .join('\n');

                // ─── GAP ANALYSIS: Tell the AI which major labs are thin ───
                const majorLabs = ['openai', 'anthropic', 'google', 'meta', 'xai', 'microsoft', 'deepseek', 'alibaba', 'mistral', 'apple', 'amazon', 'nvidia', 'cohere'];
                const labCounts = {};
                majorLabs.forEach(l => { labCounts[l] = G.models.filter(m => m.lab === l).length; });
                const underrepresented = majorLabs.filter(l => labCounts[l] < 4).map(l => `${l}(${labCounts[l]})`).join(', ');

                // ─── FOUNDER GAP: Which labs have no CEO/founder tracked? ───
                const allLabsWithModels = [...new Set(G.models.map(m => m.lab))];
                const founderLabs = new Set((typeof REAL_FOUNDERS !== 'undefined' ? REAL_FOUNDERS : []).map(f => f.lab));
                const labsMissingFounder = allLabsWithModels.filter(l => l !== 'other' && !founderLabs.has(l));
                const founderGap = labsMissingFounder.join(', ');

                // Send existing model names for deduplication (compact: id-based for large lists)
                const allModelNames = G.models.length > 400
                    ? G.models.map(m => m.id).join(',')
                    : G.models.map(m => m.name).join(', ');
                const existingLabs = Object.keys(LABS).join(', ');
                
                const prompt = `This is an analytical data request. Find exactly 4 REAL, existing AI models. Focus: ${focusCategory}.

⚠️ RECENCY IS THE #1 PRIORITY. We need the LATEST models from 2025-2026 FIRST. Older models can come later.
⚠️ TODAY IS ${new Date().toISOString().split('T')[0]}. Do NOT return any model with a release date AFTER today.

MISSING FLAGSHIPS — These specific cutting-edge models are NOT yet in our database and should be prioritized:
${flagshipGap || 'All major flagships tracked!'}

LATEST-VERSION CHECK — push past what we know if reality has moved on:
${forwardNudge}

CONTEXT:
- Underrepresented labs needing priority: ${underrepresented || 'Good coverage'}
- Labs MISSING a founder/CEO: ${founderGap || 'All tracked'}
- EXISTING MODELS (do NOT duplicate): ${allModelNames}
- EXISTING LAB IDs: ${existingLabs}. Use exact lab IDs.

CRITICAL ACCURACY RULES — VIOLATIONS WILL CORRUPT A PUBLIC DATABASE:
1. ONLY return models that have been OFFICIALLY ANNOUNCED by the lab with a public blog post, API endpoint, or press release.
2. ALWAYS return the genuinely LATEST officially-released model from each major lab, even if it is newer than anything you think we already track — recency is the entire point. Our internal list is deliberately stale; do not anchor to it. The ONLY thing to avoid is FABRICATING a version with no public announcement:
   - If a lab has genuinely shipped a new flagship (e.g. a new GPT-5.x, Claude 4.x/5, Gemini 3.x/4, Grok 4.x/5, Llama 5), RETURN IT — that is exactly what we want.
   - Do NOT speculate multiple versions ahead of reality (e.g. if GPT-5.5 is the real latest, do NOT also invent "GPT-6" or "GPT-7"; if Gemini 3.5 is real, do NOT invent "Gemini 8 Ultra").
   - Rule of thumb: the next real increment past the current release = YES; a fabricated jump with no blog post / API / press release = NO.
3. Version numbers must match real, publicly documented versions. If unsure, SKIP that model entirely.
4. Release dates must be real dates when the model became publicly available. If unsure, use null.
5. Benchmarks must be from official papers or leaderboards (e.g. LMSYS, ZeroEval). If unsure, omit the benchmark.
6. "phase": "released" for launched models, "rumored" ONLY for models officially teased/leaked by the lab itself.
7. Use the model's FULL official name (e.g. "Claude Opus 4", not just "Claude 4"; "Grok 3 Mini" not "Grok-mini").
8. For any lab in the "MISSING a founder/CEO" list, include "founder_name" (e.g. Dario Amodei for Anthropic, Sam Altman for OpenAI, Elon Musk for xAI).
9. Include accurate pricing (cost_input/cost_out per 1M tokens USD) and context window (ctx in tokens).
10. If you are not 100% certain a model exists, DO NOT include it. Return fewer than 4 models if needed.

JSON (no markdown):
{"models":[{"id":"model_id","name":"Full Model Name","lab":"lab_id","region":"us","founder_name":"CEO Name or null","released":"2025-01-01","retired":null,"phase":"released","os":false,"desc":"Summary.","personality":"Helpful","talent":"Coding","favSpot":"Server Room","benchmarks":{"MMLU":90,"HumanEval":85,"MATH":75,"GPQA":55},"arch":{"params":"200B","type":"Dense","tokens":"15T","compute":"1e25 FLOPs"},"ctx":200000,"cost_input":3.0,"cost_out":15.0}],"retirements":[],"elo_updates":[],"events":[],"lineage_updates":[]}`;
                
                let url = '', hd = { 'Content-Type': 'application/json' }, pl = {};
                
                if (G.apiProvider === 'anthropic') {
                  url = 'https://api.anthropic.com/v1/messages';
                  hd['x-api-key'] = G.authKey;
                  hd['anthropic-version'] = '2023-06-01'; 
                  hd['anthropic-dangerously-allow-browser'] = 'true';
                  pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.anthropic, max_tokens: 8192, system: 'You are a real-time AI industry data API. Respond strictly in minified JSON format. No markdown. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API as of today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.', messages: [{ role: 'user', content: prompt }] };
                } else if (G.apiProvider === 'google') {
                  const targetModel = G.modelId || PROVIDER_DEFAULT_MODELS.google;
                  url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${G.authKey}`;
                  pl = { 
                      systemInstruction: { parts: [{ text: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only output real-world data. Do not truncate. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' }] },
                      contents: [{ parts: [{ text: prompt }] }], 
                      generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json" }
                  };
                } else if (G.apiProvider === 'xai') {
                  url = 'https://api.x.ai/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { 
                      model: G.modelId || PROVIDER_DEFAULT_MODELS.xai,
                      temperature: 0.1,
                      max_tokens: 8192,
                      messages: [
                          { role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. CRITICAL: Any model that is publicly available via API as of today MUST have phase "released", NOT "rumored". Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' },
                          { role: 'user', content: prompt }
                      ] 
                  };
                } else {
                  url = 'https://api.openai.com/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { model: G.modelId || PROVIDER_DEFAULT_MODELS.openai, temperature: 0.1, max_tokens: 8192, messages: [{ role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' }, { role: 'user', content: prompt }] };
                }
          

                const res = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(120000) });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`⛔ [SCAN] HTTP ${res.status} from ${G.apiProvider}`, errText);
                    console.error(`⛔ [SCAN] Request URL:`, url);
                    console.error(`⛔ [SCAN] Request payload:`, JSON.stringify(pl, null, 2));
                    throw new Error(`API returned HTTP ${res.status}: ${errText}`);
                }
                const data = await res.json();
                rawDataDump = data;


                if (G.apiProvider === 'google') {
                    if (data.promptFeedback && data.promptFeedback.blockReason) {
                        throw new Error(`Google blocked the prompt: ${data.promptFeedback.blockReason}`);
                    }
                    if (data.candidates && data.candidates[0]) {
                        const fr = data.candidates[0].finishReason;
                        if (fr && fr !== 'STOP' && fr !== 'MAX_TOKENS') {
                            throw new Error(`Google interrupted the stream. Reason: ${fr}`);
                        }
                        if (fr === 'MAX_TOKENS') {
                            console.warn(`⚠️ [SCAN] Google hit MAX_TOKENS (thinking model used too many reasoning tokens). Attempting to salvage partial response...`);
                        }
                    }
                }
          
                let txt = '';
                if (G.apiProvider === 'anthropic') txt = data.content?.[0]?.text || '';
                else if (G.apiProvider === 'google') txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                else txt = data.choices?.[0]?.message?.content || '';
          
                if (!txt) {
                    throw new Error("API returned an empty text response. Check the Dev Console for the raw object dump.");
                }

                let cleanTxt = txt.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
                const firstBrace = cleanTxt.indexOf('{');
                const lastBrace = cleanTxt.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanTxt = cleanTxt.substring(firstBrace, lastBrace + 1);
                } else {
                    console.error("⛔ BRACKETS NOT FOUND. RAW TEXT:", txt);
                    throw new Error("No JSON brackets found in response.");
                }

                cleanTxt = cleanTxt.replace(/,\s*([\]}])/g, '$1');
                try {
                    parsedData = JSON.parse(cleanTxt);
                } catch (parseErr) {
                    // Salvage attempt: truncated JSON from MAX_TOKENS
                    // Find the last complete model object and close the structure
                    console.warn("⚠️ [SCAN] JSON parse failed, attempting salvage of truncated response...");
                    try {
                        // Find last complete object boundary in the models array
                        const modelsStart = cleanTxt.indexOf('"models"');
                        if (modelsStart !== -1) {
                            let lastCompleteObj = -1;
                            let depth = 0;
                            let inString = false;
                            let escape = false;
                            for (let ci = modelsStart; ci < cleanTxt.length; ci++) {
                                const ch = cleanTxt[ci];
                                if (escape) { escape = false; continue; }
                                if (ch === '\\') { escape = true; continue; }
                                if (ch === '"') { inString = !inString; continue; }
                                if (inString) continue;
                                if (ch === '{') depth++;
                                if (ch === '}') { depth--; if (depth === 1) lastCompleteObj = ci; }
                            }
                            if (lastCompleteObj > 0) {
                                const salvaged = cleanTxt.substring(0, lastCompleteObj + 1) + '],"retirements":[],"elo_updates":[],"events":[],"lineage_updates":[]}';
                                parsedData = JSON.parse(salvaged);

                            } else {
                                throw parseErr;
                            }
                        } else {
                            throw parseErr;
                        }
                    } catch (salvageErr) {
                        console.error("⛔ JSON PARSE FAILED. CLEANED TEXT:", cleanTxt);
                        throw new Error("API syntax error despite brute force extraction.");
                    }
                }
                
                break;
            } catch (loopErr) {
                lastErr = loopErr.message;
                console.error(`⛔ [SCAN] Attempt ${attempt}/3 failed:`, loopErr.message);
                if (rawDataDump) console.error(`⛔ [SCAN] Raw response dump:`, rawDataDump);
                if (lastErr.includes('HTTP 401') || lastErr.includes('HTTP 403') || lastErr.includes('API returned HTTP 4')) {
                    throw loopErr;
                }
                
                if (attempt < 3) {
                    if(typeof UI !== 'undefined') UI.addLog(`⚠️ API hiccup. Retrying (${attempt}/3)...`);
                    await new Promise(res => setTimeout(res, 2000)); 
                }
            }
        }

        if (!parsedData) {
            if(typeof UI !== 'undefined') UI.addLog(`⛔ Failed: ${lastErr}`);
            console.error("⛔ FINAL RAW AI RESPONSE DUMP:", JSON.stringify(rawDataDump, null, 2));
            throw new Error(lastErr);
        }

        if(typeof UI !== 'undefined') UI.addLog(`📡 Got ${parsedData.models?.length || 0} models`);
        let nC = 0;
  
        if (parsedData.models) {
            for (const m of parsedData.models) {
                if (!m.name || !m.lab) continue;
                
                const safeId = m.id ? m.id.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                const safeName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                let isDuplicate = false;
                for (const existing of G.models) {
                    const eId = existing.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eName = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    
                    if (safeId === eId || safeName === eName) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (isDuplicate) {

                    let needsUpdate = false;
                    const target = G.models.find(mod => mod.id.toLowerCase().replace(/[^a-z0-9]/g, '') === safeId || mod.name.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                    
                    if (target) {
                        if ((!window.COSTS || !window.COSTS[target.id]) && m.cost_input != null && m.cost_out != null) {
                            if(!window.COSTS) window.COSTS = {};
                            window.COSTS[target.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                            target.cost_input = m.cost_input;
                            target.cost_out = m.cost_out;
                            needsUpdate = true;
                        }
                        if ((!window.CTX || !window.CTX[target.id]) && m.ctx != null) {
                            if(!window.CTX) window.CTX = {};
                            window.CTX[target.id] = parseInt(m.ctx);
                            target.ctx = m.ctx;
                            needsUpdate = true;
                        }
                        if (needsUpdate && this.supabase) {
                            this._cloudSubmit('models', { id: target.id, cost_input: m.cost_input, cost_out: m.cost_out, ctx: m.ctx }, { op: 'update' }).then((ok) => {
                                if (ok && typeof UI !== 'undefined') UI.addToast(`📈 Backfilled economic data for ${target.name}!`);
                            });
                        }
                    }
                    continue;
                }

                // ─── VERIFICATION GATE: Reject hallucinated/impossible models ───
                const verification = this._verifyModel(m);
                if (!verification.ok) {
                    console.warn(`🚫 [Verify] REJECTED "${m.name}": ${verification.reason}`);
                    if (typeof UI !== 'undefined') UI.addLog(`🚫 Rejected "${m.name}": ${verification.reason}`);
                    continue;
                }

                if (m.benchmarks) {
                    if (!window.BM) window.BM = {};
                    window.BM[m.id] = {};
                    Object.keys(m.benchmarks).forEach(k => window.BM[m.id][k.toUpperCase()] = m.benchmarks[k]);
                }

                if (m.cost_input != null && m.cost_out != null) {
                    if (!window.COSTS) window.COSTS = {};
                    window.COSTS[m.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                }
                if (m.ctx != null) {
                    if (!window.CTX) window.CTX = {};
                    window.CTX[m.id] = parseInt(m.ctx);
                }

                const nm = {
                    id: m.id, name: m.name, lab: m.lab, rel: m.released, ret: m.retired || null,
                    phase: m.phase || 'released', os: m.os || false, desc: m.desc || 'A new citizen!',
                    per: m.personality || 'Fresh face', tal: m.talent || 'Being new', fav: m.favSpot || 'Town Square',
                    _src: 'llm_scan', benchmarks: m.benchmarks, arch: m.arch,
                    ctx: m.ctx || null, cost_input: m.cost_input || 0, cost_out: m.cost_out || 0
                };
                
                // PASS REGION INTO ENGINE DYNAMICALLY
                nm.lab = G.ensureLabExists(nm.lab, m.region);

                if (m.founder_name && typeof REAL_FOUNDERS !== 'undefined') {
                    let existingFounder = REAL_FOUNDERS.find(f => f.lab === nm.lab);
                    if (!existingFounder) {
                        const labData = LABS[nm.lab] || LABS.other || { color: '#64748b' };
                        const newFounder = { 
                            name: m.founder_name, 
                            lab: nm.lab, 
                            role: "CEO / Lead Researcher",
                            color: labData.color,
                            fact: `Founder of ${labData.name || nm.lab}. Discovered via network scan.`
                        };
                        REAL_FOUNDERS.push(newFounder);

                        
                        if (this.supabase) {
                            // Only save founder if lab exists in DB (avoids FK violation)
                            this.supabase.from('labs').select('id').eq('id', nm.lab).maybeSingle().then(({data: labRow}) => {
                                if (!labRow) return; // Lab not in DB yet — skip silently
                                return this._cloudSubmit('founders', {
                                    lab_id: nm.lab,
                                    name: m.founder_name,
                                    role: "CEO / Lead Researcher",
                                    color: labData.color,
                                    fact: newFounder.fact
                                });
                            }).catch(err => console.error(`[Founder] Save failed:`, err));
                        }
                        
                        // ─── CREATE RUNTIME CEO ENTITIES ───
                        // Spawn car + helicopter for the new founder
                        if (typeof Entities !== 'undefined' && G.ceoRefs && !G.ceoRefs[nm.lab]) {
                            if (Entities.carLayer && Entities.reflectionLayer) {
                                const ceoObj = EntitiesGfx.initCEO(newFounder, Entities.carLayer, Entities.reflectionLayer);
                                const home = G.bldById['house_' + nm.lab];
                                if (home) {
                                    ceoObj.bld = home.id;
                                    ceoObj.logicalX = home.x + home.w / 2;
                                    ceoObj.carCont.visible = false;
                                    ceoObj.refCont.visible = false;
                                }
                                G.ceoRefs[nm.lab] = ceoObj;
                            }
                            
                            if (Entities.carLayer && !Entities.heliRefs[nm.lab]) {
                                const heli = EntitiesGfx.initHelicopter(newFounder, Entities.carLayer);
                                const home = G.bldById['house_' + nm.lab];
                                if (home) {
                                    heli.homeX = home.x + home.w / 2;
                                    heli.homeY = G.groundY - 80;
                                }
                                Entities.heliRefs[nm.lab] = heli;
                            }
                        }
                        
                        // ─── CREATE ESTATE IN BILLIONAIRE'S ROW ───
                        if (!BLDS.find(b => b.id === 'house_' + nm.lab)) {
                            const hash = Array.from(nm.lab).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            const newW = 160 + (hash % 40);
                            
                            const newEstate = {
                                id: 'house_' + nm.lab, 
                                name: `${m.founder_name}'s Estate`, 
                                w: newW, x: 0, fl: 2, 
                                lab: nm.lab, 
                                desc: `The private residential estate of ${m.founder_name}.`
                            };
                            
                            BLDS.push(newEstate);
                            G.bldById[newEstate.id] = newEstate;
                            if (!G.bldsByLab[nm.lab]) G.bldsByLab[nm.lab] = [];
                            G.bldsByLab[nm.lab].push(newEstate);
                            
                            G.recalculateZoning();
                            
                            if (G.bldLayer && typeof Environment !== 'undefined') {
                                Environment.buildGround();
                                Environment.buildBuildings();
                            }
                            
                            // Update the CEO's home reference now that the estate exists
                            if (G.ceoRefs && G.ceoRefs[nm.lab]) {
                                const ceo = G.ceoRefs[nm.lab];
                                ceo.bld = newEstate.id;
                                ceo.logicalX = newEstate.x + newEstate.w / 2;
                                ceo.carCont.visible = false;
                                ceo.refCont.visible = false;
                            }
                            
                            if (typeof UI !== 'undefined') UI.addToast(`🏡 ${m.founder_name}'s Estate built in Billionaire's Row!`);
                        }
                        
                        if (typeof UI !== 'undefined') UI.addToast(`🧑‍💼 ${m.founder_name} (${labData.name}) has arrived in the city!`);
                    }
                }
                
                G.models.push(nm);
                if(typeof Entities !== 'undefined') Entities.createChar(nm); 
                nC++;
                
                if (this.supabase) {
                    try {
                        const ok = await this._cloudSubmit('models', this._dbSafeModel(nm));
                        if (!ok) console.error("Supabase Save Error: submit-data rejected or unreachable");
                    } catch (dbErr) {
                        console.error("Cloud Sync Failed:", dbErr);
                    }
                }

                if(typeof SND !== 'undefined') SND.birth();
                G.dramaticLaunch(m.name);
                G.unlockAchieve('witnessed');
            }
        }
        
        if (parsedData.lineage_updates) {
            let famAdded = 0;
            parsedData.lineage_updates.forEach(lu => {
                if (!lu.lab || !lu.parent || !lu.child) return;
                
                const safeLab = lu.lab.toLowerCase().replace(/[^a-z0-9_]/g, '');
                const safeParent = lu.parent.toLowerCase().replace(/[^a-z0-9-]/g, '');
                const safeChild = lu.child.toLowerCase().replace(/[^a-z0-9-]/g, '');
                
                if (!window.FAMILIES) window.FAMILIES = {};
                if (!window.FAMILIES[safeLab]) window.FAMILIES[safeLab] = [];
                
                let parentEdge = window.FAMILIES[safeLab].find(e => e.id === safeParent);
                if (!parentEdge) {
                    parentEdge = { id: safeParent, children: [] };
                    window.FAMILIES[safeLab].push(parentEdge);
                }
                
                if (!parentEdge.children.includes(safeChild)) {
                    parentEdge.children.push(safeChild);
                    famAdded++;
                    
                    if (this.supabase) {
                        this._cloudSubmit('families', { lab: safeLab, edges: window.FAMILIES[safeLab] });
                    }
                }
            });
            if (famAdded > 0 && typeof UI !== 'undefined') { UI.addToast(`🧬 Mapped ${famAdded} new family tree connections!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Lineage Updated!', `🧬 ${famAdded} new model family connections mapped`); }
        }

        if (parsedData.events) {
            let addedEvents = 0;
            for (const ev of parsedData.events) {
                if (window.AI_EVENTS && !window.AI_EVENTS.find(e => e.date === ev.date && e.name === ev.name)) {
                    window.AI_EVENTS.push(ev);
                    addedEvents++;
                    if (this.supabase) {
                        this._cloudSubmit('ai_events', ev);
                    }
                }
            }
            if (addedEvents > 0 && typeof UI !== 'undefined') { UI.addToast(`📅 Added ${addedEvents} new tech events to Calendar!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Events Added!', `📅 ${addedEvents} new tech events on the calendar`); }
        }

        if (parsedData.retirements) {
            parsedData.retirements.forEach(rt => {
                const safeName = rt.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                const m = G.models.find(mod => mod.id.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                if (m && !m.ret) {
                    m.ret = rt.retired_date;
                    if(typeof SND !== 'undefined') SND.retire();
                    if(typeof UI !== 'undefined') UI.addToast(`👻 ${m.name} retired.`);
                }
            });
        }
        
        let ec = 0;
        if (parsedData.elo_updates) {
            parsedData.elo_updates.forEach(eu => {
                if (!eu.name || !eu.elo || eu.elo < 800 || eu.elo > 2000) return;
                
                const safeName = eu.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                const m = G.models.find(mod => {
                    const eName = mod.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return eName === safeName;
                });
                
                if (m) {
                    if (!window.BM) window.BM = {};
                    if (!window.BM[m.id]) window.BM[m.id] = {};
                    const old = window.BM[m.id].ELO;
                    window.BM[m.id].ELO = Math.round(eu.elo);
                    ec++;
                    if (old && Math.abs(old - eu.elo) > 20 && typeof UI !== 'undefined') {
                        UI.addToast(`📊 ${m.name} ELO: ${old} → ${Math.round(eu.elo)}`);
                    }
                }
            });
        }
  
        if (ec > 0 && typeof UI !== 'undefined') UI.addLog(`📡 Updated ELO for ${ec} models.`);
        if (typeof UI !== 'undefined') {
            UI.addLog(`✅ ${nC} new models.`);
            if (nC === 0) UI.addLog('ℹ️ City up to date!');
        }
  
        if (G.models.filter(m => m._src).length >= 10) G.unlockAchieve('ten_models');
        if (G.models.length >= 50) G.unlockAchieve('fifty_models');
        if (G.models.length >= 100) G.unlockAchieve('hundred_models');
        if (new Set(G.models.map(m => m.lab)).size >= 7) G.unlockAchieve('all_labs');
        
        G.save();
        G.evolveCity();

        await stockPromise;

        // ─── LIVE DATA REFRESH: Piggyback on scan to update all live feeds ───
        Promise.allSettled([
            this.fetchVCFunding(),
            this.fetchSupplyChain(),
            this.fetchRegulationNews(),
            this.fetchArxivPapers(),
            this.fetchAIEvents(),
            this.fetchNewDataCenters()
        ]);

        // Collapse any same-name duplicates introduced by this scan (rare, but the
        // scan can produce a new ID for a model OpenRouter/ZeroEval already seeded).
        if (typeof this.dedupeModels === 'function') {
            try { await this.dedupeModels(); } catch (e) { console.warn('[Scan] Dedupe failed:', e); }
        }

      } catch(e) {
        console.error(`⛔ [SCAN] FATAL ERROR:`, e.message);
        console.error(`⛔ [SCAN] Provider: ${G.apiProvider}, Model: ${G.modelId}`);
        console.error(`⛔ [SCAN] Full error:`, e);
        if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('CORS')) {
            if(typeof UI !== 'undefined') UI.addLog(`⚠️ Network/CORS error. Try switching API providers.`);
        } else {
            if(typeof UI !== 'undefined') UI.addLog(`❌ ${e.message}`);
        }
      }
    
      if (btn) {
          btn.classList.remove('scanning');
          btn.innerHTML = '🛰️ Scan';
      }
      this._scanning = false;
    },
    
    // ═══════════════════════════════════════════════════════════════
    //   DATABASE PURGE — Remove hallucinated models from Supabase
    //   Call via console: API.purgeHallucinations()
    // ═══════════════════════════════════════════════════════════════

    async purgeHallucinations() {
        // Ensure ZeroEval + HuggingFace have populated the verified registry before purging.
        // Without this, we'd reject legitimate models simply because their source-of-truth
        // hadn't loaded yet.
        if (!this._zeroevalLoaded && typeof this.fetchZeroEval === 'function') {
            try { await this.fetchZeroEval(); } catch(e) { /* registry will fall back to knownReal */ }
        }
        if (!this._huggingfaceLoaded && typeof this.fetchHuggingFace === 'function') {
            try { await this.fetchHuggingFace(); } catch(e) { /* same fallback */ }
        }
        if (!this._openrouterLoaded && typeof this.fetchOpenRouter === 'function') {
            try { await this.fetchOpenRouter(); } catch(e) { /* same fallback */ }
        }

        // Always rebuild the registry from current G.models so it picks up any
        // ZeroEval/HuggingFace models that arrived after the last build.
        this._buildVerifiedRegistry();

        if (typeof UI !== 'undefined') UI.addLog('🧹 Scanning for hallucinated data...');

        try {
            // LOCAL-ONLY since v485: this scrubs the DISPLAYED city. Cloud deletion moved
            // to netlify/functions/db-maintenance.mjs (scheduled, service key) so the anon
            // browser key no longer needs DELETE rights on `models` — anyone could wipe
            // the table from the devtools console before. See sc_models_rls.sql.
            const localBefore = G.models.length;
            G.models = G.models.filter(m => {
                const result = this._verifyModel(m);
                if (!result.ok) {

                    // Remove character sprite
                    if (typeof Entities !== 'undefined' && G.charRefs && G.charRefs[m.id]) {
                        const refs = G.charRefs[m.id];
                        if (refs.c && refs.c.parent) refs.c.parent.removeChild(refs.c);
                        delete G.charRefs[m.id];
                    }
                    return false;
                }
                return true;
            });
            const localPurged = localBefore - G.models.length;

            if (localPurged > 0) {
                if (typeof UI !== 'undefined') UI.addLog(`🧹 Purged ${localPurged} hallucinated models from view`);
                if (typeof UI !== 'undefined') UI.addToast(`🧹 Cleaned ${localPurged} hallucinated models!`);
                G.save();
                G.evolveCity();
            }
        } catch (e) {
            console.error('🧹 [Purge] Error:', e);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   NAME-BASED DEDUPE — Collapse entries that represent the same
    //   real-world model but were written under different IDs by
    //   separate sources (LLM scan vs OpenRouter vs ZeroEval, etc.).
    //   LOCAL-ONLY since v485: cloud reconciliation moved to the
    //   db-maintenance.mjs scheduled function (anon key can't delete).
    //   Call via console: API.dedupeModels()
    // ═══════════════════════════════════════════════════════════════
    async dedupeModels() {
        const fuzzyNorm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d{6,}/g, '');

        // Source trust ranking — trusted sources survive ID collisions against scan output.
        const sourceRank = { zeroeval: 5, huggingface: 4, openrouter: 3, llm_scan: 2 };

        const scoreModel = (m) => {
            let s = sourceRank[m._src] || 1;
            if (m.phase === 'released') s += 10;
            else if (m.phase === 'rumored' || m.phase === 'baby' || m.phase === 'kid') s -= 2;
            if (!m.ret) s += 3;
            if (m.benchmarks && Object.keys(m.benchmarks).length > 0) s += 3;
            if (window.BM && window.BM[m.id] && Object.keys(window.BM[m.id]).length > 0) s += 3;
            if (m.cost_input != null && m.cost_out != null && (m.cost_input > 0 || m.cost_out > 0)) s += 2;
            if (m.ctx) s += 1;
            if (m.rel || m.released) s += 1;
            return s;
        };

        // Group local models by normalized display name.
        const groups = new Map();
        for (const m of G.models) {
            if (!m.name) continue;
            const key = fuzzyNorm(m.name);
            if (!key) continue;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(m);
        }

        const toRemoveIds = [];
        let mergedCount = 0;

        for (const [, group] of groups) {
            if (group.length < 2) continue;

            group.sort((a, b) => scoreModel(b) - scoreModel(a));
            const winner = group[0];
            const losers = group.slice(1);

            for (const loser of losers) {
                if (!winner.rel && loser.rel) winner.rel = loser.rel;
                if (!winner.released && loser.released) winner.released = loser.released;
                if (!winner.ctx && loser.ctx) winner.ctx = loser.ctx;
                if ((winner.cost_input == null || winner.cost_input === 0) && loser.cost_input) {
                    winner.cost_input = loser.cost_input;
                    winner.cost_out = loser.cost_out;
                }
                if (loser.benchmarks) {
                    if (!winner.benchmarks) winner.benchmarks = {};
                    for (const [k, v] of Object.entries(loser.benchmarks)) {
                        if (!winner.benchmarks[k] || v > winner.benchmarks[k]) winner.benchmarks[k] = v;
                    }
                }
                if (window.BM && window.BM[loser.id]) {
                    if (!window.BM[winner.id]) window.BM[winner.id] = {};
                    for (const [k, v] of Object.entries(window.BM[loser.id])) {
                        if (!window.BM[winner.id][k] || v > window.BM[winner.id][k]) window.BM[winner.id][k] = v;
                    }
                    delete window.BM[loser.id];
                }
                if (window.COSTS && window.COSTS[loser.id]) {
                    if (!window.COSTS[winner.id]) window.COSTS[winner.id] = window.COSTS[loser.id];
                    delete window.COSTS[loser.id];
                }
                if (window.CTX && window.CTX[loser.id]) {
                    if (!window.CTX[winner.id]) window.CTX[winner.id] = window.CTX[loser.id];
                    delete window.CTX[loser.id];
                }

                // Kill the duplicate citizen's sprite
                if (typeof Entities !== 'undefined' && G.charRefs && G.charRefs[loser.id]) {
                    const refs = G.charRefs[loser.id];
                    if (refs.c && refs.c.parent) refs.c.parent.removeChild(refs.c);
                    delete G.charRefs[loser.id];
                }

                toRemoveIds.push(loser.id);
                mergedCount++;
            }
        }

        // Also fold in any rows that fetchCloudModels skipped as name-duplicates on load.
        if (Array.isArray(this._pendingNameDupes) && this._pendingNameDupes.length > 0) {
            for (const id of this._pendingNameDupes) {
                if (!toRemoveIds.includes(id)) toRemoveIds.push(id);
            }
            this._pendingNameDupes = [];
        }

        if (toRemoveIds.length === 0) return;

        const removeSet = new Set(toRemoveIds);
        G.models = G.models.filter(m => !removeSet.has(m.id));

        console.log(`🔀 [Dedupe] Merged ${mergedCount} duplicate model entries. Removed IDs:`, toRemoveIds);
        if (typeof UI !== 'undefined') {
            UI.addLog(`🔀 Dedupe: collapsed ${mergedCount} duplicate model entries`);
            if (mergedCount > 0) UI.addToast(`🔀 Merged ${mergedCount} duplicate citizen${mergedCount > 1 ? 's' : ''}!`);
        }

        G.save();
        G.evolveCity();
    },

    async syncBuildingPositions() {
        if (!this.supabase) return;
        try {
            const toSync = BLDS.filter(b => b.lab || ['cafe','gym','arena','open_square','park','graveyard','neon_bar','visitor_monument','city_park'].includes(b.id));
            const rows = toSync.map(b => ({ id: b.id, name: b.name, w: b.w, x: Math.round(b.x), fl: b.fl || 1, emoji: b.emoji || null, lab: b.lab || null, desc: b.desc || null }));
            if (rows.length > 0) {
                await this._cloudSubmit('blds', rows); // chunked by the helper
            }
        } catch (e) { /* silent */ }
    }
};

// ─── VISITOR COUNTER ───
const VisitorTracker = {
    uniqueVisitors: 0,
    totalVisits: 0,
    
    async init() {
        if (!API.supabase) { this._fallbackCount(); return; }
        try {
            // Get or create visitor ID
            let vid = localStorage.getItem('sc_visitor_id');
            if (!vid) {
                vid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                localStorage.setItem('sc_visitor_id', vid);
            }
            // Call RPC to record visit and get counts
            const { data, error: _visitErr } = await API.supabase.rpc('record_visit', { p_visitor_id: vid });
            if (data && data.length > 0) {
                this.uniqueVisitors = data[0].unique_visitors || 0;
                this.totalVisits = data[0].total_visits || 0;
            } else {
                this._fallbackCount();
            }
        } catch (e) {
            this._fallbackCount();
        }
        this._updateMonument();
    },
    
    async refresh() {
        if (!API.supabase) return;
        try {
            const { data } = await API.supabase.from('visitor_counter').select('*').eq('id', 'global').single();
            if (data) {
                this.uniqueVisitors = data.unique_visitors || 0;
                this.totalVisits = data.total_visits || 0;
                this._updateMonument();
            }
        } catch (e) { /* silent */ }
    },
    
    _fallbackCount() {
        // If Supabase not available, use localStorage session count
        let visits = parseInt(localStorage.getItem('sc_visits') || '0');
        visits++;
        localStorage.setItem('sc_visits', visits.toString());
        this.totalVisits = visits;
        this.uniqueVisitors = 1;
    },
    
    _updateMonument() {
        // Update the in-world monument text
        const mon = G.bldById && G.bldById['visitor_monument'];
        if (mon && mon._counterTxt) {
            mon._counterTxt.text = this.uniqueVisitors.toLocaleString();
        }
        if (mon && mon._visitsTxt) {
            mon._visitsTxt.text = this.totalVisits.toLocaleString() + ' visits';
        }
    }
};
