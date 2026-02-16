/**
 * Human Review Queue API
 * 
 * Endpoints for managing OCR review queue items
 * Note: Stubbed until OcrReviewItem model is migrated to database
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// In-memory store for development (replace with Prisma after migration)
const reviewItems: Map<string, ReviewItem> = new Map();

interface ReviewItem {
  id: string;
  tenantId: string;
  contractId: string;
  type: string;
  status: string;
  priority: string;
  ocrConfidence: number;
  lowConfidenceRegions: unknown[];
  documentName: string;
  documentType?: string;
  assignedTo?: string;
  notes?: string;
  corrections?: unknown[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

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

  // Filter items
  let items = Array.from(reviewItems.values())
    .filter(item => item.tenantId === ctx.tenantId);

  if (params.status) items = items.filter(i => i.status === params.status);
  if (params.priority) items = items.filter(i => i.priority === params.priority);
  if (params.type) items = items.filter(i => i.type === params.type);
  if (params.assignedTo) items = items.filter(i => i.assignedTo === params.assignedTo);

  // Sort by priority and date
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  items.sort((a, b) => {
    const pDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - 
                  priorityOrder[b.priority as keyof typeof priorityOrder];
    return pDiff !== 0 ? pDiff : a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Paginate
  const total = items.length;
  const start = (params.page - 1) * params.limit;
  items = items.slice(start, start + params.limit);

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

  const id = `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date();

  const item: ReviewItem = {
    id,
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
    createdAt: now,
    updatedAt: now,
  };

  reviewItems.set(id, item);

  return createSuccessResponse(ctx, item, { status: 201 });
});
