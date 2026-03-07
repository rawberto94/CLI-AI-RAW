#!/usr/bin/env tsx
/**
 * Reset User Password CLI Script
 * 
 * Usage: npx tsx scripts/reset-password.ts --email "user@example.com"
 * 
 * Resets a user's password
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ResetOptions {
  email: string;
  password?: string;
}

function generatePassword(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function promptPassword(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Enter new password (leave empty to generate): ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function resetPassword(options: ResetOptions) {
  const { email } = options;

  console.log(`\n🔐 Resetting password for: ${email}\n`);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      tenant: { select: { name: true, slug: true } },
    },
  });

  if (!user) {
    console.error(`❌ Error: User with email "${email}" not found.`);
    process.exit(1);
  }

  console.log(`📋 User found:`);
  console.log(`   Name:   ${user.firstName} ${user.lastName}`);
  console.log(`   Tenant: ${user.tenant.name} (${user.tenant.slug})`);
  console.log(`   Role:   ${user.role}`);
  console.log('');

  // Generate or prompt for password
  let password = options.password;
  if (!password) {
    password = await promptPassword();
  }
  if (!password) {
    password = generatePassword();
    console.log(`🔑 Generated password: ${password}`);
  }

  // Hash password
  const passwordHash = await hash(password, 12);

  // Update user
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      action: 'PASSWORD_RESET_VIA_CLI',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email },
    },
  });

  console.log('');
  console.log('✅ Password reset successfully!\n');
  console.log('🔐 New Credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('');
}

// Parse command line arguments
function parseArgs(): ResetOptions {
  const args = process.argv.slice(2);
  const options: Partial<ResetOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
      case '-e':
        options.email = args[++i];
        break;
      case '--password':
      case '-p':
        options.password = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Reset Password CLI

Usage:
  npx tsx scripts/reset-password.ts --email "user@example.com"

Options:
  --email, -e       User email address (required)
  --password, -p    New password (will prompt or generate if not provided)
  --help, -h        Show this help message

Examples:
  npx tsx scripts/reset-password.ts -e "admin@acme.com"
  npx tsx scripts/reset-password.ts --email "user@acme.com" --password "newpassword123"
        `);
        process.exit(0);
    }
  }

  if (!options.email) {
    console.error('❌ Error: --email is required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  return options as ResetOptions;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await resetPassword(options);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
