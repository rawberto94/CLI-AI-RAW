/**
 * Prisma client for agents
 */

import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
export const prisma = getClient();

export default prisma;
