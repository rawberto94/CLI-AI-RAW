/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports, no-empty, no-useless-escape */
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { z } from 'zod';
import { convertCurrency, normalizeToDaily } from 'utils';
import { mapRoleDetail } from 'utils';
import fastifyCompress from '@fastify/compress';
import { healthRoutes } from './health';
import pino from 'pino';
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
// Note: Telemetry disabled due to verbatimModuleSyntax issues - can be re-enabled later
// import { initTelemetry } from 'utils/tracing';

// initTelemetry('api');

let rateLimit: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  rateLimit = require('@fastify/rate-limit');
} catch {
  rateLimit = null;
}
// Note: Removed unused cache imports - cache and llmCostGuard not used in this file
// import { cache, llmCostGuard } from './cache';
import { contractCache, getCacheMetrics, warmCache } from './cache-enhanced';
import { monitoring } from './monitoring';
import { authPreHandler } from './auth';
import { agentRoutes } from './routes/agents';
import authRoutes from './routes/auth';
import templateRoutes from './routes/templates';
import { accuracyMonitoringRoutes } from './src/routes/accuracy-monitoring';
import { permissionGuard, routePermissionGuard } from './permission';
// Note: searchIndex not used in main API file - available from search module if needed
// import { searchIndex } from './search';
import { 
  validateInput, 
  requestLogger, 
  corsOptions,
  rateLimitConfig,
  validateFileType
} from './security';
import { fileValidationService } from './src/services/file-validation.service';
import { progressTrackingService, ProcessingStage } from './src/services/progress-tracking.service';
import { uploadErrorHandlerService } from './src/services/upload-error-handler.service';
import { webSocketProgressService } from './src/services/websocket-progress.service';
import { sseProgressService } from './src/services/sse-progress.service';
import { AppError } from './src/errors';
import { registerErrorHandling } from './src/plugins/error-handler';
import { securityHeaders } from './src/security/securityHeaders';
import { sqlProtection } from './src/security/sqlInjectionProtector';
import { xssProtection } from './src/security/xssProtector';
import { registerOpenAPIRoute } from './src/openapi';
import { setupGracefulShutdown } from './src/shutdown';
// Note: validators available from security module but not used in main API file
// import { validators } from './src/security/inputValidator';

// --- RAG METRICS (in-memory, minimal) ---
const ragMetrics = {
  count: 0,
  lastLatencyMs: 0,
  lastHits: 0,
};

// env helper
let env: any = process.env as any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  env = require('./env').env;
} catch {}

// --- CLIENT INITIALIZATION ---
// Gracefully import workspace clients, allowing the server to run even if a client is missing.
// Import enhanced database layer
let getDatabaseManager: any;
let getRepositoryManager: any;
let repositoryManager: any;
let db: any; // Keep for backward compatibility
try {
  const dbModule = require('clients-db');
  getDatabaseManager = dbModule.getDatabaseManager;
  getRepositoryManager = dbModule.getRepositoryManager;
  db = dbModule.default || dbModule; // Fallback to old client
  
  // Initialize repository manager
  try {
    const databaseManager = getDatabaseManager();
    repositoryManager = getRepositoryManager(databaseManager);
    logger.info('Enhanced database layer loaded successfully.');
  } catch (repoError) {
    logger.warn('Repository manager initialization failed, using fallback client');
  }
} catch (e) {
  logger.warn('Database client not found. API will run with limited functionality.');
}

let getSignedUrl: any, uploadToS3: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const storageModule = require('clients-storage');
  getSignedUrl = storageModule.getSignedUrl;
  uploadToS3 = storageModule.uploadToS3;
  logger.info('Storage client loaded successfully.');
} catch (e) {
  logger.warn('Storage client not found. API will run with limited functionality.');
}

let getQueue: ((queueName: string) => any) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const queueModule = require('clients-queue');
  getQueue = queueModule.getQueue;
  logger.info('Queue client loaded successfully.');
} catch (e) {
  logger.warn('Queue client not found. API will run with limited functionality.');
}

// Optional OpenAI client for LLM-enhanced extraction
let OpenAIClientCtor: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OpenAIClientCtor = require('clients-openai').OpenAIClient;
  logger.info('OpenAI client loaded successfully.');
} catch (e) {
  logger.info('First attempt failed:', (e as Error).message);
  try {
    // Use absolute path to avoid path resolution issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const openaiClientPath = path.resolve(__dirname, '../../../packages/clients/openai');
    logger.info('Trying OpenAI client path:', openaiClientPath);
    OpenAIClientCtor = require(openaiClientPath).OpenAIClient;
    logger.info('OpenAI client loaded from local packages.');
  } catch (_e) {
    logger.warn('OpenAI client not found. LLM analysis will be disabled. Error:', (_e as Error).message);
  }
}

// In-memory store for demo run tracking
// Import only the functions that are actually used in this file
import { 
  createRun, 
  getRun, 
  markStage, 
  addContract, 
  getContract, 
  listContracts, 
  saveArtifacts, 
  updateContract,
  listTenants,
  addTenant,
  getTenant,
  updateTenant,
  deleteTenant,
  getSection
} from './store';
// Note: hash function available but not used in main API file 
// import { hash } from 'utils';
// Note: Normalization functions available but not used in main API file
// import { matchRole, matchSupplier, addRoleAlias, addSupplierAlias, reloadNormalizationDicts, importNormalization } from './normalization/matcher';
// Note: Query functions available but not used in main API file
// import { handlePortfolioQuery, handleContractQuery } from './query';
// import fs from 'fs';
// import path from 'path';
import { randomBytes } from 'crypto';

// --- QUEUE ORCHESTRATION ---
async function enqueueAnalysisPipeline(docId: string, tenantId: string) {
  if (!getQueue) {
    throw new Error('Queue client not available');
  }

  const ingestionQueue = getQueue('ingestion');
  const templateQueue = getQueue('template');
  const financialQueue = getQueue('financial');
  const overviewQueue = getQueue('overview');
  const clausesQueue = getQueue('clauses');
  const ratesQueue = getQueue('rates');
  const complianceQueue = getQueue('compliance');
  const benchmarkQueue = getQueue('benchmark');
  const riskQueue = getQueue('risk');
  const reportQueue = getQueue('report');

  // Stage 1: Ingestion (text extraction)
  const ingestionJob = await ingestionQueue.add('process-document', { 
    docId, 
    tenantId 
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    priority: 10
  });

  // Stage 2: Enhanced parallel analysis after ingestion
  await Promise.all([
    templateQueue.add('analyze-template', { docId, tenantId }, { 
      parent: { id: ingestionJob.id, queue: 'ingestion' },
      attempts: 3,
      priority: 9
    }),
    financialQueue.add('analyze-financial', { docId, tenantId }, { 
      parent: { id: ingestionJob.id, queue: 'ingestion' },
      attempts: 3,
      priority: 9
    }),
    overviewQueue.add('analyze-overview', { docId, tenantId }, { 
      parent: { id: ingestionJob.id, queue: 'ingestion' },
      attempts: 3,
      priority: 8
    }),
    clausesQueue.add('extract-clauses', { docId, tenantId }, {
      parent: { id: ingestionJob.id, queue: 'ingestion' },
      attempts: 3,
      priority: 8
    }),
    ratesQueue.add('extract-rates', { docId, tenantId }, {
      parent: { id: ingestionJob.id, queue: 'ingestion' },
      attempts: 3,
      priority: 7
    })
  ]);

  // Stage 3: Risk and compliance analysis (depends on previous analyses)
  await Promise.all([
    riskQueue.add('assess-risk', { docId, tenantId }, {
      delay: 10000, // Give analysis jobs time to complete
      attempts: 3,
      priority: 6
    }),
    complianceQueue.add('check-compliance', { docId, tenantId, policyPackId: 'default' }, {
      delay: 8000,
      attempts: 3,
      priority: 6
    })
  ]);

  // Stage 4: Benchmark and final report
  await benchmarkQueue.add('calculate-benchmark', { docId, tenantId }, {
    delay: 15000,
    attempts: 3,
    priority: 5
  });

  await reportQueue.add('generate-report', { docId, tenantId }, {
    delay: 20000,
    attempts: 2,
    priority: 4
  });

  logger.info(`Enqueued enhanced analysis pipeline for document ${docId} with template and financial analysis`);
  return { ingestionJobId: ingestionJob.id, stages: 10 };
}

// --- FASTIFY SERVER SETUP ---
const loggerOptions: any = { level: process.env['LOG_LEVEL'] || 'info' };
if (process.env['NODE_ENV'] !== 'production') {
  try {
    // Only enable pretty transport if available locally
    require.resolve('pino-pretty');
    loggerOptions.transport = { target: 'pino-pretty' };
  } catch {
    // pretty transport not available, continue with default logger
  }
}
import fastifyExpress from '@fastify/express';
import expressPlugin from './src/plugins/express';

const fastify = Fastify({
  logger: false, // Using custom logger
  bodyLimit: 262144000, // 250MB limit
});

fastify.register(fastifyExpress).then(() => {
  fastify.register(expressPlugin);
});

// Initialize WebSocket server after Fastify is ready
fastify.ready().then(() => {
  if (fastify.server) {
    webSocketProgressService.initialize(fastify.server);
    logger.info('WebSocket progress service initialized');
  }
}).catch(err => {
  logger.error({ err }, 'Failed to initialize WebSocket service');
});

// Register enhanced security middleware
fastify.addHook('onRequest', securityHeaders.api);
fastify.addHook('onRequest', requestLogger);
fastify.addHook('preHandler', sqlProtection.standard);
fastify.addHook('preHandler', xssProtection.standard);
fastify.addHook('preHandler', validateInput);
// Optional Auth (no-op if AUTH_MODE unset)
fastify.addHook('preHandler', authPreHandler);
fastify.addHook('preHandler', permissionGuard);

// Register plugins with enhanced security
fastify.register(multipart);
fastify.register(cors, corsOptions);
fastify.register(fastifyCompress);

// Rate limiting (if available)
if (rateLimit) {
  fastify.register(rateLimit, rateLimitConfig);
}

// Rate limiting (optional)
if (rateLimit) {
  try {
    const max = env.RATE_LIMIT_MAX ? parseInt(env.RATE_LIMIT_MAX, 10) : 100;
    const window = env.RATE_LIMIT_WINDOW || '1 minute';
    fastify.register(rateLimit, { max, timeWindow: window });
  } catch (e) {
    fastify.log.warn('Rate limit plugin not available; continuing without rate limiting');
  }
}

// OpenAPI spec route
registerOpenAPIRoute(fastify).catch(err => fastify.log.warn({ err }, 'openapi-route-failed'));

