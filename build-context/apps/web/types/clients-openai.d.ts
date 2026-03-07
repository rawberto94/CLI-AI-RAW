declare module 'clients-openai' {
  export class OpenAIClient {
    constructor(apiKey: string);
    
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
    }): Promise<{
      choices: Array<{
        message?: { content?: string };
      }>;
    }>;
  }
}
