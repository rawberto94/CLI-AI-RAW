/**
 * Contract Expirations API
 * GET /api/contracts/expirations - Get contract expiration data from the dedicated table
 * POST /api/contracts/expirations - Update expiration records or trigger actions
 * 
 * Uses the ContractExpiration table for fast querying of expiration data
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import {
  getContractExpirations,
  postContractExpirations,
} from '@/lib/contracts/server/lifecycle-monitoring';

export const dynamic = 'force-dynamic';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractExpirations(request, ctx);
});

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractExpirations(request, ctx);
});
