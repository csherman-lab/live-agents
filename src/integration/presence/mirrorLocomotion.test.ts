import { describe, expect, it } from 'vitest';
import { mirrorHudRows, shouldIgnoreCoreTaskLocomotion } from './mirrorLocomotion';
import type { PresenceAgent } from './presenceTypes';

describe('shouldIgnoreCoreTaskLocomotion', () => {
  it('ignores when mirrorMode', () => {
    expect(shouldIgnoreCoreTaskLocomotion(true)).toBe(true);
  });

  it('allows when advanced', () => {
    expect(shouldIgnoreCoreTaskLocomotion(false)).toBe(false);
  });
});

describe('mirrorHudRows', () => {
  it('shows one live row per agent, lead first — not history stacks', () => {
    const agents: PresenceAgent[] = [
      {
        agentId: 'cursor-explore',
        name: 'Explore',
        state: 'working',
        statusText: 'Working',
        parentId: 'cursor-lead',
        provider: 'cursor',
        lastTs: 200,
      },
      {
        agentId: 'cursor-lead',
        name: 'Cursor',
        state: 'working',
        statusText: 'Working',
        parentId: null,
        provider: 'cursor',
        lastTs: 100,
      },
      {
        agentId: 'cursor-review',
        name: 'Review',
        state: 'idle',
        statusText: 'Standing by',
        parentId: 'cursor-lead',
        provider: 'cursor',
        lastTs: 150,
      },
    ];
    const rows = mirrorHudRows(agents);
    expect(rows.map((r) => r.agentId)).toEqual([
      'cursor-lead',
      'cursor-explore',
      'cursor-review',
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[2]?.detail).toBe('Standing by');
  });
});
