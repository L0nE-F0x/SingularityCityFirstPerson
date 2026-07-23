# Handoff — Singularity City: First Person

**For the next AI model picking this up.** Written 2026-07-22 at the end of the
build session that created this project. Read this whole file before touching
anything, then read `README.md` for the user-facing view.

---

## 1. The original prompt (what the user asked for)

> The user has a production 2D city sim — `C:\Users\Temple Lodge\Desktop\ApexForge\SingularityCity`
> (PixiJS, ~100 JS files, live on **singularitycity.net**, "working 100% as
> intended"). They also had an experimental 3D orbit-camera version —
> `C:\Users\Temple Lodge\Desktop\SingularityCity3D` (Three.js r128) — which
> "looks like absolute rubbish and lags like crazy" due to browser renderer
> limitations.
>
> **The idea:** make the already-working 2D Singularity City into a
> **first-person game** — the user walking around the city at street level —
> with **ALL the features, zones and EVERYTHING** from the 2D version,
> learning from the 3D version's performance mistakes.
>
> Hard constraints from the user:
> - **NEVER modify `ApexForge\SingularityCity`** — it's in production. Read-only reference.
> - All new code goes in this separate folder, `Desktop\SingularityCityFirstPerson`.
> - The two reference codebases are inspiration/data sources, not code to copy verbatim.

The user's verdict on this build so far: **"good first attempt/prototype"** —
expect iteration and polish requests, not a rewrite.

## 2. Status quo — what exists and what state it's in

Fully playable prototype, ~4,300 lines, zero-build ES modules, vendored
Three.js r160 (`lib/`, no CDN, no npm). All files pass `node --check`.

| File | Lines | Responsibility |
|---|---|---|
| `js/data.js` | 570 | **Single source of truth** — all content ported from the 2D app: LABS, SEED models, ROSTER (famous models + founders), ~90 buildings (BLDS, incl. 16 datacenter facilities), 20 DISTRICTS on a 5×4 grid (800² cells, 200-unit road gaps), QUESTS (26), ACHIEVEMENTS (28), `getAct()` daily citizen schedule, TOUR_STOPS |
| `js/world.js` | 756 | City renderer — 3 tiered InstancedMeshes for generic buildings, 1 merged mesh for all signs (front+back twins on a shared atlas), 1 merged vertex-colored mesh for specialty structures, instanced trees/lamps/benches/poles/containers/hills, ships, water |
| `js/ui.js` | 628 | HUD, minimap, all TAB panels (census/leaderboard/quests/achievements/newspaper/calendar/compute/costs/family/compare/map/settings), building & citizen cards |
| `js/traffic.js` | 303 | Instanced cars on rect circuits, trams on road-grid polylines (elevated y=10), blimps, helicopter, rocket launches |
| `js/weather.js` | 278 | Sky shader dome, sun/moon arc, stars, clouds, recycled Points precipitation, Markov weather, lightning, aurora, night window-emissive/lamp ramp |
| `js/textures.js` | 249 | Procedural canvas facades, 4096² sign atlas (8×16 cells), road/pavement/water textures |
| `js/citizens.js` | 220 | 1 InstancedMesh, ~170 citizens on the `getAct()` schedule, Manhattan road routing |
| `js/main.js` | 159 | Boot + main loop; `window.G`; URL params |
| `js/player.js` | 151 | Pointer lock, WASD, sprint/jump, axis-separated AABB collision, head bob |
| `js/audio.js` | 143 | WebAudio synth SFX + rain/wind beds + `assets/SingularityCity.mp3` |
| `js/progress.js` | 133 | Achievements/quests/localStorage save (`sc_fp_save_v1`), konami/caturday eggs |
| `js/city.js` | 127 | District layout — quadrant clusters; skips colliders for OPEN-type areas |
| `js/interact.js` | 120 | Math-based look detection, E prompts, district banners, moon/blimp clicks |
| `js/tour.js` | 107 | Flying cinematic auto-tour |
| `js/state.js` | 70 | Global `G` + constants (FLOOR_H=24, EYE_H=17, WALK=150, SPRINT=320), `computeDayPhase` (respects `G.fixedPhase`) |

## 3. Verified ✅ vs unverified ❌

**Verified 2026-07-22 on a real GPU** (Intel Arc, ANGLE/D3D11, hardware WebGL 2
— the session after the build; supersedes the SwiftShader-only list below):
- **72 fps locked (vsync), 13.9 ms/frame at *high* quality** with 340 citizens
  and 90 cars. Render submission alone is ~1 ms even at a 2400×1350 buffer.
- **~92 draw calls / 99k triangles / 74 geometries / 16 textures** after the
  fidelity pass (§4c) — still well under the 150 budget. Render submission plus
  the entire city simulation is ~1.9 ms of a 16.6 ms frame. An interior is 2-3
  draw calls.
- Full gameplay loop by hand: all 12 TAB panels, pause toggle, E-inspect on
  buildings and citizens, 20/20 districts detected, quests firing in sequence
  (Sightseeing → Urban Explorer → Into the Underground → The Whole City),
  achievements unlocking, minimap, auto-tour, and the save surviving a reload
  (achievements, districts, met citizens, quality, settings).
- Movement/collision stepped directly: walk 150 u/s, sprint 320 u/s, jump peaks
  +13 u and lands at eye height, player stops one radius short of a collider.
- `AudioContext` reaches `running` in a real browser (headless could not).
- Trams confirmed on the new elevated viaduct.

**Still not verified:** mouse-look and WASD *by hand*. Pointer lock is refused
with `WrongDocumentError` under both browser-automation surfaces available
here, so no agent can drive it — the request is textbook-correct (inside the
click handler on the canvas), but a human needs to click **ENTER THE CITY**
once and confirm the mouse is captured. Also open: long-session stability
(memory/precipitation recycling over hours) and whether the audio *sounds*
right.

**Verified earlier (headless Chrome + SwiftShader, console clean — zero JS errors):**
- Boots, start screen, autostart, HUD, clock, weather label, AI index/pop
- Noon and night rendering: lit windows, neon signs (readable, correctly
  oriented after front/back fix), stars, streetlamps
- District detection banners ("AI TECH DISTRICT") and E-prompts ("E — 𝕏 XAI",
  "E — ⚓ PORT AUTHORITY") at expected locations
- Sea/ships/beach visible at port; hills no longer spawn in the sea
- **Perf budget: 113 draw calls / 46k triangles / 87 geometries / 15 textures**
  (measured via `?debug=1`). Target was <150 calls. The failed 3D version had
  ~2,000. Any real GPU should hold 60fps easily.

## 3b. Testing this thing from an agent — the traps

Learned the hard way; they cost most of a session:

- **Pointer lock is impossible** in both the in-app browser pane and automated
  real Chrome (`WrongDocumentError: The root document of this element is not
  valid for pointer lock`). `Player.update` early-returns unless `locked`, so
  WASD cannot be driven at all. Exercise systems by calling
  `G.<system>.update(dt)` directly instead.
- **Injected keys arrive with an empty `e.code`.** Every handler in this
  project switches on `e.code`, so harness key presses land as no-ops. Dispatch
  `new KeyboardEvent('keydown', {code:'KeyE'})` — nothing checks `isTrusted`.
- **rAF stalls when the browser pane is not compositing**, which reads as "the
  game is frozen" (0 ticks, 0 draw calls, 1 fps). Take a screenshot to force
  frames before timing anything, and never trust an fps sample taken cold.
- Screenshots can return the **previous** frame; if a change should be visible
  and isn't, shoot twice before believing it.
- Panel controls are wired in a `setTimeout(…, 0)` after `showPanel`, so a
  synchronous `dispatchEvent` right after opening a panel hits nothing.

## 4. Bugs found & fixed during the build — don't reintroduce

1. **Sea hidden under the base ground plane** → water moved to y=-0.6.
2. **Hills spawning in the sea + uninitialized instances at origin** → filter
   `x < SEA_X + 200`, build the spots array before instancing.
3. **Mirrored sign backs** (text read backwards from behind) → proper
   front+back twin quads in the merged sign mesh.
4. **Trams driving through buildings** → routes rebuilt as polylines snapped
   to the road grid.
5. **Dark shade-side faces** → ambient bumped (0x8a97ac), exposure 1.22,
   hemisphere light boosted. *Superseded — see §4b.*

## 4b. Fixed in the 2026-07-22 verification pass

1. **The city read as dusk at midday** — the headline bug. Three causes, all
   fixed: (a) instance tints are brand colours chosen for logos on white, many
   fully saturated and dark (DeepSeek blue is rgb 0.05/0.23/0.90), and they
   *multiply* the facade texture, so whole blocks collapsed to black →
   `facadeTint()` in `world.js` clamps saturation ≤0.42 and lightness to
   0.46–0.74, leaving hue (the identity) alone; the neon signs still carry the
   full-strength brand colour. (b) The sun arc peaked at ~75° elevation, and a
   vertical wall gets almost no direct light from an overhead sun → capped at
   `SUN_MAX_EL` (~53°) with a wide horizontal swing. (c) ACESFilmic tone
   mapping was costing ~25% scene luminance on flat-shaded art that wanted none
   of it → `NoToneMapping`, exposure 1.0, with hemi/ambient raised to carry the
   shade side (there are no shadow maps, so hemi + ambient *is* the shading).
2. **`python -m http.server` wedges** → `serve.py` (see §7).
3. **Trams ran at y=10** — 1 m at this project's scale, i.e. down the middle of
   the road with nothing holding them up, while the README claimed "elevated"
   → real viaduct at y=86 with a merged deck and instanced pylons (+2 draw
   calls total), pylons collidable.
4. **12 cars in a 4800×3800 city** → 34/56/90 by preset, citizens 150/240/340.
   Both are single InstancedMeshes, so this cost matrix writes, not draw calls.
5. **No click-to-relock** → canvas `mousedown` calls `Player.lock()`.
6. **FOV / sensitivity / time-flow never persisted** — only the invert-Y and
   music toggles called `save()` → every settings control saves now, and
   `timeScale` is stored and restored.
7. **City-map labels overflowed their cells** and the bottom district row fell
   outside the panel → labels word-wrap to the cell, canvas fits to `58vh`.

Not a bug, for the record: the "blank grey slabs" near the Arena are graveyard
headstones seen from ~26 units away. They only looked wrong in the dark.

## 4c. The 2026-07-23 fidelity pass

Owner verdict on the first build: the graphics were bad and the world was not
behaving like a real place. All of it addressed:

**Roads.** Lane markings used to be painted into the tiled asphalt texture,
which repeats in *both* directions — so the "centre line" drew a grid of
dashes running across the road. Roads are now a proper cross-section:
`CARRIAGE`/`SIDEWALK` per road in `city.js`, asphalt only over the
carriageway, raised kerbed sidewalks either side (boxes, so the kerb has a
face), and markings as real geometry — centre dashes down the direction of
travel, solid edge lines, zebra crossings on every junction approach. Cars,
pedestrians and the road surface all derive from the same two numbers, so they
cannot disagree.

**Traffic.** Cars drive on the right in real lanes (`City.laneCentre`), keep a
62-unit gap from the car in front, and stop at a city-wide two-phase signal
cycle. Verified: 0 overlapping car pairs over 300 frames, no gridlock — 56 cars
cover ~4655 units per simulated minute against ~7200 free-flow, i.e. signals
cost about a third of free-flow, which is about right. The model is now a body
+ glazing + wheels + bumpers, in three instanced meshes so a red car doesn't
get red wheels, with headlights that come on at dusk.

**Pedestrians.** They walked down the middle of the carriageway because the
router offset the whole path by one random "lane" value. They now route along
sidewalk centrelines, stand *on* the kerb rather than sunk in it, and get
nudged off tarmac by `City.offRoad`. 7 of 240 are on a carriageway at any
moment (crossing), down from most of them.

**People.** Six flat boxes became a jointed figure with its own skin tone, hair
and clothing colour, and a real walk cycle — limbs swing in the vertex shader
off per-instance `aPhase`/`aWalk` attributes, so the whole population is still
ONE draw call. `aTint` routes each vertex to the right colour source; without
it the instance colour multiplies the whole model and a citizen from a blue lab
gets a blue face.

**Crowds.** The ported schedule sends 45% of the city to one `cafe` and the
whole US roster to one `res_us`. Fine in 2D, absurd at street level. Each
citizen now takes a spot on a golden-angle spiral around its venue: peak local
density went from ~90 within 60 units to 12.

**Buildings.** Facades are 512² with floor slabs, mullions, sills, recessed
reveals, sky-reflecting glass and a proper ground floor of shopfronts with
fascias and an entrance — not the same window tiled to the pavement. Every
building got a parapet cap and rooftop plant (2 instanced draw calls for the
whole city), because a bare box cut off flat is most of why the skyline read
as untextured blocks.

**Signs (second pass, same day).** They were single neon-text planes pinned to
`p.h`, so on the OPEN power-grid structures — whose real geometry is far
shorter than the placeholder box height `p.h` — they floated in empty sky with
nothing behind them. Rebuilt in `_buildSigns`: every sign now has a dark
housing box with an accent frame and front+back neon. Solid buildings get the
sign mounted flat on the street-facing wall above the entrance (y≈42); OPEN /
short structures get a ground-planted **pylon** sign — the housing on two posts
running down to the pavement. One extra merged draw call for all the housings
and posts city-wide.

**Surface detail.** Every specialty structure (cooling towers, plant halls,
plinths, cranes, the arena…) was a flat single-colour box. There is now one
shared near-white `TEX.detail()` — concrete grain, form-work seams, weathering
streaks — on the merged STATIC mesh. It MULTIPLIES the vertex tint, so it adds
surface detail without shifting colour, and the `s*` helpers scale UVs by real
size (`TILE≈42`) so it tiles at a constant density instead of stretching one
texel over a whole tower. Cost: one texture, zero extra draw calls.

## 4e. Parity work (2026-07-23, ongoing)

The owner asked for parity with the production app. `PARITY.md` is the living
inventory. First tranche landed:

- **Cars cut to ambient levels (6/10/16).** The production city is a pedestrian
  world — it runs a *single* Nvidia delivery truck (`entities.js`:
  `if (G.cars.some(c => c.isTruck)) return;`), not a traffic sim. FP had 56–90;
  that was the "why so many cars" complaint.
- **Chat bubbles** (`chatbubbles.js`) — the original's signature aliveness. A
  fixed pool of world-space sprites floats a line from the ported `CHAT_MSGS`
  above nearby citizens, keyed to what they're doing. Pool-bounded (each sprite
  is a draw call) and only assigned within a readable distance band, so cost is
  flat regardless of crowd size.
