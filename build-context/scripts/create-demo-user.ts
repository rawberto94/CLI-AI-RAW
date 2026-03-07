/**
 * Create Demo User Script
 * Creates a demo user for authentication testing
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating demo user...');

  // Create demo tenant if not exists
  let tenant = await prisma.tenant.findUnique({
    where: { id: 'demo' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: 'demo',
        name: 'Demo Organization',
        slug: 'demo',
        status: 'ACTIVE',
      },
    });
    console.log('✅ Demo tenant created');
  } else {
    console.log('ℹ️  Demo tenant already exists');
  }

  // Create demo user if not exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (existingUser) {
    console.log('ℹ️  Demo user already exists');
    console.log('\nDemo Credentials:');
    console.log('  Email: demo@example.com');
    console.log('  Password: demo123');
    return;
  }

  const passwordHash = await hash('demo123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      passwordHash,
      tenantId: tenant.id,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Demo user created successfully!');
  console.log('\nDemo Credentials:');
  console.log('  Email: demo@example.com');
  console.log('  Password: demo123');
  console.log('  User ID:', user.id);
  console.log('  Tenant ID:', user.tenantId);
}

main()
  .catch((error) => {
    console.error('❌ Error creating demo user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
