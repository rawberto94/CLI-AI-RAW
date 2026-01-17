/**
 * Contract Obligations API
 * 
 * GET /api/contracts/[id]/obligations - Get obligation summary for a contract
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerTenantId } from '@/lib/tenant-server';

export const dynamic = 'force-dynamic';

/**
 * Obligation data types
 */
interface Obligation {
  id?: string;
  title?: string;
  description?: string;
  party?: string;
  type?: string;
  dueDate?: string | Date;
  status?: 'pending' | 'in-progress' | 'completed' | 'overdue';
}

interface Milestone {
  id?: string;
  title?: string;
  date?: string | Date;
  status?: 'pending' | 'completed';
}

interface SLAMetric {
  id?: string;
  name?: string;
  target?: string | number;
  status?: 'on-track' | 'at-risk' | 'breached';
}

interface ObligationsArtifactData {
  summary?: string;
  obligations?: Obligation[];
  milestones?: Milestone[];
  slaMetrics?: SLAMetric[];
  reportingRequirements?: unknown[];
}

/**
 * GET /api/contracts/[id]/obligations
 * Get obligation summary for a specific contract
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contractId } = await params;
    const tenantId = await getServerTenantId();

    // Verify contract belongs to tenant
    const contract = await prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      select: { id: true, contractTitle: true },
    });

    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Contract not found' },
        { status: 404 }
      );
    }

    // Get obligation artifact
    const artifact = await prisma.artifact.findFirst({
      where: {
        contractId,
        type: 'OBLIGATIONS',
      },
    });

    if (!artifact) {
      return NextResponse.json({
        success: true,
        contractId,
        contractName: contract.contractTitle || 'Unnamed Contract',
        hasObligations: false,
        message: 'No obligations artifact found. Run AI analysis to extract obligations.',
      });
    }

    const data = artifact.data as ObligationsArtifactData;
    const today = new Date();

    // Calculate obligation stats
    const obligations = data.obligations || [];
    const milestones = data.milestones || [];
    const slaMetrics = data.slaMetrics || [];

    const upcomingObligations = obligations.filter((obl: Obligation) => {
      if (!obl.dueDate) return false;
      const dueDate = new Date(obl.dueDate);
      const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining >= 0 && daysRemaining <= 30;
    });

    const overdueObligations = obligations.filter((obl: Obligation) => {
      if (!obl.dueDate) return false;
      const dueDate = new Date(obl.dueDate);
      return dueDate < today && obl.status !== 'completed';
    });

    const atRiskSLAs = slaMetrics.filter((sla: SLAMetric) => 
      sla.status === 'at-risk' || sla.status === 'breached'
    );

    const upcomingMilestones = milestones.filter((ms: Milestone) => {
      if (!ms.date) return false;
      const msDate = new Date(ms.date);
      const daysRemaining = Math.ceil((msDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysRemaining >= 0 && daysRemaining <= 30 && ms.status !== 'completed';
    });

    // Group obligations by party
    const byParty = obligations.reduce((acc: Record<string, Obligation[]>, obl: Obligation) => {
      const party = obl.party || 'Unassigned';
      if (!acc[party]) acc[party] = [];
      acc[party].push(obl);
      return acc;
    }, {});

    // Group obligations by type
    const byType = obligations.reduce((acc: Record<string, number>, obl: Obligation) => {
      const type = obl.type || 'other';
      if (!acc[type]) acc[type] = 0;
      acc[type]++;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      contractId,
      contractName: contract.contractTitle || 'Unnamed Contract',
      hasObligations: true,
      summary: data.summary,
      stats: {
        totalObligations: obligations.length,
        upcomingCount: upcomingObligations.length,
        overdueCount: overdueObligations.length,
        totalMilestones: milestones.length,
        upcomingMilestones: upcomingMilestones.length,
        totalSLAs: slaMetrics.length,
        atRiskSLACount: atRiskSLAs.length,
      },
      byParty,
      byType,
      upcoming: upcomingObligations,
      overdue: overdueObligations,
      milestones: upcomingMilestones,
      atRiskSLAs,
      reportingRequirements: data.reportingRequirements || [],
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to get contract obligations' },
      { status: 500 }
    );
  }
}
