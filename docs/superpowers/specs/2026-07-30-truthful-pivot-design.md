# Truthful Pivot — Design Spec

**Date:** 2026-07-30  
**Status:** APPROVED (user: “do that now”)  
**Parent goal:** `docs/assets/cursor-mirror-goal.md`

## Goal

Make Live Agents **actually** a Cursor swarm companion. First 10 seconds must read as a game-like spectator for Cursor agents — not a BYOK command center with mirror bolted on.

## Locked decisions

| Decision | Choice |
|----------|--------|
| First-run feel | **Game lobby** — empty office is the hero; minimal chrome |
| Default mode | Mirror on; Go Live needs no API key |
| Old product | Demoted to **Advanced** (Teams / BYOK), not deleted |
| Team hijack | Mirror only drives `cursor-mirror` while mirror is on; leaving Advanced restores prior team |
| Spawn motion | Incremental: warp **new** agents only; appearance-only updates skip full reinit |
| Empty roster | User alone in office + clear empty-state HUD (no fake “Waiting” NPC) |

## Product shell

### Onboarding
Replace current steps with companion story:
1. Welcome — watch Cursor agents as vinyl workers
2. Connect — hooks stream presence; no API key
3. Play — orbit, follow, customize looks
4. Launch — open the office / mock swarm

### Overview (lobby)
Replace Command Center primary UI with:
- Title: Cursor Swarm / Live Agents companion
- Status: connected | waiting | N agents live
- Primary CTA: **Enter Office** (Go Live)
- Secondary: **Mock Swarm**
- Tertiary collapsed: Advanced (Teams, API keys, brief/chat)

### Header
- Primary: Enter Office / Office badge
- Secondary: Advanced → Teams (not the blue primary CTA)
- Settings stays; copy is “Settings” not “API first”

### README
Demo guide leads with mirror + Mock Swarm; BYOK is optional advanced.

## Mode model

```
productMode: 'mirror' | 'advanced'
```

- Default: `mirror`
- Mirror: presence sync on; active team forced to `cursor-mirror` only while in mirror
- Advanced: presence sync off (or ignored for roster); user picks teams; BYOK works as before
- Toggle in Overview Advanced section + Settings

## Sync / spawn

When mirror roster **IDs** change:
1. Rebuild mirror `AgenticSystem` + index map
2. Update instance count / drivers
3. Warp **only** indices whose `agentId` is new
4. Apply presence poses for state

When only appearance/state changes:
- Update store + colors + status texts
- Do **not** `warpAllToSpawn`

## Empty state

- Zero presence agents → instance count = 1 (user only)
- HUD: “Waiting for Cursor…” + Mock Swarm + short hook tip
- No placeholder lead NPC

## Honesty fixes

- `connected` only from SSE `onopen`, never from Mock Swarm inject
- Mock Swarm HUD label: “Demo swarm” while not SSE-connected
- `sessionEnd` / clear: remove all agents with matching session/`parentId` tree
- Leaving mirror mode: restore previous `selectedAgentSetId`

## Out of scope

- New meshes, Cursor webview embed, ChatGPT emitters, chat transcript panel
- Full soft-GPU incremental instance add without buffer rebuild (count change may still rebuild buffers; warp is what we fix)

## Done when

1. First-run onboarding never mentions API key as required
2. Overview primary path is Enter Office / Mock Swarm
3. Teams is Advanced, not primary header CTA
4. Empty office shows waiting state with user only
5. Adding a mock agent does not teleport existing agents
6. `npm run check` passes
