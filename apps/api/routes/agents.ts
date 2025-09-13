import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ContractOrchestrator, ProfessionalServicesAnalyzer } from 'agents';
import { getSection } from '../store';
import { randomUUID } from 'crypto';

type Subscriber = {
  send: (event: string, data: any) => void;
  close: () => void;
};
const streams = new Map<string, Set<Subscriber>>();
// In-memory run state fallback for demo mode when DB is unavailable
type RunRow = { runId: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'; startedAt: string; updatedAt: string; completedAt?: string | null; summary?: string | null; contractId?: string | null };
const runState = new Map<string, RunRow>();
function addSubscriber(runId: string, sub: Subscriber) {
  if (!streams.has(runId)) streams.set(runId, new Set());
  streams.get(runId)!.add(sub);
}
function removeSubscriber(runId: string, sub: Subscriber) {
  const set = streams.get(runId);
  if (!set) return;
  set.delete(sub);
  if (set.size === 0) streams.delete(runId);
}
function publish(runId: string, event: string, data: any) {
  const set = streams.get(runId);
  if (!set) return;
  for (const s of set) s.send(event, data);
  if (event === 'done') {
    for (const s of set) s.close();
    streams.delete(runId);
  }
}

export async function agentRoutes(fastify: FastifyInstance) {
  // Lightweight direct analysis for PS contracts
  fastify.post('/analyze/ps', async (request, reply) => {
    const schema = z.object({ text: z.string().min(1, 'text is required') });
    const parse = schema.safeParse(request.body);
    if (!parse.success) return reply.code(400).send({ error: parse.error.issues.map(i => i.message).join(', ') });
    const analyzer = new ProfessionalServicesAnalyzer();
    try {
      const res = await analyzer.analyze(parse.data.text);
      return reply.code(200).send(res);
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'analysis failed' });
    }
  });

  // Full intelligence bundle from raw text
  fastify.post('/analyze/ps/bundle', async (request, reply) => {
    const schema = z.object({ text: z.string().min(1, 'text is required') });
    const parse = schema.safeParse(request.body);
    if (!parse.success) return reply.code(400).send({ error: parse.error.issues.map(i => i.message).join(', ') });
    const analyzer = new ProfessionalServicesAnalyzer();
    try {
      const res = await analyzer.bundle(parse.data.text);
      return reply.code(200).send(res);
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'bundle failed' });
    }
  });

  // Intelligence bundle by stored docId (uses ingestion content when available)
  fastify.post('/intelligence/:docId', async (request, reply) => {
    const { docId } = request.params as any;
    try {
      // Prefer in-memory ingestion; if not present, try DB artifact fallback
      let ing: any = getSection?.(docId, 'ingestion');
      let text: string = ing?.content || '';
      if (!text) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const dbModule = require('clients-db');
          const db = dbModule.default || dbModule;
          if (db && db.artifact) {
            const art = await db.artifact.findFirst({
              where: { contractId: docId, type: 'INGESTION' as any },
              orderBy: { createdAt: 'desc' },
            });
            const data = art?.data as any;
            if (data && typeof data.content === 'string' && data.content.trim().length > 0) {
              text = data.content;
            }
          }
        } catch {}
      }
      if (!text) return reply.code(400).send({ error: 'No ingestion content found for docId' });
      const analyzer = new ProfessionalServicesAnalyzer();
      const res = await analyzer.bundle(text);
      return reply.code(200).send(res);
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'intelligence failed' });
    }
  });

  // Simple assistant chat (optionally doc-aware via docId)
  fastify.post('/assistant/chat', async (request, reply) => {
    const schema = z.object({
      docId: z.string().optional(),
      messages: z.array(z.object({ role: z.enum(['system','user','assistant']), content: z.string() })).default([{ role: 'user', content: '' }])
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) return reply.code(400).send({ error: parse.error.message });
    try {
      const orchestrator = new ContractOrchestrator();
      // Convert to LangChain BaseMessageLike[] (system/user/assistant)
      const { SystemMessage, HumanMessage, AIMessage } = require('@langchain/core/messages');
      const baseMsgs = parse.data.messages.map((m) => {
        if (m.role === 'system') return new SystemMessage(m.content);
        if (m.role === 'assistant') return new AIMessage(m.content);
        return new HumanMessage(m.content);
      });
      // If docId provided, load artifacts and prepend a system context message
      const msgs = [] as any[];
      if (parse.data.docId) {
        const docId = parse.data.docId;
        let ingestionText: string = '';
        let overview: any = undefined;
        try {
          const ing = getSection?.(docId, 'ingestion');
          if (ing && typeof (ing as any).content === 'string') ingestionText = (ing as any).content;
        } catch {}
        try {
          overview = getSection?.(docId, 'overview');
        } catch {}
        if (!ingestionText) {
          // DB fallback for ingestion
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const dbModule = require('clients-db');
            const db = dbModule.default || dbModule;
            if (db && db.artifact) {
              const art = await db.artifact.findFirst({
                where: { contractId: docId, type: 'INGESTION' as any },
                orderBy: { createdAt: 'desc' },
              });
              const data = art?.data as any;
              if (data && typeof data.content === 'string') ingestionText = data.content;
            }
          } catch {}
        }
        const parts: string[] = [];
        if (overview?.summary) parts.push(`Summary: ${String(overview.summary).slice(0, 1000)}`);
        if (ingestionText) parts.push(`Text: ${ingestionText.slice(0, 8000)}`);
        if (parts.length > 0) {
          const sys = new SystemMessage(
            `You are assisting with questions about a specific contract (id: ${docId}). Use only the provided context to answer precisely. If a question can't be answered from the context, say you don't have that information.\n\nCONTEXT:\n${parts.join('\n\n')}`
          );
          msgs.push(sys);
        } else {
          // Even if no content found, nudge model to be honest
          msgs.push(new SystemMessage(`You are assisting about a specific contract, but no text was found in the system. Do not invent details.`));
        }
      }
      msgs.push(...baseMsgs);
      const out: any = await (orchestrator as any).llm.invoke(msgs);
      const content = typeof out?.content === 'string' ? out.content : JSON.stringify(out);
      return reply.code(200).send({ content });
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'chat failed' });
    }
  });
  fastify.post('/process', async (request, reply) => {
    const schema = z.object({
      docId: z.string().optional(),
      text: z.string().min(1, 'text is required'),
      stream: z.boolean().default(true).optional(),
    });
    const parse = schema.safeParse(request.body);
    if (!parse.success) {
      return reply.code(400).send({ error: parse.error.issues.map(i => i.message).join(', ') });
    }
    const { docId, text } = parse.data;

    try {
      const orchestrator = new ContractOrchestrator();

      // Try to import db client lazily to avoid hard dependency
  let db: any = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dbModule = require('clients-db');
        db = dbModule.default || dbModule;
      } catch {}

  const runId = randomUUID();
      // Create Run row if DB available
      try {
        if (db && db.run) {
          await db.run.create({ data: { runId, contractId: docId || null, status: 'PENDING' } });
        }
      } catch {}
  // In-memory fallback
  runState.set(runId, { runId, contractId: docId || null, status: 'PENDING', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null, summary: null });
      // Kick off processing in background
      (async () => {
        const safePersist = async (type: string, data: any) => {
          if (!db || !db.artifact || !docId) return;
          try {
            await db.artifact.create({ data: { contractId: docId, type: String(type).toUpperCase(), data, schemaVersion: 'v1' } });
          } catch {}
        };
        try {
          // Mark RUNNING
          try { if (db && db.run) await db.run.update({ where: { runId }, data: { status: 'RUNNING' } }); } catch {}
          const mem = runState.get(runId); if (mem) { mem.status = 'RUNNING'; mem.updatedAt = new Date().toISOString(); }
          const result = await orchestrator.process(docId || `doc-${Date.now()}`, text, {
            onStep: async (step) => {
              publish(runId, 'step', step);
              await safePersist(step.name, step.data);
            },
          });
          // Mark COMPLETED
          try { if (db && db.run) await db.run.update({ where: { runId }, data: { status: 'COMPLETED', summary: result.summary, completedAt: new Date() } }); } catch {}
          const mem2 = runState.get(runId); if (mem2) { mem2.status = 'COMPLETED'; mem2.summary = result.summary || null; mem2.completedAt = new Date().toISOString(); mem2.updatedAt = new Date().toISOString(); }
          publish(runId, 'done', { docId: docId || null, ...result });
        } catch (err: any) {
          try { if (db && db.run) await db.run.update({ where: { runId }, data: { status: 'FAILED' } }); } catch {}
          const mem = runState.get(runId); if (mem) { mem.status = 'FAILED'; mem.updatedAt = new Date().toISOString(); }
          publish(runId, 'error', { message: err?.message || 'Agent pipeline failed' });
          publish(runId, 'done', { error: 'failed' });
        }
      })();

      return reply.code(202).send({ runId });
    } catch (err: any) {
      request.log.error({ err }, 'Agent pipeline failed');
      return reply.code(500).send({ error: 'Agent pipeline failed' });
    }
  });

  // SSE stream for a runId
  fastify.get('/stream/:runId', async (request, reply) => {
    const { runId } = request.params as any;
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders?.();

    const send = (event: string, data: any) => {
      try {
        reply.raw.write(`event: ${event}\n`);
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {}
    };
    const close = () => {
      try { reply.raw.end(); } catch {}
    };
    const sub: Subscriber = { send, close };
    addSubscriber(runId, sub);

    // Heartbeat to keep connection alive
    const interval = setInterval(() => {
      try { reply.raw.write(`: ping\n\n`); } catch {}
    }, 25000);
    reply.raw.on('close', () => {
      clearInterval(interval);
      removeSubscriber(runId, sub);
    });

    return reply; // keep open
  });

  // Runs list
  fastify.get('/runs', async (_request, reply) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dbModule = require('clients-db');
      const db = dbModule.default || dbModule;
      if (!db || !db.run) return reply.code(200).send([]);
      const runs = await db.run.findMany({ orderBy: { startedAt: 'desc' }, take: 100 });
      return reply.code(200).send(runs);
    } catch {
  // Fallback to in-memory
  const arr = Array.from(runState.values()).sort((a, b) => (b.startedAt.localeCompare(a.startedAt)));
  return reply.code(200).send(arr);
    }
  });

  // Run by id
  fastify.get('/runs/:runId', async (request, reply) => {
    const { runId } = request.params as any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const dbModule = require('clients-db');
      const db = dbModule.default || dbModule;
      if (!db || !db.run) return reply.code(404).send({ error: 'Not found' });
      const run = await db.run.findUnique({ where: { runId } });
      if (!run) return reply.code(404).send({ error: 'Not found' });
      return reply.code(200).send(run);
    } catch {
  // Fallback to in-memory
  const mem = runState.get(runId);
  if (!mem) return reply.code(404).send({ error: 'Not found' });
  return reply.code(200).send(mem);
    }
  });
}
