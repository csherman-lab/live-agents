import { describe, expect, it } from 'vitest';
import {
  GaitGate,
  computeWalkPlaybackRate,
} from './LocomotionPresence';

describe('computeWalkPlaybackRate', () => {
  it('returns 1 when walk duration is zero or negative', () => {
    expect(computeWalkPlaybackRate(0.35, 0.4, 0)).toBe(1);
    expect(computeWalkPlaybackRate(0.35, 0.4, -1)).toBe(1);
  });

  it('returns 1 when stride length is non-positive', () => {
    expect(computeWalkPlaybackRate(0.35, 0, 1)).toBe(1);
  });

  it('scales rate with cruise speed (faster cruise → higher rate)', () => {
    const slow = computeWalkPlaybackRate(0.2, 0.4, 1.0);
    const fast = computeWalkPlaybackRate(0.4, 0.4, 1.0);
    expect(fast).toBeGreaterThan(slow);
  });

  it('targets distance-per-cycle ≈ stride when rate applied to duration', () => {
    const cruise = 0.35;
    const stride = 0.4;
    const duration = 0.8;
    const rate = computeWalkPlaybackRate(cruise, stride, duration);
    // distance covered in one visual cycle = cruise * (duration / rate)
    const distPerCycle = cruise * (duration / rate);
    expect(distPerCycle).toBeCloseTo(stride, 5);
  });

  it('clamps rate to a sane range', () => {
    const tiny = computeWalkPlaybackRate(0.01, 2.0, 0.5);
    const huge = computeWalkPlaybackRate(5.0, 0.1, 0.5);
    expect(tiny).toBeGreaterThanOrEqual(0.5);
    expect(huge).toBeLessThanOrEqual(2.0);
  });
});

describe('GaitGate', () => {
  it('does not enter walk immediately on path start', () => {
    const gate = new GaitGate({ commitTime: 0.12, settleTime: 0.1 });
    gate.onPathStart();
    expect(gate.update(0.05, true)).toBeNull();
    expect(gate.update(0.1, true)).toBe('walk');
  });

  it('settles before idle after path end', () => {
    const gate = new GaitGate({ commitTime: 0.05, settleTime: 0.15 });
    gate.onPathStart();
    expect(gate.update(0.06, true)).toBe('walk');
    gate.onPathEnd();
    expect(gate.update(0.05, false)).toBeNull();
    expect(gate.update(0.12, false)).toBe('idle');
  });

  it('cancels settle if pathing resumes', () => {
    const gate = new GaitGate({ commitTime: 0.05, settleTime: 0.2 });
    gate.onPathStart();
    gate.update(0.06, true);
    gate.onPathEnd();
    gate.onPathStart();
    expect(gate.update(0.01, true)).toBeNull();
    expect(gate.update(0.05, true)).toBe('walk');
  });
});
