import { DollarSign, TrendingUp } from 'lucide-react';
import React from 'react';
import { getAllAgents } from '../data/agents';
import { useCoreStore } from '../integration/store/coreStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { APPLE_TEXT, APPLE_TEXT_SECONDARY } from '../theme/brand';
import { formatTokens } from './ProjectView';

const CostDashboard: React.FC = () => {
  const {
    totalTokenUsage,
    totalEstimatedCost,
    agentTokenUsage,
    agentEstimatedCost,
    costEvents,
  } = useCoreStore();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);

  const maxEventCost = Math.max(...costEvents.map((e) => e.costDelta), 0.0001);
  const recentEvents = [...costEvents].slice(-12).reverse();

  return (
    <section className="apple-card p-5 transition-apple">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
          <DollarSign size={18} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>Cost Dashboard</h3>
          <p className="text-[12px]" style={{ color: APPLE_TEXT_SECONDARY }}>Session spend & token usage</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-appleBlue/5 rounded-xl p-3 border border-appleBlue/10">
          <p className="text-[10px] font-medium uppercase tracking-wider mb-1 text-appleBlue">Total</p>
          <p className="text-[18px] font-bold tabular-nums text-[var(--apple-text)]">
            ${totalEstimatedCost.toFixed(4)}
          </p>
        </div>
        <div className="bg-black/[0.02] rounded-xl p-3 border border-black/5">
          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: APPLE_TEXT_SECONDARY }}>Tokens</p>
          <p className="text-[18px] font-bold tabular-nums" style={{ color: APPLE_TEXT }}>
            {formatTokens(totalTokenUsage.totalTokens)}
          </p>
        </div>
        <div className="bg-black/[0.02] rounded-xl p-3 border border-black/5">
          <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: APPLE_TEXT_SECONDARY }}>API Calls</p>
          <p className="text-[18px] font-bold tabular-nums" style={{ color: APPLE_TEXT }}>
            {costEvents.length}
          </p>
        </div>
      </div>

      {costEvents.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={13} className="text-zinc-400" />
            <p className="text-[11px] font-medium" style={{ color: APPLE_TEXT_SECONDARY }}>Recent API spend</p>
          </div>
          <div className="flex items-end gap-1 h-16 px-1">
            {recentEvents.map((e) => (
              <div key={e.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div
                  className="w-full rounded-t-md bg-appleBlue/70 min-h-[4px] transition-all"
                  style={{ height: `${Math.max(8, (e.costDelta / maxEventCost) * 100)}%` }}
                  title={`$${e.costDelta.toFixed(4)}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-[11px] font-medium mb-2" style={{ color: APPLE_TEXT_SECONDARY }}>Per agent</p>
        {Object.entries(agentTokenUsage)
          .filter(([, u]) => u.totalTokens > 0)
          .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
          .map(([idx, usage]) => {
            const agentIndex = parseInt(idx, 10);
            const agent = agents.find((a) => a.index === agentIndex);
            const cost = agentEstimatedCost[agentIndex] || 0;
            const pct = totalEstimatedCost > 0 ? (cost / totalEstimatedCost) * 100 : 0;
            return (
              <div key={idx} className="flex items-center gap-2 py-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: agent?.color || '#999' }} />
                <span className="text-[12px] font-medium flex-1 truncate" style={{ color: APPLE_TEXT }}>
                  {agent?.name || `Agent ${idx}`}
                </span>
                <div className="w-16 h-1.5 bg-black/[0.06] rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-appleBlue/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] tabular-nums text-[var(--apple-text-secondary)] w-14 text-right shrink-0">
                  ${cost.toFixed(4)}
                </span>
              </div>
            );
          })}
        {Object.keys(agentTokenUsage).length === 0 && (
          <p className="text-[12px] py-2" style={{ color: APPLE_TEXT_SECONDARY }}>
            No API usage yet this session.
          </p>
        )}
      </div>
    </section>
  );
};

export default CostDashboard;
