/**
 * CSV Import Service
 * Handles parsing and validation of rate card CSV uploads
 */

export interface ParsedRow {
  rowNumber: number;
  data: {
    supplierName: string;
    supplierTier: string;
    supplierCountry: string;
    roleOriginal: string;
    roleStandardized?: string;
    seniority: string;
    lineOfService?: string;
    roleCategory?: string;
    dailyRate: number;
    currency: string;
    country: string;
    region: string;
    city?: string;
    effectiveDate: string;
    expiryDate?: string;
    isNegotiated: boolean;
    negotiationNotes?: string;
    skills?: string[];
    certifications?: string[];
  };
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
  };
  errors: string[];
}

export class CSVImportService {
  private readonly VALID_TIERS = ['BIG_4', 'TIER_2', 'BOUTIQUE', 'OFFSHORE'];
  private readonly VALID_SENIORITIES = ['JUNIOR', 'MID', 'SENIOR', 'PRINCIPAL', 'PARTNER'];
  private readonly VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'INR'];

  /**
   * Parse CSV content into structured data
   */
  parseCSV(csvContent: string): ParseResult {
    const lines = csvContent.split('\n').filter((line) => line.trim());

    if (lines.length < 5) {
      return {
        rows: [],
        summary: { totalRows: 0, validRows: 0, invalidRows: 0, warningRows: 0 },
        errors: ['CSV file is too short. Expected at least 5 rows (headers + descriptions + rules + example + data)'],
      };
    }

    // Skip header, description, and validation rules rows
    const headers = this.parseCSVLine(lines[0]);
    const dataLines = lines.slice(4); // Skip first 4 rows

    const parsedRows: ParsedRow[] = [];
    const globalErrors: string[] = [];

    dataLines.forEach((line, index) => {
      const rowNumber = index + 5; // Actual row number in file
      try {
        const values = this.parseCSVLine(line);
        
        if (values.length === 0 || values.every((v) => !v.trim())) {
          return; // Skip empty rows
        }

        const parsedRow = this.parseRow(headers, values, rowNumber);
        parsedRows.push(parsedRow);
      } catch (error) {
        globalErrors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    });

    const validRows = parsedRows.filter((r) => r.isValid).length;
    const invalidRows = parsedRows.filter((r) => !r.isValid).length;
    const warningRows = parsedRows.filter((r) => r.warnings.length > 0).length;

    return {
      rows: parsedRows,
      summary: {
        totalRows: parsedRows.length,
        validRows,
        invalidRows,
        warningRows,
      },
      errors: globalErrors,
    };
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse and validate a single row
   */
  private parseRow(headers: string[], values: string[], rowNumber: number): ParsedRow {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Map values to fields
    const fieldMap: Record<string, string> = {};
    headers.forEach((header, index) => {
      fieldMap[header] = values[index] || '';
    });

    // Required fields validation
    if (!fieldMap.supplierName?.trim()) {
      errors.push({ field: 'supplierName', message: 'Supplier name is required' });
    }

    if (!fieldMap.roleOriginal?.trim()) {
      errors.push({ field: 'roleOriginal', message: 'Role name is required' });
    }

    if (!fieldMap.seniority?.trim()) {
      errors.push({ field: 'seniority', message: 'Seniority is required' });
    } else if (!this.VALID_SENIORITIES.includes(fieldMap.seniority.toUpperCase())) {
      errors.push({
        field: 'seniority',
        message: `Invalid seniority. Must be one of: ${this.VALID_SENIORITIES.join(', ')}`,
        value: fieldMap.seniority,
      });
    }

    if (!fieldMap.dailyRate?.trim()) {
      errors.push({ field: 'dailyRate', message: 'Daily rate is required' });
    } else {
      const rate = parseFloat(fieldMap.dailyRate);
      if (isNaN(rate) || rate <= 0) {
        errors.push({
          field: 'dailyRate',
          message: 'Daily rate must be a positive number',
          value: fieldMap.dailyRate,
        });
      }
    }

    if (!fieldMap.currency?.trim()) {
      errors.push({ field: 'currency', message: 'Currency is required' });
    } else if (!this.VALID_CURRENCIES.includes(fieldMap.currency.toUpperCase())) {
      errors.push({
        field: 'currency',
        message: `Invalid currency. Must be one of: ${this.VALID_CURRENCIES.join(', ')}`,
        value: fieldMap.currency,
      });
    }

    if (!fieldMap.country?.trim()) {
      errors.push({ field: 'country', message: 'Country is required' });
    }

    if (!fieldMap.effectiveDate?.trim()) {
      errors.push({ field: 'effectiveDate', message: 'Effective date is required' });
    } else if (!this.isValidDate(fieldMap.effectiveDate)) {
      errors.push({
        field: 'effectiveDate',
        message: 'Invalid date format. Use YYYY-MM-DD',
        value: fieldMap.effectiveDate,
      });
    }

    // Optional field validation
    if (fieldMap.supplierTier && !this.VALID_TIERS.includes(fieldMap.supplierTier.toUpperCase())) {
      warnings.push({
        field: 'supplierTier',
        message: `Invalid supplier tier. Will default to TIER_2`,
        suggestion: `Use one of: ${this.VALID_TIERS.join(', ')}`,
      });
    }

    if (fieldMap.expiryDate && !this.isValidDate(fieldMap.expiryDate)) {
      warnings.push({
        field: 'expiryDate',
        message: 'Invalid expiry date format',
        suggestion: 'Use YYYY-MM-DD format or leave empty',
      });
    }

    // Parse skills and certifications
    const skills = fieldMap.skills
      ? fieldMap.skills.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const certifications = fieldMap.certifications
      ? fieldMap.certifications.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    // Build data object
    const data = {
      supplierName: fieldMap.supplierName?.trim() || '',
      supplierTier: fieldMap.supplierTier?.toUpperCase() || 'TIER_2',
      supplierCountry: fieldMap.supplierCountry?.trim() || fieldMap.country?.trim() || '',
      roleOriginal: fieldMap.roleOriginal?.trim() || '',
      roleStandardized: fieldMap.roleStandardized?.trim() || undefined,
      seniority: fieldMap.seniority?.toUpperCase() || 'MID',
      lineOfService: fieldMap.lineOfService?.trim() || undefined,
      roleCategory: fieldMap.roleCategory?.trim() || undefined,
      dailyRate: parseFloat(fieldMap.dailyRate) || 0,
      currency: fieldMap.currency?.toUpperCase() || 'USD',
      country: fieldMap.country?.trim() || '',
      region: fieldMap.region?.trim() || 'Americas',
      city: fieldMap.city?.trim() || undefined,
      effectiveDate: fieldMap.effectiveDate?.trim() || '',
      expiryDate: fieldMap.expiryDate?.trim() || undefined,
      isNegotiated: this.parseBoolean(fieldMap.isNegotiated),
      negotiationNotes: fieldMap.negotiationNotes?.trim() || undefined,
      skills,
      certifications,
    };

    return {
      rowNumber,
      data: data as any,
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Parse boolean value
   */
  private parseBoolean(value: string): boolean {
    if (!value) return false;
    const normalized = value.toLowerCase().trim();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  /**
   * Validate parsed data before import
   */
  validateForImport(parsedRows: ParsedRow[]): {
    canImport: boolean;
    blockingErrors: string[];
    warnings: string[];
  } {
    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    const invalidRows = parsedRows.filter((r) => !r.isValid);
    if (invalidRows.length === parsedRows.length) {
      blockingErrors.push('All rows have validation errors. Cannot proceed with import.');
    }

    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      blockingErrors.push('No valid rows found. Cannot proceed with import.');
    }

    if (invalidRows.length > 0) {
      warnings.push(
        `${invalidRows.length} row(s) will be skipped due to validation errors.`
      );
    }

    const rowsWithWarnings = parsedRows.filter((r) => r.warnings.length > 0);
    if (rowsWithWarnings.length > 0) {
      warnings.push(
        `${rowsWithWarnings.length} row(s) have warnings but can still be imported.`
      );
    }

    return {
      canImport: blockingErrors.length === 0 && validRows.length > 0,
      blockingErrors,
      warnings,
    };
  }
}

// Export singleton instance
export const csvImportService = new CSVImportService();
