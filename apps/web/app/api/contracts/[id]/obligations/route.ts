/**
 * Contract Obligations API
 * 
 * GET /api/contracts/[id]/obligations - Get obligation summary for a contract
 */

import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractObligations } from '@/lib/contracts/server/obligations';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/[id]/obligations
 * Get obligation summary for a specific contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractObligations(ctx, contractId);
})
