# Live Agents 3D — Orchestrator Log

**North star:** Watching AI agents work in a cute 3D office should feel delightful — clear, charming, and smooth.

**Status:** Exploration complete (2026-07-13). Wave 1 in progress.

---

## Mental model

```
React (App / SimulationView)
  └─ SceneManager
       ├─ Engine (WebGPURenderer, shadows)
       ├─ Stage (camera, OrbitControls, lights)
       ├─ WorldManager (office.glb → materials, navmesh, POIs)
       ├─ CharacterManager (character.glb → GPU instanced skinned agents)
       ├─ CharacterController (play / moveTo / walkToPoi)
       └─ InputManager (pick agents, floor walk, POIs)
```

**Agent on screen:** `agents.ts` color/index → instance buffers → GPU bake of shared `character.glb` clips → TSL skin + tint. Distinction today ≈ color + cap/headphones only.

**Watch loop:** Brief → Go Live → agents path to desks/boardroom via navmesh → status bubbles → click/keys select → chat zooms while player walks to NPC.

**Assets:** Blender scripts regenerate `character.glb` / `office.glb`. Walk export requires `pose_position=POSE`, `export_apply=False`, `export_force_sampling=False`.

---

## What's strong
- WebGPU instancing + GPU path seek scales to a team
- Navmesh + off-mesh sit teleport is pragmatic
- POI occupancy, task→place mapping, chat approach ritual
- Multi-material office slots (screens/leaves)
- Soft high-key lighting with contact shadows

---

## Weaknesses (ranked for delight)

### P0 — Avatars (charm / identity)
1. One shared mesh — agents are recolors, not characters
2. Silhouette oscillates (jellybean ↔ stick limbs); faces still read as stickers
3. Accessory story wrong vs art-direction; caps tint same as body (invisible)
4. No per-agent scale / face personality / silhouette variety

### P1 — Animation
5. Walk fragile (export flags); no frame interpolation; no stride lock
6. Missing clips silently become Idle
7. Sit arrival teleports (pop)

### P2 — Movement / watchability
8. No agent–agent avoidance (only ghost fade)
9. UI/keyboard select doesn't sync follow-cam (`SceneManager.selectedIndex`)
10. Constant-speed seek, no accel/turn blend

### P3 — Camera / onboarding / polish
11. No pan; follow always fights wide “watch the team” framing
12. ~~Chat zoom-limits only (no composed shot)~~ → **PASS Wave 13**
13. Onboarding teaches product loop, not how to watch/orbit
14. Uncapped DPR + 4K all-mesh shadows; no IBL/tone mapping

---

## Workstreams

| ID | Area | Owner files (typical) |
|----|------|------------------------|
| A | Avatar mesh / cute silhouette | `scripts/blender/generate_character.py` |
| B | Avatar variety / materials | `CharacterManager.ts`, `agents.ts` |
| C | Watch delight (cam / select / bubbles) | `Stage.ts`, `SceneManager.ts`, `InputManager.ts` |
| D | Motion / path / anim sync | `CharacterController.ts`, `constants.ts`, `NpcAgentDriver.ts` |
| E | Office / lighting polish | `generate_office.py`, `Stage.ts`, `WorldManager.ts` |

---

## Waves

### Wave 1 — Cute distinct little people (NOW)
**Goal:** Strangers can tell agents apart at a glance; faces sit on heads; silhouette reads as a cute vinyl person with stubby limbs; caps/headphones contrast.

| Agent | Mission | Status |
|-------|---------|--------|
| A | Silhouette + flush curved faces + readable limbs (Blender) | **done** — metrics pass |
| B | Per-agent scale + accessory contrast + fix accessory tint | **done** |
| C | Wire UI/keyboard select → follow-cam | **done** |

### Wave 1 review (orchestrator — critical)
**Metrics:** PASS — arm xspan 0.759, eyes Δ +0.001, Walk 0.115/0.158, scale+tint+follow-cam code verified.

