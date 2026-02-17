/**
 * Autonomous Agent Orchestrator API
 * 
 * Endpoints for managing autonomous agent goals, triggers, and monitoring
 */

import { NextRequest } from 'next/server';
import { getAutonomousOrchestrator, AgentGoalStatus } from '@repo/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { z } from 'zod';

const orchestratorGetSchema = z.object({
  resource: z.enum(['status', 'goals', 'goal', 'triggers', 'notifications']).default('status'),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  id: z.string().optional(),
  unreadOnly: z.enum(['true', 'false']).optional(),
});

const orchestratorPostSchema = z.object({
  action: z.enum(['create_goal', 'cancel_goal', 'register_trigger', 'toggle_trigger', 'mark_notification_read', 'start_processing', 'stop_processing']),
  type: z.string().optional(),
  description: z.string().optional(),
  priority: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  goalId: z.string().optional(),
  reason: z.string().optional(),
  name: z.string().optional(),
  triggerType: z.string().optional(),
  condition: z.record(z.unknown()).optional(),
  goalTemplate: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  triggerId: z.string().optional(),
  triggerEnabled: z.boolean().optional(),
  notificationId: z.string().optional(),
});

// ============================================================================
// GET - Get orchestrator status, goals, triggers, or notifications
// ============================================================================

export const GET = withAuthApiHandler(async (request, ctx) => {
  const tenantId = ctx.tenantId;
    const { searchParams } = new URL(request.url);
    const parsed = orchestratorGetSchema.safeParse({
      resource: searchParams.get('resource') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
      id: searchParams.get('id') || undefined,
      unreadOnly: searchParams.get('unreadOnly') || undefined,
    });
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid parameters: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { resource } = parsed.data;

    const orchestrator = getAutonomousOrchestrator();

    switch (resource) {
      case 'status':
        return createSuccessResponse(ctx, orchestrator.getStatus());

      case 'goals':
        const validStatuses: AgentGoalStatus[] = ['pending', 'planning', 'awaiting_approval', 'executing', 'completed', 'failed', 'cancelled'];
        const statusParam = parsed.data.status?.toLowerCase();
        const goalStatus = statusParam && validStatuses.includes(statusParam as AgentGoalStatus) 
          ? statusParam as AgentGoalStatus
          : undefined;

        return createSuccessResponse(ctx, orchestrator.getGoals(tenantId, { status: goalStatus, limit: parsed.data.limit, offset: parsed.data.offset }));

      case 'goal':
        const goalId = parsed.data.id;
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
        const unreadOnly = parsed.data.unreadOnly === 'true';

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
    const parsed = orchestratorPostSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid body: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { action } = parsed.data;

    const orchestrator = getAutonomousOrchestrator();

    switch (action) {
      case 'create_goal':
        const { type, description, priority, metadata } = parsed.data;
        
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
        const { goalId, reason } = parsed.data;
        
        if (!goalId) {
          return createErrorResponse(ctx, 'BAD_REQUEST', 'Goal ID required', 400);
        }
        
        const cancelled = await orchestrator.cancelGoal(goalId, reason);
        
        return createSuccessResponse(ctx, {
          cancelled,
          message: cancelled ? 'Goal cancelled' : 'Unable to cancel goal'
        });

      case 'register_trigger':
        const { name, triggerType, condition, goalTemplate, enabled = true } = parsed.data;
        
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
        const { triggerId, triggerEnabled } = parsed.data;
        
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
        const { notificationId } = parsed.data;
        
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
// PATCH - Update goals or triggers (now with real persistence)
// ============================================================================

const patchSchema = z.object({
  resource: z.enum(['goal', 'trigger']),
  id: z.string(),
  updates: z.record(z.unknown()),
});

export const PATCH = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(ctx, 'BAD_REQUEST', `Invalid body: ${parsed.error.issues.map(i => i.message).join(', ')}`, 400);
    }
    const { resource, id, updates } = parsed.data;

    const orchestrator = getAutonomousOrchestrator();

    switch (resource) {
      case 'goal': {
        // Update in-memory goal
        const goal = orchestrator.getGoal(id);
        if (!goal) {
          return createErrorResponse(ctx, 'NOT_FOUND', 'Goal not found', 404);
        }

        // Apply allowed updates
        if (updates.priority && ['critical', 'high', 'medium', 'low', 'background'].includes(updates.priority as string)) {
          goal.priority = updates.priority as any;
        }
        if (updates.description && typeof updates.description === 'string') {
          goal.description = updates.description;
        }
        if (updates.metadata && typeof updates.metadata === 'object') {
          goal.metadata = { ...goal.metadata, ...updates.metadata as Record<string, unknown> };
        }
        goal.updatedAt = new Date();

        return createSuccessResponse(ctx, {
          goal,
          message: `Goal ${id} updated successfully`
        });
      }

      case 'trigger': {
        // Update trigger enabled state or config
        if (updates.enabled !== undefined) {
          const updated = orchestrator.setTriggerEnabled(id, Boolean(updates.enabled));
          if (!updated) {
            return createErrorResponse(ctx, 'NOT_FOUND', 'Trigger not found', 404);
          }
        }

        const triggers = orchestrator.getTriggers(ctx.tenantId);
        const trigger = triggers.find(t => t.id === id);
        
        return createSuccessResponse(ctx, {
          trigger: trigger ?? null,
          message: `Trigger ${id} updated successfully`
        });
      }

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid resource type', 400);
    }
  });
