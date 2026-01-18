/**
 * Read Replica Support for Prisma
 * 
 * Provides automatic read/write splitting for better database scaling.
 * Reads go to replicas, writes go to primary.
 */

import { PrismaClient } from '@prisma/client';

interface ReplicaConfig {
  primary: string;
  replicas: string[];
  readPreference?: 'primary' | 'replica' | 'nearest';
}

/**
 * Create a Prisma client with read replica support
 */
export function createReplicaPrismaClient(config?: ReplicaConfig): PrismaClient {
  const primaryUrl = config?.primary || process.env.DATABASE_URL;
  const replicaUrls = config?.replicas || parseReplicaUrls();
  
  // If no replicas configured, return standard client
  if (replicaUrls.length === 0) {
    return new PrismaClient({
      datasources: {
        db: { url: primaryUrl },
      },
    });
  }

  // Create primary client for writes
  const primaryClient = new PrismaClient({
    datasources: {
      db: { url: primaryUrl },
    },
  });

  // Create replica clients for reads
  const replicaClients = replicaUrls.map(url => 
    new PrismaClient({
      datasources: {
        db: { url },
      },
    })
  );

  let replicaIndex = 0;

  // Get next replica (round-robin)
  const getReplicaClient = (): PrismaClient => {
    const client = replicaClients[replicaIndex];
    replicaIndex = (replicaIndex + 1) % replicaClients.length;
    return client;
  };

  // Create proxy that routes reads to replicas
  return new Proxy(primaryClient, {
    get(target, prop: string) {
      // Write operations always go to primary
      const writeOperations = ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'];
      
      // Transaction operations go to primary
      if (prop === '$transaction' || prop === '$executeRaw' || prop === '$executeRawUnsafe') {
        return target[prop as keyof PrismaClient];
      }

      // Model access - return proxy that routes operations
      const value = target[prop as keyof PrismaClient];
      
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(modelTarget, modelProp: string) {
            const operation = modelTarget[modelProp as keyof typeof modelTarget];
            
            if (typeof operation === 'function') {
              // Route to appropriate client
              if (writeOperations.includes(modelProp)) {
                return (operation as (...args: unknown[]) => unknown).bind(modelTarget);
              } else {
                // Read operations go to replica
                const replicaClient = getReplicaClient();
                const replicaModel = replicaClient[prop as keyof PrismaClient] as any;
                return replicaModel[modelProp].bind(replicaModel);
              }
            }
            
            return operation;
          },
        });
      }

      return value;
    },
  }) as PrismaClient;
}

/**
 * Parse replica URLs from environment
 */
function parseReplicaUrls(): string[] {
  const replicaEnv = process.env.DATABASE_REPLICA_URLS;
  if (!replicaEnv) return [];
  
  return replicaEnv.split(',').map(url => url.trim()).filter(Boolean);
}

/**
 * Health check for all database connections
 */
export async function checkDatabaseHealth(
  primary: PrismaClient,
  replicas: PrismaClient[]
): Promise<{
  primary: { healthy: boolean; latency: number };
  replicas: { healthy: boolean; latency: number; index: number }[];
}> {
  const checkConnection = async (client: PrismaClient): Promise<{ healthy: boolean; latency: number }> => {
    const start = Date.now();
    try {
      await client.$queryRaw`SELECT 1`;
      return { healthy: true, latency: Date.now() - start };
    } catch {
      return { healthy: false, latency: Date.now() - start };
    }
  };

  const [primaryHealth, ...replicaHealths] = await Promise.all([
    checkConnection(primary),
    ...replicas.map(checkConnection),
  ]);

  return {
    primary: primaryHealth,
    replicas: replicaHealths.map((health, index) => ({ ...health, index })),
  };
}

/**
 * Replica lag monitoring
 */
export async function getReplicaLag(
  primary: PrismaClient,
  replica: PrismaClient
): Promise<number | null> {
  try {
    // PostgreSQL-specific replication lag query
    const result = await replica.$queryRaw<[{ lag_bytes: bigint }]>`
      SELECT pg_wal_lsn_diff(
        pg_current_wal_lsn(),
        replay_lsn
      ) as lag_bytes
      FROM pg_stat_replication
      LIMIT 1
    `;
    
    return Number(result[0]?.lag_bytes || 0);
  } catch {
    // Not a replica or query not supported
    return null;
  }
}

/**
 * Connection pool configuration for high-traffic scenarios
 */
export const poolConfig = {
  // Primary - fewer connections, writes only
  primary: {
    connectionLimit: 10,
    poolTimeout: 10,
  },
  // Replicas - more connections for reads
  replica: {
    connectionLimit: 30,
    poolTimeout: 5,
  },
};

/**
 * Build connection URL with pool settings
 */
export function buildConnectionUrl(
  baseUrl: string,
  pool: typeof poolConfig.primary | typeof poolConfig.replica
): string {
  const url = new URL(baseUrl);
  url.searchParams.set('connection_limit', pool.connectionLimit.toString());
  url.searchParams.set('pool_timeout', pool.poolTimeout.toString());
  return url.toString();
}
