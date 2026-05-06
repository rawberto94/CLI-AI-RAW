import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  deleteContractArtifact,
  getContractArtifact,
  putContractArtifact,
} from '@/lib/contracts/server/artifacts';

/**
 * GET /api/contracts/[id]/artifacts/[artifactId]
 * Get a specific artifact
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return getContractArtifact(ctx, contractId, artifactId);
})

/**
 * PUT /api/contracts/[id]/artifacts/[artifactId]
 * Update an artifact
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return putContractArtifact(request, ctx, contractId, artifactId);
})

/**
 * DELETE /api/contracts/[id]/artifacts/[artifactId]
 * Delete an artifact
 */
export const DELETE = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId, artifactId } = await (ctx as any).params as { id: string; artifactId: string };

  return deleteContractArtifact(ctx, contractId, artifactId);
})
