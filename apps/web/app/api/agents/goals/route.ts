/**
 * Agent Goals API - Human-in-the-Loop Approval System
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AgentGoalStatus } from '@prisma/client';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';
import { monitoringService } from 'data-orchestration/services';
import { broadcastSSE } from '@/app/api/agents/sse/route';
import { sendHITLApprovalNotification, sendHITLDecisionNotification } from '@/lib/notifications/hitl-notification.service';
import { logger } from '@/lib/logger';

/**
 * Add a goal execution job to the queue (BullMQ via shared QueueService or fallback)
 */
async function queueGoalExecution(goalId: string, tenantId: string): Promise<void> {
  try {
    // Use the shared singleton QueueService — avoids creating a new Redis connection per request
    const { getInitializedQueueService } = await import('@/lib/queue-init');
    const queueService = getInitializedQueueService();
    if (queueService) {
      await queueService.addJob('agent-orchestration', 'execute-goal', { goalId, tenantId }, {
        attempts: 3,
        delay: 5000,
      });
      logger.warn(`[Agent Goals] Queued goal execution: ${goalId}`);
      return;
    }
  } catch (error) {
    logger.error('[Agent Goals] QueueService queueing failed:', error);
    // Fall through to webhook/logging
  }

  // Fallback: Log for manual processing or trigger webhook
  logger.warn(`[Agent Goals] Manual execution needed for goal: ${goalId}`);

  // In production, trigger a webhook or serverless function
  if (process.env.AGENT_WEBHOOK_URL) {
    try {
      await fetch(process.env.AGENT_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AGENT_WEBHOOK_SECRET || ''}`
        },
        body: JSON.stringify({ event: 'goal.approved', goalId, tenantId }) });
    } catch (err) {
      logger.error('[Agent Goals] Webhook trigger failed:', err);
    }
  }
}

// GET - List goals awaiting approval
export const GET = withAuthApiHandler(async (request, ctx) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0') || 0);

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: ctx.tenantId };

    if (status === 'awaiting') {
      where.status = AgentGoalStatus.AWAITING_APPROVAL;
    } else if (status) {
      where.status = status.toUpperCase() as AgentGoalStatus;
    }

    // Fetch goals with steps
    const [goals, total] = await Promise.all([
      prisma.agentGoal.findMany({
        where,
        include: {
          steps: {
            orderBy: { order: 'asc' } },
          triggers: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset }),
      prisma.agentGoal.count({ where }),
    ]);

    return createSuccessResponse(ctx, {
      goals,
      total,
      limit,
      offset,
      hasMore: offset + goals.length < total });

  });

// POST - Approve or reject a goal
export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { goalId, action, feedback } = body;

    if (!goalId || !action) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Missing goalId or action', 400);
    }

    if (!['approve', 'reject', 'modify'].includes(action)) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action. Must be approve, reject, or modify', 400);
    }

    // Fetch the goal
    const goal = await prisma.agentGoal.findFirst({
      where: {
        id: goalId,
        tenantId: ctx.tenantId } });

    if (!goal) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Goal not found', 404);
    }

    if (goal.status !== 'AWAITING_APPROVAL') {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Goal is not awaiting approval', 400);
    }

    // Update goal based on action
    let updatedGoal;

    switch (action) {
      case 'approve':
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            status: AgentGoalStatus.EXECUTING,
            approvedBy: ctx.userId,
            approvedAt: new Date() } });
        
        // Trigger agent execution via queue
        await queueGoalExecution(goalId, ctx.tenantId);
        break;

      case 'reject':
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            status: AgentGoalStatus.CANCELLED,
            error: feedback, // Store rejection reason in error field
            completedAt: new Date() } });
        break;

      case 'modify':
        // Keep in awaiting state — accept feedback alone or an optional modified plan
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            ...(body.modifiedPlan ? { plan: body.modifiedPlan } : {}),
            error: feedback || 'Changes requested', // Store modification notes
            status: AgentGoalStatus.AWAITING_APPROVAL, // Stay in awaiting state
          } });
        break;

      default:
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid action', 400);
    }

    // Log the approval action
    await prisma.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: `AGENT_GOAL_${action.toUpperCase()}`,
        resourceType: 'AgentGoal',
        entityId: goalId,
        details: {
          goalTitle: goal.title,
          previousStatus: goal.status,
          newStatus: updatedGoal.status,
          feedback } } });

    // Broadcast real-time SSE event to connected subscribers
    broadcastSSE(ctx.tenantId, `goal_${action}d`, {
      goalId,
      action,
      status: updatedGoal.status,
      title: goal.title,
      approvedBy: action === 'approve' ? ctx.userId : undefined,
      timestamp: new Date().toISOString(),
    });

    // Send out-of-browser decision notifications (Slack, push, etc.)
    sendHITLDecisionNotification(
      ctx.tenantId,
      goalId,
      goal.title,
      action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'modified',
      ctx.userId,
    ).catch(() => {}); // fire-and-forget

    return createSuccessResponse(ctx, {
      goal: updatedGoal,
      message: `Goal ${action}d successfully` });

  });
