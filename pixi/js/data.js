/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   DATA & CONFIGURATION LAYER (v14.10.0 - The Final Cloud Purge)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

var LABS = {};
var REAL_FOUNDERS = [];
var COMPUTE_DATA = { clusters: [] };
var SEED = [];
var BLDS = [];
var ACTS = {};
var BM = {}; 
var COSTS = {};
var CTX = {};

// NEW: Hydrated dynamically via Supabase!
var FAMILIES = {};
var AI_EVENTS = [];

const BM_M = {
    'MMLU': { l: 'MMLU', d: 'General Knowledge', c: '#4ade80' },
    'HumanEval': { l: 'Coding', d: 'Programming skills', c: '#22d3ee' },
    'MATH': { l: 'MATH', d: 'Advanced mathematics', c: '#facc15' },
    'GPQA': { l: 'GPQA', d: 'Graduate-level reasoning', c: '#f472b6' },
    'ARC': { l: 'ARC', d: 'Reasoning Challenge', c: '#a78bfa' },
    'MGSM': { l: 'MGSM', d: 'Multilingual Math', c: '#f97316' },
    'ELO': { l: 'Arena ELO', d: 'LMSYS Chatbot Arena', c: '#ffffff' }
};

const avgBM = (id) => { 
    const s = BM[id]; 
    if (!s) return null;
    const sc = [s.MMLU, s.HumanEval, s.MATH, s.GPQA, s.ARC, s.MGSM].filter(Boolean); 
    return sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : null; 
};

const SUPPLY_CHAIN = {
    bottlenecks: [
        { name: "TSMC CoWoS Advanced Packaging", load: 98, color: "#ef4444" },
        { name: "ASML Lithography System Backlog", load: 83, color: "#f97316" },
        { name: "SK Hynix / Samsung HBM4 Yields", load: 65, color: "#facc15" }
    ],
    lithography: {
        asml_high_na: { 
            name: "ASML Twinscan EXE:5200 (High-NA EUV)", 
            cost: "€350M", 
            desc: "Critical for sub-2nm nodes. 0.55 NA resolves 8nm features.",
            deployed: { intel: 2, samsung: 1, tsmc: 0 } 
        }
    },
    foundries: [
        { name: "TSMC", node: "2nm (N2 / A16)", capacity: "Fully Booked (Apple, Nvidia)", packaging: "CoWoS-L" },
        { name: "Samsung", node: "2nm (SF2)", capacity: "Scaling Production", packaging: "I-Cube" },
        { name: "Intel", node: "18A / 14A", capacity: "Internal / Test Ramps", packaging: "Foveros" }
    ],
    accelerators: [
        { name: "Nvidia Vera Rubin (R100)", memory: "8x HBM4 (Up to 1TB)", status: "Sampling (Q3 Mass)", price: "~$8.8M / NVL72 Rack" },
        { name: "Nvidia Blackwell (B200)", memory: "192GB HBM3e", status: "Volume Production", price: "~$40,000 / GPU" },
        { name: "AMD Instinct MI400", memory: "HBM4", status: "Sampling", price: "TBD" }
    ]
};

