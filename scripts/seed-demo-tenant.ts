import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTenant() {
  try {
    // Create demo tenant
    const tenant = await prisma.tenant.upsert({
      where: { id: 'demo' },
      update: {},
      create: {
        id: 'demo',
        name: 'Demo Organization',
        slug: 'demo',
        plan: 'enterprise',
        status: 'active',
        settings: {},
        metadata: {
          description: 'Demo tenant for testing',
          createdBy: 'system'
        }
      }
    });

    console.log('✅ Demo tenant created:', tenant);

    // Also create a default user for the tenant
    const user = await prisma.user.upsert({
      where: { email: 'demo@example.com' },
      update: {},
      create: {
        email: 'demo@example.com',
        name: 'Demo User',
        tenantId: 'demo',
        role: 'admin',
        emailVerified: new Date()
      }
    });

    console.log('✅ Demo user created:', user);

  } catch (error) {
    console.error('❌ Error seeding tenant:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedTenant();
