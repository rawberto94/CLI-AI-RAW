/**
 * Contract Source Test Connection API
 * 
 * POST /api/contract-sources/test - Test a source connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantContext } from '@/lib/tenant-server';
import { z } from 'zod';

const testConnectionSchema = z.object({
  sourceId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const { tenantId, userId } = await getTenantContext();

    if (!tenantId || !userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = testConnectionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { sourceId } = parsed.data;

    // Verify source exists and belongs to tenant
    const source = await prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source not found' },
        { status: 404 }
      );
    }

    // Test the connection
    const { contractSourceSyncService } = await import('@/lib/integrations/sync-service');
    const result = await contractSourceSyncService.testConnection(sourceId, tenantId);

    return NextResponse.json({
      success: result.success,
      data: {
        connected: result.success,
        message: result.message,
        accountInfo: result.accountInfo,
        error: result.error,
        errorCode: result.errorCode,
      },
    });
  } catch (error) {
    console.error('Error testing connection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to test connection' 
      },
      { status: 500 }
    );
  }
}
