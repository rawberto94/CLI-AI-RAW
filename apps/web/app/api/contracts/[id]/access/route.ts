/**
 * Contract Access Control API
 * 
 * Assign specific users/groups to specific contracts
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  deleteContractAccess,
  getContractAccess,
  getUserAccessibleContracts,
  hasContractAccess,
  postContractAccess,
} from '@/lib/contracts/server/access-control';

/**
 * GET /api/contracts/[id]/access - Get access list for a contract
 */
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return getContractAccess(ctx, contractId);
})

/**
 * POST /api/contracts/[id]/access - Grant access to contract
 */
export const POST = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return postContractAccess(request, ctx, contractId);
})

/**
 * DELETE /api/contracts/[id]/access - Revoke access
 */
export const DELETE = withContractApiHandler(async (request: NextRequest, ctx) => {
  const { id: contractId } = await (ctx as any).params as { id: string };

  return deleteContractAccess(request, ctx, contractId);
})
