import { NextRequest } from 'next/server';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';
import { prisma } from '@/lib/prisma';
import { monitoringService } from 'data-orchestration/services';

/**
 * DELETE /api/admin/data-connections/[id]
 * Delete a data connection
 */
export const DELETE = withAuthApiHandler(async (_request: NextRequest, ctx) => {
  if (ctx.userRole !== 'admin' && ctx.userRole !== 'owner') {
    return createErrorResponse(ctx, 'FORBIDDEN', 'Admin access required', 403);
  }

  try {
    const { id } = await (ctx as any).params as { id: string };

    // Get existing settings
    const settings = await prisma.tenantSettings.findFirst({
      where: { tenantId: ctx.tenantId },
    });

    if (!settings?.customFields) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Connection not found', 404);
    }

    const customFields = typeof settings.customFields === 'string' 
      ? JSON.parse(settings.customFields) 
      : settings.customFields;
    
    const existingConnections = customFields.dataConnections || [];
    const updatedConnections = existingConnections.filter((c: { id: string }) => c.id !== id);

    if (existingConnections.length === updatedConnections.length) {
      return createErrorResponse(ctx, 'NOT_FOUND', 'Connection not found', 404);
    }

    // Update settings
    await prisma.tenantSettings.update({
      where: { id: settings.id },
      data: {
        customFields: JSON.stringify({
          ...customFields,
          dataConnections: updatedConnections,
        }),
      },
    });

    return createSuccessResponse(ctx, {});
  } catch (error) {
    return handleApiError(ctx, error);
  }
})
