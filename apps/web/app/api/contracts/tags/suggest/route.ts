/**
 * Tag Autocomplete API
 * 
 * GET /api/contracts/tags/suggest?q=query
 * Returns tag suggestions based on existing tags and common patterns
 */

import { NextRequest } from 'next/server';
import { withContractApiHandler } from '@/lib/contracts/server/context';
import { getContractTagSuggestions } from '@/lib/contracts/server/metadata';

export const GET = withContractApiHandler(async (request, ctx) => {
  return getContractTagSuggestions(request, ctx);
});
