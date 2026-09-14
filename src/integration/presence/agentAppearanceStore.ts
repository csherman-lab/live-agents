import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AgentAppearance {
  name?: string;
  color?: string;
  accessory?: number;
}

interface AppearanceState {
  byAgentId: Record<string, AgentAppearance>;
  setAppearance: (agentId: string, patch: AgentAppearance, roleName?: string) => void;
  clearAppearance: (agentId: string) => void;
}

/** Stable key so looks survive Cursor session_id rotation. */
export function appearanceRoleKey(name: string): string {
  const n = name.trim().toLowerCase();
  return n ? `role:${n}` : 'role:agent';
}

/** Resolve look: exact agentId first, then role fallback. */
export function resolveAppearance(
  byAgentId: Record<string, AgentAppearance>,
  agentId: string,
  name: string,
): AgentAppearance {
  return byAgentId[agentId] ?? byAgentId[appearanceRoleKey(name)] ?? {};
}

export const useAgentAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      byAgentId: {},
      setAppearance: (agentId, patch, roleName) => {
        const prev = get().byAgentId;
        const next: Record<string, AgentAppearance> = {
          ...prev,
          [agentId]: { ...prev[agentId], ...patch },
        };
        if (roleName?.trim()) {
          const role = appearanceRoleKey(roleName);
          next[role] = { ...prev[role], ...patch };
        }
        // Also mirror under display name in the patch if provided.
        if (patch.name?.trim()) {
          const role = appearanceRoleKey(patch.name);
          next[role] = { ...next[role], ...patch };
        }
        set({ byAgentId: next });
      },
      clearAppearance: (agentId) => {
        const next = { ...get().byAgentId };
        delete next[agentId];
        set({ byAgentId: next });
      },
    }),
    {
      name: 'live-agents-appearance',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const SPECIALIST_ACCESSORIES = [1, 3, 4, 5, 6, 7] as const;
export const ACCESSORY_LABELS: Record<number, string> = {
  0: 'None',
  1: 'Headphones',
  2: 'Cap',
  3: 'Beanie',
  4: 'Glasses',
  5: 'Lanyard',
  6: 'Backpack',
  7: 'Scarf',
};

/** Main Cursor session agent — always the blue vinyl in the office. */
export const MIRROR_LEAD_NAME = 'Cursor';
export const MIRROR_LEAD_COLOR = '#4285F4';

export const COLLECTIVE_COLORS = [
  MIRROR_LEAD_COLOR,
  '#34A853',
  '#FBBC05',
  '#EA4335',
  '#E34B99',
  '#5E888E',
  '#8B5CF6',
  '#F97316',
] as const;

/** Lead stays blue; specialists cycle the rest of the palette. */
export function defaultMirrorColor(slot: number, isLead: boolean): string {
  if (isLead) return MIRROR_LEAD_COLOR;
  const palette = COLLECTIVE_COLORS.slice(1);
  return palette[Math.max(0, slot - 1) % palette.length];
}

/** Prefer customized name; lead defaults to "Cursor" (maps legacy "Composer" too). */
export function defaultMirrorName(
  agentName: string,
  isLead: boolean,
  appearanceName?: string,
): string {
  const custom = appearanceName?.trim();
  if (custom) return custom;
  if (isLead) {
    const raw = agentName.trim();
    if (!raw || /^composer$/i.test(raw) || /^cursor$/i.test(raw)) return MIRROR_LEAD_NAME;
    // Still the main session agent — keep the Cursor label unless they customized.
    return MIRROR_LEAD_NAME;
  }
  return agentName.trim() || 'Agent';
}
