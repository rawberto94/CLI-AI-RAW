/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/prefer-optional-chain, @typescript-eslint/strict-boolean-expressions */
import Redis from 'ioredis';

export interface ContractData {
  docId: string;
  pdfText: string;
  fileName?: string;
  uploadedAt: Date;
  metadata?: Record<string, any>;
}

export interface ArtifactData {
  id: string;
  docId: string;
  type: string;
  data: any;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export class SharedContractStore {
  private redis: any;
  private readonly CONTRACT_PREFIX = 'contract:';
  private readonly ARTIFACT_PREFIX = 'artifact:';
  private readonly CONTRACT_LIST_KEY = 'contracts:list';

  constructor(redisConnection: { url: string } | string) {
    try {
      if (typeof redisConnection === 'string') {
        this.redis = new Redis(redisConnection);
      } else {
        this.redis = new Redis(redisConnection.url);
      }
    } catch (error) {
      console.error('Failed to initialize Redis connection:', error);
      throw error;
    }
  }

  /**
   * Store a contract in Redis
   */
  async storeContract(contract: ContractData): Promise<void> {
    const key = `${this.CONTRACT_PREFIX}${contract.docId}`;
    
    // Store contract data
    await this.redis.hset(key, {
      docId: contract.docId,
      pdfText: contract.pdfText,
      fileName: contract.fileName ?? '',
      uploadedAt: contract.uploadedAt.toISOString(),
      metadata: JSON.stringify(contract.metadata ?? {})
    });
    
    // Add to contract list for indexing
    await this.redis.sadd(this.CONTRACT_LIST_KEY, contract.docId);
    
    // Set expiration (optional - 24 hours)
    await this.redis.expire(key, 24 * 60 * 60);
  }

  /**
   * Retrieve a contract from Redis
   */
  async getContract(docId: string): Promise<ContractData | null> {
    const key = `${this.CONTRACT_PREFIX}${docId}`;
    const data = await this.redis.hgetall(key);
    
    if (!data?.docId) {
      return null;
    }

    return {
      docId: data.docId,
      pdfText: data.pdfText,
      fileName: data.fileName || undefined,
      uploadedAt: new Date(data.uploadedAt),
      metadata: data.metadata ? JSON.parse(data.metadata) : undefined
    };
  }

  /**
   * Store an artifact in Redis
   */
  async storeArtifact(artifact: ArtifactData): Promise<void> {
    const key = `${this.ARTIFACT_PREFIX}${artifact.id}`;
    
    await this.redis.hset(key, {
      id: artifact.id,
      docId: artifact.docId,
      type: artifact.type,
      data: JSON.stringify(artifact.data),
      createdAt: artifact.createdAt.toISOString(),
      metadata: JSON.stringify(artifact.metadata || {})
    });

    // Add to contract's artifact list
    await this.redis.sadd(`${this.CONTRACT_PREFIX}${artifact.docId}:artifacts`, artifact.id);
    
    // Set expiration (optional - 24 hours)
    await this.redis.expire(key, 24 * 60 * 60);
  }

  /**
   * Get artifacts for a contract
   */
  async getArtifacts(docId: string): Promise<ArtifactData[]> {
    const artifactIds = await this.redis.smembers(`${this.CONTRACT_PREFIX}${docId}:artifacts`);
    const artifacts: ArtifactData[] = [];

    for (const artifactId of artifactIds) {
      const key = `${this.ARTIFACT_PREFIX}${artifactId}`;
      const data = await this.redis.hgetall(key);
      
      if (data && data.id) {
        artifacts.push({
          id: data.id,
          docId: data.docId,
          type: data.type,
          data: JSON.parse(data.data),
          createdAt: new Date(data.createdAt),
          metadata: data.metadata ? JSON.parse(data.metadata) : undefined
        });
      }
    }

    return artifacts;
  }

  /**
   * List all contract IDs
   */
  async listContracts(): Promise<string[]> {
    return (await this.redis.smembers(this.CONTRACT_LIST_KEY)) as string[];
  }

  /**
   * Get contract's PDF text directly for workers
   */
  async getContractText(docId: string): Promise<string | null> {
    const contract = await this.getContract(docId);
    return contract?.pdfText ?? null;
  }

  /**
   * Check if a contract exists
   */
  async contractExists(docId: string): Promise<boolean> {
    const key = `${this.CONTRACT_PREFIX}${docId}`;
    return (await this.redis.exists(key)) === 1;
  }

  /**
   * Clean up expired data
   */
  async cleanup(): Promise<void> {
    // This method can be enhanced with more sophisticated cleanup logic
    await Promise.resolve();
    console.log('[SharedContractStore] Cleanup completed');
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}

// Export a singleton instance factory
let sharedStoreInstance: SharedContractStore | null = null;

export function getSharedContractStore(redisConnection?: any): SharedContractStore {
  if (!sharedStoreInstance && redisConnection) {
    sharedStoreInstance = new SharedContractStore(redisConnection);
  }
  
  if (!sharedStoreInstance) {
    throw new Error('SharedContractStore not initialized. Call with redisConnection first.');
  }
  
  return sharedStoreInstance;
}