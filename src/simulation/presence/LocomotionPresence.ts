/**
 * Locomotion presence — walk cycle rate sync + start/stop gait gates.
 * Pure logic; CharacterController applies the results.
 */

export interface GaitGateOptions {
  /** Seconds of continuous pathing before emitting 'walk'. */
  commitTime: number;
  /** Seconds after path end before emitting 'idle'. */
  settleTime: number;
}

/**
 * Choose a playback rate so cruise * (duration / rate) ≈ strideLength.
 * Clamped to [0.5, 2.0] so extreme speeds don't look broken.
 */
export function computeWalkPlaybackRate(
  cruiseSpeed: number,
  strideLength: number,
  walkDuration: number,
): number {
  if (walkDuration <= 0 || strideLength <= 0 || cruiseSpeed <= 0) return 1;
  // distance per cycle at rate 1 = cruise * duration; we want stride
  // rate = (cruise * duration) / stride
  const raw = (cruiseSpeed * walkDuration) / strideLength;
  return Math.min(2.0, Math.max(0.5, raw));
}

type GaitPhase = 'idle' | 'committing' | 'walking' | 'settling';

/**
 * Delays walk enter / idle exit so animation doesn't pop mid-stride.
 * `update` returns a desired state key only when a transition should fire.
 */
export class GaitGate {
  private phase: GaitPhase = 'idle';
  private timer = 0;
  private readonly commitTime: number;
  private readonly settleTime: number;

  constructor(opts: GaitGateOptions) {
    this.commitTime = opts.commitTime;
    this.settleTime = opts.settleTime;
  }

  public onPathStart(): void {
    if (this.phase === 'walking') return;
    this.phase = 'committing';
    this.timer = 0;
  }

  public onPathEnd(): void {
    if (this.phase === 'idle') return;
    this.phase = 'settling';
    this.timer = 0;
  }

  /**
   * @param dt seconds
   * @param isPathing whether the agent still has an active path / sit approach
   * @returns 'walk' | 'idle' when a state change should be applied; else null
   */
  public update(dt: number, isPathing: boolean): 'walk' | 'idle' | null {
    if (isPathing && (this.phase === 'idle' || this.phase === 'settling')) {
      this.onPathStart();
    }
    if (!isPathing && (this.phase === 'committing' || this.phase === 'walking')) {
      this.onPathEnd();
    }

    this.timer += dt;

    if (this.phase === 'committing' && this.timer >= this.commitTime) {
      this.phase = 'walking';
      this.timer = 0;
      return 'walk';
    }

    if (this.phase === 'settling' && this.timer >= this.settleTime) {
      this.phase = 'idle';
      this.timer = 0;
      return 'idle';
    }

    return null;
  }

  public getPhase(): GaitPhase {
    return this.phase;
  }

  public reset(): void {
    this.phase = 'idle';
    this.timer = 0;
  }
}

export interface FacingXZ {
  x: number;
  z: number;
}

/**
 * Rotate current XZ facing toward desired at `turnRate` rad/s (shortest arc).
 * Used for conversation approach / hold facing (Wave 5).
 */
export function blendFacingXZ(
  current: FacingXZ,
  desired: FacingXZ,
  turnRate: number,
  dt: number,
): FacingXZ {
  let fx = current.x;
  let fz = current.z;
  const flen = Math.hypot(fx, fz) || 1;
  fx /= flen;
  fz /= flen;

  const dlen = Math.hypot(desired.x, desired.z);
  if (dlen < 1e-5) return { x: fx, z: fz };
  const dx = desired.x / dlen;
  const dz = desired.z / dlen;

  const dot = Math.max(-1, Math.min(1, fx * dx + fz * dz));
  const cross = fx * dz - fz * dx;
  const angle = Math.atan2(cross, dot);
  const maxStep = turnRate * Math.max(0, dt);
  const step = Math.max(-maxStep, Math.min(maxStep, angle));

  if (Math.abs(step) <= 1e-6) return { x: dx, z: dz };

  const c = Math.cos(step);
  const s = Math.sin(step);
  const nfx = fx * c - fz * s;
  const nfz = fx * s + fz * c;
  const nlen = Math.hypot(nfx, nfz) || 1;
  return { x: nfx / nlen, z: nfz / nlen };
}
