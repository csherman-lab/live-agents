import { describe, expect, it } from 'vitest';
import {
  HoverReactionScheduler,
  isDoubleClick,
} from './InteractionPresence';

describe('isDoubleClick', () => {
  it('is false when no prior click', () => {
    expect(isDoubleClick(1000, null, 350)).toBe(false);
  });

  it('is true within threshold', () => {
    expect(isDoubleClick(1200, 1000, 350)).toBe(true);
  });

  it('is false after threshold', () => {
    expect(isDoubleClick(1500, 1000, 350)).toBe(false);
  });
});

describe('HoverReactionScheduler', () => {
  it('does not fire immediately for a new hover', () => {
    const s = new HoverReactionScheduler({ chance: 1, cooldownMs: 5000, minHoverMs: 400 });
    expect(s.tick(1, 100)).toBeNull();
  });

  it('fires after min hover when chance is 1', () => {
    const s = new HoverReactionScheduler({ chance: 1, cooldownMs: 5000, minHoverMs: 400 });
    s.tick(2, 100); // even → wave
    expect(s.tick(2, 550)).toBe('wave');
  });

  it('respects per-agent cooldown', () => {
    const s = new HoverReactionScheduler({ chance: 1, cooldownMs: 5000, minHoverMs: 100 });
    s.tick(2, 0);
    expect(s.tick(2, 150)).toBe('wave');
    s.tick(2, 200);
    expect(s.tick(2, 400)).toBeNull();
  });

  it('clears hover tracking on null', () => {
    const s = new HoverReactionScheduler({ chance: 1, cooldownMs: 0, minHoverMs: 200 });
    s.tick(4, 0);
    s.tick(null, 50);
    expect(s.tick(4, 300)).toBeNull(); // hover clock reset
    expect(s.tick(4, 550)).toBe('wave');
  });
});
