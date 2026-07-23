/* ══════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (D) — Bloomberg-style data terminal over the city.
   Implemented last among modes per owner directive. HTML overlay, no
   extra WebGL cost while open. Escape / D closes and returns to FP.
   ══════════════════════════════════════════════════════════════════════════ */
import { G, clockString } from './state.js';
import {
    LABS, SEED, ROSTER, NEWS, CONFERENCES, activeConference,
    DC_FACILITIES, COMPUTE_DATA, COSTS, TRAM_LINES
} from './data.js';
import { kardashevScale } from './kardashev.js';

export function buildTerminalModel(Gref) {
    const labs = Object.keys(LABS).map(id => ({
        id,
        name: LABS[id].name,
        region: LABS[id].region,
        color: LABS[id].color
    }));
    const models = SEED.filter(m => m.phase !== 'retired').slice(0, 24).map(m => ({
        id: m.id, name: m.name, lab: m.lab, phase: m.phase
    }));
    const idx = Gref.ui?.aiIndex ?? 512;
    const k = kardashevScale(idx);
    return {
        clock: clockString(Gref.dayPhase || 0.5),
        weather: Gref.weatherSys?.state || 'clear',
        district: Gref.districtAt?.label || 'Singularity City',
        aiIndex: idx,
        kardashev: k,
        pop: Gref.citizens?.list?.length || 0,
        labs,
        models,
        news: (NEWS || []).slice(0, 8),
        conferences: CONFERENCES,
        activeConf: activeConference(),
        datacenters: (DC_FACILITIES || []).slice(0, 12).map(d => ({
            id: d.id, name: d.name, operator: d.operator, location: d.location
        })),
        metro: TRAM_LINES,
        costs: COSTS ? Object.keys(COSTS).slice(0, 10) : [],
        compute: COMPUTE_DATA || null,
        deals: Gref.vcDealFlow?.dealsCompleted ?? 0,
        papers: Gref.researchPapers?.delivered ?? 0,
        jail: Gref.jail?.snapshot?.() || null,
        court: Gref.court?.snapshot?.() || null
    };
}

export function terminalHtml(model) {
    const labRows = model.labs.map(l =>
        `<div class="term-row"><span style="color:${l.color}">●</span> ${l.name} <em>${l.region || ''}</em></div>`
    ).join('');
    const modelRows = model.models.map(m =>
        `<div class="term-row">${m.name} <em>${m.lab} · ${m.phase}</em></div>`
    ).join('');
    const newsRows = model.news.map(n =>
        `<div class="term-row">▸ ${n.headline || n.title || JSON.stringify(n).slice(0, 60)}</div>`
    ).join('');
    const dcRows = model.datacenters.map(d =>
        `<div class="term-row">${d.name} <em>${d.operator} · ${d.location}</em></div>`
    ).join('');
    const conf = model.activeConf
        ? `${model.activeConf.name} (LIVE)`
        : 'none this week';
    return `
    <div class="term-top">
      <div class="term-brand">SC TERMINAL <span>// BLOOMBERG MODE</span></div>
      <div class="term-meta">${model.clock} · ${model.weather} · ${model.district}</div>
      <button type="button" id="termClose" class="term-close">✕</button>
    </div>
    <div class="term-grid">
      <section class="term-panel">
        <h3>AI INDEX</h3>
        <div class="term-big">${Math.round(model.aiIndex)}</div>
        <div class="term-sub">${model.kardashev.tier} · K=${model.kardashev.k}</div>
        <div class="term-sub">POP ${model.pop} · DEALS ${model.deals} · PAPERS ${model.papers}</div>
      </section>
      <section class="term-panel">
        <h3>LABS</h3>
        <div class="term-scroll">${labRows}</div>
      </section>
      <section class="term-panel">
        <h3>MODELS</h3>
        <div class="term-scroll">${modelRows}</div>
      </section>
      <section class="term-panel">
        <h3>NEWS WIRE</h3>
        <div class="term-scroll">${newsRows}</div>
      </section>
      <section class="term-panel">
        <h3>DATACENTERS</h3>
        <div class="term-scroll">${dcRows}</div>
      </section>
      <section class="term-panel">
        <h3>CITY SYSTEMS</h3>
        <div class="term-row">Conference: ${conf}</div>
        <div class="term-row">Metro lines: ${model.metro.map(t => t.id).join(', ')}</div>
        <div class="term-row">Jail inmates: ${model.jail?.inmates ?? '—'}</div>
        <div class="term-row">Court: ${model.court?.current || 'idle'} (${model.court?.rulings ?? 0} rulings)</div>
        <div class="term-row">API costs tracked: ${model.costs.length}</div>
      </section>
    </div>
    <div class="term-foot">D / ESC close · data from static data.js (no live APIs)</div>`;
}

export const Terminal = {
    open: false,
    el: null,

    init() {
        let el = document.getElementById('terminal');
        if (!el) {
            el = document.createElement('div');
            el.id = 'terminal';
            el.className = 'hidden';
            document.body.appendChild(el);
        }
        this.el = el;

        document.addEventListener('keydown', e => {
            if (!G.started) return;
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            // KeyD alone is WASD strafe — open terminal with Ctrl/Meta+D, backtick,
            // or plain D when pointer is unlocked (pause / menu). Closes with D too.
            const dTerm = e.code === 'KeyD' && (e.ctrlKey || e.metaKey || !G.player?.locked || this.open);
            const tick = e.code === 'Backquote';
            if ((dTerm || tick) && !e.repeat && (!G.panelOpen || this.open)) {
                e.preventDefault();
                this.toggle();
            }
            if (e.code === 'Escape' && this.open) {
                e.preventDefault();
                this.close();
            }
        });
    },

    toggle() {
        if (this.open) this.close();
        else this.show();
    },

    show() {
        if (G.orbitMode) G.orbitModeSys?.exit?.();
        if (G.xrayMode) G.xrayModeSys?.exit?.();
        if (G.holomapMode) G.holomap?.exit?.();
        this.open = true;
        G.terminalOpen = true;
        G.panelOpen = true; // block game keys similarly
        G.player?.unlock?.();
        const model = buildTerminalModel(G);
        this.el.innerHTML = terminalHtml(model);
        this.el.classList.remove('hidden');
        const btn = document.getElementById('termClose');
        if (btn) btn.onclick = () => this.close();
        G.progress?.unlock?.('terminal_open');
    },

    close() {
        this.open = false;
        G.terminalOpen = false;
        G.panelOpen = false;
        if (this.el) {
            this.el.classList.add('hidden');
            this.el.innerHTML = '';
        }
        if (G.started && !G.paused) G.player?.lock?.();
    },

    update(_dt) {
        // live clock refresh while open (cheap)
        if (!this.open || !this.el) return;
        const clock = this.el.querySelector('.term-meta');
        if (clock) {
            clock.textContent = `${clockString(G.dayPhase)} · ${G.weatherSys?.state || 'clear'} · ${G.districtAt?.label || 'Singularity City'}`;
        }
    },

    snapshot() {
        return {
            open: this.open,
            boundKey: 'KeyD',
            aliases: ['Backquote', 'Ctrl+KeyD'],
            hasEl: !!this.el,
            modelKeys: Object.keys(buildTerminalModel(G))
        };
    }
};