- **Street vendors** (`vendors.js`) — the 6 production food carts (Taco Bot,
  Byte Brew, Ramen-san, Gelato GPU, Pretzel Net, PageRank Books). Carts merge
  into one mesh, emoji/item signs share one atlas → 2 draw calls. They spawn on
  the inner-road sidewalk (verified clear of colliders — placing them at the
  building footprint buried them inside the packed clusters).

Second tranche (also 2026-07-23):

- **Bird flocks** (`birds.js`) — 3 flocks of 6, V-formation, wings flapping in
  the vertex shader off a per-instance phase, scatter upward when the camera
  nears. One InstancedMesh, one draw call.
- **City-wide power lines** — wooden poles with two crossarms + insulators down
  each avenue's sidewalk, sagging catenary wires as `LineSegments`. Folded into
  `world.js` `_buildProps` (which already carried a ring-road pole line). NOTE:
  a first attempt added a separate `_buildPowerLines` method wedged mid-way
  through `_buildProps`, which orphaned the container/ship code below it — it's
  inline in `_buildProps` now.
- **Nvidia supply-chain truck** (`traffic.js` `_initTruck`) — the one
  meaningful vehicle from the original: cab + green cargo box on a road-grid
  loop through Port → fab → HQ. Verified: exists, path valid, moves.

