import { NextRequest } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

type RelatedContractItem = {
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
};

type ContractCard = {
  id: string;
  fileName: string | null;
  contractTitle: string | null;
  status: string | null;
  contractType: string | null;
  clientName: string | null;
  totalValue: unknown;
  currency: string | null;
  expirationDate: Date | null;
  relationshipType?: string | null;
};

function mapContractCard(
  contract: ContractCard,
  relationshipType: RelatedContractItem['relationshipType'],
  similarity?: number,
): RelatedContractItem {
  return {
    id: contract.id,
    filename: contract.contractTitle || contract.fileName || 'Untitled',
    status: (contract.status || 'unknown').toLowerCase(),
    contractType: contract.contractType || undefined,
    clientName: contract.clientName || undefined,
    totalValue: contract.totalValue ? Number(contract.totalValue) : undefined,
    currency: contract.currency || undefined,
    expirationDate: contract.expirationDate?.toISOString(),
    relationshipType,
    ...(similarity ? { similarity } : {}),
  };
}

function appendUniqueContract(
  relatedContracts: RelatedContractItem[],
  contract: RelatedContractItem,
) {
  if (!relatedContracts.find((existing) => existing.id === contract.id)) {
    relatedContracts.push(contract);
  }
}

export async function getRelatedContracts(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  const tenantId = context.tenantId;
  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const clientName = request.nextUrl.searchParams.get('clientName');
  const categoryId = request.nextUrl.searchParams.get('categoryId');
  const limit = Math.min(
    Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') || '5', 10) || 5),
    200,
  );

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
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const relatedContracts: RelatedContractItem[] = [];

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
    const relationshipType = child.relationshipType?.toLowerCase();
    appendUniqueContract(
      relatedContracts,
      mapContractCard(
        child,
        relationshipType === 'renewal'
          ? 'renewal'
          : relationshipType === 'amendment'
            ? 'amendment'
            : 'similar',
      ),
    );
  }

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

    if (parent) {
      appendUniqueContract(relatedContracts, mapContractCard(parent, 'similar'));
    }
  }

  const effectiveClientName = clientName || currentContract.clientName;
  if (effectiveClientName && relatedContracts.length < limit) {
    const clientWhereConditions: Array<
      { clientId?: string } | { clientName: { contains: string; mode: 'insensitive' } }
    > = [];

    if (currentContract.clientId) {
      clientWhereConditions.push({ clientId: currentContract.clientId });
    }

    clientWhereConditions.push({
      clientName: {
        contains: effectiveClientName,
        mode: 'insensitive',
      },
    });

    const sameClientContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        id: { not: contractId },
        NOT: { id: { in: relatedContracts.map((contract) => contract.id) } },
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
      appendUniqueContract(relatedContracts, mapContractCard(contract, 'same-client'));
    }
  }

  const effectiveCategoryId = categoryId || currentContract.contractCategoryId;
  if (effectiveCategoryId && relatedContracts.length < limit) {
    const sameCategoryContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        id: { not: contractId },
        NOT: { id: { in: relatedContracts.map((contract) => contract.id) } },
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
      appendUniqueContract(relatedContracts, mapContractCard(contract, 'same-category'));
    }
  }

  if (currentContract.contractType && relatedContracts.length < limit) {
    const similarTypeContracts = await prisma.contract.findMany({
      where: {
        tenantId,
        isDeleted: false,
        id: { not: contractId },
        NOT: { id: { in: relatedContracts.map((contract) => contract.id) } },
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
      appendUniqueContract(relatedContracts, mapContractCard(contract, 'similar', 75));
    }
  }

  return createSuccessResponse(context, {
    contracts: relatedContracts.slice(0, limit),
    total: relatedContracts.length,
  });
}