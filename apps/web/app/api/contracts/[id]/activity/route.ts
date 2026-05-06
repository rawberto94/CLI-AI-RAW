import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import { getContractActivity } from '@/lib/contracts/server/activity';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/:id/activity
 * Get activity feed for a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractActivity(ctx, contractId);
});
