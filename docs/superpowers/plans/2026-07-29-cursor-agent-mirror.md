# Cursor Agent Mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Live Agents as a Cursor companion that visualizes agents/subagents in the 3D office with names, status, customization, and no API key.

**Architecture:** Cursor hooks POST `AgentPresenceEvent` to Vite middleware; SSE fans out to `PresenceClient` → `presenceStore` → mirror roster → SceneManager; appearance overrides persist locally.

**Tech Stack:** React 19, Zustand, Vite middleware (SSE), Cursor hooks (stdin JSON → curl/fetch), Vitest.

## Global Constraints

- No API key required for mirror Go Live
- One character per agent/subagent
- Medium customize: name, color, accessory only
- Preserve existing BYOK team runner when a key is present
- `MAX_MIRROR_AGENTS = 16`
- Fail-open hooks (never block Cursor)
- Do not break GLB mesh/bone/anim contracts

## File map

| Path | Role |
|------|------|
| `src/integration/presence/presenceTypes.ts` | Schema + parse |
| `src/integration/presence/presenceStore.ts` | Roster Zustand store |
| `src/integration/presence/PresenceClient.ts` | SSE client + inject |
| `src/integration/presence/buildMirrorSystem.ts` | Roster → AgenticSystem |
| `src/integration/presence/mapPresenceBehavior.ts` | State → bubble/AgentState |
| `src/integration/presence/agentAppearanceStore.ts` | Persisted overrides |
| `src/integration/presence/usePresenceSync.ts` | Wire client + roster → team/UI |
| `vite-plugins/presenceHub.ts` | POST + SSE hub |
| `.cursor/hooks.json` + `.cursor/hooks/emit-presence.mjs` | Cursor bridge |
| `src/interface/components/SwarmHud.tsx` | Count + connection + mock |
| `src/interface/components/AgentCustomizePanel.tsx` | Name/color/accessory |
| Modify: `enterWorkspace.ts`, `agents.ts` (MAX), `UIOverlay.tsx`, `App.tsx`, `vite.config.ts`, `Header.tsx`, `NpcAgentDriver.ts` / SceneManager as needed |

---

### Task 1: Presence schema + store

**Files:**
- Create: `src/integration/presence/presenceTypes.ts`
- Create: `src/integration/presence/presenceStore.ts`
- Create: `src/integration/presence/presenceTypes.test.ts`
- Create: `src/integration/presence/presenceStore.test.ts`

- [ ] **Step 1: Write schema + parse tests**

```ts
import { describe, expect, it } from 'vitest';
import { parsePresenceEvent, PRESENCE_STATES } from './presenceTypes';

describe('parsePresenceEvent', () => {
  it('accepts valid upsert', () => {
    const e = parsePresenceEvent({
      type: 'agent.presence', v: 1, ts: 1,
      agentId: 'a1', name: 'Explore', state: 'thinking',
      statusText: 'Searching…', parentId: 'lead', provider: 'cursor',
    });
    expect(e?.agentId).toBe('a1');
    expect(e?.state).toBe('thinking');
  });

  it('rejects bad state', () => {
    expect(parsePresenceEvent({ type: 'agent.presence', v: 1, ts: 1, agentId: 'x', name: 'X', state: 'nope' })).toBeNull();
  });
});
```

- [ ] **Step 2: Implement types + store; tests pass**

`presenceStore` API:
- `agents: Record<string, PresenceAgent>`
- `connected: boolean`
- `mirrorMode: boolean` (default true when no key — set by sync)
- `upsert(event)`, `remove(agentId)`, `clear()`, `setConnected(boolean)`
- PresenceAgent = event fields + lastTs

- [ ] **Step 3: Run** `npx vitest run src/integration/presence/`

---

### Task 2: Vite presence hub + client

