import type { Plugin, Connect } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { parsePresenceEvent, type AgentPresenceEvent } from '../src/integration/presence/presenceTypes';

type SseClient = ServerResponse;

interface HubState {
  agents: Map<string, AgentPresenceEvent>;
  clients: Set<SseClient>;
  startedAt: number;
  lastEventAt: number | null;
  lastEvent: AgentPresenceEvent | null;
  recent: AgentPresenceEvent[];
  postCount: number;
}

const RECENT_MAX = 24;

/**
 * The presence hub is a dev-only local endpoint. Only the app's own origins may
 * read it cross-origin from a browser; Cursor hooks POST via plain Node `fetch`
 * (no CORS enforcement there) so this only tightens what a browser tab can see.
 */
const ALLOWED_ORIGINS = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);

function resolveCorsOrigin(req: IncomingMessage): string | null {
  const origin = req.headers.origin;
  return typeof origin === 'string' && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown, origin: string | null) {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.end(payload);
}

function pushRecent(hub: HubState, event: AgentPresenceEvent) {
  hub.recent.unshift(event);
  if (hub.recent.length > RECENT_MAX) hub.recent.length = RECENT_MAX;
}

function broadcast(hub: HubState, event: AgentPresenceEvent) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of hub.clients) {
    try {
      client.write(data);
    } catch {
      hub.clients.delete(client);
    }
  }
}

function applyToHub(hub: HubState, event: AgentPresenceEvent) {
  hub.lastEventAt = Date.now();
  hub.lastEvent = event;
  hub.postCount += 1;
  pushRecent(hub, event);

  if (event.op === 'remove') {
    // Clear the whole subtree so hydrate/SSE reconnect don't resurrect orphans.
    const toRemove = new Set<string>([event.agentId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of hub.agents.values()) {
        if (a.parentId && toRemove.has(a.parentId) && !toRemove.has(a.agentId)) {
          toRemove.add(a.agentId);
          grew = true;
        }
      }
    }
    for (const id of toRemove) hub.agents.delete(id);
  } else {
    const prev = hub.agents.get(event.agentId);
    if (prev && event.ts < prev.ts) return;
    hub.agents.set(event.agentId, event);
  }
  broadcast(hub, event);
}

function healthPayload(hub: HubState) {
  return {
    ok: true,
    service: 'live-agents-presence-hub',
    startedAt: hub.startedAt,
    uptimeMs: Date.now() - hub.startedAt,
    agentCount: hub.agents.size,
    sseClients: hub.clients.size,
    lastEventAt: hub.lastEventAt,
    lastEvent: hub.lastEvent,
    postCount: hub.postCount,
    recent: hub.recent.slice(0, 12),
  };
}

/**
 * Dev-server presence hub: Cursor hooks POST events; the browser listens via SSE.
 */
export function presenceHubPlugin(): Plugin {
  const hub: HubState = {
    agents: new Map(),
    clients: new Set(),
    startedAt: Date.now(),
    lastEventAt: null,
    lastEvent: null,
    recent: [],
    postCount: 0,
  };

  const middleware: Connect.NextHandleFunction = async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? '';
    const origin = resolveCorsOrigin(req);

    if (req.method === 'OPTIONS' && url.startsWith('/api/presence')) {
      res.statusCode = 204;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
      res.end();
      return;
    }

    if (url === '/api/presence/health' && req.method === 'GET') {
      sendJson(res, 200, healthPayload(hub), origin);
      return;
    }

    if (url === '/api/presence' && req.method === 'GET') {
      sendJson(
        res,
        200,
        {
          agents: [...hub.agents.values()],
          health: healthPayload(hub),
        },
        origin,
      );
      return;
    }

    if (url === '/api/presence' && req.method === 'POST') {
      try {
        const raw = JSON.parse(await readBody(req));
        const events = Array.isArray(raw) ? raw : [raw];
        const accepted: AgentPresenceEvent[] = [];
        for (const item of events) {
          const event = parsePresenceEvent(item);
          if (!event) {
            sendJson(res, 400, { error: 'invalid presence event' }, origin);
            return;
          }
          applyToHub(hub, event);
          accepted.push(event);
        }
        sendJson(res, 200, { ok: true, count: accepted.length }, origin);
      } catch {
        sendJson(res, 400, { error: 'invalid json' }, origin);
      }
      return;
    }

    if (url === '/api/presence/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
      });
      res.write('\n');
      for (const event of hub.agents.values()) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      hub.clients.add(res);
      req.on('close', () => hub.clients.delete(res));
      return;
    }

    next();
  };

  return {
    name: 'live-agents-presence-hub',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
