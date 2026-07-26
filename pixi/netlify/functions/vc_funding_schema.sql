-- ════════════════════════════════════════════════════════════════
-- vc_funding — aggregate per-lab AI funding totals + valuations.
-- Written by netlify/functions/update-vc-funding.mjs (service role).
-- Read (public) by js/api.js fetchVCFunding(), which MAX-merges these
-- values against the curated VCRow.FUNDING baseline in js/vc_row.js —
-- so this table can only ever RAISE a valuation, never mask a fresher
-- curated one. Run this ONCE in the Supabase SQL editor.
--
-- Idempotent: safe to re-run. `add column if not exists` reconciles an
-- existing (possibly older) table so the writer never hits a missing column.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.vc_funding (
    lab_id       text primary key,
    total_m      numeric,        -- total raised, $millions
    valuation_m  numeric,        -- latest valuation, $millions
    rounds       text,           -- human-readable round history (cosmetic)
    source       text,           -- provenance of the latest auto-detected bump
    source_url   text,           -- link to the headline that moved it
    updated_at   timestamptz default now()
);

-- Reconcile columns on any pre-existing table (no-ops if already present).
alter table public.vc_funding add column if not exists total_m      numeric;
alter table public.vc_funding add column if not exists valuation_m  numeric;
alter table public.vc_funding add column if not exists rounds       text;
alter table public.vc_funding add column if not exists source       text;
alter table public.vc_funding add column if not exists source_url   text;
alter table public.vc_funding add column if not exists updated_at   timestamptz default now();

-- RLS: public read, no anon writes. The service role (used by the Netlify
-- function) bypasses RLS entirely, so no write policy is needed.
alter table public.vc_funding enable row level security;

drop policy if exists vc_funding_public_read on public.vc_funding;
create policy vc_funding_public_read
    on public.vc_funding for select
    using (true);
