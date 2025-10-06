/**
 * Async File Operations Optimizer
 * Replaces synchronous file operations with async alternatives for better performance
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export class AsyncFileOperations {
  private fileCache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5000; // 5 seconds

  /**
   * Check if file exists (async)
   */
  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Read file with caching
   */
  async readFile(path: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    // Check cache
    const cached = this.fileCache.get(path);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // Read file
    const data = await fs.readFile(path, encoding);
    
    // Cache result
    this.fileCache.set(path, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }

  /**
   * Write file with atomic operation
   */
  async writeFile(path: string, data: string | Buffer): Promise<void> {
    const tempPath = `${path}.tmp`;
    
    try {
      // Write to temp file first
      await fs.writeFile(tempPath, data);
      
      // Atomic rename
      await fs.rename(tempPath, path);
      
      // Invalidate cache
      this.fileCache.delete(path);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Batch read multiple files
   */
  async readFiles(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    // Read in parallel
    const promises = paths.map(async (path) => {
      try {
        const data = await this.readFile(path);
        results.set(path, data);
      } catch (error) {
        // Skip files that don't exist or can't be read
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Batch write multiple files
   */
  async writeFiles(files: Map<string, string | Buffer>): Promise<void> {
    const promises = Array.from(files.entries()).map(([path, data]) =>
      this.writeFile(path, data)
    );

    await Promise.all(promises);
  }

  /**
   * Clear file cache
   */
  clearCache(): void {
    this.fileCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.fileCache.size,
      entries: Array.from(this.fileCache.keys()),
    };
  }
}

export const asyncFileOps = new AsyncFileOperations();
