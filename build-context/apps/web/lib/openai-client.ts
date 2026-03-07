/**
 * OpenAI Client for web app
 * Creates a typed OpenAI client wrapper
 */

import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
const apiKey = process.env.OPENAI_API_KEY || '';

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

// Wrapper class to provide the expected interface
class OpenAIClient implements TypedOpenAIClient {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async createStructured<T>(opts: {
    model: string;
    system: string;
    userChunks: any[];
    schema: any;
    temperature?: number;
  }): Promise<T> {
    const response = await this.openai.chat.completions.create({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.system },
        ...opts.userChunks.map((chunk: any) => ({ role: 'user' as const, content: String(chunk) })),
      ],
      temperature: opts.temperature ?? 0.3,
      response_format: { type: 'json_object' },
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
    response_format?: { type: 'json_object' | 'text' };
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

export const openai: TypedOpenAIClient | null = apiKey ? new OpenAIClient(apiKey) : null;

export { OpenAIClient };
