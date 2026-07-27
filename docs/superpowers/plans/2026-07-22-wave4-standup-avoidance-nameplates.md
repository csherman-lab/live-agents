# Wave 4 — Stand-up, Walking Avoidance, Nameplates

> **For agentic workers:** Execute task-by-task. Do NOT commit unless orchestrator asks.

**Goal:** Make sit→walk continuous, reduce crossing-path collisions, and show lightweight in-sim nameplates.

**Architecture:** Reversed bake of Sit clip as Stand (no Blender); anticipatory steering bias in CharacterController; DOM nameplates reusing `npcScreenPositions`.

**Tech Stack:** Existing Three.js WebGPU + React overlay (no R3F).

## Global Constraints

- No R3F, no new Blender clips required
- Do not commit
- Preserve lead-never-sits, chat suspend, busy desk-only
- Keep vinyl/command-center UI language for nameplates (small, low-noise)

## File ownership

| Task | Owns |
|------|------|
| W4-A Stand-up | `types.ts` (AnimationName/CharacterStateKey), `CharacterStateMachine.ts`, `CharacterManager.ts` bake only, `NpcAgentDriver.ts` get-up, optionally `SceneManager.ts` seated→idle exits |
| W4-B Avoidance | `CharacterController.ts` updatePaths/separation, motion constants in `constants.ts` only |
| W4-C Nameplates | New `Nameplate.tsx`, `UIOverlay.tsx`, maybe tiny CSS; do NOT change SceneManager projection unless needed |

---

### Task W4-A: Stand-up transition

1. Add `AnimationName.STAND = 'Stand'` and `'stand'` to `CharacterStateKey`
2. In CharacterManager bake loop: if no Stand clip in GLB, bake Sit clip with reversed `mixer.setTime` into STAND slot (`bakeAnimation(..., { reverse: true })`)
3. `STATE_MAP.stand = { animation: STAND, loop: false, nextState: 'idle', interruptible: false }`
4. NpcAgentDriver get-up: `play(..., 'stand')` instead of `'idle'`; tune POST_STAND_PAUSE to ~clip duration or rely on non-interruptible timer
5. Audit SceneManager chat cleanup: if leaving seated via idle, prefer stand when currently sit_*
6. `npm run lint`

### Task W4-B: Local avoidance while walking

1. Add constants: `AGENT_AVOIDANCE_RADIUS` (~1.0), `AGENT_AVOIDANCE_STRENGTH` (~0.35), optional crossing-dot threshold
2. In `CharacterController.updatePaths`, before `blendWalkFacing`: for pathing agents, scan other movers within avoidance radius; if relative approach / opposing travel, nudge desired direction sideways (reuse cross-product side pick)
3. Keep existing `applySeparation` as safety net
4. Do not change navmesh
5. `npm run lint`

### Task W4-C: In-sim nameplates

1. Create `src/interface/Nameplate.tsx` — small centered label above head using same absolute positioning pattern as AgentHeadBubble
2. Render in UIOverlay for each agent using `npcScreenPositions`; hide for focused agent if focused bubble already shows name; hide during chat for the chatting NPC pair if noisy
3. Style: tiny sans/existing UI fonts, soft panel, agent color accent bar or text — low visual noise
4. `npm run lint`

### Verify (orchestrator)
`npm run check` + spot-check e2e / asset verify
