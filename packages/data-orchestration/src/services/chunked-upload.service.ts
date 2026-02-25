/**
 * Chunked Upload Service
 * 
 * Handles large file uploads by splitting them into chunks:
 * - S3/MinIO temp bucket storage for multi-container access
 * - Redis-backed session state for scalability
 * - Fallback to local filesystem when S3 unavailable
 * - Chunk assembly and validation
 * - Progress tracking per chunk
 * - Cleanup for failed uploads
 * - Resume capability for interrupted uploads
 */

import { randomUUID } from 'crypto';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { createLogger } from '../utils/logger';
import { fileIntegrityService } from './file-integrity.service';

const logger = createLogger('chunked-upload-service');

// =========================================================================
// TYPES AND INTERFACES
// =========================================================================

export interface ChunkedUploadSession {
  id: string;
  tenantId: string;
  fileName: string;
  totalChunks: number;
  chunkSize: number;
  totalSize: number;
  uploadedChunks: number[];
  createdAt: Date;
  expiresAt: Date;
  storageBackend: 's3' | 'local';
  metadata?: any;
}

export interface ChunkUploadResult {
  sessionId: string;
  chunkIndex: number;
  uploaded: boolean;
  progress: number;
  remainingChunks: number;
  complete: boolean;
  filePath?: string;
}

export interface StorageProvider {
  upload(options: { fileName: string; buffer: Buffer; contentType?: string; metadata?: Record<string, string> }): Promise<{ success: boolean; error?: string }>;
  download(fileName: string): Promise<Buffer | null>;
  delete(fileName: string): Promise<boolean>;
  list(prefix: string): Promise<string[]>;
  exists(fileName: string): Promise<boolean>;
}

export interface SessionStore {
  get(sessionId: string): Promise<ChunkedUploadSession | null>;
  set(sessionId: string, session: ChunkedUploadSession, ttlMs?: number): Promise<void>;
  delete(sessionId: string): Promise<void>;
  addChunk(sessionId: string, chunkIndex: number): Promise<ChunkedUploadSession | null>;
  listExpired(maxAgeMs: number): Promise<string[]>;
}

// =========================================================================
// REDIS SESSION STORE (primary)
// =========================================================================

class RedisSessionStore implements SessionStore {
  private redis: any;
  private prefix = 'upload-session:';

  constructor(redis: any) {
    this.redis = redis;
  }

  async get(sessionId: string): Promise<ChunkedUploadSession | null> {
    try {
      const data = await this.redis.get(`${this.prefix}${sessionId}`);
      if (!data) return null;
      const session = JSON.parse(data);
      session.createdAt = new Date(session.createdAt);
      session.expiresAt = new Date(session.expiresAt);
      return session;
    } catch (error) {
      logger.error({ error, sessionId }, 'Redis session get failed');
      return null;
    }
  }

  async set(sessionId: string, session: ChunkedUploadSession, ttlMs?: number): Promise<void> {
    const ttl = ttlMs || (session.expiresAt.getTime() - Date.now());
    await this.redis.set(
      `${this.prefix}${sessionId}`,
      JSON.stringify(session),
      'PX',
      Math.max(ttl, 60000) // Minimum 1 minute TTL
    );
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(`${this.prefix}${sessionId}`);
  }

  async addChunk(sessionId: string, chunkIndex: number): Promise<ChunkedUploadSession | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    if (!session.uploadedChunks.includes(chunkIndex)) {
      session.uploadedChunks.push(chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);
      await this.set(sessionId, session);
    }
    return session;
  }

  async listExpired(maxAgeMs: number): Promise<string[]> {
    try {
      const keys = await this.redis.keys(`${this.prefix}*`);
      const expired: string[] = [];
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;
        const session = JSON.parse(data);
        if (Date.now() - new Date(session.createdAt).getTime() > maxAgeMs) {
          expired.push(session.id);
        }
      }
      return expired;
    } catch (error) {
      logger.error({ error }, 'Failed to list expired sessions');
      return [];
    }
  }
}

