/**
 * POST /api/admin/integration-events/:id/replay
 *
 * Session-auth admin endpoint that replays one durable IntegrationEvent to the
 * current set of active webhook subscribers for the tenant. This reuses the
 * existing internal webhook trigger path and does not write a second
 * IntegrationEvent row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminScope, isScopeError } from '@/lib/tenant-isolation';
import { triggerWebhook } from '@/lib/webhook-triggers';
import { WEBHOOK_EVENTS, type WebhookEvent } from '@/app/api/webhooks/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const scope = await requireAdminScope(request);
  if (isScopeError(scope)) {
    return scope;
  }
  const tenantId = scope.tenantId;

  const { id } = await context.params;
  let eventId: bigint;
  try {
    eventId = BigInt(id);
  } catch {
    return NextResponse.json({ error: 'Invalid event id' }, { status: 400 });
  }

  const eventRow = await prisma.integrationEvent.findFirst({
    where: { id: eventId, tenantId },
    select: {
      id: true,
      eventType: true,
      payload: true,
      resourceId: true,
    },
  });

  if (!eventRow) {
    return NextResponse.json({ error: 'Integration event not found' }, { status: 404 });
  }

  if (!WEBHOOK_EVENTS.includes(eventRow.eventType as WebhookEvent)) {
    return NextResponse.json(
      { error: `Event type is not replayable via webhooks: ${eventRow.eventType}` },
      { status: 400 },
    );
  }

  const payload = eventRow.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Stored event payload is invalid' }, { status: 400 });
  }

  const result = await triggerWebhook({
    tenantId,
    event: eventRow.eventType as WebhookEvent,
    data: payload as Record<string, unknown>,
  });

  if (!result.success && result.delivered === 0 && result.failed === 0 && result.error) {
    return NextResponse.json(
      { error: result.error, eventId: eventRow.id.toString() },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    eventId: eventRow.id.toString(),
    eventType: eventRow.eventType,
    resourceId: eventRow.resourceId,
    replay: result,
  });
}