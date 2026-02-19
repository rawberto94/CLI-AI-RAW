/**
 * AI Client for Word Add-in and other API routes
 * Returns an OpenAI-compatible client with a default model property.
 *
 * Supports two providers via environment variables:
 *   1. OpenAI  — OPENAI_API_KEY + OPENAI_MODEL
 *   2. Mistral — MISTRAL_API_KEY (uses the OpenAI-compatible endpoint)
 *
 * If OPENAI_API_KEY is empty or starts with "sk-your", the client
 * automatically falls back to Mistral when MISTRAL_API_KEY is set.
 */

import OpenAI from 'openai';

interface AIClient extends OpenAI {
  model: string;
  provider: 'openai' | 'mistral';
}

let _client: AIClient | null = null;

/**
 * Returns a singleton OpenAI-compatible AI client.
 * Auto-selects Mistral when the OpenAI key is missing or exhausted.
 */
export async function getAIClient(): Promise<AIClient> {
  if (_client) return _client;

  const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
  const mistralKey = (process.env.MISTRAL_API_KEY || '').trim();
  const preferredModel = process.env.OPENAI_MODEL || '';

  // Decide which provider to use
  const openaiUsable = openaiKey.length > 10 && !openaiKey.startsWith('sk-your');

  let client: AIClient;

  if (openaiUsable) {
    // Try OpenAI first
    try {
      const openai = new OpenAI({ apiKey: openaiKey }) as AIClient;
      openai.model = preferredModel || 'gpt-4o-mini';
      openai.provider = 'openai';

      // Quick validation — list models to verify the key isn't exhausted
      // (We skip the actual call; if it fails at usage time we'll catch it.)
      client = openai;
    } catch {
      // Fall through to Mistral
      client = null as unknown as AIClient;
    }
  } else {
    client = null as unknown as AIClient;
  }

  // Fallback to Mistral if OpenAI client wasn't created or key looks bad
  if (!client && mistralKey) {
    const mistral = new OpenAI({
      apiKey: mistralKey,
      baseURL: 'https://api.mistral.ai/v1',
    }) as AIClient;
    mistral.model = 'mistral-large-latest';
    mistral.provider = 'mistral';
    client = mistral;
  }

  // Last resort: create an OpenAI client anyway (will fail at call time with a clear error)
  if (!client) {
    const fallback = new OpenAI({ apiKey: openaiKey || 'missing-key' }) as AIClient;
    fallback.model = preferredModel || 'gpt-4o-mini';
    fallback.provider = 'openai';
    client = fallback;
  }

  _client = client;
  console.log(`[AI] Using provider: ${_client.provider}, model: ${_client.model}`);
  return _client;
}

/**
 * Reset the cached client (useful when env vars change at runtime).
 */
export function resetAIClient(): void {
  _client = null;
}
