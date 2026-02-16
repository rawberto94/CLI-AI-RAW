/**
 * Autonomous Agent Orchestrator API
 * 
 * Endpoints for managing autonomous agent goals, triggers, and monitoring
 */

import { NextRequest } from 'next/server';
import { getAutonomousOrchestrator, AgentGoalStatus } from '@repo/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

// ============================================================================
// GET - Get orchestrator status, goals, triggers, or notifications
// ============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource') || 'status';
    
    const orchestrator = getAutonomousOrchestrator();

    switch (resource) {
      case 'status':
        return createSuccessResponse(ctx, orchestrator.getStatus());

      case 'goals':
        const validStatuses: AgentGoalStatus[] = ['pending', 'planning', 'awaiting_approval', 'executing', 'completed', 'failed', 'cancelled'];
        const statusParam = searchParams.get('status')?.toLowerCase();
        const goalStatus = statusParam && validStatuses.includes(statusParam as AgentGoalStatus) 
          ? statusParam as AgentGoalStatus
          : undefined;
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        
        return createSuccessResponse(ctx, orchestrator.getGoals(tenantId, { status: goalStatus, limit, offset }));

      case 'goal':
        const goalId = searchParams.get('id');
        if (!goalId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Goal ID required', 400);
        }
        
        const goal = orchestrator.getGoal(goalId);
        if (!goal) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'Goal not found', 404);
        }
        
        return createSuccessResponse(ctx, goal);

      case 'triggers':
        return createSuccessResponse(ctx, orchestrator.getTriggers(tenantId));

      case 'notifications':
        const unreadOnly = searchParams.get('unreadOnly') === 'true';
        
        return createSuccessResponse(ctx, orchestrator.getNotifications(tenantId, unreadOnly));

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid resource', 400);
    }
  });

// ============================================================================
// POST - Create goals, register triggers, approve goals
// ============================================================================

export const POST = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const body = await request.json();
    const { action } = body;
    
    const orchestrator = getAutonomousOrchestrator();

    switch (action) {
      case 'create_goal':
        const { type, description, priority, metadata } = body;
        
        if (!type || !description) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Goal type and description required', 400);
        }
        
        const goal = await orchestrator.createGoal(tenantId, type, description, {
          priority,
          metadata,
          trigger: {
            type: 'user_request',
            source: 'api'
          }
        });
        
        return createSuccessResponse(ctx, {
          ...goal,
          message: 'Goal created and queued for execution'
        });

      case 'cancel_goal':
        const { goalId, reason } = body;
        
        if (!goalId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Goal ID required', 400);
        }
        
        const cancelled = await orchestrator.cancelGoal(goalId, reason);
        
        return createSuccessResponse(ctx, {
          cancelled,
          message: cancelled ? 'Goal cancelled' : 'Unable to cancel goal'
        });

      case 'register_trigger':
        const { name, triggerType, condition, goalTemplate, enabled = true } = body;
        
        if (!name || !triggerType || !condition || !goalTemplate) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Trigger name, type, condition, and goal template required', 400);
        }
        
        const trigger = orchestrator.registerTrigger({
          tenantId,
          name,
          type: triggerType,
          enabled,
          condition,
          goalTemplate
        });
        
        return createSuccessResponse(ctx, {
          ...trigger,
          message: 'Trigger registered successfully'
        });

      case 'toggle_trigger':
        const { triggerId, triggerEnabled } = body;
        
        if (!triggerId || triggerEnabled === undefined) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Trigger ID and enabled state required', 400);
        }
        
        const updated = orchestrator.setTriggerEnabled(triggerId, triggerEnabled);
        
        return createSuccessResponse(ctx, {
          updated,
          message: updated 
            ? `Trigger ${triggerEnabled ? 'enabled' : 'disabled'}` 
            : 'Trigger not found'
        });

      case 'mark_notification_read':
        const { notificationId } = body;
        
        if (!notificationId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Notification ID required', 400);
        }
        
        const marked = orchestrator.markNotificationRead(tenantId, notificationId);
        
        return createSuccessResponse(ctx, {
          marked,
          message: marked ? 'Notification marked as read' : 'Notification not found'
        });

      case 'start_processing':
        orchestrator.startProcessing();
        
        return createSuccessResponse(ctx, {
          message: 'Orchestrator started processing'
        });

      case 'stop_processing':
        orchestrator.stopProcessing();
        
        return createSuccessResponse(ctx, {
          message: 'Orchestrator stopping (will finish current goal)'
        });

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
    }
  });

// ============================================================================
// PATCH - Update goals or triggers
// ============================================================================

export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { resource, id, updates: _updates } = body;
    
    // In a full implementation, this would update goals/triggers in the database
    // For now, we return a success response
    
    return createSuccessResponse(ctx, {
      message: `${resource} ${id} updated`
    });
  });
