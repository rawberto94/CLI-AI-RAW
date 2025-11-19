import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { DataQualityScorerService } from 'data-orchestration/services';

// Using singleton prisma instance from @/lib/prisma

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
