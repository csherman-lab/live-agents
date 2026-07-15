# Live Agents — 3D Art Direction

## Visual identity

Live Agents uses a **clean command-center** aesthetic aligned with the app UI:

- Soft neutral palette (warm whites, cool grays, slate glass)
- Apple-blue accent strips that inherit the active team color at runtime
- Rounded, friendly agent silhouettes — approachable, not cartoonish
- Low visual noise: readable at a glance in overview preview and full simulation

## Office (`office.glb`)

**Concept:** White open-plan workspace matching the reference — grey grid floor, thin blue accent border, all-white furniture. Desks with monitors/flexo lamps, ergonomic chairs, lounge sofa, cafe table, counter, presentation board, bookshelf, plants.

| Zone | Purpose |
|------|---------|
| East cluster | Four work desks with monitors, keyboards, desk lamps |
| North-west lounge | Sofas + cafe table for `sit_idle` |
| West counter | Laptop bar for async work |
| South-east board | Presentation screen |
| Hub / spawn zones | Open floor with thin colored border (team tint at runtime) |

**Runtime accents:** Meshes prefixed `colored-` receive the team theme color in `WorldManager`.

## Character (`character.glb`)

**Concept:** Vinyl-toy worker — large bulbous head, stout rounded body, stubby limbs, reference-sized face cards.

- Body proportions matched to reference AABB (~0.81 × 0.78 × 1.23)
- Expression atlases from reference style on `eyes` / `mouth` planes (2×4 grid)
- Accessories: `cap` (team lead), `headphones` (specialists) — **team-colored** like the body (soft lift on cap, slightly darker muffs), matching `office-preview.jpg`
- Twelve animation clips from the shared rig (Idle, Walk, etc.)

## Differentiation

These assets are **procedurally authored for Live Agents** in `scripts/blender/`. They are not derived from third-party office packs and are MIT-licensed with the rest of the project.
