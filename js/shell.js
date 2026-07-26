/* ============================================================================
   SHELL — view toggle + shared chrome for the integrated product.

   Views:
     - fp   : Three.js first-person
     - map  : Canvas city overview (same store, no Pixi)
     - pixi : Hard-swap navigation to vendored 2D app at ./pixi/
              (full production Pixi copy living in this repo)
   ============================================================================ */

import { CityStore } from './store/city_store.js';
import { INTEGRATION, flagEnabled } from './store/config.js';
import { G, CELL_W, CELL_D, CITY_W, CITY_D } from './state.js';
import { City } from './city.js';
import { DISTRICTS, LABS, BLDS } from './data.js';
import { goPixi2D } from './store/nav.js';

let _els = {};
let _mapCanvas = null;
let _mapCtx = null;
let _raf = 0;
let _unsub = null;
let _lastToken = null;

function ensureDom() {
    if (document.getElementById('scShell')) return;

    const shell = document.createElement('div');
    shell.id = 'scShell';
    shell.innerHTML = `
      <div class="sc-shell-bar" role="banner">
        <div class="sc-shell-brand">
          <span class="sc-shell-mark">🏙</span>
          <span class="sc-shell-title">SINGULARITY CITY</span>
          <span class="sc-shell-mode" id="scShellMode">FP</span>
        </div>
        <div class="sc-shell-views" role="toolbar" aria-label="View mode">
          <button type="button" class="sc-shell-btn active" data-view="fp" title="First-person streets">🚶 First Person</button>
          <button type="button" class="sc-shell-btn" data-view="map" title="Top-down city map (shared state)">🗺 City Map</button>
        </div>
        <div class="sc-shell-meta">
          <span id="scLiveBadge" class="sc-live-badge offline" title="Live data status">OFFLINE</span>
          <span id="scShellClock" class="sc-shell-clock">--:--</span>
          ${flagEnabled('classic2dLink')
            ? `<button type="button" class="sc-shell-link sc-shell-pixi-btn" id="scGoPixi" title="Hard-swap to vendored Pixi 2D city (same repo)">🗺 2D City</button>`
            : ''}
        </div>
      </div>
      <div id="scMapView" class="sc-map-view hidden" aria-hidden="true">
        <div class="sc-map-hud">
          <div>
            <div class="sc-map-h1">City Map</div>
            <div class="sc-map-sub" id="scMapSub">Shared CityStore · same clock, weather, news &amp; progress as First Person</div>
          </div>
          <div class="sc-map-side">
            <div id="scMapWeather">—</div>
            <div id="scMapIndex">AI INDEX —</div>
            <div id="scMapCotd">COTD —</div>
          </div>
        </div>
        <canvas id="scMapCanvas" width="1200" height="900"></canvas>
        <div class="sc-map-news" id="scMapNews"></div>
        <div class="sc-map-hint">Click a district to resume First Person near its centre · Esc / 🚶 to return · V toggles</div>
      </div>
    `;
    document.body.appendChild(shell);

    _els = {
        shell,
        mode: document.getElementById('scShellMode'),
        live: document.getElementById('scLiveBadge'),
        clock: document.getElementById('scShellClock'),
        mapView: document.getElementById('scMapView'),
        mapSub: document.getElementById('scMapSub'),
        mapWeather: document.getElementById('scMapWeather'),
        mapIndex: document.getElementById('scMapIndex'),
        mapCotd: document.getElementById('scMapCotd'),
        mapNews: document.getElementById('scMapNews'),
        buttons: [...shell.querySelectorAll('[data-view]')]
    };
    _mapCanvas = document.getElementById('scMapCanvas');
    _mapCtx = _mapCanvas.getContext('2d');

    for (const btn of _els.buttons) {
        btn.addEventListener('click', () => Shell.setView(btn.dataset.view));
    }
    const goPixiBtn = document.getElementById('scGoPixi');
    if (goPixiBtn) {
        goPixiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Shell.goPixi();
        });
    }
    _mapCanvas.addEventListener('click', onMapClick);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && CityStore.getView() === 'map') {
            Shell.setView('fp');
        }
        if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (G.terminalOpen) return;
            Shell.goPixi();
            return;
        }
        if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (G.terminalOpen) return;
            if (G.panelOpen && CityStore.getView() !== 'map') return;
            Shell.setView(CityStore.getView() === 'fp' ? 'map' : 'fp');
        }
    });
}

