/**
 * Agent Approvals API
 * 
 * GET /api/agents/approvals - List all pending approvals
 * POST /api/agents/approvals/:id/approve - Approve an item
 * POST /api/agents/approvals/:id/reject - Reject an item
 * POST /api/agents/approvals/:id/modify - Request modifications
 * 
 * HITL (Human-in-the-Loop) approval management
 */

import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const ApprovalActionSchema = z.object({
  actionId: z.string().min(1, 'Action ID is required'),
  action: z.enum(['approve', 'reject', 'modify', 'escalate', 'defer']),
  notes: z.string().optional(),
  modifications: z.record(z.any()).optional(),
});

/**
 * GET /api/agents/approvals
 * 
 * Returns all items awaiting human approval across all agent types
 */
export const GET = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId } = ctx;
  const searchParams = req.nextUrl.searchParams;
  const type = searchParams.get('type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

  try {
    // Fetch all approval-requiring items in parallel
    const [
      agentGoals,
      rfxEvents,
      complianceAlerts,
      renewalAlerts,
    ] = await Promise.all([
      // 1. Agent Goals awaiting approval
      prisma.agentGoal.findMany({
        where: {
          tenantId,
          status: 'AWAITING_APPROVAL',
          ...(type && { type: type.toUpperCase() }),
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 2. RFx Events awaiting approval
      prisma.rFxEvent.findMany({
        where: {
          tenantId,
          status: 'awaiting_approval',
        },
        orderBy: { updatedAt: 'desc' },
      }),

      // 3. Compliance alerts needing review
      prisma.riskDetectionLog.findMany({
        where: {
          tenantId,
          acknowledged: false,
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
        orderBy: { detectedAt: 'desc' },
      }),

      // 4. Contract renewals needing decision
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
      }),
    ]);

    // Transform to unified approval format
    const approvals = [
      // Agent Goals
      ...agentGoals.map(goal => {
        const ctx = (goal.context ?? {}) as Record<string, unknown>;
        const confidence = typeof ctx.confidence === 'number' ? ctx.confidence : 0.8;
        return {
          id: goal.id,
          type: 'agent_goal',
          category: 'workflow',
          title: goal.title || 'Agent Goal Approval',
          description: goal.description,
          agentId: goal.type?.toLowerCase().replace(/_/g, '-') || 'unknown',
          agentCodename: getAgentCodename(goal.type),
          contractId: goal.contractId,
          priority: mapPriorityNumeric(goal.priority),
          requestedAt: goal.createdAt.toISOString(),
          requester: goal.userId || 'System',
          context: {
            plan: goal.plan,
            confidence,
          },
          recommendation: {
            action: 'approve',
            reason: goal.description,
            confidence,
          },
          alternatives: [
            { action: 'reject', label: 'Reject', reason: 'Do not proceed with this goal' },
            { action: 'modify', label: 'Modify', reason: 'Adjust parameters before execution' },
          ],
        };
      }),

      // RFx Events
      ...rfxEvents.map(rfx => ({
        id: rfx.id,
        type: 'rfx_award',
        category: 'procurement',
        title: `Award ${rfx.type}: ${rfx.title}`,
        description: rfx.awardJustification,
        agentId: 'rfx-procurement-agent',
        agentCodename: 'Merchant',
        contractId: null,
        priority: 'high',
        requestedAt: rfx.updatedAt.toISOString(),
        requester: 'Merchant Agent',
        context: {
          vendor: rfx.winner,
          awardValue: rfx.estimatedValue,
          savings: rfx.savingsAchieved,
          bids: rfx.responses,
        },
        recommendation: {
          action: 'approve',
          reason: rfx.awardJustification || `Award to ${rfx.winner}`,
          confidence: 0.85,
        },
        alternatives: [
          { action: 'reject', label: 'Reject Award', reason: 'Select different vendor' },
          { action: 'modify', label: 'Negotiate', reason: 'Request better terms' },
        ],
      })),

      // Compliance Alerts
      ...complianceAlerts.map(alert => ({
        id: alert.id,
        type: 'compliance_alert',
        category: 'risk',
        title: `${alert.severity} Risk: ${alert.riskType}`,
        description: alert.description,
        agentId: 'compliance-monitoring-agent',
        agentCodename: 'Vigil',
        contractId: alert.contractId,
        priority: alert.severity === 'CRITICAL' ? 'critical' : 'high',
        requestedAt: alert.detectedAt.toISOString(),
        requester: 'Vigil Agent',
        context: {
          riskType: alert.riskType,
          affectedSection: alert.affectedSection,
          severity: alert.severity,
        },
        recommendation: {
          action: 'approve',
          reason: alert.recommendation || 'Review and address this issue',
          confidence: 0.85,
        },
        alternatives: [
          { action: 'reject', label: 'Acknowledge', reason: 'Accept risk and continue' },
          { action: 'escalate', label: 'Escalate', reason: 'Send to legal/compliance team' },
        ],
      })),

      // Renewal Alerts
      ...renewalAlerts.map(contract => {
        const daysToExpiry = contract.expirationDate 
          ? Math.ceil((contract.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0;

        return {
          id: `renewal-${contract.id}`,
          type: 'renewal_decision',
          category: 'contract',
          title: `Renewal Decision: ${contract.contractTitle}`,
          description: `Contract expires in ${daysToExpiry} days. Start renewal process?`,
          agentId: 'autonomous-deadline-manager',
          agentCodename: 'Clockwork',
          contractId: contract.id,
          priority: daysToExpiry <= 14 ? 'critical' : 'high',
          requestedAt: new Date().toISOString(),
          requester: 'Clockwork Agent',
          context: {
            daysToExpiry,
            expiryDate: contract.expirationDate?.toISOString(),
            contractValue: contract.totalValue,
          },
          recommendation: {
            action: 'approve',
            reason: `Start renewal now to avoid service disruption. ${daysToExpiry} days remaining.`,
            confidence: 0.9,
          },
          alternatives: [
            { action: 'reject', label: 'Auto-Renew', reason: 'Allow automatic renewal' },
            { action: 'defer', label: 'Snooze', reason: 'Remind me later' },
          ],
        };
      }),
    ];

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    approvals.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return createSuccessResponse(ctx, {
      approvals: approvals.slice(offset, offset + limit),
      pagination: {
        total: approvals.length,
        limit,
        offset,
        hasMore: offset + limit < approvals.length,
      },
      stats: {
        total: approvals.length,
        critical: approvals.filter(a => a.priority === 'critical').length,
        byCategory: approvals.reduce((acc, a) => {
          acc[a.category] = (acc[a.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch approvals:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to fetch approvals', 500);
  }
});

/**
 * POST /api/agents/approvals
 * Body: { actionId, action, notes?, modifications? }
 */
export const POST = withAuthApiHandler(async (req: NextRequest, ctx) => {
  const { tenantId, userId } = ctx;

  try {
    const body = await req.json();
    const { actionId, action, notes, modifications } = ApprovalActionSchema.parse(body);

    // Determine the type of approval and route accordingly
    let result;

    if (actionId.startsWith('goal-')) {
      const goalId = actionId.replace('goal-', '');
      result = await processGoalApproval(goalId, tenantId, action, notes, modifications);
    } else if (actionId.startsWith('rfx-')) {
      const rfxId = actionId.replace('rfx-', '');
      result = await processRfxApproval(rfxId, tenantId, action, notes, modifications);
    } else if (actionId.startsWith('renewal-')) {
      const contractId = actionId.replace('renewal-', '');
      result = await processRenewalApproval(contractId, tenantId, action, notes);
    } else if (actionId.startsWith('compliance-')) {
      const alertId = actionId.replace('compliance-', '');
      result = await processComplianceApproval(alertId, tenantId, userId, action, notes);
    } else {
      return createErrorResponse(ctx, 'INVALID_APPROVAL_TYPE', 'Unknown approval type', 400);
    }

    // Log the approval action
    await prisma.approvalAction.create({
      data: {
        tenantId,
        approvalId: actionId,
        approvalType: result.type,
        action,
        actorId: userId,
        notes,
        modifications,
      },
    });

    return createSuccessResponse(ctx, result);
  } catch (error) {
    logger.error('Failed to process approval:', error);
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to process approval', 500, {
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// APPROVAL PROCESSING FUNCTIONS
// ============================================================================

async function processGoalApproval(
  goalId: string,
  tenantId: string,
  action: string,
  notes?: string,
  modifications?: any
) {
  const goal = await prisma.agentGoal.findFirst({
    where: { id: goalId, tenantId },
  });

  if (!goal) {
    throw new Error('Goal not found');
  }

  switch (action) {
    case 'approve':
      await prisma.agentGoal.update({
        where: { id: goalId },
        data: {
          status: 'EXECUTING',
          approvedAt: new Date(),
          context: {
            ...(goal.context as Record<string, unknown>),
            approvalNotes: notes,
          },
        },
      });
      
      // Trigger goal execution
      await triggerGoalExecution(goalId, tenantId);
      
      return {
        type: 'agent_goal',
        status: 'approved',
        message: 'Goal approved and execution started',
      };

    case 'reject':
      await prisma.agentGoal.update({
        where: { id: goalId },
        data: {
          status: 'CANCELLED',
          completedAt: new Date(),
          context: {
            ...(goal.context as Record<string, unknown>),
            cancellationReason: notes || 'Rejected by user',
          },
        },
      });
      
      return {
        type: 'agent_goal',
        status: 'rejected',
        message: 'Goal rejected',
      };

    case 'modify':
      await prisma.agentGoal.update({
        where: { id: goalId },
        data: {
          status: 'PLANNING',
          context: {
            ...(goal.context as Record<string, unknown>),
            modifications: modifications || {},
            modificationNotes: notes,
          },
        },
      });
      
      return {
        type: 'agent_goal',
        status: 'modified',
        message: 'Modifications requested',
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function processRfxApproval(
  rfxId: string,
  tenantId: string,
  action: string,
  notes?: string,
  modifications?: any
) {
  const rfx = await prisma.rFxEvent.findFirst({
    where: { id: rfxId, tenantId },
  });

  if (!rfx) {
    throw new Error('RFx event not found');
  }

  switch (action) {
    case 'approve':
      // Use transaction to ensure both RFx update and contract creation succeed
      const { contract } = await prisma.$transaction(async (tx) => {
        await tx.rFxEvent.update({
          where: { id: rfxId },
          data: {
            status: 'awarded',
            awardDate: new Date(),
            awardJustification: notes || rfx.awardJustification,
          },
        });
        
        // Create contract from award
        const contract = await createContractFromAward(rfx, tenantId, tx);
        
        return { contract };
      });
      
      return {
        type: 'rfx_award',
        status: 'awarded',
        message: 'Award approved and contract created',
        contractId: contract.id,
      };

    case 'reject':
      await prisma.rFxEvent.update({
        where: { id: rfxId },
        data: {
          status: 'evaluating',
          awardJustification: notes ? `Rejected: ${notes}` : null,
        },
      });
      
      return {
        type: 'rfx_award',
        status: 'rejected',
        message: 'Award rejected - returning to evaluation',
      };

    case 'modify':
      await prisma.rFxEvent.update({
        where: { id: rfxId },
        data: {
          status: 'evaluating',
          awardJustification: notes ? `Negotiation requested: ${notes}` : 'Negotiation requested',
        },
      });
      
      return {
        type: 'rfx_award',
        status: 'negotiating',
        message: 'Negotiation requested',
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function processRenewalApproval(
  contractId: string,
  tenantId: string,
  action: string,
  notes?: string
) {
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, tenantId },
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  switch (action) {
    case 'approve':
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          renewalInitiatedAt: new Date(),
        },
      });
      
      // Create RFx for renewal
      const rfx = await prisma.rFxEvent.create({
        data: {
          tenantId,
          type: 'RFP',
          title: `Renewal: ${contract.contractTitle}`,
          description: `Competitive renewal for ${contract.contractTitle}`,
          status: 'draft',
          category: contract.contractType,
          estimatedValue: contract.annualValue
            ? Number(contract.annualValue)
            : contract.totalValue
              ? Number(contract.totalValue)
              : null,
          responseDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          createdBy: 'system',
        },
      });
      
      return {
        type: 'renewal_decision',
        status: 'renewal_started',
        message: 'Renewal process initiated',
        rfxId: rfx.id,
      };

    case 'reject':
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          renewalNotes: notes || 'Auto-renewal approved',
        },
      });
      
      return {
        type: 'renewal_decision',
        status: 'auto_renewal',
        message: 'Auto-renewal confirmed',
      };

    case 'defer':
      await prisma.contract.update({
        where: { id: contractId },
        data: {
          renewalNotes: `Snoozed until ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()}`,
        },
      });
      
      return {
        type: 'renewal_decision',
        status: 'snoozed',
        message: 'Renewal reminder snoozed for 7 days',
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function processComplianceApproval(
  alertId: string,
  tenantId: string,
  userId: string,
  action: string,
  notes?: string
) {
  const alert = await prisma.riskDetectionLog.findFirst({
    where: { id: alertId, tenantId },
  });

  if (!alert) {
    throw new Error('Alert not found');
  }

  switch (action) {
    case 'approve':
      await prisma.riskDetectionLog.update({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
          resolved: true,
          resolvedAt: new Date(),
        },
      });
      
      return {
        type: 'compliance_alert',
        status: 'reviewed',
        message: 'Alert reviewed and acknowledged',
      };

    case 'reject':
      await prisma.riskDetectionLog.update({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
        },
      });
      
      return {
        type: 'compliance_alert',
        status: 'risk_accepted',
        message: 'Risk accepted and logged',
      };

    case 'escalate':
      await prisma.riskDetectionLog.update({
        where: { id: alertId },
        data: {
          acknowledgedBy: `escalated:${userId}`,
        },
      });
      
      return {
        type: 'compliance_alert',
        status: 'escalated',
        message: 'Alert escalated to compliance team',
      };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function triggerGoalExecution(goalId: string, tenantId: string) {
  // Queue goal execution via BullMQ
  const { getQueueService } = await import('@repo/utils/queue/queue-service');
  const queueService = getQueueService();
  
  await queueService.addJob('goal-execution', 'execute-goal', {
    goalId,
    tenantId,
  }, {
    priority: 5,
    attempts: 3,
  });
}

async function createContractFromAward(rfx: any, tenantId: string, tx?: any) {
  const db = tx || prisma;
  
  // Calculate expiration from RFx requirements, fallback to 1 year
  const requirements = (rfx.requirements ?? {}) as Record<string, unknown>;
  const termMonths = (typeof requirements.termMonths === 'number' ? requirements.termMonths : null) || 12;
  const effectiveDate = new Date();
  const expirationDate = new Date(effectiveDate);
  expirationDate.setMonth(expirationDate.getMonth() + termMonths);
  
  // Create new contract record from RFx award
  const contract = await db.contract.create({
    data: {
      tenantId,
      contractTitle: `${rfx.title} - ${rfx.winner || 'TBD'}`,
      contractType: rfx.contractType || 'VENDOR_AGREEMENT',
      status: 'DRAFT',
      supplierName: rfx.winner || 'Pending',
      totalValue: rfx.estimatedValue,
      effectiveDate,
      expirationDate,
      importSource: 'API',
      sourceType: 'NEW',
      sourceMetadata: { rfxId: rfx.id, rfxType: rfx.type },
    },
  });
  
  return contract;
}

function getAgentCodename(agentType: string | null | undefined): string {
  const codenameMap: Record<string, string> = {
    'RENEWAL_MANAGEMENT': 'Clockwork',
    'COMPLIANCE_CHECK': 'Vigil',
    'RISK_ASSESSMENT': 'Warden',
    'OPPORTUNITY_DISCOVERY': 'Prospector',
    'VENDOR_CONSOLIDATION': 'Merchant',
    'RFX_DETECTION': 'Scout',
    'RFX_PROCUREMENT': 'Merchant',
    'ANALYTICS': 'Analyst',
    'SAVINGS_OPTIMIZATION': 'Prospector',
    'DOCUMENT_PROCESSING': 'Scribe',
    'CONTRACT_DRAFTING': 'Architect',
  };
  return codenameMap[agentType || ''] || 'Agent';
}

function mapPriorityNumeric(priority: number): string {
  if (priority <= 2) return 'critical';
  if (priority <= 4) return 'high';
  if (priority <= 6) return 'medium';
  return 'low';
}
