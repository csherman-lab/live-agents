import { useCoreStore } from './store/coreStore';
import { useUiStore } from './store/uiStore';
import { toast } from './store/toastStore';

/** Enter the simulation workspace. Starts the project when a brief is set and phase is idle. */
export function enterWorkspace(): boolean {
  const ui = useUiStore.getState();
  const core = useCoreStore.getState();

  if (!ui.llmConfig.apiKey && !ui.isDemoMode) {
    toast('Add your AI provider API key in Settings to run agents', 'info');
    ui.setSettingsOpen(true);
    return false;
  }

  if (ui.llmConfig.apiKey) {
    ui.setDemoMode(false);
  }

  const brief = core.userBrief.trim();
  if (ui.llmConfig.apiKey && core.phase === 'idle' && brief) {
    core.startProject(brief);
    core.addLogEntry({
      agentIndex: 1,
      action: 'Project started from Command Center',
      taskId: undefined,
    });
  }

  core.setViewMode('simulation');
  return true;
}
