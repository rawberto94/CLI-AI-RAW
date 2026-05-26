import { ExcelParser, type ExcelRow } from '@/lib/import/excel-parser';
import { getFileExtension, formatFileSize } from '@/lib/import/file-validation';

export const CLAUSE_IMPORT_ALLOWED_EXTENSIONS = ['.csv', '.json', '.xlsx', '.xls'] as const;
export const MAX_CLAUSE_IMPORT_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_CLAUSE_IMPORT_ROWS = 500;

export type ClauseImportRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ClauseImportRow {
  rowNumber: number;
  sourceSheet?: string;
  title: string;
  content: string;
  category: string;
  riskLevel: ClauseImportRiskLevel;
  tags: string[];
  isStandard: boolean;
  isMandatory: boolean;
  isNegotiable: boolean;
  jurisdiction?: string;
  contractTypes: string[];
  alternativeText?: string;
  errors: string[];
  warnings: string[];
  duplicate?: boolean;
  duplicateReason?: string;
}

export interface ClauseImportParseResult {
  fileName: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  rows: ClauseImportRow[];
}

type RawImportRow = Record<string, unknown>;

interface SourceRow {
  row: RawImportRow;
  rowNumber: number;
  sourceSheet?: string;
}

const FIELD_ALIASES = {
  title: ['title', 'name', 'clausename', 'clausetitle'],
  content: ['content', 'clause', 'clausetext', 'text', 'body', 'language'],
  category: ['category', 'type', 'clausetype', 'section'],
  riskLevel: ['risklevel', 'risk', 'risk_level', 'severity'],
  tags: ['tags', 'tag', 'keywords', 'labels'],
  isStandard: ['isstandard', 'standard', 'is_standard'],
  isMandatory: ['ismandatory', 'mandatory', 'required', 'is_mandatory'],
  isNegotiable: ['isnegotiable', 'negotiable', 'is_negotiable'],
  jurisdiction: ['jurisdiction', 'law', 'governinglaw', 'governing_law'],
  contractTypes: ['contracttypes', 'contracttype', 'documenttypes', 'agreementtypes', 'contract_types'],
  alternativeText: ['alternativetext', 'alternate', 'fallback', 'fallbacklanguage', 'alternative_text'],
} as const;

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function getAliasedValue(row: RawImportRow, aliases: readonly string[]): unknown {
  const normalizedKeys = new Map<string, string>();

  for (const key of Object.keys(row)) {
    normalizedKeys.set(normalizeHeader(key), key);
  }

  for (const alias of aliases) {
    const sourceKey = normalizedKeys.get(normalizeHeader(alias));
    if (sourceKey) return row[sourceKey];
  }

  return undefined;
}

function normalizeCategory(value: unknown): string {
  return valueToString(value)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();
}

function normalizeRiskLevel(value: unknown, errors: string[]): ClauseImportRiskLevel {
  const raw = valueToString(value);
  if (!raw) return 'MEDIUM';

  const normalized = raw.toUpperCase();
  if (normalized === 'LOW' || normalized === 'MEDIUM' || normalized === 'HIGH') {
    return normalized;
  }

  errors.push('Risk level must be LOW, MEDIUM, or HIGH');
  return 'MEDIUM';
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => valueToString(entry)).filter(Boolean);
  }

  const raw = valueToString(value);
  if (!raw) return [];

  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => valueToString(entry)).filter(Boolean);
      }
    } catch {
      // Fall through to delimited parsing.
    }
  }

  return raw.split(/[,;\n]/).map((entry) => entry.trim()).filter(Boolean);
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;

  const raw = valueToString(value).toLowerCase();
  if (!raw) return fallback;
  if (['true', 'yes', 'y', '1'].includes(raw)) return true;
  if (['false', 'no', 'n', '0'].includes(raw)) return false;

  return fallback;
}

