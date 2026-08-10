import type { PresenceAgent } from './presenceTypes';

/** True when Cursor companion owns locomotion — ignore Advanced task desk/spawn movers. */
export function shouldIgnoreCoreTaskLocomotion(mirrorMode: boolean): boolean {
  return mirrorMode;
}

export function mirrorPlacementKey(placement: string, characterState: string): string {
  return `${placement}:${characterState}`;
}

export interface MirrorHudRow {
  agentId: string;
  name: string;
  detail: string;
  lastTs: number;
}

/** One live status row per agent (lead first). Not an append-only activity log. */
export function mirrorHudRows(agents: PresenceAgent[]): MirrorHudRow[] {
  return agents
    .slice()
    .sort((a, b) => {
      const aLead = a.parentId ? 1 : 0;
      const bLead = b.parentId ? 1 : 0;
      if (aLead !== bLead) return aLead - bLead;
      return a.name.localeCompare(b.name);
    })
    .map((a) => ({
      agentId: a.agentId,
      name: a.name,
      detail:
        a.statusText?.trim() ||
        (a.state === 'working'
          ? 'Working'
          : a.state === 'thinking'
            ? 'Thinking…'
            : a.state === 'done'
              ? 'Done'
              : 'Standing by'),
      lastTs: a.lastTs,
    }));
}
