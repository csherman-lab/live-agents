import { Radio, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { usePresenceStore } from '../integration/presence/presenceStore';
import { markOnboardingDone, shouldShowOnboarding } from './OnboardingOverlay';

interface CompanionTipProps {
  onEnterOffice: () => void;
  onMockSwarm: () => void;
}

/**
 * Non-blocking first-run tip — never covers the lobby hero.
 * Replaces the full-screen onboarding dialog for mirror companion mode.
 */
const CompanionTip: React.FC<CompanionTipProps> = ({ onEnterOffice, onMockSwarm }) => {
  const [visible, setVisible] = useState(false);
  const viewMode = useCoreStore((s) => s.viewMode);
  const demoSwarmActive = usePresenceStore((s) => s.demoSwarmActive);
  const agentCount = usePresenceStore((s) => Object.keys(s.agents).length);

  useEffect(() => {
    setVisible(shouldShowOnboarding());
  }, []);

  // Auto-dismiss once the user is actually in the experience.
  useEffect(() => {
    if (!visible) return;
    if (viewMode === 'simulation' || demoSwarmActive || agentCount > 0) {
      markOnboardingDone();
      setVisible(false);
    }
  }, [visible, viewMode, demoSwarmActive, agentCount]);

  const dismiss = () => {
    markOnboardingDone();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-1/2 z-[500] w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-white/10 bg-black/75 px-4 py-3 text-white shadow-2xl backdrop-blur-md"
      role="status"
    >
      <div className="flex items-start gap-3">
        <Radio size={16} className="mt-0.5 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">Watch your Cursor swarm</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/70">
            Cursor agents appear as named vinyl workers in the office. No API key — Enter Office, or try Mock
            Swarm for an instant demo.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                dismiss();
                onEnterOffice();
              }}
              className="rounded-lg bg-appleBlue px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Enter Office
            </button>
            <button
              type="button"
              onClick={() => {
                dismiss();
                onMockSwarm();
              }}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              Mock Swarm
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-white/60 hover:text-white"
            >
              Got it
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss tip"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default CompanionTip;
