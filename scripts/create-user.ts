#!/usr/bin/env tsx
/**
 * Create User CLI Script
 * 
 * Usage: npx tsx scripts/create-user.ts --email "user@example.com" --tenant "acme" --role "owner"
 * 
 * Creates a new user in a specific tenant
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface UserOptions {
  email: string;
  tenant: string; // tenant slug or ID
  role?: string;
  firstName?: string;
  lastName?: string;
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
    rl.question('Enter password (leave empty to generate): ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function createUser(options: UserOptions) {
  const { 
    email, 
    tenant, 
    role = 'member', 
    firstName, 
    lastName,
  } = options;

  console.log(`\n👤 Creating user: ${email}\n`);

  // Find tenant by slug or ID
  const tenantRecord = await prisma.tenant.findFirst({
    where: {
      OR: [
        { slug: tenant },
        { id: tenant },
      ],
    },
  });

  if (!tenantRecord) {
    console.error(`❌ Error: Tenant "${tenant}" not found.`);
    console.log('Available tenants:');
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, slug: true },
      take: 10,
    });
    tenants.forEach((t) => console.log(`   - ${t.slug} (${t.name})`));
    process.exit(1);
  }

  // Check if user already exists in this tenant
  const existingUser = await prisma.user.findFirst({
    where: { 
      email,
      tenantId: tenantRecord.id,
    },
  });

  if (existingUser) {
    console.error(`❌ Error: User with email "${email}" already exists in tenant "${tenantRecord.name}".`);
    process.exit(1);
  }

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

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      firstName: firstName || email.split('@')[0],
      lastName: lastName || '',
      passwordHash,
      tenantId: tenantRecord.id,
      role,
      status: 'ACTIVE',
      emailVerified: true, // Pre-verified for CLI-created users
    },
  });

  // Find or create role record
  let roleRecord = await prisma.role.findFirst({
    where: { name: role },
  });

  if (!roleRecord) {
    roleRecord = await prisma.role.create({
      data: {
        name: role,
        description: `${role.charAt(0).toUpperCase() + role.slice(1)} role`,
        isSystem: true,
      },
    });
  }

  // Assign role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: roleRecord.id,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      tenantId: tenantRecord.id,
      userId: user.id,
      action: 'USER_CREATED_VIA_CLI',
      entityType: 'USER',
      entityId: user.id,
      metadata: { email, role },
    },
  });

  console.log('');
  console.log('✅ User created successfully!\n');
  console.log('📋 User Details:');
  console.log(`   ID:       ${user.id}`);
  console.log(`   Email:    ${user.email}`);
  console.log(`   Name:     ${user.firstName} ${user.lastName}`);
  console.log(`   Role:     ${user.role}`);
  console.log(`   Tenant:   ${tenantRecord.name} (${tenantRecord.slug})`);
  console.log(`   Status:   ${user.status}`);
  console.log('');
  console.log('🔐 Login Credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('');

  return user;
}

// Parse command line arguments
function parseArgs(): UserOptions {
  const args = process.argv.slice(2);
  const options: Partial<UserOptions> = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--email':
      case '-e':
        options.email = args[++i];
        break;
      case '--tenant':
      case '-t':
        options.tenant = args[++i];
        break;
      case '--role':
      case '-r':
        options.role = args[++i];
        break;
      case '--first-name':
      case '-f':
        options.firstName = args[++i];
        break;
      case '--last-name':
      case '-l':
        options.lastName = args[++i];
        break;
      case '--password':
      case '-p':
        options.password = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Create User CLI

Usage:
  npx tsx scripts/create-user.ts --email "user@example.com" --tenant "tenant-slug"

Options:
  --email, -e       User email address (required)
  --tenant, -t      Tenant slug or ID (required)
  --role, -r        User role: owner, admin, member, viewer (default: member)
  --first-name, -f  User's first name
  --last-name, -l   User's last name
  --password, -p    User password (will prompt or generate if not provided)
  --help, -h        Show this help message

Examples:
  npx tsx scripts/create-user.ts -e "admin@acme.com" -t "acme" -r owner
  npx tsx scripts/create-user.ts --email "user@acme.com" --tenant "acme" --first-name "John" --last-name "Doe"
        `);
        process.exit(0);
    }
  }

  if (!options.email || !options.tenant) {
    console.error('❌ Error: --email and --tenant are required');
    console.log('Use --help for usage information');
    process.exit(1);
  }

  return options as UserOptions;
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    await createUser(options);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
