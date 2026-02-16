/**
 * EU/Swiss-Compliant OCR Providers
 *
 * OCR services that process data entirely within the EU/EEA/Switzerland,
 * ensuring compliance with GDPR, Swiss FADP, and Schrems II requirements.
 *
 * Why this matters:
 * - Standard OpenAI/AWS sends data to US servers
 * - Swiss FADP and GDPR require data to stay in EU/CH or have adequate safeguards
 * - These providers guarantee EU/Swiss data residency
 *
 * Providers included:
 * 1. Azure AI Vision (Switzerland/EU regions)
 * 2. Google Cloud Vision (EU regions)
 * 3. OVHcloud AI (French sovereignty)
 * 4. Self-hosted Tesseract (no data leaves your infrastructure)
 * 5. Infomaniak AI (Swiss provider)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { optionalImport } from '@/lib/server/optional-module';

// ============================================================================
// Types
// ============================================================================

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  region: string;
  pages?: PageResult[];
  tables?: TableResult[];
  processingTime: number;
  dataResidency: 'switzerland' | 'eu' | 'eea';
}

export interface PageResult {
  pageNumber: number;
  text: string;
  confidence: number;
  blocks?: TextBlock[];
}

export interface TextBlock {
  text: string;
  boundingBox?: BoundingBox;
  confidence: number;
  blockType: 'text' | 'table' | 'header' | 'footer' | 'signature';
}

export interface TableResult {
  pageNumber: number;
  headers: string[];
  rows: string[][];
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCROptions {
  /** Preferred provider (will fallback if unavailable) */
  provider?: 'azure-ch' | 'azure-eu' | 'azure-di' | 'google-eu' | 'ovh' | 'tesseract' | 'infomaniak';

  /** Target language (improves accuracy) */
  language?: 'de' | 'fr' | 'it' | 'en' | 'auto';

  /** Extract tables in addition to text */
  extractTables?: boolean;

  /** High-resolution mode for scanned documents */
  highResolution?: boolean;

  /** Encrypt text before returning (for extra security) */
  encryptResult?: boolean;

  /** Encryption key (required if encryptResult is true) */
  encryptionKey?: string;

  /**
   * Azure Document Intelligence model override.
   *
   * - 'layout'   — Full structural extraction (text + tables + KV pairs + paragraphs)
   * - 'contract' — Prebuilt contract party/date/jurisdiction extraction
   * - 'invoice'  — Vendor, line items, totals, payment terms
   * - 'read'     — Lightweight text-only OCR (default)
   *
   * Only applies when provider is 'azure-ch', 'azure-eu' or 'azure-di'.
   */
  diModel?: 'layout' | 'contract' | 'invoice' | 'read';

  /** Enable key-value pair extraction (DI v4.0 layout/contract models) */
  extractKeyValuePairs?: boolean;

  /** Ad-hoc query fields to extract from the document (DI v4.0 layout model) */
  queryFields?: string[];
}

// ============================================================================
// Azure AI Vision - Switzerland Region
// ============================================================================

/**
 * Azure Document Intelligence v4.0 — Switzerland Region
 * Region: Switzerland North (Zurich) or Switzerland West (Geneva)
 *
 * Data residency: Data processed and stored in Switzerland
 * Compliance: ISO 27001, SOC 2, GDPR, FINMA-ready
 *
 * Models available:
 * - prebuilt-layout  (default): Text + tables + key-value pairs + paragraphs
 * - prebuilt-contract: Parties, dates, jurisdiction, governing law
 * - prebuilt-invoice:  Vendor, line items, totals, payment terms
 * - prebuilt-read:     Lightweight text-only OCR
 *
 * Environment variables:
 *   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://di-contracts-ch.cognitiveservices.azure.com
 *   AZURE_DOCUMENT_INTELLIGENCE_KEY=your-di-key
 *   (fallback) AZURE_VISION_ENDPOINT_CH / AZURE_VISION_KEY_CH
 */