function clockString(dp) {
    const h = Math.floor(dp * 24);
    const m = Math.floor((dp * 24 - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function applyChrome(snap) {
    if (!_els.mode) return;
    _els.mode.textContent = snap.view === 'map' ? 'MAP' : 'FP';
    for (const btn of _els.buttons) {
        btn.classList.toggle('active', btn.dataset.view === snap.view);
    }
    const live = snap.live || {};
    _els.live.textContent = live.online ? 'LIVE' : (live.error ? 'CACHE' : 'OFFLINE');
    _els.live.className = 'sc-live-badge ' + (live.online ? 'online' : 'offline');
    _els.live.title = live.sources?.length
        ? `Sources: ${live.sources.join(', ')}${live.models != null ? ` · ${live.models} models` : ''}`
        : 'Live data';
    _els.clock.textContent = clockString(snap.dayPhase);

    if (snap.view === 'map') {
        _els.mapWeather.textContent = `${snap.weather?.state || 'clear'} · ${Math.round((snap.weather?.intensity || 0) * 100)}%`;
        _els.mapIndex.textContent = `AI INDEX ${Math.round(snap.aiIndex)}`;
        if (snap.cotd) {
            const lab = LABS[snap.cotd.lab]?.name || snap.cotd.lab || '';
            _els.mapCotd.textContent = `COTD ${snap.cotd.name || snap.cotd.modelId}${lab ? ' · ' + lab : ''}`;
        } else {
            _els.mapCotd.textContent = 'COTD —';
        }
        const news = (snap.news || []).slice(0, 6);
        _els.mapNews.innerHTML = news.map(n =>
            `<a href="${n.url || '#'}" target="_blank" rel="noopener"><b>${n.source || 'News'}</b> ${escapeHtml(n.headline || '')}</a>`
        ).join('');
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function resizeMapCanvas() {
    if (!_mapCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(640, window.innerWidth - 48);
    const h = Math.max(420, window.innerHeight - 160);
    _mapCanvas.style.width = w + 'px';
    _mapCanvas.style.height = h + 'px';
    _mapCanvas.width = Math.floor(w * dpr);
    _mapCanvas.height = Math.floor(h * dpr);
    _mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawMap() {
    if (!_mapCtx || CityStore.getView() !== 'map') return;
    const ctx = _mapCtx;
    const W = _mapCanvas.clientWidth || 1200;
    const H = _mapCanvas.clientHeight || 900;
    const pad = 40;
    const worldW = CITY_W + 800;
    const worldD = CITY_D + 800;
    const sx = (W - pad * 2) / worldW;
    const sz = (H - pad * 2) / worldD;
    const x2 = (x) => pad + (x + CITY_W / 2 + 400) * sx;
    const z2 = (z) => pad + (z + CITY_D / 2 + 400) * sz;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, W, H);

    const districts = City.districts?.length ? City.districts : DISTRICTS.map(d => ({
        ...d,
        cx: (d.col - 2) * (CELL_W + 200),
        cz: (d.row - 1.5) * (CELL_D + 200),
        biomeDef: { ground: 0x1a2332 }
    }));

    for (const d of districts) {
        const col = typeof d.biomeDef?.ground === 'number'
            ? '#' + d.biomeDef.ground.toString(16).padStart(6, '0')
            : '#1a2332';
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x2(d.cx - CELL_W / 2), z2(d.cz - CELL_D / 2), CELL_W * sx, CELL_D * sz);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.strokeRect(x2(d.cx - CELL_W / 2), z2(d.cz - CELL_D / 2), CELL_W * sx, CELL_D * sz);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        const label = (d.label || d.id || '').replace(/^[^\w]*/, '').slice(0, 22);
        ctx.fillText(label, x2(d.cx), z2(d.cz));
    }

    const placements = G.placements || [];
    ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
    for (const p of placements) {
        if (p.x == null || p.z == null) continue;
        ctx.fillRect(x2(p.x) - 1.5, z2(p.z) - 1.5, 3, 3);
    }

    if (G.camera) {
        const px = G.camera.position.x;
        const pz = G.camera.position.z;
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(x2(px), z2(pz), 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    const visited = CityStore.getSnapshot().progress.visitedDistricts || {};
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
    ctx.lineWidth = 2;
    for (const d of districts) {
        if (visited[d.id]) {
            ctx.strokeRect(x2(d.cx - CELL_W / 2) + 2, z2(d.cz - CELL_D / 2) + 2, CELL_W * sx - 4, CELL_D * sz - 4);
        }
    }

    _raf = requestAnimationFrame(drawMap);
}

function onMapClick(ev) {
    if (!City.districts?.length) return;
    const rect = _mapCanvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const W = rect.width;
    const H = rect.height;
    const pad = 40;
    const worldW = CITY_W + 800;
    const worldD = CITY_D + 800;
    const sx = (W - pad * 2) / worldW;
    const sz = (H - pad * 2) / worldD;
    const wx = ((mx - pad) / sx) - CITY_W / 2 - 400;
    const wz = ((my - pad) / sz) - CITY_D / 2 - 400;

    let best = null;
    let bestD = Infinity;
    for (const d of City.districts) {
        const dx = wx - d.cx;
        const dz = wz - d.cz;
        const dist = dx * dx + dz * dz;
        if (dist < bestD) { bestD = dist; best = d; }
    }
    if (!best) return;

    const token = CityStore.captureResume('fp', {
        districtId: best.id,
        x: best.cx,
        z: best.cz + CELL_D * 0.35,
        yaw: Math.PI
    });
    _lastToken = token;
    Shell.setView('fp');
    if (G.player?.teleport) {
        G.player.teleport(token.x, token.z, token.yaw);
    }
    G.ui?.banner?.(best.label || best.id, 'resumed from City Map');
    G.progress?.visitDistrict?.(best.id);
}

function enterMap() {
    ensureDom();
    _els.mapView.classList.remove('hidden');
    _els.mapView.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sc-view-map');
    resizeMapCanvas();
    cancelAnimationFrame(_raf);
    drawMap();
    G.panelOpen = true;
    try { document.exitPointerLock?.(); } catch (_) { /* ignore */ }
}

function leaveMap() {
    if (_els.mapView) {
        _els.mapView.classList.add('hidden');
        _els.mapView.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('sc-view-map');
    cancelAnimationFrame(_raf);
    G.panelOpen = false;
}

export const Shell = {
    init() {
        if (!flagEnabled('viewToggle')) return;
        ensureDom();
        applyChrome(CityStore.getSnapshot());
        _unsub = CityStore.subscribe((patch, full) => {
            applyChrome(full);
            if (patch.view != null) {
                if (full.view === 'map') enterMap();
                else leaveMap();
            }
        });
        window.addEventListener('resize', () => {
            if (CityStore.getView() === 'map') resizeMapCanvas();
        });
        if (CityStore.getView() === 'map') enterMap();
        else leaveMap();

        // Capture-phase P so pointer-lock / other handlers cannot swallow the shortcut
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'KeyP' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            e.preventDefault();
            e.stopPropagation();
            this.goPixi();
        }, true);
    },

    setView(view) {
        if (!flagEnabled('viewToggle')) return;
        if (view !== 'fp' && view !== 'map') return;
        if (view === CityStore.getView()) return;

        CityStore.saveProgress();
        const extra = {};
        if (G.camera) {
            extra.x = G.camera.position.x;
            extra.z = G.camera.position.z;
            if (G.player?.yaw != null) extra.yaw = G.player.yaw;
        }
        if (G.inside?.id) extra.buildingId = G.inside.id;
        _lastToken = CityStore.captureResume(view, extra);
        CityStore.setView(view);

        try {
            const u = new URL(location.href);
            u.searchParams.set('view', view);
            history.replaceState(null, '', u.toString());
        } catch (_) { /* ignore */ }

        if (view === 'fp' && G.started) {
            G.ui?.addToast?.('First Person · click canvas to look', 'info');
        }
        if (view === 'map') {
            G.ui?.addToast?.('City Map · shared CityStore state', 'info');
        }
    },

    goPixi() {
        goPixi2D();
    },

    lastResumeToken() { return _lastToken; },

    dispose() {
        if (_unsub) _unsub();
        cancelAnimationFrame(_raf);
        leaveMap();
    }
};

if (typeof window !== 'undefined') window.Shell = Shell;





