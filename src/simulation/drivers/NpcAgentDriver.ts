import * as THREE from 'three/webgpu';
import { AgentNode, MAX_AGENTS } from '../../data/agents';
import { useCoreStore } from '../../integration/store/coreStore';
import { CharacterStateKey, IAgentDriver, PoiDef } from '../../types';
import { CharacterController } from '../CharacterController';
import {
  AGENT_SEPARATION_RADIUS,
  AGENT_SEPARATION_WANDER_CLEARANCE,
  AGENT_WANDER_NUDGE_ITERATIONS,
} from '../constants';

/** Initial per-agent stagger so the team doesn't flip in lockstep on load. */
const INITIAL_STAGGER_MIN = 2.5;
const INITIAL_STAGGER_RANGE = 5; // → 2.5–7.5s

/** Standing-agent re-decide beat (idle/look_around before the next wander/sit roll). */
const IDLE_BEAT_MIN = 4;
const IDLE_BEAT_RANGE = 6; // → 4–10s

/** Seated "sit_work" beat — longer than idle so focused work reads calmer. */
const DESK_WORK_MIN = 6;
const DESK_WORK_RANGE = 8; // → 6–14s
/** Seated "sit_idle" beat. */
const DESK_IDLE_MIN = 4;
const DESK_IDLE_RANGE = 6; // → 4–10s

/** Probability a seated agent stays at the desk (toggles work/idle) instead of standing up. */
const STAY_SEATED_CHANCE = 0.72; // ~28% stand-up rate (was 50/50)

/**
 * Brief standing pause right after the 'stand' get-up animation finishes, before the next
 * wander/sit roll (no instant walk pop). The get-up motion itself (Wave 4: reversed-Sit
 * bake) already covers the "seated → standing" beat via the state machine's non-interruptible
 * clip timer, so this only needs to add a short settle — not the full previous pause.
 */
const POST_STAND_PAUSE_MIN = 0.3;
const POST_STAND_PAUSE_RANGE = 0.4; // → 0.3–0.7s

/**
 * NpcAgentDriver — drives a single NPC autonomously.
 *
 * Each NPC in the scene has its own instance of this class.
 * The update() method is the entry point for all NPC autonomous behavior.
 *
 * It respects the global Core phase and individual task status to determine behavior.
 * Wave 14: seated / waiting agents get light desk life (sit_work ↔ sit_idle,
 * occasional look_around when standing) without fighting walk / chat / GOTO.
 * Motion polish pass: calmer desk cadence (longer beats, ~28% stand-up rate),
 * with a brief standing pause after getting up before the next wander/sit roll.
 */
export class NpcAgentDriver implements IAgentDriver {
  public readonly agentIndex: number;
  /** Countdown to next autonomous / desk-life decision. Staggered per agent. */
  private behaviorTimer: number;
  private wasBusy: boolean = false;

  /**
   * External state injected by the pilar 'Integration' or 'Simulation' loop.
   * This removes the direct dependency on useUiStore (Interface).
   */
  private isChattingWithMe: boolean = false;

  constructor(
    agentIndex: number,
    protected readonly controller: CharacterController,
    protected readonly data: AgentNode,
  ) {
    this.agentIndex = agentIndex;
    // Stagger first beat so the team doesn't flip in lockstep (2.5–7.5s).
    this.behaviorTimer = INITIAL_STAGGER_MIN + ((agentIndex * 2.37) % INITIAL_STAGGER_RANGE);
  }

  /** Sets whether the agent is currently engaged in a chat, suspending autonomy. */
  public setChatting(isChatting: boolean): void {
    this.isChattingWithMe = isChatting;
  }

  // ── IAgentDriver ─────────────────────────────────────────────

  public update(positions: Float32Array, delta: number): void {
    const currentState = this.controller.getState(this.agentIndex);
    const systemState = useCoreStore.getState();

    // Chat owns body language — suspend autonomy entirely.
    if (this.isChattingWithMe) {
      return;
    }

    // Never interrupt locomotion, chat poses, or an active nav path.
    // 'sit_down' / 'stand' are one-shot, non-interruptible transitions — let them finish.
    if (
      currentState === 'walk' ||
      currentState === 'talk' ||
      currentState === 'listen' ||
      currentState === 'sit_down' ||
      currentState === 'stand' ||
      this.controller.isPathing(this.agentIndex)
    ) {
      return;
    }

    // Special behavior for Lead Agent when project is ready
    const isLeadCandidate = this.agentIndex === 1;
    if (isLeadCandidate && systemState.phase === 'done') {
      this._updateProjectReadyBehavior(positions, delta, currentState);
      return;
    }

    // Capture current active task (if any)
    const activeTask = systemState.tasks.find(
      t => t.assignedAgentId === this.agentIndex && (t.status === 'in_progress' || t.status === 'on_hold' || t.status === 'scheduled')
    );
    const isBusyWithSystem = !!activeTask;

    // Detect busy→idle transition: kick the agent to move away immediately
    if (this.wasBusy && !isBusyWithSystem) {
      this.behaviorTimer = 0;
    }
    this.wasBusy = isBusyWithSystem;

    const isSeated = currentState === 'sit_idle' || currentState === 'sit_work';
    const isStandingRest = currentState === 'idle' || currentState === 'look_around';

    // Busy agents: SceneManager owns placement. Only flavor seated desk life.
    if (isBusyWithSystem) {
      if (!isSeated) return;
      this.behaviorTimer -= delta;
      if (this.behaviorTimer <= 0) {
        this._tickDeskLife(currentState);
      }
      return;
    }

    // Autonomous: only decide from stable rest states (incl. sit_work).
    if (!isSeated && !isStandingRest) return;

    this.behaviorTimer -= delta;
    if (this.behaviorTimer <= 0) {
      this._decideNextAction(positions, currentState);
    }
  }

