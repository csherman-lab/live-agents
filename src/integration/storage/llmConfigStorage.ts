import { DEFAULT_MODELS, getDefaultModels, normalizeProviderId, type LLMProviderId } from '../../core/llm/constants';
import type { LLMConfig } from '../../core/llm/types';

export const LLM_CONFIG_STORAGE_KEY = 'live-agents-llm-config';
const LEGACY_STORAGE_KEY = 'byok-config';

export function loadLlmConfig(): LLMConfig {
  try {
    const saved = localStorage.getItem(LLM_CONFIG_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const provider = normalizeProviderId(parsed.provider);
      return {
        provider,
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || '',
        model: parsed.model || getDefaultModels(provider).text,
      };
    }
  } catch {
    /* ignore */
  }

  return {
    provider: 'gemini',
    apiKey: '',
    model: DEFAULT_MODELS.text,
  };
}

export function saveLlmConfig(config: LLMConfig): void {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}
