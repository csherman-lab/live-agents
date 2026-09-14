/**
 * Map Cursor hook stdin payloads → AgentPresenceEvent.
 * Shared by the project hook and unit tests.
 */

const FRIENDLY_NAMES = {
  generalPurpose: 'General',
  explore: 'Explore',
  shell: 'Shell',
  browser: 'Browser',
  bestOfN: 'Best-of-N',
  'best-of-n-runner': 'Best-of-N',
  'ci-investigator': 'CI Investigator',
  bugbot: 'Bugbot',
  'security-review': 'Security',
  'cursor-guide': 'Docs',
};

export function truncate(text, max = 72) {
  if (!text || typeof text !== 'string') return undefined;
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function friendlyAgentName(raw) {
  if (!raw || typeof raw !== 'string') return 'Agent';
  const key = raw.trim();
  if (FRIENDLY_NAMES[key]) return FRIENDLY_NAMES[key];
  // Title-case kebab / camel leftovers
  const spaced = key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!spaced) return 'Agent';
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

function toolStatus(payload, tool) {
  const input = payload?.tool_input || payload?.input || payload?.arguments || {};
  const path =
    input?.path ||
    input?.file_path ||
    input?.target_directory ||
    input?.uri ||
    input?.command;
  const shortPath =
    typeof path === 'string'
      ? path.split('/').filter(Boolean).slice(-2).join('/')
      : undefined;

  if (!tool) return shortPath ? truncate(shortPath) || 'Working…' : 'Working…';

  const t = String(tool);
  if (/^read$/i.test(t) || /readfile/i.test(t)) {
    return truncate(shortPath ? `Reading ${shortPath}` : 'Reading…') || 'Reading…';
  }
  if (/write|streplace|editnotebook/i.test(t)) {
    return truncate(shortPath ? `Editing ${shortPath}` : 'Editing…') || 'Editing…';
  }
  if (/shell|bash/i.test(t)) {
    const cmd = typeof input?.command === 'string' ? input.command : undefined;
    return truncate(cmd ? `Shell: ${cmd}` : 'Running shell…') || 'Running shell…';
  }
  if (/grep|glob/i.test(t)) {
    return truncate(shortPath ? `Searching ${shortPath}` : 'Searching…') || 'Searching…';
  }
  if (/task/i.test(t)) {
    return 'Launching subagent…';
  }
  return truncate(`Using ${t}${shortPath ? ` · ${shortPath}` : ''}`) || `Using ${t}`;
}

/**
 * @param {Record<string, unknown>} payload
 * @param {{ now?: number }} [opts]
 */
export function mapHookToPresence(payload, opts = {}) {
  const hookEvent = payload?.hook_event_name || payload?.event || payload?.type || '';
  const now = opts.now ?? Date.now();
  const sessionId = String(
    payload?.session_id || payload?.conversation_id || payload?.composerId || 'cursor-session',
  );
  const subId = payload?.subagent_id || payload?.agent_id || payload?.task_id;
  const subType = payload?.subagent_type || payload?.agent_type || payload?.description;
  const tool = payload?.tool_name || payload?.toolName || payload?.tool;
  const displayName = friendlyAgentName(subType || (subId ? 'Subagent' : 'Cursor'));

  const base = {
    type: 'agent.presence',
    v: 1,
    ts: now,
    provider: 'cursor',
    op: 'upsert',
  };

  switch (hookEvent) {
    case 'sessionStart':
      return {
        ...base,
        agentId: sessionId,
        name: 'Cursor',
        state: 'thinking',
        statusText: 'Session started',
      };
    case 'sessionEnd':
      return {
        ...base,
        agentId: sessionId,
        name: 'Cursor',
        state: 'done',
        statusText: 'Session ended',
        op: 'remove',
      };
    case 'subagentStart':
      return {
        ...base,
        agentId: String(subId || `${sessionId}-${subType || 'sub'}-${now}`),
        name: displayName,
        state: 'thinking',
        statusText: 'Starting…',
        parentId: sessionId,
      };
    case 'subagentStop':
      return {
        ...base,
        agentId: String(subId || `${sessionId}-sub`),
        name: displayName,
        state: 'done',
        statusText: 'Finished',
        parentId: sessionId,
        op: 'remove',
      };
    case 'afterAgentThought':
      return {
        ...base,
        agentId: String(subId || sessionId),
        name: subId ? displayName : 'Cursor',
        state: 'thinking',
        statusText:
          truncate(payload?.text || payload?.thought || payload?.content) || 'Thinking…',
        parentId: subId ? sessionId : null,
      };
    case 'preToolUse':
    case 'postToolUse':
      return {
        ...base,
        agentId: String(subId || sessionId),
        name: subId ? displayName : 'Cursor',
        state: 'working',
        statusText: toolStatus(payload, tool),
        parentId: subId ? sessionId : null,
      };
    case 'stop':
      // Lead/session stop clears the whole tree; subagent stop removes that worker only.
      if (subId) {
        return {
          ...base,
          agentId: String(subId),
          name: displayName,
          state: 'done',
          statusText: 'Done',
          parentId: sessionId,
          op: 'remove',
        };
      }
      return {
        ...base,
        agentId: sessionId,
        name: 'Cursor',
        state: 'done',
        statusText: 'Done',
        op: 'remove',
      };
    default:
      return {
        ...base,
        agentId: String(subId || sessionId),
        name: subId ? displayName : friendlyAgentName(String(hookEvent || 'Agent')),
        state: 'idle',
        statusText: truncate(String(hookEvent)) || 'Standing by',
        parentId: subId ? sessionId : null,
      };
  }
}
