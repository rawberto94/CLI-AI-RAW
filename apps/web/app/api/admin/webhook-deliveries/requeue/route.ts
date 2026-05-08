/**
 * POST /api/admin/webhook-deliveries/requeue
 *
 * Session-auth admin endpoint that requeues every `dead` delivery row in the
 * caller's tenant matching the optional event / webhookId filters.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requeueMatchingDeadDeliveries } from '@/lib/webhooks/delivery';
import { requireAdminScope, isScopeError } from '@/lib/tenant-isolation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const scope = await requireAdminScope(request);
  if (isScopeError(scope)) {
    return scope;
  }
  const tenantId = scope.tenantId;

  const body = await request.json().catch(() => ({}));
  const event = typeof body?.event === 'string' && body.event.trim() ? body.event.trim() : undefined;
  const webhookId =
    typeof body?.webhookId === 'string' && body.webhookId.trim()
      ? body.webhookId.trim()
      : undefined;

  const requeued = await requeueMatchingDeadDeliveries({ tenantId, event, webhookId });
  return NextResponse.json({ ok: true, requeued });
}