// Lightweight tracing and API version header
fastify.addHook('onRequest', async (request, reply) => {
  const rid = (request.headers['x-request-id'] as string) || `req-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  (request as any).id = rid;
  reply.header('x-request-id', rid);
  reply.header('x-api-version', 'v0');
});

// Add monitoring hooks with safe wrappers
fastify.addHook('onRequest', async (req, rep) => monitoring.onRequest(req as any, rep as any));
fastify.addHook('onResponse', async (req, rep) => monitoring.onResponse(req as any, rep as any));
fastify.addHook('onError', async (req, rep, error) => monitoring.onError(req as any, rep as any, error as any));

// Central error handler with monitoring integration
registerErrorHandling(fastify).catch(err => fastify.log.error({ err }, 'register-error-handler-failed'));

// Error handling test routes (dev/staging only)
if (process.env['NODE_ENV'] !== 'production') {
  fastify.get('/test/error/validation', async () => {
    throw new AppError(400, 'Invalid request data', true, { field: 'email', message: 'Invalid email format' });
  });
  
  fastify.get('/test/error/not-found', async () => {
    throw new AppError(404, 'Resource not found', true, { resourceId: '123', type: 'contract' });
  });
  
  fastify.get('/test/error/internal', async () => {
    throw new Error('Simulated internal error');
  });

  // Security test routes
  fastify.post('/test/security/sql-injection', async (request) => {
    return { message: 'SQL injection protection working', body: request.body };
  });

  fastify.post('/test/security/xss', async (request) => {
    return { message: 'XSS protection working', body: request.body };
  });

  fastify.get('/test/security/headers', async (_request, reply) => {
    return { 
      message: 'Security headers applied',
      headers: reply.getHeaders()
    };
  });
}

// --- MULTI-TENANCY GUARD ---
// Attach tenantId to request and optionally enforce presence via env.TENANT_ENFORCE = 'true'
fastify.addHook('preHandler', async (request, reply) => {
  // Skip meta endpoints
  if (request.method === 'OPTIONS') return; // Allow CORS preflight to pass through
  if (request.url === '/' || request.url === '/healthz') return;
  // Allow policy metadata endpoints without strict tenant header (UI bootstrap)
  if (request.url.startsWith('/api/policies/')) return;
  const enforce = String(env.TENANT_ENFORCE || 'false').toLowerCase() === 'true';
  const tenantId = (request.headers['x-tenant-id'] as string) || 'demo';
  (request as any).tenantId = tenantId;
  if (enforce && !request.headers['x-tenant-id']) {
    return reply.code(400).send({ error: 'x-tenant-id header required' });
  }
});

// Note: No demo API key auth enforcement; rely on network and deployment-layer controls.

// --- META ENDPOINTS ---
fastify.get('/', async () => ({ hello: 'world' }));
// keep minimal legacy health (mounted here for compatibility)
// '/healthz' provided by healthRoutes; no duplicate here.
// Minimal metrics endpoint (no Prometheus format, simple JSON)
fastify.get('/metrics', async () => ({
  rag: ragMetrics,
  cache: getCacheMetrics(),
  system: monitoring.getMetrics()
}));

// Cache-specific metrics endpoint
fastify.get('/metrics/cache', async () => getCacheMetrics());

// Comprehensive monitoring endpoints
fastify.get('/metrics/system', async () => monitoring.getMetrics());
fastify.get('/metrics/requests', async () => monitoring.getRecentRequests());
fastify.get('/metrics/endpoints', async () => monitoring.getRequestsByEndpoint());
fastify.get('/metrics/slow', async () => monitoring.getSlowRequests());
fastify.get('/metrics/health', async () => monitoring.getHealthStatus());
fastify.get('/metrics/prom', async (_request, reply) => {
  const lines = [
    '# HELP rag_requests_total Total RAG search requests',
    '# TYPE rag_requests_total counter',
    `rag_requests_total ${ragMetrics.count}`,
    '# HELP rag_last_latency_ms Last RAG search latency in milliseconds',
    '# TYPE rag_last_latency_ms gauge',
    `rag_last_latency_ms ${ragMetrics.lastLatencyMs}`,
    '# HELP rag_last_hits Last RAG search hit count',
    '# TYPE rag_last_hits gauge',
    `rag_last_hits ${ragMetrics.lastHits}`,
  ];
  reply.header('content-type', 'text/plain; version=0.0.4');
  return lines.join('\n') + '\n';
});
// Progress tracking endpoints
fastify.get('/contracts/:docId/progress', async (request, reply) => {
  try {
    const { docId } = request.params as { docId: string };
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const progress = progressTrackingService.getProgress(docId);
    
    if (!progress) {
      return reply.code(404).send({ 
        error: 'Progress not found',
        message: 'No progress tracking found for this contract. It may have completed or expired.'
      });
    }
    
    // Verify tenant access
    if (progress.tenantId !== tenantId) {
      return reply.code(403).send({ 
        error: 'Access denied',
        message: 'You do not have access to this contract progress.'
      });
    }
    
    return reply.code(200).send({
      contractId: progress.contractId,
      stage: progress.stage,
      progress: progress.progress,
      message: progress.message,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      completedStages: progress.completedStages,
      errors: progress.errors,
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt
    });
    
  } catch (e) {
    request.log.error(e, 'progress-tracking-error');
    return reply.code(500).send({ error: 'Failed to get progress' });
  }
});

// Get progress for all contracts in a tenant
fastify.get('/contracts/progress', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const allProgress = progressTrackingService.getTenantProgress(tenantId);
    
    return reply.code(200).send({
      tenantId,
      contracts: allProgress.map(progress => ({
        contractId: progress.contractId,
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
        startedAt: progress.startedAt,
        updatedAt: progress.updatedAt,
        hasErrors: (progress.errors?.length || 0) > 0
      }))
    });
    
  } catch (e) {
    request.log.error(e, 'tenant-progress-error');
    return reply.code(500).send({ error: 'Failed to get tenant progress' });
  }
});

// Server-Sent Events endpoint for real-time progress updates
fastify.get('/contracts/progress/stream', async (request, reply) => {
  await sseProgressService.handleConnection(request, reply);
});

// WebSocket endpoint will be handled during server setup
// Real-time progress statistics
fastify.get('/metrics/progress', async (request, reply) => {
  try {
    const sseStats = sseProgressService.getStats();
    const wsStats = webSocketProgressService.getStats();
    
    return reply.code(200).send({
      realTimeConnections: {
        sse: sseStats,
        websocket: wsStats,
        total: sseStats.totalConnections + wsStats.totalConnections
      },
      activeProgress: {
        totalContracts: progressTrackingService.getTenantProgress('demo').length, // This would be improved with proper tenant handling
        byStage: {} // Could be enhanced to show progress by stage
      }
    });
    
  } catch (e) {
    request.log.error(e, 'progress-metrics-error');
    return reply.code(500).send({ error: 'Failed to get progress metrics' });
  }
});

// Internal API endpoints for workers to update progress
fastify.post('/internal/progress/update', async (request, reply) => {
  try {
    const { contractId, tenantId, stage, progress, message, metadata } = request.body as any;
    
    if (!contractId || !tenantId || !stage || progress === undefined) {
      return reply.code(400).send({ 
        error: 'Missing required fields: contractId, tenantId, stage, progress' 
      });
    }
    
    const result = progressTrackingService.updateProgress(
      contractId,
      stage,
      progress,
      message,
      metadata
    );
    
    if (!result) {
      return reply.code(404).send({ 
        error: 'Progress tracking not found for contract' 
      });
    }
    
    return reply.code(200).send({ success: true });
    
  } catch (e) {
    request.log.error(e, 'progress-update-error');
    return reply.code(500).send({ error: 'Failed to update progress' });
  }
});

fastify.post('/internal/progress/complete', async (request, reply) => {
  try {
    const { contractId, tenantId, stage, message } = request.body as any;
    
    if (!contractId || !tenantId || !stage) {
      return reply.code(400).send({ 
        error: 'Missing required fields: contractId, tenantId, stage' 
      });
    }
    
    const result = progressTrackingService.completeStage(contractId, stage, message);
    
    if (!result) {
      return reply.code(404).send({ 
        error: 'Progress tracking not found for contract' 
      });
    }
    
    return reply.code(200).send({ success: true });
    
  } catch (e) {
    request.log.error(e, 'progress-complete-error');
    return reply.code(500).send({ error: 'Failed to complete stage' });
  }
});

fastify.post('/internal/progress/error', async (request, reply) => {
  try {
    const { contractId, tenantId, stage, error, recoverable, retryCount } = request.body as any;
    
    if (!contractId || !tenantId || !stage || !error) {
      return reply.code(400).send({ 
        error: 'Missing required fields: contractId, tenantId, stage, error' 
      });
    }
    
    const result = progressTrackingService.addError(
      contractId,
      stage,
      error,
      recoverable !== false, // Default to true
      retryCount || 0
    );
    
    if (!result) {
      return reply.code(404).send({ 
        error: 'Progress tracking not found for contract' 
      });
    }
    
    return reply.code(200).send({ success: true });
    
  } catch (e) {
    request.log.error(e, 'progress-error-report-error');
    return reply.code(500).send({ error: 'Failed to report error' });
  }
});

// Circuit breaker management endpoints
fastify.get('/internal/circuit-breakers', async (request, reply) => {
  try {
    const { circuitBreakerManager } = await import('./src/services/circuit-breaker.service');
    const stats = circuitBreakerManager.getAllStats();
    const health = circuitBreakerManager.getHealthStatus();
    
    return reply.code(200).send({
      stats,
      health,
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'circuit-breaker-stats-error');
    return reply.code(500).send({ error: 'Failed to get circuit breaker stats' });
  }
});

fastify.post('/internal/circuit-breakers/:name/force-open', async (request, reply) => {
  try {
    const { name } = request.params as { name: string };
    const { circuitBreakerManager } = await import('./src/services/circuit-breaker.service');
    
    const breaker = circuitBreakerManager.getBreaker(name);
    breaker.forceOpen();
    
    return reply.code(200).send({ 
      success: true, 
      message: `Circuit breaker ${name} forced open` 
    });
    
  } catch (e) {
    request.log.error(e, 'circuit-breaker-force-open-error');
    return reply.code(500).send({ error: 'Failed to force open circuit breaker' });
  }
});

fastify.post('/internal/circuit-breakers/:name/force-close', async (request, reply) => {
  try {
    const { name } = request.params as { name: string };
    const { circuitBreakerManager } = await import('./src/services/circuit-breaker.service');
    
    const breaker = circuitBreakerManager.getBreaker(name);
    breaker.forceClose();
    
    return reply.code(200).send({ 
      success: true, 
      message: `Circuit breaker ${name} forced closed` 
    });
    
  } catch (e) {
    request.log.error(e, 'circuit-breaker-force-close-error');
    return reply.code(500).send({ error: 'Failed to force close circuit breaker' });
  }
});

// Cross-Contract Intelligence API endpoints
fastify.get('/api/contracts/:contractId/relationships', async (request, reply) => {
  try {
    const { contractId } = request.params as { contractId: string };
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Get existing contracts for relationship analysis
    const contracts = listContracts(tenantId);
    
    // Analyze relationships
    const relationships = await crossContractIntelligenceService.analyzeContractRelationships(
      contractId, 
      tenantId, 
      contracts
    );
    
    return reply.code(200).send({
      contractId,
      relationships,
      totalRelationships: relationships.length,
      relationshipTypes: [...new Set(relationships.map(r => r.relationshipType))]
    });
    
  } catch (e) {
    request.log.error(e, 'contract-relationships-error');
    return reply.code(500).send({ error: 'Failed to analyze contract relationships' });
  }
});

fastify.get('/api/portfolio/patterns', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Get contracts for pattern analysis
    const contracts = listContracts(tenantId);
    
    // Identify patterns
    const patterns = await crossContractIntelligenceService.identifyContractPatterns(tenantId, contracts);
    
    // Group patterns by type
    const patternsByType = patterns.reduce((acc, pattern) => {
      if (!acc[pattern.patternType]) {
        acc[pattern.patternType] = [];
      }
      acc[pattern.patternType].push(pattern);
      return acc;
    }, {} as Record<string, any[]>);
    
    return reply.code(200).send({
      tenantId,
      totalPatterns: patterns.length,
      patternsByType,
      patterns: patterns.slice(0, 20) // Limit to first 20 for performance
    });
    
  } catch (e) {
    request.log.error(e, 'portfolio-patterns-error');
    return reply.code(500).send({ error: 'Failed to identify portfolio patterns' });
  }
});

fastify.get('/api/portfolio/insights', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Get contracts for insight generation
    const contracts = listContracts(tenantId);
    
    // Generate insights
    const insights = await crossContractIntelligenceService.generatePortfolioInsights(tenantId, contracts);
    
    // Sort by impact and confidence
    const sortedInsights = insights.sort((a, b) => {
      const impactWeight = { high: 3, medium: 2, low: 1 };
      const aScore = impactWeight[a.impact] * a.confidence;
      const bScore = impactWeight[b.impact] * b.confidence;
      return bScore - aScore;
    });
    
    // Calculate potential savings and risk reduction
    const totalSavings = insights.reduce((sum, insight) => sum + (insight.potentialSavings || 0), 0);
    const totalRiskReduction = insights.reduce((sum, insight) => sum + (insight.riskReduction || 0), 0);
    
    return reply.code(200).send({
      tenantId,
      totalInsights: insights.length,
      insights: sortedInsights,
      summary: {
        potentialSavings: totalSavings,
        riskReduction: totalRiskReduction,
        highImpactInsights: insights.filter(i => i.impact === 'high').length,
        mediumImpactInsights: insights.filter(i => i.impact === 'medium').length,
        lowImpactInsights: insights.filter(i => i.impact === 'low').length
      }
    });
    
  } catch (e) {
    request.log.error(e, 'portfolio-insights-error');
    return reply.code(500).send({ error: 'Failed to generate portfolio insights' });
  }
});

fastify.get('/api/contracts/:contractId/similar', async (request, reply) => {
  try {
    const { contractId } = request.params as { contractId: string };
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const query = request.query as any;
    const limit = parseInt(query.limit || '10', 10);
    const minSimilarity = parseFloat(query.minSimilarity || '0.3');
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Get all contracts
    const contracts = listContracts(tenantId);
    const targetContract = contracts.find(c => c.id === contractId);
    
    if (!targetContract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    
    // Find similar contracts through relationship analysis
    const relationships = await crossContractIntelligenceService.analyzeContractRelationships(
      contractId, 
      tenantId, 
      contracts
    );
    
    // Filter and sort by similarity strength
    const similarContracts = relationships
      .filter(r => r.strength >= minSimilarity)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map(r => {
        const contract = contracts.find(c => c.id === r.targetContractId);
        return {
          contractId: r.targetContractId,
          contract: contract ? {
            id: contract.id,
            name: contract.name,
            status: contract.status,
            createdAt: contract.createdAt
          } : null,
          similarity: r.strength,
          relationshipType: r.relationshipType,
          description: r.description,
          identifiedBy: r.identifiedBy
        };
      });
    
    return reply.code(200).send({
      contractId,
      similarContracts,
      totalFound: similarContracts.length,
      searchCriteria: {
        minSimilarity,
        limit
      }
    });
    
  } catch (e) {
    request.log.error(e, 'similar-contracts-error');
    return reply.code(500).send({ error: 'Failed to find similar contracts' });
  }
});

fastify.get('/api/portfolio/analytics', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Get all data
    const contracts = listContracts(tenantId);
    const patterns = crossContractIntelligenceService.getTenantPatterns(tenantId);
    const insights = crossContractIntelligenceService.getTenantInsights(tenantId);
    
    // Calculate analytics
    const totalValue = contracts.reduce((sum, c) => sum + (c.totalValue || 0), 0);
    const averageValue = totalValue / Math.max(contracts.length, 1);
    
    const contractsByStatus = contracts.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const patternsByType = patterns.reduce((acc, p) => {
      acc[p.patternType] = (acc[p.patternType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const insightsByCategory = insights.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return reply.code(200).send({
      tenantId,
      portfolio: {
        totalContracts: contracts.length,
        totalValue,
        averageValue,
        contractsByStatus
      },
      intelligence: {
        totalPatterns: patterns.length,
        patternsByType,
        totalInsights: insights.length,
        insightsByCategory
      },
      recommendations: {
        topInsights: insights
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
          .map(i => ({
            category: i.category,
            title: i.title,
            impact: i.impact,
            confidence: i.confidence
          }))
      }
    });
    
  } catch (e) {
    request.log.error(e, 'portfolio-analytics-error');
    return reply.code(500).send({ error: 'Failed to generate portfolio analytics' });
  }
});

fastify.post('/api/portfolio/refresh-intelligence', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    
    const { crossContractIntelligenceService } = await import('./src/services/cross-contract-intelligence.service');
    
    // Clear existing data
    crossContractIntelligenceService.clearTenantData(tenantId);
    
    // Get contracts
    const contracts = listContracts(tenantId);
    
    // Regenerate all intelligence
    const patterns = await crossContractIntelligenceService.identifyContractPatterns(tenantId, contracts);
    const insights = await crossContractIntelligenceService.generatePortfolioInsights(tenantId, contracts);
    
    // Analyze relationships for all contracts
    const relationshipPromises = contracts.map(contract => 
      crossContractIntelligenceService.analyzeContractRelationships(contract.id, tenantId, contracts)
    );
    
    const allRelationships = await Promise.all(relationshipPromises);
    const totalRelationships = allRelationships.reduce((sum, rels) => sum + rels.length, 0);
    
    return reply.code(200).send({
      success: true,
      tenantId,
      refreshed: {
        patterns: patterns.length,
        insights: insights.length,
        relationships: totalRelationships,
        contracts: contracts.length
      },
      message: 'Cross-contract intelligence refreshed successfully'
    });
    
  } catch (e) {
    request.log.error(e, 'refresh-intelligence-error');
    return reply.code(500).send({ error: 'Failed to refresh cross-contract intelligence' });
  }
});

// Database Performance Management API endpoints
fastify.get('/api/admin/database/performance', async (request, reply) => {
  try {
    const { databasePerformanceService } = await import('./src/services/database-performance.service');
    const { connectionPoolService } = await import('./src/services/connection-pool.service');
    
    const performanceMetrics = databasePerformanceService.getPerformanceMetrics();
    const connectionStats = connectionPoolService.getStats();
    const queryAnalysis = databasePerformanceService.analyzeQueryPerformance();
    
    return reply.code(200).send({
      performance: performanceMetrics,
      connectionPool: connectionStats,
      queryAnalysis: {
        slowQueries: queryAnalysis.slowQueries.length,
        recommendations: queryAnalysis.recommendations,
        cacheEfficiency: queryAnalysis.cacheEfficiency
      },
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'database-performance-error');
    return reply.code(500).send({ error: 'Failed to get database performance metrics' });
  }
});

fastify.get('/api/admin/database/connections', async (request, reply) => {
  try {
    const { connectionPoolService } = await import('./src/services/connection-pool.service');
    
    const stats = connectionPoolService.getStats();
    const connections = connectionPoolService.getConnectionDetails();
    const healthCheck = await connectionPoolService.healthCheck();
    
    return reply.code(200).send({
      stats,
      connections: connections.slice(0, 20), // Limit to first 20 for performance
      health: healthCheck,
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'database-connections-error');
    return reply.code(500).send({ error: 'Failed to get connection pool information' });
  }
});

fastify.post('/api/admin/database/optimize', async (request, reply) => {
  try {
    const { databasePerformanceService } = await import('./src/services/database-performance.service');
    
    // Create optimized indexes
    const indexResults = await databasePerformanceService.createOptimizedIndexes();
    
    // Create/refresh materialized views
    const viewResults = await databasePerformanceService.createMaterializedViews();
    
    return reply.code(200).send({
      success: true,
      optimization: {
        indexes: {
          created: indexResults.created.length,
          skipped: indexResults.skipped.length,
          errors: indexResults.errors.length,
          details: indexResults
        },
        materializedViews: {
          created: viewResults.created.length,
          refreshed: viewResults.refreshed.length,
          errors: viewResults.errors.length,
          details: viewResults
        }
      },
      message: 'Database optimization completed',
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'database-optimize-error');
    return reply.code(500).send({ error: 'Failed to optimize database' });
  }
});

fastify.get('/api/admin/database/slow-queries', async (request, reply) => {
  try {
    const { databasePerformanceService } = await import('./src/services/database-performance.service');
    
    const analysis = databasePerformanceService.analyzeQueryPerformance();
    
    return reply.code(200).send({
      slowQueries: analysis.slowQueries.map(query => ({
        queryType: query.queryType,
        executionTime: query.executionTime,
        rowsAffected: query.rowsAffected,
        indexesUsed: query.indexesUsed,
        timestamp: query.timestamp
      })),
      recommendations: analysis.recommendations,
      cacheEfficiency: analysis.cacheEfficiency,
      summary: {
        totalSlowQueries: analysis.slowQueries.length,
        averageSlowQueryTime: analysis.slowQueries.length > 0 
          ? analysis.slowQueries.reduce((sum, q) => sum + q.executionTime, 0) / analysis.slowQueries.length 
          : 0
      }
    });
    
  } catch (e) {
    request.log.error(e, 'slow-queries-error');
    return reply.code(500).send({ error: 'Failed to analyze slow queries' });
  }
});

fastify.post('/api/admin/database/batch-insert', async (request, reply) => {
  try {
    const { table, records, options } = request.body as {
      table: string;
      records: any[];
      options?: { batchSize?: number; onConflict?: 'ignore' | 'update' };
    };
    
    if (!table || !records || !Array.isArray(records)) {
      return reply.code(400).send({ 
        error: 'Missing required fields: table, records (array)' 
      });
    }
    
    const { databasePerformanceService } = await import('./src/services/database-performance.service');
    
    const result = await databasePerformanceService.batchInsert(table, records, options);
    
    return reply.code(200).send({
      success: true,
      table,
      totalRecords: records.length,
      result,
      batchSize: options?.batchSize || 1000,
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'batch-insert-error');
    return reply.code(500).send({ error: 'Failed to perform batch insert' });
  }
});

fastify.get('/api/admin/database/health', async (request, reply) => {
  try {
    const { connectionPoolService } = await import('./src/services/connection-pool.service');
    const { databasePerformanceService } = await import('./src/services/database-performance.service');
    
    const connectionHealth = await connectionPoolService.healthCheck();
    const performanceMetrics = databasePerformanceService.getPerformanceMetrics();
    
    const overallHealth = connectionHealth.healthy && 
                         performanceMetrics.queryMetrics.cacheHitRate > 30 &&
                         performanceMetrics.queryMetrics.averageExecutionTime < 2000;
    
    return reply.code(200).send({
      healthy: overallHealth,
      components: {
        connectionPool: {
          healthy: connectionHealth.healthy,
          stats: connectionHealth.stats,
          issues: connectionHealth.issues
        },
        queryPerformance: {
          healthy: performanceMetrics.queryMetrics.averageExecutionTime < 2000,
          averageExecutionTime: performanceMetrics.queryMetrics.averageExecutionTime,
          cacheHitRate: performanceMetrics.queryMetrics.cacheHitRate,
          slowQueryCount: performanceMetrics.queryMetrics.slowQueryCount
        }
      },
      recommendations: [
        ...connectionHealth.issues,
        ...(performanceMetrics.queryMetrics.cacheHitRate < 50 ? ['Consider optimizing query cache settings'] : []),
        ...(performanceMetrics.queryMetrics.slowQueryCount > 10 ? ['Review and optimize slow queries'] : [])
      ],
      timestamp: new Date()
    });
    
  } catch (e) {
    request.log.error(e, 'database-health-error');
    return reply.code(500).send({ error: 'Failed to check database health' });
  }
});

// Simple RAG search endpoint
fastify.get('/api/rag/search', async (request, reply) => {
  try {
    if ((env.RAG_ENABLED || '').toLowerCase() !== 'true') return reply.code(200).send({ enabled: false, items: [] });
    const q = request.query as any;
  const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const docId = String(q.docId || '').trim();
    const query = String(q.q || '').slice(0, 500);
    const topK = q.k ? parseInt(String(q.k), 10) : (env.RAG_TOP_K || 6);
    if (!docId || !query) return reply.code(400).send({ error: 'docId and q are required' });

    let rag: any;
    try {
      rag = require('clients-rag');
    } catch {
      rag = require('../../packages/clients/rag');
    }
  const t0 = Date.now();
  const items = await rag.retrieve(docId, tenantId, query, topK);
  const dt = Date.now() - t0;
  ragMetrics.count += 1;
  ragMetrics.lastLatencyMs = dt;
  ragMetrics.lastHits = Array.isArray(items) ? items.length : 0;
  request.log.info({ tenantId, docId, qlen: query.length, topK, hits: ragMetrics.lastHits, dt }, 'rag.search');
  return { enabled: true, items };
  } catch (e) {
    request.log.error(e, 'RAG search error');
    return reply.code(500).send({ error: 'RAG search failed' });
  }
});

// --- SIGNED URL UPLOAD FLOW ---
fastify.post('/uploads/init-signed', async (request, reply) => {
  const correlationId = (request as any).id;
  
  try {
    if (!getSignedUrl) return reply.code(501).send({ error: 'Signed URL not supported' });
    
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const schema = z.object({ 
      filename: z.string().min(1).max(255), 
      contentType: z.string().min(3).max(200).optional(),
      size: z.number().optional()
    });
    
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ 
        error: 'Invalid payload', 
        details: parsed.error.issues,
        correlationId 
      });
    }
    
    const { filename, contentType, size } = parsed.data;
    
    // Enhanced file validation
    const validationResult = await fileValidationService.validateFile({
      filename,
      contentType: contentType || 'application/octet-stream',
      size: size || 0
    });
    
    if (!validationResult.isValid) {
      return reply.code(400).send({ 
        error: 'File validation failed',
        details: validationResult.errors,
        warnings: validationResult.warnings,
        correlationId
      });
    }
    
    const docId = newDocId();
    
    // Initialize progress tracking
    progressTrackingService.initializeProgress(docId, tenantId);
    progressTrackingService.updateProgress(
      docId, 
      ProcessingStage.UPLOAD_VALIDATION, 
      100, 
      'File validation completed successfully'
    );
    
    const storagePath = `uploads/${tenantId}/${docId}/${filename}`;
    const url = getSignedUrl({ 
      Bucket: env.S3_BUCKET || 'contracts', 
      Key: storagePath, 
      Expires: 600, 
      ContentType: contentType 
    });
    
    logger.info({ 
      docId, 
      tenantId, 
      filename, 
      contentType, 
      correlationId 
    }, 'Signed upload initialized');
    
    return reply.code(200).send({ 
      docId, 
      uploadUrl: url, 
      storagePath,
      correlationId,
      validation: {
        warnings: validationResult.warnings,
        metadata: validationResult.metadata
      }
    });
    
  } catch (e) {
    const recoveryResult = await uploadErrorHandlerService.handleError(
      e as Error,
      { operation: 'init-signed', tenantId: (request as any).tenantId },
      correlationId
    );
    
    request.log.error({ 
      error: e, 
      correlationId,
      recovery: recoveryResult 
    }, 'init-signed-error');
    
    return reply.code(500).send({ 
      error: uploadErrorHandlerService.createUserMessage(
        e as any, 
        recoveryResult
      ),
      correlationId,
      retryAfter: recoveryResult.retryAfter
    });
  }
});

fastify.post('/uploads/finalize', async (request, reply) => {
  const correlationId = (request as any).id;
  
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const schema = z.object({ 
      docId: z.string().min(1), 
      filename: z.string().min(1), 
      storagePath: z.string().min(1),
      checksum: z.string().optional()
    });
    
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ 
        error: 'Invalid payload', 
        details: parsed.error.issues,
        correlationId 
      });
    }
    
    const { docId, filename, storagePath, checksum } = parsed.data;
    
    // Update progress
    progressTrackingService.updateProgress(
      docId, 
      ProcessingStage.FILE_EXTRACTION, 
      10, 
      'Finalizing upload and preparing for processing...'
    );
    
    // Store contract in database
    addContract({ 
      id: docId, 
      name: filename, 
      status: 'UPLOADED', 
      createdAt: new Date(), 
      updatedAt: new Date(), 
      tenantId, 
      storagePath,
      checksum 
    });
    
    // Clear cache
    contractCache.clear('contract_list');
    contractCache.delete('contract_detail', `${tenantId}_${docId}`);
    
    // Complete upload validation stage
    progressTrackingService.completeStage(
      docId, 
      ProcessingStage.UPLOAD_VALIDATION, 
      'Upload completed successfully'
    );

    try {
      if (getQueue) {
        // Start the enhanced analysis pipeline
        const pipelineResult = await enqueueAnalysisPipeline(docId, tenantId);
        monitoring.startAnalysis(docId);
        
        // Update progress to file extraction stage
        progressTrackingService.updateProgress(
          docId, 
          ProcessingStage.FILE_EXTRACTION, 
          20, 
          'Analysis pipeline started - extracting content...'
        );
        
        logger.info({ 
          docId, 
          tenantId, 
          filename, 
          pipelineResult,
          correlationId 
        }, 'Upload finalized and analysis started');
        
      } else {
        // Without a queue, create placeholders and mark as completed
        try { 
          savePlaceholderArtifacts(docId); 
          progressTrackingService.completeStage(
            docId, 
            ProcessingStage.COMPLETED, 
            'Processing completed with placeholder data'
          );
        } catch (placeholderError) {
          progressTrackingService.addError(
            docId,
            ProcessingStage.ARTIFACT_GENERATION,
            'Failed to create placeholder artifacts',
            false
          );
        }
      }
      
      monitoring.trackUpload(true);
      
      return reply.code(201).send({ 
        docId,
        correlationId,
        message: 'Upload completed successfully. Processing has begun.',
        estimatedProcessingTime: progressTrackingService.getProgress(docId)?.estimatedTimeRemaining
      });
      
    } catch (e) {
      monitoring.trackUpload(false);
      
      // Add error to progress tracking
      progressTrackingService.addError(
        docId,
        ProcessingStage.FILE_EXTRACTION,
        'Failed to start processing pipeline',
        true
      );
      
      const recoveryResult = await uploadErrorHandlerService.handleError(
        e as Error,
        { operation: 'finalize-processing', docId, tenantId },
        correlationId
      );
      
      request.log.error({ 
        err: e, 
        docId, 
        correlationId,
        recovery: recoveryResult 
      }, 'finalize-enqueue-error');
      
      return reply.code(500).send({ 
        error: uploadErrorHandlerService.createUserMessage(
          e as any, 
          recoveryResult
        ),
        docId,
        correlationId,
        retryAfter: recoveryResult.retryAfter
      });
    }
    
  } catch (e) {
    const recoveryResult = await uploadErrorHandlerService.handleError(
      e as Error,
      { operation: 'finalize', tenantId: (request as any).tenantId },
      correlationId
    );
    
    request.log.error({ 
      error: e, 
      correlationId,
      recovery: recoveryResult 
    }, 'finalize-error');
    
    return reply.code(500).send({ 
      error: uploadErrorHandlerService.createUserMessage(
        e as any, 
        recoveryResult
      ),
      correlationId,
      retryAfter: recoveryResult.retryAfter
    });
  }
});

// --- UPLOAD HELPERS ---
async function streamToString(stream: NodeJS.ReadableStream, maxBytes = 2_000_000): Promise<string> {
  // Cap to ~2MB to avoid OOM on large files; but fully drain the stream to keep Fastify happy.
  const chunks: Buffer[] = [];
  let total = 0;
  let truncated = false;
  const cap = Math.max(64 * 1024, maxBytes);
  for await (const chunk of stream as any) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
    if (!truncated) {
      if (total + buf.length > cap) {
        const remain = cap - total;
        if (remain > 0) chunks.push(buf.subarray(0, remain));
        total = cap;
        truncated = true;
        // continue to drain remaining bytes without storing
      } else {
        chunks.push(buf);
        total += buf.length;
      }
    }
    // else: already truncated, just keep iterating to drain
  }
  const s = Buffer.concat(chunks as any, total).toString('utf8');
  return truncated ? s + '\n\n[TRUNCATED]' : s;
}

function newDocId() {
  return `doc-${Date.now()}-${randomBytes(3).toString('hex')}`;
}

// embedWithRetry removed (was unused)

// --- LIGHTWEIGHT IN-PROCESS ANALYSIS PIPELINE ---
// This complements the external workers: when Redis/DB aren't configured, we still analyze uploads
// and populate artifacts using heuristics and optional LLM.
function schedule(fn: () => Promise<void>) {
  // Defer to next tick so we never block the request
  setTimeout(() => { fn().catch(() => {/* swallow */}); }, 10);
}

function inferPartiesFromText(text: string): string[] {
  const t = String(text || '');
  const between = t.match(/between\s+(.+?)\s+and\s+(.+?)(?:[\.;\n]|$)/i);
  const client = t.match(/client\s*[:\-]\s*([^\n\r]+)$/im)?.[1]?.trim();
  const supplier = t.match(/(supplier|vendor)\s*[:\-]\s*([^\n\r]+)$/im)?.[2]?.trim();
  if (between && between[1] && between[2]) return [between[1].trim(), between[2].trim()].filter(Boolean);
  const parts = [client, supplier].filter(Boolean) as string[];
  if (parts.length) return parts;
  const header = t.slice(0, 2000);
  const guesses = Array.from(new Set((header.match(/[A-Z][A-Za-z0-9&.,\- ]{2,60}\b/g) || [])
    .map(s => s.trim())
    .filter(s => s.length > 2 && !/^(the|and|or|of|agreement|contract|statement|work|services|terms)$/i.test(s)))).slice(0, 2);
  return guesses;
}

async function analyzeOverview(docId: string, _tenantId: string, text: string) {
  const start = Date.now();
  let summary = (text || '').slice(0, 800).trim() || 'No content extracted';
  let parties = inferPartiesFromText(text);
  const apiKey = process.env['OPENAI_API_KEY'];
  const allowLLM = String(process.env['ANALYSIS_USE_LLM_OVERVIEW'] ?? process.env['ANALYSIS_USE_LLM'] ?? 'true') === 'true';
  if (apiKey && allowLLM && OpenAIClientCtor) {
    try {
      const client = new OpenAIClientCtor(apiKey);
      const schema = {
        type: 'object',
        required: ['summary','parties'],
        additionalProperties: false,
        properties: { summary: { type: 'string' }, parties: { type: 'array', items: { type: 'string' } } },
      };
      const result = await (client as any).createStructured({
        model: process.env['OPENAI_MODEL'] || 'gpt-4o-mini',
        system: 'Extract a one-sentence summary and a list of parties from this contract text.',
        userChunks: [ { type:'text', role:'user', content: (text || '').slice(0, 10000) } ],
        schema,
        temperature: 0,
      });
      if (result?.summary) summary = String(result.summary).trim() || summary;
      if (Array.isArray(result?.parties) && result.parties.length) parties = result.parties.slice(0, 10);
    } catch (e) {
      fastify.log.warn({ docId, err: (e as any)?.message }, 'overview LLM failed; using heuristics');
    }
  }
  const artifact = {
    metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'overview', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] },
    summary,
    parties,
  };
  saveArtifacts(docId, { overview: artifact as any });
  markStage(docId, 'overview', true);
}

async function analyzeRates(docId: string, _tenantId: string, text: string) {
  const start = Date.now();
  const rates: any[] = [];
  const apiKey = process.env['OPENAI_API_KEY'];
  const model = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';
  const USE_LLM = String(process.env['ANALYSIS_USE_LLM_RATES'] ?? process.env['ANALYSIS_USE_LLM'] ?? 'true') === 'true';

  // Simple table/line heuristic
  try {
    const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const money = /(?:USD|EUR|GBP)?\s*(?:[$€£])\s?\d{1,3}(?:[,]\d{3})*(?:[.,]\d+)?/i;
    for (const line of lines.slice(0, 2000)) {
      if (!/(hour|day|month|year)/i.test(line)) continue;
      if (!money.test(line)) continue;
      const cols = line.split(/\s{2,}|\t|\s\|\s/).filter(Boolean);
      const unitCell = cols.find(c => /hour|day|month|year/i.test(c)) || 'Hour';
      const priceCell = (line.match(/([$€£]\s?\d[\d,]*(?:[.,]\d+)?)/) || [])[0] || '';
      const currency = /€/.test(priceCell) ? 'EUR' : /£/.test(priceCell) ? 'GBP' : 'USD';
      const amount = Number(priceCell.replace(/[^0-9.,]/g,'').replace(/,/g,'').replace(/(\..*)\./,'$1'));
      if (!amount || !isFinite(amount)) continue;
      const uom = /(hour|hr)/i.test(unitCell) ? 'Hour' : /(month|mo)/i.test(unitCell) ? 'Month' : /(year|yr|annual)/i.test(unitCell) ? 'Year' : 'Day';
      const title = (cols[0] || '').trim() || (/(hour|hr)/i.test(unitCell) ? 'Hourly Rate' : /(month|mo)/i.test(unitCell) ? 'Monthly Rate' : /(year|yr|annual)/i.test(unitCell) ? 'Yearly Rate' : 'Daily Rate');
      const mapped = mapRoleDetail(title);
      const daily = normalizeToDaily(amount, uom as any);
      const dailyUsd = convertCurrency(daily, currency as any, 'USD');
      rates.push({
        pdfRole: title,
        role: mapped.role,
        seniority: mapped.seniority,
        mappingConfidence: mapped.confidence,
        currency,
        uom,
        amount,
        dailyUsd: Math.round(dailyUsd),
        country: 'Unknown',
        lineOfService: 'Unknown',
      });
      if (rates.length >= 100) break;
    }
  } catch {}

  if (USE_LLM && apiKey && OpenAIClientCtor && text && rates.length < 3) {
    try {
      const client = new OpenAIClientCtor(apiKey);
      const schema = {
        type: 'object', additionalProperties: true,
        properties: { items: { type: 'array', items: { type: 'object', additionalProperties: true, properties: { title: { type:'string' }, seniority: { type:'string' }, amount: { type:'number' }, currency: { type:'string' }, unit: { type:'string' }, raw_line: { type:'string' } } } } },
      };
      const result = await (client as any).createStructured({
        model,
        system: 'Extract rate lines with amount, currency, and unit (Hour/Day/Month/Year).',
        userChunks: [ { type:'text', role:'user', content: (text || '').slice(0, 100000) } ],
        schema,
        temperature: 0,
      });
      let items: any[] = Array.isArray((result as any)?.items) ? (result as any).items : Array.isArray((result as any)?.rates) ? (result as any).rates : Array.isArray((result as any)?.data?.items) ? (result as any).data.items : [];
      for (const it of items) {
        const uom = /(hour|hr)/i.test(String(it.unit||'')) ? 'Hour' : /(month|mo)/i.test(String(it.unit||'')) ? 'Month' : /(year|yr|annual)/i.test(String(it.unit||'')) ? 'Year' : 'Day';
        const amount = Number(it.amount);
        if (!amount || !isFinite(amount) || amount <= 0) continue;
        const cur = ((it.currency || 'USD') as string).toUpperCase();
        const title = String(it.title || '').trim() || (uom === 'Hour' ? 'Hourly Rate' : uom === 'Month' ? 'Monthly Rate' : uom === 'Year' ? 'Yearly Rate' : 'Daily Rate');
        const mapped = mapRoleDetail(title);
        const daily = normalizeToDaily(amount, uom as any);
        const dailyUsd = convertCurrency(daily, cur as any, 'USD');
        rates.push({
          pdfRole: title,
          role: mapped.role,
          seniority: mapped.seniority,
          mappingConfidence: mapped.confidence,
          sourceLine: it.raw_line || undefined,
          currency: cur,
          uom,
          amount,
          dailyUsd: Math.round(dailyUsd),
          country: 'Unknown',
          lineOfService: 'Unknown',
        });
        if (rates.length >= 100) break;
      }
    } catch (e) {
      fastify.log.warn({ docId, err: (e as any)?.message }, 'rates LLM failed; using heuristics');
    }
  }

  if (rates.length === 0 && text) {
    const re = /(hourly|per\s*hour|daily|per\s*day|monthly|per\s*month|yearly|per\s*year)\s*(?:rate)?\s*[:\-]?\s*([$€£]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)(?:\s*(USD|EUR|GBP))?/ig;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && rates.length < 50) {
      const unitHint = m[1] || '';
      const amountRaw = (m[2] || '').replace(/[\,\s]/g, '').replace('€','').replace('£','').replace('$','');
      const amount = Number(amountRaw.replace(',', '.'));
      if (!amount || !isFinite(amount)) continue;
      const currency = (m[3] || (/[€]/.test(m[2]||'') ? 'EUR' : /[£]/.test(m[2]||'') ? 'GBP' : 'USD')).toUpperCase();
      const uom = /(hour|hr)/i.test(unitHint) ? 'Hour' : /(month|mo)/i.test(unitHint) ? 'Month' : /(year|yr|annual)/i.test(unitHint) ? 'Year' : 'Day';
      const title = /(hour|hr)/i.test(unitHint) ? 'Hourly Rate' : /(month|mo)/i.test(unitHint) ? 'Monthly Rate' : /(year|yr|annual)/i.test(unitHint) ? 'Yearly Rate' : 'Daily Rate';
      const mapped = mapRoleDetail(title);
      const daily = normalizeToDaily(amount, uom as any);
      const dailyUsd = convertCurrency(daily, currency as any, 'USD');
      rates.push({ pdfRole: title, role: mapped.role, seniority: mapped.seniority, mappingConfidence: mapped.confidence, currency, uom, amount, dailyUsd: Math.round(dailyUsd), country: 'Unknown', lineOfService: 'Unknown' });
    }
  }

  if (rates.length === 0) rates.push({ rateName: 'Day Rate', value: 1000, currency: 'USD' });

  const artifact = { metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'rates', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] }, rates };
  saveArtifacts(docId, { rates: artifact as any });
  markStage(docId, 'rates', true);
}

async function analyzeRisk(docId: string, _tenantId: string, text: string) {
  const start = Date.now();
  const t = String(text || '').toLowerCase();
  const risks: any[] = [];
  if (/payment\s+terms?:?\s*(more than|over|exceed)\s*60/.test(t) || (/net\s*\d{2,3}/.test(t) && /net\s*(?:90|120)/.test(t))) {
    risks.push({ riskType: 'Late Payment', description: 'Payment terms may exceed 60 days', severity: 'medium' });
  }
  if (!/confidential/.test(t)) risks.push({ riskType: 'Confidentiality', description: 'Confidentiality not clearly defined', severity: 'medium' });
  if (!/limitation\s+of\s+liability|liability\s+cap/.test(t)) risks.push({ riskType: 'Liability', description: 'No clear limitation of liability found', severity: 'high' });
  if (!risks.length) risks.push({ riskType: 'General', description: 'No major risks detected heuristically', severity: 'low' });
  const artifact = { metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'risk', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] }, risks };
  saveArtifacts(docId, { risk: artifact as any });
  markStage(docId, 'risk', true);
}

async function analyzeClauses(docId: string, _tenantId: string, _text: string) {
  const start = Date.now();
  const artifact = { metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'clauses', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] }, clauses: [] };
  saveArtifacts(docId, { clauses: artifact as any });
  markStage(docId, 'clauses', true);
}

async function analyzeCompliance(docId: string, _tenantId: string, _text: string) {
  const start = Date.now();
  const artifact = { metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'compliance', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] }, compliance: [] };
  saveArtifacts(docId, { compliance: artifact as any });
  markStage(docId, 'compliance', true);
}

async function analyzeBenchmark(docId: string, _tenantId: string, _text: string) {
  const start = Date.now();
  const artifact = { metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'benchmark', timestamp: new Date().toISOString(), durationMs: Date.now() - start }] }, benchmark: {} };
  saveArtifacts(docId, { benchmark: artifact as any });
  markStage(docId, 'benchmark', true);
}

async function runAnalysisPipeline(docId: string, tenantId: string, text: string) {
  try {
    updateContract(docId, { status: 'PROCESSING' });
    createRun(docId);
    await analyzeOverview(docId, tenantId, text);
    await analyzeRates(docId, tenantId, text);
    await analyzeRisk(docId, tenantId, text);
    await analyzeClauses(docId, tenantId, text);
    await analyzeCompliance(docId, tenantId, text);
    await analyzeBenchmark(docId, tenantId, text);
    // If all core stages present, mark contract completed
    updateContract(docId, { status: 'COMPLETED' });
  } catch (e) {
    markStage(docId, 'overview', false, (e as any)?.message);
    markStage(docId, 'rates', false, (e as any)?.message);
    markStage(docId, 'risk', false, (e as any)?.message);
    markStage(docId, 'clauses', false, (e as any)?.message);
    markStage(docId, 'compliance', false, (e as any)?.message);
    markStage(docId, 'benchmark', false, (e as any)?.message);
    updateContract(docId, { status: 'FAILED' });
  }
}

// --- SINGLE UPLOAD ---
fastify.post('/uploads', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    let found = false;
    let docId: string | null = null;
    const hasParts = typeof (request as any).parts === 'function';
    if (!hasParts) return reply.code(400).send({ error: 'multipart required' });
  for await (const part of (request as any).parts()) {
      if (!part || part.type !== 'file') continue;
      if (found) continue; // only first file
      found = true;
      
      const id = newDocId();
      docId = id;
      const filename = part.filename || 'upload';
      const mimetype = part.mimetype || 'application/octet-stream';
      
      // Validate file type and size
      if (!validateFileType(mimetype, filename)) {
        return reply.code(400).send({ 
          error: 'Invalid file type',
          details: 'Only PDF, DOC, and DOCX files are allowed'
        });
      }
      
  // Check file size (if available in headers)
  const contentLength = request.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
        return reply.code(400).send({ 
          error: 'File too large',
          details: 'File size must be less than 100MB'
        });
      }
      
      request.log.info({ 
        docId: id, 
        filename, 
        mimetype, 
        tenantId 
      }, 'Processing file upload');
      
      // Read stream once; optionally upload to storage using a tee
      let storagePath = '';
      let fileText: string | null = null;
      try {
        if (uploadToS3) {
          storagePath = `uploads/${tenantId}/${id}/${filename}`;
          await uploadToS3(storagePath, part.file);
        } else {
          fileText = await streamToString(part.file);
          storagePath = `memory://${id}`;
        }
      } catch (e) {
        request.log.error({ err: e, docId: id }, 'Failed to store file');
        return reply.code(500).send({ error: 'File storage failed' });
      }
      
      // Create contract with storage path
      addContract({ 
        id, 
        name: filename, 
        status: 'UPLOADED', 
        createdAt: new Date(), 
        updatedAt: new Date(), 
        tenantId,
        storagePath 
      });
      
      // Invalidate contract cache for this tenant
      contractCache.clear(`contract_list`);
      contractCache.delete('contract_detail', `${tenantId}_${id}`);
      
      // Enqueue comprehensive analysis pipeline - TEMPORARILY DISABLED FOR DEBUGGING
      // try {
        request.log.info({ docId: id }, 'Skipping analysis pipeline entirely for debugging');
        
        const sizeNum = contentLength ? parseInt(String(contentLength), 10) : undefined;
        monitoring.trackUpload(true, Number.isFinite(sizeNum || NaN) ? sizeNum : undefined); // Track successful upload with size
      // } catch (e) {
      //   monitoring.trackUpload(false);
      //   request.log.error({ err: e, docId: id }, 'Failed to enqueue analysis pipeline');
      //   return reply.code(500).send({ error: 'Failed to start document processing' });
      // }
    }
    if (!docId) return reply.code(400).send({ error: 'no file found' });
    return reply.code(201).send({ docId });
  } catch (e) {
    request.log.error(e, 'Upload failed');
    return reply.code(500).send({ error: 'Upload failed' });
  }
});

