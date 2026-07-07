import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { getProviderConfig, normalizeProviderId, providerSupportsOutput } from '../../core/llm/constants';
import { useActiveTeam } from '../../integration/store/teamStore';
import { useUiStore } from '../../integration/store/uiStore';

interface ProviderOutputBannerProps {
  onOpenSettings?: () => void;
  onManageTeams?: () => void;
}

const ProviderOutputBanner: React.FC<ProviderOutputBannerProps> = ({ onOpenSettings, onManageTeams }) => {
  const { llmConfig } = useUiStore();
  const activeTeam = useActiveTeam();
  const providerId = normalizeProviderId(llmConfig.provider);

  if (providerSupportsOutput(providerId, activeTeam.outputType)) {
    return null;
  }

  const providerLabel = getProviderConfig(providerId).label;

  return (
    <div className="mx-5 mb-3 apple-card p-3.5 border border-orange-200/70 bg-orange-50/80 flex gap-3">
      <AlertTriangle size={18} className="text-orange-500 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-orange-900">
          Team output mismatch
        </p>
        <p className="text-[12px] mt-1 leading-relaxed text-orange-800/90">
          <strong>{activeTeam.teamName}</strong> delivers <strong>{activeTeam.outputType.toUpperCase()}</strong>, but{' '}
          {providerLabel} only supports text. Switch the team to Text in Teams, or use Google Gemini in Settings.
        </p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          {onManageTeams && (
            <button
              type="button"
              onClick={onManageTeams}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-orange-200 text-orange-900 hover:bg-orange-50"
            >
              Open Teams
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-orange-500 text-white hover:opacity-90"
            >
              Change provider
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderOutputBanner;
