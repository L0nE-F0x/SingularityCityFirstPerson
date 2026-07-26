-- ════════════════════════════════════════════════════════════════════════════
-- rls_all.sql — the COMPLETE, committed RLS posture for every Singularity City
-- table. Supersedes sc_models_rls.sql (which still allowed anon INSERT/UPDATE
-- on `models` — meaning anyone with the publishable key could poison the shared
-- dataset for all visitors).
--
-- Posture after running this file:
--   • anon / authenticated: SELECT ONLY on every table below. No INSERT, no
--     UPDATE, no DELETE — every prior write policy is dropped, whatever it was
--     named.
--   • All writes go through Netlify functions holding SUPABASE_SERVICE_KEY
--     (service role bypasses RLS): submit-data.mjs validates client-submitted
--     rows (models/founders/families/blds/dc_facilities/ai_events/vc_deals/
--     supply_chain); the scheduled writers own the rest.
--   • The `record_visit` RPC keeps working: it is SECURITY DEFINER, so the
--     visitor counter needs no table-level write access.
--
-- Paste this whole file into the Supabase SQL Editor and Run. Idempotent —
-- safe to re-run any time; tables that don't exist yet are skipped.
--
-- ⚠ Deploy order: push the submit-data function FIRST (same deploy as the
-- client changes), verify the site works, THEN run this file. Running it
-- before submit-data is live would break client writes with no fallback.
-- After running, rotate the publishable (anon) key in the Supabase dashboard —
-- the old one has been write-capable and public in git history.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    t text;
    p record;
    tables text[] := array[
        -- curated core (read by fetchCoreData)
        'labs', 'founders', 'compute_clusters', 'blds', 'acts', 'families',
        'ai_events', 'dc_facilities',
        -- living dataset
        'models',
        -- feed-derived rows (previously anon-writable from the browser)
        'vc_deals', 'supply_chain',
        -- server-written tables (re-assert read-only; harmless if already so)
        'sc_events', 'ai_bans', 'sc_metrics_history', 'vc_funding',
        'grid_data', 'port_commodities',
        'newspaper_editions', 'newspaper_edition_html',
        -- visitor counter table: reads allowed; writes only via record_visit()
        'visitor_counter'
    ];
begin
    foreach t in array tables loop
        if exists (select from pg_tables where schemaname = 'public' and tablename = t) then
            execute format('alter table public.%I enable row level security', t);

            -- Drop EVERY existing policy (any name, any command) so no stray
            -- anon INSERT/UPDATE path survives under a forgotten policy name.
            for p in
                select policyname from pg_policies
                where schemaname = 'public' and tablename = t
            loop
                execute format('drop policy %I on public.%I', p.policyname, t);
            end loop;

            execute format(
                'create policy %I on public.%I for select to anon, authenticated using (true)',
                t || ' anon read', t
            );
            raise notice 'locked down: % (read-only for anon)', t;
        else
            raise notice 'skipped (missing): %', t;
        end if;
    end loop;
end $$;

-- Verify with:
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' order by tablename;
-- Every listed table should show exactly one SELECT policy and nothing else.
