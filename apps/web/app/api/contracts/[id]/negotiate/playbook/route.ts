import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getNegotiationPlaybook,
  postNegotiationPlaybook,
} from '@/lib/contracts/server/negotiation';

/**
 * GET /api/contracts/[id]/negotiate/playbook
 * Fetch existing negotiation playbook for a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getNegotiationPlaybook(ctx, contractId);
})

/**
 * POST /api/contracts/[id]/negotiate/playbook
 * Generate a new AI negotiation playbook
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postNegotiationPlaybook(request, ctx, contractId);
})
