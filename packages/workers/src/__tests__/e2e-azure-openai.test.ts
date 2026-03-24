/**
 * Azure OpenAI + DI Pipeline E2E Integration Tests
 *
 * These tests are SKIPPED by default and only run when Azure OpenAI credentials
 * are provided via environment variables:
 *
 *   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
 *   AZURE_OPENAI_API_KEY=your-key
 *   AZURE_OPENAI_DEPLOYMENT=gpt-4o        (default)
 *
 * To run:
 *   AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_API_KEY=... vitest run src/__tests__/e2e-azure-openai.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01';

const isConfigured = !!(AZURE_ENDPOINT && AZURE_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Call Azure OpenAI chat completions and return the response JSON */
async function callAzureOpenAI(
  systemPrompt: string,
  userContent: string,
  deployment = AZURE_DEPLOYMENT,
): Promise<any> {
  if (!AZURE_ENDPOINT || !AZURE_KEY) throw new Error('Azure OpenAI not configured');

  const url = `${AZURE_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${AZURE_API_VERSION}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': AZURE_KEY },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Azure OpenAI ${res.status}: ${body}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Azure OpenAI');
  return JSON.parse(content);
}

// ─── Fixture: sample contract text ──────────────────────────────────────────

const SAMPLE_CONTRACT_TEXT = `
STATEMENT OF WORK

Agreement No: SOW-2024-001
Date: January 15, 2024

PARTIES:
- Client: Contigo Labs AG, Bahnhofstrasse 10, 8001 Zurich, Switzerland
- Vendor: TechServ GmbH, Hardstrasse 201, 8005 Zurich, Switzerland

SCOPE OF WORK:
Vendor shall provide software development services for a contract management platform
including Azure Document Intelligence integration, AI artifact generation, and
a web-based user interface.

TERM: January 15, 2024 – December 31, 2024

FINANCIAL TERMS:
- Monthly retainer: CHF 25,000
- Total contract value: CHF 300,000
- Payment terms: Net 30 days

GOVERNING LAW: Swiss law, Canton of Zurich
`.trim();

// ─── Tests ───────────────────────────────────────────────────────────────────

describe.skipIf(!isConfigured)('Azure OpenAI E2E integration', () => {
  it('Azure OpenAI endpoint is reachable and returns valid JSON', async () => {
    const result = await callAzureOpenAI(
      'You are a helpful assistant. Return a JSON object with a single field "status" set to "ok".',
      'Ping',
    );
    expect(result).toHaveProperty('status', 'ok');
  }, 30_000);

  it('generates OVERVIEW artifact from sample contract text', async () => {
    const systemPrompt = `You are a contract analysis AI. Always return a valid JSON object.`;
    const userPrompt = `Analyze this contract and return a JSON object with these fields:
{
  "summary": "2-3 sentence summary",
  "parties": [{"name": "string", "role": "string"}],
  "effectiveDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "totalValue": number or null,
  "currency": "string or null",
  "jurisdiction": "string or null",
  "contractType": "string",
  "certainty": number between 0 and 1
}

Contract text:
${SAMPLE_CONTRACT_TEXT}`;

    const result = await callAzureOpenAI(systemPrompt, userPrompt);

    expect(result).toBeDefined();
    expect(typeof result.summary).toBe('string');
    expect(result.summary.length).toBeGreaterThan(20);

    expect(Array.isArray(result.parties)).toBe(true);
    expect(result.parties.length).toBeGreaterThanOrEqual(2);

    // Azure DI pre-validated dates should match
    expect(result.effectiveDate).toBe('2024-01-15');
    expect(result.expirationDate).toBe('2024-12-31');

    // Financial values
    expect(result.totalValue).toBe(300000);
    expect(result.currency).toMatch(/CHF/i);

    // Jurisdiction
    expect(result.jurisdiction?.toLowerCase()).toContain('swiss');

    expect(result.certainty).toBeGreaterThan(0.5);

    console.log('OVERVIEW result:', JSON.stringify(result, null, 2));
  }, 60_000);

  it('handles DI table context — generates FINANCIAL artifact from JSON table data', async () => {
    // Simulate the JSON table format we now pass to AI (as per tables-as-JSON improvement)
    const tableJson = JSON.stringify({
      tableIndex: 1,
      pageNumber: 2,
      confidence: 0.95,
      headers: ['Description', 'Quantity', 'Unit Price (CHF)', 'Total (CHF)'],
      rows: [
        ['Software Development', '160h', '150', '24,000'],
        ['Project Management', '40h', '175', '7,000'],
        ['Total', '', '', '31,000'],
      ],
    }, null, 2);

    const systemPrompt = `You are a contract financial analysis AI. Always return valid JSON.`;
    const userPrompt = `Extract financial data from this contract table (in JSON format) and return:
{
  "lineItems": [{"description": "string", "quantity": number, "unitPrice": number, "amount": number}],
  "totalValue": number,
  "currency": "string",
  "certainty": number
}

PRE-VALIDATED TABLE AS JSON:
${tableJson}`;

    const result = await callAzureOpenAI(systemPrompt, userPrompt);

    expect(result).toBeDefined();
    expect(Array.isArray(result.lineItems)).toBe(true);
    expect(result.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(result.totalValue).toBeGreaterThan(0);
    expect(result.currency).toMatch(/CHF/i);

    console.log('FINANCIAL result:', JSON.stringify(result, null, 2));
  }, 60_000);

  it('handles multilingual contract with locale guidance', async () => {
    const germanContract = `
ARBEITSVERTRAG (DIENSTLEISTUNGSVERTRAG)

Vertragsnummer: AV-2024-001
Datum: 15.01.2024

PARTEIEN:
- Auftraggeber: Musterfirma AG, Bahnhofstrasse 5, 8001 Zürich
- Auftragnehmer: Dienstleister GmbH, Hardstrasse 10, 8005 Zürich

LEISTUNGSUMFANG: Softwareentwicklung und IT-Beratung

VERTRAGSLAUFZEIT: 15.01.2024 – 31.12.2024
VERGÜTUNG: CHF 15'000 pro Monat, zahlbar innerhalb von 30 Tagen
GESAMTWERT: CHF 180'000

ANWENDBARES RECHT: Schweizer Recht, Kanton Zürich
`.trim();

    const systemPrompt = `You are a multilingual contract analysis AI. Always return valid JSON.
[de-CH] Swiss German: dates are DD.MM.YYYY, currency CHF, decimal separator dot (1'234.56).
Apply locale-specific parsing for dates and currency amounts.`;

    const userPrompt = `Analyze this German-language Swiss contract and return JSON:
{
  "parties": [{"name": "string", "role": "string"}],
  "effectiveDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "totalValue": number,
  "currency": "string",
  "language": "string",
  "certainty": number
}

Contract:
${germanContract}`;

    const result = await callAzureOpenAI(systemPrompt, userPrompt);

    expect(result).toBeDefined();
    expect(result.effectiveDate).toBe('2024-01-15');
    expect(result.expirationDate).toBe('2024-12-31');
    expect(result.totalValue).toBe(180000);
    expect(result.currency).toMatch(/CHF/i);
    expect(result.language?.toLowerCase()).toMatch(/german|deutsch/i);

    console.log('Multilingual result:', JSON.stringify(result, null, 2));
  }, 60_000);
});

describe.skipIf(!isConfigured)('Azure OpenAI — DI_METADATA confidence warning flow', () => {
  it('acts cautiously when given low OCR confidence warning', async () => {
    const systemPrompt = `You are a contract analysis AI. Always return valid JSON.`;
    const userPrompt = `WORD-LEVEL OCR QUALITY:
  Average confidence: 58.3%, Total words: 450, Low-confidence words (<70%): 187 (41.6%)
  WARNING: More than 20% of words have low OCR confidence. Treat extracted values with elevated scrutiny.

Based on this low-quality OCR document, extract what you can and set "lowQualityOCR": true in your response.
Return JSON: { "lowQualityOCR": boolean, "extractionNote": "string", "certainty": number }

Contract text (may contain OCR errors): Th1s 1s a c0ntract f0r $ervice5 b3tween P4rty A and P4rty B...`;

    const result = await callAzureOpenAI(systemPrompt, userPrompt);

    expect(result).toBeDefined();
    expect(result.lowQualityOCR).toBe(true);
    expect(result.certainty).toBeLessThan(0.7);

    console.log('Low confidence result:', JSON.stringify(result, null, 2));
  }, 30_000);
});
