"use client";

/**
 * Offline Support Queue for AI Requests
 * 
 * Queues AI requests when offline and syncs when connection is restored.
 * Provides resilient AI functionality even with intermittent connectivity.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface QueuedRequest {
  id: string;
  type: 'chat' | 'analysis' | 'suggestion' | 'batch';
  payload: unknown;
  priority: 'low' | 'normal' | 'high';
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: unknown;
}

export interface OfflineQueueConfig {
  maxQueueSize: number;
  maxRetries: number;
  retryDelay: number; // ms
  storageKey: string;
  onSync?: (results: SyncResult) => void;
  onQueueChange?: (queue: QueuedRequest[]) => void;
}

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

const DEFAULT_CONFIG: OfflineQueueConfig = {
  maxQueueSize: 50,
  maxRetries: 3,
  retryDelay: 5000,
  storageKey: 'ai-offline-queue',
};

/**
 * Offline Queue Service
 * Manages AI request queue for offline support
 */
class OfflineQueueService {
  private static instance: OfflineQueueService;
  private queue: QueuedRequest[] = [];
  private config: OfflineQueueConfig;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncTimeout: NodeJS.Timeout | null = null;
  private listeners: Set<(queue: QueuedRequest[]) => void> = new Set();

  private constructor(config: Partial<OfflineQueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFromStorage();
    this.setupNetworkListeners();
  }

  public static getInstance(config?: Partial<OfflineQueueConfig>): OfflineQueueService {
    if (!OfflineQueueService.instance) {
      OfflineQueueService.instance = new OfflineQueueService(config);
    }
    return OfflineQueueService.instance;
  }

  /**
   * Setup network status listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    this.isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      console.log('[OfflineQueue] Network online');
      this.isOnline = true;
      this.scheduleSync();
    });

    window.addEventListener('offline', () => {
      console.log('[OfflineQueue] Network offline');
      this.isOnline = false;
    });
  }

  /**
   * Load queue from localStorage
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.queue = parsed.filter((r: QueuedRequest) => 
          r.status === 'pending' || r.status === 'processing'
        );
        console.log(`[OfflineQueue] Loaded ${this.queue.length} pending requests`);
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to load from storage:', error);
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OfflineQueue] Failed to save to storage:', error);
    }
  }

  /**
   * Notify listeners of queue changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener([...this.queue]);
    }
    this.config.onQueueChange?.([...this.queue]);
  }

  /**
   * Add a request to the queue
   */
  enqueue(
    type: QueuedRequest['type'],
    payload: unknown,
    priority: QueuedRequest['priority'] = 'normal'
  ): QueuedRequest {
    // Check queue size limit
    if (this.queue.length >= this.config.maxQueueSize) {
      // Remove oldest low-priority items
      const lowPriorityIndex = this.queue.findIndex((r) => r.priority === 'low');
      if (lowPriorityIndex !== -1) {
        this.queue.splice(lowPriorityIndex, 1);
      } else {
        throw new Error('Queue is full');
      }
    }

    const request: QueuedRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type,
      payload,
      priority,
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      status: 'pending',
    };

    // Insert based on priority
    if (priority === 'high') {
      this.queue.unshift(request);
    } else {
      this.queue.push(request);
    }

    this.saveToStorage();
    this.notifyListeners();

    console.log(`[OfflineQueue] Enqueued request: ${request.id} (${type})`);

    // Try to process immediately if online
    if (this.isOnline) {
      this.scheduleSync();
    }