  /** Standing-agent re-decide beat (idle/look_around before the next wander/sit roll). */
  private _resetDeskTimer(): void {
    this.behaviorTimer = IDLE_BEAT_MIN + Math.random() * IDLE_BEAT_RANGE;
  }

  /**
   * Light desk life: sit_work ↔ sit_idle. Never stands / wanders.
   * Subtle focused mouth while working (ExpressionBuffer already has 'neutral').
   * Work beats run longer than idle beats (calmer, more purposeful desk life).
   */
  private _tickDeskLife(currentState: CharacterStateKey | string): void {
    let nextState: 'sit_work' | 'sit_idle';
    if (currentState === 'sit_work') {
      // Mostly pause typing to rest; sometimes keep working.
      nextState = Math.random() < 0.6 ? 'sit_idle' : 'sit_work';
    } else {
      // sit_idle → lean into work most of the time
      nextState = Math.random() < 0.7 ? 'sit_work' : 'sit_idle';
    }

    this.controller.play(this.agentIndex, nextState);
    if (nextState === 'sit_work') {
      this.controller.setExpression(this.agentIndex, 'neutral');
      this.behaviorTimer = DESK_WORK_MIN + Math.random() * DESK_WORK_RANGE;
    } else {
      this.behaviorTimer = DESK_IDLE_MIN + Math.random() * DESK_IDLE_RANGE;
    }
  }

  private _updateProjectReadyBehavior(positions: Float32Array, delta: number, currentState: string): void {
    const spawnId = `idle-spawn-${this.agentIndex}`;
    const targetPoi = this.controller.poiManager.getPoi(spawnId);
    if (!targetPoi) return;

    const currentPos = new THREE.Vector3(
      positions[this.agentIndex * 4],
      positions[this.agentIndex * 4 + 1],
      positions[this.agentIndex * 4 + 2]
    );

    // If not near spawn area, go there
    const dist = currentPos.distanceTo(targetPoi.position);
    if (dist > 1.5) { // Slightly larger threshold to avoid oscillation
      if (currentState !== 'walk') {
        this.controller.moveTo(this.agentIndex, targetPoi.position, 'happy_loop', undefined, currentPos, targetPoi.quaternion);
      }
      return;
    }

    // If arrived or idling near spawn, switch to the looping happy state.
    const isHappy = currentState === 'happy_loop';
    if (!isHappy && currentState !== 'walk') {
      // Snap to target orientation if we are already close but not in the final state
      this.controller.characterManager.setOrientation(this.agentIndex, targetPoi.quaternion);

      // Don't cancel movement if we're naturally arriving via moveTo's arrivalState
      if (currentState !== 'idle') {
        this.controller.cancelMovement(this.agentIndex);
      }
      this.controller.play(this.agentIndex, 'happy_loop');
    }
  }

