/**
 * Human Review Queue API
 * 
 * Endpoints for managing OCR review queue items
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';

// Query params schema
const querySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'escalated']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  type: z.enum(['ocr_quality', 'handwriting', 'mixed_language', 'legal_entity', 'sensitive_content']).optional(),
  assignedTo: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// Create review item schema
const createSchema = z.object({
  contractId: z.string(),
  type: z.enum(['ocr_quality', 'handwriting', 'mixed_language', 'legal_entity', 'sensitive_content']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  ocrConfidence: z.number().min(0).max(1),
  lowConfidenceRegions: z.array(z.object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
    confidence: z.number(),
  })).optional(),
  documentName: z.string(),
  documentType: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/ocr/review-queue
 * List review queue items with filtering
 */
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const { searchParams } = new URL(request.url);
  const params = querySchema.parse(Object.fromEntries(searchParams));
  const { prisma } = await import('@/lib/prisma');

  const where: any = { tenantId: ctx.tenantId };
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.type) where.type = params.type;
  if (params.assignedTo) where.assignedTo = params.assignedTo;

  const [items, total] = await Promise.all([
    prisma.ocrReviewItem.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.ocrReviewItem.count({ where }),
  ]);

  return createSuccessResponse(ctx, {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  });
});

/**
 * POST /api/ocr/review-queue
 * Create a new review queue item
 */
export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const body = await request.json();
  const data = createSchema.parse(body);
  const { prisma } = await import('@/lib/prisma');

  const item = await prisma.ocrReviewItem.create({
    data: {
      tenantId: ctx.tenantId!,
      contractId: data.contractId,
      type: data.type,
      status: 'pending',
      priority: data.priority,
      ocrConfidence: data.ocrConfidence,
      lowConfidenceRegions: data.lowConfidenceRegions || [],
      documentName: data.documentName,
      documentType: data.documentType,
      notes: data.notes,
      createdBy: ctx.userId,
    },
  });

  return createSuccessResponse(ctx, item, { status: 201 });
});
