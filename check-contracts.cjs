const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        originalName: { contains: 'Statement_of_Work' }
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { 
        id: true, 
        tenantId: true, 
        originalName: true, 
        status: true, 
        createdAt: true 
      }
    });
    
    console.log('=== Contracts with Statement_of_Work ===');
    contracts.forEach(c => {
      console.log(`ID: ${c.id}`);
      console.log(`  Tenant: ${c.tenantId}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Created: ${c.createdAt.toISOString()}`);
      console.log('');
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
