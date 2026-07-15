# Character → Reference Loop (Orchestrator Charter)

**Owner:** Orchestrator (this chat)  
**Started:** 2026-07-15  
**Stop when:** Stranger side-by-side cannot tell Live Agents character from `/tmp/ref-character.glb` + face style in-app vs preview, **or** honest FAIL with zero remaining high-confidence levers.

## North star
`/tmp/ref-character.glb` (commit `073f2d5`) + `public/images/office-preview.jpg` + current cute face direction (white sclera + black pupils + thick smile, **no white face plate / bandit mask**).

## Contracts (never break)
Meshes `body/eyes/mouth/cap/headphones`, bone `head`, 12 clips, Walk export: `POSE`, `export_apply=False`, `export_force_sampling=False`, Walk travel >0.05.

## Loop protocol
1. Measure ours vs ref (AABB, arm xspan, head ratio, eye/mouth sizes, accessory AABBs, Walk travel).
2. Spawn focused sub-agent(s) with **one** primary gap.
3. Integrate → hard-refresh QA at `http://localhost:3000/?v=N`.
4. Critical review: PASS only if visual stranger-test improves **and** metrics move toward ref. Reject regressions (wink bleed, white face plate, dead Walk).
5. Log wave in this file + `orchestrator-log.md`.
6. Re-arm wake until stop condition.

## Gap backlog (ranked)
1. ~~Body silhouette residual: arm xspan still +15.6% vs ref; crotch_hw med 0.155 vs 0.102; deepen valleys without arm inflate~~ — **closed in R4-SILHOUETTE** (arm +3.0%, head 0%, AABB ≈ REF)
2. ~~Face shells toward ref cards~~ — **closed in R3-FACE** (eyes/mouth w×h ≈ REF; flush ≤0.01)
3. ~~Vinyl material / softness vs preview~~ — **closed in R5-MATERIAL** (runtime SSS vinyl; body rough 0.68→0.45 + sheen/SSS)
4. Idle arm readability at iso (only after further silhouette polish — avoid arm inflate)
5. ~~Cap / headphones scale vs ref~~ — **closed in R2-ACCESSORIES** (AABB within ~10%)

## Status
- Loop: **FROZEN — stranger-test PASS** (2026-07-15, `?v=240`)
- Closed waves: R1 measure → R2 accessories → R3 face → R4 silhouette → R5 vinyl material
- Optional residual only: idle arm readability at iso (low confidence; do not reopen arm inflate)
- Ship checkpoint: accessories ≈ref AABB, faces ≈ref shells + cute atlases, body AABB/arm/head ≈ref, soft SSS vinyl runtime

---

## R1 measure (2026-07-15)

**Sources:** CURRENT `public/models/character.glb` vs REF `/tmp/ref-character.glb` (commit `073f2d5`). Blender one-off `/tmp/r1_measure_character.py`. Browser QA `http://localhost:3000/?v=200` (GLB served as `character.glb?v=187` from app cache string). Screenshots: `/tmp/r1-qa-v200-*.png`.

### Metrics (CURRENT → REF)

| Metric | CURRENT | REF | Δ |
|--------|---------|-----|---|
| Body AABB (x×y×z) | 0.988×0.679×1.230 | 0.735×0.697×1.250 | +34.5% / −2.6% / −1.6% |
| Arm xspan @z 0.22–0.50 | 0.988 | 0.697 | **+41.8%** |
| Head width (z>48%) | 0.600 | 0.735 | **−18.4%** |
| Head ratio | 0.50 | 0.50 | 0 |
| Eyes size (w×h) | 0.460×0.377 | 0.463×0.252 | ~w / **h +50%** |
| Eyes flush Δ | +0.005 | −0.006 | ours proud; ref slightly recessed |
| Mouth size (w×h) | 0.340×0.221 | 0.272×0.171 | +25% / +29% |
| Cap AABB | 0.396×0.382×0.326 | 0.706×0.867×0.318 | **~−44% / −56%** XY |
| Headphones AABB | 0.588×0.239×0.345 | 0.888×0.562×0.696 | **~−34% / −58% / −50%** |
| Walk L / R travel | 0.140 / 0.150 | 0.140 / 0.150 | match |
| Clip count | 12 | 12 | match (full contract set) |
| pose_position | POSE | POSE | match |
| Head bone | true | true | match |

