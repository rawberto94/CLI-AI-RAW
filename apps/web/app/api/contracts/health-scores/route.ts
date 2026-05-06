/**
 * Contract Health Scores API
 * GET /api/contracts/health-scores - Get health scores from dedicated table
 * POST /api/contracts/health-scores - Trigger recalculation for specific contracts
 * 
 * Uses the ContractHealthScore table for fast querying
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractHealthScores,
  postContractHealthScores,
} from '@/lib/contracts/server/lifecycle-monitoring';

export const dynamic = 'force-dynamic';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractHealthScores(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractHealthScores(request, ctx);
});
