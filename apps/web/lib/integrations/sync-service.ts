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
  SyncJobProgress,
  SyncJobResult,
  ConnectorCredentials,
} from './connectors';
import { uploadToStorage } from '@/lib/storage';
import * as crypto from 'crypto';

// File size limit for sync (may be used for validation in future)
const _MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB default

export interface ContractSourceConfig {
  id: string;
  tenantId: string;
  name: string;
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
        credentials: JSON.parse(JSON.stringify(encryptedCredentials)),
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

    await connector.disconnect?.();

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

      // Cast source to the expected type with proper credentials
      const sourceConfig = {
        ...source,
        credentials: source.credentials as unknown as ConnectorCredentials,
      };

      if (syncMode === SyncMode.DELTA && connector.supportsDeltaSync?.() && connector.getDeltaChanges) {
        // Delta sync
        newSyncCursor = await this.performDeltaSync(
          sourceConfig as ContractSourceConfig & { syncCursor: string | null },
          connector,
          sync.id,
          progress
        );
      } else {
        // Full or incremental sync
        await this.performFullSync(
          sourceConfig as ContractSourceConfig & { syncFolder: string | null; filePatterns: string[] },
          connector,
          sync.id,
          progress,
          syncMode === SyncMode.INCREMENTAL
        );
      }

      // Disconnect
      await connector.disconnect?.();

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

      // Process files concurrently with a semaphore (5 parallel downloads)
      const CONCURRENCY = 5;
      const filesToProcess = result.files.filter(f => {
        if (job?.cancel) return false;
        if (processedIds.has(f.id)) return false;
        processedIds.add(f.id);
        return true;
      });

      // Process in batches of CONCURRENCY
      for (let i = 0; i < filesToProcess.length; i += CONCURRENCY) {
        if (job?.cancel) break;
        const batch = filesToProcess.slice(i, i + CONCURRENCY);

        const results = await Promise.allSettled(
          batch.map(async (file) => {
            progress.currentFile = file.name;
            await this.processFile(source, connector, file, syncId, progress, incrementalOnly);
          })
        );

        // Track failures
        results.forEach((result, idx) => {
          if (result.status === 'rejected') {
            progress.filesFailed++;
            progress.errors.push({
              fileId: batch[idx].id,
              fileName: batch[idx].name,
              error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            });
          }
        });
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

    const changes = result.changes ?? [];
    progress.filesFound = changes.length;

    for (const change of changes) {
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
      // Reference-mode short-circuit: some connectors (e.g. Postgres in
      // reference mode) only carry a URL/path in the source row and have no
      // bytes to download. Skip downloadFile + storage and create a
      // metadata-only Contract pointing at the original URL.
      const isReferenceMode =
        (file.metadata as Record<string, unknown> | undefined)?.mode === 'reference';

      if (isReferenceMode) {
        const externalUrl = file.webUrl || file.downloadUrl;
        if (!externalUrl) {
          throw new Error(
            `Reference-mode row ${file.id} has no webUrl/downloadUrl; ` +
              `check that the body column maps to a URL string.`,
          );
        }

        const contract = await prisma.contract.create({
          data: {
            tenantId: source.tenantId,
            fileName: file.name,
            originalName: file.name,
            mimeType: file.mimeType,
            fileSize: BigInt(file.size || 0),
            status: 'UPLOADED', // never auto-process; we don't have the bytes
            storagePath: '', // no local copy
            storageProvider: 'reference',
            importSource: source.provider,
            externalId: file.id,
            externalUrl,
            sourceMetadata: {
              sourceId: source.id,
              sourceName: source.name,
              remotePath: file.path,
              syncedAt: new Date().toISOString(),
              mode: 'reference',
              ...(file.metadata as Record<string, unknown> | undefined),
            },
          },
        });

        await prisma.syncedFile.update({
          where: { id: syncedFile.id },
          data: {
            contractId: contract.id,
            processingStatus: SyncFileStatus.COMPLETED,
            processedAt: new Date(),
          },
        });

        // Outbound webhook (non-blocking)
        import('@/lib/webhook-triggers')
          .then(({ triggerContractCreated }) =>
            triggerContractCreated(source.tenantId, contract.id, {
              fileName: contract.fileName,
              importSource: source.provider,
              mode: 'reference',
              externalUrl: contract.externalUrl,
            }),
          )
          .catch(() => {});

        // Durable event log
        import('@/lib/events/integration-events')
          .then(({ recordIntegrationEvent }) =>
            recordIntegrationEvent({
              tenantId: source.tenantId,
              eventType: 'contract.created',
              resourceId: contract.id,
              payload: {
                contractId: contract.id,
                fileName: contract.fileName,
                importSource: source.provider,
                mode: 'reference',
                externalUrl: contract.externalUrl,
              },
            }),
          )
          .catch(() => {});

        progress.filesProcessed++;
        return;
      }

      // Download file
      const downloaded = await connector.downloadFile(file.id);
      const downloadedSize = downloaded.size ?? 0;
      progress.bytesTransferred += downloadedSize;

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
          fileSize: BigInt(downloadedSize),
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

      // Outbound webhook (non-blocking)
      import('@/lib/webhook-triggers')
        .then(({ triggerContractCreated }) =>
          triggerContractCreated(source.tenantId, contract.id, {
            fileName: contract.fileName,
            importSource: source.provider,
            mode: 'copy',
          }),
        )
        .catch(() => {});

      // Durable event log
      import('@/lib/events/integration-events')
        .then(({ recordIntegrationEvent }) =>
          recordIntegrationEvent({
            tenantId: source.tenantId,
            eventType: 'contract.created',
            resourceId: contract.id,
            payload: {
              contractId: contract.id,
              fileName: contract.fileName,
              importSource: source.provider,
              mode: 'copy',
            },
          }),
        )
        .catch(() => {});

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
  // Credential Encryption (AES-256-GCM)
  // ============================================

  private getEncryptionKey(): Buffer {
    // Get encryption key from environment (should be 32 bytes for AES-256)
    const keyBase64 = process.env.CREDENTIAL_ENCRYPTION_KEY;
    if (!keyBase64) {
      // In production, require the key
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CREDENTIAL_ENCRYPTION_KEY is required in production');
      }
      console.warn('[SyncService] CREDENTIAL_ENCRYPTION_KEY not set - using derived key from DATABASE_URL (DEV ONLY)');
      // Fallback: derive key from DATABASE_URL hash (not recommended for production)
      const fallbackKey = process.env.DATABASE_URL || '';
      return crypto.createHash('sha256').update(fallbackKey).digest();
    }
    return Buffer.from(keyBase64, 'base64');
  }

  private async encryptCredentials(credentials: ConnectorCredentials): Promise<Record<string, unknown>> {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16); // 16 bytes IV for AES-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(credentials);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();

    return {
      _encrypted: true,
      _algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted,
    };
  }

  private async decryptCredentials(encrypted: Record<string, unknown>): Promise<ConnectorCredentials> {
    // Handle unencrypted credentials (legacy data)
    if (!encrypted._encrypted) {
      return encrypted as unknown as ConnectorCredentials;
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(encrypted.iv as string, 'base64');
    const authTag = Buffer.from(encrypted.authTag as string, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted.data as string, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted) as ConnectorCredentials;
  }
}

// Export singleton
export const contractSourceSyncService = new ContractSourceSyncService();

// Export class for testing
export { ContractSourceSyncService };