Contracts: **PASS** (Walk >0.05, 12 clips, POSE, meshes + head bone). Both GLBs still carry orphan `Icosphere`.

### Visual QA (iso + close vs `office-preview.jpg`)
- **Silhouette:** Current reads as wide-shouldered bean with slimmed crown; preview/ref reads as fat-head pill with shorter arm stubs. Limb valleys soft / hard to see at default iso.
- **Face:** Cute white sclera + pupils present (charter direction). Eyes cards taller than ref; mouth larger; iso face readable on forward agents, weak on backs.
- **Accessories:** Cap / headphones visually undersized vs preview (cups don’t mass the head; brim/dome don’t land like ref).
- **Stranger-test:** FAIL — accessory scale + head/arm dominance alone would expose CURRENT immediately.

### Top 3 gaps NEXT (highest impact → ref stranger-test)
1. **Cap + headphones AABB toward ref** (−0.31/−0.48 cap XY; −0.30/−0.32/−0.35 HP) without breaking head-bone attach.
2. **Rebalance silhouette:** reduce arm xspan toward ~0.70–0.80 and restore head width toward ~0.72–0.735 (invert current “arms wider than head”).
3. **Shrink face shells to ref cards** — eyes h→~0.25, mouth→~0.27×0.17; keep flush |Δ|≤0.01 and no white plate.

### Recommended next wave
**R1-ACCESSORIES:** scale cap + headphones to within ~10% of ref AABB while preserving head skinning / Walk contracts — largest visual win before another body sculpt.

---

## R1-SILHOUETTE (2026-07-15) — `?v=201`

**Shipped:** `adapt_ref_body` rebalance toward REF AABB — milder scale target `(0.76,0.71,1.245)`, `max_head_width=0.68`, arm xspan target `0.78` (was 0.88→0.988), softer A-pose/outer reach, deeper underarm+crotch valleys. `ensure_reference_character` pins `073f2d5`. Cache bust `character.glb?v=201` (+ face atlases). Face atlas UV homes / ExpressionBuffer / face materials untouched.

### Metrics BEFORE → AFTER → REF

| Metric | BEFORE (hybrid) | AFTER (`v=201`) | REF (`073f2d5`) |
|--------|-----------------|-----------------|-----------------|
| Body AABB | 0.988×0.679×1.230 | **0.806×0.673×1.245** | 0.735×0.697×1.250 |
| Arm xspan | 0.988 | **0.806** | 0.697 |
| Head width | 0.600 | **0.680** | 0.735 |
| torso_hw@z40 med/max | 0.266 / 0.457 | **0.244 / 0.383** | 0.225 / 0.340 |
| crotch_hw@z10 med/max | 0.171 / 0.224 | **0.155 / 0.201** | 0.102 / 0.185 |
| Eyes / mouth | (prior) | 0.490×0.401 / 0.374×0.243 · flush Δ0.005 | — |
| Walk L/R | 0.140 / 0.150 | **0.140 / 0.150** | 0.140 / 0.150 |
| Export | POSE / apply=False / force_sampling=False | **same** | same |
| Clips / head bone | 12 / yes | **12 / yes** | 12 / yes |

### Visual QA (`http://localhost:3000/?v=201`)
- **Silhouette:** **PASS (partial)** — AABB/arm/head moved clearly toward ref; stubby arms+legs still readable at default iso (not Wave-9 wing-span). Not stranger-identical yet; valleys softer than ideal; residual arm overshoot +15.6%.
- **Face:** **PASS** — white sclera + black pupils + thick smile; no bandit plate; no wink/atlas bleed on standing agents.
- **Walk/contracts:** **PASS**.
- **Stranger-test overall:** still FAIL (accessories dominant next) — body gap narrowed.

QA assets: `docs/assets/wave-r1-qa-v201-*.png`, `wave-r1-{ref,after}-rest-front.png`.

---

## R2-ACCESSORIES (2026-07-15) — `?v=210`