**Visual QA (`?v=35`):** PARTIAL FAIL — agents still read as colored pills at workspace zoom; atlas faces/mouths not charming enough; limbs soft in iso. Charm bar not met.

### Wave 1.5 — Face + silhouette charm (NOW)
Push faces to read as cute vinyl people at default camera; keep metric contracts.

### Wave 1.5 review
**Metrics:** PASS — eyes 0.34 flush, mouth 0.24, emissive 0.07, Walk OK.
**Visual QA (`?v=36`):** Still weak — iso read still “limbless beans”; faces not popping as charming people. Continue iteration before Wave 2.

### Wave 1.6 review
**Metrics:** PASS — arm xspan **0.852** (was 0.759); eyes/mouth larger; Walk OK.
**Idle arm span:** REST/Idle still ~0.85 — limbs exist in data; iso still reads soft because agents are small on screen + same-color limbs.
**Visual QA:** Partial — progress, not charming yet.

### Wave 2 — Watch delight + motion (NOW)
1. Default camera closer so agents fill more of the viewport
2. Soft separation / less clipping when idle-wandering
3. Keep iterating avatar charm in parallel if needed

### Wave 2 review
**Camera:** PASS — default dist ~13, roam 8–16; agents larger on screen.
**Separation:** PASS — CPU XZ push-apart; seated anchors; GOTO 0.25×; wander clearance.
**Avatar charm:** Still open — closer cam helps but silhouette still soft.

### Wave 3 — Motion personality (NEXT)
Soften sit arrival teleport; improve walk foot sync / frame feel.

### Wave 3 review
**Walk blend:** PASS — GPU lerp between adjacent bake frames for all clips.
**Sit arrival:** PASS — slowdown last 1.25u + 0.28s ease into seat; occupancy intact.
**Avatar charm:** Still the open gap for “genuinely cute.”

### Wave 4 — Onboarding + avatar charm (NEXT)
1. First-run tips for orbit / select / watch
2. Another avatar silhouette pass toward preview-quality cute vinyl people

### Wave 4 review
**Onboarding:** PASS — workspace step teaches orbit / 1–9 / bubbles.
**Avatar metrics:** PASS — arm 0.904, eyes flush, mouth 0.24.
**Avatar visual:** Still soft/pill at iso — charm not closed. Treat as ongoing.

### Wave 5 — Perf + lighting polish (NOW)
Cap DPR, reduce shadow cost, add subtle tone mapping so the office reads richer.

### Wave 5 review
**Perf:** PASS — DPR ≤2, shadow map 2048, tiny clutter no cast.
**Tone:** PASS — ACES Filmic + exposure 1.12; lights unchanged.
**Open:** Avatar charm still soft at iso.

### Wave 6 — Hybrid ref body (DONE)
Cloned HEAD `body` (no metaballs); mild vinyl smooth; head slim + A-pose arms; atlas faces kept. Metrics PASS (xspan 0.87, Walk ~0.14). Silhouette clearer than pills; charm still soft vinyl-toy at iso.

### Wave 7 — Face / atlas pop at iso (PARTIAL)
**Goal:** Eyes/mouth as cute painted vinyl at workspace zoom.

**Shipped:**
- Face materials: no `instanceColor` (was team-tinting sclera), no mipmaps, DoubleSide, depthTest off, albedo×1.25 + emissive×0.55 on atlas
- Mouth UV base fixed to col0 (ExpressionBuffer adds cell offsets) — was double-offsetting idle mouth
- Atlas: opaque white face ovals behind eye ink; mouth ink punched near-black
- Blender: larger face shells (eyes 0.38, mouth 0.30), face cavity flatten, outward normals, flush Δ≈0.003
- Metrics PASS — Walk L/R ~0.14, 12 clips, head bone, eyes flush

**Visual QA (`?v=54`):** Better than Wave 6 dark-screen + faint icons — white face mass more present in close crops (pupils sometimes readable). At default iso still soft/noisy; not yet clean “painted vinyl” ovals. Charm bar **not closed**.

### Wave 8 — Oversized face fill (DONE)
**Goal:** Clear white eye ovals + pupils and readable mouth ink at default iso (dist~13).

