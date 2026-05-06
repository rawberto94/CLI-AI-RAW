/**
 * Contract Details API - Simplified for Frontend
 * GET /api/contracts/[id]/details - Get contract with artifacts in frontend format
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractFrontendDetails } from '@/lib/contracts/server/details';

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractFrontendDetails(ctx, contractId);
});
