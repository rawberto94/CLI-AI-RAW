// Prefer workspace import, fallback to relative if needed
let BenchmarkArtifactV1Schema: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BenchmarkArtifactV1Schema = require('schemas').BenchmarkArtifactV1Schema;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BenchmarkArtifactV1Schema = require('../../packages/schemas/src').BenchmarkArtifactV1Schema;
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

export async function runBenchmark(job: { data: { docId: string; tenantId?: string } }) {
  const { docId, tenantId } = job.data;
  console.log(`[worker:benchmark] Starting benchmark analysis for ${docId}`);
  const startTime = Date.now();
  
  // Get contract to ensure we have tenantId
  const contract = await db.contract.findUnique({ where: { id: docId } });
  if (!contract) throw new Error(`Contract ${docId} not found`);
  
  const contractTenantId = tenantId || contract.tenantId;
  // Use existing rates to compute simple percentiles
  const rates = await db.artifact.findFirst({ where: { contractId: docId, type: 'RATES' }, orderBy: { createdAt: 'desc' } });
  const arr = Array.isArray((rates?.data as any)?.rates) ? ((rates!.data as any).rates as any[]).map(r => Number(r.dailyUsd)).filter((n: any) => Number.isFinite(n)) : [];
  let benchmarks: any[] = [];
  if (arr.length) {
    const sorted = [...arr].sort((a,b)=>a-b);
    const pct = (p: number) => sorted[Math.floor((p/100)*(sorted.length-1))];
    benchmarks = [
      { role: 'All Roles (P50)', rate: Math.round(pct(50) || 0), percentile: 50 },
      { role: 'All Roles (P75)', rate: Math.round(pct(75) || 0), percentile: 75 },
    ];
  } else {
    benchmarks = [{ role: 'All Roles (P50)', rate: 1000, percentile: 50 }];
  }

  const artifact = BenchmarkArtifactV1Schema.parse({
    metadata: { docId, fileType: 'pdf', totalPages: 1, ocrRate: 0, provenance: [{ worker: 'benchmark', timestamp: new Date().toISOString(), durationMs: Date.now() - startTime }] },
    benchmarks,
  });

  await db.artifact.create({
    data: {
      contractId: docId,
      type: 'BENCHMARK',
      data: artifact as any,
      tenantId: contractTenantId,
    },
  });

  console.log(`[worker:benchmark] Finished benchmark analysis for ${docId}`);
  return { docId };
}