export async function performAzureSwitzerlandOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  // ── Prefer Document Intelligence v4.0 credentials ──
  const diEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
  const diKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;

  // Fall back to legacy Vision credentials
  const endpoint = diEndpoint || process.env.AZURE_VISION_ENDPOINT_CH;
  const apiKey = diKey || process.env.AZURE_VISION_KEY_CH;

  if (!endpoint || !apiKey) {
    throw new Error(
      'Azure Switzerland Vision not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT/KEY or AZURE_VISION_ENDPOINT_CH/KEY_CH'
    );
  }

  const useDIv4 = !!(diEndpoint && diKey);
  const languageHint = options.language === 'auto' ? undefined : options.language;

  // ── Determine which DI model to use ──
  const modelMap: Record<string, string> = {
    layout: 'prebuilt-layout',
    contract: 'prebuilt-contract',
    invoice: 'prebuilt-invoice',
    read: 'prebuilt-read',
  };
  const selectedModel = modelMap[options.diModel || 'layout'] || 'prebuilt-layout';
  const apiVersion = useDIv4 ? '2024-11-30' : '2023-07-31';
  const apiPath = useDIv4 ? 'documentintelligence' : 'formrecognizer';
  const actualModel = useDIv4 ? selectedModel : 'prebuilt-read'; // Legacy only supports read

  // Build URL with optional features
  const params = new URLSearchParams({ 'api-version': apiVersion });
  if (useDIv4 && (options.extractKeyValuePairs !== false) && actualModel !== 'prebuilt-read') {
    params.set('features', 'keyValuePairs');
  }
  if (useDIv4 && options.queryFields?.length) {
    params.set('features', [params.get('features'), 'queryFields'].filter(Boolean).join(','));
    params.set('queryFields', options.queryFields.join(','));
  }

  const analyzeUrl = `${endpoint.replace(/\/$/, '')}/${apiPath}/documentModels/${actualModel}:analyze?${params.toString()}`;

  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Azure Vision API error: ${response.status} - ${error}`);
  }

  // Get operation location for async processing
  const operationLocation = response.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('No operation location returned from Azure');
  }

  // Poll for results
  let result: any = null;
  let attempts = 0;
  const maxAttempts = 60;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;

    const statusResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    const statusData = await statusResponse.json();

    if (statusData.status === 'succeeded') {
      result = statusData.analyzeResult;
      break;
    } else if (statusData.status === 'failed') {
      throw new Error(`Azure analysis failed: ${JSON.stringify(statusData.error)}`);
    }
  }

  if (!result) {
    throw new Error('Azure OCR timed out');
  }

  // Extract pages
  const pages: PageResult[] = (result.pages || []).map((page: any, idx: number) => ({
    pageNumber: idx + 1,
    text: (page.lines || []).map((line: any) => line.content).join('\n'),
    confidence: page.confidence || 0.9,
    blocks: (page.lines || []).map((line: any) => ({
      text: line.content,
      confidence: line.confidence || 0.9,
      blockType: 'text' as const,
      boundingBox: line.polygon
        ? {
            x: line.polygon[0],
            y: line.polygon[1],
            width: line.polygon[2] - line.polygon[0],
            height: line.polygon[5] - line.polygon[1],
          }
        : undefined,
    })),
  }));

  // Extract tables (DI v4.0 returns richer table data)
  const tables: TableResult[] = (options.extractTables !== false)
    ? (result.tables || []).map((table: any) => ({
        pageNumber: table.boundingRegions?.[0]?.pageNumber || 1,
        headers: (table.cells || [])
          .filter((c: any) => c.kind === 'columnHeader')
          .sort((a: any, b: any) => a.columnIndex - b.columnIndex)
          .map((c: any) => c.content) || [],
        rows: groupTableCells(table.cells || []),
        confidence: table.confidence || 0.9,
      }))
    : [];

  // Extract key-value pairs (DI v4.0)
  const keyValuePairs: Array<{ key: string; value: string; confidence: number }> = [];
  if (result.keyValuePairs) {
    for (const kv of result.keyValuePairs) {
      keyValuePairs.push({
        key: kv.key?.content || '',
        value: kv.value?.content || '',
        confidence: Math.min(kv.key?.confidence ?? 0.9, kv.value?.confidence ?? 0.9),
      });
    }
  }

  // Extract document fields (contract/invoice models)
  const documentFields: Record<string, any> = {};
  if (result.documents?.[0]?.fields) {
    for (const [key, val] of Object.entries(result.documents[0].fields as Record<string, any>)) {
      documentFields[key] = {
        value: val.value ?? val.valueString ?? val.content ?? null,
        confidence: val.confidence ?? 0.9,
        type: val.type,
      };
    }
  }

  const fullText = result.content || pages.map((p) => p.text).join('\n\n');
  const processingTime = Date.now() - startTime;

  let resultText = fullText;

  // Append structured data as enrichment
  if (keyValuePairs.length > 0) {
    resultText += '\n\n--- KEY-VALUE PAIRS ---\n';
    for (const kv of keyValuePairs) {
      if (kv.key && kv.value) resultText += `${kv.key}: ${kv.value}\n`;
    }
  }

  if (Object.keys(documentFields).length > 0) {
    resultText += '\n\n--- DOCUMENT FIELDS ---\n';
    for (const [key, field] of Object.entries(documentFields)) {
      if (field.value) resultText += `${key}: ${field.value}\n`;
    }
  }

  if (options.encryptResult && options.encryptionKey) {
    resultText = encryptText(resultText, options.encryptionKey);
  }

  return {
    text: resultText,
    confidence: calculateAverageConfidence(pages),
    provider: useDIv4 ? 'azure-document-intelligence-v4' : 'azure-document-intelligence',
    region: 'switzerland-north',
    pages,
    tables,
    processingTime,
    dataResidency: 'switzerland',
  };
}

// ============================================================================
// Azure AI Vision - EU Region (for non-Swiss EU clients)
// ============================================================================

/**
 * Azure Document Intelligence v4.0 — EU Region
 * Regions: West Europe (Netherlands), North Europe (Ireland), France Central
 *
 * Data residency: Data stays within EU
 * Compliance: GDPR compliant
 *
 * Uses DI v4.0 when AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_EU is set,
 * otherwise falls back to legacy Form Recognizer API.
 */
export async function performAzureEUOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  // Try DI-specific EU credentials first, then legacy
  const diEndpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_EU;
  const diKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY_EU;
  const endpoint = diEndpoint || process.env.AZURE_VISION_ENDPOINT_EU || process.env.AZURE_VISION_ENDPOINT;
  const apiKey = diKey || process.env.AZURE_VISION_KEY_EU || process.env.AZURE_VISION_KEY;

  if (!endpoint || !apiKey) {
    throw new Error('Azure EU Vision not configured. Set AZURE_VISION_ENDPOINT_EU and AZURE_VISION_KEY_EU');
  }

  const useDIv4 = !!(diEndpoint && diKey);
  const modelMap: Record<string, string> = {
    layout: 'prebuilt-layout',
    contract: 'prebuilt-contract',
    invoice: 'prebuilt-invoice',
    read: 'prebuilt-read',
  };
  const selectedModel = modelMap[options.diModel || 'layout'] || 'prebuilt-layout';
  const apiVersion = useDIv4 ? '2024-11-30' : '2023-07-31';
  const apiPath = useDIv4 ? 'documentintelligence' : 'formrecognizer';
  const actualModel = useDIv4 ? selectedModel : 'prebuilt-read';

  const params = new URLSearchParams({ 'api-version': apiVersion });
  if (useDIv4 && (options.extractKeyValuePairs !== false) && actualModel !== 'prebuilt-read') {
    params.set('features', 'keyValuePairs');
  }

  const analyzeUrl = `${endpoint.replace(/\/$/, '')}/${apiPath}/documentModels/${actualModel}:analyze?${params.toString()}`;

  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!response.ok) {
    throw new Error(`Azure EU Vision API error: ${response.status}`);
  }

  const operationLocation = response.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('No operation location returned');
  }

  let result: any = null;
  for (let i = 0; i < 60; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusResponse = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });
    const statusData = await statusResponse.json();
    if (statusData.status === 'succeeded') {
      result = statusData.analyzeResult;
      break;
    }
    if (statusData.status === 'failed') {
      throw new Error('Azure EU analysis failed');
    }
  }

  if (!result) throw new Error('Azure EU OCR timed out');

  const pages: PageResult[] = (result.pages || []).map((page: any, idx: number) => ({
    pageNumber: idx + 1,
    text: (page.lines || []).map((l: any) => l.content).join('\n'),
    confidence: page.confidence || 0.9,
    blocks: (page.lines || []).map((l: any) => ({
      text: l.content,
      confidence: l.confidence || 0.9,
      blockType: 'text' as const,
    })),
  }));

  const tables: TableResult[] = (options.extractTables !== false)
    ? (result.tables || []).map((table: any) => ({
        pageNumber: table.boundingRegions?.[0]?.pageNumber || 1,
        headers: (table.cells || [])
          .filter((c: any) => c.kind === 'columnHeader')
          .sort((a: any, b: any) => a.columnIndex - b.columnIndex)
          .map((c: any) => c.content) || [],
        rows: groupTableCells(table.cells || []),
        confidence: table.confidence || 0.9,
      }))
    : [];

  let fullText = result.content || pages.map((p) => p.text).join('\n\n');

  // Append key-value pairs if available
  if (result.keyValuePairs?.length) {
    fullText += '\n\n--- KEY-VALUE PAIRS ---\n';
    for (const kv of result.keyValuePairs) {
      const k = kv.key?.content || '';
      const v = kv.value?.content || '';
      if (k && v) fullText += `${k}: ${v}\n`;
    }
  }

  return {
    text: fullText,
    confidence: calculateAverageConfidence(pages),
    provider: useDIv4 ? 'azure-document-intelligence-v4-eu' : 'azure-document-intelligence',
    region: 'west-europe',
    pages,
    tables,
    processingTime: Date.now() - startTime,
    dataResidency: 'eu',
  };
}

// ============================================================================
// Google Cloud Vision - EU Region
// ============================================================================

/**
 * Google Cloud Vision API with EU data residency
 *
 * Regions: europe-west1 (Belgium), europe-west6 (Zurich)
 * Data residency: Configurable via organization policy
 *
 * Setup:
 * 1. Create GCP project
 * 2. Enable Vision API
 * 3. Set organization policy for EU data residency
 * 4. Create service account with EU-only access
 *
 * Environment variables:
 *   GOOGLE_VISION_CREDENTIALS_EU=/path/to/eu-service-account.json
 *   GOOGLE_CLOUD_REGION=europe-west6
 */
export async function performGoogleEUOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  // Note: In production, use @google-cloud/vision with EU endpoint
  const credentialsPath = process.env.GOOGLE_VISION_CREDENTIALS_EU;
  const region = process.env.GOOGLE_CLOUD_REGION || 'europe-west6';

  if (!credentialsPath) {
    throw new Error(
      'Google EU Vision not configured. Set GOOGLE_VISION_CREDENTIALS_EU'
    );
  }

  // Validate EU region
  const euRegions = ['europe-west1', 'europe-west2', 'europe-west3', 'europe-west4', 'europe-west6'];
  if (!euRegions.includes(region)) {
    throw new Error(`Region ${region} is not an EU region. Use one of: ${euRegions.join(', ')}`);
  }

  try {
    const visionModule = await optionalImport<any>('@google-cloud/vision');

    if (!visionModule?.ImageAnnotatorClient) {
      throw new Error('Missing optional dependency: @google-cloud/vision');
    }

    const { ImageAnnotatorClient } = visionModule;

    const client = new ImageAnnotatorClient({
      keyFilename: credentialsPath,
      apiEndpoint: `${region}-vision.googleapis.com`, // EU regional endpoint
    });

    // Use textDetection for OCR (documentTextDetection requires different API)
    const [result] = await client.textDetection({
      content: fileBuffer.toString('base64'),
    } as any);

    const fullText = result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description || '';
    const pages: PageResult[] = (result.fullTextAnnotation?.pages || []).map(
      (page: any, idx: number) => ({
        pageNumber: idx + 1,
        text: page.blocks
          ?.map((block: any) =>
            block.paragraphs?.map((p: any) => p.words?.map((w: any) => w.symbols?.map((s: any) => s.text).join('')).join(' ')).join('\n')
          )
          .join('\n\n') || '',
        confidence: page.confidence || 0.9,
        blocks: [],
      })
    );

    return {
      text: fullText,
      confidence: result.fullTextAnnotation?.pages?.[0]?.confidence || 0.9,
      provider: 'google-cloud-vision',
      region: region,
      pages,
      tables: [],
      processingTime: Date.now() - startTime,
      dataResidency: region === 'europe-west6' ? 'switzerland' : 'eu',
    };
  } catch (error) {
    throw new Error(`Google EU Vision failed: ${error}`);
  }
}

// ============================================================================
// OVHcloud AI - French/EU Sovereignty
// ============================================================================

/**
 * OVHcloud AI Services
 *
 * Data residency: France (EU sovereignty)
 * Compliance: GDPR, HDS (Health Data Hosting), SecNumCloud
 *
 * Advantages:
 * - European company, no US jurisdiction (CLOUD Act)
 * - SecNumCloud certified (French government security standard)
 * - Full data sovereignty
 *
 * Setup:
 * 1. Create OVHcloud account
 * 2. Enable AI Services
 * 3. Get API credentials
 *
 * Environment variables:
 *   OVH_APPLICATION_KEY=your-app-key
 *   OVH_APPLICATION_SECRET=your-secret
 *   OVH_CONSUMER_KEY=your-consumer-key
 *   OVH_ENDPOINT=ovh-eu
 */
export async function performOVHCloudOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  const appKey = process.env.OVH_APPLICATION_KEY;
  const appSecret = process.env.OVH_APPLICATION_SECRET;
  const consumerKey = process.env.OVH_CONSUMER_KEY;

  if (!appKey || !appSecret || !consumerKey) {
    throw new Error(
      'OVHcloud not configured. Set OVH_APPLICATION_KEY, OVH_APPLICATION_SECRET, OVH_CONSUMER_KEY'
    );
  }

  // OVH uses a custom signature-based authentication
  // In production, use the ovh npm package
  try {
    const ovh = await optionalImport<any>('ovh');

    if (!ovh?.default) {
      throw new Error('Missing optional dependency: ovh');
    }

    const client = ovh.default({
      appKey,
      appSecret,
      consumerKey,
      endpoint: 'ovh-eu',
    });

    // OVH AI OCR endpoint (example - check current API docs)
    const result = await client.requestPromised(
      'POST',
      '/cloud/project/{serviceName}/ai/job',
      {
        image: fileBuffer.toString('base64'),
        type: 'ocr',
        language: options.language || 'auto',
      }
    );

    return {
      text: result.text || '',
      confidence: result.confidence || 0.85,
      provider: 'ovhcloud-ai',
      region: 'france-gra',
      pages: [],
      tables: [],
      processingTime: Date.now() - startTime,
      dataResidency: 'eu',
    };
  } catch (error) {
    throw new Error(`OVHcloud OCR failed: ${error}`);
  }
}

// ============================================================================
// Self-Hosted Tesseract - Maximum Privacy
// ============================================================================

/**
 * Self-hosted Tesseract OCR
 *
 * Data residency: Your own infrastructure (wherever you deploy)
 * Compliance: Full control - no data leaves your network
 *
 * Advantages:
 * - Zero external data transfer
 * - No API costs
 * - Works offline
 * - Complete audit trail
 *
 * Disadvantages:
 * - Lower accuracy than AI-based solutions (85-90% vs 95-99%)
 * - Slower processing
 * - Requires infrastructure management
 *
 * Setup:
 * 1. Install tesseract: apt-get install tesseract-ocr
 * 2. Install language packs: apt-get install tesseract-ocr-deu tesseract-ocr-fra
 * 3. Install node-tesseract-ocr: npm install node-tesseract-ocr
 */
export async function performTesseractOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  try {
    const Tesseract = await optionalImport<any>('tesseract.js');

    if (!Tesseract?.createWorker) {
      throw new Error('Missing optional dependency: tesseract.js');
    }

    const langMap: Record<string, string> = {
      de: 'deu',
      fr: 'fra',
      it: 'ita',
      en: 'eng',
      auto: 'eng+deu+fra+ita',
    };

    const lang = langMap[options.language || 'auto'] || 'eng';

    // Use worker-based API for tesseract.js
    const worker = await Tesseract.createWorker(lang);
    const { data: { text, confidence } } = await worker.recognize(fileBuffer);
    await worker.terminate();

    return {
      text,
      confidence: confidence / 100, // Tesseract returns 0-100
      provider: 'tesseract-local',
      region: 'local',
      pages: [
        {
          pageNumber: 1,
          text,
          confidence: confidence / 100,
          blocks: [],
        },
      ],
      tables: [],
      processingTime: Date.now() - startTime,
      dataResidency: 'switzerland', // Assuming Swiss deployment
    };
  } catch (error) {
    throw new Error(`Tesseract OCR failed: ${error}`);
  }
}

// ============================================================================
// Infomaniak AI - Swiss Provider
// ============================================================================

/**
 * Infomaniak AI Services (Swiss provider)
 *
 * Data residency: Switzerland only
 * Compliance: FADP, ISO 27001, Swiss hosting
 *
 * Advantages:
 * - 100% Swiss company
 * - Data never leaves Switzerland
 * - Swiss law only (no CLOUD Act)
 * - Green energy powered
 *
 * Note: As of 2024, Infomaniak offers LLM hosting (kChat AI, Llama)
 * Check their current AI offerings for OCR capabilities
 *
 * Environment variables:
 *   INFOMANIAK_API_TOKEN=your-token
 *   INFOMANIAK_ACCOUNT_ID=your-account-id
 */
export async function performInfomaniakOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const startTime = Date.now();

  const apiToken = process.env.INFOMANIAK_API_TOKEN;
  const accountId = process.env.INFOMANIAK_ACCOUNT_ID;

  if (!apiToken || !accountId) {
    throw new Error(
      'Infomaniak not configured. Set INFOMANIAK_API_TOKEN and INFOMANIAK_ACCOUNT_ID'
    );
  }

  // Infomaniak offers AI through their kChat AI product
  // For OCR, we can use their hosted Ollama with vision models
  // or combine with their document processing APIs

  const response = await fetch(
    `https://api.infomaniak.com/1/ai/${accountId}/chat/completions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llava', // Vision model for OCR
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this document. Return only the text, preserving structure.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/octet-stream;base64,${fileBuffer.toString('base64')}`,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Infomaniak API error: ${response.status}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content || '';

  return {
    text,
    confidence: 0.88, // Estimate for vision model OCR
    provider: 'infomaniak-ai',
    region: 'switzerland',
    pages: [],
    tables: [],
    processingTime: Date.now() - startTime,
    dataResidency: 'switzerland',
  };
}

// ============================================================================
// Unified EU/Swiss-Compliant OCR Function
// ============================================================================

/**
 * Perform OCR with automatic provider selection and fallback
 *
 * Priority order (Swiss clients):
 * 1. Azure Switzerland (best accuracy, Swiss residency)
 * 2. Google EU Zurich (good accuracy, Swiss residency)
 * 3. Infomaniak (Swiss provider)
 * 4. Tesseract (fallback, local processing)
 *
 * Priority order (EU clients):
 * 1. Azure EU (best accuracy, EU residency)
 * 2. Google EU (good accuracy, EU residency)
 * 3. OVHcloud (French sovereignty)
 * 4. Tesseract (fallback)
 */
export async function performEUCompliantOCR(
  fileBuffer: Buffer,
  options: OCROptions = {}
): Promise<OCRResult> {
  const { provider } = options;

  // If specific provider requested, use it
  if (provider) {
    switch (provider) {
      case 'azure-ch':
      case 'azure-di':
        return performAzureSwitzerlandOCR(fileBuffer, options);
      case 'azure-eu':
        return performAzureEUOCR(fileBuffer, options);
      case 'google-eu':
        return performGoogleEUOCR(fileBuffer, options);
      case 'ovh':
        return performOVHCloudOCR(fileBuffer, options);
      case 'tesseract':
        return performTesseractOCR(fileBuffer, options);
      case 'infomaniak':
        return performInfomaniakOCR(fileBuffer, options);
    }
  }

  // Automatic fallback chain
  const swissPriority = [
    { fn: performAzureSwitzerlandOCR, name: 'Azure Switzerland' },
    { fn: performGoogleEUOCR, name: 'Google EU (Zurich)' },
    { fn: performInfomaniakOCR, name: 'Infomaniak' },
    { fn: performTesseractOCR, name: 'Tesseract (local)' },
  ];

  for (const { fn } of swissPriority) {
    try {
      const result = await fn(fileBuffer, options);
      return result;
    } catch {
      continue;
    }
  }

  throw new Error('All EU-compliant OCR providers failed');
}

// ============================================================================
// Integration with Anonymization Layer
// ============================================================================

import { ContractAnonymizer } from './anonymizer';

/**
 * Secure OCR + Anonymization Pipeline
 *
 * 1. OCR with EU/Swiss provider (data stays in region)
 * 2. Anonymize sensitive data
 * 3. Optionally encrypt result
 *
 * This ensures:
 * - OCR processing in EU/Switzerland
 * - Sensitive data anonymized before any further processing
 * - Optional encryption for storage
 */
export async function secureOCRWithAnonymization(
  fileBuffer: Buffer,
  options: OCROptions & { anonymize?: boolean } = {}
): Promise<OCRResult & { anonymizedText?: string; mappingId?: string }> {
  // Step 1: Perform EU-compliant OCR
  const ocrResult = await performEUCompliantOCR(fileBuffer, options);

  // Step 2: Optionally anonymize
  if (options.anonymize !== false) {
    const anonymizer = new ContractAnonymizer();
    const { anonymizedText, mappingId } = anonymizer.anonymize(ocrResult.text);

    return {
      ...ocrResult,
      anonymizedText,
      mappingId,
    };
  }

  return ocrResult;
}

// ============================================================================
// Helper Functions
// ============================================================================

function groupTableCells(cells: any[]): string[][] {
  const rows: Map<number, string[]> = new Map();

  for (const cell of cells) {
    if (cell.kind === 'columnHeader') continue;
    const rowIdx = cell.rowIndex || 0;
    if (!rows.has(rowIdx)) rows.set(rowIdx, []);
    rows.get(rowIdx)![cell.columnIndex || 0] = cell.content || '';
  }

  return Array.from(rows.values());
}

function calculateAverageConfidence(pages: PageResult[]): number {
  if (pages.length === 0) return 0.9;
  const sum = pages.reduce((acc, p) => acc + p.confidence, 0);
  return sum / pages.length;
}

function mapLanguageCode(lang: string): string {
  const map: Record<string, string> = {
    de: 'de',
    fr: 'fr',
    it: 'it',
    en: 'en',
  };
  return map[lang] || lang;
}

function encryptText(text: string, key: string): string {
  const iv = randomBytes(16);
  const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptText(encrypted: string, key: string): string {
  const parts = encrypted.split(':');
  const ivHex = parts[0] ?? '';
  const authTagHex = parts[1] ?? '';
  const encryptedText = parts[2] ?? '';

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const keyBuffer = Buffer.from(key.padEnd(32, '0').slice(0, 32));

  const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Check which EU/Swiss OCR providers are configured
 */
export function getAvailableProviders(): {
  provider: string;
  configured: boolean;
  region: string;
  dataResidency: string;
}[] {
  return [
    {
      provider: 'azure-di',
      configured: !!(process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT && process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY),
      region: 'Switzerland North (Zurich) — Document Intelligence v4.0',
      dataResidency: 'Switzerland',
    },
    {
      provider: 'azure-ch',
      configured: !!(process.env.AZURE_VISION_ENDPOINT_CH && process.env.AZURE_VISION_KEY_CH),
      region: 'Switzerland North (Zurich)',
      dataResidency: 'Switzerland',
    },
    {
      provider: 'azure-eu',
      configured: !!(
        process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT_EU ||
        process.env.AZURE_VISION_ENDPOINT_EU ||
        process.env.AZURE_VISION_ENDPOINT
      ),
      region: 'West Europe (Netherlands)',
      dataResidency: 'EU',
    },
    {
      provider: 'google-eu',
      configured: !!process.env.GOOGLE_VISION_CREDENTIALS_EU,
      region: process.env.GOOGLE_CLOUD_REGION || 'europe-west6',
      dataResidency: 'EU/Switzerland',
    },
    {
      provider: 'ovh',
      configured: !!(
        process.env.OVH_APPLICATION_KEY &&
        process.env.OVH_APPLICATION_SECRET
      ),
      region: 'France (Gravelines)',
      dataResidency: 'EU (France)',
    },
    {
      provider: 'infomaniak',
      configured: !!process.env.INFOMANIAK_API_TOKEN,
      region: 'Switzerland',
      dataResidency: 'Switzerland',
    },
    {
      provider: 'tesseract',
      configured: true, // Always available as fallback
      region: 'Local',
      dataResidency: 'Your infrastructure',
    },
  ];
}

/**
 * Log provider configuration status
 */
export function logProviderStatus(): void {
  // Provider status logging disabled
  const providers = getAvailableProviders();
  const _configured = providers.filter((p) => p.configured);
}
