import { NextRequest, NextResponse } from 'next/server';
import { analyticalIntelligenceService } from '@/lib/services/analytical-intelligence.service';

/**
 * Natural Language Query API Endpoints
 */

// POST /api/analytics/intelligence/query - Process natural language queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, sessionId, tenantId, userId, context } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string is required' },
        { status: 400 }
      );
    }

    const queryContext = {
      sessionId: sessionId || `session-${Date.now()}`,
      tenantId: tenantId || 'default',
      userId: userId || 'anonymous',
      ...context
    };

    const result = await analyticalIntelligenceService.processNaturalLanguageQuery(query, queryContext);

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to process natural language query:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to process query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/analytics/intelligence/query/history - Get query history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const tenantId = searchParams.get('tenantId') || 'default';
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const filters = {
      tenantId,
      ...(sessionId && { sessionId }),
      ...(userId && { userId }),
      limit
    };

    const history = await analyticalIntelligenceService.getQueryHistory(filters);

    return NextResponse.json({
      success: true,
      data: history,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get query history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get query history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}