fastify.post('/uploads/batch', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const items: Array<{ name: string; docId: string }> = [];
    const hasParts = typeof (request as any).parts === 'function';
    if (!hasParts) return reply.code(400).send({ error: 'multipart required' });
    
    for await (const part of (request as any).parts()) {
      if (!part || part.type !== 'file') continue;
      
      const id = newDocId();
      const filename = part.filename || 'upload';
      items.push({ name: filename, docId: id });
      
      // Store file to storage first; if no storage, read once
      let storagePath = '';
      let fileText: string | null = null;
      try {
        if (uploadToS3) {
          storagePath = `uploads/${tenantId}/${id}/${filename}`;
          await uploadToS3(storagePath, part.file);
        } else {
          fileText = await streamToString(part.file);
          storagePath = `memory://${id}`;
        }
      } catch (e) {
        request.log.error({ err: e, docId: id }, 'Failed to store file');
        continue; // Skip this file but continue with others
      }
      
      // Create contract with storage path
      addContract({ 
        id, 
        name: filename, 
        status: 'UPLOADED', 
        createdAt: new Date(), 
        updatedAt: new Date(), 
        tenantId,
        storagePath 
      });
      
      // Enqueue proper ingestion job
      try {
        if (getQueue) {
          const ingestionQueue = getQueue('ingestion');
          await ingestionQueue.add('process-document', { docId: id });
          request.log.info({ docId: id }, 'Enqueued ingestion job');
        } else {
          // Fallback to in-process if no queue available
          const text = fileText ?? '[no-bytes]';
          saveArtifacts(id, { ingestion: { text } as any });
          markStage(id, 'ingestion', true);
          try { savePlaceholderArtifacts(id); } catch {}
          schedule(() => runAnalysisPipeline(id, tenantId, text));
        }
      } catch (e) {
        request.log.error({ err: e, docId: id }, 'Failed to enqueue ingestion job');
        // Continue with other files even if one fails
      }
    }
    
    if (items.length === 0) return reply.code(400).send({ error: 'no files found' });
    return reply.code(201).send({ items });
  } catch (e) {
    request.log.error(e, 'Batch upload failed');
    return reply.code(500).send({ error: 'Batch upload failed' });
  }
});

