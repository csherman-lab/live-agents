import {
  Eye,
  Play,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useUiStore } from '../integration/store/uiStore';
import { formatEventAge, usePresenceStore } from '../integration/presence/presenceStore';
import { resolveMirrorHudStatus } from '../integration/presence/mirrorHudStatus';
import {
  enterMirrorMode,
  injectMockSwarm,
} from '../integration/presence/usePresenceSync';
import { getPresenceClient } from '../integration/presence/PresenceClient';
import { APPLE_BLUE, APPLE_TEXT, APPLE_TEXT_SECONDARY } from '../theme/brand';

interface OverviewPanelProps {
  onGoLive: () => void;
  onManageTeams: () => void;
  onExploreDemo: () => void;
}

const OverviewPanel: React.FC<OverviewPanelProps> = ({ onGoLive }) => {
  const [now, setNow] = useState(Date.now());
  const { setSettingsOpen } = useUiStore();
  const connected = usePresenceStore((s) => s.connected);
  const hubOnline = usePresenceStore((s) => s.hubOnline);
  const hubHealth = usePresenceStore((s) => s.hubHealth);
  const demoSwarmActive = usePresenceStore((s) => s.demoSwarmActive);
  const mirrorMode = usePresenceStore((s) => s.mirrorMode);
  const agentCount = usePresenceStore((s) => Object.keys(s.agents).length);
  const lastEventAt = usePresenceStore((s) => s.lastEventAt);
  const activity = usePresenceStore((s) => s.activity);

  useEffect(() => {
    if (!mirrorMode) return;

    const client = getPresenceClient();
    client.start();
    void client.pollHealth();
    const healthTimer = window.setInterval(() => {
      void client.pollHealth();
    }, 2500);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(t);
      window.clearInterval(healthTimer);
      client.stop();
    };
  }, [mirrorMode]);

  const hubUp = hubOnline || connected;
  const hubPending = !hubUp && !hubHealth;

  const status = resolveMirrorHudStatus({
    demoSwarmActive,
    connected,
    hubOnline,
    hubHealth: hubHealth ? { ok: hubHealth.ok } : null,
  });
  const statusLabel =
    status.phase === 'hub_ready' ? 'Hub ready — waiting for Cursor' : status.label;

  const handleEnterOffice = () => {
    if (!mirrorMode) enterMirrorMode();
    onGoLive();
  };

  const handleMockSwarm = () => {
    if (!mirrorMode) enterMirrorMode();
    injectMockSwarm();
    onGoLive();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Radio size={14} className="text-appleBlue" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-appleBlue">
              Cursor Companion
            </span>
          </div>
          <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-2" style={{ color: APPLE_TEXT }}>
            Watch your swarm
          </h1>
          <p className="text-[13px] leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
            Agents and subagents from Cursor appear as named workers in the 3D office. No API key required.
          </p>
        </div>

        <div className="px-5 pb-4 space-y-2">
          <div className="apple-card p-4 flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                status.phase === 'cursor_live'
                  ? 'bg-emerald-500'
                  : status.phase === 'demo'
                    ? 'bg-sky-500'
                    : status.phase === 'hub_ready' || status.phase === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: APPLE_TEXT }}>
                {hubUp ? <Wifi size={14} /> : <WifiOff size={14} className="text-rose-500" />}
                {statusLabel}
              </p>
              <p className="text-[11px]" style={{ color: APPLE_TEXT_SECONDARY }}>
                {agentCount > 0
                  ? `${agentCount} agent${agentCount === 1 ? '' : 's'} · last event ${formatEventAge(lastEventAt, now)}`
                  : hubUp
                    ? `Ready · last event ${formatEventAge(lastEventAt, now)}`
                    : status.detail}
              </p>
            </div>
          </div>

          {!hubUp && !hubPending && (
            <div className="rounded-xl border border-rose-200/60 bg-rose-50/80 px-3 py-2 text-[11px] text-rose-800">
              Presence hub unreachable. Keep <code className="font-mono">npm run dev</code> running on port 3000
              so Cursor hooks can POST events.
            </div>
          )}

          {hubUp && (
            <div className="apple-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: APPLE_TEXT_SECONDARY }}>
                Bridge status
              </p>
              <p className="text-[11px]" style={{ color: APPLE_TEXT }}>
                {connected ? 'SSE connected' : 'Hub reachable'}
                {hubHealth
                  ? ` · posts ${hubHealth.postCount} · agents ${hubHealth.agentCount} · SSE ${hubHealth.sseClients}`
                  : ''}
              </p>
              {activity.length > 0 && (
                <div className="space-y-1 max-h-28 overflow-y-auto mt-2">
                  {activity.slice(0, 6).map((e) => (
                    <div key={`${e.agentId}-${e.ts}`} className="flex justify-between gap-2 text-[11px]">
                      <span className="truncate" style={{ color: APPLE_TEXT }}>
                        <strong>{e.name}</strong> · {e.statusText || e.state}
                      </span>
                      <span className="shrink-0 tabular-nums" style={{ color: APPLE_TEXT_SECONDARY }}>
                        {formatEventAge(e.ts, now)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!hubUp && activity.length > 0 && (
            <div className="apple-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: APPLE_TEXT_SECONDARY }}>
                Recent activity (local)
              </p>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {activity.slice(0, 6).map((e) => (
                  <div key={`${e.agentId}-${e.ts}`} className="flex justify-between gap-2 text-[11px]">
                    <span className="truncate" style={{ color: APPLE_TEXT }}>
                      <strong>{e.name}</strong> · {e.statusText || e.state}
                    </span>
                    <span className="shrink-0 tabular-nums" style={{ color: APPLE_TEXT_SECONDARY }}>
                      {formatEventAge(e.ts, now)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-2 space-y-2">
          <button
            type="button"
            onClick={handleEnterOffice}
            className="w-full relative overflow-hidden rounded-2xl py-3.5 px-6 text-white font-semibold text-[15px] flex items-center justify-center gap-2.5 transition-apple active:scale-95"
            style={{ background: APPLE_BLUE }}
          >
            <Play size={17} fill="currentColor" />
            Enter Office
            <span className="w-2 h-2 rounded-full bg-white live-dot" />
          </button>

          <button
            type="button"
            onClick={handleMockSwarm}
            className="w-full py-3 rounded-2xl text-[13px] font-semibold flex items-center justify-center gap-2 border theme-badge hover:opacity-90 transition-apple"
            style={{ color: APPLE_TEXT }}
          >
            <Eye size={15} />
            Mock Swarm
          </button>

          <p className="text-center text-[11px] pt-1" style={{ color: APPLE_TEXT_SECONDARY }}>
            Live from any workspace:{' '}
            <code className="font-mono text-[10px]">npm run bridge:install</code>
            {' '}· keep <code className="font-mono text-[10px]">npm run dev</code> running
          </p>
        </div>

        <div className="px-5 pt-2 pb-6">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen(true);
            }}
            className="w-full text-center text-[11px] py-2 hover:underline"
            style={{ color: APPLE_TEXT_SECONDARY }}
          >
            Advanced tools (Teams / BYOK) live in Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default OverviewPanel;
