/**
 * Artifact Regeneration API Route
 * 
 * Regenerates specific artifacts by type.
 * Reads contract text from database (no longer requires client to send it).
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { postContractArtifactRegeneration } from '@/lib/contracts/server/artifacts';

/**
 * POST /api/contracts/[id]/artifacts/regenerate
 * Regenerate specific artifact type
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractArtifactRegeneration(request, ctx, contractId);
});
