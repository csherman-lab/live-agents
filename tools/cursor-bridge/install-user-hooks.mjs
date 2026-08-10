#!/usr/bin/env node
/**
 * Install Live Agents presence hooks at the user level (~/.cursor/hooks.json)
 * so any workspace can stream Cursor agents into the office.
 *
 * Usage: node tools/cursor-bridge/install-user-hooks.mjs
 */
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const cursorDir = join(homedir(), '.cursor');
const hooksDir = join(cursorDir, 'hooks');
const hooksJsonPath = join(cursorDir, 'hooks.json');
const scriptName = 'live-agents-emit-presence.mjs';
const scriptDest = join(hooksDir, scriptName);
const mapDest = join(hooksDir, 'live-agents-mapHook.mjs');

const EVENTS = [
  'sessionStart',
  'sessionEnd',
  'subagentStart',
  'subagentStop',
  'afterAgentThought',
  'preToolUse',
  'postToolUse',
  'stop',
];

function loadHooksJson() {
  if (!existsSync(hooksJsonPath)) return { version: 1, hooks: {} };
  const raw = readFileSync(hooksJsonPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Never silently overwrite a file we can't parse — that would destroy the
    // user's existing (if malformed) hooks.json. Abort loudly instead.
    console.error(`Refusing to install: ${hooksJsonPath} is not valid JSON.`);
    console.error(`  ${err?.message || err}`);
    console.error('Fix or remove that file, then re-run npm run bridge:install.');
    process.exit(1);
  }
}

function isOurHook(entry) {
  const cmd = typeof entry === 'string' ? entry : entry?.command;
  return typeof cmd === 'string' && cmd.includes('live-agents-emit-presence');
}

function main() {
  mkdirSync(hooksDir, { recursive: true });

  copyFileSync(join(repoRoot, 'tools/cursor-bridge/mapHook.mjs'), mapDest);
  // User hook script with import relative to ~/.cursor/hooks/
  const userScript = `#!/usr/bin/env node
import { stdin } from 'node:process';
import { mapHookToPresence } from './live-agents-mapHook.mjs';

const HUB_URL = process.env.LIVE_AGENTS_PRESENCE_URL || 'http://127.0.0.1:3000/api/presence';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    stdin.setEncoding('utf8');
    stdin.on('data', (c) => { data += c; });
    stdin.on('end', () => resolve(data));
    stdin.on('error', () => resolve(''));
  });
}

async function main() {
  try {
    const raw = await readStdin();
    if (!raw) { process.stdout.write('{}\\n'); return; }
    let payload;
    try { payload = JSON.parse(raw); } catch { process.stdout.write('{}\\n'); return; }
    const event = mapHookToPresence(payload);
    const res = await fetch(HUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }).catch(() => null);
    if (!res || !res.ok) {
      console.error('[live-agents] hub unreachable at ' + HUB_URL + ' — run npm run dev in live-agents');
    }
  } catch (err) {
    console.error('[live-agents] hook fail-open:', err?.message || err);
  }
  process.stdout.write('{}\\n');
}
main();
`;
  writeFileSync(scriptDest, userScript, 'utf8');
  chmodSync(scriptDest, 0o755);

  const config = loadHooksJson();
  if (!config.hooks) config.hooks = {};
  config.version = config.version || 1;

  const command = `node ./hooks/${scriptName}`;
  for (const event of EVENTS) {
    const list = Array.isArray(config.hooks[event]) ? config.hooks[event] : [];
    const filtered = list.filter((e) => !isOurHook(e));
    filtered.push({ command });
    config.hooks[event] = filtered;
  }

  if (existsSync(hooksJsonPath)) {
    copyFileSync(hooksJsonPath, `${hooksJsonPath}.bak`);
  }
  writeFileSync(hooksJsonPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

  console.log('Installed Live Agents user hooks:');
  console.log(`  ${hooksJsonPath}`);
  console.log(`  ${scriptDest}`);
  console.log('');
  console.log('Next:');
  console.log('  1. Keep live-agents running: npm run dev');
  console.log('  2. Open http://localhost:3000 → Enter Office');
  console.log('  3. Restart Cursor or reload hooks if needed');
  console.log('  4. Run an agent in any workspace — workers should appear');
}

main();
