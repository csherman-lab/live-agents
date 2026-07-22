# Live Agents — 3D Art Direction

## Visual identity

Live Agents uses a **clean command-center** aesthetic aligned with the app UI:

- Soft neutral palette (warm whites, cool grays, slate glass)
- Apple-blue accent strips that inherit the active team color at runtime
- Rounded, friendly agent silhouettes — approachable, not cartoonish
- Low visual noise: readable at a glance in overview preview and full simulation

## Office (`office.glb`)

**Concept:** White open-plan workspace matching the reference — grey grid floor, thin blue accent border, all-white furniture. Desks with monitors/flexo lamps, ergonomic chairs, lounge sofa, cafe table, counter, presentation board, bookshelf, plants.

**Desk clutter:** Each work desk (`static-work-desk.*`) joins its own keyboard, mouse, notepad, a
second small paper stack, a two-book pile, and a mug + handle into one export mesh — no extra draw
calls per desk. Wave 3 sized the keyboard/mouse/notepad up (~15-20%) so they read as distinct
silhouettes at iso instead of disappearing into the desk-white slab, and switched the mug to the
`accent` material slot so `WorldManager` recolors it with the active team tint (a small pop of color
against the all-white desk) instead of leaving it flat white. The cafe table and counter each carry a
matching light prop (cafe cup + napkin; counter pad switched to paper) for the same reason — quiet
desktop/tabletop life without touching POI positions or the navmesh.

| Zone | Purpose |
|------|---------|
| East cluster | Four work desks with monitors, keyboards, desk lamps |
| North-west lounge | Sofas + cafe table for `sit_idle` |
| West counter | Laptop bar for async work |
| South-east board | Presentation screen |
| Hub / spawn zones | Open floor with thin colored border (team tint at runtime) |

**Runtime accents:** Meshes prefixed `colored-` receive the team theme color in `WorldManager`.

**Materials & lighting:** Furniture reads as warm off-white rather than clinical white, and
`WorldManager` splits the GLB's shared "white" slot by mesh name so pieces aren't a single flat
material. Roughness/warmth steps up zone by zone: desks stay cooler/smoother (laminate); work-cluster
chairs (`static-work-chair`) are warmer/softer (ergonomic shell); the lounge armchairs (`static-chair`,
distinct from `static-work-chair`) step warmer and softer again; the lounge sofa/cafe-table lean
warmest and softest of all — so the lounge reads cozier than the work cluster at a glance, and the
armchairs read as their own piece rather than desk chairs relocated. Screens carry a slightly
stronger blue-white emissive glow so monitors read as "on", plus a gentle global sine pulse on that
emissive intensity (`WorldManager.update`, driven once per frame from `SceneManager`) so the whole
office feels quietly alive rather than static; flexo lamp heads/bulbs boost their GLB emissive
warmth (bulb brighter than head) rather than being clamped to one flat brightness. `colored-*` hub
accents carry a slight matching emissive on top of the team-tint color so the border reads as a lit
accent strip rather than flat paint, and re-theming keeps that glow in sync. The five office plants
alternate between two foliage green variants (leaf + stem/soil) keyed off their instance number so
the planted row isn't monochrome. Floor stays neutral mid-grey with a darker grid line so
white/warm furniture edges still pop. `Stage` keeps the soft high-key three-light rig (ambient +
hemisphere + warm directional) but with a tighter, lower-bias contact shadow so feet and desk legs
ground into the floor without hardening into a harsh-contrast look.

## Character (`character.glb`)

**Concept:** Vinyl-toy worker — large bulbous head, stout rounded body, stubby limbs, reference-sized face cards.

- Body proportions matched to reference AABB (~0.81 × 0.78 × 1.23)
- Expression atlases from reference style on `eyes` / `mouth` planes (2×4 grid)
- Accessories (one per agent, no stacking): `cap` (team lead, always) plus a unique pick per specialist slot from `headphones` / `beanie` / `glasses` / `lanyard` / `backpack` / `scarf` (IDs 1/3/4/5/6/7; cycles deterministically, or an explicit `AgentNode.accessory` override clamped to this set) — **team-colored** like the body:
  - `cap`, `beanie`, `scarf` — soft lift tint (headwear/garment family)
  - `headphones`, `lanyard`, `backpack` — slightly darker tint (plush muffs / chest badge / worn-gear family)
  - `glasses` — near-white frames with only a subtle team tint
  - `lanyard` and `backpack` pin to the `spine` bone (avoids swinging on head look-arounds); `scarf` pins to `head` (rig has no separate neck bone) alongside `cap`/`beanie`/`glasses`
  - User stays accessory-free (`0`)
  - Every specialist across `AGENTIC_SETS` (`src/data/agents.ts`) now sets an explicit, role-fitting `accessory` (e.g. Developer=headphones, Designer=glasses, Copywriter=beanie) instead of relying on slot-order cycling, for stable identity across sessions
- Twelve GLB clips from the shared rig (Idle, Walk, Sit, etc.); runtime also reverse-bakes Sit into a Stand clip for continuous chair get-ups
- Ambient in-sim nameplates (dark HUD pills) sit just above heads; focused agent uses the larger bubble instead

## Differentiation

These assets are **procedurally authored for Live Agents** in `scripts/blender/`. They are not derived from third-party office packs and are MIT-licensed with the rest of the project.
