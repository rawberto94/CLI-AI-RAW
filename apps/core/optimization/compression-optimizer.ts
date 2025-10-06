/**
 * Compression Optimizer
 * Optimizes data transfer and storage through intelligent compression
 */

import { createGzip, createGunzip, createBrotliCompress, createBrotliDecompress } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Writable } from 'stream';
import { performanceMonitor } from '../performance/performance-monitor';

export type CompressionAlgorithm = 'gzip' | 'brotli' | 'none';

export interface CompressionOptions {
  algorithm?: CompressionAlgorithm;
  level?: number; // 1-9 for gzip, 0-11 for brotli
  threshold?: number; // Minimum size to compress (bytes)
}

export class CompressionOptimizer {
  private defaultOptions: CompressionOptions = {
    algorithm: 'gzip',
    level: 6, // Balanced compression
    threshold: 1024, // 1KB minimum
  };

  /**
   * Compress data with automatic algorithm selection
   */
  async compress(
    data: Buffer | string,
    options?: CompressionOptions
  ): Promise<{ compressed: Buffer; algorithm: CompressionAlgorithm; ratio: number }> {
    return performanceMonitor.measure('compression:compress', async () => {
      const opts = { ...this.defaultOptions, ...options };
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Skip compression for small data
      if (buffer.length < opts.threshold!) {
        return {
          compressed: buffer,
          algorithm: 'none',
          ratio: 1,
        };
      }

      // Choose best algorithm based on data type
      const algorithm = opts.algorithm || this.selectAlgorithm(buffer);
      
      let compressed: Buffer;
      
      if (algorithm === 'gzip') {
        compressed = await this.compressGzip(buffer, opts.level);
      } else if (algorithm === 'brotli') {
        compressed = await this.compressBrotli(buffer, opts.level);
      } else {
        compressed = buffer;
      }

      const ratio = buffer.length / compressed.length;

      // Use uncompressed if compression doesn't help
      if (ratio < 1.1) {
        return {
          compressed: buffer,
          algorithm: 'none',
          ratio: 1,
        };
      }

      return { compressed, algorithm, ratio };
    });
  }

  /**
   * Decompress data
   */
  async decompress(
    data: Buffer,
    algorithm: CompressionAlgorithm
  ): Promise<Buffer> {
    return performanceMonitor.measure('compression:decompress', async () => {
      if (algorithm === 'none') {
        return data;
      }

      if (algorithm === 'gzip') {
        return this.decompressGzip(data);
      }

      if (algorithm === 'brotli') {
        return this.decompressBrotli(data);
      }

      throw new Error(`Unknown compression algorithm: ${algorithm}`);
    });
  }

  /**
   * Compress stream
   */
  async compressStream(
    input: Readable,
    output: Writable,
    options?: CompressionOptions
  ): Promise<void> {
    const opts = { ...this.defaultOptions, ...options };
    const algorithm = opts.algorithm || 'gzip';

    if (algorithm === 'gzip') {
      const gzip = createGzip({ level: opts.level });
      await pipeline(input, gzip, output);
    } else if (algorithm === 'brotli') {
      const brotli = createBrotliCompress({
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: opts.level || 6,
        },
      });
      await pipeline(input, brotli, output);
    } else {
      await pipeline(input, output);
    }
  }

  /**
   * Decompress stream
   */
  async decompressStream(
    input: Readable,
    output: Writable,
    algorithm: CompressionAlgorithm
  ): Promise<void> {
    if (algorithm === 'none') {
      await pipeline(input, output);
      return;
    }

    if (algorithm === 'gzip') {
      const gunzip = createGunzip();
      await pipeline(input, gunzip, output);
    } else if (algorithm === 'brotli') {
      const brotli = createBrotliDecompress();
      await pipeline(input, brotli, output);
    }
  }

  /**
   * Batch compress multiple items
   */
  async compressBatch(
    items: Array<{ data: Buffer | string; key: string }>,
    options?: CompressionOptions
  ): Promise<Map<string, { compressed: Buffer; algorithm: CompressionAlgorithm; ratio: number }>> {
    const results = new Map();

    await Promise.all(
      items.map(async ({ data, key }) => {
        const result = await this.compress(data, options);
        results.set(key, result);
      })
    );

    return results;
  }

  /**
   * Select best compression algorithm based on data characteristics
   */
  private selectAlgorithm(data: Buffer): CompressionAlgorithm {
    // Sample first 1KB to determine data type
    const sample = data.slice(0, 1024);
    
    // Check if data is already compressed (low entropy)
    const entropy = this.calculateEntropy(sample);
    
    if (entropy > 7.5) {
      // High entropy - likely already compressed or encrypted
      return 'none';
    }

    // Check for text vs binary
    const isText = this.isLikelyText(sample);
    
    if (isText) {
      // Brotli is better for text
      return 'brotli';
    } else {
      // Gzip is faster for binary
      return 'gzip';
    }
  }

  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(data: Buffer): number {
    const frequencies = new Map<number, number>();
    
    for (const byte of data) {
      frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
    }

    let entropy = 0;
    const length = data.length;

    for (const count of frequencies.values()) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  /**
   * Check if data is likely text
   */
  private isLikelyText(data: Buffer): boolean {
    let textChars = 0;
    
    for (const byte of data) {
      // Check for printable ASCII and common whitespace
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textChars++;
      }
    }

    return textChars / data.length > 0.8;
  }

  /**
   * Gzip compression
   */
  private async compressGzip(data: Buffer, level?: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gzip = createGzip({ level: level || 6 });
      const chunks: Buffer[] = [];

      gzip.on('data', (chunk) => chunks.push(chunk));
      gzip.on('end', () => resolve(Buffer.concat(chunks)));
      gzip.on('error', reject);

      gzip.write(data);
      gzip.end();
    });
  }

  /**
   * Gzip decompression
   */
  private async decompressGzip(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const gunzip = createGunzip();
      const chunks: Buffer[] = [];

      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks)));
      gunzip.on('error', reject);

      gunzip.write(data);
      gunzip.end();
    });
  }

  /**
   * Brotli compression
   */
  private async compressBrotli(data: Buffer, level?: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const brotli = createBrotliCompress({
        params: {
          [require('zlib').constants.BROTLI_PARAM_QUALITY]: level || 6,
        },
      });
      const chunks: Buffer[] = [];

      brotli.on('data', (chunk) => chunks.push(chunk));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);

      brotli.write(data);
      brotli.end();
    });
  }

  /**
   * Brotli decompression
   */
  private async decompressBrotli(data: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const brotli = createBrotliDecompress();
      const chunks: Buffer[] = [];

      brotli.on('data', (chunk) => chunks.push(chunk));
      brotli.on('end', () => resolve(Buffer.concat(chunks)));
      brotli.on('error', reject);

      brotli.write(data);
      brotli.end();
    });
  }
}

export const compressionOptimizer = new CompressionOptimizer();
