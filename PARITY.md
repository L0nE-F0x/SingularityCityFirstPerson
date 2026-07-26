# Parity with the production 2D app

Tracking first-person vs production `ApexForge/SingularityCity` (read-only).  
**Updated:** 2026-07-26 evening (destination parity + skyline).

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

## Present in first-person (approximate)

- 20 districts, ~90 buildings + datacenters, quadrant layout
- Instanced citizens (schedule *implemented* but **owner reports it doesn’t feel right**)
- Weather + day/night + aurora + soft circular stars
- **Underground metro rolling stock** (not elevated) — **not yet boardable by player**
- 12 data panels, quests, achievements, auto-tour
- Walk-in interiors (themed) — **props need fidelity**; elevators incomplete
- Streets with carriageways/markings/sidewalks + **traffic lights**; junction kerbs fixed (2026-07-23)
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
