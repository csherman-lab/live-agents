import React, { Suspense, useState } from 'react';
import { getAllAgents, getAllCharacters } from '../data/agents';
import { useUiStore } from '../integration/store/uiStore';
import { useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { getAgentBubbleContent } from '../utils/agentStatus';
import AgentHeadBubble from './components/AgentHeadBubble';

const InfoModal = React.lazy(() => import('./InfoModal'));

const UIOverlay: React.FC = () => {
  const {
    selectedNpcIndex,
    selectedPosition,
    hoveredNpcIndex,
    hoveredPoiLabel,
    hoverPosition,
    npcScreenPositions,
    agentStatuses,
    setSelectedNpc,
  } = useUiStore();
  const [isHelpOpen, setHelpOpen] = useState(false);
  const { tasks, phase, isGeneratingAsset } = useCoreStore();
  const system = useActiveTeam();
  const npcAgents = getAllAgents(system);
  const allCharacters = getAllCharacters(system);

  const focusedIndex =
    selectedNpcIndex !== null
      ? selectedNpcIndex
      : hoveredNpcIndex !== null && hoveredNpcIndex !== selectedNpcIndex
        ? hoveredNpcIndex
        : null;

  const focusedPosition =
    focusedIndex === selectedNpcIndex && selectedPosition
      ? selectedPosition
      : focusedIndex === hoveredNpcIndex && hoverPosition
        ? hoverPosition
        : null;

  const focusedAgent =
    focusedIndex != null
      ? allCharacters.find((a) => a.index === focusedIndex) ?? null
      : null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      {/* Ambient status bubbles — one per agent, hidden when that agent is focused */}
      {npcAgents.map((agent) => {
        const pos = npcScreenPositions[agent.index];
        if (!pos) return null;
        if (focusedIndex === agent.index) return null;

        const content = getAgentBubbleContent(
          agent.index,
          system.leadAgent.index,
          agent.name,
          tasks,
          phase,
          isGeneratingAsset,
          agentStatuses[agent.index] ?? 'idle',
          system.user.index,
        );

        return (
          <AgentHeadBubble
            key={`ambient-${agent.index}`}
            content={content}
            agentColor={agent.color}
            position={pos}
            yOffset={-40}
            onClick={
              content.clickable
                ? () => setSelectedNpc(agent.index)
                : undefined
            }
          />
        );
      })}

      {/* Focused agent — larger bubble with name + full status */}
      {focusedAgent && focusedPosition && (
        <AgentHeadBubble
          key={`focused-${focusedAgent.index}`}
          variant="focused"
          content={getAgentBubbleContent(
            focusedAgent.index,
            system.leadAgent.index,
            focusedAgent.name,
            tasks,
            phase,
            isGeneratingAsset,
            agentStatuses[focusedAgent.index] ?? 'idle',
            system.user.index,
          )}
          agentColor={focusedAgent.color}
          agentName={
            focusedAgent.index === system.user.index
              ? `${focusedAgent.name} (You)`
              : focusedAgent.name
          }
          position={focusedPosition}
          yOffset={-32}
          onClick={() => setSelectedNpc(focusedAgent.index)}
        />
      )}

      {/* POI hover label */}
      {hoveredPoiLabel && hoverPosition && !focusedAgent && (
        <div
          className="absolute z-10 pointer-events-none transition-all duration-75 ease-out"
          style={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            transform: 'translate(-50%, -100%) translateY(-12px)',
          }}
        >
          <div className="relative px-3 py-1.5 rounded-xl glass-panel-elevated shadow-lg">
            <span className="text-[11px] font-semibold text-[var(--apple-text)]">{hoveredPoiLabel}</span>
            <div
              className="absolute left-1/2 -bottom-[5px] w-2.5 h-2.5 -translate-x-1/2 rotate-45 glass-panel-elevated border-r border-b"
              style={{ borderColor: 'var(--apple-border)' }}
              aria-hidden
            />
          </div>
        </div>
      )}

      {isHelpOpen && (
        <Suspense fallback={null}>
          <InfoModal open={isHelpOpen} onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default UIOverlay;
