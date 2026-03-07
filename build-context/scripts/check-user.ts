/**
 * Check User Script
 * Verifies user data in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking demo user...\n');

  const user = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('User Details:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  First Name:', user.firstName);
  console.log('  Last Name:', user.lastName);
  console.log('  Tenant ID:', user.tenantId);
  console.log('  Status:', user.status);
  console.log('  Email Verified:', user.emailVerified);
  console.log('  Password Hash:', user.passwordHash ? `SET (${user.passwordHash.substring(0, 20)}...)` : 'NULL or EMPTY');
  console.log('  Password Hash Length:', user.passwordHash?.length || 0);
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
