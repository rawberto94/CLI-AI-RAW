const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const contract = await prisma.contract.findFirst({
      where: { status: 'COMPLETED' },
      select: { id: true, fileName: true, rawText: true, storagePath: true }
    });
    
    console.log('Contract:', contract?.id);
    console.log('FileName:', contract?.fileName);
    console.log('HasRawText:', !!contract?.rawText);
    console.log('RawTextLength:', contract?.rawText?.length || 0);
    console.log('StoragePath:', contract?.storagePath);
  } finally {
    await prisma.$disconnect();
  }
})();
