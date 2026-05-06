/**
 * Contract Data Sync API
 * POST /api/contracts/sync - Sync all contract tracking data
 * 
 * This is a convenience endpoint that triggers sync for:
 * - Contract expirations
 * - Health scores
 * - Expiration alerts
 * 
 * Useful for scheduled jobs or manual refresh
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractTrackingSyncDescription,
  postContractTrackingSync,
} from '@/lib/contracts/server/lifecycle-monitoring';

export const dynamic = 'force-dynamic';

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractTrackingSync(request, ctx);
});

export const GET = withContractApiHandler(async (_request, ctx) => {
  return getContractTrackingSyncDescription(ctx);
});
