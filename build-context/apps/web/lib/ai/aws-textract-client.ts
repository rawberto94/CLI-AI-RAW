/**
 * AWS Textract Client
 * 
 * State-of-the-art document analysis using AWS Textract.
 * Provides superior table extraction (99%+ accuracy) and form field detection.
 * 
 * Features:
 * - Table extraction with cell-level accuracy
 * - Form field (key-value pair) detection
 * - Signature detection
 * - Handwriting recognition
 * - Query-based extraction
 * - Document structure analysis
 * 
 * Data Residency:
 * - EU regions: eu-west-1 (Ireland), eu-central-1 (Frankfurt)
 * - Swiss compliance: Use with Swiss gateway or data anonymization
 */

import { optionalImport } from '@/lib/server/optional-module';

// ============================================================================
// Types
// ============================================================================

export interface TextractConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
}

export interface TextractResult {
  text: string;
  confidence: number;
  tables: TextractTable[];
  forms: TextractFormField[];
  signatures: TextractSignature[];
  handwriting: TextractHandwriting[];
  blocks: TextractBlock[];
  pages: number;
  processingTimeMs: number;
  documentMetadata: DocumentMetadata;
}

export interface TextractTable {
  tableId: string;
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  rows: TextractTableRow[];
  confidence: number;
  boundingBox: BoundingBox;
}

export interface TextractTableRow {
  rowIndex: number;
  cells: TextractTableCell[];
}

export interface TextractTableCell {
  columnIndex: number;
  rowIndex: number;
  text: string;
  confidence: number;
  isHeader: boolean;
  columnSpan: number;
  rowSpan: number;
}

export interface TextractFormField {
  key: string;
  value: string;
  keyConfidence: number;
  valueConfidence: number;
  pageNumber: number;
  boundingBox: BoundingBox;
}

export interface TextractSignature {
  pageNumber: number;
  boundingBox: BoundingBox;
  confidence: number;
  type: 'handwritten' | 'digital' | 'stamp';
}

export interface TextractHandwriting {
  text: string;
  confidence: number;
  pageNumber: number;
  boundingBox: BoundingBox;
}

export interface TextractBlock {
  id: string;
  blockType: 'PAGE' | 'LINE' | 'WORD' | 'TABLE' | 'CELL' | 'KEY_VALUE_SET' | 'SELECTION_ELEMENT' | 'SIGNATURE' | 'QUERY' | 'QUERY_RESULT';
  text?: string;
  confidence: number;
  pageNumber: number;
  boundingBox?: BoundingBox;
  relationships?: BlockRelationship[];
}

export interface BlockRelationship {
  type: 'CHILD' | 'VALUE' | 'COMPLEX_FEATURES' | 'MERGED_CELL' | 'ANSWER';
  ids: string[];
}

export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DocumentMetadata {
  pages: number;
  hasSignatures: boolean;
  hasHandwriting: boolean;
  hasTables: boolean;
  hasForms: boolean;
  documentType?: string;
}

export interface TextractOptions {
  /** Feature types to analyze */
  featureTypes?: ('TABLES' | 'FORMS' | 'SIGNATURES' | 'LAYOUT')[];
  /** Custom queries for targeted extraction */
  queries?: TextractQuery[];
  /** Use async processing for large documents */
  async?: boolean;
  /** S3 output bucket for async results */
  outputBucket?: string;
  /** Notification topic ARN */
  notificationChannel?: string;
}

export interface TextractQuery {
  text: string;
  alias?: string;
  pages?: string; // e.g., "1-3" or "*"
}

// ============================================================================
// AWS Textract Client Class
// ============================================================================

export class AWSTextractClient {
  private config: TextractConfig;
  private textractClient: any;
  private initialized = false;

  constructor(config?: Partial<TextractConfig>) {
    this.config = {
      region: config?.region || process.env.AWS_TEXTRACT_REGION || process.env.AWS_REGION || 'eu-central-1',
      accessKeyId: config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
      endpoint: config?.endpoint || process.env.AWS_TEXTRACT_ENDPOINT,
    };
  }