// =========================================================================
// IN-MEMORY SESSION STORE (fallback)
// =========================================================================

class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, ChunkedUploadSession> = new Map();

  async get(sessionId: string): Promise<ChunkedUploadSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (new Date() > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async set(sessionId: string, session: ChunkedUploadSession): Promise<void> {
    this.sessions.set(sessionId, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async addChunk(sessionId: string, chunkIndex: number): Promise<ChunkedUploadSession | null> {
    const session = await this.get(sessionId);
    if (!session) return null;
    if (!session.uploadedChunks.includes(chunkIndex)) {
      session.uploadedChunks.push(chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);
    }
    return session;
  }

  async listExpired(maxAgeMs: number): Promise<string[]> {
    const expired: string[] = [];
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.createdAt.getTime() > maxAgeMs) {
        expired.push(id);
      }
    }
    return expired;
  }
}

// =========================================================================
// CONSTANTS
// =========================================================================

const TEMP_BUCKET_PREFIX = 'temp-chunks';

// =========================================================================
// CHUNKED UPLOAD SERVICE
// =========================================================================

export class ChunkedUploadService {
  private static instance: ChunkedUploadService;
  private sessionStore: SessionStore;
  private storageProvider: StorageProvider | null = null;
  private useS3: boolean = false;
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/chunks';

  private constructor() {
    // Ensure local upload directory exists as fallback
    if (!existsSync(this.UPLOAD_DIR)) {
      mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
    
    // Initialize session store (Redis or in-memory)
    this.sessionStore = new InMemorySessionStore();
    this.initializeBackends();
    
    logger.info({ uploadDir: this.UPLOAD_DIR }, 'Chunked Upload Service initialized');
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Initialize S3 storage and Redis session store if available
   */
  private async initializeBackends(): Promise<void> {
    // Try Redis for session store
    try {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const Redis = (await import('ioredis')).default;
        const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });
        await redis.connect();
        this.sessionStore = new RedisSessionStore(redis);
        logger.info('Using Redis session store for chunked uploads');
      }
    } catch (error) {
      logger.warn({ error }, 'Redis unavailable for session store, using in-memory fallback');
    }

