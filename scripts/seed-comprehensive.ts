import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive database seeding...\n');

  // Clean up existing data in dependency order
  console.log('🧹 Cleaning up existing data...');
  await prisma.workflowStepExecution.deleteMany({});
  await prisma.workflowExecution.deleteMany({});
  await prisma.workflowStep.deleteMany({});
  await prisma.workflow.deleteMany({});
  await prisma.contractComment.deleteMany({});
  await prisma.contractActivity.deleteMany({});
  await prisma.contractVersion.deleteMany({});
  await prisma.contractTemplate.deleteMany({});
  await prisma.rateCardEntry.deleteMany({});
  await prisma.contractMetadata.deleteMany({});
  await prisma.contract.deleteMany({});
  await prisma.party.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});
  console.log('✅ Cleanup complete\n');

  // 1. Create tenant
  console.log('1️⃣ Creating tenant...');
  const tenant = await prisma.tenant.create({
    data: {
      id: 'demo',
      name: 'Demo Corporation',
      slug: 'demo',
    },
  });
  console.log('   ✅ Created tenant: ' + tenant.name + '\n');

  // 2. Create users
  console.log('2️⃣ Creating users...');
  const dummyHash = '$2b$10$dummyhashdummyhashdummyhashdummyhashdummy00';
  const users = await Promise.all([
    prisma.user.create({ data: { id: 'user-001', tenantId: tenant.id, email: 'admin@acme.com', firstName: 'Admin', lastName: 'User', passwordHash: dummyHash, role: 'admin' } }),
    prisma.user.create({ data: { id: 'user-002', tenantId: tenant.id, email: 'john.doe@acme.com', firstName: 'John', lastName: 'Doe', passwordHash: dummyHash, role: 'manager' } }),
    prisma.user.create({ data: { id: 'user-003', tenantId: tenant.id, email: 'jane.smith@acme.com', firstName: 'Jane', lastName: 'Smith', passwordHash: dummyHash, role: 'analyst' } }),
    prisma.user.create({ data: { id: 'user-004', tenantId: tenant.id, email: 'mike.wilson@acme.com', firstName: 'Mike', lastName: 'Wilson', passwordHash: dummyHash, role: 'viewer' } }),
  ]);
  console.log('   ✅ Created ' + users.length + ' users\n');

  // 3. Create parties (suppliers/clients)
  console.log('3️⃣ Creating parties...');
  const parties = await Promise.all([
    prisma.party.create({ data: { id: 'party-001', name: 'TechSupply Inc.', type: 'SUPPLIER', email: 'contact@techsupply.com', phone: '+1-555-0101', address: { street: '123 Tech Lane', city: 'Silicon Valley', state: 'CA', zip: '94000' } } }),
    prisma.party.create({ data: { id: 'party-002', name: 'Global Services LLC', type: 'SUPPLIER', email: 'info@globalservices.com', phone: '+1-555-0102', address: { street: '456 Business Ave', city: 'New York', state: 'NY', zip: '10001' } } }),
    prisma.party.create({ data: { id: 'party-003', name: 'Industrial Parts Co.', type: 'SUPPLIER', email: 'sales@industrialparts.com', phone: '+1-555-0103', address: { street: '789 Factory Rd', city: 'Detroit', state: 'MI', zip: '48201' } } }),
    prisma.party.create({ data: { id: 'party-004', name: 'CloudTech Solutions', type: 'SUPPLIER', email: 'enterprise@cloudtech.io', phone: '+1-555-0104', address: { street: '321 Cloud Plaza', city: 'Seattle', state: 'WA', zip: '98101' } } }),
  ]);
  console.log('   ✅ Created ' + parties.length + ' parties\n');

  // 4. Create contracts
  console.log('4️⃣ Creating contracts...');
  const contractData = [
    { id: 'contract-001', contractTitle: 'Enterprise Software License Agreement', status: 'ACTIVE' as const, supplierId: parties[0].id, supplierName: parties[0].name, value: 250000, startDate: new Date('2024-01-01'), endDate: new Date('2026-12-31') },
    { id: 'contract-002', contractTitle: 'IT Support and Maintenance', status: 'ACTIVE' as const, supplierId: parties[1].id, supplierName: parties[1].name, value: 180000, startDate: new Date('2024-03-01'), endDate: new Date('2025-02-28') },
    { id: 'contract-003', contractTitle: 'Manufacturing Equipment Supply', status: 'PROCESSING' as const, supplierId: parties[2].id, supplierName: parties[2].name, value: 500000, startDate: new Date('2024-06-01'), endDate: new Date('2027-05-31') },
    { id: 'contract-004', contractTitle: 'Cloud Infrastructure Services', status: 'ACTIVE' as const, supplierId: parties[3].id, supplierName: parties[3].name, value: 120000, startDate: new Date('2024-01-15'), endDate: new Date('2024-12-31') },
    { id: 'contract-005', contractTitle: 'Consulting Services Agreement', status: 'PROCESSING' as const, supplierId: parties[1].id, supplierName: parties[1].name, value: 75000, startDate: new Date('2024-08-01'), endDate: new Date('2024-12-31') },
    { id: 'contract-006', contractTitle: 'Hardware Procurement - Q4 2024', status: 'ARCHIVED' as const, supplierId: parties[0].id, supplierName: parties[0].name, value: 320000, startDate: new Date('2023-10-01'), endDate: new Date('2023-12-31') },
  ];

  const contracts = await Promise.all(
    contractData.map((c, i) =>
      prisma.contract.create({
        data: {
          id: c.id,
          tenantId: tenant.id,
          contractTitle: c.contractTitle,
          fileName: 'contract-' + (i + 1) + '.pdf',
          mimeType: 'application/pdf',
          fileSize: BigInt(100000 + i * 10000),
          status: c.status,
          supplierId: c.supplierId,
          supplierName: c.supplierName,
          totalValue: c.value,
          startDate: c.startDate,
          endDate: c.endDate,
          description: 'Contract description for ' + c.contractTitle,
          contractType: 'service',
        },
      })
    )
  );
  console.log('   ✅ Created ' + contracts.length + ' contracts\n');

  // 5. Create contract versions
  console.log('5️⃣ Creating contract versions...');
  let versionCount = 0;
  for (const contract of contracts.slice(0, 4)) {
    for (let v = 1; v <= 3; v++) {
      await prisma.contractVersion.create({
        data: {
          tenantId: tenant.id,
          contractId: contract.id,
          versionNumber: v,
          changes: { modified: v === 1 ? ['Initial creation'] : ['Amendment ' + (v - 1)], sections: ['all'] },
          summary: v === 1 ? 'Initial contract version' : 'Version ' + v + ' - Updated terms',
          uploadedBy: users[v % users.length].id,
        },
      });
      versionCount++;
    }
  }
  console.log('   ✅ Created ' + versionCount + ' contract versions\n');

  // 6. Create contract comments
  console.log('6️⃣ Creating contract comments...');
  let commentCount = 0;
  for (const contract of contracts.slice(0, 4)) {
    const title = contract.contractTitle || 'Contract';
    const parentComment = await prisma.contractComment.create({
      data: { tenantId: tenant.id, contractId: contract.id, userId: users[0].id, content: 'Initial review of ' + title + '. Please check the terms.', mentions: [users[1].id], isResolved: false },
    });
    commentCount++;
    await prisma.contractComment.create({
      data: { tenantId: tenant.id, contractId: contract.id, userId: users[1].id, content: 'I have reviewed the terms. Looks good.', parentId: parentComment.id, mentions: [], isResolved: false },
    });
    commentCount++;
    await prisma.contractComment.create({
      data: { tenantId: tenant.id, contractId: contract.id, userId: users[2].id, content: 'Legal review completed. No issues found.', mentions: [users[0].id, users[1].id], isResolved: true },
    });
    commentCount++;
  }
  console.log('   ✅ Created ' + commentCount + ' contract comments\n');

  // 7. Create contract activities
  console.log('7️⃣ Creating contract activities...');
  let activityCount = 0;
  const activityTypes = ['upload', 'edit', 'comment', 'approval', 'download'];
  const activityActions = ['Uploaded contract', 'Edited contract terms', 'Added comment', 'Approved contract', 'Downloaded contract'];
  for (const contract of contracts) {
    const title = contract.contractTitle || 'Contract';
    for (let i = 0; i < 5; i++) {
      await prisma.contractActivity.create({
        data: {
          tenantId: tenant.id,
          contractId: contract.id,
          userId: users[i % users.length].id,
          type: activityTypes[i % activityTypes.length],
          action: activityActions[i % activityActions.length],
          details: 'Activity for ' + title,
          timestamp: new Date(Date.now() - (10 - i) * 24 * 60 * 60 * 1000),
        },
      });
      activityCount++;
    }
  }
  console.log('   ✅ Created ' + activityCount + ' contract activities\n');

  // 8. Create contract templates
  console.log('8️⃣ Creating contract templates...');
  const templates = await Promise.all([
    prisma.contractTemplate.create({ data: { tenantId: tenant.id, name: 'Standard Service Agreement', description: 'Template for general service contracts.', category: 'service', clauses: [{ id: 'scope', title: 'Scope of Work', content: 'The Contractor agrees to...' }], structure: { sections: ['scope', 'payment', 'term'] }, metadata: {} } }),
    prisma.contractTemplate.create({ data: { tenantId: tenant.id, name: 'Software License Agreement', description: 'Template for software licensing.', category: 'license', clauses: [{ id: 'grant', title: 'License Grant', content: 'Subject to terms...' }], structure: { sections: ['grant', 'restrictions', 'ip'] }, metadata: {} } }),
    prisma.contractTemplate.create({ data: { tenantId: tenant.id, name: 'Non-Disclosure Agreement', description: 'Standard NDA template.', category: 'nda', clauses: [{ id: 'definition', title: 'Confidential Info', content: 'Means...' }], structure: { sections: ['definition', 'obligations'] }, metadata: {} } }),
    prisma.contractTemplate.create({ data: { tenantId: tenant.id, name: 'Master Services Agreement', description: 'Comprehensive MSA.', category: 'msa', clauses: [{ id: 'relationship', title: 'Parties', content: 'Independent contractors...' }], structure: { sections: ['relationship', 'sow', 'fees'] }, metadata: {} } }),
    prisma.contractTemplate.create({ data: { tenantId: tenant.id, name: 'Procurement Agreement', description: 'Goods procurement template.', category: 'procurement', clauses: [{ id: 'goods', title: 'Goods', content: 'Seller agrees...' }], structure: { sections: ['goods', 'delivery'] }, metadata: {} } }),
  ]);
  console.log('   ✅ Created ' + templates.length + ' contract templates\n');

  // 9. Create workflows and executions
  console.log('9️⃣ Creating workflows and executions...');
  const workflow1 = await prisma.workflow.create({
    data: { id: 'workflow-001', tenantId: tenant.id, name: 'Contract Approval', description: 'Standard approval workflow.', type: 'APPROVAL', isActive: true },
  });
  const workflow2 = await prisma.workflow.create({
    data: { id: 'workflow-002', tenantId: tenant.id, name: 'Contract Renewal', description: 'Renewal notification workflow.', type: 'REVIEW', isActive: true },
  });

  // Create workflow steps for workflow1
  await prisma.workflowStep.createMany({
    data: [
      { workflowId: workflow1.id, name: 'Manager Review', type: 'APPROVAL', order: 1, config: {} },
      { workflowId: workflow1.id, name: 'Legal Review', type: 'APPROVAL', order: 2, config: {} },
      { workflowId: workflow1.id, name: 'Final Approval', type: 'APPROVAL', order: 3, config: {} },
    ],
  });

  // Create workflow executions
  let executionCount = 0;
  for (const contract of contracts.slice(0, 3)) {
    const isCompleted = contract.status === 'ACTIVE';
    await prisma.workflowExecution.create({
      data: {
        tenantId: tenant.id,
        workflowId: workflow1.id,
        contractId: contract.id,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        currentStep: isCompleted ? 'step-3' : 'step-1',
        initiatedBy: users[0].id,
        startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        completedAt: isCompleted ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : null,
      },
    });
    executionCount++;
  }
  console.log('   ✅ Created 2 workflows and ' + executionCount + ' executions\n');

  // Print summary
  console.log('='.repeat(50));
  console.log('📊 SEEDING COMPLETE - SUMMARY');
  console.log('='.repeat(50));
  console.log('   Tenants:            1');
  console.log('   Users:              ' + users.length);
  console.log('   Parties:            ' + parties.length);
  console.log('   Contracts:          ' + contracts.length);
  console.log('   Contract Versions:  ' + versionCount);
  console.log('   Contract Comments:  ' + commentCount);
  console.log('   Contract Activities:' + activityCount);
  console.log('   Templates:          ' + templates.length);
  console.log('   Workflows:          2');
  console.log('   Workflow Executions:' + executionCount);
  console.log('='.repeat(50));
  console.log('\n✅ All data seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
