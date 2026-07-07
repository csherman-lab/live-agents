import type { OutputType } from '../../data/agents';

export type LLMProviderId = 'gemini' | 'openai';

export type ModelType = 'text' | 'image' | 'music' | 'video';

export interface ProviderConfig {
  id: LLMProviderId;
  label: string;
  keyLabel: string;
  keyUrl: string;
  keyHelp: string;
  /** Output modalities this provider can generate at project completion. */
  capabilities: OutputType[];
  defaultModels: Record<ModelType, string>;
  availableModels: Record<ModelType, readonly string[]>;
}

export const PROVIDER_CONFIGS: Record<LLMProviderId, ProviderConfig> = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    keyLabel: 'Gemini API Key',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHelp: 'Supports agent chat plus image, music, and video generation.',
    capabilities: ['text', 'image', 'music', 'video'],
    defaultModels: {
      text: 'gemini-3-flash-preview',
      image: 'gemini-3.1-flash-image-preview',
      music: 'lyria-3-clip-preview',
      video: 'veo-3.1-lite-generate-preview',
    },
    availableModels: {
      text: [
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite-preview',
      ],
      image: [
        'gemini-3.1-flash-image-preview',
        'gemini-3-pro-image-preview',
        'gemini-2.5-flash-image',
      ],
      music: ['lyria-3-clip-preview', 'lyria-3-pro-preview'],
      video: [
        'veo-3.1-lite-generate-preview',
        'veo-3.1-fast-generate-preview',
        'veo-3.1-generate-preview',
      ],
    },
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    keyLabel: 'OpenAI API Key',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHelp: 'Text-only agents. Choose a text deliverable team — no image/music/video generation.',
    capabilities: ['text'],
    defaultModels: {
      text: 'gpt-4o-mini',
      image: '',
      music: '',
      video: '',
    },
    availableModels: {
      text: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
      image: [],
      music: [],
      video: [],
    },
  },
};

export const LLM_PROVIDER_IDS = Object.keys(PROVIDER_CONFIGS) as LLMProviderId[];

/** @deprecated Use getDefaultModels(provider) for provider-aware defaults. */
export const DEFAULT_MODELS = PROVIDER_CONFIGS.gemini.defaultModels;

/** @deprecated Use getAvailableModels(provider) for provider-aware catalogs. */
export const AVAILABLE_MODELS = PROVIDER_CONFIGS.gemini.availableModels;

export function normalizeProviderId(provider?: string): LLMProviderId {
  return provider === 'openai' ? 'openai' : 'gemini';
}

export function getProviderConfig(provider?: string): ProviderConfig {
  return PROVIDER_CONFIGS[normalizeProviderId(provider)];
}

export function getDefaultModels(provider?: string): Record<ModelType, string> {
  return getProviderConfig(provider).defaultModels;
}

export function getAvailableModels(provider?: string): Record<ModelType, readonly string[]> {
  return getProviderConfig(provider).availableModels;
}

export function getTextModels(provider?: string): readonly string[] {
  return getAvailableModels(provider).text;
}

export function providerSupportsOutput(provider: string | undefined, outputType: OutputType): boolean {
  return getProviderConfig(provider).capabilities.includes(outputType);
}

export function getSupportedOutputTypes(provider?: string): OutputType[] {
  return [...getProviderConfig(provider).capabilities];
}
