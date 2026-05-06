/**
 * Custom AI Analysis API
 * 
 * POST /api/contracts/[id]/analyze
 * 
 * Allows users to ask custom questions about a contract
 * or use pre-built analysis templates.
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractAnalysisTemplateCatalog,
  postContractCustomAnalysis,
} from '@/lib/contracts/server/analysis';

// ============================================================================
// POST - Custom Analysis
// ============================================================================

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postContractCustomAnalysis(request, ctx, contractId);
});

// ============================================================================
// GET - Get Available Templates
// ============================================================================

export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  return getContractAnalysisTemplateCatalog(ctx);
});
