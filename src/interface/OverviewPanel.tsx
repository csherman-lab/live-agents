import {
  ArrowRight,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Layers,
  Package,
  Play,
  Radio,
  Save,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { PROJECT_TEMPLATES } from '../data/projectTemplates';
import { getAgentSet, getAllAgents } from '../data/agents';
import { useCoreStore } from '../integration/store/coreStore';
import { countPendingApprovals, useProjectStore } from '../integration/store/projectStore';
import { requestTeamSwitch } from '../integration/hooks/useTeamSwitch';
import { toast } from '../integration/store/toastStore';
import { useTeamStore, useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { APPLE_BLUE, APPLE_TEXT, APPLE_TEXT_SECONDARY, withHexAlpha } from '../theme/brand';
import { exportProjectDeliverables } from '../utils/exportProject';
import { TeamBadge } from './components/TeamBadge';
import OverviewStatusModals, { type StatusCardId } from './OverviewStatusModals';
import ApprovalInbox from './ApprovalInbox';

interface OverviewPanelProps {
  onGoLive: () => void;
  onManageTeams: () => void;
  onExploreDemo: () => void;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ onGoLive, onManageTeams, onExploreDemo }) => {
  const [openCard, setOpenCard] = useState<StatusCardId | null>(null);
  const { phase, tasks, userBrief, setUserBrief, setFinalOutputOpen, resetProject } = useCoreStore();
  const { llmConfig, setSettingsOpen, isDemoMode } = useUiStore();
  const { customSystems } = useTeamStore();
  const { savedProjects, saveCurrentProject, loadProject, deleteProject } = useProjectStore();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);
  const hasKey = !!llmConfig.apiKey;
  const canEnter = hasKey || isDemoMode;

  const activeTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = countPendingApprovals(tasks);

  const phaseLabel = phase === 'working' ? 'Agents Working' : phase === 'done' ? 'Project Complete' : 'Ready to Start';
  const phaseColor = phase === 'working' ? '#FF9500' : phase === 'done' ? '#34C759' : APPLE_BLUE;

  const tasksLabel =
    pendingTasks > 0
      ? `${pendingTasks} need approval`
      : activeTasks > 0
        ? `${activeTasks} in progress`
        : 'None yet';

  const applyTemplate = (templateId: string) => {
    const template = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    requestTeamSwitch(template.teamId);
    setUserBrief(template.brief);
    toast('Template applied', 'success');
  };

  const handleSaveProject = () => {
    if (!userBrief.trim()) return;
    saveCurrentProject();
    toast('Brief saved to history', 'success');
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-appleBlue" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-appleBlue">Command Center</span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-2" style={{ color: APPLE_TEXT }}>
            Your Agent Workspace
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
            Configure your team and watch agents collaborate in 3D.
          </p>
        </div>

        {phase === 'done' && (
          <div className="px-5 pb-3">
            <button
              type="button"
              onClick={() => exportProjectDeliverables()}
              className="w-full apple-card p-4 flex items-center gap-3 hover:shadow-md transition-apple text-left group border border-green-200/60 bg-green-50/50"
            >
              <div className="w-10 h-10 rounded-xl bg-appleGreen/15 flex items-center justify-center shrink-0">
                <Package size={18} className="text-appleGreen" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-green-900">Project complete</p>
                <p className="text-[11px] text-green-700/80">View output and export deliverables</p>
              </div>
              <ArrowRight size={14} className="text-green-400 group-hover:text-appleGreen shrink-0" />
            </button>
          </div>
        )}

        <div className="px-5 pb-4 grid grid-cols-2 gap-2.5">
          <StatusCard icon={<Radio size={15} />} label="Status" value={phaseLabel} accent={phaseColor} pulse={phase === 'working'} onClick={() => setOpenCard('status')} />
          <StatusCard icon={<Users size={15} />} label="Agents" value={`${agents.length} active`} accent={APPLE_BLUE} onClick={() => setOpenCard('agents')} />
          <StatusCard icon={<Layers size={15} />} label="Tasks" value={tasksLabel} accent={pendingTasks > 0 ? '#FF9500' : '#AF52DE'} pulse={pendingTasks > 0} onClick={() => setOpenCard('tasks')} />
          <StatusCard icon={<Sparkles size={15} />} label="API" value={hasKey ? 'Connected' : 'Not set'} accent={hasKey ? '#34C759' : '#FF9500'} onClick={() => setOpenCard('api')} />
        </div>

        <OverviewStatusModals
          open={openCard}
          onClose={() => setOpenCard(null)}
          onGoLive={onGoLive}
          onManageTeams={onManageTeams}
          onEndProject={() => {
            resetProject();
            setOpenCard(null);
          }}
        />

        <ApprovalInbox onGoLive={onGoLive} />

        <div className="px-5 pb-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-zinc-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: APPLE_TEXT_SECONDARY }}>
                Project Brief
              </span>
            </div>
            {userBrief.trim().length > 0 && (
              <span className="text-[10px] tabular-nums" style={{ color: APPLE_TEXT_SECONDARY }}>
                {userBrief.trim().split(/\s+/).filter(Boolean).length} words
              </span>
            )}
          </div>
          <textarea
            value={userBrief}
            onChange={(e) => setUserBrief(e.target.value)}
            aria-label="Project brief"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canEnter) {
                e.preventDefault();
                onGoLive();
              }
            }}
            placeholder="Describe what you want your agents to build…"
            rows={4}
            className="w-full apple-card p-3 text-[13px] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-appleBlue/30 min-h-[96px]"
            style={{ color: APPLE_TEXT }}
          />
          {!userBrief.trim() && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {['Build a landing page', 'Research competitors', 'Draft a product spec'].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setUserBrief(hint)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-black/[0.04] hover:bg-appleBlue/10 hover:text-appleBlue transition-apple"
                  style={{ color: APPLE_TEXT_SECONDARY }}
                >
                  {hint}
                </button>
              ))}
            </div>
          )}
          {userBrief.trim() && canEnter && (
            <p className="text-[10px] mt-2 text-zinc-400">
              Press <kbd className="px-1 py-0.5 bg-black/[0.05] rounded text-[9px]">⌘</kbd>+<kbd className="px-1 py-0.5 bg-black/[0.05] rounded text-[9px]">↵</kbd> to go live
            </p>
          )}
        </div>

        {savedProjects.length > 0 && (
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <FolderOpen size={13} className="text-zinc-400" />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: APPLE_TEXT_SECONDARY }}>
                  Brief History
                </span>
              </div>
              {userBrief.trim() && (
                <button
                  type="button"
                  onClick={handleSaveProject}
                  className="flex items-center gap-1 text-[10px] font-semibold text-appleBlue"
                >
                  <Save size={11} />
                  Save current
                </button>
              )}
            </div>
            <p className="text-[10px] mb-2.5" style={{ color: APPLE_TEXT_SECONDARY }}>
              Restores brief text and team — not tasks or progress
            </p>
            <div className="flex flex-col gap-2">
              {savedProjects.slice(0, 5).map((p) => {
                const team = getAgentSet(p.teamId, customSystems);
                return (
                  <div
                    key={p.id}
                    className="apple-card p-3 flex items-center gap-3 group"
                  >
                    <button
                      type="button"
                      onClick={() => loadProject(p.id)}
                      className="flex-1 flex items-center gap-3 min-w-0 text-left"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: withHexAlpha(team.color) }}
                      >
                        <FileText size={14} style={{ color: team.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate" style={{ color: APPLE_TEXT }}>{p.name}</p>
                        <p className="text-[10px] flex items-center gap-1.5" style={{ color: APPLE_TEXT_SECONDARY }}>
                          <Clock size={10} />
                          {new Date(p.updatedAt).toLocaleDateString()}
                          {p.taskCount > 0 && ` · ${p.taskCount} tasks`}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProject(p.id)}
                      className="p-1.5 rounded-lg text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {savedProjects.length === 0 && userBrief.trim() && (
          <div className="px-5 pb-4">
            <button
              type="button"
              onClick={handleSaveProject}
              className="w-full py-2.5 rounded-xl text-[12px] font-semibold text-appleBlue bg-appleBlue/10 hover:bg-appleBlue/15 transition-apple flex items-center justify-center gap-1.5"
            >
              <Save size={13} />
              Save brief to history
            </button>
          </div>
        )}

        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <FileText size={13} className="text-zinc-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: APPLE_TEXT_SECONDARY }}>
              Quick Start Templates
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {PROJECT_TEMPLATES.map((t) => {
              const TemplateIcon = t.icon;
              const team = getAgentSet(t.teamId, customSystems);
              const accent = team.color;
              return (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t.id)}
                  className="w-full apple-card p-3 flex items-center gap-3 hover:shadow-md transition-apple active:scale-[0.99] text-left group"
                  style={{ ['--template-accent' as string]: accent }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: withHexAlpha(accent) }}
                  >
                    <TemplateIcon size={18} style={{ color: accent }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold truncate" style={{ color: APPLE_TEXT }}>{t.title}</p>
                    <p className="text-[11px] truncate" style={{ color: APPLE_TEXT_SECONDARY }}>{t.description}</p>
                  </div>
                  <ArrowRight size={14} className="text-zinc-300 group-hover:text-[var(--template-accent)] shrink-0 transition-apple" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 pb-3">
          <button
            onClick={onManageTeams}
            className="w-full glass-panel rounded-2xl p-3.5 flex items-center gap-3 hover:shadow-md transition-apple active:scale-[0.99] text-left group"
          >
            <TeamBadge system={activeTeam} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: APPLE_TEXT }}>{activeTeam.teamName}</p>
              <p className="text-[11px] truncate" style={{ color: APPLE_TEXT_SECONDARY }}>Manage teams & agents</p>
            </div>
            <ArrowRight size={15} className="text-zinc-300 group-hover:text-appleBlue transition-apple shrink-0" />
          </button>
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full glass-panel rounded-2xl p-4 flex items-center gap-3 hover:shadow-md transition-apple text-left group"
          >
            <div className="w-9 h-9 rounded-xl bg-appleBlue/10 flex items-center justify-center shrink-0">
              <Sparkles size={16} className="text-appleBlue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: APPLE_TEXT }}>Settings & API Keys</p>
              <p className="text-[11px]" style={{ color: APPLE_TEXT_SECONDARY }}>
                {hasKey ? 'API connected · Tap to configure' : 'Add your Gemini key to get started'}
              </p>
            </div>
            <ArrowRight size={15} className="text-zinc-300 group-hover:text-appleBlue transition-apple shrink-0" />
          </button>
        </div>
      </div>

      <div className="shrink-0 px-5 py-4 border-t backdrop-blur-xl app-footer">
        <button
          onClick={onGoLive}
          disabled={!canEnter}
          className="w-full relative overflow-hidden rounded-2xl py-3.5 px-6 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-apple active:scale-[0.98] disabled:opacity-50"
          style={{ background: canEnter ? APPLE_BLUE : '#C7C7CC' }}
          aria-disabled={!canEnter}
        >
          {canEnter && <div className="absolute inset-0 go-live-shimmer opacity-0 hover:opacity-100 transition-opacity" />}
          <span className="relative flex items-center gap-2.5">
            <Play size={17} fill="currentColor" />
            Go Live
            {hasKey && <span className="w-2 h-2 rounded-full bg-white live-dot" />}
          </span>
        </button>

        {!hasKey && (
          <button
            type="button"
            onClick={onExploreDemo}
            className="w-full mt-2 py-3 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 border theme-badge hover:opacity-90 transition-apple"
            style={{ color: APPLE_TEXT }}
          >
            <Eye size={15} />
            Explore demo (no API key)
          </button>
        )}

        {!hasKey && !isDemoMode && (
          <p className="text-center text-[11px] mt-2" style={{ color: APPLE_TEXT_SECONDARY }}>
            Open Settings to add your API key, or try the demo
          </p>
        )}
        {phase === 'done' && (
          <button
            type="button"
            onClick={() => setFinalOutputOpen(true)}
            className="w-full mt-2 py-2.5 text-[12px] font-semibold text-appleGreen"
          >
            View final deliverable
          </button>
        )}
        <p className="text-center text-[10px] mt-2 text-zinc-400">
          Shortcuts: <kbd className="px-1 py-0.5 bg-black/[0.05] rounded text-[9px]">G</kbd> live · <kbd className="px-1 py-0.5 bg-black/[0.05] rounded text-[9px]">S</kbd> settings · <kbd className="px-1 py-0.5 bg-black/[0.05] rounded text-[9px]">?</kbd> shortcuts
        </p>
      </div>
    </div>
  );
};

const StatusCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  pulse?: boolean;
  onClick: () => void;
}> = ({ icon, label, value, accent, pulse, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="glass-panel rounded-xl p-3 text-left hover:shadow-md transition-apple active:scale-[0.98] cursor-pointer"
  >
    <div className="flex items-center gap-1.5 mb-1.5">
      <span style={{ color: accent }}>{icon}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: APPLE_TEXT_SECONDARY }}>{label}</span>
      {pulse && <span className="w-1.5 h-1.5 rounded-full live-dot ml-auto" style={{ background: accent }} />}
    </div>
    <p className="text-[12px] font-semibold leading-snug" style={{ color: APPLE_TEXT }}>{value}</p>
  </button>
);

export default OverviewPanel;
