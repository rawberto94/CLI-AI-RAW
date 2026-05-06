import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractArtifactRegenerationStatus,
  postContractArtifactByIdRegeneration,
} from '@/lib/contracts/server/artifacts';

/**
 * POST /api/contracts/[id]/artifacts/[artifactId]/regenerate
 * 
 * Regenerate a specific artifact for a contract
 * Used for error recovery and manual regeneration
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return postContractArtifactByIdRegeneration(ctx, contractId, artifactId);
});
/**
 * GET /api/contracts/[id]/artifacts/[artifactId]/regenerate
 * 
 * Get regeneration status
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return getContractArtifactRegenerationStatus(ctx, contractId, artifactId);
});
