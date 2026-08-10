import { describe, expect, it } from 'vitest';
import { shouldApplyHubPresenceEvent } from './presenceLiveGate';

describe('shouldApplyHubPresenceEvent', () => {
  it('blocks all hub events while demo swarm is active', () => {
    expect(shouldApplyHubPresenceEvent(true)).toBe(false);
  });
  it('allows hub events when demo is off', () => {
    expect(shouldApplyHubPresenceEvent(false)).toBe(true);
  });
});
