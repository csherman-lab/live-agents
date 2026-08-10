import type { PresenceBehavior } from './mapPresenceBehavior';
import { mirrorPlacementKey } from './mirrorLocomotion';

export { mirrorPlacementKey };

/** How long to keep a settled placement before allowing a retarget (ms). */
export const MIRROR_PLACEMENT_HOLD_MS = 2800;

/** Consecutive failed walk/move attempts before soft escape-to-spawn. */
export const MIRROR_ESCAPE_FAIL_THRESHOLD = 3;

export function shouldDeferPlacementChange(opts: {
  now: number;
  holdUntil: number;
  currentKey: string | null;
  nextKey: string;
  pathing: boolean;
  /** stand / sit_down — never cancel these clips mid-way. */
  blockingTransition?: boolean;
}): boolean {
  if (opts.blockingTransition) return true;
  if (opts.currentKey != null && opts.currentKey === opts.nextKey) return false;
  if (opts.holdUntil > opts.now) return true;
  return false;
}

export function shouldEscapeAfterFails(
  consecutiveFails: number,
  threshold = MIRROR_ESCAPE_FAIL_THRESHOLD,
): boolean {
  return consecutiveFails >= threshold;
}

export interface MirrorDirectorSnapshot {
  desired: PresenceBehavior | null;
  pending: PresenceBehavior | null;
  inFlight: string | null;
  arrived: string | null;
  holdUntil: number;
  failCount: number;
}

/**
 * Intent + hysteresis for Cursor companion locomotion.
 * SceneManager executes walks; this class decides when retargets are allowed.
 */
export class MirrorPresenceDirector {
  private desired = new Map<number, PresenceBehavior>();
  private pending = new Map<number, PresenceBehavior>();
  private arrived = new Map<number, string>();
  private inFlight = new Map<number, string>();
  private holdUntil = new Map<number, number>();
  private failCount = new Map<number, number>();

  clearIndex(index: number): void {
    this.desired.delete(index);
    this.pending.delete(index);
    this.arrived.delete(index);
    this.inFlight.delete(index);
    this.holdUntil.delete(index);
    this.failCount.delete(index);
  }

  /** Latest behavior (including deferred pending for display/dim). */
  getDesired(index: number): PresenceBehavior | undefined {
    return this.pending.get(index) ?? this.desired.get(index);
  }

  /** Behavior currently driving locomotion (may lag pending during hold). */
  getActive(index: number): PresenceBehavior | undefined {
    return this.desired.get(index);
  }

  getArrived(index: number): string | undefined {
    return this.arrived.get(index);
  }

  getInFlight(index: number): string | undefined {
    return this.inFlight.get(index);
  }

  snapshot(index: number): MirrorDirectorSnapshot {
    return {
      desired: this.desired.get(index) ?? null,
      pending: this.pending.get(index) ?? null,
      inFlight: this.inFlight.get(index) ?? null,
      arrived: this.arrived.get(index) ?? null,
      holdUntil: this.holdUntil.get(index) ?? 0,
      failCount: this.failCount.get(index) ?? 0,
    };
  }

  entries(): IterableIterator<[number, PresenceBehavior]> {
    return this.desired.entries();
  }

  /**
   * Record a presence intent. Returns the behavior that should drive locomotion
   * right now (may be the previous one if retarget is deferred).
   */
  setIntent(
    index: number,
    behavior: PresenceBehavior,
    opts: { now?: number; pathing: boolean; blockingTransition: boolean },
  ): PresenceBehavior {
    const now = opts.now ?? performance.now();
    const nextKey = mirrorPlacementKey(behavior.placement, behavior.characterState);
    const active = this.desired.get(index);
    const activeKey = active
      ? mirrorPlacementKey(active.placement, active.characterState)
      : this.arrived.get(index) ?? this.inFlight.get(index) ?? null;

    const defer = shouldDeferPlacementChange({
      now,
      holdUntil: this.holdUntil.get(index) ?? 0,
      currentKey: activeKey,
      nextKey,
      pathing: opts.pathing,
      blockingTransition: opts.blockingTransition,
    });

    if (defer && active && activeKey !== nextKey) {
      this.pending.set(index, behavior);
      return active;
    }

    this.pending.delete(index);
    this.desired.set(index, behavior);
    return behavior;
  }

  /** Promote deferred intents once holds/transitions clear. */
  promotePending(
    index: number,
    opts: { now?: number; pathing: boolean; blockingTransition: boolean },
  ): PresenceBehavior | null {
    const pending = this.pending.get(index);
    if (!pending) return null;
    const now = opts.now ?? performance.now();
    if (opts.blockingTransition) return null;
    if ((this.holdUntil.get(index) ?? 0) > now) return null;
    if (opts.pathing) return null;

    this.pending.delete(index);
    this.desired.set(index, pending);
    return pending;
  }

  markInFlight(index: number, key: string): void {
    this.inFlight.set(index, key);
    this.arrived.delete(index);
  }

  clearInFlight(index: number): void {
    this.inFlight.delete(index);
  }

  markArrived(index: number, key: string, now = performance.now()): void {
    this.arrived.set(index, key);
    this.inFlight.delete(index);
    this.failCount.set(index, 0);
    this.holdUntil.set(index, now + MIRROR_PLACEMENT_HOLD_MS);
  }

  clearArrived(index: number): void {
    this.arrived.delete(index);
  }

  /** Returns true when the caller should soft-escape to spawn. */
  noteWalkResult(index: number, ok: boolean): boolean {
    if (ok) {
      this.failCount.set(index, 0);
      return false;
    }
    const next = (this.failCount.get(index) ?? 0) + 1;
    this.failCount.set(index, next);
    return shouldEscapeAfterFails(next);
  }

  resetFails(index: number): void {
    this.failCount.set(index, 0);
  }
}
