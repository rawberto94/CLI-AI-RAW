/**
 * AI SDK Provider
 *
 * Returns a Vercel AI SDK-compatible provider that respects the project's
 * environment configuration (Azure OpenAI → OpenAI → Mistral fallback).
 *
 * Usage:
 *   import { getAIModel } from '@/lib/ai/ai-sdk-provider';
 *   const { object } = await generateObject({ model: getAIModel(), ... });
 */

import { createOpenAI } from '@ai-sdk/openai';

function getProvider() {
  const azureKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const azureEndpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim();

  if (azureKey && azureEndpoint) {
    const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o').trim();
    const apiVersion = (process.env.AZURE_OPENAI_API_VERSION || '2024-02-01').trim();
    return {
      provider: createOpenAI({
        apiKey: azureKey,
        baseURL: `${azureEndpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
        headers: { 'api-key': azureKey },
        compatibility: 'compatible',
        fetch: (url, init) => {
          // Append api-version to all Azure OpenAI requests
          const separator = String(url).includes('?') ? '&' : '?';
          return fetch(`${url}${separator}api-version=${apiVersion}`, init);
        },
      }),
      model: deployment,
    };
  }

  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (openaiKey && !openaiKey.startsWith('sk-your')) {
    return {
      provider: createOpenAI({ apiKey: openaiKey }),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    };
  }

  const mistralKey = (process.env.MISTRAL_API_KEY || '').trim();
  if (mistralKey) {
    return {
      provider: createOpenAI({
        apiKey: mistralKey,
        baseURL: 'https://api.mistral.ai/v1',
        compatibility: 'compatible',
      }),
      model: 'mistral-large-latest',
    };
  }

  throw new Error(
    'No AI provider configured. Set AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY, OPENAI_API_KEY, or MISTRAL_API_KEY.'
  );
}

/**
 * Returns a Vercel AI SDK LanguageModel configured for the active provider.
 * Use with `generateObject`, `generateText`, or `streamText`.
 */
export function getAIModel(modelOverride?: string) {
  const { provider, model } = getProvider();
  return provider(modelOverride || model);
}
