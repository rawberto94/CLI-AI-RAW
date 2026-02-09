import { NextRequest } from 'next/server';
import { getDataProviderFactory } from 'data-orchestration';
import { DataMode } from 'data-orchestration/types';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';
import { analyticsService } from 'data-orchestration/services';

/**
 * Savings Pipeline API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/savings - Get savings pipeline data
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const timeframe = searchParams.get('timeframe') || '12months';
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  
  // Check for data mode parameter
  const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
  const mode = dataMode === 'mock' ? DataMode.MOCK : 
               dataMode === 'real' ? DataMode.REAL : 
               DataMode.REAL;

  // Use data provider system
  const factory = getDataProviderFactory();
  const response = await factory.getData('savings-pipeline', {
    timeframe,
    category: category || undefined,
    status: status || undefined
  }, mode);

  return createSuccessResponse(ctx, {
    data: response.data,
    metadata: {
      source: response.metadata.source,
      mode: response.metadata.mode,
      lastUpdated: response.metadata.lastUpdated,
      confidence: response.metadata.confidence
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/analytics/savings/opportunities - Create new savings opportunity
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { title, category, potentialSavings, probability, timeToRealize: _timeToRealize } = body;
  
  // For now, this only works with real data
  // Mock mode would just return the input as confirmation
  const dataMode = body.mode;
  
  if (dataMode === 'mock') {
    return createSuccessResponse(ctx, {
      id: `OPP${Math.floor(Math.random() * 1000)}`,
      ...body,
      status: 'identified',
      createdAt: new Date().toISOString(),
      _metadata: {
        source: 'mock-data-generator',
        mode: 'mock'
      },
    });
  }

  // Real implementation - save to database
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
