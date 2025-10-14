/**
 * Real-time Intelligence Stream API
 * GET /api/intelligence/stream - Server-Sent Events for real-time intelligence updates
 * 
 * ✅ Uses data-orchestration event system
 * - Real-time pattern detection notifications
 * - Live insight generation
 * - Processing status updates
 * - System health monitoring
 */

import { NextRequest } from "next/server";
import { eventBus, Events } from "data-orchestration";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId") || "demo";

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const encoder = new TextEncoder();
      
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      // Send connection established event
      sendEvent("connected", {
        timestamp: new Date().toISOString(),
        tenantId,
        message: "Intelligence stream connected",
      });

      // Set up event listeners for intelligence events
      const handlePatternDetected = async (payload: any) => {
        if (payload.data.tenantId === tenantId) {
          sendEvent("pattern_detected", {
            timestamp: new Date().toISOString(),
            pattern: payload.data.pattern,
            contractId: payload.data.contractId,
            impact: payload.data.pattern.impact,
            description: payload.data.pattern.description,
          });
        }
      };

      const handleInsightGenerated = async (payload: any) => {
        if (payload.data.tenantId === tenantId) {
          sendEvent("insight_generated", {
            timestamp: new Date().toISOString(),
            insight: payload.data.insight,
            priority: payload.data.insight.priority,
            impact: payload.data.insight.impact,
            title: payload.data.insight.title,
            potentialSavings: payload.data.insight.potentialSavings,
          });
        }
      };

      const handleProcessingCompleted = async (payload: any) => {
        if (payload.data.tenantId === tenantId) {
          sendEvent("processing_completed", {
            timestamp: new Date().toISOString(),
            contractId: payload.data.contractId,
            duration: payload.data.duration,
            artifactsGenerated: payload.data.artifactsGenerated || 0,
          });
        }
      };

      const handleAnomalyDetected = async (payload: any) => {
        if (payload.data.tenantId === tenantId) {
          sendEvent("anomaly_detected", {
            timestamp: new Date().toISOString(),
            anomaly: payload.data.anomaly,
            severity: payload.data.severity,
            contractId: payload.data.contractId,
          });
        }
      };

      // Subscribe to intelligence events
      eventBus.subscribe(Events.PATTERN_DETECTED, handlePatternDetected);
      eventBus.subscribe(Events.INSIGHT_GENERATED, handleInsightGenerated);
      eventBus.subscribe(Events.PROCESSING_COMPLETED, handleProcessingCompleted);
      eventBus.subscribe(Events.ANOMALY_DETECTED, handleAnomalyDetected);

      // Send periodic heartbeat and stats
      const heartbeatInterval = setInterval(() => {
        sendEvent("heartbeat", {
          timestamp: new Date().toISOString(),
          stats: eventBus.getStats(),
          uptime: process.uptime(),
        });
      }, 30000); // Every 30 seconds

      // Send system health updates
      const healthInterval = setInterval(async () => {
        try {
          // Get system health metrics
          const health = await getSystemHealth();
          sendEvent("system_health", {
            timestamp: new Date().toISOString(),
            health,
          });
        } catch (error) {
          sendEvent("error", {
            timestamp: new Date().toISOString(),
            error: "Failed to get system health",
            details: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }, 60000); // Every minute

      // Cleanup function
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        clearInterval(healthInterval);
        
        // Unsubscribe from events
        eventBus.unsubscribe(Events.PATTERN_DETECTED, handlePatternDetected);
        eventBus.unsubscribe(Events.INSIGHT_GENERATED, handleInsightGenerated);
        eventBus.unsubscribe(Events.PROCESSING_COMPLETED, handleProcessingCompleted);
        eventBus.unsubscribe(Events.ANOMALY_DETECTED, handleAnomalyDetected);
      };

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup();
        controller.close();
      });

      // Store cleanup function for potential future use
      (controller as any).cleanup = cleanup;
    },

    cancel() {
      // Cleanup when stream is cancelled
      if ((this as any).cleanup) {
        (this as any).cleanup();
      }
    },
  });

  // Return the stream with appropriate headers for Server-Sent Events
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}

/**
 * Get system health metrics
 */
async function getSystemHealth() {
  try {
    // Import health check functions
    const { dbAdaptor, cacheAdaptor } = await import("data-orchestration");
    
    const [dbHealth, cacheHealth] = await Promise.all([
      dbAdaptor.healthCheck().catch(() => false),
      cacheAdaptor.healthCheck().catch(() => false),
    ]);

    const overallHealth = dbHealth && cacheHealth ? "healthy" : 
                         dbHealth || cacheHealth ? "degraded" : "unhealthy";

    return {
      status: overallHealth,
      services: {
        database: dbHealth,
        cache: cacheHealth,
        eventBus: eventBus.getStats().connectionStatus === "ready",
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  } catch (error) {
    return {
      status: "unknown",
      error: error instanceof Error ? error.message : "Health check failed",
      timestamp: new Date().toISOString(),
    };
  }
}