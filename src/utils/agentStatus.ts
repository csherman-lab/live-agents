import { Task, ProjectPhase } from '../integration/store/coreStore';
import type { AgentState } from '../types';

export type BubbleTone =
  | 'idle'
  | 'ready'
  | 'working'
  | 'moving'
  | 'talking'
  | 'approval'
  | 'done'
  | 'delivering'
  | 'waiting';

export type BubbleIcon =
  | 'brief'
  | 'work'
  | 'walk'
  | 'chat'
  | 'alert'
  | 'check'
  | 'sparkle'
  | 'loader'
  | 'coffee'
  | 'party';

export interface AgentBubbleContent {
  primary: string;
  secondary?: string;
  tone: BubbleTone;
  icon: BubbleIcon;
  urgent?: boolean;
  clickable?: boolean;
}

const IDLE_LINES = [
  'At their desk',
  'Ready to collaborate',
  'Standing by',
  'Reviewing the brief',
  'Available',
] as const;

/** Rich bubble payload — always returns meaningful copy for NPC agents. */
export function getAgentBubbleContent(
  agentIndex: number,
  leadAgentIndex: number,
  agentName: string,
  tasks: Task[],
  phase: ProjectPhase,
  isGeneratingAsset: boolean,
  liveStatus: AgentState = 'idle',
  userIndex = 0,
): AgentBubbleContent {
  if (agentIndex === userIndex) {
    return {
      primary: phase === 'working' ? 'Watching the team' : 'Your workspace',
      secondary: 'Tap agents to interact',
      tone: 'idle',
      icon: 'sparkle',
    };
  }

  if (isGeneratingAsset && agentIndex === leadAgentIndex) {
    return {
      primary: 'Delivering final asset',
      secondary: 'Almost there…',
      tone: 'delivering',
      icon: 'loader',
    };
  }

  if (agentIndex === leadAgentIndex && phase === 'done') {
    return {
      primary: 'Project complete',
      secondary: 'Tap to view output',
      tone: 'done',
      icon: 'party',
    };
  }

  const holdTask = tasks.find(
    (t) => t.assignedAgentId === agentIndex && t.status === 'on_hold',
  );
  if (holdTask && phase !== 'done') {
    return {
      primary: 'Needs your approval',
      secondary: truncate(holdTask.title, 36),
      tone: 'approval',
      icon: 'alert',
      urgent: true,
      clickable: true,
    };
  }

  const activeTask = tasks.find(
    (t) => t.assignedAgentId === agentIndex && t.status === 'in_progress',
  );
  if (activeTask) {
    return {
      primary: truncate(activeTask.title, 38),
      secondary: liveStatus === 'working' ? 'Deep in the work' : 'In progress',
      tone: 'working',
      icon: 'work',
    };
  }

  if (liveStatus === 'talking') {
    return {
      primary: 'In conversation',
      secondary: 'Chatting with the team',
      tone: 'talking',
      icon: 'chat',
    };
  }

  if (liveStatus === 'moving') {
    return {
      primary: 'On the move',
      secondary: 'Heading to their spot',
      tone: 'moving',
      icon: 'walk',
    };
  }

  if (liveStatus === 'working') {
    return {
      primary: 'Focused',
      secondary: agentName,
      tone: 'working',
      icon: 'work',
    };
  }

  const scheduled = tasks.find(
    (t) => t.assignedAgentId === agentIndex && t.status === 'scheduled',
  );
  if (scheduled && phase === 'working') {
    return {
      primary: 'Up next',
      secondary: truncate(scheduled.title, 36),
      tone: 'waiting',
      icon: 'coffee',
    };
  }

  if (agentIndex === leadAgentIndex && phase === 'idle') {
    return {
      primary: 'Waiting for your brief',
      secondary: 'Start from Command Center',
      tone: 'ready',
      icon: 'brief',
      urgent: true,
      clickable: true,
    };
  }

  if (phase === 'working') {
    return {
      primary: 'On standby',
      secondary: 'Ready for the next task',
      tone: 'waiting',
      icon: 'coffee',
    };
  }

  if (phase === 'done') {
    return {
      primary: 'All done',
      secondary: 'Great work today',
      tone: 'done',
      icon: 'check',
    };
  }

  const idleLine = IDLE_LINES[agentIndex % IDLE_LINES.length];
  return {
    primary: idleLine,
    secondary: agentName,
    tone: 'idle',
    icon: 'sparkle',
  };
}

/** @deprecated Use getAgentBubbleContent */
export function getAgentStatusMessage(
  agentIndex: number,
  leadAgentIndex: number,
  tasks: Task[],
  phase: ProjectPhase,
  isGeneratingAsset: boolean,
): string | null {
  const content = getAgentBubbleContent(
    agentIndex,
    leadAgentIndex,
    '',
    tasks,
    phase,
    isGeneratingAsset,
  );
  if (content.secondary) return `${content.primary} · ${content.secondary}`;
  return content.primary;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed) return 'Untitled task';
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1) + '…';
}
