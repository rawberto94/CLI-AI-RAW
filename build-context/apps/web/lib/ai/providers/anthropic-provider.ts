/**
 * Anthropic AI Provider
 * Integration with Claude models for contract analysis and AI tasks
 */

import Anthropic from '@anthropic-ai/sdk';
import pino from 'pino';

const logger = pino({ name: 'anthropic-provider' });

// Model configurations
export const ANTHROPIC_MODELS = {
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet-20241022',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    capabilities: ['extraction', 'analysis', 'summarization', 'chat', 'generation'],
  },
  'claude-3-5-haiku': {
    id: 'claude-3-5-haiku-20241022',
    maxTokens: 8192,
    contextWindow: 200000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
    capabilities: ['extraction', 'classification', 'chat', 'fast-responses'],
  },
  'claude-3-opus': {
    id: 'claude-3-opus-20240229',
    maxTokens: 4096,
    contextWindow: 200000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    capabilities: ['complex-reasoning', 'analysis', 'generation', 'research'],
  },
} as const;

export type AnthropicModelName = keyof typeof ANTHROPIC_MODELS;

export interface AnthropicConfig {
  apiKey?: string;
  defaultModel?: AnthropicModelName;
  maxRetries?: number;
  timeout?: number;
}

export interface CompletionOptions {
  model?: AnthropicModelName;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stopSequences?: string[];
}

export interface CompletionResult {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
  cost: number;
}

export interface StreamingOptions extends CompletionOptions {
  onToken?: (token: string) => void;
  onComplete?: (result: CompletionResult) => void;
}

/**
 * Anthropic AI Provider
 */
export class AnthropicProvider {
  private client: Anthropic | null = null;
  private config: Required<AnthropicConfig>;

  constructor(config?: AnthropicConfig) {
    this.config = {
      apiKey: config?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '',
      defaultModel: config?.defaultModel ?? 'claude-3-5-sonnet',
      maxRetries: config?.maxRetries ?? 3,
      timeout: config?.timeout ?? 120000,
    };

    if (this.config.apiKey) {
      this.client = new Anthropic({
        apiKey: this.config.apiKey,
        maxRetries: this.config.maxRetries,
        timeout: this.config.timeout,
      });
    }
  }

  /**
   * Check if Anthropic is configured and available
   */
  isAvailable(): boolean {
    return this.client !== null && this.config.apiKey.length > 0;
  }

  /**
   * Get model configuration
   */
  getModelConfig(model?: AnthropicModelName) {
    const modelName = model ?? this.config.defaultModel;
    return ANTHROPIC_MODELS[modelName];
  }

  /**
   * Create a completion
   */
  async complete(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized. Please set ANTHROPIC_API_KEY.');
    }

    const modelName = options?.model ?? this.config.defaultModel;
    const modelConfig = ANTHROPIC_MODELS[modelName];

    try {
      const response = await this.client.messages.create({
        model: modelConfig.id,
        max_tokens: options?.maxTokens ?? modelConfig.maxTokens,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        stop_sequences: options?.stopSequences,
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost = (inputTokens / 1000) * modelConfig.costPer1kInput +
                   (outputTokens / 1000) * modelConfig.costPer1kOutput;

      logger.debug({
        model: modelName,
        inputTokens,
        outputTokens,
        cost: cost.toFixed(4),
      }, 'Anthropic completion');

      return {
        content,
        model: modelConfig.id,
        inputTokens,
        outputTokens,
        stopReason: response.stop_reason ?? 'unknown',
        cost,
      };

    } catch (error) {
      logger.error({ error, model: modelName }, 'Anthropic completion failed');
      throw error;
    }
  }

  /**
   * Create a streaming completion
   */
  async *stream(
    prompt: string,
    options?: StreamingOptions
  ): AsyncGenerator<string, CompletionResult, unknown> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized. Please set ANTHROPIC_API_KEY.');
    }

    const modelName = options?.model ?? this.config.defaultModel;
    const modelConfig = ANTHROPIC_MODELS[modelName];

