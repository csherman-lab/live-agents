# Cursor Companion Reliability Goal

**North star:** Opening Live Agents beside Cursor reliably shows every agent/subagent as a named worker, with honest health status, great game feel, and zero mystery about whether the bridge is working.

## Must pass

1. Presence hub health: `GET /api/presence/health` returns hub uptime + agent count + lastEventAt
2. Project hooks map richer status (tool name, subagent type, truncated thought)
3. User-hook install script works for any workspace (`tools/cursor-bridge/install-user-hooks.mjs`)
4. Lobby + office HUD show: hub online / SSE connected / last event age / agent count
5. Activity feed of last ~12 presence events
6. Hook script unit-tested via stdin fixtures
7. Live smoke: POST event → SSE client receives; Mock Swarm works; `npm run check` green
8. Empty office is clear; broken hub shows actionable fix copy

## Quality bar

- No false “Cursor live” without SSE
- No mystery failures — UI tells you to start `npm run dev` or install hooks
- Subagents get readable names (Explore, Shell, etc.)
- Tool use shows “Using Read”, “Editing file”, etc.
- Session end clears the whole tree
