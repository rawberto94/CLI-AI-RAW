/**
 * Contracts List API
 * GET /api/contracts - List contracts with filtering, sorting, and pagination
 *
 * OPTIMIZATIONS:
 * - Caches GET responses with Redis for reduced database load
 * - Uses selective field projection to minimize data transfer
 * - Implements efficient pagination with cursor-based approach
 * - Standardized error handling and response format
 * 
 * MULTI-TENANT: Uses authenticated tenant context for proper tenant isolation
 */

import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/api-middleware';
import { getContractsCollection } from '@/lib/contracts/server/collection';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export const GET = withContractApiHandler(async (request: NextRequest, ctx) => {
  return getContractsCollection(request, ctx);
});
