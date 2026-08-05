/**
 * Prisma client for agents / workers
 */

import clientsDb from 'clients-db';

const getClient = typeof clientsDb === 'function' ? clientsDb : (clientsDb as any).default;
export const prisma = getClient();

export default prisma;

// Re-export tenant helpers for worker services (Wave D)
export { withTenant, assertSafeTenantId, TenantGuardError } from 'clients-db';

