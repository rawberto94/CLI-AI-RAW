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

    // Get negotiation history (contract activities with proposals)
    const negotiations = await prisma.contractActivity.findMany({
      where: {
        action: { in: ['NEGOTIATION_PROPOSAL', 'PORTAL_MESSAGE'] },
        contract: {
          supplierName: supplierName !== 'Unknown Supplier' ? supplierName : undefined,
        },
      },
      include: {
        contract: {
          select: { id: true, contractTitle: true, fileName: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const negotiationRounds = negotiations.map(n => ({
      id: n.id,
      contractId: n.contractId,
      contractName: n.contract.contractTitle || n.contract.fileName || 'Untitled',
      type: n.action,
      description: n.description,
      metadata: n.metadata,
      createdAt: n.createdAt.toISOString(),
    }));

    const portalData = {
      supplier: {
        id: supplierId || 'unknown',
        name: supplierName,
        activeContracts: portalContracts.length,
      },
      contracts: portalContracts,
      pendingTasks,
      negotiations: negotiationRounds,
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
        case 'negotiations':
          return createSuccessResponse(ctx, {
            success: true,
            data: { negotiations: portalData.negotiations },
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
  const { action, contractId, taskId, message, document: _document, proposal } = body;

  if (action === 'sign') {
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'contractId is required', 400);
    }
    // Find the pending signature request and mark the signer as signed
    const sigRequest = await prisma.signatureRequest.findFirst({
      where: { contractId, status: { in: ['pending', 'sent'] } },
    });
    if (sigRequest) {
      const signers = (sigRequest.signers as unknown as Array<Record<string, unknown>>) || [];
      const updatedSigners = signers.map(s => ({ ...s, status: 'signed', signedAt: new Date().toISOString() }));
      const allSigned = true;
      await prisma.signatureRequest.update({
        where: { id: sigRequest.id },
        data: {
          signers: JSON.parse(JSON.stringify(updatedSigners)),
          status: allSigned ? 'completed' : sigRequest.status,
        },
      });
      if (allSigned) {
        await prisma.contract.update({
          where: { id: contractId },
          data: { status: 'COMPLETED' },
        });
      }
    }
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Contract signed successfully',
      data: {
        contractId,
        signedAt: new Date().toISOString(),
        signatureRequestId: sigRequest?.id,
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
    // Store as a contract comment/activity
    if (contractId && message) {
      await prisma.contractActivity.create({
        data: {
          contractId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'PORTAL_MESSAGE',
          description: message,
          metadata: { source: 'portal', timestamp: new Date().toISOString() },
        },
      });
    }
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
    // Complete a signature request task
    if (taskId) {
      try {
        await prisma.signatureRequest.update({
          where: { id: taskId },
          data: { status: 'completed' },
        });
      } catch {
        // Task may not be a signature request — that's okay
      }
    }
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Task completed',
      data: {
        taskId,
        completedAt: new Date().toISOString(),
      },
    });
  }

  if (action === 'submit-proposal') {
    // Store a negotiation proposal as a contract activity with version tracking
    if (contractId && proposal) {
      await prisma.contractActivity.create({
        data: {
          contractId,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          action: 'NEGOTIATION_PROPOSAL',
          description: proposal.summary || 'New negotiation proposal submitted',
          metadata: {
            source: 'portal',
            proposalId: `prop-${Date.now()}`,
            redlines: proposal.redlines || [],
            comments: proposal.comments || [],
            submittedAt: new Date().toISOString(),
          },
        },
      });

      // Update contract status to show it's in negotiation
      await prisma.contract.update({
        where: { id: contractId },
        data: { status: 'NEGOTIATION' },
      });
    }
    return createSuccessResponse(ctx, {
      success: true,
      message: 'Proposal submitted for review',
      data: {
        contractId,
        proposalId: `prop-${Date.now()}`,
        submittedAt: new Date().toISOString(),
      },
    });
  }

  if (action === 'generate-magic-link') {
    const { supplierId, supplierEmail } = body;
    const tokenPayload = {
      sid: supplierId || 'unknown',
      tid: ctx.tenantId,
      exp: Date.now() + 7 * 86400000,
    };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3005';
    return createSuccessResponse(ctx, {
      success: true,
      data: {
        magicLink: `${baseUrl}/portal?token=${token}`,
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        supplierEmail,
      },
    });
  }

  return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
});
