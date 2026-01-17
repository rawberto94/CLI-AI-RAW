/**
 * Read Replica Manager
 * 
 * Provides read/write splitting, connection routing, and failover handling for:
 * - Horizontal scaling of read operations
 * - Automatic failover to primary on replica failure
 * - Load balancing across replicas
 * - Replication lag awareness
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ReplicaConfig {
  id: string;
  url: string;
  weight?: number;
  maxLag?: number; // Maximum acceptable lag in milliseconds
  region?: string;
}

export interface ReplicaManagerConfig {
  primary: string;
  replicas: ReplicaConfig[];
  loadBalanceStrategy: LoadBalanceStrategy;
  maxReplicationLag: number; // Maximum acceptable lag before failing over
  healthCheckInterval: number; // Milliseconds between health checks
  failoverThreshold: number; // Number of consecutive failures before removing replica
  readFromPrimary: boolean; // Whether to include primary in read pool
}

export type LoadBalanceStrategy = 
  | 'round-robin'
  | 'weighted'
  | 'random'
  | 'least-connections'
  | 'latency-based';

export interface ReplicaStatus {
  id: string;
  healthy: boolean;
  lag: number;
  latency: number;
  activeConnections: number;
  consecutiveFailures: number;
  lastChecked: Date;
  region?: string;
}

export interface RoutingDecision {
  client: PrismaClient;
  replicaId: string;
  isReadReplica: boolean;
}

// ============================================================================
// REPLICA HEALTH TRACKER
// ============================================================================

class ReplicaHealthTracker {
  private statuses: Map<string, ReplicaStatus> = new Map();
  
  updateStatus(id: string, updates: Partial<ReplicaStatus>): void {
    const current = this.statuses.get(id) || this.createDefaultStatus(id);
    this.statuses.set(id, {
      ...current,
      ...updates,
      lastChecked: new Date(),
    });
  }
  
  getStatus(id: string): ReplicaStatus | undefined {
    return this.statuses.get(id);
  }
  
  getAllStatuses(): ReplicaStatus[] {
    return Array.from(this.statuses.values());
  }
  
  getHealthyReplicas(): ReplicaStatus[] {
    return this.getAllStatuses().filter(s => s.healthy);
  }
  
  recordFailure(id: string): void {
    const current = this.getStatus(id);
    if (current) {
      this.updateStatus(id, {
        consecutiveFailures: current.consecutiveFailures + 1,
        healthy: current.consecutiveFailures + 1 < 3, // Mark unhealthy after 3 failures
      });
    }
  }
  
  recordSuccess(id: string, latency: number): void {
    this.updateStatus(id, {
      consecutiveFailures: 0,
      healthy: true,
      latency,
    });
  }
  
  private createDefaultStatus(id: string): ReplicaStatus {
    return {
      id,
      healthy: true,
      lag: 0,
      latency: 0,
      activeConnections: 0,
      consecutiveFailures: 0,
      lastChecked: new Date(),
    };
  }
}

// ============================================================================
// LOAD BALANCER
// ============================================================================

class LoadBalancer {
  private roundRobinIndex = 0;
  
  selectReplica(
    replicas: ReplicaConfig[],
    statuses: Map<string, ReplicaStatus>,
    strategy: LoadBalanceStrategy
  ): ReplicaConfig | null {
    const healthyReplicas = replicas.filter(r => {
      const status = statuses.get(r.id);
      return !status || status.healthy;
    });
    
    if (healthyReplicas.length === 0) {
      return null;
    }
    
    switch (strategy) {
      case 'round-robin':
        return this.roundRobin(healthyReplicas);
      case 'weighted':
        return this.weighted(healthyReplicas);
      case 'random':
        return this.random(healthyReplicas);
      case 'least-connections':
        return this.leastConnections(healthyReplicas, statuses);
      case 'latency-based':
        return this.latencyBased(healthyReplicas, statuses);
      default:
        return this.roundRobin(healthyReplicas);
    }
  }
  
  private roundRobin(replicas: ReplicaConfig[]): ReplicaConfig {
    if (replicas.length === 0) {
      throw new Error('No replicas available');
    }
    const replica = replicas[this.roundRobinIndex % replicas.length]!;
    this.roundRobinIndex++;
    return replica;
  }
  
  private weighted(replicas: ReplicaConfig[]): ReplicaConfig {
    if (replicas.length === 0) {
      throw new Error('No replicas available');
    }
    const totalWeight = replicas.reduce((sum, r) => sum + (r.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const replica of replicas) {
      random -= replica.weight || 1;
      if (random <= 0) {
        return replica;
      }
    }
    
    return replicas[0]!;
  }
  
  private random(replicas: ReplicaConfig[]): ReplicaConfig {
    if (replicas.length === 0) {
      throw new Error('No replicas available');
    }
    return replicas[Math.floor(Math.random() * replicas.length)]!;
  }
  
  private leastConnections(
    replicas: ReplicaConfig[],
    statuses: Map<string, ReplicaStatus>
  ): ReplicaConfig {
    if (replicas.length === 0) {
      throw new Error('No replicas available');
    }
    return replicas.reduce((min, replica) => {
      const minConnections = statuses.get(min.id)?.activeConnections || 0;
      const replicaConnections = statuses.get(replica.id)?.activeConnections || 0;
      return replicaConnections < minConnections ? replica : min;
    }, replicas[0]!);
  }
  
  private latencyBased(
    replicas: ReplicaConfig[],
    statuses: Map<string, ReplicaStatus>
  ): ReplicaConfig {
    if (replicas.length === 0) {
      throw new Error('No replicas available');
    }
    return replicas.reduce((best, replica) => {
      const bestLatency = statuses.get(best.id)?.latency || Infinity;
      const replicaLatency = statuses.get(replica.id)?.latency || Infinity;
      return replicaLatency < bestLatency ? replica : best;
    }, replicas[0]!);
  }
}

// ============================================================================
// REPLICA MANAGER IMPLEMENTATION
// ============================================================================

export class ReplicaManager {
  private config: ReplicaManagerConfig;
  private primaryClient: PrismaClient;
  private replicaClients: Map<string, PrismaClient> = new Map();
  private healthTracker: ReplicaHealthTracker;
  private loadBalancer: LoadBalancer;
  private healthCheckTimer?: NodeJS.Timeout;
  private connectionCounts: Map<string, number> = new Map();

  constructor(config: Partial<ReplicaManagerConfig> & { primary: string }) {
    this.config = {
      primary: config.primary,
      replicas: config.replicas || [],
      loadBalanceStrategy: config.loadBalanceStrategy || 'round-robin',
      maxReplicationLag: config.maxReplicationLag || 5000,
      healthCheckInterval: config.healthCheckInterval || 30000,
      failoverThreshold: config.failoverThreshold || 3,
      readFromPrimary: config.readFromPrimary ?? true,
    };

    this.healthTracker = new ReplicaHealthTracker();
    this.loadBalancer = new LoadBalancer();

    // Initialize primary client
    this.primaryClient = new PrismaClient({
      datasources: { db: { url: this.config.primary } },
    });

    // Initialize replica clients
    for (const replica of this.config.replicas) {
      const client = new PrismaClient({
        datasources: { db: { url: replica.url } },
        log: ['error'],
      });
      this.replicaClients.set(replica.id, client);
      this.connectionCounts.set(replica.id, 0);
      this.healthTracker.updateStatus(replica.id, { region: replica.region });
    }

    // Also track primary in health
    this.healthTracker.updateStatus('primary', { healthy: true });
    this.connectionCounts.set('primary', 0);
  }

  // =========================================================================
  // CONNECTION ROUTING
  // =========================================================================

  /**
   * Get a client for read operations
   */
  getReadClient(): RoutingDecision {
    // Try to get a healthy replica
    const replica = this.selectReadReplica();
    
    if (replica) {
      const client = this.replicaClients.get(replica.id);
      if (client) {
        this.incrementConnections(replica.id);
        return {
          client,
          replicaId: replica.id,
          isReadReplica: true,
        };
      }
    }

    // Fallback to primary
    this.incrementConnections('primary');
    return {
      client: this.primaryClient,
      replicaId: 'primary',
      isReadReplica: false,
    };
  }

  /**
   * Get a client for write operations (always primary)
   */
  getWriteClient(): RoutingDecision {
    this.incrementConnections('primary');
    return {
      client: this.primaryClient,
      replicaId: 'primary',
      isReadReplica: false,
    };
  }

  /**
   * Get the primary client directly
   */
  getPrimary(): PrismaClient {
    return this.primaryClient;
  }

  /**
   * Get a specific replica client
   */
  getReplica(id: string): PrismaClient | undefined {
    return this.replicaClients.get(id);
  }

  /**
   * Release a connection
   */
  releaseConnection(replicaId: string): void {
    const current = this.connectionCounts.get(replicaId) || 0;
    this.connectionCounts.set(replicaId, Math.max(0, current - 1));
    this.healthTracker.updateStatus(replicaId, {
      activeConnections: Math.max(0, current - 1),
    });
  }

  /**
   * Execute a read operation with automatic routing
   */
  async executeRead<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const routing = this.getReadClient();
    const start = Date.now();

    try {
      const result = await operation(routing.client);
      this.healthTracker.recordSuccess(routing.replicaId, Date.now() - start);
      return result;
    } catch (error) {
      this.healthTracker.recordFailure(routing.replicaId);
      
      // If replica failed, retry on primary
      if (routing.isReadReplica) {
        return operation(this.primaryClient);
      }
      
      throw error;
    } finally {
      this.releaseConnection(routing.replicaId);
    }
  }

  /**
   * Execute a write operation (always on primary)
   */
  async executeWrite<T>(operation: (client: PrismaClient) => Promise<T>): Promise<T> {
    const routing = this.getWriteClient();

    try {
      return await operation(routing.client);
    } finally {
      this.releaseConnection(routing.replicaId);
    }
  }

  // =========================================================================
  // HEALTH CHECKS
  // =========================================================================

  /**
   * Start health check interval
   */
  startHealthChecks(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(
      () => this.checkAllReplicas(),
      this.config.healthCheckInterval
    );
  }

  /**
   * Stop health check interval
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Check all replicas for health
   */
  async checkAllReplicas(): Promise<Map<string, ReplicaStatus>> {
    const checks = await Promise.all([
      this.checkPrimary(),
      ...this.config.replicas.map(r => this.checkReplica(r)),
    ]);

    return new Map(checks.map(status => [status.id, status]));
  }

  /**
   * Check replication lag for a replica
   */
  async checkReplicationLag(replicaId: string): Promise<number> {
    const replica = this.replicaClients.get(replicaId);
    if (!replica) {
      return Infinity;
    }

    try {
      // Write a marker to primary
      const marker = Date.now().toString();
      await this.primaryClient.$executeRawUnsafe(
        `CREATE TEMP TABLE IF NOT EXISTS _lag_check (marker TEXT, ts TIMESTAMP DEFAULT NOW());
         DELETE FROM _lag_check;
         INSERT INTO _lag_check (marker) VALUES ('${marker}');`
      );

      // Check if marker is visible on replica
      const start = Date.now();
      let found = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!found && attempts < maxAttempts) {
        try {
          const result = await replica.$queryRawUnsafe<Array<{ marker: string }>>(
            `SELECT marker FROM _lag_check WHERE marker = '${marker}'`
          );
          found = result.length > 0;
        } catch {
          // Table might not exist on replica yet
        }
        
        if (!found) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }

      const lag = found ? Date.now() - start : Infinity;
      this.healthTracker.updateStatus(replicaId, { lag });
      return lag;
    } catch {
      return Infinity;
    }
  }

  // =========================================================================
  // STATUS & METRICS
  // =========================================================================

  /**
   * Get all replica statuses
   */
  getStatuses(): ReplicaStatus[] {
    return this.healthTracker.getAllStatuses();
  }

  /**
   * Get summary of replica manager state
   */
  getSummary(): {
    primaryHealthy: boolean;
    healthyReplicaCount: number;
    totalReplicaCount: number;
    strategy: LoadBalanceStrategy;
    totalConnections: number;
  } {
    const statuses = this.healthTracker.getAllStatuses();
    const primaryStatus = this.healthTracker.getStatus('primary');

    return {
      primaryHealthy: primaryStatus?.healthy ?? true,
      healthyReplicaCount: statuses.filter(s => s.id !== 'primary' && s.healthy).length,
      totalReplicaCount: this.config.replicas.length,
      strategy: this.config.loadBalanceStrategy,
      totalConnections: Array.from(this.connectionCounts.values()).reduce((a, b) => a + b, 0),
    };
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Initialize all connections
   */
  async connect(): Promise<void> {
    await this.primaryClient.$connect();
    
    for (const [id, client] of this.replicaClients) {
      try {
        await client.$connect();
        this.healthTracker.updateStatus(id, { healthy: true });
      } catch {
        this.healthTracker.updateStatus(id, { healthy: false });
      }
    }
  }

  /**
   * Disconnect all clients
   */
  async disconnect(): Promise<void> {
    this.stopHealthChecks();
    
    await this.primaryClient.$disconnect();
    
    for (const client of this.replicaClients.values()) {
      await client.$disconnect();
    }
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private selectReadReplica(): ReplicaConfig | null {
    if (this.config.replicas.length === 0 || !this.config.readFromPrimary === false) {
      // Only use replicas if configured, otherwise use primary
      if (this.config.replicas.length === 0) {
        return null;
      }
    }

    const statuses = new Map(
      this.healthTracker.getAllStatuses().map(s => [s.id, s])
    );

    // Filter replicas with acceptable lag
    const acceptableReplicas = this.config.replicas.filter(r => {
      const status = statuses.get(r.id);
      return !status || (status.healthy && status.lag <= (r.maxLag || this.config.maxReplicationLag));
    });

    return this.loadBalancer.selectReplica(
      acceptableReplicas,
      statuses,
      this.config.loadBalanceStrategy
    );
  }

  private incrementConnections(id: string): void {
    const current = this.connectionCounts.get(id) || 0;
    this.connectionCounts.set(id, current + 1);
    this.healthTracker.updateStatus(id, { activeConnections: current + 1 });
  }

  private async checkPrimary(): Promise<ReplicaStatus> {
    const start = Date.now();
    try {
      await this.primaryClient.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      this.healthTracker.recordSuccess('primary', latency);
      return this.healthTracker.getStatus('primary')!;
    } catch (error) {
      this.healthTracker.recordFailure('primary');
      return this.healthTracker.getStatus('primary')!;
    }
  }

  private async checkReplica(replica: ReplicaConfig): Promise<ReplicaStatus> {
    const client = this.replicaClients.get(replica.id);
    if (!client) {
      return this.healthTracker.getStatus(replica.id)!;
    }

    const start = Date.now();
    try {
      await client.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      this.healthTracker.recordSuccess(replica.id, latency);
      return this.healthTracker.getStatus(replica.id)!;
    } catch (error) {
      this.healthTracker.recordFailure(replica.id);
      return this.healthTracker.getStatus(replica.id)!;
    }
  }
}

// ============================================================================
// SINGLETON & FACTORY
// ============================================================================

let replicaManagerInstance: ReplicaManager | null = null;

export function getReplicaManager(
  config?: Partial<ReplicaManagerConfig> & { primary: string }
): ReplicaManager {
  if (!replicaManagerInstance) {
    if (!config) {
      throw new Error('Config required for first initialization');
    }
    replicaManagerInstance = new ReplicaManager(config);
  }
  return replicaManagerInstance;
}

export function resetReplicaManager(): void {
  if (replicaManagerInstance) {
    replicaManagerInstance.disconnect();
  }
  replicaManagerInstance = null;
}
