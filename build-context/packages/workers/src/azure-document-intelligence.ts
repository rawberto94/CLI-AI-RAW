/**
 * Azure Document Intelligence v4.0 Integration
 *
 * Provides structured document extraction using Azure's prebuilt and custom models:
 * - prebuilt-layout:  Text + tables + key-value pairs + document structure
 * - prebuilt-contract: Party names, agreement details, dates, jurisdiction
 * - prebuilt-invoice:  Vendor, line items, totals, payment terms
 * - prebuilt-read:     Pure OCR text extraction (lightweight)
 *
 * API Version: 2024-11-30 (GA v4.0)
 * Data residency: Configurable — Switzerland North, West Europe, etc.
 *
 * Environment variables:
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT  — e.g. https://di-contracts-ch.cognitiveservices.azure.com
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY       — subscription key
 */

import pino from 'pino';
import { startSpan, endSpan, setSpanAttributes, addSpanEvent } from './observability/opentelemetry';
import { RateLimiter } from './resilience/backpressure';

const logger = pino({ name: 'azure-document-intelligence' });

// ============================================================================
// DI-Specific Rate Limiter (Azure S0 tier = 15 TPS)
// ============================================================================

const diRateLimiter = new RateLimiter({
  maxRequests: parseInt(process.env.AZURE_DI_MAX_TPS || '15', 10),
  windowMs: 1000,
  retryAfter: 200,
});

// ============================================================================
// Prometheus-compatible Metrics Counters
// ============================================================================

export const diMetrics = {
  requestsTotal: 0,
  requestsSucceeded: 0,
  requestsFailed: 0,
  requestsByModel: {} as Record<string, number>,
  totalPagesProcessed: 0,
  totalProcessingTimeMs: 0,
  averageProcessingTimeMs: 0,
  lastRequestAt: null as string | null,

  /** Record a successful DI request */
  recordSuccess(model: string, pages: number, processingTimeMs: number) {
    this.requestsTotal++;
    this.requestsSucceeded++;
    this.requestsByModel[model] = (this.requestsByModel[model] || 0) + 1;
    this.totalPagesProcessed += pages;
    this.totalProcessingTimeMs += processingTimeMs;
    this.averageProcessingTimeMs = this.totalProcessingTimeMs / this.requestsSucceeded;
    this.lastRequestAt = new Date().toISOString();
  },

  /** Record a failed DI request */
  recordFailure(model: string) {
    this.requestsTotal++;
    this.requestsFailed++;
    this.requestsByModel[model] = (this.requestsByModel[model] || 0) + 1;
    this.lastRequestAt = new Date().toISOString();
  },

  /** Get metrics snapshot for /metrics endpoint */
  getSnapshot() {
    return {
      requests: {
        total: this.requestsTotal,
        succeeded: this.requestsSucceeded,
        failed: this.requestsFailed,
        byModel: { ...this.requestsByModel },
      },
      pages: {
        totalProcessed: this.totalPagesProcessed,
      },
      latency: {
        totalMs: this.totalProcessingTimeMs,
        averageMs: Math.round(this.averageProcessingTimeMs),
      },
      lastRequestAt: this.lastRequestAt,
    };
  },

  /** Reset all counters (for testing) */
  reset() {
    this.requestsTotal = 0;
    this.requestsSucceeded = 0;
    this.requestsFailed = 0;
    this.requestsByModel = {};
    this.totalPagesProcessed = 0;
    this.totalProcessingTimeMs = 0;
    this.averageProcessingTimeMs = 0;
    this.lastRequestAt = null;
  },
};

// ============================================================================
// Constants
// ============================================================================

const DI_API_VERSION = '2024-11-30';

const MAX_POLL_ATTEMPTS = 120; // 2 minutes
const POLL_INTERVAL_MS = 1000;

// Azure DI pricing per page (USD, S0 tier as of 2025)
const DI_COST_PER_PAGE: Record<string, number> = {
  'prebuilt-read': 0.001,
  'prebuilt-layout': 0.01,
  'prebuilt-contract': 0.01,
  'prebuilt-invoice': 0.01,
  'prebuilt-receipt': 0.01,
  'prebuilt-idDocument': 0.01,
};

