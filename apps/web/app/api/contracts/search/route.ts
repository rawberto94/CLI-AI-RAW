/**
 * Contract Search API
 * POST /api/contracts/search - Search contracts using hybrid search
 */

import { NextRequest, NextResponse } from 'next/server';
import { hybridSearchService } from '@core/search/hybrid-search.service';
import { z } from 'zod';

// Request validation schema
const searchRequestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  mode: z.enum(['balanced', 'semantic', 'keyword']).optional().default('balanced'),
  filters: z
    .object({
      contractType: z.string().optional(),
      status: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      clientId: z.string().optional(),
      supplierId: z.string().optional(),
    })
    .optional(),
  pagination: z
    .object({
      limit: z.number().int().min(1).max(100).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
    })
    .optional(),
  options: z
    .object({
      vectorThreshold: z.number().min(0).max(1).optional(),
      ftsMinScore: z.number().min(0).optional(),
      boostRecent: z.boolean().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = searchRequestSchema.parse(body);

    // Convert date strings to Date objects
    const filters = validatedData.filters
      ? {
          ...validatedData.filters,
          startDate: validatedData.filters.startDate
            ? new Date(validatedData.filters.startDate)
            : undefined,
          endDate: validatedData.filters.endDate
            ? new Date(validatedData.filters.endDate)
            : undefined,
        }
      : undefined;

    // Perform hybrid search
    const searchResults = await hybridSearchService.search({
      query: validatedData.query,
      mode: validatedData.mode,
      filters,
      pagination: validatedData.pagination,
      options: validatedData.options,
    });

    // Get search recommendations
    const recommendations = await hybridSearchService.getSearchRecommendations(
      validatedData.query
    );

    // Build response
    const response = {
      success: true,
      data: {
        results: searchResults.results.map((result) => ({
          ...result,
          explanation: hybridSearchService.explainResult(result),
        })),
        pagination: {
          total: searchResults.total,
          limit: validatedData.pagination?.limit || 20,
          offset: validatedData.pagination?.offset || 0,
          hasMore:
            (validatedData.pagination?.offset || 0) +
              (validatedData.pagination?.limit || 20) <
            searchResults.total,
        },
        query: searchResults.query,
        executionTime: searchResults.executionTime,
        searchStrategy: searchResults.searchStrategy,
        recommendations,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Search error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint for simple searches (query parameter)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: 'Query parameter is required',
        },
        { status: 400 }
      );
    }

    // Parse optional parameters
    const mode = (searchParams.get('mode') as any) || 'balanced';
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const contractType = searchParams.get('contractType') || undefined;
    const status = searchParams.get('status') || undefined;

    // Perform search
    const searchResults = await hybridSearchService.search({
      query,
      mode,
      filters: {
        contractType,
        status,
      },
      pagination: {
        limit,
        offset,
      },
    });

    const response = {
      success: true,
      data: {
        results: searchResults.results,
        pagination: {
          total: searchResults.total,
          limit,
          offset,
          hasMore: offset + limit < searchResults.total,
        },
        query: searchResults.query,
        executionTime: searchResults.executionTime,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Search error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
