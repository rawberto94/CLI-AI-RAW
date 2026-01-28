/**
 * Seed script to create test tenants for multi-tenant testing
 * 
 * Creates:
 * - Tenant Roberto
 * - Tenant Florian
 * 
 * Run with: npx ts-node scripts/seed-tenants.ts
 * Or: pnpm exec ts-node scripts/seed-tenants.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating test tenants...\n');

  // Create Tenant Roberto
  console.log('1️⃣ Creating Tenant Roberto...');
  const tenantRoberto = await prisma.tenant.upsert({
    where: { id: 'tenant-roberto' },
    update: {
      name: 'Roberto Corporation',
      slug: 'roberto',
    },
    create: {
      id: 'tenant-roberto',
      name: 'Roberto Corporation',
      slug: 'roberto',
      status: 'ACTIVE',
    },
  });
  console.log('   ✅ Created/Updated tenant: ' + tenantRoberto.name + ' (ID: ' + tenantRoberto.id + ')\n');

  // Create a test user for Tenant Roberto
  const dummyHash = '$2b$10$dummyhashdummyhashdummyhashdummyhashdummy00';
  const userRoberto = await prisma.user.upsert({
    where: { email: 'roberto@roberto.com' },
    update: {
      tenantId: tenantRoberto.id,
      firstName: 'Roberto',
      lastName: 'Admin',
    },
    create: {
      tenantId: tenantRoberto.id,
      email: 'roberto@roberto.com',
      firstName: 'Roberto',
      lastName: 'Admin',
      passwordHash: dummyHash,
      role: 'admin',
    },
  });
  console.log('   ✅ Created/Updated user: ' + userRoberto.email + '\n');

  // Create Tenant Florian
  console.log('2️⃣ Creating Tenant Florian...');
  const tenantFlorian = await prisma.tenant.upsert({
    where: { id: 'tenant-florian' },
    update: {
      name: 'Florian Enterprises',
      slug: 'florian',
    },
    create: {
      id: 'tenant-florian',
      name: 'Florian Enterprises',
      slug: 'florian',
      status: 'ACTIVE',
    },
  });
  console.log('   ✅ Created/Updated tenant: ' + tenantFlorian.name + ' (ID: ' + tenantFlorian.id + ')\n');

  // Create a test user for Tenant Florian
  const userFlorian = await prisma.user.upsert({
    where: { email: 'florian@florian.com' },
    update: {
      tenantId: tenantFlorian.id,
      firstName: 'Florian',
      lastName: 'Admin',
    },
    create: {
      tenantId: tenantFlorian.id,
      email: 'florian@florian.com',
      firstName: 'Florian',
      lastName: 'Admin',
      passwordHash: dummyHash,
      role: 'admin',
    },
  });
  console.log('   ✅ Created/Updated user: ' + userFlorian.email + '\n');

  console.log('✨ Tenant creation complete!\n');
  console.log('📋 Summary:');
  console.log('   • Tenant Roberto: ID=' + tenantRoberto.id + ', Slug=' + tenantRoberto.slug);
  console.log('   • Tenant Florian: ID=' + tenantFlorian.id + ', Slug=' + tenantFlorian.slug);
  console.log('\n🔑 To switch tenants in the app:');
  console.log('   1. Open browser DevTools Console');
  console.log('   2. Run: sessionStorage.setItem("tenantId", "tenant-roberto")');
  console.log('   3. Or: sessionStorage.setItem("tenantId", "tenant-florian")');
  console.log('   4. Refresh the page');
}

main()
  .catch((e) => {
    console.error('❌ Error creating tenants:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
