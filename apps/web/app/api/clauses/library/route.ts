import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getTenantIdFromRequest } from '@/lib/tenant-server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { createClauseLibraryEntry, listClauseLibrary } from '@/lib/clauses/clause-library';

const clauseLibraryCreateSchema = z.object({
  name: z.string().min(1, 'name is required'),
  title: z.string().min(1, 'title is required'),
  category: z.string().min(1, 'category is required'),
  content: z.string().min(1, 'content is required'),
  riskLevel: z.string().default('MEDIUM'),
  isStandard: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  isNegotiable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  jurisdiction: z.string().optional(),
  contractTypes: z.array(z.string()).default([]),
  alternativeText: z.string().optional(),
});
// GET /api/clauses/library - Get all library clauses
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getTenantIdFromRequest(request);
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const riskLevel = searchParams.get('riskLevel');
  const search = searchParams.get('search');
  const isStandard = searchParams.get('isStandard');
  const isMandatory = searchParams.get('isMandatory');

  const clauses = await listClauseLibrary(
    tenantId,
    {
      category,
      riskLevel,
      search,
      isStandard: isStandard === 'true' ? true : undefined,
      isMandatory: isMandatory === 'true' ? true : undefined,
      limit: 200,
    },
    { seedDefaults: true },
  );

  return createSuccessResponse(ctx, {
    clauses,
    source: 'database',
    total: clauses.length,
  });
});

// POST /api/clauses/library - Add clause to library
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await getTenantIdFromRequest(request);
  const body = await request.json();

  let validated;
  try {
    validated = clauseLibraryCreateSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', error.errors.map(e => e.message).join(', '), 400);
    }
    throw error;
  }

  const { 
    name, 
    title, 
    category, 
    content, 
    riskLevel,
    isStandard,
    isMandatory,
    isNegotiable,
    tags,
    jurisdiction,
    contractTypes,
    alternativeText,
  } = validated;

  const clause = await createClauseLibraryEntry(tenantId, ctx.userId, {
    name,
    title,
    category,
    content,
    riskLevel,
    isStandard,
    isMandatory,
    isNegotiable,
    tags,
    jurisdiction,
    contractTypes,
    alternativeText,
  });

  return createSuccessResponse(ctx, {
    clause,
    source: 'database',
  });
});
