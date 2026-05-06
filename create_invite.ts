import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ownerEmail = process.env.OWNER_EMAIL!;
  const memberEmail = process.env.MEMBER_EMAIL!;

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: ownerEmail }
  });

  const tenantId = owner.tenantId;

  const invitation = await prisma.teamInvitation.create({
    data: {
      email: memberEmail,
      tenantId: tenantId,
      role: 'MEMBER',
      token: 'test-invite-token-' + Date.now(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'PENDING'
    }
  });

  console.log('INVITATION_TOKEN=' + invitation.token);
  console.log('TENANT_ID=' + tenantId);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
