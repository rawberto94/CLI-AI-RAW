import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';
export const dynamic = 'force-dynamic';

/**
 * Share Types:
 * - VIEW: Can view the document
 * - COMMENT: Can view and comment
 * - EDIT: Can view, comment, and edit
 * - ADMIN: Full access including share permissions
 */

interface ShareSettings {
  id: string;
  documentId: string;
  documentType: 'contract' | 'rate_card' | 'template' | 'workflow';
  sharedWith: string; // userId or email
  sharedBy: string;
  permission: 'VIEW' | 'COMMENT' | 'EDIT' | 'ADMIN';
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  accessedAt?: string;
}

/**
 * GET /api/sharing - Get shares for a document
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');
  const documentType = searchParams.get('documentType') || 'contract';

  if (!documentId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Document ID is required', 400);
  }

  // Try database first
  try {
    const shares = await prisma.documentShare.findMany({
      where: { 
        tenantId,
        documentId,
        documentType,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return createSuccessResponse(ctx, {
      success: true,
      shares,
      total: shares.length,
      source: 'database',
    });
  } catch {
    // Database lookup failed
  }

  // Return empty results when database is unavailable
  return createSuccessResponse(ctx, {
    success: true,
    shares: [],
    total: 0,
    source: 'database',
  });
});

/**
 * POST /api/sharing - Create a new share
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const body = await request.json();

  const { 
    documentId, 
    documentType = 'contract',
    recipients, // Array of emails or userIds
    permission = 'VIEW',
    expiresAt,
    message, // Optional message to include in notification
    notifyByEmail: _notifyByEmail = true,
  } = body;

  if (!documentId || !recipients || recipients.length === 0) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Document ID and at least one recipient are required', 400);
  }

  const createdShares: ShareSettings[] = [];

  try {
    // Create shares for each recipient
    for (const recipient of recipients) {
      const share = await prisma.documentShare.create({
        data: {
          tenantId,
          documentId,
          documentType,
          sharedWith: recipient,
          sharedBy: userId,
          permission,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          isActive: true,
          accessToken: crypto.randomBytes(32).toString('hex'),
        },
      });

      createdShares.push({
        id: share.id,
        documentId: share.documentId,
        documentType: share.documentType as 'contract',
        sharedWith: share.sharedWith,
        sharedBy: share.sharedBy,
        permission: share.permission as 'VIEW',
        expiresAt: share.expiresAt?.toISOString(),
        isActive: share.isActive,
        createdAt: share.createdAt.toISOString(),
      });

      // Create notification for recipient
      await prisma.notification.create({
        data: {
          tenantId,
          userId: recipient,
          type: 'SHARE_INVITE',
          title: 'Document shared with you',
          message: message || `${userId} shared a ${documentType} with you`,
          link: `/${documentType}s/${documentId}`,
          metadata: { 
            documentId, 
            documentType, 
            permission, 
            sharedBy: userId,
          },
        },
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      shares: createdShares,
      message: `Document shared with ${recipients.length} recipient(s)`,
      source: 'database',
    });
  } catch (error) {
    throw error;
  }
});

/**
 * PATCH /api/sharing - Update share permissions
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const body = await request.json();
  const { shareId, permission, expiresAt, isActive } = body;

  if (!shareId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Share ID is required', 400);
  }

  try {
    // Verify share belongs to tenant before updating
    const existingShare = await prisma.documentShare.findFirst({
      where: { id: shareId, tenantId },
      select: { id: true },
    });

    if (!existingShare) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Share not found', 404);
    }

    const share = await prisma.documentShare.update({
      where: { id: existingShare.id },
      data: {
        ...(permission && { permission }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });

    return createSuccessResponse(ctx, {
      success: true,
      share,
      message: 'Share updated successfully',
      source: 'database',
    });
  } catch (error) {
    throw error;
  }
});

/**
 * DELETE /api/sharing - Revoke a share
 */
export const DELETE = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const shareId = searchParams.get('id');

  if (!shareId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Share ID is required', 400);
  }

  try {
    // Verify share belongs to tenant before revoking
    const existingShare = await prisma.documentShare.findFirst({
      where: { id: shareId, tenantId },
      select: { id: true },
    });

    if (!existingShare) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Share not found', 404);
    }

    await prisma.documentShare.update({
      where: { id: existingShare.id },
      data: { isActive: false },
    });

    return createSuccessResponse(ctx, {
      success: true,
      message: 'Share revoked successfully',
      source: 'database',
    });
  } catch (error) {
    throw error;
  }
});
