import { create } from 'zustand';
import { getAllAgents } from '../../data/agents';
import { AgentState, CharacterState } from '../../types';
import { useTeamStore, getActiveAgentSet } from './teamStore';
import { getDefaultModels, getTextModels, normalizeProviderId } from '../../core/llm/constants';
import { loadLlmConfig } from '../storage/llmConfigStorage';
import { useCoreStore } from './coreStore';
import { loadThemePreference, saveThemePreference, type ThemePreference } from '../../theme/theme';

export const useUiStore = create<CharacterState>()(
  (set) => ({
    isThinking: false,
    instanceCount: getAllAgents(getActiveAgentSet()).length + 1, // +1 for user

    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoveredPoiId: null,
    hoveredPoiLabel: null,
    hoverPosition: null,
    npcScreenPositions: {},
    isChatting: false,
    isTyping: false,
    chatMessages: [],
    inspectorTab: 'info',
    agentStatuses: {},
    setAgentStatus: (index: number, status: AgentState) => set((s) => ({
      agentStatuses: { ...s.agentStatuses, [index]: status }
    })),

    isBYOKOpen: false,
    isSettingsOpen: false,
    isAboutOpen: false,
    isShortcutsOpen: false,
    isDemoMode: false,
    themePreference: loadThemePreference(),
    pendingTeamSwitchId: null,
    skipProjectResetOnTeamChange: false,
    byokError: null,
    apiTestStatus: 'idle',
    apiTestError: null,
    setBYOKOpen: (open: boolean, error: string | null = null) =>
      set({ isSettingsOpen: open, byokError: error }),
    setSettingsOpen: (open: boolean) =>
      set({ isSettingsOpen: open, ...(open ? {} : { byokError: null }) }),
    setAboutOpen: (open: boolean) => set({ isAboutOpen: open }),
    setShortcutsOpen: (open: boolean) => set({ isShortcutsOpen: open }),
    setDemoMode: (demo: boolean) => set({ isDemoMode: demo }),
    setThemePreference: (preference: ThemePreference) => {
      saveThemePreference(preference);
      set({ themePreference: preference });
    },
    setPendingTeamSwitch: (teamId: string | null) => set({ pendingTeamSwitchId: teamId }),
    setSkipProjectResetOnTeamChange: (skip: boolean) => set({ skipProjectResetOnTeamChange: skip }),
    setApiTestStatus: (status, error = null) =>
      set({ apiTestStatus: status, apiTestError: error }),
    openApiSettings: (error: string | null = null) =>
      set({ isSettingsOpen: true, byokError: error }),

    activeAuditTaskId: null,
    setActiveAuditTaskId: (taskId: string | null) => set({ activeAuditTaskId: taskId }),

    llmConfig: loadLlmConfig(),

    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setInspectorTab: (tab: 'info' | 'chat') => set({ inspectorTab: tab }),
    setInstanceCount: (count: number) => set({ instanceCount: count }),

    setSelectedNpc: (index: number | null) => set({
      selectedNpcIndex: index,
      selectedPosition: null,
    }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({
      hoveredNpcIndex: index,
      hoverPosition: pos,
      hoveredPoiId: null,
      hoveredPoiLabel: null,
    }),
    setHoveredPoi: (id: string | null, label: string | null, pos: { x: number; y: number } | null) => set({
      hoveredPoiId: id,
      hoveredPoiLabel: label,
      hoverPosition: pos,
      hoveredNpcIndex: null,
    }),
    setLlmConfig: (config) => set((s) => {
      const next = { ...s.llmConfig, ...config };
      const provider = normalizeProviderId(next.provider);
      const normalized = {
        ...next,
        provider,
        model: next.model || getDefaultModels(provider).text,
      };
      useCoreStore.setState({ availableModels: [...getTextModels(provider)] });
      return { llmConfig: normalized };
    }),
    setChatting: (isChatting: boolean) => set((s) => ({ 
      isChatting, 
      isTyping: isChatting ? s.isTyping : false,
      isThinking: isChatting ? s.isThinking : false,
      chatMessages: isChatting ? s.chatMessages : []
    })),
  })
);

// Keep instanceCount in sync whenever the active agent set changes
useTeamStore.subscribe((state, prevState) => {
  if (state.selectedAgentSetId !== prevState.selectedAgentSetId) {
    const system = getActiveAgentSet();
    useUiStore.getState().setInstanceCount(getAllAgents(system).length + 1);
  }
});
