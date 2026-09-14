import { describe, expect, it } from 'vitest';
import { ConversationSession } from './ConversationSession';

describe('ConversationSession', () => {
  it('both participants listen until a speaker is set', () => {
    const s = new ConversationSession(1, 2);
    s.begin();
    expect(s.roleOf(1)).toBe('listen');
    expect(s.roleOf(2)).toBe('listen');
    expect(s.isActive).toBe(true);
  });

  it('only the speaker talks; the other listens', () => {
    const s = new ConversationSession(1, 2);
    s.begin();
    s.setSpeaker(1);
    expect(s.roleOf(1)).toBe('talk');
    expect(s.roleOf(2)).toBe('listen');
    s.setSpeaker(2);
    expect(s.roleOf(1)).toBe('listen');
    expect(s.roleOf(2)).toBe('talk');
  });

  it('clearing speaker returns both to listen', () => {
    const s = new ConversationSession(0, 3);
    s.begin();
    s.setSpeaker(3);
    s.setSpeaker(null);
    expect(s.roleOf(0)).toBe('listen');
    expect(s.roleOf(3)).toBe('listen');
  });

  it('facing dirs point each participant toward the other', () => {
    const s = new ConversationSession(0, 1);
    s.begin();
    // A at origin, B at +X
    const facing = s.facingDirs(
      { x: 0, z: 0 },
      { x: 2, z: 0 },
    );
    expect(facing.a.x).toBeGreaterThan(0.9);
    expect(Math.abs(facing.a.z)).toBeLessThan(0.1);
    expect(facing.b.x).toBeLessThan(-0.9);
  });

  it('end clears active and rejects speaker changes', () => {
    const s = new ConversationSession(1, 2);
    s.begin();
    s.end();
    expect(s.isActive).toBe(false);
    s.setSpeaker(1);
    expect(s.roleOf(1)).toBe('listen');
  });

  it('isParticipant only for the two indices', () => {
    const s = new ConversationSession(4, 7);
    expect(s.isParticipant(4)).toBe(true);
    expect(s.isParticipant(7)).toBe(true);
    expect(s.isParticipant(5)).toBe(false);
  });
});
