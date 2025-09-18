import { DatabaseManager } from '../../index';
import { TenantRepository } from './tenant.repository';
import { ContractRepository } from './contract.repository';
import { UserRepository } from './user.repository';
import { ArtifactRepository } from './artifact.repository';

export class RepositoryManager {
  public readonly tenants: TenantRepository;
  public readonly contracts: ContractRepository;
  public readonly users: UserRepository;
  public readonly artifacts: ArtifactRepository;

  constructor(private databaseManager: DatabaseManager) {
    this.tenants = new TenantRepository(databaseManager);
    this.contracts = new ContractRepository(databaseManager);
    this.users = new UserRepository(databaseManager);
    this.artifacts = new ArtifactRepository(databaseManager);
  }

  // Transaction support
  async withTransaction<T>(
    callback: (repositories: RepositoryManager) => Promise<T>
  ): Promise<T> {
    return await this.databaseManager.getClient().$transaction(async (tx) => {
      // Create a new repository manager with the transaction client
      const transactionManager = new DatabaseManager();
      (transactionManager as any).prisma = tx;
      
      const transactionRepositories = new RepositoryManager(transactionManager);
      return await callback(transactionRepositories);
    });
  }

  // Bulk operations
  async bulkCreate<T>(
    repository: keyof RepositoryManager,
    data: any[]
  ): Promise<T[]> {
    const repo = this[repository] as any;
    const results: T[] = [];
    
    for (const item of data) {
      const result = await repo.create(item);
      results.push(result);
    }
    
    return results;
  }

  // Health check for all repositories
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    repositories: Record<string, boolean>;
  }> {
    const checks = {
      tenants: false,
      contracts: false,
      users: false,
      artifacts: false,
    };

    try {
      // Test each repository with a simple count operation
      await this.tenants.count();
      checks.tenants = true;
    } catch (error) {
      console.error('Tenants repository health check failed:', error);
    }

    try {
      await this.contracts.count();
      checks.contracts = true;
    } catch (error) {
      console.error('Contracts repository health check failed:', error);
    }

    try {
      await this.users.count();
      checks.users = true;
    } catch (error) {
      console.error('Users repository health check failed:', error);
    }

    try {
      await this.artifacts.count();
      checks.artifacts = true;
    } catch (error) {
      console.error('Artifacts repository health check failed:', error);
    }

    const allHealthy = Object.values(checks).every(check => check);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      repositories: checks,
    };
  }

  // Get database statistics
  async getStats(): Promise<{
    totalTenants: number;
    totalContracts: number;
    totalUsers: number;
    totalArtifacts: number;
    activeTenantsCount: number;
    processingContractsCount: number;
  }> {
    const [
      totalTenants,
      totalContracts,
      totalUsers,
      totalArtifacts,
      activeTenantsCount,
      processingContractsCount,
    ] = await Promise.all([
      this.tenants.count(),
      this.contracts.count(),
      this.users.count(),
      this.artifacts.count(),
      this.tenants.count({ status: 'ACTIVE' }),
      this.contracts.count({ 
        status: { in: ['UPLOADED', 'PROCESSING'] } 
      }),
    ]);

    return {
      totalTenants,
      totalContracts,
      totalUsers,
      totalArtifacts,
      activeTenantsCount,
      processingContractsCount,
    };
  }
}

// Export all repository types and classes
export * from './base.repository';
export * from './tenant.repository';
export * from './contract.repository';
export * from './user.repository';
export * from './artifact.repository';

// Create a singleton repository manager
let repositoryManagerInstance: RepositoryManager | null = null;

export function getRepositoryManager(databaseManager?: DatabaseManager): RepositoryManager {
  if (!repositoryManagerInstance) {
    if (!databaseManager) {
      throw new Error('DatabaseManager is required for first initialization');
    }
    repositoryManagerInstance = new RepositoryManager(databaseManager);
  }
  return repositoryManagerInstance;
}