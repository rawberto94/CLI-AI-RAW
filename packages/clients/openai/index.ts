/**
 * Shared OpenAI / Azure OpenAI client factory.
 *
 * Prefers Azure when AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY are set
 * (production Contigo). Falls back to OPENAI_API_KEY for local/dev.
 *
 * Use this instead of `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
 * which silently no-ops in Azure-only deployments (agent-readiness F9 / P1-3).
 */

// Lazy import OpenAI to avoid ESM/CJS interop issues in some runners
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let OpenAICtor: any;
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
let AzureOpenAICtor: any;

import Ajv from 'ajv';

const ajv = new Ajv();
const MAX_REPAIR_ATTEMPTS = 3;

export type ActiveProviderConfig =
  | {
      provider: 'azure';
      apiKey: string;
      endpoint: string;
      deployment: string;
      miniDeployment: string;
      embeddingDeployment: string;
      apiVersion: string;
    }
  | {
      provider: 'openai';
      apiKey: string;
    };

function loadOpenAIModule(): { OpenAI: any; AzureOpenAI: any } {
  if (!OpenAICtor || !AzureOpenAICtor) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('openai');
    OpenAICtor = mod.OpenAI || mod.default;
    AzureOpenAICtor = mod.AzureOpenAI || mod.default?.AzureOpenAI || mod.OpenAI;
  }
  return { OpenAI: OpenAICtor, AzureOpenAI: AzureOpenAICtor };
}

export function getActiveProviderConfig(): ActiveProviderConfig | null {
  const azureApiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();

  if (azureApiKey && azureEndpoint) {
    const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o').trim();
    const miniDeployment = (
      process.env.AZURE_OPENAI_MINI_DEPLOYMENT ||
      process.env.AZURE_OPENAI_DEPLOYMENT ||
      deployment
    ).trim();
    const embeddingDeployment = (
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-small'
    ).trim();
    return {
      provider: 'azure',
      apiKey: azureApiKey,
      endpoint: azureEndpoint.replace(/\/$/, ''),
      deployment,
      miniDeployment,
      embeddingDeployment,
      apiVersion: (process.env.AZURE_OPENAI_API_VERSION || '2024-10-21').trim(),
    };
  }

  const openAiApiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (openAiApiKey && !openAiApiKey.startsWith('sk-your') && !/placeholder/i.test(openAiApiKey)) {
    return { provider: 'openai', apiKey: openAiApiKey };
  }

  return null;
}

export function hasAIClientConfig(): boolean {
  return getActiveProviderConfig() !== null;
}

export function isAzureOpenAIEnabled(): boolean {
  return getActiveProviderConfig()?.provider === 'azure';
}

export function getDeploymentName(preferMini = false): string {
  const config = getActiveProviderConfig();
  if (!config) return preferMini ? 'gpt-4o-mini' : 'gpt-4o';
  if (config.provider === 'azure') {
    return preferMini ? config.miniDeployment : config.deployment;
  }
  return preferMini ? 'gpt-4o-mini' : 'gpt-4o';
}

export function getOpenAIApiKey(): string {
  const config = getActiveProviderConfig();
  if (!config?.apiKey) {
    throw new Error(
      'No AI API key configured. Set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY or OPENAI_API_KEY.',
    );
  }
  return config.apiKey;
}

/** Chat / completion client (full deployment). Throws if unconfigured. */
export function createOpenAIClient(options?: {
  apiKeyOverride?: string;
  timeoutMs?: number;
  preferMini?: boolean;
}): any {
  const config = getActiveProviderConfig();
  const { OpenAI, AzureOpenAI } = loadOpenAIModule();
  const timeout = options?.timeoutMs ?? 60_000;

  if (config?.provider === 'azure') {
    const deployment = options?.preferMini ? config.miniDeployment : config.deployment;
    if (!deployment) {
      throw new Error(
        'Azure OpenAI deployment not set. Configure AZURE_OPENAI_DEPLOYMENT (and optionally AZURE_OPENAI_MINI_DEPLOYMENT).',
      );
    }
    return new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deployment,
      apiVersion: config.apiVersion,
      timeout,
      maxRetries: 2,
    });
  }

  const apiKey = (options?.apiKeyOverride || config?.apiKey || '').trim();
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured (and Azure OpenAI is not available).',
    );
  }
  return new OpenAI({ apiKey, timeout, maxRetries: 2 });
}

