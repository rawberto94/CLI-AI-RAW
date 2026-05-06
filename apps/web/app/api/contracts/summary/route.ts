import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/api-middleware';
import { getContractsSummary } from '@/lib/contracts/server/summary';

/**
 * GET /api/contracts/summary
 * Returns a summary of contracts for the dashboard
 */
export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractsSummary(ctx);
});
