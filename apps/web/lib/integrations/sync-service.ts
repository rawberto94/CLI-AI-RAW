/**
 * Contract Source Sync Service
 * 
 * Handles synchronization of contracts from external sources.
 * Manages sync jobs, tracks progress, and handles errors.
 */

import { prisma } from '@/lib/prisma';
import { ContractSourceProvider, SyncMode, SyncFileStatus, SourceSyncStatus, ContractSourceStatus } from '@prisma/client';
import {
  createConnector,
  IContractSourceConnector,
  RemoteFile,
  SyncJobConfig,
  SyncJobProgress,
  SyncJobResult,
  ConnectorCredentials,
  matchesFilePattern,
  isSupportedMimeType,
} from './connectors';
import { uploadToStorage } from '@/lib/storage';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB default

export interface ContractSourceConfig {
  id: string;
  tenantId: string;
  provider: ContractSourceProvider;
  credentials: ConnectorCredentials;
  syncFolder: string;
  filePatterns: string[];
  maxFileSizeMb: number;
  syncMode: SyncMode;
  autoProcess: boolean;
  syncCursor?: string | null;
}

class ContractSourceSyncService {
  private activeJobs: Map<string, { cancel: boolean; progress: SyncJobProgress }> = new Map();

  /**
   * Get all sources for a tenant
   */
  async getSourcesForTenant(tenantId: string) {
    return prisma.contractSource.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { syncedFiles: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get a single source by ID
   */
  async getSource(sourceId: string, tenantId: string) {
    return prisma.contractSource.findFirst({
      where: { id: sourceId, tenantId },
      include: {
        syncedFiles: {
          orderBy: { lastSyncedAt: 'desc' },
          take: 10,
        },
        sourceSyncs: {
          orderBy: { startedAt: 'desc' },
          take: 5,
        },
      },
    });
  }

  /**
   * Create a new contract source
   */
  async createSource(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      provider: ContractSourceProvider;
      credentials: ConnectorCredentials;
      syncFolder?: string;
      filePatterns?: string[];
      syncInterval?: number;
      syncMode?: SyncMode;
      autoProcess?: boolean;
      maxFileSizeMb?: number;
    },
    userId: string
  ) {
    // Encrypt credentials before storing
    const encryptedCredentials = await this.encryptCredentials(data.credentials);

    return prisma.contractSource.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        provider: data.provider,
        credentials: encryptedCredentials,
        syncFolder: data.syncFolder || '/',
        filePatterns: data.filePatterns || ['*.pdf', '*.docx', '*.doc'],
        syncInterval: data.syncInterval || 60,
        syncMode: data.syncMode || SyncMode.INCREMENTAL,
        autoProcess: data.autoProcess ?? true,
        maxFileSizeMb: data.maxFileSizeMb || 50,
        status: ContractSourceStatus.DISCONNECTED,
        createdBy: userId,
      },
    });
  }

  /**
   * Update source configuration
   */
  async updateSource(
    sourceId: string,
    tenantId: string,
    data: Partial<{
      name: string;
      description: string;
      syncFolder: string;
      filePatterns: string[];
      syncInterval: number;
      syncMode: SyncMode;
      autoProcess: boolean;
      maxFileSizeMb: number;
      isActive: boolean;
      syncEnabled: boolean;
    }>
  ) {
    return prisma.contractSource.update({
      where: { id: sourceId, tenantId },
      data,
    });
  }

  /**
   * Delete a source
   */
  async deleteSource(sourceId: string, tenantId: string) {
    return prisma.contractSource.delete({
      where: { id: sourceId, tenantId },
    });
  }

  /**
   * Test connection for a source
   */
  async testConnection(sourceId: string, tenantId: string) {
    const source = await this.getSource(sourceId, tenantId);
    if (!source) {
      throw new Error('Source not found');
    }

    const credentials = await this.decryptCredentials(source.credentials as Record<string, unknown>);
    const connector = createConnector(source.provider, credentials);

    // Set OAuth tokens if available
    if ('setTokens' in connector && source.accessToken) {
      (connector as { setTokens: (a: string, r?: string, e?: Date) => void }).setTokens(
        source.accessToken,
        source.refreshToken || undefined,
        source.tokenExpiresAt || undefined
      );
    }

    const result = await connector.testConnection();

    // Update source status based on result
    await prisma.contractSource.update({
      where: { id: sourceId },
      data: {
        status: result.success ? ContractSourceStatus.CONNECTED : ContractSourceStatus.ERROR,
        lastErrorMessage: result.success ? null : result.error,
        lastErrorAt: result.success ? null : new Date(),
        accountEmail: result.accountInfo?.email,
        accountName: result.accountInfo?.name,
        connectedAt: result.success ? new Date() : undefined,
      },
    });

    await connector.disconnect();

    return result;
  }

  /**
   * Start a sync job for a source
   */
  async startSync(
    sourceId: string,
    tenantId: string,
    options?: {
      triggeredBy?: string;
      syncMode?: SyncMode;
    }
  ): Promise<SyncJobResult> {
    const source = await this.getSource(sourceId, tenantId);
    if (!source) {
      throw new Error('Source not found');
    }

    // Check if already syncing
    if (this.activeJobs.has(sourceId)) {
      throw new Error('Sync already in progress');
    }

    // Create sync record
    const syncMode = options?.syncMode || source.syncMode;
    const sync = await prisma.sourceSync.create({
      data: {
        tenantId,
        sourceId,
        status: SourceSyncStatus.PENDING,
        syncMode,
        triggeredBy: options?.triggeredBy || 'MANUAL',
      },
    });

    // Initialize progress tracking
    const progress: SyncJobProgress = {
      filesFound: 0,
      filesProcessed: 0,
      filesSkipped: 0,
      filesFailed: 0,
      bytesTransferred: 0,
      errors: [],
    };

    this.activeJobs.set(sourceId, { cancel: false, progress });

    // Update source status
    await prisma.contractSource.update({
      where: { id: sourceId },
      data: { status: ContractSourceStatus.SYNCING },
    });

    const startTime = Date.now();

    try {
      // Get connector
      const credentials = await this.decryptCredentials(source.credentials as Record<string, unknown>);
      const connector = createConnector(source.provider, credentials);

      // Set OAuth tokens if available
      if ('setTokens' in connector && source.accessToken) {
        (connector as { setTokens: (a: string, r?: string, e?: Date) => void }).setTokens(
          source.accessToken,
          source.refreshToken || undefined,
          source.tokenExpiresAt || undefined
        );
      }

      // Update sync status to running
      await prisma.sourceSync.update({
        where: { id: sync.id },
        data: { status: SourceSyncStatus.RUNNING },
      });

      // Perform sync based on mode
      let newSyncCursor: string | undefined;

      if (syncMode === SyncMode.DELTA && connector.supportsDeltaSync() && connector.getDeltaChanges) {
        // Delta sync
        newSyncCursor = await this.performDeltaSync(
          source,
          connector,
          sync.id,
          progress
        );
      } else {
        // Full or incremental sync
        await this.performFullSync(
          source,
          connector,
          sync.id,
          progress,
          syncMode === SyncMode.INCREMENTAL
        );
      }

      // Disconnect
      await connector.disconnect();

      // Update sync record
      const duration = Date.now() - startTime;
      await prisma.sourceSync.update({
        where: { id: sync.id },
        data: {
          status: SourceSyncStatus.COMPLETED,
          filesFound: progress.filesFound,
          filesProcessed: progress.filesProcessed,
          filesSkipped: progress.filesSkipped,
          filesFailed: progress.filesFailed,
          bytesTransferred: BigInt(progress.bytesTransferred),
          completedAt: new Date(),
          duration,
          nextSyncCursor: newSyncCursor,
        },
      });

      // Update source
      await prisma.contractSource.update({
        where: { id: sourceId },
        data: {
          status: ContractSourceStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          syncCursor: newSyncCursor || source.syncCursor,
          totalFilesSynced: { increment: progress.filesProcessed },
          totalBytesSynced: { increment: BigInt(progress.bytesTransferred) },
        },
      });

      return {
        success: true,
        syncId: sync.id,
        progress,
        nextDeltaToken: newSyncCursor,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update sync record
      await prisma.sourceSync.update({
        where: { id: sync.id },
        data: {
          status: SourceSyncStatus.FAILED,
          filesFound: progress.filesFound,
          filesProcessed: progress.filesProcessed,
          filesSkipped: progress.filesSkipped,
          filesFailed: progress.filesFailed,
          bytesTransferred: BigInt(progress.bytesTransferred),
          completedAt: new Date(),
          duration,
          errorMessage,
          errorDetails: { errors: progress.errors },
        },
      });

      // Update source
      await prisma.contractSource.update({
        where: { id: sourceId },
        data: {
          status: ContractSourceStatus.ERROR,
          lastSyncStatus: 'FAILED',
          lastErrorMessage: errorMessage,
          lastErrorAt: new Date(),
        },
      });

      return {
        success: false,
        syncId: sync.id,
        progress,
        duration,
        error: errorMessage,
      };
    } finally {
      this.activeJobs.delete(sourceId);
    }
  }

  /**
   * Cancel an in-progress sync
   */
  cancelSync(sourceId: string): boolean {
    const job = this.activeJobs.get(sourceId);
    if (job) {
      job.cancel = true;
      return true;
    }
    return false;
  }

  /**
   * Get sync progress for a source
   */
  getSyncProgress(sourceId: string): SyncJobProgress | null {
    const job = this.activeJobs.get(sourceId);
    return job?.progress || null;
  }

  // ============================================
  // Private Sync Methods
  // ============================================

  private async performFullSync(
    source: ContractSourceConfig & { syncFolder: string | null; filePatterns: string[] },
    connector: IContractSourceConnector,
    syncId: string,
    progress: SyncJobProgress,
    incrementalOnly: boolean
  ): Promise<void> {
    const job = this.activeJobs.get(source.id);
    let pageToken: string | undefined;
    const processedIds = new Set<string>();

    do {
      if (job?.cancel) break;

      // List files
      const result = await connector.listFiles(source.syncFolder || undefined, {
        pageToken,
        pageSize: 100,
        filePatterns: source.filePatterns,
      });

      progress.filesFound += result.files.length;

      // Process each file
      for (const file of result.files) {
        if (job?.cancel) break;
        if (processedIds.has(file.id)) continue;
        processedIds.add(file.id);

        progress.currentFile = file.name;

        try {
          await this.processFile(source, connector, file, syncId, progress, incrementalOnly);
        } catch (error) {
          progress.filesFailed++;
          progress.errors.push({
            fileId: file.id,
            fileName: file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      pageToken = result.nextPageToken;
    } while (pageToken && !job?.cancel);
  }

  private async performDeltaSync(
    source: ContractSourceConfig & { syncCursor: string | null },
    connector: IContractSourceConnector,
    syncId: string,
    progress: SyncJobProgress
  ): Promise<string | undefined> {
    const job = this.activeJobs.get(source.id);

    if (!connector.getDeltaChanges) {
      throw new Error('Connector does not support delta sync');
    }

    const result = await connector.getDeltaChanges(source.syncCursor || undefined);

    progress.filesFound = result.changes.length;

    for (const change of result.changes) {
      if (job?.cancel) break;

      progress.currentFile = change.file.name;

      if (change.type === 'deleted') {
        // Mark as deleted in our system
        await prisma.syncedFile.updateMany({
          where: {
            sourceId: source.id,
            remoteId: change.file.id,
          },
          data: {
            isDeleted: true,
            lastSyncedAt: new Date(),
          },
        });
        progress.filesProcessed++;
      } else {
        try {
          await this.processFile(source, connector, change.file, syncId, progress, true);
        } catch (error) {
          progress.filesFailed++;
          progress.errors.push({
            fileId: change.file.id,
            fileName: change.file.name,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return result.deltaToken;
  }

  private async processFile(
    source: ContractSourceConfig,
    connector: IContractSourceConnector,
    file: RemoteFile,
    syncId: string,
    progress: SyncJobProgress,
    incrementalOnly: boolean
  ): Promise<void> {
    // Check file size
    const maxSize = (source.maxFileSizeMb || 50) * 1024 * 1024;
    if (file.size > maxSize) {
      progress.filesSkipped++;
      return;
    }

    // Check if already synced (for incremental sync)
    const existingSyncedFile = await prisma.syncedFile.findUnique({
      where: {
        sourceId_remoteId: {
          sourceId: source.id,
          remoteId: file.id,
        },
      },
    });

    if (incrementalOnly && existingSyncedFile) {
      // Check if file has been modified
      if (
        existingSyncedFile.remoteHash === file.hash ||
        (file.modifiedAt && existingSyncedFile.remoteModifiedAt &&
          file.modifiedAt <= existingSyncedFile.remoteModifiedAt)
      ) {
        // File hasn't changed
        progress.filesSkipped++;
        return;
      }
    }

    // Update synced file status
    const syncedFile = await prisma.syncedFile.upsert({
      where: {
        sourceId_remoteId: {
          sourceId: source.id,
          remoteId: file.id,
        },
      },
      update: {
        processingStatus: SyncFileStatus.DOWNLOADING,
        remoteHash: file.hash,
        remoteModifiedAt: file.modifiedAt,
        lastSyncedAt: new Date(),
        syncCount: { increment: 1 },
      },
      create: {
        tenantId: source.tenantId,
        sourceId: source.id,
        remoteId: file.id,
        remotePath: file.path,
        remoteHash: file.hash,
        fileName: file.name,
        mimeType: file.mimeType,
        fileSize: BigInt(file.size),
        remoteCreatedAt: file.createdAt,
        remoteModifiedAt: file.modifiedAt,
        processingStatus: SyncFileStatus.DOWNLOADING,
      },
    });

    try {
      // Download file
      const downloaded = await connector.downloadFile(file.id);
      progress.bytesTransferred += downloaded.size;

      // Upload to local storage
      const storagePath = `uploads/${source.tenantId}/synced/${source.id}/${Date.now()}-${file.name}`;
      await uploadToStorage(storagePath, downloaded.content, downloaded.mimeType);

      // Create contract record
      const contract = await prisma.contract.create({
        data: {
          tenantId: source.tenantId,
          fileName: file.name,
          originalName: file.name,
          mimeType: downloaded.mimeType,
          fileSize: BigInt(downloaded.size),
          status: source.autoProcess ? 'PENDING' : 'UPLOADED',
          storagePath,
          storageProvider: 'local',
          importSource: source.provider,
          externalId: file.id,
          externalUrl: file.webUrl,
          sourceMetadata: {
            sourceId: source.id,
            sourceName: source.name,
            remotePath: file.path,
            syncedAt: new Date().toISOString(),
          },
        },
      });

      // Update synced file with contract reference
      await prisma.syncedFile.update({
        where: { id: syncedFile.id },
        data: {
          contractId: contract.id,
          processingStatus: source.autoProcess ? SyncFileStatus.PROCESSING : SyncFileStatus.COMPLETED,
          processedAt: new Date(),
        },
      });

      // If auto-process is enabled, queue for processing
      if (source.autoProcess) {
        // Queue contract for AI processing (integrate with existing job system)
        await this.queueContractForProcessing(contract.id, source.tenantId);
      }

      progress.filesProcessed++;
    } catch (error) {
      // Update synced file with error
      await prisma.syncedFile.update({
        where: { id: syncedFile.id },
        data: {
          processingStatus: SyncFileStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    }
  }

  private async queueContractForProcessing(contractId: string, tenantId: string): Promise<void> {
    // Create a processing job (integrates with existing worker system)
    await prisma.processingJob.create({
      data: {
        tenantId,
        contractId,
        status: 'PENDING',
        jobType: 'FULL_EXTRACTION',
        priority: 5,
        metadata: {
          source: 'contract-source-sync',
          autoProcess: true,
        },
      },
    });
  }

  // ============================================
  // Credential Encryption (placeholder - use proper encryption in production)
  // ============================================

  private async encryptCredentials(credentials: ConnectorCredentials): Promise<Record<string, unknown>> {
    // In production, use proper encryption (e.g., AES-256-GCM with KMS)
    // For now, return as-is (credentials should be encrypted at rest in DB)
    return credentials as Record<string, unknown>;
  }

  private async decryptCredentials(encrypted: Record<string, unknown>): Promise<ConnectorCredentials> {
    // In production, decrypt using the same key
    return encrypted as ConnectorCredentials;
  }
}

// Export singleton
export const contractSourceSyncService = new ContractSourceSyncService();

// Export class for testing
export { ContractSourceSyncService };
