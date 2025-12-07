#!/usr/bin/env tsx
/**
 * List Tenants CLI Script
 * 
 * Usage: npx tsx scripts/list-tenants.ts
 * 
 * Lists all tenants with their user counts and status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listTenants() {
  console.log('\n🏢 Tenant List\n');
  console.log('─'.repeat(100));

  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: {
        select: { plan: true, status: true },
      },
      _count: {
        select: { 
          users: true, 
          contracts: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (tenants.length === 0) {
    console.log('No tenants found.\n');
    console.log('Create one with: npx tsx scripts/create-tenant.ts --name "Company" --slug "company"');
    return;
  }

  // Header
  console.log(
    padRight('Slug', 20) +
    padRight('Name', 25) +
    padRight('Plan', 15) +
    padRight('Status', 12) +
    padRight('Users', 8) +
    padRight('Contracts', 10)
  );
  console.log('─'.repeat(100));

  // Rows
  for (const tenant of tenants) {
    console.log(
      padRight(tenant.slug, 20) +
      padRight(truncate(tenant.name, 23), 25) +
      padRight(tenant.subscription?.plan || 'FREE', 15) +
      padRight(tenant.status, 12) +
      padRight(String(tenant._count.users), 8) +
      padRight(String(tenant._count.contracts), 10)
    );
  }

  console.log('─'.repeat(100));
  console.log(`\nTotal: ${tenants.length} tenant(s)\n`);
}

function padRight(str: string, len: number): string {
  return str.padEnd(len);
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 2) + '..' : str;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
List Tenants CLI

Usage:
  npx tsx scripts/list-tenants.ts

Options:
  --help, -h    Show this help message
    `);
    process.exit(0);
  }

  try {
    await listTenants();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
