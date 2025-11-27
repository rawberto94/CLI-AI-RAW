/**
 * CSV Parser for rate card imports
 */

/** Parsed cell value types */
export type ParsedCellValue = string | number | boolean | Date | null;

/** Row with parsed values */
export type ParsedRow = Record<string, ParsedCellValue>;

export interface CSVParseResult {
  headers: string[];
  rows: ParsedRow[];
  metadata: {
    fileName: string;
    fileSize: number;
    rowCount: number;
    columnCount: number;
    delimiter: string;
    encoding: string;
    hasHeader: boolean;
  };
}

export class CSVParser {
  /**
   * Parse CSV file from text content
   */
  static async parseFile(content: string, fileName: string, fileSize: number): Promise<CSVParseResult> {
    // Detect delimiter
    const delimiter = this.detectDelimiter(content);
    
    // Detect encoding (simplified - assumes UTF-8)
    const encoding = 'UTF-8';
    
    // Parse CSV
    const lines = this.splitLines(content);
    const hasHeader = this.detectHeader(lines, delimiter);
    
    let headers: string[];
    let dataLines: string[];
    
    if (hasHeader && lines.length > 0) {
      const firstLine = lines[0];
      headers = firstLine ? this.parseLine(firstLine, delimiter) : [];
      dataLines = lines.slice(1);
    } else {
      // Generate column names
      const firstLine = lines[0] ? this.parseLine(lines[0], delimiter) : [];
      headers = firstLine.map((_, i) => `Column_${i + 1}`);
      dataLines = lines;
    }
    
    // Parse data rows
    const rows: ParsedRow[] = [];
    
    for (const line of dataLines) {
      if (!line || line.trim() === '') continue;
      
      const values = this.parseLine(line, delimiter);
      const row: ParsedRow = {};
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        if (header) {
          row[header] = this.parseValue(value ?? '');
        }
      }
      
      rows.push(row);
    }
    
    return {
      headers,
      rows,
      metadata: {
        fileName,
        fileSize,
        rowCount: rows.length,
        columnCount: headers.length,
        delimiter,
        encoding,
        hasHeader,
      },
    };
  }

  /**
   * Parse CSV from File object
   */
  static async parseFromFile(file: File): Promise<CSVParseResult> {
    const content = await file.text();
    return this.parseFile(content, file.name, file.size);
  }

  /**
   * Detect delimiter (comma, semicolon, tab, pipe)
   */
  private static detectDelimiter(content: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const sampleLines = content.split('\n').slice(0, 5);
    
    const counts = delimiters.map(delimiter => {
      const lineCounts = sampleLines.map(line => 
        (line.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
      );
      
      // Check consistency across lines
      const avgCount = lineCounts.reduce((a, b) => a + b, 0) / lineCounts.length;
      const variance = lineCounts.reduce((sum, count) => 
        sum + Math.pow(count - avgCount, 2), 0
      ) / lineCounts.length;
      
      return {
        delimiter,
        avgCount,
        variance,
      };
    });
    
    // Choose delimiter with highest average count and lowest variance
    counts.sort((a, b) => {
      if (a.avgCount === 0) return 1;
      if (b.avgCount === 0) return -1;
      return (a.variance / a.avgCount) - (b.variance / b.avgCount);
    });
    
    return counts[0]?.delimiter ?? ',';
  }

  /**
   * Detect if first line is a header
   */
  private static detectHeader(lines: string[], delimiter: string): boolean {
    if (lines.length < 2) return true;
    
    const line0 = lines[0];
    const line1 = lines[1];
    if (!line0 || !line1) return true;
    
    const firstLine = this.parseLine(line0, delimiter);
    const secondLine = this.parseLine(line1, delimiter);
    
    // Check if first line has mostly text and second line has numbers
    const firstLineTextCount = firstLine.filter(v => isNaN(Number(v))).length;
    const secondLineNumberCount = secondLine.filter(v => !isNaN(Number(v))).length;
    
    return firstLineTextCount > firstLine.length / 2 && 
           secondLineNumberCount > secondLine.length / 2;
  }

  /**
   * Split content into lines, handling different line endings
   */
  private static splitLines(content: string): string[] {
    return content.split(/\r?\n/);
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private static parseLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    values.push(current.trim());
    
    return values;
  }

  /**
   * Parse value to appropriate type
   */
  private static parseValue(value: string): ParsedCellValue {
    if (value === '' || value === null || value === undefined) {
      return null;
    }
    
    // Remove quotes
    value = value.replace(/^["']|["']$/g, '');
    
    // Try to parse as number
    if (!isNaN(Number(value)) && value.trim() !== '') {
      return Number(value);
    }
    
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Try to parse as date
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{1,2}-\d{1,2}-\d{2,4}$/,
    ];
    
    for (const pattern of datePatterns) {
      if (pattern.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    return value;
  }

  /**
   * Convert CSV result to Excel-like format for consistency
   */
  static toExcelFormat(result: CSVParseResult): {
    sheets: Array<{
      name: string;
      headers: string[];
      rows: ParsedRow[];
      metadata: {
        rowCount: number;
        columnCount: number;
        headerRow: number;
        dataStartRow: number;
        hasEmptyRows: boolean;
      };
    }>;
    metadata: {
      fileName: string;
      fileSize: number;
      sheetCount: number;
      totalRows: number;
    };
  } {
    return {
      sheets: [{
        name: 'Sheet1',
        headers: result.headers,
        rows: result.rows,
        metadata: {
          rowCount: result.metadata.rowCount,
          columnCount: result.metadata.columnCount,
          headerRow: 0,
          dataStartRow: 1,
          hasEmptyRows: false,
        },
      }],
      metadata: {
        fileName: result.metadata.fileName,
        fileSize: result.metadata.fileSize,
        sheetCount: 1,
        totalRows: result.metadata.rowCount,
      },
    };
  }

  /**
   * Validate CSV structure
   */
  static validate(result: CSVParseResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (result.headers.length === 0) {
      errors.push('No headers found');
    }
    
    if (result.rows.length === 0) {
      errors.push('No data rows found');
    }
    
    // Check for inconsistent column counts
    const columnCounts = result.rows.map(row => Object.keys(row).length);
    const uniqueCounts = [...new Set(columnCounts)];
    
    if (uniqueCounts.length > 1) {
      errors.push(`Inconsistent column counts: ${uniqueCounts.join(', ')}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export to CSV format
   */
  static export(headers: string[], rows: ParsedRow[], delimiter: string = ','): string {
    const lines: string[] = [];
    
    // Add header
    lines.push(headers.map(h => this.escapeField(h, delimiter)).join(delimiter));
    
    // Add data rows
    for (const row of rows) {
      const values = headers.map(header => {
        const value = row[header];
        return this.escapeField(String(value ?? ''), delimiter);
      });
      lines.push(values.join(delimiter));
    }
    
    return lines.join('\n');
  }

  /**
   * Escape field for CSV export
   */
  private static escapeField(value: string, delimiter: string): string {
    // If field contains delimiter, quotes, or newlines, wrap in quotes
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      // Escape quotes by doubling them
      value = value.replace(/"/g, '""');
      return `"${value}"`;
    }
    return value;
  }
}
