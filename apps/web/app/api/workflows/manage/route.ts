/**
 * Workflow Management API
 * 
 * Advanced workflow management with autonomous orchestrator integration
 * Handles workflow suggestions, auto-start, escalations, and step processing
 */

import { NextRequest } from 'next/server';
import { getSessionTenantId } from '@/lib/tenant-server';
import { getWorkflowManagementService } from 'data-orchestration/services';
import { getAutonomousOrchestrator } from '@repo/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// GET - Get pending approvals for the current user
// ============================================================================

export const GET = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = getSessionTenantId(session);
  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const limit = parseInt(searchParams.get('limit') || '50');

  const workflowService = getWorkflowManagementService();

  const pending = await workflowService.getPendingApprovals(tenantId, {
    userId,
    role: role || undefined,
    limit
  });

  return createSuccessResponse(ctx, {
    success: true,
    data: pending,
    count: pending.length
  });
});

// ============================================================================
// POST - Start workflow, process step, or suggest workflow
// ============================================================================

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  if (!session?.user) {
    return createErrorResponse(ctx, 'UNAUTHORIZED', 'Unauthorized', 401);
  }

  const tenantId = getSessionTenantId(session);
  const userId = session.user.id || 'unknown';
  const body = await request.json();
  const { action } = body;

  const orchestrator = getAutonomousOrchestrator();

  switch (action) {
    case 'start': {
      // Start a workflow for a contract
      const { contractId, workflowId, autoSelect, dueDate } = body;

      if (!contractId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
      }

      const result = await orchestrator.startWorkflowForContract(
        contractId,
        tenantId,
        {
          workflowId,
          initiatedBy: userId,
          dueDate: dueDate ? new Date(dueDate) : undefined,
          autoSelect: autoSelect ?? !workflowId
        }
      );

      return createSuccessResponse(ctx, {
        success: result.success,
        data: result,
        message: result.executionId 
          ? `Workflow "${result.workflowName}" started`
          : result.error || `Suggested workflow: ${result.workflowName}`
      });
    }

    case 'approve': {
      const { executionId, stepId, comment } = body;

      if (!executionId || !stepId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Execution ID and step ID are required', 400);
      }

      const result = await orchestrator.processWorkflowAction(
        executionId,
        stepId,
        'approve',
        userId,
        { comment }
      );

      return createSuccessResponse(ctx, {
        success: result.success,
        data: result,
        message: result.message
      });
    }

    case 'reject': {
      const { executionId, stepId, comment } = body;

      if (!executionId || !stepId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Execution ID and step ID are required', 400);
      }

      const result = await orchestrator.processWorkflowAction(
        executionId,
        stepId,
        'reject',
        userId,
        { comment }
      );

      return createSuccessResponse(ctx, {
        success: result.success,
        data: result,
        message: result.message
      });
    }

    case 'delegate': {
      const { executionId, stepId, delegateTo, comment } = body;

      if (!executionId || !stepId || !delegateTo) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Execution ID, step ID, and delegate target are required', 400);
      }

      const result = await orchestrator.processWorkflowAction(
        executionId,
        stepId,
        'delegate',
        userId,
        { delegateTo, comment }
      );

      return createSuccessResponse(ctx, {
        success: result.success,
        data: result,
        message: result.message
      });
    }

    case 'request_changes': {
      const { executionId, stepId, comment } = body;

      if (!executionId || !stepId || !comment) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Execution ID, step ID, and comment are required', 400);
      }

      const result = await orchestrator.processWorkflowAction(
        executionId,
        stepId,
        'request_changes',
        userId,
        { comment }
      );

      return createSuccessResponse(ctx, {
        success: result.success,
        data: result,
        message: result.message
      });
    }

    case 'get_progress': {
      const { executionId } = body;

      if (!executionId) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Execution ID is required', 400);
      }

      const progress = await orchestrator.getWorkflowProgress(executionId);

      if (!progress) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Execution not found', 404);
      }

      return createSuccessResponse(ctx, {
        success: true,
        data: progress
      });
    }

    case 'check_escalations': {
      // Trigger escalation check (admin only)
      const result = await orchestrator.checkWorkflowEscalations();

      return createSuccessResponse(ctx, {
        success: true,
        data: result,
        message: `Checked escalations: ${result.escalated} escalated, ${result.reminders} reminders sent`
      });
    }

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
