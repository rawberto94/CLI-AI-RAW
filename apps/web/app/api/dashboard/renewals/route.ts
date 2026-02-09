/**
 * Dashboard Renewals API
 * GET /api/dashboard/renewals - Get upcoming contract renewals from real database
 * 
 * Fully integrated with actual contract data - no mock fallback
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Safe constants for pagination bounds
const MAX_DAYS = 365;
const DEFAULT_DAYS = 90;
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 10;

function safeParsePaginationParams(searchParams: URLSearchParams) {
  const rawDays = Number(searchParams.get("days"));
  const rawLimit = Number(searchParams.get("limit"));
  
  const days = Math.min(MAX_DAYS, Math.max(1, isNaN(rawDays) ? DEFAULT_DAYS : Math.floor(rawDays)));
  const limit = Math.min(MAX_LIMIT, Math.max(1, isNaN(rawLimit) ? DEFAULT_LIMIT : Math.floor(rawLimit)));
  
  return { days, limit };
}

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const { days, limit } = safeParsePaginationParams(searchParams);
  
  const tenantId = ctx.tenantId;
  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  
  // Query contracts with upcoming expiration dates
  const renewals = await prisma.contract.findMany({
    where: {
      tenantId,
      OR: [
        // Contracts with endDate in the future within range
        {
          endDate: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // Include recently expired
            lte: futureDate
          }
        },
        // Contracts with expirationDate in the future within range
        {
          expirationDate: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            lte: futureDate
          }
        }
      ],
      status: { in: ['COMPLETED', 'ACTIVE', 'PROCESSING'] }
    },
    include: {
      artifacts: {
        where: { type: { in: ['OVERVIEW', 'FINANCIAL'] } },
        select: { type: true, data: true },
      },
    },
    orderBy: [
      { endDate: 'asc' },
      { expirationDate: 'asc' }
    ],
    take: limit
  });
  
  // Transform to renewal format
  const renewalData = renewals.map(contract => {
    const expiryDate = contract.endDate || contract.expirationDate;
    const daysUntilExpiry = expiryDate 
      ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    // Extract value from contract or artifacts
    let contractValue = contract.totalValue ? Number(contract.totalValue) : null;
    const financialArtifact = contract.artifacts.find(a => a.type === 'FINANCIAL');
    if (!contractValue && financialArtifact?.data) {
      const financialData = financialArtifact.data as any;
      contractValue = financialData.totalValue || financialData.contractValue || null;
    }

    // Extract contract type from contract or artifacts
    let contractType = contract.contractType || contract.category;
    const overviewArtifact = contract.artifacts.find(a => a.type === 'OVERVIEW');
    if (!contractType && overviewArtifact?.data) {
      const overviewData = overviewArtifact.data as any;
      contractType = overviewData.contractType || null;
    }
      
    return {
      id: contract.id,
      name: contract.contractTitle || contract.originalName || contract.fileName,
      type: contractType || 'Unknown',
      endDate: expiryDate?.toISOString() || null,
      startDate: (contract.startDate || contract.effectiveDate)?.toISOString() || null,
      daysUntilExpiry,
      priority: daysUntilExpiry !== null && daysUntilExpiry <= 0 ? 'expired' as const :
               daysUntilExpiry !== null && daysUntilExpiry <= 30 ? 'urgent' as const : 
               daysUntilExpiry !== null && daysUntilExpiry <= 60 ? 'high' as const : 'medium' as const,
      value: contractValue,
      supplier: contract.supplierName || null,
    };
  });

  // Sort by urgency (expired first, then by days)
  renewalData.sort((a, b) => {
    const aDays = a.daysUntilExpiry ?? 999;
    const bDays = b.daysUntilExpiry ?? 999;
    return aDays - bDays;
  });
  
  // Stats for dashboard widget
  const stats = {
    total: renewalData.length,
    expired: renewalData.filter(r => r.daysUntilExpiry !== null && r.daysUntilExpiry < 0).length,
    urgent: renewalData.filter(r => r.daysUntilExpiry !== null && r.daysUntilExpiry >= 0 && r.daysUntilExpiry <= 30).length,
    high: renewalData.filter(r => r.daysUntilExpiry !== null && r.daysUntilExpiry > 30 && r.daysUntilExpiry <= 60).length,
    medium: renewalData.filter(r => r.daysUntilExpiry !== null && r.daysUntilExpiry > 60).length,
    withoutDates: await prisma.contract.count({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'ACTIVE'] },
        endDate: null,
        expirationDate: null,
      }
    }),
  };
  
  return createSuccessResponse(ctx, {
    renewals: renewalData,
    stats,
    meta: { 
      source: 'database',
      tenantId,
      daysQueried: days,
      timestamp: now.toISOString(),
    }
  });
});
