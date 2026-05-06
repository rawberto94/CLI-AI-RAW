import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@acme.com';
  const admin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { tenant: true }
  });

  if (!admin) {
    console.error('Admin not found');
    process.exit(1);
  }

  const email = `audit34-${uuidv4().slice(0, 8)}@example.com`;
  const token = uuidv4();
  
  const invitation = await prisma.invitation.create({
    data: {
      email,
      token,
      role: 'member',
      tenantId: admin.tenantId,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    }
  });

  console.log(`INVITATION_EMAIL=${email}`);
  console.log(`INVITATION_TOKEN=${token}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