**Root cause (beyond size):** Mouth UV `zoom>1` expanded thin dark ink into a solid dark plate; aggressive eye zoom clipped oval alpha into noisy white rectangles. MeshBasic alone wasn't the fix.

**Shipped:**
- Blender chibi shells: eyes **0.462×0.254** (~68% head width), mouth **0.354×0.159** (~52%); raised upper-front for iso; flush Δ≈0.005
- Eye UV zoom **1.18** (keep oval silhouette); mouth UV zoom **1.0** (ink stroke only)
- Runtime: black albedo + full atlas `emissiveNode`, no `instanceColor`, NearestFilter, alphaTest 0.05, DoubleSide, depthTest off
- Cache bust `character.glb?v=62`; Walk invariants OK (POSE, apply=False, force_sampling=False)

**Metrics:** PASS — Walk L/R ~0.14, 12 clips, head bone, flush ≤0.01

**Visual QA (`?v=62`):** **PASS** — white ovals + pupils clear on ≥3 standing agents (yellow/red/green); mouths readable ink. Not glow stickers. Charm bar for faces closed at default iso; silhouette charm still iterative.

### Wave 9 — Limb silhouette at iso (DONE)
Faces closed. Remaining P0: stubby arms/legs as separate volumes at workspace iso.

**Shipped (hybrid ref only — no metaballs):**
- Deeper underarm + crotch valleys; outer arm/leg reach; stronger mild A-pose
- Head slim `max_head_width=0.60`; arm xspan target **0.88** (hit **0.988**)
- Milder vinyl smooth `0.05×1`; Wave 8 face shells floor `eyes≥0.462` / `mouth≥0.354`; UV zoom unchanged
- Cache bust `character.glb?v=70`; export invariants OK (`POSE`, `apply=False`, `force_sampling=False`)

**Metrics:** PASS — arm xspan **0.988**, head_w **0.600**, eyes **0.462×0.254** flush Δ**0.005**, mouth **0.354×0.159**, Walk L/R **0.140/0.150**, 12 clips, head bone

**Visual QA (`?v=70`):** **PASS** — ≥2 standing agents (green/yellow; red walk) show clear underarm notch + stubby arms past head + leg separation; vinyl person, not colored pill. QA crops: `docs/assets/wave9-qa-v70.png`, `wave9-qa-v70-agents.png`.

### Wave 10 — Distinct little people (DONE)
Face + limbs closed. Goal: strangers tell lead vs specialist vs user at a glance via accessories + idle face seeds — keep one `character.glb` instancing.

**Shipped:**
- Blender: taller soft beanie dome (`radius 0.178`, scale Z↑) + thicker HP cups (`radius 0.098`, scale X 0.58) / band beads
- Runtime: cream cap tint `mix(cream, team, 0.18)`; near-black HP cups; scale spread **[0.90, 1.12]**
- `ExpressionBuffer`: per-instance idle personality (`idle` / `neutral` / `happy`) + staggered blinks; lead=`happy`, user=`neutral`
- Cache bust `character.glb?v=80`

**Metrics:** PASS — arm xspan **0.988**, head_w **0.600**, eyes **0.462×0.254** flush Δ**0.005**, mouth **0.354×0.159**, Walk L/R **0.140/0.150**, 12 clips, head bone, `POSE` / `export_apply=False` / `export_force_sampling=False`
- Cap AABB ≈ `(0.396, 0.382, 0.326)`; headphones ≈ `(0.588, 0.239, 0.345)`

**Visual QA (`?v=80`):** **PASS** — lead clearly cream-capped; ≥1 specialist with unmistakable thick headphones; specialist cap/HP alternate readable; faces not clone-identical (subtle idle cell variety). Not “same blob, different color.” QA: `docs/assets/wave10-qa-v80.png`, `wave10-qa-v80-agents.png`, `wave10-qa-v80-lead.png`, `wave10-qa-v80-hp.png`.

