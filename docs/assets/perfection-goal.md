# Live Agents 3D — Perfection Goal

**North star:** Side-by-side with `public/images/office-preview.jpg` and `/tmp/ref-character.glb` + `/tmp/ref-office.glb`, a stranger should not immediately tell which is the original.

## Quality bar (must all pass)

### Workers
1. Continuous vinyl-toy body with **readable stubby arms + legs** (not a featureless blob)
2. Large head; soft matte finish; solid team color tint
3. **Visible faces** from isometric camera: white eyes + pupils + mouth (reference atlases)
4. Cap / headphones correctly attached to head during Idle + Walk
5. Walk deformation soft and local (no exploding mesh / sliding limbs)
6. Body AABB ≈ reference `(0.81 × 0.78 × 1.23)`

### Office
1. All-white matte furniture on light grey grid floor + thin blue border only
2. Dense desks: iMac-like monitors, lamps, keyboards, chairs with 5-star bases
3. Lounge sofa, cafe table, counter, board, bookshelf, **leafy plants**
4. No blue “holes” / giant colored carpets on the floor
5. Navmesh holes around furniture — agents path around desks

### Motion
1. Walk speed feels deliberate (not skating)
2. No phasing through desks/dividers on normal paths
3. Sit POIs still reachable (path to nearby nav point, teleport into seat)

## Contracts (do not break)
- Meshes: `body`, `eyes`, `mouth`, `cap`, `headphones`
- Bone: `head`
- Anims: Idle, Walk, Talk, Listen, Sit, Sit_Idle, Sit_Work, LookAround, Happy, Sad, Pick, Wave
- Office: mesh name contains `navmesh`; `colored-*` for theme tint; POIs from `reference_data.py`
- Regenerate: `blender -b --python scripts/blender/generate_all.py` or per-script

## Workstreams
| ID | Owner files | Focus |
|----|-------------|-------|
| A | `scripts/blender/generate_character.py` | Silhouette, faces, accessories, weights |
| B | `scripts/blender/generate_office.py`, `navmesh.py` | Furniture density & white aesthetic |
| C | `src/simulation/constants.ts`, motion/render polish | Speed, materials, bubble offsets |

## Done when
Visual QA at `http://localhost:3000` (hard-refresh) matches the quality bar above, and both GLBs regenerate cleanly.

---

## Round 2 — Iteration goal (2026-07-13 QA)

**Evidence:** Live scene at `?v=20` vs `office-preview.jpg` — furniture nearly invisible (white-on-white blowout); characters read as soft blobs; floor grid / desk edges / chair bases must pop like the reference.

### Must fix this round
1. **Furniture readable at a glance** — desks, monitors, chairs, sofa visible without squinting (shadow + slight value separation from floor, not blue carpets)
2. **Floor grid readable** — light grey grid like preview, not blown-out white void
3. **Character limbs readable** in isometric — stubby arms/legs separate from torso silhouette
4. **Headphones / eyes** closer to reference scale (eyes slightly smaller; cups thicker)
5. **No stray floating meshes** (Icosphere / orphan geometry)
6. **Lighting** — lower ambient fill so directional shadows define form; keep soft high-key, not chalk flat

### Agent lanes
| ID | Files | Mission |
|----|-------|---------|
| A | `generate_character.py` only | Limb separation, eye/HP scale, strip custom bone shapes / orphans |
| B | `generate_office.py`, `navmesh.py` | Desk/chair silhouette density; floor slightly darker than furniture; plants greener/more volume |
| C | `Stage.ts`, `WorldManager.ts`, `CharacterManager.ts`, `constants.ts` | Cut ambient blowout; stronger soft shadows; furniture/floor material split |

### Round 2 outcome
- A: Body AABB hit `(0.81×0.78×1.23)`; eyes `0.46×0.25`; HP near ref; no Icosphere in GLB
- B: Floor `(0.78)` vs white `(0.97)`; thicker desks/chairs; greener plants; office.glb OK
- C: Ambient `0.22π`, key `0.78π`; material split — **integrate fix:** floor/grid now keep GLB colors (runtime no longer overrides B’s floor)

### Round 3 — still open (from live QA `?v=22`)
1. Limbs still soft from default iso camera — need deeper arm/leg valleys or slight pose rest offset so stubs read at distance
2. Mouths hard to see at workspace zoom — ensure mouth card size/offset/renderOrder wins
3. Blue border may read thick vs preview — thin the ring slightly
4. Walk feel spot-check after silhouette change

### Round 3 outcome
- A: deeper valleys (threshold 0.775), mouth 0.32×0.20 farther forward; AABB held
- B: border `0.07 → 0.035`
- C: face renderOrder 10, polygonOffset −8, binary alpha + emissive lift

---

## Round 4 — Match reference GLBs (measured 2026-07-13)

**North star this round:** Close measured deltas vs `/tmp/ref-character.glb` + `/tmp/ref-office.glb` and `office-preview.jpg`. Not “more detail” — **same silhouette language**.

