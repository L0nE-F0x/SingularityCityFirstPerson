# Resume here — Singularity City: First Person

**Updated:** 2026-07-28 (rendering overhaul, content parity, elevator + scale, supply chain).
**Deployed:** yes — `main` @ `541aa25` is live via Netlify auto-deploy from a push to `main`.
**Owner status:** playtesting the live build; happy with frame rate and exposure.

```
python serve.py 8931
http://127.0.0.1:8931/?autostart=1          # skip the start screen
http://127.0.0.1:8931/home.html             # landing page
```

Hard-refresh after code changes: **Ctrl+Shift+R**.

---

## 1. How to work on this

### Tests — all five must stay green

```
node tests/run_node_check.mjs        # import-checks all 64 modules
node tests/parity_exercise.mjs       # drives real sim entry points
node tests/interior_theme_check.mjs  # every interior builds on every floor
node tests/street_check.mjs          # kerbs never cross a carriageway
node tests/store_check.mjs
```

### Screenshots without a browser pane

`serve.py` has a **dev-only** `POST /__shot?name=foo` endpoint that writes
`.shots/foo.jpg` (gitignored). From page JS:

```js
G.renderer.render(G.scene, G.camera);
const url = G.renderer.domElement.toDataURL('image/jpeg', 0.86);   // BEFORE any await
await fetch('/__shot?name=foo', { method: 'POST', body: url });
```

**Read/serialise the canvas before any `await`**, or you capture a cleared
buffer. A blank or all-black frame is almost always this, not a render bug.

If the browser pane will not composite, you can still drive everything
headlessly: set `G.renderer.setSize(1280, 720, false)` and step the systems
manually (`G.weatherSys.update(1/30, t)`, `G.world.update(...)`, etc).
Move the camera BEFORE running the systems — the sky dome, stars and shadow
frustum are parked on the camera each frame, so updating first and moving after
leaves a hole in the sky.

### Useful boot params

`?autostart=1` · `?sim=<sec>` fast-forward · `?dp=<0..1>` freeze time of day ·
`?wx=<state>` force weather · `?inside=<buildingId>` boot into an interior ·
`?festival=<id>` force a festival · `?allregions=1` regional festivals ·
`?x= &z= &yaw=` teleport · `?debug=1` log draw calls · `?tutorial=1` force it.

---

## 2. Architecture decisions that are NOT obvious

Read these before touching the relevant file — each cost real debugging.

**`js/world.js` — `facadeTint` clamps in sRGB, deliberately.**
`Color.getHSL`/`setHSL` default to the *linear* working colour space. Clamping
L to `[0.46, 0.74]` there is really sRGB `[0.71, 0.88]`, which forced every
façade into a near-white band: district grey `#5a6b80` came out `#94aecf` and
DeepSeek `#0ea5e9` came out `#8db2d3` — two unrelated colours landing on the
same pale blue. This was the single biggest cause of the original "washed out,
everything looks the same" complaint. Do not drop the `THREE.SRGBColorSpace`
arguments.

**`js/interior.js` — `ROOM_SCALE = 1/3`.**
Interiors are authored at ~3x human scale (ceiling 96 = 9.6 m). The whole
interior group is scaled by `ROOM_SCALE`, and the few places where
interior-local units meet WORLD units convert through `S()`: colliders,
teleports, and the lift/hotspot/exit proximity checks. Any new consumer of
`_liftZones` / `_hotspots` / `_colliders` must convert too. Prefer
`Interior.liftZoneWorld(i)` over reading `_liftZones` raw.

**`js/world.js` — per-building instance handles.**
Buildings share three instanced meshes. `b._inst` and `b._capInst` record
`{ mesh, i, base }` so a system can recolour ONE building; changing a material
would recolour the whole city. This is how the datacentre brownout works, and
why the parapet cap is tracked separately — dimming only the walls left every
roof vividly lit and the effect did not read from above.

**`js/supply_chain.js` — shortage tracks the scarcest CRITICAL input.**
Averaging every stock let a full grid and plenty of helium mask an empty GPU
stockpile; a real run reported "NOMINAL" with accelerators at 17%.

**`js/interior.js` — the lift is a state machine, not a teleport.**
`setFloor()` rides (closing → moving → opening). `setFloorInstant()` jumps with
no ride — use it in tests and boot params. `exit()` refuses above floor 0
unless you pass `exit(true)`; teardown paths (metro boarding, test harness)
pass force. `Interior.inCar()` exists because the lift-bank zone sits out in
the lobby and does not cover the car interior.

**`js/textures.js` — `signAtlas()` is the live path.**
One atlas + merged quads = 3 draw calls. The old per-building `makeSignPlate`
path was ~390 draw calls and 130 textures.

**`js/traffic.js` — `mergeByMaterial()` on every vehicle builder.**
Vehicles are authored as dozens of little boxes; `ambientCars` alone was **614
draw calls** (44 meshes per car). Keep new vehicles going through it.

---

## 3. Traps that have already caught someone

- **`G.player.eyeY` is ABSOLUTE** (`G.floorY + EYE_H`), not an offset. Adding
  `FLOOR_Y` again puts the camera 4000 units under the world.
- **`THREE.Raycaster` ignores `object.visible`.** Filter up the parent chain or
  you will "find" hidden geometry and chase a ghost.
- **`PointsMaterial.size` is WORLD-space** and is *not* affected by an ancestor
  group's scale. Sizes authored in a scaled space render enormous — this made
  the holomap a white blob.
- **Merged-shell meshes report `material.color` as `#ffffff`** because they use
  `vertexColors`. Colour alone will not identify them in a raycast.
- Opening a hole in a wall means opening it in **both** the collider and the
  geometry. Doing only the collider put the player inside the lift car facing
  the back of a solid wall.
- `pixi/` is a **read-only vendored copy** of the production 2D app. Never edit
  anything under it.

---

## 4. Current state

- **25 districts**, 148 named buildings + ~200 infill ≈ **350 blocks**
- Tallest: Google DeepMind **77 m / 32 floors**
- **~570 draw calls** at street level (was ~1400 before the vehicle merge)
- Citizens: 700 (medium preset) + 45 shift-working worker NPCs
- Sun shadows on medium/high; sky-derived PMREM environment; ACES at exposure 1.35
- Interiors **bespoke** for: bar, underground, metro, embassy, villa, alignment,
  press, legacy museum, backbone, agents, robotics, longevity, VC row, worker
  housing. Everything else uses the generic themed room.
- Modes: terminal (13 live panels), x-ray (metric heat, data cards, packet
  arcs), holomap (projected galaxy)
- Systems: news reactivity, 19 real festivals, district ambience, personality
  behaviour, supply chain, tutorial, daily briefing

---

## 5. Open / deferred — pick up here

**Deferred by the owner — do NOT "fix" without asking:**

- **Orbit mode is permanently off the list.** The 2D version covers it. It is
  still the original ~99-line stub and should stay that way.
- **Interior palette reads bright and pale** on upper office floors and worker
  apartments. Lighting was measured and is correct (hemi 1.35 / ambient 0.85) —
  it is the light-on-light palette, i.e. an art-direction decision. Owner said
  leave it for now. This is the highest-value remaining visual work, but ask
  first.

**Known cosmetic, not chased:**

- Daytime fireworks from a news celebration look slightly odd. Brief and rare.
- Parapet caps stay lit under the datacentre brownout on *non*-consumer
  buildings — correct, but worth knowing if you extend the effect.

**Nothing from the original 2D→FP parity audit remains outstanding.**
