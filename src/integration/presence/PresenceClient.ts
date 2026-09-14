import { shouldApplyHubPresenceEvent } from './presenceLiveGate';
import { parsePresenceEvent, type AgentPresenceEvent } from './presenceTypes';
import { usePresenceStore, type HubHealth } from './presenceStore';

type PresenceListener = (event: AgentPresenceEvent) => void;

type GlobalPresenceClient = typeof globalThis & {
  __liveAgentsPresenceClient?: PresenceClient;
};

/**
 * Browser client for the Vite presence hub (SSE + health poll) plus local inject.
 * start()/stop() are ref-counted so React Strict Mode remounts don't drop the link.
 */
export class PresenceClient {
  private source: EventSource | null = null;
  private listeners = new Set<PresenceListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private closed = true;
  private backoffMs = 500;
  private startCount = 0;

  /** Always resolve against the current page origin (survives HMR / navigation). */
  static resolveUrls(): { streamUrl: string; healthUrl: string; postUrl: string } {
    const base = import.meta.env.BASE_URL || '/';
    const root = base.endsWith('/') ? base.slice(0, -1) : base;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const prefix = `${origin}${root}`;
    return {
      streamUrl: `${prefix}/api/presence/stream`,
      healthUrl: `${prefix}/api/presence/health`,
      postUrl: `${prefix}/api/presence`,
    };
  }

  start() {
    this.startCount += 1;
    if (this.startCount > 1 && !this.closed) {
      void this.pollHealth();
      return;
    }
    this.closed = false;
    this.connect();
    this.startHealthPoll();
  }

  stop() {
    this.startCount = Math.max(0, this.startCount - 1);
    if (this.startCount > 0) return;

    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
    this.source?.close();
    this.source = null;
    usePresenceStore.getState().setConnected(false);
  }

  /** Force-stop regardless of ref-count (leaving mirror mode). */
  forceStop() {
    this.startCount = 0;
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.healthTimer = null;
    this.source?.close();
    this.source = null;
    usePresenceStore.getState().setConnected(false);
  }

  onEvent(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  inject(event: AgentPresenceEvent, mirrorToHub = false) {
    // Local inject must apply even during demo (and always for mock ids).
    usePresenceStore.getState().applyEvent(event);
    for (const listener of this.listeners) listener(event);
    if (mirrorToHub && typeof fetch !== 'undefined') {
      const { postUrl } = PresenceClient.resolveUrls();
      void fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(() => {});
    }
  }

  async pollHealth(): Promise<HubHealth> {
    const { healthUrl } = PresenceClient.resolveUrls();
    try {
      const res = await fetch(healthUrl, { cache: 'no-store' });
      // Stamp checkedAt after the round-trip so slow successes aren't treated as stale
      // relative to a fast failure that started later.
      const checkedAt = Date.now();
      const text = await res.text();
      if (!res.ok) {
        const health: HubHealth = {
          ok: false,
          reachable: true,
          agentCount: 0,
          sseClients: 0,
          lastEventAt: null,
          postCount: 0,
          checkedAt,
        };
        usePresenceStore.getState().setHubHealth(health);
        return health;
      }
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const health: HubHealth = {
          ok: false,
          reachable: true,
          agentCount: 0,
          sseClients: 0,
          lastEventAt: null,
          postCount: 0,
          checkedAt,
        };
        usePresenceStore.getState().setHubHealth(health);
        return health;
      }
      const health: HubHealth = {
        ok: !!data.ok,
        reachable: true,
        agentCount: Number(data.agentCount) || 0,
        sseClients: Number(data.sseClients) || 0,
        lastEventAt: typeof data.lastEventAt === 'number' ? data.lastEventAt : null,
        postCount: Number(data.postCount) || 0,
        checkedAt,
      };
      usePresenceStore.getState().setHubHealth(health);
      if (health.lastEventAt) {
        const prev = usePresenceStore.getState().lastEventAt;
        if (!prev || health.lastEventAt > prev) {
          usePresenceStore.setState({ lastEventAt: health.lastEventAt });
        }
      }
      return health;
    } catch {
      const health: HubHealth = {
        ok: false,
        reachable: false,
        agentCount: 0,
        sseClients: 0,
        lastEventAt: null,
        postCount: 0,
        checkedAt: Date.now(),
      };
      usePresenceStore.getState().setHubHealth(health);
      return health;
    }
  }

  /** Pull current hub roster (SSE only streams live + connect snapshot once). */
  async hydrateFromHub(): Promise<void> {
    if (usePresenceStore.getState().demoSwarmActive) return;
    const { postUrl } = PresenceClient.resolveUrls();
    try {
      const res = await fetch(postUrl, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { agents?: unknown[] };
      if (!Array.isArray(data.agents)) return;
      for (const raw of data.agents) {
        const event = parsePresenceEvent(raw);
        if (event) this.dispatch(event);
      }
    } catch {
      // ignore — health poll / SSE remain source of truth
    }
  }

  private startHealthPoll() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    void this.pollHealth();
    this.healthTimer = setInterval(() => {
      if (!this.closed) void this.pollHealth();
    }, 3000);
  }

  private connect() {
    if (this.closed) return;
    this.source?.close();

    const { streamUrl } = PresenceClient.resolveUrls();
    try {
      this.source = new EventSource(streamUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.source.onopen = () => {
      this.backoffMs = 500;
      usePresenceStore.getState().setConnected(true);
      void this.pollHealth();
      void this.hydrateFromHub();
    };

    this.source.onmessage = (msg) => {
      try {
        const event = parsePresenceEvent(JSON.parse(msg.data));
        if (event) this.dispatch(event);
      } catch {
        // ignore malformed SSE payloads
      }
    };

    this.source.onerror = () => {
      usePresenceStore.getState().setConnected(false);
      this.source?.close();
      this.source = null;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 8000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private dispatch(event: AgentPresenceEvent) {
    if (!shouldApplyHubPresenceEvent(usePresenceStore.getState().demoSwarmActive)) {
      return;
    }
    usePresenceStore.getState().applyEvent(event);
    for (const listener of this.listeners) listener(event);
  }
}

const g = globalThis as GlobalPresenceClient;

export function getPresenceClient(): PresenceClient {
  if (!g.__liveAgentsPresenceClient) {
    g.__liveAgentsPresenceClient = new PresenceClient();
  }
  return g.__liveAgentsPresenceClient;
}

if (typeof window !== 'undefined') {
  (window as unknown as { __laPresenceHub?: () => unknown }).__laPresenceHub = () => {
    const s = usePresenceStore.getState();
    const client = g.__liveAgentsPresenceClient as unknown as {
      startCount?: number;
      closed?: boolean;
    } | null;
    return {
      connected: s.connected,
      hubOnline: s.hubOnline,
      hubFailStreak: s.hubFailStreak,
      hubHealth: s.hubHealth,
      agentCount: Object.keys(s.agents).length,
      agentIds: Object.keys(s.agents),
      activityLen: s.activity.length,
      mirrorMode: s.mirrorMode,
      urls: PresenceClient.resolveUrls(),
      startCount: client?.startCount ?? null,
      closed: client?.closed ?? null,
    };
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Keep the global client/store across HMR so lobby health doesn't flap.
    // Full page reload still creates fresh instances.
  });
}
