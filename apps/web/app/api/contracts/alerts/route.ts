/**
 * Expiration Alerts API
 * GET /api/contracts/alerts - Get pending and sent expiration alerts
 * POST /api/contracts/alerts - Create, send, or acknowledge alerts
 * 
 * Uses the ExpirationAlert table for tracking alert history
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractAlerts, postContractAlerts } from '@/lib/contracts/server/lifecycle-monitoring';

export const dynamic = 'force-dynamic';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractAlerts(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractAlerts(request, ctx);
});