/** Cumulative cost tracking for the current process lifetime */
export const diCostTracker = {
  totalCostUSD: 0,
  costByModel: {} as Record<string, number>,
  pagesByModel: {} as Record<string, number>,

  record(model: string, pages: number) {
    const perPage = DI_COST_PER_PAGE[model] || 0.01;
    const cost = pages * perPage;
    this.totalCostUSD += cost;
    this.costByModel[model] = (this.costByModel[model] || 0) + cost;
    this.pagesByModel[model] = (this.pagesByModel[model] || 0) + pages;
    return cost;
  },

  getSnapshot() {
    return {
      totalCostUSD: Math.round(this.totalCostUSD * 10000) / 10000,
      costByModel: { ...this.costByModel },
      pagesByModel: { ...this.pagesByModel },
    };
  },

  reset() {
    this.totalCostUSD = 0;
    this.costByModel = {};
    this.pagesByModel = {};
  },
};

export type DIModel =
  | 'prebuilt-layout'
  | 'prebuilt-read'
  | 'prebuilt-contract'
  | 'prebuilt-invoice'
  | 'prebuilt-receipt'
  | 'prebuilt-idDocument';

// ============================================================================
// Types — Structured Extraction Results
// ============================================================================

export interface DIAnalyzeResult {
  /** Full concatenated text content */
  content: string;
  /** Per-page breakdown */
  pages: DIPage[];
  /** Extracted tables with headers and cells */
  tables: DITable[];
  /** Key-value pairs detected in the document */
  keyValuePairs: DIKeyValuePair[];
  /** Detected paragraphs with semantic roles */
  paragraphs: DIParagraph[];
  /** Prebuilt model-specific extracted fields */
  documents: DIDocument[];
  /** Processing metadata */
  metadata: DIMetadata;
}

export interface DIPage {
  pageNumber: number;
  width: number;
  height: number;
  unit: string;
  text: string;
  words: DIWord[];
  lines: DILine[];
  selectionMarks?: DISelectionMark[];
}

export interface DIWord {
  content: string;
  confidence: number;
  polygon?: number[];
}

export interface DILine {
  content: string;
  polygon?: number[];
}

export interface DITable {
  pageNumber: number;
  rowCount: number;
  columnCount: number;
  headers: string[];
  rows: string[][];
  cells: DITableCell[];
  confidence: number;
}

export interface DITableCell {
  rowIndex: number;
  columnIndex: number;
  content: string;
  kind: 'content' | 'columnHeader' | 'rowHeader' | 'stubHead' | 'description';
  confidence: number;
}

export interface DIKeyValuePair {
  key: string;
  value: string;
  confidence: number;
}

export interface DIParagraph {
  content: string;
  role?: 'title' | 'sectionHeading' | 'footnote' | 'pageHeader' | 'pageFooter' | 'pageNumber';
}

export interface DIDocument {
  docType: string;
  fields: Record<string, DIField>;
  confidence: number;
}

export interface DIField {
  type: 'string' | 'date' | 'number' | 'currency' | 'address' | 'array' | 'object';
  value: any;
  content?: string;
  confidence: number;
}

export interface DISelectionMark {
  state: 'selected' | 'unselected';
  confidence: number;
  polygon?: number[];
}

export interface DIMetadata {
  model: DIModel;
  apiVersion: string;
  processingTimeMs: number;
  pageCount: number;
  region: string;
  dataResidency: string;
}

// ============================================================================
// Contract-Specific Types
// ============================================================================

export interface ContractExtractionResult {
  parties: ContractParty[];
  dates: {
    effectiveDate?: string;
    expirationDate?: string;
    executionDate?: string;
    renewalDate?: string;
  };
  jurisdiction?: string;
  title?: string;
  documentType?: string;
  confidence: number;
  /** Raw DI fields for further processing */
  rawFields: Record<string, DIField>;
}

