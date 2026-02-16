import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { RunnableSequence } from '@langchain/core/runnables';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';

export type AgentStep = { name: string; status: 'pending' | 'running' | 'completed' | 'skipped' | 'error'; data?: any; error?: string };
export type AgentResult = { summary?: string; steps: AgentStep[] };
export type OnStep = (step: AgentStep) => void | Promise<void>;

const overviewSchema = z.object({ summary: z.string().min(1), parties: z.array(z.string()).optional(), effectiveDate: z.string().optional() });
const clausesSchema = z.object({ clauses: z.array(z.object({ name: z.string(), present: z.boolean(), snippet: z.string().optional() })) });
const ratesSchema = z.object({ roles: z.array(z.object({ role: z.string(), uom: z.string().default('Day'), rate: z.number().or(z.string()), currency: z.string().default('CHF') })) });

export class ContractOrchestrator {
  llm: ChatOpenAI;

  constructor(opts?: { apiKey?: string; model?: string }) {
    const key = opts?.apiKey || process.env['OPENAI_API_KEY'];
    if (!key) {
      // Lightweight fallback that mimics a chat model runnable
      // Produces deterministic JSON based on simple heuristics
      const fallback = {
        async invoke(input: any) {
          const userMsg = Array.isArray(input?.messages) ? input.messages.find((m: any) => m.role === 'user') : null;
          const t: string = String(userMsg?.content || input?.text || '');
          if (/Identify presence of key clauses/i.test(JSON.stringify(input))) {
            const names = ['Liability Cap','Termination','Confidentiality','IP Ownership','Indemnity'];
            const clauses = names.map(n => ({ name: n, present: new RegExp(n.split(' ')[0] || n, 'i').test(t), snippet: undefined }));
            return { content: JSON.stringify({ clauses }) };
          }
          if (/Extract any role-based rate cards/i.test(JSON.stringify(input))) {
            const roles: any[] = [];
            const lines = t.split(/\r?\n/);
            for (const line of lines) {
              const m = line.match(/(Analyst|Consultant|Manager|Engineer|Director)/i);
              const r = line.match(/(\$|€|£)?\s?(\d{2,4})/);
              if (m && r) roles.push({ role: m[1], uom: 'Day', rate: Number(r[2]), currency: r[1] ? 'CHF' : 'CHF' });
              if (roles.length >= 8) break;
            }
            return { content: JSON.stringify({ roles }) };
          }
          // Overview default
          return { content: JSON.stringify({ summary: t.slice(0, 400) }) };
        }
      } as any;
      this.llm = fallback;
    } else {
      this.llm = new ChatOpenAI({ openAIApiKey: key, azureOpenAIApiKey: undefined, modelName: opts?.model || process.env['OPENAI_MODEL'] || 'gpt-4o-mini', temperature: 0.2 });
    }
  }

  private makeOverviewChain() {
    const system = `You are a contracts analyst. Summarize the contract and extract parties and effective date when possible. Return JSON.`;
    return RunnableSequence.from([
      async (input: { text: string }) => [
        new SystemMessage(system),
        new HumanMessage(input.text.slice(0, 12000)),
      ],
      this.llm,
      async (output: any) => {
        // Try to parse JSON from model output; fallback to simple summary
        const content = typeof output?.content === 'string' ? output.content : JSON.stringify(output);
        try {
          const json = JSON.parse(content);
          return overviewSchema.safeParse(json).success ? json : { summary: content.slice(0, 500) };
        } catch {
          return { summary: content.slice(0, 500) };
        }
      },
    ]);
  }

  private makeClausesChain() {
    const system = `Identify presence of key clauses: Liability Cap, Termination, Confidentiality, IP Ownership, Indemnity. Return strict JSON with { clauses: [{ name, present, snippet? }] }.`;
    return RunnableSequence.from([
      async (input: { text: string }) => [
        new SystemMessage(system),
        new HumanMessage(input.text.slice(0, 12000)),
      ],
      this.llm,
      async (output: any) => {
        const content = typeof output?.content === 'string' ? output.content : JSON.stringify(output);
        try {
          const json = JSON.parse(content);
          return clausesSchema.safeParse(json).success ? json : { clauses: [] };
        } catch {
          return { clauses: [] };
        }
      },
    ]);
  }

  private makeRatesChain() {
    const system = `Extract any role-based rate cards. Return JSON with { roles: [{ role, uom, rate, currency }] }. If none, return { roles: [] }`;
    return RunnableSequence.from([
      async (input: { text: string }) => [
        new SystemMessage(system),
        new HumanMessage(input.text.slice(0, 12000)),
      ],
      this.llm,
      async (output: any) => {
        const content = typeof output?.content === 'string' ? output.content : JSON.stringify(output);
        try {
          const json = JSON.parse(content);
          return ratesSchema.safeParse(json).success ? json : { roles: [] };
        } catch {
          return { roles: [] };
        }
      },
    ]);
  }

  async process(_docId: string, text: string, opts?: { onStep?: OnStep }): Promise<AgentResult> {
    const steps: AgentStep[] = [
      { name: 'overview', status: 'pending' },
      { name: 'clauses', status: 'pending' },
      { name: 'rates', status: 'pending' },
    ];

    // Overview
    steps[0]!.status = 'running';
    if (opts?.onStep) await opts.onStep(steps[0]!);
    try {
      const overview = await this.makeOverviewChain().invoke({ text });
      steps[0]!.status = 'completed';
      steps[0]!.data = overview;
      if (opts?.onStep) await opts.onStep(steps[0]!);
    } catch (e: any) {
      steps[0]!.status = 'error';
      steps[0]!.error = e?.message || 'overview failed';
      if (opts?.onStep) await opts.onStep(steps[0]!);
    }

    // Clauses
    steps[1]!.status = 'running';
    if (opts?.onStep) await opts.onStep(steps[1]!);
    try {
      const clauses = await this.makeClausesChain().invoke({ text });
      steps[1]!.status = 'completed';
      steps[1]!.data = clauses;
      if (opts?.onStep) await opts.onStep(steps[1]!);
    } catch (e: any) {
      steps[1]!.status = 'error';
      steps[1]!.error = e?.message || 'clauses failed';
      if (opts?.onStep) await opts.onStep(steps[1]!);
    }

    // Rates
    steps[2]!.status = 'running';
    if (opts?.onStep) await opts.onStep(steps[2]!);
    try {
      const rates = await this.makeRatesChain().invoke({ text });
      steps[2]!.status = 'completed';
      steps[2]!.data = rates;
      if (opts?.onStep) await opts.onStep(steps[2]!);
    } catch (e: any) {
      steps[2]!.status = 'error';
      steps[2]!.error = e?.message || 'rates failed';
      if (opts?.onStep) await opts.onStep(steps[2]!);
    }

    const summary = steps[0]?.data?.summary || 'Agentic processing pipeline executed';
    return { summary, steps };
  }
}
