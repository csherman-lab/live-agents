# Team-colored accessories design

**Date:** 2026-07-15  
**Status:** Approved (user chose preview-matched tint; approach B)

## Goal

Cap and ear muffs read like `office-preview.jpg`: same family as body hue, distinct silhouette pieces, not cream-hat / jet-muff.

## Geometry

### Cap (accessoryType 2 — lead)
- Low vinyl crown seated on head (not tall beanie puff)
- Clear forward baseball brim
- Short cuff under crown; tiny crown button OK
- Seats on crown; brim clears eyes

### Ear muffs (accessoryType 1 — specialists)
- Two round plush cups on cheeks + thin arched band
- Side mass readable at iso; rearward Y restrained (body color shows from back)
- Not a black helmet blob

## Runtime tint

| Piece | Formula |
|-------|---------|
| Cap | `mix(bodyColor * 1.08, bodyColor, 0.15)` soft lift — mostly instanceColor (~team) |
| Ear muffs | `instanceColor * ~0.78` (slightly darker cups) |
| Neither | cream plate or jet charcoal |

Bump `character.glb?v=250` after regen.

## Contracts

Meshes `body/eyes/mouth/cap/headphones`, bone `head`, 12 clips, Walk POSE / apply=False / force_sampling=False. Face atlases unchanged.
