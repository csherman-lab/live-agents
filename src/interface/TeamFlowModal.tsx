import { Background, Edge, ReactFlow, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AgenticSystem } from '../data/agents';
import { DirectionalEdge } from './VisualConfigurator/edges/DirectionalEdge';
import { VisualFlowNode } from './VisualConfigurator/nodes/VisualFlowNode';
import { systemToFlow, VisualAgentNode } from './VisualConfigurator/flowUtils';
import { useFlowFocus } from './VisualConfigurator/hooks/useFlowFocus';
import { TeamBadge } from './components/TeamBadge';
import { TeamOutputBadge } from './components/TeamOutputBadge';

const nodeTypes = { agent: VisualFlowNode, user: VisualFlowNode };
const edgeTypes = { default: DirectionalEdge, hierarchy: DirectionalEdge, smoothstep: DirectionalEdge };

interface TeamFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  system: AgenticSystem;
}

const FlowViewport: React.FC<{ system: AgenticSystem }> = ({ system }) => {
  const { fitView } = useReactFlow();
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => systemToFlow(system), [system]);
  const [nodes] = useState<VisualAgentNode[]>(initialNodes);
  const [edges] = useState<Edge[]>(initialEdges);
  const { nodesWithFocus, edgesWithFocus } = useFlowFocus(nodes, edges, null, system.leadAgent.id);

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    return () => clearTimeout(timer);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodesWithFocus}
      edges={edgesWithFocus}
      nodeTypes={nodeTypes as any}
      edgeTypes={edgeTypes as any}
      nodeOrigin={[0.5, 0]}
      fitView
      proOptions={{ hideAttribution: true }}
      nodesConnectable={false}
      nodesDraggable={false}
      elementsSelectable={false}
      zoomOnScroll
      maxZoom={1.5}
      minZoom={0.2}
      className="theme-designer-canvas"
      style={{ background: 'var(--apple-bg)' }}
    >
      <Background gap={28} color="var(--flow-dot-color)" size={1.5} />
    </ReactFlow>
  );
};

const TeamFlowModal: React.FC<TeamFlowModalProps> = ({ isOpen, onClose, system }) => {
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay fixed inset-0 z-[650] flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onClose} />
      <div className="modal-panel relative w-full max-w-6xl h-[min(85vh,720px)] flex flex-col glass-panel-elevated rounded-[var(--apple-radius-lg)] overflow-hidden animate-modal-in shadow-2xl">
        <div className="app-header h-14 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-appleBlue/10 flex items-center justify-center">
              <GitBranch size={16} className="text-appleBlue" />
            </div>
            <TeamBadge system={system} />
            <TeamOutputBadge system={system} className="hidden sm:flex" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.04] transition-apple"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 relative min-h-0">
          <ReactFlowProvider>
            <FlowViewport system={system} />
          </ReactFlowProvider>
        </div>

        <div className="px-5 py-3 border-t app-footer flex items-center justify-between shrink-0">
          <span className="text-[11px] font-medium text-[var(--apple-text-secondary)]">
            Hierarchy flow · read-only view
          </span>
          <span className="text-[11px] text-zinc-400">Scroll to zoom · drag to pan</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TeamFlowModal;
