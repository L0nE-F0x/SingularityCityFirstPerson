/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   KARDASHEV SCALE TRACKER (v1.0.0)
   Composite civilisation-level score derived from real data flowing through Singularity City.
   Five pillars: Energy · Compute · Intelligence · Research · Infrastructure
   Score range: 0.700 (baseline) → 1.000 (Type I civilisation)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Kardashev = {

    score: 0.700,
    pillars: {},
    _built: false,
    _lastCalc: 0,
    _history: [],        // { t, score } snapshots for sparkline

    // ─── PILLAR WEIGHTS ───
    W_ENERGY:  0.30,     // True to Kardashev's original energy thesis
    W_COMPUTE: 0.25,     // The engine
    W_INTEL:   0.25,     // The output
    W_RESEARCH: 0.10,    // The pipeline
    W_INFRA:   0.10,     // The supply chain

    // ─── PILLAR NORMALIZATION TARGETS (100 = "Type I threshold") ───
    // These are calibrated so the score floats realistically with live app data
    TARGET_ENERGY_GW:       8000,    // 8 TW — estimated minimum for Type I
    TARGET_RENEW_PCT:        100,    // 100% renewable = max contribution
    TARGET_GPU_COUNT:    5000000,    // 5M GPUs — near-term frontier
    TARGET_DC_POWER_MW:    50000,    // 50 GW DC capacity
    TARGET_MODELS:          1000,    // Active model count
    TARGET_AVG_BENCH:        100,    // Perfect benchmark score
    TARGET_TOP_ELO:         2000,    // Chatbot Arena frontier
    TARGET_PAPERS:           100,    // ArXiv papers tracked
    TARGET_EVENTS:            50,    // AI events tracked
    TARGET_LAUNCHES:          20,    // Upcoming space launches
    TARGET_FUNDING_B:        200,    // $200B total VC deployed
    TARGET_SUPPLY_HEALTH:    100,    // 100% supply chain health (inverse of bottleneck load)

    // ─── MILESTONES ───
    MILESTONES: [
        { k: 0.720, label: 'Industrial Age',     icon: '🏭', color: '#94a3b8' },
        { k: 0.750, label: 'Digital Age',         icon: '💻', color: '#60a5fa' },
        { k: 0.780, label: 'AI Emergence',        icon: '🧠', color: '#a78bfa' },
        { k: 0.820, label: 'AI Convergence',      icon: '🔗', color: '#22d3ee' },
        { k: 0.870, label: 'Pre-Singularity',     icon: '⚡', color: '#facc15' },
        { k: 0.920, label: 'Singularity Horizon',  icon: '🌅', color: '#f97316' },
        { k: 0.960, label: 'Approaching Type I',  icon: '🌟', color: '#fbbf24' },
        { k: 1.000, label: 'Type I Civilisation', icon: '🌍', color: '#4ade80' },
    ],

    // ═══════════════════════════════════════════════════════════════════════════════
    //  CALCULATE — pulls from every data source in the app
    // ═══════════════════════════════════════════════════════════════════════════════
    calculate() {
        const now = Date.now();
        if (now - this._lastCalc < 5000) return this.score;
        this._lastCalc = now;

        // ─── PILLAR 1: ENERGY (30%) ───
        let energyScore = 0;
        // Real-world from Overpass
        const grid = typeof API !== 'undefined' ? API._gridData : null;
        if (grid && grid.totalMW > 0) {
            const gwNorm = Math.min(100, (grid.totalMW / 1000) / (this.TARGET_ENERGY_GW / 1000) * 100);
            const renewNorm = Math.min(100, grid.renewPct);
            energyScore = gwNorm * 0.6 + renewNorm * 0.4;
        } else if (typeof PowerZone !== 'undefined') {
            // Fallback: in-game simulation
            const supply = PowerZone.getTotalSupply();
            const maxSim = 2450; // max simulated supply
            const simNorm = Math.min(100, (supply / maxSim) * 30); // Sim is a tiny fraction of real
            energyScore = simNorm;
        }

        // ─── PILLAR 2: COMPUTE (25%) ───
        let computeScore = 0;
        let totalGPU = 0;
        let totalDCPower = 0;
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => {
                if (dc.status === 'operational' || dc.status === 'active') {
                    // Parse GPU count from string like "~50,000 TPU v5p" or "100,000 H100"
                    const gpuMatch = (dc.gpus || '').match(/([\d,]+)/);
                    if (gpuMatch) totalGPU += parseInt(gpuMatch[1].replace(/,/g, ''), 10);
                }
                if (dc.power_mw) totalDCPower += dc.power_mw;
            });
        }
        const gpuNorm = Math.min(100, (totalGPU / this.TARGET_GPU_COUNT) * 100);
        const dcPowerNorm = Math.min(100, (totalDCPower / this.TARGET_DC_POWER_MW) * 100);
        computeScore = gpuNorm * 0.6 + dcPowerNorm * 0.4;

        // ─── PILLAR 3: INTELLIGENCE (25%) ───
        let intelScore = 0;
        const models = (typeof G !== 'undefined' && G.models) ? G.models : [];
        const activeModels = models.filter(m => !m.ret || new Date(m.ret).getTime() > now);
        const modelNorm = Math.min(100, (activeModels.length / this.TARGET_MODELS) * 100);

        // Average benchmark across all models
        let benchSum = 0, benchCount = 0;
        if (typeof avgBM === 'function') {
            activeModels.forEach(m => {
                const s = avgBM(m.id);
                if (s > 0) { benchSum += s; benchCount++; }
            });
        }
        const avgBench = benchCount > 0 ? benchSum / benchCount : 0;
        const benchNorm = Math.min(100, (avgBench / this.TARGET_AVG_BENCH) * 100);

        // Top ELO
        let topElo = 0;
        if (typeof BM !== 'undefined') {
            activeModels.forEach(m => {
                const e = BM[m.id]?.ELO || 0;
                if (e > topElo) topElo = e;
            });
        }
        const eloNorm = Math.min(100, (topElo / this.TARGET_TOP_ELO) * 100);

        intelScore = modelNorm * 0.3 + benchNorm * 0.4 + eloNorm * 0.3;

        // ─── PILLAR 4: RESEARCH (10%) ───
        let researchScore = 0;
        const papers = typeof API !== 'undefined' && API.arxivPapers ? API.arxivPapers.length : 0;
        const events = typeof AI_EVENTS !== 'undefined' ? AI_EVENTS.length : 0;
        const launches = typeof SpaceData !== 'undefined' && SpaceData.launches ? SpaceData.launches.length : 0;
        const paperNorm = Math.min(100, (papers / this.TARGET_PAPERS) * 100);
        const eventNorm = Math.min(100, (events / this.TARGET_EVENTS) * 100);
        const launchNorm = Math.min(100, (launches / this.TARGET_LAUNCHES) * 100);
        researchScore = paperNorm * 0.5 + eventNorm * 0.3 + launchNorm * 0.2;

        // ─── PILLAR 5: INFRASTRUCTURE (10%) ───
        let infraScore = 0;
        // VC funding
        let fundingB = 0;
        if (typeof VCRow !== 'undefined' && VCRow.FUNDING) {
            Object.values(VCRow.FUNDING).forEach(f => {
                const t = parseFloat(String(f.total || 0).replace(/[^0-9.]/g, ''));
                if (t > 0) fundingB += t / 1000; // FUNDING.total is in $M, convert to $B
            });
        }
        const fundingNorm = Math.min(100, (fundingB / this.TARGET_FUNDING_B) * 100);

        // Supply chain health (inverse of bottleneck load average)
        let scHealth = 100;
        if (typeof SUPPLY_CHAIN !== 'undefined' && SUPPLY_CHAIN.bottlenecks) {
            const bns = SUPPLY_CHAIN.bottlenecks.filter(b => b && b.load != null);
            if (bns.length > 0) {
                const avgLoad = bns.reduce((s, b) => s + b.load, 0) / bns.length;
                scHealth = Math.max(0, 100 - avgLoad); // Lower bottleneck = healthier
            }
        }
        const scNorm = Math.min(100, scHealth);
        infraScore = fundingNorm * 0.5 + scNorm * 0.5;

        // ─── COMPOSITE SCORE ───
        const weighted = (
            energyScore   * this.W_ENERGY +
            computeScore  * this.W_COMPUTE +
            intelScore    * this.W_INTEL +
            researchScore * this.W_RESEARCH +
            infraScore    * this.W_INFRA
        );

        // Map 0-100 weighted average into 0.700 – 1.000 range
        this.score = 0.700 + (weighted / 100) * 0.300;
        this.score = Math.min(1.000, Math.round(this.score * 1000) / 1000);

        this.pillars = {
            energy:   { score: Math.round(energyScore),   label: 'Energy',         emoji: '⚡', color: '#fbbf24', details: grid ? `${(grid.totalMW / 1000).toFixed(1)} GW mapped · ${grid.renewPct.toFixed(0)}% renewable` : `${typeof PowerZone !== 'undefined' ? PowerZone.getTotalSupply() : 0} MW sim` },
            compute:  { score: Math.round(computeScore),  label: 'Compute',        emoji: '🖥️', color: '#22d3ee', details: `${totalGPU.toLocaleString()} GPUs · ${(totalDCPower / 1000).toFixed(1)} GW DC power` },
            intel:    { score: Math.round(intelScore),     label: 'Intelligence',   emoji: '🧠', color: '#a78bfa', details: `${activeModels.length} models · avg ${avgBench.toFixed(0)}% · top ELO ${topElo}` },
            research: { score: Math.round(researchScore),  label: 'Research',       emoji: '📡', color: '#4ade80', details: `${papers} papers · ${events} events · ${launches} launches` },
            infra:    { score: Math.round(infraScore),     label: 'Infrastructure', emoji: '🔧', color: '#f97316', details: `$${fundingB.toFixed(1)}B VC · ${scHealth.toFixed(0)}% supply health` },
        };

        // Record history for sparkline (max 60 data points)
        this._history.push({ t: now, score: this.score });
        if (this._history.length > 60) this._history.shift();

        return this.score;
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    //  HUD GAUGE — persistent corner element
    // ═══════════════════════════════════════════════════════════════════════════════
    buildHUD() {
        if (this._built) return;
        this._built = true;

        const el = document.createElement('div');
        el.id = 'kardashevHUD';

        if (window.isMobile) {
            // On mobile: add a compact button to the control bar instead of a floating gauge
            el.style.cssText = 'display:none;';
            document.body.appendChild(el);

            const ctrlScroll = document.querySelector('.ctrls-scroll');
            if (ctrlScroll) {
                const btn = document.createElement('button');
                btn.className = 'btn';
                btn.id = 'kardashevBtn';
                btn.innerHTML = '⚡ <span id="kBtnScore">K 0.700</span>';
                btn.onclick = () => this.showPanel();
                ctrlScroll.appendChild(btn);
            }
        } else {
            el.style.cssText = 'position:fixed;top:4px;left:260px;z-index:800;cursor:pointer;user-select:none;transition:opacity 0.3s ease;';
        }
        el.onclick = () => this.showPanel();

        // SVG arc gauge (used on desktop, hidden on mobile)
        el.innerHTML = `
            <svg width="68" height="42" viewBox="0 0 68 42" style="display:block">
                <defs>
                    <linearGradient id="kGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="#f59e0b"/>
                        <stop offset="50%" stop-color="#22d3ee"/>
                        <stop offset="100%" stop-color="#4ade80"/>
                    </linearGradient>
                </defs>
                <!-- Track -->
                <path d="M 8 38 A 28 28 0 0 1 60 38" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" stroke-linecap="round"/>
                <!-- Fill -->
                <path id="kArc" d="M 8 38 A 28 28 0 0 1 60 38" fill="none" stroke="url(#kGrad)" stroke-width="4" stroke-linecap="round" stroke-dasharray="0 999"/>
                <!-- Score text -->
                <text id="kScore" x="34" y="28" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="JetBrains Mono,monospace">K 0.700</text>
                <text id="kLabel" x="34" y="38" text-anchor="middle" fill="rgba(255,255,255,0.5)" font-size="5" font-family="JetBrains Mono,monospace">KARDASHEV</text>
            </svg>`;
        document.body.appendChild(el);
    },

    updateHUD() {
        const arc = document.getElementById('kArc');
        const txt = document.getElementById('kScore');
        if (!arc || !txt) return;

        // Arc path total length ≈ 88px for a half-circle
        const totalLen = 88;
        const fill = ((this.score - 0.700) / 0.300) * totalLen; // 0.700→0, 1.000→88
        arc.setAttribute('stroke-dasharray', `${Math.max(0, fill)} ${totalLen}`);
        txt.textContent = `K ${this.score.toFixed(3)}`;

        // Update mobile button text if present
        const mBtn = document.getElementById('kBtnScore');
        if (mBtn) mBtn.textContent = `K ${this.score.toFixed(3)}`;

        // Pulse color based on score
        const hud = document.getElementById('kardashevHUD');
        if (hud) {
            const glow = this.score >= 0.900 ? 'drop-shadow(0 0 6px #4ade80)' :
                         this.score >= 0.800 ? 'drop-shadow(0 0 4px #22d3ee)' :
                         this.score >= 0.750 ? 'drop-shadow(0 0 3px #fbbf24)' : 'none';
            hud.style.filter = glow;
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════════
    //  FULL BREAKDOWN PANEL
    // ═══════════════════════════════════════════════════════════════════════════════
    showPanel() {
        const ov = document.getElementById('kardashevOv');
        if (!ov) return;

        this.calculate(); // Ensure fresh
        const pan = document.getElementById('kardashevPan');
        const s = this.score;

        // Find current & next milestone
        let currentMS = this.MILESTONES[0];
        let nextMS = this.MILESTONES[1];
        for (let i = 0; i < this.MILESTONES.length; i++) {
            if (s >= this.MILESTONES[i].k) currentMS = this.MILESTONES[i];
            if (s < this.MILESTONES[i].k && !nextMS) nextMS = this.MILESTONES[i];
        }
        // Re-find next properly
        nextMS = null;
        for (let i = 0; i < this.MILESTONES.length; i++) {
            if (this.MILESTONES[i].k > s) { nextMS = this.MILESTONES[i]; break; }
        }

        let h = '<button class="ipanel-x" onclick="document.getElementById(\'kardashevOv\').classList.remove(\'open\')">✕</button>';

        // ─── Giant score display ───
        h += '<div style="text-align:center;padding:16px 0 8px">';
        h += '<div style="font-size:8px;color:var(--t3);letter-spacing:3px;margin-bottom:4px">KARDASHEV SCALE</div>';
        h += '<div style="font-size:36px;font-weight:bold;color:#fff;font-family:\'JetBrains Mono\',monospace;letter-spacing:2px;text-shadow:0 0 20px ' + currentMS.color + '40">K ' + s.toFixed(3) + '</div>';
        h += '<div style="font-size:10px;color:' + currentMS.color + ';font-weight:bold;margin-top:4px">' + currentMS.icon + ' ' + currentMS.label + '</div>';
        h += '</div>';

        // ─── Progress bar with milestones ───
        const pct = ((s - 0.700) / 0.300) * 100;
        h += '<div style="position:relative;margin:12px 0 20px;padding:0 4px">';
        h += '<div style="background:rgba(255,255,255,0.06);border-radius:4px;height:10px;overflow:visible;position:relative">';
        h += '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#f59e0b,#22d3ee,#4ade80);border-radius:4px;transition:width 1s ease;box-shadow:0 0 8px ' + currentMS.color + '60"></div>';
        // Milestone markers
        this.MILESTONES.forEach(ms => {
            const msPct = ((ms.k - 0.700) / 0.300) * 100;
            if (msPct > 0 && msPct < 100) {
                const reached = s >= ms.k;
                h += '<div style="position:absolute;top:-2px;left:' + msPct + '%;transform:translateX(-50%);width:3px;height:14px;background:' + (reached ? ms.color : 'rgba(255,255,255,0.15)') + ';border-radius:2px" title="K ' + ms.k.toFixed(3) + ' — ' + ms.label + '"></div>';
            }
        });
        h += '</div>';
        // Labels at ends
        h += '<div style="display:flex;justify-content:space-between;font-size:6px;color:var(--t3);margin-top:2px"><span>K 0.700</span><span>K 1.000 — Type I</span></div>';
        h += '</div>';

        // ─── Next milestone callout ───
        if (nextMS) {
            const gap = ((nextMS.k - s) * 1000).toFixed(0);
            h += '<div style="background:' + nextMS.color + '0a;border:1px solid ' + nextMS.color + '33;border-radius:6px;padding:8px;margin-bottom:12px;display:flex;align-items:center;gap:8px">';
            h += '<span style="font-size:18px">' + nextMS.icon + '</span>';
            h += '<div><div style="font-size:9px;font-weight:bold;color:#fff">Next: ' + nextMS.label + ' (K ' + nextMS.k.toFixed(3) + ')</div>';
            h += '<div style="font-size:7px;color:var(--t3)">' + gap + ' millipoints away</div></div></div>';
        }

        // ─── Five pillar bars ───
        h += '<div style="font-size:8px;color:var(--t3);letter-spacing:2px;margin-bottom:6px">PILLAR BREAKDOWN</div>';
        const pillars = this.pillars;
        const pKeys = ['energy', 'compute', 'intel', 'research', 'infra'];
        const weights = [this.W_ENERGY, this.W_COMPUTE, this.W_INTEL, this.W_RESEARCH, this.W_INFRA];

        pKeys.forEach((key, i) => {
            const p = pillars[key];
            if (!p) return;
            const w = (weights[i] * 100).toFixed(0);
            h += '<div style="margin-bottom:8px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:8px">';
            h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
            h += '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:12px">' + p.emoji + '</span><span style="font-size:9px;font-weight:bold;color:#fff">' + p.label + '</span><span style="font-size:7px;color:var(--t3)">(' + w + '% weight)</span></div>';
            h += '<span style="font-size:12px;font-weight:bold;color:' + p.color + ';font-family:\'JetBrains Mono\',monospace">' + p.score + '</span>';
            h += '</div>';
            // Bar
            h += '<div style="background:rgba(255,255,255,0.06);border-radius:3px;height:6px;overflow:hidden;margin-bottom:3px">';
            h += '<div style="width:' + p.score + '%;height:100%;background:' + p.color + ';border-radius:3px;transition:width 0.5s ease"></div></div>';
            // Detail
            h += '<div style="font-size:7px;color:var(--t3)">' + p.details + '</div>';
            h += '</div>';
        });

        // ─── Stacked contribution bar ───
        h += '<div style="font-size:8px;color:var(--t3);letter-spacing:2px;margin:8px 0 6px">CONTRIBUTION MIX</div>';
        h += '<div style="display:flex;height:14px;border-radius:4px;overflow:hidden;margin-bottom:4px">';
        const totalWeighted = pKeys.reduce((sum, key, i) => sum + (pillars[key]?.score || 0) * weights[i], 0);
        pKeys.forEach((key, i) => {
            const p = pillars[key];
            if (!p || p.score === 0) return;
            const contrib = (p.score * weights[i] / Math.max(1, totalWeighted)) * 100;
            h += '<div style="width:' + contrib + '%;background:' + p.color + ';display:flex;align-items:center;justify-content:center;min-width:10px" title="' + p.label + ' ' + contrib.toFixed(1) + '%">';
            h += '<span style="font-size:5px;color:#000;font-weight:bold">' + (contrib >= 8 ? p.emoji : '') + '</span></div>';
        });
        h += '</div>';
        h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
        pKeys.forEach((key, i) => {
            const p = pillars[key];
            if (!p) return;
            const contrib = totalWeighted > 0 ? ((p.score * weights[i] / totalWeighted) * 100).toFixed(0) : 0;
            h += '<span style="font-size:6px;color:var(--t3)"><span style="display:inline-block;width:6px;height:6px;border-radius:2px;background:' + p.color + ';margin-right:2px;vertical-align:middle"></span>' + p.label + ' ' + contrib + '%</span>';
        });
        h += '</div>';

        // ─── Milestone timeline ───
        h += '<div style="font-size:8px;color:var(--t3);letter-spacing:2px;margin:8px 0 6px">CIVILISATION MILESTONES</div>';
        this.MILESTONES.forEach(ms => {
            const reached = s >= ms.k;
            h += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;opacity:' + (reached ? '1' : '0.4') + '">';
            h += '<span style="font-size:12px">' + ms.icon + '</span>';
            h += '<div style="flex:1"><span style="font-size:8px;font-weight:bold;color:' + (reached ? ms.color : 'var(--t3)') + '">' + ms.label + '</span></div>';
            h += '<span style="font-size:7px;color:var(--t3);font-family:\'JetBrains Mono\',monospace">K ' + ms.k.toFixed(3) + '</span>';
            h += '<span style="font-size:8px">' + (reached ? '✅' : '⬜') + '</span>';
            h += '</div>';
        });

        // Attribution
        h += '<div style="text-align:center;font-size:6px;color:var(--t3);margin-top:12px;padding-top:8px;border-top:1px dashed var(--bd)">Score updates live from all city data streams · <a href="https://en.wikipedia.org/wiki/Kardashev_scale" target="_blank" style="color:#22d3ee;text-decoration:none">What is the Kardashev Scale?</a></div>';

        pan.innerHTML = h;
        ov.classList.add('open');
    },

    // ─── TICK — called from engine update loop ───
    tick() {
        if (!this._built) return;

        // Hide during interiors / macro / orbit
        const hud = document.getElementById('kardashevHUD');
        if (hud) {
            const hide = (typeof G !== 'undefined' && (G.activeInterior || G.trainFocus || G.viewMode === 'macro'))
                || (typeof OrbitMode !== 'undefined' && OrbitMode.active)
                || (typeof XRayMode !== 'undefined' && XRayMode.active);
            hud.style.opacity = hide ? '0' : '1';
            hud.style.pointerEvents = hide ? 'none' : 'auto';
        }

        // Recalculate every 5 seconds
        if (Date.now() - this._lastCalc >= 5000) {
            this.calculate();
            this.updateHUD();
        }
    }
};
