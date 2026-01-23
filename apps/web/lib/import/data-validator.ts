/**
 * Data validation service for rate card imports
 */

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'range' | 'format' | 'custom';
  validator: (value: unknown, row: Record<string, unknown>) => boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationIssue {
  rowNumber: number;
  field: string;
  value: unknown;
  type: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  validRows: Record<string, unknown>[];
  invalidRows: Record<string, unknown>[];
  summary: {
    totalRows: number;
    validRows: number;
    errorCount: number;
    warningCount: number;
    infoCount: number;
  };
}

export class DataValidator {
  private static readonly CURRENCY_CODES = ['USD', 'EUR', 'GBP', 'CHF', 'CAD', 'AUD', 'INR'];
  private static readonly RATE_PERIODS = ['hourly', 'daily', 'monthly', 'annual', 'hour', 'day', 'month', 'year'];

  /**
   * Validate rate card data
   */
  static validate(rows: Record<string, unknown>[], mappings: Record<string, string>): ValidationResult {
    const issues: ValidationIssue[] = [];
    const rules = this.getValidationRules();
    const rowsWithErrors = new Set<number>();

    rows.forEach((row, index) => {
      const rowNumber = index + 1;

      // Apply each validation rule
      for (const rule of rules) {
        const mappedField = Object.keys(mappings).find(k => mappings[k] === rule.field);
        if (!mappedField) continue;

        const value = row[mappedField];

        if (!rule.validator(value, row)) {
          issues.push({
            rowNumber,
            field: mappedField,
            value,
            type: rule.type,
            message: rule.message,
            severity: rule.severity,
          });
          if (rule.severity === 'error') {
            rowsWithErrors.add(index);
          }
        }
      }

      // Check for duplicates
      const duplicateIssues = this.checkDuplicates(row, rows, rowNumber, mappings);
      issues.push(...duplicateIssues);
      if (duplicateIssues.some(i => i.severity === 'error')) {
        rowsWithErrors.add(index);
      }

      // Check for outliers
      const outlierIssues = this.checkOutliers(row, rows, rowNumber, mappings);
      issues.push(...outlierIssues);
    });

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    // Separate valid and invalid rows
    const validRows = rows.filter((_, index) => !rowsWithErrors.has(index));
    const invalidRows = rows.filter((_, index) => rowsWithErrors.has(index));

    return {
      valid: errorCount === 0,
      issues,
      validRows,
      invalidRows,
      summary: {
        totalRows: rows.length,
        validRows: validRows.length,
        errorCount,
        warningCount,
        infoCount,
      },
    };
  }

  /**
   * Get validation rules
   */
  private static getValidationRules(): ValidationRule[] {
    return [
      // Required fields
      {
        field: 'role',
        type: 'required',
        validator: (value) => value != null && String(value).trim() !== '',
        message: 'Role is required',
        severity: 'error',
      },
      {
        field: 'rate',
        type: 'required',
        validator: (value) => value != null && !isNaN(Number(value)),
        message: 'Rate is required and must be a number',
        severity: 'error',
      },

      // Type validation
      {
        field: 'rate',
        type: 'type',
        validator: (value) => !isNaN(Number(value)) && Number(value) > 0,
        message: 'Rate must be a positive number',
        severity: 'error',
      },

      // Range validation
      {
        field: 'rate',
        type: 'range',
        validator: (value) => {
          const num = Number(value);
          return num >= 10 && num <= 10000; // Reasonable rate range
        },
        message: 'Rate seems unusually high or low (expected 10-10000)',
        severity: 'warning',
      },

      // Currency validation
      {
        field: 'currency',
        type: 'format',
        validator: (value) => {
          if (!value) return true; // Optional field
          return this.CURRENCY_CODES.includes(String(value).toUpperCase());
        },
        message: `Currency must be one of: ${this.CURRENCY_CODES.join(', ')}`,
        severity: 'warning',
      },

      // Period validation
      {
        field: 'period',
        type: 'format',
        validator: (value) => {
          if (!value) return true; // Optional field
          return this.RATE_PERIODS.some(p => String(value).toLowerCase().includes(p));
        },
        message: `Period should be one of: ${this.RATE_PERIODS.join(', ')}`,
        severity: 'warning',
      },

      // Location validation
      {
        field: 'location',
        type: 'format',
        validator: (value) => {
          if (!value) return true; // Optional field
          return String(value).trim().length >= 2;
        },
        message: 'Location should be at least 2 characters',
        severity: 'info',
      },
    ];
  }

