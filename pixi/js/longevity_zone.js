/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH WING (v1.0.0 — AI Drug Discovery & Life Extension)
   Calico, Altos Labs, Insilico Medicine, Recursion — genomics, clinical trials, cryonics.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Each company carries real 2026 flavor: drug (lead candidate) / hq / founded /
// program / milestone (latest real headline) / facts[] (panel bullets).
const LONGEVITY_COMPANIES = {
    isomorphic: {
        name: 'Isomorphic Labs', ceo: 'Demis Hassabis', color: '#3b82f6', icon: '🧠',
        hq: 'London, UK', founded: '2021', drug: 'AlphaFold 3 oncology candidates',
        program: 'AI-first drug design on AlphaFold 3',
        milestone: 'May 2026: raised $2.1B Series B — one of the sector\'s largest ever — with first human trials of AI-designed drugs due by end of 2026.',
        facts: [
            'A DeepMind spin-off; AlphaFold 3 predicts protein–DNA–ligand interactions at atomic precision',
            'First trials prioritize oncology; AlphaFold 3 open-sourced Nov 2024',
            'J&J signed a deep-integration deal to design protein–protein inhibitors with AF3'
        ],
        desc: 'DeepMind\'s drug-design spin-off. AlphaFold 3 turned protein structure into a multi-billion-dollar pipeline — first AI-designed drugs hit trials in 2026.'
    },
    retro: {
        name: 'Retro Biosciences', ceo: 'Joe Betts-LaCroix', color: '#a855f7', icon: '⏪',
        hq: 'Redwood City, California', founded: '2021', drug: "Alzheimer's autophagy pill",
        program: 'Add 10 healthy years to human life',
        milestone: 'May 2026: hit a $1.8B valuation after Sam Altman personally put in ~$180M; its first trial — an Alzheimer\'s pill — is "going super good."',
        facts: [
            'OpenAI\'s Sam Altman is the anchor investor in the anti-aging bet',
            'Lead trial clears protein aggregates; no dose-limiting toxicities seen',
            'Autophagy, plasma-inspired therapies and cellular reprogramming'
        ],
        desc: 'Sam Altman\'s longevity bet. Aiming to add ten healthy years to human life — its first Alzheimer\'s pill is already in the clinic.'
    },
    insilico: {
        name: 'Insilico Medicine', ceo: 'Alex Zhavoronkov', color: '#8b5cf6', icon: '💊',
        hq: 'Cambridge, MA / Hong Kong', founded: '2014', drug: 'Rentosertib (ISM001-055)',
        program: 'Generative chemistry via Pharma.AI',
        milestone: 'Jul 7, 2026: rentosertib entered Phase III for pulmonary fibrosis (320 patients, 47 centers in China) — the first drug with an AI-identified target, AI-generated structure, and AI-guided trials to reach pivotal testing.',
        facts: [
            'TNIK inhibitor for idiopathic pulmonary fibrosis (IPF)',
            'Published Phase IIa results in Nature Medicine; an inhaled version cleared IND',
            'Its inhalation solution is the world\'s first AI-driven direct-to-lung candidate',
            'End-to-end: Pharma.AI picks the target AND designs the molecule'
        ],
        desc: 'The generative-chemistry pioneer. Rentosertib became the first AI-designed drug with human proof-of-concept, published in Nature Medicine.'
    },
    recursion: {
        name: 'Recursion', ceo: 'Chris Gibson', color: '#ec4899', icon: '🧫',
        hq: 'Salt Lake City, Utah', founded: '2013', drug: 'REC-1245',
        program: 'Industrialized "techbio" drug discovery',
        milestone: 'Absorbed Exscientia in a $688M all-stock deal — a full-stack AI discovery platform with 10 clinical programs; REC-1245 has Phase I data due H1 2026.',
        facts: [
            'Runs millions of automated cell-image experiments a week',
            'REC-1245 is its first fully end-to-end AI-discovered program',
            'The Recursion + Exscientia merger created a trans-Atlantic AI-pharma leader'
        ],
        desc: 'Drug discovery at industrial scale — computer vision on millions of cell images. Now merged with Exscientia into a full-stack AI-pharma machine.'
    },
    altos: {
        name: 'Altos Labs', ceo: 'Hal Barron', color: '#06b6d4', icon: '🔬',
        hq: 'San Diego / Cambridge / Bay Area', founded: '2021', drug: 'Partial reprogramming therapies',
        program: 'Cellular rejuvenation to reverse biological age',
        milestone: '2026: emerging from stealth — partial reprogramming extended mouse lifespan, and early human safety testing began in 2025.',
        facts: [
            'Launched with a record ~$3B in founding capital',
            'Restored 90-year-olds\' skin cells to youth in a dish',
            'Targeting the kidney, heart and liver — the first organs to fail with age'
        ],
        desc: 'The $3B rejuvenation moonshot. Reprogramming old cells back to a youthful state — reversing biological age, one organ at a time.'
    },
    calico: {
        name: 'Calico Labs', ceo: 'Art Levinson', color: '#22c55e', icon: '🧬',
        hq: 'South San Francisco', founded: '2013', drug: 'Aging-biology pipeline',
        program: 'Treat aging itself as a disease',
        milestone: 'Alphabet\'s secretive longevity lab pairs deep ML with wet-lab biology to decode the fundamental mechanisms of aging.',
        facts: [
            'Founded and chaired by ex-Genentech/Apple chairman Art Levinson',
            'Backed by Alphabet + AbbVie with billions in committed capital',
            'Studies naked mole rats and other species that barely age'
        ],
        desc: 'Alphabet\'s longevity lab. Treats aging as a disease to be understood and slowed, combining machine learning with deep biology.'
    },
    bioage: {
        name: 'BioAge Labs', ceo: 'Kristen Fortney', color: '#f59e0b', icon: '⏳',
        hq: 'Richmond, California', founded: '2015', drug: 'Metabolic aging drugs',
        program: 'Human longevity data → drug targets',
        milestone: 'Mines decades of human aging data to find and drug the pathways that keep people healthy into their 90s.',
        facts: [
            'Human-data-first: starts from people who age well, not mice',
            'Pivoted into metabolic aging and muscle-preservation targets',
            'Publicly traded — a rare listed pure-play longevity biotech'
        ],
        desc: 'Human-data-first longevity. Mines the biology of people who reach 95 in good health to find drugs that extend healthspan.'
    },
    unity: {
        name: 'Unity Biotech', ceo: 'Anirvan Ghosh', color: '#ef4444', icon: '🎯',
        hq: 'South San Francisco', founded: '2011', drug: 'Senolytics (UBX1325)',
        program: 'Clear senescent "zombie" cells',
        milestone: 'Advancing senolytic therapies that selectively destroy the senescent cells driving age-related eye and tissue disease.',
        facts: [
            'Senescent cells accumulate with age and inflame surrounding tissue',
            'Lead candidate targets diabetic macular edema in the eye',
            'A pioneer of the "clear the zombie cells" thesis of aging'
        ],
        desc: 'The senolytics specialist. Hunts and destroys the senescent "zombie" cells that accumulate with age and poison healthy tissue.'
    }
};

