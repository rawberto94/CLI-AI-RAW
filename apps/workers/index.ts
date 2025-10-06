import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Worker, Queue, QueueEvents, FlowProducer } from 'bullmq';

// Import all worker functions
import { runCompliance } from './compliance.worker';
import { runIngestion } from './ingestion.worker';
// import { runOverview } from './overview.worker';    // Temporarily disabled  
// import { runClauses } from './clauses.worker';      // Temporarily disabled
import { runRates } from './rates.worker';
// import { runRisk } from './risk.worker';            // Temporarily disabled
import { runBenchmark } from './benchmark.worker';
import { runReport } from './report.worker';
import { runSearch } from './search.worker';
import { runTemplate } from './template.worker';
import { runFinancial } from './financial.worker';
import { runEnhancedOverview } from './enhanced-overview.worker';

// Debug environment loading
console.log('🔧 Worker Environment Debug:');
console.log('  Working Directory:', process.cwd());
console.log('  OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET');
console.log('  OPENAI_MODEL:', process.env.OPENAI_MODEL || 'NOT SET');
console.log('  ENABLE_LLM:', process.env.ENABLE_LLM || 'NOT SET (defaults to true)');

// Best-effort: if key env vars are missing, try known monorepo .env locations
(() => {
  const mustHave = [
    // LLM toggles/keys (optional but nice to have)
    'OPENAI_API_KEY', 'OPENAI_MODEL', 'ANALYSIS_USE_LLM', 'ANALYSIS_USE_LLM_OVERVIEW', 'ANALYSIS_USE_LLM_RATES',
    // Critical runtime
    'REDIS_URL',
    // Storage for MinIO/S3
    'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET',
  ];
  const missing = mustHave.some((k) => !process.env[k]);
  if (!missing) return;
  const candidates = [
    // When running from TS (cwd: apps/workers)
    path.resolve(process.cwd(), '../api/.env'),
    path.resolve(process.cwd(), '../../.env'),
    // When running from dist (cwd may be apps/workers)
    path.resolve(__dirname, '../api/.env'),
    path.resolve(__dirname, '../../api/.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const res = dotenv.config({ path: p, override: false });
        if (!res.error) {
          // eslint-disable-next-line no-console
          console.log(`[workers] Loaded env from ${p}`);
          break;
        }
      }
    } catch {
      // noop
    }
  }
})();

const redisUrl = process.env['REDIS_URL'] || '';

if (!redisUrl) {
  console.warn('[workers] REDIS_URL not set. Skipping worker startup.');
  process.exit(0);
}

const connection = { url: redisUrl } as any;
const flowProducer = new FlowProducer({ connection });

// A map of queue names to their processor functions
const workerProcessors: Record<string, (data: any) => Promise<any>> = {
  ingestion: runIngestion,
  template: runTemplate,
  financial: runFinancial,
  // overview: runOverview,       // Temporarily disabled
  'enhanced-overview': runEnhancedOverview,
  // clauses: runClauses,         // Temporarily disabled
  rates: runRates,
  benchmark: runBenchmark,
  // risk: runRisk,               // Temporarily disabled
  report: runReport,
  compliance: runCompliance,
  search: runSearch,
};

type WorkerName = keyof typeof workerProcessors;

const workers: Worker[] = [];
const queues: Record<string, Queue> = {};
const queueEvents: QueueEvents[] = [];

console.log('[workers] Initializing workers...');

for (const name in workerProcessors) {
  const queueName = name as WorkerName;
  const processor = workerProcessors[queueName];

  const queue = new Queue(queueName, { connection });
  queues[queueName] = queue;

  const qEvents = new QueueEvents(queueName, { connection });
  qEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`[workers] ${queueName} job ${jobId} completed`);
    const jobResult = returnvalue as any; // Cast to access properties

    // If ingestion is complete, create the analysis flow
    if (queueName === 'ingestion' && jobResult?.docId) {
      const { docId } = jobResult;
      console.log(`[workers] Ingestion complete for ${docId}, creating analysis flow.`);
      flowProducer.add({
        name: 'analysis-flow',
        queueName: 'risk', // This job runs after its children complete
        data: { docId },
        children: [
          { name: 'template', data: { docId }, queueName: 'template' },
          { name: 'financial', data: { docId }, queueName: 'financial' },
          { name: 'overview', data: { docId }, queueName: 'overview' },
          { name: 'clauses', data: { docId }, queueName: 'clauses' },
          { name: 'rates', data: { docId }, queueName: 'rates' },
          { name: 'benchmark', data: { docId }, queueName: 'benchmark' },
          { name: 'compliance', data: { docId, policyPackId: process.env['DEFAULT_POLICY_PACK_ID'] || 'default' }, queueName: 'compliance' },
          { name: 'search', data: { docId }, queueName: 'search' },
        ],
      }).catch(err => console.error(`[workers] Failed to create flow for ${docId}`, err));
    }
    // If risk analysis is complete, trigger the final report
    if (queueName === 'risk' && jobResult?.docId) {
        const { docId } = jobResult;
        console.log(`[workers] Risk analysis complete for ${docId}, queueing report.`);
        queues['report']?.add('generate-report', { docId }).catch(err => console.error(`[workers] Failed to queue report for ${docId}`, err));
    }
  });
  qEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[workers] ${queueName} job ${jobId} failed: ${failedReason}`);
  });
  queueEvents.push(qEvents);

  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: Number(process.env[`${queueName.toUpperCase()}_CONCURRENCY`] || '2'),
  });

  worker.on('ready', () => console.log(`[workers] ${queueName} worker ready`));
  worker.on('error', (err) => console.error(`[workers] ${queueName} worker error`, err));
  workers.push(worker);
}

const shutdown = async () => {
  console.log('\n[workers] shutting down...');
  await flowProducer.close();
  await Promise.allSettled(workers.map(w => w.close()));
  await Promise.allSettled(Object.values(queues).map(q => q.close()));
  await Promise.allSettled(queueEvents.map(qe => qe.close()));
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('[workers] All workers initialized and ready.');
