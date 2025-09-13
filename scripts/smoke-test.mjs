// Simple E2E smoke test: upload two files via batch endpoint and fetch artifacts
// Usage: node scripts/smoke-test.mjs [baseUrl]
// Defaults: baseUrl = http://localhost:3001

import fs from 'node:fs';
import path from 'node:path';

const baseUrl = process.argv[2] || process.env.API_URL || 'http://localhost:3001';

async function postBatch(files) {
  const fd = new FormData();
  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const blob = new Blob([data]);
    fd.append('files', blob, f.name);
  }
  const res = await fetch(`${baseUrl}/uploads/batch`, {
    method: 'POST',
    body: fd,
    headers: { 'x-tenant-id': 'demo' },
  });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'x-tenant-id': 'demo' } });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollStatus(docId, timeout = 30000, interval = 2000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const res = await getJson(`${baseUrl}/api/contracts/${docId}/status`);
    if (res.status === 200 && res.json.status === 'COMPLETED') {
      console.log(`[smoke] status for ${docId} is COMPLETED`);
      return true;
    }
    console.log(`[smoke] waiting for ${docId}, current status: ${res.json?.status || 'unknown'}`);
    await sleep(interval);
  }
  console.error(`[smoke] timeout waiting for ${docId} to complete`);
  return false;
}

async function main() {
  console.log(`[smoke] Base URL: ${baseUrl}`);
  const health = await getJson(`${baseUrl}/healthz`);
  console.log('[smoke] healthz:', health);

  const pdf = path.resolve('apps/workers/test/fixtures/sample.pdf');
  const txt = path.resolve('tmp/sample-contract.txt');
  if (!fs.existsSync(pdf)) throw new Error(`Missing file: ${pdf}`);
  if (!fs.existsSync(txt)) throw new Error(`Missing file: ${txt}`);

  const up = await postBatch([
    { abs: pdf, name: 'sample.pdf' },
    { abs: txt, name: 'sample-contract.txt' },
  ]);
  console.log('[smoke] upload response:', up);
  if (!up.json || !Array.isArray(up.json.items)) {
    console.error('[smoke] upload did not return items array');
    process.exit(1);
  }
  const ids = up.json.items.map(it => it.docId);
  console.log('[smoke] docIds:', ids);

  // Fetch artifacts for first doc
  const first = ids[0];
  if (!first) {
    console.error('[smoke] no ids returned');
    process.exit(1);
  }

  // --- Wait for async processing ---
  const completed = await pollStatus(first);
  if (!completed) {
    process.exit(1);
  }

  const arts = await getJson(`${baseUrl}/api/contracts/${first}/artifacts`);
  console.log(`[smoke] artifacts bundle (${first}):`, arts.status, Object.keys(arts.json || {}));
  const sections = ['ingestion','overview','clauses','rates','compliance','benchmark','risk'];
  for (const s of sections) {
    const r = await getJson(`${baseUrl}/api/contracts/${first}/artifacts/${s}.json`);
    console.log(`[smoke] section ${s}:`, r.status, typeof r.json === 'object' ? 'ok' : r.text?.slice(0,120));
  }
}

main().catch((e) => {
  console.error('[smoke] failed:', e);
  process.exit(1);
});
