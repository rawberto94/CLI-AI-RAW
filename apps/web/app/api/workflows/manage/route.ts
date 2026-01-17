/**
 * Workflow Management API
 * 
 * Advanced workflow management with autonomous orchestrator integration
 * Handles workflow suggestions, auto-start, escalations, and step processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getWorkflowManagementService } from '@repo/data-orchestration';
import { getAutonomousOrchestrator } from '@repo/agents';

// ============================================================================
// GET - Get pending approvals for the current user
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = session.user.tenantId || 'default';
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

    return NextResponse.json({
      success: true,
      data: pending,
      count: pending.length
    });
  } catch (error) {
    console.error('Pending approvals GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Start workflow, process step, or suggest workflow
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
      case 'start': {
        // Start a workflow for a contract
        const { contractId, workflowId, autoSelect, dueDate } = body;
        
        if (!contractId) {
          return NextResponse.json(
            { error: 'Contract ID is required' },
            { status: 400 }
          );
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
        
        return NextResponse.json({
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
          return NextResponse.json(
            { error: 'Execution ID and step ID are required' },
            { status: 400 }
          );
        }
        
        const result = await orchestrator.processWorkflowAction(
          executionId,
          stepId,
          'approve',
          userId,
          { comment }
        );
        
        return NextResponse.json({
          success: result.success,
          data: result,
          message: result.message
        });
      }

      case 'reject': {
        const { executionId, stepId, comment } = body;
        
        if (!executionId || !stepId) {
          return NextResponse.json(
            { error: 'Execution ID and step ID are required' },
            { status: 400 }
          );
        }
        
        const result = await orchestrator.processWorkflowAction(
          executionId,
          stepId,
          'reject',
          userId,
          { comment }
        );
        
        return NextResponse.json({
          success: result.success,
          data: result,
          message: result.message
        });
      }

      case 'delegate': {
        const { executionId, stepId, delegateTo, comment } = body;
        
        if (!executionId || !stepId || !delegateTo) {
          return NextResponse.json(
            { error: 'Execution ID, step ID, and delegate target are required' },
            { status: 400 }
          );
        }
        
        const result = await orchestrator.processWorkflowAction(
          executionId,
          stepId,
          'delegate',
          userId,
          { delegateTo, comment }
        );
        
        return NextResponse.json({
          success: result.success,
          data: result,
          message: result.message
        });
      }

      case 'request_changes': {
        const { executionId, stepId, comment } = body;
        
        if (!executionId || !stepId || !comment) {
          return NextResponse.json(
            { error: 'Execution ID, step ID, and comment are required' },
            { status: 400 }
          );
        }
        
        const result = await orchestrator.processWorkflowAction(
          executionId,
          stepId,
          'request_changes',
          userId,
          { comment }
        );
        
        return NextResponse.json({
          success: result.success,
          data: result,
          message: result.message
        });
      }

      case 'get_progress': {
        const { executionId } = body;
        
        if (!executionId) {
          return NextResponse.json(
            { error: 'Execution ID is required' },
            { status: 400 }
          );
        }
        
        const progress = await orchestrator.getWorkflowProgress(executionId);
        
        if (!progress) {
          return NextResponse.json(
            { error: 'Execution not found' },
            { status: 404 }
          );
        }
        
        return NextResponse.json({
          success: true,
          data: progress
        });
      }

      case 'check_escalations': {
        // Trigger escalation check (admin only)
        const result = await orchestrator.checkWorkflowEscalations();
        
        return NextResponse.json({
          success: true,
          data: result,
          message: `Checked escalations: ${result.escalated} escalated, ${result.reminders} reminders sent`
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Workflow management POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
