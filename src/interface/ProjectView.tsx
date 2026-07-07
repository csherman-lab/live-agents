import { Info, RefreshCcw, Package } from 'lucide-react';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { getAgentSet, getAllAgents } from '../data/agents';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore, useActiveTeam } from '../integration/store/teamStore';
import { useSceneManager } from '../simulation/SceneContext';
import { USER_COLOR } from '../theme/brand';
import ResetModal from './ResetModal';
import PricingModal from './PricingModal';
import { exportProjectDeliverables } from '../utils/exportProject';
import { useMemoryStore } from '../integration/store/memoryStore';

export function formatTokens(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

const ProjectView: React.FC = () => {
  const {
    userBrief,
    referenceImages,
    phase,
    actionLog,
    resetProject,
  } = useCoreStore();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const activeTeam = useActiveTeam();
  const scene = useSceneManager();

  const hasLogs = actionLog.length > 0;

  const handleResetConfirm = () => {
    scene?.resetScene();
    resetProject();
    const teamId = useTeamStore.getState().selectedAgentSetId;
    useMemoryStore.setState((s) => {
      const next = { ...s.teamMemories };
      delete next[teamId];
      return { teamMemories: next };
    });
    setIsResetModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5">
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-[var(--apple-text)]">Project</h2>
          <div
            className="px-2.5 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1.5"
            style={{
              backgroundColor: phase === 'working' ? 'rgba(0,122,255,0.12)' : phase === 'done' ? 'rgba(52,199,89,0.12)' : 'rgba(0,0,0,0.04)',
              color: phase === 'idle' ? 'var(--apple-text-secondary)' : phase === 'working' ? '#007AFF' : '#34C759',
            }}
          >
            {phase === 'working' && <span className="w-1.5 h-1.5 rounded-full bg-appleBlue live-dot" />}
            {phase === 'idle' ? 'Ready' : phase === 'working' ? 'Working' : 'Complete'}
          </div>
        </div>
      </div>

      {phase === 'done' && (
        <div className="mb-6">
          <button
            onClick={() => exportProjectDeliverables()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-appleBlue/10 text-appleBlue hover:bg-appleBlue/15 transition-apple active:scale-[0.98] font-medium text-[13px]"
          >
            <Package size={15} />
            Export Project Deliverables
          </button>
        </div>
      )}

      {/* Reset Project Button */}
      {hasLogs && (
        <div className="mb-8 w-full">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl transition-apple active:scale-[0.98] group ${phase === 'done'
                ? 'bg-[var(--apple-text)] hover:opacity-90 text-white shadow-sm'
                : 'bg-black/[0.04] hover:bg-black/[0.07] text-zinc-500'
              }`}
          >
            <RefreshCcw size={14} className="transition-transform group-hover:rotate-180 duration-500" />
            <span className="text-[13px] font-medium">Start New Project</span>
          </button>
        </div>
      )}

      {/* Brief */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">User Brief</p>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>
        {userBrief ? (
          <div className="space-y-4">
            <div className="markdown-content text-xs leading-relaxed font-medium theme-chip p-4 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar" style={{ color: 'var(--apple-text-secondary)' }}>
              <ReactMarkdown>
                {userBrief}
              </ReactMarkdown>
            </div>

            {(activeTeam.outputType === 'image' || activeTeam.outputType === 'video') && referenceImages.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Brief Logic References</p>
                <div className="grid grid-cols-3 gap-2">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-zinc-100 shadow-sm bg-zinc-50">
                      <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="apple-card p-4 space-y-2">
            <p className="text-[13px] font-semibold" style={{ color: 'var(--apple-text)' }}>
              No brief yet
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: 'var(--apple-text-secondary)' }}>
              Click your lead agent in the office, then use <strong>Open Chat</strong> to define the project brief.
            </p>
          </div>
        )}
      </div>

      {/* Token Usage */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Token Usage</p>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
          <button
            onClick={() => setIsPricingModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 rounded-lg transition-all active:scale-95 group ml-4 cursor-pointer"
          >
            <span className="text-[10px] font-black uppercase tracking-tight text-emerald-600">
              Total Est. ${useCoreStore.getState().totalEstimatedCost.toFixed(3)}
            </span>
            <Info size={11} className="text-emerald-500 group-hover:text-emerald-600" />
          </button>
        </div>

        <div className="bg-zinc-50 rounded-xl p-5 border border-zinc-100 mb-6">
          <div className="flex flex-col gap-1 mb-6">
            <span className="text-4xl font-mono font-black text-darkDelegation tracking-tighter">
              {formatTokens(useCoreStore.getState().totalTokenUsage.totalTokens)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono">
            <span className="text-zinc-700">{formatTokens(useCoreStore.getState().totalTokenUsage.promptTokens)} <span className="text-zinc-400 font-medium">input</span></span>
            <span className="text-zinc-300">+</span>
            <span className="text-zinc-700">{formatTokens(useCoreStore.getState().totalTokenUsage.completionTokens)} <span className="text-zinc-400 font-medium">output</span></span>
          </div>
        </div>

        <div className="space-y-1">
          {Object.entries(useCoreStore.getState().agentTokenUsage)
            .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
            .map(([idx, usage]) => {
              const agentIndex = parseInt(idx);
              const agents = getAllAgents(activeTeam);
              const agent = agentIndex === -1
                ? { name: 'System', color: '#71717a' }
                : agents.find(a => a.index === agentIndex);

              if (!agent || usage.totalTokens === 0) return null;

              return (
                <div key={idx} className="flex items-center justify-between py-2 px-2 hover:bg-zinc-100/50 rounded-lg transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: agent.color }} />
                    <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-tight group-hover:text-darkDelegation transition-colors">
                      {agent.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {useCoreStore.getState().agentEstimatedCost[agentIndex] > 0 && (
                        <span className="text-[9px] font-mono font-bold text-emerald-600/70">
                          ${useCoreStore.getState().agentEstimatedCost[agentIndex].toFixed(4)}
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-black text-darkDelegation">
                        {formatTokens(usage.totalTokens)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold font-mono text-zinc-400">
                      <span>{formatTokens(usage.promptTokens)} <span className="font-medium opacity-60">input</span></span>
                      <span className="text-zinc-200">+</span>
                      <span>{formatTokens(usage.completionTokens)} <span className="font-medium opacity-60">output</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetConfirm}
      />

      {isPricingModalOpen && (
        <PricingModal onClose={() => setIsPricingModalOpen(false)} />
      )}
    </div>
  );
};

export default ProjectView;
