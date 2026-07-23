# Integration plan — First Person ↔ SingularityCity.net (shared city state)

**Status:** planning only — do not implement until the owner explicitly starts this work.  
**Written:** 2026-07-23 (owner commute handoff).  
**Audience:** the next Grok/Claude/agent session picking this up.

Read this **before** bolting live APIs, Supabase, or a view-toggle onto the first-person build.  
Also read `HANDOFF.md`, `PARITY.md`, `RESUME.md`, and (read-only) the production app when available.

---

## 1. Owner goal (source of truth for intent)

1. The first-person build is **not** a permanent standalone product.
2. It will eventually ship on **singularitycity.net** as an **extra feature**.
3. Users will **toggle** between:
   - **Pixi.js 2D view** — production app (`ApexForge/SingularityCity`, live today)
   - **Three.js first-person view** — this repo (`SingularityCityFirstPerson`)
4. **City state must be the same** no matter which mode is active:
   - same day/time/weather/climate where applicable
   - same citizens / schedule / named models
   - same live data (news, model releases, prices, AI index, etc.)
   - same Supabase-backed / account progress where the 2D app already has it
5. Live data pipelines and Supabase were **deliberately cut** from FP (`PARITY.md` non-goal; static `data.js`). That was correct for a prototype; it is **wrong** for the integrated product. Integration reopens that surface — carefully, through a shared store, not a second parallel client.

**Absolute constraints (unchanged):**

- **Never modify** production trees while exploring, unless the owner opens a dedicated integration PR in the real monorepo/site:
  - `ApexForge/SingularityCity` (production 2D) — read-only reference until a real integration branch is authorized
  - Failed experiment `SingularityCity3D` — catalog of what not to do
- FP performance doctrine still applies **inside** the Three view: instancing / merged static geo, no shadow maps, no post chain, no log-depth, no transmission. Live data must update **store fields**, not unbatched mesh spam.

---

## 2. Architectural thesis (one brain, two eyes)

| Layer | Responsibility |
|--------|----------------|
| **CityStore / GameState** | Canonical simulation + live overlays + progress. Single writer rules. |
| **View: Pixi 2D** | Production presentation (current singularitycity.net experience). |
| **View: Three FP** | Street-level presentation (this project). |
| **Shell** | Auth, feature flags, toggle UI, mount/unmount views, shared panels if any. |

**Do not** keep two independent apps that "sync sometimes" over Supabase.  
**Do** extract (or define) a shared state API; both renderers **subscribe** to it.

```
singularitycity.net (or monorepo shell)
  ├── bootstrap (auth, Supabase client, feature flags)
  ├── CityStore   ← single state + live subscriptions + save
  ├── views/pixi  ← current app, refactored to read/write CityStore
  ├── views/fp    ← this project, slimmed (no private data forks)
  └── shell UI    ← toggle FP ↔ 2D, shared chrome where sensible
```

Static `data.js` in FP becomes **schema + offline fallbacks**, not the long-term live source of truth.

---

## 3. What "same state" means (acceptance checklist)

### Must match across toggle

- [ ] **Day phase / clock** (and time-scale if user-set)
- [ ] **Weather state + intensity + climate bias** (same Markov / overrides)
- [ ] **Citizen of the Day** pick (same UTC date key + news-lab bias cache)
- [ ] **Progress**: achievements, quests, visited districts, settings that are "account/city" not "camera"
- [ ] **Live overlays**: AI index, headlines/news wire, model roster updates, costs/compute if shown in both
- [ ] **Named entities**: same SEED/ROSTER/labs/buildings IDs; same act schedule inputs (`getAct` / stage)
- [ ] **Global events**: conference week, seasonal id, court/jail *logical* outcomes if those become store-driven

### Explicitly does *not* require pixel parity

- Exact pedestrian x/z on FP sidewalks vs 2D sprite pixels
- FP-only systems (orbit/x-ray/holomap/terminal, wetness puddles, 3D interiors) need not exist in Pixi
- Draw-call layout, camera FOV, pointer-lock, head bob

**Coordinate rule:** identity is **`buildingId` + `citizenId` + `act` + `dayPhase`**, not raw positions.  
Adapter: `buildingId → FP world pose` / `FP pose → district + nearest building` (FP already has `G.bldById`, districts, interiors).

---

## 4. Live data & Supabase

### Current reality

| Surface | 2D production | FP today |
|---------|----------------|----------|
| Model roster / labs / buildings | Live + fallbacks | Static `js/data.js` |
| News / blimps / newspaper | Live pipelines | Static `NEWS` etc. |
| Supabase / auth / cloud save | Yes (production) | No |
| Save key | Production keys | `sc_fp_save_v1` localStorage |

