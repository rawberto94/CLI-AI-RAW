/**
 * File Integrity Service
 * 
 * Provides file validation, checksum calculation, and duplicate detection
 * to ensure data integrity and prevent duplicate uploads.
 */

import { createHash } from 'crypto';
import { createReadStream, statSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { createLogger } from '../utils/logger';
import { dbAdaptor } from '../dal/database.adaptor';

const logger = createLogger('file-integrity-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface FileMetadata {
  size: number;
  mimeType: string;
  extension: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface FileIntegrityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ChecksumResult {
  checksum: string;
  algorithm: 'sha256';
  calculatedAt: Date;
  fileSize: number;
}

// =========================================================================
// FILE INTEGRITY SERVICE
// =========================================================================

export class FileIntegrityService {
  private static instance: FileIntegrityService;

  // Allowed MIME types for contract files
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  // Magic numbers for file type verification
  private readonly MAGIC_NUMBERS: Record<string, Buffer[]> = {
    'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
    'application/msword': [Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])], // DOC
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // DOCX (ZIP)
      Buffer.from([0x50, 0x4B, 0x05, 0x06]), // DOCX (ZIP empty)
      Buffer.from([0x50, 0x4B, 0x07, 0x08]), // DOCX (ZIP spanned)
    ],
    'text/plain': [], // No magic number for plain text
    'application/rtf': [Buffer.from([0x7B, 0x5C, 0x72, 0x74, 0x66])], // {\rtf
  };

  // File size limits (in bytes)
  private readonly MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
  private readonly MIN_FILE_SIZE = 1; // 1 byte

  private constructor() {
    logger.info('File Integrity Service initialized');
  }

  // =========================================================================
  // COMPREHENSIVE FILE VALIDATION
  // =========================================================================

  /**
   * Comprehensive file validation including MIME type, magic numbers, and size
   */
  async validateFile(
    filePath: string,
    declaredMimeType: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check file exists
      if (!existsSync(filePath)) {
        errors.push('File does not exist');
        return { valid: false, errors, warnings };
      }

      // Get file stats
      const stats = statSync(filePath);

      // Validate file size
      if (stats.size < this.MIN_FILE_SIZE) {
        errors.push('File is empty');
      }

      if (stats.size > this.MAX_FILE_SIZE) {
        errors.push(
          `File size (${this.formatBytes(stats.size)}) exceeds maximum (${this.formatBytes(this.MAX_FILE_SIZE)})`
        );
      }

      // Validate MIME type against whitelist
      if (!this.ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
        errors.push(`MIME type '${declaredMimeType}' is not allowed`);
        warnings.push(`Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`);
      }

      // Verify magic number matches declared MIME type
      const magicNumberResult = await this.verifyMagicNumberComprehensive(
        filePath,
        declaredMimeType
      );

      if (!magicNumberResult.valid) {
        errors.push(...magicNumberResult.errors);
        warnings.push(...magicNumberResult.warnings);
      }

      const valid = errors.length === 0;

      logger.info(
        { filePath, declaredMimeType, valid, errorCount: errors.length, warningCount: warnings.length },
        'File validation completed'
      );

      return { valid, errors, warnings };
    } catch (error) {
      logger.error({ error, filePath }, 'File validation failed');
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Comprehensive magic number verification
   */
  private async verifyMagicNumberComprehensive(
    filePath: string,
    declaredMimeType: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Skip for types without magic numbers
      if (declaredMimeType === 'text/plain') {
        return { valid: true, errors, warnings };
      }

      // Get magic numbers for this MIME type
      const expectedMagicNumbers = this.MAGIC_NUMBERS[declaredMimeType];

      if (!expectedMagicNumbers || expectedMagicNumbers.length === 0) {
        warnings.push(`No magic number defined for MIME type: ${declaredMimeType}`);
        return { valid: true, errors, warnings };
      }

      // Read first 16 bytes of file
      const buffer = Buffer.alloc(16);
      const fd = await import('fs/promises').then(fs => fs.open(filePath, 'r'));
      await fd.read(buffer, 0, 16, 0);
      await fd.close();

      // Check if any of the expected magic numbers match
      let matched = false;
      for (const expectedMagic of expectedMagicNumbers) {
        if (expectedMagic.length === 0) continue;

        const fileHeader = buffer.subarray(0, expectedMagic.length);
        if (fileHeader.equals(expectedMagic)) {
          matched = true;
          break;
        }
      }

      if (!matched) {
        errors.push(
          `File signature does not match declared MIME type '${declaredMimeType}'. File may be corrupted or mislabeled.`
        );
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      logger.warn({ error, filePath, declaredMimeType }, 'Magic number verification failed');
      warnings.push('Unable to verify file signature');
      return { valid: true, errors, warnings };
    }
  }

  /**
   * Validate file extension matches MIME type
   */
  validateExtension(fileName: string, mimeType: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    const expectedMimeType = this.getMimeTypeFromExtension(extension);

    if (expectedMimeType !== mimeType && expectedMimeType !== 'application/octet-stream') {
      warnings.push(
        `File extension '.${extension}' suggests MIME type '${expectedMimeType}' but declared as '${mimeType}'`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static getInstance(): FileIntegrityService {
    if (!FileIntegrityService.instance) {
      FileIntegrityService.instance = new FileIntegrityService();
    }
    return FileIntegrityService.instance;
  }

  // =========================================================================
  // CHECKSUM OPERATIONS
  // =========================================================================

  /**
   * Calculate SHA-256 checksum for a file
   * Uses streaming for large files to prevent memory issues
   */
  async calculateChecksum(filePath: string): Promise<ChecksumResult> {
    const startTime = Date.now();
    
    try {
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = statSync(filePath);
      const fileSize = stats.size;

      logger.debug({ filePath, fileSize }, 'Calculating checksum');

      // Use streaming for files larger than 10MB
      let checksum: string;
      if (fileSize > 10 * 1024 * 1024) {
        checksum = await this.calculateChecksumStreaming(filePath);
      } else {
        checksum = await this.calculateChecksumDirect(filePath);
      }

      const duration = Date.now() - startTime;
      logger.info({ filePath, checksum, fileSize, duration }, 'Checksum calculated');

      return {
        checksum,
        algorithm: 'sha256',
        calculatedAt: new Date(),
        fileSize,
      };
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to calculate checksum');
      throw error;
    }
  }

  /**
   * Calculate checksum using streaming (for large files)
   */
  private calculateChecksumStreaming(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Calculate checksum directly (for small files)
   */
  private async calculateChecksumDirect(filePath: string): Promise<string> {
    const buffer = await readFile(filePath);
    const hash = createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
  }

  /**
   * Verify file integrity by comparing checksums
   */
  async verifyIntegrity(
    filePath: string,
    expectedChecksum: string
  ): Promise<boolean> {
    try {
      logger.debug({ filePath, expectedChecksum }, 'Verifying file integrity');

      const result = await this.calculateChecksum(filePath);
      const isValid = result.checksum === expectedChecksum;

      if (!isValid) {
        logger.warn(
          { filePath, expected: expectedChecksum, actual: result.checksum },
          'File integrity check failed'
        );
      } else {
        logger.info({ filePath }, 'File integrity verified');
      }

      return isValid;
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to verify file integrity');
      return false;
    }
  }

  // =========================================================================
  // DUPLICATE DETECTION
  // =========================================================================

  /**
   * Find duplicate contracts by checksum
   */
  async findDuplicateByChecksum(
    checksum: string,
    tenantId: string
  ): Promise<any | null> {
    try {
      logger.debug({ checksum, tenantId }, 'Checking for duplicate');

      // Query database for existing contract with same checksum
      const duplicate = await dbAdaptor.getClient().contract.findFirst({
        where: {
          checksum,
          tenantId,
          status: { not: 'DELETED' },
        },
        select: {
          id: true,
          fileName: true,
          checksum: true,
          createdAt: true,
          uploadedBy: true,
        },
      });

      if (duplicate) {
        logger.info(
          { checksum, duplicateId: duplicate.id, tenantId },
          'Duplicate contract found'
        );
      }

      return duplicate;
    } catch (error) {
      logger.error({ error, checksum, tenantId }, 'Failed to check for duplicate');
      throw error;
    }
  }

  // =========================================================================
  // FILE VALIDATION
  // =========================================================================

  /**
   * Validate file format and content
   */
  async validateFileFormat(
    filePath: string,
    mimeType: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      logger.debug({ filePath, mimeType }, 'Validating file format');

      // Check if file exists
      if (!existsSync(filePath)) {
        errors.push('File does not exist');
        return { valid: false, errors, warnings };
      }

      // Check file size
      const stats = statSync(filePath);
      if (stats.size === 0) {
        errors.push('File is empty');
      }

      if (stats.size > this.MAX_FILE_SIZE) {
        errors.push(
          `File size (${this.formatBytes(stats.size)}) exceeds maximum allowed size (${this.formatBytes(this.MAX_FILE_SIZE)})`
        );
      }

      // Check MIME type
      if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
        errors.push(`MIME type '${mimeType}' is not allowed`);
        warnings.push(
          `Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
        );
      }

      // Verify magic numbers (file signature)
      const magicNumberValid = await this.verifyMagicNumber(filePath, mimeType);
      if (!magicNumberValid) {
        warnings.push(
          'File signature does not match declared MIME type. File may be corrupted or mislabeled.'
        );
      }

      const valid = errors.length === 0;
      logger.info({ filePath, valid, errorCount: errors.length }, 'File validation completed');

      return { valid, errors, warnings };
    } catch (error) {
      logger.error({ error, filePath }, 'File validation failed');
      errors.push(`Validation error: ${error}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Verify file magic number (file signature)
   */
  private async verifyMagicNumber(
    filePath: string,
    mimeType: string
  ): Promise<boolean> {
    try {
      // Skip verification for types without magic numbers
      if (mimeType === 'text/plain') {
        return true;
      }

      // Read first few bytes of file
      const buffer = Buffer.alloc(8);
      const fd = await import('fs/promises').then(fs => fs.open(filePath, 'r'));
      await fd.read(buffer, 0, 8, 0);
      await fd.close();

      // Check PDF signature
      if (mimeType === 'application/pdf') {
        const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
        return buffer.slice(0, 4).equals(pdfSignature);
      }

      // Check ZIP-based formats (DOCX, XLSX)
      if (
        mimeType.includes('openxmlformats') ||
        mimeType === 'application/zip'
      ) {
        const zipSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK
        return buffer.slice(0, 4).equals(zipSignature);
      }

      // Unknown format, skip verification
      return true;
    } catch (error) {
      logger.warn({ error, filePath, mimeType }, 'Magic number verification failed');
      return false;
    }
  }

  // =========================================================================
  // FILE METADATA
  // =========================================================================

  /**
   * Extract file metadata
   */
  async extractFileMetadata(filePath: string): Promise<FileMetadata> {
    try {
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = statSync(filePath);
      const extension = filePath.split('.').pop() || '';

      // Detect MIME type based on extension
      const mimeType = this.getMimeTypeFromExtension(extension);

      const metadata: FileMetadata = {
        size: stats.size,
        mimeType,
        extension,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };

      logger.debug({ filePath, metadata }, 'File metadata extracted');
      return metadata;
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to extract file metadata');
      throw error;
    }
  }

  /**
   * Get MIME type from file extension
   */
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      rtf: 'application/rtf',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get allowed MIME types
   */
  getAllowedMimeTypes(): string[] {
    return [...this.ALLOWED_MIME_TYPES];
  }

  /**
   * Get maximum file size
   */
  getMaxFileSize(): number {
    return this.MAX_FILE_SIZE;
  }

  /**
   * Health check for file integrity service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Service is healthy if we can access it
      // No database dependency for this service
      return true;
    } catch (error) {
      logger.error({ error }, 'File integrity service health check failed');
      return false;
    }
  }
}

export const fileIntegrityService = FileIntegrityService.getInstance();
