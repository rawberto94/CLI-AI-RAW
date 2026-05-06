import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractHealthScoreSyncSummary,
  postContractHealthScoreSync,
} from '@/lib/contracts/server/lifecycle-monitoring';

/**
 * POST /api/contracts/sync-health-scores
 * Calculates and syncs health scores for all contracts using raw SQL
 */
export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractHealthScoreSync(request, ctx);
});

/**
 * GET /api/contracts/sync-health-scores - Returns health score statistics
 */
export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractHealthScoreSyncSummary(request, ctx);
});
