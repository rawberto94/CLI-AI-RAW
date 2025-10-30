import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { DataQualityScorerService } from '@/packages/data-orchestration/src/services/data-quality-scorer.service';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const qualityService = new DataQualityScorerService(prisma);
    const qualityScore = await qualityService.calculateQualityScore(id);

    return NextResponse.json({
      success: true,
      data: qualityScore,
    });
  } catch (error: any) {
    console.error('Error calculating quality score:', error);
    return NextResponse.json(
      { 
        error: 'Failed to calculate quality score',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
