// Batch upload a folder of contracts to the API and poll status until complete
// Usage:
//   node scripts/batch-upload.mjs ./my-contracts --url http://localhost:3011 --chunk 10 --interval 2000 --timeout 600000
// Notes:
// - Sends files under the given directory individually to POST /uploads (compatible with API)
// - Polls GET /contracts/:docId/status until all are completed or timeout

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args[0] || args[0].startsWith('-')) {
  console.error('Usage: node scripts/batch-upload.mjs <dir> [--url URL] [--chunk N] [--interval ms] [--timeout ms]');
  process.exit(1);
}

const dir = path.resolve(args[0]);
const getArg = (k, def) => {
  const idx = args.indexOf(k);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return def;
};
const baseUrl = getArg('--url', process.env.API_URL || 'http://localhost:3001');
const chunkSize = parseInt(getArg('--chunk', '10'), 10) || 10;
const pollInterval = parseInt(getArg('--interval', '2000'), 10) || 2000;
const timeoutMs = parseInt(getArg('--timeout', '600000'), 10) || 600000; // 10 min

function readFilesFromDir(d) {
  const all = fs.readdirSync(d);
  const allowed = all.filter(f => /\.(pdf|txt|docx?)$/i.test(f));
  return allowed.map(name => ({ name, abs: path.join(d, name) }));
}

async function postOne(file) {
  const fd = new FormData();
  const data = fs.readFileSync(file.abs);
  const blob = new Blob([data]);
  fd.append('file', blob, file.name);
  const res = await fetch(`${baseUrl}/uploads`, { method: 'POST', body: fd });
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return { status: res.status, json: JSON.parse(text) };
  } catch {
    return { status: res.status, text };
  }
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function pollStatuses(ids) {
  const start = Date.now();
  let done = new Set();
  while (true) {
    const res = await Promise.all(ids.map(async (id) => {
      const r = await getJson(`${baseUrl}/contracts/${id}/status`);
      const state = r.json?.state || 'unknown';
      if (state === 'completed') done.add(id);
      return { id, state, stages: r.json?.stages };
    }));
    const completed = res.filter(r => r.state === 'completed').length;
    const failed = res.filter(r => r.state === 'failed').length;
    const pct = Math.round((completed / Math.max(1, ids.length)) * 100);
    process.stdout.write(`\r[batch] progress ${completed}/${ids.length} completed, ${failed} failed (${pct}%)   `);
    if (completed + failed >= ids.length) {
      process.stdout.write('\n');
      return res;
    }
    if (Date.now() - start > timeoutMs) {
      process.stdout.write('\n');
      throw new Error('Timeout waiting for batch to complete');
    }
    await new Promise(r => setTimeout(r, pollInterval));
  }
}

async function main() {
  console.log(`[batch] Base URL: ${baseUrl}`);
  const health = await getJson(`${baseUrl}/healthz`);
  if (health.status !== 200) {
    console.error('[batch] API not healthy:', health);
    process.exit(1);
  }
  console.log('[batch] Health OK');

  const files = readFilesFromDir(dir);
  if (!files.length) {
    console.error(`[batch] No files matching .pdf/.txt/.docx found in ${dir}`);
    process.exit(1);
  }
  console.log(`[batch] Found ${files.length} files in ${dir}`);

  const chunks = chunk(files, chunkSize);
  const allIds = [];
  for (let i = 0; i < chunks.length; i++) {
    const group = chunks[i];
    console.log(`[batch] Uploading chunk ${i + 1}/${chunks.length} (${group.length} files)`);
    const ids = [];
    for (const f of group) {
      const up = await postOne(f);
      if ((up.status !== 200 && up.status !== 201) || !up.json?.docId) {
        console.error('[batch] Upload error:', up);
        process.exit(1);
      }
      ids.push(up.json.docId);
    }
    console.log(`[batch] Received ${ids.length} docIds`);
    allIds.push(...ids);
  }

  console.log(`[batch] Total docIds: ${allIds.length}. Polling statuses...`);
  const results = await pollStatuses(allIds);
  const failed = results.filter(r => r.state === 'failed');
  const ok = results.filter(r => r.state === 'completed');
  console.log(`[batch] Completed: ${ok.length}, Failed: ${failed.length}`);
  if (failed.length) {
    console.log('[batch] Failed IDs:', failed.map(f => f.id));
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('[batch] failed:', e);
  process.exit(1);
});
