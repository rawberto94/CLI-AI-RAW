/**
 * Webhook Delivery — persistent retry + DLQ pipeline.
 *
 * Each call to `enqueueAndAttempt` creates a `WebhookDelivery` row, then performs
 * the first delivery attempt synchronously. On transient failure, the row stays
 * `pending` with an exponentially backed-off `nextAttemptAt`. On final failure
 * (attempt >= maxAttempts) the row flips to `dead` (DLQ).
 *
 * `runDueRetries` is invoked by `/api/cron/webhook-retry` on a fixed schedule
 * (recommended: every 60s) and processes any pending rows whose retry window
 * has elapsed.
 */

import crypto from 'crypto';
import { getRetryingDeliveryWhere } from '@/lib/webhooks/status';

const DEFAULT_MAX_ATTEMPTS = 8;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BATCH_SIZE = 50;

export interface WebhookTarget {
  id: string;
  url: string;
  secret: string;
}

export interface EnqueueInput {
  tenantId: string;
  webhook: WebhookTarget;
  event: string;
  payload: Record<string, unknown>;
  dispatchId?: string;
  maxAttempts?: number;
}

export interface AttemptResult {
  deliveryRowId: string;
  deliveryId: string;
  dispatchId: string;
  status: 'success' | 'failed' | 'dead';
  statusCode?: number;
  error?: string;
}

/**
 * Exponential backoff with jitter. Capped at 1h.
 * Schedule (approx): 30s, 1m, 2m, 4m, 8m, 16m, 32m, 60m, 60m...
 */
function nextDelayMs(attempt: number): number {
  const base = 30_000 * Math.pow(2, Math.max(0, attempt - 1));
  const cap = 60 * 60_000;
  const capped = Math.min(base, cap);
  const jitter = capped * (0.85 + Math.random() * 0.3);
  return Math.round(jitter);
}

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma');
  return prisma;
}

interface DeliveryRow {
  id: string;
  webhookId: string;
  tenantId: string;
  event: string;
  deliveryId: string | null;
  payload: unknown;
  attempt: number;
  maxAttempts: number;
}

async function performHttpDelivery(
  target: WebhookTarget,
  event: string,
  deliveryId: string,
  bodyJson: string,
): Promise<{ ok: boolean; statusCode?: number; responseSnippet?: string; error?: string }> {
  const signature = crypto.createHmac('sha256', target.secret).update(bodyJson).digest('hex');
  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ContractIntelligence-Webhook/1.0',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
        'X-Webhook-Delivery': deliveryId,
      },
      body: bodyJson,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    let snippet: string | undefined;
    try {
      const text = await response.text();
      snippet = text.slice(0, 1024);
    } catch {
      /* ignore body read error */
    }
    return { ok: response.ok, statusCode: response.status, responseSnippet: snippet };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Persist a delivery row and run the first attempt synchronously.
 * Returns the row id + outcome of the initial attempt.
 */
export async function enqueueAndAttempt(input: EnqueueInput): Promise<AttemptResult> {
  const prisma = await getPrisma();
  const dispatchId = input.dispatchId ?? crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  const wrappedPayload = {
    id: deliveryId,
    dispatchId,
    event: input.event,
    timestamp: new Date().toISOString(),
    tenantId: input.tenantId,
    data: input.payload,
  };

  const row = await prisma.webhookDelivery.create({
    data: {
      tenantId: input.tenantId,
      webhookId: input.webhook.id,
      event: input.event,
      deliveryId,
      payload: wrappedPayload as object,
      maxAttempts,
      status: 'pending',
      attempt: 0,
    },
    select: { id: true },
  });

  return attemptDelivery(
    {
      id: row.id,
      webhookId: input.webhook.id,
      tenantId: input.tenantId,
      event: input.event,
      deliveryId,
      payload: wrappedPayload,
      attempt: 0,
      maxAttempts,
    },
    input.webhook,
  );
}

