# Parity with the production 2D app

Tracking first-person vs production `ApexForge/SingularityCity` (read-only).  
**Updated:** 2026-07-28 (parity backlog closed — see RESUME.md for live status).

**North star:** switching FP ↔ 2D should feel like **same city, different camera**.  
You should be able to go **anywhere** you can go in the 2D app.

---

## Owner backlog (open — from 2026-07-23 playtest)

These override stale “[x] done” claims elsewhere when they conflict with lived experience.

### Mobility
- [x] **Board and ride metro trains** (street or platform → ride → alight) — 2026-07-26
- [x] **Real elevators** — F / digits 0–9 / E at lift; floors from building storeys — 2026-07-26
- [x] Full destination parity with 2D enterable spaces (themed rooms for all major 2D interior routes) — 2026-07-26

### Aliveness / characters
- [x] **Commuter schedules** reworked (band re-assign + founder schedule) — *verify feel in playtest* — 2026-07-26
- [x] **Founders / CEOs** larger, door slots, CEO schedule — *verify feel* — 2026-07-26
- [x] **Founder helicopters** per lab orbiting HQ — 2026-07-26
- [x] **Founders visible inside VIP cars** (occupant heads, gold plate) — 2026-07-26

### Streets
- [x] Fix **sidewalks/kerbs in the middle of intersections** (2026-07-23) — kerbs are now segmented around every crossing carriageway in `City.sidewalkSegments()`; `tests/street_check.mjs` asserts no kerb overlaps a carriageway. *Verify feel in a human playtest.*
- [x] **Lane markings** follow road direction correctly (2026-07-23) — dashes/edges already axis-correct; edge lines now also stop at junctions instead of running white lines straight across the crossing carriageway.
- [x] **Traffic lights** present and readable at junctions (2026-07-23) — `signals.js`: mast-arm 3-lens heads at every avenue×street junction, driven from the same two-phase cycle the cars obey. Confirmed in a headless screenshot.
- [x] Traffic density honest to 2D (done earlier — 6/10/16 ambient cars + one Nvidia truck)

### Interiors / fidelity
- [x] **Interior props quality** pass (richer lobbies, lifts, Standard materials, fill light) — ongoing polish welcome — 2026-07-26
- [x] Exterior materials/skyline polish (setbacks, ledges, crowns, Phong glass facades) — 2026-07-26

### Multiplayer
- [x] **No fake ghost peers** when offline (removed 2026-07-23)
- [ ] Real multiplayer only when a real backend exists

---

## 2026-07-27 — rendering overhaul + content parity pass

### Rendering (the "looks bad" complaint)
- [x] **Root cause: `facadeTint` clamped colour in LINEAR space.** `Color.getHSL/setHSL`
      default to the working colour space, so an L clamp of `[0.46, 0.74]` was really
      sRGB `[0.71, 0.88]` — every façade in the city was forced near-white.
      District grey `#5a6b80` came out `#94aecf`; DeepSeek `#0ea5e9` came out `#8db2d3`.
      Two different brand colours landed on the same pale blue. Clamped in sRGB now.
- [x] Sun **shadow map** with a texel-snapped, player-following ortho frustum (off on `low`)
- [x] **ACES tone mapping** re-enabled (the earlier revert treated a symptom of the tint bug)
- [x] **Sky-derived PMREM** into `scene.environment` — metal/glass finally reflect something
- [x] Per-instance **façade UV scaling** — a window is the same physical size on every building
- [x] Baked **vertex AO** on the shared building box
- [x] **3 seeded façade variants per tier** (was one shared texture; every mid-rise had the
      same windows lit at night)
- [x] Anisotropy → `getMaxAnisotropy()` (was hard-coded 4); ground textures memoised
- [x] Camera near/far `0.5/12000` → `4/8000` — ~10x depth precision, kills marking z-fighting
- [x] Fog retuned for aerial perspective; the distant hills are visible instead of a white wall
- [x] Ground/roads/sidewalks moved from Lambert/Phong to Standard; asphalt lightened off black
- [x] Architectural trim tinted per building (was six near-identical greys city-wide)
- [x] **Night streets**: 8.8 m lamps (were 3.4 m) + instanced halo + ground light pools

### City structure
- [x] **Skyline.** Tallest building was 21.6 m and every building was wider than tall, which
      also left world.js's setback/crown/spire code unreachable. Per-type storey multiplier —
      Google DeepMind is now 77 m / 32 floors.
- [x] **Density.** Block infill on empty lots: 111 → ~350 buildings.
- [x] Grid 5×4 → **5×5**, 20 → **25 districts**

