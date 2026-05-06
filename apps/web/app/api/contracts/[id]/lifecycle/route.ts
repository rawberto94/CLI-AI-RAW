/**
 * API: Update Contract Lifecycle
 * Allows marking a contract as NEW (requires approval) or EXISTING (reference only)
 * 
 * POST /api/contracts/[id]/lifecycle
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractLifecycleState,
  postContractLifecycle,
} from '@/lib/contracts/server/lifecycle';

export const dynamic = 'force-dynamic';

export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractLifecycle(request, ctx, contractId);
});

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractLifecycleState(ctx, contractId);
});