  private _decideNextAction(positions: Float32Array, currentState: CharacterStateKey | string): void {
    const isSeated = currentState === 'sit_idle' || currentState === 'sit_work';

    // 1. SEATED — mostly stay at the desk; occasional purposeful stand-up (~28%).
    if (isSeated) {
      if (Math.random() < STAY_SEATED_CHANCE) {
        this._tickDeskLife(currentState);
        return;
      }
      // Getting up: play the stand-up animation (continuous reverse of sitting down),
      // then settle into a brief standing beat — the next decide tick (short pause)
      // picks look_around/wander/sit, avoiding an instant walk pop straight off the chair.
      // 'stand' is non-interruptible and auto-transitions to 'idle' when the clip finishes;
      // the state machine's own timer covers the get-up motion, so behaviorTimer only needs
      // to add a short settle once 'idle' is reached.
      this.controller.play(this.agentIndex, 'stand');
      this.behaviorTimer = POST_STAND_PAUSE_MIN + Math.random() * POST_STAND_PAUSE_RANGE;
      return;
    }

    const currentPos = new THREE.Vector3(
      positions[this.agentIndex * 4],
      positions[this.agentIndex * 4 + 1],
      positions[this.agentIndex * 4 + 2]
    );

    // 2. STANDING — a look-around beat sometimes precedes the wander/sit decision.
    if (Math.random() < 0.22) {
      this.controller.play(this.agentIndex, 'look_around');
      this._resetDeskTimer();
      return;
    }

    const isLeadCandidate = this.agentIndex === 1;

    // Prefer wander to common areas.
    if (Math.random() < 0.55) {
      const areaPois = this.controller.poiManager.getFreePoisByPrefix('area-', this.agentIndex);
      if (areaPois.length > 0) {
        const areaPoi = this._pickLeastCrowdedAreaPoi(positions, areaPois);

        const angle = (this.agentIndex * (Math.PI * 2)) / MAX_AGENTS;
        const radius = 1;
        const target = areaPoi.position.clone();
        target.x += Math.cos(angle) * radius;
        target.z += Math.sin(angle) * radius;
        this._nudgeWanderTargetClear(positions, target);

        const direction = new THREE.Vector3().subVectors(areaPoi.position, target).normalize();
        const rotationY = Math.atan2(direction.x, direction.z);
        const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

        if (this.controller.moveTo(this.agentIndex, target, 'look_around', undefined, currentPos, targetQuaternion)) {
          this.controller.poiManager.releaseAll(this.agentIndex);
          this.behaviorTimer = Math.random() * 4 + 4; // 4–8s before next decide
          return;
        }
      }
    }

    // Lead never sits; specialists may claim a free sit POI
    if (!isLeadCandidate && Math.random() < 0.55) {
      const pois = this.controller.poiManager.getFreePois('sit_idle', this.agentIndex);
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        this.controller.walkToPoi(this.agentIndex, poi.id, undefined, currentPos);
        this.behaviorTimer = Math.random() * 6 + 6; // 6–12s sit stay
        return;
      }
    }

    // Fallback: short standing reaction if nothing else found a path.
    const expressions: ('look_around' | 'wave' | 'happy')[] = ['look_around', 'wave', 'happy'];
    const randomAnim = expressions[Math.floor(Math.random() * expressions.length)];
    this.controller.play(this.agentIndex, randomAnim);
    this._resetDeskTimer();
  }

  /**
   * `area-*` POIs are never claimed via `poiManager.occupy` (unlike sit POIs), so
   * `getFreePoisByPrefix('area-', ...)` occupancy filtering is a no-op for them — every
   * area POI always reports "free". Rank candidates by how many agents are currently
   * camped within the wander-clearance radius instead, and prefer the least-crowded one
   * (light randomness among ties so free areas don't all funnel to one exact spot). This
   * is what actually keeps wander spread across the office rather than piling into
   * whichever area happens to win the uniform-random roll.
   */
  private _pickLeastCrowdedAreaPoi(positions: Float32Array, areaPois: PoiDef[]): PoiDef {
    const clearR2 = (AGENT_SEPARATION_RADIUS * AGENT_SEPARATION_WANDER_CLEARANCE) ** 2;
    const count = this.controller.getCount();

    let best: PoiDef[] = [];
    let bestCrowd = Infinity;

    for (const poi of areaPois) {
      let crowd = 0;
      for (let i = 0; i < count; i++) {
        if (i === this.agentIndex) continue;
        const dx = poi.position.x - positions[i * 4];
        const dz = poi.position.z - positions[i * 4 + 2];
        if (dx * dx + dz * dz < clearR2) crowd++;
      }
      if (crowd < bestCrowd) {
        bestCrowd = crowd;
        best = [poi];
      } else if (crowd === bestCrowd) {
        best.push(poi);
      }
    }

    return best[Math.floor(Math.random() * best.length)];
  }

  /**
   * Push a wander target away from other agents already near that spot,
   * so arrivals don’t intentionally stack inside the separation radius.
   * Wave 2: multiple settle passes — a single pass can leave the target
   * re-encroaching on an already-resolved agent when several are nearby
   * from different directions; iterating lets it fully converge.
   */
  private _nudgeWanderTargetClear(positions: Float32Array, target: THREE.Vector3): void {
    const clearR = AGENT_SEPARATION_RADIUS * AGENT_SEPARATION_WANDER_CLEARANCE;
    const clearR2 = clearR * clearR;
    const count = this.controller.getCount();

    for (let pass = 0; pass < AGENT_WANDER_NUDGE_ITERATIONS; pass++) {
      let moved = false;

      for (let i = 0; i < count; i++) {
        if (i === this.agentIndex) continue;
        const dx = target.x - positions[i * 4];
        const dz = target.z - positions[i * 4 + 2];
        const d2 = dx * dx + dz * dz;
        if (d2 >= clearR2 || d2 < 1e-8) continue;

        const dist = Math.sqrt(d2);
        const push = (clearR - dist) / dist;
        target.x += dx * push;
        target.z += dz * push;
        moved = true;
      }

      if (!moved) break;
    }
  }

  public dispose(): void { }
}
