# Wave 3 — Final polish to done criteria

Spec done criteria in `docs/superpowers/specs/2026-07-21-3d-office-polish-design.md` Wave 3 section.

## Task W3-Office: Desk clutter + zone life

**Own:** `scripts/blender/generate_office.py`, regenerate `public/models/office.glb` only via `blender -b --python scripts/blender/generate_office.py`, `WorldManager.ts` only if new mesh name hints needed, art-direction office clutter note.

**Do:**
1. Add small joined desk clutter per work desk: keyboard slab, mouse, 1–2 paper stacks or notepad, maybe a mug — keep vinyl/command-center low-poly, join into desk piece or separate `static-*` names that WorldManager already handles (paper/pot hints exist)
2. Do NOT change POI positions or floor plan / navmesh walkability in a breaking way — clutter must stay on desktop tops, not block paths
3. Optional: one extra plant or bookshelf detail if cheap
4. Regenerate office.glb; bump office.glb cache query if WorldManager/Scene loads with ?v=

**Do NOT** touch character.glb or generate_character.py. Do NOT commit.

## Task W3-Identity: Stable accessory assignment

**Own:** `src/data/agents.ts` (set `accessory` on Creative Agency + other teams' specialists for stable unique IDs), optionally art-direction. Do NOT regenerate GLB unless something broken.

Assign Creative Agency specialists distinct accessories e.g. Developer=1 headphones, Designer=4 glasses, Copywriter=3 beanie (or similar readable mapping). Other teams: unique cycle via explicit accessory fields where ≤4 specialists.

Lead never gets accessory override (CharacterManager forces 2). User never.

## Task W3-Interaction: Final UX pass

**Own:** SelectionRing/SceneManager/constants interaction only.

1. Ensure hover ring doesn't show during chat
2. Ensure player ring + selection ring never double-draw oddly
3. If chat camera still feels stiff, tiny damp constant tweak only
4. Verify dispose/reset clears all three rings

## Task W3-Motion: Final skate/corridor pass

**Own:** constants motion keys + NpcAgentDriver only if needed.

1. If cruise variance + turn factor still leave skate risk, tiny retune (document values)
2. Ensure wander prefers free area POIs that aren't overcrowded (if getFreePois already filters, use it more aggressively)

## Verify
Each agent: npm run lint. Orchestrator runs full npm run check at end.

Do NOT commit.
