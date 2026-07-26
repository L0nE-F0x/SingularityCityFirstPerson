/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   GLOBAL AI INDEX (v1.0.0)
   Composite score (0-1000) tracking humanity's total AI capability.
   Displayed on a giant digital billboard in the city.
   Components: Benchmark Ceiling, Population, Lab Diversity, Open Source, Compute, Velocity.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AIIndex = {

    BLDS: [
        { id: 'ai_index', name: 'Global AI Index', w: 160, fl: 5, emoji: '📊', type: 'ai_index', desc: 'A colossal digital billboard tracking humanity\'s composite AI capability score in real time. Six weighted components distilled into a single number: 0-1000.' },
    ],

    _score: 0,
    _targetScore: 0,
    _components: {},
    _history: [],       // rolling 30-day history for sparkline
    _allTimeHigh: 0,
    _billboard: null,   // PIXI container for the rendered billboard
    _lastCalcTick: 0,
    _zoneStartX: 0,
    _zoneEndX: 0,

    // Reference ceilings — tuned so mid-2026 industry scores ~400-500
    CEILINGS: {
        benchmarkCeiling: 100,     // max avg benchmark (perfect = 100%)
        population:       1500,    // total active models
        labDiversity:     25,      // distinct labs with ≥3 models
        openSource:       1.0,     // 100% open source ratio
        compute:          50000,   // total MW + GPU equivalents
        velocity:         200,     // models released in last 90 days
    },

    WEIGHTS: {
        benchmarkCeiling: 0.25,
        population:       0.15,
        labDiversity:     0.15,
        openSource:       0.10,
        compute:          0.20,
        velocity:         0.15,
    },

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    positionZone(startX) {
        let cx = startX + 30;
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 30; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    calculate() {
        if (!G.models || G.models.length === 0) return;

        const nowMs = Date.now();
        const ninetyDaysAgo = nowMs - 90 * 24 * 60 * 60 * 1000;

        let bestAvgBench = 0;
        let aliveCount = 0;
        let osCount = 0;
        let recentCount = 0;
        const labModelCounts = {};

        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            const stg = getStage(m.rel, m.ret, m.phase);
            const isAlive = stg !== 'retired';

            if (isAlive) {
                aliveCount++;
                if (m.os) osCount++;

                // Lab diversity
                if (m.lab) {
                    labModelCounts[m.lab] = (labModelCounts[m.lab] || 0) + 1;
                }
            }

            // Benchmark ceiling (best average across all models)
            if (typeof avgBM === 'function') {
                const avg = avgBM(m.id);
                if (avg && avg > bestAvgBench) bestAvgBench = avg;
            }

            // Velocity (released in last 90 days)
            if (m.rel) {
                const relMs = new Date(m.rel).getTime();
                if (relMs > ninetyDaysAgo && relMs <= nowMs) recentCount++;
            }
        }

        // Lab diversity: labs with ≥3 models
        const diverseLabs = Object.values(labModelCounts).filter(c => c >= 3).length;

        // Compute scale: sum from DC facilities if available
        let computeScore = 0;
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => {
                if (dc.power_mw) computeScore += dc.power_mw;
                if (dc.gpus) computeScore += dc.gpus * 0.01; // normalize GPU count
            });
        }
        // Add Kardashev data if available
        if (typeof Kardashev !== 'undefined' && Kardashev._cityPowerMW) {
            computeScore = Math.max(computeScore, Kardashev._cityPowerMW);
        }

        // Calculate components (0-1 each)
        this._components = {
            benchmarkCeiling: Math.min(1, bestAvgBench / this.CEILINGS.benchmarkCeiling),
            population:       Math.min(1, aliveCount / this.CEILINGS.population),
            labDiversity:     Math.min(1, diverseLabs / this.CEILINGS.labDiversity),
            openSource:       aliveCount > 0 ? Math.min(1, osCount / aliveCount) : 0,
            compute:          Math.min(1, computeScore / this.CEILINGS.compute),
            velocity:         Math.min(1, recentCount / this.CEILINGS.velocity),
        };

        // Weighted sum → 0-1000
        let total = 0;
        for (const key in this.WEIGHTS) {
            total += (this._components[key] || 0) * this.WEIGHTS[key];
        }
        this._targetScore = Math.round(total * 1000);

        // Track all-time high
        if (this._targetScore > this._allTimeHigh) {
            const wasHigh = this._allTimeHigh;
            this._allTimeHigh = this._targetScore;
            if (wasHigh > 0 && typeof UI !== 'undefined') {
                UI.addToast('📊 Global AI Index hit a new all-time high: ' + this._targetScore);
            }
        }

        // Rolling history for sparkline (max 30 entries)
        this._history.push(this._targetScore);
        if (this._history.length > 30) this._history.shift();
    },

    drawBillboard(gfx, container, b, h) {
        const w = b.w;

        // ── STEEL SUPPORT STRUCTURE ──
        gfx.beginFill(0x3a3a4a); gfx.drawRect(w / 2 - 4, h - 14, 8, 14); gfx.endFill();
        gfx.beginFill(0x4a4a5a); gfx.drawRect(w / 2 - 6, h - 16, 12, 4); gfx.endFill();
        // Cross braces
        gfx.beginFill(0x333344); gfx.drawRect(w / 2 - 20, h - 20, 40, 2); gfx.endFill();
        gfx.beginFill(0x333344); gfx.drawRect(w / 2 - 3, h - 80, 6, 66); gfx.endFill();

        // ── BILLBOARD SCREEN ──
        const screenW = w - 20;
        const screenH = 65;
        const screenX = 10;
        const screenY = h - 82;
        // Outer frame
        gfx.beginFill(0x1a1a2e); gfx.drawRoundedRect(screenX - 2, screenY - 2, screenW + 4, screenH + 4, 3); gfx.endFill();
        // Screen background
        gfx.beginFill(0x0a0a18); gfx.drawRoundedRect(screenX, screenY, screenW, screenH, 2); gfx.endFill();
        // Scan line effect
        for (let sy = screenY + 2; sy < screenY + screenH - 2; sy += 3) {
            gfx.beginFill(0x111122, 0.3); gfx.drawRect(screenX + 1, sy, screenW - 2, 1); gfx.endFill();
        }

        // ── GROUND ──
        gfx.beginFill(0x2a2a3a); gfx.drawRect(0, h - 4, w, 4); gfx.endFill();

        // Create dynamic text container for score updates
        const dynCont = new PIXI.Container();
        dynCont.x = screenX;
        dynCont.y = screenY;
        container.addChild(dynCont);

        b._dynCont = dynCont;
        b._screenW = screenW;
        b._screenH = screenH;
        b._screenX = screenX;
        b._screenY = screenY;

        // Tooltip
        b.tip = '📊 Global AI Index<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Composite AI capability score (0-1000).<br>Tracks benchmarks, population, diversity,<br>open source, compute, and velocity.</span>';
    },

    updateBillboard() {
        const b = G.bldById['ai_index'];
        if (!b || !b._dynCont) return;

        // Smooth score animation
        if (this._score !== this._targetScore) {
            const diff = this._targetScore - this._score;
            this._score += Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) * 0.05));
            if (Math.abs(this._score - this._targetScore) < 2) this._score = this._targetScore;
        }

        const cont = b._dynCont;
        const sw = b._screenW;
        const _sh = b._screenH;

        // Only rebuild text every 30 frames
        if (G.tick % 30 !== 0 && cont.children.length > 0) return;

        cont.removeChildren();

        // Score color zone
        let scoreCol = 0xef4444; // red (0-200)
        if (this._score >= 200) scoreCol = 0xfacc15; // yellow (200-500)
        if (this._score >= 500) scoreCol = 0x4ade80; // green (500-800)
        if (this._score >= 800) scoreCol = 0x22d3ee; // blue (800+)

        // Title
        const title = new PIXI.Text('GLOBAL AI INDEX', { fontFamily: 'Silkscreen', fontSize: 5, fill: 0x6688aa });
        title.x = 4; title.y = 3;
        cont.addChild(title);

        // Main score number
        const scoreTxt = new PIXI.Text(String(this._score), { fontFamily: 'Press Start 2P', fontSize: 14, fill: scoreCol });
        scoreTxt.anchor.set(0.5, 0);
        scoreTxt.x = sw / 2; scoreTxt.y = 10;
        cont.addChild(scoreTxt);

        // Score label
        let label = 'EARLY';
        if (this._score >= 200) label = 'ACCELERATING';
        if (this._score >= 500) label = 'ADVANCED';
        if (this._score >= 800) label = 'APPROACHING SINGULARITY';
        const labelTxt = new PIXI.Text(label, { fontFamily: 'Silkscreen', fontSize: 4, fill: scoreCol, letterSpacing: 1 });
        labelTxt.anchor.set(0.5, 0);
        labelTxt.x = sw / 2; labelTxt.y = 28;
        cont.addChild(labelTxt);

        // Sparkline (bottom area)
        if (this._history.length > 1) {
            const sparkGfx = new PIXI.Graphics();
            const sparkY = 38;
            const sparkH = 18;
            const sparkW = sw - 8;
            const maxVal = Math.max(...this._history, 1);
            const minVal = Math.min(...this._history);
            const range = Math.max(maxVal - minVal, 10);

            sparkGfx.lineStyle(1, scoreCol, 0.6);
            for (let i = 0; i < this._history.length; i++) {
                const px = 4 + (i / (this._history.length - 1)) * sparkW;
                const py = sparkY + sparkH - ((this._history[i] - minVal) / range) * sparkH;
                if (i === 0) sparkGfx.moveTo(px, py);
                else sparkGfx.lineTo(px, py);
            }
            // Fill under the line
            sparkGfx.lineStyle(0);
            sparkGfx.beginFill(scoreCol, 0.1);
            sparkGfx.moveTo(4, sparkY + sparkH);
            for (let i = 0; i < this._history.length; i++) {
                const px = 4 + (i / (this._history.length - 1)) * sparkW;
                const py = sparkY + sparkH - ((this._history[i] - minVal) / range) * sparkH;
                sparkGfx.lineTo(px, py);
            }
            sparkGfx.lineTo(4 + sparkW, sparkY + sparkH);
            sparkGfx.closePath();
            sparkGfx.endFill();
            cont.addChild(sparkGfx);
        }

        // ATH indicator
        if (this._score >= this._allTimeHigh && this._allTimeHigh > 0) {
            const athTxt = new PIXI.Text('ATH', { fontFamily: 'Silkscreen', fontSize: 4, fill: 0xfacc15 });
            athTxt.x = sw - 16; athTxt.y = 3;
            cont.addChild(athTxt);
        }
    },

    tick() {
        // Calculate immediately on first call, then every 300 ticks
        if (this._lastCalcTick === 0 || G.tick - this._lastCalcTick >= 300) {
            this.calculate();
            this._lastCalcTick = G.tick;
        }
        this.updateBillboard();
    }
};
