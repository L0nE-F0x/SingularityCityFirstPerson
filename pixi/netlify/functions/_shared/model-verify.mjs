// ════════════════════════════════════════════════════════════════════════════
// SHARED MODEL-VERIFICATION ENGINE
//
// Single authoritative server-side copy of the hallucination/verification
// logic: version ceilings (auto-raised floors — NEVER frozen caps, see project
// memory), the known-real registry, and the verify/high-confidence gates.
// Consumers: db-maintenance.mjs (purge/dedupe) and submit-data.mjs (the
// verify-then-write gate for client submissions).
//
// The browser keeps its own display-filter mirror in js/api.js
// (_maxKnownVersions / knownReal / _verifyModel) — when tuning here, mirror
// there. The client copy only filters the LOCAL display list; this copy is
// what protects the shared database.
// ════════════════════════════════════════════════════════════════════════════

// ─── VERSION CEILINGS (mirrors js/api.js _maxKnownVersions — floors, auto-raised) ──
const MAX_KNOWN_VERSIONS = {
    // Western
    gemini: 3.1, gemma: 3, gpt: 5.4, claude: 4.6, llama: 4,
    grok: 4.3, phi: 4, palm: 2, bard: 1, codellama: 1,
    mistral: 3, mixtral: 2, codestral: 1, ministral: 3, pixtral: 1, devstral: 1.5,
    mathstral: 1, magistral: 2,
    command: 2, nova: 2, titan: 1, nemotron: 4,
    // Asian
    deepseek: 3.2, qwen: 3.5, qwq: 3,
    yi: 2, ernie: 5, glm: 5, chatglm: 4,
    kimi: 2.5, moonshot: 1, minimax: 2.5, doubao: 2,
    hunyuan: 4, step: 3.5, baichuan: 2,
    internlm: 3, internvl: 3,
    // Open / specialty
    falcon: 3, jais: 2, olmo: 2, olmoe: 1, tulu: 3, granite: 4, smollm: 3,
    bloom: 1, bloomz: 1, starling: 1, vicuna: 1, wizard: 2, orca: 2,
    dbrx: 1, hermes: 4, aya: 2, snowflake: 2, openelm: 1,
    starcoder: 2, mpt: 1, pythia: 1, jamba: 2, stablelm: 3,
    minicpm: 4, llava: 2, lfm: 2, dolphin: 3, nvlm: 1, arctic: 2,
};

// Closed-weight frontier families never appear on HF and lag aggregators, so a real
// new flagship would be rejected until they catch up — allow a bounded forward step.
const FRONTIER_FORWARD_TOLERANCE = { gpt: 1.0, claude: 1.0, gemini: 1.0, grok: 1.0 };
const OPEN_WEIGHT_FORWARD_TOLERANCE = 0.5;

const FAMILY_TO_LAB = {
    gpt: ['openai'], claude: ['anthropic'],
    gemini: ['google'], gemma: ['google'], palm: ['google'], bard: ['google'],
    llama: ['meta'], codellama: ['meta'], openelm: ['apple'],
    grok: ['xai'],
    phi: ['microsoft'],
    mistral: ['mistral'], mixtral: ['mistral'], pixtral: ['mistral'],
    codestral: ['mistral'], ministral: ['mistral'], devstral: ['mistral'],
    mathstral: ['mistral'], magistral: ['mistral'],
    deepseek: ['deepseek'],
    qwen: ['alibaba'], qwq: ['alibaba'],
    ernie: ['baidu'],
    glm: ['zhipu_ai', 'zhipu', 'thudm'], chatglm: ['zhipu_ai', 'zhipu', 'thudm'],
    command: ['cohere'], aya: ['cohere', 'cohereforai'],
    nova: ['amazon'], titan: ['amazon'],
    nemotron: ['nvidia'], nvlm: ['nvidia'],
    yi: ['zerooneai', '01_ai', '01ai'],
    kimi: ['moonshot'], moonshot: ['moonshot'],
    minimax: ['minimax'],
    doubao: ['bytedance'],
    hunyuan: ['tencent'],
    step: ['stepfun'],
    baichuan: ['baichuan'],
    internlm: ['shanghai_ai_lab'], internvl: ['shanghai_ai_lab'],
    falcon: ['tii'], jais: ['inception'],
    olmo: ['allen_ai', 'allenai'], olmoe: ['allen_ai', 'allenai'],
    tulu: ['allen_ai', 'allenai'],
    granite: ['ibm'], smollm: ['huggingface', 'huggingfaceh4'],
    bloom: ['bigscience'], bloomz: ['bigscience'],
    dbrx: ['databricks'],
    hermes: ['nous', 'nousresearch'],
    snowflake: ['snowflake'], arctic: ['snowflake'],
    starcoder: ['bigcode', 'huggingface'],
    mpt: ['mosaicml', 'databricks'],
    pythia: ['eleutherai'],
    jamba: ['ai21', 'ai21labs'],
    stablelm: ['stabilityai', 'stability_ai'],
    minicpm: ['openbmb'],
    llava: ['llava', 'haotianliu'],
    lfm: ['liquid', 'liquidai'],
    dolphin: ['cognitivecomputations'],
};

