# Mirror Office Polish — Design Notes

**Date:** 2026-08-04  
**Status:** Implemented (companion polish pass)

## Goal

Make the Mock Swarm / Cursor mirror office read clearly at a glance: correct seats, honest status bubbles, readable lead, no ghost UI.

## Improvements shipped

1. **Working bubble only after arrival** — hallway walks stay quiet; bubble appears on stage/desk arrival  
2. **Lead never dimmed** — Cursor stays saturated on stage when idle/done  
3. **Stronger idle dull + working boost** — specialists read waiting vs busy  
4. **Gentler spawn pulse with hard scale reset** — no stuck miniature agents  
5. **Dimmed nameplates** — idle labels quieter  
6. **Mirror overlay hygiene** — hide player ring/projections; skip behind-camera labels  
7. **isLead passed into bubble mapping**

## Success checks

- Cursor on stage, talking, full color, Working bubble once arrived  
- Working specialists seated at desks before Working bubble  
- Idle specialists on couches, dulled, no bubble  
- Thinkers at board, no Working bubble  
- HUD: one row per agent  
- Uniform character scale after spawn
