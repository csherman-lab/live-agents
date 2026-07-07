import type { LLMConfig } from '../types';
import { getProviderConfig, normalizeProviderId } from '../constants';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenAIProvider } from './OpenAIProvider';

export function createTextProvider(config: LLMConfig) {
  const providerId = normalizeProviderId(config.provider);
  const apiKey = config.apiKey?.trim();
  if (!apiKey) {
    throw new Error(`${getProviderConfig(providerId).keyLabel} is required`);
  }

  if (providerId === 'openai') {
    return new OpenAIProvider(apiKey, config.baseUrl);
  }

  if (providerId === 'anthropic') {
    return new AnthropicProvider(apiKey, config.baseUrl);
  }

  return new GeminiProvider(apiKey);
}

/** Returns Gemini when the active provider supports multimodal final output. */
export function createMediaProvider(config: LLMConfig): GeminiProvider | null {
  const providerId = normalizeProviderId(config.provider);
  const apiKey = config.apiKey?.trim();
  if (!apiKey) return null;

  const capabilities = getProviderConfig(providerId).capabilities;
  if (!capabilities.some((type) => type !== 'text')) {
    return null;
  }

  return new GeminiProvider(apiKey);
}
