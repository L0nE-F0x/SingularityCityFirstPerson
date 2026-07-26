-- ════════════════════════════════════════════════════════════════════════════
-- sc_events — server-side accumulated event log for News Reactivity, Citizen
-- of the Day, and Daily Briefing. The collect-events.mjs Netlify function
-- writes here hourly; the client reads via the anon key.
--
-- Each row is one "thing that happened in AI" — a HN story, a HuggingFace
-- release, a rocket launch, a paper, a leaderboard shake-up, etc. — already
-- classified into the city's 4 reaction archetypes so the client can fire
-- visuals directly from this table without re-classifying.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists sc_events (
    id           text primary key,                     -- e.g., "hn:45891", "hf:anthropic/claude-3-opus", "ll2:8a3b…"
    source       text not null,                        -- 'hn' | 'hf' | 'launch_lib' | 'arxiv' | 'zeroeval' | 'finnhub' | 'news_engine'
    event_type   text not null,                        -- 'celebrate' | 'crisis' | 'emergency' | 'regulatory' | 'launch' | 'release' | 'paper' | 'benchmark'
    archetype    text,                                 -- 'Launch Party' | 'Crisis Flicker' | 'Emergency Huddle' | 'Court Convene' (for briefing display)
    emoji        text,                                 -- 🎉 | 😰 | 🚁 | ⚖️ | 🚀 | 📰
    lab          text,                                 -- 'openai' | 'anthropic' | 'xai' | 'google' | ... or null for general events
    title        text not null,                        -- the headline / story title shown in briefing's lower-third
    url          text,                                 -- click-through link
    score        int default 50,                       -- 0–100 significance for ranking (HN upvotes, HF downloads, etc.)
    ts           timestamptz not null default now(),   -- when the source published it
    event_date   date not null,                        -- UTC date for daily-briefing grouping
    created_at   timestamptz not null default now()    -- when we inserted into sc_events
);

create index if not exists idx_sc_events_date on sc_events (event_date desc);
create index if not exists idx_sc_events_ts on sc_events (ts desc);
create index if not exists idx_sc_events_source on sc_events (source);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Reads: public (anon key). Writes: service-role only (collect-events.mjs).
alter table sc_events enable row level security;

drop policy if exists "sc_events anon read" on sc_events;
create policy "sc_events anon read"
    on sc_events for select
    to anon, authenticated
    using (true);

-- Service role bypasses RLS by default; no insert/update/delete policies for
-- anon means writes require SUPABASE_SERVICE_KEY (which only the Netlify
-- function has).
