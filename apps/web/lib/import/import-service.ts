/**
 * End-to-end import service orchestrating the full pipeline
 */

import { FileParser } from './file-parser';
import { FuzzyMatcher } from './fuzzy-matcher';
import { AIMapper } from './ai-mapper';
import { DataValidator } from './data-validator';
import { DataTransformer } from './data-transformer';
import type { ParseResult } from './file-parser';
import type { MatchResult } from './fuzzy-matcher';
import type { ValidationResult } from './data-validator';
import type { TransformedRate } from './data-transformer';

export interface ImportOptions {
  useAI?: boolean;
  aiApiKey?: string;
  baseCurrency?: string;
  autoApprove?: boolean;
  sheetIndex?: number;
}

export interface ImportProgress {
  stage: 'parsing' | 'mapping' | 'validating' | 'transforming' | 'saving' | 'complete';
  progress: number; // 0-100
  message: string;
  currentStep?: string;
}

export interface ImportResult {
  success: boolean;
  jobId?: string;
  parseResult?: ParseResult;
  mappings?: MatchResult[];
  validationResult?: ValidationResult;
  transformedData?: TransformedRate[];
  errors?: string[];
  warnings?: string[];
}

export class ImportService {
  /**
   * Process a complete import from file to database
   */
  static async processImport(
    file: File,
    options: ImportOptions = {},
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Stage 1: Parse file
      onProgress?.({
        stage: 'parsing',
        progress: 10,
        message: 'Parsing file...',
        currentStep: 'Reading file content',
      });

      const parseResult = await FileParser.parse(file, {
        sheetIndex: options.sheetIndex,
      });

      if (parseResult.sheets.length === 0) {
        throw new Error('No sheets found in file');
      }

      const sheet = parseResult.sheets[0];
      if (!sheet || sheet.rows.length === 0) {
        throw new Error('No data rows found');
      }

      onProgress?.({
        stage: 'parsing',
        progress: 20,
        message: `Parsed ${sheet.rows.length} rows`,
      });

      // Stage 2: Column mapping
      onProgress?.({
        stage: 'mapping',
        progress: 30,
        message: 'Mapping columns...',
        currentStep: 'Analyzing headers',
      });

      let mappings: MatchResult[];

      if (options.useAI && options.aiApiKey) {
        mappings = await AIMapper.suggestMappings(
          sheet.headers,
          sheet.rows.slice(0, 5),
          {
            useAI: true,
            apiKey: options.aiApiKey,
          }
        );
      } else {
        mappings = FuzzyMatcher.matchColumns(sheet.headers);
      }

      // Check for missing required fields
      const missingFields = FuzzyMatcher.getMissingRequiredFields(mappings);
      if (missingFields.length > 0) {
        errors.push(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Check for low confidence mappings
      const lowConfidence = mappings.filter(m => m.confidence < 0.7);
      if (lowConfidence.length > 0) {
        warnings.push(
          `Low confidence mappings: ${lowConfidence.map(m => m.sourceColumn).join(', ')}`
        );
      }

      onProgress?.({
        stage: 'mapping',
        progress: 40,
        message: `Mapped ${mappings.length} columns`,
      });

      // Stage 3: Validation
      onProgress?.({
        stage: 'validating',
        progress: 50,
        message: 'Validating data...',
        currentStep: 'Checking data quality',
      });

      const mappingDict = mappings.reduce((acc, m) => {
        acc[m.sourceColumn] = m.targetField;
        return acc;
      }, {} as Record<string, string>);

      const validationResult = DataValidator.validate(sheet.rows, mappingDict);

      if (!validationResult.valid && !options.autoApprove) {
        errors.push(`Validation failed with ${validationResult.summary.errorCount} errors`);
      }

      if (validationResult.summary.warningCount > 0) {
        warnings.push(`${validationResult.summary.warningCount} validation warnings`);
      }

      onProgress?.({
        stage: 'validating',
        progress: 60,
        message: `Validated ${validationResult.summary.validRows}/${validationResult.summary.totalRows} rows`,
      });

      // Stage 4: Transformation
      onProgress?.({
        stage: 'transforming',
        progress: 70,
        message: 'Transforming data...',
        currentStep: 'Normalizing rates',
      });

      const transformedData = DataTransformer.transform(sheet.rows, mappingDict, {
        baseCurrency: options.baseCurrency || 'CHF',
      });

      const transformSummary = DataTransformer.getSummary(transformedData);

      onProgress?.({
        stage: 'transforming',
        progress: 80,
        message: `Transformed ${transformedData.length} rows (avg confidence: ${transformSummary.avgConfidence})`,
      });

      // Stage 5: Save to database (placeholder)
      onProgress?.({
        stage: 'saving',
        progress: 90,
        message: 'Saving to database...',
        currentStep: 'Creating import job',
      });

      // TODO: Save to database using repositories
      const jobId = `job-${Date.now()}`;

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Import complete!',
      });

      return {
        success: errors.length === 0,
        jobId,
        parseResult,
        mappings,
        validationResult,
        transformedData,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Preview import without saving
   */
  static async previewImport(
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    return this.processImport(file, { ...options, autoApprove: false });
  }

  /**
   * Get sample data for preview
   */
  static async getSampleData(file: File, rowCount: number = 10): Promise<{
    headers: string[];
    rows: Record<string, any>[];
  }> {
    const result = await FileParser.preview(file, rowCount);
    const sheet = result.sheets[0];
    if (!sheet) {
      return { headers: [], rows: [] };
    }

    return {
      headers: sheet.headers,
      rows: sheet.rows,
    };
  }

  /**
   * Validate file before import
   */
  static async validateFile(file: File): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    info: {
      rowCount: number;
      columnCount: number;
      fileSize: number;
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const result = await FileParser.validate(file);

      if (!result.valid) {
        errors.push(...result.errors);
      }

      const preview = await FileParser.preview(file, 1);
      const sheet = preview.sheets[0];

      if (!sheet) {
        errors.push('No sheets found in file');
        return {
          valid: false,
          errors,
          warnings,
          info: {
            rowCount: 0,
            columnCount: 0,
            fileSize: file.size,
          },
        };
      }

      // Check row count
      if (sheet.rows.length === 0) {
        errors.push('File contains no data rows');
      } else if (sheet.rows.length > 10000) {
        warnings.push('File contains more than 10,000 rows - processing may be slow');
      }

      // Check column count
      if (sheet.headers.length < 2) {
        errors.push('File must have at least 2 columns');
      } else if (sheet.headers.length > 50) {
        warnings.push('File has many columns - some may not be mapped');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        info: {
          rowCount: sheet.rows.length,
          columnCount: sheet.headers.length,
          fileSize: file.size,
        },
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Failed to validate file');

      return {
        valid: false,
        errors,
        warnings,
        info: {
          rowCount: 0,
          columnCount: 0,
          fileSize: file.size,
        },
      };
    }
  }
}
