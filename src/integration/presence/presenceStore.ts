import { create } from 'zustand';
import type { AgentPresenceEvent, PresenceAgent, PresenceState } from './presenceTypes';

export type ProductMode = 'mirror' | 'advanced';

export interface HubHealth {
  ok: boolean;
  reachable: boolean;
  agentCount: number;
  sseClients: number;
  lastEventAt: number | null;
  postCount: number;
  checkedAt: number;
}

interface PresenceStateStore {
  agents: Record<string, PresenceAgent>;
  /** True only when EventSource is open — never set by Mock Swarm. */
  connected: boolean;
  /** Hub HTTP health (polled). */
  hubOnline: boolean;
  hubHealth: HubHealth | null;
  /** Consecutive failed health polls — used for offline hysteresis. */
  hubFailStreak: number;
  lastEventAt: number | null;
  activity: AgentPresenceEvent[];
  /** Kept in sync with productMode === 'mirror'. */
  mirrorMode: boolean;
  productMode: ProductMode;
  previousTeamId: string | null;
  demoSwarmActive: boolean;
  agentStatusTexts: Record<number, string>;
  indexByAgentId: Record<string, number>;

  setConnected: (connected: boolean) => void;
  setHubHealth: (health: HubHealth | null) => void;
  setDemoSwarmActive: (active: boolean) => void;
  setMirrorMode: (mirrorMode: boolean) => void;
  setProductMode: (mode: ProductMode, previousTeamId?: string | null) => void;
  upsert: (event: AgentPresenceEvent) => void;
  remove: (agentId: string) => void;
  removeTree: (rootAgentId: string) => void;
  clear: () => void;
  setIndexMap: (indexByAgentId: Record<string, number>) => void;
  setAgentStatusTexts: (texts: Record<number, string>) => void;
  applyEvent: (event: AgentPresenceEvent) => void;
  pushActivity: (event: AgentPresenceEvent) => void;
}

const ACTIVITY_MAX = 16;

/** Require this many consecutive failures before flipping hubOnline off. */
const HUB_OFFLINE_AFTER_FAILURES = 2;

type GlobalPresence = typeof globalThis & {
  __liveAgentsPresenceStore?: ReturnType<typeof createPresenceStore>;
};

