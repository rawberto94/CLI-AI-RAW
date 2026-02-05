/**
 * Human Review Queue API
 * 
 * Endpoints for managing OCR review queue items
 * Note: Stubbed until OcrReviewItem model is migrated to database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

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
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const params = querySchema.parse(Object.fromEntries(searchParams));

    // Filter items
    let items = Array.from(reviewItems.values())
      .filter(item => item.tenantId === session.user.tenantId);

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

    return NextResponse.json({
      items,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    });
  } catch (error) {
    console.error('[Review Queue] Error fetching items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ocr/review-queue
 * Create a new review queue item
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    const id = `review_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date();

    const item: ReviewItem = {
      id,
      tenantId: session.user.tenantId!,
      contractId: data.contractId,
      type: data.type,
      status: 'pending',
      priority: data.priority,
      ocrConfidence: data.ocrConfidence,
      lowConfidenceRegions: data.lowConfidenceRegions || [],
      documentName: data.documentName,
      documentType: data.documentType,
      notes: data.notes,
      createdBy: session.user.id,
      createdAt: now,
      updatedAt: now,
    };

    reviewItems.set(id, item);

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    console.error('[Review Queue] Error creating item:', error);
    return NextResponse.json(
      { error: 'Failed to create review item' },
      { status: 500 }
    );
  }
}
