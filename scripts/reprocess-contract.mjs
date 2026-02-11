/**
 * Reprocess a contract by queuing it for artifact generation
 */
import { Queue } from 'bullmq';

const contractId = process.argv[2];
const tenantId = process.argv[3] || 'demo';

if (!contractId) {
  console.error('Usage: node scripts/reprocess-contract.mjs <contractId> [tenantId]');
  process.exit(1);
}

async function main() {
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
  };

  console.log('Connecting to Redis...', connection);
  
  const queue = new Queue('contract-processing', { connection });
  
  console.log(`Queuing contract ${contractId} for processing...`);
  
  const job = await queue.add(
    'process-contract',
    {
      contractId,
      tenantId,
      filePath: `contracts/${tenantId}/1770801951370-Statement_of_Work_Corporate_repaired.pdf`,
      originalName: 'Statement_of_Work_Corporate_repaired.pdf',
    },
    {
      priority: 1, // High priority
      jobId: `reprocess-${contractId}-${Date.now()}`,
    }
  );

  console.log('Job queued:', job?.id);
  
  // Wait a bit then check queue status
  await new Promise(r => setTimeout(r, 2000));
  
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  
  console.log(`Queue status - Waiting: ${waiting}, Active: ${active}`);
  
  await queue.close();
  console.log('Done');
}

main().catch(console.error);
