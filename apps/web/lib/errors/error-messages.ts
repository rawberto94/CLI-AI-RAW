/**
 * Error Message Mapping Library
 * Maps technical errors to user-friendly messages with recovery suggestions
 */

import { ImportError } from '@/components/ui/error-message';

export type ErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'FILE_CORRUPTED'
  | 'PARSING_FAILED'
  | 'NO_DATA_FOUND'
  | 'INVALID_HEADERS'
  | 'VALIDATION_FAILED'
  | 'INVALID_RATE'
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_ENTRIES'
  | 'NETWORK_ERROR'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR';

interface ErrorTemplate {
  type: ImportError['type'];
  title: string;
  getMessage: (...args: any[]) => string;
  suggestions: string[];
  recoverable: boolean;
}

export const errorTemplates: Record<ErrorCode, ErrorTemplate> = {
  FILE_TOO_LARGE: {
    type: 'upload',
    title: 'File is too large',
    getMessage: (size: number, maxSize: number = 10) =>
      `Your file is ${size}MB. Maximum size is ${maxSize}MB.`,
    suggestions: [
      'Remove unnecessary sheets from your Excel file',
      'Split the data into multiple files',
      'Export as CSV to reduce file size',
      'Compress images if the file contains any',
    ],
    recoverable: true,
  },

  INVALID_FILE_TYPE: {
    type: 'upload',
    title: 'File type not supported',
    getMessage: (fileType: string) =>
      `${fileType} files aren't supported. Please upload .xlsx, .xls, or .csv files.`,
    suggestions: [
      'Convert to Excel (.xlsx or .xls) format',
      'Save as CSV from your spreadsheet application',
      'Check that the file extension is correct',
    ],
    recoverable: true,
  },

  FILE_CORRUPTED: {
    type: 'upload',
    title: 'File appears to be corrupted',
    getMessage: () =>
      'We couldn't read this file. It may be corrupted or password-protected.',
    suggestions: [
      'Try opening the file in Excel to verify it works',
      'Remove password protection if present',
      'Re-export the file from your source system',
      'Try saving a copy with a different name',
    ],
    recoverable: true,
  },

  PARSING_FAILED: {
    type: 'parsing',
    title: 'Unable to parse file',
    getMessage: (reason?: string) =>
      reason
        ? `We couldn't parse this file: ${reason}`
        : 'We couldn't parse this file. The format may be unusual.',
    suggestions: [
      'Ensure the file has a standard table structure',
      'Remove merged cells and complex formatting',
      'Check that data starts in the first few rows',
      'Try exporting as a simple CSV file',
    ],
    recoverable: true,
  },

  NO_DATA_FOUND: {
    type: 'parsing',
    title: 'No data found',
    getMessage: () =>
      'We couldn't find any data in this file. It appears to be empty.',
    suggestions: [
      'Check that you uploaded the correct file',
      'Ensure the file contains data rows (not just headers)',
      'Verify the correct sheet is selected (for Excel files)',
    ],
    recoverable: true,
  },

  INVALID_HEADERS: {
    type: 'parsing',
    title: 'Column headers not recognized',
    getMessage: (foundHeaders?: string[]) =>
      foundHeaders
        ? `Found headers: ${foundHeaders.join(', ')}. These don't match expected rate card columns.`
        : 'We couldn't identify the column headers in this file.',
    suggestions: [
      'Ensure the first row contains column headers',
      'Use standard column names (Role, Rate, Currency, etc.)',
      'Remove any title rows above the headers',
      'Check the column mapping step for manual adjustment',
    ],
    recoverable: true,
  },

  VALIDATION_FAILED: {
    type: 'validation',
    title: 'Data validation failed',
    getMessage: (errorCount: number) =>
      `Found ${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'} in your data.`,
    suggestions: [
      'Review the validation errors below',
      'Fix errors in your source file and re-upload',
      'Use the inline editor to correct individual errors',
      'Skip invalid rows if they're not critical',
    ],
    recoverable: true,
  },

  INVALID_RATE: {
    type: 'validation',
    title: 'Invalid rate values',
    getMessage: (rows: number[]) =>
      `Found invalid rates in ${rows.length} row${rows.length === 1 ? '' : 's'}: ${rows.slice(0, 5).join(', ')}${rows.length > 5 ? '...' : ''}`,
    suggestions: [
      'Rates must be positive numbers',
      'Remove currency symbols (£, $, €) from rate values',
      'Use decimal point (.) not comma (,) for decimals',
      'Check for hidden characters or spaces',
    ],
    recoverable: true,
  },

  MISSING_REQUIRED_FIELD: {
    type: 'validation',
    title: 'Missing required fields',
    getMessage: (field: string, rows: number[]) =>
      `${field} is missing in ${rows.length} row${rows.length === 1 ? '' : 's'}: ${rows.slice(0, 5).join(', ')}${rows.length > 5 ? '...' : ''}`,
    suggestions: [
      'Fill in all required fields in your source file',
      'Check for empty cells in required columns',
      'Ensure data isn't hidden by filters',
      'Map columns correctly in the mapping step',
    ],
    recoverable: true,
  },

  DUPLICATE_ENTRIES: {
    type: 'validation',
    title: 'Duplicate entries found',
    getMessage: (count: number) =>
      `Found ${count} duplicate ${count === 1 ? 'entry' : 'entries'} based on role and location.`,
    suggestions: [
      'Review duplicates and keep the most recent',
      'Check if roles have different seniority levels',
      'Verify locations are correctly specified',
      'Use the duplicate resolution tool to merge or skip',
    ],
    recoverable: true,
  },

  NETWORK_ERROR: {
    type: 'network',
    title: 'Connection lost',
    getMessage: () =>
      'Your connection was interrupted. Your progress has been saved.',
    suggestions: [
      'Check your internet connection',
      'Click Retry to continue',
      'Your data is safe and will resume from where it stopped',
    ],
    recoverable: true,
  },

  DATABASE_ERROR: {
    type: 'database',
    title: 'Unable to save data',
    getMessage: (reason?: string) =>
      reason
        ? `We couldn't save your data: ${reason}`
        : 'We couldn't save your data. This is usually temporary.',
    suggestions: [
      'Click Retry to try again',
      'Check if you have permission to import data',
      'Contact support if the problem persists',
    ],
    recoverable: true,
  },

  UNKNOWN_ERROR: {
    type: 'upload',
    title: 'Something went wrong',
    getMessage: () =>
      'An unexpected error occurred. We've logged the details.',
    suggestions: [
      'Try refreshing the page',
      'Check your internet connection',
      'Contact support if the problem persists',
    ],
    recoverable: true,
  },
};

/**
 * Create an ImportError from an error code
 */
export function createError(
  code: ErrorCode,
  ...args: any[]
): ImportError {
  const template = errorTemplates[code];
  
  return {
    type: template.type,
    message: template.getMessage(...args),
    recoverable: template.recoverable,
    suggestions: template.suggestions,
  };
}

/**
 * Create an ImportError with custom details
 */
export function createDetailedError(
  code: ErrorCode,
  details: string,
  ...args: any[]
): ImportError {
  const error = createError(code, ...args);
  return {
    ...error,
    details,
  };
}

/**
 * Parse error from API response
 */
export function parseApiError(error: any): ImportError {
  // Handle different error formats
  if (error.code && errorTemplates[error.code as ErrorCode]) {
    return createError(error.code as ErrorCode, ...error.args || []);
  }

  // Handle validation errors
  if (error.validationErrors) {
    return {
      type: 'validation',
      message: `Found ${error.validationErrors.length} validation errors`,
      recoverable: true,
      suggestions: errorTemplates.VALIDATION_FAILED.suggestions,
      affectedRows: error.validationErrors.map((e: any) => e.row),
    };
  }

  // Fallback to unknown error
  return createError('UNKNOWN_ERROR');
}
