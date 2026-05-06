import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractExpirationSyncSummary,
  postContractExpirationSync,
} from '@/lib/contracts/server/sync-expirations';

/**
 * POST /api/contracts/sync-expirations
 * Syncs contract expiration data to the ContractExpiration table
 * Uses raw SQL for new tables until Prisma client is regenerated
 */
export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractExpirationSync(request, ctx);
});

/**
 * GET /api/contracts/sync-expirations - Returns expiration statistics
 */
export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractExpirationSyncSummary(request, ctx);
});
