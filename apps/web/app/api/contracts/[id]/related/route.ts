/**
 * Related Contracts API
 * GET /api/contracts/[id]/related - Get related contracts based on various criteria
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID required' },
        { status: 401 }
      );
    }
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get('clientName');
    const categoryId = searchParams.get('categoryId');
    const limit = parseInt(searchParams.get('limit') || '5');
    
    // Get the current contract
    const currentContract = await prisma.contract.findFirst({
      where: {
        id: contractId,
        tenantId,
        isDeleted: false,
      },
      select: {
        id: true,
        clientId: true,
        clientName: true,
        supplierId: true,
        supplierName: true,
        contractCategoryId: true,
        parentContractId: true,
        contractType: true,
      },
    });
    
    if (!currentContract) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }
    
    const relatedContracts: Array<{
      id: string;
      filename: string;
      status: string;
      contractType?: string;
      clientName?: string;
      totalValue?: number;
      currency?: string;
      expirationDate?: string;
      similarity?: number;
      relationshipType: 'similar' | 'same-client' | 'same-category' | 'amendment' | 'renewal';
    }> = [];
    
    // 1. Get child contracts (amendments, renewals)
    const childContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        parentContractId: contractId,
        isDeleted: false,
      },
      select: {
        id: true,
        fileName: true,
        contractTitle: true,
        status: true,
        contractType: true,
        clientName: true,
        totalValue: true,
        currency: true,
        expirationDate: true,
        relationshipType: true,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    
    for (const child of childContracts) {
      const relType = child.relationshipType?.toLowerCase();
      relatedContracts.push({
        id: child.id,
        filename: child.contractTitle || child.fileName || 'Untitled',
        status: child.status || 'unknown',
        contractType: child.contractType || undefined,
        clientName: child.clientName || undefined,
        totalValue: child.totalValue ? Number(child.totalValue) : undefined,
        currency: child.currency || undefined,
        expirationDate: child.expirationDate?.toISOString(),
        relationshipType: relType === 'renewal' ? 'renewal' : relType === 'amendment' ? 'amendment' : 'similar',
      });
    }
    
    // 2. Get parent contract
    if (currentContract.parentContractId) {
      const parent = await prisma.contract.findFirst({
        where: {
          id: currentContract.parentContractId,
          tenantId,
          isDeleted: false,
        },
        select: {
          id: true,
          fileName: true,
          contractTitle: true,
          status: true,
          contractType: true,
          clientName: true,
          totalValue: true,
          currency: true,
          expirationDate: true,
          relationshipType: true,
        },
      });
      
      if (parent && !relatedContracts.find(c => c.id === parent.id)) {
        relatedContracts.push({
          id: parent.id,
          filename: parent.contractTitle || parent.fileName || 'Untitled',
          status: parent.status || 'unknown',
          contractType: parent.contractType || undefined,
          clientName: parent.clientName || undefined,
          totalValue: parent.totalValue ? Number(parent.totalValue) : undefined,
          currency: parent.currency || undefined,
          expirationDate: parent.expirationDate?.toISOString(),
          relationshipType: 'similar',
        });
      }
    }
    
    // 3. Get same-client contracts (if we have a client)
    const effectiveClientName = clientName || currentContract.clientName;
    if (effectiveClientName && relatedContracts.length < limit) {
      const clientWhereConditions = [];
      if (currentContract.clientId) {
        clientWhereConditions.push({ clientId: currentContract.clientId });
      }
      clientWhereConditions.push({ 
        clientName: { 
          contains: effectiveClientName, 
          mode: 'insensitive' as const 
        } 
      });
      
      const sameClientContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          isDeleted: false,
          id: { not: contractId },
          NOT: { id: { in: relatedContracts.map(c => c.id) } },
          OR: clientWhereConditions,
        },
        select: {
          id: true,
          fileName: true,
          contractTitle: true,
          status: true,
          contractType: true,
          clientName: true,
          totalValue: true,
          currency: true,
          expirationDate: true,
        },
        take: limit - relatedContracts.length,
        orderBy: { createdAt: 'desc' },
      });
      
      for (const contract of sameClientContracts) {
        if (!relatedContracts.find(c => c.id === contract.id)) {
          relatedContracts.push({
            id: contract.id,
            filename: contract.contractTitle || contract.fileName || 'Untitled',
            status: contract.status || 'unknown',
            contractType: contract.contractType || undefined,
            clientName: contract.clientName || undefined,
            totalValue: contract.totalValue ? Number(contract.totalValue) : undefined,
            currency: contract.currency || undefined,
            expirationDate: contract.expirationDate?.toISOString(),
            relationshipType: 'same-client',
          });
        }
      }
    }
    
    // 4. Get same-category contracts
    const effectiveCategoryId = categoryId || currentContract.contractCategoryId;
    if (effectiveCategoryId && relatedContracts.length < limit) {
      const sameCategoryContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          isDeleted: false,
          id: { not: contractId },
          NOT: { id: { in: relatedContracts.map(c => c.id) } },
          contractCategoryId: effectiveCategoryId,
        },
        select: {
          id: true,
          fileName: true,
          contractTitle: true,
          status: true,
          contractType: true,
          clientName: true,
          totalValue: true,
          currency: true,
          expirationDate: true,
        },
        take: limit - relatedContracts.length,
        orderBy: { createdAt: 'desc' },
      });
      
      for (const contract of sameCategoryContracts) {
        if (!relatedContracts.find(c => c.id === contract.id)) {
          relatedContracts.push({
            id: contract.id,
            filename: contract.contractTitle || contract.fileName || 'Untitled',
            status: contract.status || 'unknown',
            contractType: contract.contractType || undefined,
            clientName: contract.clientName || undefined,
            totalValue: contract.totalValue ? Number(contract.totalValue) : undefined,
            currency: contract.currency || undefined,
            expirationDate: contract.expirationDate?.toISOString(),
            relationshipType: 'same-category',
          });
        }
      }
    }
    
    // 5. Get contracts with similar type if still need more
    if (currentContract.contractType && relatedContracts.length < limit) {
      const similarTypeContracts = await prisma.contract.findMany({
        where: {
          tenantId,
          isDeleted: false,
          id: { not: contractId },
          NOT: { id: { in: relatedContracts.map(c => c.id) } },
          contractType: currentContract.contractType,
        },
        select: {
          id: true,
          fileName: true,
          contractTitle: true,
          status: true,
          contractType: true,
          clientName: true,
          totalValue: true,
          currency: true,
          expirationDate: true,
        },
        take: limit - relatedContracts.length,
        orderBy: { createdAt: 'desc' },
      });
      
      for (const contract of similarTypeContracts) {
        if (!relatedContracts.find(c => c.id === contract.id)) {
          relatedContracts.push({
            id: contract.id,
            filename: contract.contractTitle || contract.fileName || 'Untitled',
            status: contract.status || 'unknown',
            contractType: contract.contractType || undefined,
            clientName: contract.clientName || undefined,
            totalValue: contract.totalValue ? Number(contract.totalValue) : undefined,
            currency: contract.currency || undefined,
            expirationDate: contract.expirationDate?.toISOString(),
            relationshipType: 'similar',
            similarity: 75, // Basic similarity score for same type
          });
        }
      }
    }
    
    return NextResponse.json({
      contracts: relatedContracts.slice(0, limit),
      total: relatedContracts.length,
    });
    
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch related contracts' },
      { status: 500 }
    );
  }
}
