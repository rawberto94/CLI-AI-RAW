/**
 * Integration events — durable, append-only event log.
 *
 * Consumers (warehouses, BI tools, other systems) poll
 * `/api/v1/events?since=<id>` and replay deterministically. This
 * complements the push-style webhooks (`/api/webhooks`): webhooks are
 * fire-and-forget and can drop on transient failures, but
 * IntegrationEvent rows are persisted so consumers never miss a beat.
 *
 * Every place that fires a webhook should also record here. The
 * `recordIntegrationEvent` helper is fire-and-forget and never throws.
 */

import { prisma } from '@/lib/db';

export type IntegrationEventType =
  | 'contract.created'
  | 'contract.updated'
  | 'contract.processed'
  | 'contract.deleted'
  | 'contract.expired'
  | 'contract.renewed'
  | 'obligation.created'
  | 'obligation.completed'
  | 'obligation.overdue'
  | 'artifact.generated'
  | 'signature.completed';

export interface RecordEventInput {
  tenantId: string;
  eventType: IntegrationEventType;
  resourceId?: string;
  payload: Record<string, unknown>;
}

/**
 * Persist one event. Never throws — writes happen on the hot path of
 * upload/process/etc. and must not break the originating request.
 */
export async function recordIntegrationEvent(input: RecordEventInput): Promise<void> {
  try {
    await prisma.integrationEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: input.eventType,
        resourceId: input.resourceId ?? null,
        payload: input.payload as object,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[integration-events] failed to record:', (err as Error).message);
  }
}
