import prisma from 'clients-db';

const permissions = [
  // Tenant permissions
  { action: 'create', subject: 'Tenant' },
  { action: 'read', subject: 'Tenant' },
  { action: 'update', subject: 'Tenant' },
  { action: 'delete', subject: 'Tenant' },

  // Contract permissions
  { action: 'create', subject: 'Contract' },
  { action: 'read', subject: 'Contract' },
  { action: 'update', subject: 'Contract' },
  { action: 'delete', subject: 'Contract' },
];

export async function seedRbac() {
  console.log('Seeding RBAC...');

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { action_subject: permission },
      update: {},
      create: permission,
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user' },
  });

  const allPermissions = await prisma.permission.findMany();

  for (const permission of allPermissions) {
    await prisma.permissionsOnRoles.upsert({
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

  const readPermissions = await prisma.permission.findMany({
    where: { action: 'read' },
  });

  for (const permission of readPermissions) {
    await prisma.permissionsOnRoles.upsert({
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

  console.log('RBAC seeding finished.');
}
