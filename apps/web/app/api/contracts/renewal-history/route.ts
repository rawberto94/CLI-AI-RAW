/**
 * Renewal History API
 * GET /api/contracts/renewal-history - Get renewal history for contracts
 * POST /api/contracts/renewal-history - Record a new renewal
 */

import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractRenewalHistory,
  postContractRenewalHistory,
} from '@/lib/contracts/server/renewal-history';

export const dynamic = 'force-dynamic';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractRenewalHistory(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractRenewalHistory(request, ctx);
});