    try {
      const stream = await this.client.messages.stream({
        model: modelConfig.id,
        max_tokens: options?.maxTokens ?? modelConfig.maxTokens,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        stop_sequences: options?.stopSequences,
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if ('text' in delta) {
            fullContent += delta.text;
            options?.onToken?.(delta.text);
            yield delta.text;
          }
        } else if (event.type === 'message_delta') {
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens;
        }
      }

      const cost = (inputTokens / 1000) * modelConfig.costPer1kInput +
                   (outputTokens / 1000) * modelConfig.costPer1kOutput;

      const result: CompletionResult = {
        content: fullContent,
        model: modelConfig.id,
        inputTokens,
        outputTokens,
        stopReason: 'end_turn',
        cost,
      };

      options?.onComplete?.(result);
      return result;

    } catch (error) {
      logger.error({ error, model: modelName }, 'Anthropic streaming failed');
      throw error;
    }
  }

  /**
   * Multi-turn conversation
   */
  async chat(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    if (!this.client) {
      throw new Error('Anthropic client not initialized. Please set ANTHROPIC_API_KEY.');
    }

    const modelName = options?.model ?? this.config.defaultModel;
    const modelConfig = ANTHROPIC_MODELS[modelName];

    try {
      const response = await this.client.messages.create({
        model: modelConfig.id,
        max_tokens: options?.maxTokens ?? modelConfig.maxTokens,
        temperature: options?.temperature ?? 0.7,
        system: options?.systemPrompt,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('');

      const inputTokens = response.usage.input_tokens;
      const outputTokens = response.usage.output_tokens;
      const cost = (inputTokens / 1000) * modelConfig.costPer1kInput +
                   (outputTokens / 1000) * modelConfig.costPer1kOutput;

      return {
        content,
        model: modelConfig.id,
        inputTokens,
        outputTokens,
        stopReason: response.stop_reason ?? 'unknown',
        cost,
      };

    } catch (error) {
      logger.error({ error, model: modelName }, 'Anthropic chat failed');
      throw error;
    }
  }

  /**
   * Extract structured data from text using Claude
   */
  async extractStructured<T>(
    text: string,
    schema: {
      description: string;
      fields: Array<{ name: string; type: string; description: string }>;
    },
    options?: CompletionOptions
  ): Promise<T> {
    const systemPrompt = `You are a data extraction assistant. Extract the requested information from the provided text and return it as valid JSON.

Schema:
${schema.description}

Fields to extract:
${schema.fields.map(f => `- ${f.name} (${f.type}): ${f.description}`).join('\n')}

Return ONLY valid JSON matching the schema. Do not include any explanation or markdown formatting.`;

    const result = await this.complete(text, {
      ...options,
      systemPrompt,
      temperature: 0.1, // Low temperature for extraction
    });

    try {
      // Parse JSON from response
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      logger.error({ error, content: result.content }, 'Failed to parse extraction result');
      throw new Error('Failed to parse structured extraction result');
    }
  }

  /**
   * Analyze contract text
   */
  async analyzeContract(
    contractText: string,
    analysisType: 'risk' | 'summary' | 'clauses' | 'obligations' | 'full',
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    const systemPrompts: Record<string, string> = {
      risk: `You are a contract risk analyst. Analyze the contract for potential risks, liabilities, and unfavorable terms. Categorize risks as critical, high, medium, or low. Provide specific clause references and mitigation recommendations.`,
      
      summary: `You are a contract summarization expert. Create a concise executive summary of the contract including: parties involved, key terms, financial details, important dates, and main obligations.`,
      
      clauses: `You are a legal clause analyst. Identify and categorize all significant clauses in the contract. For each clause, provide: the clause type, a summary, any unusual or concerning language, and comparison to standard market terms.`,
      
      obligations: `You are a contract obligation tracker. Extract all obligations, deadlines, deliverables, and commitments from the contract. Categorize by party (us/them/mutual) and by type (payment, delivery, compliance, reporting).`,
      
      full: `You are a comprehensive contract analyst. Perform a thorough analysis including:
1. Executive summary
2. Key terms and financial details
3. Risk assessment with severity ratings
4. All obligations by party
5. Important dates and deadlines
6. Unusual or non-standard clauses
7. Recommendations for negotiation

Format your response in clear sections.`,
    };

    return this.complete(contractText, {
      ...options,
      systemPrompt: systemPrompts[analysisType],
      maxTokens: analysisType === 'full' ? 4000 : 2000,
    });
  }
}

// Export singleton with default configuration
export const anthropicProvider = new AnthropicProvider();

// Export factory for custom configurations
export function createAnthropicProvider(config?: AnthropicConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
