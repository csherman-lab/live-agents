#!/usr/bin/env node
/**
 * Cursor → Live Agents presence bridge.
 * Reads hook JSON from stdin, POSTs AgentPresenceEvent to the local hub.
 * Always fail-open (exit 0) so Cursor is never blocked.
 */
import { stdin } from 'node:process';
import { mapHookToPresence } from '../../tools/cursor-bridge/mapHook.mjs';

const HUB_URL = process.env.LIVE_AGENTS_PRESENCE_URL || 'http://127.0.0.1:3000/api/presence';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (chunk) => {
      data += chunk;
    });
    stdin.on('end', () => resolve(data));
    stdin.on('error', () => resolve(''));
  });
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) {
      process.stdout.write('{}\n');
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      process.stdout.write('{}\n');
      return;
    }

    const event = mapHookToPresence(payload);
    const res = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => null);

    // Soft diagnostic on stderr only — never blocks Cursor
    if (!res || !res.ok) {
      console.error(
        `[live-agents] presence hub unreachable at ${HUB_URL} (is npm run dev running?)`,
      );
    }
  } catch (err) {
    console.error('[live-agents] emit-presence failed open:', err?.message || err);
  }
  process.stdout.write('{}\n');
}

main();
