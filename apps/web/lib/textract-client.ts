/**
 * AWS Textract Client
 * 
 * Enterprise-grade document analysis with industry-leading accuracy:
 * - 99%+ OCR accuracy on printed text
 * - Native table extraction with cell-level precision
 * - Form field detection (key-value pairs)
 * - Signature detection
 * - Layout analysis
 * 
 * Cost: ~$1.50/1000 pages for table analysis
 * Speed: 1-2 seconds per page
 * 
 * @see UPLOAD_OCR_AUDIT_REPORT.md for implementation details
 */

import {
  TextractClient,
  AnalyzeDocumentCommand,
  Block,
  FeatureType,
  Relationship,
  EntityType,
} from '@aws-sdk/client-textract';
import fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

// Types for extracted data
export interface TableData {
  title?: string;
  headers: string[];
  rows: string[][];
  confidence: number;
  pageNumber: number;
  location: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface FormField {
  key: string;
  value: string;
  confidence: number;
  pageNumber: number;
}

export interface SignatureData {
  pageNumber: number;
  confidence: number;
  location: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface TextractResult {
  text: string;
  tables: TableData[];
  forms: FormField[];
  signatures: SignatureData[];
  confidence: number;
  pageCount: number;
}

export interface TextractOptions {
  region?: string;
  extractTables?: boolean;
  extractForms?: boolean;
  extractSignatures?: boolean;
  queries?: string[]; // Specific questions to ask about the document
}

/**
 * Initialize Textract client
 */
function getTextractClient(region: string = 'us-east-1'): TextractClient {
  // Check for AWS credentials
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not found. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.'
    );
  }

  return new TextractClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

/**
 * Extract tables from document using Textract
 */
export async function extractTablesWithTextract(
  filePath: string,
  options: TextractOptions = {}
): Promise<TableData[]> {
  const {
    region = 'us-east-1',
    extractTables = true,
  } = options;

  if (!extractTables) {
    return [];
  }

  // Read document
  const documentBytes = await readFile(filePath);

  // Initialize Textract client
  const textract = getTextractClient(region);

  // Analyze document
  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: documentBytes },
    FeatureTypes: [FeatureType.TABLES],
  });

  const response = await textract.send(command);
  
  if (!response.Blocks) {
    return [];
  }

  // Parse tables
  const tables = extractTablesFromBlocks(response.Blocks);
  
  return tables;
}

/**
 * Extract form fields (key-value pairs) from document
 */
export async function extractFormsWithTextract(
  filePath: string,
  options: TextractOptions = {}
): Promise<FormField[]> {
  const {
    region = 'us-east-1',
    extractForms = true,
  } = options;

  if (!extractForms) {
    return [];
  }

  const documentBytes = await readFile(filePath);
  const textract = getTextractClient(region);

  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: documentBytes },
    FeatureTypes: [FeatureType.FORMS],
  });

  const response = await textract.send(command);
  
  if (!response.Blocks) {
    return [];
  }

  return extractFormFieldsFromBlocks(response.Blocks);
}

/**
 * Comprehensive document analysis with all features
 */
export async function analyzeDocumentWithTextract(
  filePath: string,
  options: TextractOptions = {}
): Promise<TextractResult> {
  const {
    region = 'us-east-1',
    extractTables = true,
    extractForms = true,
    extractSignatures = true,
    queries = [],
  } = options;

  const documentBytes = await readFile(filePath);
  const textract = getTextractClient(region);

  // Build feature types
  const featureTypes: FeatureType[] = [];
  if (extractTables) featureTypes.push(FeatureType.TABLES);
  if (extractForms) featureTypes.push(FeatureType.FORMS);
  if (extractSignatures) featureTypes.push(FeatureType.SIGNATURES);

  // Analyze document
  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: documentBytes },
    FeatureTypes: featureTypes.length > 0 ? featureTypes : [FeatureType.TABLES],
    ...(queries.length > 0 && {
      QueriesConfig: {
        Queries: queries.map(q => ({ Text: q })),
      },
    }),
  });

  const response = await textract.send(command);
  
  if (!response.Blocks) {
    return {
      text: '',
      tables: [],
      forms: [],
      signatures: [],
      confidence: 0,
      pageCount: 0,
    };
  }

  // Extract all data
  const text = extractTextFromBlocks(response.Blocks);
  const tables = extractTablesFromBlocks(response.Blocks);
  const forms = extractFormFieldsFromBlocks(response.Blocks);
  const signatures = extractSignaturesFromBlocks(response.Blocks);
  
  // Calculate average confidence
  const allConfidences = [
    ...tables.map(t => t.confidence),
    ...forms.map(f => f.confidence),
    ...signatures.map(s => s.confidence),
  ];
  const avgConfidence = allConfidences.length > 0
    ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
    : 0;

  // Get page count
  const pageNumbers = new Set(
    response.Blocks.filter(b => b.Page).map(b => b.Page!)
  );

  return {
    text,
    tables,
    forms,
    signatures,
    confidence: avgConfidence,
    pageCount: pageNumbers.size,
  };
}

