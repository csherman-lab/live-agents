# Cursor Companion Amazing Goal

**Parent:** `cursor-companion-delight-goal.md` (chrome mostly fixed)  
**Date:** 2026-07-30

**North star:** Opening Live Agents beside Cursor feels like a tiny game — not an IDE plugin, not a BYOK leftover. Within 10 seconds you smile.

## Gaps this goal kills (evidence from delight audit)

| Gap | Why it kills amazing | Fix |
|-----|----------------------|-----|
| A. Advanced still visible | Header “Advanced · Teams” + lobby Advanced accordion compete with Enter Office | Mirror: bury Advanced behind Settings only; no header icon, no lobby accordion |
| B. Onboarding covers the hero | Cold open = modal over the product | Non-blocking tip strip OR auto-skip to office/lobby with one-tap dismiss; never full-screen block after first paint of lobby |
| C. Thin game feel | Spawn is a teleport; camera is generic; no “whoa they appeared” | Enter Office / Mock Swarm: cinematic framing + soft spawn pulse; intensity from working count |
| D. Motion still soft | Agents don’t sell the spectator fantasy | Prefer desk for working; thinking pose; idle roam light; no skate |

## Must pass

1. Cold open: lobby hero readable in ≤2s with **no full-screen onboarding dialog** (tip OK)
2. Mirror header: Enter Office / Lobby / Settings / About only — **no Advanced icon**
3. Lobby: Advanced reachable only via Settings → “Advanced · Teams” (or footer text link), not a primary accordion
4. Mock Swarm / Enter Office: camera eases to a pleasing office frame; new agents get a short spawn pulse (scale/emissive), not a hard pop
5. Working agents sit/work; thinking looks alive; HUD says Demo swarm or Cursor live honestly
6. `npm run check` + `npm run bridge:smoke` green
7. Browser QA screenshot: office fills the stage; no Advanced chrome in first viewport

## Out of scope

- Full Blender vinyl regen (`perfection-goal.md`) — runtime feel only this pass
- Embedding in Cursor
- New providers

## Done when

You open the app and think “this is a game companion,” not “this is a settings panel with a 3D view.”

---

## Progress (2026-07-30)

### Shipped
- Goal doc created
- **A.** Header Advanced icon hidden in mirror; lobby accordion replaced with Settings footer link; Advanced entry in Settings
- **B.** Full-screen onboarding replaced by non-blocking `CompanionTip` (auto-dismisses in office / with agents)
- **C.** Office overview camera frame on spawn; soft spawn scale pulse + happy spawn pose
- **D.** Working still prefers desk via existing presence mapper; spawn happy beat

### QA evidence
- Header buttons: Lobby, Enter Office, Settings, Open in browser, Fullscreen, About — **no Advanced**
- `hasFullOnboard: false`, tip non-blocking
- Mock Swarm: Composer/Explore/Shell/Review; Demo swarm; no Technical / API-key banner
- `npm run check` green

### Still optional later
- Full Blender vinyl regen (`perfection-goal.md`)
- Richer spawn VFX (particles) beyond scale pulse
