/**
 * Tag Autocomplete API
 * 
 * GET /api/contracts/tags/suggest?q=query
 * Returns tag suggestions based on existing tags and common patterns
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { contractService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request, ctx) => {

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const tenantId = ctx.tenantId;

  if (query.length < 2) {
    return createSuccessResponse(ctx, { suggestions: [] });
  }

  const normalizedQuery = query.toLowerCase().replace(/\s+/g, '-');

  // Get existing tags that match the query
  // Note: tags is stored as Json, so we fetch all contracts and filter in JS
  const existingTags = await prisma.contract.findMany({
    where: {
      tenantId,
    },
    select: {
      tags: true,
    },
    take: 100,
  }).catch(() => []);

  // Extract and count unique tags
  const tagCounts = new Map<string, number>();
  for (const contract of existingTags) {
    for (const tag of (contract.tags as string[]) || []) {
      if (tag.toLowerCase().includes(normalizedQuery)) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  // Sort by frequency and take top matches
  const matchingTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  // Add smart suggestions based on common patterns
  const smartSuggestions: string[] = [];
  const commonSuffixes = ['-consulting', '-services', '-contract', '-agreement', '-vendor'];
  
  for (const suffix of commonSuffixes) {
    const suggestion = `${normalizedQuery}${suffix}`;
    if (!matchingTags.includes(suggestion) && !smartSuggestions.includes(suggestion)) {
      smartSuggestions.push(suggestion);
    }
  }

  // Combine existing tags with smart suggestions
  const suggestions = [
    ...matchingTags,
    ...smartSuggestions.slice(0, 5 - matchingTags.length),
  ].slice(0, 8);

  return createSuccessResponse(ctx, {
    suggestions,
    query: normalizedQuery,
  });
});
