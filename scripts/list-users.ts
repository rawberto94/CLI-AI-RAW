#!/usr/bin/env tsx
/**
 * List Users CLI Script
 * 
 * Usage: npx tsx scripts/list-users.ts [--tenant "slug"]
 * 
 * Lists all users, optionally filtered by tenant
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ListOptions {
  tenant?: string;
}

async function listUsers(options: ListOptions) {
  console.log('\n👥 User List\n');
  console.log('─'.repeat(110));

  const where = options.tenant ? {
    tenant: {
      OR: [
        { slug: options.tenant },
        { id: options.tenant },
      ],
    },
  } : {};

  const users = await prisma.user.findMany({
    where,
    include: {
      tenant: {
        select: { name: true, slug: true },
      },
    },
    orderBy: [
      { tenantId: 'asc' },
      { role: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  if (users.length === 0) {
    console.log('No users found.\n');
    if (options.tenant) {
      console.log(`No users in tenant "${options.tenant}".`);
    }
    console.log('Create one with: npx tsx scripts/create-user.ts --email "user@example.com" --tenant "slug"');
    return;
  }

  // Header
  console.log(
    padRight('Email', 30) +
    padRight('Name', 20) +
    padRight('Role', 10) +
    padRight('Status', 10) +
    padRight('Tenant', 20) +
    padRight('Last Login', 20)
  );
  console.log('─'.repeat(110));

  // Rows
  for (const user of users) {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || '-';
    const lastLogin = user.lastLoginAt 
      ? new Date(user.lastLoginAt).toLocaleString() 
      : 'Never';

    console.log(
      padRight(truncate(user.email, 28), 30) +
      padRight(truncate(name, 18), 20) +
      padRight(user.role, 10) +
      padRight(user.status, 10) +
      padRight(truncate(user.tenant.slug, 18), 20) +
      padRight(lastLogin, 20)
    );
  }

  console.log('─'.repeat(110));
  console.log(`\nTotal: ${users.length} user(s)\n`);
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 2) + '..' : str;
}

// Parse command line arguments
function parseArgs(): ListOptions {
  const args = process.argv.slice(2);
  const options: ListOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--tenant':
      case '-t':
        options.tenant = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
List Users CLI

Usage:
  npx tsx scripts/list-users.ts [--tenant "slug"]

Options:
  --tenant, -t  Filter by tenant slug or ID
  --help, -h    Show this help message

Examples:
  npx tsx scripts/list-users.ts
  npx tsx scripts/list-users.ts --tenant "acme"
        `);
        process.exit(0);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await listUsers(options);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
