import { MessageSquareWarning, ArrowRight } from 'lucide-react';
import React from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { getAllAgents } from '../data/agents';
import { useActiveTeam } from '../integration/store/teamStore';
import { APPLE_TEXT, APPLE_TEXT_SECONDARY } from '../theme/brand';

interface ApprovalInboxProps {
  onGoLive?: () => void;
}

const ApprovalInbox: React.FC<ApprovalInboxProps> = ({ onGoLive }) => {
  const { tasks, viewMode, setKanbanOpen } = useCoreStore();
  const { setActiveAuditTaskId } = useUiStore();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);

  const pending = tasks.filter((t) => t.status === 'on_hold');
  if (pending.length === 0) return null;

  const openTask = (taskId: string) => {
    if (viewMode !== 'simulation' && onGoLive) {
      onGoLive();
    }
    setKanbanOpen(true);
    setActiveAuditTaskId(taskId);
  };

  return (
    <div className="px-5 pb-4">
      <div className="apple-card p-4 border border-orange-200/80 bg-orange-50/40">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquareWarning size={16} className="text-orange-500" />
          <span className="text-[12px] font-semibold text-orange-700">
            {pending.length} approval{pending.length > 1 ? 's' : ''} needed
          </span>
        </div>
        <ul className="flex flex-col gap-2">
          {pending.slice(0, 3).map((task) => {
            const agent = agents.find((a) => a.index === task.assignedAgentId);
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl theme-panel hover:opacity-90 border border-orange-100 text-left transition-apple"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: agent?.color ?? '#FF9500' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: APPLE_TEXT }}>
                      {task.title}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: APPLE_TEXT_SECONDARY }}>
                      {agent?.name ?? 'Agent'}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-orange-400 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default ApprovalInbox;
