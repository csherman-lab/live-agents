# Live Agents — 3D Asset Technical Spec

## Files

| File | Description |
|------|-------------|
| `public/models/office.glb` | Environment, nav mesh, POI empties |
| `public/models/character.glb` | Rigged agent, accessories, animations |
| `public/models/textures/*.png` | Source atlases (also embedded in character GLB) |

## Office contract

### Nav mesh

- One mesh whose **name contains** `navmesh` (case-insensitive)
- Loaded by `NavMeshManager` and hidden at runtime

### Theme meshes

- Meshes whose names **start with** `colored` receive team color tint in `WorldManager.updateThemeColor`

### Points of interest (POIs)

Empty objects named:

```
poi-<arrivalState>-<uniqueId>
```

| Prefix / state | Maps to |
|----------------|---------|
| `poi-spawn-*` | Spawn → `idle` |
| `poi-area-*` / `poi-idle-area-*` | Wander zones → `idle` |
| `poi-sit_idle-*` | Seated idle |
| `poi-sit_work-*` | Seated working |

Loaded by `PoiManager.loadFromGlb`.

### Required POI names (current layout)

- `poi-idle-area-boardroom`, `canteen`, `hub`, `workspace`
- `poi-idle-spawn-1` … `poi-idle-spawn-5`
- `poi-sit_idle-1` … `poi-sit_idle-4`
- `poi-sit_work-1` … `poi-sit_work-5`

## Character contract

### Meshes

| Name | Skinned | Notes |
|------|---------|-------|
| `body` | Yes | Main torso/limbs |
| `eyes` | Yes | UV atlas `eyes-atlas-color` (1024²) |
| `mouth` | Yes | UV atlas `mouth-atlas-color` (512×1024) |
| `cap` | No | Visible when `accessoryType == 2` |
| `headphones` | No | Visible when `accessoryType == 1` |

### Skeleton

Must include a bone named `head` (used for accessory attachment and look-at).

### Animations

Clip names must match `AnimationName` in `src/types.ts`:

`Idle`, `Walk`, `Talk`, `Listen`, `Sit`, `Sit_Idle`, `Sit_Work`, `LookAround`, `Happy`, `Sad`, `Pick`, `Wave`

### Expression atlas layout

2 columns × 4 rows per atlas. See `ExpressionBuffer` / `EXPRESSIONS` in `src/simulation/behavior/ExpressionBuffer.ts`.

## Regeneration

```bash
npm run assets:generate
```

Runs `scripts/blender/generate_all.py` headless via Blender CLI.
