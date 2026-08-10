import { useEffect, useRef } from 'react';
import type { SceneManager } from '../../simulation/SceneManager';
import { useCoreStore } from '../store/coreStore';
import { useUiStore } from '../store/uiStore';
import { useTeamStore } from '../store/teamStore';
import { useAgentAppearanceStore } from './agentAppearanceStore';
import {
  buildMirrorSystem,
  CURSOR_MIRROR_SET_ID,
  getMirrorNpcAgents,
} from './buildMirrorSystem';
import { getPresenceClient } from './PresenceClient';
import { mapPresenceBehavior } from './mapPresenceBehavior';
import { listPresenceAgents, usePresenceStore } from './presenceStore';

function idFingerprint(agents: ReturnType<typeof listPresenceAgents>): string {
  return agents
    .map((a) => a.agentId)
    .sort()
    .join('|');
}

function appearanceFingerprint(agents: ReturnType<typeof listPresenceAgents>): string {
  const looks = useAgentAppearanceStore.getState().byAgentId;
  return agents
    .map((a) => {
      const o = looks[a.agentId];
      return `${a.agentId}:${o?.name ?? ''}:${o?.color ?? ''}:${o?.accessory ?? ''}`;
    })
    .sort()
    .join('|');
}

function applyPresenceToScene(
  scene: SceneManager | null,
  agents: ReturnType<typeof listPresenceAgents>,
  indexByAgentId: Record<string, number>,
) {
  if (!scene) return;

  for (const agent of agents) {
    const index = indexByAgentId[agent.agentId];
    if (index == null) continue;
    const isLead = !agent.parentId;
    const behavior = mapPresenceBehavior(agent.state, agent.statusText, { isLead });
    useUiStore.getState().setAgentStatus(index, behavior.agentState);
    scene.applyMirrorPresence(index, behavior);
  }
}

function syncStatusTexts(
  agents: ReturnType<typeof listPresenceAgents>,
  indexByAgentId: Record<string, number>,
) {
  const statusTexts: Record<number, string> = {};
  for (const agent of agents) {
    const index = indexByAgentId[agent.agentId];
    if (index == null) continue;
    const behavior = mapPresenceBehavior(agent.state, agent.statusText, {
      isLead: !agent.parentId,
    });
    // "Working" is published by SceneManager only after arrival (no hallway bubbles).
    statusTexts[index] = behavior.bubblePrimary === 'Working' ? '' : behavior.bubblePrimary;
    useUiStore.getState().setAgentStatus(index, behavior.agentState);
  }
  const prev = usePresenceStore.getState().agentStatusTexts;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(statusTexts);
  const unchanged =
    prevKeys.length === nextKeys.length &&
    nextKeys.every((k) => prev[Number(k)] === statusTexts[Number(k)]);
  if (!unchanged) {
    usePresenceStore.getState().setAgentStatusTexts(statusTexts);
  }
}

function ensureMirrorTeamActive(system: ReturnType<typeof buildMirrorSystem>['system']) {
  const team = useTeamStore.getState();
  if (team.selectedAgentSetId !== CURSOR_MIRROR_SET_ID) {
    usePresenceStore.getState().setProductMode('mirror', team.selectedAgentSetId);
    useUiStore.getState().setSkipProjectResetOnTeamChange(true);
  }
  team.saveCustomSystem(system);
  if (team.selectedAgentSetId !== CURSOR_MIRROR_SET_ID) {
    team.setActiveTeam(CURSOR_MIRROR_SET_ID);
  }
}

