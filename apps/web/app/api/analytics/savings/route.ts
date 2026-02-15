import { NextRequest } from 'next/server';
import { getDataProviderFactory } from 'data-orchestration';
import { DataMode } from 'data-orchestration/types';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';
import { getCached, setCached } from '@/lib/cache';

/**
 * Savings Pipeline API Endpoints
 * Savings pipeline data endpoints
 */

// GET /api/analytics/savings - Get savings pipeline data
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '12months';
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  
  const tenantId = ctx.tenantId;
  const cacheKey = `analytics:savings:${tenantId}:${timeframe}:${category}:${status}`;
  const cached = await getCached(cacheKey);
  if (cached) return createSuccessResponse(ctx, cached);

  // Use data provider system
  const factory = getDataProviderFactory();
  const response = await factory.getData('savings-pipeline', {
    timeframe,
    category: category || undefined,
    status: status || undefined
  }, DataMode.REAL);

  const data = {
    data: response.data,
    metadata: {
      source: response.metadata.source,
      mode: response.metadata.mode,
      lastUpdated: response.metadata.lastUpdated,
      confidence: response.metadata.confidence
    },
    timestamp: new Date().toISOString()
  };
  await setCached(cacheKey, data, 300);
  return createSuccessResponse(ctx, data);
});

// POST /api/analytics/savings/opportunities - Create new savings opportunity
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { title, category, potentialSavings, probability, timeToRealize: _timeToRealize } = body;
  
  // Save to database
  const tenantId = ctx.tenantId;
  
  const opportunity = await prisma.costSavingsOpportunity.create({
    data: {
      tenantId,
      title,
      category: category || 'general',
      potentialSavingsAmount: potentialSavings || 0,
      confidence: probability || 'medium',
      status: 'IDENTIFIED',
      priority: 1,
      description: body.description || '',
      contractId: body.contractId || null,
    } as any
  });
  
  return createSuccessResponse(ctx, {
    id: opportunity.id,
    title: opportunity.title,
    category: opportunity.category,
    potentialSavings: opportunity.potentialSavingsAmount,
    probability: opportunity.confidence,
    status: opportunity.status.toLowerCase(),
    createdAt: opportunity.createdAt.toISOString()
  });
});
