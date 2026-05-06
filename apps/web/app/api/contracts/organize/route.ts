/**
 * Contract Organization API
 * GET /api/contracts/organize - Get contracts organized by various criteria
 *
 * Supports grouping by:
 * - status
 * - contractType
 * - category
 * - clientName
 * - supplierName
 * - expirationMonth
 * - valueRange
 */

import { NextRequest } from 'next/server';

import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractsOrganized } from '@/lib/contracts/server/collection';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractsOrganized(request, ctx);
});