function detectCsvDelimiter(content: string): string {
  const firstLine = content.split(/\r?\n/).find((line) => line.trim().length > 0) || '';
  const delimiters = [',', ';', '\t', '|'];
  return delimiters
    .map((delimiter) => ({
      delimiter,
      count: firstLine.split(delimiter).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter || ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsvSourceRows(content: string): SourceRow[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectCsvDelimiter(content);
  const headers = parseCsvLine(lines[0] || '', delimiter);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, delimiter);
    const row: RawImportRow = {};

    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });

    return {
      row,
      rowNumber: index + 2,
    };
  });
}

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new TextDecoder().decode(await file.arrayBuffer());
}

export function getClauseImportRowKey(row: Pick<ClauseImportRow, 'title'> | { title?: string | null; name?: string | null }): string {
  const title = 'title' in row ? row.title : row.name;
  return valueToString(title).toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeSourceRow(source: SourceRow): ClauseImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = valueToString(getAliasedValue(source.row, FIELD_ALIASES.title));
  const content = valueToString(getAliasedValue(source.row, FIELD_ALIASES.content));
  const category = normalizeCategory(getAliasedValue(source.row, FIELD_ALIASES.category));
  const riskLevel = normalizeRiskLevel(getAliasedValue(source.row, FIELD_ALIASES.riskLevel), errors);
  const jurisdiction = valueToString(getAliasedValue(source.row, FIELD_ALIASES.jurisdiction));
  const alternativeText = valueToString(getAliasedValue(source.row, FIELD_ALIASES.alternativeText));

  if (!title) errors.push('Title is required');
  if (!content) errors.push('Content is required');
  if (!category) errors.push('Category is required');
  if (content && content.length < 10) warnings.push('Clause content is very short');

  return {
    rowNumber: source.rowNumber,
    sourceSheet: source.sourceSheet,
    title,
    content,
    category,
    riskLevel,
    tags: parseStringArray(getAliasedValue(source.row, FIELD_ALIASES.tags)),
    isStandard: parseBoolean(getAliasedValue(source.row, FIELD_ALIASES.isStandard), false),
    isMandatory: parseBoolean(getAliasedValue(source.row, FIELD_ALIASES.isMandatory), false),
    isNegotiable: parseBoolean(getAliasedValue(source.row, FIELD_ALIASES.isNegotiable), true),
    jurisdiction: jurisdiction || undefined,
    contractTypes: parseStringArray(getAliasedValue(source.row, FIELD_ALIASES.contractTypes)),
    alternativeText: alternativeText || undefined,
    errors,
    warnings,
  };
}

function summarizeRows(fileName: string, fileSize: number, rows: ClauseImportRow[]): ClauseImportParseResult {
  return {
    fileName,
    fileSize,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.errors.length === 0 && !row.duplicate).length,
    errorRows: rows.filter((row) => row.errors.length > 0).length,
    duplicateRows: rows.filter((row) => row.duplicate).length,
    rows,
  };
}

function markDuplicateRows(rows: ClauseImportRow[]): ClauseImportRow[] {
  const seen = new Set<string>();

  return rows.map((row) => {
    const key = getClauseImportRowKey(row);
    if (!key || row.errors.length > 0) return row;

    if (seen.has(key)) {
      return {
        ...row,
        duplicate: true,
        duplicateReason: 'Duplicate title in this file',
        warnings: [...row.warnings, 'Duplicate title in this file'],
      };
    }

    seen.add(key);
    return row;
  });
}

function rowsToResult(fileName: string, fileSize: number, sourceRows: SourceRow[]): ClauseImportParseResult {
  const normalizedRows = sourceRows.slice(0, MAX_CLAUSE_IMPORT_ROWS).map(normalizeSourceRow);
  const rows = markDuplicateRows(normalizedRows);
  return summarizeRows(fileName, fileSize, rows);
}

