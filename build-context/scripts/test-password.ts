/**
 * Test Password Script
 * Tests password comparison
 */

import { PrismaClient } from '@prisma/client';
import { compare } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Testing password comparison...\n');

  const user = await prisma.user.findUnique({
    where: { email: 'demo@example.com' },
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('User found:', user.email);
  console.log('Password hash exists:', !!user.passwordHash);
  console.log('Password hash length:', user.passwordHash?.length);
  console.log('');

  // Test with correct password
  const testPassword = 'demo123';
  console.log(`Testing password: "${testPassword}"`);
  
  try {
    const isValid = await compare(testPassword, user.passwordHash);
    console.log('Password comparison result:', isValid ? '✅ VALID' : '❌ INVALID');
  } catch (error) {
    console.error('❌ Error during comparison:', error);
  }

  // Test with wrong password
  console.log('');
  console.log('Testing wrong password: "wrongpassword"');
  try {
    const isValid = await compare('wrongpassword', user.passwordHash);
    console.log('Password comparison result:', isValid ? '✅ VALID (unexpected!)' : '❌ INVALID (expected)');
  } catch (error) {
    console.error('❌ Error during comparison:', error);
  }
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
