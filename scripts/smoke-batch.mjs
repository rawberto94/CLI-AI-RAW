#!/usr/bin/env node
/*
  E2E smoke for UI batch upload → backend → workers.
  - Posts 2 files to web /api/upload/batch
  - Prints items
  - Polls API /contracts/:docId/status for progress
*/
const API = process.env.API_URL || 'http://localhost:3001';
const WEB = process.env.WEB_URL || 'http://localhost:3002';
const TENANT = process.argv.includes('--tenant') ? process.argv[process.argv.indexOf('--tenant') + 1] : (process.env.TENANT_ID || 'demo');
const FILE_PATH = process.argv[2] || 'tmp/sample-contract.txt';

async function postBatchThroughWeb(filePath) {
  const fs = await import('fs');
  const { statSync, readFileSync } = fs.default;
  statSync(filePath);
  const data = readFileSync(filePath);
  const fd = new FormData();
  const blob = new Blob([data], { type: 'text/plain' });
  // send twice to simulate multi-file
  fd.append('files', blob, 'sample-1.txt');
  fd.append('files', blob, 'sample-2.txt');
  const resp = await fetch(`${WEB}/api/upload/batch`, {
    method: 'POST',
    headers: { 'x-tenant-id': TENANT },
    body: fd,
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`web batch failed: ${resp.status} ${text}`);
  }
  try { return JSON.parse(text); } catch {
    throw new Error(`invalid json: ${text.slice(0,200)}`);
  }
}

async function pollStatus(docId, timeoutMs = 60000, intervalMs = 1500) {
  const end = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < end) {
    const r = await fetch(`${API}/contracts/${docId}/status`);
    last = await r.json().catch(() => null);
    if (last && last.stages) {
      const ready = Object.values(last.stages).filter(Boolean).length;
      const total = Object.keys(last.stages).length;
      process.stdout.write(`\rstatus ${ready}/${total} stages ready`);
      if (ready >= 3) break; // minimal ingestion+overview+clauses
    }
    await new Promise(res => setTimeout(res, intervalMs));
  }
  process.stdout.write('\n');
  return last;
}

(async () => {
  console.log(`[smoke-batch] Web: ${WEB}  API: ${API}`);
  const out = await postBatchThroughWeb(FILE_PATH);
  console.log('[smoke-batch] upload result:', out);
  const first = out.items?.[0]?.docId;
  if (!first) throw new Error('no items returned');
  const status = await pollStatus(first, 90000);
  console.log('\n[smoke-batch] final status:', JSON.stringify(status, null, 2));
})().catch(err => { console.error('[smoke-batch] failed:', err); process.exit(1); });
