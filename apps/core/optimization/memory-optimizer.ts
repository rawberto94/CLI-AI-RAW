/**
 * Memory Optimizer
 * Reduces memory usage through streaming, pooling, and garbage collection optimization
 */

import { Transform } from 'stream';

/**
 * Object Pool for reusing objects
 */
export class ObjectPool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    options: { initialSize?: number; maxSize?: number } = {}
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = options.maxSize || 100;

    // Pre-create initial objects
    const initialSize = options.initialSize || 10;
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  /**
   * Acquire object from pool
   */
  acquire(): T {
    let obj = this.available.pop();
    
    if (!obj) {
      obj = this.factory();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release object back to pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      return;
    }

    this.inUse.delete(obj);
    this.reset(obj);

    // Only keep up to maxSize objects
    if (this.available.length < this.maxSize) {
      this.available.push(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      total: this.available.length + this.inUse.size,
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.available = [];
    this.inUse.clear();
  }
}

/**
 * Streaming JSON Parser for large files
 */
export class StreamingJSONParser extends Transform {
  private buffer = '';
  private depth = 0;
  private inString = false;
  private escape = false;

  constructor() {
    super({ objectMode: true });
  }

  override _transform(chunk: Buffer, _encoding: string, callback: Function): void {
    this.buffer += chunk.toString();
    
    try {
      this.parseBuffer();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  private parseBuffer(): void {
    let startIndex = 0;

    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];

      if (this.escape) {
        this.escape = false;
        continue;
      }

      if (char === '\\') {
        this.escape = true;
        continue;
      }

      if (char === '"') {
        this.inString = !this.inString;
        continue;
      }

      if (this.inString) {
        continue;
      }

      if (char === '{' || char === '[') {
        if (this.depth === 0) {
          startIndex = i;
        }
        this.depth++;
      } else if (char === '}' || char === ']') {
        this.depth--;
        
        if (this.depth === 0) {
          const jsonStr = this.buffer.substring(startIndex, i + 1);
          try {
            const obj = JSON.parse(jsonStr);
            this.push(obj);
          } catch (error) {
            // Skip invalid JSON
          }
        }
      }
    }

    // Keep unparsed data in buffer
    if (this.depth === 0) {
      this.buffer = '';
    }
  }
}

/**
 * Memory-efficient data processor
 */
export class MemoryEfficientProcessor {
  /**
   * Process large array without loading all into memory
   */
  async *processLargeArray<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    chunkSize: number = 1000
  ): AsyncGenerator<R[], void, unknown> {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const results = await Promise.all(chunk.map(processor));
      yield results;
      
      // Allow garbage collection
      if (global.gc) {
        global.gc();
      }
    }
  }

  /**
   * Stream process file line by line
   */
  async processFileByLine(
    filePath: string,
    processor: (line: string, lineNumber: number) => Promise<void>
  ): Promise<void> {
    const { createReadStream } = await import('fs');
    const { createInterface } = await import('readline');

    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;
    for await (const line of rl) {
      await processor(line, lineNumber++);
    }
  }

  /**
   * Process large JSON file in streaming fashion
   */
  async processLargeJSON<T>(
    filePath: string,
    processor: (obj: T) => Promise<void>
  ): Promise<void> {
    const { createReadStream } = await import('fs');
    
    const fileStream = createReadStream(filePath);
    const jsonParser = new StreamingJSONParser();

    return new Promise((resolve, reject) => {
      fileStream
        .pipe(jsonParser)
        .on('data', async (obj: T) => {
          try {
            await processor(obj);
          } catch (error) {
            reject(error);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  /**
   * Batch process with memory limits
   */
  async processWithMemoryLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    memoryLimitMB: number = 100
  ): Promise<R[]> {
    const results: R[] = [];
    let currentBatch: T[] = [];
    const bytesPerMB = 1024 * 1024;

    for (const item of items) {
      currentBatch.push(item);

      // Check memory usage
      const memUsage = process.memoryUsage().heapUsed / bytesPerMB;
      
      if (memUsage > memoryLimitMB || currentBatch.length >= 1000) {
        // Process current batch
        const batchResults = await Promise.all(
          currentBatch.map(processor)
        );
        results.push(...batchResults);
        
        // Clear batch and force GC
        currentBatch = [];
        if (global.gc) {
          global.gc();
        }
      }
    }

    // Process remaining items
    if (currentBatch.length > 0) {
      const batchResults = await Promise.all(
        currentBatch.map(processor)
      );
      results.push(...batchResults);
    }

    return results;
  }
}

/**
 * Simple cache for automatic memory management
 */
export class SimpleCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(options: { maxSize?: number; ttl?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 60000; // 1 minute default
  }

  set(key: K, value: V): void {
    // Cleanup old entries if at max size
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value as K;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: K): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryOptimizer = new MemoryEfficientProcessor();
