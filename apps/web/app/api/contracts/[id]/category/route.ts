/**
 * Contract Category API
 * 
 * Handles category assignment, AI categorization, and feedback tracking.
 * Supports the learning loop for improving categorization accuracy.
 */

import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractCategory,
  putContractCategory,
  postContractCategory,
} from '@/lib/contracts/server/category';

/**
 * GET /api/contracts/[id]/category
 * Get current category and suggested alternatives
 */
export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractCategory(ctx, contractId);
});

/**
 * PUT /api/contracts/[id]/category
 * Update contract category (manual or from suggestions)
 * Tracks feedback for learning loop
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractCategory(request, ctx, contractId);
});

/**
 * POST /api/contracts/[id]/category
 * Trigger AI re-categorization
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractCategory(request, ctx, contractId);
});
