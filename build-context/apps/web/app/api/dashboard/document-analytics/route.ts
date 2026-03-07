/**
 * Document Classification Analytics API
 * Returns historical trends for document types and signature status over time
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';

interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

function getDateRanges(period: string): DateRange[] {
  const now = new Date();
  const ranges: DateRange[] = [];

  switch (period) {
    case 'week':
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        ranges.push({
          start: date,
          end,
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        });
      }
      break;

    case 'month':
      // Last 30 days grouped by week
      for (let i = 4; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(end.getDate() - (i * 7));
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        ranges.push({
          start,
          end,
          label: `Week ${5 - i}`,
        });
      }
      break;

    case 'quarter':
      // Last 3 months
      for (let i = 2; i >= 0; i--) {
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ranges.push({
          start,
          end,
          label: start.toLocaleDateString('en-US', { month: 'short' }),
        });
      }
      break;

    case 'year':
    default:
      // Last 12 months
      for (let i = 11; i >= 0; i--) {
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ranges.push({
          start,
          end,
          label: start.toLocaleDateString('en-US', { month: 'short' }),
        });
      }
      break;
  }

  return ranges;
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const tenantId = ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'year';

  const cacheKey = `dashboard:document-analytics:${tenantId}:${period}`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  const dateRanges = getDateRanges(period);

  // Get all contracts with their dates and classification
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: {
      id: true,
      uploadedAt: true,
      documentClassification: true,
      signatureStatus: true,
      aiMetadata: true,
    },
  });

  // Document type categories
  const nonContractTypes = ['purchase_order', 'invoice', 'quote', 'proposal', 'work_order', 'letter_of_intent', 'memorandum'];

  // Initialize trend data structure
  const trends = dateRanges.map(range => ({
    label: range.label,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    total: 0,
    contracts: 0,
    nonContracts: 0,
    signed: 0,
    unsigned: 0,
    partialSigned: 0,
    // Detailed breakdown
    documentTypes: {
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
    } as Record<string, number>,
  }));

  // Process each contract into time buckets
  for (const contract of contracts) {
    const uploadDate = contract.uploadedAt ? new Date(contract.uploadedAt) : null;
    if (!uploadDate) continue;

    // Find which range this contract belongs to
    const rangeIndex = dateRanges.findIndex(
      range => uploadDate >= range.start && uploadDate <= range.end
    );
    if (rangeIndex === -1) continue;

    const trend = trends[rangeIndex];
    trend.total++;

    // Get document classification
    let docType = (contract as any).documentClassification;
    if (!docType || docType === 'unknown') {
      const metadata = contract.aiMetadata as Record<string, any> | null;
      docType = metadata?.document_classification || 'contract';
    }
    const normalizedDocType = docType?.toLowerCase().replace(/\s+/g, '_') || 'contract';

    // Count document types
    if (normalizedDocType in trend.documentTypes) {
      trend.documentTypes[normalizedDocType]++;
    } else {
      trend.documentTypes.unknown++;
    }

    // Count contracts vs non-contracts
    if (nonContractTypes.includes(normalizedDocType)) {
      trend.nonContracts++;
    } else {
      trend.contracts++;
    }

    // Get signature status
    let sigStatus = (contract as any).signatureStatus;
    if (!sigStatus || sigStatus === 'unknown') {
      const metadata = contract.aiMetadata as Record<string, any> | null;
      sigStatus = metadata?.signature_status || 'unknown';
    }
    const normalizedSigStatus = sigStatus?.toLowerCase().replace(/\s+/g, '_') || 'unknown';

    if (normalizedSigStatus === 'signed') {
      trend.signed++;
    } else if (normalizedSigStatus === 'unsigned') {
      trend.unsigned++;
    } else if (normalizedSigStatus === 'partially_signed') {
      trend.partialSigned++;
    }
  }

  // Calculate cumulative totals
  let cumulativeContracts = 0;
  let cumulativeNonContracts = 0;
  let cumulativeSigned = 0;
  let cumulativeUnsigned = 0;

  const cumulativeTrends = trends.map(trend => {
    cumulativeContracts += trend.contracts;
    cumulativeNonContracts += trend.nonContracts;
    cumulativeSigned += trend.signed;
    cumulativeUnsigned += trend.unsigned + trend.partialSigned;

    return {
      ...trend,
      cumulative: {
        contracts: cumulativeContracts,
        nonContracts: cumulativeNonContracts,
        signed: cumulativeSigned,
        unsigned: cumulativeUnsigned,
        total: cumulativeContracts + cumulativeNonContracts,
      },
    };
  });

  // Calculate summary statistics
  const totalDocuments = contracts.length;
  const totalContracts = contracts.filter(c => {
    const docType = (c as any).documentClassification || 
      (c.aiMetadata as Record<string, any>)?.document_classification || 'contract';
    return !nonContractTypes.includes(docType?.toLowerCase().replace(/\s+/g, '_'));
  }).length;
  const totalNonContracts = totalDocuments - totalContracts;

  const signedCount = contracts.filter(c => {
    const status = (c as any).signatureStatus || 
      (c.aiMetadata as Record<string, any>)?.signature_status;
    return status === 'signed';
  }).length;

  // Calculate growth rates (compare last period to previous)
  const lastPeriod = cumulativeTrends[cumulativeTrends.length - 1];
  const prevPeriod = cumulativeTrends[cumulativeTrends.length - 2];
  
  const growthRate = prevPeriod && prevPeriod.total > 0
    ? ((lastPeriod.total - prevPeriod.total) / prevPeriod.total) * 100
    : 0;

  const contractGrowthRate = prevPeriod && prevPeriod.contracts > 0
    ? ((lastPeriod.contracts - prevPeriod.contracts) / prevPeriod.contracts) * 100
    : 0;

  const data = {
    period,
    trends: cumulativeTrends,
    summary: {
      totalDocuments,
      totalContracts,
      totalNonContracts,
      signedCount,
      unsignedCount: totalDocuments - signedCount,
      contractPercentage: totalDocuments > 0 ? (totalContracts / totalDocuments) * 100 : 100,
      signedPercentage: totalDocuments > 0 ? (signedCount / totalDocuments) * 100 : 0,
      growthRate: Math.round(growthRate * 10) / 10,
      contractGrowthRate: Math.round(contractGrowthRate * 10) / 10,
    },
    // Top document types for the entire period
    topDocumentTypes: Object.entries(
      contracts.reduce((acc, c) => {
        const docType = (c as any).documentClassification || 
          (c.aiMetadata as Record<string, any>)?.document_classification || 'contract';
        const normalized = docType?.toLowerCase().replace(/\s+/g, '_') || 'contract';
        acc[normalized] = (acc[normalized] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count, percentage: (count / totalDocuments) * 100 })),
  };
  await setCached(cacheKey, data, 300);
  return createSuccessResponse(ctx, data);
});
