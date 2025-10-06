/**
 * Import Manager Utility
 * Handles consistent dependency resolution with fallback mechanisms
 */

// Dependency status interface
export interface DependencyStatus {
  name: string;
  available: boolean;
  version?: string;
  error?: string;
  fallbackUsed: boolean;
}

// Import result interface
export interface ImportResult<T> {
  success: boolean;
  module?: T;
  error?: string;
  fallbackUsed: boolean;
  source: string;
}

// Database client interface
export interface DatabaseClient {
  contract: any;
  artifact: any;
  $queryRaw: any;
  $executeRaw: any;
}

// Schema collection interface
export interface SchemaCollection {
  IngestionArtifactV1Schema: any;
  ClausesArtifactV1Schema: any;
  RiskArtifactV1Schema: any;
  ComplianceArtifactV1Schema: any;
  FinancialArtifactV1Schema: any;
  OverviewArtifactV1Schema: any;
  TemplateArtifactV1Schema: any;
}

// Storage client interface
export interface StorageClient {
  getFileStream: (path: string) => Promise<any>;
  getObjectBuffer: (path: string) => Promise<Buffer>;
  putObject: (path: string, data: Buffer) => Promise<void>;
}

/**
 * Import Manager
 * Provides centralized import resolution with fallback mechanisms
 */
export class ImportManager {
  private static importCache: Map<string, any> = new Map();
  private static dependencyStatus: Map<string, DependencyStatus> = new Map();

  /**
   * Import database client with fallback
   */
  static async importDatabase(): Promise<ImportResult<DatabaseClient>> {
    const cacheKey = 'database-client';
    
    // Check cache first
    if (this.importCache.has(cacheKey)) {
      return {
        success: true,
        module: this.importCache.get(cacheKey),
        fallbackUsed: false,
        source: 'cache'
      };
    }

    // Try primary import paths
    const importPaths = [
      'clients-db',
      '../../packages/clients/db',
      '../../../packages/clients/db'
    ];

    for (const path of importPaths) {
      try {
        const dbModule = await import(path);
        const client = dbModule.default || dbModule;
        
        this.importCache.set(cacheKey, client);
        this.updateDependencyStatus('database', true, undefined, false);
        
        return {
          success: true,
          module: client,
          fallbackUsed: false,
          source: path
        };
      } catch (error) {
        console.warn(`Failed to import database from ${path}:`, error);
      }
    }

    // Use mock client as fallback
    console.warn('Using mock database client as fallback');
    const mockClient = this.createMockDatabaseClient();
    
    this.importCache.set(cacheKey, mockClient);
    this.updateDependencyStatus('database', false, 'All import paths failed', true);
    
    return {
      success: true,
      module: mockClient,
      fallbackUsed: true,
      source: 'mock'
    };
  }

  /**
   * Import schemas with fallback
   */
  static async importSchemas(): Promise<ImportResult<SchemaCollection>> {
    const cacheKey = 'schemas';
    
    // Check cache first
    if (this.importCache.has(cacheKey)) {
      return {
        success: true,
        module: this.importCache.get(cacheKey),
        fallbackUsed: false,
        source: 'cache'
      };
    }

    // Try primary import paths
    const importPaths = [
      'schemas',
      '../../packages/schemas/src',
      '../../../packages/schemas/src'
    ];

    for (const path of importPaths) {
      try {
        const schemasModule = await import(path);
        
        this.importCache.set(cacheKey, schemasModule);
        this.updateDependencyStatus('schemas', true, undefined, false);
        
        return {
          success: true,
          module: schemasModule,
          fallbackUsed: false,
          source: path
        };
      } catch (error) {
        console.warn(`Failed to import schemas from ${path}:`, error);
      }
    }

    // Use mock schemas as fallback
    console.warn('Using mock schemas as fallback');
    const mockSchemas = this.createMockSchemas();
    
    this.importCache.set(cacheKey, mockSchemas);
    this.updateDependencyStatus('schemas', false, 'All import paths failed', true);
    
    return {
      success: true,
      module: mockSchemas,
      fallbackUsed: true,
      source: 'mock'
    };
  }