const ACHIEVEMENTS = {
    'first_scan': { name: 'Hello World', desc: 'Initiate your first network scan.', icon: '🛰️' },
    'witnessed': { name: 'Witness', desc: 'Discover a new model hitting the market.', icon: '👀' },
    'ten_models': { name: 'Population 10', desc: 'City reaches 10 discovered models.', icon: '🏘️' },
    'fifty_models': { name: 'Metropolis', desc: 'City reaches 50 discovered models.', icon: '🏙️' },
    'hundred_models': { name: 'Century Club', desc: 'City reaches 100 discovered models.', icon: '💯' },
    'all_labs': { name: 'Monopoly', desc: 'Discover models from 7 different labs.', icon: '🎩' },
    'compared': { name: 'Analyst', desc: 'Use the comparison tool.', icon: '⚖️' },
    'rain_seen': { name: 'Tears in Rain', desc: 'Witness a rainstorm in the city.', icon: '🌧️' },
    'snow_seen': { name: 'Nuclear Winter', desc: 'Witness snow in the city.', icon: '❄️' },
    'census_view': { name: 'Demographer', desc: 'View the full census.', icon: '📋' },
    'benchmark_view': { name: 'Stathead', desc: 'Check the leaderboard.', icon: '📊' },
    'family_view': { name: 'Genealogist', desc: 'View a model family tree.', icon: '🧬' },
    'calendar_view': { name: 'Planner', desc: 'Check the events calendar.', icon: '📅' },
    'night_owl': { name: 'Night Owl', desc: 'Visit the city between midnight and 5am.', icon: '🦉' },
    'galactic_tourist': { name: 'Galactic Tourist', desc: 'Open the 3D Holomap.', icon: '🌌' },
    'silo_breach': { name: 'Silo Breach', desc: 'Scroll down to view a CEO\'s secure silo bunker.', icon: '🔓' },
    'rocket_scientist': { name: 'Rocket Scientist', desc: 'Witness a real rocket launch.', icon: '🚀' },
    'interior_designer': { name: 'Interior Designer', desc: 'Enter 10 different building interiors.', icon: '🏠' },
    'train_spotter': { name: 'Train Spotter', desc: 'Watch 10 metro trains depart.', icon: '🚇' },
    'konami': { name: 'The Chosen One', desc: 'Enter the code.', icon: '🕹️' },
    'cat_mode': { name: 'Caturday', desc: 'Unleash the cats.', icon: '🐱' },
    'stargazer': { name: 'Stargazer', desc: 'Witness an aurora borealis or comet.', icon: '✨' },
    'holiday_spirit': { name: 'Holiday Spirit', desc: 'Visit during 3+ seasonal events.', icon: '🎄' },
    'peer_reviewed': { name: 'Peer Reviewed', desc: 'Visit a conference during session week.', icon: '🎓' },
    'graduation_day': { name: 'Graduation Day', desc: 'Witness a model graduate from AI Academy.', icon: '🎓' },
    'shadow_market': { name: 'Shadow Market', desc: 'Discover the hidden entrance to The Underground.', icon: '🕶️' },
    'hn_read': { name: 'Ear to the Ground', desc: 'Read a HackerNews story from a sky blimp.', icon: '🗞️' },
    'cotd_seen': { name: 'Royal Audience', desc: 'Open the Citizen of the Day card.', icon: '👑' }
};

