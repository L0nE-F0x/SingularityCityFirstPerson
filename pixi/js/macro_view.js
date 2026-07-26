/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   MACRO VIEW & MINIMAP (v16.6.0 - Extracted from engine.js)
   Mixin providing macro network view, minimap rendering, and zone navigation.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const MacroView = {
    // Ordered left-to-right matching the geographic layout of the main map
    _mmZones: [
        { id: 'port',       emoji: '🚢', label: 'Port District',    match: b => b.id.startsWith('port_') },
        { id: 'space',      emoji: '🚀', label: 'Space Zone',       match: b => b.type === 'launchpad' },
        { id: 'frontier',   emoji: '🌲', label: 'Frontier Pines',   match: b => b.id === 'forest_space' },
        { id: 'npc_housing',emoji: '🏬', label: 'Worker Housing',   match: b => b.id.startsWith('npc_apt_') },
        { id: 'dc',         emoji: '🖥️', label: 'Compute Dist.',    match: b => b.id.startsWith('dc_') || b.id.startsWith('fab_') || b.id === 'metro_dc' },
        { id: 'res',        emoji: '🏠', label: 'Residential',      match: b => b.id.startsWith('res_') || b.id === 'metro_res' },
        { id: 'university', emoji: '🎓', label: 'AI Academy',       match: b => b.type === 'university' },
        { id: 'pine',       emoji: '🌲', label: 'Pine Reserve',     match: b => b.id === 'forest_0' },
        { id: 'court',      emoji: '🏛️', label: 'AI Court',         match: b => b.type === 'court' },
        { id: 'jail',       emoji: '🔒', label: 'Detention Center', match: b => b.type === 'jail' },
        { id: 'city_park',  emoji: '🌳', label: 'Central Park',    match: b => b.id === 'city_park' },
        { id: 'tech',       emoji: '🏢', label: 'Tech District',    match: b => b.lab && !b.id.startsWith('house_') && !b.id.startsWith('res_') && b.id !== 'metro_res' && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && b.id !== 'metro_dc' && b.type !== 'university' && b.type !== 'court' && b.type !== 'park' && b.type !== 'convention_center' },
        { id: 'midline',    emoji: '🚇', label: 'Central Line',     match: b => b.id === 'metro_mid' },
        { id: 'monument',   emoji: '🌐', label: 'Visitor Monument', match: b => b.id === 'visitor_monument' },
        { id: 'vcrow',      emoji: '💰', label: 'VC Row',           match: b => b.id.startsWith('vcrow_') },
        { id: 'conference', emoji: '🎓', label: 'Conference',       match: b => b.id === 'convention_center' },
        { id: 'embassy',    emoji: '🏛️', label: 'Embassy Row',     match: b => b.id.startsWith('embassy_') },
        { id: 'diplomats',  emoji: '🏘️', label: 'Diplomat Villas', match: b => b.id.startsWith('diplomat_villa_') },
        { id: 'ai_index',  emoji: '📊', label: 'AI Index',         match: b => b.id === 'ai_index' },
        { id: 'newspaper',  emoji: '📰', label: 'Newspaper HQ',    match: b => b.id === 'times_hq' },
        { id: 'nightlife',  emoji: '🍸', label: 'Nightlife',       match: b => b.id === 'neon_bar' },
        { id: 'metro',      emoji: '🚇', label: 'Metro East',      match: b => b.id === 'metro_east' },
        { id: 'backbone',   emoji: '🌐', label: 'The Backbone',    match: b => b.id.startsWith('backbone_') },
        { id: 'robotics',   emoji: '🤖', label: 'Robotics Factory', match: b => b.id.startsWith('robotics_') },
        { id: 'longevity',  emoji: '🧬', label: 'Longevity Wing',  match: b => b.id.startsWith('longevity_') },
        { id: 'agents',     emoji: '🎛️', label: 'Agent District',   match: b => b.id.startsWith('agents_') },
        { id: 'alignment',  emoji: '🌲', label: 'Alignment Forest',match: b => b.id.startsWith('align_') },
        { id: 'longline',   emoji: '🚇', label: 'Innovation Line', match: b => b.id === 'metro_longevity' },
        { id: 'suburbia',   emoji: '🏡', label: 'Suburbia',        match: b => b.id.startsWith('suburb_') },
        { id: 'silicon',    emoji: '🌲', label: 'Silicon Woods',   match: b => b.id === 'forest_1' },
        { id: 'estates',    emoji: '🏡', label: "Billionaire's",   match: b => b.id.startsWith('house_') },
        { id: 'power',      emoji: '⚡', label: 'Power Grid',      match: b => b.id.startsWith('power_') }
    ],

    initMinimap() {
        const mm = document.getElementById('minimap');
        const zones = document.getElementById('mmZones');
        const canvas = document.getElementById('mmCanvas');
        if (!mm || !zones || !canvas) return;

        // Build zone quick-jump buttons
        zones.innerHTML = '';

        // Orbit Mode button (special — not a zone, launches orbit view)
        if (typeof OrbitMode !== 'undefined') {
            const orbitBtn = document.createElement('div');
            orbitBtn.className = 'mm-zone mm-orbit';
            orbitBtn.dataset.zone = 'orbit';
            orbitBtn.textContent = '🛰️ Orbit';
            orbitBtn.onclick = () => { OrbitMode.enter(); };
            zones.appendChild(orbitBtn);
        }

        let zoneBtnCount = 0;
        let lastZoneBtn = null;
        this._mmZones.forEach(z => {
            if (!BLDS.some(z.match)) return; // hide button if no matching building exists
            const btn = document.createElement('div');
            btn.className = 'mm-zone' + (z.wide ? ' wide' : '');
            btn.dataset.zone = z.id;
            btn.textContent = `${z.emoji} ${z.label}`;
            btn.onclick = () => this.jumpToZone(z);
            zones.appendChild(btn);
            zoneBtnCount++;
            lastZoneBtn = btn;
        });

        // Keep the 2-column grid gap-free: zone buttons come and go dynamically
        // (e.g. Conference only exists during live NeurIPS/ICML weeks), so with an
        // odd count the last button stretches full-width instead of leaving a hole.
        if (zoneBtnCount % 2 === 1 && lastZoneBtn) lastZoneBtn.classList.add('wide');

        // Underground button (special — full width, like Orbit, enters underground view)
        if (typeof BlackMarket !== 'undefined') {
            const ugBtn = document.createElement('div');
            ugBtn.className = 'mm-zone mm-underground';
            ugBtn.dataset.zone = 'underground';
            ugBtn.textContent = '🕶️ The Underground';
            ugBtn.onclick = () => { const bld = G.bldById['black_market']; if (bld) G.enterInterior(bld); };
            zones.appendChild(ugBtn);
        }

        // Click-to-jump on the canvas
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickRatio = (e.clientX - rect.left) / rect.width;
            const targetWorldX = clickRatio * this.cityW;
            Camera.targetX = -targetWorldX + (this.vpW / 2) / Camera.zoom;
            if (this.tracking) this.stopTracking();
        });

        this._mmCanvas = canvas;
        this._mmCtx = canvas.getContext('2d');
    },

    jumpToZone(zone) {
        const match = BLDS.find(zone.match);
        if (!match) return;
        const targetX = match.x + match.w / 2;
        Camera.targetX = -targetX + (this.vpW / 2) / Camera.zoom;
        if (this.tracking) this.stopTracking();
        if (this.activeInterior) this.exitInterior();
    },

    updateMinimap() {
        const mm = document.getElementById('minimap');
        if (!mm) return;

        // Hide during interiors and macro mode
        if (this.activeInterior || this.viewMode === 'macro') {
            mm.style.display = 'none';
            return;
        }
        mm.style.display = '';

        // Skip canvas draw if collapsed
        if (mm.classList.contains('collapsed')) return;

        const ctx = this._mmCtx;
        const c = this._mmCanvas;
        if (!ctx || !c) return;

        const cW = c.width;
        const cH = c.height;
        ctx.clearRect(0, 0, cW, cH);

        // Background
        ctx.fillStyle = 'rgba(10,10,25,0.8)';
        ctx.fillRect(0, 0, cW, cH);

        const scale = cW / Math.max(this.cityW, 1);

        // Draw zone color bands
        const zoneColors = { port: '#0a1628', space: '#c2956a', frontier: '#1b4332', npc_housing: '#1a2030', res: '#334155', pine: '#1b4332', tech: '#2a2a42', metro: '#475569', nightlife: '#1a0a2e', backbone: '#0a1525', silicon: '#1b4332', estates: '#3d2514', power: '#1a1a10', court: '#2a1828', jail: '#2a1a14' };

        this._mmZones.forEach(z => {
            let minX = Infinity, maxX = 0;
            BLDS.forEach(b => {
                if (z.match(b)) {
                    if (b.x < minX) minX = b.x;
                    if (b.x + b.w > maxX) maxX = b.x + b.w;
                }
            });
            if (minX < Infinity) {
                ctx.fillStyle = zoneColors[z.id] || '#222';
                ctx.fillRect(minX * scale, 8, Math.max((maxX - minX) * scale, 3), cH - 16);
            }
        });

        // Draw buildings as thin lines
        BLDS.forEach(b => {
            const bx = b.x * scale;
            const bw = Math.max(b.w * scale, 1);
            const floors = b.dynamicFl || b.fl || 1;
            const bh = Math.min(floors * 2, cH - 10);

            if (b.lab) {
                const lab = LABS[b.lab];
                ctx.fillStyle = lab ? lab.color : '#64748b';
            } else if (b.type === 'launchpad') {
                ctx.fillStyle = '#fc3d21';
            } else {
                ctx.fillStyle = '#445';
            }
            ctx.fillRect(bx, cH - 4 - bh, bw, bh);
        });

        // Draw viewport indicator
        const vpLeft = (-Camera.x) * scale;
        const vpWidth = (this.vpW / Camera.zoom) * scale;
        ctx.strokeStyle = 'rgba(34,211,238,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vpLeft, 1, vpWidth, cH - 2);
        ctx.fillStyle = 'rgba(34,211,238,0.06)';
        ctx.fillRect(vpLeft, 1, vpWidth, cH - 2);

        // Highlight active zone button
        const camCenter = -Camera.x + (this.vpW / 2) / Camera.zoom;
        document.querySelectorAll('.mm-zone').forEach(el => {
            const zoneId = el.dataset.zone;
            const z = this._mmZones.find(zz => zz.id === zoneId);
            if (!z) return;
            let minX = Infinity, maxX = 0;
            BLDS.forEach(b => { if (z.match(b)) { if (b.x < minX) minX = b.x; if (b.x + b.w > maxX) maxX = b.x + b.w; }});
            el.classList.toggle('active', camCenter >= minX && camCenter <= maxX);
        });
    },

    buildMacroLayer() {
      this.macroLayer.removeChildren();
      this.dataPackets = [];
      this.macroNodes = [];
      this.pingRings = [];
      const cx = this.vpW / 2;
      const cy = this.vpH / 2;

      const grid = new PIXI.Graphics();
      grid.lineStyle(1, 0x33334a, 0.3);
      for(let i=0; i<this.vpW; i+=50) { grid.moveTo(i, 0); grid.lineTo(i, this.vpH); }
      for(let i=0; i<this.vpH; i+=50) { grid.moveTo(0, i); grid.lineTo(this.vpW, i); }
      this.macroLayer.addChild(grid);

      const sgGfx = new PIXI.Graphics();
      sgGfx.beginFill(0xffffff, 0.1);
      sgGfx.drawCircle(cx, cy, 50);
      sgGfx.endFill();
      sgGfx.beginFill(0xffffff, 0.5);
      sgGfx.drawCircle(cx, cy, 20);
      sgGfx.endFill();
      this.macroLayer.addChild(sgGfx);
      this.centerNodeGfx = sgGfx;

      const linesGfx = new PIXI.Graphics();
      this.macroLayer.addChild(linesGfx);

      const rad = Math.min(cx, cy) * 0.65;
      const labsEntries = Object.entries(LABS);
      const angleStep = (Math.PI * 2) / labsEntries.length;

      labsEntries.forEach(([labId, lab], i) => {
        const angle = i * angleStep;
        const nx = cx + Math.cos(angle) * rad;
        const ny = cy + Math.sin(angle) * rad;
        const col = parseInt(lab.color.slice(1), 16);

        linesGfx.lineStyle(2, col, 0.4);
        linesGfx.moveTo(nx, ny);
        linesGfx.lineTo(cx, cy);

        const nodeCont = new PIXI.Container();
        nodeCont.x = nx;
        nodeCont.y = ny;

        const clusterInfo = (typeof COMPUTE_DATA !== 'undefined' && COMPUTE_DATA.clusters) ?
                            (COMPUTE_DATA.clusters.find(c => c.lab === labId) || { name: "Remote Cluster", gpus: 0, type: "Unknown", location: "Unknown" }) :
                            { name: "Remote Cluster", gpus: 0, type: "Unknown", location: "Unknown" };

        if(clusterInfo.gpus > 0) {
            const subX = Math.cos(angle) * 60;
            const subY = Math.sin(angle) * 60;
            linesGfx.lineStyle(1, 0x22d3ee, 0.3);
            linesGfx.moveTo(nx, ny);
            linesGfx.lineTo(nx + subX, ny + subY);
            const sub = new PIXI.Graphics();
            sub.beginFill(0x22d3ee);
            sub.drawCircle(nx + subX, ny + subY, 4);
            sub.endFill();
            this.macroLayer.addChild(sub);
        }

        const nGfx = new PIXI.Graphics();
        nGfx.beginFill(col, 0.2);
        nGfx.drawCircle(0, 0, 24);
        nGfx.endFill();
        nGfx.beginFill(col, 0.8);
        nGfx.drawCircle(0, 0, 12);
        nGfx.endFill();
        nodeCont.addChild(nGfx);

        const lbl = new PIXI.Text(lab.name, { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' });
        lbl.anchor.set(0.5, 0.5);
        lbl.y = 32;
        nodeCont.addChild(lbl);

        nodeCont.eventMode = 'static';
        nodeCont.cursor = 'pointer';
        nodeCont.on('pointerover', (e) => {
            nodeCont.scale.set(1.2);
            if (typeof UI !== 'undefined') UI.showTooltip(e, `${lab.name} Uplink`, `${clusterInfo.name}<br><span style="color:#4ade80">${(clusterInfo.gpus/1000).toFixed(0)}K GPUs</span>`, false);
        });
        nodeCont.on('pointerout', () => {
            nodeCont.scale.set(1.0);
            if (typeof UI !== 'undefined') UI.hideTooltip();
        });
        this.macroLayer.addChild(nodeCont);
      });

      this.packetGfx = new PIXI.Graphics();
      this.macroLayer.addChild(this.packetGfx);
    }
};
