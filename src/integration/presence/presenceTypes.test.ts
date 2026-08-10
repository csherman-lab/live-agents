import { describe, expect, it } from 'vitest';
import { createPresenceEvent, parsePresenceEvent } from './presenceTypes';

describe('parsePresenceEvent', () => {
  it('accepts valid upsert', () => {
    const e = parsePresenceEvent({
      type: 'agent.presence',
      v: 1,
      ts: 1,
      agentId: 'a1',
      name: 'Explore',
      state: 'thinking',
      statusText: 'Searching…',
      parentId: 'lead',
      provider: 'cursor',
    });
    expect(e?.agentId).toBe('a1');
    expect(e?.state).toBe('thinking');
    expect(e?.statusText).toBe('Searching…');
    expect(e?.op).toBe('upsert');
  });

  it('rejects bad state', () => {
    expect(
      parsePresenceEvent({
        type: 'agent.presence',
        v: 1,
        ts: 1,
        agentId: 'x',
        name: 'X',
        state: 'nope',
      }),
    ).toBeNull();
  });

  it('accepts remove op', () => {
    const e = parsePresenceEvent({
      type: 'agent.presence',
      v: 1,
      ts: 2,
      agentId: 'a1',
      name: 'Explore',
      state: 'done',
      op: 'remove',
    });
    expect(e?.op).toBe('remove');
  });
});

describe('createPresenceEvent', () => {
  it('fills defaults', () => {
    const e = createPresenceEvent({
      agentId: 'lead',
      name: 'Lead',
      state: 'idle',
    });
    expect(e.type).toBe('agent.presence');
    expect(e.v).toBe(1);
    expect(e.provider).toBe('cursor');
    expect(e.op).toBe('upsert');
  });
});
