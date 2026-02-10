/**
 * Contract Hierarchy API
 * PUT /api/contracts/[id]/hierarchy - Link to parent contract
 * DELETE /api/contracts/[id]/hierarchy - Unlink from parent contract
 */

import { prisma } from "@/lib/prisma";
import { contractService } from 'data-orchestration/services';
import { getServerTenantId } from "@/lib/tenant-server";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { queueRAGReindex } from "@/lib/rag/reindex-helper";
import { getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export const runtime = "nodejs";

// Link contract to a parent
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(req);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }
    
    const body = await req.json();
    const { parentContractId, relationshipType, relationshipNote } = body;
    
    if (!parentContractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Parent contract ID is required', 400);
    }
    
    // Verify both contracts exist and belong to the same tenant via service layer
    const [contractResult, parentResult] = await Promise.all([
      contractService.getContract(contractId, tenantId!),
      contractService.getContract(parentContractId, tenantId!),
    ]);

    const contract = contractResult.data;
    const parentContract = parentResult.data;
    
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    if (!parentContract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Parent contract not found', 404);
    }
    
    // Prevent self-linking
    if (contractId === parentContractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract cannot be linked to itself', 400);
    }
    
    // Prevent circular references - check if parent is already a child of this contract
    const wouldCreateCycle = await checkForCycle(contractId, parentContractId, tenantId);
    if (wouldCreateCycle) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'This link would create a circular reference', 400);
    }
    
    // Update the contract with parent reference
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        parentContractId,
        relationshipType: relationshipType || 'OTHER',
        relationshipNote: relationshipNote || null,
        linkedAt: new Date(),
      },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            clientName: true,
            supplierName: true,
            effectiveDate: true,
            expirationDate: true,
          },
        },
      },
    });

    await publishRealtimeEvent({
      event: "contract:updated",
      data: {
        tenantId,
        contractId,
        parentContractId,
      },
      source: "api:contracts/[id]/hierarchy",
    });

    // Queue RAG re-indexing when hierarchy changes
    await queueRAGReindex({
      contractId,
      tenantId: tenantId || undefined,
      reason: 'hierarchy relationship linked',
    });
    
    return createSuccessResponse(ctx, {
      success: true,
      contract: {
        id: updatedContract.id,
        parentContractId: updatedContract.parentContractId,
        relationshipType: updatedContract.relationshipType,
        relationshipNote: updatedContract.relationshipNote,
        linkedAt: updatedContract.linkedAt?.toISOString(),
        parentContract: updatedContract.parentContract ? {
          id: updatedContract.parentContract.id,
          title: updatedContract.parentContract.contractTitle || 'Untitled',
          type: updatedContract.parentContract.contractType,
          status: updatedContract.parentContract.status,
          clientName: updatedContract.parentContract.clientName,
          supplierName: updatedContract.parentContract.supplierName,
          effectiveDate: updatedContract.parentContract.effectiveDate?.toISOString(),
          expirationDate: updatedContract.parentContract.expirationDate?.toISOString(),
        } : null,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// Unlink contract from parent
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(req);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }
    
    // Verify contract exists via service layer
    const contractResult = await contractService.getContract(contractId, tenantId!);
    const contract = contractResult.data;
    
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    if (!contract.parentContractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract is not linked to a parent', 400);
    }
    
    // Remove the parent reference via service layer
    const updateResult = await contractService.updateContract(contractId, tenantId!, {
      parentContractId: null,
      relationshipType: null,
      relationshipNote: null,
      linkedAt: null,
    } as any);
    const updatedContract = updateResult.data;

    await publishRealtimeEvent({
      event: "contract:updated",
      data: {
        tenantId,
        contractId,
        parentContractId: null,
      },
      source: "api:contracts/[id]/hierarchy",
    });

    // Queue RAG re-indexing when hierarchy changes
    await queueRAGReindex({
      contractId,
      tenantId: tenantId || undefined,
      reason: 'hierarchy relationship unlinked',
    });
    
    return createSuccessResponse(ctx, {
      success: true,
      contract: {
        id: updatedContract.id,
        parentContractId: null,
        relationshipType: null,
        relationshipNote: null,
        linkedAt: null,
      },
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// GET - Get hierarchy information
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getApiContext(req);
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }
    
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: {
        parentContract: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            clientName: true,
            supplierName: true,
            effectiveDate: true,
            expirationDate: true,
          },
        },
        childContracts: {
          select: {
            id: true,
            contractTitle: true,
            contractType: true,
            status: true,
            relationshipType: true,
            clientName: true,
            supplierName: true,
            effectiveDate: true,
            expirationDate: true,
            totalValue: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    
    if (!contract) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
    }
    
    return createSuccessResponse(ctx, {
      contractId: contract.id,
      parentContractId: contract.parentContractId,
      relationshipType: contract.relationshipType,
      relationshipNote: contract.relationshipNote,
      linkedAt: contract.linkedAt?.toISOString(),
      parentContract: contract.parentContract ? {
        id: contract.parentContract.id,
        title: contract.parentContract.contractTitle || 'Untitled',
        type: contract.parentContract.contractType,
        status: contract.parentContract.status,
        clientName: contract.parentContract.clientName,
        supplierName: contract.parentContract.supplierName,
        effectiveDate: contract.parentContract.effectiveDate?.toISOString(),
        expirationDate: contract.parentContract.expirationDate?.toISOString(),
      } : null,
      childContracts: contract.childContracts?.map((child) => ({
        id: child.id,
        title: child.contractTitle || 'Untitled',
        type: child.contractType,
        status: child.status,
        relationshipType: child.relationshipType,
        clientName: child.clientName,
        supplierName: child.supplierName,
        effectiveDate: child.effectiveDate?.toISOString(),
        expirationDate: child.expirationDate?.toISOString(),
        totalValue: child.totalValue,
        createdAt: child.createdAt?.toISOString(),
      })) || [],
    });
  } catch (error) {
    return handleApiError(ctx, error);
  }
}

// Helper function to check for circular references
async function checkForCycle(
  contractId: string, 
  potentialParentId: string, 
  tenantId: string
): Promise<boolean> {
  // Walk up the ancestor chain of the potential parent
  // If we find the current contract, we have a cycle
  let currentId: string | null = potentialParentId;
  const visited = new Set<string>();
  
  while (currentId) {
    if (visited.has(currentId)) {
      // Already visited, break to avoid infinite loop
      break;
    }
    visited.add(currentId);
    
    if (currentId === contractId) {
      // Found the contract in the ancestor chain - would create a cycle
      return true;
    }
    
    const parent = await prisma.contract.findFirst({
      where: { id: currentId, tenantId },
      select: { parentContractId: true },
    });
    
    currentId = parent?.parentContractId || null;
  }
  
  return false;
}
