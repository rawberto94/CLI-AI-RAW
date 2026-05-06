import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

function daysUntil(dateValue: string | Date | null | undefined) {
  if (!dateValue) {
    return null;
  }

  return Math.ceil(
    (new Date(dateValue).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
}

export async function getContractRenewalDetails(
  context: ContractApiContext,
  contractId: string,
) {
  try {
    const tenantId = context.tenantId;

    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true, expirationDate: true },
    });

    if (!contract) {
      return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
    }

    const artifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        tenantId,
        type: 'RENEWAL',
      },
    });

    if (!artifact) {
      return createSuccessResponse(context, {
        success: true,
        contractId,
        contractName: contract.contractTitle || 'Unnamed Contract',
        hasRenewalArtifact: false,
        expirationDate: contract.expirationDate?.toISOString() || null,
        daysUntilExpiry: daysUntil(contract.expirationDate),
        message: 'No renewal artifact found. Run AI analysis to extract renewal terms.',
      });
    }

    const data = artifact.data as any;
    const daysUntilTermEnd = daysUntil(data.currentTermEnd);
    const daysUntilOptOut = daysUntil(data.renewalTerms?.optOutDeadline);
    const alerts: Array<{ type: string; message: string; date: string | null }> = [];

    if (daysUntilOptOut !== null && daysUntilOptOut > 0 && daysUntilOptOut <= 30) {
      alerts.push({
        type: daysUntilOptOut <= 7 ? 'critical' : daysUntilOptOut <= 14 ? 'warning' : 'info',
        message: `Opt-out deadline in ${daysUntilOptOut} days`,
        date: data.renewalTerms?.optOutDeadline || null,
      });
    }

    if (daysUntilTermEnd !== null && daysUntilTermEnd > 0 && daysUntilTermEnd <= 60) {
      alerts.push({
        type: daysUntilTermEnd <= 14 ? 'critical' : daysUntilTermEnd <= 30 ? 'warning' : 'info',
        message: `Contract term ends in ${daysUntilTermEnd} days`,
        date: data.currentTermEnd || null,
      });
    }

    return createSuccessResponse(context, {
      success: true,
      contractId,
      contractName: contract.contractTitle || 'Unnamed Contract',
      hasRenewalArtifact: true,
      summary: data.summary,
      autoRenewal: data.autoRenewal,
      currentTermEnd: data.currentTermEnd,
      daysUntilTermEnd,
      renewalTerms: data.renewalTerms,
      daysUntilOptOut,
      terminationNotice: data.terminationNotice,
      priceEscalation: data.priceEscalation || [],
      optOutDeadlines: data.optOutDeadlines || [],
      renewalAlerts: data.renewalAlerts || [],
      alerts,
      renewalCount: data.renewalCount,
      certainty: data.certainty,
    });
  } catch (error) {
    return handleApiError(context, error);
  }
}