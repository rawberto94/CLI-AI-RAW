/**
 * Contract Artifacts API
 * GET /api/contracts/[id]/artifacts - Get all artifacts for a contract
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ArtifactService with automatic caching
 * - Type-safe with consistent error handling
 */

import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractArtifacts } from '@/lib/contracts/server/artifacts';

export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractArtifacts(request, ctx, contractId);
});