// --- RAG DEBUG: list chunks ---
fastify.get('/api/rag/chunks', async (request, reply) => {
  try {
    const q = request.query as any;
    const docId = String(q.docId || '').trim();
    const k = q.k ? Number(q.k) : 50;
    if (!docId) return reply.code(400).send({ error: 'docId required' });
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    let rag: any;
    try { rag = require('clients-rag'); } catch { rag = require('../../packages/clients/rag'); }
    const rows = await rag.getDocChunks(docId, tenantId, k);
    return { items: rows };
  } catch (e) {
    request.log.error(e, 'RAG chunks error');
    return reply.code(500).send({ error: 'RAG chunks failed' });
  }
});

// --- TENANT MANAGEMENT (CRUD) ---
fastify.get('/tenants', { preHandler: [routePermissionGuard([{ action: 'read', subject: 'Tenant' }])] }, async (_request, reply) => {
  const tenants = listTenants();
  return reply.code(200).send({ tenants });
});
fastify.post('/tenants', { preHandler: [routePermissionGuard([{ action: 'create', subject: 'Tenant' }])] }, async (request, reply) => {
  const schema = z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
  });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.issues });
  }
  try {
    const tenant = addTenant(parsed.data);
    return reply.code(201).send({ tenant });
  } catch (err) {
    request.log.error(err, 'Failed to create tenant');
    return reply.code(500).send({ error: 'Failed to create tenant' });
  }
});
fastify.get('/tenants/:id', { preHandler: [routePermissionGuard([{ action: 'read', subject: 'Tenant' }])] }, async (request, reply) => {
  const { id } = request.params as any;
  const tenant = getTenant(id);
  if (!tenant) {
    return reply.code(404).send({ error: 'Tenant not found' });
  }
  return reply.code(200).send({ tenant });
});
fastify.put('/tenants/:id', { preHandler: [routePermissionGuard([{ action: 'update', subject: 'Tenant' }])] }, async (request, reply) => {
  const { id } = request.params as any;
  const schema = z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
  }).partial();
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.issues });
  }
  try {
    const tenant = updateTenant(id, parsed.data);
    return reply.code(200).send({ tenant });
  } catch (err) {
    request.log.error(err, 'Failed to update tenant');
    return reply.code(500).send({ error: 'Failed to update tenant' });
  }
});
fastify.delete('/tenants/:id', { preHandler: [routePermissionGuard([{ action: 'delete', subject: 'Tenant' }])] }, async (request, reply) => {
  const { id } = request.params as any;
  try {
    deleteTenant(id);
    return reply.code(204).send();
  } catch (err) {
    request.log.error(err, 'Failed to delete tenant');
    return reply.code(500).send({ error: 'Failed to delete tenant' });
  }
});

