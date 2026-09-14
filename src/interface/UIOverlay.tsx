import React, { Suspense, useState } from 'react';
import { USER_COLOR } from '../theme/brand';
import { getAllAgents, getAllCharacters, USER_NAME, USER_ID } from '../data/agents';
import { getMirrorNpcAgents } from '../integration/presence/buildMirrorSystem';
import { useUiStore } from '../integration/store/uiStore';
import { useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { usePresenceStore } from '../integration/presence/presenceStore';
import { mapPresenceBehavior } from '../integration/presence/mapPresenceBehavior';
import { getAgentBubbleContent } from '../utils/agentStatus';
import type { AgentBubbleContent } from '../utils/agentStatus';
import AgentHeadBubble from './components/AgentHeadBubble';
import Nameplate from './components/Nameplate';
import SwarmHud from './components/SwarmHud';
import AgentCustomizePanel from './components/AgentCustomizePanel';

const InfoModal = React.lazy(() => import('./InfoModal'));

function mirrorBubble(
  statusText: string | undefined,
  presenceState: 'idle' | 'thinking' | 'working' | 'done',
  isLead: boolean,
): AgentBubbleContent {
  const mapped = mapPresenceBehavior(presenceState, undefined, { isLead });
  return {
    // Prefer live status text (SceneManager gates "Working" until arrival).
    primary: statusText ?? mapped.bubblePrimary,
    tone: mapped.bubbleTone,
    icon: mapped.bubbleIcon,
    clickable: true,
  };
}

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
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { tasks, phase, isGeneratingAsset } = useCoreStore();
  const system = useActiveTeam();
  const mirrorMode = usePresenceStore((s) => s.mirrorMode);
  const agentStatusTexts = usePresenceStore((s) => s.agentStatusTexts);
  const indexByAgentId = usePresenceStore((s) => s.indexByAgentId);
  const presenceAgents = usePresenceStore((s) => s.agents);
  const npcAgents = mirrorMode ? getMirrorNpcAgents(system) : getAllAgents(system);
  const allCharacters = mirrorMode
    ? [
        {
          id: USER_ID,
          index: system.user.index,
          name: USER_NAME,
          color: USER_COLOR,
          model: 'Human',
          description: 'You',
        },
        ...npcAgents,
      ]
    : getAllCharacters(system);

  const presenceStateForIndex = (agentIndex: number): 'idle' | 'thinking' | 'working' | 'done' => {
    const agentId = Object.entries(indexByAgentId).find(([, idx]) => idx === agentIndex)?.[0];
    if (!agentId) return 'idle';
    return presenceAgents[agentId]?.state ?? 'idle';
  };

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

  const bubbleFor = (agentIndex: number, agentName: string): AgentBubbleContent => {
    if (mirrorMode && agentIndex !== system.user.index) {
      const isLead = agentIndex === system.leadAgent.index;
      return mirrorBubble(
        agentStatusTexts[agentIndex],
        presenceStateForIndex(agentIndex),
        isLead,
      );
    }
    return getAgentBubbleContent(
      agentIndex,
      system.leadAgent.index,
      agentName,
      tasks,
      phase,
      isGeneratingAsset,
      agentStatuses[agentIndex] ?? 'idle',
      system.user.index,
    );
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden select-none">
      <SwarmHud />

      {npcAgents.map((agent) => {
        const pos = npcScreenPositions[agent.index];
        if (!pos) return null;
        if (focusedIndex === agent.index) return null;
        const isLead = agent.index === system.leadAgent.index;
        const dimmed =
          mirrorMode &&
          mapPresenceBehavior(presenceStateForIndex(agent.index), undefined, { isLead }).dimmed;

        return (
          <Nameplate
            key={`nameplate-${agent.index}`}
            name={agent.name}
            agentColor={agent.color}
            position={pos}
            dimmed={dimmed}
          />
        );
      })}

      {npcAgents.map((agent) => {
        const pos = npcScreenPositions[agent.index];
        if (!pos) return null;
        if (focusedIndex === agent.index) return null;

        const content = bubbleFor(agent.index, agent.name);

        return (
          <AgentHeadBubble
            key={`ambient-${agent.index}`}
            content={content}
            agentColor={agent.color}
            position={pos}
            yOffset={-40}
            onClick={() => setSelectedNpc(agent.index)}
          />
        );
      })}

      {focusedAgent && focusedPosition && (
        <AgentHeadBubble
          key={`focused-${focusedAgent.index}`}
          variant="focused"
          content={bubbleFor(focusedAgent.index, focusedAgent.name)}
          agentColor={focusedAgent.color}
          agentName={
            focusedAgent.index === system.user.index
              ? `${focusedAgent.name} (You)`
              : focusedAgent.name
          }
          position={focusedPosition}
          yOffset={-32}
          onClick={() => {
            setSelectedNpc(focusedAgent.index);
            if (mirrorMode && focusedAgent.index !== system.user.index) {
              setCustomizeOpen(true);
            }
          }}
        />
      )}

      {mirrorMode && customizeOpen && selectedNpcIndex != null && selectedNpcIndex !== system.user.index && (
        <AgentCustomizePanel
          agentIndex={selectedNpcIndex}
          onClose={() => setCustomizeOpen(false)}
        />
      )}

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
