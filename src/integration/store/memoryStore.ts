import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LLMMessage } from '../../core/llm/types';
import { useCoreStore } from './coreStore';
import { useTeamStore } from './teamStore';

export interface TeamMemory {
  agentHistories: Record<number, LLMMessage[]>;
  agentSummaries: Record<number, string>;
  boardroomHistories: Record<string, LLMMessage[]>;
  updatedAt: number;
}

interface MemoryState {
  teamMemories: Record<string, TeamMemory>;
  saveCurrentTeamMemory: () => void;
  loadTeamMemory: (teamId: string) => void;
  syncFromCore: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      teamMemories: {},

      saveCurrentTeamMemory: () => {
        const teamId = useTeamStore.getState().selectedAgentSetId;
        const core = useCoreStore.getState();
        if (
          Object.keys(core.agentHistories).length === 0 &&
          Object.keys(core.agentSummaries).length === 0 &&
          Object.keys(core.boardroomHistories).length === 0
        ) {
          return;
        }
        set((s) => ({
          teamMemories: {
            ...s.teamMemories,
            [teamId]: {
              agentHistories: core.agentHistories,
              agentSummaries: core.agentSummaries,
              boardroomHistories: core.boardroomHistories,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      loadTeamMemory: (teamId: string) => {
        const memory = get().teamMemories[teamId];
        if (!memory) return;
        useCoreStore.setState({
          agentHistories: memory.agentHistories,
          agentSummaries: memory.agentSummaries,
          boardroomHistories: memory.boardroomHistories,
        });
      },

      syncFromCore: () => {
        get().saveCurrentTeamMemory();
      },
    }),
    {
      name: 'live-agents-memory',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// Persist memory when agent histories change
useCoreStore.subscribe((state, prev) => {
  if (
    state.agentHistories !== prev.agentHistories ||
    state.agentSummaries !== prev.agentSummaries ||
    state.boardroomHistories !== prev.boardroomHistories
  ) {
    useMemoryStore.getState().saveCurrentTeamMemory();
  }
});

// On team switch: save old team memory, reset session, load new team memory
useTeamStore.subscribe((state, prev) => {
  if (state.selectedAgentSetId !== prev.selectedAgentSetId) {
    useMemoryStore.getState().saveCurrentTeamMemory();
    useCoreStore.getState().resetProject();
    useMemoryStore.getState().loadTeamMemory(state.selectedAgentSetId);
  }
});

// Hydrate on first load
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    const teamId = useTeamStore.getState().selectedAgentSetId;
    useMemoryStore.getState().loadTeamMemory(teamId);
  });
}
