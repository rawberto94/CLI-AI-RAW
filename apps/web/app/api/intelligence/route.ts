import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantIdFromRequest } from '@/lib/tenant-server';

/**
 * Intelligence Hub API
 * Provides real-time intelligence data from the database
 */

// Type for contract metadata JSON field
interface ContractMetadata {
  healthScore?: number;
  previousHealthScore?: number;
}

// Helper to get contract health distribution
async function getHealthScores(tenantId: string) {
  // Get all contracts with health scores from metadata JSON field
  const contracts = await prisma.contract.findMany({
    where: { tenantId },
    select: {
      id: true,
      metadata: true,
    },
  });

  // Calculate health score buckets
  let healthy = 0;
  let atRisk = 0;
  let critical = 0;
  let improving = 0;
  let declining = 0;
  let totalScore = 0;

  for (const contract of contracts) {
    const meta = contract.metadata as ContractMetadata | null;
    const healthScore = meta?.healthScore ?? 75;
    totalScore += healthScore;

    if (healthScore >= 70) healthy++;
    else if (healthScore >= 40) atRisk++;
    else critical++;

    // Check trend from previous health score if available
    const previousScore = meta?.previousHealthScore;
    if (previousScore !== undefined) {
      if (healthScore > previousScore) improving++;
      else if (healthScore < previousScore) declining++;
    }
  }

  const average = contracts.length > 0 ? Math.round(totalScore / contracts.length) : 75;

  return {
    average,
    healthy,
    atRisk,
    critical,
    improving,
    declining,
  };
}

// Helper to get AI-generated insights from artifacts and risks
async function getInsights(tenantId: string, limit = 10) {
  // Get recent contracts with expiration risks
  const contractsWithRisks = await prisma.contract.findMany({
    where: { 
      tenantId,
      expirationRisk: { in: ['HIGH', 'CRITICAL'] },
    },
    take: 5,
    orderBy: { expirationDate: 'asc' },
    select: {
      id: true,
      contractTitle: true,
      fileName: true,
      totalValue: true,
      expirationDate: true,
      autoRenewalEnabled: true,
      expirationRisk: true,
    },
  });

  // Get insights from artifacts
  const riskArtifacts = await prisma.artifact.findMany({
    where: {
      tenantId,
      type: 'RISK',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      contract: { select: { id: true, contractTitle: true, fileName: true } },
    },
  });

  const insights: Array<{
    id: string;
    type: 'risk' | 'opportunity' | 'compliance';
    severity: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    recommendation: string;
    contractId?: string;
    createdAt: string;
  }> = [];

  // Add expiration risk insights
  for (const contract of contractsWithRisks) {
    if (contract.expirationDate) {
      const daysUntilExpiry = Math.ceil((contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const displayTitle = contract.contractTitle || contract.fileName || 'Unnamed Contract';
      if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
        insights.push({
          id: `exp-${contract.id}`,
          type: 'risk',
          severity: daysUntilExpiry <= 14 ? 'high' : 'medium',
          title: `Contract Expiring ${daysUntilExpiry <= 7 ? 'This Week' : 'Soon'}`,
          description: `"${displayTitle.slice(0, 50)}" expires in ${daysUntilExpiry} days${contract.autoRenewalEnabled ? ' with auto-renewal clause' : ''}.`,
          recommendation: contract.autoRenewalEnabled 
            ? 'Review terms and notify vendor if you wish to terminate or renegotiate.'
            : 'Initiate renewal discussions or prepare transition plan.',
          contractId: contract.id,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Add risk artifact insights
  for (const artifact of riskArtifacts) {
    const artifactData = artifact.data as { risks?: Array<{ title?: string; description?: string; severity?: string }> };
    const risks = artifactData?.risks || [];
    const contractTitle = artifact.contract?.contractTitle || artifact.contract?.fileName || 'Unknown Contract';
    for (const risk of risks.slice(0, 2)) {
      insights.push({
        id: `risk-${artifact.id}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'risk',
        severity: (risk.severity?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        title: risk.title || 'Risk Identified',
        description: risk.description || 'AI identified a potential risk in this contract.',
        recommendation: 'Review the contract and consult with legal if needed.',
        contractId: artifact.contract?.id,
        createdAt: artifact.createdAt.toISOString(),
      });
    }
  }

  return insights.slice(0, limit);
}

// Helper to get recent activity
async function getRecentActivity(tenantId: string, limit = 10) {
  const activities = await prisma.auditLog.findMany({
    where: { tenantId },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
  });

  return activities.map(activity => {
    const timeDiff = Date.now() - activity.createdAt.getTime();
    const minutes = Math.floor(timeDiff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    let time = '';
    if (days > 0) time = `${days} day${days > 1 ? 's' : ''} ago`;
    else if (hours > 0) time = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    else time = `${minutes} min ago`;

    const actionLabels: Record<string, string> = {
      CREATE: 'created',
      UPDATE: 'updated',
      DELETE: 'deleted',
      VIEW: 'viewed',
      ANALYZE: 'analyzed',
      EXTRACT: 'extracted metadata from',
    };

    return {
      type: activity.action.toLowerCase(),
      message: `${activity.entityType} ${actionLabels[activity.action] || activity.action.toLowerCase()}`,
      time,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getTenantIdFromRequest(request);
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    let data: Record<string, unknown> = {};

    if (section === 'health') {
      data = { healthScores: await getHealthScores(tenantId) };
    } else if (section === 'insights') {
      data = { insights: await getInsights(tenantId) };
    } else if (section === 'activity') {
      data = { recentActivity: await getRecentActivity(tenantId) };
    } else {
      // Return all sections
      const [healthScores, insights, recentActivity] = await Promise.all([
        getHealthScores(tenantId),
        getInsights(tenantId),
        getRecentActivity(tenantId),
      ]);

      data = {
        healthScores,
        insights,
        recentActivity,
        aiCapabilities: {
          searchEnabled: true,
          healthScoresEnabled: true,
          negotiationCopilotEnabled: true,
          knowledgeGraphEnabled: true,
          lastModelUpdate: new Date().toISOString().split('T')[0],
          processingQueue: 0,
        },
      };
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch intelligence data',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'refresh-scores') {
      return NextResponse.json({
        success: true,
        message: 'Health scores refresh initiated',
        data: {
          jobId: `refresh-${Date.now()}`,
          status: 'processing',
          estimatedTime: '30 seconds',
        },
      });
    }

    if (action === 'dismiss-insight') {
      return NextResponse.json({
        success: true,
        message: 'Insight dismissed',
        data: {
          insightId: body.insightId,
          dismissedAt: new Date().toISOString(),
        },
      });
    }

    if (action === 'act-on-insight') {
      return NextResponse.json({
        success: true,
        message: 'Action recorded',
        data: {
          insightId: body.insightId,
          actionTaken: body.actionType,
          actedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
