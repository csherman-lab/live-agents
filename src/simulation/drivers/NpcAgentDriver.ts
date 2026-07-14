import * as THREE from 'three/webgpu';
import { AgentNode, MAX_AGENTS } from '../../data/agents';
import { useCoreStore } from '../../integration/store/coreStore';
import { CharacterStateKey, IAgentDriver } from '../../types';
import { CharacterController } from '../CharacterController';
import {
  AGENT_SEPARATION_RADIUS,
  AGENT_SEPARATION_WANDER_CLEARANCE,
} from '../constants';

/** Desk / idle micro-beat interval range (seconds). */
const DESK_LIFE_MIN = 4;
const DESK_LIFE_RANGE = 8; // → 4–12s

/**
 * NpcAgentDriver — drives a single NPC autonomously.
 *
 * Each NPC in the scene has its own instance of this class.
 * The update() method is the entry point for all NPC autonomous behavior.
 *
 * It respects the global Core phase and individual task status to determine behavior.
 * Wave 14: seated / waiting agents get light desk life (sit_work ↔ sit_idle,
 * occasional look_around when standing) without fighting walk / chat / GOTO.
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
    // Stagger first beat so the team doesn't flip in lockstep (4–12s).
    this.behaviorTimer = DESK_LIFE_MIN + ((agentIndex * 2.37) % DESK_LIFE_RANGE);
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
    if (
      currentState === 'walk' ||
      currentState === 'talk' ||
      currentState === 'listen' ||
      currentState === 'sit_down' ||
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

  private _resetDeskTimer(): void {
    this.behaviorTimer = DESK_LIFE_MIN + Math.random() * DESK_LIFE_RANGE;
  }

  /**
   * Light desk life: sit_work ↔ sit_idle. Never stands / wanders.
   * Subtle focused mouth while working (ExpressionBuffer already has 'neutral').
   */
  private _tickDeskLife(currentState: CharacterStateKey | string): void {
    if (currentState === 'sit_work') {
      // Mostly pause typing to rest; sometimes keep working.
      if (Math.random() < 0.6) {
        this.controller.play(this.agentIndex, 'sit_idle');
      } else {
        this.controller.play(this.agentIndex, 'sit_work');
        this.controller.setExpression(this.agentIndex, 'neutral');
      }
    } else {
      // sit_idle → lean into work most of the time
      if (Math.random() < 0.7) {
        this.controller.play(this.agentIndex, 'sit_work');
        this.controller.setExpression(this.agentIndex, 'neutral');
      } else {
        this.controller.play(this.agentIndex, 'sit_idle');
      }
    }
    this._resetDeskTimer();
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
    const rand = Math.random();
    const isSeated = currentState === 'sit_idle' || currentState === 'sit_work';

    // 1. Behavior when SEATED — prefer desk life; rarely stand up
    if (isSeated) {
      // ~70%: stay seated and swap sit_work ↔ sit_idle
      if (rand < 0.7) {
        this._tickDeskLife(currentState);
        return;
      }
      // ~30%: stand up and fall through to movement logic
    }

    // Capture current position
    const currentPos = new THREE.Vector3(
      positions[this.agentIndex * 4],
      positions[this.agentIndex * 4 + 1],
      positions[this.agentIndex * 4 + 2]
    );

    // 2. Behavior when STANDING (or if decided to get up)

    // Standing rest: occasional look_around before wandering (~35%)
    if (!isSeated && rand < 0.35) {
      this.controller.play(this.agentIndex, 'look_around');
      this._resetDeskTimer();
      return;
    }

    // A. Chance to go sit (only if NOT already seated)
    // Lead agent candidates NEVER sit, they prefer to pace or stay standing
    const isLeadCandidate = this.agentIndex === 1;
    if (!isSeated && rand < 0.55 && !isLeadCandidate) {
      const pois = this.controller.poiManager.getFreePois('sit_idle', this.agentIndex);
      if (pois.length > 0) {
        const poi = pois[Math.floor(Math.random() * pois.length)];
        this.controller.walkToPoi(this.agentIndex, poi.id, undefined, currentPos);
        this.behaviorTimer = Math.random() * 8 + 8; // longer sit stay before next decide
        return;
      }
    }

    // B. Chance to wander to common areas (both standing and those getting up)
    if (rand < 0.75 || isSeated) {
      const areaPois = this.controller.poiManager.getFreePoisByPrefix('area-', this.agentIndex);
      if (areaPois.length > 0) {
        const areaPoi = areaPois[Math.floor(Math.random() * areaPois.length)];

        // Distributed ring slot per agent index, then nudge clear of nearby agents
        const angle = (this.agentIndex * (Math.PI * 2)) / MAX_AGENTS;
        const radius = 1;
        const target = areaPoi.position.clone();
        target.x += Math.cos(angle) * radius;
        target.z += Math.sin(angle) * radius;
        this._nudgeWanderTargetClear(positions, target);

        // Calculate "natural" rotation: facing the center of the area
        const direction = new THREE.Vector3().subVectors(areaPoi.position, target).normalize();
        const rotationY = Math.atan2(direction.x, direction.z);
        const targetQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);

        if (this.controller.moveTo(this.agentIndex, target, 'look_around', undefined, currentPos, targetQuaternion)) {
          this.controller.poiManager.releaseAll(this.agentIndex);
          this.behaviorTimer = Math.random() * 5 + 8;
          return;
        }
      }
    }

    // C. Fallback: play a short reaction animation (only if standing)
    if (!isSeated) {
      const expressions: ('look_around' | 'wave' | 'happy')[] = ['look_around', 'wave', 'happy'];
      const randomAnim = expressions[Math.floor(Math.random() * expressions.length)];
      this.controller.play(this.agentIndex, randomAnim);
      this._resetDeskTimer();
    } else {
      // Seated get-up failed to find a path — stay seated with desk life next
      this._tickDeskLife(currentState);
    }
  }

  /**
   * Push a wander target away from other agents already near that spot,
   * so arrivals don’t intentionally stack inside the separation radius.
   */
  private _nudgeWanderTargetClear(positions: Float32Array, target: THREE.Vector3): void {
    const clearR = AGENT_SEPARATION_RADIUS * AGENT_SEPARATION_WANDER_CLEARANCE;
    const clearR2 = clearR * clearR;
    const count = this.controller.getCount();

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
    }
  }

  public dispose(): void { }
}
