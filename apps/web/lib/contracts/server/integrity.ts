import { NextRequest, NextResponse } from 'next/server';

import { createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import {
  formatIntegrityReport,
  validateContractIntegrity,
} from '@/lib/validation/contract-integrity';

import type { ContractApiContext } from '@/lib/contracts/server/context';

export async function getContractIntegrityReport(
  request: NextRequest,
  context: ContractApiContext,
  contractId: string,
) {
  if (!contractId) {
    return createErrorResponse(context, 'BAD_REQUEST', 'Contract ID is required', 400);
  }

  const tenantId = context.tenantId;
  if (!tenantId) {
    return createErrorResponse(context, 'UNAUTHORIZED', 'Tenant ID is required', 401);
  }

  const format = request.nextUrl.searchParams.get('format') || 'json';
  const result = await validateContractIntegrity(contractId, tenantId);

  const errors = result.issues.filter((issue) => issue.severity === 'error');
  const warnings = result.issues.filter((issue) => issue.severity === 'warning');
  const info = result.issues.filter((issue) => issue.severity === 'info');
  const suggestedFixes = result.issues
    .filter((issue) => typeof issue.suggestedFix === 'string' && issue.suggestedFix.length > 0)
    .map((issue) => ({
      category: issue.category,
      message: issue.message,
      field: issue.field,
      suggestedFix: issue.suggestedFix,
    }));

  if (format === 'text') {
    const report = formatIntegrityReport(result);
    return new Response(report, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    }) as unknown as NextResponse;
  }

  return createSuccessResponse(context, {
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
      dates:
        errors.filter((issue) => issue.category === 'dates').length +
          warnings.filter((issue) => issue.category === 'dates').length ===
        0,
      values:
        errors.filter((issue) => issue.category === 'values').length +
          warnings.filter((issue) => issue.category === 'values').length ===
        0,
      taxonomy:
        errors.filter((issue) => issue.category === 'taxonomy').length +
          warnings.filter((issue) => issue.category === 'taxonomy').length ===
        0,
      hierarchy:
        errors.filter((issue) => issue.category === 'hierarchy').length +
          warnings.filter((issue) => issue.category === 'hierarchy').length ===
        0,
      processing:
        errors.filter((issue) => issue.category === 'processing').length +
          warnings.filter((issue) => issue.category === 'processing').length ===
        0,
      artifacts:
        errors.filter((issue) => issue.category === 'artifacts').length +
          warnings.filter((issue) => issue.category === 'artifacts').length ===
        0,
      metadata:
        errors.filter((issue) => issue.category === 'metadata').length +
          warnings.filter((issue) => issue.category === 'metadata').length ===
        0,
    },
    errors,
    warnings,
    info,
    suggestedFixes,
  });
}