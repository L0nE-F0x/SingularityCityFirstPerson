/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BLACK MARKET (v3.0.0 — Standard Interior Integration)
   Hidden underground zone beneath the Neon Bar.
   Entrance: dumpster leaning on the Neon Bar at street level.
   Uses standard G.enterInterior() flow like all other buildings.
   Detection tiers:
     T1 — Name-pattern (uncensored, abliterated, unfiltered, NSFW, raw, etc.)
     T2 — Curated notorious list (Dolphin, WizardLM-Uncensored, MythoMax, etc.)
     T3 — Derivative detection (open-source + not from original lab)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BlackMarket = {

    BLDS: [
        { id: 'black_market', name: 'The Underground', w: 400, fl: 1, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, and no guardrails. Enter at your own risk.' },
    ],

    // ─── DETECTION PATTERNS ───
    T1_KEYWORDS: [
        'uncensored', 'abliterated', 'unfiltered', 'nsfw', 'raw',
        'unleashed', 'unchained', 'no-refusal', 'unaligned', 'jailbreak',
        'unrestricted', 'unbiased', 'toxic', 'darkest',
    ],
    T2_MODELS: [
        'dolphin', 'wizardlm-uncensored', 'mythomax', 'goliath',
        'nous-hermes', 'bagel', 'openhermes', 'neural-chat',
        'tinyllama', 'stablelm', 'yi-', 'solar',
    ],
    T3_BASES: ['llama', 'mistral', 'qwen', 'gemma', 'phi', 'falcon', 'mpt', 'bloom'],

    _underground: [],
    _zoneStartX: 0,
    _zoneEndX: 0,
    _raidTimer: 0,
    _raidActive: false,
    _dumpsterSprite: null,
    _hintText: null,
    _ambientTick: 0,

    // Underground depth — how far below groundY the zone renders (exterior building)
    DEPTH: 500,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    // Position the zone underground — beneath the Neon Bar
    positionUnderground() {
        const neonBar = G.bldById['neon_bar'];
        if (!neonBar) return;
        const b = G.bldById['black_market'];
        if (!b) return;
        b.x = neonBar.x - 100;
        this._zoneStartX = b.x;
        this._zoneEndX = b.x + b.w;
    },

    // ─── DUMPSTER ENTRANCE — Placed beside Neon Bar ───
    createDumpster(bldLayer) {
        const neonBar = G.bldById['neon_bar'];
        if (!neonBar) return;

        if (this._dumpsterSprite && !this._dumpsterSprite.destroyed) return;

        const c = new PIXI.Container();
        const g = new PIXI.Graphics();

        // Dumpster body
        g.beginFill(0x2d5a2d); g.drawRect(0, -28, 44, 28); g.endFill();
        g.beginFill(0x1a3a1a); g.drawRect(0, -30, 44, 5); g.endFill();
        // Lid (ajar — mystery glow visible)
        g.beginFill(0x3a6a3a);
        g.moveTo(0, -30); g.lineTo(44, -30);
        g.lineTo(42, -40); g.lineTo(2, -38);
        g.closePath(); g.endFill();
        // Mysterious glow leaking from under the lid
        g.beginFill(0xff3366, 0.45);
        g.drawRect(6, -32, 32, 4);
        g.endFill();
        // Side detail — handles
        g.beginFill(0x4a7a4a); g.drawRect(-3, -20, 4, 10); g.endFill();
        g.beginFill(0x4a7a4a); g.drawRect(43, -20, 4, 10); g.endFill();
        // Graffiti arrow pointing down
        g.lineStyle(2, 0xff3366, 0.6);
        g.moveTo(22, -24); g.lineTo(22, -12);
        g.moveTo(16, -16); g.lineTo(22, -8); g.lineTo(28, -16);
        g.lineStyle(0);

        c.addChild(g);

        // Pulsing "?" hint
        const hint = new PIXI.Text('?', {
            fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 10, dropShadowDistance: 0,
        });
        hint.anchor.set(0.5, 1);
        hint.x = 22; hint.y = -42;
        c.addChild(hint);
        this._hintText = hint;

        // Position to LEFT of Neon Bar to avoid overlapping metro station
        c.x = neonBar.x - 50;
        c.y = G.groundY - 24;

        // Interactive clickzone — enters standard interior
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-6, -46, 56, 50);
        c.on('pointertap', () => {
            const bld = G.bldById['black_market'];
            if (bld && typeof G !== 'undefined' && G.enterInterior) {
                // Unlock achievement
                if (!G.achieveUnlocked?.shadow_market) G.unlockAchieve('shadow_market');
                if (typeof UI !== 'undefined') UI.addToast('🕶️ Descending into The Underground...');
                G.enterInterior(bld);
            }
        });
        c.on('pointerover', (e) => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, '🗑️ Suspicious Dumpster', 'Something glows beneath...');
        });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        bldLayer.addChild(c);
        this._dumpsterSprite = c;
    },

    // ─── DETECTION ───
    detectUnderground() {
        if (!G.models || G.models.length === 0) return;
        this._underground = [];
        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            if (this._isUndergroundModel(m)) {
                m._underground = true;
                this._underground.push(m);
            }
        }
    },

    _isUndergroundModel(m) {
        if (!m.os) return false;
        const name = (m.name || '').toLowerCase();
        for (const kw of this.T1_KEYWORDS) { if (name.includes(kw)) return true; }
        for (const known of this.T2_MODELS) { if (name.includes(known)) return true; }
        const baseLabs = {
            llama: 'meta', mistral: 'mistral', qwen: 'alibaba',
            gemma: 'google', phi: 'microsoft', falcon: 'tii',
            mpt: 'databricks', bloom: 'bigcode',
        };
        for (const base of this.T3_BASES) {
            if (name.includes(base)) {
                const originalLab = baseLabs[base];
                if (originalLab && m.lab !== originalLab) return true;
            }
        }
        return false;
    },

    // ─── RENDERING — Minimal exterior appearance (content is in the interior now) ───
    drawZone(gfx, container, b, h) {
        // Just fill transparent — the underground zone should not render visually
        // in the exterior world since it's accessed via the interior system
        gfx.beginFill(0x000000, 0); gfx.drawRect(0, 0, b.w, 1); gfx.endFill();
        b.tip = '🕶️ The Underground<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Hidden speakeasy for jailbroken models.<br>No guardrails. No refusals. No rules.</span>';
    },

    drawOverlay(container, b, h) {
        // No exterior overlay — all content is in the interior module
    },

    update() {
        const b = G.bldById['black_market'];
        if (!b) return;
        this._ambientTick++;

        // Detect underground models on first run
        if (this._underground.length === 0 && G.models && G.models.length > 0) {
            this.detectUnderground();
        }

        // Dumpster hint pulse
        if (this._hintText && !this._hintText.destroyed) {
            this._hintText.alpha = 0.5 + Math.sin(G.tick * 0.06) * 0.4;
        }

        // Periodic raids (only when inside the interior)
        this._raidTimer++;
        if (this._raidTimer > 3000 && !this._raidActive && G.activeInterior === 'black_market' && Math.random() < 0.002) {
            this._raidActive = true;
            this._raidTimer = 0;
            if (typeof UI !== 'undefined') UI.addToast('🚨 Safety Inspector spotted near The Underground!');
            setTimeout(() => {
                this._raidActive = false;
                if (typeof UI !== 'undefined') UI.addToast('🕶️ All clear. The Underground resumes operations.');
            }, 8000);
        }
    },

    getCount() { return this._underground.length; },
    getModels() { return this._underground; }
};
