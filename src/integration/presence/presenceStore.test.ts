import { beforeEach, describe, expect, it } from 'vitest';
import { createPresenceEvent } from './presenceTypes';
import { listPresenceAgents, usePresenceStore } from './presenceStore';
import { shouldApplyHubPresenceEvent } from './presenceLiveGate';

describe('presenceStore', () => {
  beforeEach(() => {
    usePresenceStore.getState().clear();
    usePresenceStore.setState({
      connected: false,
      hubOnline: false,
      hubHealth: null,
      hubFailStreak: 0,
      mirrorMode: true,
      productMode: 'mirror',
      previousTeamId: null,
      demoSwarmActive: false,
      activity: [],
      lastEventAt: null,
    });
  });

  it('upserts and removes agents', () => {
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'a', name: 'Alpha', state: 'thinking' }),
    );
    expect(listPresenceAgents()).toHaveLength(1);
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'a', name: 'Alpha', state: 'done', op: 'remove' }),
    );
    expect(listPresenceAgents()).toHaveLength(0);
  });

  it('lead remove via applyEvent clears children (session end)', () => {
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'c1', name: 'Cursor', state: 'thinking', ts: 1 }),
    );
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({
        agentId: 's1',
        name: 'Explore',
        state: 'working',
        parentId: 'c1',
        ts: 2,
      }),
    );
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({
        agentId: 'c1',
        name: 'Cursor',
        state: 'done',
        op: 'remove',
        ts: 3,
      }),
    );
    expect(listPresenceAgents()).toHaveLength(0);
  });

  it('removeTree clears children when parent is removed', () => {
    usePresenceStore.getState().upsert(
      createPresenceEvent({ agentId: 'lead', name: 'Lead', state: 'working', ts: 1 }),
    );
    usePresenceStore.getState().upsert(
      createPresenceEvent({
        agentId: 'child',
        name: 'Child',
        state: 'working',
        parentId: 'lead',
        ts: 2,
      }),
    );
    usePresenceStore.getState().removeTree('lead');
    expect(listPresenceAgents()).toHaveLength(0);
  });

  it('ignores stale timestamps', () => {
    usePresenceStore.getState().upsert(
      createPresenceEvent({ agentId: 'a', name: 'A', state: 'working', ts: 100 }),
    );
    usePresenceStore.getState().upsert(
      createPresenceEvent({ agentId: 'a', name: 'A', state: 'idle', ts: 50 }),
    );
    expect(usePresenceStore.getState().agents.a.state).toBe('working');
  });

  it('setProductMode toggles mirrorMode', () => {
    usePresenceStore.getState().setProductMode('advanced', 'creative-agency');
    expect(usePresenceStore.getState().mirrorMode).toBe(false);
    expect(usePresenceStore.getState().previousTeamId).toBe('creative-agency');
    usePresenceStore.getState().setProductMode('mirror');
    expect(usePresenceStore.getState().mirrorMode).toBe(true);
  });

  it('setConnected(true) marks hub online', () => {
    usePresenceStore.getState().setConnected(true);
    expect(usePresenceStore.getState().hubOnline).toBe(true);
  });

  it('ignores stale health polls and requires consecutive failures', () => {
    usePresenceStore.getState().setHubHealth({
      ok: true,
      reachable: true,
      agentCount: 1,
      sseClients: 1,
      lastEventAt: 10,
      postCount: 3,
      checkedAt: 100,
    });
    expect(usePresenceStore.getState().hubOnline).toBe(true);

    usePresenceStore.getState().setHubHealth({
      ok: false,
      reachable: false,
      agentCount: 0,
      sseClients: 0,
      lastEventAt: null,
      postCount: 0,
      checkedAt: 50, // stale
    });
    expect(usePresenceStore.getState().hubOnline).toBe(true);
    expect(usePresenceStore.getState().hubHealth?.checkedAt).toBe(100);

    usePresenceStore.getState().setHubHealth({
      ok: false,
      reachable: false,
      agentCount: 0,
      sseClients: 0,
      lastEventAt: null,
      postCount: 0,
      checkedAt: 110,
    });
    expect(usePresenceStore.getState().hubOnline).toBe(true); // first failure keeps online
    expect(usePresenceStore.getState().hubHealth?.ok).toBe(true); // keep last good snapshot

    usePresenceStore.getState().setHubHealth({
      ok: false,
      reachable: false,
      agentCount: 0,
      sseClients: 0,
      lastEventAt: null,
      postCount: 0,
      checkedAt: 120,
    });
    expect(usePresenceStore.getState().hubOnline).toBe(false);
    expect(usePresenceStore.getState().hubHealth?.ok).toBe(false);
  });

  it('applyEvent keeps agents and activity in sync', () => {
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'cursor', name: 'Cursor', state: 'working' }),
    );
    const s = usePresenceStore.getState();
    expect(Object.keys(s.agents)).toEqual(['cursor']);
    expect(s.activity[0]?.name).toBe('Cursor');
  });

  it('remove of last agent clears demoSwarmActive', () => {
    usePresenceStore.getState().setDemoSwarmActive(true);
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'cursor-lead', name: 'Cursor', state: 'working' }),
    );
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({
        agentId: 'cursor-lead',
        name: 'Cursor',
        state: 'done',
        op: 'remove',
      }),
    );
    expect(listPresenceAgents()).toHaveLength(0);
    expect(usePresenceStore.getState().demoSwarmActive).toBe(false);
  });

  it('clear() exits the demo swarm one-way door: empties roster and re-opens the hub gate', () => {
    usePresenceStore.getState().setDemoSwarmActive(true);
    usePresenceStore.getState().applyEvent(
      createPresenceEvent({ agentId: 'cursor-lead', name: 'Cursor', state: 'working' }),
    );
    expect(listPresenceAgents()).toHaveLength(1);
    expect(shouldApplyHubPresenceEvent(usePresenceStore.getState().demoSwarmActive)).toBe(false);

    usePresenceStore.getState().clear();

    expect(usePresenceStore.getState().demoSwarmActive).toBe(false);
    expect(listPresenceAgents()).toHaveLength(0);
    // Hub/SSE events apply again once the demo swarm no longer owns the roster.
    expect(shouldApplyHubPresenceEvent(usePresenceStore.getState().demoSwarmActive)).toBe(true);
  });
});
