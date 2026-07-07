import type {
  LLMMessage,
  LLMProvider,
  LLMResponse,
  LLMToolCall,
  LLMToolDefinition,
} from '../types';

type AnthropicMessage =
  | { role: 'user'; content: string | AnthropicContentBlock[] }
  | { role: 'assistant'; content: string | AnthropicContentBlock[] };

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export class AnthropicProvider implements LLMProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = 'https://api.anthropic.com/v1',
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName?: string,
  ): Promise<LLMResponse> {
    const model = modelName || 'claude-sonnet-4-20250514';
    const { anthropicMessages, system } = this.mapMessages(messages, systemInstruction);

    const payload: Record<string, unknown> = {
      model,
      max_tokens: 4096,
      messages: anthropicMessages,
    };

    if (system) payload.system = system;

    if (tools?.length) {
      payload.tools = tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters,
      }));
    }

    const result = await this.request<any>('/messages', payload);

    let contentStr = '';
    const toolCalls: LLMToolCall[] = [];

    for (const block of result.content || []) {
      if (block.type === 'text') contentStr += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        });
      }
    }

    const usage = result.usage
      ? {
          promptTokens: result.usage.input_tokens || 0,
          completionTokens: result.usage.output_tokens || 0,
          totalTokens: (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0),
        }
      : undefined;

    return {
      content: contentStr || null,
      tool_calls: toolCalls.length ? toolCalls : undefined,
      usage,
      finishReason: result.stop_reason,
      raw: result,
      request: {
        contents: anthropicMessages,
        systemInstruction: system,
        tools,
      },
    };
  }

  private mapMessages(messages: LLMMessage[], systemInstruction?: string) {
    const systemParts: string[] = [];
    if (systemInstruction) systemParts.push(systemInstruction);

    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemParts.push(message.content);
        continue;
      }

      if (message.role === 'user') {
        if (message.images?.length) {
          const blocks: AnthropicContentBlock[] = [{ type: 'text', text: message.content }];
          for (const image of message.images) {
            const match = image.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
            if (match) {
              blocks.push({
                type: 'image',
                source: { type: 'base64', media_type: match[1], data: match[2] },
              });
            }
          }
          anthropicMessages.push({ role: 'user', content: blocks });
        } else {
          anthropicMessages.push({ role: 'user', content: message.content });
        }
        continue;
      }

      if (message.role === 'assistant') {
        const blocks: AnthropicContentBlock[] = [];
        if (message.content) blocks.push({ type: 'text', text: message.content });
        message.tool_calls?.forEach((call) => {
          blocks.push({
            type: 'tool_use',
            id: call.id,
            name: call.function.name,
            input: JSON.parse(call.function.arguments || '{}'),
          });
        });
        anthropicMessages.push({ role: 'assistant', content: blocks.length ? blocks : message.content });
        continue;
      }

      if (message.role === 'tool') {
        anthropicMessages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: message.name || 'tool',
            content: message.content,
          }],
        });
      }
    }

    return { anthropicMessages, system: systemParts.join('\n\n') || undefined };
  }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data?.error?.message === 'string'
          ? data.error.message
          : `Anthropic request failed (${response.status})`;
      throw new Error(message);
    }

    return data as T;
  }
}