### Target pattern

1. **Production 2D stack owns the data plane** (Supabase client, realtime, REST, news ingest) until a deliberate shared package exists.
2. FP **must not** grow a second ad-hoc Supabase client + divergent cache keys if avoidable.
3. **CityStore** exposes:
   - pull/snapshot for boot
   - subscribe(channel) for live patches
   - `commitProgress(partial)` for achievements/quests
   - deterministic daily picks (COTD) from shared date + news log
4. FP systems that already work offline (traffic instancing, chat bubble pool, wetness) keep **presentation** local; they **read** weather/dayPhase/roster from the store.

### Save / progress unification

- Inventory production save keys vs `sc_fp_save_v1`.
- Prefer **one versioned schema** (`sc_city_save_vN`) with view-specific subsections:

```json
{
  "v": 1,
  "progress": { "achievements": {}, "quests": {}, "districts": {} },
  "settings": { "music": true, "quality": "medium" },
  "view": {
    "fp": { "fov": 70, "sensitivity": 1 },
    "pixi": { }
  }
}
```

- Migrate old FP and 2D keys once on load; do not dual-write forever.

---

## 5. View toggle UX

### Recommended v1: hard swap + freeze

1. User hits toggle (HUD / settings / URL `?view=fp|pixi`).
2. **Freeze** sim one tick; flush progress to CityStore.
3. **Capture resume token**: `{ districtId?, buildingId?, dayPhase, view: 'fp'|'pixi' }`.
4. Unmount active renderer (dispose Three GPU resources carefully).
5. Mount other view; **seed** camera/map from resume token (not from a second sim).
6. Resume store clock.

**Pros:** one sim, simple reasoning, lower peak memory.  
**Cons:** short hitch on toggle.

### Later options (only if toggle becomes frequent)

- Keep both warm (memory heavy: full Three city + Pixi).
- Shared sim in a **Worker**; both views pure presentation (best long-term, biggest refactor).

### Feature flag

- Ship behind flag: `localStorage.sc_view_fp = '1'` or site config / `?view=fp`.
- Default remains Pixi until FP is stable on the real domain (HTTPS required for pointer lock).

---

## 6. Suggested work phases (when owner says "go")

Do **not** start these until authorized. Order is intentional.

### Phase 0 — Discovery (read-only)

- [ ] Map production 2D modules: Supabase client, news, save, `getAct`, COTD, weather/climate, main loop.
- [ ] Map FP entry: `js/main.js`, `state.js` `G`, `data.js`, `progress.js`, systems list.
- [ ] List every live endpoint / table the 2D app touches (even if only names).
- [ ] Confirm monorepo vs two-repo deploy (Netlify FP repo vs apexforge-site).
- [ ] Write a one-page **CityStore interface** (TypeScript-ish types OK even if JS codebase).

**Exit:** interface doc reviewed by owner; no production edits yet.

### Phase 1 — CityStore interface (extract or scaffold)

- [ ] Define `CityStore` methods: `getSnapshot()`, `subscribe(fn)`, settings/progress mutations, weather/dayPhase.
- [ ] Implement store **first against 2D** (or as a shared package both can import).
- [ ] FP gains an adapter: `G` fields populated from snapshot each frame / on event.
- [ ] Keep static `data.js` as fallback when store offline.

**Exit:** 2D still works; FP can boot from store snapshot **or** fallback without crash.

### Phase 2 — Progress + identity bridge

- [ ] Unify save schema; migrate `sc_fp_save_v1`.
- [ ] Shared COTD date key + news-lab bias source.
- [ ] Shared achievement IDs where both surfaces show them.
- [ ] Building/citizen ID parity audit (same IDs in both datasets).

**Exit:** toggle-ready progress; no double unlock / lost districts.

### Phase 3 — Shell toggle on site

- [ ] Feature-flagged mount of FP bundle on singularitycity.net (prefer same-origin module over iframe).
- [ ] Hard-swap toggle with resume token.
- [ ] Dispose Three renderer on leave (context loss / mobile).
- [ ] HTTPS + pointer-lock smoke test on real domain.

**Exit:** owner can switch views on staging without desync of clock/weather/COTD/progress.

### Phase 4 — Live data in FP presentation

- [ ] Wire FP HUD panels / terminal / newspaper to store live fields.
- [ ] Blimp/news/AI index from same feeds as 2D.
- [ ] Rate-limit mesh/label updates (pool sprites; do not recreate InstancedMeshes per patch).

**Exit:** FP no longer "feels offline" next to 2D.

### Phase 5 — Polish and perf

