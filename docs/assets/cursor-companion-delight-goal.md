# Cursor Companion Delight Goal

**Honest audit (2026-07-30):** Reliability mostly works. Delight does **not**. Opening the app still feels like a BYOK command center with a mirror bolted on — not a game-like Cursor spectator you’d be proud to leave open beside Cursor.

## Answers (evidence-based)

| Question | Answer | Evidence |
|----------|--------|----------|
| Fully tested? | **No** | First paint often sparse; office still shows Technical/Brief/Token chrome; delight path not walked as a cold user |
| Does it work? | **Mostly** | Hub healthy, SSE live, agents spawn, Mock Swarm can fill 4 named workers |
| Amazing product? | **No** | Mirror office still shouts “Command Center”, “API key”, “No tasks yet”, empty Technical panel |
| Will you be very happy? | **Not yet** | First 10 seconds don’t feel like a little game — they feel like leftover Advanced UI |

## North star

Open Live Agents beside Cursor → empty glowing office (lobby) or live swarm (office) → **instant game spectator energy**. Zero BYOK noise unless you deliberately open Advanced.

## Must pass (delight bar)

1. **Cold open (mirror):** No “add a brief”, “Command Center”, “API key to run agents”, empty Technical pane, or Token $0 as primary chrome
2. **Office = spectator stage:** Swarm HUD + nameplates + activity feed dominate; side panels collapsed/hidden in mirror
3. **Live Cursor agents:** Named vinyl workers move/work with readable status; count matches hub
4. **Mock Swarm:** One click → 4 named workers (Composer/Explore/Shell/Review) with motion + feed; label says Demo swarm
5. **Lobby:** “Watch your swarm” hero; health honest; Enter Office / Mock Swarm primary; Advanced collapsed
6. **Empty state:** Waiting for Cursor feels intentional (game lobby), not broken
7. `npm run check` + `npm run bridge:smoke` green after changes

## Out of scope this goal

- Blender mesh regen / vinyl silhouette perfection (see `perfection-goal.md`)
- Embedding inside Cursor
- ChatGPT/Claude providers

## Done when

A stranger opens `http://localhost:3000`, skips intro, hits Enter Office or Mock Swarm, and within 10 seconds says: “oh cool — my Cursor agents are in an office” — not “why is there a token counter?”

---

## Progress (2026-07-30 afternoon)

### Shipped this pass
- New goal: this file
- Mirror office hides Action Log / Kanban / Inspector
- Mirror no longer sets BYOK `isDemoMode` (killed “Add an API key” banner)
- Mirror phase banner = companion copy (Demo swarm / N Cursor agents…)
- Simulation header slimmed to “Cursor Swarm · Mirror”
- Lobby preview copy: “Your Cursor agents appear here as named workers”
- Mock Swarm office QA: no API-key / Command Center / tasks / Technical chrome; Composer/Explore/Shell/Review present; `npm run check` + `bridge:smoke` green

### Still not “amazing” yet
- Vinyl silhouette / motion polish still on `perfection-goal.md`
- Lobby Advanced accordion + header Advanced icon still visible (demoted, not invisible)
- Cold-open onboarding can still cover the hero
- Game feel (spawn juice, camera framing) still thin vs a real side-game
