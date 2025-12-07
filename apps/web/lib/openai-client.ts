/**
 * OpenAI Client for web app
 * Re-exports the OpenAI client from packages
 */

import { OpenAIClient } from 'clients-openai';

// Initialize OpenAI client with API key from environment
const apiKey = process.env.OPENAI_API_KEY || '';

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY not set. OpenAI features will be disabled.');
}

// Type the client with explicit chat method signature to ensure response_format is recognized
interface TypedOpenAIClient {
  createStructured<T>(opts: {
    model: string;
    system: string;
    userChunks: any[];
    schema: any;
    temperature?: number;
  }): Promise<T>;
  chat(opts: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: 'json_object' | 'text' };
  }): Promise<{ choices: Array<{ message?: { content?: string } }> }>;
}

export const openai: TypedOpenAIClient | null = apiKey ? new OpenAIClient(apiKey) : null;

export { OpenAIClient };
