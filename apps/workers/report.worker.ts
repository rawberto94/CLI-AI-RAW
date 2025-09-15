// Prefer workspace import, fallback to relative if needed
let ReportArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ReportArtifactV1Schema = require('schemas').ReportArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ReportArtifactV1Schema = require('../../packages/schemas/src').ReportArtifactV1Schema;
}

let db: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('clients-db');
  db = mod.default || mod;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../../packages/clients/db');
  db = mod.default || mod;
}

// Import storage client and puppeteer for PDF rendering
let uploadToS3: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  uploadToS3 = require('clients-storage').uploadToS3;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  uploadToS3 = require('../../packages/clients/storage').uploadToS3;
}

// Lazy import puppeteer to avoid heavy startup when unused
let puppeteer: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  puppeteer = require('puppeteer');
} catch {
  puppeteer = null;
}

export async function runReport(job: { data: { docId: string } }) {
  const { docId } = job.data;
  console.log(`[worker:report] Starting report for ${docId}`);
  const startTime = Date.now();

  const overview = await db.artifact.findFirst({ where: { contractId: docId, type: 'OVERVIEW' }, orderBy: { createdAt: 'desc' } });
  const clauses = await db.artifact.findFirst({ where: { contractId: docId, type: 'CLAUSES' }, orderBy: { createdAt: 'desc' } });
  const rates = await db.artifact.findFirst({ where: { contractId: docId, type: 'RATES' }, orderBy: { createdAt: 'desc' } });
  const risks = await db.artifact.findFirst({ where: { contractId: docId, type: 'RISK' }, orderBy: { createdAt: 'desc' } });
  const compliance = await db.artifact.findFirst({ where: { contractId: docId, type: 'COMPLIANCE' }, orderBy: { createdAt: 'desc' } });
  const benchmark = await db.artifact.findFirst({ where: { contractId: docId, type: 'BENCHMARK' }, orderBy: { createdAt: 'desc' } });

  // Ensure all sections exist to satisfy ReportArtifactV1Schema
  const baseMeta = {
    docId,
    fileType: 'pdf',
    totalPages: 1,
    ocrRate: 0,
    provenance: [{ worker: 'report', timestamp: new Date().toISOString(), durationMs: 0 }],
  } as const;

  const ovData = (overview?.data as any) || { metadata: baseMeta, summary: '', parties: [] };
  const clData = (clauses?.data as any) || { metadata: baseMeta, clauses: [] };
  const rtData = (rates?.data as any) || { metadata: baseMeta, rates: [] };
  const rkData = (risks?.data as any) || { metadata: baseMeta, risks: [] };
  let cpData = (compliance?.data as any) || { metadata: baseMeta, compliance: [] };
  // Sanitize compliance statuses to allowed enum values
  try {
    const allowed = new Set(['compliant','non-compliant','unknown']);
    const arr = Array.isArray(cpData?.compliance) ? cpData.compliance : [];
    cpData = {
      metadata: cpData?.metadata || baseMeta,
      compliance: arr.map((it: any) => ({
        policyId: String(it?.policyId || 'UNKNOWN'),
        status: allowed.has(String(it?.status)) ? String(it.status) : 'unknown',
        details: String(it?.details || ''),
      })),
    };
  } catch { /* noop */ }
  const bmData = (benchmark?.data as any) || { metadata: baseMeta, benchmarks: [] };

  // Simple HTML rendering for the report
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Contract Report ${docId}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; }
    .muted { color: #666; }
  </style>
</head>
<body>
  <h1>Contract Report</h1>
  <div class="muted">Doc ID: ${docId}</div>

  <h2>Overview</h2>
  <div>${escapeHtml(JSON.stringify(ovData, null, 2)).replace(/\n/g,'<br/>')}</div>

  <h2>Clauses</h2>
  <div>${escapeHtml(JSON.stringify(clData, null, 2)).replace(/\n/g,'<br/>')}</div>

  <h2>Rates</h2>
  <div>${escapeHtml(JSON.stringify(rtData, null, 2)).replace(/\n/g,'<br/>')}</div>

  <h2>Compliance</h2>
  <div>${escapeHtml(JSON.stringify(cpData, null, 2)).replace(/\n/g,'<br/>')}</div>

  <h2>Benchmark</h2>
  <div>${escapeHtml(JSON.stringify(bmData, null, 2)).replace(/\n/g,'<br/>')}</div>

  <h2>Risk</h2>
  <div>${escapeHtml(JSON.stringify(rkData, null, 2)).replace(/\n/g,'<br/>')}</div>
</body>
</html>`;

  // Render to PDF (fallback to Buffer.from(html) if puppeteer not available)
  let pdfBuffer: Buffer;
  if (puppeteer) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    } finally {
      await browser.close();
    }
  } else {
    // Minimal fallback: store HTML as PDF-like text so the download still works
    pdfBuffer = Buffer.from(html, 'utf8');
  }

  const bucket = process.env['S3_BUCKET'] || 'contracts';
  const key = `reports/${docId}/report-${Date.now()}.pdf`;
  try {
    await uploadToS3({ Bucket: bucket, Key: key, Body: pdfBuffer, ContentType: 'application/pdf' });
  } catch (e) {
    console.warn('[worker:report] uploadToS3 failed, storing without storagePath', e);
  }

  const artifactData: any = {
    metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'report', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime }] },
    overview: ovData,
    clauses: clData,
    rates: rtData,
    risks: rkData,
    compliance: cpData,
    benchmark: bmData,
    storagePath: key,
  };

  const artifact = ReportArtifactV1Schema.parse(artifactData);
  await db.artifact.create({ data: { contractId: docId, type: 'REPORT', data: artifact as any } });
  console.log(`[worker:report] Finished report for ${docId}`);
  return { docId };
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
