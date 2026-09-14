# Live Agents — Cursor Mirror Goal

**North star:** Live Agents is a side-window add-on that visualizes Cursor agents (and later ChatGPT/Claude) as named vinyl workers in the 3D office — a game-like spectator for swarms. No API key required.

## Product truth (2026-07-30)

First 10 seconds must feel like a Cursor companion, not a BYOK command center.

| Pillar | Requirement |
|--------|-------------|
| Mirror | One character per Cursor agent/subagent |
| Companion | Web app beside Cursor; hooks stream lifecycle |
| Zero keys | Enter Office works without provider API keys |
| Lobby | Empty office + Waiting for Cursor / Mock Swarm |
| Identity | Every character has a readable nameplate |
| Status | Coarse states + short status text |
| Customize | Name, color, accessory (defaults from collective designs) |
| Advanced | Teams / BYOK demoted, not deleted |
| Game feel | Incremental spawn (warp new only); walk/work/idle |

## Waves

| Wave | Outcome |
|------|---------|
| 1 | Presence event schema + Vite POST/SSE bus + client |
| 2 | Mirror mode (no API key) + dynamic roster → office spawn |
| 3 | State → animation + nameplate/bubble status text |
| 4 | Per-agent customization (name/color/accessory) persisted |
| 5 | Cursor hooks bridge (session/subagent/thought/tool/stop) |
| 6 | Swarm HUD + mock swarm for demos without Cursor |

## Done when

1. `npm run check` passes
2. Go Live works with no API key in mirror mode
3. Mock swarm spawns multiple named agents with live status
4. Project hooks can POST presence events to the local dev server
5. Customizing an agent’s name/color/accessory sticks across reloads

## Out of scope (later)

- Embedding the 3D view inside Cursor
- ChatGPT/Claude providers (same feed shape, different emitters)
- Full chat-transcript side panel
- New mesh/body pipeline