### Wave 11 — Office preview parity (DONE)
Avatar bar closed. Goal: side-by-side with `public/images/office-preview.jpg` — furniture/screens/plants/floor readable (not chalk white void).

**Shipped:**
- Blender: darker floor `(0.70)`, punchier leaf `(0.16,0.62,0.26)`, near-black screens, thicker grid/border, bushier plants; `_emit` copies mats so flexo glow no longer pollutes shared white
- `WorldManager`: forced floor/grid/screen/leaf colors (survive ACES); lamp `*-emit` slots keep glow; cache bust `office.glb?v=90`
- `Stage`: ambient `0.18π` / hemi `0.36π` / dir `0.84π` — slightly more form shadow, Wave 5 ACES untouched
- Contracts: 36 meshes (not 361), `navMesh` present, `colored-border` theme tint intact; POIs/`reference_data` unchanged

**Visual QA (`?v=90`):** **PASS** — desks/chairs readable vs grey floor; monitors dark; plants clearly green; thin blue border; soft high-key without chalk void. QA: `docs/assets/wave11-qa-v90.png`, `wave11-qa-v90-closer.png`.

### Wave 12 — Watch motion delight (DONE)
Avatar + office closed. Walking felt mechanical (constant-speed GPU seek + snap yaw).

**Shipped (CPU path follow — GPU GOTO shares waypoint/facing slots, so ease+yaw must be CPU):**
- `PathAgent`: segment start/length, remaining distance, desired direction hooks
- `CharacterController`: eased cruise along segments + arrival ease-out; yaw blends at `AGENT_TURN_RATE` (no facing snap on repath); move along facing with corner pull; separation treats `isMoving` like GOTO
- `constants`: `AGENT_CRUISE_SPEED` (= SPEED×GOTO×60 ≈ 0.354 u/s), segment/arrival ease, turn rate + turn slowdown
- Sit soft-arrival + soft separation unchanged; base SPEED/GOTO mult unchanged

**Motion QA (`?v=100`, Chrome WebGPU):**
- Continuous pathing samples: speed ~0.22–0.28 u/s (below raw cruise while easing/turning); max yaw step **~14°/50ms** (limit ~21° — not 180° snaps)
- Report: `docs/assets/wave12-motion-report.json`; stills: `wave12-qa-v100-turn-*.png`, `wave12-qa-v100-walk-c.png`

**Verdict:** **PASS** — turns interpolate; speed eases vs constant skate; POI/sit soft-arrival intact by code path.

### Wave 13 — Select / chat camera compose (DONE)
Motion closed. Chat previously only lerped OrbitControls min/max — no composed conversation shot.

**Shipped:**
- `Stage`: chat look-at eases to player+NPC midpoint at chest height (`CAMERA_CHEST_Y`); orbit radius eases to `CHAT_CAMERA_DIST` (8) within 7–9; polar stays roam iso; exit restores roam 8–16 limits; damping + `enablePan=false` unchanged
- `SceneManager`: each frame while chatting, feeds player/NPC positions via `setChatSubjects`; non-chat select still follows via `setFollowTarget` (chest look-at)
- `constants`: `CAMERA_CHEST_Y`, `CHAT_CAMERA_DIST` / min / max
- QA hook: `window.__laStage.getCameraDebug()`

**Camera QA (`?v=110`, Chrome WebGPU):**
- Before chat: dist ≈ 12.9, limits 8–16
- During chat: dist ≈ **8.00**, limits **7–9**, look-at midpoint err ≈ 0, target.y = 1.05, `hasChatSubjects=true`
- Exit chat: limits restore (max → ~16); follow remains on selected NPC
- Report: `docs/assets/wave13-camera-report.json`; stills: `wave13-qa-v110-chat.png`, `wave13-qa-v110-exit.png`

**Verdict:** **PASS** — opening chat is a framed two-person beat (midpoint + dolly), not “same orbit, narrower limits.”

### Wave 14 — Work-watch life (DONE)
Major bars closed. Seated/idle agents were frozen mannequins; bubbles sat on chibi faces.

