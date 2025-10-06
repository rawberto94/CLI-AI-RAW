/**
 * Optimized Upload Handler
 * High-performance file upload with streaming, chunking, and parallel processing
 */

import { Readable } from 'stream';
import { createHash } from 'crypto';
import { performanceMonitor } from '../performance/performance-monitor';

interface UploadChunk {
  index: number;
  data: Buffer;
  size: number;
  hash: string;
}

interface UploadSession {
  id: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Set<number>;
  chunks: Map<number, UploadChunk>;
  startTime: number;
  lastActivity: number;
}

export class OptimizedUploadHandler {
  private sessions = new Map<string, UploadSession>();
  private chunkSize = 5 * 1024 * 1024; // 5MB chunks
  private maxConcurrentUploads = 10;
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Cleanup expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Initialize chunked upload session
   */
  async initializeUpload(fileName: string, fileSize: number, mimeType: string): Promise<string> {
    return performanceMonitor.measure('upload:initialize', async () => {
      const sessionId = this.generateSessionId();
      const totalChunks = Math.ceil(fileSize / this.chunkSize);

      const session: UploadSession = {
        id: sessionId,
        fileName,
        fileSize,
        totalChunks,
        uploadedChunks: new Set(),
        chunks: new Map(),
        startTime: Date.now(),
        lastActivity: Date.now(),
      };

      this.sessions.set(sessionId, session);

      return sessionId;
    });
  }

  /**
   * Upload chunk with validation and deduplication
   */
  async uploadChunk(
    sessionId: string,
    chunkIndex: number,
    chunkData: Buffer
  ): Promise<{ success: boolean; progress: number }> {
    return performanceMonitor.measure('upload:chunk', async () => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Upload session not found or expired');
      }

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        throw new Error('Invalid chunk index');
      }

      // Check if chunk already uploaded (deduplication)
      if (session.uploadedChunks.has(chunkIndex)) {
        return {
          success: true,
          progress: (session.uploadedChunks.size / session.totalChunks) * 100,
        };
      }

      // Calculate chunk hash for integrity
      const hash = createHash('sha256').update(chunkData).digest('hex');

      // Store chunk
      const chunk: UploadChunk = {
        index: chunkIndex,
        data: chunkData,
        size: chunkData.length,
        hash,
      };

      session.chunks.set(chunkIndex, chunk);
      session.uploadedChunks.add(chunkIndex);
      session.lastActivity = Date.now();

      const progress = (session.uploadedChunks.size / session.totalChunks) * 100;

      return { success: true, progress };
    });
  }

  /**
   * Finalize upload and assemble file
   */
  async finalizeUpload(sessionId: string): Promise<Buffer> {
    return performanceMonitor.measure('upload:finalize', async () => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Upload session not found');
      }

      // Verify all chunks uploaded
      if (session.uploadedChunks.size !== session.totalChunks) {
        throw new Error(
          `Incomplete upload: ${session.uploadedChunks.size}/${session.totalChunks} chunks`
        );
      }

      // Assemble chunks in order
      const chunks: Buffer[] = [];
      for (let i = 0; i < session.totalChunks; i++) {
        const chunk = session.chunks.get(i);
        if (!chunk) {
          throw new Error(`Missing chunk ${i}`);
        }
        chunks.push(chunk.data);
      }

      const completeFile = Buffer.concat(chunks);

      // Verify file size
      if (completeFile.length !== session.fileSize) {
        throw new Error(
          `File size mismatch: expected ${session.fileSize}, got ${completeFile.length}`
        );
      }

      // Cleanup session
      this.sessions.delete(sessionId);

      return completeFile;
    });
  }

  /**
   * Stream upload for large files
   */
  async streamUpload(
    stream: Readable,
    fileName: string,
    onProgress?: (progress: number) => void
  ): Promise<Buffer> {
    return performanceMonitor.measure('upload:stream', async () => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          totalSize += chunk.length;

          if (onProgress) {
            onProgress(totalSize);
          }
        });

        stream.on('end', () => {
          const completeFile = Buffer.concat(chunks);
          resolve(completeFile);
        });

        stream.on('error', (error) => {
          reject(error);
        });
      });
    });
  }

  /**
   * Parallel chunk upload
   */
  async uploadChunksParallel(
    sessionId: string,
    chunks: Array<{ index: number; data: Buffer }>
  ): Promise<void> {
    return performanceMonitor.measure('upload:parallel', async () => {
      const batchSize = this.maxConcurrentUploads;
      
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await Promise.all(
          batch.map(chunk => this.uploadChunk(sessionId, chunk.index, chunk.data))
        );
      }
    });
  }

  /**
   * Resume interrupted upload
   */
  async resumeUpload(sessionId: string): Promise<{
    uploadedChunks: number[];
    missingChunks: number[];
    progress: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    const uploadedChunks = Array.from(session.uploadedChunks);
    const missingChunks: number[] = [];

    for (let i = 0; i < session.totalChunks; i++) {
      if (!session.uploadedChunks.has(i)) {
        missingChunks.push(i);
      }
    }

    const progress = (uploadedChunks.length / session.totalChunks) * 100;

    return { uploadedChunks, missingChunks, progress };
  }

  /**
   * Cancel upload session
   */
  async cancelUpload(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Cleanup chunks from memory
      session.chunks.clear();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Get upload statistics
   */
  getUploadStats(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const uploadedSize = Array.from(session.chunks.values())
      .reduce((sum, chunk) => sum + chunk.size, 0);

    const elapsedTime = Date.now() - session.startTime;
    const uploadSpeed = uploadedSize / (elapsedTime / 1000); // bytes per second

    return {
      fileName: session.fileName,
      fileSize: session.fileSize,
      uploadedSize,
      uploadedChunks: session.uploadedChunks.size,
      totalChunks: session.totalChunks,
      progress: (session.uploadedChunks.size / session.totalChunks) * 100,
      elapsedTime,
      uploadSpeed,
      estimatedTimeRemaining: ((session.fileSize - uploadedSize) / uploadSpeed) * 1000,
    };
  }

  /**
   * Private helper methods
   */
  private generateSessionId(): string {
    return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.sessionTimeout) {
        session.chunks.clear();
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const optimizedUploadHandler = new OptimizedUploadHandler();
