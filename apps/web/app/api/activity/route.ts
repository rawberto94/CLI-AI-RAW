/**
 * Activity Feed API
 * Track and retrieve system activity - Database persisted
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { auditTrailService } from 'data-orchestration/services';
import { logger } from '@/lib/logger';
type ActivityType = 
  | 'contract_created'
  | 'contract_updated'
  | 'contract_deleted'
  | 'contract_viewed'
  | 'contract_downloaded'
  | 'contract_approved'
  | 'contract_rejected'
  | 'comment_added'
  | 'processing_started'
  | 'processing_completed'
  | 'processing_failed'
  | 'user_login'
  | 'settings_changed'
  | 'import_completed'
  | 'export_completed'
  | 'upload'
  | 'edit'
  | 'comment'
  | 'approval'
  | 'rejection'
  | 'share'
  | 'download'
  | 'workflow'
  | 'metadata';

interface ActivityResponse {
  id: string;
  type: string;
  title: string;
  description?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  contractId?: string;
  contractName?: string;
}

// Transform database activity to API response
function transformActivity(dbActivity: any): ActivityResponse {
  const metadata = dbActivity.metadata as Record<string, any> | null;
  return {
    id: dbActivity.id,
    type: dbActivity.type,
    title: dbActivity.action,
    description: dbActivity.details || undefined,
    userId: dbActivity.userId,
    userName: metadata?.userName,
    userEmail: metadata?.userEmail,
    userAvatar: metadata?.userAvatar,
    metadata: metadata ?? undefined,
    timestamp: dbActivity.timestamp.toISOString(),
    contractId: dbActivity.contractId,
    contractName: metadata?.contractName,
  };
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const userId = searchParams.get('userId');
  const type = searchParams.get('type');
  const category = searchParams.get('category');
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);
  const tenantId = ctx.tenantId;

  // Build where clause
  const where: any = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }

  // Filter by contract
  if (contractId) {
    where.contractId = contractId;
  }

  // Filter by user
  if (userId) {
    where.userId = userId;
  }

  // Filter by type
  if (type) {
    where.type = type;
  }

  // Filter by category
  if (category) {
    const categoryTypes: Record<string, string[]> = {
      contracts: ['contract_created', 'contract_updated', 'contract_deleted', 'contract_viewed', 'contract_downloaded', 'upload', 'edit'],
      approvals: ['contract_approved', 'contract_rejected', 'approval', 'rejection'],
      processing: ['processing_started', 'processing_completed', 'processing_failed'],
      system: ['user_login', 'settings_changed', 'import_completed', 'export_completed'],
      collaboration: ['comment_added', 'comment', 'share'],
    };
    const types = categoryTypes[category];
    if (types) {
      where.type = { in: types };
    }
  }

  // Get total count
  const total = await prisma.contractActivity.count({ where });

  // Fetch activities from database
  const dbActivities = await prisma.contractActivity.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    skip: offset,
    take: limit,
  });

  const activities = dbActivities.map(transformActivity);

  return createSuccessResponse(ctx, {
    activities,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  });
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const {
    type,
    title,
    description,
    userName,
    userEmail,
    userAvatar,
    metadata,
    contractId,
    contractName,
  } = body;

  const tenantId = ctx.tenantId;
  const userId = ctx.userId;

  if (!type || !title) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'type and title are required', 400);
  }

  // Create activity in database
  const dbActivity = await prisma.contractActivity.create({
    data: {
      contractId: contractId || 'system',
      tenantId,
      userId,
      type,
      action: title,
      details: description,
      metadata: {
        userName,
        userEmail,
        userAvatar,
        contractName,
        ...metadata,
      },
    },
  });

  const activity = transformActivity(dbActivity);

  return createSuccessResponse(ctx, { activity }, { status: 201 });
});

// Helper function to log activity (can be imported and used elsewhere)
export async function logActivity(
  type: ActivityType,
  title: string,
  options: {
    description?: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    contractId?: string;
    contractName?: string;
    tenantId?: string;
    metadata?: Record<string, any>;
  }
): Promise<void> {
  const ctx = getApiContext(type as any);
  try {
    if (!options.tenantId) {
      logger.error('[logActivity] tenantId is required');
      return;
    }
    await prisma.contractActivity.create({
      data: {
        contractId: options.contractId || 'system',
        tenantId: options.tenantId,
        userId: options.userId,
        type,
        action: title,
        details: options.description,
        metadata: {
          userName: options.userName,
          userEmail: options.userEmail,
          contractName: options.contractName,
          ...options.metadata,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break the main flow
  }
}