  /**
   * Check for duplicate entries
   */
  private static checkDuplicates(
    row: Record<string, any>,
    allRows: Record<string, any>[],
    rowNumber: number,
    mappings: Record<string, string>
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Get mapped field names
    const roleField = Object.keys(mappings).find(k => mappings[k] === 'role');
    const locationField = Object.keys(mappings).find(k => mappings[k] === 'location');

    if (!roleField) return issues;

    const role = row[roleField];
    const location = locationField ? row[locationField] : undefined;

    // Find duplicates
    const duplicates = allRows.filter((r, i) => {
      if (i + 1 >= rowNumber) return false; // Only check previous rows
      return r[roleField] === role && (!locationField || r[locationField] === location);
    });

    if (duplicates.length > 0) {
      issues.push({
        rowNumber,
        field: roleField,
        value: role,
        type: 'duplicate',
        message: `Duplicate entry found for role "${role}"${location ? ` in ${location}` : ''}`,
        severity: 'warning',
        suggestion: 'Consider removing or merging duplicate entries',
      });
    }

    return issues;
  }

  /**
   * Check for statistical outliers
   */
  private static checkOutliers(
    row: Record<string, any>,
    allRows: Record<string, any>[],
    rowNumber: number,
    mappings: Record<string, string>
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const rateField = Object.keys(mappings).find(k => mappings[k] === 'rate');
    if (!rateField) return issues;

    const rate = Number(row[rateField]);
    if (isNaN(rate)) return issues;

    // Calculate statistics
    const rates = allRows
      .map(r => Number(r[rateField]))
      .filter(r => !isNaN(r));

    if (rates.length < 3) return issues; // Need enough data

    const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
    const stdDev = Math.sqrt(variance);

    // Check if rate is more than 3 standard deviations from mean
    if (Math.abs(rate - mean) > 3 * stdDev) {
      issues.push({
        rowNumber,
        field: rateField,
        value: rate,
        type: 'outlier',
        message: `Rate ${rate} is significantly different from average (${mean.toFixed(2)} ± ${stdDev.toFixed(2)})`,
        severity: 'warning',
        suggestion: 'Verify this rate is correct',
      });
    }

    return issues;
  }

  /**
   * Get issues by severity
   */
  static getIssuesBySeverity(result: ValidationResult, severity: 'error' | 'warning' | 'info'): ValidationIssue[] {
    return result.issues.filter(i => i.severity === severity);
  }

  /**
   * Get issues by row
   */
  static getIssuesByRow(result: ValidationResult): Map<number, ValidationIssue[]> {
    const byRow = new Map<number, ValidationIssue[]>();

    for (const issue of result.issues) {
      const existing = byRow.get(issue.rowNumber) || [];
      existing.push(issue);
      byRow.set(issue.rowNumber, existing);
    }

    return byRow;
  }

  /**
   * Get rows with errors
   */
  static getRowsWithErrors(result: ValidationResult): number[] {
    return [...new Set(
      result.issues
        .filter(i => i.severity === 'error')
        .map(i => i.rowNumber)
    )].sort((a, b) => a - b);
  }

  /**
   * Export validation report
   */
  static exportReport(result: ValidationResult): string {
    const lines: string[] = [];

    lines.push('# Validation Report\n');
    lines.push(`Total Rows: ${result.summary.totalRows}`);
    lines.push(`Valid Rows: ${result.summary.validRows}`);
    lines.push(`Errors: ${result.summary.errorCount}`);
    lines.push(`Warnings: ${result.summary.warningCount}`);
    lines.push(`Info: ${result.summary.infoCount}\n`);

    if (result.issues.length > 0) {
      lines.push('## Issues\n');

      const byRow = this.getIssuesByRow(result);
      for (const [rowNumber, issues] of byRow.entries()) {
        lines.push(`### Row ${rowNumber}`);
        for (const issue of issues) {
          lines.push(`- [${issue.severity.toUpperCase()}] ${issue.field}: ${issue.message}`);
          if (issue.suggestion) {
            lines.push(`  Suggestion: ${issue.suggestion}`);
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
