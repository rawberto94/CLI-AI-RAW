import { DatabaseManager } from '../../index';
import { TenantRepository } from './tenant.repository';
import { ContractRepository } from './contract.repository';
import { UserRepository } from './user.repository';
import { ArtifactRepository } from './artifact.repository';
import { ImportJobRepository } from './import-job.repository';
import { RateCardRepository } from './rate-card.repository';
import { RoleRateRepository } from './role-rate.repository';
import { MappingTemplateRepository } from './mapping-template.repository';
import { ContractArtifactRepository } from './contract-artifact.repository';
import { ClauseRepository } from './clause.repository';
import { ProcessingJobRepository } from './processing-job.repository';
import { PartyRepository } from './party.repository';

export class RepositoryManager {
  public readonly tenants: TenantRepository;
  public readonly contracts: ContractRepository;
  public readonly users: UserRepository;
  public readonly artifacts: ArtifactRepository;
  public readonly importJobs: ImportJobRepository;
  public readonly rateCards: RateCardRepository;
  public readonly roleRates: RoleRateRepository;
  public readonly mappingTemplates: MappingTemplateRepository;
  
  // Contract Repository Optimization repositories
  public readonly contractArtifacts: ContractArtifactRepository;
  public readonly clauses: ClauseRepository;
  public readonly processingJobs: ProcessingJobRepository;
  public readonly parties: PartyRepository;

  constructor(private databaseManager: DatabaseManager) {
    this.tenants = new TenantRepository(databaseManager);
    this.contracts = new ContractRepository(databaseManager);
    this.users = new UserRepository(databaseManager);
    this.artifacts = new ArtifactRepository(databaseManager);
    this.importJobs = new ImportJobRepository(databaseManager);
    this.rateCards = new RateCardRepository(databaseManager);
    this.roleRates = new RoleRateRepository(databaseManager);
    this.mappingTemplates = new MappingTemplateRepository(databaseManager);
    
    // Contract Repository Optimization repositories
    this.contractArtifacts = new ContractArtifactRepository(databaseManager);
    this.clauses = new ClauseRepository(databaseManager);
    this.processingJobs = new ProcessingJobRepository(databaseManager);
    this.parties = new PartyRepository(databaseManager);
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
      importJobs: false,
      rateCards: false,
      roleRates: false,
      mappingTemplates: false,
      contractArtifacts: false,
      clauses: false,
      processingJobs: false,
      parties: false,
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

    try {
      await this.importJobs.count();
      checks.importJobs = true;
    } catch (error) {
      console.error('ImportJobs repository health check failed:', error);
    }

    try {
      await this.rateCards.count();
      checks.rateCards = true;
    } catch (error) {
      console.error('RateCards repository health check failed:', error);
    }

    try {
      await this.roleRates.count();
      checks.roleRates = true;
    } catch (error) {
      console.error('RoleRates repository health check failed:', error);
    }

    try {
      await this.mappingTemplates.count();
      checks.mappingTemplates = true;
    } catch (error) {
      console.error('MappingTemplates repository health check failed:', error);
    }

    try {
      await this.contractArtifacts.count();
      checks.contractArtifacts = true;
    } catch (error) {
      console.error('ContractArtifacts repository health check failed:', error);
    }

    try {
      await this.clauses.count();
      checks.clauses = true;
    } catch (error) {
      console.error('Clauses repository health check failed:', error);
    }

    try {
      await this.processingJobs.count();
      checks.processingJobs = true;
    } catch (error) {
      console.error('ProcessingJobs repository health check failed:', error);
    }

    try {
      await this.parties.count();
      checks.parties = true;
    } catch (error) {
      console.error('Parties repository health check failed:', error);
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
    totalImportJobs: number;
    totalRateCards: number;
    totalRoleRates: number;
    totalMappingTemplates: number;
  }> {
    const [
      totalTenants,
      totalContracts,
      totalUsers,
      totalArtifacts,
      activeTenantsCount,
      processingContractsCount,
      totalImportJobs,
      totalRateCards,
      totalRoleRates,
      totalMappingTemplates,
    ] = await Promise.all([
      this.tenants.count(),
      this.contracts.count(),
      this.users.count(),
      this.artifacts.count(),
      this.tenants.count({ status: 'ACTIVE' }),
      this.contracts.count({ 
        status: { in: ['UPLOADED', 'PROCESSING'] } 
      }),
      this.importJobs.count(),
      this.rateCards.count(),
      this.roleRates.count(),
      this.mappingTemplates.count(),
    ]);

    return {
      totalTenants,
      totalContracts,
      totalUsers,
      totalArtifacts,
      activeTenantsCount,
      processingContractsCount,
      totalImportJobs,
      totalRateCards,
      totalRoleRates,
      totalMappingTemplates,
    };
  }
}

// Export all repository types and classes
export * from './base.repository';
export * from './tenant.repository';
export * from './contract.repository';
export * from './user.repository';
export * from './artifact.repository';
export * from './import-job.repository';
export * from './rate-card.repository';
export * from './role-rate.repository';
export * from './mapping-template.repository';
export * from './contract-artifact.repository';
export * from './clause.repository';
export * from './processing-job.repository';
export * from './party.repository';

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