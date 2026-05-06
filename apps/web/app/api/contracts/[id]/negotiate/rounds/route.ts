import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getNegotiationRounds,
  postNegotiationRound,
} from '@/lib/contracts/server/negotiation';

/**
 * GET /api/contracts/[id]/negotiate/rounds
 * Fetch all negotiation rounds for a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getNegotiationRounds(ctx, contractId);
});

/**
 * POST /api/contracts/[id]/negotiate/rounds
 * Create a new negotiation round or update an existing one
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postNegotiationRound(request, ctx, contractId);
});
