/**
 * Contract Renewal API
 * 
 * GET /api/contracts/[id]/renewal - Get renewal details for a contract
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractRenewalDetails } from '@/lib/contracts/server/renewal';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/[id]/renewal
 * Get renewal details for a specific contract
 */
export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return getContractRenewalDetails(ctx, contractId);
})
