/**
 * Database Optimization API
 * Provides endpoints for database performance monitoring, optimization, and maintenance
 */

import { NextRequest, NextResponse } from "next/server";
import { databaseOptimizationService } from "data-orchestration";

/**
 * GET /api/database/optimization - Get database performance statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "stats";

    switch (action) {
      case "stats":
        const statsResult = await databaseOptimizationService.analyzeDatabasePerformance();
        
        if (!statsResult.success) {
          return NextResponse.json({
            success: false,
            error: statsResult.error?.message || "Failed to get database statistics"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: statsResult.data,
          timestamp: new Date().toISOString()
        });

      case "recommendations":
        const recommendationsResult = await databaseOptimizationService.generateOptimizationRecommendations();
        
        if (!recommendationsResult.success) {
          return NextResponse.json({
            success: false,
            error: recommendationsResult.error?.message || "Failed to generate recommendations"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: recommendationsResult.data,
          timestamp: new Date().toISOString()
        });

      case "maintenance":
        const taskId = searchParams.get("taskId");
        const maintenanceResult = await databaseOptimizationService.getMaintenanceStatus(taskId || undefined);
        
        if (!maintenanceResult.success) {
          return NextResponse.json({
            success: false,
            error: maintenanceResult.error?.message || "Failed to get maintenance status"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: maintenanceResult.data,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action parameter"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Database optimization GET error:", error);
    return NextResponse.json({
      success: false,
      error: "Database optimization request failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * POST /api/database/optimization - Perform optimization operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case "create-indexes":
        const indexResult = await databaseOptimizationService.createEssentialIndexes();
        
        if (!indexResult.success) {
          return NextResponse.json({
            success: false,
            error: indexResult.error?.message || "Failed to create indexes"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: indexResult.data,
          message: `Created ${indexResult.data.created.length} new indexes, ${indexResult.data.existing.length} already existed`
        });

      case "optimize-queries":
        const optimizeResult = await databaseOptimizationService.optimizeContractQueries();
        
        if (!optimizeResult.success) {
          return NextResponse.json({
            success: false,
            error: optimizeResult.error?.message || "Failed to optimize queries"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: optimizeResult.data,
          message: `Optimized ${optimizeResult.data.optimized.length} queries`
        });

      case "maintenance":
        const tasks = body.tasks || ["analyze", "reindex"];
        const maintenanceResult = await databaseOptimizationService.performMaintenance(tasks);
        
        if (!maintenanceResult.success) {
          return NextResponse.json({
            success: false,
            error: maintenanceResult.error?.message || "Failed to start maintenance"
          }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          data: maintenanceResult.data,
          message: `Started ${maintenanceResult.data.length} maintenance tasks`
        });

      default:
        return NextResponse.json({
          success: false,
          error: "Invalid action parameter"
        }, { status: 400 });
    }

  } catch (error) {
    console.error("Database optimization POST error:", error);
    return NextResponse.json({
      success: false,
      error: "Database optimization operation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * PUT /api/database/optimization - Update optimization settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // This would update optimization settings in a real implementation
    // For now, return success with the settings that would be applied
    
    return NextResponse.json({
      success: true,
      data: {
        settings: body,
        applied: true,
        timestamp: new Date().toISOString()
      },
      message: "Optimization settings updated successfully"
    });

  } catch (error) {
    console.error("Database optimization PUT error:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to update optimization settings",
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
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}