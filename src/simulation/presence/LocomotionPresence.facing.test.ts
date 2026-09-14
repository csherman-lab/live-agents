import { describe, expect, it } from 'vitest';
import { blendFacingXZ } from './LocomotionPresence';

describe('blendFacingXZ', () => {
  it('moves toward desired facing over time', () => {
    const start = { x: 0, z: 1 };
    const desired = { x: 1, z: 0 };
    const mid = blendFacingXZ(start, desired, Math.PI, 0.2);
    // Should have rotated toward +X
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.z).toBeGreaterThan(0);
    const end = blendFacingXZ(mid, desired, Math.PI, 2);
    expect(end.x).toBeCloseTo(1, 1);
    expect(Math.abs(end.z)).toBeLessThan(0.2);
  });

  it('handles zero-length desired by returning current', () => {
    const cur = { x: 0, z: 1 };
    const out = blendFacingXZ(cur, { x: 0, z: 0 }, 1, 0.1);
    expect(out.x).toBeCloseTo(0);
    expect(out.z).toBeCloseTo(1);
  });
});
