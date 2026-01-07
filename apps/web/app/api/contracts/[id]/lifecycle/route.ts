/**
 * API: Update Contract Lifecycle
 * Allows marking a contract as NEW (requires approval) or EXISTING (reference only)
 * 
 * POST /api/contracts/[id]/lifecycle
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { requiresApprovalWorkflow, getContractLifecycle } from '@/lib/contract-helpers';
import { queueRAGReindex } from '@/lib/rag/reindex-helper';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await getTenantIdFromRequest(request);
    const contractId = params.id;
    const body = await request.json();
    
    const { documentRole, isNewContract, metadata } = body;

    // Validate documentRole
    const validRoles = ['NEW_CONTRACT', 'EXISTING', 'AMENDMENT', 'RENEWAL', null];
    if (documentRole && !validRoles.includes(documentRole)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid documentRole. Must be one of: ${validRoles.filter(r => r).join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Get contract
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

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
      if (contract.status === 'DRAFT') {
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

    // Update contract
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: updateData,
    });

    // Determine new lifecycle and workflow requirement
    const lifecycle = getContractLifecycle(updatedContract);
    const needsApproval = requiresApprovalWorkflow(updatedContract);

    // Queue RAG re-indexing when lifecycle/status changes
    await queueRAGReindex({
      contractId,
      tenantId: tenantId || undefined,
      reason: 'lifecycle/status updated',
    });

    return NextResponse.json({
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
    console.error('Error updating contract lifecycle:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update contract lifecycle' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tenantId = await getTenantIdFromRequest(request);
    const contractId = params.id;

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
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    const lifecycle = getContractLifecycle(contract);
    const requiresApproval = requiresApprovalWorkflow(contract);

    return NextResponse.json({
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
    console.error('Error fetching contract lifecycle:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contract lifecycle' },
      { status: 500 }
    );
  }
}
