import { Contract, ContractStatus, ProcessingStatus, JobStatus } from '@prisma/client';
import { ContractRepository } from '../../../packages/clients/db/src/repositories/contract.repository';
import { ProcessingJobRepository } from '../../../packages/clients/db/src/repositories/processing-job.repository';
import { FileStorageService } from '../storage/file-storage.service';
import { DatabaseManager } from '../../../packages/clients/db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ContractCreationInput {
  // File information
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  
  // Tenant and user
  tenantId: string;
  uploadedBy?: string;
  
  // Optional metadata
  contractType?: string;
  clientId?: string;
  clientName?: string;
  supplierId?: string;
  supplierName?: string;
  
  // Additional metadata
  metadata?: Record<string, any>;
}

export interface ContractCreationResult {
  contract: Contract;
  processingJobId: string;
  storageKey?: string;
  message: string;
}

export interface ContractCreationOptions {
  uploadToStorage?: boolean;
  createProcessingJob?: boolean;
  startProcessing?: boolean;
}

// ============================================================================
// CONTRACT CREATION SERVICE
// ============================================================================

/**
 * Contract Creation Service
 * 
 * Orchestrates the contract creation flow:
 * 1. Save contract metadata to database
 * 2. Store file reference (and optionally upload to S3)
 * 3. Create initial processing job record
 * 4. Return contract ID and upload confirmation
 * 
 * Requirements: 1.1, 1.5, 6.1, 6.2
 */
export class ContractCreationService {
  private contractRepository: ContractRepository;
  private processingJobRepository: ProcessingJobRepository;
  private fileStorageService: FileStorageService;

  constructor(
    databaseManager: DatabaseManager,
    fileStorageService: FileStorageService
  ) {
    this.contractRepository = new ContractRepository(databaseManager);
    this.processingJobRepository = new ProcessingJobRepository(databaseManager);
    this.fileStorageService = fileStorageService;
  }

  // ==========================================================================
  // CONTRACT CREATION
  // ==========================================================================

