/**
 * OpenAI client for the web app.
 * Prefers Azure OpenAI when Azure credentials are present, otherwise falls back
 * to the standard OpenAI API client.
 */

import OpenAI, { AzureOpenAI } from 'openai';

type ActiveProviderConfig =
  | {
      provider: 'azure';
      apiKey: string;
      endpoint: string;
      deployment: string;
      apiVersion: string;
    }
  | {
      provider: 'openai';
      apiKey: string;
    };

function getActiveProviderConfig(): ActiveProviderConfig | null {
  const azureApiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();

  if (azureApiKey && azureEndpoint) {
    return {
      provider: 'azure',
      apiKey: azureApiKey,
      endpoint: azureEndpoint.replace(/\/$/, ''),
      deployment: (process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o').trim(),
      apiVersion: (process.env.AZURE_OPENAI_API_VERSION || '2024-02-01').trim(),
    };
  }

  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (openAiApiKey) {
    return {
      provider: 'openai',
      apiKey: openAiApiKey,
    };
  }

  return null;
}

/**
 * Returns the OpenAI API key, or throws a clear error if missing.
 * Use this instead of `process.env.OPENAI_API_KEY || ''` to fail fast
 * with a descriptive error rather than a cryptic 401 from OpenAI.
 */
export function getOpenAIApiKey(): string {
  const config = getActiveProviderConfig();
  const key = config?.apiKey || '';
  if (!key || key.startsWith('sk-your')) {
    throw new Error(
      'No AI API key is configured. Set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY or OPENAI_API_KEY to use AI features.'
    );
  }
  return key;
}

export function hasAIClientConfig(): boolean {
  return getActiveProviderConfig() !== null;
}

export function isAzureOpenAIEnabled(): boolean {
  const config = getActiveProviderConfig();
  return config?.provider === 'azure';
}

/** Returns the active deployment/model name (e.g. 'gpt-4o') for chat completions. */
export function getDeploymentName(): string {
  const config = getActiveProviderConfig();
  return config?.provider === 'azure'
    ? config.deployment
    : 'gpt-4o';
}

export function createOpenAIClient(apiKeyOverride?: string): OpenAI {
  const config = getActiveProviderConfig();

  if (config?.provider === 'azure') {
    return new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deployment: config.deployment,
      apiVersion: config.apiVersion,
      timeout: 60_000,
      maxRetries: 2,
    }) as unknown as OpenAI;
  }

  const apiKey = (apiKeyOverride || config?.apiKey || '').trim();
  if (!apiKey || apiKey.startsWith('sk-your')) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Set it in your .env file to use OpenAI features.'
    );
  }

  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 2 });
}

/**
 * Returns an OpenAI client specifically configured for embedding operations.
 * For Azure OpenAI, this targets the embedding deployment (text-embedding-3-small)
 * rather than the chat deployment (gpt-4o).
 */
export function createEmbeddingClient(): OpenAI {
  const config = getActiveProviderConfig();

  if (config?.provider === 'azure') {
    const embeddingDeployment = (process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small').trim();
    return new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deployment: embeddingDeployment,
      apiVersion: config.apiVersion,
      timeout: 30_000,
      maxRetries: 2,
    }) as unknown as OpenAI;
  }

  // For non-Azure providers, the same client works for both chat and embeddings
  return createOpenAIClient();
}

// Type the client with explicit chat method signature to ensure response_format is recognized
interface TypedOpenAIClient {
  createStructured<T>(opts: {
    model: string;
    system: string;
    userChunks: any[];
    schema: any;
    temperature?: number;
    structuredOutputName?: string;
  }): Promise<T>;
  chat(opts: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'json_schema' | 'text'; json_schema?: { name: string; strict: boolean; schema: Record<string, unknown> } };
  }): Promise<{ choices: Array<{ message?: { content?: string } }> }>;
}

// Wrapper class to provide the expected interface
class OpenAIClient implements TypedOpenAIClient {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = createOpenAIClient(apiKey);
  }

  async createStructured<T>(opts: {
    model: string;
    system: string;
    userChunks: any[];
    schema: any;
    temperature?: number;
    structuredOutputName?: string;
  }): Promise<T> {
    const responseFormat = opts.structuredOutputName
      ? {
          type: 'json_schema' as const,
          json_schema: {
            name: opts.structuredOutputName,
            strict: true,
            schema: opts.schema,
          },
        }
      : { type: 'json_object' as const };

    const response = await this.openai.chat.completions.create({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.system },
        ...opts.userChunks.map((chunk: any) => ({ role: 'user' as const, content: String(chunk) })),
      ],
      temperature: opts.temperature ?? 0.3,
      response_format: responseFormat as any,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No content in response');
    return JSON.parse(content) as T;
  }

  async chat(opts: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'json_schema' | 'text'; json_schema?: { name: string; strict: boolean; schema: Record<string, unknown> } };
  }): Promise<{ choices: Array<{ message?: { content?: string } }> }> {
    const response = await this.openai.chat.completions.create({
      model: opts.model,
      messages: opts.messages as any,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      response_format: opts.response_format as any,
    });

    return response as any;
  }
}

export const openai: TypedOpenAIClient | null = getActiveProviderConfig() ? new OpenAIClient() : null;

export { OpenAIClient };
