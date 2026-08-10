# Cursor → Live Agents bridge

Streams Cursor agent lifecycle into the Live Agents 3D office (mirror mode).

## Quick start

```bash
# Terminal A — office + presence hub (port 3000)
npm run dev
```

Open http://localhost:3000 → **Enter Office** → **Mock Swarm** (four named workers; no Cursor required).

**Optional live** — keep `npm run dev` running, then either use this repo’s project hooks or:

```bash
npm run bridge:install   # any Cursor workspace
npm run bridge:smoke     # verify hub ingest without Cursor
```

If Cursor and the hub disagree on URL:

```bash
export LIVE_AGENTS_PRESENCE_URL=http://127.0.0.1:3000/api/presence
```

## Project hooks (this repo)

`.cursor/hooks.json` already POSTs presence events when you run agents in *this* workspace. Keep `npm run dev` running.

## User hooks (any repo)

```bash
npm run bridge:install
```

Installs `~/.cursor/hooks/live-agents-emit-presence.mjs` and wires session / subagent / tool / stop events.

Then:

1. Keep `npm run dev` running in live-agents  
2. Open the office in a browser  
3. Run agents in any Cursor workspace  

If Cursor and the hub disagree on URL:

```bash
export LIVE_AGENTS_PRESENCE_URL=http://127.0.0.1:3000/api/presence
```

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/presence/health` | Hub health + lastEventAt |
| GET | `/api/presence` | Snapshot |
| GET | `/api/presence/stream` | SSE for the browser |
| POST | `/api/presence` | Hook ingest |

## Debug

| Signal | Where |
|--------|--------|
| Hub online / SSE / last event age | Lobby + in-office HUD |
| Hook script runs | Cursor **Hooks** output channel |
| Roster / agent count (empty check) | DevTools: `window.__laPresenceHub()` → `agentCount` / `agentIds` |

Common fixes:

- HUD says hub offline → start `npm run dev` on port 3000  
- Agents idle forever → try **Mock Swarm** first; live needs a hook event  
- Roster not clearing → check `agentCount` / `agentIds` in `__laPresenceHub()` (should be `0` / `[]` after session/stop)

Mock Swarm works without Cursor and is the fastest way to verify desk / board / lounge / stage motion.
