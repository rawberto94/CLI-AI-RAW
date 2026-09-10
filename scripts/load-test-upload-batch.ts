/**
 * Pipeline load test for 20–30 page contract batches.
 *
 * Usage:
 *   npx tsx scripts/load-test-upload-batch.ts --dir ./fixtures/contracts --base-url http://localhost:3000
 *
 * Measures HTTP upload time only unless --wait-processing is set (polls /status).
 */
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

const args = process.argv.slice(2);
function flag(name: string, fallback?: string) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1] || fallback;
}

const dir = flag('dir', './uploads');
const baseUrl = flag('base-url', process.env.BASE_URL || 'http://localhost:3000');
const tenantId = flag('tenant', process.env.TENANT_ID || '');
const cookie = flag('cookie', process.env.COOKIE || '');
const waitProcessing = args.includes('--wait-processing');
const concurrency = Number(flag('concurrency', '4'));

async function listPdfs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await listPdfs(path));
    else if (/\.pdf$/i.test(entry.name)) files.push(path);
  }
  return files;
}

async function uploadOne(path: string): Promise<{ file: string; uploadMs: number; contractId?: string; error?: string; processMs?: number }> {
  const started = Date.now();
  const bytes = await readFile(path);
  const form = new FormData();
  form.set('file', new Blob([bytes], { type: 'application/pdf' }), path.split('/').pop() || 'contract.pdf');
  form.set('priority', 'high');

  const headers: Record<string, string> = {};
  if (tenantId) headers['x-tenant-id'] = tenantId;
  if (cookie) headers['cookie'] = cookie;

  const res = await fetch(`${baseUrl}/api/contracts/upload`, { method: 'POST', body: form, headers });
  const uploadMs = Date.now() - started;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { file: path, uploadMs, error: json?.error?.message || json?.error || res.statusText };
  }
  const contractId = json?.data?.contractId || json?.contractId;
  if (!waitProcessing || !contractId) {
    return { file: path, uploadMs, contractId };
  }

  const processStarted = Date.now();
  for (let i = 0; i < 120; i++) {
    const statusRes = await fetch(`${baseUrl}/api/contracts/${contractId}/status`, { headers });
    const statusJson = await statusRes.json().catch(() => ({}));
    const status = String(statusJson?.data?.status || statusJson?.status || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'FAILED') {
      return {
        file: path,
        uploadMs,
        contractId,
        processMs: Date.now() - processStarted,
        error: status === 'FAILED' ? (statusJson?.data?.error || 'processing failed') : undefined,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return { file: path, uploadMs, contractId, processMs: Date.now() - processStarted, error: 'processing timeout' };
}

async function main() {
  const info = await stat(dir!).catch(() => null);
  if (!info?.isDirectory()) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }
  const files = (await listPdfs(dir!)).slice(0, 10);
  console.log(`Uploading ${files.length} PDFs to ${baseUrl} (concurrency ${concurrency})`);
  const results: Awaited<ReturnType<typeof uploadOne>>[] = [];
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(uploadOne)));
  }
  const ok = results.filter((r) => !r.error);
  const uploadTimes = ok.map((r) => r.uploadMs).sort((a, b) => a - b);
  const p95 = uploadTimes[Math.min(uploadTimes.length - 1, Math.floor(uploadTimes.length * 0.95))] || 0;
  console.table(results.map((r) => ({
    file: r.file.split('/').pop(),
    uploadMs: r.uploadMs,
    processMs: r.processMs ?? '',
    contractId: r.contractId ?? '',
    error: r.error ?? '',
  })));
  console.log(`OK ${ok.length}/${results.length}  upload p95 ${p95}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
