import React, { useMemo, useState } from 'react';
import {
  ACCESSORY_LABELS,
  COLLECTIVE_COLORS,
  SPECIALIST_ACCESSORIES,
  resolveAppearance,
  useAgentAppearanceStore,
} from '../../integration/presence/agentAppearanceStore';
import { getMirrorNpcAgents } from '../../integration/presence/buildMirrorSystem';
import { usePresenceStore } from '../../integration/presence/presenceStore';
import { useActiveTeam } from '../../integration/store/teamStore';

interface AgentCustomizePanelProps {
  agentIndex: number;
  onClose: () => void;
}

const AgentCustomizePanel: React.FC<AgentCustomizePanelProps> = ({ agentIndex, onClose }) => {
  const system = useActiveTeam();
  const agent = useMemo(
    () => getMirrorNpcAgents(system).find((a) => a.index === agentIndex),
    [system, agentIndex],
  );
  const indexByAgentId = usePresenceStore((s) => s.indexByAgentId);
  const agentId = useMemo(
    () => Object.entries(indexByAgentId).find(([, idx]) => idx === agentIndex)?.[0] ?? agent?.id,
    [indexByAgentId, agentIndex, agent?.id],
  );

  const appearance = useAgentAppearanceStore((s) =>
    agentId ? resolveAppearance(s.byAgentId, agentId, agent?.name ?? '') : undefined,
  );
  const setAppearance = useAgentAppearanceStore((s) => s.setAppearance);

  const [name, setName] = useState(appearance?.name ?? agent?.name ?? '');
  const [color, setColor] = useState(appearance?.color ?? agent?.color ?? COLLECTIVE_COLORS[0]);
  const [accessory, setAccessory] = useState<number>(
    appearance?.accessory ?? agent?.accessory ?? 1,
  );

  if (!agent || !agentId) return null;

  const accessoryOptions = agentIndex === system.leadAgent.index
    ? [2, ...SPECIALIST_ACCESSORIES]
    : [...SPECIALIST_ACCESSORIES];

  const save = () => {
    setAppearance(
      agentId,
      {
        name: name.trim() || agent.name,
        color,
        accessory,
      },
      agent.name,
    );
    onClose();
  };

  return (
    <div className="pointer-events-auto absolute bottom-24 right-4 z-30 w-[280px] rounded-2xl border border-[var(--apple-border)] bg-[var(--apple-surface)]/95 backdrop-blur-xl shadow-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold text-[var(--apple-text)]">Customize agent</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-[12px] text-[var(--apple-text-secondary)] hover:text-[var(--apple-text)]"
        >
          Close
        </button>
      </div>

      <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
        Name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full mb-3 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] px-3 py-2 text-[13px] text-[var(--apple-text)]"
      />

      <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
        Color
      </label>
      <div className="flex flex-wrap gap-2 mb-3">
        {COLLECTIVE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-[var(--apple-text)]' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
          />
        ))}
      </div>

      <label className="block text-[11px] font-medium text-[var(--apple-text-secondary)] mb-1">
        Accessory
      </label>
      <select
        value={accessory}
        onChange={(e) => setAccessory(Number(e.target.value))}
        className="w-full mb-4 rounded-xl border border-[var(--apple-border)] bg-[var(--apple-bg)] px-3 py-2 text-[13px] text-[var(--apple-text)]"
      >
        {accessoryOptions.map((id) => (
          <option key={id} value={id}>
            {ACCESSORY_LABELS[id] ?? `Accessory ${id}`}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={save}
        className="w-full rounded-xl bg-appleBlue text-white text-[13px] font-semibold py-2.5 hover:opacity-90 active:scale-[0.98] transition-apple"
      >
        Save look
      </button>
    </div>
  );
};

export default AgentCustomizePanel;
