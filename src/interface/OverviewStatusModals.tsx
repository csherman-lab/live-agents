import {
  ArrowRight,
  KeyRound,
  Layers,
  Play,
  Radio,
  Users,
} from 'lucide-react';
import React from 'react';
import { getAllAgents } from '../data/agents';
import { ProjectPhase, Task, TaskStatus, useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { APPLE_BLUE, APPLE_TEXT, APPLE_TEXT_SECONDARY, withHexAlpha } from '../theme/brand';
import { Avatar } from './components/Avatar';
import ApiKeyForm from './components/ApiKeyForm';
import Modal from './components/Modal';
import { TeamBadge } from './components/TeamBadge';

export type StatusCardId = 'status' | 'agents' | 'tasks' | 'api';

interface OverviewStatusModalsProps {
  open: StatusCardId | null;
  onClose: () => void;
  onGoLive: () => void;
  onManageTeams: () => void;
  onEndProject?: () => void;
}

const TASK_STATUS: Record<TaskStatus, { label: string; color: string }> = {
  scheduled: { label: 'Scheduled', color: '#8E8E93' },
  on_hold: { label: 'On Hold', color: '#FF9500' },
  in_progress: { label: 'In Progress', color: APPLE_BLUE },
  done: { label: 'Done', color: '#34C759' },
};

function phaseMeta(phase: ProjectPhase) {
  switch (phase) {
    case 'working':
      return {
        label: 'Agents Working',
        color: '#FF9500',
        description: 'Your team is actively executing tasks. Go Live to watch them in the 3D workspace.',
      };
    case 'done':
      return {
        label: 'Project Complete',
        color: '#34C759',
        description: 'All tasks are finished. Review deliverables and export from the workspace.',
      };
    default:
      return {
        label: 'Ready to Start',
        color: APPLE_BLUE,
        description: 'Write a project brief below, then Go Live to delegate work to your agents.',
      };
  }
}

function agentForTask(task: Task, agents: ReturnType<typeof getAllAgents>) {
  return agents.find((a) => a.index === task.assignedAgentId);
}

const OverviewStatusModals: React.FC<OverviewStatusModalsProps> = ({
  open,
  onClose,
  onGoLive,
  onManageTeams,
  onEndProject,
}) => {
  const { phase, tasks, userBrief, setUserBrief } = useCoreStore();
  const { llmConfig } = useUiStore();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);
  const hasKey = !!llmConfig.apiKey;
  const phaseInfo = phaseMeta(phase);

  const handleGoLive = () => {
    onClose();
    onGoLive();
  };

  const handleManageTeams = () => {
    onClose();
    onManageTeams();
  };

  return (
    <>
      <Modal
        open={open === 'status'}
        onClose={onClose}
        title="Project Status"
        subtitle="Current phase and your project brief"
        size="lg"
        icon={<Radio size={18} style={{ color: phaseInfo.color }} />}
      >
        <div className="flex flex-col gap-5">
          <div
            className="flex items-center gap-3 p-4 rounded-2xl border"
            style={{
              borderColor: withHexAlpha(phaseInfo.color, '33'),
              backgroundColor: withHexAlpha(phaseInfo.color, '0D'),
            }}
          >
            {phase === 'working' && (
              <span
                className="w-2 h-2 rounded-full live-dot shrink-0"
                style={{ background: phaseInfo.color }}
              />
            )}
            <div>
              <p className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>
                {phaseInfo.label}
              </p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
                {phaseInfo.description}
              </p>
            </div>
          </div>

          <div>
            <label
              htmlFor="project-brief"
              className="block text-[11px] font-semibold uppercase tracking-wider mb-2"
              style={{ color: APPLE_TEXT_SECONDARY }}
            >
              Project Brief
            </label>
            <textarea
              id="project-brief"
              value={userBrief}
              onChange={(e) => setUserBrief(e.target.value)}
              placeholder="Describe what you want your agents to build, research, or deliver..."
              rows={6}
              className="w-full resize-none theme-input rounded-2xl px-4 py-3 text-[13px] leading-relaxed placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-appleBlue/30 transition-apple"
            />
            <p className="text-[11px] mt-2" style={{ color: APPLE_TEXT_SECONDARY }}>
              Pick a Quick Start template from the sidebar, or write your own brief here.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoLive}
            disabled={!hasKey || !userBrief.trim()}
            className="w-full py-3 rounded-2xl text-[14px] font-semibold text-white flex items-center justify-center gap-2 transition-apple active:scale-[0.98] disabled:opacity-45"
            style={{ background: hasKey && userBrief.trim() ? APPLE_BLUE : '#C7C7CC' }}
          >
            <Play size={16} fill="currentColor" />
            Go Live with this brief
          </button>
          {(phase === 'working' || phase === 'done') && onEndProject && (
            <button
              type="button"
              onClick={onEndProject}
              className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-apple"
            >
              End project & start fresh
            </button>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'agents'}
        onClose={onClose}
        title="Agent Team"
        subtitle={`${agents.length} agents on ${activeTeam.teamName}`}
        size="lg"
        icon={<Users size={18} className="text-appleBlue" />}
      >
        <div className="flex flex-col gap-4">
          <div className="apple-card p-4">
            <TeamBadge system={activeTeam} />
            <p className="text-[12px] mt-3 leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
              {activeTeam.teamDescription}
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-black/5 bg-white/60"
              >
                <Avatar
                  type={agent.index === activeTeam.leadAgent.index ? 'lead' : 'sub'}
                  color={agent.color}
                  size={40}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold truncate" style={{ color: APPLE_TEXT }}>
                    {agent.name}
                  </p>
                  <p className="text-[11px] leading-snug line-clamp-2" style={{ color: APPLE_TEXT_SECONDARY }}>
                    {agent.description}
                  </p>
                </div>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: agent.color }}
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleManageTeams}
            className="w-full py-3 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 bg-black/[0.04] hover:bg-black/[0.06] transition-apple"
            style={{ color: APPLE_TEXT }}
          >
            Manage teams & agents
            <ArrowRight size={15} />
          </button>
        </div>
      </Modal>

      <Modal
        open={open === 'tasks'}
        onClose={onClose}
        title="Tasks"
        subtitle={tasks.length > 0 ? `${tasks.length} total` : 'No tasks yet'}
        size="lg"
        icon={<Layers size={18} style={{ color: '#AF52DE' }} />}
      >
        <div className="flex flex-col gap-4">
          {tasks.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div
                className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: withHexAlpha('#AF52DE') }}
              >
                <Layers size={22} style={{ color: '#AF52DE' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: APPLE_TEXT }}>
                No tasks yet
              </p>
              <p className="text-[12px] leading-relaxed mb-5" style={{ color: APPLE_TEXT_SECONDARY }}>
                Add a project brief and Go Live. Your lead agent will break the work into tasks automatically.
              </p>
              <button
                type="button"
                onClick={handleGoLive}
                disabled={!hasKey}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-apple disabled:opacity-45"
                style={{ background: hasKey ? APPLE_BLUE : '#C7C7CC' }}
              >
                <Play size={14} fill="currentColor" />
                Go Live
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {tasks.map((task) => {
                const meta = TASK_STATUS[task.status];
                const agent = agentForTask(task, agents);
                return (
                  <li
                    key={task.id}
                    className="p-3.5 rounded-2xl border border-black/5 bg-white/60"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-[13px] font-semibold leading-snug" style={{ color: APPLE_TEXT }}>
                        {task.title || 'Untitled Task'}
                      </p>
                      <span
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{
                          color: meta.color,
                          backgroundColor: withHexAlpha(meta.color),
                        }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-[11px] leading-relaxed mb-2 line-clamp-2" style={{ color: APPLE_TEXT_SECONDARY }}>
                        {task.description}
                      </p>
                    )}
                    {agent && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: agent.color }}
                        />
                        <span className="text-[10px] font-medium" style={{ color: APPLE_TEXT_SECONDARY }}>
                          {agent.name}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {tasks.length > 0 && phase !== 'done' && (
            <p className="text-[11px] text-center" style={{ color: APPLE_TEXT_SECONDARY }}>
              Go Live to watch agents work on these tasks in the 3D workspace.
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={open === 'api'}
        onClose={onClose}
        title="API Connection"
        subtitle={hasKey ? 'Gemini API key connected' : 'Add your Gemini API key to run agents'}
        size="md"
        icon={
          <KeyRound
            size={18}
            style={{ color: hasKey ? '#34C759' : '#FF9500' }}
          />
        }
      >
        <ApiKeyForm />
        {hasKey && (
          <button
            type="button"
            onClick={handleGoLive}
            className="w-full mt-5 py-3 rounded-2xl text-[13px] font-semibold text-white flex items-center justify-center gap-2 transition-apple active:scale-[0.98]"
            style={{ background: APPLE_BLUE }}
          >
            <Play size={15} fill="currentColor" />
            Go Live
          </button>
        )}
      </Modal>
    </>
  );
};

export default OverviewStatusModals;