const LongevityZone = {
    BLDS: [
        { id: 'longevity_protein',   name: 'AI Protein Foundry',    w: 200, fl: 5, emoji: '🧠', type: 'longevity', desc: 'Where AlphaFold 3 folds proteins in silico. Structure prediction of the entire "interactome" — proteins, DNA, RNA and small molecules — feeding every downstream drug program.' },
        { id: 'longevity_discovery', name: 'Drug Discovery Lab',    w: 220, fl: 5, emoji: '💊', type: 'longevity', desc: 'AI-powered molecular screening. Generative chemistry models design novel drug candidates in silico before wet-lab synthesis.' },
        { id: 'longevity_trials',    name: 'Clinical Trials Center', w: 200, fl: 4, emoji: '🏥', type: 'longevity', desc: 'Phase I-III trial management. Real-time patient monitoring, adaptive trial protocols, and regulatory compliance dashboards.' },
        { id: 'longevity_genomics',  name: 'Genomics Sequencing',   w: 190, fl: 4, emoji: '🧬', type: 'longevity', desc: 'High-throughput sequencing facility. Whole-genome, epigenome, and transcriptome analysis powering personalized medicine.' },
        { id: 'longevity_cryo',      name: 'Cryonics Vault',        w: 160, fl: 3, emoji: '❄️', type: 'longevity', desc: 'Tissue preservation and vitrification research. Maintains biobanks at -196°C for long-term cellular storage.' },
    ],

    NPCS: [
        { id: 'npc_longevity_protein_ai', name: 'Structure AI Lead',     role: 'AlphaFold 3 Ops',       workplace: 'longevity_protein',   color: '#3b82f6', shift: 'day' },
        { id: 'npc_longevity_biophys',    name: 'Biophysicist',          role: 'Protein Modeling',      workplace: 'longevity_protein',   color: '#60a5fa', shift: 'day' },
        { id: 'npc_longevity_chemist',    name: 'Medicinal Chemist',     role: 'Drug Design',           workplace: 'longevity_discovery', color: '#22c55e', shift: 'day' },
        { id: 'npc_longevity_mleng',      name: 'ML Engineer',           role: 'Molecular Modeling',    workplace: 'longevity_discovery', color: '#3b82f6', shift: 'day' },
        { id: 'npc_longevity_synth',      name: 'Synthesis Tech',        role: 'Compound Synthesis',    workplace: 'longevity_discovery', color: '#06b6d4', shift: 'day' },
        { id: 'npc_longevity_trial_mgr',  name: 'Trial Manager',         role: 'Clinical Operations',   workplace: 'longevity_trials',    color: '#ec4899', shift: 'day' },
        { id: 'npc_longevity_biostat',    name: 'Biostatistician',       role: 'Data Analysis',         workplace: 'longevity_trials',    color: '#f59e0b', shift: 'day' },
        { id: 'npc_longevity_genomics',   name: 'Genomics Scientist',    role: 'Sequencing Lead',       workplace: 'longevity_genomics',  color: '#8b5cf6', shift: 'day' },
        { id: 'npc_longevity_bioinfo',    name: 'Bioinformatics Eng',    role: 'Pipeline Dev',          workplace: 'longevity_genomics',  color: '#a855f7', shift: 'day' },
        { id: 'npc_longevity_cryo_tech',  name: 'Cryonics Technician',   role: 'Preservation Ops',      workplace: 'longevity_cryo',      color: '#67e8f9', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Research stats
    compoundsScreened: 0,
    trialsActive: 0,
    genomesSequenced: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 45;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    update() {
        if (!this._inited) return;
        const dp = G.getDayPhase();
        if (dp > 0.30 && dp < 0.80 && G.tick % 90 === 0) {
            this.compoundsScreened += Math.floor(Math.random() * 50) + 10;
        }
        if (G.tick % 300 === 0) {
            this.trialsActive = 3 + Math.floor(Math.random() * 5);
            this.genomesSequenced += Math.floor(Math.random() * 3) + 1;
        }
    },

    getCompany(name) {
        const n = name.toLowerCase();
        for (const [key, co] of Object.entries(LONGEVITY_COMPANIES)) {
            if (n.includes(key) || n.includes(co.name.toLowerCase())) return co;
        }
        return null;
    }
};
