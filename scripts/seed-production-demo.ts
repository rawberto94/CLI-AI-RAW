import { PrismaClient, ContractStatus, ObligationStatus, ObligationType, ObligationPriority } from '@prisma/client';
import { hash } from 'bcryptjs';
import { promises as fs, constants as fsConstants } from 'fs';
import path from 'path';

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

// ============================================================================
// Realistic demo contract data
// ============================================================================

const SUPPLIERS = [
  'Siemens Mobility', 'Stadler Rail', 'ABB Schweiz', 'Swisscom Enterprise', 'Die Post',
  'Migros Industrie', 'Coop Procurement', 'Holcim Schweiz', 'Novartis Pharma', 'Roche Diagnostics',
  'Credit Suisse Procurement', 'UBS Facilities', 'Zürich Versicherung', 'Helvetia AG', 'Axpo Holding',
  'BKW Energie', 'Alpiq AG', 'Georg Fischer', 'Schindler Aufzüge', 'Burckhardt Compression',
  'Bossard Group', 'Kühne+Nagel', 'Panalpina', 'DHL Supply Chain', 'SFS Group',
  'Bystronic Laser', 'Autoneum', 'Garmin Europe', 'Logitech Europe', 'Firmenich',
];

const CLIENTS = [
  'SBB CFF FFS', 'BLS AG', 'Rhaetian Railway', 'ZVV Zürich', 'VBZ Zürich',
  'PostAuto Schweiz', 'Swiss Federal Railways', 'Bernmobil', 'TPF Fribourg', 'TL Lausanne',
];

const CONTRACT_TYPES = [
  'SUPPLY AGREEMENT', 'MAINTENANCE CONTRACT', 'LICENSE AGREEMENT', 'SERVICE CONTRACT',
  'FRAMEWORK AGREEMENT', 'SUBCONTRACT', 'CONSULTING AGREEMENT', 'NDA', 'SLA', 'LEASE',
];

const CURRENCIES = ['CHF', 'EUR', 'USD'];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateContractTitle(supplier: string, type: string, index: number): string {
  const prefixes = [
    'Master', 'Annual', 'Strategic', 'Exclusive', 'Preferred', 'Global', 'Regional', 'Local',
  ];
  const suffixes = [
    '2024-2026', 'FY25', 'Q3-Q4 2025', 'Multi-Year', 'Rolling', 'Framework 2025',
  ];
  return `${randomItem(prefixes)} ${type} — ${supplier} ${randomItem(suffixes)} #${index + 1}`;
}

