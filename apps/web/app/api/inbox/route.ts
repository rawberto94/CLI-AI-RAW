/**
 * GET /api/inbox — unified "Needs you" queue.
 *
 * Server-side aggregation of:
 * 1. Agent field writes (AiDecision pending)
 * 2. Agent goals (AWAITING_APPROVAL)
 * 3. Workflow approvals (WorkflowExecution PENDING/IN_PROGRESS)
 * 4. Metadata review (contracts PENDING_REVIEW)
 * 5. RFx / compliance / renewal checkpoints (from agents/approvals sources)
 *
 * Do not merge N sources client-side — this endpoint returns one sorted list.
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  compareInboxItems,
  priorityToRisk,
  RISK_SCORE,
  type InboxItem,
  type InboxItemType,
  type InboxRisk,
} from '@/lib/inbox/types';

/** AgentGoal.priority: 1 = highest, 10 = lowest */
function mapPriorityNumeric(priority: number | null | undefined): InboxRisk {
  if (priority == null) return 'medium';
  if (priority <= 2) return 'critical';
  if (priority <= 4) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}

export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const typeFilter = req.nextUrl.searchParams.get('type');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '100', 10) || 100, 300);
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get('offset') || '0', 10) || 0);

  try {
    const [
      pendingAgentWrites,
      agentGoals,
      workflowExecutions,
      metadataReviewContracts,
      rfxEvents,
      complianceAlerts,
      renewalAlerts,
    ] = await Promise.all([
      // 1. Agent field writes
      prisma.aiDecision.findMany({
        where: {
          tenantId,
          feature: 'agent_write',
          outcome: 'pending',
          outputType: 'agent_field_write',
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),

      // 2. Agent goals
      prisma.agentGoal.findMany({
        where: { tenantId, status: 'AWAITING_APPROVAL' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),

      // 3. Workflow approvals
      prisma.workflowExecution.findMany({
        where: {
          tenantId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
        include: {
          workflow: true,
          contract: {
            select: {
              id: true,
              contractTitle: true,
              fileName: true,
              supplierName: true,
              totalValue: true,
            },
          },
          stepExecutions: {
            where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
            orderBy: { stepOrder: 'asc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),

      // 4. Metadata / human review — contracts held in PENDING (review holding pen)
      prisma.contract.findMany({
        where: {
          tenantId,
          status: 'PENDING',
        },
        select: {
          id: true,
          contractTitle: true,
          fileName: true,
          supplierName: true,
          totalValue: true,
          updatedAt: true,
          createdAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),

      // 5a. RFx awaiting approval
      prisma.rFxEvent.findMany({
        where: { tenantId, status: 'awaiting_approval' },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),

      // 5b. Compliance alerts
      prisma.riskDetectionLog.findMany({
        where: {
          tenantId,
          acknowledged: false,
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
        orderBy: { detectedAt: 'desc' },
        take: 50,
      }),

      // 5c. Renewals needing decision
      prisma.contract.findMany({
        where: {
          tenantId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          expirationDate: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
          renewalInitiatedAt: null,
        },
        select: {
          id: true,
          contractTitle: true,
          expirationDate: true,
          supplierName: true,
          totalValue: true,
        },
        orderBy: { expirationDate: 'asc' },
        take: 50,
      }),
    ]);

    const items: InboxItem[] = [];

    // Agent writes
    for (const decision of pendingAgentWrites) {
      const output = (decision.output ?? {}) as Record<string, unknown>;
      const field = String(output.field ?? decision.subFeature?.split('.')[1] ?? 'field');
      const confidence =
        typeof decision.confidence === 'number'
          ? decision.confidence
          : typeof output.confidence === 'number'
            ? (output.confidence as number)
            : 0;
      const risk: InboxRisk = confidence < 0.5 ? 'high' : 'medium';
      const actionId = `agent-write-${decision.id}`;
      items.push({
        id: actionId,
        type: 'agent_write',
        title: `Field change: ${field}`,
        description: `${String(output.agentId ?? decision.model ?? 'agent')} proposes updating ${field}`,
        risk,
        riskScore: RISK_SCORE[risk],
        value: 0,
        deadline: decision.expiresAt?.toISOString() ?? null,
        deepLink: decision.contractId
          ? `/contracts/${decision.contractId}`
          : '/inbox?type=agent_write',
        contractId: decision.contractId,
        requestedAt: decision.createdAt.toISOString(),
        agentId: String(output.agentId ?? decision.model ?? 'agent'),
        actions: [
          { kind: 'approve', label: 'Apply', actionId },
          { kind: 'reject', label: 'Reject', actionId },
        ],
        context: {
          entity: output.entity ?? 'Contract',
          entityId: output.entityId ?? decision.contractId,
          field,
          proposedValue: output.proposedValue ?? output.value,
          previousValue: (decision as { previousValue?: unknown }).previousValue ?? output.previousValue,
          hasPreviousValue:
            ((decision as { previousValue?: unknown }).previousValue !== undefined &&
              (decision as { previousValue?: unknown }).previousValue !== null) ||
            Object.prototype.hasOwnProperty.call(output, 'previousValue'),
          confidence,
          citations: decision.citations,
          evidenceChain: decision.evidenceChain,
          decisionId: decision.id,
        },
      });
    }

    // Agent goals
    for (const goal of agentGoals) {
      const risk = mapPriorityNumeric(goal.priority as number | null);
      const actionId = goal.id;
      items.push({
        id: `goal-${goal.id}`,
        type: 'agent_goal',
        title: goal.title || 'Agent goal approval',
        description: goal.description,
        risk,
        riskScore: RISK_SCORE[risk],
        value: 0,
        deadline: null,
        deepLink: `/runs/${goal.id}`,
        contractId: goal.contractId,
        requestedAt: goal.createdAt.toISOString(),
        agentId: goal.type,
        actions: [
          { kind: 'approve', label: 'Approve', actionId },
          { kind: 'reject', label: 'Reject', actionId },
          { kind: 'modify', label: 'Modify', actionId },
          { kind: 'open', label: 'Inspect run', actionId: goal.id },
        ],
        context: {
          plan: goal.plan,
          goalId: goal.id,
          type: goal.type,
          runUrl: `/runs/${goal.id}`,
        },
      });
    }

    // Workflow approvals
    for (const exec of workflowExecutions) {
      const contractName =
        exec.contract?.contractTitle || exec.contract?.fileName || 'Unknown contract';
      const value = exec.contract?.totalValue ? Number(exec.contract.totalValue) : 0;
      const metadata = (exec.metadata ?? {}) as Record<string, unknown>;
      const dueDate =
        (metadata.dueDate as string) ||
        exec.dueDate?.toISOString() ||
        null;
      const risk = priorityToRisk((metadata.priority as string) || 'medium');
      items.push({
        id: `workflow-${exec.id}`,
        type: 'workflow_approval',
        title: `${exec.workflow?.name || 'Approval'} — ${contractName}`,
        description: (metadata.notes as string) || exec.workflow?.description || '',
        risk,
        riskScore: RISK_SCORE[risk],
        value,
        deadline: dueDate,
        deepLink: exec.contractId
          ? `/contracts/${exec.contractId}?tab=workflow`
          : `/workflows?tab=queue&execution=${exec.id}`,
        contractId: exec.contractId,
        requestedAt: exec.createdAt.toISOString(),
        agentId: null,
        actions: [
          { kind: 'approve', label: 'Approve', actionId: exec.id },
          { kind: 'reject', label: 'Reject', actionId: exec.id },
          { kind: 'open', label: 'Open', actionId: exec.id },
        ],
        context: {
          executionId: exec.id,
          workflowId: exec.workflowId,
          supplierName: exec.contract?.supplierName,
        },
      });
    }

    // Metadata review
    for (const c of metadataReviewContracts) {
      const value = c.totalValue ? Number(c.totalValue) : 0;
      items.push({
        id: `metadata-${c.id}`,
        type: 'metadata_review',
        title: `Metadata review: ${c.contractTitle || c.fileName || c.id.slice(0, 8)}`,
        description: c.supplierName
          ? `Review extracted metadata for ${c.supplierName}`
          : 'Contract is pending human review of extracted metadata',
        risk: 'medium',
        riskScore: RISK_SCORE.medium,
        value,
        deadline: null,
        deepLink: `/contracts/${c.id}?tab=details`,
        contractId: c.id,
        requestedAt: (c.updatedAt || c.createdAt).toISOString(),
        agentId: null,
        actions: [{ kind: 'review', label: 'Review', actionId: c.id }],
        context: {
          supplierName: c.supplierName,
        },
      });
    }

    // RFx
    for (const rfx of rfxEvents) {
      const value = rfx.estimatedValue ? Number(rfx.estimatedValue) : 0;
      const actionId = rfx.id;
      items.push({
        id: `rfx-${rfx.id}`,
        type: 'rfx_award',
        title: `Award ${rfx.type}: ${rfx.title}`,
        description: rfx.awardJustification,
        risk: 'high',
        riskScore: RISK_SCORE.high,
        value,
        deadline: null,
        deepLink: `/contigo-labs/rfx/${rfx.id}`,
        contractId: null,
        requestedAt: rfx.updatedAt.toISOString(),
        agentId: 'rfx-procurement-agent',
        actions: [
          { kind: 'approve', label: 'Award', actionId: `rfx-${actionId}` },
          { kind: 'reject', label: 'Reject', actionId: `rfx-${actionId}` },
        ],
        context: {
          vendor: rfx.winner,
          awardValue: rfx.estimatedValue,
          savings: rfx.savingsAchieved,
        },
      });
    }

    // Compliance
    for (const alert of complianceAlerts) {
      const risk: InboxRisk = alert.severity === 'CRITICAL' ? 'critical' : 'high';
      items.push({
        id: `compliance-${alert.id}`,
        type: 'compliance_alert',
        title: `${alert.severity} risk: ${alert.riskType}`,
        description: alert.description,
        risk,
        riskScore: RISK_SCORE[risk],
        value: 0,
        deadline: null,
        deepLink: alert.contractId
          ? `/contracts/${alert.contractId}?tab=risk`
          : '/risk',
        contractId: alert.contractId,
        requestedAt: alert.detectedAt.toISOString(),
        agentId: 'compliance-monitoring-agent',
        actions: [
          { kind: 'acknowledge', label: 'Acknowledge', actionId: `compliance-${alert.id}` },
          { kind: 'escalate', label: 'Escalate', actionId: `compliance-${alert.id}` },
        ],
        context: {
          riskType: alert.riskType,
          severity: alert.severity,
        },
      });
    }

    // Renewals
    for (const contract of renewalAlerts) {
      const daysToExpiry = contract.expirationDate
        ? Math.ceil(
            (contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          )
        : 0;
      const risk: InboxRisk = daysToExpiry <= 14 ? 'critical' : 'high';
      const value = contract.totalValue ? Number(contract.totalValue) : 0;
      items.push({
        id: `renewal-${contract.id}`,
        type: 'renewal_decision',
        title: `Renewal decision: ${contract.contractTitle}`,
        description: `Expires in ${daysToExpiry} days. Start renewal process?`,
        risk,
        riskScore: RISK_SCORE[risk],
        value,
        deadline: contract.expirationDate?.toISOString() ?? null,
        deepLink: `/contracts/${contract.id}?tab=renewal`,
        contractId: contract.id,
        requestedAt: new Date().toISOString(),
        agentId: 'autonomous-deadline-manager',
        actions: [
          { kind: 'approve', label: 'Start renewal', actionId: `renewal-${contract.id}` },
          { kind: 'defer', label: 'Snooze', actionId: `renewal-${contract.id}` },
        ],
        context: {
          daysToExpiry,
          supplierName: contract.supplierName,
        },
      });
    }

    // Filter + sort
    let filtered = items;
    if (typeFilter && typeFilter !== 'all') {
      filtered = items.filter((i) => i.type === (typeFilter as InboxItemType));
    }
    filtered.sort(compareInboxItems);

    const page = filtered.slice(offset, offset + limit);
    const byType = filtered.reduce(
      (acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return createSuccessResponse(ctx, {
      items: page,
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length,
      },
      stats: {
        total: filtered.length,
        critical: filtered.filter((i) => i.risk === 'critical').length,
        byType,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch inbox:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch inbox', 500);
  }
});

/**
 * POST /api/inbox — act on an inbox item (routes to underlying APIs by type).
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;
  try {
    const body = await req.json();
    const { id, type, action, notes } = body as {
      id: string;
      type: InboxItemType;
      action: string;
      notes?: string;
    };

    if (!id || !type || !action) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'id, type, and action are required', 400);
    }

    // Route to existing approval processors via internal fetch patterns
    if (type === 'agent_write' || type === 'agent_goal' || type === 'rfx_award' || type === 'compliance_alert' || type === 'renewal_decision') {
      const actionId =
        type === 'agent_write'
          ? id.startsWith('agent-write-')
            ? id
            : `agent-write-${id}`
          : type === 'agent_goal'
            ? id.replace(/^goal-/, '')
            : id;

      // Reuse agents/approvals POST logic by dynamic import of shared handlers would be cleaner;
      // call the same route machinery inline via a relative process:
      const { POST: approvalsPost } = await import('@/app/api/agents/approvals/route');
      const innerReq = new NextRequest('http://localhost/api/agents/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          actionId:
            type === 'agent_goal' && !actionId.startsWith('goal-')
              ? actionId
              : actionId,
          action,
          notes,
        }),
      });
      return approvalsPost(innerReq);
    }

    if (type === 'workflow_approval') {
      const executionId = id.replace(/^workflow-/, '');
      const { POST: approvalsPost } = await import('@/app/api/approvals/route');
      const innerReq = new NextRequest('http://localhost/api/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-tenant-id': tenantId,
        },
        body: JSON.stringify({
          approvalId: executionId,
          action,
          comment: notes,
        }),
      });
      return approvalsPost(innerReq);
    }

    if (type === 'metadata_review') {
      // Review is open-only; no server mutation here
      return createSuccessResponse(ctx, {
        type,
        status: 'opened',
        message: 'Open the contract to complete metadata review',
        deepLink: `/contracts/${id.replace(/^metadata-/, '')}?tab=details`,
      });
    }

    return createErrorResponse(ctx, 'UNSUPPORTED_TYPE', `Unsupported inbox type: ${type}`, 400);
  } catch (error) {
    logger.error('Failed to process inbox action:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process inbox action', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
