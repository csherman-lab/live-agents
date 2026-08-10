export const PRESENCE_STATES = ['idle', 'thinking', 'working', 'done'] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export const PRESENCE_EVENT_TYPE = 'agent.presence' as const;

export interface AgentPresenceEvent {
  type: typeof PRESENCE_EVENT_TYPE;
  v: 1;
  ts: number;
  agentId: string;
  name: string;
  state: PresenceState;
  statusText?: string;
  parentId?: string | null;
  provider?: string;
  op?: 'upsert' | 'remove';
}

export interface PresenceAgent {
  agentId: string;
  name: string;
  state: PresenceState;
  statusText?: string;
  parentId?: string | null;
  provider: string;
  lastTs: number;
}

function isPresenceState(value: unknown): value is PresenceState {
  return typeof value === 'string' && (PRESENCE_STATES as readonly string[]).includes(value);
}

/** Parse and validate a presence event. Returns null if invalid. */
export function parsePresenceEvent(raw: unknown): AgentPresenceEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (o.type !== PRESENCE_EVENT_TYPE) return null;
  if (o.v !== 1) return null;
  if (typeof o.ts !== 'number' || !Number.isFinite(o.ts)) return null;
  if (typeof o.agentId !== 'string' || !o.agentId.trim()) return null;
  if (typeof o.name !== 'string' || !o.name.trim()) return null;
  if (!isPresenceState(o.state)) return null;

  const op = o.op === 'remove' ? 'remove' : 'upsert';
  const event: AgentPresenceEvent = {
    type: PRESENCE_EVENT_TYPE,
    v: 1,
    ts: o.ts,
    agentId: o.agentId.trim(),
    name: o.name.trim(),
    state: o.state,
    op,
  };

  if (typeof o.statusText === 'string' && o.statusText.trim()) {
    event.statusText = o.statusText.trim().slice(0, 80);
  }
  if (o.parentId === null) event.parentId = null;
  else if (typeof o.parentId === 'string') event.parentId = o.parentId;
  if (typeof o.provider === 'string' && o.provider.trim()) {
    event.provider = o.provider.trim();
  }

  return event;
}

export function createPresenceEvent(
  partial: Omit<AgentPresenceEvent, 'type' | 'v' | 'ts'> & { ts?: number },
): AgentPresenceEvent {
  return {
    type: PRESENCE_EVENT_TYPE,
    v: 1,
    ts: partial.ts ?? Date.now(),
    agentId: partial.agentId,
    name: partial.name,
    state: partial.state,
    statusText: partial.statusText,
    parentId: partial.parentId,
    provider: partial.provider ?? 'cursor',
    op: partial.op ?? 'upsert',
  };
}
