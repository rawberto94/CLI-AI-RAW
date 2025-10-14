/**
 * Enhanced Contract Search API
 * GET /api/contracts/search/enhanced - Advanced search with indexing and facets
 * 
 * Features:
 * - Full-text search with highlighting
 * - Faceted search with filters
 * - Intelligent suggestions
 * - Performance optimized with indexing
 * - Real-time search capabilities
 */

import { NextRequest, NextResponse } from "next/server";
import { contractIndexingService } from "data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    // Parse search parameters
    const searchQuery = {
      tenantId: searchParams.get("tenantId") || "demo",
      query: searchParams.get("q") || undefined,
      filters: {
        contractType: searchParams.getAll("contractType"),
        category: searchParams.getAll("category"),
        parties: searchParams.getAll("parties"),
        tags: searchParams.getAll("tags"),
        riskLevel: searchParams.getAll("riskLevel") as any[],
        dateRange: searchParams.get("dateFrom") && searchParams.get("dateTo") ? {
          from: new Date(searchParams.get("dateFrom")!),
          to: new Date(searchParams.get("dateTo")!)
        } : undefined,
        valueRange: searchParams.get("minValue") && searchParams.get("maxValue") ? {
          min: Number(searchParams.get("minValue")),
          max: Number(searchParams.get("maxValue"))
        } : undefined
      },
      sortBy: (searchParams.get("sortBy") as any) || "relevance",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 20,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
      includeArtifacts: searchParams.get("includeArtifacts") === "true"
    };

    // Perform enhanced search
    const searchResult = await contractIndexingService.search(searchQuery);

    if (!searchResult.success) {
      return NextResponse.json({
        success: false,
        error: searchResult.error?.message || "Search failed",
        code: searchResult.error?.code
      }, { status: 500 });
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        ...searchResult.data,
        queryTime: responseTime
      },
      metadata: {
        query: searchQuery.query,
        filters: Object.keys(searchQuery.filters || {}).filter(key => 
          searchQuery.filters?.[key as keyof typeof searchQuery.filters]
        ),
        totalResults: searchResult.data.total,
        responseTime: `${responseTime}ms`,
        cached: responseTime < 50,
        searchEngine: "enhanced-indexing"
      }
    }, {
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Search-Engine': 'enhanced-indexing',
        'X-Total-Results': searchResult.data.total.toString(),
        'Cache-Control': 'public, max-age=30' // 30 second cache for search results
      }
    });

  } catch (error) {
    console.error("Enhanced search error:", error);

    return NextResponse.json({
      success: false,
      error: "Enhanced search failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * POST /api/contracts/search/enhanced - Advanced search with complex queries
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const tenantId = request.headers.get("x-tenant-id") || "demo";

    // Enhanced search query with complex filters
    const searchQuery = {
      tenantId,
      query: body.query,
      filters: {
        contractType: body.filters?.contractType,
        category: body.filters?.category,
        parties: body.filters?.parties,
        tags: body.filters?.tags,
        riskLevel: body.filters?.riskLevel,
        dateRange: body.filters?.dateRange ? {
          from: new Date(body.filters.dateRange.from),
          to: new Date(body.filters.dateRange.to)
        } : undefined,
        valueRange: body.filters?.valueRange
      },
      sortBy: body.sortBy || "relevance",
      sortOrder: body.sortOrder || "desc", 
      limit: body.limit || 20,
      offset: body.offset || 0,
      includeArtifacts: body.includeArtifacts || false
    };

    // Perform search
    const searchResult = await contractIndexingService.search(searchQuery);

    if (!searchResult.success) {
      return NextResponse.json({
        success: false,
        error: searchResult.error?.message || "Search failed",
        code: searchResult.error?.code
      }, { status: 500 });
    }

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        ...searchResult.data,
        queryTime: responseTime
      },
      metadata: {
        searchQuery,
        responseTime: `${responseTime}ms`,
        searchEngine: "enhanced-indexing"
      }
    }, {
      headers: {
        'X-Response-Time': `${responseTime}ms`,
        'X-Search-Engine': 'enhanced-indexing'
      }
    });

  } catch (error) {
    console.error("Enhanced search POST error:", error);

    return NextResponse.json({
      success: false,
      error: "Enhanced search failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
      "Access-Control-Max-Age": "86400"
    }
  });
}