- [ ] Draw-call budget on real GPU after live labels.
- [ ] Long-session memory (dispose on toggle).
- [ ] Deep-link `?view=fp&inside=&dp=` still works for support/debug.

---

## 7. CityStore sketch (starting point for the interface doc)

```ts
// Illustrative — not shipped code
type ViewId = 'pixi' | 'fp';

interface CitySnapshot {
  dayPhase: number;          // 0..1
  timeScale: number;
  weather: { state: string; intensity: number; climate?: string };
  aiIndex: number;
  news: { headline: string; url?: string; date?: string }[];
  cotd: { date: string; modelId: string; source: string } | null;
  citizens: { id: string; lab?: string; stage: string; act: string; targetBid?: string }[];
  // positions optional — views may derive from act+building
  progress: {
    achievements: Record<string, number>;
    visitedDistricts: Record<string, true>;
    metCitizens: Record<string, true>;
    flags: Record<string, boolean>;
  };
  settings: Record<string, unknown>;
  live?: Record<string, unknown>;  // prices, compute, etc.
}

interface ResumeToken {
  view: ViewId;
  dayPhase: number;
  districtId?: string;
  buildingId?: string;
  // FP-only optional
  x?: number;
  z?: number;
  yaw?: number;
}

interface CityStore {
  getSnapshot(): CitySnapshot;
  subscribe(fn: (patch: Partial<CitySnapshot> | CitySnapshot) => void): () => void;
  updateSettings(partial: Record<string, unknown>): void;
  unlockAchievement(id: string): void;
  markDistrict(id: string): void;
  captureResume(view: ViewId): ResumeToken;
  applyResume(token: ResumeToken): void;
}
```

Refine against real 2D module exports before coding.

---

## 8. Repo / deploy notes (as of 2026-07-23)

| Item | Location |
|------|----------|
| FP codebase | `Desktop/SingularityCityFirstPerson` (this repo) |
| GitHub | https://github.com/L0nE-F0x/SingularityCityFirstPerson |
| Local serve | `python serve.py 8931` (not `python -m http.server`) |
| Netlify | Static publish `.` via `netlify.toml`; no build step |
| Production 2D | `ApexForge/SingularityCity` — **read-only** until integration branch authorized |
| FP live data | Static `js/data.js`; PARITY deliberate non-goal until this plan |

FP already has a large **PARITY** feature set (VC, papers, metro, modes, terminal, wetness, etc.). Integration priority is **shared brain + live data**, not re-litigating every FP-only system into Pixi.

---

## 9. Risks (read before coding)

| Risk | Mitigation |
|------|------------|
| Two Supabase clients / caches diverge | One client in shell; store is the only facade |
| Toggle memory leak (WebGL) | Full `renderer.dispose()` + geometry/material audit on unmount |
| Position desync "feels wrong" | Document identity via buildingId/act; soft re-spawn on sidewalk near HQ |
| Bundle size of Three on main site | Code-split FP chunk; load only when flag or first toggle |
| Editing production by accident | Work on a branch; never commit into live deploy path without owner OK |
| Agent reimplements live layer only in FP | Reject PRs that add FP-only Supabase without CityStore |

---

## 10. First commands for the next agent (when owner starts)

```text
1. Read INTEGRATION.md (this file), HANDOFF.md, PARITY.md, RESUME.md.
2. Confirm owner wants Phase 0 only vs full implementation.
3. Locate production 2D path; READ ONLY unless owner names an integration branch.
4. Draft CityStore interface from real 2D modules (not from imagination).
5. Do not delete FP static fallbacks until store has offline mode.
6. Do not force-push GitHub; Netlify deploys from main.
```

**Local FP:**

```powershell
cd "C:\Users\TempleLodge\Desktop\SingularityCityFirstPerson"
python serve.py 8931
# http://127.0.0.1:8931/index.html
```

---

## 11. Decision log

| Date | Decision |
|------|----------|
| 2026-07-23 | Owner: integrate FP into singularitycity.net as toggleable view; shared city state; live data + Supabase eventually required. |
| 2026-07-23 | Agent recommendation: CityStore + hard-swap toggle v1; 2D owns data plane initially; no dual independent apps. |
| 2026-07-23 | This file is the starting plan; **no integration implementation until owner says go.** |

---

## 12. Out of scope for the first integration PR

- Making orbit/x-ray/holomap appear in Pixi
- Full multiplayer networking (FP ghosts are local simulated)
- Rewriting the 2D renderer
- Line-for-line port of every FP system into the store
- Touching production deploy without a named branch and owner approval

---

*End of plan. When resuming: start at section 10, then Phase 0.*
