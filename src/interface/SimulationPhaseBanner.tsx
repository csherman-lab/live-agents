import { AlertCircle, CheckCircle2, Loader2, MessageSquareWarning, Package, Sparkles, X } from 'lucide-react';
import React from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { countPendingApprovals } from '../integration/store/projectStore';
import { exportProjectDeliverables } from '../utils/exportProject';
import { APPLE_BLUE, APPLE_TEXT, APPLE_TEXT_SECONDARY } from '../theme/brand';

interface SimulationPhaseBannerProps {
  onEndProject?: () => void;
}

const SimulationPhaseBanner: React.FC<SimulationPhaseBannerProps> = ({ onEndProject }) => {
  const { phase, tasks, isGeneratingAsset, generationError, setFinalOutputOpen, setKanbanOpen, userBrief } = useCoreStore();
  const { isDemoMode, setDemoMode } = useUiStore();

  const pendingApprovals = countPendingApprovals(tasks);

  if (isDemoMode) {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b border-appleBlue/15 bg-appleBlue/8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-appleBlue shrink-0" />
          <p className="text-[12px] font-medium text-appleBlue truncate">
            Demo mode — explore the office. Add an API key to run agents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDemoMode(false)}
          className="shrink-0 text-[11px] font-semibold text-appleBlue hover:underline"
        >
          Exit demo
        </button>
      </div>
    );
  }

  if (generationError) {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b border-red-200 bg-red-50 flex items-center gap-3">
        <AlertCircle size={15} className="text-red-500 shrink-0" />
        <p className="text-[12px] text-red-700 flex-1 min-w-0 truncate">{generationError}</p>
        <button
          type="button"
          onClick={() => useCoreStore.setState({ generationError: null })}
          className="p-1 rounded-lg hover:bg-red-100 text-red-400"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (isGeneratingAsset) {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b app-bar flex items-center gap-2">
        <Loader2 size={14} className="text-appleBlue animate-spin shrink-0" />
        <p className="text-[12px] font-medium" style={{ color: APPLE_TEXT }}>
          Generating final deliverable…
        </p>
      </div>
    );
  }

  if (pendingApprovals > 0) {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b border-orange-200 bg-orange-50 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setKanbanOpen(true)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          <MessageSquareWarning size={15} className="text-orange-500 shrink-0" />
          <p className="text-[12px] font-semibold text-orange-700">
            {pendingApprovals} task{pendingApprovals > 1 ? 's' : ''} waiting for your approval
          </p>
        </button>
        <button
          type="button"
          onClick={() => setKanbanOpen(true)}
          className="shrink-0 px-3 py-1 rounded-lg bg-orange-500 text-white text-[11px] font-semibold"
        >
          Review
        </button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b border-green-200 bg-green-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-appleGreen shrink-0" />
          <p className="text-[12px] font-semibold text-green-800">Project complete</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFinalOutputOpen(true)}
            className="px-3 py-1 rounded-lg bg-white border border-green-200 text-[11px] font-semibold text-green-800"
          >
            View output
          </button>
          <button
            type="button"
            onClick={() => exportProjectDeliverables()}
            className="px-3 py-1 rounded-lg bg-appleGreen text-white text-[11px] font-semibold flex items-center gap-1"
          >
            <Package size={12} />
            Export
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'working') {
    return (
      <div className="shrink-0 px-4 py-2.5 border-b app-bar flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 live-dot" />
          <p className="text-[12px] font-medium" style={{ color: APPLE_TEXT }}>
            Agents working — {tasks.filter((t) => t.status === 'in_progress').length} in progress
          </p>
        </div>
        {onEndProject && (
          <button
            type="button"
            onClick={onEndProject}
            className="text-[11px] font-semibold shrink-0"
            style={{ color: APPLE_TEXT_SECONDARY }}
          >
            End project
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 px-4 py-2.5 border-b app-bar flex items-center gap-2">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: APPLE_BLUE }} />
      <p className="text-[12px] font-medium" style={{ color: APPLE_TEXT_SECONDARY }}>
        Ready — {userBrief.trim()
          ? 'Go Live from Command Center to kick off your project'
          : 'add a brief in Command Center or talk to your lead agent'}
      </p>
    </div>
  );
};

export default SimulationPhaseBanner;
