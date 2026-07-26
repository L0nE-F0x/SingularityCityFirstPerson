-- ════════════════════════════════════════════════════════════════════════════
-- ai_bans — government-ban registry for the AI Detention Center (js/jail.js).
--
-- AUTO-MAINTAINED. The update-ai-bans.mjs scheduled function reads real-world AI
-- regulation news and WRITES rows here when a government bans/suspends a model,
-- and DELETES them when the coverage goes stale (ban presumed lifted). The browser
-- client (JailData.fetchRemoteBans) only reads. You never have to touch this table.
--
-- Each bot row is keyed by `ban_key` (e.g. 'news:deepseek:TR') so re-runs upsert in
-- place, and `managed_by='news_bot'` so the bot only ever deletes its own rows —
-- any row you add by hand (managed_by='manual') is left untouched.
--
-- Paste this whole file into the Supabase SQL Editor and Run. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists ai_bans (
    id          bigint generated always as identity primary key,
    ban_key     text,                                  -- stable natural key for bot rows (null for manual)
    managed_by  text not null default 'manual',        -- 'news_bot' (auto) | 'manual' (hand-added)
    label       text,                                  -- chip on the detainee, e.g. 'Italy'
    authority   text,                                  -- who issued it, e.g. 'Italy'
    scope       text not null default 'global',        -- 'global' OR '{"countries":["TR"]}'
    until       date,                                  -- optional hard auto-release date
    reason      text,                                  -- one line shown in the cell / tooltip (the headline)
    source      text,                                  -- click-through URL to the news/order
    match_lab   text,                                  -- lab id to jail wholesale, e.g. 'deepseek'
    match_name  text,                                  -- case-insensitive regex on model name, e.g. 'gemini'
    active      boolean not null default true,         -- false = released (kept for history)
    last_seen   timestamptz,                           -- last time the news bot confirmed this ban
    created_at  timestamptz not null default now(),
    constraint ai_bans_has_target check (match_lab is not null or match_name is not null),
    constraint ai_bans_scope_shape check (scope = 'global' or scope like '{%}')
);

-- Idempotent upgrades if you created an earlier version of the table.
alter table ai_bans add column if not exists ban_key    text;
alter table ai_bans add column if not exists managed_by text not null default 'manual';
alter table ai_bans add column if not exists last_seen  timestamptz;

-- on_conflict=ban_key upserts need this; nulls are allowed so manual rows don't collide.
create unique index if not exists ai_bans_ban_key_key on ai_bans (ban_key);
create index if not exists idx_ai_bans_active  on ai_bans (active);
create index if not exists idx_ai_bans_managed on ai_bans (managed_by, last_seen);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Reads: public (anon key) — the browser needs to see the bans.
-- Writes: none for anon → only the update-ai-bans function (SUPABASE_SERVICE_KEY,
-- which bypasses RLS) writes/deletes, exactly like sc_events / collect-events.
alter table ai_bans enable row level security;

drop policy if exists "ai_bans anon read" on ai_bans;
create policy "ai_bans anon read"
    on ai_bans for select
    to anon, authenticated
    using (true);

-- That's it — no inserts needed. The scheduled function fills the table from live
-- news within its first run (6-hourly cron, or hit /.netlify/functions/update-ai-bans
-- once to seed it immediately). To pin a ban by hand anyway, insert a row with
-- managed_by='manual' and the bot will leave it alone.
