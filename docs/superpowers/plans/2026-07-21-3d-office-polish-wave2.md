# Wave 2 — 3D Office Polish Deepen

> Execute via subagent-driven-development. Do NOT commit unless orchestrator asks.

**Goal:** Deepen Wave 1 thin slice across all four tracks per updated spec Wave 2 section in `docs/superpowers/specs/2026-07-21-3d-office-polish-design.md`.

## File ownership

| Track | Owns |
|-------|------|
| A | `generate_character.py`, `CharacterManager.ts` accessory bits, `agents.ts` only if adding optional `accessory?`, art-direction character section, `character.glb` |
| B | `NpcAgentDriver.ts`, `CharacterController.ts` (pace variance / separation only), motion keys in `constants.ts` |
| C | `WorldManager.ts`, Stage lights only if needed for colored emissive, art-direction office |
| D | `SelectionRing.ts` (extend for hover/pop/player), `SceneManager.ts` ring/hover wiring, interaction constants, InputManager if needed |

---

### Task W2-A: Backpack + scarf

- Add `_make_backpack` (type 6) and `_make_scarf` (type 7) in generate_character.py — vinyl, skinned (backpack→spine, scarf→head or neck/spine)
- Allow-list + export; regen character only: `blender -b --python scripts/blender/generate_character.py`
- CharacterManager: SPECIALIST_ACCESSORIES = [1,3,4,5,6,7]; TSL visibility/tint for 6–7
- Optional `accessory?: number` on AgentNode — if present, use it (still force lead=2, user=0)
- Bump cache `?v=252`
- Update art-direction

### Task W2-B: Motion deepen

- Confirm `AGENT_SEPARATION_WANDER_CLEARANCE = 1.65` (already fixed); strengthen `_nudgeWanderTargetClear` iterations if weak
- Deterministic per-agent cruise multiplier ±8% from index applied in CharacterController when moving
- Slightly higher separation while GOTO if easy
- Do not break lead-never-sits / chat / busy desk-only

### Task W2-C: Office deepen

- Distinguish lounge `static-chair` (not containing `work-chair`) with warmer softer material vs work chairs
- Gentle global screen emissive pulse (sin time) in WorldManager update or Stage — prefer WorldManager if it has update hook; else SceneManager tick calling WorldManager.pulseScreens(t)
- Slight emissive on `colored-*` theme materials so hub accent reads
- Update art-direction

### Task W2-D: Interaction deepen

- Hover ring: dim, non-pulsing, on hovered unselected NPC (SceneManager already has hover callbacks)
- Select pop: brief opacity/scale kick then settle into pulse
- Cache agent color for selected ring
- Optional subtle non-pulsing ring when following player (user)
- Keep InputManager drag guard

### Verify each
`npm run lint` minimum; self-review against Wave 2 spec bullets.
