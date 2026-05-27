import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_TENANT_IDS = ['acme', 'demo', 'tenant-roberto', 'tenant-florian'];

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function tenantContractId(tenantId: string): string {
  return `renewal-demo-${tenantId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

async function seedRenewalDemoContract(tenantId: string) {
  const now = new Date();
  const effectiveDate = addDays(now, -341);
  const expirationDate = addDays(now, 24);
  const noticeDeadline = addDays(expirationDate, -45);
  const id = tenantContractId(tenantId);

  const contract = await prisma.contract.upsert({
    where: { id },
    update: {
      contractTitle: 'DEMO Renewal Showcase - Cloud Support Agreement',
      originalName: 'DEMO_Renewal_Showcase_Cloud_Support_Agreement.pdf',
      fileName: 'DEMO_Renewal_Showcase_Cloud_Support_Agreement.pdf',
      status: 'COMPLETED',
      contractType: 'SERVICE',
      category: 'Cloud Services',
      effectiveDate,
      startDate: effectiveDate,
      expirationDate,
      endDate: expirationDate,
      totalValue: 1200000,
      annualValue: 1200000,
      currency: 'CHF',
      clientName: 'Contigo Labs AG',
      supplierName: 'Helvetic Cloud Services AG',
      description: 'Demo cloud support agreement seeded for renewal workflow demonstrations.',
      rawText: demoRawText(expirationDate, noticeDeadline),
      searchableText: demoRawText(expirationDate, noticeDeadline),
      autoRenewalEnabled: false,
      renewalStatus: 'PENDING',
      renewalTerms: {
        initialTerm: '12 months',
        renewalTerm: '12 months by mutual agreement',
        noticePeriodDays: 45,
        demo: true,
      },
      noticePeriodDays: 45,
      daysUntilExpiry: 24,
      expirationRisk: 'HIGH',
      isExpired: false,
      processedAt: now,
      paymentTerms: 'NET_45',
      paymentFrequency: 'ANNUALLY',
      aiMetadata: {
        demoSeed: 'scripts/seed-renewals-demo.ts',
        tcv_amount: 1200000,
        currency: 'CHF',
        contract_end_date: expirationDate.toISOString().slice(0, 10),
        notice_deadline: noticeDeadline.toISOString().slice(0, 10),
      },
      metadata: {
        demoSeed: 'scripts/seed-renewals-demo.ts',
        external_parties: [
          { legalName: 'Contigo Labs AG', role: 'Client' },
          { legalName: 'Helvetic Cloud Services AG', role: 'Supplier' },
        ],
        contract_short_description: 'Cloud support agreement expiring soon, with a missed notice window and renewal negotiation items.',
        notice_period: '45 days',
        currency: 'CHF',
      },
      updatedAt: now,
    },
    create: {
      id,
      tenantId,
      storagePath: `demo/${tenantId}/renewal-showcase.pdf`,
      mimeType: 'application/pdf',
      fileName: 'DEMO_Renewal_Showcase_Cloud_Support_Agreement.pdf',
      originalName: 'DEMO_Renewal_Showcase_Cloud_Support_Agreement.pdf',
      fileSize: BigInt(186000),
      storageProvider: 'demo',
      status: 'COMPLETED',
      contractType: 'SERVICE',
      category: 'Cloud Services',
      contractTitle: 'DEMO Renewal Showcase - Cloud Support Agreement',
      description: 'Demo cloud support agreement seeded for renewal workflow demonstrations.',
      effectiveDate,
      startDate: effectiveDate,
      expirationDate,
      endDate: expirationDate,
      totalValue: 1200000,
      annualValue: 1200000,
      currency: 'CHF',
      clientName: 'Contigo Labs AG',
      supplierName: 'Helvetic Cloud Services AG',
      rawText: demoRawText(expirationDate, noticeDeadline),
      searchableText: demoRawText(expirationDate, noticeDeadline),
      autoRenewalEnabled: false,
      renewalStatus: 'PENDING',
      renewalTerms: {
        initialTerm: '12 months',
        renewalTerm: '12 months by mutual agreement',
        noticePeriodDays: 45,
        demo: true,
      },
      noticePeriodDays: 45,
      daysUntilExpiry: 24,
      expirationRisk: 'HIGH',
      paymentTerms: 'NET_45',
      paymentFrequency: 'ANNUALLY',
      processedAt: now,
      aiMetadata: {
        demoSeed: 'scripts/seed-renewals-demo.ts',
        tcv_amount: 1200000,
        currency: 'CHF',
        contract_end_date: expirationDate.toISOString().slice(0, 10),
        notice_deadline: noticeDeadline.toISOString().slice(0, 10),
      },
      metadata: {
        demoSeed: 'scripts/seed-renewals-demo.ts',
        external_parties: [
          { legalName: 'Contigo Labs AG', role: 'Client' },
          { legalName: 'Helvetic Cloud Services AG', role: 'Supplier' },
        ],
        contract_short_description: 'Cloud support agreement expiring soon, with a missed notice window and renewal negotiation items.',
        notice_period: '45 days',
        currency: 'CHF',
      },
    },
  });

  await prisma.artifact.upsert({
    where: { contractId_type: { contractId: contract.id, type: 'OVERVIEW' } },
    update: {
      data: overviewArtifactData(),
      title: 'Overview',
      regeneratedAt: now,
      regeneratedBy: 'seed-renewals-demo',
      regenerationReason: 'Refresh renewal demo artifact',
    },
    create: {
      contractId: contract.id,
      tenantId,
      type: 'OVERVIEW',
      title: 'Overview',
      data: overviewArtifactData(),
      modelUsed: 'demo-seed',
      promptVersion: 'seed-renewals-demo',
    },
  });

  await prisma.artifact.upsert({
    where: { contractId_type: { contractId: contract.id, type: 'FINANCIAL' } },
    update: {
      data: financialArtifactData(),
      title: 'Financial Summary',
      regeneratedAt: now,
      regeneratedBy: 'seed-renewals-demo',
      regenerationReason: 'Refresh renewal demo artifact',
    },
    create: {
      contractId: contract.id,
      tenantId,
      type: 'FINANCIAL',
      title: 'Financial Summary',
      data: financialArtifactData(),
      modelUsed: 'demo-seed',
      promptVersion: 'seed-renewals-demo',
    },
  });

  await prisma.artifact.upsert({
    where: { contractId_type: { contractId: contract.id, type: 'RISK' } },
    update: {
      data: riskArtifactData(),
      title: 'Risk Assessment',
      regeneratedAt: now,
      regeneratedBy: 'seed-renewals-demo',
      regenerationReason: 'Refresh renewal demo artifact',
    },
    create: {
      contractId: contract.id,
      tenantId,
      type: 'RISK',
      title: 'Risk Assessment',
      data: riskArtifactData(),
      modelUsed: 'demo-seed',
      promptVersion: 'seed-renewals-demo',
    },
  });

  await prisma.artifact.upsert({
    where: { contractId_type: { contractId: contract.id, type: 'RENEWAL' } },
    update: {
      data: renewalArtifactData(expirationDate, noticeDeadline),
      title: 'Renewal Analysis',
      regeneratedAt: now,
      regeneratedBy: 'seed-renewals-demo',
      regenerationReason: 'Refresh renewal demo artifact',
    },
    create: {
      contractId: contract.id,
      tenantId,
      type: 'RENEWAL',
      title: 'Renewal Analysis',
      data: renewalArtifactData(expirationDate, noticeDeadline),
      modelUsed: 'demo-seed',
      promptVersion: 'seed-renewals-demo',
    },
  });

  return contract;
}

function demoRawText(expirationDate: Date, noticeDeadline: Date): string {
  return [
    'DEMO RENEWAL SHOWCASE - CLOUD SUPPORT AGREEMENT',
    'Client: Contigo Labs AG',
    'Supplier: Helvetic Cloud Services AG',
    `Expiration Date: ${expirationDate.toISOString().slice(0, 10)}`,
    `Notice Deadline: ${noticeDeadline.toISOString().slice(0, 10)}`,
    'Total Contract Value: CHF 1,200,000.',
    'The agreement renews only by written mutual agreement. Client must provide renewal or termination notice 45 days before expiration.',
    'Key renewal issues: proposed 8% price increase, SLA credits require review, and data residency commitments should be preserved.',
  ].join('\n');
}

function overviewArtifactData() {
  return {
    _mode: 'demo',
    summary: 'Cloud support agreement expiring soon. Renewal review should focus on price increase, SLA credits, and preserving Swiss/EU data residency commitments.',
    parties: [
      { name: 'Contigo Labs AG', role: 'Client' },
      { name: 'Helvetic Cloud Services AG', role: 'Supplier' },
    ],
    keyTerms: [
      { term: 'Notice period', value: '45 days' },
      { term: 'Renewal term', value: '12 months by mutual agreement' },
      { term: 'TCV', value: 'CHF 1,200,000' },
    ],
  };
}

function financialArtifactData() {
  return {
    _mode: 'demo',
    totalValue: 1200000,
    currency: 'CHF',
    paymentTerms: 'Annual support fee, invoiced annually, net 45.',
    renewalDelta: {
      proposedIncreasePercent: 8,
      negotiationTarget: 'Cap increase at 3% unless SLA credits improve.',
    },
  };
}

function riskArtifactData() {
  return {
    _mode: 'demo',
    overallScore: 55,
    risks: [
      { category: 'Notice Window', level: 'high', description: 'Notice deadline has already passed, so renewal leverage is time-sensitive.' },
      { category: 'Price Increase', level: 'medium', description: 'Supplier proposed an 8% uplift without matching SLA improvements.' },
      { category: 'Data Residency', level: 'medium', description: 'Renewal should preserve current Swiss/EU data residency obligations.' },
    ],
  };
}

function renewalArtifactData(expirationDate: Date, noticeDeadline: Date) {
  return {
    _mode: 'demo',
    renewalType: 'manual renewal by mutual written agreement',
    currentTermEnd: expirationDate.toISOString().slice(0, 10),
    noticeDeadline: noticeDeadline.toISOString().slice(0, 10),
    noticePeriodDays: 45,
    noticeStatus: 'overdue',
    autoRenewal: false,
    renewalRecommendation: 'Start renewal negotiation immediately and preserve data residency and SLA protections.',
    negotiationPoints: [
      'Cap any price increase at 3% unless SLA credits improve.',
      'Preserve Swiss/EU data residency commitments.',
      'Clarify service credit remedies before signing the renewal.',
    ],
  };
}

async function main() {
  const seedAllTenants = process.argv.includes('--all-tenants');
  let tenants = await prisma.tenant.findMany({
    where: seedAllTenants ? undefined : { id: { in: DEFAULT_TENANT_IDS } },
    select: { id: true, name: true },
  });

  if (tenants.length === 0) {
    tenants = await prisma.tenant.findMany({ take: 1, select: { id: true, name: true } });
  }

  if (tenants.length === 0) {
    tenants = [await prisma.tenant.create({
      data: { id: 'demo', name: 'Demo Organization', slug: 'demo', status: 'ACTIVE' },
      select: { id: true, name: true },
    })];
  }

  const seeded = [];
  for (const tenant of tenants) {
    const contract = await seedRenewalDemoContract(tenant.id);
    seeded.push({ tenantId: tenant.id, tenantName: tenant.name, contractId: contract.id, title: contract.contractTitle });
  }

  console.log(JSON.stringify({ seeded }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });