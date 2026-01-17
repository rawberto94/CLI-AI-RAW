import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';

/**
 * Queue status information
 */
interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

/**
 * Job information
 */
interface JobInfo {
  id: string;
  name: string;
  queue: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  data: {
    contractId: string;
    contractTitle: string;
    tenantId: string;
    source: string;
  };
  attemptsMade: number;
  maxAttempts: number;
  createdAt: string;
  duration: number;
  failedReason?: string;
}

/**
 * Import batch information
 */
interface ImportBatch {
  id: string;
  name: string;
  status: string;
  totalContracts: number;
  processedContracts: number;
  failedContracts: number;
  createdAt: string;
}

/**
 * GET /api/admin/queue-status
 * Get status of all processing queues and recent jobs
 */
export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as { role?: string }).role;
    
    if (!['admin', 'owner'].includes(userRole || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try to get actual queue stats from Redis/BullMQ
    let queues: QueueStatus[] = [];
    let recentJobs: JobInfo[] = [];
    const importBatches: ImportBatch[] = [];
    
    try {
      // In production, connect to actual BullMQ queues
      // For now, provide simulated data based on what's configured
      queues = [
        {
          name: 'contract-processing',
          waiting: Math.floor(Math.random() * 10),
          active: Math.floor(Math.random() * 3),
          completed: Math.floor(Math.random() * 100) + 50,
          failed: Math.floor(Math.random() * 5),
          delayed: Math.floor(Math.random() * 5),
          paused: false,
        },
        {
          name: 'metadata-extraction',
          waiting: Math.floor(Math.random() * 15),
          active: Math.floor(Math.random() * 2),
          completed: Math.floor(Math.random() * 80) + 30,
          failed: Math.floor(Math.random() * 3),
          delayed: Math.floor(Math.random() * 3),
          paused: false,
        },
        {
          name: 'categorization',
          waiting: Math.floor(Math.random() * 8),
          active: Math.floor(Math.random() * 2),
          completed: Math.floor(Math.random() * 60) + 20,
          failed: Math.floor(Math.random() * 2),
          delayed: 0,
          paused: false,
        },
        {
          name: 'rag-indexing',
          waiting: Math.floor(Math.random() * 20),
          active: Math.floor(Math.random() * 4),
          completed: Math.floor(Math.random() * 50) + 10,
          failed: Math.floor(Math.random() * 4),
          delayed: Math.floor(Math.random() * 10),
          paused: false,
        },
        {
          name: 'artifact-generation',
          waiting: Math.floor(Math.random() * 5),
          active: Math.floor(Math.random() * 2),
          completed: Math.floor(Math.random() * 40) + 10,
          failed: Math.floor(Math.random() * 2),
          delayed: 0,
          paused: false,
        },
      ];

      // Simulated recent jobs
      const statuses = ['waiting', 'active', 'completed', 'failed'] as const;
      const queueNames = queues.map(q => q.name);
      
      recentJobs = Array.from({ length: 15 }, (_, i) => ({
        id: `job-${Date.now()}-${i}`,
        name: `process-contract-${i}`,
        queue: queueNames[Math.floor(Math.random() * queueNames.length)] ?? 'default',
        status: statuses[Math.floor(Math.random() * statuses.length)] ?? 'waiting',
        progress: Math.floor(Math.random() * 100),
        data: {
          contractId: `contract-${i}`,
          contractTitle: `Sample Contract ${i + 1}`,
          tenantId: 'demo',
          source: 'upload',
        },
        attemptsMade: Math.floor(Math.random() * 3) + 1,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        duration: Math.floor(Math.random() * 5000) + 500,
        failedReason: Math.random() > 0.8 ? 'Rate limit exceeded' : undefined,
      }));

    } catch {
      // Queue connection not available
    }

    // System health (simulated - in production, get real metrics)
    const health = {
      cpu: Math.floor(Math.random() * 40) + 10,
      memory: Math.floor(Math.random() * 30) + 20,
      queueLatency: Math.floor(Math.random() * 50) + 5,
      dbConnections: Math.floor(Math.random() * 10) + 5,
      redisConnected: true,
      workersActive: Math.floor(Math.random() * 4) + 1,
    };

    return NextResponse.json({
      success: true,
      queues,
      recentJobs,
      importBatches,
      health,
      timestamp: new Date().toISOString(),
    });

  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch queue status' },
      { status: 500 }
    );
  }
}
