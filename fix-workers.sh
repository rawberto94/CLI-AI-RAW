#!/bin/bash

# Fix all remaining workers to include tenantId

# Fix clauses worker
sed -i '' 's/export async function runClauses(job: { data: { docId: string } })/export async function runClauses(job: { data: { docId: string; tenantId?: string } })/' apps/workers/clauses.worker.ts
sed -i '' 's/const { docId } = job.data;/const { docId, tenantId } = job.data;\
\
  \/\/ Get contract to ensure we have tenantId\
  const contract = await db.contract.findUnique({ where: { id: docId } });\
  if (!contract) throw new Error(\`Contract \${docId} not found\`);\
  \
  const contractTenantId = tenantId || contract.tenantId;/' apps/workers/clauses.worker.ts

# Fix compliance worker  
sed -i '' 's/export async function runCompliance(job: { data: { docId: string; policyPackId?: string } })/export async function runCompliance(job: { data: { docId: string; policyPackId?: string; tenantId?: string } })/' apps/workers/compliance.worker.ts
sed -i '' 's/const { docId, policyPackId } = job.data;/const { docId, policyPackId, tenantId } = job.data;\
\
  \/\/ Get contract to ensure we have tenantId\
  const contract = await db.contract.findUnique({ where: { id: docId } });\
  if (!contract) throw new Error(\`Contract \${docId} not found\`);\
  \
  const contractTenantId = tenantId || contract.tenantId;/' apps/workers/compliance.worker.ts

# Fix rates worker
sed -i '' 's/export async function runRates(job: { data: { docId: string } })/export async function runRates(job: { data: { docId: string; tenantId?: string } })/' apps/workers/rates.worker.ts
sed -i '' 's/const { docId } = job.data;/const { docId, tenantId } = job.data;\
\
  \/\/ Get contract to ensure we have tenantId\
  const contract = await db.contract.findUnique({ where: { id: docId } });\
  if (!contract) throw new Error(\`Contract \${docId} not found\`);\
  \
  const contractTenantId = tenantId || contract.tenantId;/' apps/workers/rates.worker.ts

# Fix report worker
sed -i '' 's/export async function runReport(job: { data: { docId: string } })/export async function runReport(job: { data: { docId: string; tenantId?: string } })/' apps/workers/report.worker.ts
sed -i '' 's/const { docId } = job.data;/const { docId, tenantId } = job.data;\
\
  \/\/ Get contract to ensure we have tenantId\
  const contract = await db.contract.findUnique({ where: { id: docId } });\
  if (!contract) throw new Error(\`Contract \${docId} not found\`);\
  \
  const contractTenantId = tenantId || contract.tenantId;/' apps/workers/report.worker.ts

echo "Fixed worker function signatures and added contract lookups"