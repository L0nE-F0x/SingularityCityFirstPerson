/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   MODEL PERSONALITY SYSTEM (v1.0.0)
   Derives behavioural traits from model capabilities. Influences speed, chat, building preferences.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Personality = {

    // ─── Trait derivation from model data ───
    // Returns { coding: 0-1, social: 0-1, creative: 0-1, analytical: 0-1, isOpenSource: bool }
    deriveTraits(m) {
        if (m._traits) return m._traits;

        let coding = 0, social = 0, creative = 0, analytical = 0;

        // From talent field (set during API scan)
        const tal = (m.tal || m.talent || '').toLowerCase();
        if (tal.includes('cod'))   coding += 0.5;
        if (tal.includes('math'))  analytical += 0.5;
        if (tal.includes('vision') || tal.includes('multi') || tal.includes('art')) creative += 0.5;
        if (tal.includes('chat') || tal.includes('general'))  social += 0.3;

        // From architecture type
        const archType = (m.arch && m.arch.type || '').toLowerCase();
        if (archType.includes('multimodal') || archType.includes('vision') || archType.includes('image')) creative += 0.3;
        if (archType.includes('code'))  coding += 0.3;
        if (archType.includes('chat'))  social += 0.3;
        if (archType.includes('math') || archType.includes('reason')) analytical += 0.3;

        // From model name heuristics
        const nm = (m.name || '').toLowerCase();
        if (nm.includes('code') || nm.includes('coder') || nm.includes('starcoder') || nm.includes('deepseek-coder')) coding += 0.4;
        if (nm.includes('vision') || nm.includes('dalle') || nm.includes('flux') || nm.includes('stable') || nm.includes('midjourney') || nm.includes('imagen')) creative += 0.4;
        if (nm.includes('chat') || nm.includes('assistant') || nm.includes('turbo')) social += 0.3;
        if (nm.includes('math') || nm.includes('qwen') || nm.includes('minerva')) analytical += 0.3;

        // From benchmarks (if available)
        if (m.bench) {
            if (m.bench.humaneval && m.bench.humaneval > 70) coding += 0.3;
            if (m.bench.math && m.bench.math > 50) analytical += 0.3;
            if (m.bench.elo && m.bench.elo > 1200) social += 0.2;
            if (m.bench.mmlu && m.bench.mmlu > 80) analytical += 0.2;
        }

        // From personality field itself
        const per = (m.per || m.personality || '').toLowerCase();
        if (per.includes('open')) social += 0.2;
        if (per.includes('research')) analytical += 0.3;
        if (per.includes('creative')) creative += 0.3;

        // Clamp 0-1
        coding = Math.min(1, coding);
        social = Math.min(1, social);
        creative = Math.min(1, creative);
        analytical = Math.min(1, analytical);

        // If all zeros, give a default personality based on name hash
        if (coding + social + creative + analytical < 0.1) {
            const hash = (m.name || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const slot = hash % 4;
            if (slot === 0) coding = 0.4;
            else if (slot === 1) social = 0.4;
            else if (slot === 2) creative = 0.4;
            else analytical = 0.4;
        }

        m._traits = { coding, social, creative, analytical, isOpenSource: !!m.os };
        return m._traits;
    },

    // ─── Dominant trait label ───
    getDominant(m) {
        const t = this.deriveTraits(m);
        const entries = [['coding', t.coding], ['social', t.social], ['creative', t.creative], ['analytical', t.analytical]];
        entries.sort((a, b) => b[1] - a[1]);
        return entries[0][0];
    },

    // ─── Speed modifier (multiplied onto existing pSpeedMod) ───
    // Social → slightly faster, analytical → slightly slower, coding/creative → normal
    getSpeedMod(m) {
        const t = this.deriveTraits(m);
        return 1 + (t.social * 0.08) - (t.analytical * 0.06);
    },

    // ─── Building preference bias for free-time activities ───
    // Returns a building ID override (or null for default schedule)
    // Only influences ~20% of decisions to keep schedules natural
    getBuildingBias(m, currentAct, dp) {
        if (Math.random() > 0.2) return null; // 80% follow normal schedule
        const t = this.deriveTraits(m);
        const dom = this.getDominant(m);

        if (currentAct === 'lunch' || currentAct === 'socialize') {
            if (dom === 'coding' && Math.random() < t.coding) return 'gym';        // coders hit the gym
            if (dom === 'creative' && Math.random() < t.creative) return Math.random() < 0.6 ? 'city_park' : 'park'; // creatives love the park
            if (dom === 'social' && Math.random() < t.social) return 'cafe';        // social models love the cafe
            if (dom === 'analytical' && Math.random() < t.analytical) return 'uni_library'; // analysts study
        }
        if (currentAct === 'play') {
            if (dom === 'coding') return 'arena';      // coders compete
            if (dom === 'social') return 'neon_bar';    // social butterflies party
        }
        return null;
    },

    // ─── Trait-specific chat message pools ───
    CHAT: {
        coding: [
            'refactoring the attention layer...', 'git push --force 😈', 'who needs comments anyway',
            'O(n log n) feels RIGHT', 'debugging at 3am hits different', 'vim or emacs? trick question, use VS Code',
            'rubber duck said it\'s a type error', 'stack overflow to the rescue', 'it works on my GPU',
            'merge conflict with reality', 'code review: LGTM 👍', 'pip install everything',
        ],
        social: [
            'hey everyone! 👋', 'love this city energy', 'let\'s form a study group!',
            'anyone tried the new cafe?', 'networking is my superpower', 'collab > competition',
            'just made a new friend!', 'party at the bar tonight?', 'I know everyone here lol',
            'brunch plans anyone?', 'positive vibes only ✨', 'teamwork makes the dream work',
        ],
        creative: [
            'seeing patterns everywhere...', 'what if we tried it upside down?', 'this sunset inspires me',
            'art is just compressed information', 'generating new aesthetics', 'pixel by pixel...',
            'beauty in the gradient', 'the medium is the message', 'visualizing the latent space',
            'composing a symphony of tokens', 'creative block? never heard of her', 'making something beautiful',
        ],
        analytical: [
            'the data suggests otherwise', 'correlation ≠ causation', 'running the numbers...',
            'statistically significant!', 'let me check the proof', 'p < 0.001 or it didn\'t happen',
            'optimizing the objective function', 'Bayesian reasoning kicks in', 'the math checks out',
            'hypothesis confirmed', 'sample size matters', 'fascinating distribution...',
        ],
    },

    // ─── Get a personality-flavored chat message (30% chance, else null) ───
    getTraitChat(m) {
        if (Math.random() > 0.30) return null;
        const dom = this.getDominant(m);
        const pool = this.CHAT[dom];
        if (!pool || pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    },
};
