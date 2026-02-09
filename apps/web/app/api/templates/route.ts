import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiTenantId } from '@/lib/tenant-server'
import { getServerSession } from '@/lib/auth'
import { contractService } from 'data-orchestration/services';

// Helper to transform Prisma template to UI-expected format
function transformTemplate(template: Record<string, unknown>) {
  const metadata = (template.metadata || {}) as Record<string, unknown>
  const clauses = template.clauses as Array<Record<string, unknown>> || []
  const variables = (metadata.variables || []) as Array<Record<string, unknown>>
  
  return {
    ...template,
    // Map status from metadata or derive from isActive
    status: metadata.status || (template.isActive ? 'active' : 'draft'),
    // Map tags from metadata
    tags: metadata.tags || [],
    // Map content from metadata
    content: metadata.content || '',
    // Map language from metadata  
    language: metadata.language || 'en-US',
    // Calculate variables count
    variables: variables.length,
    // Calculate clauses count (if array) or keep as-is
    clauses: Array.isArray(clauses) ? clauses.length : (clauses || 0),
    // Add lastModified alias
    lastModified: template.updatedAt,
    // Approval status (from metadata or default)
    approvalStatus: metadata.approvalStatus || 'none',
    // Created by user name (if available)
    createdBy: template.createdBy || 'System',
  }
}

// GET /api/templates - List all templates
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId
  const { searchParams } = new URL(request.url)

  const category = searchParams.get('category')
  const search = searchParams.get('search')
  const isActive = searchParams.get('isActive')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const where: Record<string, unknown> = {
    tenantId,
  }

  if (category) {
    where.category = category
  }

  if (isActive !== null) {
    where.isActive = isActive === 'true'
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ]
  }

  const templates = await prisma.contractTemplate.findMany({
    where,
    orderBy: [
      { usageCount: 'desc' },
      { lastUsedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
    skip: offset,
  })

  const total = await prisma.contractTemplate.count({ where })

  // Transform templates to match UI expectations
  const transformedTemplates = templates.map(t => transformTemplate(t as unknown as Record<string, unknown>))

  return createSuccessResponse(ctx, {
    success: true,
    templates: transformedTemplates,
    total,
    limit,
    offset,
  })
});

// POST /api/templates - Create a new template
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId
  const body = await request.json()

  const {
    name,
    description,
    category,
    clauses = [],
    structure,
    metadata = {},
    status,
    content,
    tags,
    isActive,
  } = body

  if (!name) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Name is required', 400)
  }

  const template = await prisma.contractTemplate.create({
    data: {
      tenantId,
      name,
      description: description || '',
      category: category || 'GENERAL',
      clauses: clauses || [],
      structure: structure || {},
      metadata: {
        ...(metadata || {}),
        status: status || 'draft',
        content: content || '',
        tags: tags || [],
      },
      isActive: isActive ?? (status === 'active'),
      createdBy: session?.user?.id || 'system',
    },
  })

  return createSuccessResponse(ctx, {
    success: true,
    template: transformTemplate(template as unknown as Record<string, unknown>),
  })
});
