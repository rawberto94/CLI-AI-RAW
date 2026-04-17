// Create admin user script - run inside the container
// Must be copied to /app/ before running so node_modules resolve correctly
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find first tenant
  const tenants = await p.tenant.findMany({ take: 5, select: { id: true, name: true, slug: true } });
  console.log('Tenants:', JSON.stringify(tenants));

  // Find all users
  const users = await p.user.findMany({
    select: { email: true, status: true, role: true, tenantId: true, passwordHash: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  users.forEach(u => {
    const h = u.passwordHash;
    console.log(JSON.stringify({
      email: u.email,
      status: u.status,
      role: u.role,
      tenantId: u.tenantId,
      hashLen: h ? h.length : null,
      hashValid: h ? /^\$2[aby]\$\d{2}\$.{53}$/.test(h) : false,
    }));
  });

  // Create admin if not exists
  const adminEmail = 'admin@mycontigo.app';
  const existing = await p.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log('Admin already exists:', existing.email, 'status:', existing.status);
    // Ensure status is ACTIVE
    if (existing.status !== 'ACTIVE') {
      await p.user.update({ where: { email: adminEmail }, data: { status: 'ACTIVE' } });
      console.log('Updated admin status to ACTIVE');
    }
  } else {
    // Use first tenant
    if (tenants.length === 0) {
      console.log('No tenants found, cannot create admin');
      return;
    }
    const hash = await bcrypt.hash('ContigoAdmin2026!', 12);
    const admin = await p.user.create({
      data: {
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'Contigo',
        passwordHash: hash,
        tenantId: tenants[0].id,
        role: 'owner',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });
    console.log('Admin created:', admin.email, 'tenant:', admin.tenantId);
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect(); });
