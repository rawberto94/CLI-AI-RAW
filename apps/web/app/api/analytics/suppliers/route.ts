import { NextRequest } from 'next/server';
import { getDataProviderFactory } from 'data-orchestration';
import { DataMode } from 'data-orchestration/types';
import { withAuthApiHandler, createSuccessResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

/**
 * Supplier Analytics API Endpoints
 * Supports both real and mock data modes
 */

// GET /api/analytics/suppliers - Get supplier analytics overview
export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const supplierId = searchParams.get('supplierId');
  const timeframe = searchParams.get('timeframe') || '12months';
  const metrics = searchParams.get('metrics')?.split(',');
  
  // Check for data mode parameter
  const dataMode = searchParams.get('mode') as 'real' | 'mock' | null;
  const mode = dataMode === 'mock' ? DataMode.MOCK : 
               dataMode === 'real' ? DataMode.REAL : 
               DataMode.REAL;

  // Use data provider system
  const factory = getDataProviderFactory();
  const response = await factory.getData('supplier-analytics', {
    supplierId: supplierId || undefined,
    timeframe,
    metrics
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
