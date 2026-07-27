# 3D Office Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wave 1 polish of character identity, motion, office materials/lighting, and selection/camera interaction while keeping vinyl-toy + command-center style.

**Architecture:** Four parallel tracks with isolated file ownership. Shared files (`constants.ts`, `SceneManager.ts`, `Stage.ts`, `art-direction.md`) are touched only by the owning task listed below; orchestrator merges conflicts.

**Tech Stack:** Three.js WebGPU + TSL, Blender procedural scripts (`scripts/blender/`), Vite/React UI overlays, Zustand stores.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-3d-office-polish-design.md`
- Keep WebGPU instanced vinyl pipeline; no R3F
- One accessory per agent; user=0, lead=cap(2)
- Preserve POI prefixes `sit_work` / `sit_idle` / `area-*` / `spawn-*`
- Do not commit unless the orchestrator explicitly asks (user prefers explicit commit requests)
- After regenerating GLBs, bump cache-bust query where models are loaded

## File ownership (Wave 1)

| Track | Owns |
|-------|------|
| A Identity | `scripts/blender/generate_character.py`, `src/simulation/entities/CharacterManager.ts` (accessory only), `docs/assets/art-direction.md` (character accessories), `public/models/character.glb` |
| B Motion | `src/simulation/drivers/NpcAgentDriver.ts`, `src/simulation/CharacterController.ts` (locomotion/sit blend only), motion keys in `src/simulation/constants.ts` |
| C Office | `scripts/blender/generate_office.py`, `src/simulation/world/WorldManager.ts`, lighting in `src/simulation/core/Stage.ts`, office section of art-direction, `public/models/office.glb` |
| D Interaction | `src/simulation/entities/SelectionRing.ts`, selection/camera bits in `SceneManager.ts` + `Stage.ts` (camera follow/chat only), `InputManager.ts` if needed, `SELECTION_RING_*` in constants |

---

### Task 1: Character accessories (Track A)

**Files:**
- Modify: `scripts/blender/generate_character.py`
- Modify: `src/simulation/entities/CharacterManager.ts`
- Modify: `docs/assets/art-direction.md`
- Regenerate: `public/models/character.glb`

**Interfaces:**
- Consumes: existing accessory opacity pattern for `cap` / `headphones`
- Produces: accessoryType `3=beanie`, `4=glasses`, `5=lanyard`; specialist assignment map; TSL visibility + team tint

- [x] **Step 1:** Add `_make_beanie`, `_make_glasses`, `_make_lanyard` in `generate_character.py` (vinyl style, parented/weighted like cap)
- [ ] **Step 2:** Include new meshes in export allow-list and skinning pass alongside `cap`/`headphones`
- [ ] **Step 3:** Regenerate `character.glb` via project’s usual Blender script entry (check README / package scripts for exact command)
- [ ] **Step 4:** In `CharacterManager.initInstances`, assign lead=2; specialists unique among {1,3,4,5} (or 1–5 except forcing lead cap); user=0
- [ ] **Step 5:** Extend TSL accessory visibility/tint branches for types 3–5 (mirror cap/headphones patterns; glasses may stay near-white frames with subtle body tint)
- [ ] **Step 6:** Bump character.glb cache query if present; update art-direction accessories list
- [ ] **Step 7:** Self-review: mesh names stable; no stacking; lead still always cap

**Verify:** Load sim — each specialist silhouette differs; lead has cap; user has none.

---

### Task 2: Motion polish (Track B)

**Files:**
- Modify: `src/simulation/drivers/NpcAgentDriver.ts`
- Modify: `src/simulation/CharacterController.ts` (only if sit/walk ease needs code change)
- Modify: `src/simulation/constants.ts` — only `AGENT_CRUISE_SPEED`, `AGENT_TURN_SPEED_FACTOR`, `SIT_ARRIVAL_BLEND_*`, `AGENT_SEPARATION_WANDER_CLEARANCE`, and any new desk-life constants if added in driver file instead

**Interfaces:**
- Consumes: existing `prepareSitDown`, `walkToPoi`, `moveTo`, desk-life helpers
- Produces: calmer desk cadence; retuned cruise/sit blend

- [ ] **Step 1:** In `NpcAgentDriver`, raise desk-life intervals (e.g. seated work beats ~6–14s; idle ~4–10s)
- [ ] **Step 2:** Change seated stand-up probability from `0.5` to ~`0.28`
- [ ] **Step 3:** Ensure busy/in-progress path never calls wander/stand (desk life only) — verify existing branch and tighten if needed
- [ ] **Step 4:** Retune `SIT_ARRIVAL_BLEND_DURATION` (~0.32–0.40) and ease if snap remains
- [ ] **Step 5:** Slightly adjust `AGENT_CRUISE_SPEED` / `AGENT_TURN_SPEED_FACTOR` to reduce skate; increase wander clearance nudge if agents stack
- [ ] **Step 6:** After stand-up, prefer short idle/`look_around` before wander when possible
- [ ] **Step 7:** Self-review: lead still never sits; chat still suspends autonomy

**Verify:** Idle office: people mostly at desks/lounge, occasional purposeful walks; sit arrival soft; less corridor milling.

---

### Task 3: Office materials & lighting (Track C)

**Files:**
- Modify: `scripts/blender/generate_office.py` (subtle prop/material naming if needed)
- Modify: `src/simulation/world/WorldManager.ts`
- Modify: `src/simulation/core/Stage.ts` (lights/shadows only)
- Modify: `docs/assets/art-direction.md` (office materials paragraph)
- Optionally regenerate: `public/models/office.glb`

**Interfaces:**
- Consumes: existing name-hint material heuristics (`colored-`, screen, plant, floor)
- Produces: warmer furniture variation; stronger screens/lamps; clearer zone read

- [ ] **Step 1:** In `WorldManager`, warm furniture default whites (slight yellow-white) with roughness split for desk vs chair if name hints allow
- [ ] **Step 2:** Increase screen emissive slightly; add/boost lamp `emit` warmth if meshes exist
- [ ] **Step 3:** Plant leaf/plant colors: two greens for variety
- [ ] **Step 4:** In `Stage`, slightly tighten contact shadows / bias so feet/desks ground; keep soft high-key (no harsh contrast)
- [ ] **Step 5:** Only if needed for “alive desks”: small Blender prop join (keyboard/papers already present — prefer runtime materials first)
- [ ] **Step 6:** Update art-direction office materials notes
- [ ] **Step 7:** Self-review: `colored-*` still theme-tints; floor still mid-grey grid

**Verify:** Iso view — work cluster warmer/glowier; lounge softer; hub accents still team-colored.

---

### Task 4: Selection & camera interaction (Track D)

**Files:**
- Modify: `src/simulation/entities/SelectionRing.ts`
- Modify: `src/simulation/SceneManager.ts` (ring update / follow only)
- Modify: `src/simulation/core/Stage.ts` (camera follow/chat easing only — coordinate with Task 3 if both touch Stage: Task 3 lights, Task 4 camera)
- Modify: `src/simulation/constants.ts` — only `SELECTION_RING_*` and chat/follow camera constants
- Optionally: `src/simulation/input/InputManager.ts`

**Interfaces:**
- Consumes: existing `SelectionRing.update(position, colorHex)`
- Produces: pulsing ring; smoother follow; no drag fight regressions

- [ ] **Step 1:** Add subtle opacity or scale pulse in `SelectionRing.update` using elapsed time (pass `time` or use `performance.now`)
- [ ] **Step 2:** Ensure ring renderOrder / Y keeps it readable near desks
- [ ] **Step 3:** Polish camera follow damping / chat two-shot constants in `Stage` + `constants.ts`
- [ ] **Step 4:** Confirm InputManager still skips hover while pointer buttons down (orbit drag)
- [ ] **Step 5:** Wire any new `update(dt)` from SceneManager if ring needs delta
- [ ] **Step 6:** Self-review: hide ring when selection cleared; color matches agent

**Verify:** Click agent → soft pulsing ring + smooth follow; chat framing eases; orbit drag doesn’t flicker selection.

---

### Task 5: Integration QA (Orchestrator)

- [ ] **Step 1:** Ensure no merge conflicts across tracks (especially `constants.ts`, `Stage.ts`, `art-direction.md`)
- [ ] **Step 2:** Run typecheck / existing tests if present (`npm test` / `npm run build` — use package.json scripts)
- [ ] **Step 3:** Manual checklist: accessories distinct, motion calm, office warmer, selection pulse
- [ ] **Step 4:** Fix any cross-track breakage

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| Track A accessories 3–5 | Task 1 |
| Track B desk/locomotion | Task 2 |
| Track C materials/lighting | Task 3 |
| Track D ring/camera | Task 4 |
| Wave merge QA | Task 5 |
