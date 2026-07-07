import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ProjectPhase, Task } from './coreStore';
import { useCoreStore } from './coreStore';
import { useTeamStore } from './teamStore';
import { useUiStore } from './uiStore';

export interface SavedProject {
  id: string;
  name: string;
  brief: string;
  teamId: string;
  phase: ProjectPhase;
  taskCount: number;
  createdAt: number;
  updatedAt: number;
}

interface ProjectStoreState {
  savedProjects: SavedProject[];
  saveCurrentProject: (name?: string) => SavedProject;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
}

function briefTitle(brief: string): string {
  const line = brief.trim().split('\n')[0] || 'Untitled project';
  return line.length > 48 ? `${line.slice(0, 47)}…` : line;
}

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => ({
      savedProjects: [],

      saveCurrentProject: (name) => {
        const core = useCoreStore.getState();
        const teamId = useTeamStore.getState().selectedAgentSetId;
        const now = Date.now();
        const title = name?.trim() || briefTitle(core.userBrief) || 'Untitled project';

        const existing = get().savedProjects.find(
          (p) => p.brief === core.userBrief && p.teamId === teamId && p.phase === core.phase,
        );

        if (existing) {
          const updated: SavedProject = {
            ...existing,
            name: title,
            phase: core.phase,
            taskCount: core.tasks.length,
            updatedAt: now,
          };
          set((s) => ({
            savedProjects: s.savedProjects.map((p) => (p.id === existing.id ? updated : p)),
          }));
          return updated;
        }

        const entry: SavedProject = {
          id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
          name: title,
          brief: core.userBrief,
          teamId,
          phase: core.phase,
          taskCount: core.tasks.length,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({
          savedProjects: [entry, ...s.savedProjects].slice(0, 20),
        }));
        return entry;
      },

      loadProject: (id) => {
        const project = get().savedProjects.find((p) => p.id === id);
        if (!project) return;

        const currentTeamId = useTeamStore.getState().selectedAgentSetId;
        if (project.teamId !== currentTeamId) {
          useUiStore.getState().setSkipProjectResetOnTeamChange(true);
          useTeamStore.getState().setActiveTeam(project.teamId);
          useUiStore.getState().setSkipProjectResetOnTeamChange(false);
        }
        useCoreStore.getState().resetProject();
        useCoreStore.getState().setUserBrief(project.brief);
      },

      deleteProject: (id) =>
        set((s) => ({
          savedProjects: s.savedProjects.filter((p) => p.id !== id),
        })),

      renameProject: (id, name) =>
        set((s) => ({
          savedProjects: s.savedProjects.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name, updatedAt: Date.now() } : p,
          ),
        })),
    }),
    {
      name: 'live-agents-projects',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export function countPendingApprovals(tasks: Task[]): number {
  return tasks.filter((t) => t.status === 'on_hold').length;
}
