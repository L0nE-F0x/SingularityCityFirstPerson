# Integration plan — Full dual-view app in this folder

**Status:** Vendored Pixi 2D + First Person live together in `SingularityCityFirstPerson`.  
**Production** `ApexForge/SingularityCity` is still the live source tree and remains **untouched**.  
**Goal:** Locally test the *future* combined product here until you are happy, then push **this** repo to replace production.

---

## What this folder is now

```
SingularityCityFirstPerson/          candidate future production
  home.html                          redirects to /pixi/ (2D entry)
  index.html + js/ + lib/            Three.js first-person (not the public entry)
  pixi/                              FULL copy of production Pixi 2D app
    index.html                       Landing + city (public entry)
    js/… + sc_integrated_bridge.js
    css/, data/, textures/, netlify/, …
  js/store/                          CityStore, live, nav hard-swap
  js/shell.js                        FP chrome + map overview + 2D City button
```

| View | URL (local) | How to reach the other |
|------|-------------|-------------------------|
| **2D (public entry)** | `/pixi/` (Netlify `/` → `/pixi/`) | Landing → **Enter Singularity City** |
| First Person | `/index.html` | **Only** from 2D toolbar **FP** (not from landing) |
| Dev shortcut | `/home.html` | Redirects to `/pixi/` |

Hard-swap uses a full navigation (dispose one renderer, load the other). Resume tokens: `sc_view_resume_v1`. Shared progress: `sc_city_save_v1` (+ legacy FP / soft-merge Pixi `sc_data` achievements).

Coordinate systems differ (Pixi linear X vs FP grid). Identity is district/building/progress, not pixel-perfect positions.

---

## Owner constraints (honoured)

1. Do **not** modify `ApexForge/SingularityCity` while iterating here.  
2. This monorepo is the sandbox for the combined app.  
3. When happy: deploy/push **this** tree to overwrite production (separate deliberate step).

---

## Run locally

```powershell
cd "C:\Users\TempleLodge\Desktop\SingularityCityFirstPerson"
python serve.py 8931
# 2D landing/city:  http://127.0.0.1:8931/pixi/
# First Person:     http://127.0.0.1:8931/index.html  (prefer toolbar 🚶 FP from 2D)
# home.html:        redirects to /pixi/
```

Tests:

```powershell
node tests/run_node_check.mjs
node tests/store_check.mjs
```

---

## Key integration files

| File | Role |
|------|------|
| `pixi/js/sc_integrated_bridge.js` | Only in the copy — FP button + progress merge + resume |
| `js/store/nav.js` | FP → Pixi hard-swap |
| `js/store/city_store.js` | Shared brain (FP side; Pixi uses same localStorage keys) |
| `js/shell.js` | FP shell + map overview + **2D City** |
| `home.html` | Redirects to 2D `/pixi/` |

---

## Later (when overwriting production)

Suggested deploy shape (adjust to your host):

1. Treat this repo (or a cleaned export) as the new singularitycity.net root.  
2. Either keep `pixi/` as `/` and FP as `/fp/`, or flatten after you pick defaults.  
3. Point Netlify/CDN at this build; keep ApexForge tree as rollback until verified.  
4. Re-test HTTPS pointer-lock for FP on the real domain.

**Not done yet:** single-page dual warm renderers, full CityStore TypeScript package shared as ESM inside Pixi globals, live model roster driving FP InstancedMeshes.

---

## Refreshing the Pixi vendored copy

If production 2D gets important fixes you want here **without** editing ApexForge from this work:

```powershell
# from SingularityCityFirstPerson — re-copy (destructive to pixi/ local bridge edits)
# Prefer re-applying sc_integrated_bridge.js after robocopy
robocopy ..\ApexForge\SingularityCity pixi /E /XD node_modules .git .claude
# then restore bridge script + script tag if overwritten
```

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-07-23 | Owner: integrate without touching production tree. |
| 2026-07-23 | Owner: copy full Pixi 2D into this folder so local app ≈ future combined product. |
| 2026-07-23 | Hard-swap navigation between `/` (FP) and `/pixi/` (2D); shared localStorage progress. |

---

## Session wrap (2026-07-23 evening)

**Owner:** Pausing for playtest. FP + vendored Pixi integration is in-folder; **not** shipping to production yet.

**Shipped integration pieces:** CityStore, live soft-reads, hard-swap FP↔`pixi/`, pause/P for pointer-lock exit to 2D.

**Explicit product bar (owner):** Same destinations and life as 2D — board trains, real elevators, founders/CEOs + helis + in-car visibility, working commute schedules, correct junctions/markings/lights, better interior props. See `RESUME.md` backlog and `PARITY.md` owner section.

**Do not implement production site merge until owner says the FP experience is good enough.**

| Date | Decision |
|------|----------|
| 2026-07-23 | Vendored full Pixi into `pixi/`; ApexForge remains read-only. |
| 2026-07-23 | No offline multiplayer placeholders. |
| 2026-07-23 | Session wrap — owner playtest; backlog documented in RESUME/PARITY. |