export interface ContractParty {
  name: string;
  role?: string;
  address?: string;
  confidence: number;
}

// ============================================================================
// Invoice-Specific Types
// ============================================================================

export interface InvoiceExtractionResult {
  vendorName?: string;
  vendorAddress?: string;
  customerName?: string;
  customerAddress?: string;
  invoiceId?: string;
  invoiceDate?: string;
  dueDate?: string;
  purchaseOrder?: string;
  subtotal?: number;
  totalTax?: number;
  invoiceTotal?: number;
  amountDue?: number;
  currency?: string;
  paymentTerms?: string;
  lineItems: InvoiceLineItem[];
  confidence: number;
  rawFields: Record<string, DIField>;
}

export interface InvoiceLineItem {
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  tax?: number;
  productCode?: string;
}

// ============================================================================
// Configuration
// ============================================================================

interface DIConfig {
  endpoint: string;
  apiKey: string;
  region: string;
}

function getDIConfig(): DIConfig {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  if (!endpoint || !apiKey) {
    throw new Error(
      'Azure Document Intelligence not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY'
    );
  }

  // Determine region from endpoint
  let region = 'unknown';
  if (endpoint.includes('switzerland')) region = 'switzerland-north';
  else if (endpoint.includes('westeurope') || endpoint.includes('west-europe')) region = 'west-europe';
  else if (endpoint.includes('northeurope') || endpoint.includes('north-europe')) region = 'north-europe';
  else if (endpoint.includes('francecentral') || endpoint.includes('france-central')) region = 'france-central';

  return { endpoint: endpoint.replace(/\/$/, ''), apiKey, region };
}

function getDataResidency(region: string): string {
  if (region.includes('switzerland')) return 'switzerland';
  if (region.includes('europe') || region.includes('france')) return 'eu';
  return 'other';
}

// ============================================================================
// Core API — Submit & Poll
// ============================================================================

/**
 * Submit a document to Document Intelligence for analysis and poll until complete.
 */
async function analyzeDocument(
  fileBuffer: Buffer,
  model: DIModel,
  options: {
    features?: string[];
    queryFields?: string[];
    outputContentFormat?: 'text' | 'markdown';
    locale?: string;
    onProgress?: (pct: number, message: string) => void;
  } = {}
): Promise<any> {
  const config = getDIConfig();
  const startTime = Date.now();

  // Rate limit: wait for a token before submitting to DI
  let rateLimitAttempts = 0;
  while (!diRateLimiter.consume()) {
    rateLimitAttempts++;
    if (rateLimitAttempts > 50) {
      throw new Error('DI rate limiter exhausted — too many concurrent requests');
    }
    const retryMs = diRateLimiter.getRetryAfter();
    logger.warn({ retryMs, remaining: diRateLimiter.remaining() }, 'DI rate limited, waiting');
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }

  // Build the analyze URL
  const params = new URLSearchParams({ 'api-version': DI_API_VERSION });

  // Add optional features (e.g., keyValuePairs, queryFields, barcodes)
  if (options.features?.length) {
    params.set('features', options.features.join(','));
  }
  if (options.queryFields?.length) {
    params.set('queryFields', options.queryFields.join(','));
  }
  if (options.outputContentFormat) {
    params.set('outputContentFormat', options.outputContentFormat);
  }
  if (options.locale) {
    params.set('locale', options.locale);
  }

  const analyzeUrl = `${config.endpoint}/documentintelligence/documentModels/${model}:analyze?${params.toString()}`;

  logger.info({ model, url: analyzeUrl, bufferSize: fileBuffer.length }, 'Submitting document to Document Intelligence');

  // Submit the document
  const submitResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': config.apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`Document Intelligence submit failed (${submitResponse.status}): ${errorText}`);
  }

  // Get operation location for async polling
  const operationLocation = submitResponse.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('Document Intelligence did not return Operation-Location header');
  }

  // Poll for results
  let result: any = null;
  let attempts = 0;

  options.onProgress?.(10, `Submitted to DI (${model}), polling for result…`);

  while (attempts < MAX_POLL_ATTEMPTS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    attempts++;

    // Report progress based on polling progress (10-90%)
    const pct = 10 + Math.min(80, Math.floor((attempts / MAX_POLL_ATTEMPTS) * 80));
    if (attempts % 5 === 0) {
      options.onProgress?.(pct, `DI analysis in progress (${attempts}s elapsed)…`);
    }

    const statusResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': config.apiKey },
    });

    if (!statusResponse.ok) {
      throw new Error(`Document Intelligence poll failed (${statusResponse.status})`);
    }

    const statusData = await statusResponse.json();

    if (statusData.status === 'succeeded') {
      result = statusData.analyzeResult;
      break;
    } else if (statusData.status === 'failed') {
      const errorMsg = statusData.error?.message || JSON.stringify(statusData.error);
      throw new Error(`Document Intelligence analysis failed: ${errorMsg}`);
    }
    // 'running' or 'notStarted' — continue polling
  }

  if (!result) {
    throw new Error(`Document Intelligence timed out after ${MAX_POLL_ATTEMPTS}s`);
  }

  const processingTime = Date.now() - startTime;
  const pageCount = result.pages?.length || 0;
  logger.info({ model, processingTime, pages: pageCount }, 'Document Intelligence analysis complete');

  // Record metrics and cost
  diMetrics.recordSuccess(model, pageCount, processingTime);
  const cost = diCostTracker.record(model, Math.max(pageCount, 1));
  logger.debug({ model, pages: pageCount, costUSD: cost }, 'DI cost recorded');

  options.onProgress?.(95, `DI analysis complete (${pageCount} pages, ${processingTime}ms)`);

  return { ...result, _processingTime: processingTime, _region: config.region };
}

