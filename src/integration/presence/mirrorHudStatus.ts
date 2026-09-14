export type MirrorHudPhase =
  | 'demo'
  | 'cursor_live'
  | 'hub_ready'
  | 'connecting'
  | 'hub_offline';

export interface MirrorHudStatusInput {
  demoSwarmActive: boolean;
  connected: boolean;
  hubOnline: boolean;
  hubHealth: { ok: boolean } | null;
}

export interface MirrorHudStatus {
  phase: MirrorHudPhase;
  label: string;
  detail: string;
  emptyHint: string;
}

export function resolveMirrorHudStatus(input: MirrorHudStatusInput): MirrorHudStatus {
  const hubUp = input.hubOnline || input.connected;
  const hubPending = !hubUp && !input.hubHealth;

  if (input.demoSwarmActive) {
    return {
      phase: 'demo',
      label: 'Demo swarm',
      detail: 'Mock swarm is driving the office',
      emptyHint: 'Mock Swarm is active.',
    };
  }
  if (input.connected) {
    return {
      phase: 'cursor_live',
      label: 'Cursor live',
      detail: 'SSE connected — receiving Cursor presence',
      emptyHint: 'Run an agent/swarm in Cursor (hooks enabled), or try Mock Swarm.',
    };
  }
  if (hubUp) {
    return {
      phase: 'hub_ready',
      label: 'Hub ready',
      detail: 'Hub is up. Start an agent in Cursor or use Mock Swarm.',
      emptyHint: 'Run an agent/swarm in Cursor (hooks enabled), or try Mock Swarm.',
    };
  }
  if (hubPending) {
    return {
      phase: 'connecting',
      label: 'Connecting…',
      detail: 'Checking the local presence hub…',
      emptyHint: 'Connecting to the presence hub…',
    };
  }
  return {
    phase: 'hub_offline',
    label: 'Hub offline',
    detail: 'Start the app with npm run dev so Cursor hooks can reach the hub.',
    emptyHint: 'Hub offline — keep npm run dev running, then retry.',
  };
}