### Content parity
- [x] Real VC firms (a16z, Sequoia, YC, SoftBank, Thrive, Founders Fund, MGX)
- [x] Power grid real names + SMR + fusion plant; 13 launch pads; port + commodities
- [x] Embassies and villas paired 1:1 across six nations; AI Protein Foundry
- [x] **6 metro stations / 5 lines** (was 4/3)
- [x] **AI Detention Center** — the jail no longer borrows the Black Market
- [x] 5 new districts: CEO estates, worker housing, suburbia, Silicon Woods, Frontier Pines
- [x] `getAct()` weekday/weekend/hackathon/underground/university/museum branches
- [x] **45 worker NPCs** on day/night shifts (the industrial districts were unstaffed)
- [x] Citizen counts 240 → 700 (medium)
- [x] **Bespoke interiors** — bar, underground, metro, embassy, villa, alignment, press,
      legacy museum, backbone, agents (was one procedural room in 25 colours)
- [x] **Terminal** rebuilt to 13 live panels + command bar
- [x] **X-ray mode** rebuilt: metric heat, floating data cards, bars, packet arcs
- [x] **District ambience** (`js/ambience.js`) — data flow, DNA helices, welding sparks,
      stack plumes, VC coins, manhole steam, hydrants
- [x] **19 real festivals** (`js/seasonal.js`) with variable-date resolution and 3D decor
- [x] **News reactivity** (`js/news_reactivity.js`) — headlines route to a lab and the city
      reacts: fireworks / red flicker / CEO scramble / court pulse

### Performance
- [x] Sign system: ~390 draw calls + 130 textures → **one atlas, 3 draw calls**
- [x] Vehicles merged by material — `ambientCars` alone was **614 draw calls** (44 meshes/car)
- Net: ~1400 → **~570 draw calls** despite 3x the buildings

### Closed since (2026-07-28)
- [x] **Holomap** rebuilt as a projected galaxy; **x-ray** rebuilt with metric
      heat, floating data cards and packet arcs
- [x] Interiors for **robotics, longevity, VC row and worker apartments**
- [x] **Tutorial** (30 steps, DOM spotlight, camera flights) and **daily
      briefing** (MediaRecorder news reel)
- [x] **Personality behaviour** — traits derived from benchmarks/talent/arch/name
      drive walk speed, free-time venue and chat
- [x] **Supply-chain simulation** — ships → stock → trucks → datacentre draw,
      with starved buildings browning out
- [x] **Interior scale** corrected (`ROOM_SCALE`) and the **elevator** made a
      real ride with doors, travel and ground-floor-only exit

### Deliberately not doing
- **Orbit mode** — owner closed it; the 2D app covers that view. `orbit_mode.js`
  stays a stub. Do not list it as a gap.

### Deferred (owner decision pending)
- Interior palette on upper office floors / worker apartments reads bright and
  pale. Lighting measured correct; it is an art-direction call.

---

## Present in first-person (approximate)

- **25 districts, ~350 buildings** (148 named + infill), quadrant layout
- Instanced citizens (700 medium) + 45 shift-working NPCs
- Weather + day/night + aurora + soft circular stars + sun shadows + sky IBL
- **Underground metro** — boardable, 6 stations / 5 lines
- 13-panel data terminal, quests, achievements, auto-tour
- Walk-in interiors — 10 bespoke destinations, rest procedural
- Streets with carriageways/markings/sidewalks + traffic lights + street furniture
- Chat bubbles, vendors, birds, power lines, supply truck, COTD, VC deal-flow, papers
- Modes: orbit / x-ray / holomap / terminal
- Integrated dual-view: vendored `pixi/` + FP root + CityStore / live news shell

## Corrected earlier

- Ambient car count reduced toward pedestrian city (not 90-car freeway)
- Elevated tram viaduct removed (parity with underground metro)
- Fake multiplayer cones removed

## Deliberate non-goals (for now)

- Live model-scan / full Supabase write path in FP (static `data.js` + soft live news)
- Dual warm Pixi+Three in one page (hard-swap only)
- Editing production ApexForge tree

## Controls (modes)

| Key | Mode |
|-----|------|
| Ctrl+D or \` | Data terminal |
| O | Orbit LEO |
| X | X-ray |
| H | Holomap |
| F | Interior floor (partial) |
| P | Hard-swap to 2D City |
| V | FP shell city map |

---

*When closing a backlog item, verify against production 2D behaviour, not only unit smoke tests.*