function generateContracts(count: number, tenantId: string, userId: string) {
  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const twoYearsFuture = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

  const contracts = [];
  for (let i = 0; i < count; i++) {
    const supplier = randomItem(SUPPLIERS);
    const client = randomItem(CLIENTS);
    const type = randomItem(CONTRACT_TYPES);
    const effectiveDate = randomDate(twoYearsAgo, now);
    const durationMonths = randomInt(6, 36);
    const expirationDate = new Date(effectiveDate);
    expirationDate.setMonth(expirationDate.getMonth() + durationMonths);
    const totalValue = randomInt(50000, 5000000);
    const currency = randomItem(CURRENCIES);
    const status = randomItem([
      ContractStatus.ACTIVE,
      ContractStatus.COMPLETED,
      ContractStatus.UPLOADED,
      ContractStatus.PROCESSING,
      ContractStatus.ARCHIVED,
    ]);

    contracts.push({
      tenantId,
      fileName: `contract_${i + 1}.pdf`,
      mimeType: 'application/pdf',
      fileSize: BigInt(randomInt(100000, 5000000)),
      uploadedBy: userId,
      status,
      storagePath: `contracts/${tenantId}/demo-contract-${i + 1}.pdf`,
      contractTitle: generateContractTitle(supplier, type, i),
      contractType: type,
      description: `Comprehensive ${type.toLowerCase()} governing the relationship between ${client} and ${supplier}.`,
      supplierName: supplier,
      clientName: client,
      effectiveDate,
      expirationDate,
      totalValue,
      currency,
      paymentTerms: randomItem(['Net 30', 'Net 60', 'Net 90', '14 days', 'Immediate']),
      paymentFrequency: randomItem(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME']),
      category: randomItem(['IT & Software', 'Facilities', 'Professional Services', 'Logistics', 'Manufacturing']),
      jurisdiction: randomItem(['Switzerland', 'Germany', 'EU', 'Zurich', 'Bern']),
      tags: JSON.stringify([type.toLowerCase().replace(/ /g, '-'), supplier.toLowerCase().replace(/ /g, '-'), 'demo']),
      keywords: JSON.stringify([type, supplier, client, 'demo']),
    });
  }
  return contracts;
}

function generateObligations(contractId: string, tenantId: string, contractTitle: string) {
  const obligations = [];
  const types = [ObligationType.PAYMENT, ObligationType.DELIVERY, ObligationType.REPORTING, ObligationType.COMPLIANCE];
  const count = randomInt(2, 6);
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + randomInt(-30, 180));
    obligations.push({
      contractId,
      tenantId,
      title: `${randomItem(types)} obligation for ${contractTitle.split('—')[1]?.trim() || contractTitle}`,
      description: `Demo obligation generated for demonstration purposes.`,
      type: randomItem(types),
      priority: randomItem([ObligationPriority.CRITICAL, ObligationPriority.HIGH, ObligationPriority.MEDIUM, ObligationPriority.LOW]),
      status: dueDate < now && Math.random() > 0.3 ? ObligationStatus.OVERDUE : randomItem([ObligationStatus.PENDING, ObligationStatus.IN_PROGRESS, ObligationStatus.COMPLETED]),
      dueDate,
    });
  }
  return obligations;
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

  // Seed 50+ realistic contracts
  const contractCount = 55;
  console.log(`Seeding ${contractCount} demo contracts...`);

  // Clean existing demo contracts for this tenant to avoid duplication on re-runs
  const existingContracts = await prisma.contract.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  if (existingContracts.length > 0) {
    console.log(`Removing ${existingContracts.length} existing demo contracts...`);
    await prisma.obligation.deleteMany({ where: { tenantId: tenant.id } });
    await prisma.contract.deleteMany({ where: { tenantId: tenant.id } });
  }

  // Ensure uploads directory exists for demo contract PDFs
  const uploadsDir = path.join(process.cwd(), 'apps', 'web', 'uploads', 'contracts', tenant.id);
  await fs.mkdir(uploadsDir, { recursive: true });

  // Check for template PDF
  const templatePaths = [
    path.join(process.cwd(), 'public', 'realistic_contract.pdf'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'realistic_contract.pdf'),
  ];
  let templatePdfPath: string | null = null;
  for (const tp of templatePaths) {
    try {
      await fs.access(tp, fsConstants.R_OK);
      templatePdfPath = tp;
      break;
    } catch { /* ignore */ }
  }

  const contractsData = generateContracts(contractCount, tenant.id, user.id);
  const createdContracts = [];

  for (let i = 0; i < contractsData.length; i++) {
    const data = contractsData[i];
    const contract = await prisma.contract.create({ data });
    createdContracts.push(contract);

    // Generate a demo PDF file for this contract
    const pdfFileName = `demo-contract-${i + 1}.pdf`;
    const pdfPath = path.join(uploadsDir, pdfFileName);
    try {
      if (templatePdfPath) {
        await fs.copyFile(templatePdfPath, pdfPath);
      } else {
        // Minimal valid PDF fallback
        const minimalPdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 50 700 Td (${data.contractTitle}) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n0000000191 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n292\n%%EOF\n`;
        await fs.writeFile(pdfPath, minimalPdf);
      }
    } catch (pdfErr) {
      console.warn(`Warning: Could not create PDF for contract ${contract.id}:`, pdfErr);
    }
  }

  console.log(`Created ${createdContracts.length} contracts.`);

  // Seed obligations for each contract
  let obligationCount = 0;
  for (const contract of createdContracts) {
    const obligations = generateObligations(contract.id, tenant.id, contract.contractTitle || contract.fileName);
    for (const ob of obligations) {
      await prisma.obligation.create({ data: ob });
      obligationCount++;
    }
  }

  console.log(`Created ${obligationCount} obligations.`);

  // Seed renewal history for ~20% of contracts
  const renewalCount = Math.floor(createdContracts.length * 0.2);
  for (let i = 0; i < renewalCount; i++) {
    const contract = createdContracts[i];
    await prisma.renewalHistory.create({
      data: {
        contractId: contract.id,
        tenantId: tenant.id,
        renewalNumber: 1,
        renewalType: 'STANDARD',
        previousStartDate: contract.effectiveDate,
        previousEndDate: contract.expirationDate,
        previousValue: contract.totalValue,
        newStartDate: new Date(contract.expirationDate || new Date()),
        newEndDate: new Date(new Date(contract.expirationDate || new Date()).setFullYear(new Date(contract.expirationDate || new Date()).getFullYear() + 1)),
        newValue: contract.totalValue ? (Number(contract.totalValue) * 1.05) : 0,
        valueChangePercent: 5.0,
        completedAt: new Date(),
      },
    });
  }

  console.log(`Created ${renewalCount} renewal history entries.`);

  // ============================================================================
  // Seed demo access groups (baskets) so the feature is visible on day one
  // ============================================================================

  // Clean existing demo group access for this tenant to avoid duplication
  const existingGroups = await prisma.userGroup.findMany({
    where: { tenantId: tenant.id },
    select: { id: true },
  });

  if (existingGroups.length > 0) {
    console.log(`Cleaning ${existingGroups.length} existing demo groups...`);
    await prisma.contractGroupAccess.deleteMany({ where: { groupId: { in: existingGroups.map(g => g.id) } } });
    await prisma.userGroupMember.deleteMany({ where: { groupId: { in: existingGroups.map(g => g.id) } } });
    await prisma.userGroup.deleteMany({ where: { tenantId: tenant.id } });
  }

  const groupDefinitions = [
    {
      name: 'Legal',
      description: 'Legal department contract review and compliance oversight.',
      color: '#EF4444',
      contractTypes: new Set(['NDA', 'LICENSE AGREEMENT', 'CONSULTING AGREEMENT', 'FRAMEWORK AGREEMENT']),
    },
    {
      name: 'Procurement',
      description: 'Procurement team managing supplier agreements and sourcing.',
      color: '#3B82F6',
      contractTypes: new Set(['SUPPLY AGREEMENT', 'SUBCONTRACT', 'LEASE']),
    },
    {
      name: 'Finance',
      description: 'Finance team overseeing payment terms, SLAs, and maintenance budgets.',
      color: '#10B981',
      contractTypes: new Set(['SERVICE CONTRACT', 'MAINTENANCE CONTRACT', 'SLA']),
    },
  ];

  const demoGroups = [];
  for (const def of groupDefinitions) {
    const group = await prisma.userGroup.create({
      data: {
        tenantId: tenant.id,
        name: def.name,
        description: def.description,
        color: def.color,
        contractAccessLevel: 'assigned',
        createdBy: user.id,
      },
    });
    demoGroups.push({ group, contractTypes: def.contractTypes });

    await prisma.userGroupMember.create({
      data: {
        groupId: group.id,
        userId: user.id,
        role: 'leader',
        addedBy: user.id,
      },
    });
  }

  // Assign contracts to groups based on contract type
  let groupAssignmentCount = 0;
  for (const { group, contractTypes } of demoGroups) {
    const matchedContracts = createdContracts.filter(c => contractTypes.has(c.contractType));
    for (const contract of matchedContracts) {
      await prisma.contractGroupAccess.create({
        data: {
          contractId: contract.id,
          groupId: group.id,
          accessLevel: 'edit',
          grantedBy: user.id,
        },
      });
      groupAssignmentCount++;
    }
  }

  console.log(`Created ${demoGroups.length} demo access groups with ${groupAssignmentCount} contract assignments.`);

  console.log('');
  console.log('Production demo tenant is ready.');
  console.log(`Tenant: ${tenant.id} (${tenant.slug})`);
  console.log(`User: ${user.email}`);
  console.log(`Role: ${user.role}`);
  console.log(`Contracts: ${createdContracts.length}`);
  console.log(`Obligations: ${obligationCount}`);
  console.log(`Renewals: ${renewalCount}`);
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
