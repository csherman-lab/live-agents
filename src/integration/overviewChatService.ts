import { getAllAgents } from '../data/agents';
import { getActiveAgentSet } from './store/teamStore';
import { AgentHost } from '../simulation/core/AgentHost';
import { useCoreStore } from './store/coreStore';
import { useUiStore } from './store/uiStore';

const stubSimulation = {
  getAllAgents: () => getAllAgents(getActiveAgentSet()),
  processScheduledTasks: () => {},
};

const hostCache = new Map<number, AgentHost>();

function getHost(agentIndex: number): AgentHost | null {
  const agent = getAllAgents(getActiveAgentSet()).find((a) => a.index === agentIndex);
  if (!agent) return null;

  if (!hostCache.has(agentIndex)) {
    hostCache.set(agentIndex, new AgentHost(agent, stubSimulation));
  }
  return hostCache.get(agentIndex)!;
}

export function openOverviewChat(agentIndex: number): void {
  useUiStore.setState({
    selectedNpcIndex: agentIndex,
    isChatting: true,
    inspectorTab: 'chat',
  });
}

export async function sendOverviewChatMessage(text: string): Promise<void> {
  const { selectedNpcIndex } = useUiStore.getState();
  if (selectedNpcIndex === null) return;

  const host = getHost(selectedNpcIndex);
  if (!host) return;

  await host.think(text, { isChat: true });
}

export function clearOverviewChatCache(): void {
  hostCache.clear();
}
