import { describe, expect, it } from 'vitest';
import { buildMirrorSystem, MAX_MIRROR_AGENTS, MIRROR_EMPTY_LEAD_ID } from './buildMirrorSystem';
import type { PresenceAgent } from './presenceTypes';

function agent(partial: Partial<PresenceAgent> & Pick<PresenceAgent, 'agentId' | 'name'>): PresenceAgent {
  return {
    state: 'idle',
    provider: 'cursor',
    lastTs: 1,
    parentId: null,
    ...partial,
  };
}

describe('buildMirrorSystem', () => {
  it('builds empty user-only office when roster is empty', () => {
    const { system, indexByAgentId, empty } = buildMirrorSystem([]);
    expect(empty).toBe(true);
    expect(system.leadAgent.id).toBe(MIRROR_EMPTY_LEAD_ID);
    expect(Object.keys(indexByAgentId)).toHaveLength(0);
  });

  it('assigns indices and respects appearance overrides', () => {
    const agents = [
      agent({ agentId: 'lead', name: 'Composer' }),
      agent({ agentId: 'child', name: 'Explore', parentId: 'lead' }),
    ];
    const { system, indexByAgentId, empty } = buildMirrorSystem(agents, {
      child: { name: 'Scout', color: '#112233', accessory: 4 },
    });
    expect(empty).toBe(false);
    expect(indexByAgentId.lead).toBe(1);
    expect(indexByAgentId.child).toBe(2);
    expect(system.leadAgent.name).toBe('Cursor');
    expect(system.leadAgent.color).toBe('#4285F4');
    expect(system.leadAgent.subagents?.[0].name).toBe('Scout');
    expect(system.leadAgent.subagents?.[0].color).toBe('#112233');
    expect(system.leadAgent.subagents?.[0].accessory).toBe(4);
  });

  it('keeps specialist default names and non-blue colors', () => {
    const agents = [
      agent({ agentId: 'lead', name: 'Cursor' }),
      agent({ agentId: 'e', name: 'Explore', parentId: 'lead' }),
      agent({ agentId: 's', name: 'Shell', parentId: 'lead' }),
    ];
    const { system } = buildMirrorSystem(agents);
    expect(system.leadAgent.name).toBe('Cursor');
    expect(system.leadAgent.color).toBe('#4285F4');
    expect(system.leadAgent.subagents?.[0].name).toBe('Explore');
    expect(system.leadAgent.subagents?.[0].color).not.toBe('#4285F4');
    expect(system.leadAgent.subagents?.[1].name).toBe('Shell');
  });

  it('caps at MAX_MIRROR_AGENTS', () => {
    const agents = Array.from({ length: MAX_MIRROR_AGENTS + 5 }, (_, i) =>
      agent({ agentId: `a${i}`, name: `A${i}` }),
    );
    const { indexByAgentId } = buildMirrorSystem(agents);
    expect(Object.keys(indexByAgentId)).toHaveLength(MAX_MIRROR_AGENTS);
  });
});
