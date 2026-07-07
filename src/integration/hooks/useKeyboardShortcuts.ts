import { useEffect, useCallback } from 'react';
import { getAllAgents } from '../../data/agents';
import { useCoreStore } from '../store/coreStore';
import { useActiveTeam } from '../store/teamStore';
import { useUiStore } from '../store/uiStore';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

export function useKeyboardShortcuts(opts: {
  onGoLive: () => void;
  onOpenSettings: () => void;
}) {
  const { setViewMode, viewMode } = useCoreStore();
  const { setSelectedNpc, setSettingsOpen, setShortcutsOpen } = useUiStore();
  const activeTeam = useActiveTeam();
  const agents = getAllAgents(activeTeam);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (key === 'g') {
        e.preventDefault();
        opts.onGoLive();
        return;
      }

      if (key === 's') {
        e.preventDefault();
        opts.onOpenSettings();
        return;
      }

      if (key === 'o') {
        e.preventDefault();
        setViewMode('overview');
        return;
      }

      if (key === 't') {
        e.preventDefault();
        setViewMode('design');
        return;
      }

      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      const num = parseInt(key, 10);
      if (num >= 1 && num <= 9) {
        const agent = agents[num - 1];
        if (agent) {
          e.preventDefault();
          if (viewMode === 'overview') setViewMode('simulation');
          setSelectedNpc(agent.index);
        }
      }
    },
    [agents, opts, setSelectedNpc, setShortcutsOpen, setViewMode, viewMode],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);
}
