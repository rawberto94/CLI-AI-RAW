import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const p = new PrismaClient();

async function main() {
  const pw = await hash('password123', 12);

  // Create acme tenant
  let tenant = await p.tenant.findFirst({ where: { slug: 'acme' } });
  if (!tenant) {
    tenant = await p.tenant.create({
      data: { id: 'acme', name: 'Acme Corp', slug: 'acme', status: 'ACTIVE' }
    });
    console.log('Created acme tenant');
  } else {
    console.log('Acme tenant exists:', tenant.id);
  }

  // Upsert admin@acme.com
  const admin = await p.user.upsert({
    where: { email: 'admin@acme.com' },
    update: { passwordHash: pw, status: 'ACTIVE' },
    create: { email: 'admin@acme.com', firstName: 'Admin', lastName: 'User', passwordHash: pw, tenantId: tenant.id, role: 'admin', status: 'ACTIVE' }
  });
  console.log('admin@acme.com ready, id:', admin.id);

  // Upsert roberto@acme.com
  const roberto = await p.user.upsert({
    where: { email: 'roberto@acme.com' },
    update: { passwordHash: pw, status: 'ACTIVE' },
    create: { email: 'roberto@acme.com', firstName: 'Roberto', lastName: 'Ostojic', passwordHash: pw, tenantId: tenant.id, role: 'admin', status: 'ACTIVE' }
  });
  console.log('roberto@acme.com ready, id:', roberto.id);

  // Update demo@example.com password too
  try {
    const demo = await p.user.update({
      where: { email: 'demo@example.com' },
      data: { passwordHash: pw }
    });
    console.log('demo@example.com updated, id:', demo.id);
  } catch {
    console.log('demo@example.com not found, skipping');
  }

  console.log('\nAll accounts use password: password123');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
