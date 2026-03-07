/**
 * File validation utilities for rate card imports
 */

export const ALLOWED_FILE_TYPES = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  XLS: 'application/vnd.ms-excel',
  CSV: 'text/csv',
  PDF: 'application/pdf',
} as const;

export const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf'] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const MIN_FILE_SIZE = 100; // 100 bytes

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  details?: string;
  warnings?: string[];
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  extension: string;
  lastModified: number;
}

/**
 * Validate file type and extension
 */
export function validateFileType(file: File): FileValidationResult {
  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension as any)) {
    return {
      valid: false,
      error: 'Invalid file type',
      details: `Only ${ALLOWED_EXTENSIONS.join(', ')} files are allowed`,
    };
  }

  // Some browsers don't set MIME type correctly, so we allow empty type
  // if the extension is valid
  if (file.type && !Object.values(ALLOWED_FILE_TYPES).includes(file.type as any)) {
    return {
      valid: false,
      error: 'Invalid file MIME type',
      details: `File type ${file.type} is not supported`,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too large',
      details: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
    };
  }

  if (file.size < MIN_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too small',
      details: 'The file appears to be empty or corrupted',
    };
  }

  return { valid: true };
}

/**
 * Validate file name
 */
export function validateFileName(fileName: string): FileValidationResult {
  const warnings: string[] = [];

  // Check for special characters that might cause issues
  if (/[<>:"|?*]/.test(fileName)) {
    warnings.push('File name contains special characters that will be sanitized');
  }

  // Check for very long file names
  if (fileName.length > 255) {
    return {
      valid: false,
      error: 'File name too long',
      details: 'File name must be less than 255 characters',
    };
  }

  // Check for hidden files
  if (fileName.startsWith('.')) {
    warnings.push('Hidden files may not be processed correctly');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Comprehensive file validation
 */
export function validateFile(file: File): FileValidationResult {
  // Validate file type
  const typeResult = validateFileType(file);
  if (!typeResult.valid) {
    return typeResult;
  }

  // Validate file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  // Validate file name
  const nameResult = validateFileName(file.name);
  if (!nameResult.valid) {
    return nameResult;
  }

  return {
    valid: true,
    warnings: [
      ...(typeResult.warnings || []),
      ...(sizeResult.warnings || []),
      ...(nameResult.warnings || []),
    ],
  };
}

/**
 * Validate multiple files
 */
export function validateFiles(files: File[]): {
  valid: boolean;
  results: Map<string, FileValidationResult>;
  validFiles: File[];
  invalidFiles: File[];
} {
  const results = new Map<string, FileValidationResult>();
  const validFiles: File[] = [];
  const invalidFiles: File[] = [];

  for (const file of files) {
    const result = validateFile(file);
    results.set(file.name, result);

    if (result.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push(file);
    }
  }

  return {
    valid: invalidFiles.length === 0,
    results,
    validFiles,
    invalidFiles,
  };
}

/**
 * Extract file metadata
 */
export function getFileMetadata(file: File): FileMetadata {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    extension: getFileExtension(file.name),
    lastModified: file.lastModified,
  };
}

/**
 * Get file extension
 */
export function getFileExtension(fileName: string): string {
  return fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
}

/**
 * Sanitize file name for storage
 */
export function sanitizeFileName(fileName: string): string {
  // Remove or replace special characters
  const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Ensure it doesn't start with a dot
  return sanitized.startsWith('.') ? sanitized.substring(1) : sanitized;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file type icon
 */
export function getFileTypeIcon(fileName: string): string {
  const extension = getFileExtension(fileName);

  switch (extension) {
    case '.xlsx':
    case '.xls':
      return '📊';
    case '.csv':
      return '📄';
    case '.pdf':
      return '📕';
    default:
      return '📎';
  }
}

/**
 * Check if file is Excel
 */
export function isExcelFile(fileName: string): boolean {
  const extension = getFileExtension(fileName);
  return extension === '.xlsx' || extension === '.xls';
}

/**
 * Check if file is CSV
 */
export function isCSVFile(fileName: string): boolean {
  return getFileExtension(fileName) === '.csv';
}

/**
 * Check if file is PDF
 */
export function isPDFFile(fileName: string): boolean {
  return getFileExtension(fileName) === '.pdf';
}