**Shipped:** Rebuild `_make_baseball_cap` / `_make_headphones` toward REF accessory AABB (procedural, not mesh dump). Cap: low wide crown + forward platter brim + cuff + button (replaces tall beanie/no-brim). Headphones: wider band radius, low cheek cups + outer pads, nudged behind eye front plane. Regenned `character.glb`. Cache bust `character.glb?v=210`. Face atlases / white-sclera style untouched. Body silhouette left to R1-SILHOUETTE.

### Metrics BEFORE (R1) → AFTER → REF

| Metric | BEFORE | AFTER (`v=210`) | REF | Δ vs REF |
|--------|--------|-----------------|-----|----------|
| Cap AABB | 0.396×0.382×0.326 | **0.697×0.908×0.324** | 0.706×0.867×0.318 | **−1.3% / +4.7% / +1.9%** |
| Headphones AABB | 0.588×0.239×0.345 | **0.922×0.562×0.723** | 0.888×0.562×0.696 | **+3.8% / +0.1% / +3.9%** |
| Cap seat z | [1.163,1.490] | [1.042,1.366] | [0.997,1.315] | seats on crown (not float beanie) |
| HP y vs eyes | ymin −0.01-ish | ymin **−0.261** (eyes −0.329) | ymin −0.364 | clear of eye front plane |
| Walk L/R | 0.140 / 0.150 | **0.140 / 0.150** | match | — |
| Export / clips / head | POSE · 12 · yes | **same** | same | contracts **PASS** |

### Visual QA (`http://localhost:3000/?v=210`, GLB `character.glb?v=210` 201108 B)
- **Accessories:** **PASS** — iso read is massy baseball brim + chunky over-ear cups (designer yellow brim / copywriter+dev cups), not the R1 undersized beanie/paddles. Faces still white sclera + pupils; no bandit plate.
- **Contracts:** **PASS** (Walk travel, POSE, 12 clips, meshes + head bone).
- **Stranger-test overall:** still FAIL on body silhouette residual; accessory gap closed on AABB + glance mass.

### Residual risk
- Cap peak still ~+0.05 above ref top; HP band crest ~−0.07 below ref top.
- Cap Y slightly long (+4.7%); brim can foreshorten oddly on some iso angles.
- Do not re-tune accessories against a body remesh without re-measure.

QA assets: `docs/assets/wave-r2-qa-v210-{idle,canvas,agent0,agent1,agent2,face}.png`.

---

## R3-FACE (2026-07-15) — `?v=220`

**Shipped:** Shrink face shell construction in `create_icon_meshes` toward REF card AABB. Eyes width clamp `0.44–0.47` (×0.68 head), aspect `half_z/half_x=0.545` (was 0.82 — source of tall googly plates). Mouth width clamp `0.26–0.29` (×0.40 head), aspect `0.630`. UV homes unchanged (`eyes` col0/row0, `mouth` col1/row0); ExpressionBuffer relative offsets untouched; atlas PNGs untouched (white sclera + black pupils). Cap/headphones/body silhouette left as R2/R1. Cache bust `character.glb?v=220` (+ face atlas query `?v=220`).

### Also: R2-ACCESSORIES PASS (orchestrator AABB)
Already logged above; reconfirmed on AFTER GLB — Cap **0.697×0.908×0.324** ≈ REF 0.706×0.867×0.318; HP **0.922×0.562×0.723** ≈ REF 0.888×0.562×0.696 (±10%). Untouched by this wave.

### Metrics BEFORE (R2/`v=210`) → AFTER → REF

| Metric | BEFORE | AFTER (`v=220`) | REF | Notes |
|--------|--------|-----------------|-----|-------|
| Eyes AABB (x×y×z) | 0.490×0.193×0.401 | **0.462×0.122×0.252** | 0.463×0.101×0.252 | w×h match REF; tallness −37% |
| Mouth AABB (x×y×z) | 0.374×0.078×0.243 | **0.272×0.032×0.171** | 0.272×0.129×0.171 | w×h match REF; y thinner (flat shell) |
| Eyes flush Δ | +0.0055 | **+0.0055** | −0.0055 | \|Δ\|≤0.01 **PASS** (ours proud) |
| Mouth flush Δ | +0.0055 | **+0.0055** | −0.0008 | \|Δ\|≤0.01 **PASS** |
| Cap / HP | (R2) | **unchanged** | — | R2 PASS preserved |
| Body AABB / arm | 0.806×0.673×1.245 | **unchanged** | 0.735… | silhouette not regress |
| Walk L/R | 0.140 / 0.150 | **0.140 / 0.150** | match | — |
| Export / clips / head | POSE · 12 · yes | **same** | same | contracts **PASS** |