function syncRosterIds(
  sceneManager: SceneManager | null,
  prevIndexByAgentId: Record<string, number>,
) {
  const agents = listPresenceAgents();
  const appearances = useAgentAppearanceStore.getState().byAgentId;
  const { system, indexByAgentId, empty } = buildMirrorSystem(agents, appearances);

  const npcCount = getMirrorNpcAgents(system).length;
  // Resize instances before any setAgentStatus / pose calls (avoids state-machine OOB crashes).
  useUiStore.getState().setInstanceCount(npcCount + 1);
  usePresenceStore.getState().setIndexMap(indexByAgentId);
  ensureMirrorTeamActive(system);
  syncStatusTexts(agents, indexByAgentId);

  const prevIds = new Set(Object.keys(prevIndexByAgentId));
  const warpIndices = Object.entries(indexByAgentId)
    .filter(([agentId]) => !prevIds.has(agentId))
    .map(([, index]) => index);

  // First paint / empty→occupied / occupied→empty: warp all current NPCs
  const fullWarp =
    prevIds.size === 0 || empty || (prevIds.size > 0 && npcCount === 0);
  const indicesToWarp = fullWarp
    ? getMirrorNpcAgents(system).map((a) => a.index)
    : warpIndices;

  if (sceneManager) {
    sceneManager.applyMirrorRoster(system, {
      warpIndices: indicesToWarp,
      empty,
    });
  }

  return { agents, indexByAgentId };
}

function syncAppearanceOnly(sceneManager: SceneManager | null) {
  const agents = listPresenceAgents();
  const appearances = useAgentAppearanceStore.getState().byAgentId;
  const { system, indexByAgentId } = buildMirrorSystem(agents, appearances);

  syncStatusTexts(agents, indexByAgentId);
  usePresenceStore.getState().setIndexMap(indexByAgentId);
  ensureMirrorTeamActive(system);

  if (sceneManager) {
    sceneManager.refreshMirrorAppearance(system);
  }
}

/**
 * Keeps the Cursor mirror roster in sync with the office while productMode is mirror.
 */
export function usePresenceSync(sceneManager: SceneManager | null) {
  const lastIdFp = useRef<string | null>(null);
  const lastAppearanceFp = useRef('');
  const mirrorMode = usePresenceStore((s) => s.mirrorMode);

  // Client lifecycle — only tied to mirror mode, NOT sceneManager remounts.
  useEffect(() => {
    if (!mirrorMode) {
      getPresenceClient().forceStop();
      return;
    }
    const client = getPresenceClient();
    client.start();
    void client.pollHealth();
    return () => {
      client.stop();
    };
  }, [mirrorMode]);

  // Roster ↔ office sync — may re-bind when sceneManager appears.
  useEffect(() => {
    if (!mirrorMode) return;

    const sync = () => {
      const agents = listPresenceAgents();
      const idFp = idFingerprint(agents);
      const appFp = appearanceFingerprint(agents);

      if (lastIdFp.current === null || idFp !== lastIdFp.current) {
        const prevMap = usePresenceStore.getState().indexByAgentId;
        lastIdFp.current = idFp;
        lastAppearanceFp.current = appFp;
        const result = syncRosterIds(sceneManager, prevMap);
        applyPresenceToScene(
          sceneManager,
          result.agents,
          result.indexByAgentId,
        );
        return;
      }

      if (appFp !== lastAppearanceFp.current) {
        lastAppearanceFp.current = appFp;
        syncAppearanceOnly(sceneManager);
        applyPresenceToScene(
          sceneManager,
          agents,
          usePresenceStore.getState().indexByAgentId,
        );
        return;
      }

      const indexByAgentId = usePresenceStore.getState().indexByAgentId;
      syncStatusTexts(agents, indexByAgentId);
      applyPresenceToScene(sceneManager, agents, indexByAgentId);
    };

    sync();

    const unsubPresence = usePresenceStore.subscribe((state, prev) => {
      // Ignore hub/status-text bookkeeping updates — those are written by sync itself
      // and would recurse until the stack overflows.
      if (
        state.agents === prev.agents &&
        state.mirrorMode === prev.mirrorMode &&
        state.demoSwarmActive === prev.demoSwarmActive
      ) {
        return;
      }
      sync();
    });
    const unsubAppearance = useAgentAppearanceStore.subscribe(() => {
      lastAppearanceFp.current = '';
      sync();
    });

    // Soft placement retry — recovers failed lounge walks without waiting for a new event.
    const retryTimer = window.setInterval(() => {
      if (!sceneManager) return;
      const agents = listPresenceAgents();
      applyPresenceToScene(
        sceneManager,
        agents,
        usePresenceStore.getState().indexByAgentId,
      );
    }, 2200);

    return () => {
      unsubPresence();
      unsubAppearance();
      window.clearInterval(retryTimer);
    };
  }, [mirrorMode, sceneManager]);
}

