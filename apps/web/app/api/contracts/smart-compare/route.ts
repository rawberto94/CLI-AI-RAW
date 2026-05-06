/**
 * Smart Contract Comparison API (AI-powered semantic comparison)
 * POST /api/contracts/smart-compare — Clause-level AI comparison with risk analysis
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postSmartContractsCompare } from '@/lib/contracts/server/compare';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  return postSmartContractsCompare(request, ctx);
});