const HALLUCINATION_PHRASES = [
    'rumored', 'leaked', 'speculated', 'speculation', 'predicted',
    'next gen', 'next-gen', 'next generation',
    'in training', 'in-training', 'in development',
    'upcoming', 'unreleased', 'forthcoming',
    'allegedly', 'reportedly', 'expected',
    'future model', 'will release', 'planned for',
    '(beta upcoming)', '(early)', 'pre-release',
];

const KNOWN_FAKE_PATTERNS = [
    /gemini\s*ultra\s*[2-9]/i,
    /gemini\s*[2-9](?:\.\d+)?\s*ultra/i,
    /gemini\s*1\.5\s*ultra/i,
    /claude\s+\d+\s+opus\s+[2-9]/i,
    /claude\s+\d+\s+sonnet\s+[2-9]/i,
    /claude\s+\d+\s+haiku\s+[2-9]/i,
    /gpt[\s-]*[5-9][\s-]*\(orion\s*[2-9]/i,
    /gpt[\s-]*[5-9][\s-]*\(strawberry\s*[2-9]/i,
    /gpt[\s-]*[6-9](?!\.\d)/i,
];

// Flagships we know are real — protects naming quirks like "Aya 23" (name suffix,
// not a version) from the strict version-cap check. Mirrors js/api.js knownReal.
const KNOWN_REAL = [
    'claude opus 4', 'claude opus 4.6', 'claude sonnet 4', 'claude sonnet 4.6',
    'claude haiku 4', 'claude haiku 4.5',
    'claude 3.5 sonnet', 'claude 3.5 haiku', 'claude 3 opus',
    'claude 3 sonnet', 'claude 3 haiku', 'claude 2', 'claude 2.1', 'claude instant',
    'gpt-4o', 'gpt-4o mini', 'gpt-4.1', 'gpt-4.1 mini', 'gpt-4.1 nano',
    'gpt-4', 'gpt-4 turbo', 'gpt-3.5 turbo', 'gpt-4-vision',
    'gpt-5', 'gpt-5 mini', 'gpt-5 nano', 'gpt-5.1', 'gpt-5.2', 'gpt-5.2 codex',
    'gpt-5.3 codex', 'gpt-5.3 codex spark', 'gpt-5.3 chat',
    'gpt-5.4', 'gpt-5.4 mini', 'gpt-5.4 nano',
    'o1', 'o1-mini', 'o1-pro', 'o1-preview', 'o3', 'o3-mini', 'o3-pro', 'o4-mini',
    'gemini 2.5 pro', 'gemini 2.5 flash', 'gemini 2.5 flash lite',
    'gemini 2.0 flash', 'gemini 2.0 pro', 'gemini 2.0 flash lite',
    'gemini 1.5 pro', 'gemini 1.5 flash', 'gemini 1.0 pro', 'gemini nano',
    'gemini 3.1 pro', 'gemini 3.1 ultra', 'gemini 3.1 flash', 'gemini 3.1 flash lite',
    'gemma 3', 'gemma 2', 'gemma 7b', 'codegemma', 'recurrentgemma', 'palm 2',
    'grok 1', 'grok 2', 'grok 3', 'grok 3 mini', 'grok 4', 'grok 4 mini', 'grok 4.20', 'grok 4.3',
    'llama 4 scout', 'llama 4 maverick', 'llama 4 behemoth',
    'llama 3.3', 'llama 3.2', 'llama 3.1', 'llama 3', 'llama 2', 'codellama',
    'deepseek-r1', 'deepseek r1', 'deepseek-v3', 'deepseek v3',
    'deepseek-v3.2', 'deepseek v3.2', 'deepseek-r2', 'deepseek r2',
    'deepseek coder', 'deepseek math', 'deepseek vl', 'deepseek prover',
    'qwen3', 'qwen 3', 'qwen3.5', 'qwen 3.5', 'qwen2.5', 'qwen 2.5',
    'qwen2.5-max', 'qwen2.5 max', 'qwen2', 'qwq', 'qwq 32b',
    'qwen vl', 'qwen audio', 'qwen coder', 'qwen math',
    'phi-4', 'phi 4', 'phi-4-mini', 'phi 4 mini', 'phi-3', 'phi 3', 'phi-2',
    'phi-3.5', 'phi 3.5', 'phi silica',
    'mistral 3', 'mistral large', 'mistral large 2', 'mistral large 3',
    'mistral medium', 'mistral medium 3',
    'mistral small', 'mistral small 3', 'mistral small 3.1', 'mistral small 3.2',
    'mistral nemo', 'mistral 7b',
    'mixtral 8x7b', 'mixtral 8x22b',
    'codestral', 'codestral 2501', 'codestral mamba',
    'ministral 3', 'ministral 3b', 'ministral 8b', 'ministral 14b',
    'ministral 3 14b', 'ministral 3 8b', 'ministral 3 3b',
    'pixtral', 'pixtral 12b', 'pixtral large',
    'devstral small', 'devstral medium', 'devstral 1.1',
    'mathstral', 'mathstral 7b',
    'magistral', 'magistral small', 'magistral medium',
    'command r+', 'command r', 'command a', 'command light',
    'aya 23', 'aya 23 8b', 'aya 23 35b', 'aya expanse', 'aya 8b', 'aya 35b',
    'nova pro', 'nova premier', 'nova lite', 'nova micro', 'nova canvas', 'nova reel',
    'titan text express', 'titan text lite',
    'nemotron ultra', 'nemotron-4 340b', 'nemotron-4 340b instruct',
    'nemotron-4 15b', 'nemotron-4-mini-4b-instruct',
    'llama-3.1-nemotron-ultra', 'llama 3.1 nemotron ultra',
    'nvlm', 'nvlm-d', 'nvlm 1.0',
    'yi-lightning', 'yi lightning', 'yi-large', 'yi 34b', 'yi 6b', 'yi vl',
    'ernie 4.5', 'ernie 4', 'ernie bot', 'ernie x1',
    'glm-4', 'glm 4', 'glm-4-plus', 'glm 4 plus', 'glm-4v', 'chatglm',
    'kimi k1', 'kimi k1.5', 'kimi k2', 'kimi k2 thinking', 'kimi k2.5', 'moonshot v1',
    'minimax-01', 'minimax abab', 'minimax m1', 'minimax m2', 'minimax m2.5',
    'doubao pro', 'doubao lite', 'doubao 1.5 pro',
    'hunyuan', 'hunyuan large', 'hunyuan turbo', 'hunyuan video', 'hunyuan dit',
    'step-1', 'step-2', 'step-3', 'step-3.5', 'step-3.5-flash',
    'step3', 'step3-vl', 'step3-vl-10b', 'step-1v', 'step-1.5v',
    'baichuan', 'baichuan2', 'baichuan 3', 'baichuan 4',
    'internlm', 'internlm 2', 'internlm 2.5', 'internlm xcomposer',
    'internvl', 'internvl 2', 'internvl 2.5',
    'falcon 180b', 'falcon 40b', 'falcon 7b', 'falcon mamba', 'falcon 3',
    'jais 13b', 'jais 30b',
    'olmo 2', 'olmo', 'olmo 7b', 'olmoe', 'olmoe 1b 7b',
    'tulu 3', 'tulu 2',
    'granite 3', 'granite 3.1', 'granite 3.2', 'granite code', 'granite vision',
    'smollm', 'smollm2', 'smollm 3',
    'bloom', 'bloomz',
    'dbrx', 'dbrx instruct', 'dbrx base',
    'hermes 2', 'hermes 3', 'hermes 4', 'nous hermes',
    'snowflake arctic', 'snowflake arctic instruct', 'arctic',
    'openelm', 'openelm 270m', 'openelm 1.1b', 'openelm 3b',
    'starcoder', 'starcoder2', 'starcoder 15b', 'starcoder2 15b',
    'mpt', 'mpt-7b', 'mpt-30b',
    'pythia', 'pythia 12b',
    'jamba', 'jamba 1.5', 'jamba 1.5 large', 'jamba 1.5 mini',
    'stablelm', 'stablelm 2', 'stablelm zephyr', 'stable code',
    'minicpm', 'minicpm v', 'minicpm 2.6', 'minicpm 3', 'minicpm 4',
    'llava', 'llava 1.5', 'llava 1.6', 'llava next',
    'lfm', 'lfm 1.3b', 'lfm 3b', 'lfm 40b', 'lfm 2',
    'dolphin', 'dolphin 2.9', 'dolphin 3',
    'wizardlm', 'wizardmath', 'wizardcoder',
    'orca 2', 'orca mini',
    'vicuna 13b', 'vicuna 7b',
    'starling 7b', 'starling lm',
    'alphacode', 'alphacode 2', 'alphageometry', 'alphaproof', 'alphafold',
    'chinchilla', 'chinchilla 70b', 'gopher', 'gopher 280b',
    'minerva', 'minerva 62b', 'lamda', 'glam', 'ul2', 't5', 't5 11b', 'flan-t5', 'mt5',
    'project astra', 'medgemma', 'medgemma 4b', 'med-gemini',
    'codex', 'whisper', 'instructgpt', 'text-davinci-002', 'text-davinci-003',
    'chatgpt', 'chatgpt-4o', 'chatgpt-4o latest',
    'opt', 'opt-175b', 'opt-66b', 'opt-30b', 'opt 175b', 'opt 66b', 'opt 30b',
    'galactica', 'galactica 120b', 'segment anything', 'sam', 'sam 2',
    'musicgen', 'audiogen', 'incoder', 'incoder-6.7b',
    'turing-nlg', 'turing-nlg 17b', 'megatron-turing nlg', 'mt-nlg', 'mt-nlg 530b',
    'megatron-turing nlg 530b', 'florence', 'florence-2', 'florence-2 large',
    'mai-1', 'apple ajax',
    'mm1', 'ferret-ui', 'personal voice', 'mgie', 'apple vision fm',
    'jurassic-1', 'jurassic-1 178b', 'jurassic-1 jumbo', 'jurassic-2', 'j1-jumbo',
    'luminous base', 'luminous extended', 'luminous-extended', 'luminous-supra',
    'luminous supreme', 'luminous-large-v1-0', 'luminous world',
    'pharia 1', 'pharia 1 7b', 'pharia 1 pro', 'pharia 1 pro 7b', 'pharia pro 70b',
    'stable audio', 'stable audio open', 'stable audio 2',
    'stable diffusion', 'stable diffusion 3', 'stable diffusion 3 medium',
    'stable beluga', 'stable beluga 7b', 'stablebeluga 70b',
    'stable code', 'stable lm', 'stablelm zephyr',
    'cerebras-gpt', 'cerebras-gpt-13b', 'cerebras-gpt-6.7b', 'cerebras-gpt-2.7b',
    'condor galaxy',
    'codegen', 'codegen-16b-multi', 'codegen2.5-7b-multi',
    'codet5', 'codet5+', 'codet5+ 16b',
    'xgen', 'xgen large', 'xgen 2 large', 'xgen-mm', 'xgen-mm 9b', 'xgen-mm vl',
    'magicoder', 'magicoder evolution',
    'meditron', 'meditron-70b', 'meditron-70b-v2', 'med42', 'med42 70b',
    'decolm', 'decolm 6.7b',
    'phind', 'phind-34b', 'phind-codellama', 'phind-codellama-34b',
    'phind-codellama-34b-v2', 'phind-coder', 'phind coder',
    'santacoder',
    'hyperclova', 'hyperclova x', 'hyperclova x 2', 'hyperclova x 2.0',
    'longcat', 'longcat-flash', 'longcat-flash-chat', 'longcat-flash-lite',
    'longcat-flash-thinking', 'bailing', 'bailing 7b', 'pura', 'pura 72b',
    'exaone', 'exaone 3', 'exaone 3.0', 'exaone 3.5', 'exaone audio',
    'seed', 'doubao 1.5',
    'molmo', 'medolmo', 'medolmo 32b',
    'sarvam', 'sarvam 1', 'sarvam-30b', 'sarvam med',
    'mercury', 'mercury coder',
    'mimo', 'milm', 'milm-7b', 'milm-7b-instruct', 'milm-6x7b',
    'zephyr', 'zephyr 7b', 'zephyr-7b', 'zephyr-7b-beta', 'idefics', 'idefics2',
    'idefics2-8b', 'huggingchat', 'parler-tts', 'parler-tts mini', 'parler-tts v2',
    'janus', 'janus-pro', 'janus-pro-7b', 'deepseekmoe', 'deepseekmoe-16b',
    'cogvlm', 'cogvlm2', 'cogvlm2-chat', 'cogagent',
    'qvq', 'qvq-72b', 'qvq-72b-preview',
    'dolly', 'dolly v2', 'dolly v2 12b', 'leopard 7b',
    'numinamath', 'numinamath-7b', 'sealion',
    'codewhisperer',
    'stepcoder', 'stepcoder-7b',
    'acegpt', 'acegpt-13b',
    'aider polyglot', 't0', 't0++',
    'longwriter', 'longwriter 7b',
    'med-gemini', 'med-palm', 'med-palm 2',
];

// ─── VERIFICATION ENGINE (mirrors js/api.js _extractVersionNear/_verifyModel) ──
function extractVersionNear(name, family) {
    const famRegex = new RegExp(`(?:^|[\\s\\-_])${family}(?:[\\s\\-_]|\\d|$)`, 'i');
    const fm = name.match(famRegex);
    if (!fm) return { found: false };
    const idx = name.indexOf(fm[0]);
    let win = name.substring(idx, idx + 50);
    // Strip date patterns FIRST so they aren't misread as versions ([-_/] keeps "2.5").
    win = win.replace(/\d{4}[-_/]\d{1,2}[-_/]\d{1,2}/g, ' ');
    win = win.replace(/\d{1,2}[-_/]\d{1,2}[-_/]\d{4}/g, ' ');
    win = win.replace(/\d{1,2}[-_/]\d{4}/g, ' ');
    win = win.replace(/\d{4}[-_/]\d{1,2}/g, ' ');
    win = win.replace(/\d{1,2}[-_/]\d{1,2}/g, ' ');
    win = win.replace(/\(\s*\d{6,}\s*\)/g, ' ');
    win = win.replace(/\b\d{6,}\b/g, ' ');
    // MoE experts ("8x7b"), param counts ("70b"), context ("128k"), quant codes.
    win = win.replace(/\d+x\d+(?:\.\d+)?b\b/gi, ' ');
    win = win.replace(/\d+(?:\.\d+)?b\b/gi, ' ');
    win = win.replace(/\d+(?:\.\d+)?[km]\b/gi, ' ');
    win = win.replace(/\b(?:nv)?fp\d+\b/gi, ' ');
    win = win.replace(/\bint\d+\b/gi, ' ');
    win = win.replace(/\bbf\d+\b/gi, ' ');
    win = win.replace(/\bq\d+(?:_\w+)?\b/gi, ' ');
    const matches = [...win.matchAll(/(\d+(?:\.\d+)?)([a-z]?)/g)];
    let max = -1;
    for (const mm of matches) {
        const ver = parseFloat(mm[1]);
        const suffix = (mm[2] || '').toLowerCase();
        if (suffix === 'b') continue;
        if (ver >= 100) continue;
        if (ver > max) max = ver;
    }
    return { found: true, max: max < 0 ? null : max };
}

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const fuzzyNorm = (s) => norm(s).replace(/\d{6,}/g, '');

// Registry + caps built once per run from KNOWN_REAL plus live trusted names.
function buildRegistry(trustedRawNames) {
    const verified = new Set(KNOWN_REAL.map(norm));
    const caps = { ...MAX_KNOWN_VERSIONS };
    for (const raw of trustedRawNames) {
        verified.add(norm(raw));
        // Auto-raise family ceilings from trusted live data — this is what keeps the
        // floors current so brand-new real releases are never purged.
        for (const family of Object.keys(caps)) {
            const r = extractVersionNear(raw.toLowerCase(), family);
            if (r.found && r.max != null && r.max > caps[family]) caps[family] = r.max;
        }
    }
    return { verified, caps };
}

// Returns { ok: true } or { ok: false, reason }. Only HIGH-CONFIDENCE reasons delete.
function verifyModel(m, { verified, caps }) {
    if (!m.name || !m.lab) return { ok: false, reason: 'Missing name or lab' };

    const name = m.name.toLowerCase();
    const today = new Date().toISOString().split('T')[0];
    const relDate = m.released || m.rel;

    if (relDate && relDate > today) return { ok: false, reason: `Future release date: ${relDate}` };
    if (relDate && relDate < '2017-01-01') return { ok: false, reason: `Implausibly old release date: ${relDate}` };

    for (const phrase of HALLUCINATION_PHRASES) {
        if (name.includes(phrase)) return { ok: false, reason: `Hallucination marker: "${phrase}"` };
    }
    for (const pat of KNOWN_FAKE_PATTERNS) {
        if (pat.test(name)) return { ok: false, reason: `Known fake pattern: ${pat.source}` };
    }

    // Trusted-name fast path — protects "Aya 23"-style names from the version check.
    const normName = norm(name);
    if (verified.has(normName)) return { ok: true };
    for (const v of verified) {
        if (v.length >= 5 && (normName.includes(v) || (normName.length >= 5 && v.includes(normName)))) {
            return { ok: true };
        }
    }

    for (const [family, maxVer] of Object.entries(caps)) {
        const r = extractVersionNear(name, family);
        if (!r.found) continue;
        const tol = FRONTIER_FORWARD_TOLERANCE[family] != null
            ? FRONTIER_FORWARD_TOLERANCE[family]
            : OPEN_WEIGHT_FORWARD_TOLERANCE;
        if (r.max != null && r.max > maxVer + tol) {
            return { ok: false, reason: `Version ${r.max} exceeds max known ${family} version ${maxVer}` };
        }
    }

    if (m.benchmarks) {
        for (const [k, v] of Object.entries(m.benchmarks)) {
            if (k !== 'ELO' && (v > 100 || v < 0)) return { ok: false, reason: `Impossible benchmark ${k}=${v}` };
            if (k === 'ELO' && (v < 500 || v > 2500)) return { ok: false, reason: `Impossible ELO=${v}` };
        }
    }

    if (m.cost_input != null && m.cost_input > 1000) return { ok: false, reason: `Absurd input pricing: $${m.cost_input}/1M` };
    if (m.cost_out != null && m.cost_out > 1000) return { ok: false, reason: `Absurd output pricing: $${m.cost_out}/1M` };

    return { ok: true };
}

// Only these reasons are safe enough to DELETE on (matches js/api.js isHighConfidence).
function isHighConfidence(reason) {
    if (!reason) return false;
    return reason.includes('Future release date') ||
           reason.includes('Implausibly old') ||
           reason.includes('exceeds max known') ||
           reason.includes('Impossible benchmark') ||
           reason.includes('Impossible ELO') ||
           reason.includes('Absurd input pricing') ||
           reason.includes('Absurd output pricing') ||
           reason.includes('Missing name or lab') ||
           reason.includes('Hallucination marker') ||
           reason.includes('Known fake pattern');
}

// ─── TRUSTED REGISTRY SOURCES (same feeds the client uses, fetched directly) ──
async function fetchJson(url, timeoutMs = 20000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'SingularityCity-DBMaint/1.0' } });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`[registry] ${url} — ${e.message}`);
        return null;
    }
}

