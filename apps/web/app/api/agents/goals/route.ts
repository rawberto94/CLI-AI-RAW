/**
 * Agent Goals API - Human-in-the-Loop Approval System
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AgentGoalStatus } from '@prisma/client';

// GET - List goals awaiting approval
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    const where: Record<string, unknown> = {
      tenantId: session.user.tenantId,
    };

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
            orderBy: { order: 'asc' },
          },
          triggers: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentGoal.count({ where }),
    ]);

    return NextResponse.json({
      goals,
      total,
      limit,
      offset,
      hasMore: offset + goals.length < total,
    });

  } catch (error) {
    console.error('Failed to fetch agent goals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

// POST - Approve or reject a goal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { goalId, action, feedback } = body;

    if (!goalId || !action) {
      return NextResponse.json(
        { error: 'Missing goalId or action' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'modify'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be approve, reject, or modify' },
        { status: 400 }
      );
    }

    // Fetch the goal
    const goal = await prisma.agentGoal.findFirst({
      where: {
        id: goalId,
        tenantId: session.user.tenantId,
      },
    });

    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      );
    }

    if (goal.status !== 'AWAITING_APPROVAL') {
      return NextResponse.json(
        { error: 'Goal is not awaiting approval' },
        { status: 400 }
      );
    }

    // Update goal based on action
    let updatedGoal;

    switch (action) {
      case 'approve':
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            status: AgentGoalStatus.EXECUTING,
            approvedBy: session.user.id,
            approvedAt: new Date(),
          },
        });
        
        // TODO: Trigger agent execution via queue
        // await jobQueue.add('agent-execute-goal', { goalId });
        break;

      case 'reject':
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            status: AgentGoalStatus.CANCELLED,
            error: feedback, // Store rejection reason in error field
            completedAt: new Date(),
          },
        });
        break;

      case 'modify':
        // Keep in awaiting state but update the plan
        if (!body.modifiedPlan) {
          return NextResponse.json(
            { error: 'Modified plan required for modify action' },
            { status: 400 }
          );
        }
        
        updatedGoal = await prisma.agentGoal.update({
          where: { id: goalId },
          data: {
            plan: body.modifiedPlan,
            error: feedback, // Store modification notes
          },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Log the approval action
    await prisma.auditLog.create({
      data: {
        tenantId: session.user.tenantId,
        userId: session.user.id,
        action: `AGENT_GOAL_${action.toUpperCase()}`,
        resourceType: 'AgentGoal',
        entityId: goalId,
        details: {
          goalTitle: goal.title,
          previousStatus: goal.status,
          newStatus: updatedGoal.status,
          feedback,
        },
      },
    });

    return NextResponse.json({
      success: true,
      goal: updatedGoal,
      message: `Goal ${action}d successfully`,
    });

  } catch (error) {
    console.error('Failed to process goal action:', error);
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
