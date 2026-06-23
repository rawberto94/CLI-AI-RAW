import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ take: 5, select: { id: true, name: true } });
  console.log('Tenants:', JSON.stringify(tenants, null, 2));
  const users = await prisma.user.findMany({
    take: 5,
    select: { id: true, email: true, tenantId: true, role: true, status: true },
  });
  console.log('Users:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
