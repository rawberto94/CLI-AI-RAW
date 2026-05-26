import { NextRequest } from 'next/server';
import { withAuthApiHandler, createErrorResponse, createSuccessResponse } from '@/lib/api-middleware';
import {
  applyExistingClauseDuplicateWarnings,
  parseClauseImportFile,
  validateClauseImportFile,
  MAX_CLAUSE_IMPORT_ROWS,
} from '@/lib/clauses/clause-file-parser';
import { findExistingClauseImportDuplicates } from '@/lib/clauses/clause-library';

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { name?: unknown }).name === 'string'
    && typeof (value as { size?: unknown }).size === 'number';
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!isUploadedFile(file)) {
    return createErrorResponse(ctx, 'BAD_REQUEST', 'A clause import file is required', 400, {
      retryable: false,
    });
  }

  const validation = validateClauseImportFile(file);
  if (!validation.valid) {
    return createErrorResponse(ctx, 'BAD_REQUEST', validation.error, 400, {
      details: validation.details,
      retryable: false,
    });
  }

  const parsed = await parseClauseImportFile(file);
  const duplicateKeys = await findExistingClauseImportDuplicates(ctx.tenantId, parsed.rows);
  const preview = applyExistingClauseDuplicateWarnings(parsed, duplicateKeys);

  return createSuccessResponse(ctx, {
    ...preview,
    maxRows: MAX_CLAUSE_IMPORT_ROWS,
  });
});