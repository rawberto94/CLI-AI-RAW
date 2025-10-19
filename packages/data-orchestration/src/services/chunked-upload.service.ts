/**
 * Chunked Upload Service
 * 
 * Handles large file uploads by splitting them into chunks:
 * - Chunk assembly and validation
 * - Progress tracking per chunk
 * - Cleanup for failed uploads
 * - Resume capability for interrupted uploads
 */

import { randomUUID } from 'crypto';
import { createWriteStream, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';
import { fileIntegrityService } from './file-integrity.service';

const logger = pino({ name: 'chunked-upload-service' });

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

// =========================================================================
// CHUNKED UPLOAD SERVICE
// =========================================================================

export class ChunkedUploadService {
  private static instance: ChunkedUploadService;
  private sessions: Map<string, ChunkedUploadSession> = new Map();
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours
  private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads/chunks';

  private constructor() {
    // Ensure upload directory exists
    if (!existsSync(this.UPLOAD_DIR)) {
      mkdirSync(this.UPLOAD_DIR, { recursive: true });
    }
    
    logger.info({ uploadDir: this.UPLOAD_DIR }, 'Chunked Upload Service initialized');
    
    // Start cleanup interval
    this.startCleanupInterval();
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
        metadata,
      };

      this.sessions.set(sessionId, session);

      // Create session directory
      const sessionDir = this.getSessionDir(sessionId);
      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true });
      }

      logger.info(
        { sessionId, fileName, totalChunks, totalSize },
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
  getSession(sessionId: string): ChunkedUploadSession | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session expired
    if (new Date() > session.expiresAt) {
      logger.warn({ sessionId }, 'Session expired');
      this.cleanupSession(sessionId);
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
      const session = this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found or expired`);
      }

      if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        throw new Error(`Invalid chunk index: ${chunkIndex}`);
      }

      if (session.uploadedChunks.includes(chunkIndex)) {
        logger.warn({ sessionId, chunkIndex }, 'Chunk already uploaded');
        return this.getUploadProgress(sessionId);
      }

      // Save chunk to disk
      const chunkPath = this.getChunkPath(sessionId, chunkIndex);
      await writeFile(chunkPath, chunkData);

      // Update session
      session.uploadedChunks.push(chunkIndex);
      session.uploadedChunks.sort((a, b) => a - b);

      const progress = (session.uploadedChunks.length / session.totalChunks) * 100;
      const complete = session.uploadedChunks.length === session.totalChunks;

      logger.info(
        { sessionId, chunkIndex, progress: progress.toFixed(2), complete },
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
        remainingChunks: session.totalChunks - session.uploadedChunks.length,
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
  private getUploadProgress(sessionId: string): ChunkUploadResult {
    const session = this.getSession(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const progress = (session.uploadedChunks.length / session.totalChunks) * 100;
    const complete = session.uploadedChunks.length === session.totalChunks;

    return {
      sessionId,
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
   * Assemble all chunks into final file
   */
  private async assembleChunks(sessionId: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      const session = this.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      logger.info({ sessionId, totalChunks: session.totalChunks }, 'Assembling chunks');

      // Create final file path
      const finalPath = join(this.UPLOAD_DIR, `${sessionId}_${session.fileName}`);
      const writeStream = createWriteStream(finalPath);

      // Write chunks in order
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = this.getChunkPath(sessionId, i);
        
        if (!existsSync(chunkPath)) {
          throw new Error(`Missing chunk ${i}`);
        }

        const chunkData = await readFile(chunkPath);
        writeStream.write(chunkData);
      }

      // Close stream
      await new Promise((resolve, reject) => {
        writeStream.end((err: any) => {
          if (err) reject(err);
          else resolve(true);
        });
      });

      // Verify assembled file
      const checksumResult = await fileIntegrityService.calculateChecksum(finalPath);
      
      const duration = Date.now() - startTime;
      logger.info(
        {
          sessionId,
          finalPath,
          checksum: checksumResult.checksum,
          fileSize: checksumResult.fileSize,
          duration,
        },
        'Chunks assembled successfully'
      );

      // Cleanup chunks
      await this.cleanupChunks(sessionId);

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
   * Cleanup chunks for a session
   */
  private async cleanupChunks(sessionId: string): Promise<void> {
    try {
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

        // Remove directory
        try {
          require('fs').rmdirSync(sessionDir);
        } catch (err) {
          logger.warn({ error: err, sessionDir }, 'Failed to remove session directory');
        }
      }

      logger.debug({ sessionId }, 'Chunks cleaned up');
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to cleanup chunks');
    }
  }

  /**
   * Cleanup session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    try {
      await this.cleanupChunks(sessionId);
      this.sessions.delete(sessionId);
      
      logger.info({ sessionId }, 'Session cleaned up');
    } catch (error) {
      logger.error({ error, sessionId }, 'Failed to cleanup session');
    }
  }

  /**
   * Start cleanup interval for expired sessions
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];

      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          expiredSessions.push(sessionId);
        }
      }

      if (expiredSessions.length > 0) {
        logger.info({ count: expiredSessions.length }, 'Cleaning up expired sessions');
        
        for (const sessionId of expiredSessions) {
          this.cleanupSession(sessionId).catch(err =>
            logger.error({ error: err, sessionId }, 'Failed to cleanup expired session')
          );
        }
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get session directory path
   */
  private getSessionDir(sessionId: string): string {
    return join(this.UPLOAD_DIR, sessionId);
  }

  /**
   * Get chunk file path
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
}

export const chunkedUploadService = ChunkedUploadService.getInstance();
