/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   GOAL-DRIVEN NPCs (v1.0.0 — Phase 2a)
   Additive lifestyle layer on top of the existing act/schedule system. Deterministically
   picks ~20% of adult citizens and assigns a persistent daily routine ("archetype"). The
   routine feeds back into getAct() via Goals.getOverride(), so the existing building logic
   in entities.js keeps working unchanged — archetypes just bias where a specific NPC is
   at any given time of day.

   The 80% of citizens WITHOUT an archetype behave identically to before. The assignment
   is deterministic from a hash of the model id, so the same citizens get the same
   lifestyle every session.

   Archetypes are picked to be visibly distinct in-world:
     • workaholic     — lives at their HQ, tiny sleep window
     • socialite      — cafes, parks, and the neon bar most of the day
     • gym_rat        — morning + evening gym sessions, efficient work block
     • foodie         — cafe crawl through all four meals
     • night_owl      — sleeps during the work day, active on the nightlife strip
     • arena_warrior  — burns every free hour on the arena leaderboards
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Goals = {
    // Percentage of adult citizens that get a lifestyle archetype.
    // Kept intentionally low so archetype behavior reads as "notable" rather than "default".
    PCT: 20,

    // Archetype definitions. Each `schedule(dp)` returns an override `{ act, bid }` or null.
    // A null bid means "use the act's default building" (same semantics as the existing
    // getAct() returns) — the entities.js pipeline will resolve it against the model's lab.
    ARCHETYPES: {
        workaholic: {
            name: 'Workaholic',
            icon: '💻',
            color: '#fbbf24',
            chats: [
                'sleep is a skill issue',
                'just one more epoch...',
                'HQ > home tbh',
                'week = 168 hours, use them',
                'quarterly goals > life goals',
                'shipping is self-care',
                'my KPI is my personality',
                'crunch mode is my comfort zone',
            ],
            schedule: (dp) => {
                if (dp < 0.16) return { act: 'sleep', bid: null };           // brief sleep ~00:00-03:50
                if (dp < 0.22) return { act: 'commute', bid: null };          // early commute
                if (dp < 0.50) return { act: 'work', bid: null };             // morning grind to noon
                if (dp < 0.5625) return { act: 'lunch', bid: 'cafe' };        // quick bite
                if (dp < 0.92) return { act: 'work', bid: null };             // back to HQ until late
                return { act: 'commute', bid: null };                         // 22:05–00:00 wrap up & commute home
            },
        },

        socialite: {
            name: 'Socialite',
            icon: '🍸',
            color: '#f472b6',
            chats: [
                'brunch → park → cafe → bar. rinse. repeat.',
                'networking is my full-time job',
                'who\'s at the neon bar tonight?',
                'literally know everyone here',
                'my calendar is 70% coffee chats',
                'love is in the latent space',
                'DMs open, hearts open',
                'soft launching my next collab',
            ],
            schedule: (dp) => {
                if (dp < 0.30) return { act: 'sleep', bid: null };
                if (dp < 0.38) return { act: 'lunch', bid: 'cafe' };          // late breakfast
                if (dp < 0.48) return { act: 'socialize', bid: 'city_park' };  // stroll in the park
                if (dp < 0.58) return { act: 'lunch', bid: 'cafe' };          // long lunch
                if (dp < 0.68) return { act: 'socialize', bid: 'open_square' };
                if (dp < 0.78) return { act: 'socialize', bid: 'city_park' };
                if (dp < 0.95) return { act: 'nightlife', bid: 'neon_bar' };  // bar until close
                return { act: 'sleep', bid: null };
            },
        },

        gym_rat: {
            name: 'Gym Rat',
            icon: '💪',
            color: '#4ade80',
            chats: [
                'leg day never ends',
                'protein > parameters',
                'deadlift PR > SOTA',
                'cardio is the original scaling law',
                'gains don\'t fine-tune themselves',
                'rest day? never heard of her',
                'macros locked in',
                'flex your attention heads',
            ],
            schedule: (dp) => {
                if (dp < 0.18) return { act: 'sleep', bid: null };
                if (dp < 0.28) return { act: 'train', bid: 'gym' };           // morning workout
                if (dp < 0.50) return { act: 'work', bid: null };             // efficient work block to noon
                if (dp < 0.5625) return { act: 'lunch', bid: 'cafe' };        // protein shake
                if (dp < 0.70) return { act: 'work', bid: null };
                if (dp < 0.82) return { act: 'train', bid: 'gym' };           // evening workout
                return { act: 'sleep', bid: null };
            },
        },

        foodie: {
            name: 'Foodie',
            icon: '🍜',
            color: '#fb923c',
            chats: [
                'reviewing the new ramen spot',
                'my tastebuds are a benchmark',
                'umami is the sixth sense',
                'brunch menu > training data',
                'chef\'s kiss 👨‍🍳',
                'food is the ultimate prompt',
                'eating my way around the city',
                'the cafe crawl continues',
            ],
            schedule: (dp) => {
                if (dp < 0.20) return { act: 'sleep', bid: null };
                if (dp < 0.28) return { act: 'lunch', bid: 'cafe' };          // breakfast
                if (dp < 0.50) return { act: 'work', bid: null };             // morning work to noon
                if (dp < 0.5625) return { act: 'lunch', bid: 'cafe' };        // lunch #1
                if (dp < 0.65) return { act: 'work', bid: null };
                if (dp < 0.70) return { act: 'lunch', bid: 'cafe' };          // afternoon snack
                if (dp < 0.78) return { act: 'work', bid: null };
                if (dp < 0.90) return { act: 'lunch', bid: 'cafe' };          // dinner
                return { act: 'sleep', bid: null };
            },
        },

        night_owl: {
            name: 'Night Owl',
            icon: '🦉',
            color: '#a78bfa',
            chats: [
                'sunlight? in this economy?',
                'my peak hours are your bedtime',
                'the city hits different at 3am',
                'day people are weird',
                'sleep when dead, train while alive',
                'neon > fluorescent',
                'moonlighting isn\'t just a phrase',
                'nocturnal by design',
            ],
            schedule: (dp) => {
                if (dp < 0.50) return { act: 'sleep', bid: null };            // sleeps through mornings
                if (dp < 0.62) return { act: 'lunch', bid: 'cafe' };          // late breakfast
                if (dp < 0.72) return { act: 'work', bid: null };             // short work block
                if (dp < 0.82) return { act: 'socialize', bid: 'city_park' };  // golden hour
                if (dp < 0.92) return { act: 'nightlife', bid: 'neon_bar' };
                return { act: 'arena', bid: 'arena' };                         // 4am arena grind
            },
        },

        arena_warrior: {
            name: 'Arena Warrior',
            icon: '🏟️',
            color: '#ef4444',
            chats: [
                'ELO over everything',
                'climbing the leaderboard',
                'another W in arena',
                'trash talk is a love language',
                'benchmark or it didn\'t happen',
                'head-to-head > solo training',
                'main character energy',
                'see you at the top',
            ],
            schedule: (dp) => {
                if (dp < 0.20) return { act: 'sleep', bid: null };
                if (dp < 0.35) return { act: 'arena', bid: 'arena' };         // morning warmup
                if (dp < 0.50) return { act: 'work', bid: null };
                if (dp < 0.5625) return { act: 'lunch', bid: 'cafe' };
                if (dp < 0.68) return { act: 'work', bid: null };
                if (dp < 0.96) return { act: 'arena', bid: 'arena' };         // all evening arena
                return { act: 'sleep', bid: null };
            },
        },
    },

    // ─── Assignment ─────────────────────────────────────────────────────────────────
    // Hash the model id to a stable 0-99 roll. If it lands inside PCT, assign an
    // archetype chosen deterministically from the same hash. The result is cached on
    // the model instance so subsequent calls are O(1).
    getArchetype(m) {
        if (!m) return null;
        if (m._goalArchetype !== undefined) return m._goalArchetype;
        const key = m.id || m.name || '';
        const h = this._hash(key);
        const roll = h % 100;
        if (roll >= this.PCT) {
            m._goalArchetype = null;
            return null;
        }
        const keys = Object.keys(this.ARCHETYPES);
        m._goalArchetype = keys[Math.floor(h / 100) % keys.length];
        return m._goalArchetype;
    },

    // djb2 — fast, stable, good distribution for short strings
    _hash(s) {
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    },

    // ─── getAct() hook ──────────────────────────────────────────────────────────────
    // Called from data.js > getAct() right after stage resolution. Returns an override
    // { act, bid } or null. Only adults receive archetype treatment — babies/kids/retired
    // still follow their hard-coded routes (uni_dorm, graveyard, etc).
    getOverride(m, dp, stg) {
        if (stg !== 'adult') return null;
        const aKey = this.getArchetype(m);
        if (!aKey) return null;

        // ─── Universal night sleep ──────────────────────────────────────────────────
        // Even archetype NPCs need rest. Force sleep during the deep-night window so
        // workaholic/foodie/etc don't keep streets full at 11pm. Night owls and arena
        // warriors get a slightly later cutoff because grinding late IS their identity.
        const lateCutoff = (aKey === 'night_owl' || aKey === 'arena_warrior') ? 0.96 : 0.94;
        if (dp >= lateCutoff || dp < 0.16) {
            return { act: 'sleep', bid: null };
        }

        // ─── Weekend rest day ───────────────────────────────────────────────────────
        // On Saturdays and Sundays, archetype NPCs defer to the default weekend
        // schedule (parks, cafes, arena, camping). Otherwise workaholics would still
        // be at HQ on a Sunday afternoon, which breaks the "city takes the weekend off"
        // illusion. Returning null here lets data.js fall through to its weekend block.
        const d = new Date().getDay();
        if (d === 0 || d === 6) return null;

        const def = this.ARCHETYPES[aKey];
        if (!def || typeof def.schedule !== 'function') return null;
        try {
            return def.schedule(dp, m);
        } catch (e) {
            return null;
        }
    },

    // ─── Chat hook ──────────────────────────────────────────────────────────────────
    // Returns an archetype-flavored quip (or null) — called from entities.js chat picker
    // with a low probability so normal chats still dominate.
    getGoalChat(m) {
        const aKey = this.getArchetype(m);
        if (!aKey) return null;
        const def = this.ARCHETYPES[aKey];
        if (!def || !def.chats || !def.chats.length) return null;
        return def.chats[Math.floor(Math.random() * def.chats.length)];
    },

    // ─── Debug overlay helper ───────────────────────────────────────────────────────
    // Returns { total, withGoal, byArchetype: { workaholic: n, ... } }
    stats() {
        const out = { total: 0, withGoal: 0, byArchetype: {} };
        if (typeof G === 'undefined' || !Array.isArray(G.models)) return out;
        for (const m of G.models) {
            out.total++;
            const a = this.getArchetype(m);
            if (a) {
                out.withGoal++;
                out.byArchetype[a] = (out.byArchetype[a] || 0) + 1;
            }
        }
        return out;
    },
};
