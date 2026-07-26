/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   THE SINGULARITY CITY TIMES (v2.0 — Daily + Weekly editions)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Two editions sharing the same data sources, sliced differently:
     • DAILY BRIEF — punchy snapshot. Lead pulled from HackerNews top AI story (or liveNews if
       no HN data yet). Compact sections: HN top 5, two wire headlines, one paper, market line,
       one classified. Default on Mon-Sat.
     • WEEKLY EDITION — full broadsheet retrospective. Lead, AI Industry Watch, Research
       Frontiers, Regulation, Market Ticker, Classifieds, Colophon. Default on Sundays.

   Both are live-rendered each open. A tab strip at the top lets the reader switch freely.

   Data sources (all read at render time — never persisted in this module):
     • API.liveNews / arxivPapers / regulationNews / stockPrices  (RSS + arXiv + Finnhub)
     • HNBlimps._stories                                          (HackerNews top AI)

   The "🖨 SAVE AS PDF" button calls window.print(). A print-only @media rule strips the chrome
   and scales the active edition onto letter-sized paper so browsers emit a clean PDF directly.

   Zero-dependency module: no jsPDF / html2canvas / server. Pure DOM + window.print().
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Newspaper = {
    _modalEl: null,
    _styleEl: null,
    _printStyleEl: null,
    _isOpen: false,
    _volumeStart: new Date(2025, 0, 1), // Vol 1 Issue 1 = 2025-01-01
    _activeEdition: 'daily',           // 'daily' | 'weekly' | 'archive' — set on open()
    _archiveList: null,                // Cached array of {id, edition_date, kind, ...} once fetched
    _archiveHtmlCache: {},             // editionId → cached HTML body (string)
    _viewingArchiveId: null,           // If non-null, archive HTML for that id is on-screen

    // Called once during engine boot — installs the print stylesheet
    init() {
        if (this._styleEl) return;

        // Runtime stylesheet (applies when modal is open)
        const runtime = document.createElement('style');
        runtime.id = 'newspaperRuntimeCSS';
        runtime.textContent = `
            #newspaperModal {
                position: fixed; inset: 0; z-index: 99990;
                background: rgba(10, 8, 4, 0.92);
                display: none; overflow-y: auto;
                backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
                font-family: Georgia, "Times New Roman", serif;
                color: #1a1308;
                animation: npFade 0.4s ease;
            }
            #newspaperModal.open { display: block; }
            @keyframes npFade { from { opacity: 0; } to { opacity: 1; } }
            #newspaperPaper {
                max-width: 860px;
                margin: 28px auto;
                padding: 40px 48px 48px;
                background: linear-gradient(180deg, #f4ecd6 0%, #efe3c0 100%);
                border: 2px solid #3b2a12;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px #7a5a28 inset;
                position: relative;
            }
            #newspaperPaper::before {
                content: ''; position: absolute; inset: 8px;
                border: 1px solid rgba(59, 42, 18, 0.3);
                pointer-events: none;
            }
            .np-close {
                position: absolute; top: 14px; right: 18px;
                background: #3b2a12; color: #f4ecd6;
                border: none; border-radius: 4px;
                font: bold 14px/1 Georgia, serif;
                padding: 8px 12px; cursor: pointer;
                z-index: 2;
            }
            .np-close:hover { background: #5a3e1a; }
            .np-pdf {
                position: absolute; top: 14px; right: 64px;
                background: #7a5a28; color: #f4ecd6;
                border: none; border-radius: 4px;
                font: bold 11px/1 Georgia, serif;
                padding: 8px 12px; cursor: pointer;
                letter-spacing: 0.5px;
                z-index: 2;
            }
            .np-pdf:hover { background: #9b7436; }
            .np-tabs {
                display: flex; gap: 4px;
                margin: -8px -12px 14px;
                padding: 4px 4px 0;
                border-bottom: 1px solid #7a5a28;
            }
            .np-tab {
                flex: 1;
                background: rgba(122, 90, 40, 0.08);
                border: 1px solid #7a5a28;
                border-bottom: none;
                color: #5a3e1a;
                font: bold 11px/1 Georgia, serif;
                padding: 9px 12px;
                cursor: pointer;
                letter-spacing: 1px;
                text-transform: uppercase;
                border-radius: 4px 4px 0 0;
                transition: background 0.15s ease, color 0.15s ease;
            }
            .np-tab:hover { background: rgba(122, 90, 40, 0.18); color: #1a1308; }
            .np-tab.active {
                background: linear-gradient(180deg, #f4ecd6, #efe3c0);
                color: #1a1308;
                box-shadow: 0 -1px 0 #f4ecd6 inset;
            }
            .np-masthead {
                text-align: center;
                border-bottom: 4px double #3b2a12;
                padding-bottom: 14px;
                margin-bottom: 18px;
            }
            .np-masthead h1 {
                font-family: "Old English Text MT", "UnifrakturCook", Georgia, serif;
                font-size: 52px; line-height: 1; margin: 6px 0 4px;
                color: #1a1308; letter-spacing: 1px;
                text-shadow: 1px 1px 0 rgba(122, 90, 40, 0.4);
            }
            .np-meta {
                display: flex; justify-content: space-between;
                font-size: 11px; font-style: italic;
                color: #3b2a12; padding: 0 6px;
            }
            .np-tagline {
                font-size: 11px; color: #5a3e1a; font-style: italic;
                margin-top: 2px; letter-spacing: 0.5px;
            }
            .np-top-story {
                margin: 14px 0 24px; padding: 16px 18px;
                background: rgba(255, 255, 255, 0.25);
                border-top: 2px solid #3b2a12;
                border-bottom: 2px solid #3b2a12;
            }
            .np-top-story h2 {
                font-size: 28px; font-weight: bold; margin: 0 0 8px;
                color: #1a1308; line-height: 1.1;
            }
            .np-top-story .np-sub {
                font-size: 13px; font-style: italic; color: #5a3e1a;
                margin: 0 0 10px; border-bottom: 1px dashed #7a5a28;
                padding-bottom: 8px;
            }
            .np-top-story p {
                font-size: 12px; line-height: 1.6; margin: 8px 0 0;
                color: #2a1f0c; text-align: justify;
            }
            .np-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 18px 28px;
                margin-top: 16px;
            }
            .np-section {
                border-top: 1px solid #7a5a28;
                padding-top: 10px;
            }
            .np-section h3 {
                font-size: 15px; margin: 0 0 8px;
                color: #1a1308;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-bottom: 1px solid #7a5a28;
                padding-bottom: 4px;
                font-family: "Old English Text MT", Georgia, serif;
            }
            .np-section .np-item {
                font-size: 11px; line-height: 1.5;
                margin-bottom: 8px; color: #2a1f0c;
            }
            .np-section .np-item b { color: #1a1308; }
            .np-section .np-item .np-byline {
                display: block;
                font-size: 9px; font-style: italic; color: #5a3e1a;
                margin-top: 1px; letter-spacing: 0.3px;
            }
            .np-rank {
                display: inline-block; width: 18px;
                font-weight: bold; color: #7a5a28;
            }
            .np-classifieds {
                margin-top: 16px; padding: 10px 12px;
                background: rgba(122, 90, 40, 0.1);
                border: 1px dashed #7a5a28;
                font-size: 10px; line-height: 1.6; color: #2a1f0c;
                columns: 2; column-gap: 18px;
            }
            .np-classifieds h4 {
                font-size: 13px; margin: 0 0 6px; color: #1a1308;
                column-span: all; text-align: center;
                letter-spacing: 2px;
                font-family: "Old English Text MT", Georgia, serif;
                border-bottom: 1px solid #7a5a28; padding-bottom: 4px;
            }
            .np-classifieds .np-ad {
                margin-bottom: 6px; break-inside: avoid;
            }
            .np-classifieds .np-ad b { color: #3b2a12; }
            .np-colophon {
                margin-top: 22px; padding-top: 10px;
                border-top: 2px double #3b2a12;
                text-align: center;
                font-size: 9px; font-style: italic;
                color: #5a3e1a; letter-spacing: 0.5px;
            }
            .np-archive-intro {
                margin: 14px 0 12px;
                padding: 10px 14px;
                background: rgba(122, 90, 40, 0.08);
                border-left: 3px solid #7a5a28;
                font-size: 11px; line-height: 1.5;
                color: #2a1f0c;
            }
            .np-archive-list {
                margin-top: 10px;
                display: flex; flex-direction: column; gap: 4px;
            }
            .np-archive-row {
                display: grid;
                grid-template-columns: 110px 70px 1fr;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                background: rgba(255, 255, 255, 0.18);
                border: 1px solid rgba(122, 90, 40, 0.4);
                border-radius: 3px;
                cursor: pointer;
                transition: background 0.12s ease, transform 0.12s ease;
                font-size: 11px; color: #2a1f0c;
                text-align: left;
            }
            .np-archive-row:hover {
                background: rgba(255, 255, 255, 0.42);
                transform: translateX(2px);
            }
            .np-archive-row .np-ar-date  { font-weight: bold; color: #1a1308; font-variant-numeric: tabular-nums; }
            .np-archive-row .np-ar-kind  { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #5a3e1a; }
            .np-archive-row .np-ar-lead  { color: #2a1f0c; line-height: 1.3; }
            .np-archive-row .np-ar-lead i { color: #7a5a28; }
            .np-archive-empty, .np-archive-loading {
                padding: 24px 12px;
                text-align: center;
                color: #5a3e1a; font-style: italic;
            }
            .np-archive-back {
                display: inline-block;
                margin: 0 0 12px;
                padding: 6px 12px;
                background: #7a5a28; color: #f4ecd6;
                border: none; border-radius: 3px;
                font: bold 10px/1 Georgia, serif;
                letter-spacing: 1px;
                cursor: pointer;
            }
            .np-archive-back:hover { background: #9b7436; }
            @media (max-width: 768px) {
                #newspaperPaper {
                    margin: 8px auto; padding: 16px 14px 20px;
                }
                .np-masthead h1 { font-size: 28px; }
                .np-meta { flex-direction: column; align-items: center; gap: 2px; font-size: 9px; }
                .np-top-story h2 { font-size: 18px; }
                .np-top-story p { font-size: 11px; }
                .np-top-story .np-sub { font-size: 11px; }
                .np-grid { grid-template-columns: 1fr; gap: 12px; }
                .np-section h3 { font-size: 13px; }
                .np-classifieds { columns: 1; font-size: 9px; }
                .np-close { top: 8px; right: 8px; padding: 6px 10px; font-size: 12px; }
                .np-pdf { top: 8px; right: 46px; padding: 6px 10px; font-size: 9px; }
                .np-tabs { margin: -4px -6px 10px; padding: 4px 4px 0; }
                .np-tab { font-size: 10px; padding: 7px 6px; letter-spacing: 0.5px; }
            }
            @media (max-height: 500px) {
                #newspaperPaper { margin: 4px auto; padding: 12px 10px 14px; max-height: calc(100vh - 8px); overflow-y: auto; }
                .np-masthead h1 { font-size: 22px; }
            }
        `;
        document.head.appendChild(runtime);
        this._styleEl = runtime;

        // Print-only stylesheet — strips chrome and fits letter-sized paper
        const print = document.createElement('style');
        print.id = 'newspaperPrintCSS';
        print.media = 'print';
        print.textContent = `
            body > *:not(#newspaperModal) { display: none !important; }
            #newspaperModal { position: static !important; background: #fff !important; backdrop-filter: none !important; }
            #newspaperPaper {
                max-width: 100% !important; margin: 0 !important;
                padding: 24px 32px !important; box-shadow: none !important;
                border: 1px solid #3b2a12 !important;
                background: #fff !important;
                page-break-inside: avoid;
            }
            .np-close, .np-pdf, .np-tabs { display: none !important; }
            @page { size: letter; margin: 0.4in; }
        `;
        document.head.appendChild(print);
        this._printStyleEl = print;
    },

    open(edition) {
        if (!this._styleEl) this.init();
        if (this._isOpen) return;

        // Default edition: Sundays feature the Weekly retrospective; the rest of the
        // week the Daily Brief leads. Caller can force either via the argument.
        if (edition === 'daily' || edition === 'weekly') {
            this._activeEdition = edition;
        } else {
            this._activeEdition = (new Date().getDay() === 0) ? 'weekly' : 'daily';
        }

        // Build the modal DOM
        const modal = document.createElement('div');
        modal.id = 'newspaperModal';
        modal.className = 'open';
        modal.innerHTML = this._buildModalHTML();
        document.body.appendChild(modal);

        this._wireModal(modal);

        this._modalEl = modal;
        this._isOpen = true;

        // Pause auto-tour if it's active and tell the idle timer not to fire
        if (typeof AutoTour !== 'undefined') {
            AutoTour.stop('newspaper');
            AutoTour._lastInputAt = performance.now();
        }
    },

    // Wire close / pdf / tab handlers — called fresh after every render so swapping
    // editions doesn't leak listeners.
    _wireModal(modal) {
        modal.querySelector('.np-close').addEventListener('click', () => this.close());
        modal.querySelector('.np-pdf').addEventListener('click', () => this.savePDF());
        modal.querySelectorAll('.np-tab').forEach(btn => {
            btn.addEventListener('click', () => this._setEdition(btn.dataset.edition));
        });
        // Archive row clicks → load and display that issue
        modal.querySelectorAll('.np-archive-row[data-archive-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.archiveId;
                if (!id) return;
                this._viewingArchiveId = id;
                this._loadArchiveIssue(id);
                this._refreshArchiveView();
            });
        });
        // "Back to all issues" button when viewing a single archived edition
        const back = modal.querySelector('[data-action="archive-back"]');
        if (back) {
            back.addEventListener('click', () => {
                this._viewingArchiveId = null;
                this._refreshArchiveView();
            });
        }
        // Click-outside-to-close on the dim background only
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });
    },

    _setEdition(edition) {
        if (!this._isOpen || !this._modalEl) return;
        if (edition !== 'daily' && edition !== 'weekly' && edition !== 'archive') return;
        if (this._activeEdition === edition && !this._viewingArchiveId) return;
        this._activeEdition = edition;
        this._viewingArchiveId = null;        // any tab swap returns to the list
        this._modalEl.innerHTML = this._buildModalHTML();
        this._wireModal(this._modalEl);

        // Lazy-fetch archive list on first switch to that tab
        if (edition === 'archive' && this._archiveList === null) {
            this._loadArchiveList();
        }
    },

    close() {
        if (!this._isOpen) return;
        if (this._modalEl) this._modalEl.remove();
        this._modalEl = null;
        this._isOpen = false;
    },

    savePDF() {
        // Give the browser one frame to apply any fresh print CSS, then invoke print.
        // Users hit "Save as PDF" in the print dialog — works in Chrome/Edge/Firefox/Safari.
        setTimeout(() => window.print(), 50);
    },

    // ──────────────────────────────────────────────────────────────────────────────────
    // CONTENT GENERATION — real-world AI news from API feeds + RSS + HackerNews
    // ──────────────────────────────────────────────────────────────────────────────────

    // Top-level dispatcher: returns Daily / Weekly / Archive HTML based on _activeEdition.
    _buildModalHTML() {
        if (this._activeEdition === 'archive') return this._buildArchiveHTML();
        if (this._activeEdition === 'weekly')  return this._buildWeeklyHTML();
        return this._buildDailyHTML();
    },

    _buildTabs() {
        const d = this._activeEdition === 'daily' ? ' active' : '';
        const w = this._activeEdition === 'weekly' ? ' active' : '';
        const a = this._activeEdition === 'archive' ? ' active' : '';
        return `<div class="np-tabs">
            <button class="np-tab${d}" data-edition="daily" title="Today's brief">📰 TODAY</button>
            <button class="np-tab${w}" data-edition="weekly" title="The week in review">📚 THIS WEEK</button>
            <button class="np-tab${a}" data-edition="archive" title="Archived editions from past press cycles">🗄 BACK ISSUES</button>
        </div>`;
    },

    _buildWeeklyHTML() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const issueNum = this._computeIssueNum(now);
        const weather = this._getWeatherText();

        // Pull real-world news from API feeds + HackerNews
        const hnStories = this._getHNStories(5);
        const headlines = this._mergeHeadlines(this._getLiveHeadlines(8), hnStories, 8);
        const papers = this._getArxivPapers(4);
        const regulation = this._getRegulationNews(4);
        const stocks = this._getStockTicker();

        let html = `<div id="newspaperPaper">`;
        html += `<button class="np-pdf" title="Print / save as PDF">🖨 SAVE AS PDF</button>`;
        html += `<button class="np-close" aria-label="Close">✕</button>`;
        html += this._buildTabs();

        // Masthead
        html += `<div class="np-masthead">
            <div class="np-tagline">— ESTABLISHED 2025 · WEEKLY RECORD OF THE INTELLIGENCE FRONTIER —</div>
            <h1>The Singularity City Times</h1>
            <div class="np-meta">
                <span><b>VOL. ${issueNum.vol}</b> · No. ${issueNum.issue}</span>
                <span>${dateStr}</span>
                <span>${weather} · ONE CREDIT</span>
            </div>
        </div>`;

        // ─── LEAD STORY (first real headline) ───
        if (headlines.length > 0) {
            const lead = headlines[0];
            html += `<div class="np-top-story">
                <h2>${this._esc(lead.headline)}</h2>
                <div class="np-sub">Source: ${this._esc(lead.source)} · <a href="${safeHref(lead.url)}" target="_blank" rel="noopener" style="color:#5a3e1a">Read full article →</a></div>
            </div>`;
        } else {
            html += `<div class="np-top-story">
                <h2>The Frontier Holds Steady</h2>
                <div class="np-sub">News feeds are loading. Check back shortly.</div>
            </div>`;
        }

        // ─── TWO-COLUMN GRID ───
        html += `<div class="np-grid">`;

        // Column 1: AI Industry Headlines
        html += `<div class="np-section"><h3>📡 AI Industry Watch</h3>`;
        if (headlines.length > 1) {
            for (let i = 1; i < headlines.length; i++) {
                const h = headlines[i];
                html += `<div class="np-item">
                    <b><a href="${safeHref(h.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(h.headline)}</a></b>
                    <span class="np-byline">${this._esc(h.source)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>RSS feeds loading — headlines will appear on next refresh.</i></div>`;
        }
        html += `</div>`;

        // Column 2: Research Frontiers (arXiv)
        html += `<div class="np-section"><h3>📄 Research Frontiers</h3>`;
        if (papers.length > 0) {
            for (const p of papers) {
                html += `<div class="np-item">
                    <b><a href="https://arxiv.org/abs/${this._esc(p.id)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(p.title)}</a></b>
                    <span class="np-byline">arXiv: ${this._esc(p.id)} · ${this._esc(p.published)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>arXiv feed loading — papers will appear shortly.</i></div>`;
        }
        html += `</div>`;

        html += `</div>`; // end grid

        // ─── REGULATION & POLICY (full width) ───
        html += `<div class="np-section" style="margin-top:16px"><h3>⚖ Regulation & Policy</h3>`;
        if (regulation.length > 0) {
            for (const r of regulation) {
                html += `<div class="np-item">
                    <b><a href="${safeHref(r.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(r.headline)}</a></b>
                    <span class="np-byline">${this._esc(r.source)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>No regulation headlines this cycle. The policy desk is quiet.</i></div>`;
        }
        html += `</div>`;

        // ─── MARKET TICKER (if stock data available) ───
        if (stocks.length > 0) {
            html += `<div class="np-section" style="margin-top:12px"><h3>📈 Market Ticker</h3>`;
            html += `<div class="np-item" style="font-family:monospace;font-size:10px;line-height:1.8">`;
            html += stocks.map(s =>
                `<b>${this._esc(s.sym)}</b> $${this._esc(s.price)} <span style="color:${s.color}">${this._esc(s.change)}</span>`
            ).join(' · ');
            html += `</div></div>`;
        }

        // Classifieds
        html += this._buildClassifieds();

        // Colophon
        html += `<div class="np-colophon">
            THE SINGULARITY CITY TIMES — Weekly Edition. Printed Sundays at the Times HQ downtown.
            News sourced live from TechCrunch, The Verge, VentureBeat, Ars Technica, arXiv &amp; Hacker News.
            Editor-in-Chief: The Autonomous Bureau · Design: The Neon Atelier
            <br>— Press <b>Save as PDF</b> above to archive this issue —
        </div>`;

        html += `</div>`;
        return html;
    },

    // ──────────────────────────────────────────────────────────────────────────────────
    // DAILY BRIEF — punchy snapshot, HackerNews-led when available
    // ──────────────────────────────────────────────────────────────────────────────────
    _buildDailyHTML() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
        const issueNum = this._computeDailyIssueNum(now);
        const weather = this._getWeatherText();

        const hnStories = this._getHNStories(5);
        const headlines = this._getLiveHeadlines(3);
        const papers = this._getArxivPapers(1);
        const regulation = this._getRegulationNews(1);
        const stocks = this._getStockTicker();
        const lead = this._pickDailyLead(hnStories, headlines);

        let html = `<div id="newspaperPaper">`;
        html += `<button class="np-pdf" title="Print / save as PDF">🖨 SAVE AS PDF</button>`;
        html += `<button class="np-close" aria-label="Close">✕</button>`;
        html += this._buildTabs();

        // Masthead (compact daily variant)
        html += `<div class="np-masthead">
            <div class="np-tagline">— TODAY ON THE FRONTIER · DAILY BRIEF —</div>
            <h1>The Singularity City Times</h1>
            <div class="np-meta">
                <span><b>DAILY</b> · No. ${issueNum}</span>
                <span>${dateStr}</span>
                <span>${weather} · ONE CREDIT</span>
            </div>
        </div>`;

        // ─── LEAD ───
        if (lead) {
            const subAttr = lead.source === 'Hacker News'
                ? `▲ Hacker News · ${lead.score || 0} points · ${lead.comments || 0} comments`
                : `Source: ${this._esc(lead.source)}`;
            html += `<div class="np-top-story">
                <h2><a href="${safeHref(lead.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(lead.headline)}</a></h2>
                <div class="np-sub">${subAttr} · <a href="${safeHref(lead.url)}" target="_blank" rel="noopener" style="color:#5a3e1a">Read full article →</a></div>
            </div>`;
        } else {
            html += `<div class="np-top-story">
                <h2>The Wires Are Quiet</h2>
                <div class="np-sub">Headlines fetch on a 5-minute cycle. Try again in a moment.</div>
            </div>`;
        }

        // ─── TWO-COLUMN GRID ───
        html += `<div class="np-grid">`;

        // Column 1: HackerNews top AI stories
        html += `<div class="np-section"><h3>▲ Hacker News — AI Top</h3>`;
        if (hnStories.length > 0) {
            for (const s of hnStories) {
                html += `<div class="np-item">
                    <b><a href="${safeHref(s.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(s.headline)}</a></b>
                    <span class="np-byline">▲ ${s.score || 0} · ${s.comments || 0} comments · <a href="https://news.ycombinator.com/item?id=${this._esc(s.id)}" target="_blank" rel="noopener" style="color:#5a3e1a">discuss</a></span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>HackerNews fetch in progress — top AI stories appear here.</i></div>`;
        }
        html += `</div>`;

        // Column 2: On the Wires + Paper of the Day
        html += `<div class="np-section"><h3>📡 On the Wires</h3>`;
        if (headlines.length > 0) {
            for (const h of headlines.slice(0, 3)) {
                html += `<div class="np-item">
                    <b><a href="${safeHref(h.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(h.headline)}</a></b>
                    <span class="np-byline">${this._esc(h.source)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>RSS feeds loading.</i></div>`;
        }
        html += `</div>`;

        html += `</div>`; // end grid

        // ─── PAPER + REGULATION ROW (one item each) ───
        html += `<div class="np-grid" style="margin-top:14px">`;
        html += `<div class="np-section"><h3>📄 Paper of the Day</h3>`;
        if (papers.length > 0) {
            const p = papers[0];
            html += `<div class="np-item">
                <b><a href="https://arxiv.org/abs/${this._esc(p.id)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(p.title)}</a></b>
                <span class="np-byline">arXiv: ${this._esc(p.id)} · ${this._esc(p.published)}</span>
            </div>`;
        } else {
            html += `<div class="np-item"><i>arXiv feed loading.</i></div>`;
        }
        html += `</div>`;

        html += `<div class="np-section"><h3>⚖ Policy Beat</h3>`;
        if (regulation.length > 0) {
            const r = regulation[0];
            html += `<div class="np-item">
                <b><a href="${safeHref(r.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(r.headline)}</a></b>
                <span class="np-byline">${this._esc(r.source)}</span>
            </div>`;
        } else {
            html += `<div class="np-item"><i>Policy desk: nothing fresh today.</i></div>`;
        }
        html += `</div>`;
        html += `</div>`; // end second grid

        // ─── MARKET ONE-LINER ───
        if (stocks.length > 0) {
            html += `<div class="np-section" style="margin-top:14px"><h3>📈 Markets</h3>`;
            html += `<div class="np-item" style="font-family:monospace;font-size:10px;line-height:1.8">`;
            html += stocks.slice(0, 6).map(s =>
                `<b>${this._esc(s.sym)}</b> $${this._esc(s.price)} <span style="color:${s.color}">${this._esc(s.change)}</span>`
            ).join(' · ');
            html += `</div></div>`;
        }

        // ─── ONE CLASSIFIED (rotated daily) ───
        html += this._buildDailyClassified(now);

        // Colophon
        html += `<div class="np-colophon">
            THE SINGULARITY CITY TIMES — Daily Brief. Refreshed live each visit.
            For the full weekly retrospective, switch to <b>📚 THIS WEEK</b> above.
            <br>— Press <b>Save as PDF</b> to archive today's brief —
        </div>`;

        html += `</div>`;
        return html;
    },

    // ──────────────────────────────────────────────────────────────────────────────────
    // BACK ISSUES — archived editions read from Supabase
    // ──────────────────────────────────────────────────────────────────────────────────
    _buildArchiveHTML() {
        let html = `<div id="newspaperPaper">`;
        html += `<button class="np-pdf" title="Print / save as PDF">🖨 SAVE AS PDF</button>`;
        html += `<button class="np-close" aria-label="Close">✕</button>`;
        html += this._buildTabs();

        // Viewing a specific archived issue
        if (this._viewingArchiveId) {
            const cached = this._archiveHtmlCache[this._viewingArchiveId];
            html += `<button class="np-archive-back" data-action="archive-back">← Back to all issues</button>`;
            if (cached === undefined) {
                html += `<div class="np-archive-loading">Loading archived issue…</div>`;
            } else if (cached === null) {
                html += `<div class="np-archive-empty">This issue couldn't be loaded.</div>`;
            } else {
                html += cached;
            }
            html += `</div>`;
            return html;
        }

        // Index view — list of available editions
        html += `<div class="np-masthead">
            <div class="np-tagline">— THE ARCHIVE · BACK ISSUES OF THE SINGULARITY CITY TIMES —</div>
            <h1>The Singularity City Times</h1>
            <div class="np-meta">
                <span><b>ARCHIVE</b></span>
                <span>${(this._archiveList || []).length} issues on file</span>
                <span>READ-ONLY</span>
            </div>
        </div>`;

        html += `<div class="np-archive-intro">
            Every Daily Brief and Weekly Edition is committed to the archive at 00:00 UTC.
            Click any issue below to read it as it ran. The archive is read-only — for the
            live newsroom, use <b>📰 TODAY</b> or <b>📚 THIS WEEK</b> above.
        </div>`;

        if (this._archiveList === null) {
            html += `<div class="np-archive-loading">Pulling the archive from cold storage…</div>`;
        } else if (this._archiveList.length === 0) {
            html += `<div class="np-archive-empty">No back issues yet — the first edition will be archived at the next 00:00 UTC.</div>`;
        } else {
            html += `<div class="np-archive-list">`;
            for (const row of this._archiveList) {
                const dateLabel = this._formatArchiveDate(row.edition_date);
                const kindLabel = row.kind === 'weekly' ? '📚 WEEKLY' : '📰 DAILY';
                const lead = row.lead_headline
                    ? `<b>${this._esc(row.lead_headline)}</b>` + (row.lead_source ? ` <i>· ${this._esc(row.lead_source)}</i>` : '')
                    : '<i>No lead recorded</i>';
                html += `<button class="np-archive-row" data-archive-id="${this._esc(row.id)}">
                    <span class="np-ar-date">${this._esc(dateLabel)}</span>
                    <span class="np-ar-kind">${kindLabel}</span>
                    <span class="np-ar-lead">${lead}</span>
                </button>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
        return html;
    },

    _formatArchiveDate(iso) {
        // iso is YYYY-MM-DD; format as e.g. "Fri · May 1, 2026"
        const [y, m, d] = (iso || '').split('-').map(Number);
        if (!y) return iso || '';
        const dt = new Date(Date.UTC(y, m - 1, d));
        return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    },

    // Fetches the list of archived editions from Supabase. Anon key + RLS allow read.
    async _loadArchiveList() {
        const url = (typeof G !== 'undefined' && G.supabaseUrl) || '';
        const key = (typeof G !== 'undefined' && G.supabaseKey) || '';
        if (!url || !key) {
            this._archiveList = [];
            this._refreshArchiveView();
            return;
        }
        try {
            const r = await fetch(
                `${url}/rest/v1/newspaper_editions?select=id,edition_date,kind,issue_number,volume_number,lead_headline,lead_source,lead_url&order=edition_date.desc,kind.asc&limit=60`,
                { headers: { apikey: key, Authorization: `Bearer ${key}` } }
            );
            if (!r.ok) throw new Error('HTTP ' + r.status);
            this._archiveList = await r.json();
        } catch (e) {
            console.warn('[Newspaper] archive list fetch failed:', e.message);
            this._archiveList = [];
        }
        this._refreshArchiveView();
    },

    // Fetches the HTML body of one archived edition. Cached after first load.
    async _loadArchiveIssue(id) {
        if (this._archiveHtmlCache[id] !== undefined && this._archiveHtmlCache[id] !== null) return;
        // Mark as loading so the modal shows a placeholder during fetch
        this._archiveHtmlCache[id] = undefined;
        this._refreshArchiveView();

        const url = (typeof G !== 'undefined' && G.supabaseUrl) || '';
        const key = (typeof G !== 'undefined' && G.supabaseKey) || '';
        if (!url || !key) {
            this._archiveHtmlCache[id] = null;
            this._refreshArchiveView();
            return;
        }
        try {
            const r = await fetch(
                `${url}/rest/v1/newspaper_edition_html?edition_id=eq.${encodeURIComponent(id)}&select=html`,
                { headers: { apikey: key, Authorization: `Bearer ${key}` } }
            );
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const arr = await r.json();
            this._archiveHtmlCache[id] = (arr[0] && arr[0].html) || null;
        } catch (e) {
            console.warn('[Newspaper] archive issue fetch failed:', e.message);
            this._archiveHtmlCache[id] = null;
        }
        this._refreshArchiveView();
    },

    // Re-render archive view if it's the active tab. No-op otherwise so slow
    // network responses arriving after the user navigated away don't clobber things.
    _refreshArchiveView() {
        if (!this._isOpen || !this._modalEl) return;
        if (this._activeEdition !== 'archive') return;
        this._modalEl.innerHTML = this._buildModalHTML();
        this._wireModal(this._modalEl);
    },

    // Build a numeric issue (Vol/Issue) from weeks elapsed since launch date.
    // KEEP IN SYNC with computeWeeklyIssueNum/computeDailyIssueNum in
    // netlify/functions/publish-newspaper-edition.mjs — the archive publisher
    // stamps editions with the same math; divergence = mismatched issue numbers.
    _computeIssueNum(now) {
        const ms = now - this._volumeStart;
        const weeks = Math.max(1, Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1);
        const issuesPerVolume = 52;
        const vol = Math.floor((weeks - 1) / issuesPerVolume) + 1;
        const issue = ((weeks - 1) % issuesPerVolume) + 1;
        return { vol, issue };
    },

    // Daily issue number = days elapsed since launch.
    _computeDailyIssueNum(now) {
        const ms = now - this._volumeStart;
        return Math.max(1, Math.floor(ms / (24 * 3600 * 1000)) + 1);
    },

    _getWeatherText() {
        const weather = (typeof Environment !== 'undefined' && Environment.weather) || 'clear';
        const map = {
            clear: 'FAIR SKIES', rain: 'RAINY', snow: 'SNOW FLURRIES',
            cherry: 'BLOSSOM DRIFT', sandstorm: 'SANDSTORM',
            drizzle: 'LIGHT DRIZZLE', thunderstorm: 'THUNDERSTORMS',
            fog: 'THICK FOG', overcast: 'OVERCAST', partly_cloudy: 'PARTLY CLOUDY',
            leaves: 'AUTUMN LEAVES',
        };
        return map[weather] || 'FAIR SKIES';
    },

    // ─── Real-world news from API feeds ───

    _getLiveHeadlines(n) {
        if (typeof API === 'undefined' || !API.liveNews || API.liveNews.length === 0) return [];
        return API.liveNews.slice(0, n);
    },

    _getArxivPapers(n) {
        if (typeof API === 'undefined' || !API.arxivPapers || API.arxivPapers.length === 0) return [];
        return API.arxivPapers.slice(0, n);
    },

    _getRegulationNews(n) {
        if (typeof API === 'undefined' || !API.regulationNews || API.regulationNews.length === 0) return [];
        return API.regulationNews.slice(0, n);
    },

    _getStockTicker() {
        if (typeof API === 'undefined' || !API.stockPrices) return [];
        const entries = Object.entries(API.stockPrices);
        if (entries.length === 0) return [];
        return entries.slice(0, 10).map(([sym, data]) => ({
            sym,
            price: data.price,
            change: data.change,
            color: data.color || '#666',
        }));
    },

    // Adapter: pulls from HNBlimps._stories and normalizes to the same shape as
    // liveNews items so they can flow through the same render path. HN data is
    // populated by hn_blimps.js (10-min cache via Netlify function).
    _getHNStories(n) {
        if (typeof HNBlimps === 'undefined' || !HNBlimps._stories || !HNBlimps._stories.length) return [];
        return HNBlimps._stories.slice(0, n).map(s => ({
            id: s.id,
            headline: s.title,
            source: 'Hacker News',
            url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
            score: s.score || 0,
            comments: s.descendants || 0,
        }));
    },

    // Daily lead picker: prefer a hot HN story (>=200 score) when available, otherwise
    // fall back to the freshest wire headline. Keeps the daily relevant on quiet news days.
    _pickDailyLead(hnStories, headlines) {
        const hot = hnStories.find(s => (s.score || 0) >= 200);
        if (hot) return hot;
        if (hnStories.length > 0) return hnStories[0];
        if (headlines.length > 0) return headlines[0];
        return null;
    },

    // Merge wire headlines + HN top into a single dedup'd list for the weekly's
    // "AI Industry Watch" column. URL is the dedupe key.
    _mergeHeadlines(wires, hn, n) {
        const seen = new Set();
        const out = [];
        const push = (item) => {
            const key = (item.url || item.headline || '').toLowerCase();
            if (!key || seen.has(key)) return;
            seen.add(key);
            out.push(item);
        };
        // Interleave: wires first (already sorted by recency), HN sprinkled in after the lead.
        if (wires[0]) push(wires[0]);
        for (let i = 0; i < Math.max(wires.length, hn.length) && out.length < n; i++) {
            if (hn[i]) push(hn[i]);
            if (wires[i + 1]) push(wires[i + 1]);
        }
        return out.slice(0, n);
    },

    // Daily classified rotates by day-of-year so the same ad runs all day but the
    // city sees a fresh one each morning. Ad pool is independent from the weekly's
    // 8-slot grid.
    _buildDailyClassified(now) {
        const ads = [
            ['HELP WANTED', 'Junior reasoner. Must show work. Loop unrolling a plus. Apply at any HQ.'],
            ['FOR TRADE', 'Surplus 8K context tokens. Will swap for verified citations.'],
            ['NOTICE', 'Black Market Dumpster has been moved. New entrance is the OTHER suspicious alley.'],
            ['SERVICES', 'Eval-cert\'d bench-pressing — flex your attention heads at RLHF Gym.'],
            ['LOST', 'A single coherent thought. Last seen near the Embassy Quarter at 2am.'],
            ['UPCOMING', 'Newspaper HQ tour every Thursday — see the press in action.'],
            ['SEEKING', 'Reviewer #2 for a paper that just needs ONE more accept.'],
        ];
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        const ad = ads[dayOfYear % ads.length];
        return `<div class="np-classifieds" style="margin-top:14px"><h4>— TODAY'S CLASSIFIED —</h4>
            <div class="np-ad"><b>${ad[0]}:</b> ${ad[1]}</div></div>`;
    },

    _buildClassifieds() {
        // Playful flavor ads that reference real in-game entities. Deterministic-ish pool.
        const ads = [
            ['WANTED', 'Night-shift barista, API Cafe. Must handle 4K tokens/sec. Competitive per-prompt rate. Apply within.'],
            ['FOR SALE', 'Gently used embedding model, 1536-dim, low-mileage. $50 OBO. Reach out via any vector database.'],
            ['LOST', 'One (1) aligned scalar. Last seen near the RLHF Gym. Reward: full context window.'],
            ['SERVICES', 'The Neon Bar now hosts open-mic prompt nights every Thursday. Models unwind, humans learn.'],
            ['ANNOUNCEMENT', 'LMSYS Arena semifinals this weekend. Bring your flagship. Bring your friends. Bring your backups.'],
            ['NOTICE', 'The Leaderboard Monument will be repolished next week. Expect benchmark glare reduction.'],
            ['SEEKING', 'Retired PaLM 2 memoir — "I Was There Before The Transformer". Available at the Legacy Systems museum.'],
            ['PERSONALS', 'Open-source LLM seeks cozy fine-tuning partner. No frozen layers, please. Loss curves welcome.'],
        ];
        let html = `<div class="np-classifieds"><h4>— CLASSIFIEDS —</h4>`;
        for (const [kind, body] of ads) {
            html += `<div class="np-ad"><b>${kind}:</b> ${body}</div>`;
        }
        html += `</div>`;
        return html;
    },

    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },
};
