# 3D Office Polish — Design Spec

**Date:** 2026-07-21  
**Status:** FULLY DONE (Waves 1–3 implemented + audited; `npm run check` green)  
**Wave:** 3 complete — success criteria met

## Goal

Make the 3D office feel more alive, agents more visually distinct, motion cleaner, and selection/camera interaction more intentional — without abandoning the vinyl-toy + white command-center look in `docs/assets/art-direction.md`.

## Approach

**Parallel polish waves.** Four specialist tracks work on isolated surfaces; orchestrator merges and QA each wave. Stay in existing Three.js WebGPU + instanced vinyl pipeline. No R3F rewrite. No full style reboot.

| Track | Outcome |
|-------|---------|
| A. Identity | Expand accessories beyond cap/muffs; unique specialist silhouettes |
| B. Motion | Smoother walk ↔ sit ↔ work; calmer desk life; less skate/crowd milling |
| C. Office | Richer materials/lighting/zone clarity within current floor plan |
| D. Interaction | Better selection ring, camera follow/chat framing, click/hover feedback |

## Constraints

- Keep shared vinyl body + GPU instancing (`CharacterManager` + TSL)
- Regenerate assets via `scripts/blender/`; bump cache query on GLBs after regen
- Preserve POI prefixes: `sit_work`, `sit_idle`, `area-*`, `spawn-*`
- One accessory per agent in Wave 1 (no stacking)
- User remains accessory `0` (none); lead keeps cap signature
- Do not redesign floor plan or add rooms in Wave 1

---

## Track A — Character identity & accessories

### Current

Accessory IDs: `0` none, `1` headphones, `2` cap. Lead always cap; specialists alternate 1/2.

### Wave 1 accessory set

| ID | Mesh name | Who | Notes |
|----|-----------|-----|-------|
| 0 | — | User | Unchanged |
| 1 | `headphones` | Specialist | Existing muffs |
| 2 | `cap` | Lead (always) | Existing lead signature |
| 3 | `beanie` | Specialist | Soft rounded knit crown |
| 4 | `glasses` | Specialist | Simple round frames |
| 5 | `lanyard` | Specialist | Chest badge + strap |

### Assignment

- Lead: always `2` (cap)
- Specialists: unique ID per team slot via deterministic role→accessory map (no strict alternate of two)
- Optional later: `accessory` field on `AgentNode`; Wave 1 may use index-based map without schema change

### Technical

- Author meshes in `scripts/blender/generate_character.py`; export `character.glb`
- Wire visibility/tint in `CharacterManager` TSL like cap/headphones
- Team-color tint language: same family as body (soft lift for headwear, slightly darker for muffs/badge)
- Update `docs/assets/art-direction.md` accessories section

### Success

From overview camera, specialists read as distinct people without reading bubbles.

---

## Track B — Motion polish

### Current

Navmesh path → soft seat arrival → `sit_down` → `sit_idle`/`sit_work`. Busy-office pass: ~50% stand-up on 2.5–7.5s beats — restless.

### Wave 1

1. **Desk life cadence**
   - Stand-up rate ~25–30% (from ~50%)
   - Longer seated beats; `sit_work` longer than `sit_idle`
   - Busy/in-progress: desk only — toggle work/idle, no wander

2. **Walk ↔ sit**
   - Retune `SIT_ARRIVAL_BLEND_*` so sit doesn’t snap
   - Brief idle before wander after stand (no instant walk pop)
   - `prepareSitDown` → final seated state remains reliable

3. **Locomotion**
   - Rebalance `AGENT_CRUISE_SPEED` vs Walk stride
   - Keep turn slowdown; slightly stronger yaw on sharp corners
   - Clearer wander target separation

4. **Player**
   - Same cruise/arrival feel as NPCs
   - Re-click floor/POI cancels prior path cleanly

### Out of scope

New Walk/Sit clip authoring unless retuning fails. No full RVO.

### Success

Office feels occupied and purposeful. Sit/stand is continuous. Turns don’t skate.

---

## Track C — Office environment

### Current

White open-plan; grid floor; desks/lounge/counter/board; `colored-*` team accents. Readable but sparse/same-white at iso.

