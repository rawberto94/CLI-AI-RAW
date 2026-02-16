/**
 * Contract Integrity Check API
 * GET /api/contracts/[id]/integrity - Validate contract data integrity
 * 
 * Checks 7 categories:
 * 1. Date consistency
 * 2. Value validation
 * 3. Taxonomy classification
 * 4. Hierarchy integrity
 * 5. Processing status
 * 6. Artifacts presence
 * 7. Metadata completeness
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerTenantId } from '@/lib/tenant-server'
import { validateContractIntegrity, formatIntegrityReport } from '@/lib/validation/contract-integrity'
import { getAuthenticatedApiContext, getApiContext, createSuccessResponse, createErrorResponse, handleApiError } from '@/lib/api-middleware';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = getAuthenticatedApiContext(request);
  if (!ctx) {
    return createErrorResponse(getApiContext(request), 'UNAUTHORIZED', 'Authentication required', 401, { retryable: false });
  }
  const params = await context.params
  try {
    const contractId = params.id

    if (!contractId) {
      return createErrorResponse(ctx, 'BAD_REQUEST', 'Contract ID is required', 400);
    }

    // Get tenant ID for isolation
    const tenantId = await getServerTenantId()
    if (!tenantId) {
      return createErrorResponse(ctx, 'UNAUTHORIZED', 'Tenant ID is required', 401);
    }

    // Get format preference
    const format = request.nextUrl.searchParams.get('format') || 'json'

    // Run integrity validation
    const result = await validateContractIntegrity(contractId, tenantId)

    const errors = result.issues.filter(i => i.severity === 'error')
    const warnings = result.issues.filter(i => i.severity === 'warning')
    const info = result.issues.filter(i => i.severity === 'info')
    const suggestedFixes = result.issues
      .filter(i => typeof i.suggestedFix === 'string' && i.suggestedFix.length > 0)
      .map(i => ({
        category: i.category,
        message: i.message,
        field: i.field,
        suggestedFix: i.suggestedFix,
      }))

    if (format === 'text') {
      // Return human-readable text report
      const report = formatIntegrityReport(result)
      return new NextResponse(report, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    // Return JSON format
    return createSuccessResponse(ctx, {
      contractId,
      tenantId,
      valid: result.valid,
      score: result.score,
      summary: {
        errors: errors.length,
        warnings: warnings.length,
        info: info.length,
      },
      checks: {
        dates: errors.filter(e => e.category === 'dates').length +
          warnings.filter(w => w.category === 'dates').length === 0,
        values: errors.filter(e => e.category === 'values').length +
          warnings.filter(w => w.category === 'values').length === 0,
        taxonomy: errors.filter(e => e.category === 'taxonomy').length +
          warnings.filter(w => w.category === 'taxonomy').length === 0,
        hierarchy: errors.filter(e => e.category === 'hierarchy').length +
          warnings.filter(w => w.category === 'hierarchy').length === 0,
        processing: errors.filter(e => e.category === 'processing').length +
          warnings.filter(w => w.category === 'processing').length === 0,
        artifacts: errors.filter(e => e.category === 'artifacts').length +
          warnings.filter(w => w.category === 'artifacts').length === 0,
        metadata: errors.filter(e => e.category === 'metadata').length +
          warnings.filter(w => w.category === 'metadata').length === 0,
      },
      errors,
      warnings,
      info,
      suggestedFixes,
    });
  } catch (error: unknown) {
    return handleApiError(ctx, error);
  }
}
