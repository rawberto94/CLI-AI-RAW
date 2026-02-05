/**
 * Example API Route: Data Consistency
 * 
 * Demonstrates how to use the data consistency services in an API route:
 * - Optimistic locking
 * - Data validation
 * - Transaction management
 * - Audit trails
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  optimisticLockingService,
  dataIntegrityService,
  transactionManager,
  dataConsistencyAuditService,
  OptimisticLockError
} from 'data-orchestration/services';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/auth';

// Define validation schema
const updateContractSchema = z.object({
  status: z.enum(['DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  totalValue: z.number().positive().optional(),
  endDate: z.string().datetime().optional(),
  version: z.number().int().positive()
});

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const contractId = params.id;
    const body = await request.json();

    // Get user context from session
    const userId = session.user.id;
    const userName = session.user.name || 'User';
    const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 1. Validate input schema
    const validationResult = await dataIntegrityService.validateSchema(
      updateContractSchema,
      body,
      'contract_update'
    );

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.errors
        },
        { status: 400 }
      );
    }

    const { version, ...updateData } = body;

    // 2. Get current contract data for audit trail (with tenant check)
    const beforeData = await prisma.contract.findFirst({
      where: { id: contractId, tenantId }
    });

    if (!beforeData) {
      return NextResponse.json(
        { error: 'Contract not found' },
        { status: 404 }
      );
    }

    // 3. Validate business rules and referential integrity
    const integrityResult = await dataIntegrityService.validateComplete(
      updateContractSchema,
      'contract',
      { ...beforeData, ...updateData }
    );

    if (!integrityResult.valid) {
      return NextResponse.json(
        {
          error: 'Data integrity validation failed',
          details: integrityResult.errors
        },
        { status: 400 }
      );
    }

    // 4. Execute update with optimistic locking in a transaction
    const result = await transactionManager.executeTransaction(async (_tx) => {
      // Update with version check
      const updated = await optimisticLockingService.updateWithVersion({
        resourceType: 'contract',
        resourceId: contractId,
        expectedVersion: version,
        data: updateData,
        userId
      });

      // Log the modification
      await dataConsistencyAuditService.logUpdate(
        beforeData.tenantId,
        'contract',
        contractId,
        beforeData,
        updated,
        {
          userId,
          userName,
          ipAddress,
          userAgent,
          reason: 'Contract updated via API'
        }
      );

      return updated;
    });

    // 5. Handle result
    if (!result.success) {
      if (result.error instanceof OptimisticLockError) {
        return NextResponse.json(
          {
            error: 'Version conflict',
            message: 'Contract was modified by another user',
            expectedVersion: result.error.expectedVersion,
            actualVersion: result.error.actualVersion
          },
          { status: 409 }
        );
      }

      throw result.error;
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      message: 'Contract updated successfully'
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve audit trail
export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = session.user.tenantId;
    const contractId = params.id;

    // Get audit trail for the contract
    const auditTrail = await dataConsistencyAuditService.getResourceAuditTrail(
      tenantId,
      'contract',
      contractId
    );

    return NextResponse.json({
      success: true,
      data: {
        contractId,
        auditTrail,
        totalModifications: auditTrail.length
      }
    });

  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}
