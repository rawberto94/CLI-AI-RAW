/**
 * Create a pilot tenant with a user account.
 * Pilot tenants see only the core feature set (same as demo nav).
 *
 * Usage:
 *   DATABASE_URL=... npx ts-node --project tsconfig.json scripts/create-pilot-tenant.ts \
 *     --name "Acme Corp" --slug "acme" --email "admin@acme.com" --password "changeme123"
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };

  const name     = get('--name')     ?? 'Pilot Tenant';
  const slug     = get('--slug')     ?? 'pilot';
  const email    = get('--email')    ?? 'admin@pilot.local';
  const password = get('--password') ?? 'changeme123';

  // 1. Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name, status: 'ACTIVE' },
    create: { name, slug, status: 'ACTIVE' },
  });
  console.log(`✓ Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Set pilotMode in TenantConfig
  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      securitySettings: { pilotMode: true },
    },
    create: {
      tenantId: tenant.id,
      securitySettings: { pilotMode: true },
    },
  });
  console.log('✓ pilotMode = true set in TenantConfig');

  // 3. Create admin user
  const passwordHash = await hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, status: 'ACTIVE', tenantId: tenant.id },
    create: {
      email,
      firstName: 'Admin',
      lastName: tenant.name,
      passwordHash,
      tenantId: tenant.id,
      role: 'admin',
      status: 'ACTIVE',
    },
  });
  console.log(`✓ User: ${user.email}`);

  console.log('\nDone. Pilot tenant ready:');
  console.log(`  Tenant slug : ${slug}`);
  console.log(`  Login email : ${email}`);
  console.log(`  Password    : ${password}`);
  console.log('\nThis tenant will see only the pilot feature set (demo nav restrictions).');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
