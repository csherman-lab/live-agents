# Mirror Motion Glitch Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop clumping / ghost trails / wrong seats so Mock Swarm shows Cursor on stage, working specialists seated at desks, thinkers at the board, idle agents on couches — walking, not teleporting or stacking.

**Architecture:** Keep hybrid placement in `mapPresenceBehavior`. Fix locomotion ownership in `SceneManager`: (1) silence legacy task watchers in mirror mode, (2) exclusive stable seat claims, (3) pending placement retry until walk actually starts. Extract seat-pick helpers for unit tests.

**Tech Stack:** TypeScript, Vitest, existing CharacterController / PoiManager

## Global Constraints

- No mid-session teleports to furniture (walk or wait / retry)
- Only GLB `sit_idle-\d+` and `sit_work-*` for sitting
- Lead (Cursor) always `placement: stage`
- Working bubble primary is exactly `Working`
- Do not commit unless the user asks (repo user rule)

---

### Task 1: Silence legacy task locomotion in mirror mode

**Files:**
- Modify: `src/simulation/SceneManager.ts` (`startWatchingCoreStore`)
- Test: `src/simulation/SceneManager.mirrorGate.test.ts` (or extend an existing SceneManager/presence test if lighter)

**Root cause:** `useCoreStore` task status changes still call `setNpcWorking` / `moveNpcToBoardroom` / `moveNpcToSpawn`. Leftover Advanced tasks fight presence and yank Cursor onto desks.

- [x] **Step 1: Write a focused regression note as a unit-testable pure gate**

Add helper (same file or tiny util):

```ts
export function shouldIgnoreCoreTaskLocomotion(mirrorMode: boolean): boolean {
  return mirrorMode;
}
```

Test:

```ts
import { describe, expect, it } from 'vitest';
import { shouldIgnoreCoreTaskLocomotion } from '../simulation/SceneManager';
// or from a small util if exporting from SceneManager is awkward

describe('shouldIgnoreCoreTaskLocomotion', () => {
  it('ignores when mirrorMode', () => {
    expect(shouldIgnoreCoreTaskLocomotion(true)).toBe(true);
  });
  it('allows when advanced', () => {
    expect(shouldIgnoreCoreTaskLocomotion(false)).toBe(false);
  });
});
```

Prefer putting the helper in `src/integration/presence/mirrorLocomotion.ts` so SceneManager stays free of awkward exports.

- [ ] **Step 2: Gate the core-store subscriber**

In `startWatchingCoreStore`, at the top of the forEach body (or before locomotion calls):

```ts
if (usePresenceStore.getState().mirrorMode) return;
```

Also guard `setNpcWorking` itself:

```ts
public setNpcWorking(index: number, working: boolean): void {
  if (usePresenceStore.getState().mirrorMode) return;
  ...
}
```

Same early-return for `moveNpcToBoardroom` / `moveNpcToSpawn` if they can fire from non-mirror paths during mirror.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run src/integration/presence/`
Expected: PASS

---

### Task 2: Exclusive stable seat / desk assignment

**Files:**
- Create: `src/integration/presence/assignMirrorSeat.ts`
- Create: `src/integration/presence/assignMirrorSeat.test.ts`
- Modify: `src/simulation/SceneManager.ts` (`sendNpcToLounge`, `sendNpcToDesk`)

**Root cause:** Pick uses `(index-1) % free.length`, and when free is empty falls back to **occupied** seats → `walkToPoi` returns false (occupancy mutex) → agents stay stacked at spawn.

- [ ] **Step 1: Failing tests for assigner**

```ts
import { describe, expect, it } from 'vitest';
import { assignMirrorSeat } from './assignMirrorSeat';

type Seat = { id: string; occupiedBy: number | null };

describe('assignMirrorSeat', () => {
  it('keeps held seat', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: 2 },
      { id: 'sit_work-2', occupiedBy: null },
    ];
    expect(assignMirrorSeat(seats, 2).id).toBe('sit_work-1');
  });

  it('never returns a seat occupied by someone else', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: 1 },
      { id: 'sit_work-2', occupiedBy: 3 },
    ];
    expect(assignMirrorSeat(seats, 2)).toBeNull();
  });

  it('stable free pick by preferredSlot', () => {
    const seats: Seat[] = [
      { id: 'sit_work-1', occupiedBy: null },
      { id: 'sit_work-2', occupiedBy: null },
      { id: 'sit_work-3', occupiedBy: null },
    ];
    expect(assignMirrorSeat(seats, 2, 0).id).toBe('sit_work-1');
    expect(assignMirrorSeat(seats, 3, 1).id).toBe('sit_work-2');
  });
});
```

- [ ] **Step 2: Implement**

```ts
export interface MirrorSeatLike {
  id: string;
  occupiedBy: number | null;
}

