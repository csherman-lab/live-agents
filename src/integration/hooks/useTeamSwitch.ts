import { useCoreStore } from '../store/coreStore';
import { useTeamStore } from '../store/teamStore';
import { useUiStore } from '../store/uiStore';

/** Switch teams; prompts if the current project has work in progress. */
export function requestTeamSwitch(teamId: string) {
  const { selectedAgentSetId } = useTeamStore.getState();
  if (teamId === selectedAgentSetId) return;

  const { phase, tasks, userBrief } = useCoreStore.getState();
  const hasWork = phase !== 'idle' || tasks.length > 0 || userBrief.trim().length > 0;

  if (!hasWork) {
    useTeamStore.getState().setActiveTeam(teamId);
    return;
  }

  useUiStore.getState().setSkipProjectResetOnTeamChange(true);
  useUiStore.getState().setPendingTeamSwitch(teamId);
}
