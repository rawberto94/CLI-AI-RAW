/**
 * Agentic UX telemetry — emit product analytics events.
 *
 * Events (AGENTIC_UX_IMPLEMENTATION_PLAN success metrics):
 * - approval_requested
 * - approval_decided
 * - notification_impression
 * - notification_click
 * - agent_undo_used
 * - autonomy_changed (reserved for Phase 2.1; emit stub OK)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export type UxAnalyticsEventName =
  | 'approval_requested'
  | 'approval_decided'
  | 'notification_impression'
  | 'notification_click'
  | 'agent_undo_used'
  | 'autonomy_changed';

export interface EmitUxEventInput {
  tenantId: string;
  userId?: string | null;
  event: UxAnalyticsEventName | string;
  props?: Record<string, unknown>;
}

/**
 * Persist a UX analytics event. Fire-and-forget safe: never throws to callers.
 * Server-only — client components must use `trackUxEventClient` from
 * `@/lib/analytics/ux-events-client` so Prisma is not pulled into the browser bundle.
 */
export async function emitUxEvent(input: EmitUxEventInput): Promise<void> {
  try {
    if (!input.tenantId || !input.event) return;
    await prisma.analyticsEvent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        event: input.event,
        props: (input.props ?? {}) as object,
      },
    });
  } catch (err) {
    logger.warn('Failed to emit UX analytics event', {
      error: err instanceof Error ? err.message : String(err),
      event: input.event,
      tenantId: input.tenantId,
    });
  }
}

/** Reserved event names for Phase 2.1 autonomy controls */
export const AUTONOMY_CHANGED_EVENT: UxAnalyticsEventName = 'autonomy_changed';
