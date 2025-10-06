import { JobStatus, ProcessingStatus } from '@prisma/client';
import { ProcessingJobRepository } from '../../../packages/clients/db/src/repositories/processing-job.repository';
import { ContractRepository } from '../../../packages/clients/db/src/repositories/contract.repository';
import { DatabaseManager } from '../../../packages/clients/db';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WorkerResult {
  success: boolean;
  data?: any;
  error?: string;
  duration?: number;
}

export interface PipelineStage {
  name: string;
  worker: string;
  parallel: boolean;
  required: boolean;
  timeout?: number;
}

export interface PipelineConfig {
  stages: PipelineStage[];
  maxRetries: number;
  retryDelay: number;
}

export interface OrchestrationResult {
  contractId: string;
  success: boolean;
  completedStages: string[];
  failedStages: string[];
  results: Record<string, any>;
  totalDuration: number;
  error?: string;
}

// ============================================================================
// WORKER ORCHESTRATOR
// ============================================================================

/**
 * Worker Orchestrator
 * 
 * Manages the execution of contract processing workers in a defined pipeline:
 * 1. Ingestion (text extraction) - Sequential
 * 2. Parallel Analysis:
 *    - Financial analysis
 *    - Search indexing
 *    - Clause extraction
 * 3. Result aggregation
 * 
 * Requirements: 2.8
 */
export class WorkerOrchestrator {
  private contractRepository: ContractRepository;
  private processingJobRepository: ProcessingJobRepository;
  private pipelineConfig: PipelineConfig;

  constructor(databaseManager: DatabaseManager) {
    this.contractRepository = new ContractRepository(databaseManager);
    this.processingJobRepository = new ProcessingJobRepository(databaseManager);
    
    // Define the processing pipeline
    this.pipelineConfig = {
      stages: [
        {
          name: 'ingestion',
          worker: 'ingestion.worker',
          parallel: false,
          required: true,
          timeout: 60000, // 60 seconds
        },
        {
          name: 'financial',
          worker: 'financial.worker',
          parallel: true,
          required: false,
          timeout: 120000, // 2 minutes
        },
        {
          name: 'search',
          worker: 'search.worker',
          parallel: true,
          required: false,
          timeout: 90000, // 90 seconds
        },
        {
          name: 'clauses',
          worker: 'clauses.worker',
          parallel: true,
          required: false,
          timeout: 90000, // 90 seconds
        },
      ],
      maxRetries: 3,
      retryDelay: 1000, // 1 second base delay
    };
  }

  // ==========================================================================
  // PIPELINE EXECUTION
  // ==========================================================================

