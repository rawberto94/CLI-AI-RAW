/**
 * Standalone DI OCR + artifact smoke test.
 *
 * Loads local .env and runs Azure Document Intelligence layout analysis on
 * public/realistic_contract.pdf, then prints extracted text, tables, and
 * query-field answers so we can verify the pipeline end-to-end without
 * depending on the web container's DEMO_SKIP_OCR flag.
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import {
  analyzeLayout,
  analyzeWithQueries,
  checkDIHealth,
  isDIConfigured,
} from '../packages/workers/src/azure-document-intelligence';


async function main() {
  console.log('=== DI Setup Check ===');
  console.log('Configured:', isDIConfigured());
  const health = await checkDIHealth();
  console.log('Health:', JSON.stringify(health, null, 2));

  if (!health.configured || !health.reachable) {
    throw new Error('DI not reachable');
  }

  const pdfPath = path.resolve(process.cwd(), 'public/realistic_contract.pdf');
  const buffer = await fs.readFile(pdfPath);
  console.log(`\n=== OCR Test ===`);
  console.log(`File: ${pdfPath} (${buffer.length} bytes)`);

  const start = Date.now();
  const layout = await analyzeLayout(buffer, { extractKeyValuePairs: true });
  const duration = Date.now() - start;

  console.log(`\nLayout analysis completed in ${duration}ms`);
  console.log(`Pages: ${layout.pages?.length ?? 0}`);
  console.log(`Tables: ${layout.tables?.length ?? 0}`);
  console.log(`Key-value pairs: ${layout.keyValuePairs?.length ?? 0}`);
  console.log(`Paragraphs: ${layout.paragraphs?.length ?? 0}`);
  console.log(`Content length: ${layout.content?.length ?? 0}`);

  console.log(`\n--- Extracted text (first 1500 chars) ---`);
  console.log(layout.content?.substring(0, 1500));

  if (layout.tables?.length) {
    console.log(`\n--- Tables ---`);
    for (const table of layout.tables.slice(0, 3)) {
      console.log(`Table ${table.pageNumber}: ${table.rowCount}x${table.columnCount}`);
      console.log('Headers:', table.headers);
      for (const row of table.rows.slice(0, 5)) {
        console.log('Row:', row);
      }
    }
  }

  if (layout.keyValuePairs?.length) {
    console.log(`\n--- Key-value pairs ---`);
    for (const kv of layout.keyValuePairs.slice(0, 10)) {
      console.log(`${kv.key}: ${kv.value} (conf=${kv.confidence})`);
    }
  }

  console.log(`\n=== Query-field enrichment ===`);
  // DI query field names must match ^[\p{L}\p{M}\p{N}_]{1,64}$ (no spaces/punctuation).
  const queryFields = [
    'contractTitle',
    'totalContractValue',
    'contractCurrency',
    'effectiveDate',
    'expirationDate',
    'governingLaw',
    'contractingParties',
    'clientName',
    'supplierName',
    'signatureStatus',
  ];
  const queryStart = Date.now();
  const { answers } = await analyzeWithQueries(buffer, queryFields);
  const queryDuration = Date.now() - queryStart;
  console.log(`Query analysis completed in ${queryDuration}ms`);
  console.log('Raw answers:', JSON.stringify(answers, null, 2));

  console.log('Answers:', JSON.stringify(answers, null, 2));
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
