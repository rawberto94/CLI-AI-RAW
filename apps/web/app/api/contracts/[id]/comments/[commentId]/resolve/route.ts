import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import { resolveContractCommentForContract } from '@/lib/contracts/server/comments';

export const dynamic = 'force-dynamic';

/**
 * POST /api/contracts/:id/comments/:commentId/resolve
 * Mark a comment as resolved
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, commentId } = await (ctx as any).params as { id: string; commentId: string };

  return resolveContractCommentForContract(ctx, contractId, commentId);
});
