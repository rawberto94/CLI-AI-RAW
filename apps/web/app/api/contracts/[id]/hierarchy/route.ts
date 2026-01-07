/**
 * Contract Hierarchy API
 * PUT /api/contracts/[id]/hierarchy - Link to parent contract
 * DELETE /api/contracts/[id]/hierarchy - Unlink from parent contract
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant-server";
import { publishRealtimeEvent } from "@/lib/realtime/publish";
import { queueRAGReindex } from "@/lib/rag/reindex-helper";

export const runtime = "nodejs";

// Link contract to a parent
export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }
    
    const body = await req.json();
    const { parentContractId, relationshipType, relationshipNote } = body;
    
    if (!parentContractId) {
      return NextResponse.json(
        { error: "Parent contract ID is required" },
        { status: 400 }
      );
    }
    
    // Verify both contracts exist and belong to the same tenant
    const [contract, parentContract] = await Promise.all([
      prisma.contract.findFirst({
        where: { id: contractId, tenantId },
      }),
      prisma.contract.findFirst({
        where: { id: parentContractId, tenantId },
      }),
    ]);
    
    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }
    
    if (!parentContract) {
      return NextResponse.json(
        { error: "Parent contract not found" },
        { status: 404 }
      );
    }
    
    // Prevent self-linking
    if (contractId === parentContractId) {
      return NextResponse.json(
        { error: "Contract cannot be linked to itself" },
        { status: 400 }
      );
    }
    
    // Prevent circular references - check if parent is already a child of this contract
    const wouldCreateCycle = await checkForCycle(contractId, parentContractId, tenantId);
    if (wouldCreateCycle) {
      return NextResponse.json(
        { error: "This link would create a circular reference" },
        { status: 400 }
      );
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
    
    console.log(`[Hierarchy API] Linked contract ${contractId} to parent ${parentContractId}`);

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
    
    return NextResponse.json({
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
    console.error("[Hierarchy API] Error linking contracts:", error);
    return NextResponse.json(
      { error: "Failed to link contracts" },
      { status: 500 }
    );
  }
}

// Unlink contract from parent
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
    }
    
    // Verify contract exists
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
    });
    
    if (!contract) {
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }
    
    if (!contract.parentContractId) {
      return NextResponse.json(
        { error: "Contract is not linked to a parent" },
        { status: 400 }
      );
    }
    
    // Remove the parent reference
    const updatedContract = await prisma.contract.update({
      where: { id: contractId },
      data: {
        parentContractId: null,
        relationshipType: null,
        relationshipNote: null,
        linkedAt: null,
      },
    });
    
    console.log(`[Hierarchy API] Unlinked contract ${contractId} from parent`);

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
    
    return NextResponse.json({
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
    console.error("[Hierarchy API] Error unlinking contract:", error);
    return NextResponse.json(
      { error: "Failed to unlink contract" },
      { status: 500 }
    );
  }
}

// GET - Get hierarchy information
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const contractId = params.id;
    const tenantId = await getServerTenantId();
    
    if (!contractId) {
      return NextResponse.json(
        { error: "Contract ID is required" },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: "Contract not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
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
    console.error("[Hierarchy API] Error getting hierarchy:", error);
    return NextResponse.json(
      { error: "Failed to get contract hierarchy" },
      { status: 500 }
    );
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
