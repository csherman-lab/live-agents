import { describe, expect, it } from 'vitest';
import {
  mirrorPlacementKey,
  shouldDeferPlacementChange,
  shouldEscapeAfterFails,
} from './MirrorPresenceDirector';

describe('MirrorPresenceDirector helpers', () => {
  it('builds stable placement keys', () => {
    expect(mirrorPlacementKey('desk', 'sit_work')).toBe('desk:sit_work');
  });

  it('defers placement changes while settling after arrival', () => {
    const now = 10_000;
    expect(
      shouldDeferPlacementChange({
        now,
        holdUntil: 12_000,
        currentKey: 'desk:sit_work',
        nextKey: 'lounge:sit_idle',
        pathing: false,
      }),
    ).toBe(true);
  });

  it('does not defer when hold expired', () => {
    expect(
      shouldDeferPlacementChange({
        now: 13_000,
        holdUntil: 12_000,
        currentKey: 'desk:sit_work',
        nextKey: 'lounge:sit_idle',
        pathing: false,
      }),
    ).toBe(false);
  });

  it('does not defer same placement pose refresh', () => {
    expect(
      shouldDeferPlacementChange({
        now: 10_000,
        holdUntil: 12_000,
        currentKey: 'stage:talk',
        nextKey: 'stage:talk',
        pathing: false,
      }),
    ).toBe(false);
  });

  it('defers retarget while stand/sit_down even after hold', () => {
    expect(
      shouldDeferPlacementChange({
        now: 13_000,
        holdUntil: 0,
        currentKey: 'desk:sit_work',
        nextKey: 'board:look_around',
        pathing: true,
        blockingTransition: true,
      }),
    ).toBe(true);
  });

  it('escapes only after consecutive path failures', () => {
    expect(shouldEscapeAfterFails(2, 3)).toBe(false);
    expect(shouldEscapeAfterFails(3, 3)).toBe(true);
  });
});