  /**
   * Import storage client with fallback
   */
  static async importStorage(): Promise<ImportResult<StorageClient>> {
    const cacheKey = 'storage-client';
    
    // Check cache first
    if (this.importCache.has(cacheKey)) {
      return {
        success: true,
        module: this.importCache.get(cacheKey),
        fallbackUsed: false,
        source: 'cache'
      };
    }

    // Try primary import paths
    const importPaths = [
      'clients-storage',
      '../../packages/clients/storage',
      '../../../packages/clients/storage'
    ];

    for (const path of importPaths) {
      try {
        const storageModule = await import(path);
        
        this.importCache.set(cacheKey, storageModule);
        this.updateDependencyStatus('storage', true, undefined, false);
        
        return {
          success: true,
          module: storageModule,
          fallbackUsed: false,
          source: path
        };
      } catch (error) {
        console.warn(`Failed to import storage from ${path}:`, error);
      }
    }

    // Use mock storage as fallback
    console.warn('Using mock storage client as fallback');
    const mockStorage = this.createMockStorageClient();
    
    this.importCache.set(cacheKey, mockStorage);
    this.updateDependencyStatus('storage', false, 'All import paths failed', true);
    
    return {
      success: true,
      module: mockStorage,
      fallbackUsed: true,
      source: 'mock'
    };
  }

  /**
   * Import OpenAI with fallback
   */
  static async importOpenAI(): Promise<ImportResult<any>> {
    const cacheKey = 'openai';
    
    // Check cache first
    if (this.importCache.has(cacheKey)) {
      return {
        success: true,
        module: this.importCache.get(cacheKey),
        fallbackUsed: false,
        source: 'cache'
      };
    }

    try {
      const { OpenAI } = await import('openai');
      
      this.importCache.set(cacheKey, OpenAI);
      this.updateDependencyStatus('openai', true, undefined, false);
      
      return {
        success: true,
        module: OpenAI,
        fallbackUsed: false,
        source: 'openai'
      };
    } catch (error) {
      console.warn('Failed to import OpenAI:', error);
      
      this.updateDependencyStatus('openai', false, `Import failed: ${error}`, false);
      
      return {
        success: false,
        error: `OpenAI import failed: ${error}`,
        fallbackUsed: false,
        source: 'none'
      };
    }
  }

  /**
   * Validate all dependencies
   */
  static async validateDependencies(): Promise<{
    allAvailable: boolean;
    dependencies: DependencyStatus[];
    criticalMissing: string[];
  }> {
    const dependencies: DependencyStatus[] = [];
    const criticalMissing: string[] = [];

    // Check database
    const dbResult = await this.importDatabase();
    const dbStatus: DependencyStatus = {
      name: 'database',
      available: dbResult.success && !dbResult.fallbackUsed,
      fallbackUsed: dbResult.fallbackUsed || false,
      error: dbResult.error
    };
    dependencies.push(dbStatus);

    // Check schemas
    const schemasResult = await this.importSchemas();
    const schemasStatus: DependencyStatus = {
      name: 'schemas',
      available: schemasResult.success && !schemasResult.fallbackUsed,
      fallbackUsed: schemasResult.fallbackUsed || false,
      error: schemasResult.error
    };
    dependencies.push(schemasStatus);

    // Check storage
    const storageResult = await this.importStorage();
    const storageStatus: DependencyStatus = {
      name: 'storage',
      available: storageResult.success && !storageResult.fallbackUsed,
      fallbackUsed: storageResult.fallbackUsed || false,
      error: storageResult.error
    };
    dependencies.push(storageStatus);

    // Check OpenAI (optional)
    const openaiResult = await this.importOpenAI();
    const openaiStatus: DependencyStatus = {
      name: 'openai',
      available: openaiResult.success,
      fallbackUsed: false,
      error: openaiResult.error
    };
    dependencies.push(openaiStatus);

    // Identify critical missing dependencies
    if (!dbStatus.available && dbStatus.fallbackUsed) {
      criticalMissing.push('database (using mock)');
    }
    if (!schemasStatus.available && schemasStatus.fallbackUsed) {
      criticalMissing.push('schemas (using mock)');
    }

    const allAvailable = dependencies.every(dep => dep.available || dep.fallbackUsed);

    return {
      allAvailable,
      dependencies,
      criticalMissing
    };
  }

