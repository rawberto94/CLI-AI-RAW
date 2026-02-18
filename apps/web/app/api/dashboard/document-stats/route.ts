/**
 * Document Statistics API
 * Returns document classification and signature status statistics
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;

  const cacheKey = `dashboard:document-stats:${tenantId}`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  // Get all contracts with their classification and signature status
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: {
      id: true,
      documentClassification: true,
      signatureStatus: true,
      aiMetadata: true,
    },
  });

  // Initialize counters
  const documentTypes: Record<string, number> = {
    contract: 0,
    purchase_order: 0,
    invoice: 0,
    quote: 0,
    proposal: 0,
    work_order: 0,
    letter_of_intent: 0,
    memorandum: 0,
    amendment: 0,
    addendum: 0,
    unknown: 0,
  };

  const signatureStatus: Record<string, number> = {
    signed: 0,
    partially_signed: 0,
    unsigned: 0,
    unknown: 0,
  };

  // Process each contract
  for (const contract of contracts) {
    let docType = (contract as any).documentClassification;
    let sigStatus = (contract as any).signatureStatus;

    if (!docType || docType === 'unknown') {
      const metadata = contract.aiMetadata as Record<string, any> | null;
      docType = metadata?.document_classification || 'contract';
    }

    if (!sigStatus || sigStatus === 'unknown') {
      const metadata = contract.aiMetadata as Record<string, any> | null;
      sigStatus = metadata?.signature_status || 'unknown';
    }

    const normalizedDocType = docType?.toLowerCase().replace(/\s+/g, '_') || 'contract';
    const normalizedSigStatus = sigStatus?.toLowerCase().replace(/\s+/g, '_') || 'unknown';

    if (normalizedDocType in documentTypes) {
      documentTypes[normalizedDocType]++;
    } else {
      documentTypes.unknown++;
    }

    if (normalizedSigStatus in signatureStatus) {
      signatureStatus[normalizedSigStatus]++;
    } else {
      signatureStatus.unknown++;
    }
  }

  const totalDocuments = contracts.length;
  const nonContractTypes = ['purchase_order', 'invoice', 'quote', 'proposal', 'work_order', 'letter_of_intent', 'memorandum'];
  const nonContractCount = nonContractTypes.reduce((sum, type) => sum + documentTypes[type], 0);
  const unsignedCount = signatureStatus.unsigned + signatureStatus.partially_signed;

  const documentTypesArray = Object.entries(documentTypes)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalDocuments > 0 ? (count / totalDocuments) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const signatureStatusArray = Object.entries(signatureStatus)
    .map(([status, count]) => ({
      status,
      count,
    }));

  const data = {
    documentTypes: documentTypesArray,
    signatureStatus: signatureStatusArray,
    totalDocuments,
    nonContractCount,
    unsignedCount,
    summary: {
      contractPercentage: totalDocuments > 0 
        ? ((totalDocuments - nonContractCount) / totalDocuments) * 100 
        : 100,
      signedPercentage: totalDocuments > 0 
        ? (signatureStatus.signed / totalDocuments) * 100 
        : 0,
      needsAttention: nonContractCount + unsignedCount,
    },
  };
  await setCached(cacheKey, data, { ttl: 300 });
  return createSuccessResponse(ctx, data);
});
