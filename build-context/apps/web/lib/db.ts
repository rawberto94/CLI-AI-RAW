/**
 * Database client export
 * Re-exports Prisma client as 'db' for consistency
 */

import { prisma } from './prisma';

export const db = prisma;
export { prisma };
