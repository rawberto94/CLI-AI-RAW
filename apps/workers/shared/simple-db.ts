/**
 * Simple database client for workers
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let dbClient: any = null;

// Initialize database client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function initializeDatabase(): Promise<any> {
  if (dbClient) return dbClient;
  
  try {
    // Use the clients-db default export getClient function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientsDbModule = await import('clients-db') as any;
    const getClient = clientsDbModule.default;
    dbClient = getClient(); // This returns a PrismaClient directly
    console.log('✅ Database client initialized via clients-db getClient');
    return dbClient;
  } catch (error) {
    console.warn('⚠️ clients-db failed, using mock client:', error);
    
    // Fallback to mock client that matches Prisma interface
    dbClient = {
      artifact: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: async (data: any) => {
          console.log('📝 Mock: Creating artifact:', String(data?.data?.type ?? 'unknown'));
          return { id: `mock-artifact-${Date.now()}`, ...data?.data };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findFirst: async (query: any) => {
          console.log('🔍 Mock: Finding artifact:', String(query?.where?.type ?? 'any'));
          return null;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (query: any) => {
          console.log('🔍 Mock: Finding artifacts:', String(query?.where?.type ?? 'any'));
          return [];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: async (query: any) => {
          console.log('📝 Mock: Updating artifact:', String(query?.where?.id ?? 'unknown'));
          return { id: 'mock-updated' };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete: async (query: any) => {
          console.log('🗑️ Mock: Deleting artifact:', String(query?.where?.id ?? 'unknown'));
          return { id: 'mock-deleted' };
        },
      },
      contract: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findUnique: async (query: any) => {
          console.log('🔍 Mock: Finding contract:', query?.where?.id);
          // Return a mock contract for testing
          return {
            id: query?.where?.id ?? 'mock-contract',
            tenantId: 'demo',
            filename: 'mock-contract.pdf',
            status: 'UPLOADED',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findFirst: async (query: any) => {
          console.log('🔍 Mock: Finding first contract:', String(query?.where?.id ?? 'any'));
          return null;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        findMany: async (query: any) => {
          console.log('🔍 Mock: Finding contracts:', String(query?.where?.tenantId ?? 'any'));
          return [];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        update: async (query: any) => {
          console.log('📝 Mock: Updating contract:', String(query?.where?.id ?? 'unknown'));
          return { id: 'mock-updated' };
        },
      },
      $disconnect: async () => {
        console.log('🔌 Mock: Disconnecting database');
      },
      $connect: async () => {
        console.log('🔌 Mock: Connecting to database');
      },
    };
    console.log('✅ Mock database client initialized');
    return dbClient;
  }
}

// Get database client
export async function getDb() {
  if (!dbClient) {
    await initializeDatabase();
  }
  return dbClient;
}

// Export for convenience
export { getDb as getSharedDatabaseClient };