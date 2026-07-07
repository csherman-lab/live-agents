export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string; // Required for tool responses in some APIs
  tool_calls?: LLMToolCall[];
  images?: string[]; // Optional base64 images
  metadata?: {
    internal?: boolean;
    [key: string]: any;
  };
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any; // JSON Schema
  };
}

import type { LLMProviderId } from './constants';

export interface LLMConfig {
  provider?: LLMProviderId;
  apiKey?: string;
  baseUrl?: string;
  model: string;
}

export interface LLMRequestDetails {
  contents: any[];
  systemInstruction?: string;
  tools?: any[];
}

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string | null;
  tool_calls?: LLMToolCall[];
  usage?: LLMTokenUsage;
  finishReason?: string;
  raw?: any; // The original provider response
  request?: LLMRequestDetails;
}

export interface LLMStreamCallbacks {
  onTextDelta?: (text: string) => void;
}

export interface LLMProvider {
  generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName?: string
  ): Promise<LLMResponse>;

  generateCompletionStream?(
    messages: LLMMessage[],
    tools: LLMToolDefinition[] | undefined,
    systemInstruction: string | undefined,
    modelName: string | undefined,
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse>;
}
