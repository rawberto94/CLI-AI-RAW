/**
 * Worker Health Check Server (P4: Worker Scalability)
 * 
 * Provides HTTP health endpoints for Kubernetes probes
 * and Prometheus metrics scraping
 */

import http from 'http';
import { getMetricsCollector, MetricsSnapshot } from './metrics';
import { getAllCircuitStats, getBackpressureHandler } from './resilience';
import { getRecentSpans } from './observability/opentelemetry';
import { checkDIHealth, isDIConfigured, diMetrics, diCostTracker } from './azure-document-intelligence';
import pino from 'pino';

const logger = pino({ name: 'health-server' });

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  workers: {
    total: number;
    running: number;
    paused: number;
  };
  queues: {
    total: number;
    activeJobs: number;
    waitingJobs: number;
    failedJobs: number;
  };
  details?: MetricsSnapshot;
}

const startTime = Date.now();

/**
 * Create health check handler
 */
function createHealthHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
  return async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;

    try {
      switch (path) {
        case '/healthz':
        case '/health':
          await handleHealthCheck(res);
          break;
        case '/readyz':
        case '/ready':
          await handleReadinessCheck(res);
          break;
        case '/livez':
        case '/live':
          handleLivenessCheck(res);
          break;
        case '/metrics':
          await handleMetrics(res);
          break;
        case '/metrics/json':
          await handleMetricsJson(res);
          break;
        case '/resilience':
          await handleResilienceStatus(res);
          break;
        case '/traces':
          handleRecentTraces(res);
          break;
        case '/di-health':
          await handleDIHealth(res);
          break;
        case '/di-health/history':
          handleDIHealthHistory(res);
          break;
        default:
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      logger.error({ error }, 'Health check error');
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  };
}

/**
 * Full health check with detailed status
 */
async function handleHealthCheck(res: http.ServerResponse): Promise<void> {
  const collector = getMetricsCollector();
  const snapshot = await collector.getSnapshot();
  const isHealthy = collector.isHealthy();

  const response: HealthCheckResponse = {
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    workers: {
      total: snapshot.workers.length,
      running: snapshot.workers.filter(w => w.isRunning).length,
      paused: snapshot.workers.filter(w => w.isPaused).length,
    },
    queues: {
      total: snapshot.queues.length,
      activeJobs: snapshot.totals.activeJobs,
      waitingJobs: snapshot.totals.waitingJobs,
      failedJobs: snapshot.totals.failedJobs,
    },
  };

  // Check for degraded state (high failure rate or many waiting jobs)
  const failureRate = snapshot.totals.failedJobs / Math.max(snapshot.totals.completedJobs, 1);
  if (failureRate > 0.1 || snapshot.totals.waitingJobs > 1000) {
    response.status = 'degraded';
  }

  // Check DI health if configured
  let diHealth: any = null;
  if (isDIConfigured()) {
    try {
      diHealth = await checkDIHealth();
      if (diHealth.configured && !diHealth.reachable) {
        response.status = response.status === 'healthy' ? 'degraded' : response.status;
      }
    } catch {
      // Don't let DI health check crash the main health endpoint
    }
  }

  const statusCode = response.status === 'healthy' ? 200 : 
                     response.status === 'degraded' ? 200 : 503;

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...response, documentIntelligence: diHealth }, null, 2));
}

/**
 * Readiness check - can the worker accept new jobs?
 */
async function handleReadinessCheck(res: http.ServerResponse): Promise<void> {
  const collector = getMetricsCollector();
  const isHealthy = collector.isHealthy();

  if (isHealthy) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ready' }));
  } else {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'not ready', reason: 'Workers not running' }));
  }
}

/**
 * Liveness check - is the process alive?
 */
function handleLivenessCheck(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'alive',
    uptime: Math.floor((Date.now() - startTime) / 1000)
  }));
}

/**
 * Prometheus metrics endpoint
 */
async function handleMetrics(res: http.ServerResponse): Promise<void> {
  const collector = getMetricsCollector();
  const metrics = await collector.getPrometheusMetrics();

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(metrics);
}

/**
 * JSON metrics endpoint for dashboards
 */
async function handleMetricsJson(res: http.ServerResponse): Promise<void> {
  const collector = getMetricsCollector();
  const snapshot = await collector.getSnapshot();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ...snapshot, documentIntelligence: diMetrics.getSnapshot(), diCost: diCostTracker.getSnapshot() }, null, 2));
}

/**
 * Resilience status endpoint - circuit breakers and backpressure
 */
