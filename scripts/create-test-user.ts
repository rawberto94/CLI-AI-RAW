import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    // Check if default tenant exists
    let tenant = await prisma.tenant.findFirst();
    
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          id: 'default-tenant',
          name: 'Default Organization',
          slug: 'default',
        }
      });
      console.log('Created default tenant');
    }
    
    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@contigo.com' }
    });
    
    const passwordHash = await bcrypt.hash('Admin123!', 12);
    
    if (existingUser) {
      await prisma.user.update({
        where: { email: 'admin@contigo.com' },
        data: { 
          passwordHash,
          status: 'ACTIVE',
          role: 'admin'
        }
      });
      console.log('Updated existing user password');
    } else {
      await prisma.user.create({
        data: {
          email: 'admin@contigo.com',
          firstName: 'Admin',
          lastName: 'User',
          passwordHash,
          status: 'ACTIVE',
          role: 'admin',
          tenantId: tenant.id,
        }
      });
      console.log('Created new admin user');
    }
    
    console.log('');
    console.log('=== Test Credentials ===');
    console.log('Email: admin@contigo.com');
    console.log('Password: Admin123!');
    console.log('========================');
    
  } catch (error: unknown) {
    console.error('Error:', (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUser();
