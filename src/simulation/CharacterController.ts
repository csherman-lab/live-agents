import * as THREE from 'three/webgpu';
import { getActiveAgentSet } from '../integration/store/teamStore';
import { AgentBehavior, AnimationName, CharacterStateKey, ExpressionKey, ICharacterDriver, PoiDef } from '../types';

import { AgentStateBuffer } from './behavior/AgentStateBuffer';
import { CharacterStateMachine } from './behavior/CharacterStateMachine';
import {
  AGENT_ARRIVAL_EASE_DIST,
  AGENT_CRUISE_SPEED,
  AGENT_SEGMENT_EASE_DIST,
  AGENT_SEGMENT_MIN_SPEED_SCALE,
  AGENT_SEPARATION_GOTO_WEIGHT,
  AGENT_SEPARATION_PUSH,
  AGENT_SEPARATION_RADIUS,
  AGENT_TURN_RATE,
  AGENT_TURN_SPEED_FACTOR,
  PARTITION_PUSH_BOXES,
  PATH_NODE_ARRIVAL,
  SIT_APPROACH_MIN_SPEED_SCALE,
  SIT_APPROACH_SLOW_DIST,
  SIT_APPROACH_SPEED,
  SIT_ARRIVAL_BLEND_DURATION,
  SIT_ARRIVAL_BLEND_EASE,
} from './constants';
import { CharacterManager } from './entities/CharacterManager';
import { NavMeshManager } from './pathfinding/NavMeshManager';
import { PathAgent } from './pathfinding/PathAgent';
import { PoiManager } from './world/PoiManager';

/** Pending sit walk — navmesh still owns path until the slow-approach radius. */
interface SitArrivalIntent {
  approachTarget: THREE.Vector3;
  seatPos: THREE.Vector3;
  seatQuat: THREE.Quaternion;
  alignOrientation: boolean;
  onArrival?: (index: number) => void;
}

/** Active CPU soft arrival after the last meters (slow → seat blend). */
interface SitArrivalMotion {
  phase: 'slow' | 'blend';
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  startFacing: THREE.Vector2;
  targetFacing: THREE.Vector2;
  elapsed: number;
  duration: number;
}

/**
 * CharacterController — unified API for controlling any character (player or NPC).
 *
 * Composes:
 *  - CharacterManager     → GPU rendering, animation baking, expression buffers
 *  - CharacterStateMachine → declarative state→animation+expression mapping
 *  - PathAgent[]          → per-agent CPU path following
 *  - NavMeshManager       → path queries
 *  - PoiManager           → POI lookup and occupancy
 *
 * Implements ICharacterDriver so it can be passed to the state machine and
 * behavior drivers without circular dependencies.
 *
 * All behavior code (PlayerInputDriver, NpcAgentDriver) goes through this class.
 */
export class CharacterController implements ICharacterDriver {
  private stateMachine: CharacterStateMachine;
  private pathAgents: PathAgent[] = [];
  /** Per-agent callback fired when the agent reaches its path destination. */
  private arrivalCallbacks: (((index: number) => void) | undefined)[] = [];
  /** Sit POI soft-arrival intent (set while still on navmesh path). */
  private sitIntents: (SitArrivalIntent | null)[] = [];
  /** Active sit slowdown / seat-pose blend (CPU). */
  private sitMotions: (SitArrivalMotion | null)[] = [];
  /** Last frame delta — updatePaths runs without delta. */
  private lastDelta = 1 / 60;
  /** Scratch XZ offsets for soft separation (reused each frame). */
  private separationScratch: Float32Array;
  /** Per-agent smoothed walk facing (XZ unit); Wave 12 yaw blend. */
  private walkFacing: Float32Array;
  private readonly _sepPos = new THREE.Vector3();
  private readonly _sitPos = new THREE.Vector3();
  private readonly _sitForward = new THREE.Vector3();
  private readonly _movePos = new THREE.Vector3();

