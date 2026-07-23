/* ══════════════════════════════════════════════════════════════════════════
   UI — HUD (clock, weather, district, AI index), banners, toasts, minimap,
   pause menu, and every data panel: building/citizen cards, census,
   leaderboard, quests, achievements, newspaper, calendar, compute, costs,
   family tree, compare, city map, settings.
   ══════════════════════════════════════════════════════════════════════════ */
import { G, clockString, CITY_W, CITY_D, CELL_W, CELL_D } from './state.js';
import {
    LABS, BM_M, SEED, ROSTER, COSTS, CTX, FAMILIES, AI_EVENTS, SUPPLY_CHAIN,
    COMPUTE_DATA, ACHIEVEMENTS, QUESTS, NEWS, CONFERENCES, activeConference,
    ACTS, STAGES, DC_FACILITIES, SPACE_ORGS, LONGEVITY_COMPANIES, ROBOTICS_COMPANIES, DISTRICTS
} from './data.js';
import { City } from './city.js';

const $ = id => document.getElementById(id);

// deterministic estimated benchmarks for roster models
function estBM(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const r = (n) => 55 + ((h >> n) & 31) + ((h >> (n + 3)) % 9);
    return { MMLU: r(0), HumanEval: r(5), MATH: r(9) - 8, GPQA: r(13) - 12, ELO: 1050 + (h % 260) };
}
function modelBM(m) { return (m.benchmarks && Object.keys(m.benchmarks).length) ? m.benchmarks : estBM(m.name); }
const avg4 = b => Math.round(((b.MMLU || 0) + (b.HumanEval || 0) + (b.MATH || 0) + (b.GPQA || 0)) / 4);

