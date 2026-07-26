# Singularity City — Monthly Maintenance

**Mission:** this app is a global central hub for AI & the Singularity. The overriding priority is **accuracy, relevance, and cutting-edge currency**. Nothing shown may be outdated, false, or hallucinated. Prefer live/self-updating sources; for everything else, this checklist keeps it true.

Work through this on the **1st of each month** (or when you review the automated PR). Tick the boxes; anything you can't verify, flag rather than guess.

---

## Part A — The auto-update layer (VERIFY it's alive, don't hand-edit)

Most numbers update themselves. The real risk is a **silently dead source** showing stale/empty data while looking fine. Once a month, confirm each is actually flowing. Symptom column = what you'd see if it broke.

| Source | What it feeds | Cadence | How to verify | Symptom if dead |
|---|---|---|---|---|
| `netlify/functions/collect-events.mjs` | Events + rocket launches | hourly | Space Zone shows upcoming launches with live countdowns | "0 upcoming launches", empty events |
| Launch Library 2 (`ll.thespacedevs.com`) | Live launch data (client) | 15-min cache | Rockets on pads show real mission names/countdowns | Pads idle, no countdowns |
| `update-commodities.mjs` → Supabase `port_commodities` | Port cargo prices | daily 06:00 UTC | Port manifest prices differ from the hardcoded fallback | All prices match `_loadFallbackPrices` exactly |
| CoinGecko (`api.coingecko.com`) | Cryptex crypto ticker | on load | Cryptex ticker scrolls live BTC/ETH prices | "booting market feed…" stuck |
| `update-grid-background.mjs` → Overpass/OpenInfraMap | Global power-grid panel | weekly Mon 04:00 UTC | Power panel shows "REAL-WORLD" global grid card | Only the in-game sim grid shows |
| `snapshot-metrics.mjs` → `sc_metrics_history` | Terminal long-memory metrics | daily 05:15 | Terminal history charts extend to yesterday | History flat / stops on an old date |
| `update-ai-bans.mjs` | AI Detention Center (geo-scoped bans) | every 6h | Jailed models match current real gov bans; released ones clear | Stale jail roster (e.g. a lifted ban still shown) |
| `publish-newspaper-edition.mjs` | The Singularity City Times | daily 00:00 UTC | Newspaper front page dated today/yesterday | Old edition date |
| `hn-ai-stories.mjs` | HN AI headlines | on demand | News ticker shows recent HN AI stories | Stale/empty headlines |
| `db-maintenance.mjs` | Supabase cleanup | every 6h | (silent) — check Netlify function logs occasionally | — |
| Model scanner (client, API-key) | Tech District real models | on scan | Newly-released real models appear as citizens | No new models in weeks |
| `API.vcDeals` (RSS) | VC Row deal ticker | on load | VC Row ticker shows recent funding headlines | Only generic fallback lines |
| `update-vc-funding.mjs` → Supabase `vc_funding` | VC Row lab valuations | daily 07:00 UTC | `vc_funding` has rows w/ fresh `updated_at`; a lab's valuation can auto-raise from news | Empty table (client silently falls back to hardcoded `VCRow.FUNDING`) |

**Monthly check:** [ ] Open the app, spot-check each row above. [ ] Skim Netlify function logs for red (failed invocations). [ ] If any source is dead, fixing it is higher priority than any data edit — a broken feed is a silent accuracy failure.

---

## Part B — Review & merge the automated PR

The scheduled task **`monthly-ai-zone-refresh`** (runs 1st of month, 9am) opens a review-first PR that patches the qualitative `milestone`/`facts` fields across all zones.

- [ ] Open the PR (`gh pr view` or GitHub). Read the **Sources** list — every claim must trace to a real, reputable URL.
- [ ] Sanity-check each changed fact against your own knowledge. Reject anything unsourced, vague, or that "feels" like a hallucination.
- [ ] Confirm it only touched data strings (no logic/id/structure changes).
- [ ] Merge → Netlify deploys. If it opened no PR ("no material changes"), that's fine.

The agent **updates existing entries** but won't reliably **add brand-new orgs** or make judgment calls — that's Part C.

---

## Part C — Manual monthly checklist (what nothing can auto-update)

The agent refreshes what exists. **You** decide what's missing. Go zone by zone and ask: *did a new player emerge, did someone's status change, did a fact decay?*

### C1. Roster completeness — ADD new entrants
New orgs appear constantly; the map must not calcify. Add real newcomers to the relevant data file:
- [ ] **Frontier labs** → handled by the live model scanner (Tech District). Confirm big new labs actually got scanned in.
- [ ] **Humanoid robots** (`js/robotics_zone.js` `ROBOTICS_COMPANIES` + `js/robot_models.js` silhouette) — new company shipping a humanoid?
- [ ] **Rockets / space orgs** (`js/space_data.js` `SPACE_ORGS` + `SpaceRockets`) — new launcher or agency?
- [ ] **Energy deals** (`js/power_zone.js` `SOURCES`) — new AI-power facility (nuclear restart, SMR, fusion, gas)?
- [ ] **VC firms / mega-rounds** (`js/vc_row.js` `FIRMS` + `FUNDING`) — new fund or a lab's new valuation?
- [ ] **Longevity / AI-bio** (`js/longevity_zone.js` `LONGEVITY_COMPANIES`) — new drug in trials, new company?
- [ ] **Agent frameworks** (`js/agents_zone.js` `AGENT_FRAMEWORKS`) — new framework/agent product breaking out?
- [ ] **Data centers / fabs** (`js/datacenter_data.js` `DC_FACILITIES`) — new mega-campus or fab announced?

