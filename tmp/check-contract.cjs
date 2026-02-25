const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Find contract starting with cmm209v2
  const c = await p.contract.findFirst({
    where: { id: { startsWith: 'cmm209v2' } }
  });
  
  if (!c) {
    console.log('NOT FOUND - checking all recent contracts');
    const recent = await p.contract.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, status: true, storagePath: true, createdAt: true, tenantId: true, mimeType: true }
    });
    for (const r of recent) {
      const cnt = await p.contractArtifact.count({ where: { contractId: r.id } });
      console.log(`${r.id} | ${r.status} | artifacts:${cnt} | ${r.createdAt}`);
    }
    await p.$disconnect();
    return;
  }
  
  console.log('ID:', c.id);
  console.log('Status:', c.status);
  console.log('storagePath:', c.storagePath);
  console.log('tenantId:', c.tenantId);
  console.log('mimeType:', c.mimeType);
  console.log('Created:', c.createdAt);
  
  const count = await p.contractArtifact.count({ where: { contractId: c.id } });
  console.log('Artifacts:', count);
  
  const job = await p.processingJob.findFirst({
    where: { contractId: c.id },
    orderBy: { createdAt: 'desc' }
  });
  if (job) {
    console.log('Job status:', job.status);
    console.log('Job step:', job.currentStep);
    console.log('Job started:', job.startedAt);
  }
  
  await p.$disconnect();
})();
