/**
 * API Endpoint: Bulk Reprocess Metadata
 * 
 * POST /api/contracts/bulk-extract-metadata
 * Queues metadata extraction for multiple contracts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getContractQueue } from '@/lib/queue/contract-queue';
import { getApiTenantId } from '@/lib/tenant-server';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getApiTenantId(request);

    // Parse request body
    const body = await request.json();
    const {
      contractIds,
      filter,
      autoApply = true,
      autoApplyThreshold = 0.85,
      priority = 'low',
      skipExisting = true,
    } = body;

    let targetContracts: Array<{ id: string; hasMetadata: boolean }> = [];

    if (contractIds && Array.isArray(contractIds)) {
      // Specific contracts
      const contracts = await prisma.contract.findMany({
        where: {
          id: { in: contractIds },
          tenantId,
        },
        select: {
          id: true,
          contractMetadata: {
            select: { id: true },
          },
          rawText: true,
        },
      });

      targetContracts = contracts
        .filter(c => c.rawText && c.rawText.length >= 100)
        .map(c => ({
          id: c.id,
          hasMetadata: !!c.contractMetadata,
        }));
    } else if (filter) {
      // Filter-based selection
      const where: Record<string, unknown> = { tenantId };

      if (filter.status) {
        where.status = filter.status;
      }
      if (filter.missingMetadata) {
        where.contractMetadata = { is: null };
      }
      if (filter.contractType) {
        where.contractType = filter.contractType;
      }
      if (filter.createdAfter) {
        where.createdAt = { gte: new Date(filter.createdAfter) };
      }
      if (filter.createdBefore) {
        where.createdAt = { ...where.createdAt, lte: new Date(filter.createdBefore) };
      }

      const contracts = await prisma.contract.findMany({
        where,
        select: {
          id: true,
          contractMetadata: {
            select: { id: true },
          },
          rawText: true,
        },
        take: 500, // Limit to 500 contracts per batch
      });

      targetContracts = contracts
        .filter(c => c.rawText && c.rawText.length >= 100)
        .map(c => ({
          id: c.id,
          hasMetadata: !!c.contractMetadata,
        }));
    } else {
      return NextResponse.json(
        { error: 'Either contractIds or filter must be provided' },
        { status: 400 }
      );
    }

    // Filter out contracts that already have metadata if skipExisting
    const contractsToProcess = skipExisting
      ? targetContracts.filter(c => !c.hasMetadata)
      : targetContracts;

    if (contractsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        queued: 0,
        skipped: targetContracts.length,
        message: 'No contracts need metadata extraction',
      });
    }

    // Queue all contracts for background processing
    try {
      const queue = getContractQueue();
      const jobIds: string[] = [];
      const priorityValue = priority as 'high' | 'normal' | 'low';
      
      // Queue each contract with a small delay between jobs
      for (let i = 0; i < contractsToProcess.length; i++) {
        const contract = contractsToProcess[i];
        if (!contract) continue;
        const jobId = await queue.queueMetadataExtraction({
          contractId: contract.id,
          tenantId,
          autoApply,
          autoApplyThreshold,
          source: 'bulk' as any,
          priority: priorityValue,
        }, {
          delay: i * 1000, // 1 second delay between each job
        });
        
        if (jobId) {
          jobIds.push(jobId);
        }
      }

      return NextResponse.json({
        success: true,
        queued: jobIds.length,
        skipped: targetContracts.length - contractsToProcess.length,
        message: `Queued ${jobIds.length} contracts for metadata extraction`,
        estimatedTime: `${Math.ceil(jobIds.length * 30 / 60)} minutes`,
        jobIds: jobIds.slice(0, 10), // Return first 10 job IDs
      });
    } catch (queueError) {
      console.error('Queue error:', queueError);
      return NextResponse.json({
        success: false,
        error: 'Failed to queue contracts for processing',
        message: queueError instanceof Error ? queueError.message : 'Unknown error',
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Bulk extract metadata API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get bulk extraction status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = await getApiTenantId(request);

    // Get metadata statistics
    const [
      totalContracts,
      contractsWithMetadata,
      contractsProcessing,
      recentExtractions,
    ] = await Promise.all([
      prisma.contract.count({
        where: { tenantId, status: 'COMPLETED' },
      }),
      prisma.contract.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          contractMetadata: { isNot: null },
        },
      }),
      prisma.contract.count({
        where: { tenantId, status: 'PROCESSING' },
      }),
      prisma.contract.findMany({
        where: {
          tenantId,
          status: 'COMPLETED',
          contractMetadata: { isNot: null },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          contractTitle: true,
          updatedAt: true,
          contractMetadata: {
            select: {
              systemFields: true,
              customFields: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      statistics: {
        totalContracts,
        contractsWithMetadata,
        contractsWithoutMetadata: totalContracts - contractsWithMetadata,
        coveragePercentage: totalContracts > 0
          ? Math.round((contractsWithMetadata / totalContracts) * 100)
          : 0,
        processing: contractsProcessing,
      },
      queue: null, // Queue not implemented
      recentExtractions: recentExtractions.map(c => ({
        id: c.id,
        title: c.contractTitle,
        updatedAt: c.updatedAt,
        fieldCount: c.contractMetadata
          ? Object.keys(c.contractMetadata.systemFields as object || {}).length +
            Object.keys(c.contractMetadata.customFields as object || {}).length
          : 0,
      })),
    });
  } catch (error) {
    console.error('Get bulk extraction status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
