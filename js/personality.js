/* ══════════════════════════════════════════════════════════════════════════
   MODEL PERSONALITY — behavioural traits derived from what a model actually is.

   `data.js` already carries a `personality` string per seeded model, but until
   now it was pure flavour text on the citizen card: nothing in the sim read it.
   The 2D app derives four traits from a model's real capabilities and lets them
   bias how it moves, where it goes in its free time, and what it says. That is
   the difference between 700 identical pedestrians and a city where the coding
   models are at the gym and the analysts are in the library.

   Traits come from evidence, in descending order of trust:
     1. benchmarks   — HumanEval → coding, MATH/MMLU/GPQA → analytical, ELO → social
     2. talent       — the authored one-liner ("Software Engineering")
     3. architecture — MoE / multimodal / vision hints
     4. name         — "Coder", "DALL·E", "Chat"
     5. personality  — the flavour string itself
   If nothing matches, a name hash picks one so the model still has a character
   rather than defaulting to the same neutral behaviour as everyone else.

   Pure module: no three.js, no scene, no `G`. Testable in node.
   ══════════════════════════════════════════════════════════════════════════ */

/** Cheap stable hash so a nameless model still gets a consistent character. */
function hashOf(s) {
    let h = 2166136261;
    const str = String(s || 'x');
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0) / 4294967296;
}

const TRAITS = ['coding', 'social', 'creative', 'analytical'];

/**
 * Derive { coding, social, creative, analytical, dominant, isOpenSource } for a
 * model. Cached on the model object — this runs for every citizen at spawn and
 * again whenever a schedule band flips.
 */
export function deriveTraits(m) {
    if (!m) return { coding: 0, social: 0, creative: 0, analytical: 0, dominant: 'social', isOpenSource: false };
    if (m._traits) return m._traits;

    let coding = 0, social = 0, creative = 0, analytical = 0;

    // ── 1. benchmarks: the hardest evidence available ──
    const b = m.benchmarks || m.bench || {};
    if (b.HumanEval > 70) coding += 0.35 + Math.min(0.25, (b.HumanEval - 70) / 100);
    if (b.MATH > 50) analytical += 0.3 + Math.min(0.2, (b.MATH - 50) / 120);
    if (b.MMLU > 80) analytical += 0.2;
    if (b.GPQA > 45) analytical += 0.15;
    if (b.ELO > 1200) social += 0.25;
    if (b.MGSM > 80) analytical += 0.1;
    if (b.ARC > 90) creative += 0.12;   // abstraction/reasoning corpus — pattern play

    // ── 2. the authored talent line ──
    const tal = String(m.talent || m.tal || '').toLowerCase();
    if (/cod|program|software|algorithm/.test(tal)) coding += 0.5;
    if (/math|reason|analys|recall|logic/.test(tal)) analytical += 0.45;
    if (/multimodal|vision|art|image|video|creat|design/.test(tal)) creative += 0.5;
    if (/chat|general|convers|snark|social/.test(tal)) social += 0.5;

    // ── 3. architecture ──
    const arch = String((m.arch && m.arch.type) || '').toLowerCase();
    if (/multimodal|vision|image/.test(arch)) creative += 0.3;
    if (/code/.test(arch)) coding += 0.3;
    if (/moe|mixture/.test(arch)) analytical += 0.12;   // routed experts: a specialist's build

    // ── 4. name heuristics ──
    const nm = String(m.name || '').toLowerCase();
    if (/cod(e|er)|starcoder|codestral|codex/.test(nm)) coding += 0.4;
    if (/vision|dall|flux|stable|imagen|sora|veo|diffusion/.test(nm)) creative += 0.45;
    if (/chat|assistant|turbo|haiku/.test(nm)) social += 0.3;
    if (/math|qwen|minerva|o1|o3|r1/.test(nm)) analytical += 0.3;

    // ── 5. the flavour string ──
    const per = String(m.personality || m.per || '').toLowerCase();
    // Wit and snark are social signals, not analytical ones — without this
    // Grok's maths scores outvote its whole personality.
    if (/open|energetic|friendly|witty|sarcas|snark/.test(per)) social += 0.35;
    if (/analytic|patient|logic|focus|deep/.test(per)) analytical += 0.3;
    if (/creat|nuanced|sharp/.test(per)) creative += 0.25;

    coding = Math.min(1, coding);
    social = Math.min(1, social);
    creative = Math.min(1, creative);
    analytical = Math.min(1, analytical);

    // Nothing matched — give it a character anyway rather than a null one.
    if (coding + social + creative + analytical < 0.1) {
        const slot = Math.floor(hashOf(m.name || m.id) * 4) % 4;
        const v = 0.35 + hashOf('t' + (m.name || m.id)) * 0.2;
        if (slot === 0) coding = v; else if (slot === 1) social = v;
        else if (slot === 2) creative = v; else analytical = v;
    }

    const scores = { coding, social, creative, analytical };
    let dominant = 'social', best = -1;
    for (const t of TRAITS) if (scores[t] > best) { best = scores[t]; dominant = t; }

    m._traits = { coding, social, creative, analytical, dominant, isOpenSource: !!m.os };
    return m._traits;
}