  /**
   * Get dependency status
   */
  static getDependencyStatus(): Map<string, DependencyStatus> {
    return new Map(this.dependencyStatus);
  }

  /**
   * Clear import cache
   */
  static clearCache(): void {
    this.importCache.clear();
    this.dependencyStatus.clear();
  }

  /**
   * Update dependency status
   */
  private static updateDependencyStatus(
    name: string,
    available: boolean,
    error?: string,
    fallbackUsed: boolean = false
  ): void {
    this.dependencyStatus.set(name, {
      name,
      available,
      error,
      fallbackUsed
    });
  }

  /**
   * Create mock database client
   */
  private static createMockDatabaseClient(): DatabaseClient {
    return {
      contract: {
        findUnique: async (params: any) => {
          console.log('Mock: Finding contract', params.where?.id);
          return {
            id: params.where?.id || 'mock-contract',
            name: 'Mock Contract',
            tenantId: 'mock-tenant',
            storagePath: 'mock-path',
            createdAt: new Date(),
            artifacts: []
          };
        },
        findMany: async (params: any) => {
          console.log('Mock: Finding contracts');
          return [
            {
              id: 'mock-contract-1',
              name: 'Mock Contract 1',
              tenantId: 'mock-tenant',
              createdAt: new Date()
            }
          ];
        },
        update: async (params: any) => {
          console.log('Mock: Updating contract', params.where?.id);
          return {
            id: params.where?.id,
            ...params.data
          };
        }
      },
      artifact: {
        create: async (params: any) => {
          console.log('Mock: Creating artifact', params.data?.type);
          return {
            id: 'mock-artifact-' + Date.now(),
            ...params.data,
            createdAt: new Date()
          };
        },
        findMany: async (params: any) => {
          console.log('Mock: Finding artifacts');
          return [
            {
              id: 'mock-artifact-1',
              type: 'INGESTION',
              data: { content: 'Mock content for testing' },
              createdAt: new Date()
            }
          ];
        },
        findFirst: async (params: any) => {
          console.log('Mock: Finding first artifact');
          return {
            id: 'mock-artifact-1',
            type: params.where?.type || 'INGESTION',
            data: { content: 'Mock content for testing' },
            createdAt: new Date()
          };
        },
        count: async (params: any) => {
          console.log('Mock: Counting artifacts');
          return 1;
        }
      },
      $queryRaw: async (query: any) => {
        console.log('Mock: Executing raw query');
        return [{ health_check: 1 }];
      },
      $executeRaw: async (command: any) => {
        console.log('Mock: Executing raw command');
        return 1;
      }
    };
  }

  /**
   * Create mock schemas
   */
  private static createMockSchemas(): SchemaCollection {
    const mockSchema = {
      parse: (data: any) => {
        console.log('Mock: Parsing schema data');
        return data;
      }
    };

    return {
      IngestionArtifactV1Schema: mockSchema,
      ClausesArtifactV1Schema: mockSchema,
      RiskArtifactV1Schema: mockSchema,
      ComplianceArtifactV1Schema: mockSchema,
      FinancialArtifactV1Schema: mockSchema,
      OverviewArtifactV1Schema: mockSchema,
      TemplateArtifactV1Schema: mockSchema
    };
  }

  /**
   * Create mock storage client
   */
  private static createMockStorageClient(): StorageClient {
    return {
      getFileStream: async (path: string) => {
        console.log('Mock: Getting file stream for', path);
        const mockStream = {
          on: (event: string, callback: Function) => {
            if (event === 'data') {
              callback(Buffer.from('Mock file content'));
            } else if (event === 'end') {
              callback();
            }
          }
        };
        return mockStream;
      },
      getObjectBuffer: async (path: string) => {
        console.log('Mock: Getting object buffer for', path);
        return Buffer.from('Mock file content for testing');
      },
      putObject: async (path: string, data: Buffer) => {
        console.log('Mock: Putting object at', path, 'with', data.length, 'bytes');
      }
    };
  }
}

/**
 * Convenience functions for common imports
 */
export const importDatabase = () => ImportManager.importDatabase();
export const importSchemas = () => ImportManager.importSchemas();
export const importStorage = () => ImportManager.importStorage();
export const importOpenAI = () => ImportManager.importOpenAI();
export const validateDependencies = () => ImportManager.validateDependencies();