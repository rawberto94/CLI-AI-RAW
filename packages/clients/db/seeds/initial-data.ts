import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {

  // Create system roles
  
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'System administrator with full access',
      isSystem: true,
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Standard user with basic access',
      isSystem: true,
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: {
      name: 'viewer',
      description: 'Read-only access to contracts and analysis',
      isSystem: true,
    },
  });

  // Create system permissions
  
  const permissions = [
    // Contract permissions
    { action: 'create', subject: 'Contract' },
    { action: 'read', subject: 'Contract' },
    { action: 'update', subject: 'Contract' },
    { action: 'delete', subject: 'Contract' },
    
    // User permissions
    { action: 'create', subject: 'User' },
    { action: 'read', subject: 'User' },
    { action: 'update', subject: 'User' },
    { action: 'delete', subject: 'User' },
    
    // Template permissions
    { action: 'create', subject: 'Template' },
    { action: 'read', subject: 'Template' },
    { action: 'update', subject: 'Template' },
    { action: 'delete', subject: 'Template' },
    
    // Tenant permissions
    { action: 'create', subject: 'Tenant' },
    { action: 'read', subject: 'Tenant' },
    { action: 'update', subject: 'Tenant' },
    { action: 'delete', subject: 'Tenant' },
    
    // Analysis permissions
    { action: 'read', subject: 'Analysis' },
    { action: 'create', subject: 'Analysis' },
    
    // Audit permissions
    { action: 'read', subject: 'AuditLog' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { action_subject: { action: perm.action, subject: perm.subject } },
      update: {},
      create: perm,
    });
  }

  // Assign permissions to roles
  
  // Admin gets all permissions
  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // User gets contract and template permissions (read/create/update)
  const userPermissions = await prisma.permission.findMany({
    where: {
      OR: [
        { subject: 'Contract', action: { in: ['create', 'read', 'update'] } },
        { subject: 'Template', action: { in: ['read'] } },
        { subject: 'Analysis', action: { in: ['read', 'create'] } },
      ],
    },
  });

  for (const permission of userPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: userRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: userRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Viewer gets only read permissions
  const viewerPermissions = await prisma.permission.findMany({
    where: {
      action: 'read',
      subject: { in: ['Contract', 'Template', 'Analysis'] },
    },
  });

  for (const permission of viewerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: viewerRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: viewerRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Create demo tenant
  
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo',
      status: 'ACTIVE',
      configuration: {
        create: {
          aiModels: {
            default: 'gpt-4o-mini',
            available: ['gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
          },
          aiCostBudget: 100.00,
          aiCostAlerts: true,
          securitySettings: {
            requireMFA: false,
            sessionTimeout: 3600,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSymbols: false,
            },
          },
          integrations: {
            sharepoint: {
              enabled: false,
            },
            slack: {
              enabled: false,
            },
          },
          workflowSettings: {
            autoAnalysis: true,
            requireApproval: false,
            notificationChannels: ['email'],
          },
        },
      },
      subscription: {
        create: {
          plan: 'PROFESSIONAL',
          status: 'ACTIVE',
          startDate: new Date(),
          billingCycle: 'MONTHLY',
        },
      },
      usage: {
        create: {
          contractsProcessed: 0,
          aiTokensUsed: 0,
          storageUsed: 0,
          apiCallsCount: 0,
          monthlyContractLimit: 1000,
          monthlyTokenLimit: 1000000,
          monthlyStorageLimit: 10737418240, // 10GB
          monthlyApiLimit: 10000,
          resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        },
      },
    },
  });

  // Create demo admin user
  
  const hashedPassword = await hash('admin123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demo.com',
      passwordHash: hashedPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  // Assign admin role to demo user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  // Create demo regular user
  
  const userHashedPassword = await hash('user123', 10);
  
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@demo.com' },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: 'user@demo.com',
      passwordHash: userHashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });

  // Assign user role to demo user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: regularUser.id,
        roleId: userRole.id,
      },
    },
    update: {},
    create: {
      userId: regularUser.id,
      roleId: userRole.id,
    },
  });

  // Create sample contract templates
  
  const templates = [
    {
      name: 'Service Agreement Template',
      description: 'Standard service agreement template for professional services',
      category: 'service',
      clauses: {
        required: [
          'scope_of_work',
          'payment_terms',
          'intellectual_property',
          'confidentiality',
          'termination',
        ],
        optional: [
          'liability_limitation',
          'force_majeure',
          'dispute_resolution',
        ],
      },
      structure: {
        sections: [
          { name: 'Parties', order: 1, required: true },
          { name: 'Scope of Work', order: 2, required: true },
          { name: 'Payment Terms', order: 3, required: true },
          { name: 'Intellectual Property', order: 4, required: true },
          { name: 'Confidentiality', order: 5, required: true },
          { name: 'Term and Termination', order: 6, required: true },
          { name: 'General Provisions', order: 7, required: true },
        ],
      },
      metadata: {
        jurisdiction: 'US',
        language: 'en',
        industry: 'technology',
        complexity: 'medium',
      },
    },
    {
      name: 'Software License Agreement',
      description: 'Template for software licensing agreements',
      category: 'license',
      clauses: {
        required: [
          'license_grant',
          'restrictions',
          'payment_terms',
          'support_maintenance',
          'warranty_disclaimer',
          'liability_limitation',
        ],
        optional: [
          'customization',
          'data_protection',
          'compliance',
        ],
      },
      structure: {
        sections: [
          { name: 'License Grant', order: 1, required: true },
          { name: 'Restrictions', order: 2, required: true },
          { name: 'Payment Terms', order: 3, required: true },
          { name: 'Support and Maintenance', order: 4, required: true },
          { name: 'Warranty and Disclaimer', order: 5, required: true },
          { name: 'Limitation of Liability', order: 6, required: true },
          { name: 'Term and Termination', order: 7, required: true },
        ],
      },
      metadata: {
        jurisdiction: 'US',
        language: 'en',
        industry: 'software',
        complexity: 'high',
      },
    },
  ];

  for (const template of templates) {
    await prisma.contractTemplate.upsert({
      where: {
        tenantId_name_version: {
          tenantId: demoTenant.id,
          name: template.name,
          version: 1,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        name: template.name,
        description: template.description,
        category: template.category,
        clauses: template.clauses,
        structure: template.structure,
        metadata: template.metadata,
        version: 1,
        isActive: true,
        createdBy: adminUser.id,
      },
    });
  }

}

main()
  .catch(() => {
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });