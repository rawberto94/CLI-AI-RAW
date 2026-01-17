/**
 * Workflow Orchestrator API
 * 
 * Full integration between workflows and the autonomous orchestrator.
 * Provides endpoints for:
 * - Automated workflow triggering
 * - Goal-based workflow management
 * - Escalation automation
 * - Workflow analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getWorkflowManagementService } from '@repo/data-orchestration';
import { getAutonomousOrchestrator } from '@repo/agents';
import { prisma } from '@repo/database';

// ============================================================================
// GET - Get orchestrator workflow status and metrics
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId || 'default';
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    const workflowService = getWorkflowManagementService();
    const orchestrator = getAutonomousOrchestrator();

    switch (action) {
      case 'status': {
        // Get overall orchestrator status with workflow metrics
        const [activeExecutions, pendingSteps, overdueSteps, recentGoals] = await Promise.all([
          prisma.workflowExecution.count({
            where: {
              tenantId,
              status: { in: ['PENDING', 'IN_PROGRESS'] }
            }
          }),
          prisma.workflowStepExecution.count({
            where: {
              execution: { tenantId },
              status: 'PENDING'
            }
          }),
          prisma.workflowStepExecution.count({
            where: {
              execution: { tenantId },
              status: 'PENDING',
              dueDate: { lt: new Date() }
            }
          }),
          prisma.agentGoal?.count({
            where: {
              tenantId,
              status: { in: ['pending', 'in_progress'] },
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          }).catch(() => 0) // AgentGoal might not exist yet
        ]);

        return NextResponse.json({
          success: true,
          data: {
            orchestrator: {
              status: 'active',
              triggersActive: true,
              lastCheck: new Date().toISOString()
            },
            workflows: {
              activeExecutions,
              pendingSteps,
              overdueSteps,
              overduePercentage: pendingSteps > 0 
                ? Math.round((overdueSteps / pendingSteps) * 100) 
                : 0
            },
            goals: {
              recentCount: recentGoals
            }
          }
        });
      }

      case 'triggers': {
        // Get active workflow triggers
        const triggers = [
          {
            id: 'workflow-escalation-check',
            name: 'Workflow Escalation Check',
            description: 'Checks for overdue workflow steps and escalates',
            schedule: 'Every 4 hours',
            lastRun: null,
            nextRun: null,
            enabled: true
          },
          {
            id: 'auto-start-workflows',
            name: 'Auto-Start Workflows',
            description: 'Automatically starts workflows for new contracts',
            schedule: 'Event-driven (contract upload)',
            lastRun: null,
            nextRun: 'On next contract upload',
            enabled: true
          },
          {
            id: 'daily-workflow-review',
            name: 'Daily Workflow Review',
            description: 'Reviews all pending workflows and sends reminders',
            schedule: 'Daily at 9:00 AM',
            lastRun: null,
            nextRun: null,
            enabled: true
          }
        ];

        return NextResponse.json({
          success: true,
          data: { triggers }
        });
      }

      case 'analytics': {
        // Get workflow analytics
        const timeRange = searchParams.get('range') || '30d';
        const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [completed, rejected, avgDuration] = await Promise.all([
          prisma.workflowExecution.count({
            where: {
              tenantId,
              status: 'COMPLETED',
              completedAt: { gte: startDate }
            }
          }),
          prisma.workflowExecution.count({
            where: {
              tenantId,
              status: 'REJECTED',
              completedAt: { gte: startDate }
            }
          }),
          prisma.workflowExecution.findMany({
            where: {
              tenantId,
              status: 'COMPLETED',
              completedAt: { gte: startDate }
            },
            select: {
              startedAt: true,
              completedAt: true
            }
          })
        ]);

        // Calculate average duration
        let avgDurationHours = 0;
        if (avgDuration.length > 0) {
          const totalMs = avgDuration.reduce((sum, exec) => {
            if (exec.startedAt && exec.completedAt) {
              return sum + (exec.completedAt.getTime() - exec.startedAt.getTime());
            }
            return sum;
          }, 0);
          avgDurationHours = Math.round((totalMs / avgDuration.length) / (1000 * 60 * 60) * 10) / 10;
        }

        return NextResponse.json({
          success: true,
          data: {
            timeRange,
            completed,
            rejected,
            total: completed + rejected,
            approvalRate: completed + rejected > 0 
              ? Math.round((completed / (completed + rejected)) * 100) 
              : 0,
            avgDurationHours
          }
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, triggers, or analytics' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Workflow orchestrator GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Execute orchestrator actions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId || 'default';
    const userId = session.user.id || 'unknown';
    const body = await request.json();
    const { action } = body;

    const orchestrator = getAutonomousOrchestrator();

    switch (action) {
      case 'create_goal': {
        // Create a workflow-related goal for the orchestrator
        const { goalType, description, contractId, priority } = body;
        
        if (!goalType || !description) {
          return NextResponse.json(
            { error: 'Goal type and description are required' },
            { status: 400 }
          );
        }

        const goal = await orchestrator.createGoal({
          type: goalType,
          description,
          context: {
            tenantId,
            userId,
            contractId,
            priority: priority || 'medium'
          }
        });

        return NextResponse.json({
          success: true,
          data: goal,
          message: `Created workflow goal: ${description}`
        });
      }

      case 'run_escalation_check': {
        // Manually trigger escalation check
        const result = await orchestrator.checkWorkflowEscalations();

        return NextResponse.json({
          success: true,
          data: result,
          message: `Escalation check complete: ${result.escalated} escalated, ${result.reminders} reminders`
        });
      }

      case 'suggest_for_contracts': {
        // Suggest workflows for contracts without them
        const contractsWithoutWorkflow = await prisma.contract.findMany({
          where: {
            tenantId,
            status: 'DRAFT',
            executions: { none: {} }
          },
          select: {
            id: true,
            contractTitle: true,
            fileName: true
          },
          take: 10
        });

        const suggestions = await Promise.all(
          contractsWithoutWorkflow.map(async (contract) => {
            const result = await orchestrator.startWorkflowForContract(
              contract.id,
              tenantId,
              { autoSelect: true }
            );
            return {
              contractId: contract.id,
              contractTitle: contract.contractTitle || contract.fileName,
              suggestion: result
            };
          })
        );

        return NextResponse.json({
          success: true,
          data: {
            contractsAnalyzed: suggestions.length,
            suggestions
          },
          message: `Analyzed ${suggestions.length} contracts for workflow suggestions`
        });
      }

      case 'auto_approve_low_risk': {
        // Auto-approve pending steps for low-risk contracts (with approval)
        const { confirm } = body;
        
        // First, just identify candidates
        const candidates = await prisma.workflowStepExecution.findMany({
          where: {
            execution: { tenantId },
            status: 'PENDING',
            step: {
              // Only auto-approve review steps (not final approvals)
              name: { contains: 'review', mode: 'insensitive' }
            }
          },
          include: {
            step: true,
            execution: {
              include: {
                contract: {
                  include: {
                    extractedData: true
                  }
                }
              }
            }
          }
        });

        // Filter for low-value contracts (under $10,000)
        const lowRiskCandidates = candidates.filter(c => {
          const valueField = c.execution.contract?.extractedData?.find(
            (d: { fieldName: string }) => d.fieldName === 'contract_value'
          );
          const value = valueField ? parseFloat(valueField.fieldValue) : 0;
          return value < 10000;
        });

        if (!confirm) {
          return NextResponse.json({
            success: true,
            data: {
              candidateCount: lowRiskCandidates.length,
              candidates: lowRiskCandidates.map(c => ({
                executionId: c.executionId,
                stepName: c.step.name,
                contractTitle: c.execution.contract?.contractTitle
              })),
              message: 'Review these candidates and confirm to auto-approve'
            },
            requiresConfirmation: true
          });
        }

        // Process auto-approvals
        let approved = 0;
        for (const candidate of lowRiskCandidates) {
          const result = await orchestrator.processWorkflowAction(
            candidate.executionId,
            candidate.stepId,
            'approve',
            'system-auto',
            { comment: 'Auto-approved: Low-risk contract' }
          );
          if (result.success) approved++;
        }

        return NextResponse.json({
          success: true,
          data: {
            processed: lowRiskCandidates.length,
            approved,
            failed: lowRiskCandidates.length - approved
          },
          message: `Auto-approved ${approved} low-risk workflow steps`
        });
      }

      case 'bulk_delegate': {
        // Delegate all pending steps for a user to another user
        const { fromUserId, toUserId, reason } = body;
        
        if (!fromUserId || !toUserId) {
          return NextResponse.json(
            { error: 'From and to user IDs are required' },
            { status: 400 }
          );
        }

        const pendingSteps = await prisma.workflowStepExecution.findMany({
          where: {
            execution: { tenantId },
            status: 'PENDING',
            assignedTo: fromUserId
          }
        });

        let delegated = 0;
        for (const step of pendingSteps) {
          const result = await orchestrator.processWorkflowAction(
            step.executionId,
            step.stepId,
            'delegate',
            userId,
            { delegateTo: toUserId, comment: reason || 'Bulk delegation' }
          );
          if (result.success) delegated++;
        }

        return NextResponse.json({
          success: true,
          data: {
            processed: pendingSteps.length,
            delegated,
            failed: pendingSteps.length - delegated,
            fromUserId,
            toUserId
          },
          message: `Delegated ${delegated} workflow steps from ${fromUserId} to ${toUserId}`
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Workflow orchestrator POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
