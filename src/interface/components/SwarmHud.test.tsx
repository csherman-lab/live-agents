import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SwarmHud from './SwarmHud';
import { usePresenceStore } from '../../integration/presence/presenceStore';
import type { PresenceAgent } from '../../integration/presence/presenceTypes';

function makeAgents(count: number): Record<string, PresenceAgent> {
  const agents: Record<string, PresenceAgent> = {};
  for (let i = 0; i < count; i++) {
    agents[`a${i}`] = {
      agentId: `a${i}`,
      name: `Agent ${i}`,
      state: i === 0 ? 'working' : 'idle',
      statusText: '',
      parentId: null,
      provider: 'cursor',
      lastTs: Date.now(),
    };
  }
  return agents;
}

describe('SwarmHud', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    usePresenceStore.getState().clear();
    usePresenceStore.setState({
      mirrorMode: false,
      connected: false,
      hubOnline: false,
      hubHealth: null,
      demoSwarmActive: false,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    // Exit Demo re-hydrates from the hub — stub fetch so tests don't hit real network.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no hub in tests')));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it('does not crash when mirrorMode flips false -> true (all hooks must run every render)', () => {
    act(() => {
      root.render(<SwarmHud />);
    });
    // Not in mirror mode yet — renders nothing.
    expect(container.textContent).toBe('');

    // Flipping mirrorMode on the *same* mounted instance must not change how many
    // hooks the component calls, or React throws "Rendered more hooks than during
    // the previous render."
    expect(() => {
      act(() => {
        usePresenceStore.getState().setMirrorMode(true);
      });
    }).not.toThrow();

    expect(container.textContent).toContain('Mock Swarm');
  });

  it('renders the working-agent progress bar without crashing when mounted already in mirror mode', () => {
    usePresenceStore.setState({ mirrorMode: true, agents: makeAgents(3) });

    expect(() => {
      act(() => {
        root.render(<SwarmHud />);
      });
    }).not.toThrow();

    expect(container.textContent).toContain('Mock Swarm');
  });

  it('shows an Exit Demo affordance while demoSwarmActive, and clears the roster on click', () => {
    usePresenceStore.setState({ mirrorMode: true, demoSwarmActive: true, agents: makeAgents(2) });
    act(() => {
      root.render(<SwarmHud />);
    });

    const exitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /exit demo|clear demo/i.test(b.textContent || ''),
    );
    expect(exitBtn).toBeTruthy();

    act(() => {
      exitBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(usePresenceStore.getState().demoSwarmActive).toBe(false);
    expect(Object.keys(usePresenceStore.getState().agents)).toHaveLength(0);
  });

  it('does not show Exit Demo when demoSwarmActive is false', () => {
    usePresenceStore.setState({ mirrorMode: true, demoSwarmActive: false, agents: makeAgents(1) });
    act(() => {
      root.render(<SwarmHud />);
    });
    const exitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /exit demo|clear demo/i.test(b.textContent || ''),
    );
    expect(exitBtn).toBeFalsy();
  });
});
