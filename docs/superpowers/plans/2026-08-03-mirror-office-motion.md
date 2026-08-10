# Mirror Office Motion — Implementation Plan (iteration)

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-07-31-mirror-office-motion-design.md` + Mock Swarm QA notes (2026-08-03).

**Goal:** Agents walk to real desks/couches/whiteboard; work anims only at computers; no sit-on-air; screens face chairs; idle dull / working saturated; bubble says only “Working” when working.

**Architecture:** Update `mapPresenceBehavior` + `SceneManager` placement (desk / lounge / board / stage); remove floating couch POIs and snap-to-air; regenerate office.glb screen facing; stronger dim/sat; mirror bubbles.

**Tech Stack:** TypeScript, Three.js WebGPU, Blender office gen, Vitest

## Global Constraints

- No mid-session teleports to furniture (walk or wait)
- Only GLB `sit_idle-*` and `sit_work-*` for sitting
- Working bubble copy is exactly `Working` (no agent name as primary)

---

### Task 1: Behavior + bubbles
- [ ] Redefine placements: working→desk (specialists), thinking→board or stage, idle→real lounge
- [ ] Bubble: working→`Working`; else empty (hide)
- [ ] Stronger dull/saturated colors

### Task 2: Scene placement
- [ ] Remove floating couch POIs; walk-only to real seats/desks
- [ ] Whiteboard look POI; desk sit_work for working
- [ ] Kill snap-sit-on-air fallback

### Task 3: Office art
- [ ] Flip PC screens toward chairs; regen `office.glb` if Blender available (else runtime flip)

### Task 4: Verify
- [ ] Tests + Mock Swarm browser check
