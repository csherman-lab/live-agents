# Truthful Pivot Implementation Plan

> **For agentic workers:** Execute task-by-task. Verify with tests after each logical group.

**Goal:** Pivot the product shell and mirror sync so Live Agents is a Cursor companion first.

**Architecture:** `productMode` gate on presence sync; lobby Overview; soft roster apply with selective warp; empty office = user only.

## Task 1: Mode model + soft sync

**Files:** `presenceStore.ts`, `usePresenceSync.ts`, `SceneManager.ts`, tests

- [ ] Add `productMode: 'mirror' | 'advanced'`, `previousTeamId`, `demoSwarmActive`
- [ ] `setProductMode` restores prior team when leaving mirror
- [ ] Empty roster → user-only system (no placeholder NPC)
- [ ] `applyMirrorRoster(system, { warpIndices })` — selective warp
- [ ] Appearance-only updates skip reinit
- [ ] Mock swarm does not set `connected: true`

## Task 2: Product shell

**Files:** Onboarding, Overview, Header, App preview copy, README

- [ ] Rewrite onboarding steps
- [ ] Rewrite Overview as lobby
- [ ] Header: Enter Office primary; Teams demoted
- [ ] README mirror-first

## Task 3: HUD + hooks

**Files:** SwarmHud, emit-presence.mjs

- [ ] Honest connection labels
- [ ] Empty-state copy
- [ ] sessionEnd clears children

## Task 4: Verify

- [ ] `npm run check`