  /**
   * Execute the complete processing pipeline for a contract
   * 
   * @param contractId - Contract ID to process
   * @returns Orchestration result
   */
  async executeProcessing Pipeline(contractId: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const completedStages: string[] = [];
    const failedStages: string[] = [];
    const results: Record<string, any> = {};

    console.log(`🚀 Starting pipeline execution for contract: ${contractId}`);

    try {
      // Get contract data
      const contract = await this.contractRepository.findById(contractId);
      
      if (!contract) {
        throw new Error(`Contract not found: ${contractId}`);
      }

      // Get or create processing job
      let processingJob = await this.getOrCreateProcessingJob(contractId);

      // Update job status to processing
      await this.processingJobRepository.updateStatus(
        processingJob.id,
        JobStatus.PROCESSING,
        {
          progress: 5,
          currentStep: 'pipeline_started',
        }
      );

      // Execute sequential stages first (ingestion)
      const sequentialStages = this.pipelineConfig.stages.filter(s => !s.parallel);
      
      for (const stage of sequentialStages) {
        console.log(`📝 Executing sequential stage: ${stage.name}`);
        
        try {
          const result = await this.executeStageWithRetry(
            stage,
            contract,
            results
          );

          if (result.success) {
            completedStages.push(stage.name);
            results[stage.name] = result.data;
            
            // Update progress
            const progress = this.calculateProgress(completedStages.length);
            await this.processingJobRepository.updateStatus(
              processingJob.id,
              JobStatus.PROCESSING,
              {
                progress,
                currentStep: stage.name,
              }
            );
          } else {
            if (stage.required) {
              throw new Error(`Required stage ${stage.name} failed: ${result.error}`);
            }
            failedStages.push(stage.name);
            console.warn(`⚠️  Optional stage ${stage.name} failed:`, result.error);
          }
        } catch (error) {
          if (stage.required) {
            throw error;
          }
          failedStages.push(stage.name);
          console.warn(`⚠️  Stage ${stage.name} failed:`, error);
        }
      }

      // Execute parallel stages (financial, search, clauses)
      const parallelStages = this.pipelineConfig.stages.filter(s => s.parallel);
      
      if (parallelStages.length > 0) {
        console.log(`⚡ Executing ${parallelStages.length} parallel stages`);
        
        const parallelResults = await Promise.allSettled(
          parallelStages.map(stage => 
            this.executeStageWithRetry(stage, contract, results)
          )
        );

        parallelResults.forEach((result, index) => {
          const stage = parallelStages[index];
          
          if (result.status === 'fulfilled' && result.value.success) {
            completedStages.push(stage.name);
            results[stage.name] = result.value.data;
          } else {
            failedStages.push(stage.name);
            const error = result.status === 'rejected' 
              ? result.reason 
              : (result.value as WorkerResult).error;
            console.warn(`⚠️  Parallel stage ${stage.name} failed:`, error);
          }
        });

        // Update progress after parallel stages
        const progress = this.calculateProgress(completedStages.length);
        await this.processingJobRepository.updateStatus(
          processingJob.id,
          JobStatus.PROCESSING,
          {
            progress,
            currentStep: 'parallel_analysis',
          }
        );
      }

      // Aggregate results
      console.log(`📊 Aggregating results from ${completedStages.length} stages`);
      await this.aggregateResults(contractId, results);

      // Mark processing as complete
      await this.processingJobRepository.updateStatus(
        processingJob.id,
        JobStatus.COMPLETED,
        {
          progress: 100,
          currentStep: 'completed',
          completedAt: new Date(),
        }
      );

      // Update contract status
      await this.contractRepository.updateProcessingStatus(
        contractId,
        ProcessingStatus.COMPLETED
      );

      const totalDuration = Date.now() - startTime;
      console.log(`✅ Pipeline completed in ${totalDuration}ms`);

      return {
        contractId,
        success: true,
        completedStages,
        failedStages,
        results,
        totalDuration,
      };
    } catch (error) {
      console.error(`❌ Pipeline execution failed:`, error);

      // Mark processing as failed
      const jobs = await this.processingJobRepository.findByContractId(contractId);
      if (jobs.length > 0) {
        await this.processingJobRepository.updateStatus(
          jobs[0].id,
          JobStatus.FAILED,
          {
            currentStep: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        );
      }

      // Update contract status
      await this.contractRepository.updateProcessingStatus(
        contractId,
        ProcessingStatus.FAILED
      );

      const totalDuration = Date.now() - startTime;

      return {
        contractId,
        success: false,
        completedStages,
        failedStages,
        results,
        totalDuration,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // STAGE EXECUTION
  // ==========================================================================

  /**
   * Execute a single pipeline stage with retry logic
   * 
   * @param stage - Pipeline stage configuration
   * @param contract - Contract data
   * @param previousResults - Results from previous stages
   * @returns Worker result
   */
  private async executeStageWithRetry(
    stage: PipelineStage,
    contract: any,
    previousResults: Record<string, any>
  ): Promise<WorkerResult> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < this.pipelineConfig.maxRetries) {
      attempt++;
      
      try {
        console.log(`🔄 Executing ${stage.name} (attempt ${attempt}/${this.pipelineConfig.maxRetries})`);
        
        const result = await this.executeStage(stage, contract, previousResults);
        
        if (result.success) {
          return result;
        }

        // If not successful but no error, treat as failure
        lastError = new Error(result.error || 'Stage execution failed');
        
        // Don't retry if it's not a transient error
        if (!this.isTransientError(result.error)) {
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry if it's not a transient error
        if (!this.isTransientError(lastError.message)) {
          break;
        }
      }

      // Wait before retrying (exponential backoff)
      if (attempt < this.pipelineConfig.maxRetries) {
        const delay = this.pipelineConfig.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Stage execution failed after retries',
    };
  }

  /**
   * Execute a single pipeline stage
   * 
   * @param stage - Pipeline stage configuration
   * @param contract - Contract data
   * @param previousResults - Results from previous stages
   * @returns Worker result
   */
  private async executeStage(
    stage: PipelineStage,
    contract: any,
    previousResults: Record<string, any>
  ): Promise<WorkerResult> {
    const startTime = Date.now();

    try {
      // Dynamic import of worker
      const workerModule = await import(`../../../apps/workers/${stage.worker}`);
      
      // Get worker class name from file name
      const workerClassName = this.getWorkerClassName(stage.worker);
      const WorkerClass = workerModule[workerClassName];
      
      if (!WorkerClass) {
        throw new Error(`Worker class ${workerClassName} not found in ${stage.worker}`);
      }

      // Create worker instance
      const worker = new WorkerClass();

      // Prepare contract data with previous results
      const contractData = {
        ...contract,
        content: previousResults.ingestion?.extractedText || contract.rawText || '',
        metadata: {
          ...contract.metadata,
          ...previousResults.ingestion?.metadata,
        },
      };

      // Execute worker with timeout
      const result = await this.executeWithTimeout(
        worker.process(contractData),
        stage.timeout || 60000
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        data: result,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      };
    }
  }

  // ==========================================================================
  // RESULT AGGREGATION
  // ==========================================================================

  /**
   * Aggregate results from all workers and store in database
   * 
   * @param contractId - Contract ID
   * @param results - Results from all stages
   */
  private async aggregateResults(
    contractId: string,
    results: Record<string, any>
  ): Promise<void> {
    console.log(`📦 Aggregating results for contract: ${contractId}`);

    try {
      // Process ingestion results
      if (results.ingestion) {
        await this.storeIngestionResults(contractId, results.ingestion);
      }

      // Store financial artifacts
      if (results.financial) {
        await this.storeFinancialResults(contractId, results.financial);
      }

      // Store search embeddings
      if (results.search) {
        await this.storeSearchResults(contractId, results.search);
      }

      // Store clauses
      if (results.clauses) {
        await this.storeClausesResults(contractId, results.clauses);
      }

      console.log('✅ Results aggregated successfully');
    } catch (error) {
      console.error('❌ Failed to aggregate results:', error);
      throw error;
    }
  }

  /**
   * Store ingestion worker results
   * Requirements: 1.3, 2.1, 2.2
   * 
   * @param contractId - Contract ID
   * @param ingestionResult - Ingestion worker result
   */
  private async storeIngestionResults(
    contractId: string,
    ingestionResult: any
  ): Promise<void> {
    console.log(`📝 Storing ingestion results for contract: ${contractId}`);

    try {
      // Update contract with extracted text
      if (ingestionResult.extractedText) {
        await this.contractRepository.updateRawText(
          contractId,
          ingestionResult.extractedText
        );
        console.log(`✅ Stored extracted text (${ingestionResult.extractedText.length} chars)`);
      }

      // Update contract metadata
      if (ingestionResult.metadata) {
        const metadata = ingestionResult.metadata;
        const updateData: any = {};

        // Map ingestion metadata to contract fields
        if (metadata.contractType) {
          updateData.contractType = metadata.contractType;
        }

        if (metadata.effectiveDate) {
          try {
            updateData.startDate = new Date(metadata.effectiveDate);
          } catch (error) {
            console.warn('Failed to parse effective date:', metadata.effectiveDate);
          }
        }

        if (metadata.expirationDate) {
          try {
            updateData.endDate = new Date(metadata.expirationDate);
          } catch (error) {
            console.warn('Failed to parse expiration date:', metadata.expirationDate);
          }
        }

        if (metadata.jurisdiction) {
          updateData.jurisdiction = metadata.jurisdiction;
        }

        // Update contract if we have any metadata to store
        if (Object.keys(updateData).length > 0) {
          await this.contractRepository.updateMetadata(contractId, updateData);
          console.log(`✅ Updated contract metadata:`, Object.keys(updateData));
        }

        // Store parties if extracted
        if (metadata.parties && metadata.parties.length > 0) {
          await this.storeParties(contractId, metadata.parties);
        }
      }

      console.log('✅ Ingestion results stored successfully');
    } catch (error) {
      console.error('❌ Failed to store ingestion results:', error);
      throw error;
    }
  }

  /**
   * Store extracted parties
   * 
   * @param contractId - Contract ID
   * @param parties - Array of party names
   */
  private async storeParties(
    contractId: string,
    parties: string[]
  ): Promise<void> {
    try {
      // Import PartyRepository dynamically to avoid circular dependencies
      const { PartyRepository } = await import('../../../packages/clients/db/src/repositories/party.repository');
      const partyRepository = new PartyRepository(this.contractRepository['databaseManager']);

      // Store first party as client, second as supplier (if available)
      if (parties.length > 0) {
        const clientParty = await partyRepository.findOrCreate({
          name: parties[0],
          type: 'CLIENT' as any,
        });

        await this.contractRepository.updateMetadata(contractId, {
          clientId: clientParty.id,
        });

        console.log(`✅ Stored client party: ${parties[0]}`);
      }

      if (parties.length > 1) {
        const supplierParty = await partyRepository.findOrCreate({
          name: parties[1],
          type: 'SUPPLIER' as any,
        });

        await this.contractRepository.updateMetadata(contractId, {
          supplierId: supplierParty.id,
        });

        console.log(`✅ Stored supplier party: ${parties[1]}`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to store parties:', error);
      // Don't throw - parties are not critical
    }
  }

  /**
   * Store financial worker results
   * Requirements: 2.3
   * 
   * @param contractId - Contract ID
   * @param financialResult - Financial worker result
   */
  private async storeFinancialResults(
    contractId: string,
    financialResult: any
  ): Promise<void> {
    console.log(`💰 Storing financial results for contract: ${contractId}`);

    try {
      const { ContractArtifactRepository } = await import(
        '../../../packages/clients/db/src/repositories/contract-artifact.repository'
      );
      const artifactRepository = new ContractArtifactRepository(
        this.contractRepository['databaseManager']
      );

      // Store extracted tables as artifacts
      if (financialResult.extractedTables && financialResult.extractedTables.length > 0) {
        for (const table of financialResult.extractedTables) {
          await artifactRepository.create({
            contractId,
            type: table.type || 'financial_table',
            content: table,
            confidence: table.confidence / 100, // Convert to 0-1 scale
            metadata: {
              title: table.title,
              extractionMethod: table.metadata?.extractionMethod,
              rowCount: table.rows?.length || 0,
              columnCount: table.headers?.length || 0,
            },
          });
        }
        console.log(`✅ Stored ${financialResult.extractedTables.length} financial tables`);
      }

      // Store rate cards as artifacts
      if (financialResult.rateCards && financialResult.rateCards.length > 0) {
        for (const rateCard of financialResult.rateCards) {
          await artifactRepository.create({
            contractId,
            type: 'rate_card',
            content: rateCard,
            confidence: (rateCard.metadata?.extractionConfidence || 80) / 100,
            metadata: {
              title: rateCard.title,
              currency: rateCard.currency,
              rateCount: rateCard.rates?.length || 0,
              effectiveDate: rateCard.effectiveDate,
            },
          });
        }
        console.log(`✅ Stored ${financialResult.rateCards.length} rate cards`);
      }

      // Update contract with financial metadata
      if (financialResult.totalValue || financialResult.currency) {
        await this.contractRepository.updateMetadata(contractId, {
          totalValue: financialResult.totalValue,
          currency: financialResult.currency,
        });
        console.log('✅ Updated contract financial metadata');
      }

      console.log('✅ Financial results stored successfully');
    } catch (error) {
      console.error('❌ Failed to store financial results:', error);
      throw error;
    }
  }

  /**
   * Store search worker results
   * Requirements: 3.3, 3.4
   * 
   * @param contractId - Contract ID
   * @param searchResult - Search worker result
   */
  private async storeSearchResults(
    contractId: string,
    searchResult: any
  ): Promise<void> {
    console.log(`🔍 Storing search results for contract: ${contractId}`);

    try {
      const { ContractEmbeddingRepository } = await import(
        '../../../packages/clients/db/src/repositories/contract-embedding.repository'
      );
      const embeddingRepository = new ContractEmbeddingRepository(
        this.contractRepository['databaseManager']
      );

      // Store embeddings
      if (searchResult.embeddings && searchResult.embeddings.length > 0) {
        // Split text into chunks and store embeddings
        const chunkSize = 500; // words per chunk
        const text = searchResult.searchableContent || '';
        const words = text.split(/\s+/);
        const chunks = [];

        for (let i = 0; i < words.length; i += chunkSize) {
          chunks.push(words.slice(i, i + chunkSize).join(' '));
        }

        // Store embedding for each chunk (or just one for the whole document)
        await embeddingRepository.create({
          contractId,
          chunkIndex: 0,
          chunkText: text.substring(0, 1000), // First 1000 chars as sample
          embedding: searchResult.embeddings,
          metadata: {
            wordCount: searchResult.metadata?.wordCount,
            language: searchResult.metadata?.language,
            keywords: searchResult.keywords?.slice(0, 20),
          },
        });

        console.log('✅ Stored contract embeddings');
      }

      console.log('✅ Search results stored successfully');
    } catch (error) {
      console.error('❌ Failed to store search results:', error);
      throw error;
    }
  }

  /**
   * Store clauses worker results
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
   * 
   * @param contractId - Contract ID
   * @param clausesResult - Clauses worker result
   */
  private async storeClausesResults(
    contractId: string,
    clausesResult: any
  ): Promise<void> {
    console.log(`📋 Storing clauses results for contract: ${contractId}`);

    try {
      const { ClauseRepository } = await import(
        '../../../packages/clients/db/src/repositories/clause.repository'
      );
      const clauseRepository = new ClauseRepository(
        this.contractRepository['databaseManager']
      );

      // Store extracted clauses
      if (clausesResult.clauses && clausesResult.clauses.length > 0) {
        for (const clause of clausesResult.clauses) {
          await clauseRepository.create({
            contractId,
            category: clause.type,
            content: clause.content,
            position: clause.position,
            riskLevel: clause.importance,
            confidence: clause.completeness / 100, // Convert to 0-1 scale
            metadata: {
              title: clause.title,
              issues: clause.issues,
            },
          });
        }
        console.log(`✅ Stored ${clausesResult.clauses.length} clauses`);
      }

      console.log('✅ Clauses results stored successfully');
    } catch (error) {
      console.error('❌ Failed to store clauses results:', error);
      throw error;
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get or create processing job for contract
   */
  private async getOrCreateProcessingJob(contractId: string) {
    const jobs = await this.processingJobRepository.findByContractId(contractId);
    
    if (jobs.length > 0) {
      return jobs[0];
    }

    return await this.processingJobRepository.create({
      contractId,
      status: JobStatus.PENDING,
      progress: 0,
    });
  }

  /**
   * Calculate progress percentage based on completed stages
   */
  private calculateProgress(completedStages: number): number {
    const totalStages = this.pipelineConfig.stages.length;
    const baseProgress = 5; // Initial progress
    const remainingProgress = 95; // Progress to distribute across stages
    
    return Math.min(
      100,
      baseProgress + Math.round((completedStages / totalStages) * remainingProgress)
    );
  }

  /**
   * Get worker class name from file name
   */
  private getWorkerClassName(workerFile: string): string {
    // Convert "ingestion.worker.ts" to "IngestionWorker"
    const baseName = workerFile.replace('.worker.ts', '').replace('.worker', '');
    const className = baseName
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    return `${className}Worker`;
  }

  /**
   * Check if error is transient (should retry)
   */
  private isTransientError(errorMessage?: string): boolean {
    if (!errorMessage) return false;
    
    const transientPatterns = [
      /timeout/i,
      /connection/i,
      /network/i,
      /temporary/i,
      /unavailable/i,
      /rate limit/i,
    ];

    return transientPatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Execute promise with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get pipeline configuration
   */
  getPipelineConfig(): PipelineConfig {
    return this.pipelineConfig;
  }

  /**
   * Update pipeline configuration
   */
  updatePipelineConfig(config: Partial<PipelineConfig>): void {
    this.pipelineConfig = {
      ...this.pipelineConfig,
      ...config,
    };
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create WorkerOrchestrator instance
 * 
 * @param databaseManager - Database manager instance
 * @returns WorkerOrchestrator instance
 */
export function createWorkerOrchestrator(
  databaseManager: DatabaseManager
): WorkerOrchestrator {
  return new WorkerOrchestrator(databaseManager);
}
