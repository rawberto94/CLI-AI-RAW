const { PrismaClient, TeamRole, InvitationStatus } = require('@prisma/client');
const { resolveSSOSignInMapping } = require('./lib/sso-access');
const prisma = new PrismaClient();

async function run() {
  const emailAmbiguous = 'ambiguous-test@example.com';
  const emailSingle = 'single-test@example.com';
  const tenantId1 = 'tenant-1';
  const tenantId2 = 'tenant-2';

  console.log('--- Case 1: Ambiguous Invitations ---');
  try {
    await prisma.teamInvitation.createMany({
      data: [
        {
          email: emailAmbiguous,
          tenantId: tenantId1,
          role: TeamRole.MEMBER,
          status: InvitationStatus.PENDING,
          inviterId: 'system',
        },
        {
          email: emailAmbiguous,
          tenantId: tenantId2,
          role: TeamRole.ADMIN,
          status: InvitationStatus.PENDING,
          inviterId: 'system',
        },
      ],
    });

    const resultAmbiguous = await resolveSSOSignInMapping(emailAmbiguous);
    console.log('Result for ambiguous case:', JSON.stringify(resultAmbiguous));
    if (resultAmbiguous === null) {
      console.log('SUCCESS: Ambiguous case returned null.');
    } else {
      console.log('FAILURE: Ambiguous case did not return null.');
    }
  } finally {
    await prisma.teamInvitation.deleteMany({ where: { email: emailAmbiguous } });
  }

  console.log('\n--- Case 2: Single Invitation ---');
  try {
    await prisma.teamInvitation.create({
      data: {
        email: emailSingle,
        tenantId: tenantId1,
        role: TeamRole.MEMBER,
        status: InvitationStatus.PENDING,
        inviterId: 'system',
      },
    });

    const resultSingle = await resolveSSOSignInMapping(emailSingle);
    console.log('Result for single case:', JSON.stringify(resultSingle));
    if (resultSingle && resultSingle.tenantId === tenantId1 && resultSingle.role === TeamRole.MEMBER) {
      console.log('SUCCESS: Single case returned correct tenant/role.');
    } else {
      console.log('FAILURE: Single case returned incorrect data:', JSON.stringify(resultSingle));
    }
  } finally {
    await prisma.teamInvitation.deleteMany({ where: { email: emailSingle } });
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