// ============================================================================
// Result Parsers
// ============================================================================

function parsePages(raw: any): DIPage[] {
  return (raw.pages || []).map((page: any, idx: number) => ({
    pageNumber: idx + 1,
    width: page.width || 0,
    height: page.height || 0,
    unit: page.unit || 'inch',
    text: (page.lines || []).map((l: any) => l.content).join('\n'),
    words: (page.words || []).map((w: any) => ({
      content: w.content,
      confidence: w.confidence ?? 0.9,
      polygon: w.polygon,
    })),
    lines: (page.lines || []).map((l: any) => ({
      content: l.content,
      polygon: l.polygon,
    })),
    selectionMarks: (page.selectionMarks || []).map((sm: any) => ({
      state: sm.state,
      confidence: sm.confidence ?? 0.9,
      polygon: sm.polygon,
    })),
  }));
}

function parseTables(raw: any): DITable[] {
  return (raw.tables || []).map((table: any) => {
    const cells: DITableCell[] = (table.cells || []).map((c: any) => ({
      rowIndex: c.rowIndex ?? 0,
      columnIndex: c.columnIndex ?? 0,
      content: c.content || '',
      kind: c.kind || 'content',
      confidence: c.confidence ?? 0.9,
    }));

    // Extract headers
    const headers = cells
      .filter((c) => c.kind === 'columnHeader')
      .sort((a, b) => a.columnIndex - b.columnIndex)
      .map((c) => c.content);

    // Group content cells into rows
    const rowMap = new Map<number, string[]>();
    for (const cell of cells) {
      if (cell.kind === 'columnHeader') continue;
      if (!rowMap.has(cell.rowIndex)) rowMap.set(cell.rowIndex, []);
      const row = rowMap.get(cell.rowIndex)!;
      row[cell.columnIndex] = cell.content;
    }
    const rows = Array.from(rowMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, row]) => row);

    return {
      pageNumber: table.boundingRegions?.[0]?.pageNumber || 1,
      rowCount: table.rowCount || rows.length,
      columnCount: table.columnCount || headers.length,
      headers,
      rows,
      cells,
      confidence: cells.length > 0
        ? cells.reduce((sum, c) => sum + c.confidence, 0) / cells.length
        : 0.9,
    };
  });
}

