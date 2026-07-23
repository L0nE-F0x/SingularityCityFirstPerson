# Resume here — Singularity City First Person

**For the next Grok/Claude session.** Updated 2026-07-23 after full PARITY backlog pass.

```
C:\Users\TempleLodge\Desktop\SingularityCityFirstPerson
python serve.py 8931
```

## Status

**PARITY.md is complete** except deliberate non-goals (live API / Supabase). All backlog systems shipped; terminal last among modes.

## Run / test

```powershell
cd "C:\Users\TempleLodge\Desktop\SingularityCityFirstPerson"
python serve.py 8931
node tests/run_node_check.mjs
node tests/parity_exercise.mjs
# optional: node tests/boot_probe.mjs
```

Modes: **O** orbit · **X** x-ray · **H** holomap · **Ctrl+D** / **`** terminal · **F** interior floor.

## Constraints (unchanged)

1. Never edit ApexForge/SingularityCity or SingularityCity3D
2. Perf doctrine: instancing/merged geo; no shadows/post/log-depth/transmission
3. Use serve.py not http.server
4. Human pointer-lock + WASD check still open


## Integration (next major product direction)

See **`INTEGRATION.md`** — plan for merging FP into singularitycity.net as a
toggleable view with shared CityStore / live data / Supabase. **Do not start
that work until the owner explicitly says so.** Standalone FP + Netlify deploy
remain valid until then.
