# Resume here — Singularity City Integrated (2D + FP)

**Updated:** 2026-07-26 (destination parity + skyline polish while playtesting).  
**Owner status:** Playtesting; not ready for production overwrite.

```
python serve.py 8931
http://127.0.0.1:8931/home.html
http://127.0.0.1:8931/?autostart=1
```

**Hard-refresh** after code changes: Ctrl+Shift+R in Chrome.

---

## Live this playtest session

### Destination parity (2D interior routes)
Distinct FP rooms for: underground (black market), VC row, agents, alignment cabins, arena, cafe, gym, nursery, conference center, backbone IXP, plus existing metro/platform, labs, DCs, bar, court, embassy, mission (incl. **launchpads**), power, robotics, longevity, academic, press, home.

Blocked outdoors only: park, crane, graveyard, billboard, monument.

### Skyline polish
- Triple setbacks on fl≥10 towers  
- Denser belt ledges  
- Crown/antenna spires on tall crowns  
- Phong facades + brighter glass reflections in procedural textures  
- Parapet/cap materials upgraded  

### Mobility robustness
- Metro holds longer when player is near the station  
- Next-stop / alight prompts while riding  
- Founders soft-warp near venue if still >900u away after act change  
- Special destinations get a mezzanine floor even when `fl=1`  

### Prior backlog (same day)
Founder schedules, boardable metro, elevators, VIP cars/helis, interior materials.

---

## Constraints
1. Do not edit ApexForge production  
2. Perf: relaxed slightly (Phong/Standard, fill lights) — still no shadows/post/log-depth/transmission  
3. `serve.py` only  
4. No fake multiplayer ghosts  

## Tests
```powershell
node tests/run_node_check.mjs
node tests/parity_exercise.mjs
node tests/store_check.mjs
node tests/street_check.mjs
```

## Playtest tips
| Goal | How |
|------|-----|
| Founders at HQ | `?dp=0.4` walk AI Tech District |
| Founder lunch | `?dp=0.52` cafe / park |
| Metro | Central Station → F platform → E board → E alight |
| Elevator | Enter tall HQ → F or digits at lift |
| Black Market | Underground district, enter speakeasy |
| Launchpad | Space Zone, E for mission/control interior |

*Refresh with Ctrl+Shift+R if the tab was open before the polish landed.*
## Hotfix 2026-07-26 (playtest feedback)

- **Helicopters:** proper fuselage/skids/rotors, face travel direction, higher altitude  
- **VIP limos:** clear glass, seated CEO figure, floating name tag (Sam/Dario/…)  
- **Vehicles:** Nvidia supply truck always spawns + 3 delivery vans; ambient cars Standard materials  
- **Commuting:** workers go *indoors* (hidden) at HQ/home; streets show walkers + founders  
- **Elevators:** already present — **F** anywhere indoors, **E** at lift bank (left wall), **0–9** jump  
- **Interiors:** denser props (plants, desks, art, pendants) on every theme  

Hard-refresh: **Ctrl+Shift+R**
