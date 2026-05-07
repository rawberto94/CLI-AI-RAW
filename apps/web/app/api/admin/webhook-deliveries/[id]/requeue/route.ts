/**
 * POST /api/admin/webhook-deliveries/:id/requeue
 *
 * Session-auth admin endpoint that resets a `dead` (or stuck) WebhookDelivery
 * row back to `pending` so the next /api/cron/webhook-retry tick will re-attempt
 * it. Tenant-scoped via the helper in lib/webhooks/delivery.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { requeueDeadDelivery } from '@/lib/webhooks/delivery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 400 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Delivery id is required' }, { status: 400 });
  }

  const ok = await requeueDeadDelivery(id, tenantId);
  if (!ok) {
    return NextResponse.json(
      { error: 'Delivery not found or not requeueable' },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
