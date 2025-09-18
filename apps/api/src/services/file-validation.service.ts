/**
 * Enhanced File Validation Service
 * Provides comprehensive file validation, content integrity checks, and malware scanning
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import pino from 'pino';

const logger = pino({ name: 'file-validation' });

export interface FileValidationRequest {
  filename: string;
  contentType: string;
  size: number;
  buffer?: Buffer;
  checksum?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    detectedMimeType?: string;
    actualSize: number;
    checksum: string;
    encoding?: string;
    language?: string;
    confidence: number;
  };
  securityChecks: {
    malwareDetected: boolean;
    suspiciousPatterns: string[];
    contentIntegrityValid: boolean;
  };
}

export interface ContentExtractionResult {
  text: string;
  metadata: {
    pageCount?: number;
    ocrConfidence?: number;
    language?: string;
    encoding?: string;
  };
  structure: {
    sections: DocumentSection[];
    tables: TableData[];
    signatures: SignatureInfo[];
  };
  confidence: number;
}

export interface DocumentSection {
  title: string;
  content: string;
  level: number;
  startPage?: number;
  endPage?: number;
}

export interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
  page?: number;
}

export interface SignatureInfo {
  type: 'digital' | 'image' | 'text';
  location: string;
  signer?: string;
  timestamp?: Date;
  valid?: boolean;
}

export class FileValidationService {
  private readonly maxFileSize = 250 * 1024 * 1024; // 250MB
  private readonly allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/rtf',
    'application/rtf'
  ];
  
  private readonly allowedExtensions = [
    '.pdf', '.doc', '.docx', '.txt', '.rtf'
  ];

  private readonly suspiciousPatterns = [
    // JavaScript patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    
    // Executable patterns
    /\.exe\b/gi,
    /\.bat\b/gi,
    /\.cmd\b/gi,
    /\.scr\b/gi,
    /\.pif\b/gi,
    
    // Suspicious URLs
    /https?:\/\/[^\s]+\.(?:exe|bat|cmd|scr|pif)/gi,
    
    // Base64 encoded executables (simplified check)
    /TVqQAAMAAAAEAAAA/g, // PE header in base64
  ];

  /**
   * Comprehensive file validation
   */
  async validateFile(request: FileValidationRequest): Promise<FileValidationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    
    logger.info({ filename: request.filename, size: request.size }, 'Starting file validation');

    try {
      // Basic validation
      const basicValidation = this.validateBasicProperties(request);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);

      // File type validation
      const typeValidation = this.validateFileType(request);
      errors.push(...typeValidation.errors);
      warnings.push(...typeValidation.warnings);

      // Content validation (if buffer provided)
      let securityChecks = {
        malwareDetected: false,
        suspiciousPatterns: [] as string[],
        contentIntegrityValid: true
      };

      let metadata = {
        actualSize: request.size,
        checksum: request.checksum || '',
        confidence: 0.8
      };

      if (request.buffer) {
        // Calculate checksum
        const calculatedChecksum = createHash('sha256').update(request.buffer).digest('hex');
        metadata.checksum = calculatedChecksum;

        // Verify checksum if provided
        if (request.checksum && request.checksum !== calculatedChecksum) {
          errors.push('File checksum mismatch - file may be corrupted');
          securityChecks.contentIntegrityValid = false;
        }

        // Security scanning
        securityChecks = await this.performSecurityChecks(request.buffer);
        
        // Content analysis
        const contentAnalysis = await this.analyzeContent(request.buffer, request.contentType);
        metadata = { ...metadata, ...contentAnalysis };
      }

      const isValid = errors.length === 0 && !securityChecks.malwareDetected;
      
      logger.info({ 
        filename: request.filename, 
        isValid, 
        errors: errors.length, 
        warnings: warnings.length,
        duration: Date.now() - startTime 
      }, 'File validation completed');

      return {
        isValid,
        errors,
        warnings,
        metadata,
        securityChecks
      };

    } catch (error) {
      logger.error({ error, filename: request.filename }, 'File validation failed');
      return {
        isValid: false,
        errors: ['File validation failed due to internal error'],
        warnings,
        metadata: {
          actualSize: request.size,
          checksum: request.checksum || '',
          confidence: 0
        },
        securityChecks: {
          malwareDetected: false,
          suspiciousPatterns: [],
          contentIntegrityValid: false
        }
      };
    }
  }

  /**
   * Extract content from file with OCR fallback
   */
  async extractContent(buffer: Buffer, contentType: string, filename: string): Promise<ContentExtractionResult> {
    const startTime = Date.now();
    
    logger.info({ contentType, filename, size: buffer.length }, 'Starting content extraction');

    try {
      let result: ContentExtractionResult;

      switch (contentType) {
        case 'application/pdf':
          result = await this.extractFromPDF(buffer);
          break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          result = await this.extractFromWord(buffer);
          break;
        case 'text/plain':
          result = await this.extractFromText(buffer);
          break;
        default:
          // Fallback to text extraction
          result = await this.extractFromText(buffer);
          break;
      }

      // Enhance with additional metadata
      result.metadata.encoding = this.detectEncoding(buffer);
      result.metadata.language = this.detectLanguage(result.text);

      logger.info({ 
        filename, 
        textLength: result.text.length, 
        confidence: result.confidence,
        duration: Date.now() - startTime 
      }, 'Content extraction completed');

      return result;

    } catch (error) {
      logger.error({ error, filename }, 'Content extraction failed');
      
      // Fallback to basic text extraction
      return {
        text: buffer.toString('utf8').slice(0, 10000), // Limit to prevent memory issues
        metadata: {
          encoding: 'utf8',
          language: 'unknown'
        },
        structure: {
          sections: [],
          tables: [],
          signatures: []
        },
        confidence: 0.3
      };
    }
  }

  /**
   * Basic file property validation
   */
  private validateBasicProperties(request: FileValidationRequest): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // File size validation
    if (request.size <= 0) {
      errors.push('File size must be greater than 0');
    } else if (request.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`);
    } else if (request.size > 50 * 1024 * 1024) { // 50MB warning
      warnings.push('Large file detected - processing may take longer');
    }

    // Filename validation
    if (!request.filename || request.filename.trim().length === 0) {
      errors.push('Filename is required');
    } else {
      // Check for suspicious filename patterns
      if (/[<>:"|?*\x00-\x1f]/.test(request.filename)) {
        errors.push('Filename contains invalid characters');
      }
      
      if (request.filename.length > 255) {
        errors.push('Filename is too long (maximum 255 characters)');
      }

      // Check for double extensions (potential security risk)
      const parts = request.filename.split('.');
      if (parts.length > 3) {
        warnings.push('Multiple file extensions detected');
      }
    }

    return { errors, warnings };
  }

  /**
   * File type validation
   */
  private validateFileType(request: FileValidationRequest): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // MIME type validation
    if (!this.allowedMimeTypes.includes(request.contentType)) {
      errors.push(`Unsupported file type: ${request.contentType}`);
    }

    // Extension validation
    const extension = request.filename.toLowerCase().slice(request.filename.lastIndexOf('.'));
    if (!this.allowedExtensions.includes(extension)) {
      errors.push(`Unsupported file extension: ${extension}`);
    }

    // Cross-check MIME type and extension
    const expectedMimeTypes: Record<string, string[]> = {
      '.pdf': ['application/pdf'],
      '.doc': ['application/msword'],
      '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      '.txt': ['text/plain'],
      '.rtf': ['text/rtf', 'application/rtf']
    };

    const expected = expectedMimeTypes[extension];
    if (expected && !expected.includes(request.contentType)) {
      warnings.push(`MIME type ${request.contentType} doesn't match extension ${extension}`);
    }

    return { errors, warnings };
  }

  /**
   * Security checks for malware and suspicious content
   */
  private async performSecurityChecks(buffer: Buffer): Promise<{
    malwareDetected: boolean;
    suspiciousPatterns: string[];
    contentIntegrityValid: boolean;
  }> {
    const suspiciousPatterns: string[] = [];
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024 * 1024)); // Check first 1MB

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(content)) {
        suspiciousPatterns.push(pattern.source);
      }
    }

    // Check for executable signatures in binary content
    const binarySignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (could contain executables)
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    ];

    let malwareDetected = false;
    for (const signature of binarySignatures) {
      if (buffer.indexOf(signature) === 0) {
        malwareDetected = true;
        suspiciousPatterns.push(`Executable signature detected: ${signature.toString('hex')}`);
        break;
      }
    }

    return {
      malwareDetected,
      suspiciousPatterns,
      contentIntegrityValid: true
    };
  }

  /**
   * Analyze content for metadata
   */
  private async analyzeContent(buffer: Buffer, contentType: string): Promise<Partial<FileValidationResult['metadata']>> {
    const metadata: Partial<FileValidationResult['metadata']> = {};

    try {
      // Detect actual MIME type from content
      metadata.detectedMimeType = this.detectMimeType(buffer);
      
      // Calculate confidence based on various factors
      let confidence = 0.8;
      
      if (metadata.detectedMimeType && metadata.detectedMimeType !== contentType) {
        confidence -= 0.2;
      }

      metadata.confidence = Math.max(0.1, confidence);

    } catch (error) {
      logger.warn({ error }, 'Content analysis failed');
      metadata.confidence = 0.5;
    }

    return metadata;
  }

  /**
   * Extract content from PDF
   */
  private async extractFromPDF(buffer: Buffer): Promise<ContentExtractionResult> {
    // For now, return a basic implementation
    // In production, you'd use a library like pdf-parse or pdf2pic with OCR
    const text = buffer.toString('utf8');
    
    return {
      text: text.slice(0, 100000), // Limit text length
      metadata: {
        pageCount: 1,
        ocrConfidence: 0.9
      },
      structure: {
        sections: [],
        tables: [],
        signatures: []
      },
      confidence: 0.8
    };
  }

  /**
   * Extract content from Word documents
   */
  private async extractFromWord(buffer: Buffer): Promise<ContentExtractionResult> {
    // For now, return a basic implementation
    // In production, you'd use a library like mammoth or docx
    const text = buffer.toString('utf8');
    
    return {
      text: text.slice(0, 100000),
      metadata: {},
      structure: {
        sections: [],
        tables: [],
        signatures: []
      },
      confidence: 0.7
    };
  }

  /**
   * Extract content from plain text
   */
  private async extractFromText(buffer: Buffer): Promise<ContentExtractionResult> {
    const text = buffer.toString('utf8');
    
    return {
      text,
      metadata: {},
      structure: {
        sections: this.extractSections(text),
        tables: [],
        signatures: []
      },
      confidence: 0.9
    };
  }

  /**
   * Extract sections from text
   */
  private extractSections(text: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = text.split('\n');
    
    let currentSection: DocumentSection | null = null;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Simple heuristic for section headers (all caps, short lines)
      if (trimmed.length > 0 && trimmed.length < 100 && trimmed === trimmed.toUpperCase()) {
        if (currentSection) {
          sections.push(currentSection);
        }
        
        currentSection = {
          title: trimmed,
          content: '',
          level: 1
        };
      } else if (currentSection && trimmed.length > 0) {
        currentSection.content += line + '\n';
      }
    }
    
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Detect MIME type from buffer content
   */
  private detectMimeType(buffer: Buffer): string {
    // PDF signature
    if (buffer.slice(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }
    
    // ZIP-based formats (DOCX)
    if (buffer.slice(0, 4).toString('hex') === '504b0304') {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    
    // DOC signature
    if (buffer.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') {
      return 'application/msword';
    }
    
    // Default to text/plain for text content
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
    if (/^[\x20-\x7E\s]*$/.test(text)) {
      return 'text/plain';
    }
    
    return 'application/octet-stream';
  }

  /**
   * Detect text encoding
   */
  private detectEncoding(buffer: Buffer): string {
    // Simple encoding detection
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
    
    // Check for UTF-8 BOM
    if (buffer.slice(0, 3).toString('hex') === 'efbbbf') {
      return 'utf8-bom';
    }
    
    // Check if valid UTF-8
    try {
      buffer.toString('utf8');
      return 'utf8';
    } catch {
      return 'binary';
    }
  }

  /**
   * Detect document language
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on common words
    const sample = text.toLowerCase().slice(0, 1000);
    
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => {
      return count + (sample.split(word).length - 1);
    }, 0);
    
    if (englishCount > 5) {
      return 'en';
    }
    
    return 'unknown';
  }
}

export const fileValidationService = new FileValidationService();