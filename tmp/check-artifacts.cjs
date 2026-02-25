const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check artifacts for this contract
  const artifacts = await p.contractArtifact.findMany({
    where: { contractId: 'cmm209v24000377dnr0j3td1y' },
    select: { id: true, type: true, createdAt: true }
  });
  console.log('Artifacts found:', artifacts.length);
  for (const a of artifacts) {
    console.log(`  ${a.type} - ${a.id} - ${a.createdAt}`);
  }
  
  // Also check by artifact IDs from logs
  const testArtifact = await p.contractArtifact.findUnique({
    where: { id: 'cmm20c9b6000y77dnkbaruttc' }
  });
  console.log('\nDirect ID lookup:', testArtifact ? `Found (contractId: ${testArtifact.contractId})` : 'NOT FOUND');
  
  // Check contract status
  const c = await p.contract.findUnique({
    where: { id: 'cmm209v24000377dnr0j3td1y' },
    select: { id: true, status: true, contractTitle: true, totalValue: true, clientName: true, supplierName: true }
  });
  console.log('\nContract:', JSON.stringify(c, null, 2));
  
  await p.$disconnect();
})();
