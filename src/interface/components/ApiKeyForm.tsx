import { ArrowUpRight, Check, Eye, EyeOff, Loader2, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import {
  getDefaultModels,
  getProviderConfig,
  getTextModels,
  LLM_PROVIDER_IDS,
  normalizeProviderId,
  type LLMProviderId,
} from '../../core/llm/constants';
import { useUiStore } from '../../integration/store/uiStore';
import { toast } from '../../integration/store/toastStore';
import { APPLE_BLUE } from '../../theme/brand';
import { testApiKey } from '../../utils/testApiKey';

import { saveLlmConfig } from '../../integration/storage/llmConfigStorage';
import CustomSelect from './CustomSelect';

const ApiKeyForm: React.FC = () => {
  const { llmConfig, setLlmConfig, byokError, apiTestStatus, apiTestError, setApiTestStatus } = useUiStore();
  const providerId = normalizeProviderId(llmConfig.provider);
  const providerConfig = getProviderConfig(providerId);
  const textModels = getTextModels(providerId);

  const [apiKey, setApiKey] = useState(llmConfig.apiKey || '');
  const [baseUrl, setBaseUrl] = useState(llmConfig.baseUrl || '');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasKey = !!llmConfig.apiKey;
  const testing = apiTestStatus === 'testing';

  const persistConfig = (config: typeof llmConfig) => {
    setLlmConfig(config);
    saveLlmConfig(config);
  };

  const handleProviderChange = (nextProvider: LLMProviderId) => {
    const defaults = getDefaultModels(nextProvider);
    const nextConfig = {
      provider: nextProvider,
      apiKey: '',
      baseUrl: nextProvider === 'openai' ? llmConfig.baseUrl || '' : '',
      model: defaults.text,
    };
    setApiKey('');
    setBaseUrl(nextConfig.baseUrl || '');
    setApiTestStatus('idle');
    persistConfig(nextConfig);
  };

  const handleSaveKey = () => {
    const config = {
      provider: providerId,
      apiKey: apiKey.trim(),
      baseUrl: providerId === 'openai' || providerId === 'anthropic' ? baseUrl.trim() : undefined,
      model: llmConfig.model || getDefaultModels(providerId).text,
    };
    persistConfig(config);
    setSaved(true);
    toast('API settings saved', 'success');
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearKey = () => {
    const emptyConfig = {
      provider: providerId,
      apiKey: '',
      baseUrl: providerId === 'openai' || providerId === 'anthropic' ? baseUrl.trim() : undefined,
      model: llmConfig.model || getDefaultModels(providerId).text,
    };
    setApiKey('');
    persistConfig(emptyConfig);
    setApiTestStatus('idle');
  };

  const handleTest = async () => {
    const key = apiKey.trim() || llmConfig.apiKey;
    setApiTestStatus('testing');
    const result = await testApiKey({
      provider: providerId,
      apiKey: key,
      baseUrl: providerId === 'openai' || providerId === 'anthropic' ? baseUrl.trim() : undefined,
      model: llmConfig.model || getDefaultModels(providerId).text,
    });
    if (result.ok === false) {
      setApiTestStatus('error', result.error);
      return;
    }
    setApiTestStatus('ok');
    toast('API key verified', 'success');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--apple-text-secondary)]">
          AI Provider
        </label>
        <CustomSelect
          value={providerId}
          options={LLM_PROVIDER_IDS.map((id) => ({
            value: id,
            label: getProviderConfig(id).label,
          }))}
          onChange={(v) => handleProviderChange(v as LLMProviderId)}
          aria-label="AI Provider"
        />
        <p className="text-[11px] leading-relaxed text-[var(--apple-text-secondary)]">
          {providerConfig.keyHelp}
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--apple-text-secondary)]">
          Default Agent Model
        </label>
        <CustomSelect
          value={llmConfig.model || getDefaultModels(providerId).text}
          options={textModels.map((model) => ({ value: model, label: model }))}
          onChange={(model) => persistConfig({ model })}
          className="lowercase"
          aria-label="Default Agent Model"
        />
      </div>

      {hasKey && apiTestStatus !== 'error' && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-appleGreen bg-appleGreen/10 px-2.5 py-1.5 rounded-full w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-appleGreen" />
          {apiTestStatus === 'ok' ? 'Verified' : 'Connected'}
        </div>
      )}

      {apiTestStatus === 'error' && apiTestError && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600 leading-relaxed">
          {apiTestError}
        </div>
      )}

      <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--apple-text-secondary)]">
        {providerConfig.keyLabel}
      </label>
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => {
            setApiKey(e.target.value);
            if (apiTestStatus !== 'idle') setApiTestStatus('idle');
          }}
          placeholder="Paste your API key"
          className="w-full theme-input rounded-2xl px-4 py-3 pr-12 text-[13px] font-mono placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-appleBlue/30 focus:border-appleBlue/40 transition-apple"
        />
        <button
          type="button"
          onClick={() => setShowKey((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
        >
          {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {(providerId === 'openai' || providerId === 'anthropic') && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-[var(--apple-text-secondary)]">
            API Base URL (optional)
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={providerId === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://api.openai.com/v1'}
            className="w-full theme-input rounded-2xl px-4 py-3 text-[13px] font-mono placeholder:text-zinc-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-appleBlue/30"
          />
          <p className="text-[11px] text-[var(--apple-text-secondary)]">
            Leave blank for OpenAI. Use a compatible endpoint for OpenRouter or other providers.
          </p>
        </div>
      )}

      {byokError && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[12px] text-red-600 leading-relaxed">
          {byokError}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTest}
          disabled={testing || (!apiKey.trim() && !hasKey)}
          className="py-2.5 px-4 rounded-xl text-[13px] font-semibold border border-black/8 bg-white hover:bg-black/[0.03] transition-apple disabled:opacity-40 flex items-center gap-1.5"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          Test
        </button>
        <button
          type="button"
          onClick={handleSaveKey}
          disabled={!apiKey.trim()}
          className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-apple active:scale-[0.98] disabled:opacity-40"
          style={{ background: APPLE_BLUE }}
        >
          {saved ? (
            <span className="inline-flex items-center justify-center gap-1.5">
              <Check size={14} strokeWidth={2.5} />
              Saved
            </span>
          ) : (
            'Save Key'
          )}
        </button>
        <button
          type="button"
          onClick={handleClearKey}
          disabled={!hasKey && !apiKey}
          className="p-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-apple disabled:opacity-30"
          title="Clear key"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <a
        href={providerConfig.keyUrl}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-appleBlue hover:underline"
      >
        Get a {providerConfig.label} API key
        <ArrowUpRight size={12} strokeWidth={2.5} />
      </a>

      <p className="text-[11px] leading-relaxed text-[var(--apple-text-secondary)]">
        Your key is stored locally in your browser and never sent to our servers.
      </p>
    </div>
  );
};

export default ApiKeyForm;
