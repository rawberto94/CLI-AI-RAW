/**
 * Learning Records API
 * 
 * Returns adaptive learning records from the AI correction system.
 * These track AI extractions vs user corrections for continuous improvement.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthApiHandler, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  try {
    const { tenantId } = ctx;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const field = searchParams.get('field') || undefined;
    const correctionType = searchParams.get('correctionType') || undefined;

    const { prisma } = await import('@/lib/prisma');

    const where: Record<string, unknown> = { tenantId };
    if (field) where.field = field;
    if (correctionType) where.correctionType = correctionType;

    const [records, total, stats] = await Promise.all([
      prisma.learningRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.learningRecord.count({ where }),
      prisma.learningRecord.groupBy({
        by: ['correctionType'],
        _count: true,
      }),
    ]);

    // Compute summary stats
    const totalRecords = total;
    const correctionBreakdown = stats.reduce(
      (acc: Record<string, number>, s: { correctionType: string | null; _count: number }) => {
        acc[s.correctionType || 'unknown'] = s._count;
        return acc;
      },
      {} as Record<string, number>
    );

    // Average confidence from recent records
    const confRecords = records.filter((r: { confidence: unknown }) => r.confidence !== null);
    const avgConfidence = confRecords.length > 0
      ? confRecords.reduce((a: number, r: { confidence: unknown }) => a + Number(r.confidence), 0) / confRecords.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        records: records.map((r: Record<string, unknown>) => ({
          id: r.id,
          field: r.field,
          artifactType: r.artifactType,
          contractType: r.contractType,
          aiExtracted: r.aiExtracted,
          userCorrected: r.userCorrected,
          confidence: r.confidence ? Number(r.confidence) : null,
          correctionType: r.correctionType,
          modelUsed: r.modelUsed,
          createdAt: r.createdAt,
        })),
        total: totalRecords,
        correctionBreakdown,
        avgConfidence: Math.round(avgConfidence * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[Learning API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch learning records' },
      { status: 500 }
    );
  }
});