Third tranche (2026-07-23):

- **Distinct typed interiors** (`interior.js`). `_theme(b)` maps each building
  type (or district, for the generic-typed robotics/longevity buildings) to a
  palette + light mood + floor tint; `_dress` builds a signature scene per
  category. Nine themes: datacenter (cold server hall, LED racks), bar (neon,
  glowing bottles, dance floor), home, robotics (conveyor + arm), longevity
  (DNA helix), academic (library), press (printing press), warehouse, office.
  A `glow` bucket (MeshBasic vertex-colours) carries all the self-lit bits
  (LEDs, screens, neon) so an interior is still **3 draw calls** (shell + glow
  + floor + sign board). Verified all 9 build without error.

Fourth tranche (2026-07-23):

- **Weather → 10 states** (`weather.js`): added `overcast` (heavier than the
  now-"partly cloudy" `cloudy`) and `autumn` (falling orange leaves, reusing the
  recycled precipitation system like cherry). Every per-state lookup table (dim,
  fogFar, cloudOp, precip) got the two new keys; the label map now shows all ten.
- **Climate zones**: `detectClimate()` maps the IANA timezone to one of five
  climates (tropical/arid/temperate/continental/polar), each with a `favor`
  pool the state machine pulls from half the time. `localStorage.sc_climate`
  overrides it, matching the 2D app.
