/**
 * Artifact Analytics API Route
 * 
 * Provides analytics and metrics for contract artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/analytics/artifacts
 * Get aggregated artifact metrics and analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Query all artifacts for the tenant
    const artifacts = await prisma.artifact.findMany({
      where: {
        contract: {
          tenantId: tenantId
        }
      },
      include: {
        contract: {
          select: {
            name: true,
            id: true
          }
        },
        validationResults: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate overall metrics
    const totalArtifacts = artifacts.length;
    const avgConfidence = totalArtifacts > 0
      ? artifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / totalArtifacts
      : 0;
    const avgCompleteness = totalArtifacts > 0
      ? artifacts.reduce((sum, a) => sum + (a.completeness || 0), 0) / totalArtifacts
      : 0;
    const validationIssues = artifacts.reduce(
      (sum, a) => sum + ((a.validationResults as any)?.issues?.length || 0),
      0
    );

    // Calculate metrics by artifact type
    const artifactTypes = ['OVERVIEW', 'FINANCIAL', 'CLAUSES', 'RATES', 'COMPLIANCE', 'RISK'];
    const byType: Record<string, any> = {};

    for (const type of artifactTypes) {
      const typeArtifacts = artifacts.filter(a => a.type === type);
      const count = typeArtifacts.length;

      byType[type] = {
        count,
        avgConfidence: count > 0
          ? typeArtifacts.reduce((sum, a) => sum + (a.confidence || 0), 0) / count
          : 0,
        avgCompleteness: count > 0
          ? typeArtifacts.reduce((sum, a) => sum + (a.completeness || 0), 0) / count
          : 0,
        issues: typeArtifacts.reduce(
          (sum, a) => sum + ((a.validationResults as any)?.issues?.length || 0),
          0
        )
      };
    }

    // Get total cost savings
    const costSavingsAgg = await prisma.costSavingsOpportunity.aggregate({
      where: {
        tenantId: tenantId,
        status: 'identified'
      },
      _sum: {
        potentialSavingsAmount: true
      }
    });

    const costSavingsTotal = Number(costSavingsAgg._sum.potentialSavingsAmount || 0);

    // Get recent activity (last 10 artifacts)
    const recentActivity = artifacts.slice(0, 10).map(a => ({
      id: a.id,
      contractName: a.contract.name,
      artifactType: a.type,
      confidence: a.confidence || 0,
      completeness: a.completeness || 0,
      createdAt: a.createdAt.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalArtifacts,
        avgConfidence,
        avgCompleteness,
        validationIssues,
        costSavingsTotal,
        byType,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Artifact analytics error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch artifact analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
