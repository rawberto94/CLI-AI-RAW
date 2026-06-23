import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractTagRecommendations } from '@/lib/contracts/server/metadata';

/**
 * GET /api/contracts/[id]/metadata/tags/recommend
 * Returns internal tag recommendations for a contract using metadata and tenant usage patterns.
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit') || 8);
  const limit = Number.isFinite(limitParam) ? limitParam : 8;

  return getContractTagRecommendations(ctx, contractId, limit);
});