function parseKeyValuePairs(raw: any): DIKeyValuePair[] {
  return (raw.keyValuePairs || []).map((kv: any) => ({
    key: kv.key?.content || '',
    value: kv.value?.content || '',
    confidence: Math.min(kv.key?.confidence ?? 0.9, kv.value?.confidence ?? 0.9),
  }));
}

function parseParagraphs(raw: any): DIParagraph[] {
  return (raw.paragraphs || []).map((p: any) => ({
    content: p.content || '',
    role: p.role,
  }));
}

function parseDocuments(raw: any): DIDocument[] {
  return (raw.documents || []).map((doc: any) => {
    const fields: Record<string, DIField> = {};
    for (const [key, val] of Object.entries(doc.fields || {})) {
      const f = val as any;
      fields[key] = {
        type: f.type || 'string',
        value: f.value ?? f.valueString ?? f.valueDate ?? f.valueNumber ?? f.content ?? null,
        content: f.content,
        confidence: f.confidence ?? 0.9,
      };
    }
    return {
      docType: doc.docType || 'unknown',
      fields,
      confidence: doc.confidence ?? 0.9,
    };
  });
}

// ============================================================================
// Public API — Layout Analysis
// ============================================================================

/**
 * Analyze a document using the Layout model (v4.0).
 *
 * Returns full structured extraction: text, tables, key-value pairs,
 * paragraphs with semantic roles, and selection marks.
 *
 * This replaces the old Read API v3.2 and provides significantly richer output.
 */
export async function analyzeLayout(
  fileBuffer: Buffer,
  options: {
    extractKeyValuePairs?: boolean;
    locale?: string;
    outputFormat?: 'text' | 'markdown';
  } = {}
): Promise<DIAnalyzeResult> {
  const span = startSpan({ name: 'di.analyzeLayout', kind: 'client', attributes: { 'di.model': 'prebuilt-layout', 'di.buffer_size': fileBuffer.length } });
  try {
    const features: string[] = [];
    if (options.extractKeyValuePairs !== false) {
      features.push('keyValuePairs');
    }

    const raw = await analyzeDocument(fileBuffer, 'prebuilt-layout', {
      features,
      locale: options.locale,
      outputContentFormat: options.outputFormat,
    });

    const region = raw._region as string;
    setSpanAttributes(span, { 'di.region': region, 'di.pages': raw.pages?.length || 0 });

    const result: DIAnalyzeResult = {
    content: raw.content || '',
    pages: parsePages(raw),
    tables: parseTables(raw),
    keyValuePairs: parseKeyValuePairs(raw),
    paragraphs: parseParagraphs(raw),
    documents: [],
    metadata: {
      model: 'prebuilt-layout',
      apiVersion: DI_API_VERSION,
      processingTimeMs: raw._processingTime,
      pageCount: raw.pages?.length || 0,
      region: region,
      dataResidency: getDataResidency(region),
    },
  };
    endSpan(span, 'ok');
    return result;
  } catch (error) {
    diMetrics.recordFailure('prebuilt-layout');
    setSpanAttributes(span, { 'error.message': error instanceof Error ? error.message : String(error) });
    endSpan(span, 'error');
    throw error;
  }
}

// ============================================================================
// Public API — Read (lightweight OCR)
// ============================================================================

/**
 * Lightweight OCR using the Read model — text only, faster and cheaper.
 */
