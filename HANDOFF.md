# HANDOFF — Live Agents

**Offboarding summary** for Emily / Ben / Jonathan / Dan  
**Author:** Cameron Sherman (`csherman-lab`)  
**Date:** 2026-09-13

## What this is

A Cursor companion that visualizes agents and subagents as named workers in a living 3D office (React + Three.js/WebGPU + Vite). Default path is **Cursor Mirror** — no API key required. Optional **Advanced** mode is a legacy Teams designer / BYOK runner (Gemini, OpenAI, Anthropic).

Hosted static demo (Mock Swarm only): https://csherman-lab.github.io/live-agents/

## Current status (what works)

- **Mock Swarm** and game-lobby cold open work without Cursor or keys.
- **Cursor Mirror** works locally: presence hub on port 3000, project hooks in `.cursor/hooks.json`, or `npm run bridge:install` for any workspace.
- Latest **committed** work is on `feat/cursor-agent-mirror` (hardened bridge/presence hub, SwarmHud crash fix, Exit Demo, honest HUD vs Mock Swarm).
- Personal GitHub is **ahead** of `deftai/live-agents` (org copy last pushed ~2026-07-15; local/personal continued through August on mirror + presence).

## How to run

```bash
npm install
npm run dev
```

Open http://localhost:3000 in Chrome or Safari (WebGPU). Enter Office → Mock Swarm.

Optional live mirror: keep `npm run dev` running, then `npm run bridge:install` / `npm run bridge:smoke`. Escape hatch: `LIVE_AGENTS_PRESENCE_URL`.

Quality: `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run check`. Rebuild 3D models with Blender: `npm run assets:generate`.

## Key files

- `src/simulation/` — character controller, state machine, presence
- `tools/cursor-bridge/README.md` — hook / hub setup
- `docs/superpowers/` — mirror, demo-armor, presence plans/specs
- `scripts/blender/` and `docs/assets/` — 3D office / perfection goals
- `.env.example` — optional `VITE_DEMO_PROXY_URL`, `GEMINI_API_KEY` (Advanced only)

## Incomplete / follow-up

- **Uncommitted local work** (do not lose): sit transition + anim crossfade (+ tests), office `.glb` / Blender script, and simulation controller/state-machine edits. Not on GitHub yet.
- Open PR on **personal** repo: [#1 character presence playability](https://github.com/csherman-lab/live-agents/pull/1) (`feat/character-presence-playability`).
- `deftai/live-agents` is an older snapshot of the same lineage, not the working tree Cameron was using.
- No write access from the offboarding session to push this HANDOFF to `deftai/live-agents`.

## Access note

- Local origin: https://github.com/csherman-lab/live-agents (personal, **not** org-owned)
- Matching org repo **does exist**: https://github.com/deftai/live-agents (public)
- Do **not** delete the personal repo. Team should confirm whether to archive the org copy, transfer, or mirror the personal `feat/cursor-agent-mirror` work (plus uncommitted files) onto deftai.
