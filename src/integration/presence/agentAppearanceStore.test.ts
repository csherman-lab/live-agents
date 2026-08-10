import { beforeEach, describe, expect, it } from 'vitest';
import {
  appearanceRoleKey,
  resolveAppearance,
  useAgentAppearanceStore,
} from './agentAppearanceStore';

describe('agentAppearanceStore', () => {
  beforeEach(() => {
    useAgentAppearanceStore.setState({ byAgentId: {} });
  });

  it('resolves by agentId then role fallback', () => {
    useAgentAppearanceStore.getState().setAppearance(
      'session-abc',
      { name: 'Blue Composer', color: '#4285F4', accessory: 2 },
      'Composer',
    );
    const byId = useAgentAppearanceStore.getState().byAgentId;
    expect(byId['session-abc']?.name).toBe('Blue Composer');
    expect(byId[appearanceRoleKey('Composer')]?.color).toBe('#4285F4');

    // New Cursor session id — role key still applies.
    const look = resolveAppearance(byId, 'session-xyz', 'Composer');
    expect(look.name).toBe('Blue Composer');
    expect(look.color).toBe('#4285F4');
  });
});
