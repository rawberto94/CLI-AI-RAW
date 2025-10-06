/**
 * Batch Operations API
 * POST /api/contracts/batch - Batch upload contracts
 * DELETE /api/contracts/batch - Batch delete contracts
 * PUT /api/contracts/batch - Batch update contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import { BatchOperationsService } from '../../../../../apps/core/contracts/batch-operations.service';
import { ContractCreationService } from '../../../../../apps/core/contracts/contract-creation.service';
import { WorkerOrchestrator } from '../../../../../apps/core/workers/worker-orchestrator';
import { ProcessingJobService } from '../../../../../apps/core/contracts/processing-job.service';
import { ContractRepository } from '../../../../../packages/clients/db/src/repositories/contract.repository';
import { ProcessingJobRepository } from '../../../../../packages/clients/db/src/repositories/processing-job.repository';
import { prisma } from '../../../../../packages/clients/db';

const contractRepository = new ContractRepository(prisma);
const jobRepository = new ProcessingJobRepository(prisma);
const creationService = new ContractCreationService(contractRepository);
const workerOrchestrator = new WorkerOrchestrator();
const jobService = new ProcessingJobService(jobRepository);
const batchService = new BatchOperationsService(
  creationService,
  workerOrchestrator,
  jobService,
  contractRepository
);

/**
 * Batch upload contracts
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files: File[] = [];
    
    // Extract all files from form data
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (files.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 files allowed per batch' },
        { status: 400 }
      );
    }

    // Parse options
    const concurrency = parseInt(formData.get('concurrency') as string) || 5;
    const userId = formData.get('userId') as string | undefined;

    // Prepare batch upload data
    const batchFiles = files.map((file) => ({
      file,
      metadata: {
        contractType: formData.get(`${file.name}_type`) as string | undefined,
        clientId: formData.get(`${file.name}_clientId`) as string | undefined,
        supplierId: formData.get(`${file.name}_supplierId`) as string | undefined,
      },
    }));

    // Execute batch upload
    const result = await batchService.batchUpload(batchFiles, {
      concurrency,
      userId,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Batch upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Batch upload failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Batch delete contracts
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractIds, userId } = body;

    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return NextResponse.json(
        { error: 'Contract IDs array is required' },
        { status: 400 }
      );
    }

    if (contractIds.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 contracts can be deleted at once' },
        { status: 400 }
      );
    }

    // Execute batch delete
    const result = await batchService.batchDelete(contractIds, { userId });

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Batch delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Batch delete failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Batch update contracts
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Updates array is required' },
        { status: 400 }
      );
    }

    if (updates.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 contracts can be updated at once' },
        { status: 400 }
      );
    }

    // Validate update structure
    const validUpdates = updates.every(
      (update) =>
        update.contractId &&
        typeof update.contractId === 'string' &&
        update.data &&
        typeof update.data === 'object'
    );

    if (!validUpdates) {
      return NextResponse.json(
        { error: 'Invalid update structure' },
        { status: 400 }
      );
    }

    // Execute batch update
    const result = await batchService.batchUpdate(updates);

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Batch update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Batch update failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
