import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/tenant-server';
import { analyticalIntelligenceService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    const { query, context } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    const nlqEngine = analyticalIntelligenceService.getNLQEngine();

    const queryContext = {
      sessionId: context?.sessionId || `session-${Date.now()}`,
      tenantId: context?.tenantId || (session ? getSessionTenantId(session) : 'default'),
      userId: context?.userId,
      previousQueries: context?.previousQueries || [],
      filters: context?.filters
    };

    const response = await nlqEngine.processQuery(query, queryContext);
    return NextResponse.json(response);

  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const query = searchParams.get('query');
    const sessionId = searchParams.get('sessionId');

    const nlqEngine = analyticalIntelligenceService.getNLQEngine();

    switch (action) {
      case 'search':
        if (!query) {
          return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }
        const searchResults = await nlqEngine.searchContracts(query);
        return NextResponse.json(searchResults);

      case 'suggestions':
        // Return query suggestions
        const suggestions = [
          'Show all contracts with auto-renewal clauses',
          'What is the average rate for senior consultants?',
          'Which contracts are expiring in the next 90 days?',
          'List all suppliers with high compliance scores',
          'Compare rates between Accenture and Deloitte'
        ];
        return NextResponse.json(suggestions);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}