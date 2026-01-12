/**
 * Categorization Accuracy Metrics API
 * 
 * Provides accuracy metrics based on user feedback/corrections
 * to help monitor and improve AI categorization quality.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerTenantId } from "@/lib/tenant-server";

/**
 * GET /api/analytics/categorization-accuracy
 * Get categorization accuracy metrics
 */
export async function GET(request: NextRequest) {
  try {
    const tenantId = await getServerTenantId();
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get("days") || "30", 10);
    
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Get all category feedback
    const corrections = await prisma.extractionCorrection.findMany({
      where: {
        tenantId,
        fieldName: "category",
        createdAt: { gte: since },
      },
      select: {
        id: true,
        wasCorrect: true,
        feedbackType: true,
        confidence: true,
        contractType: true,
        originalValue: true,
        correctedValue: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Calculate metrics
    const total = corrections.length;
    const correct = corrections.filter(c => c.wasCorrect).length;
    const accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Breakdown by feedback type
    const byFeedbackType = {
      confirmation: corrections.filter(c => c.feedbackType === "confirmation").length,
      correction: corrections.filter(c => c.feedbackType === "correction").length,
      rejection: corrections.filter(c => c.feedbackType === "rejection").length,
    };

    // Breakdown by contract type
    const byContractType: Record<string, { total: number; correct: number; accuracy: number }> = {};
    for (const c of corrections) {
      const type = c.contractType || "unknown";
      if (!byContractType[type]) {
        byContractType[type] = { total: 0, correct: 0, accuracy: 0 };
      }
      byContractType[type].total++;
      if (c.wasCorrect) byContractType[type].correct++;
    }
    for (const type of Object.keys(byContractType)) {
      const t = byContractType[type];
      t.accuracy = t.total > 0 ? (t.correct / t.total) * 100 : 0;
    }

    // Confidence vs accuracy analysis
    const confidenceBuckets: Record<string, { total: number; correct: number; accuracy: number }> = {
      "0-25": { total: 0, correct: 0, accuracy: 0 },
      "26-50": { total: 0, correct: 0, accuracy: 0 },
      "51-75": { total: 0, correct: 0, accuracy: 0 },
      "76-100": { total: 0, correct: 0, accuracy: 0 },
    };

    for (const c of corrections) {
      const conf = c.confidence ? Number(c.confidence) * 100 : 50;
      let bucket = "0-25";
      if (conf > 75) bucket = "76-100";
      else if (conf > 50) bucket = "51-75";
      else if (conf > 25) bucket = "26-50";
      
      confidenceBuckets[bucket].total++;
      if (c.wasCorrect) confidenceBuckets[bucket].correct++;
    }
    for (const bucket of Object.keys(confidenceBuckets)) {
      const b = confidenceBuckets[bucket];
      b.accuracy = b.total > 0 ? (b.correct / b.total) * 100 : 0;
    }

    // Most common corrections (what was wrong)
    const correctionPatterns: Record<string, number> = {};
    for (const c of corrections) {
      if (!c.wasCorrect && c.originalValue && c.correctedValue) {
        const meta = c.metadata as any;
        const pattern = `${meta?.originalL1 || 'Unknown'} → ${meta?.newL1 || 'Unknown'}`;
        correctionPatterns[pattern] = (correctionPatterns[pattern] || 0) + 1;
      }
    }
    const topCorrectionPatterns = Object.entries(correctionPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));

    // Recent trend (last 7 days vs previous 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const recentCorrections = corrections.filter(c => c.createdAt >= sevenDaysAgo);
    const previousCorrections = corrections.filter(c => 
      c.createdAt >= fourteenDaysAgo && c.createdAt < sevenDaysAgo
    );

    const recentAccuracy = recentCorrections.length > 0 
      ? (recentCorrections.filter(c => c.wasCorrect).length / recentCorrections.length) * 100 
      : null;
    const previousAccuracy = previousCorrections.length > 0
      ? (previousCorrections.filter(c => c.wasCorrect).length / previousCorrections.length) * 100
      : null;

    const trend = recentAccuracy !== null && previousAccuracy !== null
      ? recentAccuracy - previousAccuracy
      : null;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          days,
          since: since.toISOString(),
        },
        overall: {
          total,
          correct,
          accuracy: Math.round(accuracy * 100) / 100,
        },
        byFeedbackType,
        byContractType,
        confidenceAnalysis: confidenceBuckets,
        topCorrectionPatterns,
        trend: {
          recentSample: recentCorrections.length,
          recentAccuracy: recentAccuracy !== null ? Math.round(recentAccuracy * 100) / 100 : null,
          previousSample: previousCorrections.length,
          previousAccuracy: previousAccuracy !== null ? Math.round(previousAccuracy * 100) / 100 : null,
          change: trend !== null ? Math.round(trend * 100) / 100 : null,
          improving: trend !== null ? trend > 0 : null,
        },
      },
    });
  } catch (error) {
    console.error("Get accuracy metrics error:", error);
    return NextResponse.json(
      { error: "Failed to get accuracy metrics", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
