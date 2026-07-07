import {
  Keyboard,
  LayoutGrid,
  Monitor,
  Moon,
  ScrollText,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import React from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { useActiveTeam } from '../integration/store/teamStore';
import { APPLE_TEXT, APPLE_TEXT_SECONDARY, withHexAlpha } from '../theme/brand';
import type { ThemePreference } from '../theme/theme';
import ApiKeyForm from './components/ApiKeyForm';
import CostDashboard from './CostDashboard';

interface SettingsPanelProps {
  compact?: boolean;
  onReplayOnboarding?: () => void;
  onOpenShortcuts?: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ compact, onReplayOnboarding, onOpenShortcuts }) => {
  const { isKanbanOpen, isLogOpen, setKanbanOpen, setLogOpen } = useCoreStore();
  const { themePreference, setThemePreference } = useUiStore();
  const activeTeam = useActiveTeam();

  return (
    <div className={`flex flex-col gap-4 ${compact ? '' : 'p-1'}`}>
      <section className="apple-card p-5 transition-apple">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>AI Provider</h3>
        </div>
        <ApiKeyForm />
      </section>

      {/* Active Team */}
      <section className="apple-card p-5 transition-apple">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: withHexAlpha(activeTeam.color) }}
          >
            <Users size={18} style={{ color: activeTeam.color }} />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>Active Team</h3>
            <p className="text-[12px]" style={{ color: APPLE_TEXT_SECONDARY }}>{activeTeam.teamName}</p>
          </div>
        </div>
        <p className="text-[13px] leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
          {activeTeam.teamDescription}
        </p>
      </section>

      {/* Display Preferences */}
      <section className="apple-card p-5 transition-apple">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <LayoutGrid size={18} className="text-orange-500" />
          </div>
          <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>Display</h3>
        </div>

        <div className="space-y-2">
          <ToggleRow
            icon={<ScrollText size={15} />}
            label="Action Log"
            description="Show agent activity feed"
            checked={isLogOpen}
            onChange={setLogOpen}
          />
          <ToggleRow
            icon={<LayoutGrid size={15} />}
            label="Kanban Board"
            description="Task progress drawer"
            checked={isKanbanOpen}
            onChange={setKanbanOpen}
          />
        </div>

        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--apple-border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: APPLE_TEXT_SECONDARY }}>
            Appearance
          </p>
          <div className="flex gap-1 p-1 rounded-xl theme-segment">
            {([
              { id: 'light' as ThemePreference, label: 'Light', icon: Sun },
              { id: 'dark' as ThemePreference, label: 'Dark', icon: Moon },
              { id: 'system' as ThemePreference, label: 'Auto', icon: Monitor },
            ]).map(({ id, label, icon: Icon }) => {
              const active = themePreference === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setThemePreference(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold transition-apple ${
                    active ? 'theme-segment-btn-active' : ''
                  }`}
                  style={{ color: active ? 'var(--apple-text)' : 'var(--apple-text-secondary)' }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <CostDashboard />

      {onOpenShortcuts ? (
        <section className="apple-card p-5 transition-apple">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-appleBlue/10 flex items-center justify-center">
              <Keyboard size={18} className="text-appleBlue" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>Keyboard Shortcuts</h3>
              <p className="text-[12px]" style={{ color: APPLE_TEXT_SECONDARY }}>Press ? anytime in the workspace</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="w-full py-2.5 px-4 rounded-xl text-[13px] font-semibold text-appleBlue bg-appleBlue/10 hover:bg-appleBlue/15 transition-apple"
          >
            View shortcuts
          </button>
        </section>
      ) : null}

      {onReplayOnboarding ? (
        <section className="apple-card p-5 transition-apple">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-appleBlue/10 flex items-center justify-center">
              <Sparkles size={18} className="text-appleBlue" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: APPLE_TEXT }}>Setup guide</h3>
              <p className="text-[12px]" style={{ color: APPLE_TEXT_SECONDARY }}>
                Replay the welcome tour anytime
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReplayOnboarding}
            className="w-full py-2.5 px-4 rounded-xl text-[13px] font-semibold text-appleBlue bg-appleBlue/10 hover:bg-appleBlue/15 transition-apple"
          >
            Replay welcome tour
          </button>
        </section>
      ) : null}

      <section className="apple-card p-4 transition-apple">
        <p className="text-[12px] leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
          Agent memories persist per team across sessions. Conversations your agents have are saved locally and restored when you return.
        </p>
      </section>

      {/* Privacy note */}
      <div className="flex items-start gap-2 px-2 py-1">
        <Shield size={14} className="text-zinc-400 mt-0.5 shrink-0" />
        <p className="text-[11px] leading-relaxed" style={{ color: APPLE_TEXT_SECONDARY }}>
          Your API key never leaves your browser. AI requests go directly from your device to your chosen provider (Gemini, OpenAI, or Anthropic).
        </p>
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, label, description, checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.03] transition-apple text-left"
  >
    <span className="text-zinc-400">{icon}</span>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-medium" style={{ color: APPLE_TEXT }}>{label}</p>
      <p className="text-[11px]" style={{ color: APPLE_TEXT_SECONDARY }}>{description}</p>
    </div>
    <div
      className={`w-11 h-6 rounded-full transition-apple relative shrink-0 ${checked ? 'bg-appleBlue' : 'bg-zinc-200'}`}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-apple ${checked ? 'left-[22px]' : 'left-0.5'}`}
      />
    </div>
  </button>
);

export default SettingsPanel;