// --- CONTRACT & ARTIFACTS ---
fastify.register(async (fastify) => {
  fastify.get('/contracts', { preHandler: [routePermissionGuard([{ action: 'read', subject: 'Contract' }])] }, async (request, reply) => {
    const tenantId = (request as any).tenantId;
    const { archived } = (request.query as any) || {};
    
    // Cache key includes tenant and archived filter
    const cacheKey = `${tenantId}_${archived === 'true' ? 'archived' : 'active'}`;
    
    // Try cache first
    let items = contractCache.get('contract_list', cacheKey);
    if (items === null) {
      items = listContracts(tenantId, { archived: String(archived) === 'true' });
      contractCache.set('contract_list', cacheKey, items, 300); // 5 minutes
    }
    
    return reply.code(200).send({ items });
  });

  fastify.get('/contracts/:id', { preHandler: [routePermissionGuard([{ action: 'read', subject: 'Contract' }])] }, async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    
    // Try cache first
    const cacheKey = `${tenantId}_${id}`;
    let contract = contractCache.get('contract_detail', cacheKey);
    
    if (contract === null) {
      contract = getContract(id, tenantId);
      if (contract) {
        contractCache.set('contract_detail', cacheKey, contract, 600); // 10 minutes
      }
    }
    
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    return reply.code(200).send(contract);
  });

  fastify.get('/contracts/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    const run = getRun(id);
    return reply.code(200).send({
      id: contract.id,
      name: contract.name,
      status: contract.status,
      stages: run?.stages,
      updatedAt: contract.updatedAt,
    });
  });

  // Report progress across analysis stages as counts and percent.
  fastify.get('/contracts/:id/progress', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    const run = getRun(id);
    const coreStages = ['ingestion','overview','clauses','rates','compliance','benchmark','risk'] as const;
    const totalStages = coreStages.length;

    // Prefer run-based readiness; fall back to artifact presence.
    let stages: Record<string, { ready: boolean; artifactUrl?: string }> = {};
    if (run?.stages) {
      stages = Object.fromEntries(coreStages.map(s => [s, { 
        ready: !!run!.stages[s].ready, 
        ...(run!.stages[s].artifactUrl && { artifactUrl: run!.stages[s].artifactUrl })
      }]));
    } else {
      stages = Object.fromEntries(coreStages.map(s => [s, { ready: !!getSection(id, s as any) }]));
    }
    const completedStages = coreStages.reduce((n, s) => n + (stages[s]?.ready ? 1 : 0), 0);
    const percent = Math.round((completedStages / totalStages) * 100);
    return reply.code(200).send({ id: contract.id, status: contract.status, completedStages, totalStages, percent, stages });
  });

  // Serve the original contract file with proper content-type
  fastify.get('/contracts/:id/file', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    
    if (!contract.storagePath) {
      return reply.code(404).send({ error: 'Contract file not found' });
    }

    try {
      // For S3 storage, redirect to signed URL
      if (getSignedUrl) {
        const url = getSignedUrl({ 
          Bucket: env.S3_BUCKET || 'contracts', 
          Key: contract.storagePath, 
          Expires: 600 
        });
        return reply.redirect(302, url);
      }
      
      // For local storage, serve directly
      const fs = await import('fs');
      const path = await import('path');
      
      // Construct local file path
      const localPath = path.join(process.cwd(), 'tmp', 'uploads', path.basename(contract.storagePath));
      
      if (!fs.existsSync(localPath)) {
        return reply.code(404).send({ error: 'Contract file not found' });
      }
      
      // Determine content type from file extension
      const ext = path.extname(contract.name || contract.storagePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.txt') contentType = 'text/plain';
      else if (ext === '.doc') contentType = 'application/msword';
      else if (ext === '.docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      return reply
        .type(contentType)
        .send(fs.createReadStream(localPath));
        
    } catch (error) {
      request.log.error(error, 'file-serve-error');
      return reply.code(500).send({ error: 'Failed to serve file' });
    }
  });

  fastify.get('/contracts/:id/artifacts/:section.json', async (request, reply) => {
    const { id, section } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    let artifact = getSection(id, section);
    if (!artifact) {
      // Fallback: for overview requests, return an empty object instead of 404
      if (String(section) === 'overview') {
        return reply.code(200).send({});
      }
      // For other known sections, create placeholders and return them to avoid 404 during processing
      const known = new Set(['ingestion','overview','clauses','rates','compliance','benchmark','risk','report']);
      if (known.has(String(section))) {
        try { savePlaceholderArtifacts(id); } catch {}
        artifact = getSection(id, section);
        if (artifact) return reply.code(200).send(artifact);
      }
      return reply.code(404).send({ error: 'Artifact not found' });
    }
    return reply.code(200).send(artifact);
  });

  // Serve generated PDF report
  fastify.get('/contracts/:id/report.pdf', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    
    const reportArtifact = getSection(id, 'report');
    if (!reportArtifact?.storagePath) {
      return reply.code(404).send({ error: 'Report not available' });
    }

    try {
      // For S3 storage, redirect to signed URL
      if (getSignedUrl) {
        const url = getSignedUrl({ 
          Bucket: env.S3_BUCKET || 'contracts', 
          Key: reportArtifact.storagePath, 
          Expires: 600,
          ContentType: 'application/pdf'
        });
        return reply.redirect(302, url);
      }
      
      // For local storage, serve directly
      const fs = await import('fs');
      const path = await import('path');
      
      // Construct local file path
      const localPath = path.join(process.cwd(), 'tmp', 'uploads', path.basename(reportArtifact.storagePath));
      
      if (!fs.existsSync(localPath)) {
        return reply.code(404).send({ error: 'Report file not found' });
      }
      
      return reply
        .type('application/pdf')
        .send(fs.createReadStream(localPath));
        
    } catch (error) {
      request.log.error(error, 'report-serve-error');
      return reply.code(500).send({ error: 'Failed to serve report' });
    }
  });

  // Presence of artifacts per section
  fastify.get('/contracts/:id/artifacts', async (request, reply) => {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId;
    const contract = getContract(id, tenantId);
    if (!contract) {
      return reply.code(404).send({ error: 'Contract not found' });
    }
    const sections = ['ingestion','overview','clauses','rates','compliance','benchmark','risk','report'] as const;
    const present: Record<string, boolean> = {};
    for (const s of sections) {
      try {
        present[s] = !!getSection(id, s as any);
      } catch {
        present[s] = false;
      }
    }
    return reply.code(200).send({ present });
  });

  // --- POLICIES (stub) ---
  // These endpoints provide policy-pack data for the UI. If you don't have
  // policy packs configured yet, they return empty defaults to keep the UI working.
  fastify.get('/policies/packs', async (_request, reply) => {
    try {
      // If a real source exists in the store later, wire it here (e.g., listTemplates or similar)
      return reply.code(200).send({ packs: [] });
    } catch (e) {
      reply.request.log.error(e, 'policies.packs');
      return reply.code(200).send({ packs: [] });
    }
  });

  fastify.get('/policies/clients', async (_request, reply) => {
    try {
      // Map of clientId -> default policy pack id
      return reply.code(200).send({ defaults: {} });
    } catch (e) {
      reply.request.log.error(e, 'policies.clients');
      return reply.code(200).send({ defaults: {} });
    }
  });
}, { prefix: '/api' });