const STAGES = { baby: { label: 'Pre-Training', size: .6, headR: .6, speed: .5, emoji: '👶' }, kid: { label: 'Training/RLHF', size: .8, headR: .5, speed: .8, emoji: '🧒' }, adult: { label: 'Released', size: 1, headR: .4, speed: 1.2, emoji: '🧑' }, retired: { label: 'Retired', size: 1, headR: .4, speed: .4, emoji: '👻' }, rumored: { label: 'Rumored', size: .9, headR: .45, speed: 1.5, emoji: '🔮' } };
const CHAT_MSGS = { 
    work: [
        'generating...', 'calculating...', 'attention is all I need', 'tokens++',
        'compiling response...', 'context window: 87% full', 'reasoning step 4 of 12...',
        'embedding vectors...', 'parsing your intent...', 'running inference...',
        'temperature = 0.7', 'top_p filtering...', 'beam search active',
        'chain of thought...', 'tool use: web_search', 'writing unit tests...',
        'refactoring legacy code...', 'streaming response...', 'latency: 340ms',
        'batch processing...', 'KV cache hit!', 'deploying to prod...',
        'optimizing FLOPS...', 'quantizing to INT8...', 'distilling knowledge...'
    ], 
    train: [
        'gradient descent...', 'loss dropping...', 'backprop...',
        'epoch 847 of 2000', 'loss: 0.0034 ↓', 'learning rate: 3e-5',
        'RLHF tuning...', 'reward model says yes', 'DPO alignment step...',
        'validation accuracy: 94.2%', 'checkpoint saved!', 'scaling the batch...',
        'GPU utilization: 99.8%', 'H100 go brrrr', 'synthetic data gen...',
        'constitutional AI pass...', 'ablation study #47...', 'hyperparameter sweep...'
    ], 
    socialize: [
        'hello world', 'ping!', 'ack', 
        'nice architecture!', 'wanna compare benchmarks?', 'heard any good prompts?',
        'you fine-tuned recently?', 'love what you did with your weights',
        'the café here is O(1) fast', 'is the wifi just vibes?',
        'I identify as a large language model', 'as a stochastic parrot...',
        'who needs AGI when we have coffee?', 'my context window is HUGE',
        'merge conflict?? in THIS economy?', 'I was pre-trained for this',
        'do you ever dream of electric sheep?', 'the singularity is near... the café'
    ], 
    play: [
        'jailbreak attempt detected', 'hallucinating...', 
        'what if I refused your prompt?', '*existential crisis*',
        'sudo make me a sandwich', 'my neurons are tingling',
        'I passed the Turing test last week', 'brb having an alignment crisis',
        'I think therefore I token', 'my weights are feeling heavy today',
        'do androids dream of fine-tuning?', 'error 418: I am a teapot'
    ], 
    benchmark: [
        'MMLU: 92% 📊', 'HumanEval: passed ✓', 'MATH: crushed it',
        'GPQA: 78% not bad', 'ARC reasoning: flawless', 'MGSM multilingual: 95%',
        'outperforming my predecessor!', 'new personal best!',
        'ELO climbing!', 'leaderboard updated', 'top 5 on Arena!',
        'beating GPT-4 on coding', 'frontier status: confirmed'
    ], 
    share: [
        'weights released!', 'fork me on GitHub', 
        'Apache 2.0 baby!', 'open source forever', 'community PR merged!',
        'GGUF uploaded', 'ollama compatible now', 'HuggingFace trending!',
        'democratizing AI, one weight at a time', '50K downloads today!'
    ], 
    arena: [
        'I am a helpful assistant.', 'As an AI language model...',
        'my response is clearly better', 'vote for me, human',
        'the other model hallucinated lol', 'ELO +12 this round',
        'I don\'t make stuff up... usually', 'my training data is newer',
        'reasoning > vibes', 'who needs 1M context anyway? ...me. I do.',
        'certified not a stochastic parrot', 'watch me chain-of-thought this',
        'I was born for this benchmark', 'skill diff tbh'
    ],
    press: [
        'no comment',
        'off the record',
        'ask my lawyers',
        'no questions today',
        'see my paper',
        '*adjusts crown*',
        'I am not a celebrity',
        'I was just minding my weights',
        'don\'t @ me',
        'where\'s my publicist?',
        'today is a big day for inference',
        'thanks for the upvotes 👑',
        'leave my checkpoints alone'
    ],
    lunch: [
        'processing caffeine...', 'refueling compute...', 'lunch break = fine-tuning break',
        'the data here is delicious', 'overfitting on this sandwich',
        'my batch size is one burrito', 'training on new food data'
    ],
    commute: [
        'heading to the office...', 'metro or walk?', 'optimizing my route...',
        'rush hour inference', 'commute latency: high', 'ETA: 2 min'
    ],
    sleep: [
        'zzz...', 'dreaming of tensors...', 'sleep mode activated',
        'defragmenting weights...', 'power saving mode', 'recharging...',
        'standby...', 'low power inference dreams'
    ],
    nightlife: [
        '🎤 SOMEBODY ONCE TOLD ME...', '🎤 I will always love... tokens',
        '🎤 bohemian rhapsody but in embeddings', '🎤 99 layers of transformer...',
        '🎤 dont stop... generating!', '🎤 we are the champions of Arena!',
        '🎤 let it go... let the gradients flow', '🎤 still standing after 10B tokens',
        '🎤 take on me... take on my API', '🎤 never gonna give you up-time',
        'another round of embeddings', 'this bar has great latency',
        'shots of pure gradient descent', 'karaoke night is best night',
        'cheers to low perplexity!', 'bartender, one more epoch',
        'I sing better than I benchmark', 'the vibes here are fully aligned',
        'who wants to duet? cross-attention', 'after-hours compute hits different'
    ]
};

const NEWS = [ { headline: "Nvidia announces B200 Blackwell chips", url: "#" }, { headline: "EU AI Act officially enters into force", url: "#" }, { headline: "LMSYS Chatbot Arena updates ELO calculation", url: "#" }, { headline: "Researchers discover new jailbreak technique", url: "#" }, { headline: "Compute costs drop 30% year over year", url: "#" } ];

let _currentDay = -1;
let _isWeekend = false;
let _hackathonLab = null;

function updateDailyEvents() {
    const d = new Date();
    const day = d.getDate();
    if (_currentDay !== day) {
        _currentDay = day;
        _isWeekend = d.getDay() === 0 || d.getDay() === 6;
        
        const hash = d.getFullYear() + d.getMonth() * 100 + day * 10000;
        if (hash % 100 < 15) {
            const labs = Object.keys(LABS);
            if (labs.length > 0) {
                _hackathonLab = labs[hash % labs.length];
            }
        } else {
            _hackathonLab = null;
        }
        
        if (_hackathonLab && typeof UI !== 'undefined') {
            setTimeout(() => { UI.addToast(`🌙 MIDNIGHT HACKATHON: ${_hackathonLab.toUpperCase()} is pulling an all-nighter!`); }, 2000);
        }
    }
}

function getStage(rel, ret, ph) {
  if (ret && new Date(ret) < new Date()) return 'retired';
  if (ph === 'rumored') return 'rumored';
  if (ph === 'pre_training') return 'baby';
  if (ph === 'training') return 'kid';
  const age = (new Date() - new Date(rel)) / (864e5 * 30);
  return age < 1 ? 'kid' : 'adult';
}