/** Embedding client (Azure embedding deployment when on Azure). */
export function createEmbeddingClient(options?: { timeoutMs?: number }): any {
  const config = getActiveProviderConfig();
  const { OpenAI, AzureOpenAI } = loadOpenAIModule();
  const timeout = options?.timeoutMs ?? 30_000;

  if (config?.provider === 'azure') {
    return new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      deployment: config.embeddingDeployment,
      apiVersion: config.apiVersion,
      timeout,
      maxRetries: 2,
    });
  }
  return createOpenAIClient({ timeoutMs: timeout });
}

/** Soft factory: returns null instead of throwing when unconfigured. */
export function tryCreateOpenAIClient(options?: {
  preferMini?: boolean;
  timeoutMs?: number;
}): any | null {
  if (!hasAIClientConfig()) return null;
  try {
    return createOpenAIClient(options);
  } catch {
    return null;
  }
}

// ── Legacy structured client (json_schema / AJV repair) ─────────────────────

export class OpenAIClient {
  private openai: any;

  constructor(apiKey?: string) {
    if (apiKey) {
      const { OpenAI } = loadOpenAIModule();
      this.openai = new OpenAI({ apiKey });
    } else {
      this.openai = createOpenAIClient();
    }
  }

  async createStructured<T>(opts: {
    model: string;
    system: string;
    userChunks: any[];
    schema: any;
    temperature?: number;
    structuredOutputName?: string;
  }): Promise<T> {
    const { model, system, userChunks, schema, temperature = 0, structuredOutputName } = opts;

    if (structuredOutputName) {
      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(userChunks) },
      ];
      const response = await this.openai.chat.completions.create({
        model,
        messages: messages as any,
        temperature,
        top_p: 1,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: structuredOutputName,
            strict: true,
            schema,
          },
        },
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');
      return JSON.parse(content) as T;
    }

    const systemWithJson = `${system} Return a valid JSON object that strictly matches the provided schema. Respond with JSON only.`;
    const safetyPreamble = 'Format: json. Output must be a single JSON object.';

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemWithJson },
      { role: 'user', content: safetyPreamble },
      { role: 'user', content: JSON.stringify(userChunks) },
    ];

    const validate = ajv.compile(schema);
    let lastResponse: any = null;
    let lastErrors: any[] = [];

    for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      try {
        const response = await this.openai.chat.completions.create({
          model,
          messages: messages as any,
          temperature,
          top_p: 1,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        lastResponse = JSON.parse(content);

        if (validate(lastResponse)) {
          return lastResponse as T;
        }

        lastErrors = validate.errors || [];

        if (attempt < MAX_REPAIR_ATTEMPTS) {
          const errorSummary = lastErrors
            .map((e: any) => `${e.instancePath || '/'}: ${e.message}`)
            .join('; ');

          messages.push({ role: 'assistant', content });
          messages.push({
            role: 'user',
            content: `The JSON response had schema validation errors: ${errorSummary}. Please fix these issues and return a corrected JSON object that matches the schema exactly.`,
          });
        }
      } catch (parseError: any) {
        if (attempt < MAX_REPAIR_ATTEMPTS) {
          messages.push({
            role: 'user',
            content:
              'The previous response was not valid JSON. Please return a properly formatted JSON object that matches the required schema.',
          });
        } else if (parseError?.message?.includes('Empty response')) {
          throw parseError;
        }
      }
    }

    throw new Error(
      `Schema validation failed after ${MAX_REPAIR_ATTEMPTS} attempts. Last errors: ${JSON.stringify(lastErrors)}`,
    );
  }

  async chat(opts: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: {
      type: 'json_object' | 'json_schema' | 'text';
      json_schema?: { name: string; strict: boolean; schema: Record<string, unknown> };
    };
  }): Promise<{ choices: Array<{ message?: { content?: string } }> }> {
    const { messages, model, temperature = 0.5, max_tokens, response_format } = opts;

    return this.openai.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
      max_tokens,
      ...(response_format && { response_format }),
    });
  }
}