// Register the new agent routes
fastify.register(agentRoutes, { prefix: '/api/v2' });

// Register health check routes
fastify.register(healthRoutes);



// Register accuracy monitoring routes
fastify.register(accuracyMonitoringRoutes, { prefix: '/api/monitoring' });

// --- SERVER START ---
// Legacy compatibility routes (non-prefixed)
fastify.get('/contracts/:id/status', async (request, reply) => {
  try {
    const { id } = request.params as any;
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const contract = getContract(id, tenantId);
    if (!contract) return reply.code(404).send({ error: 'Contract not found' });
    const run = getRun(id);
    return reply.code(200).send({ id: contract.id, name: contract.name, status: contract.status, stages: run?.stages, updatedAt: contract.updatedAt });
  } catch (e) {
    request.log.error(e, 'legacy-status-error');
    return reply.code(500).send({ error: 'Internal Server Error' });
  }
});
const start = async () => {
  try {
    const port = env.PORT ? parseInt(env.PORT as string, 10) : 3001;
    // Best-effort: ensure vector index exists when DB is present
  try {
      if (db && db.$executeRaw) {
        // Enable pgvector IVFFLAT index for cosine similarity and a supporting btree index
    const lists = Number(env.RAG_IVFFLAT_LISTS || 100);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Embedding_embedding_ivfflat_idx" ON "Embedding" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = ${lists})`);
        await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Embedding_tenant_contract_idx" ON "Embedding" ("tenantId", "contractId")');
      }
    } catch (e) {
      fastify.log.warn({ err: (e as any)?.message }, 'Vector index ensure failed (continuing)');
    }

    // Database performance and monitoring endpoints
    fastify.get('/internal/database/performance', async (request, reply) => {
      try {
        const { databasePerformanceService } = await import('./src/services/database-performance.service');
        const metrics = databasePerformanceService.getPerformanceMetrics();
        
        reply.send({
          success: true,
          metrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get database performance metrics');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve database performance metrics'
        });
      }
    });

    // Database performance dashboard
    fastify.get('/internal/database/dashboard', async (request, reply) => {
      try {
        const { databasePerformanceService } = await import('./src/services/database-performance.service');
        const dashboard = await databasePerformanceService.getPerformanceDashboard();
        
        reply.send({
          success: true,
          dashboard,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get database performance dashboard');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve database performance dashboard'
        });
      }
    });

    // Query pattern analysis
    fastify.get('/internal/database/analysis', async (request, reply) => {
      try {
        const { databasePerformanceService } = await import('./src/services/database-performance.service');
        const analysis = await databasePerformanceService.analyzeQueryPatterns();
        
        reply.send({
          success: true,
          analysis,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to analyze query patterns');
        reply.status(500).send({
          success: false,
          error: 'Failed to analyze query patterns'
        });
      }
    });

    // Database optimization operations
    fastify.post('/internal/database/optimize', async (request, reply) => {
      try {
        const { databasePerformanceService } = await import('./src/services/database-performance.service');
        const { action } = request.body as { action: 'indexes' | 'views' | 'analyze' };
        
        let result;
        switch (action) {
          case 'indexes':
            result = await databasePerformanceService.createOptimizedIndexes();
            break;
          case 'views':
            result = await databasePerformanceService.createMaterializedViews();
            break;
          case 'analyze':
            result = await databasePerformanceService.analyzeQueryPatterns();
            break;
          default:
            return reply.status(400).send({
              success: false,
              error: 'Invalid action. Must be one of: indexes, views, analyze'
            });
        }
        
        reply.send({
          success: true,
          action,
          result,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to execute database optimization');
        reply.status(500).send({
          success: false,
          error: 'Failed to execute database optimization'
        });
      }
    });

    // Database resilience and recovery endpoints
    fastify.get('/internal/database/resilience/health', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const health = await databaseResilienceService.healthCheck();
        
        reply.send({
          success: true,
          health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get database resilience health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve database resilience health'
        });
      }
    });

    // Database failover endpoint
    fastify.post('/internal/database/resilience/failover', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const { target } = request.body as { target: string };
        
        if (!target) {
          return reply.status(400).send({
            success: false,
            error: 'Target database is required'
          });
        }
        
        await databaseResilienceService.forceFailover(target);
        
        reply.send({
          success: true,
          action: 'failover',
          target,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to execute database failover');
        reply.status(500).send({
          success: false,
          error: 'Failed to execute database failover'
        });
      }
    });

    // Automatic recovery endpoints
    fastify.get('/internal/recovery/health', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const health = await automaticRecoveryService.healthCheck();
        
        reply.send({
          success: true,
          health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery service health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery service health'
        });
      }
    });

    // Trigger recovery endpoint
    fastify.post('/internal/recovery/trigger', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const { trigger, context } = request.body as { trigger: string; context?: Record<string, any> };
        
        if (!trigger) {
          return reply.status(400).send({
            success: false,
            error: 'Trigger is required'
          });
        }
        
        const executionId = await automaticRecoveryService.triggerRecovery(trigger, context);
        
        reply.send({
          success: true,
          trigger,
          executionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to trigger recovery');
        reply.status(500).send({
          success: false,
          error: 'Failed to trigger recovery'
        });
      }
    });

    // Recovery scenarios endpoint
    fastify.get('/internal/recovery/scenarios', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const scenarios = automaticRecoveryService.getScenarios();
        
        reply.send({
          success: true,
          scenarios,
          count: scenarios.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery scenarios');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery scenarios'
        });
      }
    });

    // Recovery execution history endpoint
    fastify.get('/internal/recovery/history', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const history = automaticRecoveryService.getExecutionHistory();
        
        reply.send({
          success: true,
          history,
          count: history.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery history');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery history'
        });
      }
    });

    // Storage capacity management endpoints
    fastify.get('/internal/storage/metrics', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const currentMetrics = storageCapacityService.getCurrentMetrics();
        
        reply.send({
          success: true,
          metrics: currentMetrics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get storage metrics');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve storage metrics'
        });
      }
    });

    // Storage capacity forecast endpoint
    fastify.get('/internal/storage/forecast', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const { days } = request.query as { days?: string };
        const forecastDays = days ? parseInt(days) : 30;
        
        const forecast = storageCapacityService.getCapacityForecast(forecastDays);
        
        reply.send({
          success: true,
          forecast,
          forecastDays,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get storage forecast');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve storage forecast'
        });
      }
    });

    // Storage alerts endpoint
    fastify.get('/internal/storage/alerts', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const { active } = request.query as { active?: string };
        
        const alerts = active === 'true' 
          ? storageCapacityService.getActiveAlerts()
          : storageCapacityService.getAllAlerts();
        
        reply.send({
          success: true,
          alerts,
          count: alerts.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get storage alerts');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve storage alerts'
        });
      }
    });

    // Acknowledge storage alert endpoint
    fastify.post('/internal/storage/alerts/:alertId/acknowledge', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const { alertId } = request.params as { alertId: string };
        
        const acknowledged = storageCapacityService.acknowledgeAlert(alertId);
        
        reply.send({
          success: acknowledged,
          alertId,
          acknowledged,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to acknowledge storage alert');
        reply.status(500).send({
          success: false,
          error: 'Failed to acknowledge storage alert'
        });
      }
    });

    // Archive operations endpoint
    fastify.get('/internal/storage/archive/operations', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const { active } = request.query as { active?: string };
        
        const operations = active === 'true'
          ? storageCapacityService.getActiveOperations()
          : storageCapacityService.getOperationHistory();
        
        reply.send({
          success: true,
          operations,
          count: operations.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get archive operations');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve archive operations'
        });
      }
    });

    // Trigger archive operation endpoint
    fastify.post('/internal/storage/archive/trigger', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const { policyId } = request.body as { policyId: string };
        
        if (!policyId) {
          return reply.status(400).send({
            success: false,
            error: 'Policy ID is required'
          });
        }
        
        const operationId = await storageCapacityService.triggerArchiveOperation(policyId);
        
        reply.send({
          success: true,
          operationId,
          policyId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to trigger archive operation');
        reply.status(500).send({
          success: false,
          error: 'Failed to trigger archive operation'
        });
      }
    });

    // Retention policies endpoint
    fastify.get('/internal/storage/policies', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const policies = storageCapacityService.getRetentionPolicies();
        
        reply.send({
          success: true,
          policies,
          count: policies.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get retention policies');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve retention policies'
        });
      }
    });

    // Storage health check endpoint
    fastify.get('/internal/storage/health', async (request, reply) => {
      try {
        const { storageCapacityService } = await import('./src/services/storage-capacity.service');
        const health = await storageCapacityService.healthCheck();
        
        reply.send({
          success: true,
          health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get storage health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve storage health'
        });
      }
    });

    // Error classification and handling endpoints
    fastify.get('/internal/errors/metrics', async (request, reply) => {
      try {
        const { errorClassificationService } = await import('./src/services/error-classification.service');
        const { timeRange } = request.query as { timeRange?: string };
        const range = timeRange ? parseInt(timeRange) : 3600000; // Default 1 hour
        
        const metrics = errorClassificationService.getErrorMetrics(range);
        
        reply.send({
          success: true,
          metrics,
          timeRange: range,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get error metrics');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve error metrics'
        });
      }
    });

    // Recent errors endpoint
    fastify.get('/internal/errors/recent', async (request, reply) => {
      try {
        const { errorClassificationService } = await import('./src/services/error-classification.service');
        const { limit } = request.query as { limit?: string };
        const errorLimit = limit ? parseInt(limit) : 100;
        
        const recentErrors = errorClassificationService.getRecentErrors(errorLimit);
        
        reply.send({
          success: true,
          errors: recentErrors,
          count: recentErrors.length,
          limit: errorLimit,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recent errors');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recent errors'
        });
      }
    });

    // Error patterns endpoint
    fastify.get('/internal/errors/patterns', async (request, reply) => {
      try {
        const { errorClassificationService } = await import('./src/services/error-classification.service');
        const patterns = errorClassificationService.getErrorPatterns();
        
        reply.send({
          success: true,
          patterns,
          count: patterns.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get error patterns');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve error patterns'
        });
      }
    });

    // Error handler statistics endpoint
    fastify.get('/internal/errors/statistics', async (request, reply) => {
      try {
        const { errorHandlerService } = await import('./src/services/error-handler.service');
        const statistics = errorHandlerService.getErrorStatistics();
        
        reply.send({
          success: true,
          statistics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get error statistics');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve error statistics'
        });
      }
    });

    // Error handling health check endpoint
    fastify.get('/internal/errors/health', async (request, reply) => {
      try {
        const { errorClassificationService } = await import('./src/services/error-classification.service');
        const { errorHandlerService } = await import('./src/services/error-handler.service');
        
        const [classificationHealth, handlerHealth] = await Promise.all([
          errorClassificationService.healthCheck(),
          errorHandlerService.healthCheck()
        ]);
        
        const overallHealth = {
          healthy: classificationHealth.healthy && handlerHealth.healthy,
          classification: classificationHealth,
          handler: handlerHealth,
          issues: [...classificationHealth.issues, ...handlerHealth.issues]
        };
        
        reply.send({
          success: true,
          health: overallHealth,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get error handling health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve error handling health'
        });
      }
    });

    // Comprehensive search endpoints
    fastify.post('/api/search', async (request, reply) => {
      try {
        const { comprehensiveSearchService } = await import('./src/services/comprehensive-search.service');
        const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
        
        const searchQuery = {
          ...request.body as any,
          tenantId
        };
        
        const results = await comprehensiveSearchService.search(searchQuery);
        
        reply.send({
          success: true,
          ...results,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Search failed');
        reply.status(500).send({
          success: false,
          error: 'Search failed',
          results: [],
          totalCount: 0,
          searchTime: 0
        });
      }
    });

    // Search analytics endpoint
    fastify.get('/api/search/analytics', async (request, reply) => {
      try {
        const { comprehensiveSearchService } = await import('./src/services/comprehensive-search.service');
        const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
        
        const analytics = await comprehensiveSearchService.getSearchAnalytics(tenantId);
        
        reply.send({
          success: true,
          analytics,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get search analytics');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve search analytics'
        });
      }
    });

    // Real-time indexing endpoints
    fastify.post('/internal/indexing/queue', async (request, reply) => {
      try {
        const { realTimeIndexingService } = await import('./src/services/real-time-indexing.service');
        const { contractId, tenantId, priority = 'medium', eventType = 'manual' } = request.body as any;
        
        if (!contractId || !tenantId) {
          return reply.status(400).send({
            success: false,
            error: 'contractId and tenantId are required'
          });
        }
        
        const jobId = await realTimeIndexingService.queueIndexing({
          type: eventType,
          contractId,
          tenantId,
          priority,
          timestamp: new Date()
        });
        
        reply.send({
          success: true,
          jobId,
          message: 'Contract queued for indexing',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to queue indexing');
        reply.status(500).send({
          success: false,
          error: 'Failed to queue contract for indexing'
        });
      }
    });

    // Indexing status endpoint
    fastify.get('/internal/indexing/status/:jobId', async (request, reply) => {
      try {
        const { realTimeIndexingService } = await import('./src/services/real-time-indexing.service');
        const { jobId } = request.params as { jobId: string };
        
        const job = realTimeIndexingService.getJobStatus(jobId);
        
        if (!job) {
          return reply.status(404).send({
            success: false,
            error: 'Job not found'
          });
        }
        
        reply.send({
          success: true,
          job: {
            id: job.id,
            contractId: job.contractId,
            status: job.status,
            priority: job.priority,
            retryCount: job.retryCount,
            scheduledAt: job.scheduledAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get job status');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve job status'
        });
      }
    });

    // Indexing statistics endpoint
    fastify.get('/internal/indexing/stats', async (request, reply) => {
      try {
        const { realTimeIndexingService } = await import('./src/services/real-time-indexing.service');
        const stats = realTimeIndexingService.getStats();
        
        reply.send({
          success: true,
          stats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get indexing stats');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve indexing statistics'
        });
      }
    });

    // Search health check endpoint
    fastify.get('/internal/search/health', async (request, reply) => {
      try {
        const { comprehensiveSearchService } = await import('./src/services/comprehensive-search.service');
        const { realTimeIndexingService } = await import('./src/services/real-time-indexing.service');
        
        const [searchHealth, indexingHealth] = await Promise.all([
          comprehensiveSearchService.healthCheck(),
          realTimeIndexingService.healthCheck()
        ]);
        
        const overallHealthy = searchHealth.healthy && indexingHealth.healthy;
        const allIssues = [...searchHealth.issues, ...indexingHealth.issues];
        
        reply.send({
          success: true,
          healthy: overallHealthy,
          components: {
            search: searchHealth,
            indexing: indexingHealth
          },
          issues: allIssues,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get search health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve search health status'
        });
      }
    });

    // Database resilience endpoints
    fastify.get('/internal/database/resilience/health', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const health = await databaseResilienceService.healthCheck();
        
        reply.send({
          success: true,
          ...health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get database resilience health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve database resilience health'
        });
      }
    });

    fastify.get('/internal/database/resilience/errors', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const errors = databaseResilienceService.getErrorHistory();
        
        reply.send({
          success: true,
          errors: errors.slice(-100), // Last 100 errors
          totalErrors: errors.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get database errors');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve database error history'
        });
      }
    });

    fastify.get('/internal/database/resilience/failovers', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const failovers = databaseResilienceService.getFailoverHistory();
        
        reply.send({
          success: true,
          failovers: failovers.slice(-50), // Last 50 failovers
          totalFailovers: failovers.length,
          currentDatabase: databaseResilienceService.getCurrentDatabase(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get failover history');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve failover history'
        });
      }
    });

    fastify.post('/internal/database/resilience/failover', async (request, reply) => {
      try {
        const { databaseResilienceService } = await import('./src/services/database-resilience.service');
        const { target } = request.body as { target: string };
        
        if (!target) {
          return reply.status(400).send({
            success: false,
            error: 'Target database is required'
          });
        }
        
        await databaseResilienceService.forceFailover(target);
        
        reply.send({
          success: true,
          message: `Failover to ${target} initiated`,
          currentDatabase: databaseResilienceService.getCurrentDatabase(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to initiate failover');
        reply.status(500).send({
          success: false,
          error: 'Failed to initiate database failover'
        });
      }
    });

    // Automatic recovery endpoints
    fastify.get('/internal/recovery/health', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const health = await automaticRecoveryService.healthCheck();
        
        reply.send({
          success: true,
          ...health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery health');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery service health'
        });
      }
    });

    fastify.get('/internal/recovery/scenarios', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const scenarios = automaticRecoveryService.getScenarios();
        
        reply.send({
          success: true,
          scenarios,
          totalScenarios: scenarios.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery scenarios');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery scenarios'
        });
      }
    });

    fastify.get('/internal/recovery/executions', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const executions = automaticRecoveryService.getExecutionHistory();
        
        reply.send({
          success: true,
          executions: executions.slice(-50), // Last 50 executions
          totalExecutions: executions.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to get recovery executions');
        reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recovery execution history'
        });
      }
    });

    fastify.post('/internal/recovery/trigger', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const { trigger, context } = request.body as { trigger: string; context?: Record<string, any> };
        
        if (!trigger) {
          return reply.status(400).send({
            success: false,
            error: 'Trigger is required'
          });
        }
        
        const executionId = await automaticRecoveryService.triggerRecovery(trigger, context);
        
        reply.send({
          success: true,
          executionId,
          message: (executionId != null) ? 'Recovery triggered successfully' : 'No matching recovery scenarios found',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to trigger recovery');
        reply.status(500).send({
          success: false,
          error: 'Failed to trigger recovery'
        });
      }
    });

    fastify.post('/internal/recovery/enable', async (request, reply) => {
      try {
        const { automaticRecoveryService } = await import('./src/services/automatic-recovery.service');
        const { enabled } = request.body as { enabled: boolean };
        
        automaticRecoveryService.setEnabled(enabled);
        
        reply.send({
          success: true,
          enabled,
          message: `Recovery service ${enabled ? 'enabled' : 'disabled'}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error({ error }, 'Failed to update recovery service status');
        reply.status(500).send({
          success: false,
          error: 'Failed to update recovery service status'
        });
      }
    });

    // Optional websocket init (no hard dependency)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { setupWebSocket } = require('./websocket');
      const ws = setupWebSocket(fastify);
      if (Boolean(ws)) fastify.log.info('WebSocket ready');
    } catch {
      fastify.log.info('WebSocket not initialized');
    }

    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on http://localhost:${port}`);

    // Attach graceful shutdown handlers (queues discovered lazily if available)
    try {
      const queues: any[] = [];
      if (getQueue != null) {
        for (const name of ['ingestion','overview','clauses','rates','compliance','benchmark','risk','report']) {
          try { const q = getQueue(name); if ((Boolean(q)) && typeof q.close === 'function') queues.push({ name, close: q.close.bind(q) }); } catch {}
        }
      }
      setupGracefulShutdown(fastify, { queues });
    } catch (e) {
      fastify.log.warn({ err: (e as any)?.message }, 'graceful-shutdown-setup-failed');
    }
    
    // Optional internal workers (AIO mode)
    try {
      if (String((process.env['WORKERS_INLINE'] != null) || '').toLowerCase() === 'true') {
        const { WorkerManager } = require('./worker-manager');
        const wm = new WorkerManager(fastify.log);
        await wm.startWorkers();
        fastify.addHook('onClose', async () => {
          await wm.stopWorkers();
        });
        fastify.log.info('Inline workers started');
      }
    } catch (err) {
      fastify.log.warn({ err }, 'Inline workers failed to start');
    }

    // Warm cache on startup
    try {
      await warmCache();
      fastify.log.info('Cache warming completed');
    } catch (err) {
      fastify.log.warn({ err }, 'Cache warming failed (continuing)');
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Add request logging
fastify.addHook('onRequest', async (request, _reply) => {
  request.log.info({
    method: request.method,
    url: request.url,
    tenantId: request.headers['x-tenant-id'],
  });
});

// Add response time tracking
fastify.addHook('onResponse', async (request, reply) => {
  const startTime = (request as any).startTime;
  const responseTime = (Boolean(startTime)) ? Date.now() - startTime : 0;
  request.log.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    responseTime,
  });
});

start();

// --- PLACEHOLDER ARTIFACTS HELPER ---
function savePlaceholderArtifacts(docId: string) {
  const base = (worker: string) => ({ metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker, timestamp: new Date().toISOString(), durationMs: 1 }] } });
  try { saveArtifacts(docId, { overview: { ...base('overview'), summary: 'Processing…', parties: [] } as any }); } catch {}
  try { saveArtifacts(docId, { clauses: { ...base('clauses'), clauses: [] } as any }); } catch {}
  try { saveArtifacts(docId, { rates: { ...base('rates'), rates: [] } as any }); } catch {}
  try { saveArtifacts(docId, { compliance: { ...base('compliance'), compliance: [] } as any }); } catch {}
  try { saveArtifacts(docId, { benchmark: { ...base('benchmark'), benchmark: {} } as any }); } catch {}
  try { saveArtifacts(docId, { risk: { ...base('risk'), risks: [] } as any }); } catch {}
}