export function assignMirrorSeat(
  seats: MirrorSeatLike[],
  agentIndex: number,
  preferredSlot = Math.max(0, agentIndex - 1),
): MirrorSeatLike | null {
  const held = seats.find((s) => s.occupiedBy === agentIndex);
  if (held) return held;
  const free = seats
    .filter((s) => s.occupiedBy === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (free.length === 0) return null;
  return free[preferredSlot % free.length];
}
```

- [ ] **Step 3: Wire SceneManager**

`sendNpcToLounge` / `sendNpcToDesk`: use `assignMirrorSeat`; if null, do **not** mark placement complete (see Task 3); do not call `walkToPoi` on occupied seats.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run src/integration/presence/assignMirrorSeat.test.ts`
Expected: PASS

---

### Task 3: Pending placement + retry (fix silent no-walk)

**Files:**
- Modify: `src/simulation/SceneManager.ts` (`applyMirrorPresence`, tick loop)
- Modify: `src/integration/presence/mirrorLocomotion.ts` (optional helpers)

**Root cause:** `mirrorPlacement.set(...)` runs **before** `walkToPoi`/`moveTo`. If `isGrounded` fails or walk returns false, placement looks “done” and never retries → permanent clump.

- [ ] **Step 1: Change commit semantics**

Store desired intent separately from satisfied placement:

```ts
private mirrorDesired = new Map<number, PresenceBehavior>();
private mirrorSatisfied = new Map<number, string>(); // placementKey when locomotion started or arrived
```

On `applyMirrorPresence`:
1. Always apply dim + speaking + store `mirrorDesired`
2. If pathing / stand / sit_down for same key → return
3. Attempt send*; only set `mirrorSatisfied` when walk/move returns true OR already in correct pose at target
4. If attempt fails → leave unsatisfied

- [ ] **Step 2: Remove soft `isGrounded` gate on send***

Keep invalid-position recover-to-spawn. After recover, allow walk. Do not skip walks merely because position is near origin if finite/in-bounds (spawn is valid).

- [ ] **Step 3: Retry on frame/tick**

In the existing update path (where social director is skipped in mirror), every ~0.5s:

```ts
for (const [index, behavior] of this.mirrorDesired) {
  const key = `${behavior.placement}:${behavior.characterState}`;
  if (this.mirrorSatisfied.get(index) === key) continue;
  if (pathing) continue;
  this.tryMirrorPlacement(index, behavior); // extract from applyMirrorPresence body
}
```

- [ ] **Step 4: Stage slots for lead clarity**

`sendNpcToStage`: lead (`index === 1` or behavior known lead) uses `area-stage` center. If non-lead ever uses stage, offset by slot — but lead stays center. Prefer checking placement only (lead always stage from mapper).

- [ ] **Step 5: Run presence tests**

Run: `npm test -- --run src/integration/presence/`
Expected: PASS

---

### Task 4: Board offsets + leave-seat without re-fight

**Files:**
- Modify: `src/simulation/SceneManager.ts` (`sendNpcToBoard`)

- [ ] **Step 1: Unique board slots**

Use agent index for stable offsets so two thinkers don’t stack:

```ts
const slot = Math.max(0, index - 1);
target.x += (slot % 3) * 0.55 - 0.55;
target.z += Math.floor(slot / 3) * 0.4;
```

- [ ] **Step 2: Rely on CharacterController stand-before-sit**

Already in `walkToSitPoi`. Ensure desk/lounge changes call `walkToPoi` (not raw play) so stand fires. When placement key changes, clear `mirrorSatisfied` and release old POI via controller path (walkToPoi already `releaseAll`).

---

### Task 5: Visual verification

**Files:** none (browser / Playwright)

- [ ] **Step 1: Mock Swarm headed Chrome screenshots at ~12s and ~22s**
- [ ] **Step 2: Checklist**
  - Cursor on/near stage center (not at a PC desk)
  - Working specialists at distinct desks, seated or walking there
  - Idle on lounge `sit_idle-*` couches
  - Thinking near whiteboard with spaced slots
  - No multi-nameplate stack at one point
  - Bubbles: `Working` only when working

---

## Spec coverage

| Spec / QA issue | Task |
|-----------------|------|
| Cursor always stage | 1, 3 |
| Specialists desks / lounge / board | 2, 4 |
| No clump / failed walks | 2, 3 |
| No mid-session teleport | 3 (retry, no snap) |
| Ghost trails from competing movers | 1, 3 |

## Self-review

- No placeholders
- Seat assigner tested before SceneManager wire-up
- Commits deferred per user rule
