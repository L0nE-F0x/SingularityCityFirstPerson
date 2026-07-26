# Vendored production 2D (Pixi) — INTEGRATED BUILD COPY

This folder is a **copy** of `ApexForge/SingularityCity` for local integration testing
inside `SingularityCityFirstPerson`. The original production tree is **not** modified.

- Open: `http://localhost:8931/pixi/`
- First Person toggle: toolbar button **First Person**, landing **Walk First Person**, or the top chip
- Bridge script: `js/sc_integrated_bridge.js` (only exists in this copy)

Do not confuse with live singularitycity.net until you deliberately deploy this monorepo.

---
# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS — zero bundler, ~100 JS files, ~69K lines.

🌐 **[Play Live](https://singularitycity.net)** · 📰 **[Read the Paper](https://singularitycity.net)** · 🖼️ **[Embed it](https://singularitycity.net/embed.html)**

---

## Embed it anywhere

Drop a live view of Singularity City into any page with an iframe. The embed auto-boots into a hands-free, cinematic auto-tour that roams a large pool of city landmarks, labs, zones, and building interiors, perfect for blog posts, tweets, Notion pages, and kiosks.

```html
<iframe src="https://singularitycity.net/embed.html"
        width="100%" height="600"
        frameborder="0" allowfullscreen></iframe>
```

---

## Features

### 🌦️ Dynamic Weather & Climate Zones
- **10 weather states** — clear, partly cloudy, overcast, fog, drizzle, rain, thunderstorm, snow, cherry blossoms, autumn leaves
- **5 climate profiles** detected from your IANA timezone — tropical, arid, temperate, continental, polar
- **Southern-hemisphere flip** — Sydney's July is winter, Bali's January is wet season
- **Per-climate Markov chains** — Bali gets monsoon thunderstorms, Phoenix gets year-round clear skies, Reykjavik gets polar snow, Tokyo gets cherry blossoms in spring
- **Smooth intensity transitions** — weather fades in/out over ~4 seconds instead of popping on/off
- **Wind vector** drives slanted rain, drifting snow, tumbling petals and leaves
- **Thunderstorm** adds a full-screen flash, a jagged lightning bolt, and delayed thunder SFX
- **Rain payoffs** — drops kick up ground-splash rings, wetness accumulates into neon-reflecting puddles that shimmer at night, and the streets glisten
- **Cloud ground-shadows** drift across the city under a clear or partly-cloudy sun
- **Rippling harbor water** — the port surface reflects sky, moon, neon, and ship lights through a live PIXI DisplacementFilter
- **Fog** layers a drifting wash with streaks across the viewport
- **Power grid reacts** — solar derates under clouds/storm, wind turbines spin harder during storms and stall in fog
- **Manual override** via `localStorage.setItem('sc_climate', 'polar')` for players who want a different biome

### 🏢 Living City
- **900+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
- **Goal-driven archetypes** — ~20% of citizens have lifestyle routines (gym rats, foodies, bar regulars, bookworms, park joggers, coffee addicts, night owls)
- **Dynamic zoning** — new labs auto-generate districts as models are discovered
- **5 real-time data pipelines** — HuggingFace, Google AI Studio, ZeroEval, Launch Library 2, TechCrunch/Ars Technica
- **Cloud sync via Supabase** — every player's discoveries expand the same city
- **Neon signs** on all buildings — static during day, flickering glow at night
- **City-wide power lines** — wooden utility poles with sagging wires connecting buildings across the map

### 📰 The Singularity City Times
- **Weekly newspaper building** (📰 emoji) near the Visitor Monument
- **Live-generated front page** — top story, recent launches, retired models with successors, lab standings, benchmark leader, classifieds
- **Volume/Issue** computed from weeks since 2025-01-01
- **One-click PDF export** via browser print — perfect for archiving or sharing

### 🎬 Auto-Tour / Screensaver Mode
- **20 landmark stops** — Space Port, Leaderboard Park, LMSYS Arena, Visitor Monument, Neon Bar, Pine Reserve, Solar Array, Nuclear Plant, Trade Port, Graveyard, Conference Center, AI Court, Central Park, AI Academy, Central Metro, Internet Exchange, Robotics Factory, Longevity Wing, Newspaper HQ, The Underground
- **Triggers on 60s idle** or press **`T`** to toggle manually
- **Smooth camera glides** via the existing lerp — no jumps
- **Kiosk-safe** — embed mode makes the tour sticky so it never stops on input

### 🔬 Debug / Perf Overlay
- **Press `` ` ``** (backtick/tilde) to toggle the overlay
- **FPS, frame time, draw calls, visible sprites, texture count, entity counts**
- **60-frame rolling frame-time graph** with red/yellow/green bands
- Built in from v226 forward — makes perf regressions impossible to miss

### 🖥️ Compute District — Data Centers & Chip Fabs
- **17 real-world facilities** — Google Dalles, AWS Virginia, Meta Prineville, xAI Colossus, TSMC Arizona, Samsung Foundry, Intel Ohio, and more
- **Full interiors** — NOC, server halls, reception, power distribution (DCs) · Lithography bays, etch chambers, wafer handling (fabs)

### 🚢 Port / Trade District
- **Ocean biome** with coral reef, animated fish schools, swaying algae, air bubbles, light rays
- **3 cargo ships** with staggered arrivals, animated cargo crane unloading, direction-aware wake
- **12 tracked commodities** with live pricing via Finnhub API (daily Netlify scheduled function)
- **Coastline transition** — sandy gradient with palm trees between ocean and desert

### ⚡ Power Grid Zone
- **5 power sources** — Solar (200MW variable), Wind (150MW weather-dependent), Nuclear (1,100MW), Coal (600MW), Hydro (400MW)
- **Live supply/demand** from DC facility power_mw fields + city baseline
- **Animated** — nuclear steam, coal smoke, spinning turbine blades, solar sun-tracking
- **Underground** — power/water trunk lines with vertical risers to each source
- **Full interiors** — Nuclear (4 floors), Coal (4 floors), Hydro/Solar/Wind (2 floors each)

### 🛰️ Orbit Mode
- **Top-down pixel art Earth** with ocean, grid lines, day/night terminator, and city light clusters
- **Real satellite data** from CelesTrak — Starlink, OneWeb, ISS, GPS, Galileo constellations
- **Timezone-filtered** — shows satellites currently above your location with "YOU ARE HERE" marker
- **Pixel art satellites** — detailed ISS with solar panels, GPS with antenna, Starlink/OneWeb dots
- **Smooth transitions** with full camera state save/restore on exit

### 🤖 Robotics Factory Zone
- **4 buildings** — Assembly Line, Testing Ground, Deployment Dock, R&D Lab
- **8 NPCs** — engineers, testers, welders, calibrators, researchers
- **Animated** — walking robot prototypes, welding sparks, conveyor belts, status LEDs, smoke puffs
- **Full interiors** — Chassis Fabrication, AI Brain Upload, Obstacle Course, Morphology Lab
- **Companies** — Tesla Optimus, Figure, Boston Dynamics, Unitree, Agility, 1X, Apptronik, Sanctuary

### 🧬 Longevity Research Wing
- **4 buildings** — Drug Discovery Lab, Clinical Trials Center, Genomics Sequencing, Cryonics Vault
- **8 NPCs** — chemists, ML engineers, trial managers, biostatisticians, cryonics techs
- **Animated** — DNA double helix, molecule bubbles, heartbeat pulses, sequencer LEDs, cryo vapor
- **Full interiors** — Molecular Screening, Phase I-III trials, Bioinformatics Pipeline, Vitrification Chamber
- **Companies** — Calico, Altos Labs, Insilico Medicine, Recursion, Isomorphic Labs, Retro Biosciences

### 🔬 X-Ray Mode
- **Diagnostic overlay** toggled via toolbar button
- **Building wireframes** with lab-colored outlines and corner brackets
- **Data flow packets** traveling along connection arcs between same-lab buildings
- **Stat labels** — building IDs, floor counts, types, and data center status
- **Visual effects** — coordinate grid, pulse rings, sweeping scan line
- **Terminal aesthetic** — city dims to 8-15% opacity for dark hacker feel

### 🌳 Central Park
- **500px green space** between AI Court and Tech District
- **Central fountain** with animated water spray particles (gravity + drift)
- **6 oak & maple trees** — procedural canopies with seasonal color support
- **4 park benches**, flower beds, cobblestone paths, lamp posts with night glow
- **Decorative pond** with cattails and ripple effects
- **Picket fence** around the perimeter — NPCs route here for lunch & weekends

### 🐦 Bird Flocks
- **Max 3 flocks of 6 birds** (15-24 sprites) — safe for 60fps
- **V-formation flying** from off-screen, targeting park trees & forest
- **State machine**: flying → landing → perched → scattering → dead
- **Scatter on approach** — birds flee when camera center is within 30% of viewport
- **Wing animation** — flapping during flight, folded when perched
- **Every-other-frame updates** for performance

### 📈 Global AI Index
- **Composite 0-1000 score** displayed on a highway billboard with steel supports
- **6 weighted components**: benchmark ceiling (25%), population (15%), lab diversity (15%), open-source ratio (10%), compute capacity (20%), velocity (15%)
- **Color-coded zones**: red (0-200), yellow (200-500), green (500-800), blue (800+)
- **Sparkline history**, all-time high indicator, smooth score animation
- **Recalculates every 300 ticks** from live model/benchmark/DC data

### 🚚 Supply Chain
- **6 resource types**: H100 GPUs, B200 GPUs, helium, HBM memory, coolant systems, electricity
- **Port → Data Center delivery**: cargo ships dock and fill stockpiles, trucks carry resources to DCs
- **Animated truck sprites** with cab, trailer, wheels, and cargo emoji
- **Consumption model**: DCs drain inventory scaled by operational facility count
- **Shortage effects**: DCs dim when stock < 30%, flicker when < 60%

### 💼 VC Deal Flow
- **Animated funding rounds** — VC partners travel to lab HQs for deals
- **Handshake animations** on deal close with money burst particles
- **Deal ticker** integration with existing VC Row zone
- **State machine**: spawning → traveling → meeting → celebrating → done

### 📄 Research Paper Tracker
- **Live arXiv API** — fetches 30 latest cs.AI/cs.LG/cs.CL papers
- **Lab keyword matching** — routes papers to correct lab HQs (12 labs supported)
- **Envelope delivery animation** — floating descent with sway, landing flash
- **15 fallback papers** when arXiv is unreachable
- **Delivers every 600 ticks**, cycles through paper queue

### 🕶️ The Underground (Black Market)
- **Hidden zone** after Neon Bar — dark alley aesthetic with neon accents
- **3-tier detection** for jailbroken/uncensored models:
  - T1: Name-pattern keywords (uncensored, abliterated, unfiltered, etc.)
  - T2: Curated notorious models (Dolphin, WizardLM-Uncensored, MythoMax, etc.)
  - T3: Derivative detection (open-source + known base + different lab)
- **Dumpster entrance** with clickable hitzone → "shadow_market" achievement
- **Vendor stalls** with colored goods, brick walls, wanted poster, exposed pipes
- **Raid events**: periodic safety inspector warnings with scatter/resume cycle

### 👶 NPC Aging Visuals
- **Baby stage**: larger eyes with sparkle highlights, pacifier, onesie with buttons
- **Kid stage**: baseball cap, t-shirt + shorts, smaller cyan dot
- **Rumored models**: floating question mark above head (purple)
- Visual shifts beyond size — each stage has distinct clothing, skin tone, and proportions

### 🌌 3D Holomap · 🚇 Metro (4 lines) · 🏠 NPC Housing (44 NPCs) · 🍸 Neon Bar · 🏛️ Billionaire's Row · 🚀 Space Zone · 👻 AI Graveyard · 📊 12 Data Panels · 🔊 Audio · 🏆 21 Achievements · 🌐 The Backbone · 💰 VC Row

### 🖥️ Terminal Mode — the Bloomberg of the AI industry
Press **`D`** (or "Open the Terminal" on the landing page) for a data-only, pixel-art-free dashboard of the entire sim.
- **Command line** — the `⟨GO⟩` bar. Press **`/`** and type a lab, model, country, power source, or a function (`OPENAI`, `LEAD`, `CN`, `POWER`, `TAPE`…). Fuzzy autocomplete, arrow-key nav, Enter to jump or drill in.
- **Persisted memory** — charts remember. Metrics are sampled to `localStorage` across sessions (plus an always-on daily Supabase snapshot), so sparklines show real spans with Δ-vs-24h and all-time highs instead of a 16-second window.
- **Drill-down pages** — click any lab / model / country / power source for a full "security master": benchmark radar, model roster, compute footprint, vitals, bilateral relations, wire mentions. Entities cross-link; **`esc`** backs out.
- **The Tape** — one fused, color-coded wire (news + VC deals + launches + benchmark crownings + policy/bans) as a scrolling ticker and a feed panel.
- **Watchlist + alerts** — pin entities with **☆ WATCH**; an engine diffs their state and fires in-terminal toasts (new flagship, ELO moves, retirements).
- **Light by design** — opening the Terminal pauses the Pixi renderer (no city is drawn) and pumps the sim at ~10 Hz behind the shell, so the data view is cheaper than the city, not heavier.

---

## Performance

Session 15 (v225-v233) shipped a full perf pass:

- **BitmapText chat bubbles** — no per-frame texture churn from `new PIXI.Text(...)`
- **Off-screen culling** — NPCs/cars/vendors/particles set `.renderable = false` when outside the camera box (with 200px margin). State machines keep ticking; only rendering is skipped.
- **Lazy zone boot** — 6 edge zones (Port, Power, VC Row, Backbone, Robotics, Longevity) defer construction until the camera approaches within ~3 screens.
- **Debug overlay** — press `` ` `` to measure FPS/draw calls/sprites live

## Controls

| Key / Action | What it does |
|---|---|
| Drag / Swipe | Pan camera |
| Scroll / Pinch | Zoom |
| Click building | Enter interior |
| Click model/CEO + 📡 Track | Follow entity through their day |
| `T` | Toggle auto-tour |
| `` ` `` (backtick/tilde) | Toggle debug/perf overlay |
| `?embed=1` URL param | Embed mode (chrome stripped, sticky auto-tour) |

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | PixiJS 7.3.2 (2D city) + Three.js r128 (3D Holomap) |
| Fonts | PIXI BitmapText for high-frequency text (chat bubbles, HUD) |
| Audio | Web Audio API (procedural oscillator synthesis) |
| Data | 6 live API pipelines (HuggingFace, Google AI, ZeroEval, Launch Library 2, news RSS, arXiv) + CelesTrak satellite API + Finnhub commodities |
| Backend | Supabase (cross-player cloud sync) |
| Hosting | Netlify (auto-deploy on push to main) |
| Tooling | ESLint flat config + Prettier + editorconfig |
| Code | ~63K lines vanilla JavaScript, ~97 files, zero bundler |

## Development

```bash
# Clone + serve locally (any static server)
git clone https://github.com/L0nE-F0x/SingularityCity.git
cd SingularityCity
npx http-server -p 5500   # or: python -m http.server 5500

# Bump cache versions after code changes
node tools/cachebust.mjs            # auto-pick max(local, remote) + 1; also syncs sw.js CACHE_NAME
node tools/cachebust.mjs 433        # or pin a specific version

# Lint
npx eslint js/
```

## File Structure

```
index.html              — Landing page + game shell + all overlay panels + embed mode detection
embed.html              — Thin wrapper: /embed.html → /index.html?embed=1
sw.js                   — Service worker (offline caching, cache-bump-per-deploy)
eslint.config.js        — Flat ESLint config with ~90 writable project globals
.prettierrc             — Prettier config (4-space, single quotes)
tools/
  cachebust.mjs         — Dev-only: rewrite ?v=N on local script tags
css/styles.css          — All styles including holomap + responsive breakpoints
js/
  engine.js             — Game loop, init, camera, easter eggs, achievements
  environment.js        — Building rendering, weather, day/night, skybox
  entities.js           — Character AI, trains, cars, helicopters, chat bubbles
  entities_gfx.js       — Metro tunnels, stations, bunkers, car/helicopter sprites
  camera.js             — Viewport, zoom, tracking, orbit pull detection
  ui.js                 — All UI panels, benchmarks, costs, census, ticker
  api.js                — Model discovery, HuggingFace/Google/ZeroEval pipelines
  data.js               — Static data: achievements, chat messages, news fallbacks
  snd.js                — Procedural audio engine
  personality.js        — Model personality traits
  persistence.js        — LocalStorage save/load
  multiplayer.js        — Ghost cursor multiplayer
  holomap.js            — Three.js 3D galaxy visualization
  macro_view.js         — Minimap & zone navigation
  easter_eggs.js        — Hidden features & Konami code
  city_elevator.js      — Building elevator system
  compute_worker.js     — Web worker for heavy computations
  npc_housing.js        — NPC registry & commuter system
  street_vendors.js     — Food cart NPCs

  # Interiors
  interior_manager.js          — Routes building types to interior modules
  interior_city_core.js        — HQ building interior system
  interior_city_props.js       — HQ interior furniture
  interior_city_ai.js          — Interior character AI behaviors
  interior_res_core.js         — Residential/estate interior system
  interior_res_props.js        — Furniture, elevator, luxury props
  interior_res_ai.js           — Interior character AI behaviors
  interior_avatar_states.js    — Avatar sleeping/sitting/working states
  interior_dc.js               — Data center interiors
  interior_bar.js              — Neon bar interior
  interior_npc.js              — NPC housing interiors
  interior_legacy.js           — Legacy building interiors
  interior_metro.js            — Metro station / underground platform interiors
  interior_newspaper.js        — Singularity City Times printing-press interior
  interior_backbone.js         — Backbone network interiors
  interior_vcrow.js            — VC Row interiors
  interior_robotics.js         — Robotics factory interiors
  interior_longevity.js        — Longevity research interiors
  interior_agents.js           — Agent District tower interiors
  interior_alignment.js        — Alignment Forest cabin interiors
  interior_embassy.js          — Embassy Row consulate interiors (per-country)
  interior_ambassador_res.js   — Ambassador villa interiors (Embassy Quarter)
  interior_black_market.js     — Underground / Black Market interior

  # Zones (logic / env pairs)
  orbit_mode.js          — LEO orbit view with real satellite data
  xray_mode.js           — Diagnostic wireframe overlay
  robotics_zone.js       — Robotics factory zone data & NPCs
  robotics_env.js        — Robotics factory animations
  longevity_zone.js      — Longevity research zone data & NPCs
  longevity_env.js       — Longevity research animations
  backbone_zone.js       — Backbone network zone data & NPCs
  backbone_env.js        — Backbone network animations
  agents_zone.js         — Agent District zone data, NPCs, status ticker
  agents_env.js          — Agent District animations (data flow, bots, LEDs)
  alignment_forest.js    — AI safety institute cabins (MIRI / METR / Apollo / Redwood / FAR AI)
  embassy_row.js         — Embassy Row consulates with country flags & policy briefs
  embassy_quarter.js     — Ambassador villas with per-country architecture
  power_zone.js          — Power grid zone data
  power_env.js           — Power grid animations
  power_zone_interior.js — Power plant interiors
  port_zone.js           — Port district zone data
  port_env.js            — Port district animations (ships, ocean)
  vc_row.js              — VC Row zone data & cars
  vc_row_env.js          — VC Row animations
  space_data.js          — Launch Library 2 API integration
  space_environment.js   — Desert biome rendering
  space_entities.js      — Rocket launch system
  space_interior.js      — Mission control interior
  datacenter_data.js     — DC facility data
  underground.js         — Shared sub-surface rendering (cables, strata, pipes)

  # Events & effects
  seasonal.js           — Seasonal events (snow, fireworks, etc.)
  seasonal_env.js       — Seasonal environment effects
  aurora.js             — Aurora borealis & comet effects
  conference.js         — Conference center system
  university.js         — University campus system
  court.js              — AI Court system

  # Session 15 — the 10-phase roadmap (v225-v233)
  debug_overlay.js      — Debug module: FPS/drawCalls/sprites overlay (~ hotkey)
  bitmap_fonts.js       — BitmapFonts module: lazy PIXI.BitmapFont.from() wrapper
  goals.js              — Goals module: archetype NPC routines (~20% opt-in)
  auto_tour.js          — AutoTour module: 20-landmark idle screensaver (+ embedSticky)
  newspaper.js          — Newspaper module: weekly Singularity City Times + PDF

  # Session 16 — 8-feature expansion (v290-v291)
  city_park.js          — Central Park: fountain, trees, benches, pond, lamp posts
  bird_flocks.js        — Procedural V-formation birds with landing & scatter
  ai_index.js           — Global AI Index: composite 0-1000 score billboard
  supply_chain.js       — Port→DC supply chain: trucks, inventory, shortage effects
  black_market.js       — Underground zone for jailbroken models (3-tier detection)

  # Sessions 17+ — terminal mode, civilisation scoring, world expansion
  terminal.js           — Bloomberg-style terminal: command line, drill-down pages, persisted charts, fused tape, watchlist/alerts (D hotkey)
  kardashev.js          — Kardashev-scale civilisation score (0.700 → 1.000 Type I)
  quests.js             — Quest log: 29 quests across 6 categories, derived from achievements
  hn_blimps.js          — HackerNews AI-story blimps drifting across the sky
  tutorial.js           — Opt-in 30-step interactive walkthrough
  shadows.js            — Dynamic building shadows tied to the sun's day/night arc
  crowd_separation.js   — Local NPC avoidance via spatial-hash neighbour queries
```

## License

MIT

