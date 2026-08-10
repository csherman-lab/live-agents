#!/usr/bin/env node
/**
 * Smoke-test the local presence hub + hook mapper.
 * Requires: npm run dev on :3000
 */
import { mapHookToPresence } from './mapHook.mjs';

const HUB = process.env.LIVE_AGENTS_PRESENCE_URL || 'http://127.0.0.1:3000/api/presence';

async function mustOk(label, fn) {
  try {
    await fn();
    console.log(`✓ ${label}`);
  } catch (err) {
    console.error(`✗ ${label}`);
    console.error(err?.message || err);
    process.exitCode = 1;
  }
}

async function main() {
  await mustOk('health endpoint', async () => {
    const res = await fetch(`${HUB}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error('health.ok !== true');
  });

  const event = mapHookToPresence({
    hook_event_name: 'preToolUse',
    conversation_id: 'smoke-session',
    tool_name: 'Shell',
    tool_input: { command: 'echo live-agents-smoke' },
  });

  await mustOk('POST presence event', async () => {
    const res = await fetch(HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ok) throw new Error('post.ok !== true');
  });

  await mustOk('snapshot includes smoke agent', async () => {
    const res = await fetch(HUB);
    const data = await res.json();
    const agents = data.agents || data;
    const found = (Array.isArray(agents) ? agents : []).some((a) => a.agentId === 'smoke-session');
    if (!found) throw new Error('smoke-session not in snapshot');
  });

  await mustOk('hook script maps + posts via stdin simulation', async () => {
    const payload = {
      hook_event_name: 'subagentStart',
      conversation_id: 'smoke-session',
      subagent_id: 'smoke-explore',
      subagent_type: 'explore',
    };
    const mapped = mapHookToPresence(payload);
    if (mapped.name !== 'Explore') throw new Error(`expected Explore, got ${mapped.name}`);
    const res = await fetch(HUB, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapped),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  if (process.exitCode) {
    console.error('\nSmoke failed. Is npm run dev running on :3000?');
  } else {
    console.log('\nAll smoke checks passed.');
  }
}

main();
