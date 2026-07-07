import type { LLMConfig } from '../core/llm/types';
import { getDefaultModels, getProviderConfig, normalizeProviderId } from '../core/llm/constants';
import { createTextProvider } from '../core/llm/providers/createProvider';

export type ApiTestResult =
  | { ok: true }
  | { ok: false; error: string };

export async function testApiKey(config: Pick<LLMConfig, 'provider' | 'apiKey' | 'baseUrl' | 'model'>): Promise<ApiTestResult> {
  const trimmed = config.apiKey?.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter an API key first' };
  }

  const providerId = normalizeProviderId(config.provider);
  const providerConfig = getProviderConfig(providerId);
  const model = config.model || getDefaultModels(providerId).text;

  try {
    const provider = createTextProvider({
      provider: providerId,
      apiKey: trimmed,
      baseUrl: config.baseUrl,
      model,
    });

    await provider.generateCompletion(
      [{ role: 'user', content: 'Reply with exactly: OK' }],
      undefined,
      undefined,
      model,
    );

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    if (/api.?key|invalid|401|403|permission|incorrect/i.test(message)) {
      return { ok: false, error: `Invalid ${providerConfig.keyLabel} or insufficient permissions` };
    }
    if (/quota|rate|429/i.test(message)) {
      return { ok: false, error: 'Rate limit or quota exceeded — key is valid but busy' };
    }
    if (/network|fetch|failed to fetch/i.test(message)) {
      return { ok: false, error: 'Network error — check your connection' };
    }
    return { ok: false, error: message };
  }
}

/** @deprecated Use testApiKey({ provider, apiKey, model }). */
export async function testGeminiApiKey(apiKey: string): Promise<ApiTestResult> {
  return testApiKey({ provider: 'gemini', apiKey, model: getDefaultModels('gemini').text });
}
