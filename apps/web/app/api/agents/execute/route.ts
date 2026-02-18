/**
 * API Route: POST /api/agents/execute
 * Manually trigger an agent execution
 */

import { NextRequest } from 'next/server';
import { agentRegistry } from '@repo/workers/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { agentName, contractId, context } = body;
    // P0-FIX: Always use the authenticated tenant — never trust body.tenantId
    const tenantId = ctx.tenantId;

    if (!agentName || !contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'agentName and contractId are required', 400);
    }

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
