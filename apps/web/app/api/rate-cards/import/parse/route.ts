/**
 * CSV Parse API
 * POST /api/rate-cards/import/parse
 * Parses and validates uploaded CSV file
 */

import { NextRequest, NextResponse } from 'next/server';
import { csvImportService } from 'data-orchestration/services';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Read file content
    const csvContent = await file.text();

    console.log(`📄 Parsing CSV file: ${file.name} (${file.size} bytes)`);

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

    console.log(
      `✅ Parsed ${parseResult.summary.totalRows} rows: ${parseResult.summary.validRows} valid, ${parseResult.summary.invalidRows} invalid`
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse CSV file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
