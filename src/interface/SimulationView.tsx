import { Maximize2, Minimize2, Eye, Radio } from 'lucide-react';
import React, { useState } from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import InspectorPanel from './InspectorPanel';
import UIOverlay from './UIOverlay';
import TeamFlowModal from './TeamFlowModal';
import { AuditModal } from './AuditModal';
import { TeamBadge } from './components/TeamBadge';
import { TeamOutputBadge } from './components/TeamOutputBadge';
import SimulationPhaseBanner from './SimulationPhaseBanner';
import SceneLoadingOverlay from './components/SceneLoadingOverlay';
import WebGPUFallbackOverlay from './components/WebGPUFallbackOverlay';

interface SimulationViewProps {
  canvasRef: React.Ref<HTMLDivElement>;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
  sceneReady?: boolean;
  sceneError?: boolean;
}

const SimulationView: React.FC<SimulationViewProps> = ({
  canvasRef,
  isFullscreen,
  setIsFullscreen,
  sceneReady = true,
  sceneError = false,
}) => {
  const { selectedNpcIndex, activeAuditTaskId, setActiveAuditTaskId } = useUiStore();
  const { phase, resetProject } = useCoreStore();
  const activeSet = useActiveTeam();
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);

  React.useEffect(() => {
    document.body.style.overflow = activeAuditTaskId ? 'hidden' : '';
  }, [activeAuditTaskId]);

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 relative">
      {/* Simulation header bar */}
      <div className="h-[48px] border-b flex items-center justify-between px-5 backdrop-blur-xl shrink-0 app-bar">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={() => setIsFlowModalOpen(true)}
            className="flex items-center gap-3 hover:bg-black/[0.04] px-3 py-1.5 rounded-xl transition-apple active:scale-95 group"
            title="View Team Flow"
          >
            <TeamBadge system={activeSet} />
            <div className="w-7 h-7 rounded-lg border border-black/5 flex items-center justify-center text-zinc-400 group-hover:text-appleBlue group-hover:border-appleBlue/20 transition-apple">
              <Eye size={13} />
            </div>
          </button>

          <TeamOutputBadge system={activeSet} className="hidden md:flex" />

          {phase === 'working' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-[11px] font-semibold">
              <Radio size={12} className="live-dot" />
              Live
            </div>
          )}
        </div>

        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-apple"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <SimulationPhaseBanner
        onEndProject={() => {
          resetProject();
        }}
      />

      <div ref={canvasRef} className="flex-1 min-h-0 relative overflow-hidden" style={{ background: 'var(--apple-bg)' }}>
        {sceneError ? (
          <WebGPUFallbackOverlay />
        ) : (
          <SceneLoadingOverlay visible={!sceneReady} />
        )}
        {!sceneError && <UIOverlay />}
        {isFullscreen && selectedNpcIndex !== null && (
          <div className="absolute top-4 right-4 bottom-4 w-96 z-50 pointer-events-none flex flex-col gap-4">
            <InspectorPanel isFloating />
          </div>
        )}
      </div>

      {isFlowModalOpen && (
        <TeamFlowModal
          isOpen={isFlowModalOpen}
          onClose={() => setIsFlowModalOpen(false)}
          system={activeSet}
        />
      )}

      {activeAuditTaskId && (
        <AuditModal
          isOpen={!!activeAuditTaskId}
          taskId={activeAuditTaskId}
          onClose={() => setActiveAuditTaskId(null)}
        />
      )}
    </div>
  );
};

export default SimulationView;
