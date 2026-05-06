import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractTags } from '@/lib/contracts/server/metadata';

/**
 * POST /api/contracts/[id]/metadata/tags
 * Add tags to a contract
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postContractTags(request, ctx, contractId);
})
