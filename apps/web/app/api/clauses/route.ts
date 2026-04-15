import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { createClauseLibraryEntry, listClauseLibrary } from '@/lib/clauses/clause-library';

// GET /api/clauses - List all clauses from clause library
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const riskLevel = searchParams.get('riskLevel');
  const _favorite = searchParams.get('favorite');
  const search = searchParams.get('search');
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);

  const clauses = await listClauseLibrary(tenantId, {
    category,
    riskLevel,
    search,
    limit,
  });

  return createSuccessResponse(ctx, {
    clauses,
    total: clauses.length,
    source: 'database',
  });
});

// POST /api/clauses - Create new clause
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = ctx.tenantId;
  const userId = ctx.userId;
  const body = await request.json();
  const { title, content, category, tags, riskLevel, alternativeText, isStandard, isMandatory, isNegotiable } = body;

  if (!title || !content || !category) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Title, content, and category are required', 400);
  }

  const clause = await createClauseLibraryEntry(tenantId, userId, {
    title,
    content,
    category,
    tags,
    riskLevel,
    alternativeText,
    isStandard,
    isMandatory,
    isNegotiable,
  });

  return createSuccessResponse(ctx, {
    clause,
    source: 'database',
  }, { status: 201 });
});
