#!/usr/bin/env node
// Minimal RAG smoke test with tenant header
// Usage: node scripts/smoke-rag.mjs [docId] [q] [--url http://localhost:3001] [--tenant demo]

const args = process.argv.slice(2);
const getArg = (k, def) => { const idx = args.indexOf(k); return idx>=0 && args[idx+1] && !args[idx+1].startsWith('--') ? args[idx+1] : def; };
const baseUrl = getArg('--url', process.env.API_URL || 'http://localhost:3001');
const tenant = getArg('--tenant', process.env.TENANT_ID || 'demo');
const docId = args[0] || process.env.RAG_DOC_ID || '';
const q = args[1] || 'what is the rate';

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, text }; }
}

(async function main(){
  console.log(`[rag] url=${baseUrl} tenant=${tenant} docId=${docId} q=${q}`);
  const health = await getJson(`${baseUrl}/healthz`);
  console.log('[rag] health:', health.status);
  if (!docId) { console.error('[rag] missing docId'); process.exit(2); }
  const url = `${baseUrl}/api/rag/search?` + new URLSearchParams({ docId, q }).toString();
  const r = await getJson(url, { 'x-tenant-id': tenant });
  console.log('[rag] result:', r.status, Array.isArray(r.json?.items) ? r.json.items.slice(0,3) : r.text);
  if (r.status !== 200) process.exit(1);
})();
