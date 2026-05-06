import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import {
  getContractCommentsForContract,
  postContractCommentForContract,
} from '@/lib/contracts/server/comments';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/:id/comments
 * Get all comments for a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractCommentsForContract(ctx, contractId);
});

/**
 * POST /api/contracts/:id/comments
 * Add a new comment to a contract
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractCommentForContract(request, ctx, contractId);
});
