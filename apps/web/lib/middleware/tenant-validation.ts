import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from 'data-orchestration/src/utils/logger';

const logger = createLogger('tenant-validation');

export function validateTenant(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id');

  if (!tenantId) {
    logger.warn({ url: request.url }, 'Missing tenant ID in request');
    return NextResponse.json(
      { error: 'Missing tenant ID', code: 'TENANT_REQUIRED' },
      { status: 400 }
    );
  }

  // Validate tenant format (basic validation)
  if (tenantId.length < 3 || tenantId.length > 100) {
    logger.warn({ tenantId, url: request.url }, 'Invalid tenant ID format');
    return NextResponse.json(
      { error: 'Invalid tenant ID format', code: 'INVALID_TENANT' },
      { status: 400 }
    );
  }

  // Additional validation can be added here:
  // - Check if tenant exists in database
  // - Check if tenant is active
  // - Check tenant permissions

  return null; // Continue if valid
}

export function getTenantId(request: NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

export function requireTenant(request: NextRequest): string {
  const tenantId = getTenantId(request);
  
  if (!tenantId) {
    throw new Error('Tenant ID is required');
  }

  return tenantId;
}
