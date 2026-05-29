import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const args = new Set(process.argv.slice(2));
const allowDefaultPassword = args.has('--allow-default-password');
const resetPassword = args.has('--reset-password') || Boolean(process.env.DEMO_USER_PASSWORD);

const tenantId = process.env.DEMO_TENANT_ID || 'demo';
const tenantName = process.env.DEMO_TENANT_NAME || 'Demo Organization';
const tenantSlug = process.env.DEMO_TENANT_SLUG || 'demo';
const userEmail = process.env.DEMO_USER_EMAIL || 'demo@example.com';
const userFirstName = process.env.DEMO_USER_FIRST_NAME || 'Demo';
const userLastName = process.env.DEMO_USER_LAST_NAME || 'Admin';
const userRole = process.env.DEMO_USER_ROLE || 'admin';
const defaultPassword = 'demo123';

function getPassword(): string {
  const configuredPassword = process.env.DEMO_USER_PASSWORD;
  if (configuredPassword) {
    if (configuredPassword.length < 12) {
      throw new Error('DEMO_USER_PASSWORD must be at least 12 characters for production demo accounts.');
    }
    return configuredPassword;
  }

  if (process.env.NODE_ENV === 'production' && !allowDefaultPassword) {
    throw new Error('Set DEMO_USER_PASSWORD, or pass --allow-default-password only for non-client test environments.');
  }

  return defaultPassword;
}

function nextMonthResetDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

async function main() {
  const password = getPassword();
  const passwordHash = await hash(password, 12);

  const tenant = await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: tenantName,
      slug: tenantSlug,
      status: 'ACTIVE',
    },
    create: {
      id: tenantId,
      name: tenantName,
      slug: tenantSlug,
      status: 'ACTIVE',
    },
  });

  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  await prisma.tenantUsage.upsert({
    where: { tenantId: tenant.id },
    update: {
      resetDate: nextMonthResetDate(),
    },
    create: {
      tenantId: tenant.id,
      monthlyContractLimit: 100,
      monthlyTokenLimit: BigInt(5_000_000),
      monthlyStorageLimit: BigInt(10 * 1024 * 1024 * 1024),
      monthlyApiLimit: 10_000,
      resetDate: nextMonthResetDate(),
    },
  });

  await prisma.tenantSubscription.upsert({
    where: { tenantId: tenant.id },
    update: {
      plan: 'PROFESSIONAL',
      status: 'TRIAL',
      billingCycle: 'MONTHLY',
    },
    create: {
      tenantId: tenant.id,
      plan: 'PROFESSIONAL',
      status: 'TRIAL',
      startDate: new Date(),
      billingCycle: 'MONTHLY',
    },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  const user = existingUser
    ? await prisma.user.update({
        where: { email: userEmail },
        data: {
          tenantId: tenant.id,
          firstName: userFirstName,
          lastName: userLastName,
          role: userRole,
          status: 'ACTIVE',
          emailVerified: true,
          ...(resetPassword ? { passwordHash } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: userEmail,
          firstName: userFirstName,
          lastName: userLastName,
          passwordHash,
          role: userRole,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });

  console.log('Production demo tenant is ready.');
  console.log(`Tenant: ${tenant.id} (${tenant.slug})`);
  console.log(`User: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(resetPassword || !existingUser ? 'Password hash was set.' : 'Existing password was left unchanged.');
  if (password === defaultPassword) {
    console.log('Default demo password was used. Rotate before any client-facing demo.');
  }
}

main()
  .catch((error) => {
    console.error('Failed to seed production demo tenant:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
