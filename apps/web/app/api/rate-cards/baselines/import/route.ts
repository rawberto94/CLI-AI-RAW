import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { baselineManagementService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    // Mock user for now - in production, get from session
    const mockTenantId = 'tenant-1';

    const body = await request.json();
    const { baselines, options } = body;

    if (!baselines || !Array.isArray(baselines)) {
      return NextResponse.json(
        { error: 'Invalid request: baselines array is required' },
        { status: 400 }
      );
    }

    const baselineService = new baselineManagementService(prisma);

    const result = await baselineService.importBaselines(
      mockTenantId,
      baselines,
      {
        updateExisting: options?.updateExisting ?? true,
        batchSize: options?.batchSize ?? 100,
        autoApprove: options?.autoApprove ?? false,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error importing baselines:', error);
    return NextResponse.json(
      { error: 'Failed to import baselines' },
      { status: 500 }
    );
  }
}