**Shipped:**
- `NpcAgentDriver`: desk micro-beats on 4–12s staggered timers — `sit_work` ↔ `sit_idle` while seated (busy *or* autonomous); standing rest occasionally `look_around`; never interrupts walk / talk / listen / active path (`isPathing`); soft separation + sit soft-arrival untouched
- Busy system tasks: SceneManager still owns placement; driver only flavors seated desk life (no wander-away while tasked)
- Autonomous seated: ~70% stay for desk life, ~30% stand/wander (was inverted / no-op sit_idle re-play)
- Work mouth: `setExpression('neutral')` after `sit_work` (ExpressionBuffer already has the cell)
- `BUBBLE_Y_OFFSET` 1.55 → **2.25**; `AgentHeadBubble` / `UIOverlay` screen lifts raised so tails clear white eye ovals

**Desk-life QA (`?v=120`, Chrome WebGPU):**
- 18s sample: **7** desk/standing flips (sit_idle↔sit_work, idle↔look_around) across agents 1/3/4 — not frozen
- Report: `docs/assets/wave14-desk-report.json`
- Stills: `wave14-qa-v120-before.png`, `wave14-qa-v120-after.png`, `wave14-qa-v120-bubble-close.png`, `wave14-qa-v120-life.png`, `wave14-qa-v120-bubble-final.png`

**Verdict:** **PASS** — watching the office, seated/standing agents change posture over ~15–20s; bubbles clear faces.

### Status snapshot
| Area | State |
|------|--------|
| Watch camera / select / separation | **PASS (Wave 13 compose)** |
| Walk blend / sit soften | Good |
| Work-watch desk life / bubbles | **PASS (Wave 14)** |
| Onboarding watch tips | Good |
| Perf / tone | Good |
| Avatar face pop | **PASS (Wave 8)** |
| Avatar limb silhouette | **PASS (Wave 9)** |
| Role identity (accessories / idle face) | **PASS (Wave 10)** |
| Office preview parity | **PASS (Wave 11)** |
| Walk ease + turn blend | **PASS (Wave 12)** |
| Chat composed shot | **PASS (Wave 13)** |

### Wave 15 — Stranger-test critical polish (DONE)
All major bars PASS. Critical browser QA vs `office-preview.jpg` + perfection bar.

**Stranger findings (`?v=130` before):**
1. **P0 — Faces read as QR/static** — dense curved face shells used per-triangle UV tiling → kaleidoscope atlas noise (not cute eyes/mouth)
2. Idle atlas cells pointed at wink+frown; blink cell was wrong row
3. Default iso clipped south-edge agent/bubble slightly

**Shipped:**
- `generate_character.py`: object-wide XZ UV projection for eyes/mouth (regen `character.glb`)
- `CharacterManager`: runtime UV reproject safety net + Linear face filtering
- `ExpressionBuffer` / `constants`: idle/neutral → dots+smile; blink → closed eyes; wink/doubtful cells corrected
- `Stage`: default camera pullback (~13.0 → ~14.5) so edge agents stay in frame

**Visual QA:**
- Before: `docs/assets/wave15-qa-v130-before.png`, `wave15-qa-v130-canvas.png`
- After: `docs/assets/wave15-qa-v132-final.png`, `wave15-qa-v132-canvas.png` (+ mid `wave15-qa-v131-*`)

**Contracts spot-check:** Walk travel still >0.05 on regen; eyes/mouth sizes intact; desk-life `look_around` observed; accessories still present; chat compose / bubble offset untouched.

**Remaining soft nits (not blocking):** occasional partition overlap while wandering; white-on-white furniture still subtle vs preview; mouths thin at default zoom.

**Verdict:** **PASS** — stranger-test faces now read as vinyl eyes (not static); office + workers feel delightful; no W8–14 regressions found.

