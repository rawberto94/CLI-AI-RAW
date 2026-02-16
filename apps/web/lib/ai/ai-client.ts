/**
 * AI Client for Word Add-in and other API routes
 * Returns an OpenAI-compatible client with a default model property
 */

import OpenAI from 'openai';

interface AIClient extends OpenAI {
  model: string;
}

let _client: AIClient | null = null;

/**
 * Returns a singleton OpenAI-compatible AI client.
 * Reads OPENAI_API_KEY and OPENAI_MODEL from environment variables.
 */
export async function getAIClient(): Promise<AIClient> {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const openai = new OpenAI({ apiKey }) as AIClient;
  openai.model = model;

  _client = openai;
  return _client;
}
