/**
 * API Route: POST /api/agents/execute
 * Manually trigger an agent execution
 */

import { NextRequest } from 'next/server';
import { agentRegistry } from '@repo/workers/agents';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const body = await request.json();
    const { agentName, contractId, tenantId, context } = body;

    if (!agentName || !contractId || !tenantId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'agentName, contractId, and tenantId are required', 400);
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
