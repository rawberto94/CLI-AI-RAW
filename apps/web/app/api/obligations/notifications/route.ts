/**
 * Obligation Notifications API - Manage obligation reminders and alerts
 * 
 * GET /api/obligations/notifications - List user's obligation notifications
 * POST /api/obligations/notifications - Create new notification/reminder
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { aiObligationTrackerService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
export const dynamic = 'force-dynamic';

// GET /api/obligations/notifications - List notifications
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status'); // pending, sent, read, dismissed
  const contractId = searchParams.get('contractId');
  const obligationId = searchParams.get('obligationId');
  const upcoming = searchParams.get('upcoming') === 'true'; // Get notifications due in the future
  const overdue = searchParams.get('overdue') === 'true'; // Get past due notifications

  const whereClause: Record<string, unknown> = {
    tenantId,
  };

  if (status) {
    whereClause.status = status;
  }
  if (contractId) {
    whereClause.contractId = contractId;
  }
  if (obligationId) {
    whereClause.obligationId = obligationId;
  }

  const now = new Date();
  if (upcoming) {
    whereClause.scheduledFor = { gte: now };
  } else if (overdue) {
    whereClause.scheduledFor = { lt: now };
    whereClause.status = 'pending';
  }

  const [notifications, total] = await Promise.all([
    prisma.obligationNotification.findMany({
      where: whereClause,
      orderBy: { scheduledFor: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.obligationNotification.count({ where: whereClause }),
  ]);

  // Get summary stats
  const [pendingCount, overdueCount, todayCount] = await Promise.all([
    prisma.obligationNotification.count({
      where: { tenantId, status: 'PENDING' },
    }),
    prisma.obligationNotification.count({
      where: {
        tenantId,
        status: 'PENDING',
        scheduledFor: { lt: now },
      },
    }),
    prisma.obligationNotification.count({
      where: {
        tenantId,
        status: 'PENDING',
        scheduledFor: {
          gte: new Date(now.setHours(0, 0, 0, 0)),
          lt: new Date(now.setHours(23, 59, 59, 999)),
        },
      },
    }),
  ]);

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notifications.length < total,
      },
      stats: {
        pending: pendingCount,
        overdue: overdueCount,
        today: todayCount,
      },
    },
  });
});

// POST /api/obligations/notifications - Create notification
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user?.id) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = await ctx.tenantId;
  const body = await request.json();

  const {
    obligationId,
    contractId,
    type, // 'reminder', 'alert', 'escalation'
    scheduledFor,
    message,
    channels: _channels, // ['email', 'in-app', 'slack']
    metadata,
  } = body;

  if (!obligationId || !contractId || !type || !scheduledFor) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'obligationId, contractId, type, and scheduledFor are required', 400);
  }

  if (!['reminder', 'alert', 'escalation'].includes(type)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid type. Must be reminder, alert, or escalation', 400);
  }

  // Verify contract exists and belongs to tenant
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
  }

  const notification = await prisma.obligationNotification.create({
    data: {
      tenantId,
      obligationId,
      contractId,
      type,
      scheduledFor: new Date(scheduledFor),
      message: message || null,
      status: 'PENDING',
      recipients: metadata?.recipients || [],
    },
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: { notification },
  });
});