### Measured gaps (ours → ref)

| Part | Ours | Ref | Action |
|------|------|-----|--------|
| Body AABB | 0.81×0.78×1.23 | **0.735×0.697×1.25** | Slim toward ref; keep limb notches |
| Eyes front Y | −0.410 | **−0.324** | Pull faces back onto head surface |
| Mouth size | 0.32×0.20 | **0.27×0.17** | Shrink toward ref |
| Cap | 0.66×0.79×0.28 | **0.71×0.87×0.32** | Slightly larger/softer dome |
| Office meshes | 361 | **30** | Too fragmented — merge/simplify chair/plant parts for clean iso read |
| Ref border | 1 mesh | we have 4 thin edges | OK if thin; keep preview look |

### Must pass
1. Body AABB within ~5% of ref on X/Y; Z ≈ 1.23–1.25; feet z≈0
2. Eyes/mouth sit on head (front Y within ~0.05 of head front, not floating)
3. Mouth ≈ ref 0.27×0.17; eyes ≈ 0.46×0.25
4. Office reads like preview: white furniture, grey floor, thin blue edge — fewer micro-parts, stronger whole-object silhouettes
5. Walk speed synced to Walk clip (no skate)
6. Contracts intact

### Agent lanes
| ID | Files | Mission |
|----|-------|---------|
| A | `generate_character.py` | Slim body to ref; pull faces onto head; mouth/cap to ref sizes |
| B | `generate_office.py`, `navmesh.py` | Simplify furniture into fewer solid pieces; match preview cleanliness |
| C | `constants.ts`, `CharacterController.ts`, `Stage.ts` | Walk sync + default camera framing like preview |

### Round 4 outcome
- A: Body AABB **exact ref** 0.735×0.697×1.25; faces on head; mouth 0.27×0.17
- B: Office **361 → 36** meshes (ref 30); single `colored-border`; nav OK
- C: Preview-like camera; crawl speeds — **found Walk clip dead** (0 bone travel vs ref ~0.15)

### Round 5 — Restore Walk (critical)
Root cause: character export with `export_apply=True` zeroes animation. Fix export + retarget move speed once keys return.

### Round 5 outcome
- Walk leg travel matches ref exactly (0.115 / 0.158); `export_force_sampling=False` + `pose_position=POSE`
- Move speed retargeted to `0.0050 × 1.18`

---

## Round 6 — Prop parity + multi-material + stranger test

**North star:** Side-by-side with `office-preview.jpg` / ref GLBs, strangers pick ours as the original.

### Measured gaps
1. **WorldManager flattens multi-material meshes** — PCs have slots `white/screen/metal`, plants `pot/plant/leaf`, but runtime replaces each mesh with ONE material by name → dark screens & green leaves wash to white furniture
2. **Office layout bugs:** `colored-border` center `(0, 4.98)` (should be ~0); `static-floor-grid` offset `(-3.75,0)`; cabinet dims swapped vs ref `(0.56×2.1` vs ref `2.27×0.52)` — likely 90° rotation
3. **Prop language:** Ref PCs are chunky `(0.62×0.66×0.45)`; ours are flat iMac slabs. Sofa/board proportions drift from ref
4. **Character:** AABB matches; push Idle limb read + weight smoothness under Walk without breaking export

### Must pass
1. Screens dark/emissive; plant leaves green at runtime
2. Border + floor grid centered on origin like ref
3. Cabinet/sofa/PC/board dimensions within ~15% of ref
4. Desk/chair/POI XY positions stay on `reference_data` / ref coords
5. Walk still non-zero after any character regen
6. Contracts intact

### Agent lanes
| ID | Files | Mission |
|----|-------|---------|
| A | `generate_character.py` | Idle limb notches + weight polish; never break Walk export |
| B | `generate_office.py`, `navmesh.py` | Center border/grid; fix cabinet; prop dims toward ref |
| C | `WorldManager.ts` (+ tiny Stage if needed) | Preserve multi-material slots for office meshes |

### Round 6 outcome
- A: Deeper Idle notches; Walk travel still matches ref; AABB held
- B: Border/grid centered; cabinet/PC/sofa/board within ~15% of ref
- C: Per-slot NodeMaterials — screens/leaves no longer flatten to white

## Round 7 — Cute vinyl people (user: option A)

**Direction:** Keep atlas eyes/mouth; chibi proportions (bigger head, stubby limbs); smaller centered faces; soft matte vinyl; proportional cap/HP. Not food mascots.

**Runtime:** Faces forced to head bone skinning (fixes floating eyes).

### Round 7 outcome
- Chibi AABB ~0.72×0.66×1.20, head ~55% height, soft dome cap
- Eyes ~0.31×0.16, mouth ~0.22×0.13, snug on head; Walk intact
- Soft matte vinyl (roughness 0.68); CHARACTER_Y_OFFSET 1.10

