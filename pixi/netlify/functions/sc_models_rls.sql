-- ════════════════════════════════════════════════════════════════════════════
-- ⚠ SUPERSEDED by rls_all.sql — do not run this file anymore.
-- This version still allowed anon INSERT/UPDATE on `models`, which let anyone
-- with the (public) publishable key vandalize the shared dataset. rls_all.sql
-- makes every table anon read-only; writes now go through the submit-data
-- Netlify function (service key + per-row validation). Kept for history only.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- models — lock down destructive access for the anon (publishable) key.
--
-- WHY: until v484 every visitor's browser ran purge/dedupe against the cloud DB,
-- so the anon key needed DELETE on `models` — meaning anyone could wipe the whole
-- table from the devtools console. Destructive maintenance now lives in the
-- db-maintenance.mjs scheduled function (SUPABASE_SERVICE_KEY bypasses RLS), and
-- the browser only needs SELECT / INSERT / UPDATE (model discovery upserts and
-- price/benchmark backfills still happen client-side by design — the app is
-- self-maintaining).
--
-- Paste this whole file into the Supabase SQL Editor and Run. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

alter table models enable row level security;

-- Drop EVERY existing DELETE policy on models, whatever it was named — after this,
-- no anon/authenticated delete path exists (service role is unaffected by RLS).
do $$
declare p record;
begin
    for p in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = 'models' and cmd = 'DELETE'
    loop
        execute format('drop policy %I on models', p.policyname);
    end loop;
end $$;

-- Keep the non-destructive paths the app actually uses.
drop policy if exists "models anon read" on models;
create policy "models anon read"
    on models for select
    to anon, authenticated
    using (true);

drop policy if exists "models anon insert" on models;
create policy "models anon insert"
    on models for insert
    to anon, authenticated
    with check (true);

drop policy if exists "models anon update" on models;
create policy "models anon update"
    on models for update
    to anon, authenticated
    using (true)
    with check (true);

-- That's it. Verify with:
--   select policyname, cmd from pg_policies where tablename = 'models';
-- (You should see select/insert/update policies and NO delete policy.)