  /**
   * Initialize AWS SDK client
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const textractModule = await optionalImport<any>('@aws-sdk/client-textract');
      
      if (!textractModule?.TextractClient) {
        throw new Error('AWS SDK Textract client not available. Install @aws-sdk/client-textract');
      }

      const { TextractClient } = textractModule;

      const clientConfig: any = {
        region: this.config.region,
      };

      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        };
      }

      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      this.textractClient = new TextractClient(clientConfig);
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize AWS Textract: ${error}`);
    }
  }

  /**
   * Analyze document with Textract
   */
  async analyzeDocument(
    documentBuffer: Buffer,
    options: TextractOptions = {}
  ): Promise<TextractResult> {
    await this.initialize();
    const startTime = Date.now();

    const textractModule = await optionalImport<any>('@aws-sdk/client-textract');
    const { AnalyzeDocumentCommand } = textractModule;

    // Default to all features for comprehensive analysis
    const featureTypes = options.featureTypes || ['TABLES', 'FORMS', 'SIGNATURES', 'LAYOUT'];

    const params: any = {
      Document: {
        Bytes: documentBuffer,
      },
      FeatureTypes: featureTypes,
    };

    // Add queries if provided
    if (options.queries && options.queries.length > 0) {
      params.QueriesConfig = {
        Queries: options.queries.map(q => ({
          Text: q.text,
          Alias: q.alias,
          Pages: q.pages ? [q.pages] : undefined,
        })),
      };
      if (!params.FeatureTypes.includes('QUERIES')) {
        params.FeatureTypes.push('QUERIES');
      }
    }

    try {
      const command = new AnalyzeDocumentCommand(params);
      const response = await this.textractClient.send(command);

      return this.parseTextractResponse(response, Date.now() - startTime);
    } catch (error: any) {
      if (error.name === 'UnsupportedDocumentException') {
        throw new Error('Document format not supported by Textract. Use PDF or image formats.');
      }
      if (error.name === 'DocumentTooLargeException') {
        throw new Error('Document too large for sync processing. Use async mode for documents > 10MB.');
      }
      throw new Error(`Textract analysis failed: ${error.message}`);
    }
  }