export async function analyzeRead(
  fileBuffer: Buffer,
  options: { locale?: string } = {}
): Promise<DIAnalyzeResult> {
  const span = startSpan({ name: 'di.analyzeRead', kind: 'client', attributes: { 'di.model': 'prebuilt-read', 'di.buffer_size': fileBuffer.length } });
  try {
  const raw = await analyzeDocument(fileBuffer, 'prebuilt-read', {
    locale: options.locale,
  });

  const region = raw._region as string;
  setSpanAttributes(span, { 'di.region': region, 'di.pages': raw.pages?.length || 0 });

  const result: DIAnalyzeResult = {
    content: raw.content || '',
    pages: parsePages(raw),
    tables: [],
    keyValuePairs: [],
    paragraphs: parseParagraphs(raw),
    documents: [],
    metadata: {
      model: 'prebuilt-read',
      apiVersion: DI_API_VERSION,
      processingTimeMs: raw._processingTime,
      pageCount: raw.pages?.length || 0,
      region: region,
      dataResidency: getDataResidency(region),
    },
  };
    endSpan(span, 'ok');
    return result;
  } catch (error) {
    diMetrics.recordFailure('prebuilt-read');
    setSpanAttributes(span, { 'error.message': error instanceof Error ? error.message : String(error) });
    endSpan(span, 'error');
    throw error;
  }
}

// ============================================================================
// Public API — Contract Extraction
// ============================================================================

/**
 * Extract structured contract data using the prebuilt-contract model.
 *
 * Returns parties, dates, jurisdiction, and document type extracted
 * natively by Azure — no GPT prompt engineering required.
 */
export async function analyzeContract(
  fileBuffer: Buffer,
  options: { locale?: string } = {}
): Promise<{ analysis: DIAnalyzeResult; contract: ContractExtractionResult }> {
  const span = startSpan({ name: 'di.analyzeContract', kind: 'client', attributes: { 'di.model': 'prebuilt-contract', 'di.buffer_size': fileBuffer.length } });
  try {
  const raw = await analyzeDocument(fileBuffer, 'prebuilt-contract', {
    locale: options.locale,
    features: ['keyValuePairs'],
  });

  const region = raw._region as string;

  const analysis: DIAnalyzeResult = {
    content: raw.content || '',
    pages: parsePages(raw),
    tables: parseTables(raw),
    keyValuePairs: parseKeyValuePairs(raw),
    paragraphs: parseParagraphs(raw),
    documents: parseDocuments(raw),
    metadata: {
      model: 'prebuilt-contract',
      apiVersion: DI_API_VERSION,
      processingTimeMs: raw._processingTime,
      pageCount: raw.pages?.length || 0,
      region: region,
      dataResidency: getDataResidency(region),
    },
  };

  // Extract contract-specific fields from the first document
  const doc = analysis.documents[0];
  const fields = doc?.fields || {};

  const parties: ContractParty[] = [];

  // DI contract model returns parties as an array field
  const partiesField = fields['Parties'];
  if (partiesField?.type === 'array' && Array.isArray(partiesField.value)) {
    for (const p of partiesField.value) {
      const partyObj = p.value || p;
      parties.push({
        name: partyObj?.Name?.value || partyObj?.Name?.content || partyObj?.content || 'Unknown',
        role: partyObj?.Role?.value || partyObj?.Role?.content || undefined,
        address: partyObj?.Address?.value || partyObj?.Address?.content || undefined,
        confidence: partyObj?.Name?.confidence ?? p.confidence ?? 0.8,
      });
    }
  }

  // Fallback: extract individual party fields
  if (parties.length === 0) {
    for (const [key, field] of Object.entries(fields)) {
      if (key.toLowerCase().includes('party') && field.value) {
        parties.push({
          name: typeof field.value === 'string' ? field.value : field.content || 'Unknown',
          confidence: field.confidence,
        });
      }
    }
  }

  const contract: ContractExtractionResult = {
    parties,
    dates: {
      effectiveDate: fields['ContractStartDate']?.value || fields['EffectiveDate']?.value || undefined,
      expirationDate: fields['ContractEndDate']?.value || fields['ExpirationDate']?.value || undefined,
      executionDate: fields['ExecutionDate']?.value || fields['SignatureDate']?.value || undefined,
      renewalDate: fields['RenewalDate']?.value || undefined,
    },
    jurisdiction: fields['Jurisdiction']?.value || fields['GoverningLaw']?.value || undefined,
    title: fields['Title']?.value || fields['ContractTitle']?.value || undefined,
    documentType: doc?.docType,
    confidence: doc?.confidence ?? 0.8,
    rawFields: fields,
  };

  logger.info(
    { parties: parties.length, hasEffectiveDate: !!contract.dates.effectiveDate, confidence: contract.confidence },
    'Contract extraction complete'
  );

    setSpanAttributes(span, { 'di.parties': parties.length, 'di.confidence': contract.confidence });
    endSpan(span, 'ok');
    return { analysis, contract };
  } catch (error) {
    diMetrics.recordFailure('prebuilt-contract');
    setSpanAttributes(span, { 'error.message': error instanceof Error ? error.message : String(error) });
    endSpan(span, 'error');
    throw error;
  }
}

