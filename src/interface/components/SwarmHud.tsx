import React, { useEffect, useState } from 'react';
import { Activity, Radio, Users, Wifi, WifiOff, X } from 'lucide-react';
import { exitDemoSwarm, injectMockSwarm } from '../../integration/presence/usePresenceSync';
import { mirrorHudRows } from '../../integration/presence/mirrorLocomotion';
import { resolveMirrorHudStatus } from '../../integration/presence/mirrorHudStatus';
import {
  formatEventAge,
  listPresenceAgents,
  usePresenceStore,
} from '../../integration/presence/presenceStore';

const SwarmHud: React.FC = () => {
  const connected = usePresenceStore((s) => s.connected);
  const hubOnline = usePresenceStore((s) => s.hubOnline);
  const hubHealth = usePresenceStore((s) => s.hubHealth);
  const mirrorMode = usePresenceStore((s) => s.mirrorMode);
  const demoSwarmActive = usePresenceStore((s) => s.demoSwarmActive);
  const agents = usePresenceStore((s) => s.agents);
  const agentCount = Object.keys(agents).length;
  const lastEventAt = usePresenceStore((s) => s.lastEventAt);
  const workingCount = usePresenceStore(
    (s) => Object.values(s.agents).filter((a) => a.state === 'working' || a.state === 'thinking').length,
  );
  const hudRows = mirrorHudRows(listPresenceAgents());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // All hooks above this line — the early return below must never change hook count/order.
  if (!mirrorMode) return null;

  const hubUp = hubOnline || connected;

  const status = resolveMirrorHudStatus({
    demoSwarmActive,
    connected,
    hubOnline,
    hubHealth: hubHealth ? { ok: hubHealth.ok } : null,
  });

  const dotClass =
    status.phase === 'demo'
      ? 'bg-sky-400'
      : status.phase === 'cursor_live'
        ? 'bg-emerald-400'
        : status.phase === 'hub_ready' || status.phase === 'connecting'
          ? 'bg-amber-400 animate-pulse'
          : 'bg-rose-400';

  return (
    <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 max-w-[min(92vw,420px)]">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <div
          className="flex items-center gap-2 rounded-full border border-white/10 bg-black/55 backdrop-blur-md px-3 py-1.5 shadow-lg"
          title={status.detail}
        >
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          {hubUp ? (
            <Wifi size={12} className="text-white/70" />
          ) : (
            <WifiOff size={12} className="text-rose-300" />
          )}
          <span className="text-[11px] font-semibold text-white/90 tracking-wide">{status.label}</span>
          <span className="text-white/20">|</span>
          <Users size={12} className="text-white/70" />
          <span className="text-[11px] font-semibold tabular-nums text-white/90">
            {agentCount}
          </span>
          <span className="text-white/20">|</span>
          <span className="text-[10px] text-white/60 tabular-nums">
            {formatEventAge(lastEventAt, now)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => injectMockSwarm()}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-appleBlue/90 hover:bg-appleBlue px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg transition-apple active:scale-95"
        >
          <Activity size={12} />
          Mock Swarm
        </button>
        {demoSwarmActive && (
          <button
            type="button"
            onClick={() => exitDemoSwarm()}
            title="Clear the demo swarm and resume live Cursor presence"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 hover:bg-black/70 px-3 py-1.5 text-[11px] font-semibold text-white/90 shadow-lg transition-apple active:scale-95"
          >
            <X size={12} />
            Exit Demo
          </button>
        )}
      </div>

      {agentCount === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-md px-4 py-3 text-center shadow-lg">
          <p className="text-[13px] font-semibold text-white/95 flex items-center justify-center gap-1.5">
            <Radio size={14} /> Waiting for Cursor…
          </p>
          <p className="text-[11px] text-white/65 mt-1 leading-relaxed">{status.emptyHint}</p>
        </div>
      )}

      {agentCount > 0 && workingCount > 0 && (
        <div
          className="h-1 w-full max-w-[220px] rounded-full overflow-hidden bg-white/10"
          title={`${workingCount} agent${workingCount === 1 ? '' : 's'} active`}
        >
          <div
            className="h-full rounded-full bg-emerald-400/90 transition-all duration-500"
            style={{ width: `${Math.min(100, (workingCount / Math.max(agentCount, 1)) * 100)}%` }}
          />
        </div>
      )}

      {hudRows.length > 0 && (
        <div
          className={`w-full rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md px-3 py-2 shadow-lg overflow-y-auto ${
            workingCount >= 3 ? 'max-h-36' : 'max-h-28'
          }`}
        >
          {hudRows.map((e) => (
            <div
              key={e.agentId}
              className="flex items-baseline justify-between gap-2 py-0.5 text-[10px]"
            >
              <span className="text-white/90 font-semibold truncate">
                {e.name}
                <span className="text-white/45 font-normal"> · {e.detail}</span>
              </span>
              <span className="text-white/40 shrink-0 tabular-nums">{formatEventAge(e.lastTs, now)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SwarmHud;
