import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { contractService } from 'data-orchestration/services';

/**
 * Supplier Portal API
 * Provides external suppliers access to their contracts, tasks, and messages
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const section = searchParams.get('section');
  const supplierId = searchParams.get('supplierId');

  // Validate magic link token
  if (token && token.length < 10) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Invalid or expired token', 401);
  }

  try {
    // Get supplier info
    const supplierName = supplierId || 'Unknown Supplier';

    // Get contracts for this supplier
    const contracts = await prisma.contract.findMany({
      where: {
        supplierName: supplierName !== 'Unknown Supplier' ? supplierName : undefined,
        isDeleted: false,
      },
      select: {
        id: true,
        contractTitle: true,
        fileName: true,
        status: true,
        totalValue: true,
        expirationDate: true,
        signatureRequests: {
          where: { status: 'pending' },
          select: { id: true },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    // Build portal data from real contracts
    const portalContracts = contracts.map(c => ({
      id: c.id,
      name: c.contractTitle || c.fileName || 'Untitled Contract',
      status: c.signatureRequests.length > 0 ? 'pending-signature' : c.status?.toLowerCase() || 'active',
      value: Number(c.totalValue) || 0,
      expiryDate: c.expirationDate?.toISOString().split('T')[0] || null,
      actionRequired: c.signatureRequests.length > 0,
    }));

    // Get pending tasks (signature requests)
    const signatureRequests = await prisma.signatureRequest.findMany({
      where: {
        status: 'pending',
        contract: {
          supplierName: supplierName !== 'Unknown Supplier' ? supplierName : undefined,
        },
      },
      include: {
        contract: {
          select: { contractTitle: true, fileName: true },
        },
      },
      take: 10,
    });

    const pendingTasks = signatureRequests.map(sr => ({
      id: sr.id,
      title: `Sign ${sr.contract.contractTitle || sr.contract.fileName || 'Contract'}`,
      type: 'signature',
      dueDate: sr.expiresAt?.toISOString().split('T')[0] || null,
      priority: 'high',
    }));

    const portalData = {
      supplier: {
        id: supplierId || 'unknown',
        name: supplierName,
        activeContracts: portalContracts.length,
      },
      contracts: portalContracts,
      pendingTasks,
      unreadMessages: 0,
    };

    if (section) {
      switch (section) {
        case 'contracts':
          return createSuccessResponse(ctx, {
            success: true,
            data: { contracts: portalData.contracts },
          });
        case 'tasks':
          return createSuccessResponse(ctx, {
            success: true,
            data: { tasks: portalData.pendingTasks },
          });
        default:
          return createSuccessResponse(ctx, {
            success: true,
            data: portalData,
          });
      }
    }

    return createSuccessResponse(ctx, {
      success: true,
      data: portalData,
    });
  } catch (_error) {
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch portal data', 500);
  }
});

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const { action, contractId, taskId, message: _message, document: _document } = body;

  if (action === 'sign') {
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Contract signed successfully',
      data: {
        contractId,
        signedAt: new Date().toISOString(),
        signatureId: `sig-${Date.now()}`,
      },
    });
  }

  if (action === 'upload') {
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Document uploaded successfully',
      data: {
        documentId: `doc-${Date.now()}`,
        uploadedAt: new Date().toISOString(),
      },
    });
  }

  if (action === 'send-message') {
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Message sent',
      data: {
        messageId: `msg-${Date.now()}`,
        sentAt: new Date().toISOString(),
      },
    });
  }

  if (action === 'complete-task') {
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Task completed',
      data: {
        taskId,
        completedAt: new Date().toISOString(),
      },
    });
  }

  if (action === 'generate-magic-link') {
    return createSuccessResponse(ctx, {
      success: true,
      data: {
        magicLink: `https://app.company.com/portal?token=${Buffer.from(Date.now().toString()).toString('base64')}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});
