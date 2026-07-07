import type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMToolCall,
  LLMToolDefinition,
} from '../types';

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | OpenAIContentPart[] }
  | { role: 'assistant'; content?: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAIToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export class OpenAIProvider implements LLMProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = 'https://api.openai.com/v1',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName?: string,
  ): Promise<LLMResponse> {
    const model = modelName || 'gpt-4o-mini';
    const payload: Record<string, unknown> = {
      model,
      messages: this.mapMessages(messages, systemInstruction),
    };

    if (tools?.length) {
      payload.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters,
        },
      }));
      payload.tool_choice = 'auto';
    }

    const result = await this.request<any>('/chat/completions', payload);
    const choice = result.choices?.[0];
    const message = choice?.message;

    const toolCalls: LLMToolCall[] | undefined = message?.tool_calls?.map((call: OpenAIToolCall) => ({
      id: call.id,
      type: 'function',
      function: {
        name: call.function.name,
        arguments: call.function.arguments,
      },
    }));

    const usage = result.usage
      ? {
          promptTokens: result.usage.prompt_tokens || 0,
          completionTokens: result.usage.completion_tokens || 0,
          totalTokens: result.usage.total_tokens || 0,
        }
      : undefined;

    return {
      content: message?.content ?? null,
      tool_calls: toolCalls,
      usage,
      finishReason: choice?.finish_reason,
      raw: result,
      request: {
        contents: payload.messages as any[],
        systemInstruction,
        tools,
      },
    };
  }

  private mapMessages(messages: LLMMessage[], systemInstruction?: string): OpenAIMessage[] {
    const mapped: OpenAIMessage[] = [];

    if (systemInstruction) {
      mapped.push({ role: 'system', content: systemInstruction });
    }

    for (const message of messages) {
      if (message.role === 'system') {
        mapped.push({ role: 'system', content: message.content });
        continue;
      }

      if (message.role === 'user') {
        if (message.images?.length) {
          const parts: OpenAIContentPart[] = [{ type: 'text', text: message.content }];
          for (const image of message.images) {
            parts.push({ type: 'image_url', image_url: { url: image } });
          }
          mapped.push({ role: 'user', content: parts });
        } else {
          mapped.push({ role: 'user', content: message.content });
        }
        continue;
      }

      if (message.role === 'assistant') {
        mapped.push({
          role: 'assistant',
          content: message.content,
          tool_calls: message.tool_calls?.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.function.name,
              arguments: call.function.arguments,
            },
          })),
        });
        continue;
      }

      if (message.role === 'tool') {
        mapped.push({
          role: 'tool',
          tool_call_id: message.name || 'tool',
          content: message.content,
        });
      }
    }

    return mapped;
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : `OpenAI request failed (${response.status})`;
      throw new Error(message);
    }

    return data as T;
  }
}
