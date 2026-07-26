/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   EMBASSY ROW (v1.0.0 — Phase 3, Roadmap Feature #1)
   Diplomatic quarter between the Convention Center and the Global AI Index. Six national
   consulates, each with a classical columned facade, flying flag, and AI-policy info panel.

   Clicking an embassy opens a UI.selectBld panel with that country's AI regulatory stance,
   flagship labs, and governance framework. Data is curated (not live) — policy evolves
   slowly enough that a refresh every few commits is fine.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EmbassyRow = {
    BLDS: [
        {
            id: 'embassy_us', name: 'US Consulate', w: 150, fl: 3, emoji: '🇺🇸',
            type: 'embassy', country: 'us',
            flagColors: [0xbf0a30, 0xffffff, 0x002868],
            accent: 0x002868,
            regulator: 'Executive branch · NIST · Commerce (BIS)',
            framework: "America's AI Action Plan (2025) · NIST AI RMF · pro-innovation EO",
            stance: 'Deregulatory pivot: EO 14110 rescinded (2025), replaced by an AI-dominance agenda. H200 sales to China moved to case-by-case review with a 25% tariff. Federal push to preempt state AI laws.',
            milestone: 'Jun 2026: Commerce closed a loophole letting Chinese firms buy Nvidia Blackwell-class chips via overseas subsidiaries — even as the Jan 2026 H200 case-by-case approval stays stalled, with zero chips actually shipped.',
            labs: ['OpenAI', 'Anthropic', 'Google DeepMind', 'Meta AI', 'xAI / SpaceX', 'Microsoft'],
            desc: 'United States of America. The dominant hub of frontier AI. The 2025 administration tore up the prior executive order for a deregulatory, "win the AI race" agenda — voluntary commitments over a comprehensive AI act, backed by chip export controls.'
        },
        {
            id: 'embassy_cn', name: 'Chinese Embassy', w: 150, fl: 4, emoji: '🇨🇳',
            type: 'embassy', country: 'cn',
            flagColors: [0xde2910, 0xffde00],
            accent: 0xde2910,
            regulator: 'Cyberspace Administration (CAC)',
            framework: 'Interim Measures for Generative AI · AI content-labeling rules (2025)',
            stance: 'Strict pre-market registration and security assessments; content aligned with core socialist values. Now countering US chip curbs with its own gallium & rare-earth export licenses and a domestic-silicon push.',
            milestone: 'Jul 2026: DeepSeek graduates V4 from preview to official release — 1M-token context window, new peak/off-peak API pricing — while Beijing keeps wielding rare-earth export licenses as leverage.',
            labs: ['DeepSeek', 'Alibaba Qwen', 'Moonshot (Kimi)', 'Baidu Ernie', 'Tencent Hunyuan', 'Zhipu'],
            desc: 'People\'s Republic of China. The world\'s second AI superpower. Rapid open-weight releases (DeepSeek, Qwen, Kimi) despite US export controls — and an increasingly muscular counter using its grip on critical minerals.'
        },
        {
            id: 'embassy_eu', name: 'EU Delegation', w: 150, fl: 3, emoji: '🇪🇺',
            type: 'embassy', country: 'eu',
            flagColors: [0x003399, 0xffcc00],
            accent: 0x003399,
            regulator: 'European Commission · National DPAs',
            framework: 'EU AI Act · GPAI Code of Practice · Digital Omnibus (2026)',
            stance: 'World-first comprehensive AI law. GPAI obligations for >10^25-FLOP models went live Aug 2025; a Digital Omnibus formally adopted Jun 29, 2026 pushed high-risk compliance deadlines to Dec 2027 (standalone) / Aug 2028 (embedded) to ease competitiveness worries.',
            milestone: 'Jun 29, 2026: EU Council formally adopted the Digital Omnibus, easing AI Act burdens — plus a new EU-wide ban on AI "nudification"/CSAM tools taking effect Dec 2026.',
            labs: ['Mistral', 'Black Forest Labs', 'Kyutai', 'Aleph Alpha', 'Helsing'],
            desc: 'European Union. The world\'s first jurisdiction with a comprehensive horizontal AI law. The AI Act bans social scoring and untargeted biometric scraping and imposes transparency duties on foundation models — now balancing enforcement against a competitiveness push.'
        },
        {
            id: 'embassy_uk', name: 'UK High Commission', w: 150, fl: 3, emoji: '🇬🇧',
            type: 'embassy', country: 'uk',
            flagColors: [0xc8102e, 0xffffff, 0x012169],
            accent: 0x012169,
            regulator: 'AI Security Institute (AISI) · DSIT',
            framework: 'Pro-innovation principles · Bletchley/Seoul/Paris summit lineage',
            stance: 'Sector-led, principles-based. Still no statutory AI act — the renamed AI Security Institute runs pre-deployment evaluations of frontier models by agreement, with a sharper focus on national-security risk.',
            milestone: 'Jul 2, 2026: the UK and Germany agreed to deepen AI safety cooperation — AISI and German ministries expanding joint frontier-model evaluation and cyber-risk research.',
            labs: ['Google DeepMind', 'Isomorphic Labs', 'Wayve', 'Synthesia', 'ElevenLabs', 'Stability AI'],
            desc: 'United Kingdom. Host of the inaugural AI Safety Summit at Bletchley Park (2023) and home of the world\'s first government AI evaluation body. London anchors DeepMind — the lab with the longest continuous history at the AGI frontier.'
        },
        {
            id: 'embassy_in', name: 'India High Commission', w: 150, fl: 3, emoji: '🇮🇳',
            type: 'embassy', country: 'in',
            flagColors: [0xff9933, 0xffffff, 0x138808],
            accent: 0xff9933,
            regulator: 'MeitY · NITI Aayog',
            framework: 'IndiaAI Mission (₹10,372 crore) · Responsible AI guidelines',
            stance: 'Pro-innovation, non-binding principles. Heavy state subsidy of GPU compute and Indian-language foundation models; positioning as the neutral convener of the global AI-governance conversation.',
            milestone: 'Feb 16–21, 2026: India hosted the AI Impact Summit — 88 countries adopted the non-binding New Delhi Declaration on AI Impact, with $200B+ in AI investment commitments announced.',
            labs: ['Sarvam AI', 'Krutrim', 'Soket AI', 'Yellow.ai', 'CoRover'],
            desc: 'Republic of India. The largest pool of ML engineering talent on earth. National strategy emphasises multilingual capability across 22 official languages, subsidized GPU access, and hosting the next global AI summit.'
        },
        {
            id: 'embassy_ae', name: 'UAE Embassy', w: 150, fl: 3, emoji: '🇦🇪',
            type: 'embassy', country: 'ae',
            flagColors: [0xce1126, 0x00732f, 0xffffff, 0x000000],
            accent: 0x00732f,
            regulator: 'Ministry of AI · UAE Council for AI',
            framework: 'National AI Strategy 2031 · Falcon open-weights · MGX sovereign fund',
            stance: 'Sovereign-wealth-scale compute. G42 aligned with US controls after the Microsoft deal; MGX now co-funds Stargate and writes nation-scale checks into OpenAI and xAI.',
            milestone: '2026: Abu Dhabi\'s MGX is a Stargate co-owner and a check in OpenAI\'s $122B round and xAI\'s Series E — the Gulf as a top-tier AI investor.',
            labs: ['G42', 'TII (Falcon)', 'MBZUAI', 'MGX', 'Core42'],
            desc: 'United Arab Emirates. First country to appoint a Minister of AI (2017). G42 and TII publish the most-downloaded Arabic-language open models, while the MGX fund turns sovereign wealth into frontier-AI equity and the Stargate UAE build.'
        }
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { ...def, x: 0, lab: null };
                BLDS.push(bld);
                if (typeof G !== 'undefined' && G.bldById) G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(afterX) {
        let x = afterX + 50;
        this.zoneStartX = x;
        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) { bld.x = x; x += bld.w + 25; }
        });
        this.zoneEndX = x + 30;
        return this.zoneEndX;
    },

    update() {
        // Gentle flag-wave animation on all embassy buildings.
        const t = (typeof G !== 'undefined' ? G.tick : 0) * 0.05;
        this.BLDS.forEach(def => {
            const bld = (typeof G !== 'undefined' && G.bldById) ? G.bldById[def.id] : null;
            if (!bld || !bld._flagGfx) return;
            const flagIdx = this.BLDS.indexOf(def);
            bld._flagGfx.skew.x = Math.sin(t + flagIdx * 0.8) * 0.18;
        });
    },

    /* ──────────────────────────────────────────────────────────────────────
       drawCountryFlag(g, country, w, h)
       Country-accurate flag rendering into a PIXI.Graphics object. Origin
       (0,0) is the top-left of the flag. Scales cleanly from ~12×8 pole
       flags up to ~64×40 ceremonial flags. Falls back to grey if unknown.

       Implemented countries: us, uk, cn, eu, in, ae. Used by:
         • environment.js  (embassy exterior flying flag)
         • embassy_quarter.js  (residence rooftop pole)
         • interior_embassy.js  (interior pediment + ambassador desk pair)
         • interior_ambassador_res.js  (residence interior accents)
       ────────────────────────────────────────────────────────────────────── */
    drawCountryFlag(g, country, w, h) {
        const c = (country || '').toLowerCase();

        if (c === 'us') {
            // 13 horizontal stripes (7 red, 6 white) + blue canton w/ stars
            const sH = h / 13;
            g.beginFill(0xbf0a30); g.drawRect(0, 0, w, h); g.endFill();
            g.beginFill(0xffffff);
            for (let i = 1; i < 13; i += 2) g.drawRect(0, i * sH, w, sH);
            g.endFill();
            // Blue canton — upper-hoist, ~40% wide × 7 stripes tall
            const cW = w * 0.4, cH = sH * 7;
            g.beginFill(0x002868); g.drawRect(0, 0, cW, cH); g.endFill();
            // Star field (5 rows × 6 cols, alternating offset for dense feel)
            g.beginFill(0xffffff);
            const sCols = 6, sRows = 5;
            const dx = cW / (sCols + 1), dy = cH / (sRows + 1);
            const sR = Math.max(0.35, Math.min(dx, dy) * 0.28);
            for (let r = 0; r < sRows; r++) {
                for (let cc = 0; cc < sCols; cc++) {
                    const offset = (r % 2) * (dx * 0.5);
                    g.drawCircle(dx + cc * dx + offset, dy + r * dy, sR);
                }
            }
            g.endFill();

        } else if (c === 'uk') {
            // Union Jack — blue field, white+red saltire (X), white+red cross (+)
            g.beginFill(0x012169); g.drawRect(0, 0, w, h); g.endFill();
            // White saltire (full diagonals)
            g.lineStyle(Math.max(1.6, h * 0.20), 0xffffff, 1);
            g.moveTo(0, 0); g.lineTo(w, h);
            g.moveTo(w, 0); g.lineTo(0, h);
            // Red saltire on top (thinner)
            g.lineStyle(Math.max(0.8, h * 0.10), 0xc8102e, 1);
            g.moveTo(0, 0); g.lineTo(w, h);
            g.moveTo(w, 0); g.lineTo(0, h);
            g.lineStyle(0);
            // White cross (over the saltire — wider than red cross)
            g.beginFill(0xffffff);
            g.drawRect(0, h * 0.4, w, h * 0.2);
            g.drawRect(w * 0.4, 0, w * 0.2, h);
            g.endFill();
            // Red cross (St George — narrower, on top)
            g.beginFill(0xc8102e);
            g.drawRect(0, h * 0.45, w, h * 0.1);
            g.drawRect(w * 0.45, 0, w * 0.1, h);
            g.endFill();

        } else if (c === 'cn') {
            // Red field + 5 yellow stars (1 large + 4 small arc'd to its right)
            g.beginFill(0xde2910); g.drawRect(0, 0, w, h); g.endFill();
            const drawStar = (sx, sy, sR) => {
                g.beginFill(0xffde00);
                if (g.drawStar) g.drawStar(sx, sy, 5, sR, sR * 0.42);
                else g.drawCircle(sx, sy, sR);
                g.endFill();
            };
            const bigR = Math.max(1.4, h * 0.18);
            drawStar(w * 0.20, h * 0.30, bigR);
            const smR = Math.max(0.6, h * 0.07);
            // 4 small stars arc'd around the big one
            drawStar(w * 0.36, h * 0.13, smR);
            drawStar(w * 0.46, h * 0.28, smR);
            drawStar(w * 0.46, h * 0.46, smR);
            drawStar(w * 0.36, h * 0.62, smR);

        } else if (c === 'eu') {
            // Blue field + 12 gold stars in a circle
            g.beginFill(0x003399); g.drawRect(0, 0, w, h); g.endFill();
            const cx = w / 2, cy = h / 2;
            const rr = Math.min(w, h) * 0.32;
            const sR = Math.max(0.6, h * 0.07);
            g.beginFill(0xffcc00);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
                const sx = cx + Math.cos(a) * rr;
                const sy = cy + Math.sin(a) * rr;
                if (g.drawStar) g.drawStar(sx, sy, 5, sR, sR * 0.42);
                else g.drawCircle(sx, sy, sR);
            }
            g.endFill();

        } else if (c === 'in') {
            // 3 horizontal bands (saffron, white, green) + Ashoka Chakra
            const sH = h / 3;
            g.beginFill(0xff9933); g.drawRect(0, 0, w, sH); g.endFill();
            g.beginFill(0xffffff); g.drawRect(0, sH, w, sH); g.endFill();
            g.beginFill(0x138808); g.drawRect(0, sH * 2, w, sH); g.endFill();
            // Chakra — navy wheel with 8 simplified spokes (24 in real flag, but 8 reads cleaner small)
            const ckCx = w / 2, ckCy = sH * 1.5;
            const ckR = sH * 0.42;
            g.lineStyle(Math.max(0.4, h * 0.025), 0x000080, 1);
            g.drawCircle(ckCx, ckCy, ckR);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                g.moveTo(ckCx, ckCy);
                g.lineTo(ckCx + Math.cos(a) * ckR, ckCy + Math.sin(a) * ckR);
            }
            g.lineStyle(0);
            // Tiny navy hub at center
            g.beginFill(0x000080); g.drawCircle(ckCx, ckCy, Math.max(0.6, ckR * 0.12)); g.endFill();

        } else if (c === 'ae') {
            // Vertical red hoist (1/4 width) + 3 horizontal bands (green/white/black)
            const redW = w * 0.25;
            g.beginFill(0xce1126); g.drawRect(0, 0, redW, h); g.endFill();
            const fW = w - redW;
            const sH = h / 3;
            g.beginFill(0x00732f); g.drawRect(redW, 0, fW, sH); g.endFill();
            g.beginFill(0xffffff); g.drawRect(redW, sH, fW, sH); g.endFill();
            g.beginFill(0x000000); g.drawRect(redW, sH * 2, fW, sH); g.endFill();

        } else {
            g.beginFill(0xcccccc); g.drawRect(0, 0, w, h); g.endFill();
        }

        // Subtle dark border for legibility against bright skies
        g.lineStyle(0.4, 0x000000, 0.4);
        g.drawRect(0, 0, w, h);
        g.lineStyle(0);
    }
};
