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
let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dbModule = require('clients-db');
  db = dbModule.default || dbModule;
  logger.info('Database client loaded successfully.');
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

  // Stage 2: Parallel analysis after ingestion
  await Promise.all([
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

  logger.info(`Enqueued complete analysis pipeline for document ${docId}`);
  return { ingestionJobId: ingestionJob.id, stages: 8 };
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
  try {
    if (!getSignedUrl) return reply.code(501).send({ error: 'Signed URL not supported' });
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const schema = z.object({ filename: z.string().min(1).max(255), contentType: z.string().min(3).max(200).optional() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.issues });
    const { filename, contentType } = parsed.data;
    if (!validateFileType(contentType || 'application/octet-stream', filename)) {
      return reply.code(400).send({ error: 'Invalid file type' });
    }
    const docId = newDocId();
    const storagePath = `uploads/${tenantId}/${docId}/${filename}`;
    const url = getSignedUrl({ Bucket: env.S3_BUCKET || 'contracts', Key: storagePath, Expires: 600, ContentType: contentType });
    return reply.code(200).send({ docId, uploadUrl: url, storagePath });
  } catch (e) {
    request.log.error(e, 'init-signed-error');
    return reply.code(500).send({ error: 'Failed to init signed upload' });
  }
});

fastify.post('/uploads/finalize', async (request, reply) => {
  try {
    const tenantId = (request as any).tenantId || (request.headers['x-tenant-id'] as string) || 'demo';
    const schema = z.object({ docId: z.string().min(1), filename: z.string().min(1), storagePath: z.string().min(1) });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.issues });
    const { docId, filename, storagePath } = parsed.data;

    addContract({ id: docId, name: filename, status: 'UPLOADED', createdAt: new Date(), updatedAt: new Date(), tenantId, storagePath });
    contractCache.clear('contract_list');
    contractCache.delete('contract_detail', `${tenantId}_${docId}`);

    try {
      if (getQueue) {
        await enqueueAnalysisPipeline(docId, tenantId);
        monitoring.startAnalysis(docId);
      } else {
        // Without a queue we cannot read remote content; create placeholders
        try { savePlaceholderArtifacts(docId); } catch {}
      }
      monitoring.trackUpload(true);
      return reply.code(201).send({ docId });
    } catch (e) {
      monitoring.trackUpload(false);
      request.log.error({ err: e, docId }, 'finalize-enqueue-error');
      return reply.code(500).send({ error: 'Failed to start processing' });
    }
  } catch (e) {
    request.log.error(e, 'finalize-error');
    return reply.code(500).send({ error: 'Finalize failed' });
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

    // Optional websocket init (no hard dependency)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { setupWebSocket } = require('./websocket');
      const ws = setupWebSocket(fastify);
      if (ws) fastify.log.info('WebSocket ready');
    } catch {
      fastify.log.info('WebSocket not initialized');
    }

    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on http://localhost:${port}`);

    // Attach graceful shutdown handlers (queues discovered lazily if available)
    try {
      const queues: any[] = [];
      if (getQueue) {
        for (const name of ['ingestion','overview','clauses','rates','compliance','benchmark','risk','report']) {
          try { const q = getQueue(name); if (q && typeof q.close === 'function') queues.push({ name, close: q.close.bind(q) }); } catch {}
        }
      }
      setupGracefulShutdown(fastify, { queues });
    } catch (e) {
      fastify.log.warn({ err: (e as any)?.message }, 'graceful-shutdown-setup-failed');
    }
    
    // Optional internal workers (AIO mode)
    try {
      if (String(process.env['WORKERS_INLINE'] || '').toLowerCase() === 'true') {
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
  const responseTime = startTime ? Date.now() - startTime : 0;
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