async function handleResilienceStatus(res: http.ServerResponse): Promise<void> {
  const circuitStats = getAllCircuitStats();
  const backpressure = getBackpressureHandler();
  const queueHealth = await backpressure.getAllHealth();

  const response = {
    timestamp: new Date().toISOString(),
    circuitBreakers: circuitStats,
    backpressure: {
      queues: queueHealth,
      summary: {
        total: queueHealth.length,
        healthy: queueHealth.filter(q => q.healthStatus === 'healthy').length,
        degraded: queueHealth.filter(q => q.healthStatus === 'degraded').length,
        critical: queueHealth.filter(q => q.healthStatus === 'critical').length,
        paused: queueHealth.filter(q => q.paused).length,
      },
    },
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
}

/**
 * Recent traces endpoint for debugging
 */
function handleRecentTraces(res: http.ServerResponse): void {
  const spans = getRecentSpans(50);

  const response = {
    timestamp: new Date().toISOString(),
    count: spans.length,
    spans: spans.map(s => ({
      traceId: s.traceId,
      spanId: s.spanId,
      name: s.name,
      duration: s.endTime ? s.endTime - s.startTime : null,
      status: s.status,
      attributes: s.attributes,
    })),
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
}

/**
 * Document Intelligence health check endpoint
 */
async function handleDIHealth(res: http.ServerResponse): Promise<void> {
  try {
    const health = await checkDIHealth();
    const statusCode = health.configured && health.reachable ? 200 : 
                       health.configured ? 503 : 200;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      ...health,
    }, null, 2));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Failed to check DI health',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
  }
}

// ============================================================================
// Scheduled DI Health Polling
// ============================================================================

interface DIHealthRecord {
  timestamp: string;
  reachable: boolean;
  latencyMs?: number;
  error?: string;
}

const diHealthHistory: DIHealthRecord[] = [];
const DI_HEALTH_HISTORY_MAX = 120; // Keep last 120 checks (~1 hour at 30s interval)
let diHealthInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Background DI health poller — runs every 30s and records status history.
 * Logs warnings on consecutive failures for circuit-breaker-like alerting.
 */
function startDIHealthPolling(intervalMs: number = 30_000): void {
  if (!isDIConfigured()) return;

  let consecutiveFailures = 0;

  diHealthInterval = setInterval(async () => {
    const start = Date.now();
    try {
      const health = await checkDIHealth();
      const latencyMs = Date.now() - start;
      diHealthHistory.push({
        timestamp: new Date().toISOString(),
        reachable: !!health.reachable,
        latencyMs,
      });
      if (health.reachable) {
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          logger.warn({ consecutiveFailures, latencyMs }, 'DI health: multiple consecutive unreachable checks');
        }
      }
    } catch (err) {
      consecutiveFailures++;
      diHealthHistory.push({
        timestamp: new Date().toISOString(),
        reachable: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      if (consecutiveFailures >= 3) {
        logger.warn({ consecutiveFailures, error: err instanceof Error ? err.message : String(err) }, 'DI health poll failed repeatedly');
      }
    }
    // Trim history
    while (diHealthHistory.length > DI_HEALTH_HISTORY_MAX) {
      diHealthHistory.shift();
    }
  }, intervalMs);

  // Don't block process exit
  if (diHealthInterval && typeof diHealthInterval === 'object' && 'unref' in diHealthInterval) {
    diHealthInterval.unref();
  }

  logger.info({ intervalMs }, 'DI health polling started');
}

/**
 * DI health history endpoint
 */
function handleDIHealthHistory(res: http.ServerResponse): void {
  const reachableCount = diHealthHistory.filter(h => h.reachable).length;
  const totalCount = diHealthHistory.length;
  const avgLatency = totalCount > 0
    ? diHealthHistory.reduce((sum, h) => sum + (h.latencyMs || 0), 0) / totalCount
    : 0;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: totalCount,
      reachable: reachableCount,
      unreachable: totalCount - reachableCount,
      uptimePercent: totalCount > 0 ? ((reachableCount / totalCount) * 100).toFixed(1) : 'N/A',
      avgLatencyMs: Math.round(avgLatency),
    },
    history: diHealthHistory.slice(-50), // Return last 50 records
  }, null, 2));
}

/**
 * Start the health check server
 */
export function startHealthServer(port: number = 9090): http.Server {
  const server = http.createServer(createHealthHandler());

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn({ port }, `⚠️ Health port ${port} already in use, skipping health server`);
      // Don't crash, just skip the health server
      return;
    }
    throw err;
  });

  server.listen(port, () => {
    logger.info({ port }, '🏥 Health check server started');
    logger.info({ 
      endpoints: [
        `http://localhost:${port}/healthz - Full health check`,
        `http://localhost:${port}/readyz - Readiness probe`,
        `http://localhost:${port}/livez - Liveness probe`,
        `http://localhost:${port}/metrics - Prometheus metrics`,
        `http://localhost:${port}/metrics/json - JSON metrics`,
        `http://localhost:${port}/resilience - Circuit breakers & backpressure`,
        `http://localhost:${port}/traces - Recent distributed traces`,
        `http://localhost:${port}/di-health - Azure Document Intelligence health`,
        `http://localhost:${port}/di-health/history - DI health check history`,
      ]
    }, 'Available endpoints');

    // Start background DI health polling (every 30s)
    startDIHealthPolling();
  });

  return server;
}

export default { startHealthServer, getMetricsCollector };
