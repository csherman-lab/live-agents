# Cursor Companion Finish Goal

**Date:** 2026-07-31  
**Ask:** Do all three remaining tracks.

## Tracks

### 1. Live beside-Cursor pass
Open the app as a user: lobby → Enter Office / Mock Swarm → live Cursor hooks. Fix anything that breaks or feels wrong.

**Must pass**
- Cold open: tip only (no full-screen onboard); no Advanced in header
- Hub honest; live Composer/subagents appear with names + status
- Mock Swarm still works after live agents
- `npm run check` + `bridge:smoke` green after fixes

### 2. Session end + customize harden
**Must pass**
- Cursor session/stop clears the whole agent tree (no zombies)
- Name / color / accessory edits persist across reload for the same agentId
- Customize panel works in mirror office without BYOK chrome

### 3. Vinyl / motion perfection (runtime + goal link)
**Must pass (this pass — runtime)**
- Working → desk; thinking → alive pose; idle → light roam or idle loop
- Spawn pulse + overview frame still feel good with 1–N agents
- No skate / stuck non-interruptible crashes

**Must pass (document / queue)**
- Link remaining Blender mesh work to `perfection-goal.md` with a clear “next regen” checklist; ship any safe runtime lighting/motion wins without blocking on Blender

## Done when
All three tracks have evidence (browser or tests). User can leave the app open beside Cursor without mystery zombies, lost custom looks, or dead motion.

---

## Progress (2026-07-31)

### Track 1 — Live pass
- Lobby/office: no Advanced header, no full onboard, no API-key/Technical chrome
- Mock Swarm: 4 named workers + Demo swarm HUD
- Hub healthy during pass

### Track 2 — Session end + customize
- `stop` (lead) → `op: remove` (clears tree); subagent stop removes that worker
- Hub `remove` deletes subtree (no orphan hydrate)
- Client `removeTree` verified mid→empty; empty roster clears `demoSwarmActive`
- Appearance: role-key fallback (`role:composer`) so looks survive session_id rotation; unit test added

### Track 3 — Motion + perfection link
- Thinking (`talking`) treated as presence-busy (no wander mid-thought)
- Idle agents still use existing roam/desk autonomy when not busy
- `perfection-goal.md` handoff for next Blender regen (non-blocking)

### Verification
- 67 tests, `npm run check`, `bridge:smoke` green
