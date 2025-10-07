/**
 * Contract Processing Status API
 * GET /api/contracts/:id/status - Get current processing status and progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProcessingJobService } from '@core/contracts/processing-job.service';
import { ProcessingJobRepository, databaseManager } from 'clients-db';

// Lazy initialization to avoid build-time database connections
let jobRepository: ProcessingJobRepository | null = null;
let jobService: ProcessingJobService | null = null;

function getServices() {
  if (!jobRepository) {
    jobRepository = new ProcessingJobRepository(databaseManager);
  }
  if (!jobService) {
    jobService = new ProcessingJobService(jobRepository);
  }
  return { jobService };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { jobService } = getServices();
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

    // Get detailed progress information
    const progress = await jobService.getJobProgress(job.id);

    if (!progress) {
      return NextResponse.json(
        { error: 'Unable to retrieve job progress' },
        { status: 500 }
      );
    }

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | null = null;
    if (
      progress.status === 'PROCESSING' &&
      progress.duration &&
      progress.progress > 0
    ) {
      const estimatedTotal = (progress.duration / progress.progress) * 100;
      estimatedTimeRemaining = Math.ceil(estimatedTotal - progress.duration);
    }

    // Build response
    const response = {
      contractId: progress.contractId,
      jobId: progress.id,
      status: progress.status,
      progress: progress.progress,
      currentStep: progress.currentStep,
      error: progress.error,
      startedAt: progress.startedAt,
      completedAt: progress.completedAt,
      duration: progress.duration,
      estimatedTimeRemaining,
      isProcessing: progress.status === 'PROCESSING',
      isCompleted: progress.status === 'COMPLETED',
      isFailed: progress.status === 'FAILED',
      canRetry: progress.status === 'FAILED',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching contract status:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch contract status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
