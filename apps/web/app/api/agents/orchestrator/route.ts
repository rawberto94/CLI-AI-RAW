/**
 * Autonomous Agent Orchestrator API
 * 
 * Endpoints for managing autonomous agent goals, triggers, and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getAutonomousOrchestrator } from '@repo/agents';

// ============================================================================
// GET - Get orchestrator status, goals, triggers, or notifications
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId || 'default';
    const { searchParams } = new URL(request.url);
    const resource = searchParams.get('resource') || 'status';
    
    const orchestrator = getAutonomousOrchestrator();

    switch (resource) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: orchestrator.getStatus()
        });

      case 'goals':
        const goalStatus = searchParams.get('status') || undefined;
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        
        return NextResponse.json({
          success: true,
          data: orchestrator.getGoals(tenantId, { status: goalStatus, limit, offset })
        });

      case 'goal':
        const goalId = searchParams.get('id');
        if (!goalId) {
          return NextResponse.json({ error: 'Goal ID required' }, { status: 400 });
        }
        
        const goal = orchestrator.getGoal(goalId);
        if (!goal) {
          return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          data: goal
        });

      case 'triggers':
        return NextResponse.json({
          success: true,
          data: orchestrator.getTriggers(tenantId)
        });

      case 'notifications':
        const unreadOnly = searchParams.get('unreadOnly') === 'true';
        
        return NextResponse.json({
          success: true,
          data: orchestrator.getNotifications(tenantId, unreadOnly)
        });

      default:
        return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
  } catch (error) {
    console.error('Autonomous orchestrator GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create goals, register triggers, approve goals
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as { tenantId?: string }).tenantId || 'default';
    const body = await request.json();
    const { action } = body;
    
    const orchestrator = getAutonomousOrchestrator();

    switch (action) {
      case 'create_goal':
        const { type, description, priority, metadata } = body;
        
        if (!type || !description) {
          return NextResponse.json(
            { error: 'Goal type and description required' },
            { status: 400 }
          );
        }
        
        const goal = await orchestrator.createGoal(tenantId, type, description, {
          priority,
          metadata,
          trigger: {
            type: 'user_request',
            source: 'api'
          }
        });
        
        return NextResponse.json({
          success: true,
          data: goal,
          message: 'Goal created and queued for execution'
        });

      case 'cancel_goal':
        const { goalId, reason } = body;
        
        if (!goalId) {
          return NextResponse.json({ error: 'Goal ID required' }, { status: 400 });
        }
        
        const cancelled = await orchestrator.cancelGoal(goalId, reason);
        
        return NextResponse.json({
          success: cancelled,
          message: cancelled ? 'Goal cancelled' : 'Unable to cancel goal'
        });

      case 'register_trigger':
        const { name, triggerType, condition, goalTemplate, enabled = true } = body;
        
        if (!name || !triggerType || !condition || !goalTemplate) {
          return NextResponse.json(
            { error: 'Trigger name, type, condition, and goal template required' },
            { status: 400 }
          );
        }
        
        const trigger = orchestrator.registerTrigger({
          tenantId,
          name,
          type: triggerType,
          enabled,
          condition,
          goalTemplate
        });
        
        return NextResponse.json({
          success: true,
          data: trigger,
          message: 'Trigger registered successfully'
        });

      case 'toggle_trigger':
        const { triggerId, triggerEnabled } = body;
        
        if (!triggerId || triggerEnabled === undefined) {
          return NextResponse.json(
            { error: 'Trigger ID and enabled state required' },
            { status: 400 }
          );
        }
        
        const updated = orchestrator.setTriggerEnabled(triggerId, triggerEnabled);
        
        return NextResponse.json({
          success: updated,
          message: updated 
            ? `Trigger ${triggerEnabled ? 'enabled' : 'disabled'}` 
            : 'Trigger not found'
        });

      case 'mark_notification_read':
        const { notificationId } = body;
        
        if (!notificationId) {
          return NextResponse.json(
            { error: 'Notification ID required' },
            { status: 400 }
          );
        }
        
        const marked = orchestrator.markNotificationRead(tenantId, notificationId);
        
        return NextResponse.json({
          success: marked,
          message: marked ? 'Notification marked as read' : 'Notification not found'
        });

      case 'start_processing':
        orchestrator.startProcessing();
        
        return NextResponse.json({
          success: true,
          message: 'Orchestrator started processing'
        });

      case 'stop_processing':
        orchestrator.stopProcessing();
        
        return NextResponse.json({
          success: true,
          message: 'Orchestrator stopping (will finish current goal)'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Autonomous orchestrator POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update goals or triggers
// ============================================================================

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { resource, id, updates } = body;
    
    // In a full implementation, this would update goals/triggers in the database
    // For now, we return a success response
    
    return NextResponse.json({
      success: true,
      message: `${resource} ${id} updated`
    });
  } catch (error) {
    console.error('Autonomous orchestrator PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
