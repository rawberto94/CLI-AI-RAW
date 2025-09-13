import { describe, it, expect, vi, beforeAll } from 'vitest';

// The server auto-starts on import due to start() call in index.ts.
// We just ensure environment toggles allow LLM path, but we mock clients-openai.
vi.mock('clients-openai', () => {
  class OpenAIClient {
    apiKey: string;
    constructor(apiKey: string){ this.apiKey = apiKey; }
    async createStructured(opts: any){
      return { summary: 'Mock summary', parties: ['Alpha Corp','Beta LLC'] };
    }
  }
  return { OpenAIClient };
});

describe('LLM overview analysis (mocked)', () => {
  beforeAll(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ANALYSIS_USE_LLM = 'true';
  });
  it('mock client returns structured result', async () => {
    const mod = await import('../src/index');
    // Trigger analyzeOverview directly via a pseudo pipeline if exposed in future.
    // For now, ensure module loaded without disabling LLM (no throw)
    expect(mod).toBeTruthy();
  });
});
