/**
 * API: Update Contract Lifecycle
 * Allows marking a contract as NEW (requires approval) or EXISTING (reference only)
 * 
 * POST /api/contracts/[id]/lifecycle
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { requiresApprovalWorkflow, getContractLifecycle } from '@/lib/contract-helpers';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getTenantIdFromRequest(request);
    const { id: contractId } = await context.params;
    const body = await request.json();
    
    const { documentRole, isNewContract, metadata } = body;

    // Validate documentRole
    const validRoles = ['NEW_CONTRACT', 'EXISTING', 'AMENDMENT', 'RENEWAL', null];
    if (documentRole && !validRoles.includes(documentRole)) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid documentRole. Must be one of: ${validRoles.filter(r => r).join(', ')}`, 400);
    }

    // Get contract via service layer
    const contractResult = await contractService.getContract(contractId, tenantId!);

    if (!contractResult.success || !contractResult.data) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    // The data-orchestration Contract type is missing some Prisma fields (metadata, extended statuses).
    // Cast to include them since the actual DB row has these fields.
    const contract = contractResult.data as typeof contractResult.data & {
      metadata?: Record<string, unknown>;
      status: string;
    };

    // Prepare update data
    const updateData: any = {};
    
    if (documentRole !== undefined) {
      updateData.documentRole = documentRole;
    }
    
    // If marking as new contract, set status to DRAFT
    if (isNewContract === true || documentRole === 'NEW_CONTRACT') {
      updateData.status = 'DRAFT';
      updateData.documentRole = 'NEW_CONTRACT';
      updateData.metadata = {
        ...contract.metadata as object,
        isNewContract: true,
        markedAsNewAt: new Date().toISOString(),
      };
    }
    
    // If marking as existing, ensure proper status
    if (isNewContract === false || documentRole === 'EXISTING') {
      updateData.documentRole = 'EXISTING';
      updateData.metadata = {
        ...contract.metadata as object,
        isNewContract: false,
        markedAsExistingAt: new Date().toISOString(),
      };
      // If status is DRAFT, change to ACTIVE (existing contracts should be active)
      // The Prisma ContractStatus enum includes DRAFT, but the Zod schema is narrower
      if ((contract.status as string) === 'DRAFT') {
        updateData.status = 'ACTIVE';
      }
    }
    
    // Merge additional metadata
    if (metadata) {
      updateData.metadata = {
        ...updateData.metadata || contract.metadata as object,
        ...metadata,
      };
    }

    // Update contract via service layer
    const updateResult = await contractService.updateContract(contractId, tenantId!, updateData);

    if (!updateResult.success || !updateResult.data) {
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to update contract', 500);
    }

    const updatedContract = updateResult.data as typeof updateResult.data & {
      metadata?: Record<string, unknown>;
      status: string;
    };

    // Determine new lifecycle and workflow requirement
    const lifecycle = getContractLifecycle(updatedContract);
    const needsApproval = requiresApprovalWorkflow(updatedContract);

    // Queue RAG re-indexing when lifecycle/status changes
    if (tenantId) {
      await queueRAGReindex({
        contractId,
        tenantId,
        reason: 'lifecycle/status updated',
      });
    }

    return createSuccessResponse(ctx, {
      success: true,
      contract: {
        id: updatedContract.id,
        status: updatedContract.status,
        documentRole: updatedContract.documentRole,
        lifecycle,
        requiresApproval: needsApproval,
      },
      message: needsApproval 
        ? 'Contract marked as new - approval workflow can now be initiated'
        : 'Contract marked as existing - no approval workflow required',
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  try {
    const tenantId = await getTenantIdFromRequest(request);
    const { id: contractId } = await context.params;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: {
        id: true,
        status: true,
        documentRole: true,
        metadata: true,
        effectiveDate: true,
        expirationDate: true,
        totalValue: true,
      },
    });

    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }

    const lifecycle = getContractLifecycle(contract);
    const requiresApproval = requiresApprovalWorkflow(contract);

    return createSuccessResponse(ctx, {
      success: true,
      contract: {
        id: contract.id,
        status: contract.status,
        documentRole: contract.documentRole,
        lifecycle,
        requiresApproval,
        metadata: contract.metadata,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}