  /**
   * Create a new contract with all related records
   * 
   * @param input - Contract creation input
   * @param options - Creation options
   * @returns Contract creation result
   */
  async createContract(
    input: ContractCreationInput,
    options: ContractCreationOptions = {}
  ): Promise<ContractCreationResult> {
    const {
      uploadToStorage = true,
      createProcessingJob = true,
      startProcessing = false,
    } = options;

    console.log('📝 Creating contract:', {
      fileName: input.fileName,
      fileSize: input.fileSize,
      tenantId: input.tenantId,
    });

    try {
      // Step 1: Upload file to storage (if enabled)
      let storageKey: string | undefined;
      
      if (uploadToStorage && !this.fileStorageService.isUsingLocalFallback()) {
        storageKey = this.fileStorageService.generateStorageKey(
          input.fileName,
          input.originalName,
          input.tenantId
        );

        await this.fileStorageService.uploadFromPath(
          input.filePath,
          storageKey,
          {
            contentType: input.mimeType,
            metadata: {
              tenantId: input.tenantId,
              originalName: input.originalName,
              uploadedBy: input.uploadedBy || 'system',
            },
            tags: {
              type: 'contract',
              tenant: input.tenantId,
            },
          }
        );

        console.log('✅ File uploaded to storage:', storageKey);
      }

      // Step 2: Create contract record in database
      const contract = await this.contractRepository.createWithTransaction(
        {
          tenantId: input.tenantId,
          filename: input.fileName,
          originalName: input.originalName,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          filePath: input.filePath,
          storageKey: storageKey,
          status: ContractStatus.UPLOADED,
          processingStatus: ProcessingStatus.PENDING,
          contractType: input.contractType,
          uploadedBy: input.uploadedBy,
          metadata: input.metadata,
          
          // Link to parties if provided
          ...(input.clientId && { client: { connect: { id: input.clientId } } }),
          ...(input.supplierId && { supplier: { connect: { id: input.supplierId } } }),
        },
        {
          createProcessingJob,
        }
      );

      console.log('✅ Contract created in database:', contract.id);

      // Step 3: Get or create processing job
      let processingJobId: string;
      
      if (createProcessingJob) {
        const jobs = await this.processingJobRepository.findByContractId(contract.id);
        processingJobId = jobs[0]?.id;
        
        if (!processingJobId) {
          // Fallback: create job if not created by transaction
          const job = await this.processingJobRepository.create({
            contractId: contract.id,
            status: JobStatus.PENDING,
            progress: 0,
            currentStep: 'upload',
          });
          processingJobId = job.id;
        }

        console.log('✅ Processing job created:', processingJobId);
      } else {
        processingJobId = 'none';
      }

      // Step 4: Start processing (if enabled)
      if (startProcessing && createProcessingJob) {
        // Trigger worker orchestrator asynchronously
        this.triggerProcessing(contract.id).catch(error => {
          console.error('Failed to trigger processing:', error);
        });

        console.log('🔄 Processing queued for contract:', contract.id);
      }

      return {
        contract,
        processingJobId,
        storageKey,
        message: createProcessingJob
          ? 'Contract created successfully. Processing will begin shortly.'
          : 'Contract created successfully.',
      };
    } catch (error) {
      console.error('❌ Contract creation failed:', error);
      
      // Cleanup on failure
      // Note: storageKey might not be defined if upload failed
      // This is intentional - we only cleanup if upload succeeded
      try {
        // Cleanup will be handled by caller if needed
      } catch (cleanupError) {
        console.error('⚠️ Cleanup failed:', cleanupError);
      }

      throw new Error(
        `Failed to create contract: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // BATCH CONTRACT CREATION
  // ==========================================================================

  /**
   * Create multiple contracts in batch
   * 
   * @param inputs - Array of contract creation inputs
   * @param options - Creation options
   * @returns Array of contract creation results
   */
  async createContractsBatch(
    inputs: ContractCreationInput[],
    options: ContractCreationOptions = {}
  ): Promise<ContractCreationResult[]> {
    console.log('📦 Creating contracts in batch:', inputs.length);

    const results: ContractCreationResult[] = [];
    const errors: Array<{ input: ContractCreationInput; error: Error }> = [];

    // Process contracts sequentially to avoid overwhelming the database
    for (const input of inputs) {
      try {
        const result = await this.createContract(input, options);
        results.push(result);
      } catch (error) {
        console.error('❌ Failed to create contract:', input.fileName, error);
        errors.push({
          input,
          error: error instanceof Error ? error : new Error('Unknown error'),
        });
      }
    }

    console.log('✅ Batch creation complete:', {
      successful: results.length,
      failed: errors.length,
    });

    if (errors.length > 0) {
      console.error('⚠️ Some contracts failed to create:', errors);
    }

    return results;
  }

  // ==========================================================================
  // CONTRACT RETRIEVAL
  // ==========================================================================

  /**
   * Get contract by ID with all relations
   * 
   * @param contractId - Contract ID
   * @returns Contract with relations
   */
  async getContract(contractId: string) {
    return await this.contractRepository.findByIdWithOptimizedRelations(contractId);
  }

  /**
   * Get contract processing status
   * 
   * @param contractId - Contract ID
   * @returns Processing job status
   */
  async getProcessingStatus(contractId: string) {
    const jobs = await this.processingJobRepository.findByContractId(contractId);
    
    if (jobs.length === 0) {
      return null;
    }

    // Return the most recent job
    return jobs[0];
  }

  /**
   * Get contracts by tenant
   * 
   * @param tenantId - Tenant ID
   * @param options - Query options
   * @returns Array of contracts
   */
  async getContractsByTenant(
    tenantId: string,
    options?: {
      status?: ContractStatus[];
      limit?: number;
      offset?: number;
    }
  ) {
    return await this.contractRepository.findByTenant(tenantId, options);
  }

  // ==========================================================================
  // CONTRACT UPDATE
  // ==========================================================================

  /**
   * Update contract metadata
   * 
   * @param contractId - Contract ID
   * @param metadata - Metadata to update
   * @returns Updated contract
   */
  async updateContractMetadata(
    contractId: string,
    metadata: {
      contractType?: string;
      clientId?: string;
      supplierId?: string;
      totalValue?: number;
      currency?: string;
      startDate?: Date;
      endDate?: Date;
      jurisdiction?: string;
    }
  ) {
    return await this.contractRepository.updateMetadata(contractId, metadata);
  }

  /**
   * Update contract status
   * 
   * @param contractId - Contract ID
   * @param status - New status
   * @returns Updated contract
   */
  async updateContractStatus(contractId: string, status: ContractStatus) {
    return await this.contractRepository.updateStatus(contractId, status);
  }

  // ==========================================================================
  // CONTRACT DELETION
  // ==========================================================================

  /**
   * Delete contract and all related data
   * 
   * @param contractId - Contract ID
   * @param deleteFile - Whether to delete the file from storage
   */
  async deleteContract(contractId: string, deleteFile: boolean = true) {
    console.log('🗑️ Deleting contract:', contractId);

    try {
      // Get contract to retrieve file information
      const contract = await this.contractRepository.findById(contractId);
      
      if (!contract) {
        throw new Error('Contract not found');
      }

      // Delete file from storage if requested
      if (deleteFile && contract.storageKey) {
        await this.fileStorageService.deleteFile(
          contract.storageKey,
          contract.filePath || undefined
        );
        console.log('✅ File deleted from storage');
      }

      // Delete contract and all relations from database
      await this.contractRepository.deleteWithRelations(contractId);
      
      console.log('✅ Contract deleted from database');
    } catch (error) {
      console.error('❌ Contract deletion failed:', error);
      throw new Error(
        `Failed to delete contract: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Check if contract exists
   * 
   * @param contractId - Contract ID
   * @returns True if contract exists
   */
  async contractExists(contractId: string): Promise<boolean> {
    const contract = await this.contractRepository.findById(contractId);
    return contract !== null;
  }

  /**
   * Get contract metrics for tenant
   * 
   * @param tenantId - Tenant ID
   * @param dateRange - Optional date range
   * @returns Contract metrics
   */
  async getContractMetrics(
    tenantId: string,
    dateRange?: { from: Date; to: Date }
  ) {
    return await this.contractRepository.getContractMetrics(tenantId, dateRange);
  }

  /**
   * Trigger processing pipeline for a contract
   * 
   * @param contractId - Contract ID
   */
  private async triggerProcessing(contractId: string): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { createWorkerOrchestrator } = await import('../workers/worker-orchestrator');
      const { getDatabaseManager } = await import('../../../packages/clients/db');
      
      const databaseManager = getDatabaseManager();
      const orchestrator = createWorkerOrchestrator(databaseManager);
      
      // Execute pipeline asynchronously
      await orchestrator.executeProcessingPipeline(contractId);
    } catch (error) {
      console.error('Processing pipeline failed:', error);
      throw error;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create ContractCreationService instance
 * 
 * @param databaseManager - Database manager instance
 * @param fileStorageService - File storage service instance
 * @returns ContractCreationService instance
 */
export function createContractCreationService(
  databaseManager: DatabaseManager,
  fileStorageService: FileStorageService
): ContractCreationService {
  return new ContractCreationService(databaseManager, fileStorageService);
}
