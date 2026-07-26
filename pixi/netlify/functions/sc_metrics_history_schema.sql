-- ════════════════════════════════════════════════════════════════════════════════════════════
-- sc_metrics_history — daily global AI-industry snapshot for the Terminal's long memory.
-- Written once/day by netlify/functions/snapshot-metrics.mjs (service role, bypasses RLS).
-- Read publicly by the client (js/terminal.js → _lhFetchCloud) via the anon key.
--
-- Run this ONCE in the Supabase SQL editor (like sc_models_rls.sql / sc_ai_bans_schema.sql).
-- ════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.sc_metrics_history (
    day           date primary key,
    models        integer,
    active_models integer,
    labs          integer,
    top_elo       real,
    bench_ceiling real,
    captured_at   timestamptz default now()
);

alter table public.sc_metrics_history enable row level security;

-- Public read (anon key). No insert/update/delete policy exists, so only the service role
-- (which bypasses RLS) can write — exactly the snapshot function.
drop policy if exists "sc_metrics_history public read" on public.sc_metrics_history;
create policy "sc_metrics_history public read"
    on public.sc_metrics_history
    for select
    using (true);
