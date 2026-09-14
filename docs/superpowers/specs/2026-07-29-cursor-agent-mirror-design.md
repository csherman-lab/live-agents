# Cursor Agent Mirror — Design Spec

**Date:** 2026-07-29  
**Status:** APPROVED (Approach 1 — local bridge + event bus)  
**Goal doc:** `docs/assets/cursor-mirror-goal.md`

## Goal

Turn Live Agents into a Cursor-first companion: the existing 3D office visualizes live Cursor agents/subagents as named, customizable vinyl characters. No provider API key is required for mirror mode.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Integration | Cursor-first; ChatGPT/Claude later on same feed |
| Mapping | 1 character per agent/subagent |
| Shell | Web app in side window + Cursor hooks stream |
| Auth | No API key for visualization |
| Behavior v1 | Coarse states + status text + spawn/despawn |
| Customize | Name, color, accessory (medium) |
| Architecture | Local bridge + presence bus (Approach 1) |

## Architecture

```
Cursor hooks (.cursor/hooks/*)
  → POST /api/presence  (Vite middleware)
  → SSE /api/presence/stream
  → PresenceClient → presenceStore
  → MirrorRoster builds AgenticSystem
  → SceneManager / NpcAgentDriver / UIOverlay
```

### Units

| Unit | Responsibility |
|------|----------------|
| `presenceTypes` | Shared `AgentPresenceEvent` schema v1 |
| Vite `presencePlugin` | In-memory hub: POST ingest, SSE fan-out, snapshot GET |
| `PresenceClient` | Browser EventSource + reconnect; also accepts local inject |
| `presenceStore` | Live roster + statusText; mirror mode flag |
| `agentAppearanceStore` | Persisted name/color/accessory overrides by `agentId` |
| `buildMirrorSystem` | Roster → `AgenticSystem` with collective defaults + overrides |
| `PresenceDirector` | Maps presence state → AgentState / desk vs idle POI |
| Cursor hook script | Maps hook stdin → presence event, POSTs to localhost |
| Swarm HUD | Agent count + connection chip; Mock Swarm button |

## Event schema

```ts
type PresenceState = 'idle' | 'thinking' | 'working' | 'done';

interface AgentPresenceEvent {
  type: 'agent.presence';
  v: 1;
  ts: number;
  agentId: string;
  name: string;
  state: PresenceState;
  statusText?: string;
  parentId?: string | null;
  provider?: 'cursor' | string;
  /** `remove` despawns; default `upsert` */
  op?: 'upsert' | 'remove';
}
```

### Hook → state

| Cursor hook | Presence |
|-------------|----------|
| `sessionStart` | upsert lead, `thinking` |
| `afterAgentThought` | `thinking` + truncated statusText |
| `preToolUse` | `working` + tool-ish statusText |
| `subagentStart` | upsert child with `parentId` |
| `subagentStop` / `stop` | `done` then optional `remove` after grace |
| `sessionEnd` | remove all for session |

## Mirror mode

- Default product path: mirror mode on when no API key (or explicit Mirror toggle).
- `enterWorkspace()` succeeds without API key when mirror mode is active.
- Existing BYOK team-runner remains available when a key is present; not the default story.
- Raise soft cap: `MAX_MIRROR_AGENTS = 16` (GPU instances); UI warns above that.

## Collective defaults + customization

- Defaults: palette cycles from brand/team colors; lead gets cap (accessory 2); children cycle headphones/beanie/glasses/…; names from event `name`.
- Overrides in `localStorage` keyed by `agentId`: `{ name?, color?, accessory? }`.
- Small customize panel when an agent is selected in simulation (mirror mode).

## Behavior mapping

| Presence | AgentState / motion | Bubble |
|----------|---------------------|--------|
| idle | idle / wander near spawn | statusText or “Standing by” |
| thinking | look_around at spawn area | statusText or “Thinking…” |
| working | sit_work at desk POI | statusText or “Working…” |
| done | happy briefly → idle | statusText or “Done” |
| remove | despawn (roster rebuild) | — |

## Error handling

- Bridge offline: HUD shows “Waiting for Cursor…”; office keeps last roster (or empty).
- Malformed POST: 400 JSON; ignore in client.
- Hook POST failure: fail-open (hooks never block Cursor).

## Testing

- Unit: schema parse, roster upsert/remove, buildMirrorSystem indices, appearance merge, state→bubble mapping.
- Manual: Mock Swarm → characters appear with names; customize persists; hooks POST while `npm run dev`.

## Out of scope

- Cursor webview embed, ChatGPT/Claude emitters, chat transcript panel, new meshes.
