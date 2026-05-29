/**
 * Contract Bulk Migration API
 * POST /api/contracts/migrate
 *
 * Accepts CSV or Excel files containing contract metadata and creates
 * contract records in bulk. Supports column mapping and validation.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuthApiHandler, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { auditLog, AuditAction } from '@/lib/security/audit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Expected column mappings (case-insensitive)
const COLUMN_MAPPINGS: Record<string, string[]> = {
  contractTitle: ['contract title', 'title', 'contract name', 'name', 'agreement name'],
  supplierName: ['supplier', 'vendor', 'supplier name', 'vendor name', 'counterparty', 'party'],
  clientName: ['client', 'customer', 'client name', 'buyer'],
  contractType: ['type', 'contract type', 'agreement type', 'category'],
  effectiveDate: ['effective date', 'start date', 'commencement date', 'begin date', 'from'],
  expirationDate: ['expiration date', 'end date', 'expiry date', 'termination date', 'to'],
  totalValue: ['total value', 'value', 'contract value', 'amount', 'price', 'total'],
  currency: ['currency', 'ccy', 'curr'],
  paymentTerms: ['payment terms', 'terms', 'payment conditions'],
  paymentFrequency: ['payment frequency', 'frequency', 'billing cycle'],
  description: ['description', 'notes', 'comments', 'summary'],
  jurisdiction: ['jurisdiction', 'governing law', 'country', 'region'],
  status: ['status', 'contract status'],
};

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const idx = lowerHeaders.indexOf(candidate.toLowerCase().trim());
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function autoMapColumns(headers: string[]): Record<string, string | undefined> {
  const mapping: Record<string, string | undefined> = {};
  for (const [field, candidates] of Object.entries(COLUMN_MAPPINGS)) {
    mapping[field] = findColumn(headers, candidates);
  }
  return mapping;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
    // Try DD.MM.YYYY format
    const parts = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (parts) {
      const d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }
  return null;
}

interface MigrationRow {
  contractTitle?: string;
  supplierName?: string;
  clientName?: string;
  contractType?: string;
  effectiveDate?: Date | null;
  expirationDate?: Date | null;
  totalValue?: number | null;
  currency?: string;
  paymentTerms?: string;
  paymentFrequency?: string;
  description?: string;
  jurisdiction?: string;
  status?: string;
}

function normalizeRow(raw: Record<string, unknown>, mapping: Record<string, string | undefined>): MigrationRow {
  const get = (field: string): unknown => {
    const col = mapping[field];
    return col !== undefined ? raw[col] : undefined;
  };

  return {
    contractTitle: typeof get('contractTitle') === 'string' ? get('contractTitle') as string : undefined,
    supplierName: typeof get('supplierName') === 'string' ? get('supplierName') as string : undefined,
    clientName: typeof get('clientName') === 'string' ? get('clientName') as string : undefined,
    contractType: typeof get('contractType') === 'string' ? get('contractType') as string : undefined,
    effectiveDate: parseDate(get('effectiveDate')),
    expirationDate: parseDate(get('expirationDate')),
    totalValue: parseNumber(get('totalValue')),
    currency: typeof get('currency') === 'string' ? get('currency') as string : undefined,
    paymentTerms: typeof get('paymentTerms') === 'string' ? get('paymentTerms') as string : undefined,
    paymentFrequency: typeof get('paymentFrequency') === 'string' ? get('paymentFrequency') as string : undefined,
    description: typeof get('description') === 'string' ? get('description') as string : undefined,
    jurisdiction: typeof get('jurisdiction') === 'string' ? get('jurisdiction') as string : undefined,
    status: typeof get('status') === 'string' ? get('status') as string : undefined,
  };
}

function validateRow(row: MigrationRow, index: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.contractTitle) errors.push(`Row ${index + 1}: Contract title is required`);
  if (!row.effectiveDate) errors.push(`Row ${index + 1}: Effective date is required`);
  if (!row.expirationDate) errors.push(`Row ${index + 1}: Expiration date is required`);
  if (row.effectiveDate && row.expirationDate && row.effectiveDate > row.expirationDate) {
    errors.push(`Row ${index + 1}: Effective date must be before expiration date`);
  }
  return { valid: errors.length === 0, errors };
}

export const POST = withAuthApiHandler(async (request: NextRequest, ctx) => {
  try {
    const contentType = request.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let fileBuffer: ArrayBuffer | null = null;
    let fileName = 'upload.csv';
    let fileType = 'text/csv';
    let userMapping: Record<string, string> | null = null;

    if (isJson) {
      const body = await request.json();
      if (body.fileBase64) {
        const buf = Buffer.from(body.fileBase64, 'base64');
      fileBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        fileName = body.fileName || 'upload.csv';
        fileType = body.fileType || 'text/csv';
      }
      if (body.mapping) {
        userMapping = body.mapping;
      }
    } else {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No file provided', 400);
      }
      fileBuffer = await file.arrayBuffer();
      fileName = file.name;
      fileType = file.type;
      const mappingStr = formData.get('mapping') as string | null;
      if (mappingStr) {
        try { userMapping = JSON.parse(mappingStr); } catch { /* ignore */ }
      }
    }

    if (!fileBuffer) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No file data provided', 400);
    }

    // Parse file
    let headers: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (fileType.includes('sheet') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const { ExcelParser } = await import('@/lib/import/excel-parser');
      const result = await ExcelParser.parseFile(fileBuffer, fileName);
      if (result.sheets.length === 0) {
        return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No data found in Excel file', 400);
      }
      headers = result.sheets[0].headers;
      rows = result.sheets[0].rows as Record<string, unknown>[];
    } else {
      const { CSVParser } = await import('@/lib/import/csv-parser');
      const text = new TextDecoder().decode(fileBuffer);
      const result = await CSVParser.parseFile(text, fileName, fileBuffer.byteLength);
      headers = result.headers;
      rows = result.rows as Record<string, unknown>[];
    }

    if (rows.length === 0) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'No data rows found in file', 400);
    }

    if (rows.length > 1000) {
      return createErrorResponse(ctx, 'VALIDATION_ERROR', 'Maximum 1000 rows allowed per upload', 400);
    }

    // Auto-detect column mapping
    const autoMapping = autoMapColumns(headers);

    // Merge with user-provided mapping
    const mapping: Record<string, string | undefined> = { ...autoMapping };
    if (userMapping) {
      for (const [field, col] of Object.entries(userMapping)) {
        if (headers.includes(col)) mapping[field] = col;
      }
    }

    // Validate that required fields are mapped
    const requiredFields = ['contractTitle', 'effectiveDate', 'expirationDate'];
    const unmappedRequired = requiredFields.filter(f => !mapping[f]);
    if (unmappedRequired.length > 0) {
      return createSuccessResponse(ctx, {
        stage: 'mapping',
        headers,
        mapping: autoMapping,
        message: 'Column mapping required',
        unmappedRequired,
      });
    }

    // Check for duplicates before importing
    const existingContracts = await prisma.contract.findMany({
      where: { tenantId: ctx.tenantId },
      select: { contractTitle: true, supplierName: true, effectiveDate: true },
    });
    const existingKeys = new Set(
      existingContracts.map(c => `${c.contractTitle}|${c.supplierName}|${c.effectiveDate?.toISOString().split('T')[0]}`)
    );

    // Validate and import rows
    const validationErrors: string[] = [];
    const imported: Array<{ id: string; title: string }> = [];
    const skipped: Array<{ index: number; reason: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = normalizeRow(rows[i], mapping);
      const validation = validateRow(row, i);
      if (!validation.valid) {
        validationErrors.push(...validation.errors);
        skipped.push({ index: i, reason: validation.errors.join('; ') });
        continue;
      }

      // Duplicate detection by title + supplier + effectiveDate
      const dupKey = `${row.contractTitle}|${row.supplierName}|${row.effectiveDate?.toISOString().split('T')[0]}`;
      if (existingKeys.has(dupKey)) {
        skipped.push({ index: i, reason: `Duplicate contract detected (title + supplier + effective date)` });
        continue;
      }

      try {
        const contract = await prisma.contract.create({
          data: {
            tenantId: ctx.tenantId,
            fileName: row.contractTitle || `migrated-contract-${i + 1}`,
            mimeType: 'application/pdf',
            fileSize: BigInt(0),
            uploadedBy: ctx.userId,
            status: 'ACTIVE',
            storagePath: `migrated/${ctx.tenantId}/${Date.now()}-${i}`,
            contractTitle: row.contractTitle || `Migrated Contract ${i + 1}`,
            supplierName: row.supplierName,
            clientName: row.clientName,
            contractType: row.contractType,
            effectiveDate: row.effectiveDate,
            expirationDate: row.expirationDate,
            totalValue: row.totalValue,
            currency: row.currency || 'CHF',
            paymentTerms: row.paymentTerms,
            paymentFrequency: row.paymentFrequency,
            description: row.description,
            jurisdiction: row.jurisdiction,
          },
        });
        imported.push({ id: contract.id, title: contract.contractTitle || contract.fileName });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Database error';
        skipped.push({ index: i, reason: msg });
        logger.warn('[Migration] Row import failed', { index: i, error: msg });
      }
    }

    // Audit log
    await auditLog({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      action: AuditAction.DATA_IMPORTED,
      resourceType: 'contract',
      metadata: {
        source: 'bulk_migration',
        fileName,
        totalRows: rows.length,
        imported: imported.length,
        skipped: skipped.length,
        errors: validationErrors.length,
      },
    });

    return createSuccessResponse(ctx, {
      stage: 'complete',
      totalRows: rows.length,
      imported: imported.length,
      skipped: skipped.length,
      errors: validationErrors.length,
      importedContracts: imported,
      skippedRows: skipped.slice(0, 20),
      validationErrors: validationErrors.slice(0, 20),
      mapping,
    });
  } catch (error) {
    logger.error('[Migration] Unexpected error', { error });
    return createErrorResponse(ctx, 'INTERNAL_ERROR', 'Migration processing failed', 500);
  }
});