- **Citizen archetypes** (`citizens.js` ARCHETYPES): ~20% of citizens (every
  5th, deterministic) get a lifestyle — gym rat, foodie, bar regular, bookworm,
  jogger, coffee addict, night owl — that redirects their free-time act to a
  favourite venue. Verified even distribution (7 each) and correct routing.
- Dev param **`?wx=<state>`** forces a weather state for testing.



Fifth tranche (2026-07-23, resumed after Claude rate-limit):
- **Citizen of the Day** (`js/citizen_of_day.js`): daily deterministic pick from active SEED models (news-lab bias + date hash, cached in `sc_fp_cotd_pick_v1`). Gold crown sprite over their head, 3 paparazzi meshes during commute windows (dayPhase 0.30–0.55 / 0.65–0.78), camera flashes, press-line chat bias, 👑 HUD button → info card with Track (teleport+face) and X share. Achievement `cotd_seen`.
- Press chat lines already in `CHAT_MSGS.press` (data.js).

Owner directive: **keep the terminal (press-D data terminal) for last**; work
the rest of `PARITY.md` first. Owner is happy for me to choose the order.

See `PARITY.md` for the remaining backlog (~20 typed interiors, metro,
jail/court, VC deal flow, research-paper delivery, citizen-of-the-day, climate
/weather expansion, orbit/x-ray/holomap, and finally terminal mode). Genuinely
many sessions of work.