    return request;
  }

  /**
   * Remove a request from the queue
   */
  dequeue(requestId: string): boolean {
    const index = this.queue.findIndex((r) => r.id === requestId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    this.saveToStorage();
    this.notifyListeners();

    return true;
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedRequest[] {
    return [...this.queue];
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    failed: number;
    byType: Record<string, number>;
  } {
    const stats = {
      total: this.queue.length,
      pending: 0,
      processing: 0,
      failed: 0,
      byType: {} as Record<string, number>,
    };

    for (const request of this.queue) {
      if (request.status === 'pending') stats.pending++;
      if (request.status === 'processing') stats.processing++;
      if (request.status === 'failed') stats.failed++;
      stats.byType[request.type] = (stats.byType[request.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Schedule sync with debouncing
   */
  private scheduleSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => {
      this.sync();
    }, 1000);
  }

  /**
   * Sync all pending requests
   */
  async sync(): Promise<SyncResult> {
    if (this.isSyncing || !this.isOnline) {
      return { total: 0, succeeded: 0, failed: 0, errors: [] };
    }

    this.isSyncing = true;
    console.log('[OfflineQueue] Starting sync...');

    const result: SyncResult = {
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    const pendingRequests = this.queue.filter((r) => r.status === 'pending');
    result.total = pendingRequests.length;

    for (const request of pendingRequests) {
      try {
        request.status = 'processing';
        this.notifyListeners();

        const response = await this.processRequest(request);
        
        request.status = 'completed';
        request.result = response;
        result.succeeded++;

        // Remove completed request from queue
        this.dequeue(request.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        request.retryCount++;
        
        if (request.retryCount >= request.maxRetries) {
          request.status = 'failed';
          request.error = errorMessage;
          result.failed++;
          result.errors.push({ id: request.id, error: errorMessage });
        } else {
          request.status = 'pending';
          console.log(`[OfflineQueue] Retry ${request.retryCount}/${request.maxRetries} for ${request.id}`);
        }
      }
    }

    this.saveToStorage();
    this.notifyListeners();
    this.isSyncing = false;

    console.log(`[OfflineQueue] Sync complete: ${result.succeeded} succeeded, ${result.failed} failed`);

    this.config.onSync?.(result);

    // Schedule retry for failed requests
    if (result.failed > 0 && this.queue.some((r) => r.status === 'pending')) {
      setTimeout(() => this.sync(), this.config.retryDelay);
    }

    return result;
  }

  /**
   * Process a single request
   */
  private async processRequest(request: QueuedRequest): Promise<unknown> {
    const endpoints: Record<QueuedRequest['type'], string> = {
      chat: '/api/ai/chat',
      analysis: '/api/ai/analyze',
      suggestion: '/api/ai/suggest',
      batch: '/api/ai/batch',
    };

    const endpoint = endpoints[request.type];
    if (!endpoint) {
      throw new Error(`Unknown request type: ${request.type}`);
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Request failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: QueuedRequest[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all requests
   */
  clear(): void {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Check if online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

// Export singleton instance
export const offlineQueue = OfflineQueueService.getInstance();

/**
 * React Hook for Offline Queue
 */
export function useOfflineQueue() {
  const [queue, setQueue] = useState<QueuedRequest[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const serviceRef = useRef(offlineQueue);

  useEffect(() => {
    // Subscribe to queue changes
    const unsubscribe = serviceRef.current.subscribe(setQueue);

    // Track online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Initial load
    setQueue(serviceRef.current.getQueue());

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  const enqueue = useCallback(
    (
      type: QueuedRequest['type'],
      payload: unknown,
      priority?: QueuedRequest['priority']
    ) => {
      return serviceRef.current.enqueue(type, payload, priority);
    },
    []
  );

  const sync = useCallback(async () => {
    setIsSyncing(true);
    try {
      return await serviceRef.current.sync();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const clear = useCallback(() => {
    serviceRef.current.clear();
  }, []);

  const remove = useCallback((id: string) => {
    return serviceRef.current.dequeue(id);
  }, []);

  return {
    queue,
    isOnline,
    isSyncing,
    stats: serviceRef.current.getStats(),
    enqueue,
    sync,
    clear,
    remove,
    pendingCount: queue.filter((r) => r.status === 'pending').length,
    hasQueuedRequests: queue.length > 0,
  };
}

/**
 * Offline-aware fetch wrapper
 */
export async function offlineFetch<T>(
  type: QueuedRequest['type'],
  payload: unknown,
  options?: {
    priority?: QueuedRequest['priority'];
    skipQueue?: boolean;
  }
): Promise<T | QueuedRequest> {
  const service = offlineQueue;

  // If online and skipQueue is true, make direct request
  if (service.getOnlineStatus() && options?.skipQueue) {
    const endpoints: Record<QueuedRequest['type'], string> = {
      chat: '/api/ai/chat',
      analysis: '/api/ai/analyze',
      suggestion: '/api/ai/suggest',
      batch: '/api/ai/batch',
    };

    const response = await fetch(endpoints[type], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Queue the request
  return service.enqueue(type, payload, options?.priority);
}

export default offlineQueue;