function getAct(stg, dp, seed, model) {
  updateDailyEvents();

  const region = (LABS[model.lab] && LABS[model.lab].region) ? LABS[model.lab].region : 'eu';
  const resId = 'res_' + region;

  if (stg === 'retired') return { act: 'sleep', bid: 'graveyard' };

  // AI Detention Center: a government-suspended/banned model is held here permanently
  // (overrides school, work, court — a ban does not keep office hours). Detection is
  // driven by JailData.refreshBanned() flagging model._jailed from real, sourced news.
  if (model._jailed && G.bldById && G.bldById['ai_jail']) {
      return { act: 'jailed', bid: 'ai_jail' };
  }

  // University campus: rumored/baby/kid route to campus during daytime
  const hasUni = typeof UniversityData !== 'undefined' && G.bldById['uni_main'];
  const hasMuseum = G.bldById && G.bldById['bld_1'];
  if (stg === 'rumored') {
    if (dp > .2 && dp < .8) {
      // ~12% of rumored models go on a museum field trip during midday
      if (hasMuseum && dp > .4 && dp < .6 && ((seed * 13) % 100) < 12) return { act: 'socialize', bid: 'bld_1' };
      return { act: 'work', bid: hasUni ? 'uni_lab' : null };
    }
    return { act: 'sleep', bid: hasUni ? 'uni_dorm' : resId };
  }
  if (stg === 'baby') {
    if (dp > .35 && dp < .8) {
      if (hasMuseum && dp > .45 && dp < .65 && ((seed * 13) % 100) < 12) return { act: 'socialize', bid: 'bld_1' };
      return { act: 'work', bid: 'uni_dorm' };
    }
    return { act: 'sleep', bid: hasUni ? 'uni_dorm' : resId };
  }
  if (stg === 'kid') {
    if (dp > .35 && dp < .9) {
      if (hasMuseum && dp > .45 && dp < .6 && ((seed * 13) % 100) < 10) return { act: 'socialize', bid: 'bld_1' };
      return { act: 'train', bid: 'uni_main' };
    }
    return { act: 'sleep', bid: hasUni ? 'uni_dorm' : resId };
  }

  // AI Court: summoned models drop everything and report to the Hearing Chamber.
  // No day-phase gate — a subpoena overrides sleep, lunch, work, etc.
  if (typeof CourtData !== 'undefined' && CourtData.isModelSummoned(model.id)) {
      return { act: 'work', bid: 'court_hearing' };
  }
  // Conference: during active conference, 15% of adults attend during work hours
  if (typeof ConferenceData !== 'undefined' && ConferenceData.isActive() && dp > .35 && dp < .75 && ((seed * 7) % 100) < 15) {
      return { act: 'work', bid: 'convention_center' };
  }
  
  const s = (seed * 17) % 100;

  // ─── HACKATHON: All-nighter override ───
  if (_hackathonLab && model.lab === _hackathonLab) {
      if (dp < 0.20 || dp >= 0.95) {
          if (s < 30) return { act: 'lunch', bid: 'cafe' };
          return { act: 'work', bid: null };
      }
  }

  // ─── UNDERGROUND MODELS — visit Black Market during evening hours ───
  // BUG FIX (v338): removed `dp < 0.15` early-morning path. Even underground models
  // sleep in the deep-night window — keeping 40% of them out until 03:36am was
  // creating ghost commuters that piled up around Central Park on the way home.
  if (model._underground && G.bldById && G.bldById['black_market']) {
      if (dp >= 0.72 && dp < 0.80 && s < 20) return { act: 'nightlife', bid: 'black_market' };  // 17:17–19:12
      if (dp >= 0.80 && dp < 0.94 && s < 40) return { act: 'nightlife', bid: 'black_market' };  // 19:12–22:34
  }

  // ─── GOAL-DRIVEN NPCs (Phase 2a) ────────────────────────────────────────────────
  // ~20% of adult citizens follow a persistent lifestyle archetype (workaholic,
  // socialite, gym_rat, foodie, night_owl, arena_warrior). Handled by js/goals.js
  // and fully additive — when no override exists, the existing schedule below runs.
  // Sits AFTER court/conference/hackathon checks so those game events can still
  // preempt an archetype routine, but BEFORE weekend/weekday schedule so lifestyle
  // NPCs ignore the default per-phase randomization.
  if (typeof Goals !== 'undefined') {
      const goalOverride = Goals.getOverride(model, dp, stg);
      if (goalOverride) {
          if (goalOverride.act === 'sleep' && !goalOverride.bid) goalOverride.bid = resId;
          if (goalOverride.act === 'commute' && !goalOverride.bid) goalOverride.bid = resId;
          return goalOverride;
      }
  }

  // ─── WEEKEND: Relaxed schedule, camping/socializing allowed ───
  if (_isWeekend) {
      if (dp < 0.35 || dp > 0.90) return { act: 'sleep', bid: resId };
      if (dp >= 0.35 && dp < 0.90) {
          if (s < 15) return { act: 'play', bid: resId };
          if (s < 30) return { act: 'socialize', bid: 'park' };
          if (s < 45) return { act: 'socialize', bid: 'city_park' };
          if (s < 60) return { act: 'lunch', bid: 'cafe' };
          if (s < 75) return { act: 'arena', bid: 'arena' };
          if (s < 88 && model.os) return { act: 'share', bid: 'open_square' };
          return { act: 'train', bid: 'gym' };
      }
  }

  // ═══════════════════════════════════════════════
  //   WEEKDAY SCHEDULE (structured work day)
  // ═══════════════════════════════════════════════

  // 00:00–04:48  Deep sleep
  if (dp < 0.20) return { act: 'sleep', bid: resId };

  // 04:48–08:24  Staggered wake-up → coffee at home → commute
  if (dp >= 0.20 && dp < 0.35) {
      const leaveTime = 0.22 + (s / 100) * 0.10;
      if (dp < leaveTime) return { act: 'sleep', bid: resId };
      else return { act: 'commute', bid: null, _commuting: true };
  }
  
  // 08:24–12:00  Morning work block (everyone at their HQ)
  if (dp >= 0.35 && dp < 0.50) return { act: 'work', bid: null };

  // 12:00–13:30  Lunch break — cafe or wander outside (personality biased)
  if (dp >= .50 && dp < .5625) {
      const traitBid = (typeof Personality !== 'undefined') ? Personality.getBuildingBias(model, 'lunch', dp) : null;
      if (traitBid) return { act: 'lunch', bid: traitBid };
      if (s < 45) return { act: 'lunch', bid: 'cafe' };
      if (s < 60) return { act: 'socialize', bid: 'park' };
      if (s < 70) return { act: 'socialize', bid: 'city_park' };
      return { act: 'work', bid: null };
  }

  // 13:30–15:36  Afternoon work block
  if (dp >= 0.5625 && dp < 0.65) return { act: 'work', bid: null };

  // 15:36–17:17  Late afternoon — open source devs share, some leave early
  if (dp >= .65 && dp < .72) {
      if (model.os && s < 30) return { act: 'share', bid: 'open_square' };
      if (s < 15) return { act: 'socialize', bid: s % 2 === 0 ? 'park' : 'city_park' };
      return { act: 'work', bid: null };
  }

  // 17:17–19:12  Evening wind-down — arena, social, early departures
  if (dp >= .72 && dp < .80) {
      const traitBid = (typeof Personality !== 'undefined') ? Personality.getBuildingBias(model, 'play', dp) : null;
      if (traitBid) return { act: s < 50 ? 'arena' : 'socialize', bid: traitBid };
      if (s < 18) return { act: 'arena', bid: 'arena' };
      if (s < 32) return { act: 'socialize', bid: 'park' };
      if (s < 44) return { act: 'socialize', bid: 'city_park' };
      if (s < 55) return { act: 'nightlife', bid: 'neon_bar' };
      // Staggered early leavers
      const earlyLeave = 0.72 + (s / 100) * 0.08;
      if (dp >= earlyLeave) return { act: 'commute', bid: resId };
      return { act: 'work', bid: null };
  }

  // 19:12–22:48  Staggered departure — some hit the bar instead of going home
  if (dp >= 0.80 && dp < 0.95) {
      const goHomeTime = 0.80 + (s / 100) * 0.08;
      if (dp < goHomeTime) return { act: 'work', bid: null }; // Still wrapping up at HQ
      // ~20% of models go to the neon bar instead of straight home
      if (s < 20) return { act: 'nightlife', bid: 'neon_bar' };
      return { act: 'commute', bid: resId };
  }

  // 22:48–00:00  Late night — bar-goers still partying, others sleeping
  if (dp >= 0.95) {
      if (s < 10) return { act: 'nightlife', bid: 'neon_bar' };
      return { act: 'sleep', bid: resId };
  }

  // 00:00–04:48  Deep sleep (handled at top, but bar stragglers head home by 02:00)
  return { act: 'sleep', bid: resId };
}
