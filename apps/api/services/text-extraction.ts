/**
 * Comprehensive Text Extraction Service
 * Handles PDF, DOC, DOCX, and other document formats
 */

// Optional imports for document processing
let pdfParse: any = null;
let mammoth: any = null;
let tesseract: any = null;
let sharp: any = null;

// Try to import optional dependencies
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not available');
}

try {
  mammoth = require('mammoth');
} catch (e) {
  console.warn('mammoth not available');
}

try {
  tesseract = require('tesseract.js');
} catch (e) {
  console.warn('tesseract.js not available');
}

try {
  sharp = require('sharp');
} catch (e) {
  console.warn('sharp not available');
}
import fs from 'fs/promises';
import path from 'path';

export interface ExtractionResult {
  text: string;
  metadata: {
    pages?: number;
    wordCount: number;
    language?: string;
    extractionMethod: 'direct' | 'ocr' | 'hybrid';
    confidence?: number;
  };
  errors?: string[];
  warnings?: string[];
}

export interface ExtractionOptions {
  enableOCR?: boolean;
  ocrLanguage?: string;
  cleanText?: boolean;
  preserveFormatting?: boolean;
  maxPages?: number;
}

export class TextExtractionService {
  private ocrWorker: unknown = null;

  constructor() {
    this.initializeOCR();
  }

  private async initializeOCR() {
    try {
      if (tesseract) {
        this.ocrWorker = await tesseract.createWorker('eng');
      }
    } catch (error) {
      console.warn('OCR initialization failed:', error);
    }
  }

