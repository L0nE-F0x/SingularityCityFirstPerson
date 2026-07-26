# 🏙️ Singularity City — First Person

**Walk the streets of the AI industry.** The living world of [singularitycity.net](https://singularitycity.net) rebuilt as a first-person exploration game: every lab, every district, every citizen — now at street level, on foot, in 3D.

This is a **separate project** from the production 2D app (`ApexForge/SingularityCity`) and the old orbit-camera experiment (`SingularityCity3D`). It reuses their game data and hard-won performance lessons, but shares no code with them.

## Run it

```bash
python serve.py
```

Open `http://localhost:8931`, click **ENTER THE CITY**. (ES modules require http:// — opening `index.html` directly from disk won't work.)

`serve.py` is a threaded static server. Avoid `python -m http.server`: it's single-threaded, so one browser keep-alive connection wedges every other request.

## Controls

| Key | Action |
|---|---|
| WASD / arrows | Move |
| Mouse | Look (click to capture) |
| Shift | Sprint |
| Space | Jump |
| E | Enter a building / inspect it / meet citizen |
| TAB | City panels (census, leaderboard, quests…) |
| M | Minimap |
| T | Auto-tour (cinematic landmark circuit) |
| ESC | Pause / release mouse |

URL params: `?autostart=1` skips the start screen · `?dp=0.5` freezes the time of day (0–1) · `?x= &z= &yaw=` teleports.

## What's in the city

All **20 districts** from the production app, laid out on a 5×4 grid with connector roads:

🚀 Space Zone · 🖥️ Compute District (16 real data centers & fabs) · ⚡ Power Grid (solar/wind/nuclear/coal/hydro) · 🌐 The Backbone · 🏛️ Civic Center · ⚓ Port District (cranes, container ships, lighthouse) · 🏢 AI Tech District (7 lab HQs) · 💰 VC Row · 🏳️ Embassy Row · 🏡 Embassy Quarter (6 ambassador villas) · 🤖 Robotics Quarter · 🌳 Public Square (arena, leaderboard, neon bar, graveyard) · 🧬 Longevity Wing · 🎛️ Agent District · 🌲 Alignment Forest (MIRI/METR/Apollo/Redwood/FAR) · 🕶️ The Underground (find it) · 🎓 University · 🏘️ Residential · ⛲ Central Park · 🌲 Pine Reserve

**Walk inside.** Press E at a building and you step into its lobby — reception, lift bank, name board in the lab's colours, and dressing that follows the building: server racks in a datacenter, a bar counter in the bar, stacks in the university.

**Streets that behave.** Two-lane carriageways with centre dashes, edge lines and zebra crossings; kerbed sidewalks; cars that drive on the right, queue behind each other and stop at traffic signals; pedestrians who walk on the pavement, not down the middle of the road.

Plus: 150–340 model citizens (by quality preset) — each with their own skin tone, hair, clothing colour and a real walk cycle — living the production daily schedule (commute → work → lunch → arena → bar → sleep), named famous models you can meet (GPT-4o, Claude, Gemini, Llama, DeepSeek, Grok + the founders), cars, trams on an elevated viaduct, news blimps, a helicopter, periodic rocket launches, dynamic weather (rain/snow/thunder/fog/cherry blossom), full day/night cycle, auroras, 28 achievements, 26 quests, the weekly newspaper, and the original soundtrack.

## Why it's fast (and the old 3D version wasn't)

The 2019-2023 3D experiment lagged because of ~2,000 unbatched draw calls, full-res bloom, PCFSoft shadows, logarithmic depth and transmissive materials. This version is built around the autopsy:

- **3 InstancedMeshes for ALL generic buildings** (height-tiered, shared procedural facade textures, per-instance lab colors)
- **One 4096² sign atlas** for every neon sign in the city → 1 draw call
- **One merged vertex-colored mesh** for all specialty structures (launch pads, turbines, dishes, cranes…)
- Citizens = 1 InstancedMesh · cars = 1 InstancedMesh · trees/lamps/benches = instanced
- **No shadow maps, no post-processing, no log-depth, no tone-mapping curve**; DPR capped; fog-based draw distance
- Result: **~92 draw calls / 99k triangles**, and an interior is 2–3 calls. Measured on real hardware (Intel Arc, D3D11): **72 fps locked to vsync**, ~1.9 ms of the 16.6 ms frame budget spent on rendering plus the whole city simulation. The walk cycle, the lane discipline and the crowd spreading are all per-instance data — none of them cost a draw call.

## Tech

Three.js r160 (vendored, no CDN dependency) · zero-build ES modules · procedural canvas textures · WebAudio synth SFX · localStorage save. Same game data as the production app (`js/data.js` is the single source of truth).

## Integrated dual-view (this folder)

This repo now vendors the **full Pixi 2D** production city under `pixi/` plus the **First Person** Three.js app at the root. Production `ApexForge/SingularityCity` is not modified — when you are happy, this tree is what you can push to replace it.

```bash
python serve.py
# http://localhost:8931/home.html   ← pick 2D or FP
# http://localhost:8931/pixi/       ← 2D city
# http://localhost:8931/            ← first person
```

Hard-swap between views from either UI. Details: `INTEGRATION.md`.

## Playtest status

Integrated **2D + First Person** live in this folder (see `home.html`, `INTEGRATION.md`).  
Still under active polish — not a production replacement yet. Resume work from `RESUME.md`.
