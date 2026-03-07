#!/usr/bin/env tsx
/**
 * Create Tenant CLI Script
 * 
 * Usage: npx tsx scripts/create-tenant.ts --name "Acme Corp" --slug "acme"
 * 
 * Creates a new tenant organization with default configuration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TenantOptions {
  name: string;
  slug: string;
  plan?: 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE' | 'CUSTOM';
}

async function createTenant(options: TenantOptions) {
  const { name, slug, plan = 'FREE' } = options;

  console.log(`\n🏢 Creating tenant: ${name} (${slug})\n`);

  // Check if tenant already exists
  const existingTenant = await prisma.tenant.findFirst({
    where: {
      OR: [{ name }, { slug }],
    },
  });

  if (existingTenant) {
    console.error(`❌ Error: Tenant with name "${name}" or slug "${slug}" already exists.`);
    process.exit(1);
  }

  // Create tenant with related records
  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug,
      status: 'ACTIVE',
      configuration: {
        create: {
          aiModels: {
            default: 'gpt-4',
            fallback: 'gpt-3.5-turbo',
          },
          securitySettings: {
            mfaRequired: false,
            sessionTimeout: 30 * 24 * 60 * 60, // 30 days
            ipWhitelist: [],
          },
          integrations: {
            metadataSchema: [],
          },
          workflowSettings: {
            autoApprovalThreshold: 10000,
            requireSecondApprover: false,
          },
        },
      },
      subscription: {
        create: {
          plan,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          startDate: new Date(),
        },
      },
      usage: {
        create: {
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          monthlyContractLimit: plan === 'FREE' ? 100 : plan === 'PROFESSIONAL' ? 1000 : null,
          monthlyTokenLimit: plan === 'FREE' ? BigInt(100000) : plan === 'PROFESSIONAL' ? BigInt(1000000) : null,
          monthlyStorageLimit: plan === 'FREE' ? BigInt(1024 * 1024 * 1024) : plan === 'PROFESSIONAL' ? BigInt(10 * 1024 * 1024 * 1024) : null,
        },
      },
    },
    include: {
      configuration: true,
      subscription: true,
      usage: true,
    },
  });

  console.log('✅ Tenant created successfully!\n');
  console.log('📋 Tenant Details:');
  console.log(`   ID:     ${tenant.id}`);
  console.log(`   Name:   ${tenant.name}`);
  console.log(`   Slug:   ${tenant.slug}`);
  console.log(`   Plan:   ${tenant.subscription?.plan || 'FREE'}`);
  console.log(`   Status: ${tenant.status}`);
  console.log('');

  return tenant;
}

// Parse command line arguments
function parseArgs(): TenantOptions {
  const args = process.argv.slice(2);
  const options: Partial<TenantOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--name':
      case '-n':
        options.name = args[++i];
        break;
      case '--slug':
      case '-s':
        options.slug = args[++i];
        break;
      case '--plan':
      case '-p':
        options.plan = args[++i] as TenantOptions['plan'];
        break;
      case '--help':
      case '-h':
        console.log(`
Create Tenant CLI

Usage:
  npx tsx scripts/create-tenant.ts --name "Company Name" --slug "company-slug"

Options:
  --name, -n    Organization name (required)
  --slug, -s    URL-friendly slug (required)
  --plan, -p    Subscription plan: FREE, PROFESSIONAL, ENTERPRISE, CUSTOM (default: FREE)
  --help, -h    Show this help message

Examples:
  npx tsx scripts/create-tenant.ts --name "Acme Corp" --slug "acme"
  npx tsx scripts/create-tenant.ts -n "Big Company" -s "bigco" -p ENTERPRISE
        `);
        process.exit(0);
    }
  }

  if (!options.name || !options.slug) {
    console.error('❌ Error: --name and --slug are required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  return options as TenantOptions;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await createTenant(options);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
