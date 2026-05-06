/**
 * Contract Search API
 * POST /api/contracts/search - Search contracts using hybrid search
 */

import { NextRequest } from "next/server";
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractSearch, postContractSearch } from '@/lib/contracts/server/search';

export const POST = withContractApiHandler(async (request, ctx) => {
  return postContractSearch(request, ctx);
});

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractSearch(request, ctx);
});
