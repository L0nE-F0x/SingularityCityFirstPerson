/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   HN AI BLIMPS (v1.1.0 — futuristic hull + on-hull neon ticker)
   Drifts up to 5 sleek airships across the city sky, each carrying the title of a top AI-tagged
   HackerNews story as a scrolling LED ticker embedded in the hull. Click → overlay modal with
   the article link + HN thread link.

   Data source: /.netlify/functions/hn-ai-stories (server-cached 10 min; refetched client-side
   every 15 min). Gracefully silent on network failure — no blimps spawn, nothing crashes.

   Mounts into G.charLayer with zIndex 800 so blimps render above buildings/NPCs but under UI.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const HNBlimps = {
    MAX_BLIMPS: 5,
    REFRESH_MS: 15 * 60 * 1000,
    // Neon accents — each blimp picks one; used for hull trim, ticker text, engine glow
    COLORS: [0x22d3ee, 0xa78bfa, 0xf472b6, 0xfbbf24, 0x34d399],

    _container: null,
    _blimps: [],
    _stories: [],
    _fetched: false,
    _fetchAt: 0,

    init({ charLayer }) {
        if (this._container) return;
        if (!charLayer) return;
        this._container = new PIXI.Container();
        this._container.zIndex = 800;
        this._container.sortableChildren = false;
        charLayer.addChild(this._container);
        this._fetch();
    },

    async _fetch() {
        try {
            const r = await fetch('/.netlify/functions/hn-ai-stories', {
                signal: AbortSignal.timeout(8000)
            });
            if (!r.ok) throw new Error('hn fetch HTTP ' + r.status);
            const d = await r.json();
            this._stories = Array.isArray(d.stories) ? d.stories : [];
            this._fetched = true;
            this._fetchAt = Date.now();
            if (this._container && this._stories.length) this._respawn();
        } catch (_err) {
            this._fetched = true;
            this._fetchAt = Date.now();
        }
    },

    _respawn() {
        for (const b of this._blimps) {
            if (b.container && b.container.parent) b.container.parent.removeChild(b.container);
        }
        this._blimps = [];

        const n = Math.min(this.MAX_BLIMPS, this._stories.length);
        const cityW = (typeof G !== 'undefined' && G.cityW) ? G.cityW : 4000;
        for (let i = 0; i < n; i++) {
            const story = this._stories[i];
            const color = this.COLORS[i % this.COLORS.length];
            const blimp = this._makeBlimp(story, color);
            blimp.container.x = (cityW / n) * i + Math.random() * 200;
            blimp.container.y = 60 + (i % 3) * 50;
            blimp.vx = 0.25 + Math.random() * 0.25;
            this._container.addChild(blimp.container);
            this._blimps.push(blimp);
        }
    },

    _makeBlimp(story, color) {
        const c = new PIXI.Container();
        const BW = 78;   // body half-width
        const BH = 17;   // body half-height

        // Drop shadow behind hull for depth
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.32);
        shadow.drawEllipse(2, 4, BW, BH);
        shadow.endFill();
        c.addChild(shadow);

        // Tail fins — swept X-pattern for sci-fi silhouette
        const tail = new PIXI.Graphics();
        tail.lineStyle(1, 0x000000, 0.45);
        tail.beginFill(0x1a1f2e);
        tail.drawPolygon([-BW * 0.92, -BH * 0.15, -BW * 1.18, -BH * 1.05, -BW * 1.08, -BH * 0.1]);
        tail.drawPolygon([-BW * 0.92, BH * 0.15, -BW * 1.18, BH * 1.05, -BW * 1.08, BH * 0.1]);
        tail.endFill();
        tail.lineStyle(0);
        tail.beginFill(color, 0.9);
        tail.drawPolygon([-BW * 0.95, -BH * 0.25, -BW * 1.15, -BH * 0.95, -BW * 1.07, -BH * 0.22]);
        tail.drawPolygon([-BW * 0.95, BH * 0.25, -BW * 1.15, BH * 0.95, -BW * 1.07, BH * 0.22]);
        tail.endFill();
        c.addChild(tail);

        // Engine pods — 2 small cylinders flanking the rear
        const engines = new PIXI.Graphics();
        engines.beginFill(0x0d1220);
        engines.lineStyle(0.8, color, 0.7);
        engines.drawRoundedRect(-BW * 1.06, -BH * 0.5 - 3, 10, 6, 2);
        engines.drawRoundedRect(-BW * 1.06, BH * 0.5 - 3, 10, 6, 2);
        engines.endFill();
        c.addChild(engines);

        // Engine exhaust glow (pulses)
        const glow = new PIXI.Graphics();
        glow.beginFill(color, 0.55);
        glow.drawCircle(-BW * 1.1, -BH * 0.5, 5);
        glow.drawCircle(-BW * 1.1, BH * 0.5, 5);
        glow.endFill();
        glow.beginFill(color, 1);
        glow.drawCircle(-BW * 1.08, -BH * 0.5, 1.8);
        glow.drawCircle(-BW * 1.08, BH * 0.5, 1.8);
        glow.endFill();
        c.addChild(glow);

        // Main hull — dark metallic body with neon outline
        const hull = new PIXI.Graphics();
        hull.beginFill(0x1a1f2e);
        hull.lineStyle(1.8, color, 0.95);
        hull.drawEllipse(0, 0, BW, BH);
        hull.endFill();
        c.addChild(hull);

        // Everything clipped to hull shape (sheen, ticker band, ticker text)
        const hullLayer = new PIXI.Container();
        c.addChild(hullLayer);
        const hullMask = new PIXI.Graphics();
        hullMask.beginFill(0xffffff);
        hullMask.drawEllipse(0, 0, BW - 1.5, BH - 1.5);
        hullMask.endFill();
        c.addChild(hullMask);
        hullLayer.mask = hullMask;

        // Top metallic sheen
        const sheen = new PIXI.Graphics();
        sheen.beginFill(0x3a4560, 0.55);
        sheen.drawEllipse(0, -BH * 0.58, BW * 0.9, BH * 0.32);
        sheen.endFill();
        sheen.beginFill(0xffffff, 0.12);
        sheen.drawEllipse(-BW * 0.15, -BH * 0.7, BW * 0.45, BH * 0.12);
        sheen.endFill();
        hullLayer.addChild(sheen);

        // Bottom accent glow (color rim on underside)
        const underglow = new PIXI.Graphics();
        underglow.beginFill(color, 0.35);
        underglow.drawEllipse(0, BH * 0.62, BW * 0.88, BH * 0.22);
        underglow.endFill();
        hullLayer.addChild(underglow);

        // Ticker band — recessed dark strip across middle
        const TB_H = 10;
        const TB_W = BW * 1.6;
        const band = new PIXI.Graphics();
        band.beginFill(0x05080f);
        band.drawRect(-TB_W / 2, -TB_H / 2, TB_W, TB_H);
        band.endFill();
        band.lineStyle(0.7, color, 0.55);
        band.moveTo(-TB_W / 2, -TB_H / 2 + 0.3);
        band.lineTo(TB_W / 2, -TB_H / 2 + 0.3);
        band.moveTo(-TB_W / 2, TB_H / 2 - 0.3);
        band.lineTo(TB_W / 2, TB_H / 2 - 0.3);
        hullLayer.addChild(band);

        // Neon ticker text — title + separator, scrolls right-to-left
        const text = String(story.title || 'Loading…').toUpperCase() + '   •   ';
        const tickerText = new PIXI.Text(text, {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 8,
            fontWeight: '700',
            fill: color,
            stroke: 0x000000,
            strokeThickness: 1.5,
            letterSpacing: 0.5
        });
        tickerText.anchor.set(0, 0.5);
        tickerText.x = BW * 0.9;
        tickerText.y = 0;
        hullLayer.addChild(tickerText);

        // Gondola — slim cockpit underneath
        const gond = new PIXI.Graphics();
        gond.beginFill(0x0f131e);
        gond.lineStyle(1, color, 0.55);
        gond.drawRoundedRect(-15, BH + 1, 30, 7, 3);
        gond.endFill();
        gond.lineStyle(0);
        gond.beginFill(color, 0.65);
        gond.drawRoundedRect(-11, BH + 2.5, 22, 1.5, 0.8);
        gond.endFill();
        c.addChild(gond);

        // Nose beacon — pulsing white/color light at front tip
        const beacon = new PIXI.Graphics();
        beacon.beginFill(color, 0.4);
        beacon.drawCircle(BW + 1, 0, 5);
        beacon.endFill();
        beacon.beginFill(0xffffff, 0.98);
        beacon.drawCircle(BW, 0, 2);
        beacon.endFill();
        c.addChild(beacon);

        // Small HN corner tag on hull (above ticker band)
        const tag = new PIXI.Text('▲HN', {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 6,
            fontWeight: '700',
            fill: 0xff6600,
            stroke: 0x000000,
            strokeThickness: 1.5
        });
        tag.anchor.set(1, 0.5);
        tag.x = BW * 0.8;
        tag.y = -BH * 0.55;
        c.addChild(tag);

        // Hit area generous for easy clicks
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-BW * 1.25, -BH * 1.6, BW * 2.5, BH * 3.2);
        c.on('pointerdown', () => this._onClick(story));

        return {
            container: c,
            beacon,
            glow,
            tickerText,
            tickerStartX: BW * 0.9,
            vx: 0.3,
            beaconPhase: Math.random() * Math.PI * 2,
            glowPhase: Math.random() * Math.PI * 2
        };
    },

    _onClick(story) {
        if (typeof SND !== 'undefined' && SND.playTone) {
            try { SND.playTone(880, 'sine', 0.06, 0.03, 120); } catch (_e) {}
        }
        if (typeof G !== 'undefined' && G.unlockAchieve) G.unlockAchieve('hn_read');
        this.showModal(story);
    },

    showModal(story) {
        const ov = document.getElementById('hnOv');
        const pan = document.getElementById('hnPan');
        if (!ov || !pan) return;
        const title = this._escape(story.title || 'Untitled');
        const url = story.url && /^https?:\/\//i.test(story.url)
            ? story.url
            : ('https://news.ycombinator.com/item?id=' + story.id);
        const hnThread = 'https://news.ycombinator.com/item?id=' + story.id;
        const safeUrl = safeHref(url); // protocol allowlist — HN story URLs are external input
        const safeThread = this._escape(hnThread);
        const by = this._escape(story.by || 'anon');
        const score = Number(story.score) || 0;
        const comments = Number(story.descendants) || 0;
        const domain = this._domainOf(url);

        pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('hnOv').classList.remove('open')">✕</button>
            <div style="font-size:8px;color:#ff6600;letter-spacing:2px;margin-bottom:10px;font-weight:700">▲ HACKER NEWS</div>
            <div style="font-size:14px;font-weight:700;line-height:1.4;margin-bottom:8px">${title}</div>
            <div style="font-size:9px;color:var(--t3);margin-bottom:16px">
                <span style="color:var(--ac)">${score}</span> points
                · by ${by}
                · <span style="color:var(--ac)">${comments}</span> comments
                ${domain ? `· <span>${this._escape(domain)}</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none;flex:1;justify-content:center;padding:10px 14px">🔗 Read article</a>
                <a href="${safeThread}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none;flex:1;justify-content:center;padding:10px 14px">💬 HN thread</a>
            </div>`;
        ov.classList.add('open');
    },

    _domainOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch (_e) { return ''; }
    },

    _escape(s) {
        const div = document.createElement('div');
        div.textContent = String(s == null ? '' : s);
        return div.innerHTML;
    },

    update() {
        if (this._fetched && Date.now() - this._fetchAt > this.REFRESH_MS) {
            this._fetchAt = Date.now();
            this._fetch();
        }
        if (!this._container || !this._blimps.length) return;

        const cityW = (typeof G !== 'undefined' && G.cityW) ? G.cityW : 4000;
        for (const b of this._blimps) {
            b.container.x += b.vx;
            if (b.container.x > cityW + 140) b.container.x = -140;

            // Scroll ticker text leftward; reset when it fully exits the left edge
            if (b.tickerText) {
                b.tickerText.x -= 0.55;
                if (b.tickerText.x + b.tickerText.width < -b.tickerStartX) {
                    b.tickerText.x = b.tickerStartX;
                }
            }

            // Beacon blink
            if (b.beacon) {
                b.beaconPhase += 0.09;
                b.beacon.alpha = 0.55 + 0.45 * Math.sin(b.beaconPhase);
            }

            // Engine glow pulse
            if (b.glow) {
                b.glowPhase += 0.12;
                b.glow.alpha = 0.7 + 0.3 * Math.sin(b.glowPhase);
            }
        }
    }
};
