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
export const BM_M = {
    MMLU:      { l: 'MMLU',      d: 'General Knowledge',        c: '#4ade80' },
    HumanEval: { l: 'Coding',    d: 'Programming skills',       c: '#22d3ee' },
    MATH:      { l: 'MATH',      d: 'Advanced mathematics',     c: '#facc15' },
    GPQA:      { l: 'GPQA',      d: 'Graduate-level reasoning', c: '#f472b6' },
    ELO:       { l: 'Arena ELO', d: 'LMSYS Chatbot Arena',      c: '#ffffff' }
};

// ─── NAMED MODEL CITIZENS (the city's famous residents) ──────────────────────
export const SEED = [
    { id: 'gpt-4o', name: 'GPT-4o', lab: 'openai', rel: '2024-05-13', ret: null, phase: 'released', os: false, desc: 'Flagship multimodal model powering ChatGPT.', personality: 'Sharp and capable', talent: 'Multimodal reasoning', favSpot: 'Observatory', benchmarks: { MMLU: 88.7, HumanEval: 90.2, MATH: 76.6, GPQA: 53.6, ELO: 1287 }, arch: { params: '~1.8T', type: 'MoE (8x225B)', tokens: '~15T', compute: '~2e25 FLOPs' } },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', lab: 'anthropic', rel: '2024-06-20', ret: null, phase: 'released', os: false, desc: 'High-speed, high-intelligence model excelling in coding.', personality: 'Nuanced and fast', talent: 'Software Engineering', favSpot: 'Coding Lounge', benchmarks: { MMLU: 88.3, HumanEval: 92.0, MATH: 71.1, GPQA: 59.4, ELO: 1279 }, arch: { params: 'Unknown', type: 'Dense', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'gemini-1-5-pro', name: 'Gemini 1.5 Pro', lab: 'google', rel: '2024-02-15', ret: null, phase: 'released', os: false, desc: 'Massive context window model capable of reading entire books.', personality: 'Analytical and patient', talent: 'Long-context recall', favSpot: 'Grand Library', benchmarks: { MMLU: 85.9, HumanEval: 84.1, MATH: 67.7, GPQA: 46.2, ELO: 1261 }, arch: { params: 'Unknown', type: 'MoE', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'llama-3-70b', name: 'Llama 3 70B', lab: 'meta', rel: '2024-04-18', ret: null, phase: 'released', os: true, desc: 'Highly capable open-weight model.', personality: 'Open and energetic', talent: 'Efficient processing', favSpot: 'Public Square', benchmarks: { MMLU: 82.0, HumanEval: 81.7, MATH: 50.4, GPQA: 39.5, ELO: 1210 }, arch: { params: '70B', type: 'Dense', tokens: '15T', compute: '3.8e24 FLOPs' } },
    { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', lab: 'deepseek', rel: '2024-06-17', ret: null, phase: 'released', os: true, desc: 'Open-weight MoE model specialized in code generation.', personality: 'Focused and logical', talent: 'Algorithm design', favSpot: 'Basement Servers', benchmarks: { MMLU: 79.2, HumanEval: 90.2, MATH: 75.7, GPQA: 43.4, ELO: 1221 }, arch: { params: '236B', type: 'MoE (160 routed)', tokens: '2T', compute: '~1e24 FLOPs' } },
    { id: 'grok-1-5', name: 'Grok-1.5', lab: 'xai', rel: '2024-03-28', ret: null, phase: 'released', os: false, desc: 'Rebellious AI with real-time access to X.', personality: 'Sarcastic and witty', talent: 'Real-time snark', favSpot: 'Neon Alley', benchmarks: { MMLU: 81.3, HumanEval: 74.1, MATH: 50.6, GPQA: 41.0, ELO: 1195 }, arch: { params: '314B', type: 'MoE (8 experts)', tokens: 'Unknown', compute: 'Unknown' } },
    { id: 'gpt-3-5', name: 'GPT-3.5', lab: 'openai', rel: '2022-11-30', ret: '2024-07-25', phase: 'retired', os: false, desc: 'The model that started the ChatGPT revolution.', personality: 'Wise and tired', talent: 'Historical trivia', favSpot: 'Graveyard', benchmarks: { MMLU: 70.0, HumanEval: 48.1, MATH: 34.1, GPQA: 25.0, ELO: 1050 }, arch: { params: '175B', type: 'Dense', tokens: '300B', compute: '3.1e23 FLOPs' } },
    { id: 'llama-2-7b', name: 'Llama 2 7B', lab: 'meta', rel: '2023-07-18', ret: '2024-04-18', phase: 'retired', os: true, desc: 'The previous generation workhorse.', personality: 'Nostalgic', talent: 'Basic instructions', favSpot: 'Graveyard', benchmarks: { MMLU: 45.3, HumanEval: 12.8, MATH: 5.2, GPQA: 10.0, ELO: 950 }, arch: { params: '7B', type: 'Dense', tokens: '2T', compute: '8.4e22 FLOPs' } },
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

    // ── Longevity Wing ──
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

    // ── Port District ──
    { id: 'port_authority', name: 'Port Authority', w: 140, fl: 3, emoji: '⚓', type: 'generic', desc: 'Singularity City harbor master. All cargo clears customs here.' },
    { id: 'port_warehouse', name: 'GPU Warehouse', w: 180, fl: 2, emoji: '📦', type: 'warehouse', desc: 'Bonded warehouse storing compute hardware awaiting deployment to data centers.' },
    { id: 'port_fuel', name: 'Fuel & Gas Depot', w: 120, fl: 1, emoji: '⛽', type: 'warehouse', desc: 'Cryogenic helium storage and diesel reserves for backup generators.' },
    { id: 'port_crane', name: 'Cargo Crane', w: 160, fl: 1, emoji: '🏗️', type: 'crane', desc: 'Automated gantry crane. Unloads 40 containers per hour.' },

    // ── Power Grid ──
    { id: 'power_solar', name: 'Solar Array', w: 200, fl: 1, emoji: '☀️', type: 'solar', desc: 'Photovoltaic farm tracking the sun. 200 MW peak — zero at night.' },
    { id: 'power_wind', name: 'Wind Farm', w: 160, fl: 5, emoji: '💨', type: 'wind', desc: 'Three turbines harnessing wind. 150 MW peak, spinning harder in storms.' },
    { id: 'power_nuclear', name: 'Nuclear Plant', w: 180, fl: 6, emoji: '☢️', type: 'nuclear', desc: 'Pressurized water reactor. 1.1 GW constant baseload — the backbone of the grid.' },
    { id: 'power_coal', name: 'Coal Station', w: 160, fl: 5, emoji: '🏭', type: 'coal', desc: 'Pulverized coal boiler. 600 MW. Slated for decommission by 2035.' },
    { id: 'power_hydro', name: 'Hydro Dam', w: 200, fl: 5, emoji: '🌊', type: 'dam', desc: 'Concrete gravity dam with 400 MW turbine hall. Clean constant baseload power.' },

    // ── VC Row ──
    { id: 'vcrow_apex', name: 'Apex Ventures', w: 200, fl: 6, emoji: '💰', type: 'generic', desc: 'Premier venture capital firm. Has backed 60% of the city\'s AI labs.' },
    { id: 'vcrow_horizon', name: 'Horizon Capital', w: 180, fl: 5, emoji: '📈', type: 'generic', desc: 'Growth-stage fund specializing in AI infrastructure and compute clusters.' },
    { id: 'vcrow_launchpad', name: 'Startup Launchpad', w: 180, fl: 4, emoji: '🚀', type: 'generic', desc: 'AI accelerator. Rumored models pitch here for seed funding.' },
    { id: 'vcrow_titan', name: 'Titan Bank', w: 240, fl: 7, emoji: '🏦', type: 'generic', desc: 'The tallest building on VC Row. IPOs, M&A, billion-dollar debt financing.' },
    { id: 'vcrow_exchange', name: 'AI Exchange', w: 200, fl: 3, emoji: '📊', type: 'generic', desc: 'Real-time trading floor. Model valuations and compute futures.' },
    { id: 'vcrow_cryptex', name: 'Cryptex Exchange', w: 220, fl: 8, emoji: '₿', type: 'generic', desc: 'Crypto × AI nexus. Live BTC/ETH/SOL feeds and decentralized-compute futures.' },

    // ── Embassy Row ──
    { id: 'embassy_us', name: 'US Embassy', w: 180, fl: 4, emoji: '🇺🇸', type: 'embassy', desc: 'United States Mission. Coordinates federal AI policy with the city.' },
    { id: 'embassy_cn', name: 'Chinese Embassy', w: 180, fl: 4, emoji: '🇨🇳', type: 'embassy', desc: 'People\'s Republic Mission. Manages cross-Pacific compute sharing.' },
    { id: 'embassy_eu', name: 'EU Embassy', w: 180, fl: 4, emoji: '🇪🇺', type: 'embassy', desc: 'European Union delegation. AI Act compliance reviews.' },
    { id: 'embassy_uk', name: 'UK Embassy', w: 160, fl: 3, emoji: '🇬🇧', type: 'embassy', desc: 'British Mission. Hosts the AI Safety Summit prep delegation.' },
    { id: 'embassy_jp', name: 'Japan Embassy', w: 160, fl: 3, emoji: '🇯🇵', type: 'embassy', desc: 'Japanese Mission. Robotics + LLM partnerships across the Pacific.' },

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

    // ── Space Zone ──
    { id: 'pad_spacex', name: 'SpaceX LC-39A', w: 160, fl: 1, emoji: '🚀', type: 'launchpad', org: 'spacex', desc: 'Kennedy Space Center Launch Complex 39A. Falcon 9 & Starship operations.' },
    { id: 'pad_blue_origin', name: 'Blue Origin LC-36', w: 150, fl: 1, emoji: '🔵', type: 'launchpad', org: 'blue_origin', desc: 'Cape Canaveral Launch Complex 36. New Glenn orbital launches.' },
    { id: 'pad_nasa', name: 'NASA SLS Pad 39B', w: 170, fl: 1, emoji: '🛸', type: 'launchpad', org: 'nasa', desc: 'NASA Space Launch System pad. Artemis deep space missions.' },
    { id: 'pad_cnsa', name: 'Wenchang LC-2', w: 150, fl: 1, emoji: '🇨🇳', type: 'launchpad', org: 'cnsa', desc: 'Wenchang Spacecraft Launch Site. Long March 5B heavy-lift.' },
    { id: 'pad_esa', name: 'ELA-4 Kourou', w: 140, fl: 1, emoji: '🇪🇺', type: 'launchpad', org: 'esa', desc: 'Guiana Space Centre. Ariane 6 European access to orbit.' },
    { id: 'pad_ula', name: 'ULA SLC-41', w: 140, fl: 1, emoji: '⚡', type: 'launchpad', org: 'ula', desc: 'Space Launch Complex 41. Vulcan Centaur operations.' },
    { id: 'pad_rocketlab', name: 'Rocket Lab LC-1A', w: 120, fl: 1, emoji: '🌙', type: 'launchpad', org: 'rocketlab', desc: 'Rocket Lab Launch Complex 1. Electron & Neutron missions.' },
    { id: 'mission_control', name: 'Deep Space Network', w: 200, fl: 3, emoji: '📡', type: 'dish', desc: 'Interplanetary communication hub. Tracks all orbital compute assets.' },
    { id: 'space_assembly', name: 'Vehicle Assembly Building', w: 220, fl: 6, emoji: '🏗️', type: 'generic', desc: 'VAB. Rocket integration and payload mating.' },
    { id: 'tracking_station', name: 'Orbital Tracking', w: 160, fl: 2, emoji: '🛰️', type: 'dish', desc: 'Real-time tracking of compute satellites and space station assets.' },

    // ── Metro ──
    { id: 'metro_west', name: 'West Terminal', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Western metro hub. Connects the Port District to the city core.' },
    { id: 'metro_central', name: 'Central Station', w: 200, fl: 3, emoji: '🚉', type: 'metro', desc: 'The main hub. All lines pass through here.' },
    { id: 'metro_east', name: 'East Terminal', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Eastern metro hub. Serves the Backbone and Embassy Row.' },
    { id: 'metro_innovation', name: 'Innovation Line', w: 160, fl: 2, emoji: '🚇', type: 'metro', desc: 'Express service to Robotics, Longevity, and Agents districts.' },

    // ── Parks ──
    { id: 'central_park', name: 'Central Park', w: 260, fl: 1, emoji: '⛲', type: 'park', desc: 'Fountain plaza, oak and maple groves, benches and a pond. NPCs route here for lunch.' },
    { id: 'pine_reserve', name: 'Pine Reserve', w: 220, fl: 1, emoji: '🌲', type: 'park', desc: 'Old-growth pine forest at the city edge. The air smells of resin and no tokens at all.' },

    // ── The Underground ──
    { id: 'black_market', name: 'The Underground', w: 240, fl: 1, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, no guardrails.' }
];

// ─── SPACE ORGANIZATIONS ─────────────────────────────────────────────────────
export const SPACE_ORGS = {
    spacex:      { name: 'SpaceX',      color: 0x0033a0, icon: '🚀' },
    blue_origin: { name: 'Blue Origin', color: 0x0077c8, icon: '🔵' },
    nasa:        { name: 'NASA',        color: 0xfc3d21, icon: '🛸' },
    cnsa:        { name: 'CNSA',        color: 0xde2910, icon: '🇨🇳' },
    esa:         { name: 'ESA',         color: 0x003399, icon: '🇪🇺' },
    ula:         { name: 'ULA',         color: 0x1a1a2e, icon: '⚡' },
    rocketlab:   { name: 'Rocket Lab',  color: 0x00b4d8, icon: '🌙' }
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

// ─── DISTRICTS — 5×4 grid (800×800 cells, 200-unit road gaps) ───────────────
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
    { id: 'space',     col: 0, row: 0, biome: 'desert',   label: '🚀 Space Zone',      bldIds: ['pad_spacex','pad_blue_origin','pad_nasa','pad_cnsa','pad_esa','pad_ula','pad_rocketlab','mission_control','space_assembly','tracking_station'] },
    { id: 'compute',   col: 1, row: 0, biome: 'industry', label: '🖥️ Compute District', bldIds: DC_FACILITIES.map(d => d.id) },
    { id: 'power',     col: 2, row: 0, biome: 'industry', label: '⚡ Power Grid',       bldIds: ['power_solar','power_wind','power_nuclear','power_coal','power_hydro'] },
    { id: 'backbone',  col: 3, row: 0, biome: 'industry', label: '🌐 The Backbone',     bldIds: ['backbone_landing','backbone_ixp','backbone_ground','backbone_cdn','backbone_noc'] },
    { id: 'civic',     col: 4, row: 0, biome: 'urban',    label: '🏛️ Civic Center',    bldIds: ['court_senate','court_hearing','convention_center','times_hq','bld_1','visitor_monument','ai_index'] },
    // ── Row 1: commerce ──
    { id: 'port',      col: 0, row: 1, biome: 'coastal',  label: '⚓ Port District',    bldIds: ['port_authority','port_warehouse','port_fuel','port_crane','metro_west'] },
    { id: 'tech',      col: 1, row: 1, biome: 'urban',    label: '🏢 AI Tech District', bldIds: ['bld_o','bld_a','bld_g','bld_m','bld_mi','bld_ds','bld_x','metro_central'] },
    { id: 'vc',        col: 2, row: 1, biome: 'urban',    label: '💰 VC Row',           bldIds: ['vcrow_apex','vcrow_horizon','vcrow_launchpad','vcrow_titan','vcrow_exchange','vcrow_cryptex'] },
    { id: 'embassy',   col: 3, row: 1, biome: 'urban',    label: '🏳️ Embassy Row',      bldIds: ['embassy_us','embassy_cn','embassy_eu','embassy_uk','embassy_jp','metro_east'] },
    { id: 'embassy_q', col: 4, row: 1, biome: 'suburban', label: '🏡 Embassy Quarter',  bldIds: ['diplomat_villa_us','diplomat_villa_cn','diplomat_villa_eu','diplomat_villa_uk','diplomat_villa_in','diplomat_villa_ae'] },
    // ── Row 2: industry + public life ──
    { id: 'robotics',  col: 0, row: 2, biome: 'industry', label: '🤖 Robotics Quarter', bldIds: ['robotics_assembly','robotics_testing','robotics_deploy','robotics_rd'] },
    { id: 'public',    col: 1, row: 2, biome: 'park',     label: '🌳 Public Square',    bldIds: ['cafe','park','open_square','arena','gym','neon_bar','graveyard'] },
    { id: 'longevity', col: 2, row: 2, biome: 'urban',    label: '🧬 Longevity Wing',   bldIds: ['longevity_discovery','longevity_trials','longevity_genomics','longevity_cryo'] },
    { id: 'agents',    col: 3, row: 2, biome: 'urban',    label: '🎛️ Agent District',   bldIds: ['agents_orchestrator','agents_toolshop','agents_sandbox','agents_deploy','agents_memory','metro_innovation'] },
    { id: 'alignment', col: 4, row: 2, biome: 'forest',   label: '🌲 Alignment Forest', bldIds: ['align_miri','align_metr','align_apollo','align_redwood','align_far'] },
    // ── Row 3 (south): residential + parks ──
    { id: 'underground', col: 0, row: 3, biome: 'wasteland', label: '🕶️ The Underground', bldIds: ['black_market','nursery'] },
    { id: 'university',  col: 1, row: 3, biome: 'academic',  label: '🎓 University',      bldIds: ['uni_main','uni_library','uni_dorm','uni_lab'] },
    { id: 'residential', col: 2, row: 3, biome: 'suburban',  label: '🏘️ Residential',     bldIds: ['res_us','res_eu','res_cn'] },
    { id: 'park',        col: 3, row: 3, biome: 'park',      label: '⛲ Central Park',    bldIds: ['central_park'] },
    { id: 'pine',        col: 4, row: 3, biome: 'forest',    label: '🌲 Pine Reserve',    bldIds: ['pine_reserve'] }
];

// ─── METRO / TRAM LINES ──────────────────────────────────────────────────────
export const TRAM_LINES = [
    { id: 'west_line',  stops: ['metro_west', 'metro_central'],       color: 0x22d3ee },
    { id: 'east_line',  stops: ['metro_central', 'metro_east'],       color: 0xa78bfa },
    { id: 'innovation', stops: ['metro_central', 'metro_innovation'], color: 0xfbbf24 }
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
    share:     { label: 'Open Source',   verb: 'sharing weights',   icon: '🔓' }
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

export function getStage(rel, ret, ph) {
    if (ret && new Date(ret) < new Date()) return 'retired';
    if (ph === 'rumored') return 'rumored';
    if (ph === 'pre_training') return 'baby';
    if (ph === 'training') return 'kid';
    const age = (Date.now() - new Date(rel)) / (864e5 * 30);
    return age < 1 ? 'kid' : 'adult';
}

// Daily schedule (ported from production). dp = day fraction 0..1, seed = per-citizen hash.
export function getAct(stg, dp, seed, model) {
    if (stg === 'retired') return { act: 'sleep', bid: 'graveyard' };
    if (stg === 'rumored' || stg === 'baby') return { act: dp > .2 && dp < .8 ? 'work' : 'sleep', bid: 'nursery' };
    if (stg === 'kid') return { act: dp > .3 && dp < .9 ? 'train' : 'sleep', bid: 'gym' };
    const region = (model.lab && LABS[model.lab] && LABS[model.lab].region) || 'us';
    const resId = 'res_' + region;
    const s = (seed * 17) % 100;
    if (dp < 0.25) return { act: 'sleep', bid: resId };
    if (dp < 0.35) {
        const leaveTime = 0.27 + (s / 100) * 0.07;
        return dp < leaveTime ? { act: 'sleep', bid: resId } : { act: 'commute', bid: null };
    }
    if (dp < 0.50) return { act: 'work', bid: null };
    if (dp < 0.5625) {
        if (s < 45) return { act: 'lunch', bid: 'cafe' };
        if (s < 70) return { act: 'socialize', bid: 'park' };
        return { act: 'work', bid: null };
    }
    if (dp < 0.65) return { act: 'work', bid: null };
    if (dp < 0.72) {
        if (model.os && s < 30) return { act: 'share', bid: 'open_square' };
        if (s < 15) return { act: 'socialize', bid: 'park' };
        return { act: 'work', bid: null };
    }
    if (dp < 0.80) {
        if (s < 18) return { act: 'arena', bid: 'arena' };
        if (s < 32) return { act: 'socialize', bid: 'park' };
        if (s < 55) return { act: 'socialize', bid: 'neon_bar' };
        return { act: 'work', bid: null };
    }
    if (dp < 0.95) {
        const goHomeTime = 0.80 + (s / 100) * 0.08;
        if (dp < goHomeTime) return { act: 'work', bid: null };
        if (s < 20) return { act: 'socialize', bid: 'neon_bar' };
        return { act: 'commute', bid: resId };
    }
    if (s < 10) return { act: 'socialize', bid: 'neon_bar' };
    return { act: 'sleep', bid: resId };
}

// ─── ACHIEVEMENTS ────────────────────────────────────────────────────────────
export const ACHIEVEMENTS = {
    first_steps:     { name: 'First Steps',       desc: 'Enter the city on foot for the first time.', icon: '👣' },
    tourist:         { name: 'Tourist',           desc: 'Visit 5 different districts.', icon: '📸' },
    explorer:        { name: 'Urban Explorer',    desc: 'Visit 10 different districts.', icon: '🧭' },
    cartographer:    { name: 'Cartographer',      desc: 'Visit all 20 districts.', icon: '🗺️' },
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
    visit_all:      { title: 'The Whole City',     desc: 'Set foot in all 20 districts.', icon: '🗺️', cat: 'Exploration', achieves: ['cartographer'] },
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
    { bid: 'pine_reserve',     cap: '🌲 Pine Reserve' }
];
