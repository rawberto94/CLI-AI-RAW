/**
 * Unit tests for File Validation Service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fileValidationService, FileValidationRequest } from '../file-validation.service';
import { createHash } from 'crypto';

describe('FileValidationService', () => {
  let validRequest: FileValidationRequest;
  
  beforeEach(() => {
    validRequest = {
      filename: 'test-contract.pdf',
      contentType: 'application/pdf',
      size: 1024 * 1024, // 1MB
    };
  });

  describe('validateFile', () => {
    it('should validate a valid PDF file', async () => {
      const result = await fileValidationService.validateFile(validRequest);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.confidence).toBeGreaterThan(0.5);
    });

    it('should reject files that are too large', async () => {
      const largeFileRequest = {
        ...validRequest,
        size: 300 * 1024 * 1024 // 300MB
      };
      
      const result = await fileValidationService.validateFile(largeFileRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum limit of 250MB');
    });

    it('should reject unsupported file types', async () => {
      const unsupportedRequest = {
        ...validRequest,
        filename: 'test.exe',
        contentType: 'application/x-executable'
      };
      
      const result = await fileValidationService.validateFile(unsupportedRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Unsupported file type'))).toBe(true);
    });

    it('should reject files with invalid characters in filename', async () => {
      const invalidFilenameRequest = {
        ...validRequest,
        filename: 'test<>contract.pdf'
      };
      
      const result = await fileValidationService.validateFile(invalidFilenameRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename contains invalid characters');
    });

    it('should warn about large files', async () => {
      const largeFileRequest = {
        ...validRequest,
        size: 60 * 1024 * 1024 // 60MB
      };
      
      const result = await fileValidationService.validateFile(largeFileRequest);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Large file detected - processing may take longer');
    });

    it('should validate checksum when provided', async () => {
      const testBuffer = Buffer.from('test content');
      const correctChecksum = createHash('sha256').update(testBuffer).digest('hex');
      
      const requestWithChecksum = {
        ...validRequest,
        buffer: testBuffer,
        checksum: correctChecksum
      };
      
      const result = await fileValidationService.validateFile(requestWithChecksum);
      
      expect(result.isValid).toBe(true);
      expect(result.securityChecks.contentIntegrityValid).toBe(true);
    });

    it('should detect checksum mismatch', async () => {
      const testBuffer = Buffer.from('test content');
      const wrongChecksum = 'wrong_checksum';
      
      const requestWithWrongChecksum = {
        ...validRequest,
        buffer: testBuffer,
        checksum: wrongChecksum
      };
      
      const result = await fileValidationService.validateFile(requestWithWrongChecksum);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File checksum mismatch - file may be corrupted');
      expect(result.securityChecks.contentIntegrityValid).toBe(false);
    });

    it('should detect suspicious patterns in content', async () => {
      const maliciousBuffer = Buffer.from('<script>alert("xss")</script>');
      
      const maliciousRequest = {
        ...validRequest,
        buffer: maliciousBuffer
      };
      
      const result = await fileValidationService.validateFile(maliciousRequest);
      
      expect(result.securityChecks.suspiciousPatterns.length).toBeGreaterThan(0);
    });

    it('should handle empty filename', async () => {
      const emptyFilenameRequest = {
        ...validRequest,
        filename: ''
      };
      
      const result = await fileValidationService.validateFile(emptyFilenameRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Filename is required');
    });

    it('should handle zero file size', async () => {
      const zeroSizeRequest = {
        ...validRequest,
        size: 0
      };
      
      const result = await fileValidationService.validateFile(zeroSizeRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size must be greater than 0');
    });
  });

  describe('extractContent', () => {
    it('should extract content from text buffer', async () => {
      const textContent = 'This is a test contract document.';
      const textBuffer = Buffer.from(textContent);
      
      const result = await fileValidationService.extractContent(
        textBuffer, 
        'text/plain', 
        'test.txt'
      );
      
      expect(result.text).toBe(textContent);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.metadata.encoding).toBeDefined();
    });

    it('should handle extraction errors gracefully', async () => {
      const corruptBuffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00]); // Invalid content
      
      const result = await fileValidationService.extractContent(
        corruptBuffer, 
        'application/pdf', 
        'corrupt.pdf'
      );
      
      expect(result.text).toBeDefined();
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should detect document sections in text', async () => {
      const textWithSections = `
INTRODUCTION
This is the introduction section.

TERMS AND CONDITIONS
These are the terms and conditions.

CONCLUSION
This is the conclusion.
      `;
      
      const textBuffer = Buffer.from(textWithSections);
      
      const result = await fileValidationService.extractContent(
        textBuffer, 
        'text/plain', 
        'contract.txt'
      );
      
      expect(result.structure.sections.length).toBeGreaterThan(0);
      expect(result.structure.sections[0].title).toBe('INTRODUCTION');
    });
  });

  describe('supported file types', () => {
    const supportedTypes = [
      { filename: 'test.pdf', contentType: 'application/pdf' },
      { filename: 'test.doc', contentType: 'application/msword' },
      { filename: 'test.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      { filename: 'test.txt', contentType: 'text/plain' },
      { filename: 'test.rtf', contentType: 'text/rtf' }
    ];

    supportedTypes.forEach(({ filename, contentType }) => {
      it(`should accept ${filename} with ${contentType}`, async () => {
        const request = {
          ...validRequest,
          filename,
          contentType
        };
        
        const result = await fileValidationService.validateFile(request);
        
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('security checks', () => {
    it('should detect executable signatures', async () => {
      // PE executable signature
      const executableBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00]);
      
      const executableRequest = {
        ...validRequest,
        buffer: executableBuffer
      };
      
      const result = await fileValidationService.validateFile(executableRequest);
      
      expect(result.securityChecks.malwareDetected).toBe(true);
      expect(result.isValid).toBe(false);
    });

    it('should detect suspicious JavaScript patterns', async () => {
      const jsBuffer = Buffer.from('javascript:alert("malicious")');
      
      const jsRequest = {
        ...validRequest,
        buffer: jsBuffer
      };
      
      const result = await fileValidationService.validateFile(jsRequest);
      
      expect(result.securityChecks.suspiciousPatterns.length).toBeGreaterThan(0);
    });
  });
});