import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';

import type { ContractApiContext } from '@/lib/contracts/server/context';

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

export async function getContractObligations(
  context: ContractApiContext,
  contractId: string,
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId: context.tenantId },
    select: { id: true, contractTitle: true },
  });

  if (!contract) {
    return createErrorResponse(context, 'NOT_FOUND', 'Contract not found', 404);
  }

  const artifact = await prisma.artifact.findFirst({
    where: {
      contractId,
      type: 'OBLIGATIONS',
    },
  });

  if (!artifact) {
    return createSuccessResponse(context, {
      success: true,
      contractId,
      contractName: contract.contractTitle || 'Unnamed Contract',
      hasObligations: false,
      message: 'No obligations artifact found. Run AI analysis to extract obligations.',
    });
  }

  const data = artifact.data as ObligationsArtifactData;
  const today = new Date();
  const obligations = data.obligations || [];
  const milestones = data.milestones || [];
  const slaMetrics = data.slaMetrics || [];

  const upcomingObligations = obligations.filter((obligation) => {
    if (!obligation.dueDate) return false;
    const dueDate = new Date(obligation.dueDate);
    const daysRemaining = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining >= 0 && daysRemaining <= 30;
  });

  const overdueObligations = obligations.filter((obligation) => {
    if (!obligation.dueDate) return false;
    const dueDate = new Date(obligation.dueDate);
    return dueDate < today && obligation.status !== 'completed';
  });

  const atRiskSLAs = slaMetrics.filter((sla) =>
    sla.status === 'at-risk' || sla.status === 'breached',
  );

  const upcomingMilestones = milestones.filter((milestone) => {
    if (!milestone.date) return false;
    const milestoneDate = new Date(milestone.date);
    const daysRemaining = Math.ceil((milestoneDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysRemaining >= 0 && daysRemaining <= 30 && milestone.status !== 'completed';
  });

  const byParty = obligations.reduce((acc: Record<string, Obligation[]>, obligation) => {
    const party = obligation.party || 'Unassigned';
    if (!acc[party]) acc[party] = [];
    acc[party].push(obligation);
    return acc;
  }, {});

  const byType = obligations.reduce((acc: Record<string, number>, obligation) => {
    const type = obligation.type || 'other';
    if (!acc[type]) acc[type] = 0;
    acc[type]++;
    return acc;
  }, {});

  return createSuccessResponse(context, {
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
}