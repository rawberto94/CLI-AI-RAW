/**
 * Azure Document Intelligence v4.0 — Unit Tests
 *
 * Tests all public API functions, config validation, parsing, health check,
 * and error/timeout handling with mocked HTTP responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock fetch globally ────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Mock pino (silence logs during tests) ──────────────────────────────────
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Environment variables ──────────────────────────────────────────────────
const TEST_ENDPOINT = 'https://di-contracts-ch.cognitiveservices.azure.com';
const TEST_KEY = 'test-api-key-12345';

describe('Azure Document Intelligence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = TEST_ENDPOINT;
    process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  });

  // ========================================================================
  // isDIConfigured
  // ========================================================================
  describe('isDIConfigured', () => {
    it('returns true when both env vars are set', async () => {
      const { isDIConfigured } = await import('../azure-document-intelligence');
      expect(isDIConfigured()).toBe(true);
    });

    it('returns false when endpoint is missing', async () => {
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
      const mod = await import('../azure-document-intelligence');
      // Re-evaluate (module caches won't affect env reads at call time)
      expect(mod.isDIConfigured()).toBe(false);
    });

    it('returns false when key is missing', async () => {
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
      const mod = await import('../azure-document-intelligence');
      expect(mod.isDIConfigured()).toBe(false);
    });
  });

  // ========================================================================
  // checkDIHealth
  // ========================================================================
  describe('checkDIHealth', () => {
    it('returns healthy status when DI endpoint responds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          customDocumentModels: { count: 0, limit: 500 },
          prebuiltDocumentModels: { count: 15 },
        }),
      });

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();

      expect(health.configured).toBe(true);
      expect(health.reachable).toBe(true);
      expect(health.region).toBe('switzerland-north');
      expect(health.dataResidency).toBe('switzerland');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/documentintelligence/info'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Ocp-Apim-Subscription-Key': TEST_KEY,
          }),
        })
      );
    });

    it('returns unreachable when endpoint returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();

      expect(health.configured).toBe(true);
      expect(health.reachable).toBe(false);
    });

    it('returns unconfigured when env vars are missing', async () => {
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();

      expect(health.configured).toBe(false);
      expect(health.reachable).toBe(false);
    });

    it('handles fetch network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();

      expect(health.configured).toBe(true);
      expect(health.reachable).toBe(false);
    });
  });

  // ========================================================================
  // analyzeLayout
  // ========================================================================
  describe('analyzeLayout', () => {
    function mockAnalyzeSuccess() {
      // First call: POST submit → 202 with operation-location
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Map([
          ['operation-location', `${TEST_ENDPOINT}/documentintelligence/documentModels/prebuilt-layout/analyzeResults/op-123`],
        ]),
      });
      // Second call: GET poll → 200 with succeeded result
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          analyzeResult: {
            content: 'Sample text extracted from document',
            pages: [
              {
                pageNumber: 1,
                width: 8.5,
                height: 11,
                unit: 'inch',
                words: [{ content: 'Sample', confidence: 0.99, polygon: [0, 0, 1, 0, 1, 1, 0, 1] }],
                lines: [{ content: 'Sample text extracted from document', polygon: [] }],
              },
            ],
            tables: [
              {
                rowCount: 2,
                columnCount: 2,
                cells: [
                  { rowIndex: 0, columnIndex: 0, content: 'Header1', kind: 'columnHeader', confidence: 0.95 },
                  { rowIndex: 0, columnIndex: 1, content: 'Header2', kind: 'columnHeader', confidence: 0.94 },
                  { rowIndex: 1, columnIndex: 0, content: 'Cell1', kind: 'content', confidence: 0.99 },
                  { rowIndex: 1, columnIndex: 1, content: 'Cell2', kind: 'content', confidence: 0.98 },
                ],
                boundingRegions: [{ pageNumber: 1 }],
              },
            ],
            keyValuePairs: [
              { key: { content: 'Date' }, value: { content: '2025-01-15' }, confidence: 0.97 },
            ],
            paragraphs: [
              { content: 'This is a title', role: 'title' },
              { content: 'This is body text' },
            ],
            documents: [],
          },
        }),
      });
    }

    it('extracts text, tables, KV pairs, and paragraphs from a document', async () => {
      mockAnalyzeSuccess();

      const { analyzeLayout } = await import('../azure-document-intelligence');
      const result = await analyzeLayout(Buffer.from('fake-pdf'));

      // Text content
      expect(result.content).toBe('Sample text extracted from document');

      // Pages
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].words).toHaveLength(1);
      expect(result.pages[0].words[0].content).toBe('Sample');

      // Tables
      expect(result.tables).toHaveLength(1);
      expect(result.tables[0].rowCount).toBe(2);
      expect(result.tables[0].columnCount).toBe(2);
      expect(result.tables[0].headers).toContain('Header1');
      expect(result.tables[0].rows).toHaveLength(1); // 1 data row

      // Key-value pairs
      expect(result.keyValuePairs).toHaveLength(1);
      expect(result.keyValuePairs[0].key).toBe('Date');
      expect(result.keyValuePairs[0].value).toBe('2025-01-15');

      // Paragraphs
      expect(result.paragraphs).toHaveLength(2);
      expect(result.paragraphs[0].role).toBe('title');

      // Metadata
      expect(result.metadata.model).toBe('prebuilt-layout');
      expect(result.metadata.apiVersion).toBe('2024-11-30');
      expect(result.metadata.pageCount).toBe(1);
      expect(result.metadata.region).toBe('switzerland-north');
      expect(result.metadata.dataResidency).toBe('switzerland');
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('sends correct headers and URL parameters', async () => {
      mockAnalyzeSuccess();

      const { analyzeLayout } = await import('../azure-document-intelligence');
      await analyzeLayout(Buffer.from('fake-pdf'), {
        extractKeyValuePairs: true,
        locale: 'en-US',
      });

      const [submitUrl, submitOpts] = mockFetch.mock.calls[0];
      expect(submitUrl).toContain('prebuilt-layout');
      expect(submitUrl).toContain('api-version=2024-11-30');
      expect(submitUrl).toContain('features=keyValuePairs');
      expect(submitOpts.headers['Ocp-Apim-Subscription-Key']).toBe(TEST_KEY);
      expect(submitOpts.headers['Content-Type']).toBe('application/octet-stream');
      expect(submitOpts.method).toBe('POST');
    });

    it('does not leak _config or apiKey in the public result', async () => {
      mockAnalyzeSuccess();

      const { analyzeLayout } = await import('../azure-document-intelligence');
      const result = await analyzeLayout(Buffer.from('fake-pdf'));

      // Ensure no internal fields leak
      expect((result as any)._config).toBeUndefined();
      expect((result as any)._processingTime).toBeUndefined();
      expect(JSON.stringify(result)).not.toContain(TEST_KEY);
    });
  });

  // ========================================================================
  // analyzeContract
  // ========================================================================
  describe('analyzeContract', () => {
    function mockContractSuccess() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Map([
          ['operation-location', `${TEST_ENDPOINT}/documentintelligence/documentModels/prebuilt-contract/analyzeResults/op-456`],
        ]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          analyzeResult: {
            content: 'Service Agreement between Party A and Party B',
            pages: [],
            tables: [],
            keyValuePairs: [],
            paragraphs: [],
            documents: [
              {
                docType: 'contract',
                confidence: 0.92,
                fields: {
                  Parties: {
                    type: 'array',
                    value: [
                      { type: 'object', value: { Name: { type: 'string', value: 'Acme Corp', confidence: 0.95 }, Role: { type: 'string', value: 'Provider', confidence: 0.88 } } },
                      { type: 'object', value: { Name: { type: 'string', value: 'Globex Inc', confidence: 0.93 }, Address: { type: 'string', value: '123 Main St', confidence: 0.85 } } },
                    ],
                    confidence: 0.91,
                  },
                  EffectiveDate: { type: 'date', value: '2025-03-01', confidence: 0.97 },
                  ExpirationDate: { type: 'date', value: '2026-03-01', confidence: 0.96 },
                  ExecutionDate: { type: 'date', value: '2025-02-15', confidence: 0.94 },
                  Jurisdiction: { type: 'string', value: 'Switzerland', confidence: 0.89 },
                  Title: { type: 'string', value: 'Master Service Agreement', confidence: 0.91 },
                  DocumentType: { type: 'string', value: 'MSA', confidence: 0.87 },
                },
              },
            ],
          },
        }),
      });
    }

    it('extracts contract parties, dates, and jurisdiction', async () => {
      mockContractSuccess();

      const { analyzeContract } = await import('../azure-document-intelligence');
      const result = await analyzeContract(Buffer.from('fake-contract'));

      expect(result.parties).toHaveLength(2);
      expect(result.parties[0].name).toBe('Acme Corp');
      expect(result.parties[0].role).toBe('Provider');
      expect(result.parties[1].name).toBe('Globex Inc');
      expect(result.parties[1].address).toBe('123 Main St');

      expect(result.dates.effectiveDate).toBe('2025-03-01');
      expect(result.dates.expirationDate).toBe('2026-03-01');
      expect(result.dates.executionDate).toBe('2025-02-15');

      expect(result.jurisdiction).toBe('Switzerland');
      expect(result.title).toBe('Master Service Agreement');
      expect(result.confidence).toBe(0.92);
    });
  });

  // ========================================================================
  // analyzeInvoice
  // ========================================================================
  describe('analyzeInvoice', () => {
    function mockInvoiceSuccess() {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Map([
          ['operation-location', `${TEST_ENDPOINT}/documentintelligence/documentModels/prebuilt-invoice/analyzeResults/op-789`],
        ]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          analyzeResult: {
            content: 'Invoice #INV-2025-001',
            pages: [],
            tables: [],
            keyValuePairs: [],
            paragraphs: [],
            documents: [
              {
                docType: 'invoice',
                confidence: 0.95,
                fields: {
                  VendorName: { type: 'string', value: 'Acme Corp', confidence: 0.98 },
                  VendorAddress: { type: 'string', value: '456 Oak Ave', confidence: 0.92 },
                  CustomerName: { type: 'string', value: 'Globex Inc', confidence: 0.97 },
                  InvoiceId: { type: 'string', value: 'INV-2025-001', confidence: 0.99 },
                  InvoiceDate: { type: 'date', value: '2025-01-15', confidence: 0.98 },
                  DueDate: { type: 'date', value: '2025-02-15', confidence: 0.96 },
                  SubTotal: { type: 'currency', value: { amount: 10000, currencyCode: 'CHF' }, confidence: 0.95 },
                  TotalTax: { type: 'currency', value: { amount: 770, currencyCode: 'CHF' }, confidence: 0.93 },
                  InvoiceTotal: { type: 'currency', value: { amount: 10770, currencyCode: 'CHF' }, confidence: 0.97 },
                  AmountDue: { type: 'currency', value: { amount: 10770, currencyCode: 'CHF' }, confidence: 0.96 },
                  PaymentTerms: { type: 'string', value: 'Net 30', confidence: 0.91 },
                  Items: {
                    type: 'array',
                    value: [
                      {
                        type: 'object',
                        value: {
                          Description: { type: 'string', value: 'Consulting Services', confidence: 0.97 },
                          Quantity: { type: 'number', value: 40, confidence: 0.95 },
                          Unit: { type: 'string', value: 'hours', confidence: 0.88 },
                          UnitPrice: { type: 'currency', value: { amount: 250, currencyCode: 'CHF' }, confidence: 0.94 },
                          Amount: { type: 'currency', value: { amount: 10000, currencyCode: 'CHF' }, confidence: 0.96 },
                        },
                      },
                    ],
                    confidence: 0.95,
                  },
                },
              },
            ],
          },
        }),
      });
    }

    it('extracts invoice details, line items, and totals', async () => {
      mockInvoiceSuccess();

      const { analyzeInvoice } = await import('../azure-document-intelligence');
      const result = await analyzeInvoice(Buffer.from('fake-invoice'));

      expect(result.vendorName).toBe('Acme Corp');
      expect(result.customerName).toBe('Globex Inc');
      expect(result.invoiceId).toBe('INV-2025-001');
      expect(result.invoiceDate).toBe('2025-01-15');
      expect(result.dueDate).toBe('2025-02-15');
      expect(result.invoiceTotal).toBe(10770);
      expect(result.currency).toBe('CHF');
      expect(result.paymentTerms).toBe('Net 30');

      expect(result.lineItems).toHaveLength(1);
      expect(result.lineItems[0].description).toBe('Consulting Services');
      expect(result.lineItems[0].quantity).toBe(40);
      expect(result.lineItems[0].unitPrice).toBe(250);
      expect(result.lineItems[0].amount).toBe(10000);
      expect(result.confidence).toBe(0.95);
    });
  });

  // ========================================================================
  // analyzeRead
  // ========================================================================
  describe('analyzeRead', () => {
    it('extracts text content using lightweight read model', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Map([
          ['operation-location', `${TEST_ENDPOINT}/documentintelligence/documentModels/prebuilt-read/analyzeResults/op-read`],
        ]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'succeeded',
          analyzeResult: {
            content: 'Simple text content from a scan',
            pages: [{ pageNumber: 1, width: 8.5, height: 11, unit: 'inch', words: [], lines: [] }],
            tables: [],
            keyValuePairs: [],
            paragraphs: [{ content: 'Simple text content from a scan' }],
            documents: [],
          },
        }),
      });

      const { analyzeRead } = await import('../azure-document-intelligence');
      const result = await analyzeRead(Buffer.from('fake-scan'));

      expect(result.content).toBe('Simple text content from a scan');
      expect(result.metadata.model).toBe('prebuilt-read');
      expect(result.pages).toHaveLength(1);
    });
  });

  // ========================================================================
  // Error & Timeout Handling
  // ========================================================================
  describe('error handling', () => {
    it('throws when DI credentials are not configured', async () => {
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
      delete process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

      const { analyzeLayout } = await import('../azure-document-intelligence');
      await expect(analyzeLayout(Buffer.from('test'))).rejects.toThrow(
        /not configured/i
      );
    });

    it('throws when submit returns non-202', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limited',
      });

      const { analyzeLayout } = await import('../azure-document-intelligence');
      await expect(analyzeLayout(Buffer.from('test'))).rejects.toThrow();
    });

    it('throws when DI analysis returns failed status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        headers: new Map([
          ['operation-location', `${TEST_ENDPOINT}/documentintelligence/documentModels/prebuilt-layout/analyzeResults/op-fail`],
        ]),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'failed',
          error: { message: 'Invalid document format' },
        }),
      });

      const { analyzeLayout } = await import('../azure-document-intelligence');
      await expect(analyzeLayout(Buffer.from('bad-doc'))).rejects.toThrow(
        /Invalid document format/
      );
    });
  });

  // ========================================================================
  // Region Detection & Data Residency
  // ========================================================================
  describe('region detection', () => {
    it('detects switzerland-north from endpoint', async () => {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://di-switzerland.cognitiveservices.azure.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ customDocumentModels: { count: 0 } }),
      });

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();
      expect(health.region).toBe('switzerland-north');
    });

    it('detects west-europe from endpoint', async () => {
      process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT = 'https://di-westeurope.cognitiveservices.azure.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ customDocumentModels: { count: 0 } }),
      });

      const { checkDIHealth } = await import('../azure-document-intelligence');
      const health = await checkDIHealth();
      expect(health.region).toBe('west-europe');
      expect(health.dataResidency).toBe('eu');
    });
  });

  // ========================================================================
  // Type Exports
  // ========================================================================
  describe('type exports', () => {
    it('exports all expected public types', async () => {
      const mod = await import('../azure-document-intelligence');

      // Functions
      expect(typeof mod.analyzeLayout).toBe('function');
      expect(typeof mod.analyzeContract).toBe('function');
      expect(typeof mod.analyzeInvoice).toBe('function');
      expect(typeof mod.analyzeRead).toBe('function');
      expect(typeof mod.analyzeWithQueries).toBe('function');
      expect(typeof mod.checkDIHealth).toBe('function');
      expect(typeof mod.isDIConfigured).toBe('function');
    });
  });
});