export const UI = {
    els: {},
    _toastN: 0,
    _mapT: 0,
    _hudT: 0,
    aiIndex: 512, aiDelta: 1.2,
    _cmp: [null, null],

    init() {
        ['hud', 'crosshair', 'banner', 'prompt', 'lookLabel', 'hudClock', 'hudWeather', 'hudDistrict',
            'hudIndex', 'hudPop', 'minimap', 'questTracker', 'toasts', 'tourCaption', 'hintBar',
            'panelOverlay', 'panelContent', 'pauseMenu'].forEach(id => this.els[id] = $(id));
        this.mm = this.els.minimap.getContext('2d');

        $('panelClose').onclick = () => this.closePanel();
        this.els.panelOverlay.addEventListener('mousedown', e => {
            if (e.target === this.els.panelOverlay) this.closePanel();
        });
        document.querySelectorAll('#pauseMenu [data-panel]').forEach(btn => {
            btn.onclick = () => { this.hidePause(); this.showPanel(btn.dataset.panel); };
        });

        document.addEventListener('keydown', e => {
            if (!G.started) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.code === 'Tab') {
                e.preventDefault();
                if (G.panelOpen) this.closePanel();
                else if (G.paused) this.hidePause();
                else this.showPause();
            }
            if (e.code === 'Escape' && G.panelOpen) this.closePanel();
            if (e.code === 'KeyM' && !G.panelOpen) {
                this.els.minimap.classList.toggle('hidden');
            }
            if (e.code === 'KeyT' && !G.panelOpen) G.tour.toggle();
        });

        // konami
        const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
        let ki = 0;
        document.addEventListener('keydown', e => {
            if (G.panelOpen) return;
            ki = (e.code === KONAMI[ki]) ? ki + 1 : (e.code === KONAMI[0] ? 1 : 0);
            if (ki === KONAMI.length) { ki = 0; G.progress.konami(); }
        });

        this._recalcIndex();
        setInterval(() => this._recalcIndex(), 30000);
    },

    // ── HUD ─────────────────────────────────────────────────────────
    startHUD() {
        this.els.hud.classList.remove('hidden');
        setTimeout(() => { this.els.hintBar.style.opacity = 0; }, 9000);
        this._updateQuestTracker();
    },

    update(dt) {
        this._hudT -= dt;
        if (this._hudT <= 0) {
            this._hudT = 0.5;
            this.els.hudClock.textContent = clockString(G.dayPhase);
            this.els.hudIndex.innerHTML = `AI INDEX <b>${Math.round(this.aiIndex)}</b>`;
            this.els.hudPop.innerHTML = `POP <b>${G.citizens.list.length}</b>`;
            this._updateQuestTracker();
            // time-of-day achievements
            const h = G.dayPhase * 24;
            if (h >= 0 && h < 5) G.progress.unlock('night_owl');
            if (h >= 5 && h < 7) G.progress.unlock('early_bird');
        }
        if (!this.els.minimap.classList.contains('hidden')) {
            this._mapT -= dt;
            if (this._mapT <= 0) { this._mapT = 0.25; this._drawMinimap(); }
        }
    },

    setWeather(label) { this.els.hudWeather.textContent = label; },
    setDistrict(label) { this.els.hudDistrict.textContent = label; },

    banner(text, sub) {
        const b = this.els.banner;
        b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
        b.classList.remove('hidden');
        clearTimeout(this._bt);
        this._bt = setTimeout(() => b.classList.add('hidden'), 3200);
    },

    prompt(html) {
        if (!html) { this.els.prompt.classList.add('hidden'); return; }
        this.els.prompt.innerHTML = html;
        this.els.prompt.classList.remove('hidden');
    },
    lookLabel(html) {
        if (!html) { this.els.lookLabel.classList.add('hidden'); return; }
        this.els.lookLabel.innerHTML = html;
        this.els.lookLabel.classList.remove('hidden');
    },

    addToast(text, cls) {
        const host = this.els?.toasts || document.getElementById('toasts');
        if (!host) return;
        const t = document.createElement('div');
        t.className = 'toast' + (cls ? ' ' + cls : '');
        t.innerHTML = text;
        host.appendChild(t);
        setTimeout(() => t.classList.add('out'), 3800);
        setTimeout(() => t.remove(), 4500);
        while (host.children.length > 4) host.firstChild.remove();
    },

    event(name, data) { G.progress.event(name, data); },

    _recalcIndex() {
        // Composite of benchmark ceiling, population, lab diversity, OS ratio, compute
        const named = SEED.filter(m => m.benchmarks && Object.keys(m.benchmarks).length);
        const ceiling = Math.max(...named.map(m => avg4(m.benchmarks)));
        const labs = new Set(ROSTER.map(r => r.lab).concat(SEED.map(m => m.lab)));
        const osRatio = ROSTER.filter(r => r.os).length / ROSTER.length;
        const compute = DC_FACILITIES.length * 12;
        const pop = G.citizens.list.length;
        const score = ceiling * 2.5 + pop * 0.55 + labs.size * 8 + osRatio * 60 + compute;
        const prev = this.aiIndex;
        this.aiIndex = Math.min(1000, Math.round(score + Math.sin(Date.now() / 8e5) * 14));
        this.aiDelta = this.aiIndex - prev;
        G.world.aiBoard?.draw(this.aiIndex, this.aiDelta);
    },

    _updateQuestTracker() {
        const next = Object.entries(QUESTS).find(([qid]) => !G.progress.questDone(qid));
        const el = this.els.questTracker;
        if (!next) { el.classList.add('hidden'); return; }
        const [, q] = next;
        el.innerHTML = `<div class="qt-t">◈ CURRENT QUEST</div><b>${q.icon} ${q.title}</b><div class="qt-d">${q.desc}</div>`;
        el.classList.remove('hidden');
    },

    // ── MINIMAP ─────────────────────────────────────────────────────
    _drawMinimap() {
        const c = this.mm, W = 200, H = 170;
        const sx = W / (CITY_W + 1200), sz = H / (CITY_D + 1200);
        const px2mx = x => (x + CITY_W / 2 + 600) * sx;
        const pz2mz = z => (z + CITY_D / 2 + 600) * sz;
        c.clearRect(0, 0, W, H);
        c.fillStyle = '#0a0e1a'; c.fillRect(0, 0, W, H);
        for (const d of City.districts) {
            const col = '#' + d.biomeDef.ground.toString(16).padStart(6, '0');
            c.fillStyle = col;
            c.globalAlpha = 0.75;
            c.fillRect(px2mx(d.cx - CELL_W / 2), pz2mz(d.cz - CELL_D / 2), CELL_W * sx, CELL_D * sz);
            c.globalAlpha = 1;
        }
        // player
        const p = G.camera.position;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(px2mx(p.x), pz2mz(p.z), 3.4, 0, 7); c.fill();
        c.strokeStyle = '#22d3ee'; c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(px2mx(p.x), pz2mz(p.z));
        c.lineTo(px2mx(p.x - Math.sin(G.player.yaw) * 300), pz2mz(p.z - Math.cos(G.player.yaw) * 300));
        c.stroke();
    },

    // ── PAUSE ───────────────────────────────────────────────────────
    showPause() {
        if (!G.started || G.panelOpen) return;
        G.paused = true;
        this.els.pauseMenu.classList.remove('hidden');
        G.player.unlock();
    },
    hidePause() {
        G.paused = false;
        this.els.pauseMenu.classList.add('hidden');
        if (!G.panelOpen && !G.tourMode) G.player.lock();
    },

    // ── PANELS ──────────────────────────────────────────────────────
    showPanel(name, arg) {
        G.panelOpen = true;
        this.els.pauseMenu.classList.add('hidden');
        G.paused = false;
        G.player.unlock();
        this.els.panelOverlay.classList.remove('hidden');
        const fn = {
            census: () => this._pCensus(), leaderboard: () => this._pLeaderboard(),
            quests: () => this._pQuests(), achievements: () => this._pAchievements(),
            newspaper: () => this._pNewspaper(), calendar: () => this._pCalendar(),
            compute: () => this._pCompute(), costs: () => this._pCosts(),
            family: () => this._pFamily(), compare: () => this._pCompare(),
            map: () => this._pMap(), settings: () => this._pSettings(),
            building: () => this._pBuilding(arg), citizen: () => this._pCitizen(arg)
        }[name];
        this.els.panelContent.innerHTML = fn ? fn() : '';
        if (name === 'map') this._drawBigMap();
        if (name === 'census') G.progress.unlock('census_view');
        if (name === 'leaderboard') G.progress.unlock('benchmark_view');
        if (name === 'family') G.progress.unlock('family_view');
        if (name === 'calendar') G.progress.unlock('calendar_view');
        if (name === 'newspaper') G.progress.unlock('news_read');
        G.audio?.sfx('open');
    },
    closePanel() {
        G.panelOpen = false;
        this.els.panelOverlay.classList.add('hidden');
        G.audio?.sfx('close');
        if (!G.tourMode) G.player.lock();
    },
    showBuilding(b) { this.showPanel('building', b); },
    showCitizen(c) {
        G.progress.meetCitizen(c);
        this.showPanel('citizen', c);
    },

    // ── building card ───────────────────────────────────────────────
    _pBuilding(b) {
        const d = City.districts.find(dd => dd.id === b.district);
        let extra = '';
        if (b.lab) {
            const lab = LABS[b.lab];
            const residents = G.citizens.list.filter(c => c.lab === b.lab && c.named);
            const founder = residents.find(c => c.model.founder);
            extra += `<div class="lbl">Resident models</div><div class="ov-grid">` +
                residents.filter(c => !c.model.founder).slice(0, 6).map(c => {
                    const bm = modelBM(c.model);
                    return `<div class="ov-card"><div class="t">${c.model.name}</div>
                        <div class="d">${c.model.personality || ''}</div>
                        <div class="bar"><div style="width:${avg4(bm)}%;background:${lab.color}"></div></div>
                        <div class="d">avg ${avg4(bm)} · ELO ${bm.ELO || '—'}</div></div>`;
                }).join('') + '</div>';
            if (founder) extra += `<div class="lbl">In the corner office</div>
                <div class="ov-card"><div class="t">⭐ ${founder.model.founder.name} — ${founder.model.founder.role}</div>
                <div class="d">${founder.model.founder.fact}</div></div>`;
        }
        if (b.dcData) {
            const dc = b.dcData;
            extra += `<table class="ov-table">
                ${dc.location ? `<tr><td>Location</td><td>${dc.location}</td></tr>` : ''}
                ${dc.gpus ? `<tr><td>Accelerators</td><td>${dc.gpus}</td></tr>` : ''}
                ${dc.power_mw ? `<tr><td>Power draw</td><td>${dc.power_mw} MW</td></tr>` : ''}
                ${dc.cooling ? `<tr><td>Cooling</td><td>${dc.cooling}</td></tr>` : ''}
                ${dc.process ? `<tr><td>Process</td><td>${dc.process}</td></tr>` : ''}
                ${dc.products ? `<tr><td>Products</td><td>${dc.products}</td></tr>` : ''}
                ${dc.investment ? `<tr><td>Investment</td><td>${dc.investment}</td></tr>` : ''}
                <tr><td>Status</td><td>${dc.status === 'construction' ? `🚧 under construction (est. ${dc.completion || '—'})` : '🟢 operational'}</td></tr>
            </table>`;
        }
        if (['solar', 'wind', 'nuclear', 'coal', 'dam'].includes(b.type)) {
            const dp = G.dayPhase;
            const solar = dp > 0.25 && dp < 0.75 ? Math.round(200 * Math.sin((dp - 0.25) * Math.PI * 2)) : 0;
            const mw = { solar, wind: Math.round(150 * (0.4 + G.weatherIntensity * 0.6 + Math.random() * 0.2)), nuclear: 1100, coal: 600, dam: 400 }[b.type];
            extra += `<div class="lbl">Live output</div>
                <div style="font-family:var(--px);font-size:20px;color:#4ade80">${mw} MW</div>
                <div class="d" style="color:var(--t3);font-size:11px;margin-top:6px">Supplying the city's data centers and one very thirsty Colossus.</div>`;
        }
        if (b.type === 'launchpad') {
            const org = SPACE_ORGS[b.org];
            extra += `<div class="lbl">Operator</div><div class="ov-card"><div class="t">${org ? org.icon + ' ' + org.name : '—'}</div>
                <div class="d">Launches lift off regularly — look up when you hear the rumble.</div></div>`;
        }
        if (b.type === 'newspaper') {
            extra += `<button class="btn" style="margin-top:12px" onclick="document.getElementById('panelContent').innerHTML = G.ui._pNewspaper()">📰 Read today's edition</button>`;
        }
        if (b.type === 'black_market') {
            extra += `<div class="lbl">Wares</div><div class="d" style="font-size:12px;color:var(--t3)">Uncensored weights · abliterated checkpoints · "Dolphin" fine-tunes · a suspiciously cheap H100 (falls off truck, twice). No guardrails past this point.</div>`;
        }
        if (b.id === 'convention_center') {
            const ac = activeConference();
            if (ac) {
                extra += `<div class="lbl">In session now</div><div class="ov-card"><div class="t">🎤 ${ac.name}</div><div class="d">${ac.theme}</div></div>`;
                G.progress.unlock('peer_reviewed');
            } else {
                const next = CONFERENCES.map(c => ({ ...c, when: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][c.month - 1]} ${c.startDay}–${c.endDay}` }));
                extra += `<div class="lbl">Season calendar</div>` + next.map(c => `<div class="d" style="font-size:12px;color:var(--t3)">🎤 ${c.name} — ${c.when}</div>`).join('');
            }
        }
        if (b.type === 'monument' && b.id === 'park') {
            const leader = [...SEED].filter(m => m.benchmarks?.ELO).sort((a, z) => z.benchmarks.ELO - a.benchmarks.ELO)[0];
            extra += `<div class="lbl">Currently at the top</div><div class="ov-card"><div class="t">👑 ${leader.name}</div><div class="d">Arena ELO ${leader.benchmarks.ELO}</div></div>`;
        }
        return `
            <div class="bp-head">
                <div class="bp-emoji">${b.emoji || '🏢'}</div>
                <div>
                    <div class="bp-name" ${b.lab ? `style="color:${LABS[b.lab].color}"` : ''}>${b.name}</div>
                    <div class="bp-type">${d ? d.label : ''} · ${(b.fl || 1)} floor${(b.fl || 1) > 1 ? 's' : ''}${b.os ? ' · open source' : ''}</div>
                </div>
            </div>
            <div class="bp-desc">${b.desc || ''}</div>
            ${extra}`;
    },

    // ── citizen card ────────────────────────────────────────────────
    _pCitizen(c) {
        const m = c.model;
        const lab = LABS[m.lab] || LABS.other;
        const st = STAGES[c.stage];
        const act = ACTS[c.act];
        let rows = '';
        if (m.benchmarks && Object.keys(m.benchmarks).length) {
            rows = `<div class="lbl">Benchmarks</div>` + Object.entries(m.benchmarks).map(([k, v]) => {
                const meta = BM_M[k] || { l: k, c: '#4ade80' };
                const pct = k === 'ELO' ? Math.round(((v - 900) / 500) * 100) : v;
                return `<div style="margin-bottom:6px"><span style="font-size:11px">${meta.l}</span>
                    <span style="float:right;font-size:11px">${v}</span>
                    <div class="bar"><div style="width:${Math.max(4, Math.min(100, pct))}%;background:${meta.c}"></div></div></div>`;
            }).join('');
        }
        const arch = m.arch ? `<div class="lbl">Architecture</div><table class="ov-table">
            <tr><td>Parameters</td><td>${m.arch.params}</td></tr><tr><td>Type</td><td>${m.arch.type}</td></tr>
            <tr><td>Training tokens</td><td>${m.arch.tokens}</td></tr><tr><td>Compute</td><td>${m.arch.compute}</td></tr></table>` : '';
        return `
            <div class="bp-head">
                <div class="bp-emoji">${st.emoji}</div>
                <div>
                    <div class="bp-name" style="color:${lab.color}">${m.name}</div>
                    <div class="bp-type">${lab.icon} ${lab.name} · ${st.label}${m.os ? ' · <span class="pill">open weights</span>' : ''}${m.founder ? ' · <span class="pill">founder</span>' : ''}</div>
                </div>
            </div>
            ${m.desc ? `<div class="bp-desc">${m.desc}</div>` : ''}
            <table class="ov-table">
                <tr><td>Right now</td><td>${act.icon} ${act.verb}</td></tr>
                ${m.personality ? `<tr><td>Personality</td><td>${m.personality}</td></tr>` : ''}
                ${m.talent ? `<tr><td>Talent</td><td>${m.talent}</td></tr>` : ''}
                ${m.favSpot ? `<tr><td>Favourite spot</td><td>${m.favSpot}</td></tr>` : ''}
                ${m.founder ? `<tr><td>Note</td><td>${m.founder.fact}</td></tr>` : ''}
            </table>
            ${rows}${arch}`;
    },

    // ── census ──────────────────────────────────────────────────────
    _pCensus() {
        const rows = G.citizens.list
            .slice().sort((a, b) => (b.named - a.named) || a.model.name.localeCompare(b.model.name))
            .map(c => {
                const lab = LABS[c.model.lab] || LABS.other;
                return `<tr>
                    <td>${c.named ? '⭐ ' : ''}${c.model.name}</td>
                    <td style="color:${lab.color}">${lab.name}</td>
                    <td>${STAGES[c.stage].emoji} ${STAGES[c.stage].label}</td>
                    <td>${ACTS[c.act].icon} ${ACTS[c.act].verb}</td>
                    <td>${c.model.os ? '🔓' : ''}</td></tr>`;
            }).join('');
        return `<div class="ov-title">📋 CENSUS — ${G.citizens.list.length} CITIZENS</div>
            <div class="ov-sub">⭐ = famous named model · live activity from the daily schedule</div>
            <table class="ov-table"><tr><th>Model</th><th>Lab</th><th>Stage</th><th>Right now</th><th>OS</th></tr>${rows}</table>`;
    },

    // ── leaderboard ─────────────────────────────────────────────────
    _pLeaderboard() {
        const models = SEED.filter(m => m.benchmarks && Object.keys(m.benchmarks).length)
            .concat(ROSTER.slice(0, 14).map(r => ({ name: r.name, lab: r.lab, benchmarks: estBM(r.name) })))
            .sort((a, b) => (b.benchmarks.ELO || 0) - (a.benchmarks.ELO || 0));
        const rows = models.map((m, i) => {
            const lab = LABS[m.lab] || LABS.other;
            const b = m.benchmarks;
            return `<tr>
                <td>${i === 0 ? '👑' : i + 1}</td>
                <td>${m.name}</td><td style="color:${lab.color}">${lab.name}</td>
                <td>${b.MMLU}</td><td>${b.HumanEval}</td><td>${b.MATH}</td><td>${b.GPQA}</td>
                <td><b>${b.ELO}</b></td></tr>`;
        }).join('');
        return `<div class="ov-title">📊 BENCHMARK LEADERBOARD</div>
            <div class="ov-sub">Sorted by Arena ELO · roster scores are city estimates</div>
            <table class="ov-table"><tr><th>#</th><th>Model</th><th>Lab</th><th>MMLU</th><th>Code</th><th>MATH</th><th>GPQA</th><th>ELO</th></tr>${rows}</table>`;
    },

    // ── quests / achievements ───────────────────────────────────────
    _pQuests() {
        const total = Object.keys(QUESTS).length;
        const done = Object.keys(QUESTS).filter(q => G.progress.questDone(q)).length;
        const pct = Math.round(done / total * 100);
        const cats = {};
        for (const [qid, q] of Object.entries(QUESTS)) {
            (cats[q.cat] = cats[q.cat] || []).push({ qid, q, done: G.progress.questDone(qid) });
        }
        let h = `<div class="ov-title">📜 QUEST LOG — ${done}/${total}</div>
            <div class="bar" style="margin-bottom:16px"><div style="width:${pct}%;background:linear-gradient(90deg,#fbbf24,#f472b6)"></div></div>`;
        for (const cat of ['Exploration', 'Civic Life', 'Natural Events', 'Progress', 'Secrets']) {
            if (!cats[cat]) continue;
            h += `<div class="lbl">${cat}</div><div class="ov-grid">`;
            for (const { q, done } of cats[cat]) {
                h += `<div class="ov-card" style="opacity:${done ? 1 : 0.45}">
                    <div class="t">${q.icon} ${q.title} ${done ? '<span style="color:#4ade80">✓</span>' : ''}</div>
                    <div class="d">${q.desc}</div></div>`;
            }
            h += '</div>';
        }
        return h;
    },

    _pAchievements() {
        const total = Object.keys(ACHIEVEMENTS).length;
        const done = Object.keys(G.achievements).length;
        let h = `<div class="ov-title">🏆 ACHIEVEMENTS — ${done}/${total}</div><div class="ov-grid">`;
        for (const [key, a] of Object.entries(ACHIEVEMENTS)) {
            const got = G.achievements[key];
            h += `<div class="ov-card" style="opacity:${got ? 1 : 0.4}">
                <div class="t">${a.icon} ${a.name}</div><div class="d">${a.desc}</div>
                ${got ? `<div class="d" style="color:var(--ac)">✓ ${new Date(got).toLocaleDateString()}</div>` : ''}</div>`;
        }
        return h + '</div>';
    },

    // ── newspaper ───────────────────────────────────────────────────
    _pNewspaper() {
        const today = new Date();
        const dateStr = today.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const week = Math.floor((today - new Date('2025-01-01')) / (7 * 864e5));
        const lead = NEWS[(week + today.getDate()) % NEWS.length].headline;
        const others = NEWS.filter(n => n.headline !== lead).slice(0, 6);
        const leader = [...SEED].filter(m => m.benchmarks?.ELO).sort((a, b) => b.benchmarks.ELO - a.benchmarks.ELO)[0];
        const ac = activeConference();
        return `<div class="np">
            <div class="np-mast">
                <div class="k">⚙ EST. 2025 ⚙</div>
                <div class="t">SINGULARITY CITY TIMES</div>
                <div class="d">${dateStr.toUpperCase()} · VOL. ${Math.floor(week / 52) + 1} NO. ${week % 52 + 1} · ALL THE NEWS, NEURALLY FIT TO PRINT</div>
            </div>
            <h1>${lead}</h1>
            <div style="display:grid;grid-template-columns:2fr 1fr;gap:26px">
                <div><h3>WIRE HEADLINES</h3><ul>${others.map(n => `<li>${n.headline}</li>`).join('')}</ul></div>
                <div><h3>CITY DESK</h3><ul>
                    <li>Population hits ${G.citizens.list.length} models</li>
                    <li>AI Index at ${Math.round(this.aiIndex)} (${this.aiDelta >= 0 ? '+' : ''}${Math.round(this.aiDelta)})</li>
                    <li>👑 ${leader.name} holds the Arena crown (ELO ${leader.benchmarks.ELO})</li>
                    ${ac ? `<li>🎤 ${ac.name} in session at the Convention Center</li>` : '<li>Convention Center dark until conference season</li>'}
                    <li>Rocket traffic heavy over the Space Zone</li>
                </ul></div>
            </div>
            <div style="margin-top:22px;padding-top:10px;border-top:1px solid #888;font-size:9px;text-align:center;letter-spacing:2px;color:#5a3a14">
                PRINTED ON PROCESSED CARBON · DELIVERED VIA BLIMP · READ UNDER NEON
            </div>
        </div>`;
    },

    // ── calendar ────────────────────────────────────────────────────
    _pCalendar() {
        const evs = [...AI_EVENTS].sort((a, b) => a.date.localeCompare(b.date));
        let h = `<div class="ov-title">📅 EVENTS CALENDAR</div><div class="lbl">Milestones</div>`;
        h += evs.map(e => `<div class="ov-card" style="margin-bottom:6px"><div class="t">${e.type === 'conference' ? '🎤' : '🚀'} ${e.name}
            <span class="pill">${e.date}</span></div><div class="d">${e.desc}</div></div>`).join('');
        h += `<div class="lbl">Conference season</div>` + CONFERENCES.map(c => {
            const active = activeConference()?.id === c.id;
            return `<div class="ov-card" style="margin-bottom:6px;${active ? 'border-color:#4ade80' : ''}">
                <div class="t" style="color:${c.hex}">🎤 ${c.name} ${active ? '— IN SESSION' : ''}</div>
                <div class="d">${c.theme} · every ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][c.month - 1]} ${c.startDay}–${c.endDay}</div></div>`;
        }).join('');
        return h;
    },

    // ── compute ─────────────────────────────────────────────────────
    _pCompute() {
        let h = `<div class="ov-title">🖥️ COMPUTE & SUPPLY CHAIN</div>
            <div class="lbl">Training clusters</div>
            <table class="ov-table"><tr><th>Cluster</th><th>Lab</th><th>Chips</th><th>Type</th></tr>
            ${COMPUTE_DATA.clusters.map(c => `<tr><td>${c.name}</td><td style="color:${(LABS[c.lab] || {}).color}">${(LABS[c.lab] || {}).name}</td><td>${c.gpus.toLocaleString()}</td><td>${c.type}</td></tr>`).join('')}</table>
            <div class="lbl">Supply-chain bottlenecks</div>`;
        h += SUPPLY_CHAIN.bottlenecks.map(b => `<div style="margin-bottom:8px"><span style="font-size:12px">${b.name}</span><span style="float:right">${b.load}%</span>
            <div class="bar"><div style="width:${b.load}%;background:${b.color}"></div></div></div>`).join('');
        h += `<div class="lbl">Foundries</div><table class="ov-table"><tr><th>Fab</th><th>Node</th><th>Capacity</th><th>Packaging</th></tr>
            ${SUPPLY_CHAIN.foundries.map(f => `<tr><td>${f.name}</td><td>${f.node}</td><td>${f.capacity}</td><td>${f.packaging}</td></tr>`).join('')}</table>
            <div class="lbl">Accelerators</div><table class="ov-table"><tr><th>Chip</th><th>Memory</th><th>Status</th><th>Price</th></tr>
            ${SUPPLY_CHAIN.accelerators.map(a => `<tr><td>${a.name}</td><td>${a.memory}</td><td>${a.status}</td><td>${a.price}</td></tr>`).join('')}</table>
            <div class="lbl">Facilities in the Compute District (${DC_FACILITIES.length})</div>`;
        h += `<div class="d" style="font-size:12px;color:var(--t3)">${DC_FACILITIES.map(d => d.name).join(' · ')}</div>`;
        return h;
    },

    // ── costs ───────────────────────────────────────────────────────
    _pCosts() {
        const rows = Object.entries(COSTS).map(([id, c]) => {
            const m = SEED.find(mm => mm.id === id);
            const lab = m ? LABS[m.lab] : null;
            return `<tr><td>${m ? m.name : id}</td><td style="color:${lab ? lab.color : '#fff'}">${lab ? lab.name : ''}</td>
                <td>$${c.input.toFixed(2)}</td><td>$${c.output.toFixed(2)}</td><td>${(CTX[id] || 0).toLocaleString()}</td></tr>`;
        }).join('');
        return `<div class="ov-title">💲 API COSTS</div>
            <div class="ov-sub">per 1M tokens · context window in tokens</div>
            <table class="ov-table"><tr><th>Model</th><th>Lab</th><th>Input</th><th>Output</th><th>Context</th></tr>${rows}</table>`;
    },

    // ── family tree ─────────────────────────────────────────────────
    _pFamily() {
        let h = `<div class="ov-title">🧬 MODEL FAMILY TREES</div>`;
        for (const [labId, tree] of Object.entries(FAMILIES)) {
            const lab = LABS[labId];
            h += `<div class="lbl" style="color:${lab.color}">${lab.icon} ${lab.name}</div>`;
            for (const node of tree) {
                const parent = SEED.find(m => m.id === node.id);
                h += `<div class="ov-card" style="margin-bottom:6px"><div class="t">${parent ? parent.name : node.id}</div>
                    <div class="d">└─ begat: ${node.children.map(cid => (SEED.find(m => m.id === cid) || { name: cid }).name).join(', ')}</div></div>`;
            }
        }
        return h;
    },

    // ── compare ─────────────────────────────────────────────────────
    _pCompare() {
        const [a, b] = this._cmp;
        const opts = SEED.map(m =>
            `<option value="${m.id}" ${m.id === a ? 'selected' : ''}>${m.name}</option>`).join('');
        const optsB = SEED.map(m =>
            `<option value="${m.id}" ${m.id === b ? 'selected' : ''}>${m.name}</option>`).join('');
        let table = '';
        if (a && b) {
            const ma = SEED.find(m => m.id === a), mb = SEED.find(m => m.id === b);
            const ba = modelBM(ma), bb = modelBM(mb);
            table = `<table class="ov-table" style="margin-top:14px"><tr><th></th><th>${ma.name}</th><th>${mb.name}</th></tr>
                ${['MMLU', 'HumanEval', 'MATH', 'GPQA', 'ELO'].map(k => {
                    const va = ba[k] || 0, vb = bb[k] || 0;
                    return `<tr><td>${k}</td>
                        <td style="color:${va >= vb ? '#4ade80' : 'inherit'}">${va || '—'}</td>
                        <td style="color:${vb >= va ? '#4ade80' : 'inherit'}">${vb || '—'}</td></tr>`;
                }).join('')}
                <tr><td>Context</td><td>${(CTX[a] || 0).toLocaleString()}</td><td>${(CTX[b] || 0).toLocaleString()}</td></tr>
                <tr><td>Price in/out</td><td>${COSTS[a] ? `$${COSTS[a].input}/$${COSTS[a].output}` : '—'}</td><td>${COSTS[b] ? `$${COSTS[b].input}/$${COSTS[b].output}` : '—'}</td></tr></table>`;
        }
        setTimeout(() => {
            const sa = $('cmpA'), sb = $('cmpB');
            if (sa) sa.onchange = () => { this._cmp[0] = sa.value; if (this._cmp[0] && this._cmp[1]) { G.progress.unlock('compared'); this.showPanel('compare'); } };
            if (sb) sb.onchange = () => { this._cmp[1] = sb.value; if (this._cmp[0] && this._cmp[1]) { G.progress.unlock('compared'); this.showPanel('compare'); } };
        }, 0);
        return `<div class="ov-title">⚖️ MODEL COMPARISON</div>
            <div style="display:flex;gap:12px">
                <select id="cmpA" class="btn" style="flex:1"><option value="">— pick model A —</option>${opts}</select>
                <select id="cmpB" class="btn" style="flex:1"><option value="">— pick model B —</option>${optsB}</select>
            </div>
            ${table || '<div class="d" style="color:var(--t3);margin-top:14px;font-size:12px">Select two named models to compare benchmarks, context and price.</div>'}`;
    },

    // ── big map ─────────────────────────────────────────────────────
    // max-height keeps the whole grid on screen — at width:100% the bottom
    // row of districts fell outside the panel and you had to scroll for it
    _pMap() { return `<div class="ov-title">🗺️ CITY MAP</div><canvas id="bigMap" width="780" height="640" style="max-width:100%;max-height:58vh;display:block;margin:0 auto;border:1px solid var(--bd);border-radius:4px"></canvas>
        <div class="d" style="color:var(--t3);font-size:11px;margin-top:8px">You are the white dot. Sea to the west, Space Zone north-west, Underground south-west.</div>`; },
    _drawBigMap() {
        const cv = $('bigMap');
        if (!cv) return;
        const c = cv.getContext('2d'), W = cv.width, H = cv.height;
        const sx = W / (CITY_W + 2200), sz = H / (CITY_D + 1600);
        const mx = x => (x + CITY_W / 2 + 1100) * sx;
        const mz = z => (z + CITY_D / 2 + 800) * sz;
        c.fillStyle = '#070b14'; c.fillRect(0, 0, W, H);
        // sea
        c.fillStyle = '#12283e';
        c.fillRect(0, 0, mx(-CITY_W / 2 - 100), H);
        for (const d of City.districts) {
            c.fillStyle = '#' + d.biomeDef.ground.toString(16).padStart(6, '0');
            c.fillRect(mx(d.cx - CELL_W / 2), mz(d.cz - CELL_D / 2), CELL_W * sx, CELL_D * sz);
            c.fillStyle = G.visitedDistricts[d.id] ? '#e2e8f0' : '#5a6480';
            c.textAlign = 'center';
            // "🖥️ Compute District" on one 10px line is wider than an 89px
            // cell, so labels used to run across their neighbours — wrap the
            // words to the cell instead
            this._mapLabel(c, d.label, mx(d.cx), mz(d.cz), CELL_W * sx - 8);
        }
        const p = G.camera.position;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(mx(p.x), mz(p.z), 5, 0, 7); c.fill();
        c.strokeStyle = '#22d3ee'; c.lineWidth = 2;
        c.beginPath(); c.arc(mx(p.x), mz(p.z), 8, 0, 7); c.stroke();
    },

    // word-wrap a district label into its cell, shrinking a step if a single
    // word still will not fit
    _mapLabel(c, label, cx, cy, maxW) {
        c.font = '10px Silkscreen, monospace';
        const words = label.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            const next = line ? line + ' ' + w : w;
            if (line && c.measureText(next).width > maxW) { lines.push(line); line = w; }
            else line = next;
        }
        if (line) lines.push(line);
        if (lines.some(l => c.measureText(l).width > maxW)) c.font = '8px Silkscreen, monospace';
        const lh = 11;
        const top = cy - ((lines.length - 1) * lh) / 2 + 3;
        lines.forEach((l, i) => c.fillText(l, cx, top + i * lh));
    },

    // ── settings ────────────────────────────────────────────────────
    _pSettings() {
        setTimeout(() => {
            const q = $('setQuality'), v = $('setVol'), s = $('setSens'), iy = $('setInvert'), f = $('setFov'), mu = $('setMusic'), ts = $('setTS'), rs = $('setReset');
            if (q) q.onchange = () => {
                localStorage.setItem('sc_fp_quality', q.value);
                if (confirm('Reload the city with ' + q.value + ' quality?')) location.reload();
                q.value = G.quality;
            };
            // Every one of these saves: sliders used to change the live value
            // and never persist, so FOV and sensitivity were silently lost on
            // reload unless an unrelated achievement happened to save first.
            if (v) v.oninput = () => { G.audio.setVolume(parseFloat(v.value)); G.progress.save(); };
            if (s) s.oninput = () => { G.settings.sensitivity = parseFloat(s.value); G.progress.save(); };
            if (iy) iy.onchange = () => { G.settings.invertY = iy.checked; G.progress.save(); };
            if (f) f.oninput = () => { G.settings.fov = parseInt(f.value); G.camera.fov = G.settings.fov; G.camera.updateProjectionMatrix(); G.progress.save(); };
            if (mu) mu.onchange = () => { G.audio.toggleMusic(mu.checked); G.progress.save(); };
            if (ts) ts.onchange = () => { G.timeScale = parseInt(ts.value); G.settings.timeScale = G.timeScale; G.progress.save(); };
            if (rs) rs.onclick = () => {
                if (rs.dataset.armed) { localStorage.removeItem('sc_fp_save_v1'); location.reload(); }
                rs.dataset.armed = '1'; rs.textContent = '⚠️ Click again to confirm wipe';
            };
        }, 0);
        return `<div class="ov-title">⚙️ SETTINGS</div>
            <table class="ov-table">
                <tr><td>Quality (draw distance / particles / population)</td><td>
                    <select id="setQuality" class="btn">
                        <option value="low" ${G.quality === 'low' ? 'selected' : ''}>Low</option>
                        <option value="medium" ${G.quality === 'medium' ? 'selected' : ''}>Medium</option>
                        <option value="high" ${G.quality === 'high' ? 'selected' : ''}>High</option>
                    </select></td></tr>
                <tr><td>Master volume</td><td><input id="setVol" type="range" min="0" max="1" step="0.05" value="${G.settings.volume}"></td></tr>
                <tr><td>Music</td><td><input id="setMusic" type="checkbox" ${G.settings.music ? 'checked' : ''}></td></tr>
                <tr><td>Mouse sensitivity</td><td><input id="setSens" type="range" min="0.3" max="2.5" step="0.1" value="${G.settings.sensitivity}"></td></tr>
                <tr><td>Invert Y</td><td><input id="setInvert" type="checkbox" ${G.settings.invertY ? 'checked' : ''}></td></tr>
                <tr><td>Field of view</td><td><input id="setFov" type="range" min="55" max="100" step="1" value="${G.settings.fov}"></td></tr>
                <tr><td>Time flow</td><td><select id="setTS" class="btn">
                    <option value="1" ${G.timeScale === 1 ? 'selected' : ''}>Real time</option>
                    <option value="60" ${G.timeScale === 60 ? 'selected' : ''}>1 hour / min</option>
                    <option value="240" ${G.timeScale === 240 ? 'selected' : ''}>4 hours / min</option>
                </select></td></tr>
                <tr><td>Progress</td><td><button id="setReset" class="btn">🗑 Reset save</button></td></tr>
            </table>
            <div class="lbl">Controls</div>
            <div class="d" style="font-size:12px;color:var(--t3)">WASD move · Shift sprint · Space jump · E interact · TAB panels · M minimap · T auto-tour · ESC pause/release mouse</div>`;
    }
};