### Status snapshot
| Area | State |
|------|--------|
| Watch camera / select / separation | **PASS (Wave 13 compose)** |
| Walk blend / sit soften | Good |
| Work-watch desk life / bubbles | **PASS (Wave 14)** |
| Onboarding watch tips | Good |
| Perf / tone | Good |
| Avatar face pop | **PASS (Wave 8 + Wave 15 UV)** |
| Avatar limb silhouette | **PASS (Wave 9)** |
| Role identity (accessories / idle face) | **PASS (Wave 10)** |
| Office preview parity | **PASS (Wave 11)** |
| Walk ease + turn blend | **PASS (Wave 12)** |
| Chat composed shot | **PASS (Wave 13)** |
| Stranger-test polish | **PASS (Wave 15)** |

### Wave 16 — Mouth weight + partition clearance (DONE)
W15 soft leftovers: thin mouths at default iso; occasional stand-in-partition while wandering.

**Root causes:**
1. **Mouths** — idle/neutral/happy often sampled tiny-O or open+tongue cells (hairline / red fleck at iso); smile atlas had huge empty margin; shell small vs eyes after camera pullback.
2. **Partitions** — navmesh divider holes undersized vs Blender cubes (divider-a length shortfall ~0.36, divider-b width ~0.16); soft separation could nudge idle agents into thin AABBs.

**Shipped:**
- Mouth atlas: filled banana closed-smile / frown (pure black ink); open cells preserved from W15 bak
- `generate_character.py`: mouth shell **0.420×0.260** (was 0.354×0.159), UV zoom **1.45**, global XZ projection kept (no QR reopen); flush Δ**0.005**
- `ExpressionBuffer`: resting expressions → closed smile `col1/row0` (open cells reserved for speaking)
- `navmesh.py`: divider obstacles enlarged + body clearance; regen `office.glb`
- `CharacterController.applyPartitionPushOut` + `PARTITION_PUSH_BOXES`
- Cache bust `character.glb?v=141`, `office.glb?v=141`

**Contracts:** Walk L/R **0.140/0.150**, eyes **0.462×0.254**, mouth **0.420×0.260**, 12 clips, head bone, `POSE`

**QA (`?v=141`, Chrome WebGPU):**
- Partition 20s sample: **0** AABB overlaps — `docs/assets/wave16-partition-report.json`
- Stills: `wave16-qa-v141-idle.png`, `wave16-qa-v141-canvas.png`, `wave16-mouth-atlas-smile.png`

**Verdict:** **PARTIAL FAIL** — partition walk/clip **PASS**; mouths improved (mapping + thicker ink + larger shell) but still **not clearly readable dark smiles on ≥2 agents at default iso** (remain hairline vs eyes). Soft leftover for a later pass.

### Status snapshot
| Area | State |
|------|--------|
| Watch camera / select / separation | **PASS (Wave 13 compose)** |
| Walk blend / sit soften | Good |
| Work-watch desk life / bubbles | **PASS (Wave 14)** |
| Onboarding watch tips | Good |
| Perf / tone | Good |
| Avatar face pop | **PASS (Wave 8 + Wave 15 UV)** |
| Avatar limb silhouette | **PASS (Wave 9)** |
| Role identity (accessories / idle face) | **PASS (Wave 10)** |
| Office preview parity | **PASS (Wave 11)** |
| Walk ease + turn blend | **PASS (Wave 12)** |
| Chat composed shot | **PASS (Wave 13)** |
| Stranger-test polish | **PASS (Wave 15)** |
| Mouth weight at default iso | **PASS (Wave 17)** |
| Partition walk clearance | **PASS (Wave 16)** |

### Wave 16 root cause for mouths (diagnosed)
Mouth mesh UVs use zoom **1.45** → samples only the **center** of the smile atlas cell after ExpressionBuffer offsets. Eyes work because dots sit in cell center; banana smile ink lives near the bottom → hairline at iso.

### Wave 17 — Mouth readable at iso (DONE)
Kill mouth UV center-crop; bake resting smile; fix expression offset path; confirm ≥2 agents show clear dark smiles at default iso.