## 4d. Interiors — you can go inside now

`js/interior.js`. One reusable lobby, re-dressed per building, parked at
y=-4000 and swapped in by moving the player rather than by building a second
scene — the weather system, fog and lights all reference `G.scene`, and a
HemisphereLight shades by normal direction, so the same lights work 4000 units
down. The city meshes are hidden while inside, so an interior costs **2-3 draw
calls**.

- `E` near a building's footprint enters it; `E` at the doorway leaves. Look at
  a building from further away and `E` still opens the info panel.
- `G.floorY` is the ground level the player stands on — `player.js` clamps to
  `G.floorY + EYE_H`. Anything that teleports must respect it.
- Dressing varies by `b.type`: server racks for datacenters, a bar counter for
  bars, stacks for the university, sofas for housing, turnstiles otherwise.
- Dev param: `?inside=<buildingId>` boots straight into a lobby.

## 5. Deliberate simplifications (vs the 2D production app)

These were conscious scope cuts, not oversights — revisit only if the user asks:

- **Interiors are one lobby per building**, not full walk-through floors —
  there are no upper storeys behind the lift doors.
- **No live APIs / Supabase** — the 2D app's live data (real model releases,
  prices, news) is replaced with static fallback data in `data.js`.
- **No orbit/overview mode** — first-person only, plus the cinematic auto-tour (T).

## 6. Performance doctrine (the whole point of the project)

The 3D version died from ~2,000 unbatched draw calls, full-res bloom, PCFSoft
shadows, logarithmic depth, transmissive materials. This build's rules:

- Instancing for anything repeated; merged geometry for anything static.
- One shared texture atlas per category (signs: 4096², 8×16 cells).
- **No shadow maps, no post-processing chain, no log-depth, no transmission.**
- DPR capped via quality preset; fog doubles as draw distance.
- New features must justify their draw calls. Check with `?debug=1`.

## 7. How to run & test

```bash
cd "C:/Users/Temple Lodge/Desktop/SingularityCityFirstPerson"
python serve.py 8931                # ES modules require http://
```

