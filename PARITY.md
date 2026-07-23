# Parity with the production 2D app

Tracking what the first-person port covers vs. `ApexForge/SingularityCity`
(the read-only production city, ~102 files, ~63K lines). This is a multi-session
program — the original is a very large game. Updated 2026-07-23 (full backlog pass).

## ✅ Present in first-person

- 20 districts on a grid, ~90 buildings + 16 datacenters, quadrant clusters
- ~170–340 model citizens on the `getAct()` daily schedule, named models + founders
- Weather (rain/snow/thunder/fog/cherry) + day-night + aurora + stars
- Trams (elevated viaduct), news blimps, helicopter, rocket launches
- 12 data panels (census, leaderboard, quests, achievements, newspaper,
  calendar, compute, costs, family, compare, map, settings)
- Auto-tour (T), 26 quests, 29+ achievements, konami/caturday eggs
- **Walk-in interiors** (lobby per building, type-dressed) — FP addition
- **Real streets** — carriageways, lane markings, kerbed sidewalks, traffic
  signals, cars on the right in lanes, pedestrians on pavements — FP addition
- **Chat bubbles over citizens** (ported CHAT_MSGS) — added 2026-07-23
- **Street vendors** (6 food carts) — added 2026-07-23
- **Bird flocks** (3 flocks, V-formation, wing-flap shader, scatter) — 2026-07-23
- **City-wide power lines** (utility poles + sagging catenary wires) — 2026-07-23
- **Nvidia supply-chain delivery truck** (Port → fab → HQ loop) — 2026-07-23
- **Citizen of the Day** + paparazzi entourage, crown, press chat, HUD card — 2026-07-23
- Building signage: wall-mounted boxes + ground pylon signs; concrete detail
  texture on specialty structures
- **VC deal-flow**, research-paper envelopes, distinct NPC aging looks
- **Metro** rolling stock on 3 lines, jail & court systems, multi-floor interiors
- **Modes**: orbit (O), x-ray (X), holomap (H), terminal (Ctrl+D / `)
- Conference + seasonal accents, Kardashev billboard, rain wetness, ghost cursors

## 🚗 Corrected

- **Cars**: the original runs essentially ONE delivery truck (Port → Nvidia
  fab → HQ), not a traffic sim. FP had 56–90; cut to 6–16 ambient cars.

## ❌ Missing — the backlog, roughly by first-person impact

### Aliveness / street life
- [x] Bird flocks (V-formation, flap, scatter) — `birds.js`
- [x] Power lines: utility poles + sagging wires — in `world.js` `_buildProps`
- [x] Nvidia supply-chain delivery truck (Port → fab → HQ) — `traffic.js`
- [x] Goal-driven citizen archetypes (~20%: gym rats, foodies, bar regulars,
      bookworms, joggers, coffee addicts, night owls) — `citizens.js` ARCHETYPES
- [x] VC deal-flow (partners travel to HQs, handshake animations) — `vc_dealflow.js`
- [x] Research-paper envelopes delivered to labs — `research_papers.js`
- [x] Citizen of the Day + paparazzi entourage — `citizen_of_day.js` (crown sprite, 3 paparazzi in commute windows, flashes, press bubbles, HUD card + Track)
- [x] NPC aging visuals (baby/kid/rumored distinct looks) — `citizens.js` aStage morphs + pacifier/backpack/aura (not size-only)

### Distinct interiors — DONE (9 themed types + specialized rooms, `interior.js`)
Each building type now gets its own palette, light mood and signature
centrepiece (3 draw calls per interior):
- [x] **datacenter/fab** — cold server hall, blinking LED rack columns
- [x] **bar** — dark neon bar, glowing bottles, dance floor
- [x] **home** (housing/villa/cabin) — warm living room, TV, bookshelf, plant
- [x] **robotics** — factory floor, conveyor, robot arm, safety lines
- [x] **longevity** — clinical bio-lab, vial racks, DNA double-helix
- [x] **academic** (university) — library, bookshelves, reading tables
- [x] **press** (newspaper) — printing press + paper stacks
- [x] **warehouse/metro** — shelving racks + crates
- [x] **office** (hq/vc/agents/embassy/generic) — corporate lobby
- [x] Remaining nuance from the 2D app: multi-floor interiors behind the lift
      (F / lift bank), per-country embassy detailing, jail/court rooms,
      space mission-control, power-plant control rooms — `interior.js` themes
      + `jail.js` / `court.js`

### Big modes / systems
- [x] **Terminal mode** (`D` / Ctrl+D / `) — Bloomberg-style data terminal — `terminal.js`
- [x] Orbit mode — LEO satellite view — `orbit_mode.js` (O)
- [x] X-ray mode — wireframe diagnostic overlay — `xray_mode.js` (X)
- [x] 3D holomap — `holomap.js` (H)
- [x] Metro system (3 lines from `TRAM_LINES`, stations) — `metro.js`
- [x] Jail & Court systems — `jail.js`, `court.js`
- [x] Conference events, seasonal events — `conference.js`, `seasonal.js`
- [x] Kardashev / richer AI-index billboard — `kardashev.js`

### Content / fidelity
- [x] 10 weather states (clear · partly cloudy · overcast · fog · drizzle ·
      rain · thunderstorm · snow · cherry · autumn leaves) — `weather.js`
- [x] 5 climate zones from timezone (tropical/arid/temperate/continental/polar)
      biasing the Markov chain; `localStorage.sc_climate` override — `weather.js`
- [x] Rain puddles / wetness / ground-splash / neon reflections — `wetness.js`
- [ ] Live API pipelines (deliberate scope cut — FP uses static `data.js`)
- [x] Multiplayer ghost cursors — `multiplayer.js` (local simulated peers; no network backend)

## Deliberate non-goals (unchanged)

- Live APIs / Supabase — FP uses static fallback data by design
- Orbit/overview camera as the primary mode — FP is first-person + auto-tour
  (orbit is a toggleable mode, not the default)

## Controls (modes)

| Key | Mode |
|-----|------|
| Ctrl+D or ` | Data terminal (D alone remains WASD strafe) |
| O | Orbit LEO view |
| X | X-ray wireframe |
| H | Holomap hologram |
| F | Next interior floor (when multi-floor) |
