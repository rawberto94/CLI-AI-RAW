import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postCancelUpload } from '@/lib/contracts/server/cancel-upload';

/**
 * POST /api/contracts/:id/cancel-upload
 * Abort in-flight processing and delete the leftover contract so a later
 * upload of the same file is a fresh v1, not a new version of a ghost.
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return postCancelUpload(request, ctx, contractId);
});
