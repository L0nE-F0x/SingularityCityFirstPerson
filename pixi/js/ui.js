/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   DOM & UI LAYER (v16.0.2 - Scrollable Info Panels)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>'"`]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '`': '&#96;'
    }[tag] || tag));
};

// Externally-sourced colors (Supabase rows, LLM output) get interpolated inside
// style="..." and inline handlers — anything but a plain hex literal can break
// out of the attribute, so reject non-hex values.
const safeColor = (c, fallback = '#64748b') =>
    (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) ? c : fallback;

// href sink for URLs from RSS/Supabase/HN: escaping stops attribute breakout
// but not javascript: URLs — allowlist the protocol too.
const safeHref = (u) => {
    if (typeof u !== 'string' || !u) return '#';
    try {
        const p = new URL(u, window.location.origin).protocol;
        if (p === 'https:' || p === 'http:') return escapeHTML(u);
    } catch (e) { /* malformed URL */ }
    return '#';
};

const NOTIFY = {
    permission: 'default',
    async init() {
      if ('Notification' in window) {
        this.permission = Notification.permission;
        if (this.permission === 'default') this.permission = await Notification.requestPermission();
      }
    },
    send(t, b) {
      if (this.permission === 'granted') {
        try { new Notification(t, { body: b, icon: '/icon-192.png', badge: '/favicon-32.png' });
        } catch(e) {}
      }
    }
};

const UI = {
    scanLog: [],
    compareList: [],
    selModel: null,
    selBld: null,
    eloChart: null, 
    roiChart: null, 
  
    updateTicker() {
      const el = document.getElementById('tickerText');
      if (!el) return;
      el.style.animation = 'none';
      el.offsetHeight; 
      el.style.animation = 'ts .4s ease';
      
      // Mix real news with dynamic city events (70% news, 30% city events)
      let item = null;
      const useCityEvent = Math.random() < 0.3 && G.models.length > 10;
      
      if (useCityEvent) {
          item = this.generateCityTickerEvent();
      }
      
      if (!item) {
          const src = (typeof API !== 'undefined' && API.liveNews && API.liveNews.length > 0) ? API.liveNews : NEWS;
          const rawItem = src[(typeof API !== 'undefined' ? API.newsIdx : 0) % src.length] || { headline: 'Welcome to Singularity City!', url: '#' };
          item = rawItem;
      }
      
      const safeHeadline = escapeHTML(item.headline || item.text || '');
      
      if (item.url && item.url !== '#') {
        const safeSource = escapeHTML(item.source || '');
        const safeUrl = safeHref(item.url);
        const sb = item.source ? `<span style="color:var(--cy);font-size:8px;margin-right:6px">[${safeSource}]</span>` : '';
        el.innerHTML = `📰 ${sb}<a href="${safeUrl}" target="_blank" rel="noopener" style="color:var(--t1);text-decoration:none">${safeHeadline}</a>`;
      } else {
        const icon = item.icon || '📰';
        const color = item.color || 'var(--t1)';
        el.innerHTML = `<span style="color:${color}">${icon} ${safeHeadline}</span>`;
      }
    },
    
    generateCityTickerEvent() {
        if (!G.models || G.models.length === 0) return null;
        const roll = Math.random();
        
        // Benchmark milestone — find current top model
        if (roll < 0.2) {
            const withElo = G.models.filter(m => BM[m.id] && BM[m.id].ELO).sort((a, b) => (BM[b.id].ELO || 0) - (BM[a.id].ELO || 0));
            if (withElo.length >= 2) {
                const top = withElo[0];
                const lab = LABS[top.lab] || { name: top.lab };
                return { headline: `${top.name} holds the #1 ELO ranking at ${BM[top.id].ELO} — ${lab.name} leads the frontier`, icon: '👑', color: '#fbbf24' };
            }
        }
        
        // Model population milestone
        if (roll < 0.35) {
            const count = G.models.length;
            const labs = new Set(G.models.map(m => m.lab)).size;
            return { headline: `Singularity City population: ${count} AI models across ${labs} labs`, icon: '🏙️', color: '#4ade80' };
        }
        
        // Lab rivalry — compare two random labs
        if (roll < 0.5) {
            const labKeys = Object.keys(LABS).filter(k => G.models.some(m => m.lab === k));
            if (labKeys.length >= 2) {
                const a = labKeys[Math.floor(Math.random() * labKeys.length)];
                let b = labKeys[Math.floor(Math.random() * labKeys.length)];
                while (b === a && labKeys.length > 1) b = labKeys[Math.floor(Math.random() * labKeys.length)];
                const countA = G.models.filter(m => m.lab === a).length;
                const countB = G.models.filter(m => m.lab === b).length;
                return { headline: `${LABS[a].name} (${countA} models) vs ${LABS[b].name} (${countB} models) — the race continues`, icon: '⚔️', color: '#a78bfa' };
            }
        }
        
        // Cheapest API callout
        if (roll < 0.65) {
            const withCost = G.models.filter(m => COSTS[m.id] && COSTS[m.id].input && COSTS[m.id].input > 0);
            if (withCost.length > 0) {
                const cheapest = withCost.sort((a, b) => COSTS[a.id].input - COSTS[b.id].input)[0];
                return { headline: `Budget pick: ${cheapest.name} at $${COSTS[cheapest.id].input}/1M input tokens`, icon: '💰', color: '#4ade80' };
            }
        }

        // Random model spotlight
        if (roll < 0.8) {
            const active = G.models.filter(m => !m.retired && !m.ret);
            if (active.length > 0) {
                const m = active[Math.floor(Math.random() * active.length)];
                const lab = LABS[m.lab] || { name: m.lab };
                const avg = avgBM(m.id);
                const stat = avg ? ` — avg benchmark: ${avg}%` : '';
                return { headline: `Spotlight: ${m.name} by ${lab.name}${stat}`, icon: '✦', color: lab.color || '#22d3ee' };
            }
        }
        
        // Time of day flavor
        const dp = G.getDayPhase();
        if (dp < 0.25) return { headline: 'Night shift: AI models are sleeping in the residential zone', icon: '🌙', color: '#94a3b8' };
        if (dp < 0.35) return { headline: 'Dawn commute: models heading to their HQs via metro', icon: '🌅', color: '#fb923c' };
        if (dp > 0.45 && dp < 0.55) return { headline: 'Lunch rush at the café — models socializing in the park', icon: '☕', color: '#fbbf24' };
        if (dp > 0.82) return { headline: 'Evening commute: models heading home to the residential zone', icon: '🌆', color: '#f97316' };
        
        return { headline: `${G.models.length} AI citizens going about their day in Singularity City`, icon: '🏙️', color: '#22d3ee' };
    },
  
    uiClick() {
      if(typeof SND !== 'undefined') SND.uiClick();
      if(typeof haptic === 'function') haptic(10);
    },
  
    toggleLog() {
      document.getElementById('scanLog').classList.toggle('open');
      document.getElementById('btnLog').classList.toggle('on');
    },
  
    addLog(msg) {
      this.scanLog.unshift({ t: new Date().toLocaleTimeString(), msg });
      if (this.scanLog.length > 50) this.scanLog.length = 50;
      document.getElementById('logEntries').innerHTML = this.scanLog.map(e => `<div class="slog-e"><span class="slog-tm">${e.t}</span>${e.msg}</div>`).join('');
    },
  
    addToast(msg) {
      const el = document.getElementById('toasts');
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      el.prepend(t);
      setTimeout(() => t.remove(), 6000);
    },
  
    toggleSound() {
      if(typeof SND !== 'undefined') {
          SND.enabled = !SND.enabled;
          this.updateSoundBtn();
          G.save();
      }
    },
  
    updateSoundBtn() {
      const b = document.getElementById('btnSound');
      if (b && typeof SND !== 'undefined') b.textContent = SND.enabled ? '🔊' : '🔇';

      let mb = document.getElementById('btnMusic');
      if (!mb && b) {
          mb = document.createElement('button');
          mb.id = 'btnMusic';
          mb.className = b.className; 
          mb.style.cssText = b.style.cssText;
          mb.style.marginLeft = '8px';
          mb.style.transition = 'opacity 0.2s';
          mb.onclick = () => { 
              if (typeof SND !== 'undefined') { 
                  SND.toggleMusic(); 
                  UI.updateSoundBtn(); 
              } 
          };
          b.parentNode.insertBefore(mb, b.nextSibling);
      }
      
      if (mb && typeof SND !== 'undefined') {
          mb.textContent = '🎵';
          mb.style.opacity = SND.musicEnabled ? '1' : '0.4';
      }
    },
  
    closePanel() {
      document.getElementById('infoPanel').className = 'ipanel';
      this.selModel = null;
      this.selBld = null;
      
      if (UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
      if (UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }
    },
  
    showTooltip(e, title, sub, hint) {
      const tt = document.getElementById('gameTooltip');
      tt.innerHTML = `<div class="tt-name">${title}</div><div class="tt-sub">${sub}</div>${hint ? '<div class="tt-hint">Click for details</div>' : ''}`;
      tt.style.display = 'block';
      
      const gp = e.data?.global || e.global || { x: 0, y: 0 };
      const vpRect = document.getElementById('viewport').getBoundingClientRect();
      
      let tx = vpRect.left + gp.x;
      let ty = vpRect.top + gp.y - 50;
      
      const ttW = tt.offsetWidth;
      const margin = window.isMobile ? 16 : 10;
      if (tx - (ttW / 2) < margin) tx = (ttW / 2) + margin;
      if (tx + (ttW / 2) > window.innerWidth - margin) tx = window.innerWidth - (ttW / 2) - margin;
      if (ty < margin) ty = margin;

      tt.style.left = tx + 'px';
      tt.style.top = ty + 'px';
    },
  
    hideTooltip() {
      document.getElementById('gameTooltip').style.display = 'none';
    },

    // ─────────────────────────────────────────────────────────────
    //   HOVER TOOLTIPS FOR INTERIOR PROPS  (v476)
    //   Blanket-label the furniture / items inside buildings. Any
    //   display object tagged here shows a floating label on hover.
    // ─────────────────────────────────────────────────────────────
    _tipHideT: null,

    // Tag a single display object with a label. On desktop it shows on hover;
    // on touch there's no hover, so the same label shows on TAP and auto-hides
    // after a couple seconds. First (most specific) label wins, so a prop drawn
    // inside another prop keeps its own name.
    tip(obj, title, sub) {
      if (!obj || obj._tipT || obj.destroyed) return obj;
      // Skip anything that's already an interactive entity (NPC/avatar/clickable
      // with its own hover OR tap) — its own tooltip/handler wins. Lets area-level
      // include-maps wrap orchestrators that also spawn NPCs without clobbering.
      if (obj.listenerCount && (obj.listenerCount('pointerover') > 0 || obj.listenerCount('pointertap') > 0)) return obj;
      obj._tipT = title;
      obj._tipS = sub || '';
      obj.eventMode = 'static';
      obj.cursor = window.isMobile ? 'pointer' : 'help';
      if (window.isMobile) {
        obj.on('pointertap', UI._tipTap);
      } else {
        obj.on('pointerover', UI._tipOver);
        obj.on('pointerout', UI._tipOut);
      }
      return obj;
    },

    _tipOver(e) {
      clearTimeout(UI._tipHideT);
      const o = e.currentTarget;
      if (o && o._tipT) UI.showTooltip(e, o._tipT, o._tipS);
    },

    // Touch: tap a prop to reveal its label, auto-dismissed after ~2.2s (no
    // pointerout on touch). Tapping another prop replaces it immediately.
    _tipTap(e) {
      const o = e.currentTarget;
      if (!o || !o._tipT) return;
      clearTimeout(UI._tipHideT);
      UI.showTooltip(e, o._tipT, o._tipS);
      UI._tipHideT = setTimeout(() => UI.hideTooltip(), 2200);
    },

    _tipOut() {
      // Props are built from several stacked graphics (base + glow). Moving
      // between them fires out→over back-to-back; defer the hide a hair so
      // the tooltip doesn't flicker, and let the next over() cancel it.
      clearTimeout(UI._tipHideT);
      UI._tipHideT = setTimeout(() => UI.hideTooltip(), 45);
    },

    // "drawServerRack" → "Server Rack", "drawGPUShowcase" → "GPU Showcase".
    _humanizeDraw(key) {
      return key.replace(/^draw/, '')
                .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                .replace(/([a-z\d])([A-Z])/g, '$1 $2')
                .trim();
    },

    // Wrap prop-drawing methods on a module so the display objects they append
    // get auto-tagged. One-shot per method (idempotent). Two modes:
    //   • default — scan every drawXxx(container,…) method, label via overrides
    //     or a humanized name (used by the shared res/city/space prop libs).
    //   • include — an explicit { methodName: {title,sub} | "sub" } map, for
    //     bespoke interiors whose leaf-prop helpers are named freely (e.g.
    //     InteriorDC._rack). Only the listed methods are wrapped.
    autoTipModule(mod, opts = {}) {
      if (!mod) return;
      const overrides = opts.overrides || {};
      const exclude = new Set(opts.exclude || []);
      const include = opts.include || null;
      const keys = include
        ? Object.keys(include)
        : Object.keys(mod).filter(k => /^draw[A-Z]/.test(k) && !exclude.has(k));
      for (const key of keys) {
        const fn = mod[key];
        if (typeof fn !== 'function' || fn._tipWrapped) continue;
        const raw = include ? include[key] : overrides[key];
        const meta = typeof raw === 'string' ? { sub: raw } : raw;
        const title = (meta && meta.title) || UI._humanizeDraw(key);
        let sub = (meta && meta.sub) || '';
        // Drop a sub that just repeats the title (e.g. "Hammock / Hammock").
        if (sub && sub.toLowerCase() === title.toLowerCase()) sub = '';
        const wrapped = function (...args) {
          const c = args[0];
          // Only instrument calls that draw into a plain Container. Functions
          // that paint into a shared Graphics (walls/floors) get c as a
          // Graphics → skipped, since their shapes can't be hovered apart.
          const isCont = c && c instanceof PIXI.Container && !(c instanceof PIXI.Graphics);
          const before = isCont ? c.children.length : -1;
          const r = fn.apply(this, args);
          if (isCont && title) {
            for (let i = before; i < c.children.length; i++) UI.tip(c.children[i], title, sub);
          }
          return r;
        };
        wrapped._tipWrapped = true;
        mod[key] = wrapped;
      }
    },

    // Auto-instrument the interior modules once. Runs lazily the first time
    // any interior is opened (all modules are loaded by then).
    initInteriorTips() {
      if (this._interiorTipsReady) return;
      this._interiorTipsReady = true;

      // sub-text per prop. value = "sub string"  OR  { title, sub }.
      const L = {
        // compute / servers
        drawServerRack:        'GPU compute rack',
        drawLiquidCooledServer:'Liquid-cooled training node',
        drawOpenServerRack:    'Open server rack',
        drawServerCabinet:     'Server cabinet',
        drawCommRack:          'Comms rack',
        drawServerWeights:     { title: 'Server Weights', sub: 'Rack-shaped gym weights' },
        drawDataVat:           'Cooling data vat',
        drawBrokenServer:      'Decommissioned server',
        drawGPUShowcase:       'Flagship GPU on display',
        // desks / work
        drawReceptionDesk:     'Lobby front desk',
        drawBossDesk:          'Executive desk',
        drawStandingDesk:      'Standing desk',
        drawDeskAndPC:         { title: 'Workstation', sub: 'Desk + PC' },
        drawHackathonDesk:     'Hackathon desk',
        drawCubicleDivider:    'Cubicle divider',
        drawCollaborationPod:  'Collaboration pod',
        drawCommandCenter:     'Command center',
        drawWhiteboard:        'Research whiteboard',
        drawChair:             'Chair',
        // home / living
        drawBed:               'Bed',
        drawLuxuryBed:         'Luxury bed',
        drawNightstand:        'Bedside table',
        drawKitchen:           'Kitchen',
        drawKitchenOven:       'Kitchen oven',
        drawCookingStation:    'Chef cooking station',
        drawPrepStation:       'Prep station',
        drawLivingArea:        'Living room',
        drawCouches:           'Lounge seating',
        drawShower:            'Bathroom',
        drawFireplace:         'Fireplace',
        drawHomeBar:           'Home bar',
        drawWineRack:          'Wine collection',
        drawBookshelfWall:     { title: 'Bookshelf', sub: '' },
        drawGrandPiano:        'Grand piano',
        drawWaterCooler:       'Water cooler',
        drawCoffeeMachine:     'Coffee machine',
        // plants / nature
        drawPottedPlant:       'Houseplant',
        drawPlant:             'Plant',
        drawIndoorGarden:      'Indoor garden',
        drawGardenPlanter:     'Garden planter',
        drawBonsaiTree:        'Bonsai tree',
        drawBiophilicDivider:  'Living plant divider',
        drawTree:              'Tree',
        drawFrontierPine:      'Pine tree',
        drawLuxuryRedwood:     'Redwood tree',
        drawZenGardenProp:     { title: 'Zen Garden', sub: 'Raked sand & stones' },
        drawGeckoTerrarium:    'Pet gecko terrarium',
        // fitness / sport
        drawGymCorner:         'Home gym',
        drawTreadmill:         'Treadmill',
        drawWeightBench:       'Weight bench',
        drawPunchingBag:       'Punching bag',
        drawYogaMat:           'Yoga mat',
        drawExerciseBall:      'Exercise ball',
        drawMMAOctagon:        'MMA octagon',
        drawRing:              'Boxing ring',
        drawPoolTable:         'Pool table',
        drawPingPongTable:     'Ping-pong table',
        drawPuttingGreen:      'Putting green',
        drawCricketBat:        'Cricket bat',
        drawSurfboard:         'Surfboard',
        drawLockerRow:         'Lockers',
        drawSteamRoom:         'Steam room',
        drawIndoorPool:        'Indoor pool',
        drawPoolLane:          'Lap pool',
        drawInfinityHotTub:    'Infinity hot tub',
        // leisure / luxury
        drawArcadeCabinet:     'Retro arcade cabinet',
        drawBeanbagAndHandheld:{ title: 'Gaming Beanbag', sub: 'Beanbag + handheld' },
        drawVRHeadsetDisplay:  'VR headset stand',
        drawTelescope:         'Telescope',
        drawBinoculars:        'Viewing binoculars',
        drawMeditationCorner:  'Meditation corner',
        drawTrophyCase:        'Trophy case',
        drawTrophy:            'Trophy',
        drawLeatherJacketDisplay:'Leather jacket display',
        drawScrollArt:         'Hanging scroll art',
        drawRocketModel:       'Rocket model',
        drawExecutiveLounge:   'Executive lounge',
        drawLoungeNook:        'Lounge nook',
        drawPrivateOasis:      'Private oasis',
        drawWhiskeyBar:        'Whiskey bar',
        drawFirePitLounge:     'Fire-pit lounge',
        drawHammock:           'Hammock',
        // outdoor / campus
        drawLake:              'Lake',
        drawTent:              'Camping tent',
        drawCampfire:          'Campfire',
        drawGlampingDome:      'Glamping dome',
        drawPicnicTable:       'Picnic table',
        drawOutdoorTable:      'Outdoor table',
        drawBlanketArea:       'Picnic blanket',
        drawStringLights:      'String lights',
        drawHelipad:           'Helipad',
        drawStarlinkDish:      'Starlink dish',
        drawCar:               'Parked car',
        drawViewingPlatform:   'Viewing platform',
        drawCountdownBoard:    'Countdown board',
        drawScoreboard:        'Scoreboard',
        drawLeaderboard:       'Leaderboard',
        drawJumbotron:         'Jumbotron',
        drawAudienceStands:    'Audience stands',
        drawCommentaryDesk:    'Commentary desk',
        drawContributorWall:   'Contributor wall',
        drawMirrorWall:        'Mirror wall',
        drawSpotlight:         'Spotlight',
        // café / canteen
        drawCanteen:           'Staff canteen',
        drawCafeTable:         { title: 'Café Table', sub: '' },
        drawCafeCouch:         { title: 'Café Couch', sub: '' },
        drawCafeBookshelf:     { title: 'Café Bookshelf', sub: '' },
        drawBaristaCounter:    'Barista counter',
        drawBarStool:          'Bar stool',
        drawPastryDisplay:     'Pastry display',
        drawMenuBoard:         'Menu board',
        drawVendingMachine:    'Vending machine',
        drawRefreshmentStand:  'Refreshment stand',
        drawTombstone:         'Retired-model tombstone',
        // space
        drawBigScreen:         'Mission display',
        drawOperatorDesk:      'Operator console',
        drawOverheadCrane:     'Overhead crane',
        drawRocketBay:         'Rocket assembly bay',
        drawCleanRoom:         'Clean room',
        drawPayloadRack:       'Payload rack',
        drawOrbitalDisplay:    'Orbital tracking display',
        drawTrackingConsole:   'Tracking console',
        drawLaunchConsole:     'Launch console',
        drawCountdownClock:    'Launch countdown',
        drawObservationWindow: 'Observation window',
      };
      // normalise: allow plain-string values to mean "sub only".
      const overrides = {};
      for (const k in L) overrides[k] = typeof L[k] === 'string' ? { sub: L[k] } : L[k];

      // Structural pieces (walls/floors/roof/silo/doors) and avatars are not
      // "items" — never tag them.
      const structural = [
        'drawRoof', 'drawRoomInterior', 'drawNegativeSpaceWall',
        'drawBasementInterior', 'drawSiloInterior', 'drawDoor',
        'drawAvatar', 'drawNPC', 'drawRobotNPC',
      ];

      if (typeof InteriorRes !== 'undefined') UI.autoTipModule(InteriorRes, { overrides, exclude: structural });
      if (typeof InteriorCity !== 'undefined') UI.autoTipModule(InteriorCity, { overrides, exclude: structural });
      if (typeof SpaceInterior !== 'undefined') UI.autoTipModule(SpaceInterior, { overrides, exclude: structural });

      // ── Bespoke interiors: explicit include-maps of leaf-prop helpers ──
      // (these modules build props via freely-named private methods, so we
      // list the prop helpers by name; orchestrators / _lbl / _npc omitted.)
      if (typeof InteriorDC !== 'undefined') UI.autoTipModule(InteriorDC, { include: {
        _rack:  { title: 'Server Rack', sub: 'GPU compute' },
        _noc:   { title: 'Network Operations Center', sub: 'Monitoring wall' },
        _gate:  { title: 'Security Gate', sub: 'Access control' },
        _recep: { title: 'Reception Desk' },
        _ups:   { title: 'UPS Battery', sub: 'Backup power' },
        _gen:   { title: 'Backup Generator' },
        _litho: { title: 'EUV Lithography', sub: 'Chip patterning' },
        _wafer: { title: 'Wafer Handling', sub: 'QC station' },
        _etch:  { title: 'Etch / Deposition', sub: 'Process chamber' },
        _tank:  { title: 'Chemical Tank' },
        _scaff: { title: 'Scaffolding', sub: 'Under construction' },
        _pipes: { title: 'Cooling Pipes' },
        _cond:  { title: 'Power Conduit' },
      } });
      if (typeof UniversityInterior !== 'undefined') UI.autoTipModule(UniversityInterior, { include: {
        _chalkboard: { title: 'Chalkboard' },
        _podium:     { title: 'Lecture Podium' },
        _whiteboard: { title: 'Whiteboard' },
        _studyTable: { title: 'Study Table' },
        _workstation:{ title: 'Workstation' },
        _frontDesk:  { title: 'Front Desk' },
        _noticeBoard:{ title: 'Notice Board' },
        _bookshelf:  { title: 'Bookshelf' },
        _readingDesk:{ title: 'Reading Desk' },
        _checkoutDesk:{ title: 'Checkout Desk' },
        _dormRoom:   { title: 'Dorm Room' },
        _couch:      { title: 'Couch' },
        _vendingMachine:{ title: 'Vending Machine' },
        _tv:         { title: 'TV' },
        _labBench:   { title: 'Lab Bench' },
        _oscilloscope:{ title: 'Oscilloscope' },
        _rack:       { title: 'Server Rack' },
        _pipes:      { title: 'Pipes' },
        _deskWithMonitor:{ title: 'Desk', sub: 'Workstation' },
        _fileCabinet:{ title: 'File Cabinet' },
        _docBox:     { title: 'Document Box' },
        _secureShelf:{ title: 'Secure Shelf' },
        _glassCase:  { title: 'Display Case' },
        _washer:     { title: 'Washer' },
        _crate:      { title: 'Crate' },
        _spareParts: { title: 'Spare Parts' },
      } });
      if (typeof InteriorLegacy !== 'undefined') UI.autoTipModule(InteriorLegacy, { include: {
        _welcomeDesk:   { title: 'Welcome Desk' },
        _velvetRope:    { title: 'Velvet Rope' },
        _infoKiosk:     { title: 'Info Kiosk' },
        _giftShop:      { title: 'Gift Shop' },
        _exhibitCase:   { title: 'Exhibit Case' },
        _infoPlaque:    { title: 'Info Plaque' },
        _timelineMarker:{ title: 'Timeline Marker' },
        _displayPanel:  { title: 'Display Panel' },
        _portrait:      { title: 'Portrait' },
        _emptyFrame:    { title: 'Empty Frame' },
        _memorialTorch: { title: 'Memorial Torch' },
        _oldServer:     { title: 'Legacy Server' },
        _fileCabinet:   { title: 'File Cabinet' },
        _dustyCrate:    { title: 'Dusty Crate' },
      } });
      if (typeof InteriorVCRow !== 'undefined') UI.autoTipModule(InteriorVCRow, { include: {
        // leaf props (specific) — win over the area labels below via first-tag
        _monitor:      { title: 'Monitor' },
        _plant:        { title: 'Plant' },
        _bookshelf:    { title: 'Bookshelf' },
        _wallScreen:   { title: 'Wall Screen' },
        _coffeeMachine:{ title: 'Coffee Machine' },
        // area orchestrators (everything else they draw gets the room name)
        _drawReception:     { title: 'Reception' },
        _drawDealRoom:      { title: 'Deal Room' },
        _drawPartnerOffices:{ title: 'Partner Office' },
        _drawFundOps:       { title: 'Fund Operations' },
        _drawRooftopLounge: { title: 'Rooftop Lounge' },
        _drawAnalytics:     { title: 'Analytics Floor' },
        _drawTradingFloor:  { title: 'Trading Floor' },
        _drawCoworking:     { title: 'Coworking Space' },
        _drawPitchStage:    { title: 'Pitch Stage' },
        _drawVault:         { title: 'Vault' },
        _drawLegal:         { title: 'Legal Office' },
        _drawBoardroom:     { title: 'Boardroom' },
        _drawExecutive:     { title: 'Executive Suite' },
        _drawBasement:      { title: 'Basement' },
      } });
      if (typeof InteriorBar !== 'undefined') UI.autoTipModule(InteriorBar, { include: {
        _drawMainBar: { title: 'Main Bar' },
        _drawKaraoke: { title: 'Karaoke Stage' },
        _drawVIP:     { title: 'VIP Lounge' },
        _drawCellar:  { title: 'Wine Cellar' },
        _drawTable:   { title: 'Table' },
      } });
      if (typeof InteriorBlackMarket !== 'undefined') UI.autoTipModule(InteriorBlackMarket, { include: {
        _drawTrading: { title: 'Trading Floor' },
        _drawHacker:  { title: 'Hacker Den' },
        _drawVault:   { title: 'Vault' },
        _drawTunnel:  { title: 'Smuggling Tunnel' },
      } });
      if (typeof CourtInterior !== 'undefined') UI.autoTipModule(CourtInterior, { include: {
        _drawSenateF:     { title: 'Senate Floor' },
        _drawSenateBase:  { title: 'Senate Archives' },
        _drawHearingF:    { title: 'Hearing Room' },
        _drawHearingBase: { title: 'Hearing Archives' },
      } });
      if (typeof ConferenceInterior !== 'undefined') UI.autoTipModule(ConferenceInterior, { include: {
        _drawKeynoteHall:   { title: 'Keynote Hall' },
        _drawPosterSession: { title: 'Poster Session' },
        _drawDemoBooths:    { title: 'Demo Booth' },
        _drawRegistration:  { title: 'Registration Desk' },
        _drawBasement:      { title: 'Equipment Room' },
      } });
      if (typeof InteriorNPC !== 'undefined') UI.autoTipModule(InteriorNPC, { include: {
        _drawFoyer:      { title: 'Lobby' },
        _drawApartments: { title: 'Apartment' },
        _drawBasement:   { title: 'Basement Storage' },
      } });
      if (typeof InteriorAmbassadorRes !== 'undefined') UI.autoTipModule(InteriorAmbassadorRes, { include: {
        _drawFloorProps:         { title: 'Residence Furnishing' },
        _drawOrnamental:         { title: 'Ornament' },
        _drawSleepingAmbassador: { title: 'Ambassador', sub: 'Sleeping' },
      } });
      if (typeof InteriorLongevity !== 'undefined') UI.autoTipModule(InteriorLongevity, { include: {
        _buildFloorProps:  { title: 'Lab Equipment' },
        _drawReceptionDesk:{ title: 'Reception Desk' },
      } });
      if (typeof InteriorEmbassy !== 'undefined') UI.autoTipModule(InteriorEmbassy, { include: {
        _drawPalm:             { title: 'Palm Tree' },
        _drawCountrySilhouette:{ title: 'National Emblem' },
        _drawFloorProps:       { title: 'Embassy Furnishing' },
      } });
    },

    addToCompare(id) {
      if (this.compareList.includes(id)) return;
      if (this.compareList.length >= 4) this.compareList.shift();
      this.compareList.push(id);
      this.addToast(`⚖️ Compare (${this.compareList.length}/4)`);
      G.unlockAchieve('compared');
      if (this.compareList.length >= 2) this.showCompare();
    },
  
    selectModel(m) {
      if (m.isCeo && m.founderData) {
          this.showFounder(m.founderData);
          return;
      }
      
      if (m.isNPC || (!m.arch && !m.benchmarks && !m.phase && !m._src)) {
          this.showNPC(m);
          return;
      }

      this.selModel = m;
      this.selBld = null;
      const stg = getStage(m.rel, m.ret, m.phase); const sd = STAGES[stg]; 
      const lab = LABS[m.lab] || LABS.other || {name: 'Unknown', color: '#64748b', icon: '🌐'};
      const idx = G.models.indexOf(m);
      const dp = G.getDayPhase(); 
      const { act } = getAct(stg, dp, idx, m); 
      const ai = ACTS[act] || {icon: '💻', verb: 'processing', label: 'Processing'};
      const p = document.getElementById('infoPanel');
      p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight;
      p.style.animation = 'pi .25s ease';
      const isPre = ['rumored', 'pre_training', 'training'].includes(m.phase);
      
      p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
        <div class="ipanel-top" style="background:linear-gradient(135deg,${safeColor(lab.color)}22,transparent);border-bottom:2px solid ${safeColor(lab.color)}33">
          <div class="ipanel-av" style="background:${safeColor(lab.color)};color:#fff;font-size:24px">${escapeHTML(lab.icon)}</div>
          <div style="flex:1"><div class="ipanel-name">${escapeHTML(m.name)} ${m.os ? '<span style="font-size:8px;color:#4ade80">🔓</span>' : ''}</div><div class="ipanel-sub" style="color:${safeColor(lab.color)}">${escapeHTML(lab.name)}</div></div>
          <div class="ipanel-badge" style="background:${isPre ? '#8b5cf6' : stg === 'retired' ? '#7a7f8a' : 'var(--ac)'};color:#000">${sd.emoji} ${sd.label}</div>
        </div>
        <div class="ipanel-act"><span style="font-size:14px">${ai.icon}</span><span class="ipanel-act-text">Currently ${ai.verb}</span></div>
        ${isPre ? '<div style="font-size:8px;color:#8b5cf6;padding:4px 10px;background:#8b5cf622;border:1px solid #8b5cf633;border-radius:3px;margin:4px 16px;text-align:center">🔬 Not Yet Released</div>' : ''}
        ${m._src ? '<div style="font-size:8px;color:var(--cy);padding:4px 10px;background:#22d3ee0a;border:1px solid #22d3ee22;border-radius:3px;margin:4px 16px;text-align:center">🛰️ Discovered via Scan</div>' : ''}
        <div class="ipanel-tabs"><button class="ipanel-tab active" onclick="UI.panelTab('info',this)">👤 Profile</button><button class="ipanel-tab" onclick="UI.panelTab('bench',this)">📊 Bench</button><button class="ipanel-tab" onclick="UI.panelTab('cost',this)">💰 Cost</button></div>
        <div id="panelContent" style="max-height: calc(100vh - 280px); max-height: calc(100dvh - 280px); overflow-y: auto; overflow-x: hidden; padding-right: 4px; padding-bottom: 10px;"></div>
        <div style="padding:8px 16px;display:flex;gap:6px"><button class="btn" style="flex:1;text-align:center" onclick="UI.addToCompare('${m.id}')">⚖️ Compare</button><button class="btn" style="flex:1;text-align:center;${G.tracking && G.tracking.id === m.id ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.id==='${m.id}' ? G.stopTracking() : G.startTracking('model','${m.id}','${m.lab}')">${G.tracking && G.tracking.id === m.id ? '📡 Tracking' : '📡 Track'}</button></div>`;
      this.panelTab('info');
    },

    showNPC(m) {
        this.selModel = m;
        this.selBld = null;
        const p = document.getElementById('infoPanel');
        p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
        const col = '#94a3b8';
        const safeName = escapeHTML(m.name || 'Service Unit');
        const safeRole = escapeHTML(m.role || m.job || 'Facility Maintenance');
        
        p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
          <div class="ipanel-top" style="background:linear-gradient(135deg,${col}22,transparent);border-bottom:2px solid ${col}33">
            <div class="ipanel-av" style="background:${col};color:#fff;font-size:24px">🤖</div>
            <div style="flex:1"><div class="ipanel-name">${safeName}</div><div class="ipanel-sub" style="color:${col}">${safeRole}</div></div>
            <div class="ipanel-badge" style="background:var(--cd);color:var(--t2);border:1px solid var(--bd)">NPC</div>
          </div>
          <div style="max-height: calc(100vh - 130px); max-height: calc(100dvh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
              <p class="ipanel-desc">${escapeHTML(m.desc || 'A specialized, non-sentient utility construct designed to assist with city operations.')}</p>
              <div class="ipanel-grid">
                <div class="ipanel-stat"><span class="ipanel-lbl">System Status</span><span class="ipanel-val" style="color:#4ade80">Online</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Function</span><span class="ipanel-val">${safeRole}</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Sentience</span><span class="ipanel-val" style="color:var(--t3)">Restricted</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Network</span><span class="ipanel-val" style="color:var(--t3)">Local Intranet</span></div>
              </div>
              ${m._trackType ? `<div style="padding:8px 0"><button class="btn" style="width:100%;text-align:center;${G.tracking && G.tracking.id === m.id ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.id==='${m.id}' ? G.stopTracking() : G.startTracking('${m._trackType}','${m.id}','other')">${G.tracking && G.tracking.id === m.id ? '📡 Tracking' : '📡 Track'}</button></div>` : ''}
          </div>`;
    },
  
    panelTab(tab, btn) {
      document.querySelectorAll('.ipanel-tab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active'); else document.querySelector('.ipanel-tab')?.classList.add('active');
      const m = this.selModel; if (!m) return; const ct = document.getElementById('panelContent'); if (!ct) return;
      
      if (tab !== 'bench' && UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
      if (tab !== 'cost' && UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }

      if (tab === 'info') {
        const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
        ct.innerHTML = `<p class="ipanel-desc">${escapeHTML(m.desc)}</p><div class="ipanel-grid" style="border-bottom: 1px dashed var(--bd); padding-bottom: 10px;">
          <div class="ipanel-stat"><span class="ipanel-lbl">Born</span><span class="ipanel-val">${m.phase && m.phase !== 'released' ? 'Est. ' + new Date(m.rel).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : new Date(m.rel).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
          ${m.ret ? `<div class="ipanel-stat"><span class="ipanel-lbl">Retired</span><span class="ipanel-val" style="color:#7a7f8a">${new Date(m.ret).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span></div>` : ''}
          <div class="ipanel-stat"><span class="ipanel-lbl">Personality</span><span class="ipanel-val">${escapeHTML(m.per)}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Talent</span><span class="ipanel-val">${escapeHTML(m.tal)}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Fav Spot</span><span class="ipanel-val">${escapeHTML(m.fav)}</span></div>
          ${avg ? `<div class="ipanel-stat"><span class="ipanel-lbl">Avg Score</span><span class="ipanel-val" style="color:${avg > 80 ? '#4ade80' : avg > 50 ? '#facc15' : '#ef4444'}">${avg}%</span></div>` : ''}
          </div>
          <div class="arch-title">⚡ Deep Architecture</div>
          <div class="ipanel-grid" style="padding-top:5px">
            <div class="ipanel-stat"><span class="ipanel-lbl">Parameters</span><span class="ipanel-val" style="color:var(--cy)">${m.arch?.params || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Topology</span><span class="ipanel-val" style="color:var(--ac)">${m.arch?.type || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Training Data</span><span class="ipanel-val">${m.arch?.tokens || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Compute FLOPs</span><span class="ipanel-val" style="color:#facc15">${m.arch?.compute || 'Unknown'}</span></div>
          </div>`;
      } 
      else if (tab === 'bench') {
        const sc = BM[m.id] || m.benchmarks || {};
        if (Object.keys(sc).length === 0) { ct.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);font-size:10px">No benchmark data.</div>'; return; }
        
        let html = Object.entries(BM_M).map(([k, bm]) => {
          const v = sc[k] !== undefined ? sc[k] : sc[k.toUpperCase()] || 0; 
          const fw = k === 'ELO' ? (v ? Math.min(100, (v - 1000) / 4.5) : 0) : Math.min(100, v); const dv = k === 'ELO' ? (v || '—') : (v ? v + '%' : '—');
          return `<div class="bench-row"><div class="bench-hdr"><span class="bench-name">${bm.l}</span><span class="bench-score" style="color:${bm.c}">${dv}</span></div><div class="bench-bg"><div class="bench-fill" style="width:${fw}%;background:linear-gradient(90deg,${bm.c}88,${bm.c})"></div></div><div class="bench-desc">${bm.d}</div></div>`;
        }).join('');
        
        html += `<div class="arch-title" style="margin-top: 15px;">📈 Historical ELO Trajectory</div>
                 <div class="chart-wrapper"><canvas id="eloChartCanvas"></canvas></div>`;
        
        ct.innerHTML = html;

        setTimeout(() => {
            const ctx = document.getElementById('eloChartCanvas');
            if (!ctx || typeof Chart === 'undefined') return;
            
            if (UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
            
            const currentElo = BM[m.id]?.ELO || 1000;
            const history = [currentElo - 60, currentElo - 25, currentElo - 10, currentElo + 5, currentElo];
            const labColor = (LABS[m.lab] || LABS.other || {color: '#64748b'}).color;

            UI.eloChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Now'],
                    datasets: [{
                        label: 'Arena ELO',
                        data: history,
                        borderColor: labColor,
                        backgroundColor: `${labColor}22`,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#fff',
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: '#33334a' }, ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } },
                        y: { grid: { color: '#33334a' }, ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } }
                    }
                }
            });
        }, 10);

      } 
      else if (tab === 'cost') {
        const c = COSTS[m.id];
        if (!c || (c.input === undefined && c.output === undefined)) { ct.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);font-size:10px">No pricing data.</div>'; return; }
        const a = typeof avgBM === 'function' ? avgBM(m.id) : 0; const bang = a && c.output ? (a / c.output).toFixed(1) : null;
        
        let html = `<div class="ipanel-grid" style="margin-top:10px; border-bottom: 1px dashed var(--bd); padding-bottom: 15px;">
          <div class="ipanel-stat"><span class="ipanel-lbl">Input</span><span class="ipanel-val" style="color:#4ade80">$${c.input}/1M</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Output</span><span class="ipanel-val" style="color:#facc15">$${c.output}/1M</span></div>
          ${CTX[m.id] ? `<div class="ipanel-stat"><span class="ipanel-lbl">Context</span><span class="ipanel-val">${CTX[m.id] >= 1e6 ? (CTX[m.id] / 1e6).toFixed(1).replace('.0','') + 'M' : (CTX[m.id] / 1e3).toFixed(0) + 'K'}</span></div>` : ''}
          ${bang ? `<div class="ipanel-stat"><span class="ipanel-lbl">Bang/Buck</span><span class="ipanel-val" style="color:#22d3ee">${bang}</span></div>` : ''}</div>`;
        
        html += `<div class="arch-title" style="margin-top: 15px;">💰 Compute ROI Matrix</div>
                 <div class="chart-wrapper" style="height: 250px;"><canvas id="roiChartCanvas"></canvas></div>`;
                 
        ct.innerHTML = html;

        setTimeout(() => {
            const ctx = document.getElementById('roiChartCanvas');
            if (!ctx || typeof Chart === 'undefined') return;
            
            if (UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }
            
            const scatterData = G.models.filter(x => COSTS[x.id] && typeof avgBM === 'function' && avgBM(x.id)).map(x => {
                const isSelected = x.id === m.id;
                const lab = LABS[x.lab] || LABS.other || {color: '#64748b'};
                return {
                    x: COSTS[x.id].output,
                    y: avgBM(x.id),
                    modelName: x.name,
                    backgroundColor: isSelected ? '#ffffff' : lab.color,
                    radius: isSelected ? 7 : 4,
                    borderColor: isSelected ? '#000' : 'transparent',
                    borderWidth: isSelected ? 2 : 0
                };
            });

            UI.roiChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Models',
                        data: scatterData,
                        backgroundColor: scatterData.map(d => d.backgroundColor),
                        borderColor: scatterData.map(d => d.borderColor),
                        borderWidth: scatterData.map(d => d.borderWidth),
                        pointRadius: scatterData.map(d => d.radius),
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(10,10,25,0.95)',
                            titleFont: { family: 'JetBrains Mono', size: 11 },
                            bodyFont: { family: 'JetBrains Mono', size: 10 },
                            borderColor: '#33334a',
                            borderWidth: 1,
                            callbacks: {
                                label: function(ctx) { return `${ctx.raw.modelName}: $${ctx.raw.x} / ${ctx.raw.y}%`; }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            title: { display: true, text: 'Output Cost ($/1M)', color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } }, 
                            grid: { color: '#33334a' }, 
                            ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } 
                        },
                        y: { 
                            title: { display: true, text: 'Avg Score (%)', color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } }, 
                            grid: { color: '#33334a' }, 
                            ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } 
                        }
                    }
                }
            });
        }, 10);
      }
    },
  
    selectBld(b) {
      this.selBld = b;
      this.selModel = null; 
      const lab = b.lab ? LABS[b.lab] : null;
      const isDcFab = b.id.startsWith('dc_') || b.id.startsWith('fab_');
      
      // Color: use DC operator color if lab not found
      let col;
      if (isDcFab) {
          col = (lab && lab.color) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].color) || (b.dcData && b.dcData.color) || '#06b6d4';
      } else {
          col = lab ? lab.color : b.color || '#6b7280';
      }
      
      const p = document.getElementById('infoPanel'); 
      p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
      
      const safeDesc = escapeHTML(b.desc || 'An unassigned architectural structure.');
      const safeName = escapeHTML(b.name || 'Unknown Building');

      // Determine icon and subtitle based on building type
      let icon, subtitle;
      if (isDcFab) {
          const isDc = b.id.startsWith('dc_');
          icon = isDc ? '🖥️' : '🔧';
          const opName = (lab && lab.name) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].name) || b.lab || '';
          subtitle = (isDc ? 'Data Center' : 'Chip Fabrication') + (opName ? ` · ${escapeHTML(opName)}` : '');
      } else if (b.type && ['launchpad','mission_control','assembly','tracking'].includes(b.type)) {
          const org = b.org && typeof SPACE_ORGS !== 'undefined' ? SPACE_ORGS[b.org] : null;
          icon = org ? org.icon : '🚀';
          subtitle = org ? org.name : 'Space Zone';
      } else if (lab) {
          icon = lab.icon;
          subtitle = lab.name;
      } else {
          icon = b.emoji || '🏢';
          subtitle = '';
      }

      let html = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
        <div class="ipanel-top" style="background:linear-gradient(135deg,${col}22,transparent);border-bottom:2px solid ${col}33">
          <div class="ipanel-av" style="background:${col};color:#fff;font-size:24px">${icon}</div>
          <div><div class="ipanel-name">${safeName}</div>${subtitle ? `<div class="ipanel-sub" style="color:${col}">${subtitle}</div>` : ''}</div>
        </div>`;
        
      html += `<div style="max-height: calc(100vh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">`;
      html += `<p class="ipanel-desc" style="margin-top:0">${safeDesc}</p>`;
      
      // ─── DC/FAB-specific info panel ───
      if (b.id.startsWith('dc_') || b.id.startsWith('fab_')) {
        const dc = b.dcData || {};
        const opName = (LABS[b.lab] && LABS[b.lab].name) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].name) || b.lab || 'Unknown';
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">⚡ FACILITY SPECS</div>`;
        if (dc.location) html += `<div>📍 <b>Location:</b> ${escapeHTML(dc.location)}</div>`;
        html += `<div>🏭 <b>Operator:</b> ${escapeHTML(opName)}</div>`;
        html += `<div>${dc.status === 'construction' ? '🚧' : '✅'} <b>Status:</b> ${dc.status === 'construction' ? 'Under Construction' : 'Operational'}</div>`;
        if (dc.gpus) html += `<div>🖥️ <b>Compute:</b> ${escapeHTML(dc.gpus)}</div>`;
        if (dc.power_mw) html += `<div>🔌 <b>Power:</b> ${dc.power_mw} MW</div>`;
        if (dc.cooling) html += `<div>❄️ <b>Cooling:</b> ${escapeHTML(dc.cooling)}</div>`;
        if (dc.process) html += `<div>🔬 <b>Process:</b> ${escapeHTML(dc.process)}</div>`;
        if (dc.products) html += `<div>📦 <b>Products:</b> ${escapeHTML(dc.products)}</div>`;
        if (dc.investment) html += `<div>💰 <b>Investment:</b> ${escapeHTML(dc.investment)}</div>`;
        if (dc.completion) html += `<div>📅 <b>Est. Completion:</b> ${dc.completion}</div>`;
        html += `</div>`;
      }
      // ─── SPACE ZONE building info ───
      else if (b.type && ['launchpad','mission_control','assembly','tracking'].includes(b.type)) {
        const org = b.org && typeof SPACE_ORGS !== 'undefined' ? SPACE_ORGS[b.org] : null;
        const veh = (b.org && typeof SpaceRockets !== 'undefined') ? SpaceRockets.vehicleName(b.org) : (org && org.vehicle);
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🚀 SPACE FACILITY</div>`;
        html += `<div>🏗️ <b>Type:</b> ${escapeHTML(b.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))}</div>`;
        if (org) {
            html += `<div>${org.icon} <b>Organization:</b> ${escapeHTML(org.name)}</div>`;
            if (org.ceo)     html += `<div>👤 <b>Leader:</b> ${escapeHTML(org.ceo)}</div>`;
            if (org.hq)      html += `<div>📍 <b>HQ:</b> ${escapeHTML(org.hq)}</div>`;
            if (org.founded) html += `<div>📅 <b>Founded:</b> ${escapeHTML(String(org.founded))}</div>`;
            if (veh)         html += `<div>🚀 <b>Flagship:</b> ${escapeHTML(veh)}</div>`;
            if (org.program) html += `<div>🛰️ <b>Program:</b> ${escapeHTML(org.program)}</div>`;
        }
        // Show next launch if available
        if (b.org && typeof SpaceData !== 'undefined' && SpaceData.launches) {
            const nextLaunch = SpaceData.launches.find(l => {
                const provider = SpaceData.getOrgForProvider(l.provider);
                return provider === b.org && new Date(l.net) > new Date();
            });
            if (nextLaunch) {
                const cd = SpaceData.getCountdown(nextLaunch);
                html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">`;
                html += `<div>🚀 <b>Next Launch:</b> ${escapeHTML(nextLaunch.name)}</div>`;
                html += `<div>⏱️ <b>Countdown:</b> <span style="color:${col}">${cd || 'TBD'}</span></div>`;
                html += `</div>`;
            }
        }
        html += `</div>`;
        // ─── Latest real-world milestone ───
        if (org && org.milestone) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">📡 LATEST MILESTONE</div>`;
            html += `<div style="color:var(--t2)">${escapeHTML(org.milestone)}</div>`;
            html += `</div>`;
        }
        // ─── Real-world fact bullets ───
        if (org && Array.isArray(org.facts) && org.facts.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">🌌 KNOWN FOR</div>`;
            org.facts.forEach(f => {
                html += `<div style="font-size:9px;padding:2px 0;color:var(--t2)">• ${escapeHTML(f)}</div>`;
            });
            html += `</div>`;
        }
      }
      // ─── POWER FACILITY panel — real 2026 AI-energy deal + live output ───
      else if (b._isPower && b._powerSrc) {
        const src = b._powerSrc;
        const liveOut = (typeof PowerZone !== 'undefined') ? PowerZone.getOutput(src.id) : null;
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">⚡ FACILITY SPECS</div>`;
        if (src.operator) html += `<div>🏭 <b>Operator:</b> ${escapeHTML(src.operator)}</div>`;
        if (src.offtaker) html += `<div>🤝 <b>Offtaker:</b> ${escapeHTML(src.offtaker)}</div>`;
        if (src.online)   html += `<div>${src.status === 'construction' ? '🚧' : '✅'} <b>Status:</b> ${escapeHTML(src.online)}</div>`;
        html += `<div>🔌 <b>Capacity:</b> ${src.mw.toLocaleString()} MW · $${src.costMWh}/MWh</div>`;
        if (liveOut !== null && src.status !== 'construction') {
            html += `<div>📈 <b>Live output:</b> <span style="color:${col}">${liveOut.toLocaleString()} MW</span>${src.id === 'power_fusion' ? ' (pulsed)' : ''}</div>`;
        }
        html += `</div>`;
        if (src.milestone) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">📡 LATEST MILESTONE</div>`;
            html += `<div style="color:var(--t2)">${escapeHTML(src.milestone)}</div>`;
            html += `</div>`;
        }
        if (Array.isArray(src.facts) && src.facts.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">🌌 KNOWN FOR</div>`;
            src.facts.forEach(f => {
                html += `<div style="font-size:9px;padding:2px 0;color:var(--t2)">• ${escapeHTML(f)}</div>`;
            });
            html += `</div>`;
        }
      }
      // ─── AI COURT panel — real 2026 legal docket ───
      else if (b.type === 'court') {
        if (typeof CourtData !== 'undefined' && Array.isArray(CourtData.DOCKET)) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.5">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">⚖️ ON THE DOCKET · 2026</div>`;
            CourtData.DOCKET.forEach(d => {
                html += `<div style="padding:5px 0;border-top:1px dashed var(--bd)">`;
                html += `<div><b style="color:${d.color}">${escapeHTML(d.case)}</b> <span style="font-size:8px;padding:1px 5px;background:var(--sf);border:1px solid var(--bd);border-radius:8px;color:var(--t2)">${escapeHTML(d.status)}</span></div>`;
                html += `<div style="font-size:9px;color:var(--t2);margin-top:1px">${escapeHTML(d.note)}</div></div>`;
            });
            html += `</div>`;
        }
        if (typeof CourtData !== 'undefined' && Array.isArray(CourtData.REGULATION_THEMES)) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">📜 HEARING TOPICS</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
            CourtData.REGULATION_THEMES.forEach(t => { html += `<span style="font-size:9px;padding:2px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:3px">${escapeHTML(t)}</span>`; });
            html += `</div></div>`;
        }
      }
      // ─── AI ACADEMY panel — real 2026 curriculum + faculty ───
      else if (b.type === 'university') {
        if (Array.isArray(b.curriculum) && b.curriculum.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            const label = b.id === 'uni_library' ? '📚 CORPUS & BENCHMARKS' : b.id === 'uni_lab' ? '🔬 FRONTIER TECHNIQUES' : b.id === 'uni_dorm' ? '🏠 CAMPUS LIFE' : '🎓 CURRICULUM · 2026';
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">${label}</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
            b.curriculum.forEach(c => { html += `<span style="font-size:9px;padding:2px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:3px">${escapeHTML(c)}</span>`; });
            html += `</div></div>`;
        }
        if (Array.isArray(b.faculty) && b.faculty.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            const flabel = b.id === 'uni_library' ? '🏆 GRADED AGAINST' : b.id === 'uni_lab' ? '📄 PUBLISHED AT' : '🏛️ MODELED ON';
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">${flabel}</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
            b.faculty.forEach(f => { html += `<span style="font-size:9px;padding:2px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:3px">${escapeHTML(f)}</span>`; });
            html += `</div></div>`;
        }
        if (typeof UniversityData !== 'undefined' && UniversityData.getStudents) {
            const n = UniversityData.getStudents().length;
            html += `<div style="margin:0 16px 16px;font-size:9px;color:var(--t3);text-align:center">🎓 ${n} model${n===1?'':'s'} currently enrolled (rumored / baby / kid stage)</div>`;
        }
      }
      // ─── THE BACKBONE panel — live network + real 2026 infra brief ───
      else if (b.type === 'backbone') {
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🌐 NETWORK STATUS</div>`;
        if (typeof BackboneZone !== 'undefined') {
            const s = BackboneZone.networkStats;
            html += `<div>🔀 <b>IX peak:</b> ${s.trafficTbps} Tbps · ${s.peeringASNs} ASNs peering</div>`;
            html += `<div>📡 <b>LEO sats tracked:</b> ${s.activeSats.toLocaleString()} · ⚡ ${s.cacheHitRate}% cache hit · ${s.avgLatencyMs}ms</div>`;
        }
        if (b.milestone) html += `<div style="margin-top:4px;color:var(--t2)">📡 ${escapeHTML(b.milestone)}</div>`;
        html += `</div>`;
        if (Array.isArray(b.facts) && b.facts.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">🌌 KNOWN FOR</div>`;
            b.facts.forEach(f => { html += `<div style="font-size:9px;padding:2px 0;color:var(--t2)">• ${escapeHTML(f)}</div>`; });
            html += `</div>`;
        }
        if (typeof BackboneZone !== 'undefined' && Array.isArray(BackboneZone.PLAYERS)) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.5">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🏗️ WHO RUNS THE BACKBONE · 2026</div>`;
            BackboneZone.PLAYERS.forEach(pl => {
                html += `<div style="padding:4px 0;border-top:1px dashed var(--bd)">`;
                html += `<div>${pl.icon} <b style="color:${pl.color}">${escapeHTML(pl.name)}</b></div>`;
                html += `<div style="font-size:9px;color:var(--t2)">${escapeHTML(pl.note)}</div></div>`;
            });
            html += `</div>`;
        }
      }
      // ─── AGENT DISTRICT panel — live agent ops + real 2026 framework roster ───
      else if (b.type === 'agents') {
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🤖 AGENT OPS</div>`;
        if (typeof AgentsZone !== 'undefined') {
            const s = AgentsZone.agentStats;
            html += `<div>🤖 <b>Active agents:</b> ${s.activeAgents.toLocaleString()} · ${s.swarmSize} swarms</div>`;
            html += `<div>⚡ <b>Tasks/hr:</b> ${s.tasksPerHour.toLocaleString()} · ${s.toolCalls.toLocaleString()} tool calls · ${s.errorRate}% errors</div>`;
        }
        const headline = {
            agents_orchestrator: '🎛️ <b>Pattern:</b> role-based crews + stateful graphs coordinate the swarm',
            agents_toolshop:     '🔧 <b>Standard:</b> MCP + Composio give agents authenticated hands',
            agents_sandbox:      '🏟️ <b>Benchmarks:</b> SWE-bench, GAIA, WebArena, OSWorld run 24/7',
            agents_deploy:       '🚀 <b>Guardrails:</b> human-in-the-loop checkpoints + rollback',
            agents_memory:       '🧠 <b>Memory:</b> vector + episodic stores persist across sessions'
        }[b.id];
        if (headline) html += `<div>${headline}</div>`;
        html += `</div>`;
        if (typeof AGENT_FRAMEWORKS !== 'undefined') {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.5">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🧩 FRAMEWORK REGISTRY · 2026</div>`;
            Object.values(AGENT_FRAMEWORKS).forEach(fw => {
                html += `<div style="padding:5px 0;border-top:1px dashed var(--bd)">`;
                html += `<div>${fw.icon} <b style="color:${fw.color}">${escapeHTML(fw.name)}</b> <span style="color:var(--t3)">· ${escapeHTML(fw.ceo)}${fw.product ? ' · ' + escapeHTML(fw.product) : ''}</span></div>`;
                if (fw.milestone) html += `<div style="font-size:9px;color:var(--t2);margin-top:1px">${escapeHTML(fw.milestone)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        }
      }
      // ─── LONGEVITY WING panel — live research + real 2026 AI-bio roster ───
      else if (b.type === 'longevity') {
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🧬 RESEARCH FLOOR</div>`;
        if (typeof LongevityZone !== 'undefined') {
            html += `<div>💊 <b>Compounds screened:</b> ${LongevityZone.compoundsScreened.toLocaleString()} this session</div>`;
            html += `<div>🏥 <b>Active trials:</b> ${LongevityZone.trialsActive} · 🧬 genomes sequenced: ${LongevityZone.genomesSequenced}</div>`;
        }
        const headline = {
            longevity_protein:   '🧠 <b>Backbone:</b> AlphaFold 3 — protein structure at atomic precision',
            longevity_discovery: '💊 <b>Milestone:</b> Insilico\'s Rentosertib — first AI-designed drug validated in humans',
            longevity_trials:    '🏥 <b>In the clinic:</b> Isomorphic & Retro dosing the first AI-designed drugs (2026)',
            longevity_genomics:  '🧬 <b>Reading life:</b> whole-genome + epigenome at scale',
            longevity_cryo:      '❄️ <b>−196°C:</b> vitrified biobanks for the long game'
        }[b.id];
        if (headline) html += `<div>${headline}</div>`;
        html += `</div>`;
        if (typeof LONGEVITY_COMPANIES !== 'undefined') {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.5">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🔬 AI-BIO ROSTER · 2026</div>`;
            Object.values(LONGEVITY_COMPANIES).forEach(co => {
                html += `<div style="padding:5px 0;border-top:1px dashed var(--bd)">`;
                html += `<div>${co.icon} <b style="color:${co.color}">${escapeHTML(co.name)}</b> <span style="color:var(--t3)">· ${escapeHTML(co.ceo)}${co.drug ? ' · ' + escapeHTML(co.drug) : ''}</span></div>`;
                if (co.milestone) html += `<div style="font-size:9px;color:var(--t2);margin-top:1px">${escapeHTML(co.milestone)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        }
      }
      // ─── VC ROW panel — real 2026 fund profile ───
      else if (b.type === 'vcrow') {
        const firm = (typeof VCRow !== 'undefined' && VCRow.FIRMS) ? VCRow.FIRMS[b.id] : null;
        if (firm) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">💰 FUND PROFILE</div>`;
            if (firm.partner)  html += `<div>👤 <b>Leadership:</b> ${escapeHTML(firm.partner)}</div>`;
            if (firm.founded)  html += `<div>📅 <b>Founded:</b> ${escapeHTML(String(firm.founded))}</div>`;
            if (firm.aum)      html += `<div>🏦 <b>Firepower:</b> ${escapeHTML(firm.aum)}</div>`;
            if (firm.recentDeal) html += `<div>🤝 <b>Recent deal:</b> ${escapeHTML(firm.recentDeal)}</div>`;
            html += `</div>`;
            if (firm.milestone) {
                html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
                html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">📡 LATEST MILESTONE</div>`;
                html += `<div style="color:var(--t2)">${escapeHTML(firm.milestone)}</div>`;
                html += `</div>`;
            }
            if (Array.isArray(firm.portfolio) && firm.portfolio.length) {
                html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
                html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">📁 PORTFOLIO</div>`;
                html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
                firm.portfolio.forEach(pf => {
                    html += `<span style="font-size:9px;padding:2px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:3px">${escapeHTML(pf)}</span>`;
                });
                html += `</div></div>`;
            }
            if (Array.isArray(firm.facts) && firm.facts.length) {
                html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
                html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">🌌 KNOWN FOR</div>`;
                firm.facts.forEach(f => {
                    html += `<div style="font-size:9px;padding:2px 0;color:var(--t2)">• ${escapeHTML(f)}</div>`;
                });
                html += `</div>`;
            }
        }
      }
      // ─── PORT DISTRICT panel — 2026 chip-war supply chain brief ───
      else if (b._isPort || (b.id && b.id.startsWith('port_'))) {
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🚢 SUPPLY CHAIN BRIEF</div>`;
        if (typeof PortZone !== 'undefined' && PortZone.ships && PortZone.ships.length) {
            const docked = PortZone.ships.filter(s => s.state === 'docked').length;
            const inbound = PortZone.ships.filter(s => s.state === 'sailing_in').length;
            html += `<div>⚓ <b>Vessels:</b> ${PortZone.ships.length} on rotation · ${docked} docked · ${inbound} inbound</div>`;
        }
        if (b.milestone) html += `<div style="margin-top:4px;color:var(--t2)">📡 ${escapeHTML(b.milestone)}</div>`;
        html += `</div>`;
        if (Array.isArray(b.facts) && b.facts.length) {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${col}">🌌 KNOWN FOR</div>`;
            b.facts.forEach(f => {
                html += `<div style="font-size:9px;padding:2px 0;color:var(--t2)">• ${escapeHTML(f)}</div>`;
            });
            html += `</div>`;
        }
        html += `<div style="margin:0 16px 16px"><button class="btn" style="width:100%" onclick="if(typeof PortEnv!=='undefined')PortEnv.showManifest()">📋 Open Cargo Manifest</button></div>`;
      }
      // ─── ROBOTICS FACTORY panel — live production + real 2026 humanoid roster ───
      else if (b.type === 'robotics') {
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🏭 FACTORY FLOOR</div>`;
        if (typeof RoboticsZone !== 'undefined') {
            html += `<div>🤖 <b>Units produced:</b> ${RoboticsZone.unitsProduced.toLocaleString()} this session</div>`;
        }
        const headline = {
            robotics_assembly: '⚙️ <b>Benchmark:</b> Figure’s BotQ line hit 1 robot/hour in Mar 2026',
            robotics_testing:  '🔬 <b>On the course:</b> all 8 flagship humanoids of 2026',
            robotics_deploy:   '🚛 <b>Now shipping to:</b> GXO, Hyundai, Mercedes, BYD — and homes',
            robotics_rd:       '🧠 <b>Frontier:</b> vision-language-action brains (Helix, Gemini Robotics)'
        }[b.id];
        if (headline) html += `<div>${headline}</div>`;
        html += `</div>`;
        // Full real-world humanoid roster
        if (typeof ROBOTICS_COMPANIES !== 'undefined') {
            html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.5">`;
            html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🤖 HUMANOID ROSTER · 2026</div>`;
            Object.values(ROBOTICS_COMPANIES).forEach(co => {
                html += `<div style="padding:5px 0;border-top:1px dashed var(--bd)">`;
                html += `<div>${co.icon} <b style="color:${co.color}">${escapeHTML(co.robot)}</b> <span style="color:var(--t3)">· ${escapeHTML(co.name)}${co.ceo ? ' · ' + escapeHTML(co.ceo) : ''}</span></div>`;
                if (co.milestone) html += `<div style="font-size:9px;color:var(--t2);margin-top:1px">${escapeHTML(co.milestone)}</div>`;
                html += `</div>`;
            });
            html += `</div>`;
        }
      }
      // ─── ALIGNMENT INSTITUTE panel — safety research brief ───
      else if (b.type === 'alignment') {
        const shieldCol = (typeof b.shield === 'number') ? ('#' + b.shield.toString(16).padStart(6, '0')) : col;
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:8px;color:${shieldCol};letter-spacing:1px">🛡️ SAFETY RESEARCH BRIEF</div>`;
        if (b.focus)    html += `<div>🎯 <b>Focus:</b> ${escapeHTML(b.focus)}</div>`;
        if (b.lead)     html += `<div>👤 <b>Lead:</b> ${escapeHTML(b.lead)}</div>`;
        if (b.location) html += `<div>📍 <b>Location:</b> ${escapeHTML(b.location)}</div>`;
        if (b.founded)  html += `<div>📅 <b>Founded:</b> ${b.founded}</div>`;
        if (b.milestone) html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">📡 <b>Latest:</b> <span style="color:var(--t2)">${escapeHTML(b.milestone)}</span></div>`;
        if (Array.isArray(b.papers) && b.papers.length) {
            html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${shieldCol}">📄 KEY PAPERS</div>`;
            b.papers.forEach(p => {
                html += `<div style="font-size:9px;padding:3px 0;color:var(--t2)">• ${escapeHTML(p)}</div>`;
            });
            html += `</div>`;
        }
        html += `</div>`;
      }
      // ─── EMBASSY panel — AI policy brief for the country ───
      else if (b.type === 'embassy') {
        const accentCol = (typeof b.accent === 'number') ? ('#' + b.accent.toString(16).padStart(6, '0')) : col;
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:8px;color:${accentCol};letter-spacing:1px">${b.emoji || '🏛️'} AI POLICY BRIEF</div>`;
        if (b.regulator)  html += `<div>🏛️ <b>Regulator:</b> ${escapeHTML(b.regulator)}</div>`;
        if (b.framework)  html += `<div>📜 <b>Framework:</b> ${escapeHTML(b.framework)}</div>`;
        if (b.stance)     html += `<div style="margin-top:4px">⚖️ <b>Stance:</b> ${escapeHTML(b.stance)}</div>`;
        if (b.milestone)  html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">📡 <b>2026:</b> <span style="color:var(--t2)">${escapeHTML(b.milestone)}</span></div>`;
        if (Array.isArray(b.labs) && b.labs.length) {
            html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">`;
            html += `<div style="font-weight:700;margin-bottom:4px;color:${accentCol}">🔬 NOTABLE LABS</div>`;
            html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
            b.labs.forEach(l => {
                html += `<span style="font-size:9px;padding:2px 6px;background:var(--sf);border:1px solid var(--bd);border-radius:3px">${escapeHTML(l)}</span>`;
            });
            html += `</div></div>`;
        }
        html += `</div>`;
      }
      // ─── VISITOR MONUMENT panel ───
      else if (b.id === 'visitor_monument') {
        const vt = typeof VisitorTracker !== 'undefined' ? VisitorTracker : { uniqueVisitors: 0, totalVisits: 0 };
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:#22d3ee">🌐 VISITOR STATISTICS</div>`;
        html += `<div>👤 <b>Unique Visitors:</b> <span style="color:#22d3ee;font-size:14px;font-weight:bold">${vt.uniqueVisitors.toLocaleString()}</span></div>`;
        html += `<div>📊 <b>Total Visits:</b> ${vt.totalVisits.toLocaleString()}</div>`;
        html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd);color:var(--t3);font-size:9px">Every visitor to Singularity City is recorded on this monument. Your presence contributes to the city's history.</div>`;
        html += `</div>`;
      }
      // ─── HQ model list (exclude DC/fab and space) ───
      else if (b.lab && !b.id.startsWith('house_')) {
        const res = G.models.filter(m => m.lab === b.lab);
        if (res.length > 0) {
          html += `<div style="margin:0 16px 16px"><span class="ipanel-lbl" style="margin-bottom:6px;display:block">All Models (${res.length})</span>`;
          res.forEach(r => {
            const s = getStage(r.rel, r.ret, r.phase); const a = typeof avgBM === 'function' ? avgBM(r.id) : 0;
            html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:10px;margin-bottom:3px"><span style="cursor:pointer;flex:1;display:flex;align-items:center;gap:6px" onclick="UI.selectModel(G.models.find(m=>m.id==='${r.id}'))"><span>${STAGES[s].emoji}</span><span style="flex:1">${escapeHTML(r.name)}</span>${a ? `<span style="font-size:9px;font-weight:700;color:${a > 80 ? '#4ade80' : '#facc15'}">${a}%</span>` : ''}<span style="font-size:8px;color:var(--t3)">${STAGES[s].label}</span></span><button class="btn" style="padding:2px 5px;font-size:7px" onclick="event.stopPropagation();UI.addToCompare('${r.id}')">⚖️</button></div>`;
          });
          html += '</div>';
        }
      }
  
      const dp = G.getDayPhase();
      const curOcc = [];
      // Construction sites are empty shells — no models "live" there, and the
      // interior doesn't render exterior citizens anyway. Skip occupancy scan.
      const isConstructionSite = (b.id.startsWith('dc_') || b.id.startsWith('fab_'))
          && b.dcData && b.dcData.status === 'construction';
      if (!isConstructionSite) {
          G.models.forEach((m, i) => {
            const stg = getStage(m.rel, m.ret, m.phase);
            const { act } = getAct(stg, dp, i, m);
            const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : { indoor: true, icon: '💻', verb: 'processing' };

            const refs = G.charRefs[m.id];
            if (refs && refs.bld === b.id) {
                // Detention Center: only ACTUAL detainees count as inside — a just-released model
                // may still have refs.bld='ai_jail' for a few ticks while it walks out, and the
                // panel must match the interior (which renders JailData.getJailedModels()).
                if (b.id === 'ai_jail' && typeof JailData !== 'undefined' && !JailData.isJailed(m.id)) return;
                curOcc.push({ m, ai, stg });
            }
          });
      }

      if (b.id.startsWith('house_') && typeof G.ceoRefs !== 'undefined') {
          const ceoRef = G.ceoRefs[b.lab];
          if (ceoRef && ceoRef.bld === b.id) {
              const ceoDummy = { id: 'ceo_'+b.lab, name: ceoRef.f.name, lab: b.lab, isCeo: true, founderData: ceoRef.f, phase: 'released' };
              curOcc.push({ m: ceoDummy, ai: { icon: '🧑‍💼', verb: 'resting' }, stg: 'adult' });
          }
      }

      if (curOcc.length > 0) {
        const isOutdoor = ['park', 'graveyard', 'city_park'].includes(b.id);
        const locLabel = isOutdoor ? 'Gathering Here' : 'Currently Inside';
        html += `<div style="margin:0 16px 16px"><span class="ipanel-lbl" style="margin-bottom:6px;display:block">${locLabel} (${curOcc.length})</span>`;
        curOcc.forEach(({ m, ai, stg }) => {
          const a = typeof avgBM === 'function' ? avgBM(m.id) : 0;
          html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:10px;margin-bottom:3px"><span style="cursor:pointer;flex:1;display:flex;align-items:center;gap:6px" onclick="UI.selectModel(${m.isCeo ? JSON.stringify(m).replace(/"/g, "&quot;") : `G.models.find(x=>x.id==='${m.id}')`})"><span>${ai.icon}</span><span style="flex:1">${escapeHTML(m.name)}</span>${a ? `<span style="font-size:9px;font-weight:700;color:${a > 80 ? '#4ade80' : '#facc15'}">${a}%</span>` : ''}</span>${!m.isCeo ? `<button class="btn" style="padding:2px 5px;font-size:7px" onclick="event.stopPropagation();UI.addToCompare('${m.id}')">⚖️</button>` : ''}</div>`;
        });
        html += '</div>';
      } else if (b.id === 'city_park') {
        // Open-air zone — count nearby visible NPCs instead of "inside" list
        let nearby = 0;
        Object.values(G.charRefs).forEach(refs => {
            if (refs.c && refs.c.visible && refs.c.x >= b.x && refs.c.x <= b.x + b.w) nearby++;
        });
        const msg = nearby > 0 ? `🌳 ${nearby} citizen${nearby > 1 ? 's' : ''} enjoying the park` : '🌳 An open-air social space for citizens to gather';
        html += `<div style="margin:0 16px 16px;padding:12px;text-align:center;color:#4ade80;font-size:9px;background:var(--cd);border:1px solid var(--bd);border-radius:4px">${msg}</div>`;
      } else if (!b.lab || b.id.startsWith('house_')) {
        const isOutdoor = ['park', 'graveyard'].includes(b.id);
        const emptyLabel = isOutdoor ? 'Nobody here right now' : 'Nobody inside right now';
        html += `<div style="margin:0 16px 16px;padding:12px;text-align:center;color:var(--t3);font-size:9px;background:var(--cd);border:1px solid var(--bd);border-radius:4px">${emptyLabel}</div>`;
      }
      
      html += `</div>`; 
      p.innerHTML = html;
    },
  
    showFounder(f) {
      const lab = LABS[f.lab] || LABS.other || {name: 'Independent', color: '#64748b'}; 
      const p = document.getElementById('infoPanel'); p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
      p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
      <div class="ipanel-top" style="background:linear-gradient(135deg,${safeColor(f.color)}22,transparent);border-bottom:2px solid ${safeColor(f.color)}33">
        <div class="ipanel-av" style="background:${safeColor(f.color)};color:#fff;font-size:20px">🧑‍💼</div>
        <div style="flex:1"><div class="ipanel-name">${escapeHTML(f.name)}</div><div class="ipanel-sub" style="color:${safeColor(f.color)}">${escapeHTML(f.role)}</div></div>
      </div>
      <div style="max-height: calc(100vh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
        <div class="ipanel-desc">${escapeHTML(f.fact)}</div>
        <div class="ipanel-grid">
          <div class="ipanel-stat"><span class="ipanel-lbl">Company</span><span class="ipanel-val">${escapeHTML(lab.name)}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Models</span><span class="ipanel-val">${G.models.filter(m => m.lab === f.lab).length}</span></div>
        </div>
        <div style="padding:8px 0"><button class="btn" style="width:100%;text-align:center;${G.tracking && G.tracking.lab === f.lab && G.tracking.type === 'ceo' ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.lab==='${f.lab}' && G.tracking.type==='ceo' ? G.stopTracking() : G.startTracking('ceo','ceo_${f.lab}','${f.lab}')">${G.tracking && G.tracking.lab === f.lab && G.tracking.type === 'ceo' ? '📡 Tracking' : '📡 Track'}</button></div>
      </div>`;
    },
  
    _censusQuery: '',

    showCensus() {
      G.unlockAchieve('census_view');
      document.getElementById('censusOv').classList.add('open');

      const alive = G.models.filter(m => !m.ret || new Date(m.ret) > new Date()).length;
      const q = UI._censusQuery || '';
      const h = `<button class="ipanel-x" onclick="document.getElementById('censusOv').classList.remove('open')">✕</button>
               <div class="ov-title">📊 CENSUS — ${G.models.length} Citizens</div>
               <div style="display:flex;justify-content:center;gap:16px;margin-bottom:10px;font-size:9px">
                  <span style="color:var(--ac)">● ${alive} Active</span>
                  <span style="color:#8b5cf6">● ${G.models.filter(m => ['rumored', 'pre_training', 'training'].includes(m.phase)).length} Pre-Training</span>
                  <span style="color:#7a7f8a">● ${G.models.length - alive} Retired</span>
               </div>
               <div style="margin-bottom:12px;position:relative">
                  <input id="censusSearch" type="text" placeholder="🔍 Search by name, lab, talent, or year…" value="${escapeHTML(q)}"
                         oninput="UI._censusQuery=this.value;UI.renderCensusList()"
                         style="width:100%;padding:8px 30px 8px 12px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;color:#fff;font-family:inherit;font-size:10px;outline:none;box-sizing:border-box"
                         onfocus="this.style.borderColor='var(--ac)'" onblur="this.style.borderColor='var(--bd)'">
                  ${q ? `<button onclick="UI._censusQuery='';document.getElementById('censusSearch').value='';UI.renderCensusList();document.getElementById('censusSearch').focus()" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--t2);cursor:pointer;font-size:14px;padding:0 6px">✕</button>` : ''}
               </div>
               <div id="censusList" style="display:flex;flex-direction:column;gap:12px;max-height:65vh;overflow-y:auto;padding-right:8px;"></div>`;

      document.getElementById('censusPan').innerHTML = h;
      UI.renderCensusList();
    },

    renderCensusList() {
      const list = document.getElementById('censusList');
      if (!list) return;
      const dp = G.getDayPhase();
      const q = (UI._censusQuery || '').trim().toLowerCase();

      const matches = (m) => {
        if (!q) return true;
        const lab = LABS[m.lab];
        const relYear = m.rel ? String(new Date(m.rel).getFullYear()) : '';
        const hay = [m.name, m.tal, m.lab, lab?.name, m.phase, relYear, m.arch?.params].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      };

      const gr = {};
      G.models.forEach((m, i) => {
        if (!matches(m)) return;
        const l = m.lab || 'other';
        if (!gr[l]) gr[l] = [];
        gr[l].push({ m, i });
      });

      let h = '';
      let total = 0;
      Object.keys(LABS).forEach(lk => {
        if (!gr[lk] || !gr[lk].length) return;
        const li = LABS[lk];
        total += gr[lk].length;

        h += `<div style="background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:12px">
                <div style="font-size:12px;font-weight:bold;color:${safeColor(li.color)};margin-bottom:10px;display:flex;align-items:center;gap:8px">
                    <span>${escapeHTML(li.icon)}</span> ${escapeHTML(li.name)} (${gr[lk].length})
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">`;

        gr[lk].forEach(({ m, i }) => {
          const s = getStage(m.rel, m.ret, m.phase);
          const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
          const { act } = getAct(s, dp, i, m);
          const ai = ACTS[act] || {icon: '💻', verb: 'processing'};
          const isPre = ['rumored', 'pre_training', 'training'].includes(m.phase);
          const statCol = isPre ? '#8b5cf6' : s === 'retired' ? '#7a7f8a' : '#4ade80';
          const relYear = m.rel ? new Date(m.rel).getFullYear() : 'Unknown';

          h += `<div style="background:var(--sf);border:1px solid var(--bd);border-radius:4px;padding:8px;cursor:pointer;transition:border-color 0.2s"
                     onclick="document.getElementById('censusOv').classList.remove('open');UI.selectModel(G.models[${i}])"
                     onmouseover="this.style.borderColor='${safeColor(li.color)}'" onmouseout="this.style.borderColor='var(--bd)'">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                      <div style="display:flex;align-items:center;gap:6px;max-width:80%;">
                          <span style="font-size:16px">${STAGES[s].emoji}</span>
                          <div>
                              <div style="font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                  ${escapeHTML(m.name)} ${m.os ? '<span style="color:#4ade80" title="Open Source">🔓</span>' : ''}
                              </div>
                              <div style="font-size:8px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                  ${m.arch?.params || '?'} • ${escapeHTML(m.tal)}
                              </div>
                          </div>
                      </div>
                      ${avg ? `<div style="font-size:10px;font-weight:700;color:${avg > 80 ? '#4ade80' : '#facc15'};background:var(--cd);padding:2px 6px;border-radius:3px;">${avg}%</div>` : ''}
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:var(--t2);border-top:1px dashed var(--bd);padding-top:6px;margin-top:2px;">
                      <span style="color:${statCol}">${ai.icon} ${ai.verb}</span>
                      <span>${relYear}</span>
                  </div>
              </div>`;
        });
        h += '</div></div>';
      });

      if (q && total === 0) {
        h = `<div style="text-align:center;padding:40px 20px;color:var(--t2);font-size:11px">No citizens match "${escapeHTML(UI._censusQuery)}"</div>`;
      } else if (q) {
        h = `<div style="font-size:9px;color:var(--t2);margin-bottom:4px">${total} match${total === 1 ? '' : 'es'}</div>` + h;
      }

      list.innerHTML = h;
    },
  
    _benchSort: 'avg',
    _benchSortDir: -1,
    
    showBenchmarks(sortKey) {
      G.unlockAchieve('benchmark_view');
      document.getElementById('benchOv').classList.add('open');
      
      // Update sort state
      if (sortKey) {
          if (this._benchSort === sortKey) { this._benchSortDir *= -1; }
          else { this._benchSort = sortKey; this._benchSortDir = -1; }
      }
      const sk = this._benchSort;
      const sd = this._benchSortDir;
      
      // Sort models by chosen metric
      const getSortVal = (m) => {
          if (sk === 'avg') return avgBM(m.id) || 0;
          if (sk === 'cost') return COSTS[m.id] ? COSTS[m.id].output : 9999;
          if (sk === 'ctx') return CTX[m.id] || 0;
          const sc = BM[m.id] || {};
          return sc[sk] !== undefined ? sc[sk] : (sc[sk.toUpperCase()] || 0);
      };
      
      const models = G.models.filter(m => BM[m.id] && typeof avgBM === 'function' && avgBM(m.id));
      if (sk === 'cost') {
          models.sort((a, b) => sd * ((getSortVal(a) || 9999) - (getSortVal(b) || 9999)));
      } else {
          models.sort((a, b) => sd * (getSortVal(b) - getSortVal(a)));
      }
      
      // Callout cards
      let topCallout = '';
      if (models.length > 0) {
          const avgSorted = [...models].sort((a, b) => (avgBM(b.id) || 0) - (avgBM(a.id) || 0));
          const top = avgSorted[0];
          const topLab = LABS[top.lab] || { name: top.lab, color: '#64748b' };
          const topAvg = avgBM(top.id);
          const eloTop = models.filter(m => BM[m.id] && BM[m.id].ELO).sort((a, b) => BM[b.id].ELO - BM[a.id].ELO)[0];
          
          topCallout = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">`;
          topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:8px"><div style="font-size:8px;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">👑 #1 Overall</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(top.name)}</div><div style="font-size:9px;color:${topLab.color}">${topLab.name} · avg ${topAvg}%</div></div>`;
          if (eloTop && eloTop.id !== top.id) {
              const eloLab = LABS[eloTop.lab] || { name: eloTop.lab, color: '#64748b' };
              topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(250,204,21,0.06);border:1px solid rgba(250,204,21,0.2);border-radius:8px"><div style="font-size:8px;color:#facc15;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⚔️ Arena King</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(eloTop.name)}</div><div style="font-size:9px;color:${eloLab.color}">${eloLab.name} · ELO ${BM[eloTop.id].ELO}</div></div>`;
          }
          const frontier = avgSorted.slice(0, 10);
          const cheapFrontier = frontier.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => COSTS[a.id].input - COSTS[b.id].input)[0];
          if (cheapFrontier) {
              const cfLab = LABS[cheapFrontier.lab] || { name: cheapFrontier.lab, color: '#64748b' };
              topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:8px"><div style="font-size:8px;color:#22d3ee;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">💰 Best Value Frontier</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(cheapFrontier.name)}</div><div style="font-size:9px;color:${cfLab.color}">${cfLab.name} · $${COSTS[cheapFrontier.id].input}/1M in</div></div>`;
          }
          topCallout += `</div>`;
      }
      
      const sortLabel = sk === 'avg' ? 'average score' : sk === 'cost' ? 'output cost' : sk === 'ctx' ? 'context window' : sk;
      const sortArrow = sd === -1 ? '▼' : '▲';
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('benchOv').classList.remove('open')">✕</button><div class="ov-title">📊 BENCHMARK OBSERVATORY</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:10px">${models.length} ranked models · sorted by ${sortLabel} ${sortArrow} · click any column to re-sort</div>`;
      h += topCallout;
      
      // Build sortable header
      const thStyle = 'cursor:pointer;user-select:none;transition:color 0.2s';
      const activeCol = (key) => sk === key ? 'color:#4ade80;' : '';
      h += `<div style="overflow-x:auto;overflow-y:auto;max-height:55vh"><table class="bench-table"><thead><tr>`;
      h += `<th style="text-align:left;position:sticky;left:0;background:var(--sf);z-index:2">Model</th>`;
      h += `<th style="${thStyle};${activeCol('avg')}" onclick="UI.showBenchmarks('avg')">Avg${sk === 'avg' ? ' ' + sortArrow : ''}</th>`;
      Object.entries(BM_M).forEach(([k, bm]) => { 
          h += `<th style="${thStyle};${activeCol(k)}color:${sk === k ? '#4ade80' : bm.c}" onclick="UI.showBenchmarks('${k}')">${bm.l}${sk === k ? ' ' + sortArrow : ''}</th>`; 
      }); 
      h += `<th style="${thStyle};${activeCol('cost')}" onclick="UI.showBenchmarks('cost')">$/1M out${sk === 'cost' ? ' ' + sortArrow : ''}</th>`;
      h += `<th style="${thStyle};${activeCol('ctx')}" onclick="UI.showBenchmarks('ctx')">Context${sk === 'ctx' ? ' ' + sortArrow : ''}</th>`;
      h += `</tr></thead><tbody>`;
      
      models.forEach((m, rank) => {
        const avg = avgBM(m.id); 
        const sc = BM[m.id] || {};
        const lab = LABS[m.lab] || { color: '#64748b' };
        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `<span style="font-size:8px;color:var(--t3)">${rank + 1}</span>`;
        const rowBorder = rank < 3 ? `border-left:2px solid ${lab.color}` : '';
        
        h += `<tr onclick="document.getElementById('benchOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${m.id}'))" style="cursor:pointer;${rowBorder}"><td style="position:sticky;left:0;background:var(--cd);z-index:2"><div style="display:flex;align-items:center;gap:6px">${medal}<div><span style="font-size:9px;font-weight:700">${escapeHTML(m.name)}</span><div style="font-size:7px;color:${lab.color}">${lab.name || m.lab}</div></div></div></td>`;
        
        h += `<td style="${sk === 'avg' ? 'background:rgba(74,222,128,0.05);' : ''}"><div style="display:flex;align-items:center;gap:4px"><div style="width:30px;height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="width:${avg}%;height:100%;background:${avg > 85 ? '#4ade80' : avg > 70 ? '#facc15' : '#ef4444'};border-radius:2px"></div></div><span style="font-weight:700;font-size:9px;color:${avg > 85 ? '#4ade80' : avg > 70 ? '#facc15' : '#ef4444'}">${avg}%</span></div></td>`;
        
        Object.keys(BM_M).forEach(k => {
          const v = sc[k] !== undefined ? sc[k] : sc[k.toUpperCase()]; 
          const col = k === 'ELO' ? (v > 1350 ? '#4ade80' : v > 1250 ? '#facc15' : '#ef4444') : (v > 90 ? '#4ade80' : v > 70 ? '#facc15' : v > 0 ? '#ef4444' : 'var(--t3)');
          const highlight = sk === k ? 'background:rgba(74,222,128,0.05);' : '';
          h += `<td style="color:${col};${highlight}">${k === 'ELO' ? (v || '—') : (v ? v + '%' : '—')}</td>`;
        });
        
        const cost = COSTS[m.id]; 
        h += `<td style="color:#facc15;${sk === 'cost' ? 'background:rgba(250,204,21,0.05);' : ''}">${cost && cost.output !== undefined ? '$' + cost.output : '—'}</td>`;
        
        const ctx_val = CTX[m.id];
        h += `<td style="color:var(--t2);${sk === 'ctx' ? 'background:rgba(34,211,238,0.05);' : ''}">${ctx_val !== undefined ? (ctx_val >= 1e6 ? (ctx_val / 1e6).toFixed(1).replace('.0','') + 'M' : (ctx_val / 1e3).toFixed(0) + 'K') : '—'}</td></tr>`;
      });
      h += '</tbody></table></div>'; 
      document.getElementById('benchPan').innerHTML = h;
    },
  
    showCompare() {
      document.getElementById('compareOv').classList.add('open'); const pan = document.getElementById('comparePan');
      const ms = this.compareList.map(id => G.models.find(m => m.id === id)).filter(Boolean);
      if (ms.length < 2) { pan.innerHTML = '<button class="ipanel-x" onclick="document.getElementById(\'compareOv\').classList.remove(\'open\')">✕</button><div class="ov-title">⚖️ COMPARE</div><div style="text-align:center;padding:40px;color:var(--t3)">Select 2+ models via ⚖️ buttons.</div>'; 
      return; }
      let h = `<button class="ipanel-x" onclick="document.getElementById('compareOv').classList.remove('open')">✕</button><div class="ov-title">⚖️ MODEL COMPARISON</div><div style="display:grid;grid-template-columns:repeat(${ms.length},1fr);gap:8px;margin-bottom:16px">`;
      ms.forEach(m => { const lab = LABS[m.lab] || LABS.other || {color: '#64748b', name: 'Independent'}; const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0; h += `<div style="text-align:center;padding:10px;background:var(--cd);border:2px solid ${lab.color}44;border-radius:6px"><div style="font-size:10px;font-weight:700">${escapeHTML(m.name)}</div><div style="font-size:8px;color:${lab.color}">${lab.name}</div>${avg ? `<div style="font-size:14px;font-weight:700;color:${avg > 80 ? '#4ade80' : '#facc15'};margin-top:4px">${avg}%</div>` : ''}</div>`; });
      h += '</div><div style="max-height:50vh;overflow-y:auto">';
      Object.entries(BM_M).forEach(([k, bm]) => {
        h += `<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--t2);margin-bottom:4px">${bm.l}</div>`;
        ms.forEach(m => {
          const sc = BM[m.id] || {};
          const v = sc[k] !== undefined ? sc[k] : (sc[k.toUpperCase()] || 0); 
          const lab = LABS[m.lab] || LABS.other || {color: '#64748b'}; const fw = k === 'ELO' ? (v ? Math.min(100, (v - 1000) / 4.5) : 0) : Math.min(100, v); const dv = k === 'ELO' ? (v || '—') : (v ? v + '%' : '—');
          h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-size:8px;color:var(--t3);width:60px;text-align:right;flex-shrink:0">${escapeHTML(m.name).split(' ').pop()}</span><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="width:${fw}%;height:100%;background:${lab.color};border-radius:3px"></div></div><span style="font-size:8px;color:${bm.c};width:36px;font-weight:700">${dv}</span></div>`;
        });
        h += '</div>';
      });
      h += `</div><div style="margin-top:12px;text-align:center"><button class="btn" onclick="UI.compareList=[];document.getElementById('compareOv').classList.remove('open')">Clear & Close</button></div>`; pan.innerHTML = h;
    },

    showLaunches() {
      document.getElementById('launchOv').classList.add('open');
      const pan = document.getElementById('launchPan');
      
      const launches = (typeof SpaceData !== 'undefined') ? SpaceData.launches : [];
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('launchOv').classList.remove('open')">✕</button>`;
      h += `<div class="ov-title">🚀 LAUNCH SCHEDULE</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:12px">Real-time data from Launch Library 2 API · Updated every 30 min</div>`;
      
      if (!launches.length) {
          h += `<div style="text-align:center;padding:40px;color:var(--t3);font-size:11px">No launch data available yet.<br>Data fetches automatically every 30 minutes.</div>`;
      } else {
          launches.forEach((l, i) => {
              const net = new Date(l.net);
              const now = new Date();
              const diff = net - now;
              const isPast = diff < 0;
              
              let countdown = '';
              if (isPast) {
                  countdown = '<span style="color:#4ade80">LAUNCHED</span>';
              } else {
                  countdown = `<span style="color:#22d3ee">${SpaceData.getCountdown(l)}</span>`;
              }
              
              const orgKey = SpaceData.getOrgForProvider(l.provider);
              const org = orgKey ? SPACE_ORGS[orgKey] : null;
              const orgColor = org ? org.color : '#64748b';
              const orgIcon = org ? org.icon : '🚀';
              
              const dateStr = net.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = net.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              
              h += `<div style="padding:10px 12px;margin-bottom:6px;background:${i === 0 ? 'rgba(34,211,238,0.05)' : 'var(--cd)'};border:1px solid ${i === 0 ? orgColor + '44' : 'var(--bd)'};border-radius:6px;${i === 0 ? 'border-left:3px solid ' + orgColor : ''}">`;
              h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
              h += `<div style="font-size:11px;font-weight:700;color:#fff">${orgIcon} ${escapeHTML(l.name)}</div>`;
              h += `<div style="font-size:10px;font-weight:700">${countdown}</div>`;
              h += `</div>`;
              h += `<div style="display:flex;gap:12px;font-size:9px;color:var(--t3)">`;
              h += `<span>🏢 ${escapeHTML(l.provider)}</span>`;
              h += `<span>🚀 ${escapeHTML(l.rocket)}</span>`;
              h += `<span>📅 ${dateStr} ${timeStr}</span>`;
              h += `</div>`;
              if (l.mission) {
                  h += `<div style="font-size:9px;color:var(--t2);margin-top:4px">📡 Mission: ${escapeHTML(l.mission)}</div>`;
              }
              if (l.pad && l.pad !== 'Unknown') {
                  h += `<div style="font-size:8px;color:var(--t3);margin-top:2px">📍 ${escapeHTML(l.pad)}</div>`;
              }
              h += `</div>`;
          });
      }
      
      h += `<div style="margin-top:10px;text-align:center"><button class="btn" style="width:100%" onclick="if(typeof SpaceData!=='undefined')SpaceData.fetchLaunches(true);setTimeout(()=>UI.showLaunches(),2000)">🔄 Refresh Launch Data</button></div>`;
      
      pan.innerHTML = h;
    },
  
    showFamilyTree() {
      G.unlockAchieve('family_view');
      document.getElementById('familyOv').classList.add('open');
      const pan = document.getElementById('familyPan');

      // Count total families for header stat
      const labKeys = Object.keys(FAMILIES || {}).filter(lk => LABS[lk]);

      let h = `<button class="ipanel-x" onclick="document.getElementById('familyOv').classList.remove('open')">✕</button>
        <div class="ov-title">🧬 MODEL LINEAGE</div>
        <div style="font-size:8px;color:var(--t3);text-align:center;margin-bottom:12px">${labKeys.length} labs with tracked model lineage</div>
        <div style="max-height:62vh;overflow-y:auto;padding-right:4px">`;

      labKeys.forEach(lk => {
        const edges = FAMILIES[lk];
        const lab = LABS[lk];
        if (!lab || !edges || !edges.length) return;

        // Build node set & find roots
        const nodes = new Set();
        edges.forEach(e => { nodes.add(e.id); if (e.children) e.children.forEach(c => nodes.add(c)); });
        const childSet = new Set();
        edges.forEach(e => { if (e.children) e.children.forEach(c => childSet.add(c)); });
        const roots = [...nodes].filter(n => !childSet.has(n));
        if (roots.length === 0) return;

        // Count models in this tree
        let treeCount = 0;
        nodes.forEach(n => { if (G.models.find(x => x.id === n)) treeCount++; });

        h += `<div style="margin-bottom:14px;background:var(--cd);border:1px solid ${lab.color}33;border-radius:8px;overflow:hidden">`;
        // Lab header bar
        h += `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${lab.color}11;border-bottom:1px solid ${lab.color}22">
          <span style="font-size:14px">${escapeHTML(lab.icon || '🏢')}</span>
          <span style="font-size:10px;font-weight:bold;color:${safeColor(lab.color)};flex:1">${escapeHTML(lab.name)}</span>
          <span style="font-size:7px;color:var(--t3);background:var(--cd);padding:2px 8px;border-radius:10px">${treeCount} models</span>
        </div>`;
        h += `<div style="padding:10px 14px">`;

        const render = (id, depth, isLast) => {
          const m = G.models.find(x => x.id === id);
          if (!m) return '';
          const s = getStage(m.rel, m.ret, m.phase);
          const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
          const year = new Date(m.rel).getFullYear();
          const edge = edges.find(e => e.id === id);
          const children = edge ? edge.children.filter(c => G.models.find(x => x.id === c)) : [];
          const isRoot = depth === 0;
          const retired = m.ret && new Date(m.ret).getTime() <= Date.now();

          // Connector lines
          let connector = '';
          if (!isRoot) {
            connector = `<div style="display:flex;align-items:center;width:20px;flex-shrink:0">
              <div style="width:10px;height:1px;background:${lab.color}55"></div>
              <div style="width:4px;height:4px;border-radius:50%;background:${lab.color};flex-shrink:0"></div>
            </div>`;
          }

          // Benchmark bar
          let bmBar = '';
          if (avg) {
            const barCol = avg > 85 ? '#4ade80' : avg > 65 ? '#facc15' : '#f97316';
            bmBar = `<div style="width:40px;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-left:auto;flex-shrink:0">
              <div style="width:${avg}%;height:100%;background:${barCol};border-radius:2px"></div>
            </div>
            <span style="font-size:7px;color:${barCol};font-weight:bold;min-width:24px;text-align:right">${avg}%</span>`;
          }

          let o = `<div style="display:flex;align-items:center;margin-left:${depth * 24}px;margin-bottom:2px">
            ${connector}
            <div style="display:flex;align-items:center;gap:5px;flex:1;padding:5px 10px;background:var(--sf);border:1px solid ${retired ? 'var(--bd)' : lab.color + '22'};border-radius:6px;cursor:pointer;transition:border-color 0.15s,background 0.15s;${retired ? 'opacity:0.5;' : ''}"
                 onmouseenter="this.style.borderColor='${lab.color}';this.style.background='${lab.color}11'"
                 onmouseleave="this.style.borderColor='${retired ? 'var(--bd)' : lab.color + '22'}';this.style.background='var(--sf)'"
                 onclick="document.getElementById('familyOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${id}'))">
              <span style="font-size:11px">${STAGES[s].emoji}</span>
              <span style="font-size:9px;font-weight:700;color:${retired ? 'var(--t3)' : '#fff'}">${escapeHTML(m.name)}</span>
              <span style="font-size:7px;color:var(--t3);background:var(--cd);padding:1px 5px;border-radius:3px">${year}</span>
              ${children.length > 0 ? `<span style="font-size:6px;color:${lab.color};margin-left:2px">▸ ${children.length}</span>` : ''}
              ${bmBar}
            </div>
          </div>`;

          // Render children with vertical connector
          children.forEach((c, i) => { o += render(c, depth + 1, i === children.length - 1); });
          return o;
        };

        roots.forEach(r => { h += render(r, 0, true); });
        h += '</div></div>';
      });

      h += '</div>';
      pan.innerHTML = h;
    },
  
    showCalendar() {
      G.unlockAchieve('calendar_view'); document.getElementById('calendarOv').classList.add('open');
      const pan = document.getElementById('calendarPan'); const now = new Date();
      const up = AI_EVENTS.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
      const past = AI_EVENTS.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
      let h = `<button class="ipanel-x" onclick="document.getElementById('calendarOv').classList.remove('open')">✕</button><div class="ov-title">📅 AI EVENTS</div><div style="max-height:65vh;overflow-y:auto">`;
      if (up.length) {
        h += '<div style="font-size:9px;color:var(--ac);margin-bottom:8px;font-weight:700">UPCOMING</div>';
        up.forEach(e => {
          const d = new Date(e.date); const days = Math.ceil((d - now) / (864e5)); const tc = e.type === 'conference' ? '#22d3ee' : e.type === 'release' ? '#4ade80' : '#facc15';
          h += `<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px"><div style="text-align:center;min-width:40px"><div style="font-size:14px;font-weight:700">${d.getDate()}</div><div style="font-size:7px;color:var(--t3)">${d.toLocaleDateString('en', { month: 'short' })}</div></div><div style="flex:1"><div style="font-size:9px;font-weight:700">${e.name}</div><div style="font-size:7px;color:var(--t3)">${e.desc}</div></div><span style="font-size:8px;color:${tc};border:1px solid ${tc}44;padding:2px 6px;border-radius:3px">${days}d</span></div>`;
        });
      }
      if (past.length) {
        h += '<div style="font-size:9px;color:var(--t3);margin:12px 0 8px;font-weight:700">PAST</div>';
        past.forEach(e => { h += `<div style="padding:6px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:3px;opacity:.6"><div style="font-size:8px;color:var(--t2)">${new Date(e.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })} — ${e.name}</div></div>`; });
      }
      h += '</div>'; pan.innerHTML = h;
    },
  
    showCompute() {
      document.getElementById('computeOv').classList.add('open'); const pan = document.getElementById('computePan');
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('computeOv').classList.remove('open')">✕</button>
               <div class="ov-title">🏭 GLOBAL SUPPLY CHAIN & COMPUTE</div>
               <div style="max-height:65vh;overflow-y:auto;padding-right:5px;">`;
               
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
              <div style="background:var(--cd);border:1px solid var(--bd);padding:12px;border-radius:6px;text-align:center">
                  <div style="font-size:7px;color:var(--t3)">EST. GLOBAL GPUs</div>
                  <div style="font-size:16px;font-weight:700;color:#4ade80">~3.5M</div>
              </div>
              <div style="background:var(--cd);border:1px solid var(--bd);padding:12px;border-radius:6px;text-align:center">
                  <div style="font-size:7px;color:var(--t3)">EST. POWER DRAW</div>
                  <div style="font-size:16px;font-weight:700;color:#facc15">~15.2 GW</div>
              </div>
            </div>`;

      h += `<div class="arch-title" style="margin-top:0;">⚠️ Critical Bottlenecks</div><div style="margin-bottom:16px">`;
      (SUPPLY_CHAIN.bottlenecks || []).forEach(b => {
          if (!b || !b.name) return;
          h += `<div style="margin-top:8px">
                  <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:4px">
                      <span style="color:var(--t1)">${b.name}</span>
                      <span style="color:${b.color};font-weight:bold">${b.load}% Capacity Limit</span>
                  </div>
                  <div style="width:100%;height:6px;background:var(--cd);border:1px solid var(--bd);border-radius:3px;overflow:hidden">
                      <div style="width:${b.load}%;height:100%;background:${b.color};box-shadow:0 0 5px ${b.color}"></div>
                  </div>
                </div>`;
      });
      h += `</div>`;

      h += `<div class="arch-title">🚀 AI Accelerator Pipeline (2026)</div><div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">`;
      (SUPPLY_CHAIN.accelerators || []).forEach(a => {
          if (!a || !a.name) return;
          const isRubin = a.name.includes("Rubin");
          h += `<div style="padding:10px;background:var(--sf);border:1px solid ${isRubin ? '#22d3ee55' : 'var(--bd)'};border-radius:4px; ${isRubin ? 'box-shadow: inset 0 0 15px rgba(34,211,238,0.1)' : ''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <span style="font-size:11px;font-weight:bold;color:${isRubin ? '#22d3ee' : '#fff'}">${a.name}</span>
                      <span style="font-size:9px;color:var(--t3);background:var(--cd);padding:2px 6px;border-radius:3px;">${a.price}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:9px">
                      <span style="color:var(--ac)">Status: ${a.status}</span>
                      <span style="color:#f472b6">Mem: ${a.memory}</span>
                  </div>
                </div>`;
      });
      h += `</div>`;

      h += `<div class="arch-title">🔬 Foundry & Lithography Wars</div>`;
      const _hna = SUPPLY_CHAIN.lithography?.asml_high_na;
      if (_hna && _hna.name) {
          h += `<div style="padding:10px;background:var(--cd);border:1px dashed #f9731655;border-radius:4px;margin-bottom:8px">
                <div style="font-size:10px;font-weight:bold;color:#f97316;margin-bottom:4px">${_hna.name}</div>
                <div style="font-size:8px;color:var(--t2);margin-bottom:8px">${_hna.desc} (Unit Cost: ${_hna.cost})</div>
                <div style="display:flex;justify-content:space-between;font-size:8px;background:var(--sf);padding:6px;border-radius:4px;">
                    <span style="color:var(--t1)">Intel: <b style="color:#4ade80">${_hna.deployed?.intel ?? '?'}</b> units</span>
                    <span style="color:var(--t1)">Samsung: <b style="color:#4ade80">${_hna.deployed?.samsung ?? '?'}</b> units</span>
                    <span style="color:var(--t1)">TSMC: <b style="color:#ef4444">${_hna.deployed?.tsmc ?? 0}</b> units <span style="color:var(--t3)">(Using Low-NA)</span></span>
                </div>
            </div>`;
      }
            
      (SUPPLY_CHAIN.foundries || []).forEach(f => {
          if (!f || !f.name) return;
          h += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--sf);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px">
                  <div>
                      <div style="font-size:10px;font-weight:bold;color:var(--t1)">${f.name} <span style="color:var(--cy);font-weight:normal;margin-left:4px;">${f.node}</span></div>
                      <div style="font-size:8px;color:var(--t3);margin-top:4px">Pack: ${f.packaging}</div>
                  </div>
                  <div style="font-size:8px;color:${f.capacity.includes('Booked') ? '#ef4444' : '#facc15'};font-weight:bold;background:var(--cd);padding:6px 10px;border-radius:4px;border:1px solid var(--bd)">
                      ${f.capacity}
                  </div>
                </div>`;
      });

      // Live semiconductor news from RSS
      if (typeof API !== 'undefined' && API.supplyChainNews?.length > 0) {
          h += `<div class="arch-title" style="margin-top:16px;">📰 Live Semiconductor News</div>`;
          API.supplyChainNews.slice(0, 6).forEach(n => {
              const catColors = { lithography: '#f97316', foundry: '#22d3ee', bottleneck: '#ef4444', accelerator: '#4ade80' };
              const catIcons = { lithography: '🔬', foundry: '🏭', bottleneck: '⚠️', accelerator: '🚀' };
              h += `<a href="${safeHref(n.url)}" target="_blank" rel="noopener" style="display:block;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:3px;text-decoration:none;cursor:pointer;">
                      <div style="display:flex;align-items:center;gap:6px">
                          <span style="font-size:10px">${catIcons[n.category] || '📰'}</span>
                          <span style="font-size:7px;padding:2px 5px;background:${catColors[n.category] || 'var(--bd)'}22;color:${catColors[n.category] || 'var(--t2)'};border-radius:3px;text-transform:uppercase;font-weight:700">${escapeHTML(n.category)}</span>
                          <span style="font-size:7px;color:var(--t3);margin-left:auto">${escapeHTML(n.source)}</span>
                      </div>
                      <div style="font-size:8px;color:var(--t1);margin-top:4px;line-height:1.3">${escapeHTML(n.headline)}</div>
                    </a>`;
          });
      }

      h += `<div class="arch-title" style="margin-top:16px;">🏢 Active Lab Clusters</div>`;
      COMPUTE_DATA.clusters.forEach(c => {
        const lab = c.lab ? LABS[c.lab] : null;
        h += `<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px"><span style="font-size:12px">${lab ? escapeHTML(lab.icon) : '🖥️'}</span><div style="flex:1"><div style="font-size:9px;font-weight:700">${escapeHTML(c.name)}</div><div style="font-size:7px;color:var(--t3)">${escapeHTML(c.location)}</div></div><div style="text-align:right"><div style="font-size:10px;font-weight:700;color:var(--cy)">${(c.gpus / 1e3).toFixed(0)}K</div><div style="font-size:6px;color:var(--t3)">${escapeHTML(c.type)}</div></div></div>`;
      });
      
      h += '</div>'; 
      pan.innerHTML = h;
    },
  
    showCostDashboard() {
      document.getElementById('costOv').classList.add('open');
      const pan = document.getElementById('costPan');
      const models = G.models.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => (COSTS[a.id]?.input || 999) - (COSTS[b.id]?.input || 999));
      if (!models.length) { pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('costOv').classList.remove('open')">✕</button><div class="ov-title">💰 PRICE WAR TRACKER</div><div style="text-align:center;padding:40px;color:var(--t3)">No pricing data yet.</div>`; return; }
      
      // Find cheapest frontier (top 15 by benchmark)
      const ranked = G.models.filter(m => BM[m.id] && avgBM(m.id)).sort((a, b) => avgBM(b.id) - avgBM(a.id));
      const frontier = ranked.slice(0, 15);
      const cheapFrontier = frontier.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => COSTS[a.id].input - COSTS[b.id].input);
      
      // Group by lab
      const labGroups = {};
      models.forEach(m => {
          if (!labGroups[m.lab]) labGroups[m.lab] = [];
          labGroups[m.lab].push(m);
      });
      // Sort labs by cheapest model
      const sortedLabs = Object.keys(labGroups).sort((a, b) => {
          const cheapA = Math.min(...labGroups[a].map(m => COSTS[m.id].input));
          const cheapB = Math.min(...labGroups[b].map(m => COSTS[m.id].input));
          return cheapA - cheapB;
      });
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('costOv').classList.remove('open')">✕</button><div class="ov-title">💰 PRICE WAR TRACKER</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:10px">${models.length} models with pricing · per 1M tokens</div>`;
      
      // Callout cards
      h += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">`;
      if (models[0]) {
          const ch = models[0]; const chLab = LABS[ch.lab] || { name: ch.lab, color: '#64748b' };
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:8px"><div style="font-size:8px;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">💚 Cheapest Overall</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(ch.name)}</div><div style="font-size:9px;color:${chLab.color}">${chLab.name} · $${COSTS[ch.id].input} in / $${COSTS[ch.id].output} out</div></div>`;
      }
      if (cheapFrontier[0]) {
          const cf = cheapFrontier[0]; const cfLab = LABS[cf.lab] || { name: cf.lab, color: '#64748b' }; const cfAvg = avgBM(cf.id);
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:8px"><div style="font-size:8px;color:#22d3ee;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⚡ Cheapest Frontier</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(cf.name)}</div><div style="font-size:9px;color:${cfLab.color}">${cfLab.name} · $${COSTS[cf.id].input} in · ${cfAvg}% avg</div></div>`;
      }
      // Best bang-for-buck
      const withBang = models.filter(m => avgBM(m.id) && COSTS[m.id].output > 0).map(m => ({ m, bang: avgBM(m.id) / COSTS[m.id].output })).sort((a, b) => b.bang - a.bang);
      if (withBang[0]) {
          const bb = withBang[0].m; const bbLab = LABS[bb.lab] || { name: bb.lab, color: '#64748b' };
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(250,204,21,0.06);border:1px solid rgba(250,204,21,0.2);border-radius:8px"><div style="font-size:8px;color:#facc15;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🏆 Best Bang-for-Buck</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(bb.name)}</div><div style="font-size:9px;color:${bbLab.color}">${bbLab.name} · ${withBang[0].bang.toFixed(1)} quality/$</div></div>`;
      }
      h += `</div>`;
      
      // Lab-grouped price comparison
      h += `<div style="max-height:50vh;overflow-y:auto">`;
      const mxIn = Math.max(...models.map(m => COSTS[m.id]?.input || 0));
      
      sortedLabs.forEach(labKey => {
          const lab = LABS[labKey] || { name: labKey, color: '#64748b' };
          const labModels = labGroups[labKey].sort((a, b) => COSTS[a.id].input - COSTS[b.id].input);
          
          h += `<div style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 0;border-bottom:1px solid ${safeColor(lab.color)}33"><span style="font-size:10px;font-weight:700;color:${safeColor(lab.color)}">${escapeHTML(lab.name || labKey)}</span><span style="font-size:8px;color:var(--t3)">${labModels.length} model${labModels.length > 1 ? 's' : ''}</span></div>`;
          
          labModels.forEach(m => {
              const c = COSTS[m.id];
              const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
              const bwIn = mxIn > 0 ? Math.max(2, (c.input / mxIn) * 100) : 2;
              
              h += `<div style="padding:5px 8px;background:var(--cd);border-radius:4px;margin-bottom:2px;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="document.getElementById('costOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${m.id}'))">`;
              h += `<span style="font-size:9px;font-weight:700;width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(m.name)}</span>`;
              h += `<div style="flex:1;height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="width:${bwIn}%;height:100%;background:${lab.color};border-radius:2px"></div></div>`;
              h += `<span style="font-size:8px;color:#4ade80;width:50px;text-align:right">$${c.input}</span>`;
              h += `<span style="font-size:8px;color:#facc15;width:50px;text-align:right">$${c.output}</span>`;
              h += avg ? `<span style="font-size:8px;color:${avg > 80 ? '#4ade80' : '#facc15'};width:30px;text-align:right">${avg}%</span>` : `<span style="width:30px"></span>`;
              h += `</div>`;
          });
          h += `</div>`;
      });
      h += `</div>`; 
      pan.innerHTML = h;
    },
  
    showNewsPanel() {
      document.getElementById('newsOv').classList.add('open'); const pan = document.getElementById('newsPan');
      let h = `<button class="ipanel-x" onclick="document.getElementById('newsOv').classList.remove('open')">✕</button><div class="ov-title">📰 AI NEWS</div><div style="text-align:center;margin-bottom:12px"><button class="btn" onclick="API.fetchLiveNews().then(()=>UI.showNewsPanel())">🔄 Refresh</button></div><div style="max-height:60vh;overflow-y:auto">`;
      if (!API.liveNews.length) h += '<div style="text-align:center;padding:30px;color:var(--t3);font-size:9px">Fetching headlines...</div>';
      else {
        if (API.liveNews[0]?.source === 'Fallback') h += '<div style="text-align:center;padding:8px;margin-bottom:8px;font-size:8px;color:var(--pk);background:#f472b610;border:1px solid #f472b622;border-radius:4px">Showing fallback headlines</div>';
        API.liveNews.forEach(n => {
          const safeHeadline = escapeHTML(n.headline);
          const safeSource = escapeHTML(n.source);
          const safeUrl = safeHref(n.url);
          h += `<a href="${safeUrl}" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px;text-decoration:none;transition:border-color .15s" onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--bd)'"><span style="font-size:14px">📰</span><div style="flex:1"><div style="font-size:9px;color:var(--t1);line-height:1.4">${safeHeadline}</div><div style="font-size:7px;color:var(--cy);margin-top:2px">${safeSource}</div></div></a>`;
        });
      }
      h += '</div>'; pan.innerHTML = h;
    },
  
    showAnalyst() {
      document.getElementById('analystOv').classList.add('open'); const pan = document.getElementById('analystPan');
      const providerName = { xai: 'Grok', openai: 'ChatGPT', anthropic: 'Claude', google: 'Gemini' }[G.apiProvider] || 'AI';
      const hasKey = !!G.authKey;
      pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('analystOv').classList.remove('open')">✕</button>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="ov-title" style="margin:0">🤖 ${providerName}</div>
          <div style="font-size:7px;color:var(--t3)">${G.modelId || 'default'} · <span style="color:${hasKey ? '#4ade80' : '#ef4444'}">${hasKey ? 'KEY SET' : 'NO KEY'}</span></div>
        </div>
        <div id="analystChat" style="height:55vh;overflow-y:auto;margin-bottom:10px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px">
          ${hasKey ? '<div style="font-size:9px;color:var(--t3);text-align:center;padding:40px 20px">Ask anything — this is a full conversation with ' + providerName + '.<br><span style="color:var(--t3);font-size:7px;margin-top:8px;display:block">Multi-turn chat with conversation history. Uses your API key.</span></div>' : '<div style="font-size:9px;color:#ef4444;text-align:center;padding:40px 20px">No API key set.<br><span style="color:var(--t3);font-size:7px;margin-top:8px;display:block">Go to ⚙️ Settings to add your API key.</span></div>'}
        </div>
        <div style="display:flex;gap:6px">
          <input type="text" id="analystInput" placeholder="Message ${providerName}..." class="sel-input" style="margin:0;flex:1" onkeydown="if(event.key==='Enter'&&!event.shiftKey)API.askAnalyst()">
          <button class="btn" style="padding:8px 14px" onclick="API.askAnalyst()">Send</button>
          <button class="btn" style="padding:8px 10px;color:var(--t3);font-size:7px" onclick="API._chatHistory=[];document.getElementById('analystChat').innerHTML='<div style=\\'font-size:9px;color:var(--t3);text-align:center;padding:40px 20px\\'>Conversation cleared.</div>'" title="Clear chat">Clear</button>
        </div>`;
    },
  
    // Renders a labelled on/off switch row for the settings panel.
    _toggleRow(id, name, desc, checked) {
      return `<div class="sc-toggle-row">
        <div class="sc-toggle-text"><span class="sc-toggle-name">${name}</span><span class="sc-toggle-desc">${desc}</span></div>
        <label class="sc-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="sc-slider"></span></label>
      </div>`;
    },

    // The Notifications / Experience / Sound sections of the settings panel.
    _settingsToggleSection() {
      const p = (G.prefs) || {};
      const sfxOn   = (typeof SND !== 'undefined') ? SND.enabled : (p.sfx !== false);
      const musicOn = (typeof SND !== 'undefined') ? SND.musicEnabled : (p.music !== false);
      const idle = p.idleTourMin || 5;
      const idleOpt = (v, lbl) => `<option value="${v}" ${idle === v ? 'selected' : ''}>${lbl}</option>`;
      const reduceMotionOn = (typeof G.reduceMotionOn === 'function') ? G.reduceMotionOn() : (p.reduceMotion === true);
      const uiScale = p.uiScale || 1;
      const scaleOpt = (v, lbl) => `<option value="${v}" ${Math.abs(uiScale - v) < 0.01 ? 'selected' : ''}>${lbl}</option>`;
      return `
        <div style="margin-top:20px; margin-bottom:14px; border-top:1px solid var(--bd); padding-top:20px">
          <div class="sc-settings-section-title">NOTIFICATIONS</div>
          ${this._toggleRow('prefDailyBrief', '📽 Daily Briefing prompt', 'Auto-offer a recap video of the previous day', p.dailyBrief !== false)}
          ${this._toggleRow('prefNewsToasts', '🚨 Live news alerts', 'Pop a share card when the city reacts to real AI news', p.newsToasts !== false)}
        </div>

        <div style="margin-bottom:14px">
          <div class="sc-settings-section-title">EXPERIENCE</div>
          ${this._toggleRow('prefAutoTour', '🎥 Idle auto-tour', 'Cinematic screensaver after you go idle', p.autoTour !== false)}
          <div class="sc-toggle-row">
            <div class="sc-toggle-text"><span class="sc-toggle-name">⏱ Idle delay</span><span class="sc-toggle-desc">Inactivity before the tour begins</span></div>
            <select id="prefIdleTourMin" class="sel-select" style="width:auto;margin:0;padding:6px 8px;font-size:10px">
              ${idleOpt(1,'1 min')}${idleOpt(3,'3 min')}${idleOpt(5,'5 min')}${idleOpt(10,'10 min')}${idleOpt(20,'20 min')}
            </select>
          </div>
          ${this._toggleRow('prefWeather', '🌦 Dynamic weather', 'Rain, fog, snow and seasonal effects', p.weather !== false)}
        </div>

        <div style="margin-bottom:14px">
          <div class="sc-settings-section-title">SOUND</div>
          ${this._toggleRow('prefSfx', '🔊 Sound effects', 'UI clicks and city ambiance', sfxOn)}
          ${this._toggleRow('prefMusic', '🎵 Background music', 'The Singularity City soundtrack', musicOn)}
        </div>

        <div style="margin-bottom:14px">
          <div class="sc-settings-section-title">ACCESSIBILITY</div>
          ${this._toggleRow('prefReduceMotion', '🌀 Reduce motion', 'No lightning flashes, fewer particles & animations', reduceMotionOn)}
          <div class="sc-toggle-row">
            <div class="sc-toggle-text"><span class="sc-toggle-name">🔠 Text size</span><span class="sc-toggle-desc">Enlarge tickers, tooltips & panel text</span></div>
            <select id="prefUiScale" class="sel-select" style="width:auto;margin:0;padding:6px 8px;font-size:10px">
              ${scaleOpt(1,'Normal')}${scaleOpt(1.15,'Large')}${scaleOpt(1.3,'Larger')}
            </select>
          </div>
        </div>`;
    },

    showSettings() {
      document.getElementById('settingsOv').classList.add('open');
      document.getElementById('settingsPan').innerHTML = `<button class="ipanel-x" onclick="document.getElementById('settingsOv').classList.remove('open')">✕</button><div class="ov-title">⚙️ SETTINGS</div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">API Provider</label><select id="apiProviderSel" class="sel-select" onchange="UI.updateModelDatalist()"><option value="xai" ${G.apiProvider === 'xai' ? 'selected' : ''}>xAI</option><option value="openai" ${G.apiProvider === 'openai' ? 'selected' : ''}>OpenAI</option><option value="anthropic" ${G.apiProvider === 'anthropic' ? 'selected' : ''}>Anthropic</option><option value="google" ${G.apiProvider === 'google' ? 'selected' : ''}>Google</option></select></div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">Model ID</label><input type="text" id="modelIdInput" list="modelSuggestions" value="${G.modelId}" class="sel-input"><datalist id="modelSuggestions"></datalist></div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">API Key</label><input type="password" id="authKeyInput" value="${G.authKey}" placeholder="API Key..." class="sel-input">
          <div style="font-size:7px;color:var(--t3);margin-top:4px;line-height:1.5">🔒 Keys are stored unencrypted in this browser's local storage and sent only to your chosen provider. Don't enter keys on shared computers; use a low-limit key you can revoke.</div></div>
        <div style="margin-bottom:14px">
          <label class="ipanel-lbl">Auto-Scan</label>
          <select id="autoScanSel" class="sel-select" style="margin-top:6px">
            <option value="0" ${G.autoScanMin === 0 ? 'selected' : ''}>Off</option>
            <option value="5" ${G.autoScanMin === 5 ? 'selected' : ''}>5 min</option>
            <option value="10" ${G.autoScanMin === 10 ? 'selected' : ''}>10 min</option>
            <option value="15" ${G.autoScanMin === 15 ? 'selected' : ''}>15 min</option>
            <option value="30" ${G.autoScanMin === 30 ? 'selected' : ''}>30 min</option>
            <option value="60" ${G.autoScanMin === 60 ? 'selected' : ''}>1 hour</option>
          </select>
        </div>
        
        <div style="margin-top:20px; margin-bottom:14px; border-top:1px solid var(--bd); padding-top:20px">
          <div style="font-size:10px; color:var(--ac); margin-bottom:8px; font-weight:bold">MARKET TELEMETRY</div>
          <label class="ipanel-lbl">Finnhub API Key</label>
          <input type="password" id="finnhubKeyInput" value="${G.finnhubKey || ''}" placeholder="Finnhub Key (For live stock tickers)..." class="sel-input">
        </div>

        ${this._settingsToggleSection()}

        <div style="display:flex;gap:8px;margin-top:20px"><button class="btn" style="flex:1;padding:10px;text-align:center" onclick="G.saveSettings()">💾 Save & Scan</button><button class="btn" style="padding:10px;border-color:#ef444466;color:#ef4444" onclick="if(confirm('Clear all?')){localStorage.removeItem('sc_data');location.reload()}">Reset</button><button class="btn" style="padding:10px" onclick="document.getElementById('settingsOv').classList.remove('open')">Close</button></div>`;
      this.updateModelDatalist();
    },
  
    updateModelDatalist() {
      const pv = document.getElementById('apiProviderSel')?.value;
      const dl = document.getElementById('modelSuggestions'); if (!dl) return;
      let o = []; if (pv === 'xai') o = ['grok-3-latest'];
      else if (pv === 'openai') o = ['gpt-4o', 'o3-mini']; else if (pv === 'anthropic') o = ['claude-sonnet-4-20250514'];
      else if (pv === 'google') o = ['gemini-2.5-flash'];
      dl.innerHTML = o.map(x => `<option value="${x}">`).join('');
    },

    setupMobileGestures() {
        let startY = 0;
        let currentY = 0;
        let draggingPanel = null;

        const onTouchStart = (e) => {
            const panel = e.target.closest('.ov-pan') || e.target.closest('.ipanel');
            if (!panel) return;
            
            const scrollableTarget = e.target.closest('[style*="overflow-y: auto"], [style*="overflow-y:auto"]');
            if (scrollableTarget) return;

            const rect = panel.getBoundingClientRect();
            if (e.touches[0].clientY > rect.top + 60) return;

            draggingPanel = panel;
            startY = e.touches[0].clientY;
            panel.style.transition = 'none';
            panel.style.touchAction = 'none'; 
        };

        const onTouchMove = (e) => {
            if (!draggingPanel) return;
            currentY = e.touches[0].clientY;
            const dy = currentY - startY;
            
            if (dy > 0) {
                e.preventDefault(); 
                draggingPanel.style.transform = `translateY(${dy}px)`;
            }
        };

        const onTouchEnd = () => {
            if (!draggingPanel) return;
            const dy = currentY - startY;
            
            draggingPanel.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            draggingPanel.style.touchAction = ''; 
            
            if (dy > 100) { 
                draggingPanel.style.transform = `translateY(100%)`;
                setTimeout(() => {
                    if (draggingPanel.classList.contains('ov-pan')) {
                        draggingPanel.parentElement.classList.remove('open');
                    } else {
                        draggingPanel.classList.remove('open');
                    }
                    draggingPanel.style.transform = '';
                }, 300);
            } else {
                draggingPanel.style.transform = 'translateY(0)';
                setTimeout(() => { draggingPanel.style.transform = ''; }, 300);
            }
            draggingPanel = null;
        };

        document.addEventListener('touchstart', onTouchStart, {passive: false});
        document.addEventListener('touchmove', onTouchMove, {passive: false});
        document.addEventListener('touchend', onTouchEnd);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.setupMobileGestures());
