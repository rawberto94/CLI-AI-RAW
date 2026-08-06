/**
 * GET /api/v2/stream/[runId]
 * SSE shim for the run inspector (Phase 2.4).
 * Loads the goal run once and emits step events so the client EventSource works.
 * For live runs, clients should also poll GET /api/agents/runs/[runId].
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sse(data: unknown, event?: string): string {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  return event ? `event: ${event}\n${payload}` : payload;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> | { runId: string } },
) {
  const tenantId = req.headers.get('x-tenant-id');
  const params = await Promise.resolve(context.params);
  const runId = params.runId?.replace(/^goal-/, '').replace(/^run-/, '');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      try {
        if (!tenantId || !runId) {
          send(sse({ error: 'unauthorized_or_missing_run' }, 'error'));
          send(sse({ summary: null }, 'done'));
          controller.close();
          return;
        }

        const goal = await prisma.agentGoal.findFirst({
          where: { id: runId, tenantId },
          include: { steps: { orderBy: { order: 'asc' } } },
        });

        if (!goal) {
          send(sse({ error: 'not_found' }, 'error'));
          send(sse({ summary: null }, 'done'));
          controller.close();
          return;
        }

        const steps = goal.steps?.length
          ? goal.steps
          : Array.isArray((goal.plan as { steps?: unknown[] })?.steps)
            ? ((goal.plan as { steps: Array<Record<string, unknown>> }).steps || []).map(
                (ps, i) => ({
                  id: `plan-${i}`,
                  name: String(ps.name || ps.action || `Step ${i + 1}`),
                  type: String(ps.type || 'action'),
                  status: String(ps.status || 'PENDING'),
                  order: i + 1,
                  duration: 0,
                  input: ps.input ?? ps,
                  output: ps.output ?? null,
                  error: null,
                  startedAt: null,
                  completedAt: null,
                  createdAt: goal.createdAt,
                }),
              )
            : [];

        for (const s of steps) {
          send(
            sse(
              {
                id: s.id,
                name: s.name,
                type: s.type,
                status: s.status,
                order: s.order,
                durationMs: s.duration ?? 0,
                toolInput: s.input,
                toolOutput: s.output,
                error: s.error,
              },
              'step',
            ),
          );
        }

        const result = (goal.result ?? {}) as Record<string, unknown>;
        send(
          sse(
            {
              summary:
                typeof result.summary === 'string'
                  ? result.summary
                  : goal.status === 'COMPLETED'
                    ? 'Completed'
                    : goal.error || goal.status,
              status: goal.status,
              runId: goal.id,
              contractId: goal.contractId,
            },
            'done',
          ),
        );
      } catch (err) {
        send(
          sse(
            { error: err instanceof Error ? err.message : 'stream_failed' },
            'error',
          ),
        );
        send(sse({ summary: null }, 'done'));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
