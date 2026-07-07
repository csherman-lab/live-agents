import { Users } from 'lucide-react';
import React from 'react';
import { AgenticSystem, getAllAgents } from '../../data/agents';

interface TeamBadgeProps {
  system: AgenticSystem;
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({ system }) => {
  const agentCount = getAllAgents(system).length;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1.5 shadow-sm"
        style={{ backgroundColor: system.color }}
      >
        <Users size={13} className="text-white/90" strokeWidth={2.5} />
        <span className="text-[11px] font-semibold text-white tabular-nums">{agentCount}</span>
      </div>
      <div className="flex flex-col items-start min-w-0">
        <span className="text-[13px] font-semibold text-[var(--apple-text)] leading-tight truncate max-w-[140px]">
          {system.teamName}
        </span>
        <span className="text-[10px] font-medium text-[var(--apple-text-secondary)] uppercase tracking-wide leading-tight">
          {system.teamType}
        </span>
      </div>
    </div>
  );
};
