# Company Demo Armor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Live Agents company-showable ASAP by armoring live reliability, self-serve setup, 10-second story, and big-screen Mock Swarm — without Blender regen or new platforms.

**Architecture:** Keep the existing hooks → Vite presence hub → SSE → `presenceStore` → MirrorPresenceDirector pipeline. Extract pure HUD/status helpers so honesty rules are unit-tested. Fix Mock Swarm vs live coexistence in `PresenceClient.dispatch`. Tighten README + lobby copy for a 3-step self-serve path. Runtime polish is regression-only.

**Tech Stack:** TypeScript, React 19, Zustand, Vitest, Vite presence hub, Cursor hooks (`tools/cursor-bridge`)

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-company-demo-armor-design.md`
- ASAP Demo Armor only — no Blender/`perfection-goal.md` mesh work
- No ChatGPT/Claude emitters, no embed-in-Cursor, no transcript panel
- Advanced/BYOK stays demoted (Settings only), not deleted
- `connected` means SSE open only — never set by Mock Swarm
- Never show “Cursor live” / “Cursor connected” unless `connected === true`
- Do not commit unless the user explicitly asks (repo user rule)
- Every task ends green: `npm test -- --run <touched tests>` then relevant smoke

## File map

| File | Responsibility |
|------|----------------|
| `src/integration/presence/mirrorHudStatus.ts` | Pure hub/demo status label + copy (testable) |
| `src/integration/presence/mirrorHudStatus.test.ts` | Honesty contract tests |
| `src/integration/presence/PresenceClient.ts` | Block **all** SSE ingest while Mock Swarm owns roster |
| `src/integration/presence/presenceLiveGate.ts` | Pure `shouldApplyHubPresenceEvent(demoActive)` |
| `src/integration/presence/presenceLiveGate.test.ts` | Gate tests |
| `src/interface/components/SwarmHud.tsx` | Consume `mirrorHudStatus` |
| `src/interface/OverviewPanel.tsx` | Consume status helper; self-serve copy |
| `src/interface/SimulationPhaseBanner.tsx` | Honest mirror banner via helper |
| `src/interface/CompanionTip.tsx` | 10-second story copy (if gaps) |
| `README.md` | 3-step self-serve; hosted demo = Mock Swarm only |
| `tools/cursor-bridge/README.md` | Align live install escape hatch |
| Existing presence / motion tests | Lock session clear + Mock Swarm regressions |

---

### Task 1: Honest hub / demo status helper

**Files:**
- Create: `src/integration/presence/mirrorHudStatus.ts`
- Create: `src/integration/presence/mirrorHudStatus.test.ts`
- Modify: `src/interface/components/SwarmHud.tsx`
- Modify: `src/interface/OverviewPanel.tsx`
- Modify: `src/interface/SimulationPhaseBanner.tsx`

**Interfaces:**
- Consumes: `demoSwarmActive`, `connected`, `hubOnline`, `hubHealth` from store
- Produces:

```ts
export type MirrorHudPhase =
  | 'demo'
  | 'cursor_live'
  | 'hub_ready'
  | 'connecting'
  | 'hub_offline';

export interface MirrorHudStatusInput {
  demoSwarmActive: boolean;
  connected: boolean;
  hubOnline: boolean;
  hubHealth: { ok: boolean } | null;
}

export interface MirrorHudStatus {
  phase: MirrorHudPhase;
  /** Short chip label (HUD / lobby) */
  label: string;
  /** Longer actionable title / subtitle */
  detail: string;
  /** Empty-office CTA body */
  emptyHint: string;
}

export function resolveMirrorHudStatus(input: MirrorHudStatusInput): MirrorHudStatus;
```

- [ ] **Step 1: Write the failing tests**

Create `src/integration/presence/mirrorHudStatus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMirrorHudStatus } from './mirrorHudStatus';

