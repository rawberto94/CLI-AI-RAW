/**
 * Excel Parser for rate card imports
 */
import * as XLSX from 'xlsx';

/** Excel cell value types */
export type ExcelCellValue = string | number | boolean | Date | null;

/** Row with Excel values */
export type ExcelRow = Record<string, ExcelCellValue>;

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: ExcelRow[];
  metadata: SheetMetadata;
}

export interface SheetMetadata {
  rowCount: number;
  columnCount: number;
  headerRow: number;
  dataStartRow: number;
  hasEmptyRows: boolean;
  detectedSupplier?: string;
  detectedCurrency?: string;
  detectedDate?: Date;
}

export interface ExcelParseResult {
  sheets: ParsedSheet[];
  metadata: {
    fileName: string;
    fileSize: number;
    sheetCount: number;
    totalRows: number;
  };
}

export class ExcelParser {
  /**
   * Parse Excel file from buffer
   */
  static async parseFile(buffer: ArrayBuffer, fileName: string): Promise<ExcelParseResult> {
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    
    const sheets: ParsedSheet[] = [];
    let totalRows = 0;

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const parsedSheet = this.parseSheet(worksheet, sheetName);
      sheets.push(parsedSheet);
      totalRows += parsedSheet.rows.length;
    }

    return {
      sheets,
      metadata: {
        fileName,
        fileSize: buffer.byteLength,
        sheetCount: sheets.length,
        totalRows,
      },
    };
  }

  /**
   * Parse a single worksheet
   */
  private static parseSheet(worksheet: XLSX.WorkSheet, sheetName: string): ParsedSheet {
    // Detect header row
    const headerRow = this.detectHeaderRow(worksheet);
    
    // Convert to JSON with headers
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const headers = this.extractHeaders(worksheet, headerRow);
    
    // Extract data rows
    const rows: ExcelRow[] = [];
    const dataStartRow = headerRow + 1;
    
    for (let rowNum = dataStartRow; rowNum <= range.e.r; rowNum++) {
      const row: ExcelRow = {};
      let hasData = false;
      
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        const header = headers[colNum - range.s.c];
        
        if (cell && header) {
          row[header] = this.getCellValue(cell);
          hasData = true;
        }
      }
      
      if (hasData) {
        rows.push(row);
      }
    }

    // Extract metadata
    const metadata = this.extractMetadata(worksheet, rows);

    return {
      name: sheetName,
      headers,
      rows,
      metadata: {
        ...metadata,
        headerRow,
        dataStartRow,
        rowCount: rows.length,
        columnCount: headers.length,
        hasEmptyRows: false,
      },
    };
  }

  /**
   * Detect which row contains headers
   */
  private static detectHeaderRow(worksheet: XLSX.WorkSheet): number {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Check first 10 rows for header patterns
    for (let rowNum = 0; rowNum <= Math.min(10, range.e.r); rowNum++) {
      let textCellCount = 0;
      let totalCells = 0;
      
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          totalCells++;
          if (cell.t === 's' || cell.t === 'str') {
            textCellCount++;
          }
        }
      }
      
      // Header row typically has mostly text cells
      if (totalCells > 0 && textCellCount / totalCells > 0.7) {
        return rowNum;
      }
    }
    
    return 0; // Default to first row
  }

  /**
   * Extract headers from a row
   */
  private static extractHeaders(worksheet: XLSX.WorkSheet, headerRow: number): string[] {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const headers: string[] = [];
    
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: colNum });
      const cell = worksheet[cellAddress];
      
      if (cell) {
        const value = this.getCellValue(cell);
        headers.push(String(value).trim());
      } else {
        headers.push(`Column_${colNum + 1}`);
      }
    }
    
    return headers;
  }

  /**
   * Get cell value with proper type conversion
   */
  private static getCellValue(cell: XLSX.CellObject): ExcelCellValue {
    if (!cell) return null;
    
    const cellType = cell.t;
    switch (cellType) {
      case 'n': // Number
        return cell.v as number;
      case 'd': // Date
        return cell.v as Date;
      case 'b': // Boolean
        return cell.v as boolean;
      case 's': // String (shared string)
        return String(cell.v).trim();
      case 'e': // Error
        return null;
      default:
        // Handle 'str' (inline string) and other types
        return cell.v != null ? String(cell.v) : null;
    }
  }

  /**
   * Extract metadata from worksheet
   */
  private static extractMetadata(
    worksheet: XLSX.WorkSheet,
    rows: ExcelRow[]
  ): Partial<SheetMetadata> {
    const metadata: Partial<SheetMetadata> = {
      hasEmptyRows: false,
    };

    // Try to detect supplier name
    metadata.detectedSupplier = this.detectSupplier(worksheet, rows);
    
    // Try to detect currency
    metadata.detectedCurrency = this.detectCurrency(worksheet, rows);
    
    // Try to detect dates
    metadata.detectedDate = this.detectDate(worksheet, rows);

    return metadata;
  }

  /**
   * Detect supplier name from worksheet
   */
  private static detectSupplier(
    worksheet: XLSX.WorkSheet,
    _rows: ExcelRow[]
  ): string | undefined {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Check first few rows for supplier patterns
    const supplierPatterns = [
      /supplier[:\s]+([a-z0-9\s&]+)/i,
      /vendor[:\s]+([a-z0-9\s&]+)/i,
      /company[:\s]+([a-z0-9\s&]+)/i,
    ];
    
    for (let rowNum = 0; rowNum < Math.min(5, range.e.r); rowNum++) {
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.t === 's') {
          const value = String(cell.v);
          
          for (const pattern of supplierPatterns) {
            const match = value.match(pattern);
            if (match) {
              return match[1].trim();
            }
          }
        }
      }
    }
    
    return undefined;
  }

  /**
   * Detect currency from worksheet
   */
  private static detectCurrency(
    worksheet: XLSX.WorkSheet,
    _rows: ExcelRow[]
  ): string | undefined {
    const currencyPatterns = [
      /\b(USD|EUR|GBP|CHF|CAD|AUD|INR)\b/i,
      /currency[:\s]+([A-Z]{3})/i,
    ];
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Check first few rows
    for (let rowNum = 0; rowNum < Math.min(10, range.e.r); rowNum++) {
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        
        if (cell && cell.t === 's') {
          const value = String(cell.v);
          
          for (const pattern of currencyPatterns) {
            const match = value.match(pattern);
            if (match) {
              return match[1].toUpperCase();
            }
          }
        }
      }
    }
    
    return undefined;
  }

  /**
   * Detect date from worksheet
   */
  private static detectDate(
    worksheet: XLSX.WorkSheet,
    _rows: ExcelRow[]
  ): Date | undefined {
    const datePatterns = [
      /effective[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    ];
    
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Check first few rows
    for (let rowNum = 0; rowNum < Math.min(10, range.e.r); rowNum++) {
      for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowNum, c: colNum });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // Check if cell is a date type
          if (cell.t === 'd' && cell.v instanceof Date) {
            return cell.v;
          }
          
          // Check for date patterns in text
          if (cell.t === 's') {
            const value = String(cell.v);
            
            for (const pattern of datePatterns) {
              const match = value.match(pattern);
              if (match) {
                const date = new Date(match[1]);
                if (!isNaN(date.getTime())) {
                  return date;
                }
              }
            }
          }
        }
      }
    }
    
    return undefined;
  }

  /**
   * Get sheet by name or index
   */
  static getSheet(result: ExcelParseResult, nameOrIndex: string | number): ParsedSheet | undefined {
    if (typeof nameOrIndex === 'number') {
      return result.sheets[nameOrIndex];
    }
    return result.sheets.find(s => s.name === nameOrIndex);
  }

  /**
   * Find sheets that likely contain rate data
   */
  static findRateSheets(result: ExcelParseResult): ParsedSheet[] {
    const rateKeywords = ['rate', 'price', 'cost', 'fee', 'charge'];
    
    return result.sheets.filter(sheet => {
      // Check sheet name
      const nameMatch = rateKeywords.some(keyword => 
        sheet.name.toLowerCase().includes(keyword)
      );
      
      // Check headers
      const headerMatch = sheet.headers.some(header =>
        rateKeywords.some(keyword => header.toLowerCase().includes(keyword))
      );
      
      return nameMatch || headerMatch;
    });
  }
}
