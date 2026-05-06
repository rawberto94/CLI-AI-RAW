/**
 * Related Contracts API
 * GET /api/contracts/[id]/related - Get related contracts based on various criteria
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getRelatedContracts } from '@/lib/contracts/server/related';

export const runtime = 'nodejs';

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return getRelatedContracts(request, ctx, contractId);
});
