import type { PresenceState } from './presenceTypes';
import type { CharacterStateKey } from '../../types';
import type { AgentState } from '../../types';
import type { BubbleTone, BubbleIcon } from '../../utils/agentStatus';

export type PresencePlacement = 'stage' | 'desk' | 'lounge' | 'board';

export interface PresenceBehavior {
  agentState: AgentState;
  characterState: CharacterStateKey;
  /** Empty string = hide head bubble. */
  bubblePrimary: string;
  bubbleTone: BubbleTone;
  bubbleIcon: BubbleIcon;
  /** @deprecated Prefer `placement`. */
  preferDesk: boolean;
  placement: PresencePlacement;
  /** Dull / desaturated when not actively working. */
  dimmed: boolean;
  speaking: boolean;
}

/**
 * Map Cursor presence → office body language.
 * Working = desks + "Working" bubble. Idle = couch, no bubble. Thinking = board/stage.
 */
export function mapPresenceBehavior(
  state: PresenceState,
  _statusText?: string,
  opts: { isLead?: boolean } = {},
): PresenceBehavior {
  const isLead = !!opts.isLead;

  if (state === 'working') {
    return {
      agentState: 'working',
      characterState: isLead ? 'talk' : 'sit_work',
      bubblePrimary: 'Working',
      bubbleTone: 'working',
      bubbleIcon: 'work',
      preferDesk: !isLead,
      placement: isLead ? 'stage' : 'desk',
      dimmed: false,
      speaking: isLead,
    };
  }

  if (state === 'thinking') {
    return {
      agentState: 'talking',
      characterState: 'look_around',
      bubblePrimary: '',
      bubbleTone: 'waiting',
      bubbleIcon: 'loader',
      preferDesk: false,
      // Lead stays center; specialists gather at the whiteboard.
      placement: isLead ? 'stage' : 'board',
      dimmed: false,
      speaking: false,
    };
  }

  if (state === 'done') {
    return {
      agentState: 'idle',
      characterState: isLead ? 'idle' : 'sit_idle',
      bubblePrimary: '',
      bubbleTone: 'done',
      bubbleIcon: 'check',
      preferDesk: false,
      placement: isLead ? 'stage' : 'lounge',
      // Lead stays readable on stage; only specialists dull on the couch.
      dimmed: !isLead,
      speaking: false,
    };
  }

  return {
    agentState: 'idle',
    characterState: isLead ? 'idle' : 'sit_idle',
    bubblePrimary: '',
    bubbleTone: 'idle',
    bubbleIcon: 'coffee',
    preferDesk: false,
    placement: isLead ? 'stage' : 'lounge',
    dimmed: !isLead,
    speaking: false,
  };
}
