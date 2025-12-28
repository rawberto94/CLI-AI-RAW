/**
 * Create Admin User Script
 * Creates an admin user with different credentials
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating admin user...');

  // Get demo tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: 'demo' },
  });

  if (!tenant) {
    console.log('❌ Demo tenant not found. Run create-demo-user.ts first.');
    return;
  }

  // Delete existing admin user if exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@demo.com' },
  });

  if (existingUser) {
    await prisma.user.delete({
      where: { email: 'admin@demo.com' },
    });
    console.log('ℹ️  Deleted existing admin user');
  }

  const passwordHash = await hash('Admin123!', 10);

  const user = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      firstName: 'Admin',
      lastName: 'Demo',
      passwordHash,
      tenantId: tenant.id,
      status: 'ACTIVE',
      role: 'owner',
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('\nAdmin Credentials:');
  console.log('  Email: admin@demo.com');
  console.log('  Password: Admin123!');
  console.log('  User ID:', user.id);
  console.log('  Tenant ID:', user.tenantId);
}

main()
  .catch((error) => {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
