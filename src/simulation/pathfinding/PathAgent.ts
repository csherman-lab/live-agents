import * as THREE from 'three/webgpu';
import { AgentStateBuffer } from '../behavior/AgentStateBuffer';
import { PATH_NODE_ARRIVAL } from '../constants';

/**
 * Manages path-following for a single agent on the CPU side.
 *
 * Wave 12: CharacterController owns eased locomotion + yaw; PathAgent
 * tracks waypoints, remaining distance, and segment geometry for easing hooks.
 * Waypoint buffer writes are only used as facing overrides while IDLE.
 */
export class PathAgent {
  private path: THREE.Vector3[] = [];
  private nodeIndex = 0;
  /** Start of the current segment (previous node / path start). */
  private segmentStart = new THREE.Vector3();
  public isMoving = false;

  constructor(
    private readonly agentIndex: number,
    private readonly stateBuffer: AgentStateBuffer,
  ) {}

  /** Start following a new path. */
  public setPath(path: THREE.Vector3[], fromPos?: THREE.Vector3): void {
    this.path = path;
    let prepended = false;
    if (fromPos && path.length > 0) {
      const firstNode = path[0];
      const distSq = (firstNode.x - fromPos.x) ** 2 + (firstNode.z - fromPos.z) ** 2;
      if (distSq > 0.0001) {
        this.path = [fromPos.clone(), ...path];
        prepended = true;
      }
    }
    this.nodeIndex = 0;
    this.isMoving = this.path.length > 0;
    if (this.isMoving) {
      if (prepended && this.path.length > 1) {
        this.nodeIndex = 1;
        this.segmentStart.copy(this.path[0]);
      } else {
        this.segmentStart.copy(fromPos ?? this.path[0]);
      }
    }
  }

  /** Cancel the current path. */
  public cancel(): void {
    this.path = [];
    this.nodeIndex = 0;
    this.isMoving = false;
  }

  /**
   * Advance to the next path node when the agent is close enough.
   * @returns true when the agent has reached the final destination.
   */
  public update(currentPos: THREE.Vector3): boolean {
    if (!this.isMoving || this.path.length === 0) return false;

    const target = this.path[this.nodeIndex];
    const dx = target.x - currentPos.x;
    const dz = target.z - currentPos.z;
    const dist2 = dx * dx + dz * dz;

    if (dist2 < PATH_NODE_ARRIVAL * PATH_NODE_ARRIVAL) {
      this.nodeIndex++;
      if (this.nodeIndex >= this.path.length) {
        this.isMoving = false;
        return true;
      }
      this.segmentStart.copy(target);
    }

    return false;
  }

  /** Returns the current target waypoint. */
  public getTarget(): THREE.Vector3 | null {
    if (!this.isMoving || this.path.length === 0) return null;
    return this.path[this.nodeIndex];
  }

  /** Next waypoint after the current target, if any (corner lookahead). */
  public getNextTarget(): THREE.Vector3 | null {
    if (!this.isMoving || this.nodeIndex + 1 >= this.path.length) return null;
    return this.path[this.nodeIndex + 1];
  }

  /** Start of the active segment (XZ). */
  public getSegmentStart(): THREE.Vector3 {
    return this.segmentStart;
  }

  /** XZ length of the active segment. */
  public getSegmentLength(): number {
    if (!this.isMoving || this.path.length === 0) return 0;
    const target = this.path[this.nodeIndex];
    return Math.hypot(target.x - this.segmentStart.x, target.z - this.segmentStart.z);
  }

  /** Approximate remaining path length from currentPos along remaining nodes. */
  public getRemainingDistance(currentPos: THREE.Vector3): number {
    if (!this.isMoving || this.path.length === 0) return 0;
    let dist = 0;
    let prevX = currentPos.x;
    let prevZ = currentPos.z;
    for (let i = this.nodeIndex; i < this.path.length; i++) {
      const n = this.path[i];
      dist += Math.hypot(n.x - prevX, n.z - prevZ);
      prevX = n.x;
      prevZ = n.z;
    }
    return dist;
  }

  /** Returns the last direction vector of the current path. */
  public getLastDirection(): THREE.Vector3 {
    if (this.path.length < 2) return new THREE.Vector3(0, 0, 1);
    const last = this.path[this.path.length - 1];
    const prev = this.path[this.path.length - 2];
    return new THREE.Vector3().subVectors(last, prev).normalize();
  }

  /** Desired XZ move direction toward the current waypoint. */
  public getDesiredDirection(currentPos: THREE.Vector3): THREE.Vector3 {
    const target = this.getTarget();
    if (!target) return new THREE.Vector3(0, 0, 1);
    const dx = target.x - currentPos.x;
    const dz = target.z - currentPos.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-5) {
      const next = this.getNextTarget();
      if (next) {
        const ndx = next.x - currentPos.x;
        const ndz = next.z - currentPos.z;
        const nlen = Math.hypot(ndx, ndz) || 1;
        return new THREE.Vector3(ndx / nlen, 0, ndz / nlen);
      }
      return this.getLastDirection();
    }
    return new THREE.Vector3(dx / len, 0, dz / len);
  }

  /** Write facing into the shared waypoint/facing slots (IDLE mode). */
  public writeFacing(x: number, z: number): void {
    this.stateBuffer.setFacing(this.agentIndex, x, z);
  }
}
