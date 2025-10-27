/**
 * OpenAI Client for web app
 * Re-exports the OpenAI client from packages
 */

import { OpenAIClient } from '@/packages/clients/openai';

// Initialize OpenAI client with API key from environment
const apiKey = process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY not set. OpenAI features will be disabled.');
}

export const openai = apiKey ? new OpenAIClient(apiKey) : null;

export { OpenAIClient };