// ============================================================================
// Public API — Invoice Extraction
// ============================================================================

/**
 * Extract structured invoice data using the prebuilt-invoice model.
 *
 * Returns vendor, customer, line items, totals, and payment terms.
 */
export async function analyzeInvoice(
  fileBuffer: Buffer,
  options: { locale?: string } = {}
): Promise<{ analysis: DIAnalyzeResult; invoice: InvoiceExtractionResult }> {
  const span = startSpan({ name: 'di.analyzeInvoice', kind: 'client', attributes: { 'di.model': 'prebuilt-invoice', 'di.buffer_size': fileBuffer.length } });
  try {
  const raw = await analyzeDocument(fileBuffer, 'prebuilt-invoice', {
    locale: options.locale,
  });

  const region = raw._region as string;

  const analysis: DIAnalyzeResult = {
    content: raw.content || '',
    pages: parsePages(raw),
    tables: parseTables(raw),
    keyValuePairs: parseKeyValuePairs(raw),
    paragraphs: parseParagraphs(raw),
    documents: parseDocuments(raw),
    metadata: {
      model: 'prebuilt-invoice',
      apiVersion: DI_API_VERSION,
      processingTimeMs: raw._processingTime,
      pageCount: raw.pages?.length || 0,
      region: region,
      dataResidency: getDataResidency(region),
    },
  };

  const doc = analysis.documents[0];
  const f = doc?.fields || {};

  // Parse line items
  const lineItems: InvoiceLineItem[] = [];
  const itemsField = f['Items'];
  if (itemsField?.type === 'array' && Array.isArray(itemsField.value)) {
    for (const item of itemsField.value) {
      const iv = item.value || item;
      lineItems.push({
        description: iv?.Description?.value || iv?.Description?.content,
        quantity: iv?.Quantity?.value,
        unit: iv?.Unit?.value || iv?.Unit?.content,
        unitPrice: iv?.UnitPrice?.value,
        amount: iv?.Amount?.value,
        tax: iv?.Tax?.value,
        productCode: iv?.ProductCode?.value || iv?.ProductCode?.content,
      });
    }
  }

  const invoice: InvoiceExtractionResult = {
    vendorName: f['VendorName']?.value || f['VendorName']?.content,
    vendorAddress: f['VendorAddress']?.value || f['VendorAddress']?.content,
    customerName: f['CustomerName']?.value || f['CustomerName']?.content,
    customerAddress: f['CustomerAddress']?.value || f['CustomerAddress']?.content,
    invoiceId: f['InvoiceId']?.value || f['InvoiceId']?.content,
    invoiceDate: f['InvoiceDate']?.value,
    dueDate: f['DueDate']?.value,
    purchaseOrder: f['PurchaseOrder']?.value || f['PurchaseOrder']?.content,
    subtotal: f['SubTotal']?.value,
    totalTax: f['TotalTax']?.value,
    invoiceTotal: f['InvoiceTotal']?.value,
    amountDue: f['AmountDue']?.value,
    currency: f['CurrencyCode']?.value || f['CurrencyCode']?.content,
    paymentTerms: f['PaymentTerm']?.value || f['PaymentTerm']?.content,
    lineItems,
    confidence: doc?.confidence ?? 0.8,
    rawFields: f,
  };

  logger.info(
    { vendor: invoice.vendorName, total: invoice.invoiceTotal, items: lineItems.length },
    'Invoice extraction complete'
  );

    setSpanAttributes(span, { 'di.vendor': invoice.vendorName || '', 'di.line_items': lineItems.length });
    endSpan(span, 'ok');
    return { analysis, invoice };
  } catch (error) {
    diMetrics.recordFailure('prebuilt-invoice');
    setSpanAttributes(span, { 'error.message': error instanceof Error ? error.message : String(error) });
    endSpan(span, 'error');
    throw error;
  }
}