// Returns { names: string[], sources: number } — raw display names from trusted feeds.
async function fetchTrustedNames() {
    const names = [];
    let sources = 0;

    const [hf, ze, or] = await Promise.all([
        fetchJson('https://huggingface.co/api/models?sort=likes&limit=25&pipeline_tag=text-generation'),
        fetchJson('https://api.zeroeval.com/leaderboard/models/full?justCanonicals=true'),
        fetchJson('https://openrouter.ai/api/v1/models'),
    ]);

    if (Array.isArray(hf)) {
        sources++;
        for (const m of hf) {
            if (!m.modelId) continue;
            const parts = m.modelId.split('/');
            names.push((parts.length > 1 ? parts[1] : parts[0]).replace(/-/g, ' '));
        }
    }
    if (Array.isArray(ze)) {
        sources++;
        for (const m of ze) if (m.name) names.push(m.name);
    }
    const orList = or && Array.isArray(or.data) ? or.data : null;
    if (orList) {
        sources++;
        for (const m of orList) {
            if (!m.name || /:beta$|:free$|:nitro$|:extended$|:thinking$/i.test(m.id || '')) continue;
            // Strip "Lab: " prefix, same as the client.
            let dn = m.name;
            const ci = dn.indexOf(': ');
            if (ci > 0 && ci < 30) dn = dn.slice(ci + 2).trim();
            if (dn) names.push(dn);
        }
    }
    return { names, sources };
}

export {
    MAX_KNOWN_VERSIONS,
    FRONTIER_FORWARD_TOLERANCE,
    OPEN_WEIGHT_FORWARD_TOLERANCE,
    FAMILY_TO_LAB,
    HALLUCINATION_PHRASES,
    KNOWN_FAKE_PATTERNS,
    KNOWN_REAL,
    extractVersionNear,
    norm,
    fuzzyNorm,
    buildRegistry,
    verifyModel,
    isHighConfidence,
    fetchTrustedNames,
};
