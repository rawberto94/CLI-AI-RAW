/**
 * Worker Health Check Server (P4: Worker Scalability)
 * 
 * Provides HTTP health endpoints for Kubernetes probes
 * and Prometheus metrics scraping
 */

import http from 'http';
import { getMetricsCollector, MetricsSnapshot } from './metrics';
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

  const statusCode = response.status === 'healthy' ? 200 : 
                     response.status === 'degraded' ? 200 : 503;

  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response, null, 2));
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
  res.end(JSON.stringify(snapshot, null, 2));
}

/**
 * Start the health check server
 */
export function startHealthServer(port: number = 9090): http.Server {
  const server = http.createServer(createHealthHandler());

  server.listen(port, () => {
    logger.info({ port }, '🏥 Health check server started');
    logger.info({ 
      endpoints: [
        `http://localhost:${port}/healthz - Full health check`,
        `http://localhost:${port}/readyz - Readiness probe`,
        `http://localhost:${port}/livez - Liveness probe`,
        `http://localhost:${port}/metrics - Prometheus metrics`,
        `http://localhost:${port}/metrics/json - JSON metrics`,
      ]
    }, 'Available endpoints');
  });

  return server;
}

export default { startHealthServer, getMetricsCollector };
