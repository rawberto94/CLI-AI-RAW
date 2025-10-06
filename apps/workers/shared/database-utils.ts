/**
 * Database utilities for workers - Uses shared Redis store for cross-process data access
 */

import { getSharedContractStore, type SharedContractStore, type ArtifactData } from 'utils';

// Artifact data types for different artifact schemas
interface IngestionData {
  content: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface GenericArtifactData {
  [key: string]: unknown;
}

// Local contract type that ensures storagePath is always a string
interface WorkerContract {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  storagePath: string;  // Always defined
  tenantId: string;     // Always defined
}

// Worker database client interface
export interface WorkerDatabaseClient {
  findContract: (docId: string, includeDeleted?: boolean) => Promise<{ success: boolean; data?: WorkerContract; error?: string }>;
  findArtifacts: (docId: string, type?: string, limit?: number) => Promise<{ success: boolean; data?: WorkerArtifact[]; error?: string }>;
  createArtifact: (artifact: CreateArtifactInput) => Promise<{ success: boolean; data?: WorkerArtifact; error?: string }>;
  createArtifactWithValidation?: (artifact: CreateArtifactInput) => Promise<{ success: boolean; data?: WorkerArtifact; error?: string }>;
  updateContractMetadata: (docId: string, metadata: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
}

export interface CreateArtifactInput {
  contractId: string;
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorkerArtifact {
  id: string;
  contractId: string;
  type: string;
  data: IngestionData | GenericArtifactData; // Can be ingestion data or other artifact schemas
  createdAt: Date;
  updatedAt: Date;
}

// Initialize shared store
let sharedStore: SharedContractStore | null = null;

// Create worker database client that uses shared Redis store
function createWorkerDatabaseClient(): WorkerDatabaseClient {
  return {
    async findContract(docId: string, _includeDeleted = false): Promise<{ success: boolean; data?: WorkerContract; error?: string }> {
      try {
        if (!sharedStore) {
          return { success: false, error: 'Shared store not initialized' };
        }

        const contractData = await sharedStore.getContract(docId);
        if (!contractData) {
          return { success: false, error: `Contract ${docId} not found` };
        }
        
        // Convert to WorkerContract format
        const workerContract: WorkerContract = {
          id: contractData.docId,
          name: contractData.fileName || 'unknown',
          status: 'UPLOADED',
          createdAt: contractData.uploadedAt,
          updatedAt: contractData.uploadedAt,
          tenantId: contractData.metadata?.tenantId || 'demo',
          storagePath: contractData.metadata?.storagePath || `memory://${contractData.docId}`
        };
        
        return { 
          success: true, 
          data: workerContract
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to find contract: ${errorMessage}` };
      }
    },

    async findArtifacts(docId: string, type?: string, limit = 10): Promise<{ success: boolean; data?: WorkerArtifact[]; error?: string }> {
      try {
        if (!sharedStore) {
          return { success: false, error: 'Shared store not initialized' };
        }

        const artifacts = await sharedStore.getArtifacts(docId);
        let results: WorkerArtifact[] = [];
        
        // Convert artifacts to expected format
        if (type !== undefined && type.length > 0) {
          results = artifacts
            .filter(artifact => artifact.type.toLowerCase() === type.toLowerCase())
            .map(artifact => ({
              id: artifact.id,
              contractId: artifact.docId,
              type: artifact.type,
              data: artifact.data,
              createdAt: artifact.createdAt,
              updatedAt: artifact.createdAt
            }));
        } else {
          // Return all artifacts
          results = artifacts.map(artifact => ({
            id: artifact.id,
            contractId: artifact.docId,
            type: artifact.type,
            data: artifact.data,
            createdAt: artifact.createdAt,
            updatedAt: artifact.createdAt
          }));
        }

        return { 
          success: true, 
          data: results.slice(0, limit)
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to find artifacts: ${errorMessage}` };
      }
    },

    async createArtifact(artifact: CreateArtifactInput): Promise<{ success: boolean; data?: WorkerArtifact; error?: string }> {
      try {
        if (!sharedStore) {
          return { success: false, error: 'Shared store not initialized' };
        }

        const { contractId, type, data, tenantId, metadata } = artifact;
        
        // Generate unique artifact ID
        const artifactId = `${contractId}-${type}-${Date.now()}`;
        
        // Store artifact in shared store
        const artifactData: ArtifactData = {
          id: artifactId,
          docId: contractId,
          type,
          data,
          createdAt: new Date(),
          metadata: { tenantId, ...metadata }
        };
        
        await sharedStore.storeArtifact(artifactData);
        
        const result: WorkerArtifact = {
          id: artifactId,
          contractId,
          type,
          data,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        console.log(`✅ Created ${type} artifact for contract ${contractId}`);
        return { success: true, data: result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to create artifact: ${errorMessage}` };
      }
    },

    async createArtifactWithValidation(artifact: CreateArtifactInput): Promise<{ success: boolean; data?: WorkerArtifact; error?: string }> {
      // For artifact-manager compatibility
      return this.createArtifact(artifact);
    },

    async updateContractMetadata(docId: string, metadata: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
      try {
        // For now, just log the metadata update since we don't have a real contract metadata field
        console.log(`📝 Mock: Updated metadata for contract ${docId}:`, metadata);
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to update contract metadata: ${errorMessage}` };
      }
    }
  };
}

// Create singleton instance
const workerDbClient = createWorkerDatabaseClient();

// Initialize database with Redis connection
export const initializeDatabase = async (): Promise<WorkerDatabaseClient> => {
  try {
    const redisUrl = process.env['REDIS_URL'];
    if (!redisUrl) {
      throw new Error('REDIS_URL not configured');
    }
    
    sharedStore = getSharedContractStore({ url: redisUrl });
    console.log('✅ Database client initialized for workers with shared Redis store');
    return workerDbClient;
  } catch (error) {
    console.error('❌ Failed to initialize database client:', error);
    throw error;
  }
};

// For backwards compatibility
export const getDatabase = initializeDatabase;

// Legacy exports for compatibility with existing code
export const getSharedDatabaseClient = (): WorkerDatabaseClient => workerDbClient;
export type SharedDatabaseClient = WorkerDatabaseClient;