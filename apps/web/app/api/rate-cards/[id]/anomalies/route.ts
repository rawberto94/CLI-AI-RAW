import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AnomalyExplainerService } from 'data-orchestration/services';

const prisma = new PrismaClient();

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { id } = params;

    // Get rate card entry
    const rateCard = await prisma.rateCardEntry.findUnique({
      where: { id },
    });

    if (!rateCard) {
      return NextResponse.json(
        { error: 'Rate card not found' },
        { status: 404 }
      );
    }

    // Detect anomalies
    const anomalyService = new AnomalyExplainerService(prisma);
    const anomalies = await anomalyService.detectAnomalies(id);

    // Generate explanations for each anomaly
    const explanations = await Promise.all(
      anomalies.anomalies.map(anomaly =>
        anomalyService.explainAnomaly(anomaly, id)
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        ...anomalies,
        explanations,
      },
    });
  } catch (error: any) {
    console.error('Error detecting anomalies:', error);
    return NextResponse.json(
      { 
        error: 'Failed to detect anomalies',
        message: error.message 
      },
      { status: 500 }
    );
  }
}
