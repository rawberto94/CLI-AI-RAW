import { NextRequest } from 'next/server';
import { analyticalIntelligenceService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, type AuthenticatedApiContext, getApiContext} from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const body = await request.json();
  const { query, context } = body;

  if (!query) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Query required', 400);
  }

  const nlqEngine = analyticalIntelligenceService.getNLQEngine();

  const queryContext = {
    sessionId: context?.sessionId || `session-${Date.now()}`,
    tenantId: context?.tenantId || ctx.tenantId,
    userId: context?.userId || ctx.userId,
    previousQueries: context?.previousQueries || [],
    filters: context?.filters
  };

  const response = await nlqEngine.processQuery(query, queryContext);
  return createSuccessResponse(ctx, response);
});

export const GET = withAuthApiHandler(async (request: NextRequest, ctx: AuthenticatedApiContext) => {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const query = searchParams.get('query');
  const _sessionId = searchParams.get('sessionId');

  const nlqEngine = analyticalIntelligenceService.getNLQEngine();

  switch (action) {
    case 'search':
      if (!query) {
        return createErrorResponse(ctx, 'BAD_REQUEST', 'Query required', 400);
      }
      const searchResults = await nlqEngine.searchContracts(query);
      return createSuccessResponse(ctx, searchResults);

    case 'suggestions':
      // Return query suggestions
      const suggestions = [
        'Show all contracts with auto-renewal clauses',
        'What is the average rate for senior consultants?',
        'Which contracts are expiring in the next 90 days?',
        'List all suppliers with high compliance scores',
        'Compare rates between Accenture and Deloitte'
      ];
      return createSuccessResponse(ctx, suggestions);

    default:
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Invalid action', 400);
  }
});
