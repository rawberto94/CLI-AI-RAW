import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';

/**
 * GET /api/admin/metrics/uploads
 *
 * Returns aggregated upload metrics for the admin dashboard:
 *  - statusBreakdown: contract counts by status
 *  - dailyUploads: uploads per day for the last 30 days
 *  - sourceBreakdown: uploads by import source
 *  - mimeBreakdown: uploads by MIME type
 *  - sizeStats: average / total / max file sizes
 *  - processingPerf: average processing time (upload → completed)
 */
export const GET = withAuthApiHandler(async (_request, ctx) => {
  const canViewAnalytics = await hasPermission(ctx.userId, 'analytics:view');
  if (!canViewAnalytics) {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Forbidden', 403);
  }

  const tenantId = ctx.tenantId;

  // ── Status distribution ─────────────────────────────────────────────────
  const statusBreakdown = await prisma.contract.groupBy({
    by: ['status'],
    where: { tenantId, isDeleted: false },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // ── Daily uploads (last 30 days) ───────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyUploads = await prisma.contract.groupBy({
    by: ['uploadedAt'],
    where: {
      tenantId,
      isDeleted: false,
      uploadedAt: { gte: thirtyDaysAgo },
    },
    _count: { _all: true },
    orderBy: { uploadedAt: 'asc' },
  });

  // Bucket into days
  const dailyMap = new Map<string, number>();
  for (const row of dailyUploads) {
    if (!row.uploadedAt) continue;
    const day = new Date(row.uploadedAt).toISOString().slice(0, 10);
    dailyMap.set(day, (dailyMap.get(day) || 0) + row._count._all);
  }
  const dailyData = Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── Import source breakdown ────────────────────────────────────────────
  const sourceBreakdown = await prisma.contract.groupBy({
    by: ['importSource'],
    where: { tenantId, isDeleted: false },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // ── MIME type breakdown ────────────────────────────────────────────────
  const mimeBreakdown = await prisma.contract.groupBy({
    by: ['mimeType'],
    where: { tenantId, isDeleted: false },
    _count: { _all: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // ── File size stats ────────────────────────────────────────────────────
  const sizeStats = await prisma.contract.aggregate({
    where: { tenantId, isDeleted: false, fileSize: { gt: 0 } },
    _avg: { fileSize: true },
    _sum: { fileSize: true },
    _max: { fileSize: true },
    _count: { _all: true },
  });

  // ── Processing performance (avg time upload → completed) ───────────────
  // Only contracts that have both uploadedAt and processedAt
  const completedContracts = await prisma.contract.findMany({
    where: {
      tenantId,
      isDeleted: false,
      status: 'COMPLETED',
      NOT: { processedAt: null },
    },
    select: { uploadedAt: true, processedAt: true },
    take: 500,
    orderBy: { processedAt: 'desc' },
  });

  let avgProcessingMs = 0;
  let minProcessingMs = 0;
  let maxProcessingMs = 0;
  if (completedContracts.length > 0) {
    const durations = completedContracts
      .filter(c => c.processedAt && c.uploadedAt)
      .map(c => new Date(c.processedAt!).getTime() - new Date(c.uploadedAt!).getTime())
      .filter(d => d > 0);
    if (durations.length > 0) {
      avgProcessingMs = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
      minProcessingMs = Math.min(...durations);
      maxProcessingMs = Math.max(...durations);
    }
  }

  // ── Recent uploads ─────────────────────────────────────────────────────
  const recentUploads = await prisma.contract.findMany({
    where: { tenantId, isDeleted: false },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      status: true,
      uploadedAt: true,
      processedAt: true,
      importSource: true,
    },
    orderBy: { uploadedAt: 'desc' },
    take: 20,
  });

  return createSuccessResponse(ctx, {
    statusBreakdown: statusBreakdown.map(r => ({
      status: r.status,
      count: r._count._all,
    })),
    dailyUploads: dailyData,
    sourceBreakdown: sourceBreakdown.map(r => ({
      source: r.importSource || 'UNKNOWN',
      count: r._count._all,
    })),
    mimeBreakdown: mimeBreakdown.map(r => ({
      type: r.mimeType || 'unknown',
      count: r._count._all,
    })),
    sizeStats: {
      avgBytes: Number(sizeStats._avg.fileSize ?? 0),
      totalBytes: Number(sizeStats._sum.fileSize ?? 0),
      maxBytes: Number(sizeStats._max.fileSize ?? 0),
      totalFiles: sizeStats._count._all,
    },
    processingPerf: {
      avgMs: avgProcessingMs,
      minMs: minProcessingMs,
      maxMs: maxProcessingMs,
      sampleSize: completedContracts.length,
    },
    recentUploads: recentUploads.map(u => ({
      ...u,
      fileSize: Number(u.fileSize),
    })),
  });
});
