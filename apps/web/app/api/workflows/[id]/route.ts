import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { workflowService } from 'data-orchestration/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/:id - Get specific workflow
 */
export const GET = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { id: workflowId } = await (ctx as any).params as { id: string };
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    // Try database first
    try {
      const workflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { executions: true },
          },
        },
      });
      
      if (workflow) {
        return createSuccessResponse(ctx, {
          success: true,
          workflow: {
            ...workflow,
            executions: workflow._count.executions,
          },
          source: 'database',
        });
      }
    } catch {
      // Database lookup failed
      return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Failed to retrieve workflow from database', 500);
    }
    
    return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

/**
 * PUT /api/workflows/:id - Update workflow
 */
export const PUT = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { id: workflowId } = await (ctx as any).params as { id: string };
    const body = await request.json();
    const { name, description, type, steps, isActive, triggerType, config, metadata } = body;
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before updating
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
      }
      
      // First, delete existing steps
      await prisma.workflowStep.deleteMany({
        where: { workflowId: existingWorkflow.id },
      });
      
      // Update workflow with new steps
      const workflow = await prisma.workflow.update({
        where: { id: existingWorkflow.id },
        data: {
          name,
          description,
          type: type || 'APPROVAL',
          isActive: isActive !== false,
          config: config || {},
          metadata: { ...(metadata || {}), triggerType },
          updatedAt: new Date(),
          steps: {
            create: (steps || []).map((step: { name: string; description?: string; order?: number; stepType?: string; type?: string; assigneeType?: string; assigneeId?: string; dueDays?: number; dueHours?: number; requiresApproval?: boolean; allowReject?: boolean; allowDelegate?: boolean; config?: Record<string, unknown> }, index: number) => ({
              name: step.name,
              description: step.description,
              order: step.order ?? index,
              type: step.stepType || step.type || 'APPROVAL',
              assignedRole: step.assigneeType === 'ROLE' ? step.assigneeId : undefined,
              assignedUser: step.assigneeType === 'USER' ? step.assigneeId : undefined,
              config: {
                dueDays: step.dueDays,
                dueHours: step.dueHours,
                requiresApproval: step.requiresApproval,
                allowReject: step.allowReject,
                allowDelegate: step.allowDelegate,
                ...step.config,
              },
              isRequired: step.requiresApproval !== false,
              timeout: step.dueDays ? step.dueDays * 24 * 60 : undefined,
            })),
          },
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });
      
      return createSuccessResponse(ctx, {
        success: true,
        workflow,
        source: 'database',
        message: 'Workflow updated successfully',
      });
    } catch (error) {
      throw error;
    }
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

/**
 * PATCH /api/workflows/:id - Partially update workflow (e.g., toggle active status)
 */
export const PATCH = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const { id: workflowId } = await (ctx as any).params as { id: string };
    const body = await request.json();
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before updating
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
      }
      
      const workflow = await prisma.workflow.update({
        where: { id: existingWorkflow.id },
        data: {
          ...body,
          updatedAt: new Date(),
        },
        include: {
          steps: {
            orderBy: { order: 'asc' },
          },
        },
      });
      
      return createSuccessResponse(ctx, {
        success: true,
        workflow,
        source: 'database',
        message: 'Workflow updated successfully',
      });
    } catch (error) {
      throw error;
    }
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})

/**
 * DELETE /api/workflows/:id - Delete workflow
 */
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  try {
    const { id: workflowId } = await (ctx as any).params as { id: string };
    const tenantId = ctx.tenantId;
    
    if (!tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Tenant ID is required', 400);
    }
    
    // Try database first
    try {
      // Verify workflow belongs to tenant before deleting
      const existingWorkflow = await prisma.workflow.findFirst({
        where: { id: workflowId, tenantId },
        select: { id: true },
      });
      
      if (!existingWorkflow) {
        return createErrorResponse(ctx, 'NOT_FOUND', 'Workflow not found', 404);
      }
      
      // Delete steps first (cascade should handle this, but be explicit)
      await prisma.workflowStep.deleteMany({
        where: { workflowId: existingWorkflow.id },
      });
      
      await prisma.workflow.delete({
        where: { id: existingWorkflow.id },
      });
      
      return createSuccessResponse(ctx, {
        success: true,
        source: 'database',
        message: 'Workflow deleted successfully',
      });
    } catch (error) {
      throw error;
    }
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
})