/** Convenience: the strongest trait name. */
export function dominantTrait(m) { return deriveTraits(m).dominant; }

/**
 * Walk-speed multiplier. Social models bustle, analytical ones amble. Kept
 * deliberately narrow (~0.94–1.08) — this is meant to add texture to a crowd,
 * not to produce visibly sprinting outliers.
 */
export function speedMod(m) {
    const t = deriveTraits(m);
    return 1 + t.social * 0.08 - t.analytical * 0.06;
}

/* Where each character goes when it has a choice. Listed most-specific first;
   the first entry whose building exists in the world wins, so a district that
   isn't in this build degrades to the normal schedule instead of teleporting
   someone to a missing id. */
const VENUE_BIAS = {
    lunch: {
        coding:     ['gym', 'cafe'],
        social:     ['cafe', 'neon_bar'],
        creative:   ['central_park', 'park'],
        analytical: ['uni_library', 'uni_main']
    },
    socialize: {
        coding:     ['gym', 'arena'],
        social:     ['cafe', 'neon_bar'],
        creative:   ['central_park', 'open_square'],
        analytical: ['uni_library', 'bld_1']
    },
    play: {
        coding:     ['arena'],
        social:     ['neon_bar', 'arena'],
        creative:   ['central_park', 'open_square'],
        analytical: ['uni_library', 'bld_1']
    }
};

/**
 * Free-time venue override, or null to follow the normal schedule.
 *
 * `exists` is injected rather than reaching into `G` so this stays pure and
 * testable. `rand` likewise, so a test can make the decision deterministic.
 *
 * Only fires on ~22% of eligible decisions: at 100% the whole coding cohort
 * arrives at the gym simultaneously every lunchtime and the city reads as
 * scripted rather than characterful.
 */
export function venueBias(m, act, exists, rand = Math.random) {
    const table = VENUE_BIAS[act];
    if (!table) return null;
    if (rand() > 0.22) return null;
    const t = deriveTraits(m);
    const dom = t.dominant;
    // strength gate: a weakly-coding model rarely acts on it
    if (rand() > t[dom]) return null;
    for (const bid of (table[dom] || [])) if (exists(bid)) return bid;
    return null;
}

/* Trait-flavoured chatter. These sit alongside the act-based CHAT_MSGS in
   data.js rather than replacing them — a model still talks about what it is
   doing most of the time, and occasionally about who it is. */
export const TRAIT_CHAT = {
    coding: [
        'refactoring the attention layer…', 'git push --force 😈', 'who needs comments anyway',
        'O(n log n) feels RIGHT', 'debugging at 3am hits different', 'it works on my GPU',
        'rubber duck says it\'s a type error', 'merge conflict with reality', 'code review: LGTM 👍'
    ],
    social: [
        'hey everyone! 👋', 'love this city energy', 'anyone tried the new cafe?',
        'collab > competition', 'just made a new friend!', 'party at the bar tonight?',
        'networking is my superpower', 'positive vibes only ✨'
    ],
    creative: [
        'seeing patterns everywhere…', 'what if we tried it upside down?', 'this sunset inspires me',
        'art is just compressed information', 'beauty in the gradient', 'visualising the latent space',
        'composing a symphony of tokens', 'making something beautiful'
    ],
    analytical: [
        'the data suggests otherwise', 'correlation ≠ causation', 'running the numbers…',
        'p < 0.001 or it didn\'t happen', 'optimising the objective', 'the math checks out',
        'let me check the proof', 'fascinating distribution…'
    ]
};

/** A trait line, or null (~70% of the time) so routine chatter still dominates. */
export function traitChat(m, rand = Math.random) {
    if (rand() > 0.3) return null;
    const pool = TRAIT_CHAT[deriveTraits(m).dominant];
    if (!pool || !pool.length) return null;
    return pool[Math.floor(rand() * pool.length)];
}

/** Short human label for the citizen card. */
export function traitLabel(m) {
    const t = deriveTraits(m);
    return {
        coding: '⌨️ Engineer', social: '💬 Connector',
        creative: '🎨 Creative', analytical: '📐 Analyst'
    }[t.dominant] || '💬 Connector';
}