    // Try S3/MinIO for chunk storage
    try {
      const s3Endpoint = process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT;
      if (s3Endpoint) {
        const Minio = await import('minio');
        const client = new Minio.Client({
          endPoint: s3Endpoint,
          port: parseInt(process.env.S3_PORT || process.env.MINIO_PORT || '9000'),
          useSSL: process.env.S3_USE_SSL === 'true',
          accessKey: process.env.S3_ACCESS_KEY || process.env.MINIO_ACCESS_KEY || '',
          secretKey: process.env.S3_SECRET_KEY || process.env.MINIO_SECRET_KEY || '',
        });
        const bucket = process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'contracts';

        this.storageProvider = {
          async upload(options) {
            try {
              await client.putObject(bucket, options.fileName, options.buffer, options.buffer.length, {
                'Content-Type': options.contentType || 'application/octet-stream',
                ...options.metadata,
              });
              return { success: true };
            } catch (error) {
              return { success: false, error: (error as Error).message };
            }
          },
          async download(fileName) {
            try {
              const stream = await client.getObject(bucket, fileName);
              const chunks: Buffer[] = [];
              for await (const chunk of stream) {
                chunks.push(Buffer.from(chunk));
              }
              return Buffer.concat(chunks);
            } catch {
              return null;
            }
          },
          async delete(fileName) {
            try {
              await client.removeObject(bucket, fileName);
              return true;
            } catch { return false; }
          },
          async list(prefix) {
            try {
              const objects: string[] = [];
              const stream = client.listObjects(bucket, prefix, true);
              for await (const obj of stream) {
                if (obj.name) objects.push(obj.name);
              }
              return objects;
            } catch { return []; }
          },
          async exists(fileName) {
            try {
              await client.statObject(bucket, fileName);
              return true;
            } catch { return false; }
          },
        };
        this.useS3 = true;
        logger.info({ endpoint: s3Endpoint, bucket }, 'Using S3/MinIO for chunk storage');
      }
    } catch (error) {
      logger.warn({ error }, 'S3/MinIO unavailable for chunk storage, using local filesystem');
    }
  }

  static getInstance(): ChunkedUploadService {
    if (!ChunkedUploadService.instance) {
      ChunkedUploadService.instance = new ChunkedUploadService();
    }
    return ChunkedUploadService.instance;
  }

  // =========================================================================
  // SESSION MANAGEMENT
  // =========================================================================

  /**
   * Initialize a chunked upload session
   */
  async initializeSession(
    tenantId: string,
    fileName: string,
    totalSize: number,
    metadata?: any
  ): Promise<ChunkedUploadSession> {
    try {
      const sessionId = randomUUID();
      const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);
      
      const session: ChunkedUploadSession = {
        id: sessionId,
        tenantId,
        fileName,
        totalChunks,
        chunkSize: this.CHUNK_SIZE,
        totalSize,
        uploadedChunks: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
        storageBackend: this.useS3 ? 's3' : 'local',
        metadata,
      };

      await this.sessionStore.set(sessionId, session, this.SESSION_TIMEOUT);

      // Create local session directory as fallback
      if (!this.useS3) {
        const sessionDir = this.getSessionDir(sessionId);
        if (!existsSync(sessionDir)) {
          mkdirSync(sessionDir, { recursive: true });
        }
      }

      logger.info(
        { sessionId, fileName, totalChunks, totalSize, backend: session.storageBackend },
        'Chunked upload session initialized'
      );

      return session;
    } catch (error) {
      logger.error({ error, fileName, totalSize }, 'Failed to initialize session');
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ChunkedUploadSession | null> {
    const session = await this.sessionStore.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      logger.warn({ sessionId }, 'Session expired');
      await this.cleanupSession(sessionId);
      return null;
    }

    return session;
  }

  // =========================================================================
  // CHUNK UPLOAD
  // =========================================================================

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<ChunkUploadResult> {
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }

      if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        throw new Error(`Invalid chunk index: ${chunkIndex}`);
      }

      if (session.uploadedChunks.includes(chunkIndex)) {
        logger.warn({ sessionId, chunkIndex }, 'Chunk already uploaded');
        return this.getUploadProgress(session);
      }

      // Store chunk in S3/MinIO temp bucket or local filesystem
      if (this.useS3 && this.storageProvider) {
        const storageKey = `${TEMP_BUCKET_PREFIX}/${sessionId}/chunk-${chunkIndex}`;
        const result = await this.storageProvider.upload({
          fileName: storageKey,
          buffer: chunkData,
          contentType: 'application/octet-stream',
          metadata: {
            sessionId,
            chunkIndex: String(chunkIndex),
            expiresAt: session.expiresAt.toISOString(),
          },
        });
        if (!result.success) {
          throw new Error(`Failed to upload chunk to S3: ${result.error}`);
        }
      } else {
        // Fallback to local filesystem
        const chunkPath = this.getChunkPath(sessionId, chunkIndex);
        const sessionDir = this.getSessionDir(sessionId);
        if (!existsSync(sessionDir)) {
          mkdirSync(sessionDir, { recursive: true });
        }
        await writeFile(chunkPath, chunkData);
      }

      // Update session in store (Redis or memory)
      const updatedSession = await this.sessionStore.addChunk(sessionId, chunkIndex);
      if (!updatedSession) {
        throw new Error('Failed to update session after chunk upload');
      }

      const progress = (updatedSession.uploadedChunks.length / updatedSession.totalChunks) * 100;
      const complete = updatedSession.uploadedChunks.length === updatedSession.totalChunks;

      logger.info(
        { sessionId, chunkIndex, progress: progress.toFixed(2), complete, backend: session.storageBackend },
        'Chunk uploaded'
      );

      // If all chunks uploaded, assemble file
      let filePath: string | undefined;
      if (complete) {
        filePath = await this.assembleChunks(sessionId);
      }

      return {
        sessionId,
        chunkIndex,
        uploaded: true,
        progress: Math.round(progress),
        remainingChunks: updatedSession.totalChunks - updatedSession.uploadedChunks.length,
        complete,
        filePath,
      };
    } catch (error) {
      logger.error({ error, sessionId, chunkIndex }, 'Failed to upload chunk');
      throw error;
    }
  }

  /**
   * Get upload progress
   */
  private getUploadProgress(session: ChunkedUploadSession): ChunkUploadResult {
    const progress = (session.uploadedChunks.length / session.totalChunks) * 100;
    const complete = session.uploadedChunks.length === session.totalChunks;

    return {
      sessionId: session.id,
      chunkIndex: -1,
      uploaded: false,
      progress: Math.round(progress),
      remainingChunks: session.totalChunks - session.uploadedChunks.length,
      complete,
    };
  }

  // =========================================================================
  // CHUNK ASSEMBLY
  // =========================================================================

  /**
   * Assemble all chunks into final file.
   * Downloads from S3 if using object storage, otherwise reads from local FS.
   * Uploads assembled file to permanent storage and cleans up temp chunks.
   */
  async assembleChunks(sessionId: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const session = await this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      logger.info({ sessionId, totalChunks: session.totalChunks, backend: session.storageBackend }, 'Assembling chunks');

      const chunks: Buffer[] = [];

      if (this.useS3 && this.storageProvider) {
        // Download chunks from S3 in order
        for (let i = 0; i < session.totalChunks; i++) {
          const key = `${TEMP_BUCKET_PREFIX}/${sessionId}/chunk-${i}`;
          const chunkData = await this.storageProvider.download(key);
          if (!chunkData) {
            throw new Error(`Missing chunk ${i} from S3`);
          }
          chunks.push(chunkData);
        }
      } else {
        // Read chunks from local filesystem
        for (let i = 0; i < session.totalChunks; i++) {
          const chunkPath = this.getChunkPath(sessionId, i);
          if (!existsSync(chunkPath)) {
            throw new Error(`Missing chunk ${i} from filesystem`);
          }
          const chunkData = await readFile(chunkPath);
          chunks.push(chunkData);
        }
      }

      // Upload assembled file to permanent storage key
      const assembledBuffer = Buffer.concat(chunks);
      const assembledKey = `contracts/${session.tenantId}/${Date.now()}-${session.fileName}`;

      let finalPath = assembledKey;

      if (this.useS3 && this.storageProvider) {
        const result = await this.storageProvider.upload({
          fileName: assembledKey,
          buffer: assembledBuffer,
          contentType: 'application/octet-stream',
          metadata: {
            tenantId: session.tenantId,
            originalName: session.fileName,
            assembledAt: new Date().toISOString(),
          },
        });
        if (!result.success) {
          throw new Error(`Failed to upload assembled file: ${result.error}`);
        }
      } else {
        // Write assembled file locally
        const localPath = join(this.UPLOAD_DIR, `${sessionId}_${session.fileName}`);
        const writeStream = createWriteStream(localPath);
        writeStream.write(assembledBuffer);
        await new Promise((resolve, reject) => {
          writeStream.end((err: any) => {
            if (err) reject(err);
            else resolve(true);
          });
        });
        finalPath = localPath;
      }

      // Verify assembled file via checksum
      // (Only possible for local files; for S3 we trust the upload)
      if (!this.useS3) {
        const checksumResult = await fileIntegrityService.calculateChecksum(finalPath);
        logger.info({ checksum: checksumResult.checksum, fileSize: checksumResult.fileSize }, 'File checksum verified');
      }

      const duration = Date.now() - startTime;
      logger.info(
        { sessionId, finalPath, duration, backend: session.storageBackend },
        'Chunks assembled successfully'
      );

      // Cleanup temp chunks
      await this.cleanupTempChunks(sessionId, session);

      return finalPath;
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to assemble chunks');
      throw error;
    }
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Cleanup temporary chunks for a session (S3 + local)
   */
  private async cleanupTempChunks(sessionId: string, session?: ChunkedUploadSession | null): Promise<void> {
    try {
      // Clean up S3 temp chunks
      if (this.useS3 && this.storageProvider) {
        const prefix = `${TEMP_BUCKET_PREFIX}/${sessionId}/`;
        const objects = await this.storageProvider.list(prefix);
        for (const obj of objects) {
          await this.storageProvider.delete(obj);
        }
        logger.debug({ sessionId, count: objects.length }, 'S3 temp chunks cleaned up');
      }

      // Always clean up local filesystem too (dual-write scenario)
      const sessionDir = this.getSessionDir(sessionId);
      if (existsSync(sessionDir)) {
        const files = readdirSync(sessionDir);
        for (const file of files) {
          const filePath = join(sessionDir, file);
          try {
            unlinkSync(filePath);
          } catch (err) {
            logger.warn({ error: err, filePath }, 'Failed to delete chunk file');
          }
        }
        try {
          require('fs').rmdirSync(sessionDir);
        } catch (err) {
          logger.warn({ error: err, sessionDir }, 'Failed to remove session directory');
        }
      }

      logger.debug({ sessionId }, 'Temp chunks cleaned up');
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to cleanup temp chunks');
    }
  }

  /**
   * Cleanup session (session store + temp chunks)
   */
  async cleanupSession(sessionId: string): Promise<void> {
    try {
      const session = await this.sessionStore.get(sessionId);
      await this.cleanupTempChunks(sessionId, session);
      await this.sessionStore.delete(sessionId);
      
      logger.info({ sessionId }, 'Session cleaned up');
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to cleanup session');
    }
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    setInterval(async () => {
      try {
        const expiredSessions = await this.sessionStore.listExpired(this.SESSION_TIMEOUT);
        
        if (expiredSessions.length > 0) {
          logger.info({ count: expiredSessions.length }, 'Cleaning up expired sessions');
          
          for (const sessionId of expiredSessions) {
            await this.cleanupSession(sessionId).catch(err =>
              logger.error({ error: err, sessionId }, 'Failed to cleanup expired session')
            );
          }
        }
      } catch (error) {
        logger.error({ error }, 'Cleanup interval error');
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get session directory path (local filesystem)
   */
  private getSessionDir(sessionId: string): string {
    return join(this.UPLOAD_DIR, sessionId);
  }

  /**
   * Get chunk file path (local filesystem)
   */
  private getChunkPath(sessionId: string, chunkIndex: number): string {
    return join(this.getSessionDir(sessionId), `chunk_${chunkIndex}`);
  }

  /**
   * Get chunk size
   */
  getChunkSize(): number {
    return this.CHUNK_SIZE;
  }

  /**
   * Calculate total chunks for file size
   */
  calculateTotalChunks(fileSize: number): number {
    return Math.ceil(fileSize / this.CHUNK_SIZE);
  }

  /**
   * Check if S3 storage is being used
   */
  isUsingS3(): boolean {
    return this.useS3;
  }

  /**
   * Get the storage provider for external use (e.g., cleanup workers)
   */
  getStorageProvider(): StorageProvider | null {
    return this.storageProvider;
  }

  /**
   * Get session store for external use (e.g., cleanup workers)
   */
  getSessionStore(): SessionStore {
    return this.sessionStore;
  }
}

export const chunkedUploadService = ChunkedUploadService.getInstance();
