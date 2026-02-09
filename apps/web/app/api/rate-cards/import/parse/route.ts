/**
 * CSV Parse API
 * POST /api/rate-cards/import/parse
 * Parses and validates uploaded CSV file
 */

import { NextRequest } from 'next/server';
import { csvImportService } from 'data-orchestration/services';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse, handleApiError, type AuthenticatedApiContext } from '@/lib/api-middleware';

export const POST = withAuthApiHandler(async (request, ctx) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No file provided', 400);
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Invalid file type. Please upload a CSV file.', 400);
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'File too large. Maximum size is 10MB.', 400);
    }

    // Read file content
    const csvContent = await file.text();

    // Parse and validate
    const parseResult = csvImportService.parseCSV(csvContent);

    // Validate for import
    const importValidation = csvImportService.validateForImport(parseResult.rows);

    const response = {
      success: true,
      fileName: file.name,
      fileSize: file.size,
      parseResult,
      importValidation,
      summary: {
        ...parseResult.summary,
        canImport: importValidation.canImport,
      },
    };

    return createSuccessResponse(ctx, response);
  });