function createPresenceStore() {
  return create<PresenceStateStore>((set, get) => ({
    agents: {},
    connected: false,
    hubOnline: false,
    hubHealth: null,
    hubFailStreak: 0,
    lastEventAt: null,
    activity: [],
    mirrorMode: true,
    productMode: 'mirror',
    previousTeamId: null,
    demoSwarmActive: false,
    agentStatusTexts: {},
    indexByAgentId: {},

    setConnected: (connected) =>
      set({
        connected,
        // An open SSE stream is definitive proof the hub is reachable.
        ...(connected ? { hubOnline: true, hubFailStreak: 0 } : {}),
      }),

    setHubHealth: (hubHealth) =>
      set((state) => {
        if (!hubHealth) {
          return { hubHealth: null, hubOnline: state.connected, hubFailStreak: 0 };
        }
        // Ignore out-of-order poll responses (common after Strict Mode / reconnect races).
        if (state.hubHealth && hubHealth.checkedAt < state.hubHealth.checkedAt) {
          return state;
        }

        const healthy = !!hubHealth.reachable && !!hubHealth.ok;
        if (healthy) {
          return {
            hubHealth,
            hubOnline: true,
            hubFailStreak: 0,
          };
        }

        // Failures are sticky only after consecutive misses; SSE open always wins.
        // Keep the last good health snapshot for UI while connected / within hysteresis.
        const hubFailStreak = state.hubFailStreak + 1;
        const hubOnline = state.connected
          ? true
          : hubFailStreak >= HUB_OFFLINE_AFTER_FAILURES
            ? false
            : state.hubOnline;
        const keepDisplay = !!state.hubHealth?.ok && (state.connected || hubFailStreak < HUB_OFFLINE_AFTER_FAILURES);

        return {
          hubHealth: keepDisplay ? state.hubHealth : hubHealth,
          hubFailStreak,
          hubOnline,
        };
      }),

    setDemoSwarmActive: (demoSwarmActive) => set({ demoSwarmActive }),

    setMirrorMode: (mirrorMode) =>
      set({
        mirrorMode,
        productMode: mirrorMode ? 'mirror' : 'advanced',
      }),

    setProductMode: (mode, previousTeamId) => {
      const prev = get();
      if (mode === 'advanced' && prev.productMode === 'mirror') {
        set({
          productMode: 'advanced',
          mirrorMode: false,
          previousTeamId: previousTeamId ?? prev.previousTeamId,
          demoSwarmActive: false,
        });
        return;
      }
      if (mode === 'mirror' && prev.productMode === 'advanced') {
        set({
          productMode: 'mirror',
          mirrorMode: true,
          previousTeamId: previousTeamId ?? prev.previousTeamId,
        });
        return;
      }
      set({
        productMode: mode,
        mirrorMode: mode === 'mirror',
        ...(previousTeamId !== undefined ? { previousTeamId } : {}),
      });
    },

    upsert: (event) => {
      const prev = get().agents[event.agentId];
      if (prev && event.ts < prev.lastTs) return;

      const agent: PresenceAgent = {
        agentId: event.agentId,
        name: event.name,
        state: event.state,
        statusText: event.statusText,
        parentId: event.parentId ?? null,
        provider: event.provider ?? 'cursor',
        lastTs: event.ts,
      };
      set({ agents: { ...get().agents, [event.agentId]: agent } });
    },

    remove: (agentId) => {
      const next = { ...get().agents };
      delete next[agentId];
      set({ agents: next });
    },

    removeTree: (rootAgentId) => {
      const agents = get().agents;
      const toRemove = new Set<string>([rootAgentId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const a of Object.values(agents)) {
          if (a.parentId && toRemove.has(a.parentId) && !toRemove.has(a.agentId)) {
            toRemove.add(a.agentId);
            grew = true;
          }
        }
      }
      const next = { ...agents };
      for (const id of toRemove) delete next[id];
      set({ agents: next });
    },

    clear: () =>
      set({
        agents: {},
        agentStatusTexts: {},
        indexByAgentId: {},
        demoSwarmActive: false,
        activity: [],
        lastEventAt: null,
      }),

    setIndexMap: (indexByAgentId) => set({ indexByAgentId }),

    setAgentStatusTexts: (agentStatusTexts) => set({ agentStatusTexts }),

    pushActivity: (event) => {
      const activity = [
        event,
        ...get().activity.filter((e) => e.ts !== event.ts || e.agentId !== event.agentId),
      ];
      if (activity.length > ACTIVITY_MAX) activity.length = ACTIVITY_MAX;
      set({
        activity,
        lastEventAt: Math.max(get().lastEventAt ?? 0, event.ts),
      });
    },

    applyEvent: (event) => {
      // Atomic update — activity + roster in one set so HMR/subscribers never see activity without agents.
      const state = get();
      const activity = [
        event,
        ...state.activity.filter((e) => e.ts !== event.ts || e.agentId !== event.agentId),
      ];
      if (activity.length > ACTIVITY_MAX) activity.length = ACTIVITY_MAX;
      const lastEventAt = Math.max(state.lastEventAt ?? 0, event.ts);

      if (event.op === 'remove') {
        const toRemove = new Set<string>([event.agentId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const a of Object.values(state.agents)) {
            if (a.parentId && toRemove.has(a.parentId) && !toRemove.has(a.agentId)) {
              toRemove.add(a.agentId);
              grew = true;
            }
          }
        }
        const agents = { ...state.agents };
        for (const id of toRemove) delete agents[id];
        set({
          agents,
          activity,
          lastEventAt,
          ...(Object.keys(agents).length === 0 ? { demoSwarmActive: false } : {}),
        });
        return;
      }

      const prev = state.agents[event.agentId];
      if (prev && event.ts < prev.lastTs) {
        set({ activity, lastEventAt });
        return;
      }

      const agent: PresenceAgent = {
        agentId: event.agentId,
        name: event.name,
        state: event.state,
        statusText: event.statusText,
        parentId: event.parentId ?? null,
        provider: event.provider ?? 'cursor',
        lastTs: event.ts,
      };
      set({
        agents: { ...state.agents, [event.agentId]: agent },
        activity,
        lastEventAt,
      });
    },
  }));
}

const g = globalThis as GlobalPresence;

/** HMR-safe singleton — Vite can re-evaluate this module without dropping live presence. */
export const usePresenceStore = g.__liveAgentsPresenceStore ?? createPresenceStore();
g.__liveAgentsPresenceStore = usePresenceStore;

export function listPresenceAgents(): PresenceAgent[] {
  return Object.values(usePresenceStore.getState().agents).sort(
    (a, b) => a.lastTs - b.lastTs,
  );
}

export function presenceStateToAgentState(
  state: PresenceState,
): 'idle' | 'working' | 'talking' | 'moving' | 'on_hold' {
  switch (state) {
    case 'working':
      return 'working';
    case 'thinking':
      return 'talking';
    case 'done':
      return 'idle';
    default:
      return 'idle';
  }
}

export function formatEventAge(ts: number | null | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}
