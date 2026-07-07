import React from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { getAgentSet } from '../data/agents';
import Modal from './components/Modal';
import { Users } from 'lucide-react';

const TeamSwitchModal: React.FC = () => {
  const pendingTeamId = useUiStore((s) => s.pendingTeamSwitchId);
  const { setPendingTeamSwitch, setSkipProjectResetOnTeamChange } = useUiStore();
  const { customSystems, setActiveTeam } = useTeamStore();
  const { resetProject } = useCoreStore();

  if (!pendingTeamId) return null;

  const team = getAgentSet(pendingTeamId, customSystems);

  const confirm = () => {
    resetProject();
    setActiveTeam(pendingTeamId);
    setPendingTeamSwitch(null);
    setSkipProjectResetOnTeamChange(false);
  };

  const cancel = () => {
    setSkipProjectResetOnTeamChange(false);
    setPendingTeamSwitch(null);
  };

  return (
    <Modal
      open
      onClose={cancel}
      title="Switch team?"
      subtitle="Your current project will be cleared"
      size="md"
      icon={<Users size={18} className="text-appleBlue" />}
    >
      <p className="text-[14px] leading-relaxed text-[var(--apple-text-secondary)] mb-6">
        Switching to <strong className="text-[var(--apple-text)]">{team.teamName}</strong> will end
        your current brief, tasks, and progress. This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={cancel}
          className="flex-1 py-3 rounded-xl text-[13px] font-semibold bg-black/[0.04] hover:bg-black/[0.07] transition-apple"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex-1 py-3 rounded-xl text-[13px] font-semibold text-white bg-appleBlue hover:opacity-90 transition-apple"
        >
          Switch team
        </button>
      </div>
    </Modal>
  );
};

export default TeamSwitchModal;