async function attemptDelivery(row: DeliveryRow, target: WebhookTarget): Promise<AttemptResult> {
  const prisma = await getPrisma();
  const nextAttemptNumber = row.attempt + 1;
  const bodyJson = JSON.stringify(row.payload);
  const result = await performHttpDelivery(target, row.event, row.deliveryId ?? row.id, bodyJson);
  const now = new Date();
  const dispatchId =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? ((row.payload as { dispatchId?: unknown }).dispatchId ?? row.id)
      : row.id;
  const deliveryId = row.deliveryId ?? row.id;

  if (result.ok) {
    await prisma.webhookDelivery.update({
      where: { id: row.id },
      data: {
        status: 'success',
        attempt: nextAttemptNumber,
        statusCode: result.statusCode ?? null,
        response: result.responseSnippet ?? null,
        error: null,
        sentAt: now,
        lastAttemptAt: now,
        nextAttemptAt: null,
      },
    });
    return {
      deliveryRowId: row.id,
      deliveryId,
      dispatchId: String(dispatchId),
      status: 'success',
      statusCode: result.statusCode,
    };
  }

  const isFinal = nextAttemptNumber >= row.maxAttempts;
  const errorText = result.error ?? `HTTP ${result.statusCode ?? '???'}`;

  if (isFinal) {
    await prisma.webhookDelivery.update({
      where: { id: row.id },
      data: {
        status: 'dead',
        attempt: nextAttemptNumber,
        statusCode: result.statusCode ?? null,
        response: result.responseSnippet ?? null,
        error: errorText.slice(0, 4000),
        lastAttemptAt: now,
        nextAttemptAt: null,
        deadAt: now,
      },
    });
    return {
      deliveryRowId: row.id,
      deliveryId,
      dispatchId: String(dispatchId),
      status: 'dead',
      statusCode: result.statusCode,
      error: errorText,
    };
  }

  const nextAttemptAt = new Date(now.getTime() + nextDelayMs(nextAttemptNumber));
  await prisma.webhookDelivery.update({
    where: { id: row.id },
    data: {
      status: 'pending',
      attempt: nextAttemptNumber,
      statusCode: result.statusCode ?? null,
      response: result.responseSnippet ?? null,
      error: errorText.slice(0, 4000),
      lastAttemptAt: now,
      nextAttemptAt,
    },
  });
  return {
    deliveryRowId: row.id,
    deliveryId,
    dispatchId: String(dispatchId),
    status: 'failed',
    statusCode: result.statusCode,
    error: errorText,
  };
}

/**
 * Drain due retries. Looks up `WebhookConfig` rows for each pending delivery's
 * webhookId and re-attempts. Stops at MAX_BATCH_SIZE per invocation.
 */
export async function runDueRetries(): Promise<{
  scanned: number;
  succeeded: number;
  failed: number;
  dead: number;
  skipped: number;
}> {
  const prisma = await getPrisma();
  const now = new Date();

  const due = await prisma.webhookDelivery.findMany({
    where: {
      status: 'pending',
      nextAttemptAt: { lte: now, not: null },
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: MAX_BATCH_SIZE,
  });

  let succeeded = 0;
  let failed = 0;
  let dead = 0;
  let skipped = 0;

  for (const delivery of due) {
    // Resolve target webhook config (must still exist + be active).
    const cfg = await prisma.webhookConfig.findUnique({
      where: { id: delivery.webhookId },
      select: { id: true, url: true, secret: true, isActive: true },
    });
    if (!cfg || !cfg.isActive) {
      // Configuration removed/deactivated → mark dead so it stops cycling.
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'dead',
          deadAt: new Date(),
          error: cfg ? 'Webhook deactivated' : 'Webhook configuration deleted',
          nextAttemptAt: null,
        },
      });
      skipped += 1;
      continue;
    }

    const result = await attemptDelivery(
      {
        id: delivery.id,
        webhookId: delivery.webhookId,
        tenantId: delivery.tenantId,
        event: delivery.event,
        deliveryId: delivery.deliveryId,
        payload: delivery.payload,
        attempt: delivery.attempt,
        maxAttempts: delivery.maxAttempts,
      },
      { id: cfg.id, url: cfg.url, secret: cfg.secret },
    );

    if (result.status === 'success') succeeded += 1;
    else if (result.status === 'dead') dead += 1;
    else failed += 1;
  }

  return { scanned: due.length, succeeded, failed, dead, skipped };
}

/**
 * Manually requeue a dead or retrying delivery. Resets attempt counter and
 * schedules an immediate retry (nextAttemptAt = now). Used by ops UI / API.
 */
export async function requeueDeadDelivery(deliveryRowId: string, tenantId: string): Promise<boolean> {
  const prisma = await getPrisma();
  const row = await prisma.webhookDelivery.findFirst({
    where: {
      id: deliveryRowId,
      tenantId,
      OR: [
        { status: 'dead' },
        { status: 'failed' },
        getRetryingDeliveryWhere(),
      ],
    },
    select: { id: true },
  });
  if (!row) return false;

  await prisma.webhookDelivery.update({
    where: { id: row.id },
    data: {
      status: 'pending',
      attempt: 0,
      error: null,
      deadAt: null,
      nextAttemptAt: new Date(),
    },
  });
  return true;
}

export interface RequeueMatchingDeliveriesInput {
  tenantId: string;
  event?: string;
  webhookId?: string;
}

/**
 * Requeue all dead deliveries matching the supplied tenant-scoped filters.
 * Used by the ops dashboard for batch DLQ recovery after downstream outages.
 */
export async function requeueMatchingDeadDeliveries(
  input: RequeueMatchingDeliveriesInput,
): Promise<number> {
  const prisma = await getPrisma();
  const result = await prisma.webhookDelivery.updateMany({
    where: {
      tenantId: input.tenantId,
      status: 'dead',
      ...(input.event ? { event: input.event } : {}),
      ...(input.webhookId ? { webhookId: input.webhookId } : {}),
    },
    data: {
      status: 'pending',
      attempt: 0,
      error: null,
      deadAt: null,
      nextAttemptAt: new Date(),
    },
  });

  return result.count;
}
