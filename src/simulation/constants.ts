import { AtlasCoords } from '../types';

// ── Character Visual ─────────────────────────────────────────
/** Vertical offset from position origin to character center (for raycasting/picking). */
export const CHARACTER_Y_OFFSET = 1.10;
/** Vertical offset from position origin to name/chat bubble anchor (clears chibi heads). */
export const BUBBLE_Y_OFFSET = 2.25;
/** World-space sphere radius used for mouse-picking characters. */
export const PICK_RADIUS = 0.65;
/** World-space sphere radius used for mouse-picking POIs. */
export const POI_PICK_RADIUS = 0.4;

// ── Resource Loading ──────────────────────────────────────────
/** Path to Draco decoders (hosted in public/vendor/). */
export const DRACO_LIB_PATH = `${import.meta.env.BASE_URL}vendor/draco/`;

// ── Expression Atlas ─────────────────────────────────────────
export const ATLAS_COLS = 2;
export const ATLAS_ROWS = 4;
/** Blink: both eyes closed (bottom atlas row — isolated so Linear filter can't bleed into open-eye cells). */
export const BLINK_FRAME: AtlasCoords = { col: 0, row: 3 };
/** Seconds the blink frame is held (brief — long blinks read as winks at iso). */
export const BLINK_DURATION = 0.08;
/** Seconds per speaking mouth frame. */
export const SPEAKING_FRAME_DURATION = 0.12;
/** Random blink interval range [min, min+range] in seconds. */
export const BLINK_INTERVAL_MIN = 3.5;
export const BLINK_INTERVAL_RANGE = 4;

// ── Pathfinding & Navigation ─────────────────────────────────
/** Distance (world units) at which a path node is considered reached. */
export const PATH_NODE_ARRIVAL = 0.20;
/** Distance at which player arrival at a GOTO waypoint is detected on CPU. */
export const ARRIVAL_RADIUS = 0.26;
/** Distance at which player↔NPC encounter is triggered. */
export const ENCOUNTER_RADIUS = 1.5;
/** Zone ID used with three-pathfinding. */
export const NAVMESH_ZONE = 'level';

/**
 * Locomotion (GPU units / compute dispatch; ~frame at 60 Hz).
 *
 * Measured Walk (ref HEAD character.glb):
 *   duration 0.333s (8 frames @ 24fps) → ~6 steps/s
 *   leg swing ~68–82°, foot-tip Z amplitude ≈ 0.23
 *   theoretical matched speed ≈ stride/dur ≈ 0.68 u/s
 *     → ≈ 0.0114 / frame @ 60fps
 *
 * Live Walk matches ref (leg travel L=0.115 / R=0.158, 9 keys / 0.333s).
 * Retarget ≈ 0.52× theoretical stride speed:
 *   SPEED 0.0050 × GOTO 1.18 ≈ 0.0059 / frame ≈ 0.35 u/s @ 60fps.
 */
export const AGENT_MOVE_SPEED = 0.0050;
/** Multiplier applied while following nav waypoints. */
export const AGENT_MOVE_GOTO_MULT = 1.18;
/** Distance at which a GOTO waypoint is considered reached on GPU. */
export const AGENT_WAYPOINT_RADIUS = 0.15;

/**
 * Watch locomotion (Wave 12) — CPU path follow with ease + turn blend.
 * Cruise matches GPU seek: SPEED × GOTO_MULT × 60fps ≈ 0.354 u/s.
 */
export const AGENT_CRUISE_SPEED =
  AGENT_MOVE_SPEED * AGENT_MOVE_GOTO_MULT * 60;
/** World units from segment start/end where speed eases toward min scale. */
export const AGENT_SEGMENT_EASE_DIST = 0.65;
/** Floor on ease scale (never full-stop mid-segment). */
export const AGENT_SEGMENT_MIN_SPEED_SCALE = 0.42;
/** Extra ease-out within this distance of the final destination. */
export const AGENT_ARRIVAL_EASE_DIST = 0.85;
/** Radians/sec yaw limit while walking (smooth, no snap). */
export const AGENT_TURN_RATE = 7.5;
/** While turning hard, slow a bit so feet don't skate sideways. */
export const AGENT_TURN_SPEED_FACTOR = 0.55;

// ── Agent Separation (soft push-apart; not RVO) ───────────────
/**
 * Soft XZ separation so idle/wander agents don’t stack.
 * Transparency fade (~0.6u, SceneManager 0.36 dist²) stays a secondary cue.
 *
 * SEATED agents are immovable (desk/chair anchors).
 * GOTO uses a reduced weight so path-to-desk still converges.
 */
/** XZ radius (world units) under which agents start pushing apart. */
export const AGENT_SEPARATION_RADIUS = 0.60;
/** Max XZ offset per frame at full overlap (world units). Tuned small vs AGENT_MOVE_SPEED. */
export const AGENT_SEPARATION_PUSH = 0.018;
/** Strength while in GOTO (IDLE/look-around use 1). Keeps desk path following stable. */
export const AGENT_SEPARATION_GOTO_WEIGHT = 0.25;
/** Extra clearance when picking wander area targets (× radius). */
export const AGENT_SEPARATION_WANDER_CLEARANCE = 1.5;

/**
 * Thin partition AABBs in Three XZ (glTF Y-up: Blender (x,y,z) → (x,z,-y)).
 * Half-extents include body clearance so soft separation can't leave agents inside.
 * Must stay in sync with `scripts/blender/navmesh.py` divider obstacles.
 */
export const PARTITION_PUSH_BOXES: ReadonlyArray<{
  cx: number;
  cz: number;
  hx: number;
  hz: number;
}> = [
  { cx: 0.2, cz: 0.0, hx: 0.52, hz: 2.18 }, // static-divider-a
  { cx: -0.8, cz: 3.0, hx: 1.74, hz: 0.52 }, // static-divider-b
];

// ── Sit POI soft arrival ─────────────────────────────────────
/**
 * Sit arrivals still navmesh to the near-seat waypoint (off-mesh chairs keep
 * the last node on-mesh — no furniture cutting). Occupancy is claimed when
 * walkToPoi starts. Softening is CPU-only after the last meters:
 *   1) decelerate toward the near-seat waypoint
 *   2) ease position/facing into the exact seat pose
 */
/** XZ distance to the near-seat nav waypoint where CPU slowdown begins. */
export const SIT_APPROACH_SLOW_DIST = 1.25;
/** Base world units/sec during the last-meters slowdown (GPU walk ≈ 0.35 u/s). */
export const SIT_APPROACH_SPEED = 0.28;
/** Speed scale at the waypoint (1 → this) as distance falls to 0. */
export const SIT_APPROACH_MIN_SPEED_SCALE = 0.35;
/** Seconds to ease from approach end into exact seat position/facing. */
export const SIT_ARRIVAL_BLEND_DURATION = 0.28;
/** Ease-out power for the seat-pose blend (1 = linear, 2 = quadratic out). */
export const SIT_ARRIVAL_BLEND_EASE = 2;

/** Color de fondo de la escena (Three.js) */
export const SCENE_BACKGROUND_COLOR = 0xFaFcFb;

// ── Chat / select camera compose (Wave 13) ───────────────────
/** Look-at height (chest) for conversation / selected-agent framing. */
export const CAMERA_CHEST_Y = 1.05;
/** Ideal OrbitControls distance during chat (composed two-person shot). */
export const CHAT_CAMERA_DIST = 8;
/** Zoom envelope while chatting — deliberate medium shot, not roam clamp-only. */
export const CHAT_CAMERA_MIN_DIST = 7;
export const CHAT_CAMERA_MAX_DIST = 9;
