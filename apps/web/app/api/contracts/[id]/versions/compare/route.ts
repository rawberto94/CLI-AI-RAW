import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractVersionComparison } from '@/lib/contracts/server/versions';

/**
 * GET /api/contracts/:id/versions/compare
 * Compare two versions of a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractVersionComparison(request, ctx, contractId);
});