  /**
   * Detect document text (simpler, text-only extraction)
   */
  async detectText(documentBuffer: Buffer): Promise<TextractResult> {
    await this.initialize();
    const startTime = Date.now();

    const textractModule = await optionalImport<any>('@aws-sdk/client-textract');
    const { DetectDocumentTextCommand } = textractModule;

    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: documentBuffer,
      },
    });

    const response = await this.textractClient.send(command);
    return this.parseTextractResponse(response, Date.now() - startTime);
  }

  /**
   * Start async document analysis for large documents
   */
  async startAsyncAnalysis(
    s3Bucket: string,
    s3Key: string,
    options: TextractOptions = {}
  ): Promise<string> {
    await this.initialize();

    const textractModule = await optionalImport<any>('@aws-sdk/client-textract');
    const { StartDocumentAnalysisCommand } = textractModule;

    const featureTypes = options.featureTypes || ['TABLES', 'FORMS', 'SIGNATURES'];

    const params: any = {
      DocumentLocation: {
        S3Object: {
          Bucket: s3Bucket,
          Name: s3Key,
        },
      },
      FeatureTypes: featureTypes,
    };

    if (options.outputBucket) {
      params.OutputConfig = {
        S3Bucket: options.outputBucket,
        S3Prefix: 'textract-output/',
      };
    }

    if (options.notificationChannel) {
      params.NotificationChannel = {
        SNSTopicArn: options.notificationChannel,
        RoleArn: process.env.AWS_TEXTRACT_ROLE_ARN,
      };
    }

    const command = new StartDocumentAnalysisCommand(params);
    const response = await this.textractClient.send(command);

    return response.JobId;
  }

  /**
   * Get async analysis results
   */
  async getAsyncResults(jobId: string): Promise<TextractResult | null> {
    await this.initialize();
    const startTime = Date.now();

    const textractModule = await optionalImport<any>('@aws-sdk/client-textract');
    const { GetDocumentAnalysisCommand } = textractModule;

    const command = new GetDocumentAnalysisCommand({
      JobId: jobId,
    });

    const response = await this.textractClient.send(command);

    if (response.JobStatus === 'IN_PROGRESS') {
      return null;
    }

    if (response.JobStatus === 'FAILED') {
      throw new Error(`Textract job failed: ${response.StatusMessage}`);
    }

    return this.parseTextractResponse(response, Date.now() - startTime);
  }

  /**
   * Parse Textract API response into structured result
   */
  private parseTextractResponse(response: any, processingTimeMs: number): TextractResult {
    const blocks: TextractBlock[] = (response.Blocks || []).map((block: any) => ({
      id: block.Id,
      blockType: block.BlockType,
      text: block.Text,
      confidence: block.Confidence || 0,
      pageNumber: block.Page || 1,
      boundingBox: block.Geometry?.BoundingBox ? {
        left: block.Geometry.BoundingBox.Left,
        top: block.Geometry.BoundingBox.Top,
        width: block.Geometry.BoundingBox.Width,
        height: block.Geometry.BoundingBox.Height,
      } : undefined,
      relationships: block.Relationships?.map((rel: any) => ({
        type: rel.Type,
        ids: rel.Ids || [],
      })),
    }));

    // Extract full text
    const lineBlocks = blocks.filter(b => b.blockType === 'LINE');
    const text = lineBlocks.map(b => b.text).filter(Boolean).join('\n');

    // Extract tables
    const tables = this.extractTables(blocks);

    // Extract form fields (key-value pairs)
    const forms = this.extractFormFields(blocks);

    // Extract signatures
    const signatures = this.extractSignatures(blocks);

    // Extract handwriting
    const handwriting = this.extractHandwriting(blocks);

    // Document metadata
    const documentMetadata: DocumentMetadata = {
      pages: response.DocumentMetadata?.Pages || Math.max(...blocks.map(b => b.pageNumber), 1),
      hasSignatures: signatures.length > 0,
      hasHandwriting: handwriting.length > 0,
      hasTables: tables.length > 0,
      hasForms: forms.length > 0,
    };

    // Calculate overall confidence
    const confidences = blocks.filter(b => b.confidence > 0).map(b => b.confidence);
    const avgConfidence = confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length / 100
      : 0.9;

    return {
      text,
      confidence: avgConfidence,
      tables,
      forms,
      signatures,
      handwriting,
      blocks,
      pages: documentMetadata.pages,
      processingTimeMs,
      documentMetadata,
    };
  }

  /**
   * Extract tables from blocks
   */
  private extractTables(blocks: TextractBlock[]): TextractTable[] {
    const tables: TextractTable[] = [];
    const tableBlocks = blocks.filter(b => b.blockType === 'TABLE');
    const blockMap = new Map(blocks.map(b => [b.id, b]));

    for (const tableBlock of tableBlocks) {
      const cellIds = tableBlock.relationships?.find(r => r.type === 'CHILD')?.ids || [];
      const cells: TextractTableCell[] = [];
      let maxRow = 0;
      let maxCol = 0;

      for (const cellId of cellIds) {
        const cellBlock = blockMap.get(cellId);
        if (cellBlock && cellBlock.blockType === 'CELL') {
          // Get cell text from child words
          const wordIds = cellBlock.relationships?.find(r => r.type === 'CHILD')?.ids || [];
          const cellText = wordIds
            .map(id => blockMap.get(id)?.text)
            .filter(Boolean)
            .join(' ');

          const cell: TextractTableCell = {
            rowIndex: (cellBlock as any).RowIndex || 0,
            columnIndex: (cellBlock as any).ColumnIndex || 0,
            text: cellText,
            confidence: cellBlock.confidence / 100,
            isHeader: (cellBlock as any).EntityTypes?.includes('COLUMN_HEADER') || false,
            columnSpan: (cellBlock as any).ColumnSpan || 1,
            rowSpan: (cellBlock as any).RowSpan || 1,
          };

          cells.push(cell);
          maxRow = Math.max(maxRow, cell.rowIndex);
          maxCol = Math.max(maxCol, cell.columnIndex);
        }
      }

      // Organize cells into rows
      const rowsMap = new Map<number, TextractTableCell[]>();
      for (const cell of cells) {
        if (!rowsMap.has(cell.rowIndex)) {
          rowsMap.set(cell.rowIndex, []);
        }
        rowsMap.get(cell.rowIndex)!.push(cell);
      }

      // Sort cells within each row by column index
      const rows: TextractTableRow[] = Array.from(rowsMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([rowIndex, rowCells]) => ({
          rowIndex,
          cells: rowCells.sort((a, b) => a.columnIndex - b.columnIndex),
        }));

      // Extract headers
      const headerCells = cells.filter(c => c.isHeader);
      const headers = headerCells
        .sort((a, b) => a.columnIndex - b.columnIndex)
        .map(c => c.text);

      tables.push({
        tableId: tableBlock.id,
        pageNumber: tableBlock.pageNumber,
        rowCount: maxRow + 1,
        columnCount: maxCol + 1,
        headers,
        rows,
        confidence: tableBlock.confidence / 100,
        boundingBox: tableBlock.boundingBox || { left: 0, top: 0, width: 0, height: 0 },
      });
    }

    return tables;
  }

  /**
   * Extract form fields (key-value pairs)
   */
  private extractFormFields(blocks: TextractBlock[]): TextractFormField[] {
    const forms: TextractFormField[] = [];
    const blockMap = new Map(blocks.map(b => [b.id, b]));
    const keyValueSets = blocks.filter(b => b.blockType === 'KEY_VALUE_SET');

    for (const kvBlock of keyValueSets) {
      // Check if this is a KEY block
      const entityTypes = (kvBlock as any).EntityTypes || [];
      if (!entityTypes.includes('KEY')) continue;

      // Get key text
      const keyChildIds = kvBlock.relationships?.find(r => r.type === 'CHILD')?.ids || [];
      const keyText = keyChildIds
        .map(id => blockMap.get(id)?.text)
        .filter(Boolean)
        .join(' ');

      // Get value block
      const valueRelation = kvBlock.relationships?.find(r => r.type === 'VALUE');
      if (!valueRelation || valueRelation.ids.length === 0) continue;

      const valueBlock = blockMap.get(valueRelation.ids[0]);
      if (!valueBlock) continue;

      // Get value text
      const valueChildIds = valueBlock.relationships?.find(r => r.type === 'CHILD')?.ids || [];
      const valueText = valueChildIds
        .map(id => blockMap.get(id)?.text)
        .filter(Boolean)
        .join(' ');

      forms.push({
        key: keyText.trim(),
        value: valueText.trim(),
        keyConfidence: kvBlock.confidence / 100,
        valueConfidence: valueBlock.confidence / 100,
        pageNumber: kvBlock.pageNumber,
        boundingBox: kvBlock.boundingBox || { left: 0, top: 0, width: 0, height: 0 },
      });
    }

    return forms;
  }

  /**
   * Extract signatures from blocks
   */
  private extractSignatures(blocks: TextractBlock[]): TextractSignature[] {
    const signatureBlocks = blocks.filter(b => b.blockType === 'SIGNATURE');
    
    return signatureBlocks.map(block => ({
      pageNumber: block.pageNumber,
      boundingBox: block.boundingBox || { left: 0, top: 0, width: 0, height: 0 },
      confidence: block.confidence / 100,
      type: 'handwritten' as const, // Textract doesn't distinguish, default to handwritten
    }));
  }

  /**
   * Extract handwriting from blocks
   */
  private extractHandwriting(blocks: TextractBlock[]): TextractHandwriting[] {
    // Look for blocks with low confidence that might indicate handwriting
    // Textract marks handwritten text with lower confidence typically
    const handwritingCandidates = blocks.filter(b => 
      b.blockType === 'LINE' && 
      b.confidence > 0 && 
      b.confidence < 85 && // Lower confidence might indicate handwriting
      b.text
    );

    return handwritingCandidates.map(block => ({
      text: block.text || '',
      confidence: block.confidence / 100,
      pageNumber: block.pageNumber,
      boundingBox: block.boundingBox || { left: 0, top: 0, width: 0, height: 0 },
    }));
  }

  /**
   * Check if Textract is configured
   */
  static isConfigured(): boolean {
    return !!(
      (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
      process.env.AWS_TEXTRACT_ENDPOINT
    );
  }

  /**
   * Get configured region
   */
  getRegion(): string {
    return this.config.region;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Quick analysis with default settings
 */
export async function analyzeWithTextract(
  documentBuffer: Buffer,
  options?: TextractOptions
): Promise<TextractResult> {
  const client = new AWSTextractClient();
  return client.analyzeDocument(documentBuffer, options);
}

/**
 * Extract tables only
 */
export async function extractTablesWithTextract(
  documentBuffer: Buffer
): Promise<TextractTable[]> {
  const client = new AWSTextractClient();
  const result = await client.analyzeDocument(documentBuffer, {
    featureTypes: ['TABLES'],
  });
  return result.tables;
}

/**
 * Extract form fields only
 */
export async function extractFormsWithTextract(
  documentBuffer: Buffer
): Promise<TextractFormField[]> {
  const client = new AWSTextractClient();
  const result = await client.analyzeDocument(documentBuffer, {
    featureTypes: ['FORMS'],
  });
  return result.forms;
}

/**
 * Query-based extraction
 */
export async function queryTextract(
  documentBuffer: Buffer,
  queries: string[]
): Promise<Map<string, string>> {
  const client = new AWSTextractClient();
  const result = await client.analyzeDocument(documentBuffer, {
    queries: queries.map((q, i) => ({ text: q, alias: `query_${i}` })),
  });

  // Extract query results from blocks
  const queryResults = new Map<string, string>();
  const queryResultBlocks = result.blocks.filter(b => b.blockType === 'QUERY_RESULT');
  
  for (const block of queryResultBlocks) {
    if (block.text) {
      // Match to original query if possible
      const index = queryResultBlocks.indexOf(block);
      if (index < queries.length) {
        queryResults.set(queries[index], block.text);
      }
    }
  }

  return queryResults;
}

// ============================================================================
// Export singleton for convenience
// ============================================================================

let defaultClient: AWSTextractClient | null = null;

export function getTextractClient(): AWSTextractClient {
  if (!defaultClient) {
    defaultClient = new AWSTextractClient();
  }
  return defaultClient;
}
