# Resume here — Singularity City: First Person

**Updated:** 2026-07-29 (free-fly, landscape polish, idle auto-tour screensaver).  
**Deployed:** yes — `main` @ `5cc6ee7` on Netlify (`singularitycityfirstperson.netlify.app`).  
**Owner status:** wrapping for the night; will playtest live and report back tomorrow.

```
python serve.py 8931
http://127.0.0.1:8931/?autostart=1          # skip the start screen
http://127.0.0.1:8931/home.html             # landing page
http://127.0.0.1:8931/pixi/                 # 2D city (public entry)
```

Hard-refresh after code changes: **Ctrl+Shift+R**.

---

## 1. How to work on this

### Tests — all five must stay green

```
node tests/run_node_check.mjs        # import-checks all modules
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
façade into a near-white band. Do not drop the `THREE.SRGBColorSpace` arguments.

**`js/interior.js` — `ROOM_SCALE = 1/3`.**
Interiors are authored at ~3x human scale. Interior-local units meet WORLD units
via `S()` / `Interior.liftZoneWorld(i)`. Prefer helpers over raw `_liftZones`.

**`js/world.js` — per-building instance handles.**
`b._inst` / `b._capInst` recolour ONE building; changing a shared material
recolours the whole city.

**`js/textures.js` — `signAtlas()` is the live path.**
One atlas + merged quads. Do not revive per-building `makeSignPlate` for street signs.

**`js/traffic.js` — `mergeByMaterial()` on every vehicle builder.**
Keep new vehicles going through it.

**`js/fly_mode.js` — free-fly (C key).**
Mutually exclusive with orbit / tour / interiors / metro. Player still owns
mouse look while `G.flyMode`; position is owned by `FlyMode.update`. Landing
clamps XZ to the walkable city pad and restores eye height.

**`js/tour.js` — idle screensaver.**
`G.settings.autoTour` (default true) + `G.settings.idleTourMin` (default 5).
Idle loop restarts forever; manual `T` tour ends after one circuit + achievement.
KeyT is owned by UI.toggle — tour input listener must not also treat T as “stop”.

---

## 3. Traps that have already caught someone

- **`G.player.eyeY` is ABSOLUTE** (`G.floorY + EYE_H`), not an offset.
- **`THREE.Raycaster` ignores `object.visible`.** Filter up the parent chain.
- **`PointsMaterial.size` is WORLD-space** and ignores ancestor scale.
- **Merged-shell meshes report `material.color` as `#ffffff`** (vertexColors).
- Opening a hole in a wall = collider **and** geometry.
- `pixi/` is a **read-only vendored copy** of the production 2D app. Never edit it.
- `netlify.toml` must stay **UTF-8 without BOM**.

---

## 4. Current state

- **25 districts**, 148 named buildings + ~200 infill ≈ **350 blocks**
- Sun shadows on medium/high; sky-derived PMREM; ACES exposure 1.35
- Modes: free-fly **C**, orbit **O**, tour **T** (+ idle screensaver), x-ray **X**,
  holomap **H**, terminal, city map **V**, 2D bridge **P**
- Exterior landscape (2026-07-29): countryside ground, sand beach, foam strip,
  richer ocean, multi-layer mountain foothills + peaks with mountain texture
- Settings: idle auto-tour on/off + idle delay (1–20 min), persisted via CityStore

---

## 5. Product flow (decided 2026-07-28)

Public entry is **2D**, matching production singularitycity.net:

1. Site root / `/pixi/` → landing (Enter Singularity City).
2. FP is **only** from the in-city toolbar **`🚶 FP`**.
3. Netlify: `/` → `/pixi/` (302); FP stays at `/index.html`.

Bridge: `pixi/js/sc_integrated_bridge.js` (toolbar only). Do not re-add landing CTAs.

---

## 6. Open / deferred — pick up here

**Owner will playtest free-fly + landscape + screensaver live — wait for notes.**

**Deferred by the owner — do NOT "fix" without asking:**

- **Orbit mode is permanently off the “improve me” list** for feature work
  (still present as the LEO stub; free-fly **C** is the birds-eye tool now).
- **Interior palette reads bright and pale** on upper office floors and worker
  apartments — art-direction decision; ask first.

**Known cosmetic / ops (not blocking playtest):**

- Daytime fireworks from a news celebration look slightly odd. Brief and rare.
- Parapet caps stay lit under the datacentre brownout on *non*-consumer buildings.
- Console noise (not failures): arena redirect, hallucinated model filter, PWA
  install prompt, bridge ready log.
- Netlify functions need site env **`SUPABASE_URL`** + **`SUPABASE_SERVICE_KEY`**
  for `submit-data` writes.

**Nothing from the original 2D→FP parity audit remains outstanding.**

---

## 7. This session (2026-07-29) — done

| Commit | What |
|--------|------|
| `5cc6ee7` | Free-fly **C**, richer exterior landscape textures, idle auto-tour screensaver + settings |

### Feature notes for tomorrow

| Feature | How to use / where |
|---------|-------------------|
| Free-fly | **C** — WASD, Space/Q up, Ctrl/E down, Shift boost, Alt slow. Lands under camera. |
| Idle tour | Settings → Idle auto-tour + Idle delay. Default 5 min. Manual **T** still works. |
| Landscape | `js/textures.js` (`water`, `sand`, `countryside`, `mountain`) + `js/world.js` `_buildWater` / `_buildHills` / base ground |

**Safest next action:** apply owner playtest notes from free-fly / aerial landscape / screensaver. Do not invent large new features until they report.

---

## 8. Prior session (2026-07-28 evening) — done

| Commit | What |
|--------|------|
| `22ffad5` | 2D-first entry; compact toolbar FP; landing CTAs removed |
| `64ea79c` | Netlify deploy fix (BOM stripped; temporary no-functions) |
| `3aeadb5` | Daily briefing crash (`ts` localeCompare); functions + favicons restored |
