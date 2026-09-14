# Mirror Office Motion — Design Spec

**Date:** 2026-07-31  
**Status:** DRAFT (awaiting user review)  
**Parent:** `docs/superpowers/specs/2026-07-29-cursor-agent-mirror-design.md`  
**Goal:** Make Cursor companion agents feel like a live office — natural walks, clear work/idle storytelling, no mid-session teleports.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Placement model | **Hybrid** — thinking/planning = stage huddle; sustained tool work = desks (specialists) |
| Lead (Cursor) | **Always on stage** (thinking, working, and idle/done) |
| Specialist idle/done | **Couch standby** + soft gray tint |
| Non-walk placement | **Spawn only** — soft pop at spawn once per new agent; then walks forever |
| Architecture | **Approach 1 — Presence Director** |

## Goal

Watching the side-window companion should feel like observing a small office:

- Agents **walk** between lounge, stage, and desks
- Pose changes use **stand / sit_down / talk / sit_work / sit_idle** clips
- Status bubbles and tint tell *what* they’re doing; body language tells *that they’re busy or waiting*
- **Never teleport** mid-session (no snap-to-seat / snap-to-desk fallbacks)

## Story map

| Who | Thinking | Working | Idle / Done |
|-----|----------|---------|-------------|
| **Cursor** (lead, blue) | Stage — continuous `talk` | Stage — continuous `talk` + speaking | Stage — calm `idle` (not couch) |
| **Specialist** | Walk to stage ring — standing `talk` | Walk to assigned desk — `sit_work` | Walk to lounge — `sit_idle` + soft gray |

### Visual telling

- Bubbles / status text: tool line, “Thinking…”, “Standing by”, etc. (existing Swarm HUD + in-world bubbles)
- Full color = active; soft gray = not needed
- Continuous talk on stage or sit_work at desk = busy until state leaves working/thinking

## Architecture

```
Cursor hooks → presence hub → presenceStore
  → mapPresenceBehavior (placement + pose + dim + speaking)
  → MirrorPresenceDirector (intent + locomotion queue)
  → CharacterController (stand → walk → arrive pose)
  → bubbles / dim tint (UI + CharacterManager)
```

### Units

| Unit | Responsibility |
|------|----------------|
| `mapPresenceBehavior` | Map presence state + lead flag → placement (`stage` \| `stand_ring` \| `desk` \| `lounge`), character pose, dim, speaking |
| `MirrorPresenceDirector` | Per-agent intent; locomotion queue; suppress re-walk spam; spawn-once warp |
| `SceneManager` | POI lookup (stage, sit_work desks, sit_idle lounge); execute director commands; no snap fallbacks |
| `CharacterController` | stand → walk → sit pipeline; path retry; never mid-session teleport API for mirror |
| `CharacterManager` | Durable CPU position authority so GPU sync cannot zero agents mid-walk |
| `usePresenceSync` | Feed roster/status into director; keep bubbles in sync |

## Placement rules (behavior)

```
isLead:
  thinking | working | idle | done → placement: stage
  thinking | working → pose talk (+ speaking when working)
  idle | done → pose idle (full color for lead)

!isLead:
  thinking → stand_ring + talk (standing busy)
  working  → desk (stable sit_work assignment) + sit_work
  idle | done → lounge (stable sit_idle seat) + sit_idle + dimmed
```

Desk and lounge seats are assigned stably from agent index (and held seat preference) so roster churn does not reshuffle everyone every event.

## Locomotion pipeline

On **intent change** (placement or leave-seat):

1. If seated and leaving → play **stand**; wait until finished  
2. **Walk** on navmesh to target POI  
3. On arrival → target pose (`talk` / standing think / `sit_down`→`sit_work` or `sit_idle`)  
4. While pathing or in `stand` / `sit_down` → ignore placement spam; still update bubble/status  
5. If already at correct place → refresh pose only (no re-walk)

### Anti-teleport

- Remove mid-session snap/sit fallbacks currently used when walks fail  
- Spawn warp allowed **once** per new `agentId` (soft pulse OK)  
- Path fail → retry on a short interval / hold last good pose in place — **never** `setPosition` to seat/desk for recovery  

### Reliability (required)

Root cause of today’s teleports: GPU↔CPU position sync collapsing new instances toward origin, which made walks fail and triggered snap fallbacks.

Must ship with director:

- Durable position hold / correct storage upload so `updatePaths` can advance agents  
- Director treats “at origin / NaN” after spawn as “still spawning,” not as a reason to snap to furniture  

## Data flow

```
presence event (state, statusText, parentId)
  → mapPresenceBehavior({ isLead: !parentId })
  → director.setIntent(agentIndex, { placement, pose, dim, speaking })
  → director.tick / on-event:
       if intent unchanged and settled → pose/dim only
       else enqueue stand→walk→arrive
  → setAgentStatus + bubbles from behavior
```

## Error handling

| Failure | Response |
|---------|----------|
| Navmesh path empty | Stay put; retry next director tick; log once in DEV |
| Agent seated when new walk needed | Always stand first |
| Rapid presence spam (tool status) | Update text only; do not restart walk |
| Agent removed | Release POI; despawn; clear director state |
| New agent | Spawn pop once → walk to first intent |

## Testing

- Unit: `mapPresenceBehavior` hybrid placements (lead stage always; specialist thinking→ring, working→desk, idle→lounge+dim)  
- Unit: director state machine — stand before walk; no re-walk while pathing; spawn-once flag  
- Manual / browser: Mock Swarm — visible walks couch↔stage↔desk; no mid-session teleports; Cursor stays on stage; idle specialists gray on couch  

## Out of scope

- Full social/ambient AI director  
- Blender office / furniture regen beyond existing companion sofa seats  
- Embedding inside Cursor IDE chrome  
- BYOK / Advanced mode behavior changes  

## Success criteria

1. No mid-session teleports during Mock Swarm or live Cursor sessions  
2. Hybrid story is readable in <3 seconds: lead on stage, thinkers near lead, workers at desks, waiters on couch  
3. Transitions use stand/sit/walk clips and feel continuous  
4. Status bubbles still match Cursor activity text  

## Implementation notes (for plan)

Primary touch points:

- New: `src/integration/presence/MirrorPresenceDirector.ts` (+ tests)  
- Update: `mapPresenceBehavior.ts` placements  
- Update: `usePresenceSync.ts` to drive director  
- Update: `SceneManager.ts` — remove snap fallbacks; expose walk-only helpers  
- Update: `CharacterManager.ts` / controller — position sync reliability  
- Keep: couch POIs + companion sofa; stage POI; desk `sit_work` POIs  
