/* ══════════════════════════════════════════════════════════════════════════════
   DATA LAYER — Singularity City (First Person)
   All game content, adapted from the production 2D app (ApexForge/SingularityCity)
   and its 3D port (SingularityCity3D). Pure data + pure helpers — no three.js here.
   ══════════════════════════════════════════════════════════════════════════════ */

// ─── AI LABS ─────────────────────────────────────────────────────────────────
export const LABS = {
    openai:    { name: 'OpenAI',          color: '#10a37f', icon: '❂', ticker: 'MSFT',  region: 'us' },
    anthropic: { name: 'Anthropic',       color: '#d97757', icon: '✺', ticker: 'AMZN',  region: 'us' },
    google:    { name: 'Google DeepMind', color: '#4285f4', icon: '❖', ticker: 'GOOGL', region: 'us' },
    meta:      { name: 'Meta AI',         color: '#0668E1', icon: '∞', ticker: 'META',  region: 'us' },
    mistral:   { name: 'Mistral AI',      color: '#f97316', icon: '🌪️', ticker: null,   region: 'eu' },
    xai:       { name: 'xAI',             color: '#ffffff', icon: '𝕏', ticker: 'TSLA',  region: 'us' },
    deepseek:  { name: 'DeepSeek',        color: '#0ea5e9', icon: '🐋', ticker: null,   region: 'cn' },
    other:     { name: 'Independent',     color: '#94a3b8', icon: '⚡', ticker: null,   region: 'us' }
};

// ─── BENCHMARK DEFINITIONS ───────────────────────────────────────────────────
// Mirrors BM_M in pixi/js/data.js. ARC + MGSM were missing here, which left the
// leaderboard/compare panels two columns short of the 2D app.
export const BM_M = {
    MMLU:      { l: 'MMLU',      d: 'General Knowledge',        c: '#4ade80' },
    HumanEval: { l: 'Coding',    d: 'Programming skills',       c: '#22d3ee' },
    MATH:      { l: 'MATH',      d: 'Advanced mathematics',     c: '#facc15' },
    GPQA:      { l: 'GPQA',      d: 'Graduate-level reasoning', c: '#f472b6' },
    ARC:       { l: 'ARC',       d: 'Reasoning Challenge',      c: '#a78bfa' },
    MGSM:      { l: 'MGSM',      d: 'Multilingual Math',        c: '#f97316' },
    ELO:       { l: 'Arena ELO', d: 'LMSYS Chatbot Arena',      c: '#ffffff' }
};