  /**
   * Extract text from various file formats
   */
  async extractText(
    filePath: string,
    mimeType: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const defaultOptions: ExtractionOptions = {
      enableOCR: true,
      ocrLanguage: 'eng',
      cleanText: true,
      preserveFormatting: false,
      maxPages: 100,
      ...options
    };

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(filePath, defaultOptions);
        
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.extractFromWord(filePath, defaultOptions);
        
        case 'text/plain':
          return await this.extractFromText(filePath, defaultOptions);
        
        case 'image/jpeg':
        case 'image/png':
        case 'image/tiff':
          return await this.extractFromImage(filePath, defaultOptions);
        
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }
    } catch (error) {
      return {
        text: '',
        metadata: {
          wordCount: 0,
          extractionMethod: 'direct'
        },
        errors: [`Extraction failed: ${error.message}`]
      };
    }
  }

  /**
   * Extract text from PDF files
   */
  private async extractFromPDF(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (!pdfParse) {
      throw new Error('PDF parsing not available - pdf-parse dependency missing');
    }
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(fileBuffer);

      let extractedText = pdfData.text;
      const metadata: {
        pages?: number;
        wordCount: number;
        extractionMethod: 'direct' | 'ocr' | 'hybrid';
        confidence?: number;
      } = {
        pages: pdfData.numpages,
        wordCount: 0,
        extractionMethod: 'direct'
      };

      // If direct extraction yields poor results, try OCR
      if (extractedText.trim().length < 100 && options.enableOCR) {
        const ocrResult = await this.extractPDFWithOCR(filePath, options);
        if (ocrResult.text.length > extractedText.length) {
          extractedText = ocrResult.text;
          metadata.extractionMethod = 'ocr';
          metadata.confidence = ocrResult.metadata.confidence;
        }
      }

      if (options.cleanText) {
        extractedText = this.cleanExtractedText(extractedText);
      }

      metadata.wordCount = this.countWords(extractedText);

      return {
        text: extractedText,
        metadata,
        warnings: extractedText.length < 50 ? ['Low text extraction yield'] : undefined
      };

    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from Word documents
   */
  private async extractFromWord(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (!mammoth) {
      throw new Error('Word document parsing not available - mammoth dependency missing');
    }
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: fileBuffer });

      let extractedText = result.value;

      if (options.cleanText) {
        extractedText = this.cleanExtractedText(extractedText);
      }

      return {
        text: extractedText,
        metadata: {
          wordCount: this.countWords(extractedText),
          extractionMethod: 'direct'
        },
        warnings: result.messages.length > 0 ? result.messages.map(m => m.message) : undefined
      };

    } catch (error) {
      throw new Error(`Word document extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from plain text files
   */
  private async extractFromText(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    try {
      let text = await fs.readFile(filePath, 'utf-8');

      if (options.cleanText) {
        text = this.cleanExtractedText(text);
      }

      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
          extractionMethod: 'direct'
        }
      };

    } catch (error) {
      throw new Error(`Text file extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from images using OCR
   */
  private async extractFromImage(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (!options.enableOCR || !this.ocrWorker) {
      throw new Error('OCR is required for image text extraction but not available');
    }

    try {
      // Preprocess image for better OCR results
      const processedImagePath = await this.preprocessImage(filePath);
      
      const { data: { text, confidence } } = await this.ocrWorker.recognize(processedImagePath);

      let extractedText = text;
      if (options.cleanText) {
        extractedText = this.cleanExtractedText(extractedText);
      }

      // Clean up processed image
      if (processedImagePath !== filePath) {
        await fs.unlink(processedImagePath).catch(() => {});
      }

      return {
        text: extractedText,
        metadata: {
          wordCount: this.countWords(extractedText),
          extractionMethod: 'ocr',
          confidence: confidence
        },
        warnings: confidence < 70 ? ['Low OCR confidence'] : undefined
      };

    } catch (error) {
      throw new Error(`Image OCR extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract PDF using OCR (for scanned documents)
   */
  private async extractPDFWithOCR(
    filePath: string,
    options: ExtractionOptions
  ): Promise<ExtractionResult> {
    if (!this.ocrWorker) {
      throw new Error('OCR worker not available');
    }

    try {
      // Convert PDF pages to images and run OCR
      // This is a simplified implementation - in production, you'd use pdf2pic or similar
      const { data: { text, confidence } } = await this.ocrWorker.recognize(filePath);

      return {
        text: options.cleanText ? this.cleanExtractedText(text) : text,
        metadata: {
          wordCount: this.countWords(text),
          extractionMethod: 'ocr',
          confidence: confidence
        }
      };

    } catch (error) {
      throw new Error(`PDF OCR extraction failed: ${error.message}`);
    }
  }

  /**
   * Preprocess image for better OCR results
   */
  private async preprocessImage(imagePath: string): Promise<string> {
    try {
      const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');
      
      await sharp(imagePath)
        .greyscale()
        .normalize()
        .sharpen()
        .png()
        .toFile(outputPath);

      return outputPath;
    } catch (error) {
      console.warn('Image preprocessing failed, using original:', error);
      return imagePath;
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Detect language of extracted text
   */
  private async detectLanguage(text: string): Promise<string> {
    // Simplified language detection - in production, use a proper library
    const sample = text.substring(0, 1000).toLowerCase();
    
    // Basic English detection
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const englishCount = englishWords.reduce((count, word) => 
      count + (sample.split(word).length - 1), 0);
    
    if (englishCount > 10) {
      return 'en';
    }
    
    return 'unknown';
  }

  /**
   * Validate extraction quality
   */
  private validateExtraction(result: ExtractionResult): ExtractionResult {
    const warnings: string[] = result.warnings || [];

    // Check for minimum text length
    if (result.text.length < 50) {
      warnings.push('Very short text extracted - document may be empty or corrupted');
    }

    // Check for OCR confidence
    if (result.metadata.extractionMethod === 'ocr' && 
        result.metadata.confidence && 
        result.metadata.confidence < 60) {
      warnings.push('Low OCR confidence - text may contain errors');
    }

    // Check for excessive special characters (may indicate extraction issues)
    const specialCharRatio = (result.text.match(/[^\w\s]/g) || []).length / result.text.length;
    if (specialCharRatio > 0.3) {
      warnings.push('High ratio of special characters - extraction may be corrupted');
    }

    return {
      ...result,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.ocrWorker) {
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }
}

// Export singleton instance
export const textExtractionService = new TextExtractionService();