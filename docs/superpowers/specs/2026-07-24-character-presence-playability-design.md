# Character Presence & Playability — Design Spec

**Date:** 2026-07-24  
**Status:** APPROVED — implement all waves  
**North star:** Vinyl agents feel like little people you play with — accurate locomotion, believable talk/listen, and an office that reacts to you and to each other.

## Goal

Improve three pillars without rewriting the WebGPU instanced skinning pipeline:

1. **Locomotion accuracy** — walk/turn/stop look intentional (less skate, fewer pops)
2. **Conversation choreography** — face each other; talk/listen matches who’s speaking
3. **Game-like play + alive office** — clear interact feedback; ambient social life; notice-the-player

## Approach

**Character Presence layer** on top of `CharacterController` + `CharacterStateMachine`. Same GPU bake path and GLB contracts. Blender open when Walk/Talk/Listen clips need retunes.

| Module | Responsibility |
|--------|----------------|
| `LocomotionPresence` | Walk cycle rate ↔ speed; start/stop gait gates |
| `ConversationSession` | 2-party session: face, talk/listen roles, speaking mouths, enter/exit |
| `SocialDirector` | Ambient NPC↔NPC beats + notice-player; yields to work/chat |
| `InteractionPresence` | Hover/select feedback, approach-to-chat, wave emote |

`SceneManager` opens/closes sessions and feeds speaker flags; it does not own body-language branching ad-hoc.

## Constraints

- Keep shared vinyl body + GPU instancing (`CharacterManager` + TSL)
- Preserve mesh names, bone `head`, `AnimationName`s, POI prefixes
- User remains accessory `0`; lead keeps cap
- Do not redesign floor plan / rooms
- Max 1 ambient social session; never steal busy / player-chat agents
- No blend-tree rewrite, voice lip-sync, multi-party (>2) chats, inventory/quests

## Wave 1 — Locomotion accuracy

### Problems

Cruise speed is approximate vs Walk clip; hard idle↔walk cuts; turns ease yaw but feet keep full walk.

### Design

1. Use Walk bake `duration` + measured/tuned stride constant so cruise distance-per-cycle matches visual stride (playback rate on unused anim buffer slot and/or cruise retune).
2. **Gait gate:** enter `walk` after short commit; exit `walk`→`idle` with brief settle (no mid-stride idle snap).
3. Keep existing turn slowdown; when nearly stopped with large facing error, prefer yaw-in-place over skating.
4. Blender only if Walk export is dead/weak (known past `export_apply` issue).

### Success

No obvious skate at default zoom; start/stop deliberate; sit soft-arrival unchanged.

## Wave 2 — Conversation choreography

### Problems

Chat sets talk/listen from UI flags; facing is a one-shot waypoint nudge; speaker mouth can desync from body.

### Design — `ConversationSession`

1. **Enter:** suspend autonomy; approach (~1.2 units); smooth mutual facing; both `listen` until first speaker.
2. **Roles:** exactly one `talk` + speaking mouth; others `listen` + listening expression. Player typing → player talk; agent thinking → agent talk. Agent↔agent via same session.
3. **Exit:** clear speaking; idle/desk; resume autonomy; existing chat camera exit.

### Success

At chat zoom, who’s speaking is obvious; bodies face each other; mouth only on speaker.

## Wave 3 — Direct play + presence feedback

### Problems

Select / floor walk / POI / chat work, but feedback is thin; starting chat doesn’t feel like walking up to talk.

### Design

1. Click NPC = select + follow (keep). Double-click NPC (or Chat CTA / existing start) opens conversation session (approach + Wave 2).
2. Hover: ring + rate-limited look/wave chance.
3. While chatting, floor clicks do not yank the player out (Esc / end chat exits).
4. Light emote: wave at selected NPC without opening chat (key or UI — prefer existing shortcuts patterns).
5. Tighten select → approach → talk as one readable gesture.

### Success

A stranger can click around and feel they’re playing a tiny office avatar.

## Wave 4 — Alive office

### Problems

NPCs wander/sit/work alone; no ambient social; no notice-you.

### Design — `SocialDirector`

1. **Ambient chats:** pair two nearby free NPCs into a short ConversationSession (~4–8s, no LLM). Cap: 1 ambient session. Never steal busy / desk-working / player-chat agents.
2. **Notice player:** idle NPC within radius → chance of `look_around` / `wave` once; per-agent cooldown.
3. Yield to task `talking`, boardroom, working, player chat.

### Success

Office feels socially alive when idle; calm when working; player approach can get a reaction.

## Error handling

- Opening player chat cancels ambient sessions involving that NPC
- Path fail on approach → session abort to idle (optional toast)
- DEV: session dump alongside existing `__laController`

## Testing

- Unit tests: conversation role transitions; gait gate enter/exit; social director eligibility
- `npm run check` green
- Manual/smoke: walk feel, click→chat face-off, ambient pair when idle

## Out of scope

Full blend trees / root motion; new rooms; voice lip-sync; >2 circle chats; combat/inventory/quests.

## Wave 5 — Presence harden (2026-07-27)

Shipped on top of Waves 1–4 (no voice / lip-sync):

1. Chat approach fail → abort session + toast; skip walk if already close
2. Ease + hold mutual facing during approach / chat
3. Ambient meetup: walk free NPCs together, then talk
4. Return-to-desk / boardroom after player chat when tasked
5. Player `E` wave → NPC reacts; listener micro-beats
6. Discoverability: shortcuts, onboarding, inspector hint
7. DEV: `window.__laPresence()` session dump