  constructor(
    public readonly characterManager: CharacterManager,
    private readonly navMesh: NavMeshManager,
    public readonly poiManager: PoiManager,
  ) {
    const count = characterManager.getCount();
    this.stateMachine = new CharacterStateMachine(count);
    this.separationScratch = new Float32Array(count * 2);
    this.walkFacing = new Float32Array(count * 2);
    this.sitIntents = new Array(count).fill(null);
    this.sitMotions = new Array(count).fill(null);

    const stateBuffer = characterManager.getAgentStateBuffer()!;
    for (let i = 0; i < count; i++) {
      this.pathAgents.push(new PathAgent(i, stateBuffer));
      // Default face +Z
      this.walkFacing[i * 2] = 0;
      this.walkFacing[i * 2 + 1] = 1;
    }

    // Dev QA probe for Wave 12 locomotion (ease / yaw samples).
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as unknown as { __laController?: CharacterController }).__laController = this;
    }
  }

  // ── High-level character API ─────────────────────────────────

  /**
   * Transition a character to the given state.
   * The state machine applies the correct animation + expression automatically.
   * Non-interruptible states (e.g. 'sit_down') will queue the new state until ready.
   */
  public play(index: number, state: CharacterStateKey): void {
    // If transitioning away from a seated state, release any POIs
    const currentState = this.stateMachine.getState(index);
    const isCurrentlySeated = currentState === 'sit_idle' || currentState === 'sit_work' || currentState === 'sit_down';
    const isNewStateSeated = state === 'sit_idle' || state === 'sit_work' || state === 'sit_down';

    if (isCurrentlySeated && !isNewStateSeated) {
      this.poiManager.releaseAll(index);
    }

    this.stateMachine.transition(index, state, this);
  }

  /**
   * Walk a character to a world-space position using the navmesh.
   * Automatically transitions to 'walk' and then to `arrivalState` on arrival.
   *
   * @param arrivalState State to enter upon reaching the destination (default: 'idle')
   * @param onArrival    Optional callback fired when the destination is reached
   * @param fromPosition Optional start position (defaults to current CPU position)
   * @param targetOrientation Optional orientation to snap to upon arrival
   */
  public moveTo(
    index: number,
    target: THREE.Vector3,
    arrivalState: CharacterStateKey = 'idle',
    onArrival?: (index: number) => void,
    fromPosition?: THREE.Vector3,
    targetOrientation?: THREE.Quaternion,
  ): boolean {
    let from: THREE.Vector3;

    if (fromPosition) {
      from = fromPosition.clone();
    } else {
      const positions = this.characterManager.getCPUPositions();
      if (!positions) return false;

      from = new THREE.Vector3(
        positions[index * 4],
        positions[index * 4 + 1],
        positions[index * 4 + 2],
      );
    }

    const path = this.navMesh.findPath(from, target);

    if (path.length === 0) {
      // Emergency Teleport: If the target is valid on the navmesh but we can't find a path
      // (likely because the character is stuck outside the navmesh bounds), teleport directly.
      if (index === getActiveAgentSet().user.index) {
        this.characterManager.setPosition(index, target);
        if (targetOrientation) {
          this.characterManager.setOrientation(index, targetOrientation);
        }
        this.play(index, arrivalState);
        onArrival?.(index);
        return true;
      }

      return false;
    }

    // Snap to the exact target only when it lies on the walkable navmesh.
    // POIs on chairs/desks are often off-mesh; overriding the last node would
    // route agents straight through furniture. Sit POIs use soft CPU arrival.
    if (this.navMesh.isPointOnNavMesh(target)) {
      path[path.length - 1] = target.clone();
    }

    this.clearSitArrival(index);
    this.initWalkFacing(index, from, path[Math.min(1, path.length - 1)] ?? path[0]);
    this.pathAgents[index].setPath(path, from);
    this.arrivalCallbacks[index] = (i) => {
      if (targetOrientation) {
        this.characterManager.setOrientation(i, targetOrientation);
      }
      this.play(i, arrivalState);
      onArrival?.(i);
    };

    // IDLE physics: CPU owns eased seek + yaw (shared waypoint/facing slots).
    // Mode stays semantically "pathing" via PathAgent.isMoving for separation.
    this.setPhysicsMode(index, AgentBehavior.IDLE);
    this.play(index, 'walk');

    return true;
  }

  /**
   * Walk a character to a POI by ID.
   * Occupies the POI immediately; releases existing ones first.
   */
  public walkToPoi(
    index: number,
    poiId: string,
    onArrival?: (index: number) => void,
    fromPosition?: THREE.Vector3,
  ): boolean {
    const poi = this.poiManager.getPoi(poiId);
    if (!poi || (poi.occupiedBy !== null && poi.occupiedBy !== index)) return false;

    const targetState = poi.arrivalState;
    const isSitVariant = targetState === 'sit_idle' || targetState === 'sit_work';

    if (isSitVariant) {
      return this.walkToSitPoi(index, poi, targetState as 'sit_idle' | 'sit_work', onArrival, fromPosition);
    }

    // Check path before releasing old POIs
    const moved = this.moveTo(index, poi.position, 'idle', (i) => {
      // Non-sit POIs still snap to the marker (areas / spawns).
      this.characterManager.setPosition(i, poi.position);

      if (!poi.id.startsWith('area')) {
        this.characterManager.setOrientation(i, poi.quaternion);
      }

      this.play(i, targetState);
      onArrival?.(i);
    }, fromPosition);

    if (!moved) return false;

    this.poiManager.releaseAll(index);
    this.poiManager.occupy(poiId, index);

    return true;
  }

  /**
   * Sit POI path: navmesh to near-seat, then CPU slowdown + seat-pose blend.
   * Occupancy mutex is claimed before movement starts (same as other POIs).
   */
  private walkToSitPoi(
    index: number,
    poi: PoiDef,
    finalState: 'sit_idle' | 'sit_work',
    onArrival?: (index: number) => void,
    fromPosition?: THREE.Vector3,
  ): boolean {
    // Pre-arm sit sequence before async arrival / blend completes.
    this.stateMachine.prepareSitDown(index, finalState);

    let from: THREE.Vector3;
    if (fromPosition) {
      from = fromPosition.clone();
    } else {
      const positions = this.characterManager.getCPUPositions();
      if (!positions) return false;
      from = new THREE.Vector3(
        positions[index * 4],
        positions[index * 4 + 1],
        positions[index * 4 + 2],
      );
    }

    const path = this.navMesh.findPath(from, poi.position);
    if (path.length === 0) return false;

    // Keep last node on-mesh when the chair POI is off-mesh (no furniture cutting).
    if (this.navMesh.isPointOnNavMesh(poi.position)) {
      path[path.length - 1] = poi.position.clone();
    }

    const approachTarget = path[path.length - 1].clone();

    this.clearSitArrival(index);
    this.sitIntents[index] = {
      approachTarget,
      seatPos: poi.position.clone(),
      seatQuat: poi.quaternion.clone(),
      alignOrientation: !poi.id.startsWith('area'),
      onArrival,
    };

    this.initWalkFacing(index, from, path[Math.min(1, path.length - 1)] ?? path[0]);
    this.pathAgents[index].setPath(path, from);
    this.arrivalCallbacks[index] = (i) => {
      // Reached near-seat waypoint without early slowdown — still ease into seat.
      this.beginSitSeatBlend(i);
    };

    this.setPhysicsMode(index, AgentBehavior.IDLE);
    this.play(index, 'walk');

    this.poiManager.releaseAll(index);
    this.poiManager.occupy(poi.id, index);

    return true;
  }

  private clearSitArrival(index: number): void {
    this.sitIntents[index] = null;
    this.sitMotions[index] = null;
  }

  /** Seed walk facing — keep current yaw and blend; only seed if unset/zero. */
  private initWalkFacing(index: number, from: THREE.Vector3, toward: THREE.Vector3): void {
    const curX = this.walkFacing[index * 2];
    const curZ = this.walkFacing[index * 2 + 1];
    if (Math.hypot(curX, curZ) > 0.1) {
      // Keep current facing; blendWalkFacing will rotate toward the path.
      this.characterManager.setFacing(index, curX, curZ);
      return;
    }

    const dx = toward.x - from.x;
    const dz = toward.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len > 1e-5) {
      this.walkFacing[index * 2] = dx / len;
      this.walkFacing[index * 2 + 1] = dz / len;
    } else {
      const cur = this.readFacingXZ(index);
      this.walkFacing[index * 2] = cur.x;
      this.walkFacing[index * 2 + 1] = cur.y;
    }
    this.characterManager.setFacing(
      index,
      this.walkFacing[index * 2],
      this.walkFacing[index * 2 + 1],
    );
  }

  /**
   * Rotate current XZ facing toward desired at AGENT_TURN_RATE (shortest arc).
   * Returns alignment 1 = aligned, 0 = opposite (for turn slowdown).
   */
  private blendWalkFacing(index: number, desiredX: number, desiredZ: number, dt: number): number {
    let fx = this.walkFacing[index * 2];
    let fz = this.walkFacing[index * 2 + 1];
    const flen = Math.hypot(fx, fz) || 1;
    fx /= flen;
    fz /= flen;

    const dlen = Math.hypot(desiredX, desiredZ) || 1;
    const dx = desiredX / dlen;
    const dz = desiredZ / dlen;

    const dot = Math.max(-1, Math.min(1, fx * dx + fz * dz));
    const cross = fx * dz - fz * dx; // signed sin in XZ
    const angle = Math.atan2(cross, dot);
    const maxStep = AGENT_TURN_RATE * dt;
    const step = Math.max(-maxStep, Math.min(maxStep, angle));

    if (Math.abs(step) > 1e-6) {
      const c = Math.cos(step);
      const s = Math.sin(step);
      const nfx = fx * c - fz * s;
      const nfz = fx * s + fz * c;
      const nlen = Math.hypot(nfx, nfz) || 1;
      this.walkFacing[index * 2] = nfx / nlen;
      this.walkFacing[index * 2 + 1] = nfz / nlen;
    } else {
      this.walkFacing[index * 2] = dx;
      this.walkFacing[index * 2 + 1] = dz;
    }

    return (dot + 1) * 0.5;
  }

  /**
   * Ease scale for the active segment + final arrival (smoothstep in/out).
   * Cruise stays AGENT_CRUISE_SPEED at mid-segment.
   */
  private computeSpeedScale(
    agent: PathAgent,
    currentPos: THREE.Vector3,
    distToNode: number,
  ): number {
    const segLen = Math.max(agent.getSegmentLength(), 1e-4);
    const traveled = Math.hypot(
      currentPos.x - agent.getSegmentStart().x,
      currentPos.z - agent.getSegmentStart().z,
    );
    const easeR = AGENT_SEGMENT_EASE_DIST;
    const minS = AGENT_SEGMENT_MIN_SPEED_SCALE;

    // Ease-in from segment start
    const inT = Math.min(traveled / easeR, 1);
    const easeIn = minS + (1 - minS) * (inT * inT * (3 - 2 * inT));

    // Ease-out toward segment end (and slightly before corners)
    const outT = Math.min(distToNode / easeR, 1);
    const easeOut = minS + (1 - minS) * (outT * outT * (3 - 2 * outT));

    // Final destination ease-out
    const remaining = agent.getRemainingDistance(currentPos);
    const arrT = Math.min(remaining / AGENT_ARRIVAL_EASE_DIST, 1);
    const arrival = minS + (1 - minS) * (arrT * arrT * (3 - 2 * arrT));

    // Short segments: don't stack ease-in and ease-out into a crawl
    let scale = Math.min(easeIn, easeOut, arrival);
    if (segLen < easeR * 1.5) {
      scale = Math.max(scale, (minS + 1) * 0.5);
    }
    return scale;
  }

  private readFacingXZ(index: number): THREE.Vector2 {
    const wp = this.characterManager.getAgentStateBuffer()?.getWaypoint(index);
    if (!wp) return new THREE.Vector2(0, 1);
    const len = Math.hypot(wp.x, wp.z) || 1;
    return new THREE.Vector2(wp.x / len, wp.z / len);
  }

  /** CPU decelerate toward the near-seat nav waypoint (last meters). */
  private beginSitSlowApproach(index: number, currentPos: THREE.Vector3): void {
    const intent = this.sitIntents[index];
    if (!intent) return;

    this.sitMotions[index] = {
      phase: 'slow',
      startPos: currentPos.clone(),
      endPos: intent.approachTarget.clone(),
      startFacing: this.readFacingXZ(index),
      targetFacing: this.readFacingXZ(index),
      elapsed: 0,
      duration: 0,
    };
  }

  /**
   * Ease position/facing into the exact seat pose over SIT_ARRIVAL_BLEND_DURATION,
   * then lock SEATED + sit_down (sitTarget already prepared).
   */
  private beginSitSeatBlend(index: number): void {
    const intent = this.sitIntents[index];
    if (!intent) return;

    const current = this.characterManager.getCPUPosition(index) ?? intent.approachTarget.clone();
    const startFacing = this.readFacingXZ(index);

    let targetFacing = startFacing.clone();
    if (intent.alignOrientation) {
      this._sitForward.set(0, 0, 1).applyQuaternion(intent.seatQuat);
      const len = Math.hypot(this._sitForward.x, this._sitForward.z) || 1;
      targetFacing = new THREE.Vector2(this._sitForward.x / len, this._sitForward.z / len);
    }

    this.sitMotions[index] = {
      phase: 'blend',
      startPos: current.clone(),
      endPos: intent.seatPos.clone(),
      startFacing,
      targetFacing,
      elapsed: 0,
      duration: SIT_ARRIVAL_BLEND_DURATION,
    };

    // Clear path arrival so we don't re-enter; occupy already held.
    this.arrivalCallbacks[index] = undefined;
    this.setPhysicsMode(index, AgentBehavior.SEATED);
    this.play(index, 'sit_down');
  }

  private tickSitArrivals(delta: number): void {
    const dt = Math.min(Math.max(delta, 0), 0.1);

    for (let i = 0; i < this.sitMotions.length; i++) {
      const motion = this.sitMotions[i];
      const intent = this.sitIntents[i];
      if (!motion || !intent) continue;

      if (motion.phase === 'slow') {
        const cur = this.characterManager.getCPUPosition(i);
        if (!cur) continue;

        const dx = intent.approachTarget.x - cur.x;
        const dz = intent.approachTarget.z - cur.z;
        const dist = Math.hypot(dx, dz);

        if (dist <= PATH_NODE_ARRIVAL) {
          this.beginSitSeatBlend(i);
          continue;
        }

        // Decelerate as we close in on the near-seat waypoint.
        const closeT = 1 - Math.min(dist / SIT_APPROACH_SLOW_DIST, 1);
        const speedScale = THREE.MathUtils.lerp(1, SIT_APPROACH_MIN_SPEED_SCALE, closeT);
        const step = Math.min(dist, SIT_APPROACH_SPEED * speedScale * dt);
        const inv = 1 / dist;
        this._sitPos.set(cur.x + dx * inv * step, cur.y, cur.z + dz * inv * step);
        this.characterManager.setPositionAndZeroVelocity(i, this._sitPos);
        this.characterManager.setFacing(i, dx * inv, dz * inv);
        continue;
      }

      // Seat-pose blend
      motion.elapsed += dt;
      const u = Math.min(motion.elapsed / motion.duration, 1);
      const e = 1 - Math.pow(1 - u, SIT_ARRIVAL_BLEND_EASE);

      this._sitPos.lerpVectors(motion.startPos, motion.endPos, e);
      this.characterManager.setPositionAndZeroVelocity(i, this._sitPos);

      if (intent.alignOrientation) {
        const fx = THREE.MathUtils.lerp(motion.startFacing.x, motion.targetFacing.x, e);
        const fz = THREE.MathUtils.lerp(motion.startFacing.y, motion.targetFacing.y, e);
        const flen = Math.hypot(fx, fz) || 1;
        this.characterManager.setFacing(i, fx / flen, fz / flen);
      }

      if (u >= 1) {
        this.characterManager.setPositionAndZeroVelocity(i, intent.seatPos);
        if (intent.alignOrientation) {
          this.characterManager.setOrientation(i, intent.seatQuat);
        }
        const cb = intent.onArrival;
        this.clearSitArrival(i);
        cb?.(i);
      }
    }
  }

  /** Speaking mouth animation overlay — independent of character state. */
  public setSpeaking(index: number, isSpeaking: boolean): void {
    this.characterManager.setSpeaking(index, isSpeaking);
  }

  public getState(index: number): CharacterStateKey {
    return this.stateMachine.getState(index);
  }

  // ── Per-frame update ─────────────────────────────────────────

  /**
   * Main update loop. Call once per frame.
   *  1. Updates GPU expression buffers (blink, mouth animation).
   *  2. Runs GPU compute shader (physics/movement).
   *  3. Ticks the state machine timers (non-looping state auto-transitions).
   *  4. Advances per-agent path following.
   */
  public update(delta: number, renderer: any): void {
    this.lastDelta = delta;
    this.characterManager.update(delta, renderer);
    this.stateMachine.update(delta, this);
  }

  /**
   * GPU→CPU position readback (async, 1-frame lag).
   * Returns the positions buffer so drivers can use it for logic.
   */
  public async syncFromGPU(renderer: any): Promise<Float32Array | null> {
    return this.characterManager.syncFromGPU(renderer);
  }

  /**
   * Advance path agents. Call after syncFromGPU resolves so positions are fresh.
   * Wave 12: CPU eased seek + smooth yaw (GPU GOTO is constant-speed snap-turn).
   * Fires arrival callbacks for agents that reach their destination.
   * Then applies soft XZ separation so idle/wander agents don’t stack.
   */
  public updatePaths(positions: Float32Array): void {
    const dt = Math.min(Math.max(this.lastDelta, 0), 0.1);

    for (let i = 0; i < this.pathAgents.length; i++) {
      // Soft sit arrival owns locomotion once slowdown/blend starts.
      if (this.sitMotions[i]) continue;

      const currentPos = new THREE.Vector3(
        positions[i * 4],
        positions[i * 4 + 1],
        positions[i * 4 + 2],
      );

      // Last meters: hand off from path follow to CPU decelerating approach.
      const sitIntent = this.sitIntents[i];
      if (sitIntent && this.pathAgents[i].isMoving) {
        const dx = sitIntent.approachTarget.x - currentPos.x;
        const dz = sitIntent.approachTarget.z - currentPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < SIT_APPROACH_SLOW_DIST) {
          const lastDir = this.pathAgents[i].getLastDirection();
          this.pathAgents[i].cancel();
          this.walkFacing[i * 2] = lastDir.x;
          this.walkFacing[i * 2 + 1] = lastDir.z;
          this.characterManager.setFacing(i, lastDir.x, lastDir.z);
          this.setPhysicsMode(i, AgentBehavior.IDLE);
          this.arrivalCallbacks[i] = undefined;
          this.beginSitSlowApproach(i, currentPos);
          continue;
        }
      }

      if (!this.pathAgents[i].isMoving) continue;

      const agent = this.pathAgents[i];
      const target = agent.getTarget();
      if (!target) continue;

      const toX = target.x - currentPos.x;
      const toZ = target.z - currentPos.z;
      const distToNode = Math.hypot(toX, toZ);

      const desired = agent.getDesiredDirection(currentPos);
      const align = this.blendWalkFacing(i, desired.x, desired.z, dt);
      const fx = this.walkFacing[i * 2];
      const fz = this.walkFacing[i * 2 + 1];

      // Ease along segment / destination; slow while yawing hard.
      const easeScale = this.computeSpeedScale(agent, currentPos, distToNode);
      const turnScale = THREE.MathUtils.lerp(AGENT_TURN_SPEED_FACTOR, 1, align);
      const speed = AGENT_CRUISE_SPEED * easeScale * turnScale;
      const step = Math.min(distToNode, speed * dt);

      // Move along facing (deliberate arcs) but don't overshoot the node.
      this._movePos.set(
        currentPos.x + fx * step,
        currentPos.y,
        currentPos.z + fz * step,
      );
      // If facing hasn't caught up, still progress toward the node a little
      // so agents don't stall on sharp corners.
      if (align < 0.35 && distToNode > PATH_NODE_ARRIVAL) {
        const pull = step * 0.35;
        const inv = 1 / distToNode;
        this._movePos.x = currentPos.x + fx * step * 0.65 + toX * inv * pull;
        this._movePos.z = currentPos.z + fz * step * 0.65 + toZ * inv * pull;
      }

      this.characterManager.setPositionAndZeroVelocity(i, this._movePos);
      this.characterManager.setFacing(i, fx, fz);
      // Keep IDLE so facing overrides apply (GOTO shares the same slots as waypoints).
      this.setPhysicsMode(i, AgentBehavior.IDLE);

      // Mirror into the positions buffer so separation sees the new spot this frame.
      positions[i * 4] = this._movePos.x;
      positions[i * 4 + 2] = this._movePos.z;

      const arrived = agent.update(this._movePos);
      if (arrived) {
        this.characterManager.setFacing(i, fx, fz);
        this.setPhysicsMode(i, AgentBehavior.IDLE);
        this.arrivalCallbacks[i]?.(i);
      }
    }

    this.applySeparation(positions);
    this.applyPartitionPushOut(positions);
    this.tickSitArrivals(this.lastDelta);
  }

  /**
   * Soft XZ push-out when an idle/wander agent drifts into a thin partition box
   * (separation can nudge them into gaps that pathfinding then can't leave).
   * Pathing / soft-sit agents are left alone so Walk ease + sit arrival stay intact.
   */
  private applyPartitionPushOut(positions: Float32Array): void {
    const count = this.pathAgents.length;
    for (let i = 0; i < count; i++) {
      if (this.pathAgents[i].isMoving || this.sitMotions[i]) continue;
      const mode = this.characterManager.getAgentState(i);
      if (mode === AgentBehavior.SEATED || mode === AgentBehavior.GOTO) continue;

      let x = positions[i * 4];
      let z = positions[i * 4 + 2];
      let pushed = false;

      for (const box of PARTITION_PUSH_BOXES) {
        const dx = x - box.cx;
        const dz = z - box.cz;
        if (Math.abs(dx) > box.hx || Math.abs(dz) > box.hz) continue;

        const pushX = box.hx - Math.abs(dx);
        const pushZ = box.hz - Math.abs(dz);
        if (pushX < pushZ) {
          x = box.cx + Math.sign(dx || 1) * (box.hx + 0.02);
        } else {
          z = box.cz + Math.sign(dz || 1) * (box.hz + 0.02);
        }
        pushed = true;
      }

      if (!pushed) continue;
      this._sepPos.set(x, positions[i * 4 + 1], z);
      this.characterManager.setPosition(i, this._sepPos);
      positions[i * 4] = x;
      positions[i * 4 + 2] = z;
    }
  }

  /**
   * Lightweight push-apart on XZ when agents are closer than AGENT_SEPARATION_RADIUS.
   * SEATED agents are anchors (desks). GOTO gets a reduced weight so path following
   * still converges. Writes into the GPU position buffer for the next compute frame.
   */
  private applySeparation(positions: Float32Array): void {
    const count = this.pathAgents.length;
    if (this.separationScratch.length < count * 2) {
      this.separationScratch = new Float32Array(count * 2);
    } else {
      this.separationScratch.fill(0);
    }

    const r = AGENT_SEPARATION_RADIUS;
    const r2 = r * r;
    const pushMax = AGENT_SEPARATION_PUSH;

    for (let i = 0; i < count; i++) {
      const modeI = this.characterManager.getAgentState(i);
      const ix = positions[i * 4];
      const iz = positions[i * 4 + 2];
      const softSitI = !!this.sitMotions[i];
      const pathingI = this.pathAgents[i].isMoving;
      const weightI = softSitI || modeI === AgentBehavior.SEATED
        ? 0
        : pathingI || modeI === AgentBehavior.GOTO
          ? AGENT_SEPARATION_GOTO_WEIGHT
          : 1;

      for (let j = i + 1; j < count; j++) {
        const modeJ = this.characterManager.getAgentState(j);
        const softSitJ = !!this.sitMotions[j];
        const pathingJ = this.pathAgents[j].isMoving;
        const weightJ = softSitJ || modeJ === AgentBehavior.SEATED
          ? 0
          : pathingJ || modeJ === AgentBehavior.GOTO
            ? AGENT_SEPARATION_GOTO_WEIGHT
            : 1;

        // Both seated (or otherwise immovable) — nothing to do
        if (weightI === 0 && weightJ === 0) continue;

        let dx = ix - positions[j * 4];
        let dz = iz - positions[j * 4 + 2];
        const d2 = dx * dx + dz * dz;
        if (d2 >= r2) continue;

        let dist = Math.sqrt(d2);
        if (dist < 1e-5) {
          // Deterministic split when perfectly stacked
          const angle = (i * 12.9898 + j * 78.233) % (Math.PI * 2);
          dx = Math.cos(angle);
          dz = Math.sin(angle);
          dist = 1e-5;
        } else {
          dx /= dist;
          dz /= dist;
        }

        const force = ((r - dist) / r) * pushMax;
        // Split when both move; full force onto the mover when the other is a SEATED anchor
        const shareI = weightJ > 0 ? 0.5 : 1;
        const shareJ = weightI > 0 ? 0.5 : 1;
        this.separationScratch[i * 2] += dx * force * shareI * weightI;
        this.separationScratch[i * 2 + 1] += dz * force * shareI * weightI;
        this.separationScratch[j * 2] -= dx * force * shareJ * weightJ;
        this.separationScratch[j * 2 + 1] -= dz * force * shareJ * weightJ;
      }
    }

    for (let i = 0; i < count; i++) {
      const ox = this.separationScratch[i * 2];
      const oz = this.separationScratch[i * 2 + 1];
      if (ox === 0 && oz === 0) continue;

      this._sepPos.set(
        positions[i * 4] + ox,
        positions[i * 4 + 1],
        positions[i * 4 + 2] + oz,
      );
      this.characterManager.setPosition(i, this._sepPos);
    }
  }

  /** Cancel movement for an agent and return to idle. */
  public cancelMovement(index: number): void {
    this.pathAgents[index].cancel();
    this.clearSitArrival(index);
    this.arrivalCallbacks[index] = undefined;
    this.setPhysicsMode(index, AgentBehavior.IDLE);
  }

  /**
   * Instantly teleport every agent to their original spawn POI — no pathfinding,
   * no arrival callbacks. Spawn POIs are reassigned in sorted ID order, mirroring
   * the order used during initialisation.
   *
   * @param playerIndex  Index of the player character (teleported to world origin).
   * @param npcIndices   Indices of all NPC agents, in the desired spawn-assignment order.
   */
  public warpAllToSpawn(playerIndex: number, npcIndices: number[]): void {
    // 1. Release all POIs so spawn slots are free
    this.poiManager.releaseAll(playerIndex);
    npcIndices.forEach(i => this.poiManager.releaseAll(i));

    // 2. Cancel in-flight paths and snap physics to IDLE
    this.cancelMovement(playerIndex);
    npcIndices.forEach(i => this.cancelMovement(i));

    // 3. Teleport player to world origin
    this.characterManager.setPosition(playerIndex, new THREE.Vector3(0, 0, 0));
    this.play(playerIndex, 'idle');

    // 4. Reassign spawn POIs in sorted order (same as initInstances)
    const spawnPois = this.poiManager.getPoisByPrefix('spawn');
    npcIndices.forEach((agentIndex, order) => {
      const poi = spawnPois[order % spawnPois.length];
      if (poi) {
        this.characterManager.setPosition(agentIndex, poi.position);
        this.characterManager.setOrientation(agentIndex, poi.quaternion);
        this.poiManager.occupy(poi.id, agentIndex);
      }
      this.play(agentIndex, 'idle');
    });
  }

  // ── Forwarded accessors ──────────────────────────────────────

  public getCPUPositions(): Float32Array | null {
    return this.characterManager.getCPUPositions();
  }

  public getCPUPosition(index: number): THREE.Vector3 | null {
    return this.characterManager.getCPUPosition(index);
  }

  public getCount(): number {
    return this.characterManager.getCount();
  }

  public getAgentStateBuffer(): AgentStateBuffer | null {
    return this.characterManager.getAgentStateBuffer();
  }

  public setColors(): void {
    this.characterManager.setColors();
    // Re-sync components after recreation
    const newCount = this.characterManager.getCount();
    const stateBuffer = this.characterManager.getAgentStateBuffer()!;
    this.pathAgents = [];
    this.separationScratch = new Float32Array(newCount * 2);
    this.walkFacing = new Float32Array(newCount * 2);
    this.sitIntents = new Array(newCount).fill(null);
    this.sitMotions = new Array(newCount).fill(null);
    this.arrivalCallbacks = [];
    for (let i = 0; i < newCount; i++) {
      this.pathAgents.push(new PathAgent(i, stateBuffer));
      this.walkFacing[i * 2] = 0;
      this.walkFacing[i * 2 + 1] = 1;
    }
    this.stateMachine = new CharacterStateMachine(newCount);
  }

  public setInstanceCount(count: number): void {
    this.characterManager.setInstanceCount(count);
    // Re-sync path agents and state machine after resize
    const newCount = this.characterManager.getCount();
    const stateBuffer = this.characterManager.getAgentStateBuffer()!;
    this.pathAgents = [];
    this.separationScratch = new Float32Array(newCount * 2);
    this.walkFacing = new Float32Array(newCount * 2);
    this.sitIntents = new Array(newCount).fill(null);
    this.sitMotions = new Array(newCount).fill(null);
    this.arrivalCallbacks = [];
    for (let i = 0; i < newCount; i++) {
      this.pathAgents.push(new PathAgent(i, stateBuffer));
      this.walkFacing[i * 2] = 0;
      this.walkFacing[i * 2 + 1] = 1;
    }
    this.stateMachine = new CharacterStateMachine(newCount);
  }

  public get isLoaded(): boolean {
    return this.characterManager.isLoaded;
  }

  // ── ICharacterDriver implementation ──────────────────────────

  public setPhysicsMode(index: number, mode: AgentBehavior): void {
    this.characterManager.setPhysicsMode(index, mode);
  }

  public setAnimation(index: number, name: AnimationName, loop: boolean = true): void {
    this.characterManager.setAnimation(index, name, loop);
  }

  public setExpression(index: number, key: ExpressionKey): void {
    this.characterManager.setExpression(index, key);
  }

  public getAgentState(index: number): AgentBehavior {
    return this.characterManager.getAgentState(index);
  }

  /** True while PathAgent is actively following a nav path. */
  public isPathing(index: number): boolean {
    return this.pathAgents[index]?.isMoving ?? false;
  }

  /** Current smoothed walk facing (XZ). */
  public getWalkFacing(index: number): { x: number; z: number } {
    return {
      x: this.walkFacing[index * 2] ?? 0,
      z: this.walkFacing[index * 2 + 1] ?? 1,
    };
  }

  /** Dev/QA: walk agent to XZ without needing THREE in the console. */
  public debugWalkTo(index: number, x: number, z: number): boolean {
    const from = this.getCPUPosition(index);
    const y = from?.y ?? 0;
    return this.moveTo(index, new THREE.Vector3(x, y, z), 'idle', undefined, from ?? undefined);
  }

  public getAnimationDuration(name: AnimationName): number {
    return this.characterManager.getAnimationDuration(name);
  }
}
