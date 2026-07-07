import { FunctionDeclaration, GoogleGenAI, Tool, Type } from '@google/genai';
import { LLMMessage, LLMProvider, LLMResponse, LLMStreamCallbacks, LLMToolCall, LLMToolDefinition } from '../types';
import { DEFAULT_MODELS } from '../constants';
import { calculateTokensForCost } from '../pricing';
import { withRateLimitRetry } from '../../../utils/retry';


export class GeminiProvider implements LLMProvider {
  private client: GoogleGenAI;

  constructor(private apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = DEFAULT_MODELS.text
  ): Promise<LLMResponse> {
    const { contents, systemTools, request } = this.buildRequest(messages, tools, systemInstruction);

    const result = await withRateLimitRetry(() =>
      this.client.models.generateContent({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          tools: systemTools,
        }
      })
    );

    return this.parseGenerateContentResponse(result, { contents, systemInstruction, tools: systemTools });
  }

  async generateCompletionStream(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = DEFAULT_MODELS.text,
    callbacks?: LLMStreamCallbacks
  ): Promise<LLMResponse> {
    const { contents, systemTools, request } = this.buildRequest(messages, tools, systemInstruction);

    return withRateLimitRetry(async () => {
      const stream = await this.client.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction: systemInstruction,
          tools: systemTools,
        }
      });

      let contentStr = '';
      const toolCallMap = new Map<string, LLMToolCall>();
      let lastChunk: any = null;
      let finishReason: string | undefined;
      let usage: LLMResponse['usage'];

      for await (const chunk of stream) {
        lastChunk = chunk;
        const delta = chunk.text;
        if (delta) {
          contentStr += delta;
          callbacks?.onTextDelta?.(contentStr);
        }

        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason as string;
        if (chunk.usageMetadata) {
          usage = {
            promptTokens: chunk.usageMetadata.promptTokenCount || 0,
            completionTokens: (chunk.usageMetadata.candidatesTokenCount || 0) + (chunk.usageMetadata.thoughtsTokenCount || 0),
            totalTokens: chunk.usageMetadata.totalTokenCount || 0
          };
        }

        this.collectToolCallsFromParts(candidate?.content?.parts, toolCallMap);
        if (chunk.functionCalls) {
          for (const call of chunk.functionCalls) {
            const key = call.name || Math.random().toString(36).substring(7);
            toolCallMap.set(key, {
              id: Math.random().toString(36).substring(7),
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.args)
              }
            });
          }
        }
      }

      const toolCalls = toolCallMap.size > 0 ? Array.from(toolCallMap.values()) : undefined;

      return {
        content: contentStr || null,
        tool_calls: toolCalls,
        usage,
        finishReason,
        raw: lastChunk,
        request
      };
    });
  }

  private buildRequest(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string
  ) {
    const contents = this.mapMessagesToGemini(messages);
    const systemTools: Tool[] | undefined = tools ? [{
      functionDeclarations: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: this.mapToGeminiSchema(t.function.parameters)
      } as FunctionDeclaration))
    }] : undefined;

    return {
      contents,
      systemTools,
      request: {
        contents,
        systemInstruction,
        tools: systemTools
      }
    };
  }

  private parseGenerateContentResponse(result: any, request: LLMResponse['request']): LLMResponse {
    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let contentStr: string | null = null;
    const toolCallMap = new Map<string, LLMToolCall>();

    for (const part of parts) {
      if (part.text) {
        contentStr = (contentStr || '') + part.text;
      }
    }

    this.collectToolCallsFromParts(parts, toolCallMap);

    if (result.functionCalls && toolCallMap.size === 0) {
      for (const call of result.functionCalls) {
        const key = call.name || Math.random().toString(36).substring(7);
        toolCallMap.set(key, {
          id: Math.random().toString(36).substring(7),
          type: 'function',
          function: {
            name: call.name,
            arguments: JSON.stringify(call.args)
          }
        });
      }
    }

    const toolCalls = toolCallMap.size > 0 ? Array.from(toolCallMap.values()) : undefined;

    const usage = result.usageMetadata ? {
      promptTokens: result.usageMetadata.promptTokenCount || 0,
      completionTokens: (result.usageMetadata.candidatesTokenCount || 0) + (result.usageMetadata.thoughtsTokenCount || 0),
      totalTokens: result.usageMetadata.totalTokenCount || 0
    } : undefined;

    return {
      content: contentStr,
      tool_calls: toolCalls,
      usage,
      finishReason: candidate?.finishReason as string,
      raw: result,
      request
    };
  }

  private collectToolCallsFromParts(parts: any[] | undefined, toolCallMap: Map<string, LLMToolCall>) {
    if (!parts) return;
    for (const part of parts) {
      if (part.functionCall) {
        const key = part.functionCall.name || Math.random().toString(36).substring(7);
        toolCallMap.set(key, {
          id: Math.random().toString(36).substring(7),
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args)
          }
        });
      }
    }
  }

  async generateImage(
    prompt: string,
    modelName: string = DEFAULT_MODELS.image,
    onProgress?: (msg: string) => void,
    options: { aspectRatio?: string; imageSize?: string } = {},
    images?: string[]
  ): Promise<{ data: string; usage?: any }> {
    if (onProgress) onProgress("Generating image...");

    const config = {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: options.aspectRatio || '16:9',
        imageSize: options.imageSize || '1K', // Default 1K, options: '512', '1K', '2K', '4K'
      }
    };

    const contents: any[] = [{ text: prompt }];

    if (images && images.length > 0) {
      for (const img of images) {
        const base64Match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (base64Match) {
          contents.push({
            inlineData: {
              mimeType: base64Match[1],
              data: base64Match[2]
            }
          });
        }
      }
    }

    const result = await this.client.models.generateContent({
      model: modelName,
      contents,
      config: config as any
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let base64Data: string | undefined;

    for (const part of parts) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
      }
    }

    const imageTokens = calculateTokensForCost(modelName, 1);

    return {
      data: base64Data || '',
      usage: {
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        completionTokens: (result.usageMetadata?.candidatesTokenCount || 0) + imageTokens,
        totalTokens: (result.usageMetadata?.totalTokenCount || 0) + imageTokens,
        count: 1
      }
    };
  }

  async generateAudio(
    prompt: string,
    modelName: string = DEFAULT_MODELS.music,
    onProgress?: (msg: string) => void
  ): Promise<{ data: string; usage?: any }> {
    if (onProgress) onProgress("Generating audio...");
    const result = await this.client.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseModalities: ["AUDIO", "TEXT"],
      }
    });

    const candidate = result.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    let base64Data: string | undefined;

    for (const part of parts) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
      }
    }

    const audioTokens = calculateTokensForCost(modelName, 1);

    return {
      data: base64Data || '',
      usage: {
        promptTokens: result.usageMetadata?.promptTokenCount || 0,
        completionTokens: (result.usageMetadata?.candidatesTokenCount || 0) + audioTokens,
        totalTokens: (result.usageMetadata?.totalTokenCount || 0) + audioTokens,
        count: 1
      }
    };
  }

  async generateVideo(
    prompt: string,
    modelName: string = DEFAULT_MODELS.video,
    onProgress?: (msg: string) => void,
    options: {
      resolution?: '720p' | '1080p' | '4k';
      aspectRatio?: '16:9' | '9:16';
      durationSeconds?: 4 | 6 | 8;
    } = {},
    images?: string[]
  ): Promise<{ videoUrl: string; usage?: any }> {
    if (modelName.includes('lite')) {
      return this.createVideoLite(prompt, modelName, onProgress, options, images);
    } else {
      return this.createVideo(prompt, modelName, onProgress, options, images);
    }
  }

  private async createVideo(
    prompt: string,
    modelName: string,
    onProgress?: (msg: string) => void,
    options: any = {},
    images?: string[]
  ): Promise<{ videoUrl: string; usage?: any }> {
    const videoConfig: any = {
      resolution: options.resolution || '720p',
      aspectRatio: options.aspectRatio || '16:9',
      durationSeconds: options.durationSeconds || 4,
      sampleCount: 1,
    };

    const generateVideoPayload: any = {
      model: modelName,
      config: videoConfig
    };

    if (prompt) {
      generateVideoPayload.prompt = prompt;
    }

    if (images && images.length > 0) {
      const referenceImagesPayload: any[] = [];
      for (const img of images) {
        const m = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
        if (m) {
          referenceImagesPayload.push({
            image: {
              imageBytes: m[2],
              mimeType: m[1]
            },
            referenceType: 'asset' // Using lowercase string as currently mapped in other parts
          });
        }
      }
      
      if (referenceImagesPayload.length > 0) {
        generateVideoPayload.config.referenceImages = referenceImagesPayload;
        // MUST be 8 when using reference images
        videoConfig.durationSeconds = 8;
      }
    }

    // Also must be 8 for 1080p or 4k
    if (videoConfig.resolution === '1080p' || videoConfig.resolution === '4k') {
      videoConfig.durationSeconds = 8;
    }

    let operation = await (this.client.models as any).generateVideos(generateVideoPayload);

    return this.pollVideoOperation(operation, modelName, onProgress);
  }

  private async createVideoLite(
    prompt: string,
    modelName: string,
    onProgress?: (msg: string) => void,
    options: any = {},
    images?: string[]
  ): Promise<{ videoUrl: string; usage?: any }> {
    const videoConfig: any = {
      resolution: options.resolution || '720p',
      aspectRatio: options.aspectRatio || '16:9',
      durationSeconds: options.durationSeconds || 4,
      sampleCount: 1,
    };

    const request: any = {
      model: modelName,
      prompt: prompt,
      config: videoConfig
    };

    if (images && images.length > 0) {
      // Lite models support 1 primary image for animation (Image object)
      const m = images[0].match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (m) {
        request.image = {
          imageBytes: m[2],
          mimeType: m[1]
        };
      }
    }

    // Use the official SDK Client
    let operation = await (this.client.models as any).generateVideos(request);

    return this.pollVideoOperation(operation, modelName, onProgress);
  }

  private async pollVideoOperation(
    operation: any,
    modelName: string,
    onProgress?: (msg: string) => void
  ): Promise<{ videoUrl: string; usage?: any }> {
    while (!operation.done) {
      if (onProgress) onProgress("Generating video (this may take a minute)...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await (this.client as any).operations.getVideosOperation({
        operation: operation,
      });
    }

    const videoData = operation.response?.generatedVideos?.[0];
    let videoUri = (videoData?.video as any)?.uri || '';

    if (videoUri && videoUri.includes('generativelanguage.googleapis.com')) {
      const separator = videoUri.includes('?') ? '&' : '?';
      videoUri += `${separator}key=${this.apiKey}`;
    }

    const videoDuration = videoData?.durationSeconds || 4;
    const videoTokens = calculateTokensForCost(modelName, videoDuration);

    return {
      videoUrl: videoUri,
      usage: {
        promptTokens: 0,
        completionTokens: videoTokens,
        totalTokens: videoTokens,
        duration: videoDuration
      }
    };
  }

  private mapMessagesToGemini(messages: LLMMessage[]): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];

        if (m.content) {
          parts.push({ text: m.content });
        }

        if (m.tool_calls) {
          for (const tc of m.tool_calls) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              }
            });
          }
        }

        if (m.role === 'tool' && m.name) {
          parts.push({
            functionResponse: {
              name: m.name,
              response: JSON.parse(m.content)
            }
          });
        }

        if (m.images) {
          for (const img of m.images) {
            // Strip data URL prefix if present: "data:image/png;base64,..."
            const base64Match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
            if (base64Match) {
              parts.push({
                inlineData: {
                  mimeType: base64Match[1],
                  data: base64Match[2]
                }
              });
            } else {
              // Assume it's already a raw base64 string and default to jpeg
              parts.push({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: img
                }
              });
            }
          }
        }

        return { role, parts };
      });
  }

  private mapToGeminiSchema(schema: any): any {
    if (!schema) return undefined;

    const typeStr = (schema.type || 'string').toUpperCase();
    const mappedType = Type[typeStr as keyof typeof Type] || Type.STRING;

    const result: any = {
      type: mappedType,
      description: schema.description,
      nullable: schema.nullable,
      minItems: schema.minItems,
      maxItems: schema.maxItems,
      minimum: schema.minimum,
      maximum: schema.maximum,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
    };

    if (schema.properties) {
      result.properties = Object.keys(schema.properties).reduce((acc, key) => {
        acc[key] = this.mapToGeminiSchema(schema.properties[key]);
        return acc;
      }, {} as Record<string, any>);
    }

    if (schema.required) {
      result.required = schema.required;
    }

    if (schema.items) {
      result.items = this.mapToGeminiSchema(schema.items);
    }

    if (schema.enum) {
      result.enum = schema.enum;
    }

    return result;
  }
}
