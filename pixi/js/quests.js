/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   QUEST LOG (v1.0.0 — Phase 1, Roadmap Feature #4)
   Additive checklist layer on top of the existing ACHIEVEMENTS system. Each quest binds to
   one or more achievement keys; completion is derived live from G.achievements (which is
   already persisted by persistence.js), so no new storage is introduced.

   The only engine hook is a single additive line in G.unlockAchieve() that forwards the
   key here — existing achievement logic is untouched.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const QUESTS = {
    // ── 🧭 EXPLORATION ──────────────────────────────────────────────────────────
    visit_black_market: {
        title: 'Into the Underground',
        desc: 'Find the hidden entrance to the Black Market.',
        icon: '🕶️',
        cat: 'Exploration',
        achieves: ['shadow_market']
    },
    crack_silo: {
        title: 'Silo Breach',
        desc: "Scroll below a CEO villa to reach the secure bunker.",
        icon: '🔓',
        cat: 'Exploration',
        achieves: ['silo_breach']
    },
    interior_10: {
        title: 'Interior Designer',
        desc: 'Enter 10 different building interiors.',
        icon: '🏠',
        cat: 'Exploration',
        achieves: ['interior_designer']
    },
    holomap_tourist: {
        title: 'Galactic Tourist',
        desc: 'Open the 3D Holomap and survey the planet.',
        icon: '🌌',
        cat: 'Exploration',
        achieves: ['galactic_tourist']
    },
    hn_blimp: {
        title: 'Ear to the Ground',
        desc: 'Click a HackerNews blimp drifting over the city.',
        icon: '🗞️',
        cat: 'Exploration',
        achieves: ['hn_read']
    },

    // ── 🌍 NATURAL EVENTS ───────────────────────────────────────────────────────
    see_aurora: {
        title: 'Stargazer',
        desc: 'Witness an aurora borealis or comet over the city.',
        icon: '✨',
        cat: 'Natural Events',
        achieves: ['stargazer']
    },
    see_rain: {
        title: 'Tears in Rain',
        desc: 'Stay in the city through a rainstorm.',
        icon: '🌧️',
        cat: 'Natural Events',
        achieves: ['rain_seen']
    },
    see_snow: {
        title: 'Nuclear Winter',
        desc: 'Watch snow settle across the skyline.',
        icon: '❄️',
        cat: 'Natural Events',
        achieves: ['snow_seen']
    },
    see_thunder: {
        title: 'Thunderstruck',
        desc: 'Weather a full thunderstorm with lightning.',
        icon: '⛈️',
        cat: 'Natural Events',
        achieves: ['thunder_seen']
    },
    see_fog: {
        title: 'Walk in the Fog',
        desc: 'Navigate the city through thick fog.',
        icon: '🌫️',
        cat: 'Natural Events',
        achieves: ['fog_seen']
    },
    night_owl: {
        title: 'Night Owl',
        desc: 'Visit the city between midnight and 5am local time.',
        icon: '🦉',
        cat: 'Natural Events',
        achieves: ['night_owl']
    },

    // ── 🎓 CIVIC LIFE ───────────────────────────────────────────────────────────
    witness_graduation: {
        title: 'Graduation Day',
        desc: 'Witness a model graduate from the AI Academy.',
        icon: '🎓',
        cat: 'Civic Life',
        achieves: ['graduation_day']
    },
    attend_conference: {
        title: 'Peer Reviewed',
        desc: 'Visit a conference during session week.',
        icon: '🎤',
        cat: 'Civic Life',
        achieves: ['peer_reviewed']
    },
    rocket_launch: {
        title: 'Rocket Scientist',
        desc: 'Witness a real rocket launch from the Space Zone.',
        icon: '🚀',
        cat: 'Civic Life',
        achieves: ['rocket_scientist']
    },
    train_10: {
        title: 'Train Spotter',
        desc: 'Watch 10 metro trains depart their platforms.',
        icon: '🚇',
        cat: 'Civic Life',
        achieves: ['train_spotter']
    },

    // ── 🏆 PROGRESS ─────────────────────────────────────────────────────────────
    scan_first: {
        title: 'Hello World',
        desc: 'Initiate your first network scan.',
        icon: '🛰️',
        cat: 'Progress',
        achieves: ['first_scan']
    },
    witness_first: {
        title: 'Witness',
        desc: 'Discover a new model hitting the market.',
        icon: '👀',
        cat: 'Progress',
        achieves: ['witnessed']
    },
    pop_10: {
        title: 'Population 10',
        desc: 'Grow the city to 10 discovered models.',
        icon: '🏘️',
        cat: 'Progress',
        achieves: ['ten_models']
    },
    pop_50: {
        title: 'Metropolis',
        desc: 'Grow the population to 50 discovered models.',
        icon: '🏙️',
        cat: 'Progress',
        achieves: ['fifty_models']
    },
    pop_100: {
        title: 'Century Club',
        desc: 'Grow the population to 100 discovered models.',
        icon: '💯',
        cat: 'Progress',
        achieves: ['hundred_models']
    },
    all_labs: {
        title: 'Monopoly',
        desc: 'Discover models from 7 different labs.',
        icon: '🎩',
        cat: 'Progress',
        achieves: ['all_labs']
    },
    bench_view: {
        title: 'Stathead',
        desc: 'Check the full leaderboard.',
        icon: '📊',
        cat: 'Progress',
        achieves: ['benchmark_view']
    },
    census_view: {
        title: 'Demographer',
        desc: 'View the full census.',
        icon: '📋',
        cat: 'Progress',
        achieves: ['census_view']
    },
    family_view: {
        title: 'Genealogist',
        desc: 'View a model family tree.',
        icon: '🧬',
        cat: 'Progress',
        achieves: ['family_view']
    },
    calendar_view: {
        title: 'Planner',
        desc: 'Check the events calendar.',
        icon: '📅',
        cat: 'Progress',
        achieves: ['calendar_view']
    },
    compared: {
        title: 'Analyst',
        desc: 'Use the comparison tool on two or more models.',
        icon: '⚖️',
        cat: 'Progress',
        achieves: ['compared']
    },

    // ── 🎮 SECRETS ──────────────────────────────────────────────────────────────
    konami: {
        title: 'The Chosen One',
        desc: 'Enter the legendary code.',
        icon: '🕹️',
        cat: 'Secrets',
        achieves: ['konami']
    },
    cat_mode: {
        title: 'Caturday',
        desc: 'Unleash the cats upon the city.',
        icon: '🐱',
        cat: 'Secrets',
        achieves: ['cat_mode']
    },
    holiday: {
        title: 'Holiday Spirit',
        desc: 'Visit during 3+ seasonal events.',
        icon: '🎄',
        cat: 'Secrets',
        achieves: ['holiday_spirit']
    }
};

const Quests = {
    _tab: 'all',

    isDone(qid) {
        const q = QUESTS[qid];
        if (!q || !q.achieves) return false;
        if (typeof G === 'undefined' || !G.achievements) return false;
        return q.achieves.some(k => G.achievements[k]);
    },

    doneAt(qid) {
        const q = QUESTS[qid];
        if (!q || !q.achieves) return 0;
        if (typeof G === 'undefined' || !G.achievements) return 0;
        const times = q.achieves.map(k => G.achievements[k]).filter(t => t);
        return times.length ? Math.min(...times) : 0;
    },

    // Called from G.unlockAchieve(). Fires a toast only when a quest transitions
    // from incomplete → complete (i.e., this is the first of its mapped achievements
    // to unlock). Because unlockAchieve() dedupes and sets G.achievements[key] before
    // calling here, we check "any OTHER mapped key already set" to avoid re-toasting.
    onAchievement(key) {
        if (typeof G === 'undefined' || !G.achievements) return;
        for (const qid in QUESTS) {
            const q = QUESTS[qid];
            if (!q.achieves || !q.achieves.includes(key)) continue;
            const otherAlreadyDone = q.achieves.some(k => k !== key && G.achievements[k]);
            if (otherAlreadyDone) continue;
            if (typeof UI !== 'undefined' && UI.addToast) {
                UI.addToast(`📜 Quest complete: ${q.icon} ${q.title}`);
            }
        }
    },

    showPanel() {
        if (typeof G === 'undefined') return;
        const ov = document.getElementById('questsOv');
        const pan = document.getElementById('questsPan');
        if (!ov || !pan) return;
        ov.classList.add('open');
        this.renderPanel();
    },

    renderPanel() {
        const pan = document.getElementById('questsPan');
        if (!pan) return;
        const total = Object.keys(QUESTS).length;
        const doneCount = Object.keys(QUESTS).filter(k => this.isDone(k)).length;
        const pct = total ? Math.round((doneCount / total) * 100) : 0;

        const cats = {};
        for (const qid in QUESTS) {
            const q = QUESTS[qid];
            const completed = this.isDone(qid);
            if (this._tab === 'active' && completed) continue;
            if (this._tab === 'completed' && !completed) continue;
            const cat = q.cat || 'Other';
            if (!cats[cat]) cats[cat] = [];
            cats[cat].push({ qid, q, completed });
        }

        let h = `<button class="ipanel-x" onclick="document.getElementById('questsOv').classList.remove('open')">✕</button>
            <div class="ov-title">📜 QUEST LOG — ${doneCount}/${total}</div>
            <div style="height:6px;background:var(--bd);border-radius:3px;margin-bottom:14px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#fbbf24,#f472b6);transition:width .4s"></div>
            </div>
            <div style="display:flex;gap:6px;margin-bottom:16px">
                ${['all', 'active', 'completed'].map(t => `
                    <button class="btn" style="padding:6px 12px;flex:1;justify-content:center;${this._tab === t ? 'background:var(--sf);border-color:var(--ac);color:var(--ac)' : ''}"
                        onclick="Quests._tab='${t}';Quests.renderPanel()">
                        ${t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                `).join('')}
            </div>`;

        const catOrder = ['Exploration', 'Civic Life', 'Natural Events', 'Progress', 'Secrets', 'Other'];
        let hasAny = false;
        catOrder.forEach(cat => {
            if (!cats[cat] || !cats[cat].length) return;
            hasAny = true;
            h += `<div style="font-size:8px;color:var(--t3);margin:12px 0 6px 0;letter-spacing:1.2px;text-transform:uppercase">${cat}</div><div class="pop-grid" style="gap:6px">`;
            cats[cat].forEach(({ qid, q, completed }) => {
                const stamp = completed ? new Date(this.doneAt(qid)).toLocaleDateString() : '';
                h += `<div class="pop-card" style="opacity:${completed ? 1 : .42};background:${completed ? 'var(--cd)' : 'var(--sf)'}">
                    <span style="font-size:20px">${q.icon}</span>
                    <div style="flex:1">
                        <div style="font-size:9px;font-weight:700">${q.title}</div>
                        <div style="font-size:7px;color:var(--t3)">${q.desc}</div>
                        ${completed ? `<div style="font-size:6px;color:var(--ac);margin-top:2px">✓ ${stamp}</div>` : ''}
                    </div>
                </div>`;
            });
            h += `</div>`;
        });
        if (!hasAny) {
            const msg = this._tab === 'completed'
                ? 'No quests completed yet. Go explore the city!'
                : "All quests complete — you've seen it all.";
            h += `<div style="text-align:center;padding:40px 20px;color:var(--t3);font-size:9px">${msg}</div>`;
        }

        pan.innerHTML = h;
    }
};