**Files:**
- Create: `vite-plugins/presenceHub.ts`
- Create: `src/integration/presence/PresenceClient.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Hub plugin** — `POST /api/presence` (JSON body → validate → broadcast), `GET /api/presence/stream` (SSE), `GET /api/presence` (snapshot `{ agents: [...] }`)

- [ ] **Step 2: PresenceClient** — connect EventSource to `/api/presence/stream` (dev only; base-aware), `inject(event)` for mock + tests, reconnect with backoff

- [ ] **Step 3: Wire plugin in `vite.config.ts`**

---

### Task 3: buildMirrorSystem + appearance

**Files:**
- Create: `src/integration/presence/buildMirrorSystem.ts`
- Create: `src/integration/presence/agentAppearanceStore.ts`
- Create: `src/integration/presence/buildMirrorSystem.test.ts`

- [ ] **Step 1: Tests** — empty roster → user only lead placeholder; 3 agents get indices 1..n; appearance override wins for name/color/accessory; cap at 16

- [ ] **Step 2: Implement** collective color/accessory defaults; `CURSOR_MIRROR_SET_ID = 'cursor-mirror'`

---

### Task 4: Mirror Go Live + sync hook

**Files:**
- Modify: `src/integration/enterWorkspace.ts`
- Create: `src/integration/presence/usePresenceSync.ts`
- Modify: `src/App.tsx`
- Modify: `src/data/agents.ts` — export `MAX_MIRROR_AGENTS = 16` (keep `MAX_AGENTS` for designer or raise designer separately)

- [ ] **Step 1: `enterWorkspace`** — if `mirrorMode` (or no key + mirror default), skip API key gate; set demo/mirror flags; enter simulation without `startProject`

- [ ] **Step 2: `usePresenceSync`** — start PresenceClient; on roster change buildMirrorSystem → saveCustomSystem + setActiveTeam(`cursor-mirror`); set instanceCount; sync agentStatuses + status texts into uiStore

- [ ] **Step 3: Mount hook in App when simulation or always in dev

---

### Task 5: Behavior + bubbles

**Files:**
- Create: `src/integration/presence/mapPresenceBehavior.ts` (+ test)
- Modify: `src/utils/agentStatus.ts` or UIOverlay to prefer presence statusText
- Modify: `src/simulation/drivers/NpcAgentDriver.ts` and/or SceneManager to honor presence working→desk

- [ ] **Step 1: mapPresenceBehavior** — thinking→look_around / idle; working→sit_work; done→happy

- [ ] **Step 2: Extend uiStore or presenceStore for `agentStatusTexts: Record<number, string>`

- [ ] **Step 3: UIOverlay nameplates always show name; bubbles use statusText when in mirror mode

---

### Task 6: Customize panel + Swarm HUD

**Files:**
- Create: `src/interface/components/AgentCustomizePanel.tsx`
- Create: `src/interface/components/SwarmHud.tsx`
- Modify: `UIOverlay.tsx` / `App.tsx` / `Header.tsx`

- [ ] **Step 1: SwarmHud** — connected chip, live count, “Mock Swarm” button that injects 4 agents cycling states

- [ ] **Step 2: Customize panel** when selected NPC in mirror mode — name input, color picker, accessory select; writes appearanceStore + rebuild roster

---

### Task 7: Cursor hooks bridge

**Files:**
- Create: `.cursor/hooks.json`
- Create: `.cursor/hooks/emit-presence.mjs`
- Create: `tools/cursor-bridge/README.md`

- [ ] **Step 1: Script** reads stdin JSON, maps event name → presence event, POSTs `http://127.0.0.1:3000/api/presence` (fail-open)

- [ ] **Step 2: hooks.json** wires sessionStart, sessionEnd, subagentStart, subagentStop, afterAgentThought, preToolUse, stop

- [ ] **Step 3: README** — enable hooks, run `npm run dev`, open office

---

### Task 8: Verify

- [ ] **Step 1:** `npm run check`
- [ ] **Step 2:** Fix failures
- [ ] **Step 3:** Manual note in goal doc if anything deferred

---

## Self-review

- Spec coverage: schema, hub, mirror mode, roster, behavior, customize, hooks, HUD — all tasked
- No TBD placeholders
- Types consistent: `AgentPresenceEvent`, `PresenceState`, `CURSOR_MIRROR_SET_ID`
