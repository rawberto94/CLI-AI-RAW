import { ExcelParser, type ExcelParseResult } from './excel-parser';
import { CSVParser, type CSVParseResult } from './csv-parser';
import { isExcelFile, isCSVFile, isPDFFile } from './file-validation';

export type ParseResult = ExcelParseResult | ReturnType<typeof CSVParser.toExcelFormat>;

export interface ParserOptions {
  detectMetadata?: boolean;
  maxRows?: number;
  sheetIndex?: number;
  sheetName?: string;
}

export class FileParser {
  /**
   * Parse any supported file type
   */
  static async parse(file: File, options: ParserOptions = {}): Promise<ParseResult> {
    if (isExcelFile(file.name)) {
      return this.parseExcel(file, options);
    } else if (isCSVFile(file.name)) {
      return this.parseCSV(file, options);
    } else if (isPDFFile(file.name)) {
      throw new Error('PDF parsing not yet implemented. Use OCR service.');
    } else {
      throw new Error(`Unsupported file type: ${file.name}`);
    }
  }

  /**
   * Parse Excel file
   */
  private static async parseExcel(file: File, options: ParserOptions): Promise<ExcelParseResult> {
    const buffer = await file.arrayBuffer();
    const result = await ExcelParser.parseFile(buffer, file.name);
    
    // Apply row limit if specified
    if (options.maxRows) {
      result.sheets = result.sheets.map(sheet => ({
        ...sheet,
        rows: sheet.rows.slice(0, options.maxRows),
      }));
    }
    
    return result;
  }

  /**
   * Parse CSV file
   */
  private static async parseCSV(file: File, options: ParserOptions): Promise<ReturnType<typeof CSVParser.toExcelFormat>> {
    const csvResult = await CSVParser.parseFromFile(file);
    
    // Apply row limit if specified
    if (options.maxRows) {
      csvResult.rows = csvResult.rows.slice(0, options.maxRows);
    }
    
    // Convert to Excel-like format for consistency
    return CSVParser.toExcelFormat(csvResult);
  }

  /**
   * Get preview of file (first N rows)
   */
  static async preview(file: File, rowCount: number = 10): Promise<ParseResult> {
    return this.parse(file, { maxRows: rowCount });
  }

  /**
   * Extract just headers from file
   */
  static async extractHeaders(file: File): Promise<string[]> {
    const result = await this.parse(file, { maxRows: 1 });
    
    if (result.sheets.length > 0) {
      return result.sheets[0].headers;
    }
    
    return [];
  }

  /**
   * Count rows in file without parsing all data
   */
  static async countRows(file: File): Promise<number> {
    if (isCSVFile(file.name)) {
      const content = await file.text();
      return content.split('\n').length - 1; // Subtract header
    } else if (isExcelFile(file.name)) {
      const result = await this.parse(file);
      return result.metadata.totalRows;
    }
    
    return 0;
  }

  /**
   * Validate file can be parsed
   */
  static async validate(file: File): Promise<{ valid: boolean; errors: string[] }> {
    try {
      const result = await this.parse(file, { maxRows: 10 });
      
      const errors: string[] = [];
      
      if (result.sheets.length === 0) {
        errors.push('No sheets found in file');
      }
      
      for (const sheet of result.sheets) {
        if (sheet.headers.length === 0) {
          errors.push(`Sheet "${sheet.name}" has no headers`);
        }
        
        if (sheet.rows.length === 0) {
          errors.push(`Sheet "${sheet.name}" has no data rows`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Failed to parse file'],
      };
    }
  }
}