/** Inject a demo swarm for demos without Cursor hooks. */
export function injectMockSwarm() {
  const client = getPresenceClient();
  const now = Date.now();
  const swarm = [
    { agentId: 'cursor-lead', name: 'Cursor', state: 'working' as const, statusText: 'Working' },
    {
      agentId: 'cursor-explore',
      name: 'Explore',
      state: 'working' as const,
      statusText: 'Working',
      parentId: 'cursor-lead',
    },
    {
      agentId: 'cursor-shell',
      name: 'Shell',
      state: 'thinking' as const,
      statusText: 'Thinking…',
      parentId: 'cursor-lead',
    },
    {
      agentId: 'cursor-review',
      name: 'Review',
      state: 'idle' as const,
      statusText: 'Standing by',
      parentId: 'cursor-lead',
    },
  ];

  usePresenceStore.getState().setProductMode('mirror');
  // Replace live roster so the demo is visible even when Cursor agents already fill seats.
  usePresenceStore.getState().clear();
  usePresenceStore.getState().setDemoSwarmActive(true);
  // Drop leftover Advanced tasks so they can't fight companion seating.
  useCoreStore.setState({ tasks: [] });
  // Do NOT set connected — that flag is SSE-only

  for (const agent of swarm) {
    client.inject({
      type: 'agent.presence',
      v: 1,
      ts: now,
      provider: 'cursor',
      op: 'upsert',
      ...agent,
    });
  }

  // Slow rotation so agents can finish walks (no frantic glitching).
  let tick = 0;
  const timer = window.setInterval(() => {
    if (!usePresenceStore.getState().demoSwarmActive) {
      window.clearInterval(timer);
      return;
    }
    tick += 1;
    // Lead stays working on stage; specialists rotate desk / board / lounge.
    const specialistStates = ['working', 'thinking', 'idle'] as const;
    for (let i = 1; i < swarm.length; i++) {
      const state = specialistStates[(tick + i) % specialistStates.length];
      client.inject({
        type: 'agent.presence',
        v: 1,
        ts: Date.now(),
        agentId: swarm[i].agentId,
        name: swarm[i].name,
        parentId: swarm[i].parentId,
        state,
        statusText: state === 'working' ? 'Working' : state === 'thinking' ? 'Thinking…' : 'Standing by',
        provider: 'cursor',
        op: 'upsert',
      });
    }
    client.inject({
      type: 'agent.presence',
      v: 1,
      ts: Date.now(),
      agentId: 'cursor-lead',
      name: 'Cursor',
      state: 'working',
      statusText: 'Working',
      provider: 'cursor',
      op: 'upsert',
    });
    if (tick >= 9) window.clearInterval(timer);
  }, 12000);
}

/** Switch to Advanced (BYOK / Teams) and restore prior team if known. */
export function enterAdvancedMode() {
  const presence = usePresenceStore.getState();
  const team = useTeamStore.getState();
  const restoreId = presence.previousTeamId ?? team.selectedAgentSetId;
  presence.clear();
  presence.setProductMode('advanced', team.selectedAgentSetId === CURSOR_MIRROR_SET_ID ? restoreId : team.selectedAgentSetId);
  if (restoreId && restoreId !== CURSOR_MIRROR_SET_ID) {
    useUiStore.getState().setSkipProjectResetOnTeamChange(true);
    team.setActiveTeam(restoreId);
  }
}

export function enterMirrorMode() {
  const team = useTeamStore.getState();
  usePresenceStore.getState().setProductMode('mirror', team.selectedAgentSetId);
  useUiStore.getState().setSkipProjectResetOnTeamChange(true);
  team.setActiveTeam(CURSOR_MIRROR_SET_ID);
}
