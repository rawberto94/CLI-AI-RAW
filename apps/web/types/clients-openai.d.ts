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
  }
}