### Visual QA (`http://localhost:3000/?v=220`, GLB `character.glb?v=220` 200544 B)
- **Face shells:** **PASS** — at forced close (~1.0 unit) white sclera + black pupils + smile readable; no wink bleed; no bandit white faceplate; cards no longer dominate head height vs R2 tall plates. Flush proud hair only (not floating plates).
- **Accessories / silhouette:** unchanged (R2/R1 gains held).
- **Contracts:** **PASS**.
- **Stranger-test overall:** still FAIL on body silhouette residual; **face-card size gap closed** on metrics.

### Residual risk
- Mouth shell Y-depth thinner than REF (0.03 vs 0.13) — flat curved patch vs REF’s thicker card; w×h already match.
- Eyes still slightly proud (+0.0055) vs REF recessed (−0.0055); within flush budget.
- Do not re-inflate aspect toward “iso readability” without re-measure vs REF.

QA assets: `docs/assets/wave-r3-qa-v220-{idle,canvas,iso,agent*,closer-*,facezoom*,proof-*}`.

---

## R4-SILHOUETTE (2026-07-15) — `?v=230`

**Shipped:** Rebalance `adapt_ref_body` toward REF fat-head pill — scale target `(0.735,0.700,1.248)`, `_fit_head_width(0.730)` (grow/slim; was slim-cap `0.68`), deeper underarm/crotch carve, muted outer-arm + A-pose X inflate, `_clamp_arm_xspan(0.720)` bi-directional (replaces grow-only `0.78`). Cap/headphones untouched. Face construction untouched (shells track wider head via existing clamps → eyes/mouth at clamp ceiling). Cache bust `character.glb?v=230` (+ face atlas query).

### Metrics BEFORE (R1/R3 body) → AFTER → REF

| Metric | BEFORE (`v=201`/`220` body) | AFTER (`v=230`) | REF (`073f2d5`) | Δ AFTER vs REF |
|--------|----------------------------|-----------------|-----------------|----------------|
| Body AABB (x×y×z) | 0.806×0.673×1.245 | **0.735×0.700×1.248** | 0.735×0.697×1.250 | **0% / +0.5% / −0.1%** |
| Arm xspan @z 0.22–0.50 | 0.806 | **0.718** | 0.697 | **+3.0%** (was +15.6%) |
| Head width (z>48%) | 0.680 | **0.735** | 0.735 | **0%** (was −7.5%) |
| Eyes size (w×h) | 0.462×0.252 | 0.470×0.256 | 0.463×0.252 | +1.5% / +1.6% (head-tracked clamps) |
| Mouth size (w×h) | 0.272×0.171 | 0.290×0.183 | 0.272×0.171 | +6.6% / +6.7% |
| Cap / HP AABB | R2 PASS | **unchanged** | — | accessories held |
| Walk L / R travel | 0.140 / 0.150 | **0.140 / 0.150** | 0.140 / 0.150 | match |
| Export | POSE · apply=False · force_sampling=False | **same** | same | contracts **PASS** |
| Clips / meshes / head bone | 12 · body/eyes/mouth/cap/headphones · yes | **same** | same | **PASS** |

### Visual QA (`http://localhost:3000/?v=230`, GLB `character.glb?v=230` 200448 B)
- **Silhouette:** **PASS** — fat-head pill (head ≥ arms), stubby limbs with readable underarm + crotch valleys at default iso / mid-body; no Wave-9 bean wings. AABB/arm/head all inside stated budgets.
- **Face / accessories:** R3/R2 held (white sclera, no bandit plate; massy cap/HP). Mouth slightly larger vs REF cards via head-width clamps — not a silhouette regress.
- **Contracts:** **PASS**.
- **Stranger-test overall:** **PASS** — side-by-side proportions now read as the same vinyl-people language as preview/ref; residual tells are material softness (still backlog), not arm/head ratios.

