const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient({ log: [] });
(async () => {
  try {
    const hash = await bcrypt.hash('Test1234', 10);
    await p.user.update({ 
      where: { email: 'admin@acme.com' }, 
      data: { passwordHash: hash } 
    });
    console.log('PASSWORD_RESET_OK');
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  await p.$disconnect();
})();
