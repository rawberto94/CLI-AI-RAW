/**
 * Contract Comparison API
 * Compare multiple contracts and find differences
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractsCompare } from '@/lib/contracts/server/compare';

export const dynamic = 'force-dynamic';

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractsCompare(request, ctx);
});
