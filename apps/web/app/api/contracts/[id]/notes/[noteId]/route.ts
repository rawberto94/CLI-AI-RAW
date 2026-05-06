import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { deleteContractNote, getContractNote, patchContractNote } from '@/lib/contracts/server/comments';

/**
 * GET /api/contracts/[id]/notes/[noteId]
 * Get a single note
 */
export const GET = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId, noteId } = await (ctx as any).params as { id: string; noteId: string };

  return getContractNote(ctx, contractId, noteId);
});

/**
 * PATCH /api/contracts/[id]/notes/[noteId]
 * Update a note (content, pin status)
 */
export const PATCH = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, noteId } = await (ctx as any).params as { id: string; noteId: string };

  return patchContractNote(request, ctx, contractId, noteId);
});

/**
 * DELETE /api/contracts/[id]/notes/[noteId]
 * Delete a note
 */
export const DELETE = withContractApiHandler(async (_request: NextRequest, ctx) => {
  const { id: contractId, noteId } = await (ctx as any).params as { id: string; noteId: string };

  return deleteContractNote(ctx, contractId, noteId);
});