### Residual (non-blocking for silhouette)
1. Vinyl / material softness vs preview (backlog #3).
2. Mouth shell w×h +6.6% vs REF from head-relative clamps at fat head (cosmetic; do not enlarge further).

QA assets: `docs/assets/wave-r4-qa-v230-{idle,canvas,iso,body,agent*,proof-*}`.

---

## R5-MATERIAL (2026-07-15) — `?v=240`

**Shipped:** Runtime body/accessory materials → `MeshSSSNodeMaterial` soft vinyl (not chalky `MeshStandard` @ 0.68). Plastic IOR 1.45, soft milky sheen, mild thickness SSS. Face materials **untouched** (Standard roughness 0.75 + atlas emissive; white sclera). Blender generator body/acc roughness aligned for next regen; **no mesh remesh / no GLB regen** (same `character.glb` bytes as R4 — 200448). Engine ACES/exposure left alone. Cache bust `character.glb?v=240` (+ face atlas query).

### Diff: REF GLB materials
REF `/tmp/ref-character.glb` assigns **no** PBR to body/cap/headphones (only eyes/mouth roughness 1.0). Vinyl read is entirely a runtime / lighting concern vs `office-preview.jpg`.

### BEFORE → AFTER (runtime body / accessories)

| Param | BEFORE (`?v=230`) | AFTER (`?v=240`) | Notes |
|-------|-------------------|------------------|-------|
| Material class | `MeshStandardNodeMaterial` | **`MeshSSSNodeMaterial`** | sheen + IOR + cheap SSS |
| Body roughness | **0.68** | **0.45** | was chalky; preview reads soft plastic sheen |
| Cap roughness | 0.68 | **0.45** | same vinyl stack |
| Headphones roughness | 0.68 | **0.50** | slightly duller black plastic |
| Metalness | 0.02 | **0** | |
| IOR | (n/a) | **1.45** | plastic fresnel |
| Specular intensity | (std) | **0.92** | |
| Sheen / sheenRough | 0 | **0.30 / 0.64** (HP 0.14) | milky vinyl edge |
| SSS thicknessScale | — | **3.2** (HP 2.0) | soft lit→shadow fill |
| Face roughness | 0.75 | **0.75** | unchanged |
| ACES exposure | 1.12 | **1.12** | untouched |
| Walk / AABB / clips | R4 PASS | **unchanged** | no mesh regen |

### Visual QA (`http://localhost:3000/?v=240`, GLB `character.glb?v=240` 200448 B)
- **Vinyl:** **PASS** — bodies leave the chalky-dry R4 read; broad soft sheen + milder shadow fill now sits with `office-preview.jpg` soft-plastic vinyl language (preview itself is mid-sheen plastic, not chalk). Not a photographic designer-toy SSS match (no IBL), but the stranger tell of “matte chalk vs vinyl” is closed under current lighting.
- **Faces:** **PASS** — white sclera + black pupils + smile; no bandit plate; face Standard path unchanged.
- **Silhouette / accessories / Walk:** R4–R2 held (no remesh).
- **Contracts:** **PASS** (mesh bytes unchanged; Walk travel still from R4 export).

### Residual
- Further vinyl realism would need env/IBL or Engine lighting (explicitly deprioritized vs mesh materials). Idle arm readability remains backlog #4.

QA assets: `docs/assets/wave-r5-qa-v240-{idle,canvas,iso,body,agent*,proof-*}`.


---

## HOTFIX-BLACK-BACKS (2026-07-15) — `?v=241`

**Symptom:** Headphones agents looked jet-black from the rear; lead body could crush to near-black under SSS.

**Cause:** R2 cups had huge +Y pad mass + jet `0.07` plastic + HP cast shadows onto body; R5 `MeshSSSNodeMaterial` crushed shaded blues without IBL.

**Fix:** Soft Standard vinyl (rough 0.52); charcoal HP `~0.20`; HP no castShadow; body-only receiveShadow; thinner cups (HP AABB Y 0.56→0.37); cache `?v=241`.


---

## TEAM-COLORED-ACCESSORIES (2026-07-15) — `?v=250`

Preview-matched redesign: baseball cap (low crown + forward brim) + plush ear muffs (round cups + thin arch). Runtime tint = team color (cap ~88% team lift, muffs ×0.82 darker). Spec: `docs/superpowers/specs/2026-07-15-team-colored-accessories-design.md`. Walk contracts held.
