import { describe, expect, it } from 'vitest';
import { resolveMirrorHudStatus } from './mirrorHudStatus';

describe('resolveMirrorHudStatus', () => {
  it('demo wins over connected', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: true,
      connected: true,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('demo');
    expect(s.label.toLowerCase()).toMatch(/demo/);
    expect(s.label.toLowerCase()).not.toMatch(/cursor live|cursor connected/);
  });

  it('never says Cursor live without SSE', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('hub_ready');
    expect(s.label.toLowerCase()).not.toMatch(/cursor live|cursor connected/);
    expect(s.detail.toLowerCase()).toMatch(/mock swarm|cursor/);
  });

  it('hub offline tells user to run npm run dev', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: false,
      hubHealth: { ok: false },
    });
    expect(s.phase).toBe('hub_offline');
    expect(s.detail.toLowerCase()).toMatch(/npm run dev/);
    expect(s.emptyHint.toLowerCase()).toMatch(/npm run dev/);
  });

  it('connecting while health unknown', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: false,
      hubOnline: false,
      hubHealth: null,
    });
    expect(s.phase).toBe('connecting');
  });

  it('SSE open is cursor_live', () => {
    const s = resolveMirrorHudStatus({
      demoSwarmActive: false,
      connected: true,
      hubOnline: true,
      hubHealth: { ok: true },
    });
    expect(s.phase).toBe('cursor_live');
  });
});
