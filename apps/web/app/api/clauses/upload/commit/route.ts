import { NextRequest } from 'next/server';
import { withAuthApiHandler, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import { bulkCreateClauseLibraryEntries, type BulkClauseImportIssue } from '@/lib/clauses/clause-library';
import { normalizeClauseImportRows, type ClauseImportRow } from '@/lib/clauses/clause-file-parser';

function invalidRowsToIssues(rows: ClauseImportRow[]): BulkClauseImportIssue[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    title: row.title || `Row ${row.rowNumber}`,
    reason: row.errors.join(', '),
  }));
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Valid JSON is required', 400, {
      retryable: false,
    });
  }

  const rows = typeof body === 'object' && body !== null && Array.isArray((body as { rows?: unknown }).rows)
    ? (body as { rows: unknown[] }).rows
    : null;

  if (!rows) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'Rows are required', 400, {
      retryable: false,
    });
  }

  const normalized = normalizeClauseImportRows(rows, 'clause-upload-commit');
  const invalidRows = normalized.rows.filter((row) => row.errors.length > 0);
  const importableRows = normalized.rows.filter((row) => row.errors.length === 0 && !row.duplicate);

  const result = await bulkCreateClauseLibraryEntries(
    ctx.tenantId,
    ctx.userId,
    importableRows.map((row) => ({
      rowNumber: row.rowNumber,
      title: row.title,
      content: row.content,
      category: row.category,
      riskLevel: row.riskLevel,
      tags: row.tags,
      isStandard: row.isStandard,
      isMandatory: row.isMandatory,
      isNegotiable: row.isNegotiable,
      jurisdiction: row.jurisdiction,
      contractTypes: row.contractTypes,
      alternativeText: row.alternativeText,
    })),
  );

  const failed = [...invalidRowsToIssues(invalidRows), ...result.failed];

  return createSuccessResponse(ctx, {
    totalRows: normalized.rows.length,
    createdCount: result.created.length,
    skippedCount: result.skipped.length,
    failedCount: failed.length,
    created: result.created,
    skipped: result.skipped,
    failed,
  }, { status: 201 });
});