describe('resolveMirrorHudStatus', () => {
  it('demo wins over connected', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: true,
      connected: true,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('demo');
    expect(s.label.toLowerCase()).toMatch(/demo/);
    expect(s.label.toLowerCase()).not.toMatch(/cursor live|cursor connected/);
  });

  it('never says Cursor live without SSE', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('hub_ready');
    expect(s.label.toLowerCase()).not.toMatch(/cursor live|cursor connected/);
    expect(s.detail.toLowerCase()).toMatch(/mock swarm|cursor/);
  });

  it('hub offline tells user to run npm run dev', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: false,
      hubHealth: { ok: false },
    });
    expect(s.phase).toBe('hub_offline');
    expect(s.detail.toLowerCase()).toMatch(/npm run dev/);
    expect(s.emptyHint.toLowerCase()).toMatch(/npm run dev/);
  });

  it('connecting while health unknown', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: false,
      hubHealth: null,
    });
    expect(s.phase).toBe('connecting');
  });

  it('SSE open is cursor_live', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: true,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('cursor_live');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/integration/presence/mirrorHudStatus.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement helper**

Create `src/integration/presence/mirrorHudStatus.ts`:

```ts
export type MirrorHudPhase =
  | 'demo'
  | 'cursor_live'
  | 'hub_ready'
  | 'connecting'
  | 'hub_offline';

export interface MirrorHudStatusInput {
  demoSwarmActive: boolean;
  connected: boolean;
  hubOnline: boolean;
  hubHealth: { ok: boolean } | null;
}

export interface MirrorHudStatus {
  phase: MirrorHudPhase;
  label: string;
  detail: string;
  emptyHint: string;
}

export function resolveMirrorHudStatus(input: MirrorHudStatusInput): MirrorHudStatus {
  const hubUp = input.hubOnline || input.connected;
  const hubPending = !hubUp && !input.hubHealth;

  if (input.demoSwarmActive) {
    return {
      phase: 'demo',
      label: 'Demo swarm',
      detail: 'Mock swarm is driving the office',
      emptyHint: 'Mock Swarm is active.',
    };
  }
  if (input.connected) {
    return {
      phase: 'cursor_live',
      label: 'Cursor live',
      detail: 'SSE connected — receiving Cursor presence',
      emptyHint: 'Run an agent/swarm in Cursor (hooks enabled), or try Mock Swarm.',
    };
  }
  if (hubUp) {
    return {
      phase: 'hub_ready',
      label: 'Hub ready',
      detail: 'Hub is up. Start an agent in Cursor or use Mock Swarm.',
      emptyHint: 'Run an agent/swarm in Cursor (hooks enabled), or try Mock Swarm.',
    };
  }
  if (hubPending) {
    return {
      phase: 'connecting',
      label: 'Connecting…',
      detail: 'Checking the local presence hub…',
      emptyHint: 'Connecting to the presence hub…',
    };
  }
  return {
    phase: 'hub_offline',
    label: 'Hub offline',
    detail: 'Start the app with npm run dev so Cursor hooks can reach the hub.',
    emptyHint: 'Hub offline — keep npm run dev running, then retry.',
  };
}
```

- [ ] **Step 4: Wire UI consumers**

In `SwarmHud.tsx`, replace inline `statusLabel` / `statusTitle` / empty-hint branches with:

```ts
const status = resolveMirrorHudStatus({
  demoSwarmActive,
  connected,
  hubOnline,
  hubHealth: hubHealth ? { ok: hubHealth.ok } : null,
});
// use status.label, status.detail, status.emptyHint
// keep existing dotClass keyed off status.phase
```

In `OverviewPanel.tsx`, same helper for lobby chip (`label` may use a lobby-friendly variant — either pass the same labels or map `hub_ready` → `Hub ready — waiting for Cursor` in the panel only; do not invent a second truth table).

In `SimulationPhaseBanner.tsx` mirror branch:

```ts
const status = resolveMirrorHudStatus({ ... });
const label =
  status.phase === 'demo'
    ? 'Demo swarm — named workers preview the office'
    : status.phase === 'cursor_live'
      ? agentCount > 0
        ? `${agentCount} Cursor agent${agentCount === 1 ? '' : 's'} in the office`
        : 'Connected — waiting for Cursor agents'
      : 'Watch your swarm — Mock Swarm or run an agent in Cursor';
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/integration/presence/mirrorHudStatus.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add src/integration/presence/mirrorHudStatus.ts src/integration/presence/mirrorHudStatus.test.ts \
  src/interface/components/SwarmHud.tsx src/interface/OverviewPanel.tsx src/interface/SimulationPhaseBanner.tsx
git commit -m "Lock honest mirror HUD status for demo vs live."
```

---

### Task 2: Mock Swarm owns roster — block all hub SSE

**Files:**
- Create: `src/integration/presence/presenceLiveGate.ts`
- Create: `src/integration/presence/presenceLiveGate.test.ts`
- Modify: `src/integration/presence/PresenceClient.ts` (`dispatch`)

**Why:** Current gate allows `agentId.startsWith('cursor-')` through during demo. Mock Swarm uses `cursor-lead` / `cursor-*` ids, so the prefix check is the wrong rule. Spec: Mock Swarm and live must not stomp incorrectly.

**Interfaces:**
- Produces:

```ts
/** Hub/SSE events apply only when Mock Swarm is not owning the roster. */
export function shouldApplyHubPresenceEvent(demoSwarmActive: boolean): boolean {
  return !demoSwarmActive;
}
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { shouldApplyHubPresenceEvent } from './presenceLiveGate';

describe('shouldApplyHubPresenceEvent', () => {
  it('blocks all hub events while demo swarm is active', () => {
    expect(shouldApplyHubPresenceEvent(true)).toBe(false);
  });
  it('allows hub events when demo is off', () => {
    expect(shouldApplyHubPresenceEvent(false)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- --run src/integration/presence/presenceLiveGate.test.ts`

- [ ] **Step 3: Implement gate + wire dispatch**

Create `presenceLiveGate.ts` with the function above.

In `PresenceClient.dispatch`:

```ts
private dispatch(event: AgentPresenceEvent) {
  if (!shouldApplyHubPresenceEvent(usePresenceStore.getState().demoSwarmActive)) {
    return;
  }
  usePresenceStore.getState().applyEvent(event);
  for (const listener of this.listeners) listener(event);
}
```

Keep `inject()` applying locally always (Mock Swarm path). Keep `hydrateFromHub()` early-return when `demoSwarmActive`.

- [ ] **Step 4: Add store regression — empty remove clears demo**

Extend `src/integration/presence/presenceStore.test.ts`:

```ts
it('remove of last agent clears demoSwarmActive', () => {
  usePresenceStore.getState().setDemoSwarmActive(true);
  usePresenceStore.getState().applyEvent(
    createPresenceEvent({ agentId: 'cursor-lead', name: 'Cursor', state: 'working' }),
  );
  usePresenceStore.getState().applyEvent(
    createPresenceEvent({
      agentId: 'cursor-lead',
      name: 'Cursor',
      state: 'done',
      op: 'remove',
    }),
  );
  expect(listPresenceAgents()).toHaveLength(0);
  expect(usePresenceStore.getState().demoSwarmActive).toBe(false);
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/integration/presence/`  
Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add src/integration/presence/presenceLiveGate.ts src/integration/presence/presenceLiveGate.test.ts \
  src/integration/presence/PresenceClient.ts src/integration/presence/presenceStore.test.ts
git commit -m "Block hub presence while Mock Swarm owns the roster."
```

---

### Task 3: Session clear + hook stop contract (live reliability)

**Files:**
- Test: `src/integration/presence/mapHook.test.ts` (already covers stop/sessionEnd)
- Modify only if gaps: `tools/cursor-bridge/mapHook.mjs`
- Test: `src/integration/presence/presenceStore.test.ts`

**Must pass (spec):** stop/sessionEnd clears tree; no zombies.

- [ ] **Step 1: Add tree-clear integration-style store test**

```ts
it('lead remove via applyEvent clears children (session end)', () => {
  usePresenceStore.getState().applyEvent(
    createPresenceEvent({ agentId: 'c1', name: 'Cursor', state: 'thinking', ts: 1 }),
  );
  usePresenceStore.getState().applyEvent(
    createPresenceEvent({
      agentId: 's1',
      name: 'Explore',
      state: 'working',
      parentId: 'c1',
      ts: 2,
    }),
  );
  usePresenceStore.getState().applyEvent(
    createPresenceEvent({
      agentId: 'c1',
      name: 'Cursor',
      state: 'done',
      op: 'remove',
      ts: 3,
    }),
  );
  expect(listPresenceAgents()).toHaveLength(0);
});
```

- [ ] **Step 2: Confirm mapHook stop/sessionEnd still assert `op: 'remove'`**

Run: `npm test -- --run src/integration/presence/mapHook.test.ts src/integration/presence/presenceStore.test.ts`  
Expected: PASS. If stop does not remove lead tree, fix `tools/cursor-bridge/mapHook.mjs` `stop` / `sessionEnd` cases only.

- [ ] **Step 3: Smoke hub ingest**

Run: `npm run bridge:smoke`  
Expected: exit 0 (POST → hub healthy)

- [ ] **Step 4: Manual live script (document results in PR/notes, not code)**

With `npm run dev` + project hooks:
1. Start a Cursor agent in this repo → lead appears, HUD → Cursor live  
2. Spawn a subagent → second worker  
3. Stop / end session → office empty, no zombies; `window.__laPresenceHub()` agentCount 0  

If zombies remain, debug hub `remove` subtree in `vite-plugins/presenceHub.ts` and client `applyEvent` — do not add teleports.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add src/integration/presence/presenceStore.test.ts tools/cursor-bridge/mapHook.mjs
git commit -m "Harden session-end clear so live mirror leaves no zombies."
```

---

### Task 4: Self-serve setup path (README + lobby)

**Files:**
- Modify: `README.md`
- Modify: `tools/cursor-bridge/README.md`
- Modify: `src/interface/OverviewPanel.tsx` (footer copy)

**Done-when:** Fresh clone reaches Mock Swarm in ≤5 minutes from README only; live is clearly optional via `bridge:install`.

- [ ] **Step 1: Rewrite Getting Started to a strict 3-step path**

Replace the Getting Started section in `README.md` so it reads as:

1. Header: `## Getting Started (≤5 minutes)`
2. Commands: `npm install` then `npm run dev`
3. Open `http://localhost:3000` in Chrome or Safari (WebGPU)
4. Numbered steps:
   - **Enter Office** (or dismiss the tip)
   - Click **Mock Swarm** — four named workers (no Cursor required)
   - Optional live: keep the app running; use this repo’s project hooks or `npm run bridge:install` for any workspace
5. Explicit note: hosted github.io demo is **Mock Swarm only** (no local hub / Cursor hooks on static hosting)
6. Cursor hooks subsection: project `.cursor/hooks.json` → `http://127.0.0.1:3000/api/presence`; any workspace `npm run bridge:install`; escape hatch `LIVE_AGENTS_PRESENCE_URL=http://127.0.0.1:3000/api/presence`; verify with `npm run bridge:smoke` and `window.__laPresenceHub()`; link `tools/cursor-bridge/README.md`

Keep Features / Advanced / scripts sections; demote Advanced further if it still reads primary.

- [ ] **Step 2: Align bridge README quick start**

Ensure `tools/cursor-bridge/README.md` opens with the same order: Terminal A `npm run dev` → Mock Swarm → optional `bridge:install` → `LIVE_AGENTS_PRESENCE_URL`.

- [ ] **Step 3: Lobby footer copy**

In `OverviewPanel.tsx`, keep Enter Office + Mock Swarm primary. Footer should say:

```tsx
<p className="text-center text-[11px] pt-1" style={{ color: APPLE_TEXT_SECONDARY }}>
  Live from any workspace:{' '}
  <code className="font-mono text-[10px]">npm run bridge:install</code>
  {' '}· keep <code className="font-mono text-[10px]">npm run dev</code> running
</p>
```

When `status.phase === 'hub_offline'`, the status card detail must already include `npm run dev` (Task 1).

- [ ] **Step 4: Self-review README as a stranger**

Read only `README.md` top → Getting Started. Confirm no required hop into `docs/superpowers/`.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add README.md tools/cursor-bridge/README.md src/interface/OverviewPanel.tsx
git commit -m "Clarify self-serve and live hook setup for company demos."
```

---

### Task 5: Ten-second story (cold open)

**Files:**
- Verify / light modify: `src/interface/CompanionTip.tsx`
- Verify: `src/interface/Header.tsx` (Advanced icon only when `!mirrorMode` — already)
- Verify: `src/App.tsx` (CompanionTip, not full onboard on cold open)

**Must pass:** Cold open ≤2s readable; no Advanced in first viewport; tip says Cursor agents as named workers.

- [ ] **Step 1: Audit cold open (manual + code)**

Checklist:
- [ ] `App.tsx` uses `CompanionTip` on cold open (full `OnboardingOverlay` only from Settings replay)
- [ ] Header: no Advanced Users icon when `mirrorMode`
- [ ] CompanionTip copy mentions named workers + Mock Swarm / Enter Office
- [ ] No “API key” / “Command Center” / token chrome in mirror lobby

If CompanionTip copy is weak, set to:

```tsx
<p className="text-[13px] font-semibold">Watch your Cursor swarm</p>
<p className="mt-0.5 text-[11px] leading-relaxed text-white/70">
  Cursor agents appear as named vinyl workers in the office. No API key —
  Enter Office, or try Mock Swarm for an instant demo.
</p>
```

- [ ] **Step 2: Phase banner honesty**

Confirm Task 1 wiring: Demo swarm vs Cursor live never swapped.

- [ ] **Step 3: Browser cold open**

Run: `npm run dev` → hard refresh → screenshot first viewport.  
Expected: lobby hero + tip strip; no Advanced icon; no full-screen onboard.

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add src/interface/CompanionTip.tsx src/App.tsx src/interface/Header.tsx
git commit -m "Keep cold open story on companion tip and Mock Swarm."
```

---

### Task 6: Big-screen Mock Swarm polish (regression only)

**Files:**
- Test: `src/integration/presence/MirrorPresenceDirector.test.ts`
- Test: `src/integration/presence/mirrorLocomotion.test.ts`
- Test: `src/integration/presence/mapPresenceBehavior.test.ts`
- Fix only if failing: director / SceneManager / spawn pulse (see `2026-08-04-mirror-office-polish-design.md`)

**Must pass:** One click → ≥4 named workers; readable busy/idle; no skate / stuck miniature / ghost chrome.

- [ ] **Step 1: Run existing mirror motion tests**

Run: `npm test -- --run src/integration/presence/`  
Expected: PASS. Fix any failures before new features.

- [ ] **Step 2: Manual Mock Swarm projector glance**

1. Enter Office → Mock Swarm  
2. Confirm HUD: Demo swarm, count ≥ 4  
3. Cursor/lead on stage; specialists at desk/board/lounge over ~12s rotation  
4. Nameplates readable; no Advanced chrome  
5. After spawn pulse, character scale uniform (no stuck miniatures)

If stuck scale / teleport regressions: fix per prior polish plan (hard scale reset; no mid-session teleports). Do not start Blender regen.

- [ ] **Step 3: Full check**

Run: `npm run check`  
Expected: lint + test + build green

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add -u
git commit -m "Fix Mock Swarm demo regressions for big-screen polish."
```

---

### Task 7: Company-ready verification gate

**Files:** none required (evidence only). Optional: add a short checklist to the spec Progress section — prefer leaving evidence in the PR description.

- [ ] **Step 1: Run automated gates**

```bash
npm run check
npm run bridge:smoke
```

Expected: both exit 0

- [ ] **Step 2: Walk the three share paths**

| Path | Actions | Pass |
|------|---------|------|
| Mock Swarm | Cold open → Enter Office → Mock Swarm | ≥4 workers, Demo swarm HUD, no Advanced/API-key chrome |
| Live | hooks + agent start/stop | Appear → clear; HUD Hub ready → Cursor live → waiting; no zombies |
| Self-serve | Follow README only | Mock Swarm in ≤5 min; live docs mention `bridge:install` |

- [ ] **Step 3: Failure drills**

1. Stop `npm run dev` mid-session → HUD Hub offline + `npm run dev` copy  
2. Hosted github.io (if checking): Mock Swarm works; do not claim Cursor live without hub  

- [ ] **Step 4: Mark armor done**

Update spec status line to `IMPLEMENTED` only after all rows pass (user-approved). Do not claim done on code alone.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Live reliability / HUD honesty | 1, 2, 3 |
| Session clear / no zombies | 3 |
| Mock vs live coexistence | 2 |
| Self-serve 3-step + bridge:install | 4 |
| Hosted = Mock Swarm only | 4 |
| Ten-second story / no Advanced chrome | 5 |
| Big-screen Mock Swarm polish | 6 |
| Success criteria + manual QA | 7 |
| Out of scope Blender / providers | Global Constraints |

No TBD placeholders. Helper names consistent: `resolveMirrorHudStatus`, `shouldApplyHubPresenceEvent`.
