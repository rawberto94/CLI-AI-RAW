import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';
import { artifactService } from 'data-orchestration/services';
export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const tenantId = await ctx.tenantId;
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');
  const status = searchParams.get('status');
  const source = searchParams.get('source');

  // Build where clause
  const where: Record<string, unknown> = { tenantId };
  if (status) where.status = status;
  if (source) where.source = source;

  // Fetch import jobs from database
  const [importJobs, totalCount] = await Promise.all([
    prisma.importJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        rateCards: {
          select: {
            id: true,
            supplierName: true,
            _count: {
              select: { roles: true },
            },
          },
        },
      },
    }),
    prisma.importJob.count({ where }),
  ]);

  // Transform to response format
  const history = importJobs.map((job) => {
    const totalRecords = job.rowsProcessed || 0;
    const successfulRecords = job.rowsSucceeded || 0;
    const failedRecords = job.rowsFailed || 0;

    return {
      id: job.id,
      fileName: job.fileName || 'Unknown file',
      fileSize: job.fileSize ? Number(job.fileSize) : 0,
      source: job.source,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() || null,
      completedAt: job.completedAt?.toISOString() || null,
      totalRecords,
      successfulRecords,
      failedRecords,
      rateCardsCreated: job.rateCards.length,
      suppliers: [...new Set(job.rateCards.map(rc => rc.supplierName))],
      requiresReview: job.requiresReview,
      reviewedBy: job.reviewedBy,
      reviewedAt: job.reviewedAt?.toISOString() || null,
      mappingConfidence: Number(job.mappingConfidence || 0),
      errors: job.errors as any[],
      warnings: job.warnings as any[],
      notes: job.reviewNotes || (
        job.status === 'COMPLETED' 
          ? 'Import completed successfully.'
          : job.status === 'FAILED'
          ? 'Import failed. See errors for details.'
          : job.requiresReview
          ? 'Some records require manual review.'
          : null
      ),
    };
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: history,
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    },
  });
});