// ============================================================================
// Public API — Query Fields (ad-hoc extraction)
// ============================================================================

/**
 * Ask ad-hoc questions about a document at extraction time.
 *
 * Example queryFields: ['What is the governing law?', 'What is the termination notice period?']
 *
 * Uses the Layout model with queryFields feature.
 */
export async function analyzeWithQueries(
  fileBuffer: Buffer,
  queryFields: string[],
  options: { locale?: string } = {}
): Promise<{ analysis: DIAnalyzeResult; answers: Record<string, string> }> {
  const span = startSpan({ name: 'di.analyzeWithQueries', kind: 'client', attributes: { 'di.model': 'prebuilt-layout', 'di.queries': queryFields.length } });
  try {
  const raw = await analyzeDocument(fileBuffer, 'prebuilt-layout', {
    features: ['queryFields', 'keyValuePairs'],
    queryFields,
    locale: options.locale,
  });

  const region = raw._region as string;

  const analysis: DIAnalyzeResult = {
    content: raw.content || '',
    pages: parsePages(raw),
    tables: parseTables(raw),
    keyValuePairs: parseKeyValuePairs(raw),
    paragraphs: parseParagraphs(raw),
    documents: parseDocuments(raw),
    metadata: {
      model: 'prebuilt-layout',
      apiVersion: DI_API_VERSION,
      processingTimeMs: raw._processingTime,
      pageCount: raw.pages?.length || 0,
      region: region,
      dataResidency: getDataResidency(region),
    },
  };

  // Query field answers come back in the documents array
  const answers: Record<string, string> = {};
  for (const doc of analysis.documents) {
    for (const [key, field] of Object.entries(doc.fields)) {
      answers[key] = field.value ?? field.content ?? '';
    }
  }

    setSpanAttributes(span, { 'di.answers': Object.keys(answers).length });
    endSpan(span, 'ok');
    return { analysis, answers };
  } catch (error) {
    diMetrics.recordFailure('prebuilt-layout');
    setSpanAttributes(span, { 'error.message': error instanceof Error ? error.message : String(error) });
    endSpan(span, 'error');
    throw error;
  }
}

// ============================================================================
// Public API — Utility: Check Configuration
// ============================================================================

/**
 * Verify that Document Intelligence credentials are configured and reachable.
 */
export async function checkDIHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  region: string;
  dataResidency: string;
  error?: string;
}> {
  try {
    const config = getDIConfig();
    const healthUrl = `${config.endpoint}/documentintelligence/info?api-version=${DI_API_VERSION}`;

    const response = await fetch(healthUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': config.apiKey },
    });

    return {
      configured: true,
      reachable: response.ok,
      region: config.region,
      dataResidency: getDataResidency(config.region),
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const err = error as Error;
    const hasCreds = !!(
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
    );
    return {
      configured: hasCreds,
      reachable: false,
      region: 'unknown',
      dataResidency: 'unknown',
      error: err.message,
    };
  }
}

/**
 * Check if Document Intelligence feature flag is enabled.
 * Defaults to true when DI credentials are configured.
 * Set AZURE_DI_ENABLED=false to disable even with valid credentials.
 */
export function isDIEnabled(): boolean {
  const flag = process.env.AZURE_DI_ENABLED;
  if (flag !== undefined) {
    return flag === 'true' || flag === '1';
  }
  // Enabled by default when configured
  return isDIConfigured();
}

/**
 * Check if Document Intelligence is configured (non-throwing).
 */
export function isDIConfigured(): boolean {
  return !!(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT &&
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY
  );
}
