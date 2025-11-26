/**
 * Health Check Service
 * Provides comprehensive health monitoring for all system components
 */

import { prisma } from "@/lib/prisma";
import Redis from "ioredis";
import pino from "pino";

const logger = pino({ name: "health-check" });

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
    storage: HealthStatus;
    workers: HealthStatus;
    ai: HealthStatus;
  };
  metrics?: {
    activeConnections?: number;
    queueDepth?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

const startTime = Date.now();

/**
 * Check PostgreSQL database health
 */
export async function checkDatabaseHealth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    // Execute a simple query
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    // Check connection pool stats if available
    const connectionStats = await prisma.$queryRaw<any[]>`
      SELECT 
        numbackends as active_connections,
        xact_commit as transactions,
        tup_returned as rows_returned
      FROM pg_stat_database 
      WHERE datname = current_database()
    `.catch(() => null);
    
    const latency = Date.now() - start;
    
    return {
      status: latency > 1000 ? "degraded" : "healthy",
      latency,
      details: {
        activeConnections: connectionStats?.[0]?.active_connections,
        transactions: connectionStats?.[0]?.transactions,
      },
    };
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });

    const pong = await redisClient.ping();
    const info = await redisClient.info("memory").catch(() => null);
    
    await redisClient.quit();
    
    const latency = Date.now() - start;
    
    // Parse memory info
    const memoryMatch = info?.match(/used_memory:(\d+)/);
    const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : undefined;
    
    return {
      status: pong === "PONG" ? (latency > 100 ? "degraded" : "healthy") : "unhealthy",
      latency,
      details: {
        ping: pong,
        usedMemoryBytes: usedMemory,
        usedMemoryMB: usedMemory ? Math.round(usedMemory / 1024 / 1024) : undefined,
      },
    };
  } catch (error) {
    logger.error({ error }, "Redis health check failed");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check Object Storage (MinIO/S3) health
 */
export async function checkStorageHealth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    const { initializeStorage } = await import("@/lib/storage-service");
    const storageService = initializeStorage();
    
    if (!storageService) {
      return {
        status: "unhealthy",
        error: "Storage service not initialized",
      };
    }
    
    // Try to list objects to verify connectivity
    const files = await storageService.list("health-check/", 1);
    
    const latency = Date.now() - start;
    
    return {
      status: latency > 2000 ? "degraded" : "healthy",
      latency,
      details: {
        provider: process.env.S3_ENDPOINT || "minio",
        bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || "contracts",
      },
    };
  } catch (error) {
    logger.error({ error }, "Storage health check failed");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check worker queue health
 */
export async function checkWorkersHealth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
    });

    // Check BullMQ queue stats
    const queues = ["contract-processing", "artifact-generation", "webhook-delivery"];
    const queueStats: Record<string, any> = {};
    
    for (const queueName of queues) {
      const waiting = await redisClient.llen(`bull:${queueName}:wait`).catch(() => 0);
      const active = await redisClient.llen(`bull:${queueName}:active`).catch(() => 0);
      const delayed = await redisClient.zcard(`bull:${queueName}:delayed`).catch(() => 0);
      const failed = await redisClient.zcard(`bull:${queueName}:failed`).catch(() => 0);
      
      queueStats[queueName] = { waiting, active, delayed, failed };
    }
    
    await redisClient.quit();
    
    const latency = Date.now() - start;
    
    // Calculate total queue depth
    const totalWaiting = Object.values(queueStats).reduce((sum: number, q: any) => sum + q.waiting, 0);
    const totalFailed = Object.values(queueStats).reduce((sum: number, q: any) => sum + q.failed, 0);
    
    // Determine health based on queue state
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (totalWaiting > 100) status = "degraded";
    if (totalFailed > 50) status = "degraded";
    if (totalWaiting > 500 || totalFailed > 100) status = "unhealthy";
    
    return {
      status,
      latency,
      details: {
        queues: queueStats,
        totalWaiting,
        totalFailed,
      },
    };
  } catch (error) {
    logger.error({ error }, "Workers health check failed");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check AI service health (OpenAI/Mistral)
 */
export async function checkAIHealth(): Promise<HealthStatus> {
  const start = Date.now();
  
  try {
    const openAIKey = process.env.OPENAI_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    
    const details: Record<string, any> = {};
    
    // Check OpenAI
    if (openAIKey && openAIKey.startsWith("sk-")) {
      try {
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey: openAIKey });
        
        // Just check if we can list models (lightweight)
        await client.models.list();
        details.openai = { status: "connected", model: process.env.OPENAI_MODEL || "gpt-4o-mini" };
      } catch (e) {
        details.openai = { status: "error", error: (e as Error).message };
      }
    } else {
      details.openai = { status: "not_configured" };
    }
    
    // Check Mistral
    if (mistralKey) {
      try {
        const { Mistral } = await import("@mistralai/mistralai");
        const client = new Mistral({ apiKey: mistralKey });
        
        // Check models list
        await client.models.list();
        details.mistral = { status: "connected" };
      } catch (e) {
        details.mistral = { status: "error", error: (e as Error).message };
      }
    } else {
      details.mistral = { status: "not_configured" };
    }
    
    const latency = Date.now() - start;
    
    // Determine overall status
    const hasWorkingAI = details.openai?.status === "connected" || details.mistral?.status === "connected";
    const hasErrors = details.openai?.status === "error" || details.mistral?.status === "error";
    
    return {
      status: hasWorkingAI ? (hasErrors ? "degraded" : "healthy") : "unhealthy",
      latency,
      details,
    };
  } catch (error) {
    logger.error({ error }, "AI health check failed");
    return {
      status: "unhealthy",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get comprehensive system health
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, redis, storage, workers, ai] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkStorageHealth(),
    checkWorkersHealth(),
    checkAIHealth(),
  ]);

  const checks = { database, redis, storage, workers, ai };
  
  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  
  if (statuses.includes("unhealthy")) {
    // Database or Redis unhealthy = system unhealthy
    if (database.status === "unhealthy" || redis.status === "unhealthy") {
      overallStatus = "unhealthy";
    } else {
      overallStatus = "degraded";
    }
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  // Calculate memory usage
  const memoryUsage = process.memoryUsage();
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    metrics: {
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      queueDepth: (workers.details?.totalWaiting as number) || 0,
    },
  };
}

/**
 * Simple liveness check (for k8s)
 */
export async function livenessCheck(): Promise<boolean> {
  return true;
}

/**
 * Readiness check (for k8s)
 */
export async function readinessCheck(): Promise<boolean> {
  try {
    // Check critical services
    const [database, redis] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    
    return database.status !== "unhealthy" && redis.status !== "unhealthy";
  } catch {
    return false;
  }
}
