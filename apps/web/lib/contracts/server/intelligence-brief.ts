import { NextRequest } from 'next/server';

import {
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

async function getTenantOwnedContractId(contractId: string, tenantId: string) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, isDeleted: false },
    select: { id: true },
  });

  return contract?.id || null;
}

export async function getContractIntelligenceBrief(
  request: NextRequest,
  context: ContractApiContext,
) {
  const contractId = request.nextUrl.searchParams.get('contractId');
  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'contractId is required', 400);
  }

  const tenantId = context.tenantId;
  const ownedContractId = await getTenantOwnedContractId(contractId, tenantId);
  if (!ownedContractId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  try {
    const artifact = (await prisma.artifact.findUnique({
      where: {
        contractId_tenantId_type: {
          contractId: ownedContractId,
          tenantId,
          type: 'INTELLIGENCE_BRIEF',
        },
      } as any,
    })) as any;

    if (!artifact) {
      return createSuccessResponse(context, { brief: null, status: 'not_generated' });
    }

    return createSuccessResponse(context, {
      brief: artifact?.content?.brief || null,
      comparisons: artifact?.content?.comparisons || [],
      generatedAt: artifact?.content?.generatedAt || null,
      model: artifact?.content?.model || null,
      processingTime: artifact?.content?.processingTime || null,
      status: 'ready',
    });
  } catch {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to fetch intelligence brief', 500);
  }
}

export async function postContractIntelligenceBrief(
  request: NextRequest,
  context: ContractApiContext,
) {
  const body = await request.json();
  const { contractId } = body;

  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'contractId is required', 400);
  }

  const tenantId = context.tenantId;
  const ownedContractId = await getTenantOwnedContractId(contractId, tenantId);
  if (!ownedContractId) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  try {
    const { runIntelligencePipeline } = await import('@/lib/ai/intelligence-brief.service');
    const result = await runIntelligencePipeline({ contractId: ownedContractId, tenantId });

    if (!result.success) {
      return createErrorResponse(
        context,
        'PROCESSING_ERROR',
        result.error || 'Intelligence brief generation failed',
        500,
      );
    }

    return createSuccessResponse(context, {
      brief: result.brief,
      status: 'generated',
    });
  } catch {
    return createErrorResponse(context, 'INTERNAL_ERROR', 'Failed to generate intelligence brief', 500);
  }
}