### C2. Leadership & people — the fastest-decaying facts
CEOs, leads and partners change roles often; a wrong name is an obvious error.
- [ ] Skim every `ceo`/`lead`/`partner` field across `space_data.js`, `robotics_zone.js`, `vc_row.js` (FIRMS), `longevity_zone.js`, `agents_zone.js`, `alignment_forest.js`, `embassy_row.js`. Verify each is still in role.

### C3. Fast-decaying facts
- [ ] **Valuations** (`vc_row.js` `FUNDING`) — OpenAI/Anthropic/xAI/Mistral etc. round + valuation still current?
- [ ] **Model/hardware generation** — references to specific models or chips (e.g. NVIDIA gen in `datacenter_data.js`, model names in descs) still the latest shipping?
- [ ] **Construction → operational** (`datacenter_data.js`, `power_zone.js`) — did a "construction" facility go live? Update `status`/`completion`.
- [ ] **Court cases** (`js/court.js` `DOCKET`) — did a case settle, get a ruling, or get appealed? Update `status`/`note`.
- [ ] **AI policy** (`js/embassy_row.js`) — new law, enforcement action, or leadership/framework change per country?
- [ ] **Safety orgs** (`js/alignment_forest.js`) — major new paper or milestone?

### C4. Cross-zone consistency
A single real event ripples across zones — make sure it's reflected everywhere.
- [ ] A merger/acquisition (e.g. SpaceX•xAI) must read consistently in every zone that mentions it (Space, VC Row, Compute, Embassy…).
- [ ] A lab's new model shouldn't show an old flagship in one zone and a new one in another.

### C5. Known traps (do NOT reintroduce)
- [ ] **No frozen version ceilings** for gpt/claude/gemini/grok — never re-add a "do not exceed vX" cap. New flagships must be able to appear. (See `memory/project_model_version_ceilings.md`.)
- [ ] **Seed bans need an `until`** in the jail or they never auto-release.
- [ ] After edits: run `node tools/cachebust.mjs` (bumps `?v=` + `sw.js` cache) or the deploy serves stale assets.

---

## Part D — Quarterly / deeper (every ~3 months)

- [ ] **Benchmark refresh** — are the benchmarks named in `js/university.js` (MMLU, GPQA, SWE-bench, ARC-AGI, HLE) still the ones the field cares about? Add the new saturating benchmark.
- [ ] **Graveyard / deprecations** — are retired/deprecated models reflected (model graveyard, tombstones)?
- [ ] **Dead-link sweep** — check external URLs in panels/sources still resolve.
- [ ] **Reduce the manual surface** (see backlog below).

---

## Part E — Backlog: make more of it auto (reduce the manual load)

Every item here is a chance to turn a hand-maintained string into a live feed — the long game for "the app updates itself":
- [x] Move `vc_row.js` `FUNDING` valuations to a small Supabase table refreshed by a scheduled function (like `port_commodities`). **Done (2026-07):** `update-vc-funding.mjs` (daily) writes the curated floor to `vc_funding` and auto-raises a lab's valuation from venture RSS (monotonic + band-guarded); client MAX-merges so code stays authoritative. One-time setup: run `netlify/functions/vc_funding_schema.sql`. Curated floor in the function's `BASELINE` should be kept roughly in sync with `VCRow.FUNDING`.
- [ ] Consider a Netlify function that pulls funding-round headlines into `FIRMS[*].milestone` automatically (with the same review-PR gate).
- [x] A lightweight "data freshness" self-check. **Done (2026-07):** `node tools/freshness.mjs [months]` scans every `js/*.js` for `milestone:` strings, parses the leading date, and flags any feed whose newest milestone is older than the threshold (default 6 months), counting undated ones too. Robust source-scan (no per-zone object coupling); exits 1 if any dated feed is stale so it can gate a pre-refresh check. Run it at the top of this checklist each month.
- [x] Auto-flip `datacenter_data.js` construction→operational from `completion` dates. **Verified (2026-07):** `DCManager.checkCompletions()` fires from `evolveCity` (engine.js) and on boot; a backdated-completion test flips status→operational, updates the BLDS entry, syncs to Supabase, toasts, and rebuilds. All 6 current construction sites correctly stay pending (completions 2027–2028).

---

## Part F — Accuracy incident response

If you (or a user) spot something wrong on the live site:
1. Fix the data string in the relevant `js/*.js` file.
2. `node tools/cachebust.mjs`
3. Commit + push to `main` (auto-deploys). For anything uncertain, branch + PR instead.
4. If it was a whole class of error (e.g. a dead API), fix the source, not just the symptom.

**The rule:** when unsure whether a fact is current, remove or soften it rather than assert something possibly false. An honest gap beats a confident error.