### Wave 1

1. **Materials** — Warm off-white furniture variety; stronger screen glow / lamp warmth; plant color variety
2. **Zones** — Work cluster denser “alive” cues; lounge warmer vs desks; hub stays open with accent border
3. **Layout** — Keep floor plan + POI graph; nudge only if pathing cramped
4. **Lighting** — Soft high-key; stronger contact shadows; subtle work-cluster lamp emissives

### Out of scope

New rooms, multi-floor, outdoor views, heavy texture atlases.

### Success

Work vs lounge vs hub reads instantly; office feels designed, not empty boxes.

---

## Track D — Interaction UX

### Current

Orbit camera, click-select NPC + follow, new flat `SelectionRing`, floor/POI click for player walk, React bubbles.

### Wave 1

1. **Selection ring** — Soft pulse/scale or opacity breathe; agent-colored; readable when partially occluded (render order / slight Y lift OK)
2. **Camera** — Smoother follow damping; chat two-shot framing polish (existing Stage chat helpers)
3. **Click/hover** — Clearer cursor + hover feedback; selection doesn’t fight orbit drag
4. **Player focus** — Optional subtle ring when following self is deferred unless cheap; prioritize NPC selection polish

### Success

Selecting and moving among people feels deliberate and smooth, not twitchy.

---

## Wave plan

1. Ship thin slice of A–D together — **DONE** (verified 2026-07-21; wander clearance bug fixed to 1.65)
2. Visual/code QA — **DONE** (Tracks A–D PASS; `npm run check` green)
3. **Wave 2** — deepen all four tracks (below)
4. **Wave 3** — final polish + success-criteria gate

---

## Wave 2 — Deepen

### A Identity
- Add `backpack` (type 6) and `scarf` (type 7) — vinyl style
- Expand specialist pool to cycle `[1,3,4,5,6,7]` (still unique for ≤6 specialists; lead stays cap)
- Optional: `accessory?: number` on `AgentNode` when set overrides the cycle
- Still one accessory per agent (no stacking)

### B Motion
- Wander clearance ≥ 1.65 (fixed); occupancy-aware area target nudge stronger
- Per-agent cruise speed variance ±8% deterministic from agent index
- Soft secondary seated life: occasional `look_around` is already there; prefer longer sit_work holds when task in_progress (already) — add micro expression blink variance if ExpressionBuffer allows cheaply
- When two agents path-cross near, slightly stronger IDLE separation weight while walking (constants only if possible)

### C Office
- Lounge chairs (`static-chair` not `work-chair`) get distinct softer/warmer material vs work chairs
- Subtle screen emissive pulse when nearby agent is in `sit_work` OR globally gentle idle pulse on all screens (prefer global gentle pulse — simpler, no per-desk wiring)
- Hub `colored-*` rim: slight emissiveIntensity on theme tint so accent border reads more

### D Interaction
- Dim non-pulsing hover ring (reuse SelectionRing or second instance) when hovering unselected NPC
- One-shot scale/opacity pop on select before settle into pulse
- Cache selected agent color (avoid rebuilding agent list every frame)
- Cheap player self-ring when follow target is user (subtle, non-pulsing)

---

## Wave 3 — Final polish & done criteria

### Must pass to call “fully done”
1. Every specialist on Creative Agency (and typical 4-specialist teams) has a unique accessory silhouette including Wave 2 pieces when roster >4
2. Desk life feels calm; wander clearance does not stack agents in corridors
3. Lounge vs desk materials clearly differ; screens/lamps feel alive; accents readable
4. Hover → select → follow feels intentional (hover ring + select pop + pulse)
5. `npm run check` passes
6. Art-direction.md documents final accessory IDs and material language

### Wave 3 tasks (only if Wave 2 leaves gaps)
- Nameplate sprites if silhouettes still ambiguous at iso
- Further cruise/turn retune if skate remains after variance
- Small desk clutter join in Blender only if office still reads empty

## Non-goals

- R3F migration
- Unique body meshes / gender variants
- Full crowd simulation rewrite
- Style reboot away from vinyl + command-center
- Accessory stacking (deferred indefinitely unless Wave 3 requires)