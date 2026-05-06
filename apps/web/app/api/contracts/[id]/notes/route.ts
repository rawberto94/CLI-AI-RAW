import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractNotes, postContractNote } from '@/lib/contracts/server/comments';

/**
 * GET /api/contracts/[id]/notes
 * Get all notes for a contract
 */
export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractNotes(ctx, contractId);
});

/**
 * POST /api/contracts/[id]/notes
 * Create a new note for a contract
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractNote(request, ctx, contractId);
});