/**
 * Extract plain text from blocks
 */
function extractTextFromBlocks(blocks: Block[]): string {
  const lines = blocks
    .filter(block => block.BlockType === 'LINE')
    .map(block => block.Text || '')
    .filter(text => text.length > 0);
  
  return lines.join('\n');
}

/**
 * Extract tables from Textract blocks
 */
function extractTablesFromBlocks(blocks: Block[]): TableData[] {
  const tables: TableData[] = [];
  const blockMap = new Map<string, Block>();
  
  // Build block map for quick lookups
  blocks.forEach(block => {
    if (block.Id) {
      blockMap.set(block.Id, block);
    }
  });

  // Find all table blocks
  const tableBlocks = blocks.filter(block => block.BlockType === 'TABLE');

  for (const tableBlock of tableBlocks) {
    if (!tableBlock.Relationships) continue;

    // Get all cells in this table
    const cellRelationship = tableBlock.Relationships.find(
      rel => rel.Type === 'CHILD'
    );
    
    if (!cellRelationship?.Ids) continue;

    const cells = cellRelationship.Ids
      .map(id => blockMap.get(id))
      .filter((block): block is Block => 
        block !== undefined && block.BlockType === 'CELL'
      );

    // Build table structure
    const maxRow = Math.max(...cells.map(c => c.RowIndex || 0));
    const maxCol = Math.max(...cells.map(c => c.ColumnIndex || 0));
    
    const grid: string[][] = Array(maxRow)
      .fill(null)
      .map(() => Array(maxCol).fill(''));

    // Fill grid with cell contents
    for (const cell of cells) {
      const rowIndex = (cell.RowIndex || 1) - 1;
      const colIndex = (cell.ColumnIndex || 1) - 1;
      const text = extractCellText(cell, blockMap);
      
      if (rowIndex >= 0 && colIndex >= 0) {
        grid[rowIndex][colIndex] = text;
      }
    }

    // Separate headers from rows
    const headers = grid[0] || [];
    const rows = grid.slice(1);

    // Get location
    const geometry = tableBlock.Geometry?.BoundingBox;
    const location = geometry ? {
      top: geometry.Top || 0,
      left: geometry.Left || 0,
      width: geometry.Width || 0,
      height: geometry.Height || 0,
    } : { top: 0, left: 0, width: 0, height: 0 };

    tables.push({
      headers,
      rows,
      confidence: tableBlock.Confidence || 0,
      pageNumber: tableBlock.Page || 1,
      location,
    });
  }

  return tables;
}

/**
 * Extract text from a cell block
 */
function extractCellText(cell: Block, blockMap: Map<string, Block>): string {
  if (!cell.Relationships) return '';

  const childRelationship = cell.Relationships.find(rel => rel.Type === 'CHILD');
  if (!childRelationship?.Ids) return '';

  const texts = childRelationship.Ids
    .map(id => blockMap.get(id))
    .filter((block): block is Block => block !== undefined)
    .map(block => block.Text || '')
    .filter(text => text.length > 0);

  return texts.join(' ');
}

/**
 * Extract form fields from blocks
 */
