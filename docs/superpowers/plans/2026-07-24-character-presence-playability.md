# Character Presence & Playability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Waves 1–4 so agents walk accurately, converse with correct talk/listen facing, feel playable, and the office feels socially alive.

**Architecture:** Pure Presence modules under `src/simulation/presence/`, wired through `CharacterController` / `SceneManager` / `InputManager`. Playback rate uses AgentStateBuffer anim `.w`. No GPU pipeline rewrite.

**Tech Stack:** TypeScript, Three.js WebGPU/TSL, Vitest, existing CharacterController + state machine.

## Global Constraints

- Keep vinyl GPU instancing + existing `AnimationName` / POI / mesh contracts
- Max 1 ambient ConversationSession; never steal busy / player-chat agents
- Floor clicks ignored while `isChatting`
- `npm run check` must pass

## File map

| File | Role |
|------|------|
| `src/simulation/presence/LocomotionPresence.ts` | Gait gate + walk playback rate math |
| `src/simulation/presence/ConversationSession.ts` | 2-party talk/listen session |
| `src/simulation/presence/SocialDirector.ts` | Ambient pairs + notice-player |
| `src/simulation/presence/InteractionPresence.ts` | Double-click + hover reaction timing |
| `src/simulation/presence/*.test.ts` | Unit tests |
| `src/simulation/behavior/AgentStateBuffer.ts` | Anim playback rate in `.w` |
| `src/simulation/entities/CharacterManager.ts` | Shader uses rate; `setAnimationRate` |
| `src/simulation/CharacterController.ts` | Gait gate + rate while walking |
| `src/simulation/constants.ts` | Presence tuning constants |
| `src/simulation/SceneManager.ts` | Wire sessions, social, chat visuals |
| `src/simulation/input/InputManager.ts` | Double-click chat; block floor in chat |
| `src/integration/hooks/useKeyboardShortcuts.ts` | `E` wave emote |
| `src/interface/ShortcutsModal.tsx` | Document `E` / double-click |

---

### Task 1: LocomotionPresence (Wave 1 core)

**Files:**
- Create: `src/simulation/presence/LocomotionPresence.ts`
- Create: `src/simulation/presence/LocomotionPresence.test.ts`
- Modify: `src/simulation/constants.ts` (add gait/stride constants)

**Interfaces:**
- Produces: `computeWalkPlaybackRate(cruiseSpeed, strideLength, walkDuration): number`
- Produces: `GaitGate` class with `onPathStart()`, `onPathEnd()`, `update(dt, isPathing): 'walk' | 'idle' | null` (null = no change)

- [ ] **Step 1:** Write failing tests for playback rate (higher cruise → higher rate; zero duration → 1) and gait gate (path start does not instantly walk until commit distance/time; path end settles before idle).
- [ ] **Step 2:** Implement `LocomotionPresence.ts` + constants; tests pass.

---

### Task 2: Wire walk playback rate + gait into controller (Wave 1)

**Files:**
- Modify: `AgentStateBuffer.ts`, `CharacterManager.ts` (vertex shader + API), `CharacterController.ts`

**Interfaces:**
- Consumes: Task 1 helpers
- Produces: `setAnimationRate(index, rate)`, default rate `1` on `setAnimation`

- [ ] **Step 1:** Store rate in anim buffer `.w`; shader `animTime *= rate`.
- [ ] **Step 2:** On walk, set rate from `computeWalkPlaybackRate`; on leave walk, rate=1. GaitGate decides when `play('walk')` / `play('idle')` around pathing.

---

### Task 3: ConversationSession (Wave 2)

**Files:**
- Create: `src/simulation/presence/ConversationSession.ts`
- Create: `src/simulation/presence/ConversationSession.test.ts`

**Interfaces:**
- Produces: `ConversationSession` with `participants`, `begin()`, `setSpeaker(index|null)`, `roleOf(index)`, `facingDirs()`, `end()`, `isActive`

- [ ] **Step 1:** Failing tests: both listen until speaker set; only speaker is talk; facing dirs oppose; end clears.
- [ ] **Step 2:** Implement session.

---

### Task 4: Wire ConversationSession into SceneManager (Wave 2)

**Files:**
- Modify: `SceneManager.ts` (`_startChatVisuals`, chat store sub, `setNpcTalking`)

- [ ] Replace ad-hoc talk/listen branching with session `setSpeaker` from `isThinking`/`isTyping` / agent talking status.
- [ ] On enter: approach + mutual facing via session facing dirs; on exit: `session.end()` + cleanup.

---

### Task 5: InteractionPresence + InputManager (Wave 3)

**Files:**
- Create: `src/simulation/presence/InteractionPresence.ts` + test
- Modify: `InputManager.ts`, `SceneManager.ts` init callbacks
- Modify: `useKeyboardShortcuts.ts`, `ShortcutsModal.tsx`

**Interfaces:**
- Produces: `isDoubleClick(nowMs, lastClickMs, thresholdMs)`, `HoverReactionScheduler`

- [ ] Double-click NPC → `startChat` (select on single click remains).
- [ ] While chatting, ignore floor waypoint clicks.
- [ ] Hover scheduler may request look_around/wave (rate-limited) via SceneManager tick.
- [ ] Key `E` waves at selected NPC when not chatting/typing.

---

### Task 6: SocialDirector (Wave 4)

**Files:**
- Create: `src/simulation/presence/SocialDirector.ts` + test
- Modify: `SceneManager.ts` animate loop
- Modify: `constants.ts`

**Interfaces:**
- Produces: `SocialDirector.update(ctx) => SocialAction[]` (`ambient_start`, `ambient_tick`, `ambient_end`, `notice`)

- [ ] Eligibility: not busy, not seated-working-only steal, not in player session, not pathing.
- [ ] Max 1 ambient; duration 4–8s; notice cooldown per agent.
- [ ] SceneManager applies actions via ConversationSession + `play`/`setSpeaking`.

---

### Task 7: Verification

- [ ] `npm run check`
- [ ] Spec checklist: Waves 1–4 success criteria covered by code/tests
- [ ] Fix any failures

---

## Execution

User requested all waves now — execute inline (executing-plans), feature branch `feat/character-presence-playability`.
