/**
 * API Route: POST /api/agents/execute
 * Manually trigger an agent execution
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { agentRegistry } from '@repo/workers/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

const executeSchema = z.object({
  agentName: z.string().min(1, 'agentName is required'),
  contractId: z.string().min(1, 'contractId is required'),
  context: z.record(z.unknown()).optional(),
});

export const POST = withAuthApiHandler(async (request, ctx) => {
    const { agentName, contractId, context } = executeSchema.parse(await request.json());
    // P0-FIX: Always use the authenticated tenant — never trust body.tenantId
    const tenantId = ctx.tenantId;

    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant context is required', 401);
    }

    // Get agent from registry
    const agent = agentRegistry.get(agentName);
    if (!agent) {
      return createErrorResponse(ctx, 'NOT_FOUND', `Agent '${agentName}' not found`, 404);
    }

    // Execute agent
    const result = await agent.executeWithTracking({
      contractId,
      tenantId,
      context: context || {},
      metadata: {
        triggeredBy: 'user',
        priority: 'medium',
        timestamp: new Date() } });

    return createSuccessResponse(ctx, {
      agent: agentName,
      result });
  });
