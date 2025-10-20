/**
 * Data Lineage API
 * GET /api/intelligence/lineage - Get data lineage graph and statistics
 * 
 * ✅ Uses data-orchestration lineage system
 * - Complete data flow visualization
 * - Contract-to-insight traceability
 * - Processing pipeline tracking
 * - Impact analysis capabilities
 */

import { NextRequest, NextResponse } from "next/server";
import { dataLineageTracker } from "@/lib/data-orchestration";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || "demo";
    const contractId = searchParams.get("contractId");
    const includeStats = searchParams.get("includeStats") === "true";
    const format = searchParams.get("format") || "graph"; // graph, stats, both

    let lineageData: any = {};

    // Get lineage graph
    if (format === "graph" || format === "both") {
      if (contractId) {
        // Get lineage for specific contract
        lineageData.contractLineage = await dataLineageTracker.getContractLineage(contractId, tenantId);
      } else {
        // Get full tenant lineage
        lineageData.tenantLineage = await dataLineageTracker.getTenantLineage(tenantId);
      }
    }

    // Get lineage statistics
    if (format === "stats" || format === "both" || includeStats) {
      lineageData.statistics = await dataLineageTracker.getLineageStats(tenantId);
    }

    // Add metadata and insights
    const responseData = {
      success: true,
      data: {
        ...lineageData,
        metadata: {
          tenantId,
          contractId: contractId || null,
          generatedAt: new Date(),
          responseTime: Date.now() - startTime,
          format,
        },
        insights: generateLineageInsights(lineageData),
      },
    };

    return NextResponse.json(responseData, {
      headers: {
        'X-Response-Time': `${Date.now() - startTime}ms`,
        'X-Data-Source': 'lineage-tracker',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
      }
    });

  } catch (error) {
    console.error("Data lineage error:", error);

    return NextResponse.json({
      success: false,
      error: "Failed to get data lineage",
      details: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

/**
 * Generate insights from lineage data
 */
function generateLineageInsights(lineageData: any): any[] {
  const insights = [];

  // Analyze statistics if available
  if (lineageData.statistics) {
    const stats = lineageData.statistics;

    // Insight 1: Graph complexity
    if (stats.totalNodes > 0) {
      const complexity = stats.averageConnectivity > 3 ? "high" : 
                        stats.averageConnectivity > 1.5 ? "medium" : "low";
      
      insights.push({
        type: "complexity",
        title: `${complexity.charAt(0).toUpperCase() + complexity.slice(1)} Data Complexity`,
        description: `Your data graph has ${stats.totalNodes} nodes with ${stats.averageConnectivity.toFixed(1)} average connections per node`,
        impact: complexity === "high" ? "medium" : "low",
        recommendation: complexity === "high" 
          ? "Consider simplifying data flows or implementing better organization"
          : "Good data organization with manageable complexity",
      });
    }

    // Insight 2: Processing efficiency
    const artifactRatio = (stats.nodesByType.artifact || 0) / Math.max(stats.nodesByType.contract || 1, 1);
    if (artifactRatio > 0) {
      insights.push({
        type: "efficiency",
        title: "Processing Efficiency",
        description: `Generating ${artifactRatio.toFixed(1)} artifacts per contract on average`,
        impact: artifactRatio > 5 ? "high" : artifactRatio > 3 ? "medium" : "low",
        recommendation: artifactRatio > 5 
          ? "Excellent processing depth - generating comprehensive insights"
          : "Consider enabling more analysis types for deeper insights",
      });
    }

    // Insight 3: Intelligence generation
    const intelligenceRatio = ((stats.nodesByType.pattern || 0) + (stats.nodesByType.insight || 0)) / 
                             Math.max(stats.nodesByType.contract || 1, 1);
    if (intelligenceRatio > 0) {
      insights.push({
        type: "intelligence",
        title: "Intelligence Generation Rate",
        description: `Generating ${intelligenceRatio.toFixed(1)} patterns/insights per contract`,
        impact: intelligenceRatio > 2 ? "high" : intelligenceRatio > 0.5 ? "medium" : "low",
        recommendation: intelligenceRatio > 1 
          ? "Strong intelligence generation - good pattern detection"
          : "Intelligence generation could be improved with more data or better algorithms",
      });
    }
  }

  // Analyze graph structure if available
  if (lineageData.contractLineage || lineageData.tenantLineage) {
    const graph = lineageData.contractLineage || lineageData.tenantLineage;

    // Insight 4: Data flow depth
    if (graph.metadata.depth > 0) {
      insights.push({
        type: "depth",
        title: "Data Processing Depth",
        description: `Maximum processing depth of ${graph.metadata.depth} levels`,
        impact: graph.metadata.depth > 3 ? "high" : "medium",
        recommendation: graph.metadata.depth > 3 
          ? "Deep processing pipeline - excellent for comprehensive analysis"
          : "Consider adding more processing stages for deeper insights",
      });
    }

    // Insight 5: Relationship diversity
    const relationshipTypes = new Set(graph.edges.map((e: any) => e.relationship));
    if (relationshipTypes.size > 0) {
      insights.push({
        type: "relationships",
        title: "Relationship Diversity",
        description: `${relationshipTypes.size} different types of data relationships`,
        impact: relationshipTypes.size > 3 ? "high" : "medium",
        recommendation: relationshipTypes.size > 3 
          ? "Rich relationship model - good for complex analysis"
          : "Consider tracking more relationship types for better insights",
      });
    }
  }

  return insights;
}