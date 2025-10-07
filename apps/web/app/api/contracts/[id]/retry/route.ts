/**
 * Contract Processing Retry API
 * POST /api/contracts/:id/retry - Retry failed processing job
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProcessingJobService } from '@core/contracts/processing-job.service';
import { ProcessingJobRepository, databaseManager } from 'clients-db';
import { WorkerOrchestrator } from '@core/workers/worker-orchestrator';
import { processingStatusBroadcaster } from '@core/contracts/processing-status-broadcaster';

// Lazy initialization to avoid build-time database connections
let jobRepository: ProcessingJobRepository | null = null;
let jobService: ProcessingJobService | null = null;
let workerOrchestrator: WorkerOrchestrator | null = null;

function getServices() {
  if (!jobRepository) {
    jobRepository = new ProcessingJobRepository(databaseManager);
  }
  if (!jobService) {
    jobService = new ProcessingJobService(jobRepository);
  }
  if (!workerOrchestrator) {
    workerOrchestrator = new WorkerOrchestrator();
  }
  return { jobRepository, jobService, workerOrchestrator };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { jobService, workerOrchestrator } = getServices();
    const contractId = params.id;

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      );
    }

    // Get the latest processing job for this contract
    const job = await jobService.getJobByContractId(contractId);

    if (!job) {
      return NextResponse.json(
        { error: 'No processing job found for this contract' },
        { status: 404 }
      );
    }

    // Check if job can be retried
    if (job.status !== 'FAILED') {
      return NextResponse.json(
        {
          error: 'Only failed jobs can be retried',
          currentStatus: job.status,
        },
        { status: 400 }
      );
    }

    // Reset job for retry
    const resetJob = await jobService.resetJobForRetry(job.id);

    // Broadcast retry started
    processingStatusBroadcaster.broadcastProcessingStarted(
      contractId,
      resetJob.id,
      'Retrying processing'
    );

    // Start processing in background
    workerOrchestrator
      .executePipeline(contractId, resetJob.id)
      .then(async (result) => {
        // Update job status on success
        await jobService.completeJob(resetJob.id);
        processingStatusBroadcaster.broadcastCompleted(
          contractId,
          resetJob.id,
          result
        );
      })
      .catch(async (error) => {
        // Update job status on failure
        await jobService.failJob(
          resetJob.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
        processingStatusBroadcaster.broadcastFailed(
          contractId,
          resetJob.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
      });

    return NextResponse.json(
      {
        message: 'Processing retry initiated',
        contractId,
        jobId: resetJob.id,
        status: resetJob.status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrying contract processing:', error);
    return NextResponse.json(
      {
        error: 'Failed to retry contract processing',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
