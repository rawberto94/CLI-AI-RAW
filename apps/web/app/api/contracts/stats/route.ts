/**
 * Contracts Statistics API
 * GET /api/contracts/stats - Get contract statistics and aggregations
 *
 * Provides:
 * - Total counts by status
 * - Total value aggregations
 * - Expiration timeline analysis
 * - Category distribution
 * - Party statistics
 * 
 * Performance:
 * - Redis caching (60s TTL)
 * - Parallel database queries
 * - SWR cache headers
 */

import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/api-middleware';
import { getContractStats } from '@/lib/contracts/server/stats';

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractStats(ctx);
});