export function validateClauseImportFile(file: File): { valid: true } | { valid: false; error: string; details?: string } {
  const extension = getFileExtension(file.name);

  if (!CLAUSE_IMPORT_ALLOWED_EXTENSIONS.includes(extension as typeof CLAUSE_IMPORT_ALLOWED_EXTENSIONS[number])) {
    return {
      valid: false,
      error: 'Invalid file type',
      details: `Upload ${CLAUSE_IMPORT_ALLOWED_EXTENSIONS.join(', ')} files only`,
    };
  }

  if (file.size > MAX_CLAUSE_IMPORT_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too large',
      details: `File size must be less than ${formatFileSize(MAX_CLAUSE_IMPORT_FILE_SIZE)}`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty',
    };
  }

  return { valid: true };
}

export async function parseClauseImportFile(file: File): Promise<ClauseImportParseResult> {
  const validation = validateClauseImportFile(file);
  if (!validation.valid) {
    throw new Error(validation.details ? `${validation.error}: ${validation.details}` : validation.error);
  }

  const extension = getFileExtension(file.name);

  if (extension === '.json') {
    const parsed = JSON.parse(await readFileText(file)) as unknown;
    return parseClauseImportJson(parsed, file.name, file.size);
  }

  if (extension === '.csv') {
    const sourceRows = parseCsvSourceRows(await readFileText(file));
    return rowsToResult(file.name, file.size, sourceRows);
  }

  const parsed = await ExcelParser.parseFile(await file.arrayBuffer(), file.name);
  const sourceRows = parsed.sheets.flatMap((sheet) =>
    sheet.rows.map((row: ExcelRow, index) => ({
      row: row as RawImportRow,
      rowNumber: sheet.metadata.dataStartRow + index + 1,
      sourceSheet: sheet.name,
    })),
  );

  return rowsToResult(file.name, file.size, sourceRows);
}

export function parseClauseImportJson(value: unknown, fileName = 'clauses.json', fileSize = 0): ClauseImportParseResult {
  const collection = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { clauses?: unknown }).clauses)
      ? (value as { clauses: unknown[] }).clauses
      : typeof value === 'object' && value !== null && Array.isArray((value as { items?: unknown }).items)
        ? (value as { items: unknown[] }).items
        : typeof value === 'object' && value !== null && Array.isArray((value as { data?: unknown }).data)
          ? (value as { data: unknown[] }).data
          : null;

  if (!collection) {
    throw new Error('JSON file must contain an array of clauses');
  }

  const sourceRows = collection.map((row, index) => ({
    row: (typeof row === 'object' && row !== null ? row : {}) as RawImportRow,
    rowNumber: index + 1,
  }));

  return rowsToResult(fileName, fileSize, sourceRows);
}

export function normalizeClauseImportRows(rows: unknown[], fileName = 'clauses'): ClauseImportParseResult {
  const sourceRows = rows.map((row, index) => ({
    row: (typeof row === 'object' && row !== null ? row : {}) as RawImportRow,
    rowNumber: typeof (row as { rowNumber?: unknown })?.rowNumber === 'number'
      ? (row as { rowNumber: number }).rowNumber
      : index + 1,
    sourceSheet: typeof (row as { sourceSheet?: unknown })?.sourceSheet === 'string'
      ? (row as { sourceSheet: string }).sourceSheet
      : undefined,
  }));

  return rowsToResult(fileName, 0, sourceRows);
}

export function applyExistingClauseDuplicateWarnings(
  result: ClauseImportParseResult,
  duplicateKeys: Set<string>,
): ClauseImportParseResult {
  const rows = result.rows.map((row) => {
    const key = getClauseImportRowKey(row);
    if (!key || row.errors.length > 0 || !duplicateKeys.has(key)) return row;

    return {
      ...row,
      duplicate: true,
      duplicateReason: 'Already exists in the clause library',
      warnings: [...row.warnings, 'Already exists in the clause library'],
    };
  });

  return summarizeRows(result.fileName, result.fileSize, rows);
}