import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { deleteContractTag } from '@/lib/contracts/server/metadata';

/**
 * DELETE /api/contracts/[id]/metadata/tags/[tagName]
 * Remove a tag from a contract
 */
export const DELETE = withContractApiHandler(async (request: NextRequest, ctx) => {
  const params = await (ctx as any).params as { id: string; tagName: string };
  return deleteContractTag(ctx, params.id, params.tagName);
})
