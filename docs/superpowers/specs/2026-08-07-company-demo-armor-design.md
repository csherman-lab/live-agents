# Company Demo Armor — Design Spec

**Date:** 2026-08-07  
**Status:** APPROVED (Approach 1 — Demo Armor)  
**Parent goals:** `docs/assets/cursor-mirror-goal.md`, companion finish/delight/reliability goals  
**Constraint:** ASAP — harden share paths; do not expand platform scope

## Goal

Make Live Agents company-showable as soon as possible by armoring the three share paths people will actually use. Features mostly exist; the risk is flaky live mirror, confusing setup, and a muddy first ten seconds—not missing mesh detail.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Approach | Demo Armor (reliability + setup + story + Mock Swarm polish) |
| Timeline | ASAP — ship armor before visual stranger-test regen |
| Share paths | All three: big-screen Mock Swarm, live beside Cursor, self-serve clone |
| Top failure modes | Live flakes + setup friction (story is a thin layer on top) |
| Blender / `perfection-goal.md` | Deferred until after armor ships |
| Platform expand (new providers, embed, transcript panel) | Out of scope |

## Share paths

| Share path | Audience moment | Done-when |
|------------|-----------------|-----------|
| **Big-screen** | Mock Swarm on a projector / shared tab | One click → full named office in ≤10s; HUD says Demo swarm; no setup talk |
| **Live beside Cursor** | You work; colleagues watch the side window | Real agents appear/clear correctly; HUD never lies about hub/SSE |
| **Self-serve** | Someone clones the repo | `npm i` → `npm run dev` → Enter Office / Mock Swarm without reading a design doc; live needs one clear `bridge:install` path |

## Architecture (unchanged)

Armor works inside the existing mirror pipeline—no new integration shape.

```
Cursor hooks → POST /api/presence (Vite hub)
  → SSE /api/presence/stream
  → PresenceClient → presenceStore
  → mapPresenceBehavior → MirrorPresenceDirector
  → SceneManager / CharacterController
  → SwarmHud + nameplates + bubbles
```

Mock Swarm injects the same store path without Cursor. Hosted static demo (`github.io`) is Mock-Swarm-first; it cannot run the local presence hub.

### Units touched (expected)

| Unit | Armor responsibility |
|------|----------------------|
| Presence hub + hooks bridge | Reliable ingest; honest health; install path clear |
| `presenceStore` / `PresenceClient` | Session clear; no false “Cursor live”; Mock vs live coexistence |
| Swarm HUD / lobby / CompanionTip | Actionable failure copy; 10-second story; Demo vs live labels |
| README + `tools/cursor-bridge/README.md` | Self-serve 3-step path + optional live install |
| Mirror director / motion runtime | Fix demo-breaking regressions only (skate, stuck scale, ghost chrome) |

## Ordered workstreams

Do in order. Later tracks assume earlier ones hold.

### 1. Live reliability (blocker)

Hardening only—no new behaviors.

- Session/stop clears the whole agent tree (no zombies after Cursor ends)
- HUD honesty: never “Cursor live” without SSE; hub offline → actionable copy (`npm run dev`)
- Status text stays coarse + useful (“Using Read”, “Thinking…”)
- Mock Swarm and live coexist without incorrect stomping
- Smoke: `npm run bridge:smoke` + scripted live walk (start agent → subagent → stop → empty office)

### 2. Self-serve setup (blocker for company clone)

- README / lobby copy: 3-step path only (install → dev → Enter Office / Mock Swarm)
- `bridge:install` called out as the optional live step, with `LIVE_AGENTS_PRESENCE_URL` escape hatch
- In-app failure states point to the same three steps (no hunting in specs)
- Hosted demo stays Mock-Swarm-first (no pretence that hooks work on static hosting)

### 3. Ten-second story (fast)

- Cold open: CompanionTip only; no Advanced in first viewport
- Lobby + office hero copy: “Cursor agents as named workers”
- Mock Swarm is the primary big-screen CTA; live is the power path
- Phase banner / HUD labels stay honest (Demo swarm vs Cursor live)

### 4. Big-screen Mock Swarm polish (runtime only)

- One click fills the office with readable nameplates + working/idle storytelling
- No skate / stuck miniature / ghost chrome (fix regressions from prior polish specs)
- Camera framing stays office-first so a projector still reads at a glance

## Error handling contract

The UI always answers **what’s wrong?** and **what do I do?** for:

| Condition | Expected UI |
|-----------|-------------|
| Hub offline | Not “Cursor live”; tell user to start `npm run dev` |
| SSE down / connecting | Honest pending state; never claim live agents |
| Waiting for Cursor | Intentional lobby/office empty state + Mock Swarm CTA |
| Demo swarm active | Label says Demo swarm (not Cursor live) |
| Session ended | Roster empty; no zombie workers |

Silent empty office is a bug.

## Success criteria

Company-ready when all three paths pass in one sitting:

| Path | Pass bar |
|------|----------|
| **Mock Swarm** | Cold open → Enter Office → Mock Swarm → ≥4 named workers moving with Demo swarm HUD; no Advanced/API-key chrome in first frame |
| **Live** | `npm run dev` + project/user hooks → start Cursor agent → lead + any subagents appear → stop/session end empties office; HUD flips Hub ready → Cursor live → empty/waiting honestly |
| **Self-serve** | Fresh clone following README only (no tribal knowledge) reaches Mock Swarm in ≤5 minutes; live path documented as `bridge:install` + keep hub running |

### Automated gates

- `npm run check`
- `npm run bridge:smoke`
- Existing presence / mirror unit tests stay green

### Manual QA checklist (evidence before calling done)

1. Cold open screenshot — tip only, office readable
2. Mock Swarm projector-distance glance — names + busy/idle readable
3. Live start → stop → no zombies (`window.__laPresence()` empty / HUD waiting)
4. Hub killed mid-session — HUD says offline with `npm run dev` fix
5. Fresh-clone README walk (or document any missing step and fix README)

## Out of scope

- Blender vinyl / office stranger-test regen (`docs/assets/perfection-goal.md`)
- Embedding the 3D view inside Cursor
- ChatGPT / Claude providers
- Full chat-transcript side panel
- Advanced / BYOK feature work (keep demoted; do not delete)

## Relationship to prior work

| Doc | Role |
|-----|------|
| `cursor-mirror-goal.md` | Product north star — already largely met |
| Companion reliability / delight / amazing / finish goals | Prior companion waves — armor assumes these shipped |
| `2026-08-04-mirror-office-polish-design.md` | Runtime polish baseline — fix regressions only |
| `perfection-goal.md` | Next visual wave **after** this armor ships |

## Done when

All four workstreams have evidence (automated + manual checklist), and a stranger can be shown the product via Mock Swarm, live Cursor, or clone/run without setup mystery, false live status, or zombie agents.