**Use `serve.py`, not `python -m http.server`.** The stdlib server is
single-threaded: one browser keep-alive connection blocks every other request,
so a second tab (or a second browser) gets `ERR_EMPTY_RESPONSE` while the port
still shows as LISTENING. `serve.py` is the same thing on
`ThreadingHTTPServer` with `Cache-Control: no-store`.

Headless verification (what the previous session used; ~40-90s per shot under
SwiftShader — run sequentially, never parallel):

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new \
  --disable-gpu --enable-unsafe-swiftshader --no-first-run \
  --window-size=1600,900 --virtual-time-budget=9000 \
  --enable-logging=stderr --v=0 \
  --screenshot="C:\Users\Temple Lodge\Desktop\SingularityCityFirstPerson\shot.png" \
  "http://localhost:8931/index.html?autostart=1&dp=0.5&debug=1" 2>&1 | grep CONSOLE
```

URL params: `?autostart=1` skip start screen · `?dp=0..1` freeze time of day
(0.5=noon, 0.95=night) · `?x= &z= &yaw=` teleport · `?debug=1` log draw calls
after 3.5s (look for `[SC-FP DEBUG]`) · `?sim=<seconds>` fast-forward citizens
and traffic before the first frame, so a screenshot catches a city that has
been living rather than one where everyone is still on their doorstep ·
`?inside=<buildingId>` boot inside a lobby. Useful spawn: port
`?x=-1000&z=-280&yaw=0`; a good street view is `?x=-560&z=-500&yaw=1.5708`.

**Screenshots when the Browser pane is not displayed:** the pane stops
compositing and every screenshot times out (and rAF stalls, so the game looks
frozen at 0 ticks). Fall back to headless Chrome — that is what the shot script
in §7 above is for. `?sim=` exists precisely because headless boots fresh.

Delete test screenshots before committing anything; kill the python server
when done (find PID: `netstat -ano | grep 8931`).

## 8. Where to take it next (suggested priority)

Items 1–3 of the original list are **done** (see §3 and §4b): the playtest pass
ran, real-GPU perf is confirmed at 72 fps locked, and the lighting nits turned
out to be the headline bug rather than nits. What is left:

1. **The one human check** — click ENTER THE CITY and confirm the mouse locks
   and WASD moves you. No agent can do this (§3b).
2. Remaining cosmetic polish: window texture is still sparse on very large
   facades, and graveyard headstones are unlabelled (the 2D app names the
   deprecated models on them).
3. Long-session stability: leave it running for an hour and watch memory and
   the precipitation recycling.
4. Bigger features only if the user asks: building interiors, live data wiring
   (the 2D app's API/Supabase layer is the reference), gamepad support.

## 9. Reference codebases (read-only!)

- `C:\Users\Temple Lodge\Desktop\ApexForge\SingularityCity` — production 2D
  app. **Do not modify, ever.** Source of truth for content/zone design.
- `C:\Users\Temple Lodge\Desktop\SingularityCity3D` — the failed 3D experiment.
  Useful as a catalog of what NOT to do (see §6).

Working style note: the user runs in auto-permission mode and expects decisive
progress without approval-seeking, but the two constraints in §1 are absolute.

## 4f. Full PARITY backlog pass (2026-07-23)

Cleared remaining PARITY.md checkboxes except deliberate non-goals (live APIs).

**Street life:** `vc_dealflow.js` (partners → HQs + handshake sparks), `research_papers.js` (arXiv envelopes to labs), NPC aging morphs in `citizens.js` (aAnim stage pack + pacifier/backpack/aura, not size-only).

**Places:** multi-floor lifts (F) + jail/court/embassy/mission/power interior themes; `metro.js` (3 lines); `jail.js` + `court.js`.

**Modes:** `orbit_mode.js` (O), `xray_mode.js` (X), `holomap.js` (H), `terminal.js` (Ctrl+D / backtick — KeyD alone stays WASD strafe).

**Events/fidelity:** `conference.js`, `seasonal.js`, `kardashev.js`, `wetness.js`, `multiplayer.js` (local ghost peers).

**Harness:** `tests/parity_exercise.mjs`, `tests/run_node_check.mjs`, `tests/boot_probe.mjs`. package.json import map + node_modules/three shim for Node.

