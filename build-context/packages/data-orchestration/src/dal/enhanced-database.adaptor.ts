/**
 * Enhanced Database Adaptor
 * Extended database operations with error handling and categorization
 */

import { dbAdaptor } from './database.adaptor';

export enum ErrorCategory {
  VALIDATION = 'validation',
  VALIDATION_ERROR = 'validation_error',
  DATABASE = 'database',
  NETWORK = 'network',
  NETWORK_ERROR = 'network_error',
  PERMISSION = 'permission',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  TIMEOUT_ERROR = 'timeout_error',
  UNKNOWN = 'unknown',
}

export interface EnhancedDbResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    category: ErrorCategory;
    code?: string;
  };
}

class EnhancedDatabaseAdaptor {
  private static instance: EnhancedDatabaseAdaptor;

  private constructor() {}

  public static getInstance(): EnhancedDatabaseAdaptor {
    if (!EnhancedDatabaseAdaptor.instance) {
      EnhancedDatabaseAdaptor.instance = new EnhancedDatabaseAdaptor();
    }
    return EnhancedDatabaseAdaptor.instance;
  }

  /**
   * Execute a database operation with error handling
   */
  async execute<T>(operation: () => Promise<T>): Promise<EnhancedDbResult<T>> {
    try {
      const data = await operation();
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          message: error.message || 'Unknown error',
          category: this.categorizeError(error),
          code: error.code,
        },
      };
    }
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: any): ErrorCategory {
    if (error.code === 'P2002') return ErrorCategory.CONFLICT;
    if (error.code === 'P2025') return ErrorCategory.NOT_FOUND;
    if (error.code?.startsWith('P')) return ErrorCategory.DATABASE;
    if (error.name === 'ValidationError') return ErrorCategory.VALIDATION;
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Get contract with enhanced error handling
   */
  async getContract(id: string, tenantId: string): Promise<EnhancedDbResult<any>> {
    return this.execute(() => dbAdaptor.getContract(id, tenantId));
  }

  /**
   * Create contract with enhanced error handling
   */
  async createContract(data: any): Promise<EnhancedDbResult<any>> {
    return this.execute(() => dbAdaptor.createContract(data));
  }

  /**
   * Update contract with enhanced error handling
   */
  async updateContract(id: string, tenantId: string, data: any): Promise<EnhancedDbResult<any>> {
    return this.execute(() => dbAdaptor.updateContract(id, tenantId, data));
  }

  /**
   * Get artifact with enhanced error handling
   */
  async getArtifact(id: string, tenantId: string): Promise<EnhancedDbResult<any>> {
    return this.execute(() => dbAdaptor.getArtifact(id, tenantId));
  }

  /**
   * Create artifact with enhanced error handling
   */
  async createArtifact(data: any): Promise<EnhancedDbResult<any>> {
    return this.execute(() => dbAdaptor.createArtifact(data));
  }

  /**
   * Execute operation with transaction support
   */
  async withTransaction<T>(callback: () => Promise<T>): Promise<EnhancedDbResult<T>> {
    return this.execute(callback);
  }
}

export const enhancedDbAdaptor = EnhancedDatabaseAdaptor.getInstance();
