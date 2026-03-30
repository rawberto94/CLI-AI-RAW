import { NextRequest } from 'next/server';
import { getDataProviderFactory } from 'data-orchestration';
import { DataMode } from 'data-orchestration/types';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * Negotiation Preparation API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/negotiation - Get negotiation preparation data
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get('contractId');
  const supplierId = searchParams.get('supplierId');
  const category = searchParams.get('category');
  
  // Always use real data
  const mode = DataMode.REAL;

  // Use data provider system
  const factory = getDataProviderFactory();
  const response = await factory.getData('negotiation-prep', {
    contractId: contractId || undefined,
    supplierId: supplierId || undefined,
    category: category || undefined
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

// POST /api/analytics/negotiation/generate-pack - Generate negotiation pack
export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { contractId, supplierId, category } = body;
  
  const mode = DataMode.REAL;

  const factory = getDataProviderFactory();
  const response = await factory.getData('negotiation-prep', {
    contractId,
    supplierId,
    category
  }, mode);

  return createSuccessResponse(ctx, {
    data: response.data,
    metadata: response.metadata,
    timestamp: new Date().toISOString()
  });
});
