import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractVersions,
  postContractVersion,
  putContractVersion,
} from '@/lib/contracts/server/versions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/contracts/:id/versions
 * Get all versions of a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractVersions(ctx, contractId);
});

/**
 * POST /api/contracts/:id/versions
 * Create a new version of a contract
 * 
 * Accepts either:
 * - FormData with file upload (multipart/form-data)
 * - JSON with metadata-only version (application/json)
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractVersion(request, ctx, contractId);
});

/**
 * PUT /api/contracts/:id/versions
 * Activate a specific version (revert)
 */
export const PUT = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractVersion(request, ctx, contractId);
});
