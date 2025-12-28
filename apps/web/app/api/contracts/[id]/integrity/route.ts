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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  try {
    const contractId = params.id

    if (!contractId) {
      return NextResponse.json(
        { error: 'Contract ID is required' },
        { status: 400 }
      )
    }

    // Get tenant ID for isolation
    const tenantId = await getServerTenantId()
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 401 }
      )
    }

    // Get format preference
    const format = request.nextUrl.searchParams.get('format') || 'json'

    // Run integrity validation
    const result = await validateContractIntegrity(contractId, tenantId)

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
    return NextResponse.json({
      contractId,
      tenantId,
      valid: result.valid,
      score: result.score,
      summary: {
        errors: result.errors.length,
        warnings: result.warnings.length,
        info: result.info.length,
      },
      checks: {
        dates: result.errors.filter(e => e.category === 'dates').length + 
               result.warnings.filter(w => w.category === 'dates').length === 0,
        values: result.errors.filter(e => e.category === 'values').length + 
                result.warnings.filter(w => w.category === 'values').length === 0,
        taxonomy: result.errors.filter(e => e.category === 'taxonomy').length + 
                  result.warnings.filter(w => w.category === 'taxonomy').length === 0,
        hierarchy: result.errors.filter(e => e.category === 'hierarchy').length + 
                   result.warnings.filter(w => w.category === 'hierarchy').length === 0,
        processing: result.errors.filter(e => e.category === 'processing').length + 
                    result.warnings.filter(w => w.category === 'processing').length === 0,
        artifacts: result.errors.filter(e => e.category === 'artifacts').length + 
                   result.warnings.filter(w => w.category === 'artifacts').length === 0,
        metadata: result.errors.filter(e => e.category === 'metadata').length + 
                  result.warnings.filter(w => w.category === 'metadata').length === 0,
      },
      errors: result.errors,
      warnings: result.warnings,
      info: result.info,
      suggestedFixes: result.suggestedFixes,
    })
  } catch (error) {
    console.error('Contract integrity check error:', error)
    return NextResponse.json(
      {
        error: 'Integrity check failed',
        details: (error as Error).message,
      },
      { status: 500 }
    )
  }
}
