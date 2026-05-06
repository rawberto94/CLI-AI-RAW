/**
 * Contract Summarization API
 * 
 * POST /api/contracts/[id]/summarize
 * 
 * Generates a comprehensive AI-powered summary of a contract including:
 * - Executive overview
 * - Key points and highlights
 * - Party obligations
 * - Financial terms
 * - Key dates and deadlines
 * - Risk assessment
 * - Recommendations
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractSummary } from '@/lib/contracts/server/analysis';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postContractSummary(request, ctx, contractId);
});
