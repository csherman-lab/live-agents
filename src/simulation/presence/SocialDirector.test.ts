import { describe, expect, it } from 'vitest';
import { SocialDirector, type SocialAgentSnapshot } from './SocialDirector';

function snap(partial: Partial<SocialAgentSnapshot> & { index: number }): SocialAgentSnapshot {
  return {
    index: partial.index,
    x: partial.x ?? 0,
    z: partial.z ?? 0,
    state: partial.state ?? 'idle',
    pathing: partial.pathing ?? false,
    busy: partial.busy ?? false,
    inPlayerChat: partial.inPlayerChat ?? false,
  };
}

const baseOpts = {
  ambientInterval: 0,
  ambientDuration: 5,
  noticeRadius: 1.5,
  noticeChance: 0,
  noticeCooldown: 10,
  ambientMeetupRadius: 8,
};

describe('SocialDirector', () => {
  it('emits ambient_meetup for nearby free agents', () => {
    const d = new SocialDirector(baseOpts);
    const actions = d.update(1, {
      agents: [
        snap({ index: 1, x: 0, z: 0 }),
        snap({ index: 2, x: 5, z: 0 }),
        snap({ index: 3, x: 20, z: 20 }),
      ],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: false,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    const start = actions.find((a) => a.type === 'ambient_meetup');
    expect(start).toBeTruthy();
    if (start?.type === 'ambient_meetup') {
      expect(new Set([start.a, start.b])).toEqual(new Set([1, 2]));
    }
  });

  it('does not start ambient when one is already active', () => {
    const d = new SocialDirector(baseOpts);
    const actions = d.update(1, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: true,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    expect(actions.some((a) => a.type === 'ambient_meetup')).toBe(false);
  });

  it('skips busy / pathing / player-chat agents', () => {
    const d = new SocialDirector(baseOpts);
    const actions = d.update(1, {
      agents: [
        snap({ index: 1, busy: true }),
        snap({ index: 2, x: 1 }),
        snap({ index: 3, x: 1.2, pathing: true }),
      ],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: false,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    expect(actions.some((a) => a.type === 'ambient_meetup')).toBe(false);
  });

  it('does not tick or end until ambientTalking', () => {
    const d = new SocialDirector({ ...baseOpts, ambientDuration: 2 });
    d.update(0.1, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: false,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    const mid = d.update(3, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: true,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    expect(mid.some((a) => a.type === 'ambient_end' || a.type === 'ambient_tick')).toBe(false);
  });

  it('emits ambient_end after duration once talking', () => {
    const d = new SocialDirector({ ...baseOpts, ambientDuration: 2 });
    d.update(0.1, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: false,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    const mid = d.update(1.5, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: true,
      hasPlayerSession: false,
      ambientTalking: true,
    });
    expect(mid.some((a) => a.type === 'ambient_end')).toBe(false);
    const end = d.update(1, {
      agents: [snap({ index: 1 }), snap({ index: 2, x: 1 })],
      playerIndex: 0,
      playerX: 50,
      playerZ: 50,
      hasAmbientSession: true,
      hasPlayerSession: false,
      ambientTalking: true,
    });
    expect(end.some((a) => a.type === 'ambient_end')).toBe(true);
  });

  it('notices nearby player with chance 1', () => {
    const d = new SocialDirector({
      ...baseOpts,
      ambientInterval: 999,
      noticeChance: 1,
      noticeCooldown: 30,
      noticeRadius: 2,
    });
    const actions = d.update(0.5, {
      agents: [snap({ index: 1, x: 0, z: 0 })],
      playerIndex: 0,
      playerX: 0.5,
      playerZ: 0,
      hasAmbientSession: false,
      hasPlayerSession: false,
      ambientTalking: false,
    });
    const notice = actions.find((a) => a.type === 'notice');
    expect(notice).toBeTruthy();
    if (notice?.type === 'notice') {
      expect(notice.index).toBe(1);
      expect(['wave', 'look_around']).toContain(notice.reaction);
    }
  });
});
