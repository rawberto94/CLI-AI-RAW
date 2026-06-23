/**
 * Tag Recommendations API
 * GET /api/tags/recommend?contractId=X&limit=5
 * 
 * Returns AI-recommended tags for a contract based on its metadata,
 * content, and similar contracts in the tenant.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { getTenantTagRegistry } from '@/lib/contracts/server/tag-registry';

interface TagRecommendation {
  name: string;
  confidence: number;
  reason: string;
}

/**
 * GET /api/tags/recommend
 * Get recommended tags for a contract
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
  }

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '5') || 5), 20);

  if (!contractId) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  // Fetch the contract
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId, isDeleted: false },
    select: {
      id: true,
      contractTitle: true,
      contractType: true,
      status: true,
      categoryL1: true,
      totalValue: true,
      currency: true,
      startDate: true,
      endDate: true,
      clientName: true,
      supplierName: true,
      metadata: { select: { tags: true } },
      aiMetadata: { select: { confidence: true } },
    },
  });

  if (!contract) {
    return createErrorResponse(ctx, 'NOT_FOUND', 'Contract not found', 404);
  }

  const recommendations: TagRecommendation[] = [];
  const recommendationMap = new Map<string, { confidence: number; reasons: string[] }>();

  // Get all tags in tenant registry
  const tagRegistry = await getTenantTagRegistry(tenantId);

  // Rule 1: By contract status
  if (contract.status) {
    const statusMap: Record<string, { tag: string; confidence: number }> = {
      draft: { tag: 'draft', confidence: 0.95 },
      pending_signature: { tag: 'pending-signature', confidence: 0.95 },
      pending_execution: { tag: 'pending-execution', confidence: 0.9 },
      executed: { tag: 'executed', confidence: 0.95 },
      terminated: { tag: 'terminated', confidence: 0.9 },
      expired: { tag: 'expired', confidence: 0.95 },
    };

    const statusRecommendation = statusMap[contract.status.toLowerCase()];
    if (statusRecommendation) {
      const key = statusRecommendation.tag.toLowerCase();
      const existing = recommendationMap.get(key);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, statusRecommendation.confidence);
        existing.reasons.push(`Status: ${contract.status}`);
      } else {
        recommendationMap.set(key, {
          confidence: statusRecommendation.confidence,
          reasons: [`Status: ${contract.status}`],
        });
      }
    }
  }

  // Rule 2: By contract type
  if (contract.contractType) {
    const typeRecommendation = {
      tag: contract.contractType.toLowerCase(),
      confidence: 0.85,
    };
    const key = typeRecommendation.tag.toLowerCase();
    const existing = recommendationMap.get(key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, typeRecommendation.confidence);
      existing.reasons.push(`Type: ${contract.contractType}`);
    } else {
      recommendationMap.set(key, {
        confidence: typeRecommendation.confidence,
        reasons: [`Type: ${contract.contractType}`],
      });
    }
  }

  // Rule 3: By category
  if (contract.categoryL1) {
    const key = `category-${contract.categoryL1.toLowerCase()}`;
    const existing = recommendationMap.get(key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, 0.7);
      existing.reasons.push(`Category: ${contract.categoryL1}`);
    } else {
      recommendationMap.set(key, {
        confidence: 0.7,
        reasons: [`Category: ${contract.categoryL1}`],
      });
    }
  }

  // Rule 4: By value
  if (contract.totalValue !== null && contract.totalValue !== undefined) {
    if (contract.totalValue > 1000000) {
      const key = 'high-value';
      const existing = recommendationMap.get(key);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, 0.8);
        existing.reasons.push(`High value contract (${contract.currency} ${contract.totalValue})`);
      } else {
        recommendationMap.set(key, {
          confidence: 0.8,
          reasons: [`High value contract`],
        });
      }
    }
  }

  // Rule 5: By expiration
  if (contract.endDate) {
    const now = new Date();
    const endDate = new Date(contract.endDate);
    const daysUntilExpiry = Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) {
      const key = 'expired';
      const existing = recommendationMap.get(key);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, 0.9);
      } else {
        recommendationMap.set(key, {
          confidence: 0.9,
          reasons: [`Contract expired ${Math.abs(daysUntilExpiry)} days ago`],
        });
      }
    } else if (daysUntilExpiry < 30) {
      const key = 'expiring-soon';
      const existing = recommendationMap.get(key);
      if (existing) {
        existing.confidence = Math.max(existing.confidence, 0.85);
        existing.reasons.push(`Expires in ${daysUntilExpiry} days`);
      } else {
        recommendationMap.set(key, {
          confidence: 0.85,
          reasons: [`Expires in ${daysUntilExpiry} days`],
        });
      }
    }
  }

  // Rule 6: By party (client/supplier)
  if (contract.clientName && contract.clientName.length > 0) {
    const key = `client-${contract.clientName.toLowerCase().replace(/\s+/g, '-')}`;
    const existing = recommendationMap.get(key);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, 0.4);
    } else {
      recommendationMap.set(key, {
        confidence: 0.4,
        reasons: [`Client: ${contract.clientName}`],
      });
    }
  }

  // Convert map to array, sort by confidence, and limit
  const sorted = Array.from(recommendationMap.entries())
    .map(([tagName, data]) => ({
      name: tagName,
      confidence: data.confidence,
      reason: data.reasons[0] || 'AI recommendation',
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);

  return createSuccessResponse(ctx, {
    success: true,
    data: {
      recommendations: sorted,
      total: sorted.length,
      contractId,
    },
  });
});
