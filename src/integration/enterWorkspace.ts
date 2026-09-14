import { useCoreStore } from './store/coreStore';
import { useUiStore } from './store/uiStore';
import { toast } from './store/toastStore';
import { usePresenceStore } from './presence/presenceStore';

/** Enter the simulation workspace. Mirror mode skips API keys; BYOK still starts projects. */
export function enterWorkspace(): boolean {
  const ui = useUiStore.getState();
  const core = useCoreStore.getState();
  const mirrorMode = usePresenceStore.getState().mirrorMode;

  if (!ui.llmConfig.apiKey && !ui.isDemoMode && !mirrorMode) {
    toast('Add your AI provider API key in Settings to run agents', 'info');
    ui.setSettingsOpen(true);
    return false;
  }

  if (mirrorMode) {
    // Cursor companion spectator — not BYOK "demo mode" (that banner is Advanced-only).
    ui.setDemoMode(false);
  } else if (ui.llmConfig.apiKey) {
    ui.setDemoMode(false);
  }

  const brief = core.userBrief.trim();
  if (!mirrorMode && ui.llmConfig.apiKey && core.phase === 'idle' && brief) {
    core.startProject(brief);
    core.addLogEntry({
      agentIndex: 1,
      action: 'Project started from Command Center',
      taskId: undefined,
    });
  }

  // Mirror office is a clean spectator stage — collapse Advanced side panels.
  if (mirrorMode) {
    core.setLogOpen(false);
    core.setKanbanOpen(false);
  }

  core.setViewMode('simulation');
  return true;
}
