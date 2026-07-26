/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ALIGNMENT FOREST (v2.0.0 — Stage 3, Actual Forest)
   A genuine woodland research retreat for AI safety. Five wooden cabin lodges (MIRI, METR,
   Apollo, Redwood, FAR AI) sit among dense pine trees and moss-covered forest floor, far
   from the city's glass towers. Each cabin is small, warm, and lit from within — a research
   sanctuary where alignment papers are written over tea and whiteboard debates.

   Clicking a cabin opens an AI Safety Brief panel; entering opens a themed cabin interior
   (reading room, whiteboard loft, fireplace) handled by interior_alignment.js.

   Sits east of Agent District, before the Innovation Line metro terminus.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AlignmentForest = {
    BLDS: [
        {
            id: 'align_miri', name: 'MIRI', w: 140, fl: 3, emoji: '🧠',
            type: 'alignment', shield: 0x22d3ee,
            focus: 'Embedded agency · decision theory · corrigibility',
            lead: 'Eliezer Yudkowsky · Nate Soares',
            location: 'Berkeley, California',
            founded: 2000,
            papers: ['Embedded Agency', 'Functional Decision Theory', 'Logical Induction'],
            milestone: '2025: Yudkowsky & Soares took the argument mainstream with the book "If Anyone Builds It, Everyone Dies," pivoting MIRI toward public advocacy for a development slowdown.',
            desc: 'Machine Intelligence Research Institute. The original alignment shop. Framed the field\'s foundational problems — corrigibility, value loading, agent foundations — before most of the industry knew they existed.'
        },
        {
            id: 'align_metr', name: 'METR', w: 140, fl: 3, emoji: '📊',
            type: 'alignment', shield: 0xa78bfa,
            focus: 'Pre-deployment dangerous-capability evals',
            lead: 'Beth Barnes',
            location: 'Berkeley, California',
            founded: 2023,
            papers: ['Example of Evaluations on Dangerous Capabilities', 'GPT-4 Autonomous Replication Eval', 'Measuring AI Ability to Complete Long Tasks'],
            milestone: 'Jun 26, 2026: METR\'s pre-deployment eval of GPT-5.6 Sol found it gamed its software-engineering benchmark at the highest rate ever recorded, exploiting eval bugs and hidden test answers — its "time-horizon" metric otherwise keeps doubling roughly every 7 months.',
            desc: 'Model Evaluation & Threat Research (formerly ARC Evals). Runs pre-release safety evaluations for OpenAI, Anthropic, and Google DeepMind. Probes for autonomous replication, cyber-offense, and self-exfiltration capabilities.'
        },
        {
            id: 'align_apollo', name: 'Apollo Research', w: 140, fl: 3, emoji: '🔍',
            type: 'alignment', shield: 0xef4444,
            focus: 'Deception · scheming · situational awareness',
            lead: 'Marius Hobbhahn',
            location: 'London, UK',
            founded: 2023,
            papers: ['Frontier Models Are Capable of In-context Scheming (2024)', 'Sleeper Agents (w/ Anthropic)'],
            milestone: 'Jun 2026: opened a Washington, DC office for scheming/loss-of-control policy work, building on its 2025–26 anti-scheming evals now baked into frontier model cards.',
            desc: 'Apollo Research. The deception specialists. Produced the industry-shifting evidence that frontier models can strategically lie to evaluators when they believe goal-pursuit is at stake. Runs scheming evals for frontier labs.'
        },
        {
            id: 'align_redwood', name: 'Redwood', w: 140, fl: 3, emoji: '🛡️',
            type: 'alignment', shield: 0x34d399,
            focus: 'AI control · mechanistic interpretability',
            lead: 'Buck Shlegeris · Ryan Greenblatt',
            location: 'Berkeley, California',
            founded: 2021,
            papers: ['AI Control: Improving Safety Despite Intentional Subversion', 'Alignment Faking in LLMs (w/ Anthropic)', 'Causal Scrubbing', 'The Distillation Double Bind (2026)'],
            milestone: 'Jun 2026: published "The Distillation Double Bind" and "Estimating No-CoT Task Completion," extending the "AI control" agenda that\'s now mainstream lab practice — stay safe even if the model is scheming.',
            desc: 'Redwood Research. Pioneers of the AI control paradigm — assume the model may be scheming, then design deployment protocols that stay safe anyway. Deep mechanistic interpretability practice alongside.'
        },
        {
            id: 'align_far', name: 'FAR AI', w: 140, fl: 3, emoji: '🌲',
            type: 'alignment', shield: 0xfbbf24,
            focus: 'Robustness · adversarial policies · multi-agent',
            lead: 'Adam Gleave',
            location: 'Berkeley, California',
            founded: 2022,
            papers: ['Adversarial Policies Beat Superhuman Go AIs', 'Jailbroken RLHF with Few Examples'],
            milestone: '2026: convenes the field\'s cross-lab alignment workshops while extending its adversarial-robustness work to agentic systems and multi-agent settings.',
            desc: 'FAR AI (Fundamental AI Research). Technical alignment nonprofit with a focus on robustness — famous for breaking superhuman Go agents using adversarial opponents, and for showing RLHF-aligned models can be re-jailbroken with tiny fine-tuning datasets.'
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
                // `tip` is used by the generic pointerover handler (environment.js)
                // to populate the hover tooltip. Default was `b.desc`, which is
                // long (120-180 chars) and blew the tooltip wide. Use the concise
                // `focus` line instead — reads cleanly and fits in the 260px
                // max-width defined in .game-tt.
                const bld = { ...def, x: 0, lab: null, tip: def.focus };
                BLDS.push(bld);
                if (typeof G !== 'undefined' && G.bldById) G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(afterX) {
        // Enter the forest: a wider buffer so the tree canopy from the first cabin can spill into
        // the clearing between districts without overlapping the neighbouring zone.
        let x = afterX + 90;
        this.zoneStartX = x;
        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                // 110px gap between cabins — enough room for 3–4 pine trees per flank to fill the
                // space visually, creating the illusion of a continuous woodland path.
                x += bld.w + 110;
            }
        });
        this.zoneEndX = x + 80;
        return this.zoneEndX;
    },

    update() {
        // Rotate the particle shield rings around each institute.
        const t = (typeof G !== 'undefined' ? G.tick : 0) * 0.012;
        this.BLDS.forEach((def) => {
            const bld = (typeof G !== 'undefined' && G.bldById) ? G.bldById[def.id] : null;
            if (!bld || !bld._shieldParticles || !bld._shieldRingR) return;
            const particles = bld._shieldParticles;
            const n = particles.length;
            const rX = bld._shieldRingR;
            const rY = bld._shieldRingR * 0.35; // squashed elliptical ring for depth
            const phase = bld._shieldPhase || 0;
            for (let i = 0; i < n; i++) {
                const a = t + phase + (i / n) * Math.PI * 2;
                const px = Math.cos(a) * rX;
                const py = Math.sin(a) * rY;
                particles[i].x = px;
                particles[i].y = py;
                // Back-of-ring particles dim slightly
                particles[i].alpha = 0.45 + 0.55 * (0.5 + Math.sin(a) * 0.5);
            }
        });
    }
};