**Root causes (stacked):**
1. Wave 16 `zoom=1.45` center-crop (partial).
2. Runtime `reprojectFaceAtlasUVs` used **XZ** after glTF (face height is **+Y**) — atlas V collapsed across shell depth → hairline.
3. TSL `expressionData.zw` on storage element was a **no-op** → mouths stuck on home cell (confirmed with magenta debug atlas) while eyes `.xy` worked.
4. Ink-only mouth cells undersampled at iso vs eye sclera plates.

**Shipped:**
- Mouth UV zoom **1.0** (full cell) in Blender + no runtime XZ reproject
- Mouth mesh UVs baked into closed-smile cell **col1/row0**; ExpressionBuffer mouth offsets **relative** to that origin; shader uses `vec2(z,w)`
- Atlas: cream oval plate + thick pure-black banana/frown (eyes-style readable plate)
- Mouth shell taller **0.420×0.330**; Walk **L/R 0.140/0.150**, `POSE`, `export_apply=False`, `export_force_sampling=False`
- Cache bust `character.glb?v=156` + runtime mouth atlas load

**QA (`?v=156`, Chrome WebGPU):**
- Before: `wave17-qa-before-idle.png` (Wave 16 hairlines)
- After: `wave17-qa-after-idle.png`, `wave17-qa-after-canvas.png`, proofs `wave17-qa-v156-proof-green.png` / `wave17-qa-v156-proof-red.png`
- Dark smile span pixels: green **101**, red **63** (wide, not hairline); eyes clear, no QR

**Verdict:** **PASS** — clearly readable dark smiles on ≥2 agents (green + red; also blue/yellow when facing camera) at default workspace iso.

### Status snapshot
| Area | State |
|------|--------|
| Avatar face + mouth | **PASS (W8/15/17)** |
| Limbs / identity / desk life | **PASS** |
| Office / partitions | **PASS (W11/16)** |
| Walk / chat camera | **PASS (W12/13)** |
| Soft leftover | furniture edges still a bit white-on-white vs preview |

### Wave 18 — Furniture edge pop (DONE)
Gently separate furniture from floor at default iso without chalk or blue carpets — closer to `office-preview.jpg`.

**Changes:**
- `WorldManager`: neutral mid-grey floor `(0.52)` + grid `(0.32)`; furniture white `(0.96)` roughness `0.62`; cache `office.glb?v=160`
- `generate_office.py`: matching floor/grid/white albedos (source of truth; runtime still overrides)
- `Stage`: ambient/hemi slightly down, key up (`0.15 / 0.32 / 0.92`), tighter contact shadows (`radius 1.75`) — ACES + soft high-key kept
- Avatars untouched (`CharacterManager` still `?v=156`)

**Metrics (canvas luminance desk−floor):** Wave15 `Δ4.4` → Wave18 `Δ23.5` (preview `Δ15.2`). Chair−floor `Δ29.3`.

**Visual QA (`?v=160`):** **PASS** — desk/chair silhouettes read vs grey floor without squinting; contact shadows tighter; screens dark, plants green, thin blue border; no chalk blowout / no blue carpet. QA: `docs/assets/wave18-qa-v160-idle.png`, `wave18-qa-v160-canvas.png`, `wave18-qa-v160-desks.png`, `wave18-qa-v160-compare.png`.

| Area | State |
|------|--------|
| Avatar face + mouth | **PASS (W8/15/17)** |
| Limbs / identity / desk life | **PASS** |
| Office / partitions | **PASS (W11/16)** |
| Walk / chat camera | **PASS (W12/13)** |
| Furniture edge pop | **PASS (Wave 18)** |

### Wave 19 — Final stranger re-QA (DONE)
Re-checked `?v=160` after W18. No new P0 delight breaks vs closed bars (faces/mouths, limbs, identity, office/floor contrast, partitions, walk ease, chat compose, desk life). Soft leftovers from W15 are closed.

**Verdict:** Delight loop **stable** — ready for user judgment / commit if desired. Optional later: idle wander “busy office” density, IBL, selection highlight.

---

## Running checklist
- [x] Waves 1–18
- [x] Wave 19 stranger re-QA (stable)
