import { describe, expect, it } from 'vitest';
import { friendlyAgentName, mapHookToPresence, truncate } from '../../../tools/cursor-bridge/mapHook.mjs';

describe('mapHookToPresence', () => {
  it('maps sessionStart to Cursor thinking', () => {
    const e = mapHookToPresence(
      { hook_event_name: 'sessionStart', conversation_id: 'c1' },
      { now: 100 },
    );
    expect(e.agentId).toBe('c1');
    expect(e.name).toBe('Cursor');
    expect(e.state).toBe('thinking');
    expect(e.ts).toBe(100);
  });

  it('maps subagentStart with friendly name', () => {
    const e = mapHookToPresence({
      hook_event_name: 'subagentStart',
      conversation_id: 'c1',
      subagent_id: 's1',
      subagent_type: 'explore',
    }) as { name: string; parentId?: string | null; state: string };
    expect(e.name).toBe('Explore');
    expect(e.parentId).toBe('c1');
    expect(e.state).toBe('thinking');
  });

  it('maps preToolUse with file path status', () => {
    const e = mapHookToPresence({
      hook_event_name: 'preToolUse',
      conversation_id: 'c1',
      tool_name: 'Read',
      tool_input: { path: '/Users/me/proj/src/App.tsx' },
    });
    expect(e.state).toBe('working');
    expect(e.statusText).toMatch(/Reading/);
    expect(e.statusText).toMatch(/App\.tsx/);
  });

  it('sessionEnd uses remove op', () => {
    const e = mapHookToPresence({
      hook_event_name: 'sessionEnd',
      conversation_id: 'c1',
    });
    expect(e.op).toBe('remove');
  });

  it('stop on lead clears session with remove', () => {
    const e = mapHookToPresence({
      hook_event_name: 'stop',
      conversation_id: 'c1',
    });
    expect(e.op).toBe('remove');
    expect(e.agentId).toBe('c1');
  });

  it('stop on subagent removes that worker', () => {
    const e = mapHookToPresence({
      hook_event_name: 'stop',
      conversation_id: 'c1',
      subagent_id: 's1',
      subagent_type: 'shell',
    });
    expect(e.op).toBe('remove');
    expect(e.agentId).toBe('s1');
  });
});

describe('friendlyAgentName', () => {
  it('maps known types', () => {
    expect(friendlyAgentName('shell')).toBe('Shell');
    expect(friendlyAgentName('best-of-n-runner')).toBe('Best-of-N');
  });
});

describe('truncate', () => {
  it('shortens long strings', () => {
    expect(truncate('a'.repeat(100))?.endsWith('…')).toBe(true);
  });
});
