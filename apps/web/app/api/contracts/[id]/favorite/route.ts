import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractFavorite, postContractFavorite } from '@/lib/contracts/server/details';

/**
 * POST /api/contracts/[id]/favorite
 * Toggle favorite status for a contract
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractFavorite(request, ctx, contractId);
});

/**
 * GET /api/contracts/[id]/favorite
 * Check if a contract is favorited by the current user
 */
export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractFavorite(ctx, contractId);
});