function extractFormFieldsFromBlocks(blocks: Block[]): FormField[] {
  const fields: FormField[] = [];
  const blockMap = new Map<string, Block>();
  
  blocks.forEach(block => {
    if (block.Id) blockMap.set(block.Id, block);
  });

  const keyValueSets = blocks.filter(
    block => block.BlockType === 'KEY_VALUE_SET'
  );

  // Group by key-value pairs
  const keys = keyValueSets.filter(
    block => block.EntityTypes?.includes('KEY' as EntityType)
  );

  for (const keyBlock of keys) {
    // Get key text
    const keyText = extractBlockText(keyBlock, blockMap);
    
    // Find associated value
    const valueRelationship = keyBlock.Relationships?.find(
      rel => rel.Type === 'VALUE'
    );
    
    if (!valueRelationship?.Ids?.[0]) continue;
    
    const valueBlock = blockMap.get(valueRelationship.Ids[0]);
    if (!valueBlock) continue;
    
    const valueText = extractBlockText(valueBlock, blockMap);
    
    fields.push({
      key: keyText,
      value: valueText,
      confidence: Math.min(keyBlock.Confidence || 0, valueBlock.Confidence || 0),
      pageNumber: keyBlock.Page || 1,
    });
  }

  return fields;
}

/**
 * Extract text from a block and its children
 */
function extractBlockText(block: Block, blockMap: Map<string, Block>): string {
  if (!block.Relationships) return block.Text || '';

  const childRelationship = block.Relationships.find(rel => rel.Type === 'CHILD');
  if (!childRelationship?.Ids) return block.Text || '';

  const texts = childRelationship.Ids
    .map(id => blockMap.get(id))
    .filter((b): b is Block => b !== undefined)
    .map(b => b.Text || '')
    .filter(text => text.length > 0);

  return texts.join(' ');
}

/**
 * Extract signatures from blocks
 */
function extractSignaturesFromBlocks(blocks: Block[]): SignatureData[] {
  const signatures: SignatureData[] = [];

  const signatureBlocks = blocks.filter(
    block => block.BlockType === 'SIGNATURE'
  );

  for (const sigBlock of signatureBlocks) {
    const geometry = sigBlock.Geometry?.BoundingBox;
    const location = geometry ? {
      top: geometry.Top || 0,
      left: geometry.Left || 0,
      width: geometry.Width || 0,
      height: geometry.Height || 0,
    } : { top: 0, left: 0, width: 0, height: 0 };

    signatures.push({
      pageNumber: sigBlock.Page || 1,
      confidence: sigBlock.Confidence || 0,
      location,
    });
  }

  return signatures;
}

/**
 * Query-based extraction - ask specific questions about the document
 */
export async function queryDocument(
  filePath: string,
  queries: string[],
  options: TextractOptions = {}
): Promise<Map<string, string>> {
  const { region = 'us-east-1' } = options;

  const documentBytes = await readFile(filePath);
  const textract = getTextractClient(region);

  const command = new AnalyzeDocumentCommand({
    Document: { Bytes: documentBytes },
    FeatureTypes: [FeatureType.QUERIES],
    QueriesConfig: {
      Queries: queries.map(q => ({ Text: q })),
    },
  });

  const response = await textract.send(command);
  
  if (!response.Blocks) {
    return new Map();
  }

  // Extract query results
  const results = new Map<string, string>();
  const queryBlocks = response.Blocks.filter(b => b.BlockType === 'QUERY');
  const answerBlocks = response.Blocks.filter(b => b.BlockType === 'QUERY_RESULT');

  for (const queryBlock of queryBlocks) {
    const query = queryBlock.Query?.Text;
    if (!query) continue;

    // Find the answer
    const answerRelationship = queryBlock.Relationships?.find(
      rel => rel.Type === 'ANSWER'
    );
    
    if (answerRelationship?.Ids?.[0]) {
      const answerBlock = answerBlocks.find(
        b => b.Id === answerRelationship.Ids![0]
      );
      
      if (answerBlock) {
        results.set(query, answerBlock.Text || '');
      }
    }
  }

  return results;
}
