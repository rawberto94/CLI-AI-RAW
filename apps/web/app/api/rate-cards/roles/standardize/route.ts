/**
 * Role Standardization API
 * POST /api/rate-cards/roles/standardize
 * Standardizes a role name using AI
 */

import { NextRequest, NextResponse } from 'next/server';
import { roleStandardizationService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();

    const { roleOriginal, context } = body;

    if (!roleOriginal) {
      return NextResponse.json(
        { error: 'roleOriginal is required' },
        { status: 400 }
      );
    }

    const result = await roleStandardizationService.standardizeRole(
      roleOriginal,
      tenantId,
      context
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error standardizing role:', error);
    return NextResponse.json(
      {
        error: 'Failed to standardize role',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
