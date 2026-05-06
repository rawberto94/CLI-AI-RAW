/**
 * Contract Details API
 * GET /api/contracts/[id] - Get contract with artifacts and processing status
 *
 * ✅ MIGRATED to data-orchestration service
 * - Uses centralized ContractService and ArtifactService
 * - Type-safe with automatic caching
 * - Consistent error handling
 */

import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/api-middleware';
import { deleteContractDetails, getContractDetails, putContractDetails } from '@/lib/contracts/server/details';

export const runtime = "nodejs";

export const GET = withContractApiHandler(async (req: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };
  return getContractDetails(req, ctx, contractId);
});

export const PUT = withContractApiHandler(async (req: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return putContractDetails(req, ctx, contractId);
});

export const PATCH = PUT;

export const DELETE = withContractApiHandler(async (req: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return deleteContractDetails(ctx, contractId);
});