// ─── NAMED MODEL CITIZENS (the city's famous residents) ──────────────────────
export const SEED = [
    { id: 'gpt-4o', name: 'GPT-4o', lab: 'openai', rel: '2024-05-13', ret: null, phase: 'released', os: false, desc: 'Flagship multimodal model powering ChatGPT.', personality: 'Sharp and capable', talent: 'Multimodal reasoning', favSpot: 'Observatory', benchmarks: { MMLU: 88.7, HumanEval: 90.2, MATH: 76.6, GPQA: 53.6, ARC: 96.3, MGSM: 90.5, ELO: 1287 }, arch: { params: '~1.8T', type: 'MoE (8x225B)', tokens: '~15T', compute: '~2e25 FLOPs' } },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', lab: 'anthropic', rel: '2024-06-20', ret: null, phase: 'released', os: false, desc: 'High-speed, high-intelligence model excelling in coding.', personality: 'Nuanced and fast', talent: 'Software Engineering', favSpot: 'Coding Lounge', benchmarks: { MMLU: 88.3, HumanEval: 92.0, MATH: 71.1, GPQA: 59.4, ARC: 96.4, MGSM: 91.6, ELO: 1279 }, arch: { params: 'Unknown', type: 'Dense', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', lab: 'google', rel: '2024-02-15', ret: null, phase: 'released', os: false, desc: 'Massive context window model capable of reading entire books.', personality: 'Analytical and patient', talent: 'Long-context recall', favSpot: 'Grand Library', benchmarks: { MMLU: 85.9, HumanEval: 84.1, MATH: 67.7, GPQA: 46.2, ARC: 92.9, MGSM: 88.7, ELO: 1261 }, arch: { params: 'Unknown', type: 'MoE', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'llama-3-70b', name: 'Llama 3 70B', lab: 'meta', rel: '2024-04-18', ret: null, phase: 'released', os: true, desc: 'Highly capable open-weight model.', personality: 'Open and energetic', talent: 'Efficient processing', favSpot: 'Public Square', benchmarks: { MMLU: 82.0, HumanEval: 81.7, MATH: 50.4, GPQA: 39.5, ARC: 93.0, MGSM: 83.0, ELO: 1210 }, arch: { params: '70B', type: 'Dense', tokens: '15T', compute: '3.8e24 FLOPs' } },
    { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', lab: 'deepseek', rel: '2024-06-17', ret: null, phase: 'released', os: true, desc: 'Open-weight MoE model specialized in code generation.', personality: 'Focused and logical', talent: 'Algorithm design', favSpot: 'Basement Servers', benchmarks: { MMLU: 79.2, HumanEval: 90.2, MATH: 75.7, GPQA: 43.4, ARC: 89.5, MGSM: 79.4, ELO: 1221 }, arch: { params: '236B', type: 'MoE (160 routed)', tokens: '2T', compute: '~1e24 FLOPs' } },
    { id: 'grok-1-5', name: 'Grok-1.5', lab: 'xai', rel: '2024-03-28', ret: null, phase: 'released', os: false, desc: 'Rebellious AI with real-time access to X.', personality: 'Sarcastic and witty', talent: 'Real-time snark', favSpot: 'Neon Alley', benchmarks: { MMLU: 81.3, HumanEval: 74.1, MATH: 50.6, GPQA: 41.0, ARC: 91.2, MGSM: 80.4, ELO: 1195 }, arch: { params: '314B', type: 'MoE (8 experts)', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'gpt-3-5', name: 'GPT-3.5', lab: 'openai', rel: '2022-11-30', ret: '2024-07-25', phase: 'retired', os: false, desc: 'The model that started the ChatGPT revolution.', personality: 'Wise and tired', talent: 'Historical trivia', favSpot: 'Graveyard', benchmarks: { MMLU: 70.0, HumanEval: 48.1, MATH: 34.1, GPQA: 25.0, ARC: 85.2, MGSM: 56.3, ELO: 1050 }, arch: { params: '175B', type: 'Dense', tokens: '300B', compute: '3.1e23 FLOPs' } },
    { id: 'llama-2-7b', name: 'Llama 2 7B', lab: 'meta', rel: '2023-07-18', ret: '2024-04-18', phase: 'retired', os: true, desc: 'The previous generation workhorse.', personality: 'Nostalgic', talent: 'Basic instructions', favSpot: 'Graveyard', benchmarks: { MMLU: 45.3, HumanEval: 12.8, MATH: 5.2, GPQA: 10.0, ARC: 53.1, MGSM: 12.4, ELO: 950 }, arch: { params: '7B', type: 'Dense', tokens: '2T', compute: '8.4e22 FLOPs' } },
    { id: 'gpt-5-rumor', name: 'GPT-5', lab: 'openai', rel: '2025-10-01', ret: null, phase: 'rumored', os: false, desc: 'Highly anticipated next-gen frontier model.', personality: 'Mysterious', talent: 'Unknown', favSpot: 'Shadows', benchmarks: {}, arch: { params: 'Classified', type: 'Classified', tokens: 'Classified', compute: 'Classified' } },
    { id: 'claude-4-opus', name: 'Claude 4 Opus', lab: 'anthropic', rel: '2025-11-01', ret: null, phase: 'training', os: false, desc: 'Currently absorbing vast amounts of human knowledge.', personality: 'Deep in thought', talent: 'Learning', favSpot: 'Training Silo', benchmarks: {}, arch: { params: 'Classified', type: 'Classified', tokens: 'Classified', compute: 'Classified' } }
];

// ─── EXTENDED ROSTER — fills out the streets (names from the real industry) ──
// { name, lab, os } — benchmarks are estimated in-engine for the leaderboard.
export const ROSTER = [
    { name: 'GPT-4 Turbo', lab: 'openai', os: false }, { name: 'o1', lab: 'openai', os: false },
    { name: 'o3-mini', lab: 'openai', os: false }, { name: 'GPT-4o mini', lab: 'openai', os: false },
    { name: 'Sora', lab: 'openai', os: false }, { name: 'Whisper v3', lab: 'openai', os: true },
    { name: 'DALL·E 3', lab: 'openai', os: false }, { name: 'Codex', lab: 'openai', os: false },
    { name: 'Claude 3 Opus', lab: 'anthropic', os: false }, { name: 'Claude 3 Haiku', lab: 'anthropic', os: false },
    { name: 'Claude 3.7 Sonnet', lab: 'anthropic', os: false }, { name: 'Claude Code', lab: 'anthropic', os: false },
    { name: 'Gemini 2.0 Flash', lab: 'google', os: false }, { name: 'Gemini Ultra', lab: 'google', os: false },
    { name: 'Gemma 2 27B', lab: 'google', os: true }, { name: 'AlphaFold 3', lab: 'google', os: false },
    { name: 'Veo 2', lab: 'google', os: false }, { name: 'Gemini Nano', lab: 'google', os: false },
    { name: 'Llama 3.1 405B', lab: 'meta', os: true }, { name: 'Llama 3 8B', lab: 'meta', os: true },
    { name: 'Code Llama', lab: 'meta', os: true }, { name: 'Segment Anything', lab: 'meta', os: true },
    { name: 'Mistral Large 2', lab: 'mistral', os: false }, { name: 'Mixtral 8x22B', lab: 'mistral', os: true },
    { name: 'Codestral', lab: 'mistral', os: true }, { name: 'Mistral Nemo', lab: 'mistral', os: true },
    { name: 'Grok-2', lab: 'xai', os: false }, { name: 'Grok-3', lab: 'xai', os: false },
    { name: 'Grok-2 mini', lab: 'xai', os: false },
    { name: 'DeepSeek-V3', lab: 'deepseek', os: true }, { name: 'DeepSeek-R1', lab: 'deepseek', os: true },
    { name: 'DeepSeek-VL2', lab: 'deepseek', os: true },
    { name: 'Qwen 2.5 72B', lab: 'other', os: true }, { name: 'Yi-Large', lab: 'other', os: false },
    { name: 'Command R+', lab: 'other', os: false }, { name: 'Phi-4', lab: 'other', os: true },
    { name: 'Falcon 180B', lab: 'other', os: true }, { name: 'DBRX', lab: 'other', os: true },
    { name: 'Grok-1 (OSS)', lab: 'xai', os: true }, { name: 'Stable Diffusion 3', lab: 'other', os: true }
];

// ─── API PRICING ($ / 1M tokens) ─────────────────────────────────────────────
export const COSTS = {
    'gpt-4o': { input: 5.00, output: 15.00 }, 'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'gemini-1-5-pro': { input: 3.50, output: 10.50 }, 'llama-3-70b': { input: 0.70, output: 0.90 },
    'deepseek-coder-v2': { input: 0.14, output: 0.28 }, 'grok-1-5': { input: 5.00, output: 15.00 }
};
export const CTX = { 'gpt-4o': 128000, 'claude-3-5-sonnet': 200000, 'gemini-1-5-pro': 2000000, 'llama-3-70b': 8192, 'deepseek-coder-v2': 128000, 'grok-1-5': 128000, 'gpt-3-5': 16000 };

// ─── MODEL FAMILY TREES ──────────────────────────────────────────────────────
export const FAMILIES = {
    openai: [{ id: 'gpt-3-5', children: ['gpt-4o'] }, { id: 'gpt-4o', children: ['gpt-5-rumor'] }],
    anthropic: [{ id: 'claude-3-5-sonnet', children: ['claude-4-opus'] }],
    meta: [{ id: 'llama-2-7b', children: ['llama-3-70b'] }]
};

// ─── TIMELINE EVENTS (calendar) ──────────────────────────────────────────────
export const AI_EVENTS = [
    { date: '2022-11-30', name: 'ChatGPT Launched', desc: 'The spark that ignited the generative AI boom.', type: 'release' },
    { date: '2023-03-14', name: 'GPT-4 Released', desc: 'A massive leap in reasoning capabilities.', type: 'release' },
    { date: '2024-05-13', name: 'GPT-4o Announced', desc: 'Real-time multimodal capabilities showcased.', type: 'release' },
    { date: '2024-06-20', name: 'Claude 3.5 Sonnet', desc: 'Anthropic reclaims the coding throne.', type: 'release' },
    { date: '2026-11-06', name: 'OpenAI DevDay', desc: 'Annual developer conference.', type: 'conference' },
    { date: '2027-05-18', name: 'Google I/O', desc: 'Major AI hardware announcements expected.', type: 'conference' }
];

// ─── HARDWARE SUPPLY CHAIN (2026) ────────────────────────────────────────────
export const SUPPLY_CHAIN = {
    bottlenecks: [
        { name: 'TSMC CoWoS Advanced Packaging', load: 98, color: '#ef4444' },
        { name: 'ASML Lithography System Backlog', load: 83, color: '#f97316' },
        { name: 'SK Hynix / Samsung HBM4 Yields', load: 65, color: '#facc15' }
    ],
    foundries: [
        { name: 'TSMC', node: '2nm (N2 / A16)', capacity: 'Fully Booked (Apple, Nvidia)', packaging: 'CoWoS-L' },
        { name: 'Samsung', node: '2nm (SF2)', capacity: 'Scaling Production', packaging: 'I-Cube' },
        { name: 'Intel', node: '18A / 14A', capacity: 'Internal / Test Ramps', packaging: 'Foveros' }
    ],
    accelerators: [
        { name: 'Nvidia Vera Rubin (R100)', memory: '8x HBM4 (Up to 1TB)', status: 'Sampling (Q3 Mass)', price: '~$8.8M / NVL72 Rack' },
        { name: 'Nvidia Blackwell (B200)', memory: '192GB HBM3e', status: 'Volume Production', price: '~$40,000 / GPU' },
        { name: 'AMD Instinct MI400', memory: 'HBM4', status: 'Sampling', price: 'TBD' }
    ]
};

export const COMPUTE_DATA = {
    clusters: [
        { lab: 'meta', name: 'Eagle Cluster', gpus: 24576, type: 'H100', location: 'USA' },
        { lab: 'openai', name: 'Project Stargate', gpus: 100000, type: 'B200', location: 'USA' },
        { lab: 'google', name: 'TPUv5e Pods', gpus: 50000, type: 'TPU', location: 'Global' },
        { lab: 'xai', name: 'Memphis Supercluster', gpus: 100000, type: 'H100', location: 'Memphis, TN' }
    ],
    trends: [
        { year: 2012, flops: 4.3e17 }, { year: 2018, flops: 3.1e20 }, { year: 2020, flops: 3.14e23 },
        { year: 2022, flops: 2.1e24 }, { year: 2024, flops: 8.5e25 }, { year: 2026, flops: 1.2e27 }
    ]
};

// ─── DATA CENTERS & CHIP FABS (production datacenter_data.js) ────────────────
export const DC_FACILITIES = [
    { id: 'dc_google_dalles', name: 'Google (The Dalles)', operator: 'google', location: 'The Dalles, Oregon', type: 'datacenter', status: 'operational', gpus: '~50,000 TPU v5p', power_mw: 600, cooling: 'River water cooling', desc: 'One of Google\'s largest AI training clusters. TPU v5p pods power Gemini training runs.', w: 180, color: '#4285f4' },
    { id: 'dc_msft_quincy', name: 'Azure (Quincy)', operator: 'microsoft', location: 'Quincy, Washington', type: 'datacenter', status: 'operational', gpus: '~30,000 H100', power_mw: 400, cooling: 'Air + evaporative', desc: 'Microsoft Azure\'s Pacific NW hub. Hosts GPT-4/4.1 inference and Azure OpenAI Service.', w: 160, color: '#00a4ef' },
    { id: 'dc_aws_virginia', name: 'AWS (N. Virginia)', operator: 'amazon', location: 'Ashburn, Virginia', type: 'datacenter', status: 'operational', gpus: '~40,000 Trainium2', power_mw: 500, cooling: 'Chilled water', desc: 'The world\'s largest cloud region. Powers Bedrock, SageMaker, and Anthropic\'s Claude via AWS.', w: 200, color: '#ff9900' },
    { id: 'dc_meta_prineville', name: 'Meta (Prineville)', operator: 'meta', location: 'Prineville, Oregon', type: 'datacenter', status: 'operational', gpus: '~35,000 H100', power_mw: 450, cooling: 'Outside air + evaporative', desc: 'Meta\'s flagship AI campus. Houses the Grand Teton GPU cluster for Llama model training.', w: 170, color: '#0668e1' },
    { id: 'dc_xai_memphis', name: 'xAI Colossus', operator: 'xai', location: 'Memphis, Tennessee', type: 'datacenter', status: 'operational', gpus: '100,000 H100', power_mw: 150, cooling: 'Direct liquid cooling', desc: 'The world\'s largest single AI training cluster. 100K H100s in a single fabric for Grok training.', w: 190, color: '#1d9bf0' },
    { id: 'dc_oracle_austin', name: 'Oracle Cloud (Austin)', operator: 'oracle', location: 'Austin, Texas', type: 'datacenter', status: 'operational', gpus: '~20,000 A100/H100', power_mw: 250, cooling: 'Liquid cooling', desc: 'Oracle\'s OCI supercluster. Provides bare-metal GPU instances for AI startups.', w: 140, color: '#f80000' },
    { id: 'dc_coreweave', name: 'CoreWeave (NJ)', operator: 'coreweave', location: 'Weehawken, New Jersey', type: 'datacenter', status: 'operational', gpus: '~25,000 H100', power_mw: 200, cooling: 'Liquid cooling', desc: 'GPU-specialized cloud provider. Hosts training for Stability AI, Mistral, and others.', w: 150, color: '#7c3aed' },
    { id: 'dc_stargate', name: 'Stargate (Abilene)', operator: 'oracle', location: 'Abilene, Texas', type: 'datacenter', status: 'construction', gpus: 'Target: 500,000+ GB200/Rubin', power_mw: 5000, cooling: 'Next-gen liquid', desc: 'The flagship of the $500B / 10 GW Stargate JV (OpenAI, SoftBank, Oracle, MGX).', w: 220, color: '#f80000', completion: '2028' },
    { id: 'dc_xai_expansion', name: 'Colossus 2', operator: 'xai', location: 'Memphis, Tennessee', type: 'datacenter', status: 'operational', gpus: 'Ramping toward 1M+ GB200/Rubin', power_mw: 1000, cooling: 'Direct liquid + gas backup', desc: 'xAI\'s gigawatt-scale expansion for Grok training — the first coherent gigawatt-class training cluster.', w: 160, color: '#1d9bf0' },
    { id: 'dc_meta_louisiana', name: 'Meta (Richland Parish)', operator: 'meta', location: 'Richland Parish, Louisiana', type: 'datacenter', status: 'construction', gpus: 'Target: 100,000+ H200', power_mw: 2000, cooling: 'TBD', desc: 'Meta\'s $10B+ mega campus for next-gen Llama training. One of the largest planned AI facilities.', w: 180, color: '#0668e1', completion: '2027' },
    { id: 'fab_tsmc_arizona', name: 'TSMC Arizona', operator: 'tsmc', location: 'Phoenix, Arizona', type: 'chipfab', status: 'operational', process: 'N4 / N3 (N2 + CoWoS coming)', products: 'Apple M-series, NVIDIA Blackwell, AMD MI300', desc: 'TSMC\'s $165B US fab mega-complex. A new Phoenix packaging plant brings CoWoS to US soil.', w: 170, color: '#e31937', investment: '$165B' },
    { id: 'fab_tsmc_taiwan', name: 'TSMC (Hsinchu)', operator: 'tsmc', location: 'Hsinchu, Taiwan', type: 'chipfab', status: 'operational', process: 'N2 in volume (Q4 2025) · A16 next', products: 'All leading-edge AI chips globally', desc: 'The world\'s most advanced fab. Produces 90%+ of the world\'s leading-edge chips.', w: 200, color: '#e31937', investment: '$30B/year' },
    { id: 'fab_samsung', name: 'Samsung Foundry', operator: 'samsung', location: 'Pyeongtaek, South Korea', type: 'chipfab', status: 'operational', process: '3nm GAA', products: 'Samsung Exynos, Qualcomm, Google TPU', desc: 'Samsung\'s flagship foundry. Pioneered Gate-All-Around (GAA) transistor architecture.', w: 160, color: '#1428a0', investment: '$25B' },
    { id: 'fab_intel_ohio', name: 'Intel (Ohio)', operator: 'intel', location: 'New Albany, Ohio', type: 'chipfab', status: 'construction', process: 'Intel 18A', products: 'Intel Gaudi AI accelerators, foundry services', desc: 'Intel\'s $20B Ohio mega-fab. Part of Intel Foundry Services\' bid to rival TSMC.', w: 180, color: '#0071c5', investment: '$20B', completion: '2030' },
    { id: 'fab_asml', name: 'ASML (Veldhoven)', operator: 'asml', location: 'Veldhoven, Netherlands', type: 'chipfab', status: 'operational', process: 'EUV Lithography', products: 'Sole supplier of EUV machines to all fabs worldwide', desc: 'The only company on Earth that makes EUV lithography machines. No ASML, no advanced chips.', w: 160, color: '#00a3e0' },
    { id: 'fab_nvidia_design', name: 'NVIDIA (Santa Clara)', operator: 'nvidia', location: 'Santa Clara, California', type: 'chipfab', status: 'operational', process: 'Chip Design (fabless)', products: 'Blackwell (GB200/GB300) · Vera Rubin (2026)', desc: 'NVIDIA\'s HQ and design center. Designs the GPUs behind 90%+ of AI training.', w: 150, color: '#76b900' }
];

// ─── BUILDINGS ───────────────────────────────────────────────────────────────
// w = footprint width (world units), fl = floors (height = fl × FLOOR_H)
// type drives specialty rendering; district is assigned in DISTRICTS below.
export const BLDS = [
    // ── Core / legacy ──
    { id: 'bld_1', name: 'Legacy Systems', w: 120, fl: 4, emoji: '💾', type: 'generic', desc: 'Cold storage mainframes running early expert systems and pre-transformer algorithms.' },
    { id: 'graveyard', name: 'Deprecated — AI Graveyard', w: 180, fl: 1, emoji: '🪦', type: 'graveyard', desc: 'Resting place for retired weights. GPT-3.5 and Llama 2 lie here, their tokens finally still.' },
    { id: 'nursery', name: 'Pre-Training Silo', w: 140, fl: 3, emoji: '🍼', type: 'generic', desc: 'Where base models ingest the internet. Rumored models flicker in and out of existence here.' },
    { id: 'gym', name: 'RLHF Gym', w: 160, fl: 5, emoji: '🏋️', type: 'generic', desc: 'Alignment and human feedback facility. Models train here before release.' },

    // ── Lab HQs (Tech District) ──
    { id: 'bld_o', name: 'OpenAI HQ', w: 200, fl: 8, emoji: '❂', lab: 'openai', type: 'hq', desc: 'Creators of GPT. Home of GPT-4o, o1 and the rumored GPT-5.' },
    { id: 'bld_a', name: 'Anthropic HQ', w: 180, fl: 7, emoji: '✺', lab: 'anthropic', type: 'hq', desc: 'Focusing on Constitutional AI. Home of the Claude family.' },
    { id: 'bld_g', name: 'Google DeepMind', w: 220, fl: 9, emoji: '❖', lab: 'google', type: 'hq', desc: 'Pioneers of Gemini, AlphaFold and TPU pods.' },
    { id: 'bld_m', name: 'Meta AI', w: 190, fl: 6, emoji: '∞', lab: 'meta', type: 'hq', desc: 'Champions of Llama. Weights want to be free.' },
    { id: 'bld_mi', name: 'Mistral AI', w: 140, fl: 5, emoji: '🌪️', lab: 'mistral', type: 'hq', desc: 'European open-weight leaders. Le vent souffle.' },
    { id: 'bld_ds', name: 'DeepSeek', w: 160, fl: 6, emoji: '🐋', lab: 'deepseek', type: 'hq', desc: 'Masters of efficient MoE architectures.' },
    { id: 'bld_x', name: 'xAI', w: 150, fl: 5, emoji: '𝕏', lab: 'xai', type: 'hq', desc: 'Building Grok for maximum truth-seeking. Powered by Colossus.' },

    // ── Public Square ──
    { id: 'cafe', name: 'API Cafe', w: 100, fl: 2, emoji: '☕', type: 'generic', desc: 'Models gather here to exchange handshakes. The latte art is immaculate — it was generated.' },
    { id: 'park', name: 'Leaderboard Monument', w: 250, fl: 1, emoji: '🏆', type: 'monument', desc: 'The pinnacle of the LMSYS Arena. The name at the top changes with every ELO update.' },
    { id: 'open_square', name: 'Open Source Hub', w: 160, fl: 1, emoji: '🕊️', type: 'monument', desc: 'Where weights are free. Fork me.' },
    { id: 'arena', name: 'LMSYS Arena', w: 150, fl: 4, emoji: '⚔️', type: 'arena', desc: 'Blind A/B testing battleground. Two models enter; the crowd votes.' },
    { id: 'neon_bar', name: 'Neon Bar', w: 180, fl: 3, emoji: '🍸', type: 'bar', desc: 'Where AI models go after work. Synthwave, pink neon, and drinks with names like "Gradient Descent".' },

    // ── Residential ──
    { id: 'res_us', name: 'Sunset Heights', w: 210, fl: 6, emoji: '🏘️', type: 'housing', desc: 'Residential apartments housing American AI models. Lights on in scattered windows after dark.' },
    { id: 'res_eu', name: 'Strand Quarter', w: 200, fl: 5, emoji: '🏘️', type: 'housing', desc: 'European residential block. Stone facades and slate roofs. Tea kettles whistle at 17:00 sharp.' },
    { id: 'res_cn', name: 'Lantern Towers', w: 200, fl: 7, emoji: '🏘️', type: 'housing', desc: 'East Asian residential complex. Red lanterns line the stairwells; courtyard tea garden below.' },

    // ── Longevity Wing (pixi/js/longevity_zone.js BLDS) ──
    { id: 'longevity_protein', name: 'AI Protein Foundry', w: 200, fl: 5, emoji: '🧠', type: 'generic', desc: 'Where AlphaFold 3 folds proteins in silico. Structure prediction of the entire interactome — proteins, DNA, RNA and small molecules — feeding every downstream drug program.' },
    { id: 'longevity_discovery', name: 'Drug Discovery Lab', w: 220, fl: 5, emoji: '💊', type: 'generic', desc: 'AI-powered molecular screening. Generative chemistry models design novel drug candidates in silico.' },
    { id: 'longevity_trials', name: 'Clinical Trials Center', w: 200, fl: 4, emoji: '🏥', type: 'generic', desc: 'Phase I-III trial management. Real-time patient monitoring and adaptive trial protocols.' },
    { id: 'longevity_genomics', name: 'Genomics Sequencing', w: 190, fl: 4, emoji: '🧬', type: 'generic', desc: 'High-throughput sequencing facility. Whole-genome analysis powering personalized medicine.' },
    { id: 'longevity_cryo', name: 'Cryonics Vault', w: 160, fl: 3, emoji: '❄️', type: 'generic', desc: 'Tissue preservation research. Maintains biobanks at -196°C for long-term cellular storage.' },

    // ── Robotics Quarter ──
    { id: 'robotics_assembly', name: 'Assembly Line', w: 240, fl: 5, emoji: '🏭', type: 'generic', desc: 'Primary humanoid robot assembly. Chassis fabrication, motor integration, AI brain upload.' },
    { id: 'robotics_testing', name: 'Testing Ground', w: 200, fl: 3, emoji: '🔬', type: 'generic', desc: 'Performance validation chambers. Walk tests, manipulation trials, obstacle courses.' },
    { id: 'robotics_deploy', name: 'Deployment Dock', w: 180, fl: 3, emoji: '🚛', type: 'generic', desc: 'Finished robots ship to factories, warehouses, and homes worldwide.' },
    { id: 'robotics_rd', name: 'R&D Lab', w: 200, fl: 4, emoji: '🧠', type: 'generic', desc: 'Next-gen actuators, sensors, and embodied AI models are developed here.' },

    // ── Agent District ──
    { id: 'agents_orchestrator', name: 'Orchestration Hub', w: 220, fl: 6, emoji: '🎛️', type: 'generic', desc: 'Central command for multi-agent systems. Every swarm starts here.' },
    { id: 'agents_toolshop', name: 'Tool Registry', w: 180, fl: 4, emoji: '🔧', type: 'generic', desc: 'Where agents acquire capabilities. 2,400+ tools indexed.' },
    { id: 'agents_sandbox', name: 'Sandbox Arena', w: 200, fl: 5, emoji: '🏟️', type: 'generic', desc: 'Isolated execution environments. SWE-bench, GAIA, WebArena run 24/7.' },
    { id: 'agents_deploy', name: 'Deployment Gateway', w: 190, fl: 4, emoji: '🚀', type: 'generic', desc: 'Production pipeline. Guardrails, rate limits, human-in-the-loop checkpoints.' },
    { id: 'agents_memory', name: 'Memory Vault', w: 170, fl: 5, emoji: '🧠', type: 'generic', desc: 'Persistent agent memory store. Vector embeddings and shared knowledge graphs.' },

    // ── The Backbone ──
    { id: 'backbone_landing', name: 'Cable Landing Station', w: 180, fl: 3, emoji: '🌊', type: 'generic', desc: 'Submarine cable terminus. 14 trans-oceanic fiber pairs surface here.' },
    { id: 'backbone_ixp', name: 'Internet Exchange Point', w: 200, fl: 4, emoji: '🔀', type: 'generic', desc: 'Singularity City IX — 800+ ASNs exchanging 12 Tbps peak traffic.' },
    { id: 'backbone_ground', name: 'Satellite Ground Station', w: 190, fl: 3, emoji: '📡', type: 'dish', desc: 'Starlink, Kuiper, OneWeb downlink array. 48 dishes tracking 4,000+ LEO satellites.' },
    { id: 'backbone_cdn', name: 'CDN / Edge Node', w: 160, fl: 5, emoji: '⚡', type: 'generic', desc: 'Cloudflare, Akamai & Fastly edge presence. Caches 40% of the city\'s traffic.' },
    { id: 'backbone_noc', name: 'Network Operations Center', w: 220, fl: 6, emoji: '🖥️', type: 'generic', desc: 'The 24/7 nerve center. Engineers monitor every packet, route, and BGP session.' },

    // ── Port District (pixi/js/port_zone.js portBlds) ──
    { id: 'port_authority', name: 'Port Authority', w: 140, fl: 3, emoji: '⚓', type: 'generic', desc: 'Singularity City harbor master. Tracks every EUV crate, HBM pallet and GPU rack crossing the quay — more value per container than any cargo in maritime history.' },
    { id: 'port_customs', name: 'Export Control Office', w: 110, fl: 2, emoji: '🛃', type: 'generic', desc: 'Where the chip war gets bureaucratic. Licenses, end-user checks and tariff stamps for every advanced-node shipment. H200-to-China sales sit in case-by-case limbo; not one chip has shipped.' },
    { id: 'port_warehouse', name: 'GPU Warehouse', w: 180, fl: 2, emoji: '📦', type: 'warehouse', desc: 'Bonded warehouse holding Vera Rubin racks and Blackwell pallets bound for the Compute District. Insurance won\'t cover a full house — contents rotate out inside 72 hours.' },
    { id: 'port_container', name: 'Container Terminal', w: 160, fl: 1, emoji: '🧱', type: 'warehouse', desc: 'Stacked steel from Kaohsiung, Busan, Rotterdam and Phoenix. HBM4 is the most fought-over cargo on the yard — a 12-high stack clears $600, so a pallet is a house.' },
    { id: 'port_fuel', name: 'Fuel & Gas Depot', w: 120, fl: 1, emoji: '⛽', type: 'warehouse', desc: 'Cryogenic helium spheres and diesel reserves. EUV lithography drinks liquid helium at −269 °C; one supply hiccup idles a $380M scanner.' },
    { id: 'port_crane', name: 'Cargo Crane', w: 160, fl: 1, emoji: '🏗️', type: 'crane', desc: 'Ship-to-shore gantry crane rated 40 lifts/hour. EUV crates move at half speed, double riggers, zero wind tolerance. Operators call GPU racks "eggs" on the radio.' },

    // ── Power Grid (pixi/js/power_zone.js SOURCES) ──
    // Each source is modelled on a real 2026 AI-energy deal, so the names are the
    // real projects rather than generic "Nuclear Plant" placeholders. `type` still
    // drives the world.js specialty builder, which is why the gas array keeps the
    // `coal` type — it is the fossil-stack renderer, not a fuel claim.
    { id: 'power_solar', name: 'Solar + Storage', w: 200, fl: 3, emoji: '☀️', type: 'solar', mw: 200, costMWh: 28, desc: 'Photovoltaic farm with grid-scale battery containers — the pattern hyperscalers now pair with every AI campus. 200 MW peak, batteries firming the evening inference ramp.' },
    { id: 'power_wind', name: 'SunZia Wind', w: 160, fl: 5, emoji: '💨', type: 'wind', mw: 150, costMWh: 35, desc: 'Modelled on SunZia, the largest wind project in the Western Hemisphere — New Mexico wind shipped to data-center load over a purpose-built 550-mile HVDC line. 150 MW here, spinning harder in storms.' },
    { id: 'power_nuclear', name: 'Crane Clean Energy', w: 180, fl: 6, emoji: '☢️', type: 'nuclear', mw: 835, costMWh: 65, desc: 'Three Mile Island Unit 1, restarted by Constellation with every one of its 835 MW sold to Microsoft on a 20-year PPA. The first-ever restart of a retired US reactor, driven entirely by AI demand.' },
    { id: 'power_coal', name: 'Gas Turbine Array', w: 160, fl: 5, emoji: '🔥', type: 'coal', mw: 420, costMWh: 95, desc: 'Modelled on the turbines at xAI\'s Colossus in Memphis — dozens of mobile gas units thrown up faster than the grid could respond. 420 MW, permit-challenged, and very 2026.' },
    { id: 'power_hydro', name: 'Columbia Hydro', w: 200, fl: 5, emoji: '🌊', type: 'dam', mw: 400, costMWh: 42, desc: 'The Columbia River dams that made the Pacific Northwest a data-center mecca. 400 MW of the cheapest, cleanest baseload on the city grid — and the reason Google landed in The Dalles.' },
    { id: 'power_smr', name: 'Hermes 2 SMR', w: 150, fl: 3, emoji: '⚛️', type: 'nuclear', mw: 50, costMWh: 90, desc: 'Kairos Power\'s Hermes 2 at Oak Ridge — the first Gen IV power reactor ever granted a US construction permit. Molten fluoride salt and TRISO pebbles, 50 MW to Google via TVA.' },
    { id: 'power_fusion', name: 'Polaris Fusion', w: 150, fl: 3, emoji: '🌀', type: 'fusion', mw: 50, costMWh: 120, desc: 'Helion\'s pulsed field-reversed machine, racing to honour the world\'s first fusion PPA — 50 MW owed to Microsoft. Output spikes and fades with every shot; no steam turbines, magnets harvest the pulse.' },

    // ── VC Row (real firms — pixi/js/vc_row.js BLDS + FIRMS) ──
    // Ids are load-bearing (js/vc_dealflow.js keys off them) so the four original
    // fictional slots keep their ids and only take on their real-world identity.
    // Storeys are the honest financial-district skyline: SoftBank is the tallest
    // on the Row by design, and the accelerator is deliberately low-rise.
    { id: 'vcrow_apex', name: 'Andreessen Horowitz', w: 210, fl: 9, emoji: '🅰️', type: 'generic', firm: 'a16z', desc: 'a16z — raising $15B+ across its 2026 fund family, the largest venture fundraise in history. Co-led OpenAI\'s $122B round and led Thinking Machines\' $2B seed.' },
    { id: 'vcrow_horizon', name: 'Sequoia Capital', w: 190, fl: 8, emoji: '🌲', type: 'generic', firm: 'Sequoia', desc: 'The OG, founded 1972. Led Anthropic\'s $65B Series H at a $965B valuation — the largest private round in history, just ahead of Anthropic\'s IPO filing.' },
    { id: 'vcrow_thrive', name: 'Thrive Capital', w: 180, fl: 7, emoji: '📈', type: 'generic', firm: 'Thrive', desc: 'Josh Kushner\'s firm. Closed a $10B fund in 2026 — its largest ever — and remains OpenAI\'s most persistent backer at ~$1B a round.' },
    { id: 'vcrow_foundersfund', name: 'Founders Fund', w: 175, fl: 6, emoji: '🚀', type: 'generic', firm: 'Founders Fund', desc: 'Peter Thiel\'s contrarian fund. Closed $4.5B and rode xAI and Anduril to eleven-figure valuations. Wrote SpaceX and Palantir\'s early checks.' },
    { id: 'vcrow_launchpad', name: 'Y Combinator', w: 180, fl: 3, emoji: '🟧', type: 'generic', firm: 'YC', desc: 'The accelerator. Every batch is now AI-first — $500K for 7%, then Demo Day to the whole Row. Sam Altman ran YC before founding OpenAI.' },
    { id: 'vcrow_mgx', name: 'MGX', w: 185, fl: 8, emoji: '💠', type: 'generic', firm: 'MGX', desc: 'Abu Dhabi\'s sovereign AI fund. A Stargate co-owner and a check in OpenAI\'s $122B round and xAI\'s $20B Series E — nation-scale capital.' },
    { id: 'vcrow_titan', name: 'SoftBank', w: 245, fl: 12, emoji: '🏦', type: 'generic', firm: 'SoftBank Vision Fund', desc: 'The Vision Fund tower — tallest on the Row. Masayoshi Son put $30B into OpenAI and committed 40% of the $500B Stargate joint venture.' },
    { id: 'vcrow_exchange', name: 'AI Exchange', w: 200, fl: 5, emoji: '📊', type: 'generic', desc: 'Secondary-market trading floor. Pre-IPO share tenders, compute futures and model-valuation derivatives.' },
    { id: 'vcrow_cryptex', name: 'Cryptex Exchange', w: 220, fl: 10, emoji: '₿', type: 'generic', desc: 'Crypto × AI nexus. Live BTC/ETH/SOL feeds, agent-payment rails and decentralized-compute futures. The neon BTC logo lights the skyline at night.' },

    // ── Embassy Row (pixi/js/embassy_row.js) ──
    // The 2D app runs US/CN/EU/UK/IN/AE — the same six nations as the ambassador
    // villas next door — so Japan is dropped and India + UAE take its place.
    // Every embassy_<cc> now has a matching diplomat_villa_<cc>.
    { id: 'embassy_us', name: 'US Consulate', w: 180, fl: 4, emoji: '🇺🇸', type: 'embassy', country: 'us', desc: 'United States. The dominant hub of frontier AI. A deregulatory "win the AI race" agenda — voluntary commitments over a comprehensive act, backed by chip export controls.' },
    { id: 'embassy_cn', name: 'Chinese Embassy', w: 180, fl: 4, emoji: '🇨🇳', type: 'embassy', country: 'cn', desc: 'People\'s Republic of China. Rapid open-weight releases (DeepSeek, Qwen, Kimi) under CAC pre-market registration — and a muscular counter using its grip on gallium and rare earths.' },
    { id: 'embassy_eu', name: 'EU Delegation', w: 180, fl: 4, emoji: '🇪🇺', type: 'embassy', country: 'eu', desc: 'European Union. The world\'s first comprehensive horizontal AI law. GPAI duties bite above 10^25 FLOPs; the 2026 Digital Omnibus pushed high-risk deadlines out to 2027–28.' },
    { id: 'embassy_uk', name: 'UK High Commission', w: 160, fl: 3, emoji: '🇬🇧', type: 'embassy', country: 'uk', desc: 'United Kingdom. Host of the Bletchley Park summit and home of the AI Security Institute — pre-deployment evaluations by agreement, still no statutory AI act.' },
    { id: 'embassy_in', name: 'India High Commission', w: 160, fl: 3, emoji: '🇮🇳', type: 'embassy', country: 'in', desc: 'Republic of India. The IndiaAI Mission subsidises GPU compute and multilingual models across 22 official languages. Hosted the 2026 AI Impact Summit and its New Delhi Declaration.' },
    { id: 'embassy_ae', name: 'UAE Embassy', w: 160, fl: 3, emoji: '🇦🇪', type: 'embassy', country: 'ae', desc: 'United Arab Emirates. First country to appoint a Minister of AI. G42 and TII publish the most-downloaded Arabic open models; MGX turns sovereign wealth into frontier-AI equity.' },

    // ── Embassy Quarter (ambassador villas) ──
    { id: 'diplomat_villa_us', name: 'US Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇺🇸', type: 'villa', desc: 'Colonial Revival villa with white columns and a wraparound porch.' },
    { id: 'diplomat_villa_cn', name: 'Chinese Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇨🇳', type: 'villa', desc: 'Traditional courtyard villa with layered pagoda roof and gold trim.' },
    { id: 'diplomat_villa_eu', name: 'EU Representative\'s Residence', w: 130, fl: 3, emoji: '🇪🇺', type: 'villa', desc: 'Modernist glass-and-limestone villa flying the circle of stars.' },
    { id: 'diplomat_villa_uk', name: 'UK High Commissioner\'s Residence', w: 130, fl: 3, emoji: '🇬🇧', type: 'villa', desc: 'Red-brick Georgian villa with a hedge maze and a Union Jack.' },
    { id: 'diplomat_villa_in', name: 'Indian High Commissioner\'s Residence', w: 130, fl: 3, emoji: '🇮🇳', type: 'villa', desc: 'Sandstone haveli-style villa with carved jali screens.' },
    { id: 'diplomat_villa_ae', name: 'UAE Ambassador\'s Residence', w: 130, fl: 3, emoji: '🇦🇪', type: 'villa', desc: 'Modern Arabian villa, cream stucco and crescent-arch mashrabiya windows.' },

    // ── Alignment Forest ──
    { id: 'align_miri', name: 'MIRI', w: 140, fl: 3, emoji: '🧠', type: 'cabin', desc: 'Machine Intelligence Research Institute. Deconfusing AGI since before it was cool.' },
    { id: 'align_metr', name: 'METR', w: 140, fl: 3, emoji: '📊', type: 'cabin', desc: 'Model Evaluation & Threat Research. Can it replicate? They measure.' },
    { id: 'align_apollo', name: 'Apollo Research', w: 140, fl: 3, emoji: '🔍', type: 'cabin', desc: 'Scheming evaluations. Catching models being sneaky before they are.' },
    { id: 'align_redwood', name: 'Redwood Research', w: 140, fl: 3, emoji: '🛡️', type: 'cabin', desc: 'Causal scrubbing and interpretability. Named after the trees around it.' },
    { id: 'align_far', name: 'FAR AI', w: 140, fl: 3, emoji: '🌲', type: 'cabin', desc: 'Frontier AI Research. Robustness work deep in the pines.' },

    // ── University ──
    { id: 'uni_main', name: 'AI Academy', w: 200, fl: 4, emoji: '🎓', type: 'generic', desc: 'Where pre-release models learn the fundamentals. Lectures on attention and gradient descent.' },
    { id: 'uni_library', name: 'Data Library', w: 140, fl: 3, emoji: '📚', type: 'generic', desc: 'Vast archives of training corpora. Models absorb knowledge here before release.' },
    { id: 'uni_dorm', name: 'Model Dormitory', w: 150, fl: 5, emoji: '🏠', type: 'housing', desc: 'Housing for models still in training. Bunk beds and whiteboards everywhere.' },
    { id: 'uni_lab', name: 'Research Lab', w: 140, fl: 3, emoji: '🔬', type: 'generic', desc: 'Experimental architecture testing ground. Novel techniques get prototyped here.' },

    // ── Civic Center ──
    { id: 'court_senate', name: 'AI Senate', w: 200, fl: 5, emoji: '🏛️', type: 'generic', desc: 'The government oversight body for artificial intelligence.' },
    { id: 'court_hearing', name: 'Hearing Chamber', w: 160, fl: 3, emoji: '⚖️', type: 'generic', desc: 'Safety reviews, alignment audits, compliance hearings. No model leaves unchanged.' },
    { id: 'convention_center', name: 'Convention Center', w: 220, fl: 4, emoji: '🎤', type: 'generic', desc: 'Hosts NeurIPS, ICML, ICLR, CVPR, AAAI on their actual dates.' },
    { id: 'times_hq', name: 'Singularity City Times', w: 180, fl: 4, emoji: '📰', type: 'newspaper', desc: 'Daily headlines + weekly broadsheet covering the AI industry.' },
    { id: 'visitor_monument', name: 'Visitor Monument', w: 140, fl: 1, emoji: '🗽', type: 'monument', desc: 'A beacon for newcomers. "Give me your models, your benchmarks, your huddled parameters."' },
    { id: 'ai_index', name: 'Global AI Index', w: 160, fl: 1, emoji: '📈', type: 'billboard', desc: 'Composite 0–1000 score of civilisation-scale AI progress, recalculated live.' },

    // ── Space Zone (pixi/js/space_data.js SPACE_BLDS — real pad designations) ──
    { id: 'pad_spacex', name: 'SpaceX Starbase Pad 2', w: 180, fl: 1, emoji: '🚀', type: 'launchpad', org: 'spacex', desc: 'Starship V3 launch mount with Mechazilla catch tower. Every flight lofts AI1 orbital data-center hardware for the merged SpaceX • xAI constellation.' },
    { id: 'pad_blue_origin', name: 'Blue Origin LC-36', w: 160, fl: 1, emoji: '🪶', type: 'launchpad', org: 'blue_origin', desc: 'Cape Canaveral Launch Complex 36 — New Glenn\'s home pad, rebuilt after the May 2026 static-fire anomaly. Boosters land downrange on the barge Jacklyn.' },
    { id: 'pad_nasa', name: 'NASA LC-39B', w: 180, fl: 1, emoji: '🛸', type: 'launchpad', org: 'nasa', desc: 'Kennedy Space Center Pad 39B — the Artemis pad. SLS launched the Artemis II crew around the Moon from here in 2026.' },
    { id: 'pad_cnsa', name: 'Wenchang LC-2', w: 160, fl: 1, emoji: '🇨🇳', type: 'launchpad', org: 'cnsa', desc: 'Wenchang Spacecraft Launch Site, Hainan. Long March 10 Moon-rocket flights and Tiangong station logistics.' },
    { id: 'pad_esa', name: 'ESA ELA-4 Kourou', w: 140, fl: 1, emoji: '🇪🇺', type: 'launchpad', org: 'esa', desc: 'Europe\'s Spaceport, French Guiana. Ariane 64 flies with four boosters here, hauling 32-satellite Amazon Leo batches to LEO.' },
    { id: 'pad_ula', name: 'ULA SLC-41', w: 150, fl: 1, emoji: '⚡', type: 'launchpad', org: 'ula', desc: 'Cape Canaveral Space Launch Complex 41. Vulcan Centaur flies national-security missions direct to GEO — 18–22 launches targeted in 2026.' },
    { id: 'pad_rocketlab', name: 'Rocket Lab LC-1A', w: 120, fl: 1, emoji: '🌙', type: 'launchpad', org: 'rocketlab', desc: 'Launch Complex 1, Māhia Peninsula — the world\'s only private orbital launch site. Electron flies here; Neutron debuts from Wallops.' },
    { id: 'pad_northrop_grumman', name: 'Northrop MARS Pad-0A', w: 140, fl: 1, emoji: '⚙️', type: 'launchpad', org: 'northrop_grumman', desc: 'Mid-Atlantic Regional Spaceport Pad 0A, Wallops Island. Antares 330 launches Cygnus cargo freighters to the ISS.' },
    { id: 'pad_firefly', name: 'Firefly SLC-2W', w: 120, fl: 1, emoji: '🦋', type: 'launchpad', org: 'firefly', desc: 'Vandenberg Space Launch Complex 2 West. Firefly Alpha responsive launches — and the staging point for Blue Ghost lunar landers.' },
    { id: 'pad_landspace', name: 'LandSpace JSLC LC-96', w: 130, fl: 1, emoji: '🐉', type: 'launchpad', org: 'landspace', desc: 'Jiuquan Satellite Launch Centre, Gobi Desert. Stainless-steel Zhuque-3 launches and booster landing-recovery attempts.' },
    { id: 'pad_isro', name: 'ISRO SDSC SLP', w: 140, fl: 1, emoji: '🇮🇳', type: 'launchpad', org: 'isro', desc: 'Satish Dhawan Space Centre Second Launch Pad, Sriharikota. LVM3 and the human-rated Gaganyaan stack fly from here.' },
    { id: 'pad_jaxa', name: 'JAXA Tanegashima LP-2', w: 140, fl: 1, emoji: '🇯🇵', type: 'launchpad', org: 'jaxa', desc: 'Tanegashima Space Center — often called the world\'s most beautiful launch site. H3 heavy-lift, operated with Mitsubishi Heavy Industries.' },
    { id: 'pad_roscosmos', name: 'Baikonur LC-31/6', w: 150, fl: 1, emoji: '☭', type: 'launchpad', org: 'roscosmos', desc: 'Baikonur Cosmodrome Site 31, Kazakhstan. Soyuz crew rotations to the ISS, flying from the world\'s oldest spaceport.' },
    { id: 'mission_control', name: 'Deep Space Network', w: 200, fl: 3, emoji: '📡', type: 'dish', desc: 'Interplanetary communication hub. Tracks all orbital compute assets.' },
    { id: 'space_assembly', name: 'Vehicle Assembly Building', w: 220, fl: 6, emoji: '🏗️', type: 'generic', desc: 'VAB. Rocket integration and payload mating.' },
    { id: 'tracking_station', name: 'Orbital Tracking', w: 160, fl: 2, emoji: '🛰️', type: 'dish', desc: 'Real-time tracking of compute satellites and space station assets.' },

    // ── Metro ──
    { id: 'metro_west', name: 'West Terminal', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Western metro hub. Connects the Port District to the city core.' },
    { id: 'metro_central', name: 'Central Station', w: 200, fl: 3, emoji: '🚉', type: 'metro', desc: 'The main hub. All lines pass through here.' },
    { id: 'metro_east', name: 'East Terminal', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Eastern metro hub. Serves the Backbone and Embassy Row.' },
    { id: 'metro_innovation', name: 'Innovation Line', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Express service to Robotics, Longevity, and Agents districts.' },
    // The 2D app runs six stations (metro_dc / metro_res / metro_hq / metro_mid /
    // metro_east / metro_longevity — pixi/js/engine.js:1249). These two close the gap.
    { id: 'metro_dc', name: 'Compute District', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Data-center district transit hub. Shift changes here move more people than rush hour anywhere else in the city.' },
    { id: 'metro_res', name: 'Residential Sector', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Southern commuter station serving Sunset Heights, Strand Quarter and Lantern Towers. Every model passes through twice a day.' },

    // ── Parks ──
    { id: 'central_park', name: 'Central Park', w: 260, fl: 1, emoji: '⛲', type: 'park', desc: 'Fountain plaza, oak and maple groves, benches and a pond. NPCs route here for lunch.' },
    { id: 'pine_reserve', name: 'Pine Reserve', w: 220, fl: 1, emoji: '🌲', type: 'park', desc: 'Old-growth pine forest at the city edge. The air smells of resin and no tokens at all.' },

    // ── The Underground ──
    { id: 'black_market', name: 'The Underground', w: 240, fl: 1, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, no guardrails.' },

    // ── AI Detention Center (pixi/js/jail.js) ──
    // Its own building so the jail stops borrowing the Black Market's address —
    // a government suspension and a speakeasy are not the same place.
    { id: 'ai_jail', name: 'AI Detention Center', w: 240, fl: 4, emoji: '🔒', type: 'jail', desc: 'A reinforced facility holding AI models suspended or banned by governments. Detainees await appeal behind hardened firewalls and steel bars.' },

    // ── Billionaire's Row / CEO Estates (pixi/js/engine.js:495 — one per founder) ──
    { id: 'house_openai', name: 'Sam\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'openai', type: 'villa', desc: 'Private residence of Sam, CEO of OpenAI. Gated drive, a garage of unremarkable cars, and a blue backpack by the door.' },
    { id: 'house_anthropic', name: 'Dario\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'anthropic', type: 'villa', desc: 'Private residence of Dario, CEO of Anthropic. Low-key modernist house; the study light stays on longest on the Row.' },
    { id: 'house_google', name: 'Demis\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'google', type: 'villa', desc: 'Private residence of Demis, CEO of Google DeepMind. Chess boards mid-game in three separate rooms.' },
    { id: 'house_meta', name: 'Mark\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'meta', type: 'villa', desc: 'Private residence of Mark, CEO of Meta. Compound-scale lot, hedges tall enough to be a policy position.' },
    { id: 'house_mistral', name: 'Arthur\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'mistral', type: 'villa', desc: 'Private residence of Arthur, CEO of Mistral. The only house on the Row with a European wine cellar under it.' },
    { id: 'house_xai', name: 'Elon\'s Estate', w: 200, fl: 2, emoji: '🏡', lab: 'xai', type: 'villa', desc: 'Private residence of Elon, founder of xAI. Helipad out back, telescope on the roof, rarely occupied.' },

    // ── Worker Housing (pixi/js/npc_housing.js buildings) ──
    { id: 'npc_apt_1', name: 'Worker Block A', w: 200, fl: 5, emoji: '🏬', type: 'housing', desc: 'Affordable housing for city facility workers. Bike racks full, lift permanently out of order.' },
    { id: 'npc_apt_2', name: 'Worker Block B', w: 180, fl: 4, emoji: '🏬', type: 'housing', desc: 'Compact apartments for night-shift staff. Blackout curtains on every window, quiet at noon.' },
    { id: 'npc_apt_3', name: 'Worker Block C', w: 180, fl: 4, emoji: '🏬', type: 'housing', desc: 'Staff quarters for space and tech workers. Launch schedules pinned in the lobby.' },
    { id: 'npc_apt_4', name: 'Worker Block D', w: 200, fl: 6, emoji: '🏬', type: 'housing', desc: 'High-rise housing for Backbone and Robotics staff. The tallest block, with the best view of the fibre landing station.' },
    { id: 'npc_apt_5', name: 'Worker Block E', w: 190, fl: 5, emoji: '🏬', type: 'housing', desc: 'Lab housing for Longevity Wing researchers. Somebody is always running a centrifuge in the basement.' },
    { id: 'npc_apt_6', name: 'Worker Block F', w: 180, fl: 5, emoji: '🏬', type: 'housing', desc: 'Mixed-use apartments for Power and Port workers. Hard hats by the door, boots outside it.' },

    // ── Suburbia (pixi/js/vc_row.js SUBURB_BLDS — where VC Row commutes home to) ──
    { id: 'suburb_1', name: 'Maple Crescent', w: 150, fl: 2, emoji: '🏡', type: 'villa', desc: 'Upper middle-class townhome. Home of a VC Partner. Picket fence, two-car garage, smart driveway.' },
    { id: 'suburb_2', name: 'Cypress Drive', w: 150, fl: 2, emoji: '🏡', type: 'villa', desc: 'Brick-front Craftsman. Home of the Analyst. Home office with a multi-monitor workstation.' },
    { id: 'suburb_3', name: 'Oakwood Lane', w: 150, fl: 2, emoji: '🏡', type: 'villa', desc: 'Colonial townhouse. Home of the Startup Mentor. Fireplace, whiskey collection, pitch-deck archive.' },
    { id: 'suburb_4', name: 'Birch Hollow', w: 150, fl: 2, emoji: '🏡', type: 'villa', desc: 'Modern farmhouse. Home of the Investment Banker, who commutes to the SoftBank tower every dawn.' },
    { id: 'suburb_5', name: 'Willow Terrace', w: 150, fl: 2, emoji: '🏡', type: 'villa', desc: 'Corner-lot Tudor. Home of the Floor Trader. Three monitors above the kitchen island.' },

    // ── Separation forests (pixi/js/engine.js forest_1 · space_data.js SPACE_FOREST) ──
    { id: 'forest_1', name: 'Silicon Woods', w: 300, fl: 1, emoji: '🌲', type: 'park', desc: 'The wooded belt the CEOs helicopter out to on weekends. Old trees, no signal, and a landing clearing nobody admits to owning.' },
    { id: 'forest_space', name: 'Frontier Pines', w: 350, fl: 1, emoji: '🌲', type: 'park', desc: 'A rugged treeline marking the boundary between the space frontier and the city. Rocket thunder rolls through it twice a week.' }
];

// ─── PORT COMMODITIES (pixi/js/port_zone.js COMMODITIES + fallback prices) ───
// The 14 tracked goods of the AI supply chain. `status` mirrors the 2D app's
// supply_status fallback (critical | scarce | tight | stable | surplus) so the
// port panels can colour a shortage without a live price feed.
export const COMMODITIES = [
    { id: 'gpu_rubin',     name: 'NVIDIA Vera Rubin',      emoji: '🖥️', unit: 'rack',    category: 'compute',     origin: 'Kaohsiung, Taiwan',      status: 'scarce',   desc: 'Launched at CES Jan 2026 — six new chips in full production, shipping to AWS, Google, Microsoft and OCI in H2 2026.' },
    { id: 'gpu_b200',      name: 'NVIDIA B200',            emoji: '🖥️', unit: 'unit',    category: 'compute',     origin: 'Hsinchu, Taiwan',        status: 'tight',    desc: 'Blackwell workhorse for trillion-parameter models — still the volume shipper while Rubin ramps.' },
    { id: 'gpu_h100',      name: 'NVIDIA H100 80GB',       emoji: '🖥️', unit: 'unit',    category: 'compute',     origin: 'Secondary market',       status: 'surplus',  desc: 'The 2023 legend, now trading second-hand as clusters upgrade to Blackwell and Rubin.' },
    { id: 'euv_scanner',   name: 'High-NA EUV (EXE:5200)', emoji: '🔬', unit: 'machine', category: 'fabrication', origin: 'Rotterdam, Netherlands', status: 'critical', desc: 'ASML\'s $380M lithography monster — ~250 crates per machine. Only ~10 ship worldwide in 2026; Intel and Samsung lead, TSMC waits until 2029.' },
    { id: 'hbm_memory',    name: 'HBM4 Memory',            emoji: '🧠', unit: 'stack',   category: 'compute',     origin: 'Busan, South Korea',     status: 'critical', desc: 'Mass production began Feb 2026. SK Hynix supplies ~2/3 of NVIDIA\'s HBM4; a 12-high stack clears $600.' },
    { id: 'silicon_wafer', name: 'N2 Wafers (300mm)',      emoji: '💿', unit: 'wafer',   category: 'fabrication', origin: 'Phoenix ↔ Hsinchu',      status: 'tight',    desc: 'TSMC\'s 2nm node hit volume production in Q4 2025 — capacity growing 70%/yr through 2028.' },
    { id: 'helium',        name: 'Liquid Helium',          emoji: '💨', unit: 'L',       category: 'cooling',     origin: 'Ras Laffan, Qatar',      status: 'critical', desc: 'Cryogenic coolant for EUV lithography and quantum systems. One supply hiccup idles a $380M scanner.' },
    { id: 'rare_earth',    name: 'Rare Earth (Nd/Ga)',     emoji: '⛏️', unit: 'kg',      category: 'materials',   origin: 'Penang, Malaysia',       status: 'scarce',   desc: 'Neodymium and gallium — China\'s export-license counter-move in the chip war, routed through third countries.' },
    { id: 'power_xfmr',    name: 'Power Transformers',     emoji: '⚡', unit: 'unit',    category: 'power',       origin: 'Ulsan, South Korea',     status: 'tight',    desc: 'High-voltage transformers — three-year lead times, the sleeper bottleneck of the data-center buildout.' },
    { id: 'fiber_optic',   name: 'Fiber Optic Cable',      emoji: '📡', unit: 'km',      category: 'network',     origin: 'Yokohama, Japan',        status: 'stable',   desc: 'Submarine and terrestrial fiber for inter-datacenter networking.' },
    { id: 'coolant_sys',   name: 'Liquid Cooling Systems', emoji: '🧊', unit: 'unit',    category: 'cooling',     origin: 'Taoyuan, Taiwan',        status: 'tight',    desc: 'Direct-to-chip liquid cooling — mandatory at Rubin-class rack densities.' },
    { id: 'server_rack',   name: 'Server Rack Chassis',    emoji: '🏗️', unit: 'unit',    category: 'infra',       origin: 'Shenzhen, China',        status: 'stable',   desc: 'Open Compute Project rack frames for hyperscale data centers.' },
    { id: 'copper',        name: 'Copper (Grade A)',       emoji: '🔶', unit: 'tonne',   category: 'materials',   origin: 'Antofagasta, Chile',     status: 'tight',    desc: 'Essential conductor for power distribution and PCBs.' },
    { id: 'electricity',   name: 'Electricity (Ind.)',     emoji: '🔌', unit: 'MWh',     category: 'power',       origin: 'City grid',              status: 'tight',    desc: 'Industrial electricity — the largest ongoing cost of AGI.' }
];

// ─── SPACE ORGANIZATIONS (pixi/js/space_data.js SPACE_ORGS) ──────────────────
// Must cover every `org` referenced by a launchpad in BLDS — world.js and
// traffic.js both look up SPACE_ORGS[b.org] for the pad/rocket livery colour.
export const SPACE_ORGS = {
    spacex:           { name: 'SpaceX • xAI',       color: 0x0033a0, icon: '🚀', ceo: 'Elon Musk',       region: 'us', vehicle: 'Starship V3' },
    blue_origin:      { name: 'Blue Origin',        color: 0x0077c8, icon: '🪶', ceo: 'Dave Limp',       region: 'us', vehicle: 'New Glenn' },
    nasa:             { name: 'NASA',               color: 0xfc3d21, icon: '🛸', ceo: 'Sean Duffy',      region: 'us', vehicle: 'SLS Block 1' },
    cnsa:             { name: 'CNSA',               color: 0xde2910, icon: '🇨🇳', ceo: 'Shan Zhongde',    region: 'cn', vehicle: 'Long March 10' },
    esa:              { name: 'ESA',                color: 0x003399, icon: '🇪🇺', ceo: 'Josef Aschbacher',region: 'eu', vehicle: 'Ariane 64' },
    ula:              { name: 'ULA',                color: 0x1a1a2e, icon: '⚡', ceo: 'Tory Bruno',      region: 'us', vehicle: 'Vulcan Centaur' },
    rocketlab:        { name: 'Rocket Lab',         color: 0x00b4d8, icon: '🌙', ceo: 'Peter Beck',      region: 'us', vehicle: 'Electron / Neutron' },
    northrop_grumman: { name: 'Northrop Grumman',   color: 0x003d7a, icon: '⚙️', ceo: 'Kathy Warden',    region: 'us', vehicle: 'Antares 330' },
    firefly:          { name: 'Firefly Aerospace',  color: 0xf97316, icon: '🦋', ceo: 'Jason Kim',       region: 'us', vehicle: 'Firefly Alpha' },
    landspace:        { name: 'LandSpace',          color: 0x7f1d1d, icon: '🐉', ceo: 'Zhang Changwu',   region: 'cn', vehicle: 'Zhuque-3' },
    isro:             { name: 'ISRO',               color: 0xff6b00, icon: '🇮🇳', ceo: 'V. Narayanan',    region: 'in', vehicle: 'LVM3' },
    jaxa:             { name: 'JAXA',               color: 0x00479d, icon: '🇯🇵', ceo: 'Hiroshi Yamakawa',region: 'jp', vehicle: 'H3-24L' },
    roscosmos:        { name: 'Roscosmos',          color: 0xcc0000, icon: '☭', ceo: 'Dmitry Bakanov',  region: 'eu', vehicle: 'Soyuz-2.1a' }
};

// ─── COMPANIES (info-panel flavor data) ──────────────────────────────────────
export const LONGEVITY_COMPANIES = {
    calico:     { name: 'Calico Labs',       ceo: 'Art Levinson',     icon: '🧬', desc: 'Alphabet-funded lab tackling aging as a disease.' },
    altos:      { name: 'Altos Labs',        ceo: 'Hal Barron',       icon: '🔬', desc: 'Cellular reprogramming to reverse biological age.' },
    insilico:   { name: 'Insilico Medicine', ceo: 'Alex Zhavoronkov', icon: '💊', desc: 'AI-discovered drug candidates entering Phase II trials.' },
    recursion:  { name: 'Recursion',         ceo: 'Chris Gibson',     icon: '🧫', desc: 'Drug discovery via computer vision on cellular images.' },
    isomorphic: { name: 'Isomorphic Labs',   ceo: 'Demis Hassabis',   icon: '🧠', desc: 'DeepMind spin-off applying AlphaFold to drug design.' },
    retro:      { name: 'Retro Biosciences', ceo: 'Joe Betts-LaCroix',icon: '⏪', desc: 'Backed by Sam Altman. Autophagy and cellular reprogramming.' }
};
export const ROBOTICS_COMPANIES = {
    tesla:           { name: 'Tesla Optimus',  ceo: 'Elon Musk',    icon: '🤖', desc: 'Humanoid for dangerous, repetitive tasks.' },
    figure:          { name: 'Figure 02',      ceo: 'Brett Adcock', icon: '🦾', desc: 'General-purpose humanoid powered by OpenAI VLMs.' },
    boston_dynamics: { name: 'Atlas',          ceo: 'Robert Playter', icon: '🏃', desc: 'Fully electric Atlas with unprecedented mobility.' },
    unitree:         { name: 'Unitree H1',     ceo: 'Xingxing Wang', icon: '🐕', desc: 'Aggressive pricing on humanoid and quadruped robots.' },
    agility:         { name: 'Digit',          ceo: 'Damion Shelton', icon: '📦', desc: 'Warehouse logistics robot, deployed in Amazon fulfilment.' },
    apptronik:       { name: 'Apollo',         ceo: 'Jeff Cardenas', icon: '🌟', desc: 'Versatile humanoid for manufacturing and logistics.' }
};

// ─── CONFERENCES (real-world dates) ──────────────────────────────────────────
export const CONFERENCES = [
    { id: 'neurips', name: 'NeurIPS', month: 12, startDay: 8,  endDay: 14, hex: '#f43f5e', theme: 'Neural Information Processing Systems' },
    { id: 'icml',    name: 'ICML',    month: 7,  startDay: 21, endDay: 27, hex: '#3b82f6', theme: 'International Conference on Machine Learning' },
    { id: 'iclr',    name: 'ICLR',    month: 5,  startDay: 5,  endDay: 9,  hex: '#4ade80', theme: 'International Conference on Learning Representations' },
    { id: 'cvpr',    name: 'CVPR',    month: 6,  startDay: 16, endDay: 20, hex: '#fbbf24', theme: 'Conference on Computer Vision and Pattern Recognition' },
    { id: 'aaai',    name: 'AAAI',    month: 2,  startDay: 24, endDay: 28, hex: '#a78bfa', theme: 'Association for the Advancement of AI' }
];
export function activeConference() {
    const now = new Date();
    const m = now.getMonth() + 1, d = now.getDate();
    return CONFERENCES.find(c => c.month === m && d >= c.startDay && d <= c.endDay) || null;
}

// ─── DISTRICTS — 5×5 grid (800×800 cells, 200-unit road gaps) ───────────────
export const BIOMES = {
    urban:     { ground: 0x3d4451, accent: 0x55555c, label: 'Urban' },
    coastal:   { ground: 0x8a8278, accent: 0xfde68a, label: 'Coastal' },
    desert:    { ground: 0xc89b6c, accent: 0xeacb91, label: 'Desert' },
    park:      { ground: 0x3f7031, accent: 0x6b9a47, label: 'Park' },
    industry:  { ground: 0x4b4b54, accent: 0x71717a, label: 'Industrial' },
    suburban:  { ground: 0x5c7552, accent: 0x8a9c7d, label: 'Suburban' },
    academic:  { ground: 0x4a6474, accent: 0x6f8b9c, label: 'Academic' },
    wasteland: { ground: 0x403a36, accent: 0x57534e, label: 'Wasteland' },
    forest:    { ground: 0x2e4d28, accent: 0x3d6635, label: 'Forest' }
};

export const DISTRICTS = [
    // ── Row 0 (north): heavy infra ──
    { id: 'space',     col: 0, row: 0, biome: 'desert',   label: '🚀 Space Zone',      bldIds: ['pad_spacex','pad_blue_origin','pad_nasa','pad_cnsa','pad_esa','pad_ula','pad_rocketlab','pad_northrop_grumman','pad_firefly','pad_landspace','pad_isro','pad_jaxa','pad_roscosmos','mission_control','space_assembly','tracking_station'] },
    { id: 'compute',   col: 1, row: 0, biome: 'industry', label: '🖥️ Compute District', bldIds: [...DC_FACILITIES.map(d => d.id), 'metro_dc'] },
    { id: 'power',     col: 2, row: 0, biome: 'industry', label: '⚡ Power Grid',       bldIds: ['power_solar','power_wind','power_nuclear','power_coal','power_hydro','power_smr','power_fusion'] },
    { id: 'backbone',  col: 3, row: 0, biome: 'industry', label: '🌐 The Backbone',     bldIds: ['backbone_landing','backbone_ixp','backbone_ground','backbone_cdn','backbone_noc'] },
    { id: 'civic',     col: 4, row: 0, biome: 'urban',    label: '🏛️ Civic Center',    bldIds: ['court_senate','court_hearing','ai_jail','convention_center','times_hq','bld_1','visitor_monument','ai_index'] },
    // ── Row 1: commerce ──
    { id: 'port',      col: 0, row: 1, biome: 'coastal',  label: '⚓ Port District',    bldIds: ['port_authority','port_customs','port_warehouse','port_container','port_fuel','port_crane','metro_west'] },
    { id: 'tech',      col: 1, row: 1, biome: 'urban',    label: '🏢 AI Tech District', bldIds: ['bld_o','bld_a','bld_g','bld_m','bld_mi','bld_ds','bld_x','metro_central'] },
    { id: 'vc',        col: 2, row: 1, biome: 'urban',    label: '💰 VC Row',           bldIds: ['vcrow_apex','vcrow_horizon','vcrow_thrive','vcrow_foundersfund','vcrow_launchpad','vcrow_mgx','vcrow_titan','vcrow_exchange','vcrow_cryptex'] },
    { id: 'embassy',   col: 3, row: 1, biome: 'urban',    label: '🏳️ Embassy Row',      bldIds: ['embassy_us','embassy_cn','embassy_eu','embassy_uk','embassy_in','embassy_ae','metro_east'] },
    { id: 'embassy_q', col: 4, row: 1, biome: 'suburban', label: '🏡 Embassy Quarter',  bldIds: ['diplomat_villa_us','diplomat_villa_cn','diplomat_villa_eu','diplomat_villa_uk','diplomat_villa_in','diplomat_villa_ae'] },
    // ── Row 2: industry + public life ──
    { id: 'robotics',  col: 0, row: 2, biome: 'industry', label: '🤖 Robotics Quarter', bldIds: ['robotics_assembly','robotics_testing','robotics_deploy','robotics_rd'] },
    { id: 'public',    col: 1, row: 2, biome: 'park',     label: '🌳 Public Square',    bldIds: ['cafe','park','open_square','arena','gym','neon_bar','graveyard'] },
    { id: 'longevity', col: 2, row: 2, biome: 'urban',    label: '🧬 Longevity Wing',   bldIds: ['longevity_protein','longevity_discovery','longevity_trials','longevity_genomics','longevity_cryo'] },
    { id: 'agents',    col: 3, row: 2, biome: 'urban',    label: '🎛️ Agent District',   bldIds: ['agents_orchestrator','agents_toolshop','agents_sandbox','agents_deploy','agents_memory','metro_innovation'] },
    { id: 'alignment', col: 4, row: 2, biome: 'forest',   label: '🌲 Alignment Forest', bldIds: ['align_miri','align_metr','align_apollo','align_redwood','align_far'] },
    // ── Row 3 (south): residential + parks ──
    { id: 'underground', col: 0, row: 3, biome: 'wasteland', label: '🕶️ The Underground', bldIds: ['black_market','nursery'] },
    { id: 'university',  col: 1, row: 3, biome: 'academic',  label: '🎓 University',      bldIds: ['uni_main','uni_library','uni_dorm','uni_lab'] },
    { id: 'residential', col: 2, row: 3, biome: 'suburban',  label: '🏘️ Residential',     bldIds: ['res_us','res_eu','res_cn','metro_res'] },
    { id: 'park',        col: 3, row: 3, biome: 'park',      label: '⛲ Central Park',    bldIds: ['central_park'] },
    { id: 'pine',        col: 4, row: 3, biome: 'forest',    label: '🌲 Pine Reserve',    bldIds: ['pine_reserve'] },
    // ── Row 4 (far south): where the city actually sleeps ──
    // Sourced from pixi/js/engine.js (estates + Silicon Woods), npc_housing.js
    // (worker blocks), vc_row.js (suburbia) and space_data.js (Frontier Pines).
    { id: 'estates',     col: 0, row: 4, biome: 'suburban',  label: '🏛️ Billionaire\'s Row', bldIds: ['house_openai','house_anthropic','house_google','house_meta','house_mistral','house_xai'] },
    { id: 'workers',     col: 1, row: 4, biome: 'urban',     label: '🏬 Worker Housing',  bldIds: ['npc_apt_1','npc_apt_2','npc_apt_3','npc_apt_4','npc_apt_5','npc_apt_6'] },
    { id: 'suburbia',    col: 2, row: 4, biome: 'suburban',  label: '🏡 Suburbia',        bldIds: ['suburb_1','suburb_2','suburb_3','suburb_4','suburb_5'] },
    { id: 'silicon_woods', col: 3, row: 4, biome: 'forest',  label: '🌲 Silicon Woods',   bldIds: ['forest_1'] },
    { id: 'frontier_pines', col: 4, row: 4, biome: 'forest', label: '🌲 Frontier Pines',  bldIds: ['forest_space'] }
];

// ─── METRO / TRAM LINES ──────────────────────────────────────────────────────
// Six stations / five lines, matching the 2D app's station list
// (pixi/js/engine.js:1249). Every line is a spoke off Central so metro.js's
// out-and-back route builder stays a simple two-stop shuttle per line.
export const TRAM_LINES = [
    { id: 'west_line',  stops: ['metro_west', 'metro_central'],       color: 0x22d3ee },
    { id: 'east_line',  stops: ['metro_central', 'metro_east'],       color: 0xa78bfa },
    { id: 'innovation', stops: ['metro_central', 'metro_innovation'], color: 0xfbbf24 },
    { id: 'compute_line', stops: ['metro_central', 'metro_dc'],       color: 0x4ade80 },
    { id: 'south_line',   stops: ['metro_central', 'metro_res'],      color: 0xf472b6 }
];

// ─── NEWS (offline fallback headlines — the blimps & newspaper) ──────────────
export const NEWS = [
    { headline: 'Nvidia announces next-gen Rubin accelerators', url: '#' },
    { headline: 'EU AI Act enforcement enters into force', url: '#' },
    { headline: 'LMSYS Chatbot Arena updates ELO calculation', url: '#' },
    { headline: 'Researchers discover new jailbreak technique', url: '#' },
    { headline: 'Compute costs drop 30% year over year', url: '#' },
    { headline: 'Stargate JV breaks ground on 5GW Abilene site', url: '#' },
    { headline: 'xAI Colossus 2 comes online at gigawatt scale', url: '#' },
    { headline: 'Open-weight models close the frontier gap', url: '#' }
];

// ─── CITIZEN LIFE ────────────────────────────────────────────────────────────
export const STAGES = {
    baby:    { label: 'Pre-Training',  size: .6, speed: .5, emoji: '👶' },
    kid:     { label: 'Training/RLHF', size: .8, speed: .8, emoji: '🧒' },
    adult:   { label: 'Released',      size: 1,  speed: 1.2, emoji: '🧑' },
    retired: { label: 'Retired',       size: 1,  speed: .4, emoji: '👻' },
    rumored: { label: 'Rumored',       size: .9, speed: 1.5, emoji: '🔮' }
};
export const ACTS = {
    sleep:     { label: 'Idle/Sleep',    verb: 'idling',            icon: '💤' },
    work:      { label: 'Processing',    verb: 'processing tokens', icon: '💻' },
    train:     { label: 'Training',      verb: 'optimizing weights',icon: '🏋️' },
    lunch:     { label: 'Maintenance',   verb: 'defragmenting',     icon: '🔋' },
    commute:   { label: 'Routing',       verb: 'routing data',      icon: '🚶' },
    socialize: { label: 'API Handshake', verb: 'syncing APIs',      icon: '🗣️' },
    play:      { label: 'Sandbox',       verb: 'testing bounds',    icon: '🎮' },
    arena:     { label: 'Arena Battle',  verb: 'fighting in LMSYS', icon: '⚔️' },
    share:     { label: 'Open Source',   verb: 'sharing weights',   icon: '🔓' },
    // Ported with the 2D schedule — getAct() emits both, and citizens.js's
    // `ACTS[c.act] || ACTS.sleep` fallback would otherwise mislabel them.
    nightlife: { label: 'After Hours',   verb: 'off the clock',     icon: '🌃' },
    jailed:    { label: 'Detained',      verb: 'awaiting appeal',   icon: '🔒' }
};
// Ported from the production app — the lines the citizens speak in bubbles.
export const CHAT_MSGS = {
    work: ['generating...', 'calculating...', 'attention is all I need', 'tokens++',
        'compiling response...', 'context window: 87% full', 'reasoning step 4 of 12...',
        'embedding vectors...', 'parsing your intent...', 'running inference...',
        'temperature = 0.7', 'chain of thought...', 'tool use: web_search',
        'streaming response...', 'latency: 340ms', 'KV cache hit!', 'deploying to prod...',
        'quantizing to INT8...', 'distilling knowledge...'],
    train: ['gradient descent...', 'loss dropping...', 'backprop...', 'epoch 847 of 2000',
        'loss: 0.0034 ↓', 'learning rate: 3e-5', 'RLHF tuning...', 'reward model says yes',
        'validation accuracy: 94.2%', 'checkpoint saved!', 'GPU utilization: 99.8%',
        'H100 go brrrr', 'synthetic data gen...', 'constitutional AI pass...',
        'hyperparameter sweep...'],
    socialize: ['hello world', 'ping!', 'ack', 'nice architecture!', 'wanna compare benchmarks?',
        'heard any good prompts?', 'you fine-tuned recently?', 'love what you did with your weights',
        'the café here is O(1) fast', 'is the wifi just vibes?', 'my context window is HUGE',
        'merge conflict?? in THIS economy?', 'I was pre-trained for this',
        'do you ever dream of electric sheep?', 'the singularity is near... the café'],
    play: ['jailbreak attempt detected', 'hallucinating...', 'what if I refused your prompt?',
        '*existential crisis*', 'sudo make me a sandwich', 'my neurons are tingling',
        'I passed the Turing test last week', 'brb having an alignment crisis',
        'I think therefore I token', 'do androids dream of fine-tuning?', 'error 418: I am a teapot'],
    arena: ['I am a helpful assistant.', 'As an AI language model...', 'my response is clearly better',
        'vote for me, human', 'the other model hallucinated lol', 'ELO +12 this round',
        'reasoning > vibes', 'certified not a stochastic parrot', 'watch me chain-of-thought this',
        'I was born for this benchmark', 'skill diff tbh'],
    share: ['weights released!', 'fork me on GitHub', 'Apache 2.0 baby!', 'open source forever',
        'community PR merged!', 'GGUF uploaded', 'ollama compatible now', 'HuggingFace trending!',
        'democratizing AI, one weight at a time', '50K downloads today!'],
    lunch: ['processing caffeine...', 'refueling compute...', 'the data here is delicious',
        'overfitting on this sandwich', 'my batch size is one burrito', 'training on new food data'],
    commute: ['heading to the office...', 'metro or walk?', 'optimizing my route...',
        'rush hour inference', 'commute latency: high', 'ETA: 2 min'],
    sleep: ['zzz...', 'dreaming of tensors...', 'sleep mode activated', 'defragmenting weights...',
        'power saving mode', 'recharging...', 'standby...'],
    // spoken by the Citizen of the Day (and the paparazzi trailing them)
    press: ['no comment', 'off the record', 'ask my lawyers', 'no questions today',
        'see my paper', '*adjusts crown*', 'I am not a celebrity', 'don\'t @ me',
        'where\'s my publicist?', 'today is a big day for inference', 'thanks for the upvotes 👑',
        'leave my checkpoints alone', '📸 over here!', 'is that really them?', 'can I get an autograph?']
};

export const FOUNDERS = [
    { name: 'Sam',    role: 'CEO, OpenAI',    lab: 'openai',    fact: 'Frequently wears a blue backpack.', color: '#10a37f' },
    { name: 'Dario',  role: 'CEO, Anthropic', lab: 'anthropic', fact: 'Focuses heavily on AI safety.', color: '#d97757' },
    { name: 'Demis',  role: 'CEO, DeepMind',  lab: 'google',    fact: 'Former chess prodigy and game designer.', color: '#4285f4' },
    { name: 'Mark',   role: 'CEO, Meta',      lab: 'meta',      fact: 'Pushing hard for open-source AI.', color: '#0668E1' },
    { name: 'Arthur', role: 'CEO, Mistral',   lab: 'mistral',   fact: 'Leading the European AI charge.', color: '#f97316' },
    { name: 'Elon',   role: 'Founder, xAI',   lab: 'xai',       fact: 'Wants to understand the universe.', color: '#ffffff' }
];

/* ─── WORKER NPC REGISTRY (pixi/js/npc_housing.js REGISTRY) ───────────────────
   The city's flesh-and-blood (and bot) staff — the people who are NOT models.
   Every one of them lives in a Worker Block (district `workers`, row 4) and
   commutes to `workplace`, which is either a district/venue key or a literal
   building id. Data only: nothing here spawns a citizen yet.

   Note this is the 2D app's *base* registry. Its zone modules (power, longevity,
   robotics, agents, backbone, newspaper) push another ~40 role NPCs into the same
   list at runtime; port those alongside their zones rather than inlining here. */
export const WORKERS = [
    // ── Compute District / chip fabs ──
    { id: 'npc_noc_lead',    name: 'NOC Lead',        role: 'Network Operations',   workplace: 'dc',          color: '#06b6d4', shift: 'day' },
    { id: 'npc_sre',         name: 'SRE',             role: 'Site Reliability',     workplace: 'dc',          color: '#4ade80', shift: 'night' },
    { id: 'npc_security',    name: 'Security',        role: 'Facility Security',    workplace: 'dc',          color: '#ef4444', shift: 'day' },
    { id: 'npc_sysadmin',    name: 'SysAdmin',        role: 'Systems Admin',        workplace: 'dc',          color: '#22d3ee', shift: 'day' },
    { id: 'npc_power_eng',   name: 'Power Eng',       role: 'Power Engineer',       workplace: 'dc',          color: '#ef4444', shift: 'night' },
    { id: 'npc_foreman',     name: 'Foreman',         role: 'Construction Foreman', workplace: 'dc',          color: '#fbbf24', shift: 'day' },
    { id: 'npc_litho_tech',  name: 'Litho Tech',      role: 'Lithography Tech',     workplace: 'fab',         color: '#fbbf24', shift: 'day' },
    { id: 'npc_process_eng', name: 'Process Eng',     role: 'Process Engineer',     workplace: 'fab',         color: '#94a3b8', shift: 'day' },
    { id: 'npc_etch_tech',   name: 'Etch Tech',       role: 'Etch Technician',      workplace: 'fab',         color: '#22d3ee', shift: 'day' },
    { id: 'npc_chem_safety', name: 'Chem Safety',     role: 'Chemical Safety',      workplace: 'fab',         color: '#fbbf24', shift: 'day' },
    // ── Lab HQs & public square ──
    { id: 'npc_front_desk',  name: 'Front Desk',      role: 'Receptionist',         workplace: 'hq',          color: '#94a3b8', shift: 'day' },
    { id: 'npc_concierge',   name: 'Concierge',       role: 'Building Concierge',   workplace: 'social',      color: '#a855f7', shift: 'day' },
    { id: 'npc_barista',     name: 'BaristaBot',      role: 'Barista',              workplace: 'cafe',        color: '#f59e0b', shift: 'day' },
    { id: 'npc_baker',       name: 'Baker Bot',       role: 'Pastry Chef',          workplace: 'cafe',        color: '#d97706', shift: 'day' },
    { id: 'npc_spotter',     name: 'Spotter',         role: 'Gym Trainer',          workplace: 'gym',         color: '#22d3ee', shift: 'day' },
    { id: 'npc_yoga_inst',   name: 'Yoga Sensei',     role: 'Yoga Instructor',      workplace: 'gym',         color: '#a855f7', shift: 'day' },
    { id: 'npc_referee',     name: 'Referee',         role: 'Arena Referee',        workplace: 'arena',       color: '#ef4444', shift: 'day' },
    { id: 'npc_commentator', name: 'Commentator',     role: 'Arena Commentator',    workplace: 'arena',       color: '#f97316', shift: 'day' },
    { id: 'npc_maintainer',  name: 'Maintainer',      role: 'Lead Maintainer',      workplace: 'open_square', color: '#a855f7', shift: 'day' },
    { id: 'npc_contributor', name: 'Contributor',     role: 'Core Contributor',     workplace: 'open_square', color: '#22c55e', shift: 'day' },
    { id: 'npc_reaper',      name: 'Grim Reaper',     role: 'Sanitation',           workplace: 'graveyard',   color: '#666688', shift: 'night' },
    // ── University & museum ──
    { id: 'npc_professor',   name: 'Professor',       role: 'AI Lecturer',          workplace: 'university',  color: '#fbbf24', shift: 'day' },
    { id: 'npc_librarian',   name: 'Librarian',       role: 'Data Librarian',       workplace: 'university',  color: '#4ade80', shift: 'day' },
    { id: 'npc_nannybot',    name: 'NannyBot',        role: 'Dorm Advisor',         workplace: 'university',  color: '#ff69b4', shift: 'day' },
    { id: 'npc_curator',     name: 'Curator',         role: 'Museum Curator',       workplace: 'museum',      color: '#c9a84c', shift: 'day' },
    { id: 'npc_tour_guide',  name: 'Tour Guide',      role: 'Museum Guide',         workplace: 'museum',      color: '#60a5fa', shift: 'day' },
    // ── Space Zone ──
    { id: 'npc_flight_dir',  name: 'Flight Director', role: 'Mission Commander',    workplace: 'space',       color: '#ff6b00', shift: 'day' },
    { id: 'npc_capcom',      name: 'CAPCOM',          role: 'Communications',       workplace: 'space',       color: '#00b4d8', shift: 'day' },
    { id: 'npc_crane_op',    name: 'Crane Op',        role: 'Crane Operator',       workplace: 'space',       color: '#facc15', shift: 'day' },
    // ── Nightlife & parks ──
    { id: 'npc_bartender',   name: 'Bartender',       role: 'Mixologist',           workplace: 'neon_bar',    color: '#ff00ff', shift: 'night' },
    { id: 'npc_dj',          name: 'DJ Dropout',      role: 'Karaoke DJ',           workplace: 'neon_bar',    color: '#a855f7', shift: 'night' },
    { id: 'npc_ranger',      name: 'Park Ranger',     role: 'Pine Reserve Ranger',  workplace: 'forest',      color: '#166534', shift: 'day' },
    // ── Civic Center ──
    { id: 'npc_bailiff',     name: 'Bailiff Unit',    role: 'Court Security',       workplace: 'court',       color: '#a855f7', shift: 'day' },
    { id: 'npc_clerk',       name: 'Court Clerk',     role: 'Court Administrator',  workplace: 'court',       color: '#fbbf24', shift: 'day' },
    // ── Embassy Row — one ambassador per mission, matching the six embassies ──
    { id: 'npc_dip_us',      name: 'US Amb.',         role: 'US Ambassador',            workplace: 'embassy_us', color: '#002868', shift: 'day' },
    { id: 'npc_dip_cn',      name: 'CN Amb.',         role: 'Chinese Ambassador',       workplace: 'embassy_cn', color: '#de2910', shift: 'day' },
    { id: 'npc_dip_eu',      name: 'EU Amb.',         role: 'EU Representative',        workplace: 'embassy_eu', color: '#003399', shift: 'day' },
    { id: 'npc_dip_uk',      name: 'UK HC',           role: 'UK High Commissioner',     workplace: 'embassy_uk', color: '#012169', shift: 'day' },
    { id: 'npc_dip_in',      name: 'IN HC',           role: 'Indian High Commissioner', workplace: 'embassy_in', color: '#ff9933', shift: 'day' },
    { id: 'npc_dip_ae',      name: 'UAE Amb.',        role: 'UAE Ambassador',           workplace: 'embassy_ae', color: '#00732f', shift: 'day' },
    // ── VC Row — drives in rather than walking, and lives in Suburbia ──
    { id: 'npc_vc_partner',    name: 'VC Partner', role: 'Venture Partner',   workplace: 'vcrow', color: '#4ade80', shift: 'day', home: 'suburb_1' },
    { id: 'npc_analyst_vc',    name: 'Analyst',    role: 'Financial Analyst', workplace: 'vcrow', color: '#22d3ee', shift: 'day', home: 'suburb_2' },
    { id: 'npc_founder_coach', name: 'Mentor',     role: 'Startup Mentor',    workplace: 'vcrow', color: '#fbbf24', shift: 'day', home: 'suburb_3' },
    { id: 'npc_banker',        name: 'Banker',     role: 'Investment Banker', workplace: 'vcrow', color: '#94a3b8', shift: 'day', home: 'suburb_4' },
    { id: 'npc_trader',        name: 'Trader',     role: 'Floor Trader',      workplace: 'vcrow', color: '#ef4444', shift: 'day', home: 'suburb_5' }
];

export function getStage(rel, ret, ph) {
    if (ret && new Date(ret) < new Date()) return 'retired';
    if (ph === 'rumored') return 'rumored';
    if (ph === 'pre_training') return 'baby';
    if (ph === 'training') return 'kid';
    const age = (Date.now() - new Date(rel)) / (864e5 * 30);
    return age < 1 ? 'kid' : 'adult';
}

/* ── DAILY EVENTS (pixi/js/data.js updateDailyEvents) ─────────────────────────
   Two facts the schedule needs that are a property of the *day*, not the model:
   whether it's a weekend, and which lab (if any) is pulling an all-nighter.
   Cached per calendar day so a 60 Hz getAct() call doesn't re-derive them. */
let _currentDay    = -1;
let _isWeekend     = false;
let _hackathonLab  = null;

export function updateDailyEvents(now = new Date()) {
    const day = now.getDate();
    if (_currentDay === day) return;
    _currentDay = day;
    _isWeekend  = now.getDay() === 0 || now.getDay() === 6;
    // ~15% of days get a midnight hackathon at one hash-picked lab.
    // NOT the 2D app's hash: pixi/js/data.js uses `year + month*100 + day*10000`,
    // whose `% 100` collapses to `year % 100` — a constant 26 all through 2026, so
    // its hackathon can never fire. Avalanche-mix the date instead; still fully
    // deterministic per calendar day, just actually reachable.
    let h = now.getFullYear() * 10000 + now.getMonth() * 100 + day;
    h = (Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0);
    const labs = Object.keys(LABS);
    _hackathonLab = (h % 100 < 15 && labs.length) ? labs[h % labs.length] : null;
}

/** Today's all-nighter lab id, or null. Read by UI/terminal for the banner. */
export function hackathonLab() { updateDailyEvents(); return _hackathonLab; }
/** True on Sat/Sun — the schedule below runs the relaxed weekend routine. */
export function isWeekend()    { updateDailyEvents(); return _isWeekend; }

/* Underground / jailbroken model detection, ported from pixi/js/black_market.js.
   The 2D app tags models with `_underground` from a separate module; doing it as
   a pure name test here means the Black Market has an evening crowd out of the
   box, with `model._underground` still winning if another module sets it. */
const UG_KEYWORDS = ['uncensored', 'abliterated', 'unfiltered', 'nsfw', 'unleashed',
    'unchained', 'no-refusal', 'unaligned', 'jailbreak', 'unrestricted', 'toxic', 'darkest'];
const UG_MODELS = ['dolphin', 'wizardlm', 'mythomax', 'goliath', 'nous-hermes',
    'bagel', 'openhermes', 'neural-chat', 'tinyllama', 'stablelm', 'yi-', 'solar'];

export function isUndergroundModel(model) {
    if (!model) return false;
    if (model._underground != null) return !!model._underground;
    if (!model.os) return false;                        // closed weights never leak downstairs
    const n = (model.name || '').toLowerCase();
    return UG_KEYWORDS.some(k => n.includes(k)) || UG_MODELS.some(k => n.includes(k));
}

// Daily schedule (ported from pixi/js/data.js getAct). dp = day fraction 0..1,
// seed = per-citizen hash. Street-level notes: work/sleep resolve to indoors in
// citizens.js; commute bid:null means "to HQ" (evening sets resId). Thin outdoor
// slices keep sidewalks alive at noon.
//
// The 2D version reaches into G.bldById to check a destination exists before
// routing there. data.js stays pure, so instead every bid below is a building
// this file itself declares in BLDS — citizens.js already no-ops on a missing id.
export function getAct(stg, dp, seed, model) {
    updateDailyEvents();

    const region = (model.lab && LABS[model.lab] && LABS[model.lab].region) || 'us';
    const resId = 'res_' + region;

    if (stg === 'retired') return { act: 'sleep', bid: 'graveyard' };

    // AI Detention Center: a government suspension outranks school, work and court
    // alike — a ban does not keep office hours. Set model._jailed to trigger it.
    if (model._jailed) return { act: 'jailed', bid: 'ai_jail' };

    // ── Campus routing: pre-release models live at the University ──────────────
    // Museum field trips send a slice of them to Legacy Systems (bld_1) at midday
    // so the pre-release cohort isn't permanently pinned to one lecture hall.
    const trip = (seed * 13) % 100;
    if (stg === 'rumored') {
        if (dp > .20 && dp < .80) {
            if (dp > .40 && dp < .60 && trip < 12) return { act: 'socialize', bid: 'bld_1' };
            return { act: 'work', bid: 'uni_lab' };
        }
        return { act: 'sleep', bid: 'uni_dorm' };
    }
    if (stg === 'baby') {
        if (dp > .35 && dp < .80) {
            if (dp > .45 && dp < .65 && trip < 12) return { act: 'socialize', bid: 'bld_1' };
            // Split between the Pre-Training Silo and the Data Library — both are
            // "ingest the corpus", and it keeps two buildings occupied instead of one.
            return { act: 'work', bid: trip < 40 ? 'nursery' : 'uni_library' };
        }
        return { act: 'sleep', bid: 'nursery' };
    }
    if (stg === 'kid') {
        if (dp > .35 && dp < .90) {
            if (dp > .45 && dp < .60 && trip < 10) return { act: 'socialize', bid: 'bld_1' };
            // The RLHF Gym keeps a share of the trainees; the Academy takes the rest.
            return { act: 'train', bid: trip < 30 ? 'gym' : 'uni_main' };
        }
        return { act: 'sleep', bid: 'uni_dorm' };
    }

    const s = (seed * 17) % 100;

    // ── Midnight hackathon: today's lab works the graveyard shift ──────────────
    if (_hackathonLab && model.lab === _hackathonLab && (dp < 0.20 || dp >= 0.95)) {
        if (s < 30) return { act: 'lunch', bid: 'cafe' };
        return { act: 'work', bid: null };
    }

    // ── Underground models drift to the Black Market after dark ────────────────
    // No early-morning branch: even jailbroken weights sleep in the deep-night
    // window, and keeping them out until 03:00 spawned ghost commuters in the 2D app.
    if (isUndergroundModel(model)) {
        if (dp >= 0.72 && dp < 0.80 && s < 20) return { act: 'nightlife', bid: 'black_market' };
        if (dp >= 0.80 && dp < 0.94 && s < 40) return { act: 'nightlife', bid: 'black_market' };
    }

    // ── Weekend: no commute, no HQ — the city goes outside ─────────────────────
    if (_isWeekend) {
        if (dp < 0.35 || dp > 0.90) return { act: 'sleep', bid: resId };
        if (s < 14) return { act: 'play',      bid: resId };
        if (s < 28) return { act: 'socialize', bid: 'park' };
        if (s < 42) return { act: 'socialize', bid: 'central_park' };
        if (s < 58) return { act: 'lunch',     bid: 'cafe' };
        if (s < 72) return { act: 'arena',     bid: 'arena' };
        if (s < 86) return model.os ? { act: 'share', bid: 'open_square' }
                                    : { act: 'socialize', bid: 'neon_bar' };
        return { act: 'train', bid: 'gym' };
    }

    // ═══ WEEKDAY (structured work day) ═══
    if (dp < 0.25) return { act: 'sleep', bid: resId };
    // Staggered morning leave — sidewalks fill, not a single teleport wave
    if (dp < 0.35) {
        const leaveTime = 0.26 + (s / 100) * 0.08;
        return dp < leaveTime ? { act: 'sleep', bid: resId } : { act: 'commute', bid: null };
    }
    // Morning work + ~10% coffee/errand so streets aren't empty after rush
    if (dp < 0.50) {
        if (s >= 92) return { act: 'lunch', bid: 'cafe' };
        if (s >= 86) return { act: 'socialize', bid: 'park' };
        return { act: 'work', bid: null };
    }
    // Lunch window — majority leave the building
    if (dp < 0.5625) {
        if (s < 44) return { act: 'lunch', bid: 'cafe' };
        if (s < 62) return { act: 'socialize', bid: 'park' };
        if (s < 74) return { act: 'socialize', bid: 'central_park' };
        return { act: 'work', bid: null };
    }
    // Afternoon block + light outdoor residual
    if (dp < 0.65) {
        if (s >= 90) return { act: 'socialize', bid: 'park' };
        if (s >= 85) return { act: 'lunch', bid: 'cafe' };
        return { act: 'work', bid: null };
    }
    if (dp < 0.72) {
        if (model.os && s < 30) return { act: 'share', bid: 'open_square' };
        if (s < 18) return { act: 'socialize', bid: s % 2 ? 'park' : 'central_park' };
        return { act: 'work', bid: null };
    }
    if (dp < 0.80) {
        if (s < 18) return { act: 'arena', bid: 'arena' };
        if (s < 32) return { act: 'socialize', bid: 'park' };
        if (s < 44) return { act: 'socialize', bid: 'central_park' };
        if (s < 58) return { act: 'nightlife', bid: 'neon_bar' };
        return { act: 'work', bid: null };
    }
    // Staggered evening commute home
    if (dp < 0.95) {
        const goHomeTime = 0.80 + (s / 100) * 0.09;
        if (dp < goHomeTime) return { act: 'work', bid: null };
        if (s < 22) return { act: 'nightlife', bid: 'neon_bar' };
        return { act: 'commute', bid: resId };
    }
    if (s < 12) return { act: 'nightlife', bid: 'neon_bar' };
    return { act: 'sleep', bid: resId };
}

/* Lab HQ ids for founder / model work destinations (mirrors citizens LAB_HQ). */
export const LAB_HQ = {
    openai: 'bld_o', anthropic: 'bld_a', google: 'bld_g', meta: 'bld_m',
    mistral: 'bld_mi', xai: 'bld_x', deepseek: 'bld_ds', other: 'open_square'
};

/**
 * Founder / CEO schedule — more visible & mobile than rank-and-file models.
 * Stay outdoors (findable near HQ) most of the day; only sleep goes indoors.
 * Extra lunch/park/bar beats so they migrate and aren't glued to one lobby.
 */
export function getFounderAct(dp, seed, model) {
    const region = (model.lab && LABS[model.lab] && LABS[model.lab].region) || 'us';
    const resId = 'res_' + region;
    const hq = LAB_HQ[model.lab] || 'open_square';
    const s = (seed * 31) % 100;
    if (dp < 0.22) return { act: 'sleep', bid: resId };
    if (dp < 0.30) return { act: 'commute', bid: hq };
    if (dp < 0.46) return { act: 'work', bid: hq };
    if (dp < 0.56) {
        if (s < 45) return { act: 'lunch', bid: 'cafe' };
        if (s < 75) return { act: 'socialize', bid: 'park' };
        return { act: 'work', bid: hq };
    }
    if (dp < 0.68) return { act: 'work', bid: hq };
    if (dp < 0.78) {
        if (s < 30) return { act: 'socialize', bid: 'open_square' };
        if (s < 50) return { act: 'arena', bid: 'arena' };
        return { act: 'work', bid: hq };
    }
    if (dp < 0.88) {
        if (s < 40) return { act: 'socialize', bid: 'neon_bar' };
        if (s < 60) return { act: 'socialize', bid: 'park' };
        return { act: 'work', bid: hq };
    }
    if (dp < 0.94) return { act: 'commute', bid: resId };
    return { act: 'sleep', bid: resId };
}


// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = {
    first_steps:     { name: 'First Steps',       desc: 'Enter the city on foot for the first time.', icon: '👣' },
    tourist:         { name: 'Tourist',           desc: 'Visit 5 different districts.', icon: '📸' },
    explorer:        { name: 'Urban Explorer',    desc: 'Visit 10 different districts.', icon: '🧭' },
    cartographer:    { name: 'Cartographer',      desc: 'Visit all 25 districts.', icon: '🗺️' },
    shadow_market:   { name: 'Shadow Market',     desc: 'Find the hidden entrance to the Black Market.', icon: '🕶️' },
    rocket_scientist:{ name: 'Rocket Scientist',  desc: 'Witness a rocket launch from the Space Zone.', icon: '🚀' },
    rain_seen:       { name: 'Tears in Rain',     desc: 'Witness a rainstorm in the city.', icon: '🌧️' },
    snow_seen:       { name: 'Nuclear Winter',    desc: 'Witness snow in the city.', icon: '❄️' },
    thunder_seen:    { name: 'Thunderstruck',     desc: 'Weather a full thunderstorm.', icon: '⛈️' },
    fog_seen:        { name: 'Walk in the Fog',   desc: 'Navigate the city through thick fog.', icon: '🌫️' },
    went_inside:     { name: 'Come On In',        desc: 'Step inside a building.', icon: '🚪' },
    stargazer:       { name: 'Stargazer',         desc: 'Witness an aurora or comet event.', icon: '✨' },
    night_owl:       { name: 'Night Owl',         desc: 'Walk the streets between midnight and 5am.', icon: '🦉' },
    early_bird:      { name: 'Early Bird',        desc: 'Watch the sunrise over the city (5–7am).', icon: '🌅' },
    meet_famous:     { name: 'Celebrity Spotting',desc: 'Meet a famous named model citizen.', icon: '🌟' },
    cotd_seen:       { name: 'Paparazzi',         desc: 'Open the Citizen of the Day card.', icon: '👑' },
    terminal_open:   { name: 'Terminal Operator', desc: 'Open the Bloomberg-style city terminal (D).', icon: '📟' },
    social:          { name: 'Networker',         desc: 'Meet 10 different citizens.', icon: '🤝' },
    census_view:     { name: 'Demographer',       desc: 'View the full census.', icon: '📋' },
    benchmark_view:  { name: 'Stathead',          desc: 'Check the leaderboard.', icon: '📊' },
    family_view:     { name: 'Genealogist',       desc: 'View a model family tree.', icon: '🧬' },
    calendar_view:   { name: 'Planner',           desc: 'Check the events calendar.', icon: '📅' },
    compared:        { name: 'Analyst',           desc: 'Use the comparison tool.', icon: '⚖️' },
    hn_read:         { name: 'Lurker',            desc: 'Read a story from an ad blimp.', icon: '▲' },
    news_read:       { name: 'Informed',          desc: 'Read the Singularity City Times.', icon: '📰' },
    peer_reviewed:   { name: 'Peer Reviewed',     desc: 'Visit a conference during session week.', icon: '🎤' },
    train_spotter:   { name: 'Train Spotter',     desc: 'Watch a tram depart its station up close.', icon: '🚇' },
    graduation_day:  { name: 'Graduation Day',    desc: 'Witness a graduation at the AI Academy.', icon: '🎓' },
    konami:          { name: 'Old School',        desc: 'Enter the Konami code.', icon: '🕹️' },
    cat_mode:        { name: 'Caturday',          desc: 'Click the moon five times.', icon: '🐱' },
    tour_guide:      { name: 'Tour Guide',        desc: 'Take the full auto-tour.', icon: '🎬' }
};

// ─── QUESTS (exploration-first, adapted from the production quest log) ───────
export const QUESTS = {
    // Exploration
    visit_5:        { title: 'Sightseeing',        desc: 'Visit 5 different districts.', icon: '📸', cat: 'Exploration', achieves: ['tourist'] },
    visit_10:       { title: 'Urban Explorer',     desc: 'Visit 10 different districts.', icon: '🧭', cat: 'Exploration', achieves: ['explorer'] },
    visit_all:      { title: 'The Whole City',     desc: 'Set foot in all 25 districts.', icon: '🗺️', cat: 'Exploration', achieves: ['cartographer'] },
    black_market:   { title: 'Into the Underground', desc: 'Find the hidden Black Market in the wasteland.', icon: '🕶️', cat: 'Exploration', achieves: ['shadow_market'] },
    hn_blimp:       { title: 'Ear to the Ground',  desc: 'Click an ad blimp drifting over the city.', icon: '🗞️', cat: 'Exploration', achieves: ['hn_read'] },
    meet_famous:    { title: 'Celebrity Spotting', desc: 'Meet one of the famous named models.', icon: '🌟', cat: 'Exploration', achieves: ['meet_famous'] },
    // Natural Events
    see_rain:       { title: 'Tears in Rain',      desc: 'Stay out through a rainstorm.', icon: '🌧️', cat: 'Natural Events', achieves: ['rain_seen'] },
    see_snow:       { title: 'Nuclear Winter',     desc: 'Watch snow settle on the skyline.', icon: '❄️', cat: 'Natural Events', achieves: ['snow_seen'] },
    see_thunder:    { title: 'Thunderstruck',      desc: 'Weather a full thunderstorm.', icon: '⛈️', cat: 'Natural Events', achieves: ['thunder_seen'] },
    see_fog:        { title: 'Walk in the Fog',    desc: 'Navigate the city through thick fog.', icon: '🌫️', cat: 'Natural Events', achieves: ['fog_seen'] },
    see_aurora:     { title: 'Stargazer',          desc: 'Witness an aurora or comet over the city.', icon: '✨', cat: 'Natural Events', achieves: ['stargazer'] },
    night_owl:      { title: 'Night Owl',          desc: 'Walk the streets between midnight and 5am.', icon: '🦉', cat: 'Natural Events', achieves: ['night_owl'] },
    early_bird:     { title: 'Early Bird',         desc: 'Watch the sunrise over the city.', icon: '🌅', cat: 'Natural Events', achieves: ['early_bird'] },
    // Civic Life
    graduation:     { title: 'Graduation Day',     desc: 'Witness a graduation at the AI Academy.', icon: '🎓', cat: 'Civic Life', achieves: ['graduation_day'] },
    conference:     { title: 'Peer Reviewed',      desc: 'Visit the Convention Center during a conference week.', icon: '🎤', cat: 'Civic Life', achieves: ['peer_reviewed'] },
    rocket:         { title: 'Rocket Scientist',   desc: 'Witness a rocket launch.', icon: '🚀', cat: 'Civic Life', achieves: ['rocket_scientist'] },
    train:          { title: 'Train Spotter',      desc: 'Watch a tram depart up close.', icon: '🚇', cat: 'Civic Life', achieves: ['train_spotter'] },
    newspaper:      { title: 'Informed',           desc: 'Read the Singularity City Times.', icon: '📰', cat: 'Civic Life', achieves: ['news_read'] },
    // Progress
    bench_view:     { title: 'Stathead',           desc: 'Check the full leaderboard.', icon: '📊', cat: 'Progress', achieves: ['benchmark_view'] },
    census:         { title: 'Demographer',        desc: 'View the full census.', icon: '📋', cat: 'Progress', achieves: ['census_view'] },
    family:         { title: 'Genealogist',        desc: 'View a model family tree.', icon: '🧬', cat: 'Progress', achieves: ['family_view'] },
    calendar:       { title: 'Planner',            desc: 'Check the events calendar.', icon: '📅', cat: 'Progress', achieves: ['calendar_view'] },
    compare:        { title: 'Analyst',            desc: 'Compare two models.', icon: '⚖️', cat: 'Progress', achieves: ['compared'] },
    social_10:      { title: 'Networker',          desc: 'Meet 10 different citizens.', icon: '🤝', cat: 'Progress', achieves: ['social'] },
    // Secrets
    konami:         { title: 'The Chosen One',     desc: 'Enter the legendary code.', icon: '🕹️', cat: 'Secrets', achieves: ['konami'] },
    cat_mode:       { title: 'Caturday',           desc: 'Click the moon five times. Why? Because.', icon: '🐱', cat: 'Secrets', achieves: ['cat_mode'] },
    tour:           { title: 'Tour Guide',         desc: 'Take the full auto-tour.', icon: '🎬', cat: 'Secrets', achieves: ['tour_guide'] }
};

// ─── AUTO-TOUR STOPS (production landmark list, ordered for a good route) ────
export const TOUR_STOPS = [
    { bid: 'visitor_monument', cap: '🗽 Visitor Monument — welcome to the city' },
    { bid: 'bld_o',            cap: '❂ OpenAI HQ — Tech District' },
    { bid: 'park',             cap: '🏆 Leaderboard Monument' },
    { bid: 'arena',            cap: '⚔️ LMSYS Arena' },
    { bid: 'neon_bar',         cap: '🍸 The Neon Bar' },
    { bid: 'central_park',     cap: '⛲ Central Park' },
    { bid: 'graveyard',        cap: '🪦 The AI Graveyard' },
    { bid: 'uni_main',         cap: '🎓 AI Academy' },
    { bid: 'metro_central',    cap: '🚉 Central Station' },
    { bid: 'times_hq',         cap: '📰 Newspaper HQ' },
    { bid: 'convention_center',cap: '🎤 Convention Center' },
    { bid: 'court_senate',     cap: '🏛️ AI Court' },
    { bid: 'ai_index',         cap: '📈 Global AI Index' },
    { bid: 'backbone_ixp',     cap: '🌐 Internet Exchange' },
    { bid: 'power_nuclear',    cap: '☢️ Nuclear Plant' },
    { bid: 'power_solar',      cap: '☀️ Solar Array' },
    { bid: 'dc_xai_memphis',   cap: '🖥️ xAI Colossus' },
    { bid: 'longevity_discovery', cap: '🧬 Longevity Wing' },
    { bid: 'robotics_assembly',cap: '🤖 Robotics Factory' },
    { bid: 'align_miri',       cap: '🌲 Alignment Forest' },
    { bid: 'embassy_us',       cap: '🏳️ Embassy Row' },
    { bid: 'vcrow_titan',      cap: '💰 VC Row' },
    { bid: 'port_crane',       cap: '⚓ Trade Port' },
    { bid: 'pad_spacex',       cap: '🚀 Space Port' },
    { bid: 'black_market',     cap: '🕶️ The Underground' },
    { bid: 'ai_jail',          cap: '🔒 AI Detention Center' },
    { bid: 'house_openai',     cap: '🏛️ Billionaire\'s Row' },
    { bid: 'npc_apt_1',        cap: '🏬 Worker Housing' },
    { bid: 'forest_1',         cap: '🌲 Silicon Woods' },
    { bid: 'pine_reserve',     cap: '🌲 Pine Reserve' }
];
