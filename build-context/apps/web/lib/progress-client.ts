/**
 * Progress Tracking Client Library
 * Provides easy integration with real-time progress tracking via WebSocket and SSE
 */

export interface ProgressUpdate {
  contractId: string;
  tenantId: string;
  stage: string;
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
  startedAt: Date;
  updatedAt: Date;
  completedStages: string[];
  errors?: ProcessingError[];
  metadata?: Record<string, any>;
}

export interface ProcessingError {
  stage: string;
  error: string;
  timestamp: Date;
  recoverable: boolean;
  retryCount?: number;
}

export interface ProgressClientOptions {
  apiUrl: string;
  tenantId: string;
  preferredTransport?: 'websocket' | 'sse' | 'polling';
  pollingInterval?: number; // milliseconds
  reconnectAttempts?: number;
  reconnectDelay?: number; // milliseconds
}

export interface ProgressEventHandlers {
  onProgress?: (progress: ProgressUpdate) => void;
  onError?: (error: ProcessingError) => void;
  onCompleted?: (progress: ProgressUpdate) => void;
  onFailed?: (progress: ProgressUpdate) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onReconnecting?: (attempt: number) => void;
}

export class ProgressClient {
  private options: Required<ProgressClientOptions>;
  private handlers: ProgressEventHandlers = {};
  private transport: 'websocket' | 'sse' | 'polling' | null = null;
  private connection: WebSocket | EventSource | null = null;
  private pollingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private subscriptions = new Set<string>();
  private isConnected = false;

  constructor(options: ProgressClientOptions) {
    this.options = {
      preferredTransport: 'websocket',
      pollingInterval: 2000,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      ...options
    };
  }

  /**
   * Set event handlers
   */
  on(handlers: ProgressEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Connect to progress tracking
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Try preferred transport first, then fallback
    const transports = this.getTransportPriority();
    
    for (const transport of transports) {
      try {
        await this.connectWithTransport(transport);
        this.transport = transport;
        this.isConnected = true;
        this.reconnectAttempt = 0;
        this.handlers.onConnected?.();
        return;
      } catch {
        // Transport failed, try next one
      }
    }
    
    throw new Error('Failed to connect with any transport method');
  }

  /**
   * Disconnect from progress tracking
   */
  disconnect(): void {
    this.isConnected = false;
    
    if (this.connection) {
      if (this.connection instanceof WebSocket) {
        this.connection.close();
      } else if (this.connection instanceof EventSource) {
        this.connection.close();
      }
      this.connection = null;
    }
    
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.handlers.onDisconnected?.();
  }

  /**
   * Subscribe to progress updates for a specific contract
   */
  subscribe(contractId: string): void {
    this.subscriptions.add(contractId);
    
    if (this.isConnected && this.transport === 'websocket' && this.connection instanceof WebSocket) {
      this.connection.send(JSON.stringify({
        type: 'subscribe',
        contractId
      }));
    }
  }

  /**
   * Unsubscribe from progress updates for a specific contract
   */
  unsubscribe(contractId: string): void {
    this.subscriptions.delete(contractId);
    
    if (this.isConnected && this.transport === 'websocket' && this.connection instanceof WebSocket) {
      this.connection.send(JSON.stringify({
        type: 'unsubscribe',
        contractId
      }));
    }
  }

  /**
   * Get current progress for a contract (REST API call)
   */
  async getProgress(contractId: string): Promise<ProgressUpdate | null> {
    try {
      const response = await fetch(`${this.options.apiUrl}/contracts/${contractId}/progress`, {
        headers: {
          'x-tenant-id': this.options.tenantId
        }
      });
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return this.parseProgressUpdate(data);
      
    } catch (error: unknown) {
      throw error;
    }
  }

  /**
   * Get progress for all contracts in the tenant
   */
  async getAllProgress(): Promise<ProgressUpdate[]> {
    try {
      const response = await fetch(`${this.options.apiUrl}/contracts/progress`, {
        headers: {
          'x-tenant-id': this.options.tenantId
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.contracts.map((contract: any) => this.parseProgressUpdate(contract));
      
    } catch (error: unknown) {
      throw error;
    }
  }

  /**
   * Get transport priority based on browser support and preferences
   */
  private getTransportPriority(): ('websocket' | 'sse' | 'polling')[] {
    const transports: ('websocket' | 'sse' | 'polling')[] = [];
    
    // Add preferred transport first
    transports.push(this.options.preferredTransport);
    
    // Add other supported transports as fallbacks
    if (typeof WebSocket !== 'undefined' && this.options.preferredTransport !== 'websocket') {
      transports.push('websocket');
    }
    
    if (typeof EventSource !== 'undefined' && this.options.preferredTransport !== 'sse') {
      transports.push('sse');
    }
    
    if (this.options.preferredTransport !== 'polling') {
      transports.push('polling');
    }
    
    return transports;
  }

  /**
   * Connect using specific transport
   */
  private async connectWithTransport(transport: 'websocket' | 'sse' | 'polling'): Promise<void> {
    switch (transport) {
      case 'websocket':
        return this.connectWebSocket();
      case 'sse':
        return this.connectSSE();
      case 'polling':
        return this.connectPolling();
      default:
        throw new Error(`Unsupported transport: ${transport}`);
    }
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.options.apiUrl.replace(/^http/, 'ws');
      const url = `${wsUrl}/ws/progress?tenantId=${this.options.tenantId}`;
      
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        this.connection = ws;
        
        // Subscribe to existing subscriptions
        this.subscriptions.forEach(contractId => {
          ws.send(JSON.stringify({
            type: 'subscribe',
            contractId
          }));
        });
        
        resolve();
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          // Failed to parse message, ignore
        }
      };
      
      ws.onclose = () => {
        this.handleDisconnection();
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(error);
      };
    });
  }

  /**
   * Connect via Server-Sent Events
   */
  private async connectSSE(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.options.apiUrl}/contracts/progress/stream?tenantId=${this.options.tenantId}`;
      
      const eventSource = new EventSource(url);
      
      const timeout = setTimeout(() => {
        eventSource.close();
        reject(new Error('SSE connection timeout'));
      }, 10000);
      
      eventSource.onopen = () => {
        clearTimeout(timeout);
        this.connection = eventSource;
        resolve();
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {
          // Failed to parse message, ignore
        }
      };
      
      eventSource.addEventListener('progress', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          this.handleMessage({ type: 'progress', ...data });
        } catch {
          // Failed to parse event, ignore
        }
      });
      
      eventSource.addEventListener('error', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          this.handleMessage({ type: 'error', ...data });
        } catch {
          // Failed to parse event, ignore
        }
      });
      
      eventSource.addEventListener('completed', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          this.handleMessage({ type: 'completed', ...data });
        } catch {
          // Failed to parse event, ignore
        }
      });
      
      eventSource.addEventListener('failed', (event) => {
        try {
          const messageEvent = event as MessageEvent;
          const data = JSON.parse(messageEvent.data);
          this.handleMessage({ type: 'failed', ...data });
        } catch {
          // Failed to parse event, ignore
        }
      });
      
      eventSource.onerror = () => {
        clearTimeout(timeout);
        this.handleDisconnection();
      };
    });
  }

  /**
   * Connect via polling
   */
  private async connectPolling(): Promise<void> {
    this.startPolling();
    return Promise.resolve();
  }

  /**
   * Start polling for progress updates
   */
  private startPolling(): void {
    const poll = async () => {
      try {
        if (this.subscriptions.size > 0) {
          // Poll specific contracts
          for (const contractId of this.subscriptions) {
            const progress = await this.getProgress(contractId);
            if (progress) {
              this.handlers.onProgress?.(progress);
              
              if (progress.stage === 'completed') {
                this.handlers.onCompleted?.(progress);
              } else if (progress.stage === 'failed') {
                this.handlers.onFailed?.(progress);
              }
            }
          }
        } else {
          // Poll all tenant progress
          const allProgress = await this.getAllProgress();
          allProgress.forEach(progress => {
            this.handlers.onProgress?.(progress);
          });
        }
      } catch {
        // Polling failed, will retry on next interval
      }
      
      if (this.isConnected) {
        this.pollingTimer = setTimeout(poll, this.options.pollingInterval);
      }
    };
    
    poll();
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'progress':
        if (message.data || message.progress) {
          const progress = this.parseProgressUpdate(message.data || message.progress);
          this.handlers.onProgress?.(progress);
        }
        break;
        
      case 'error':
        if (message.data || message.error) {
          const error = this.parseProcessingError(message.data || message.error);
          this.handlers.onError?.(error);
        }
        break;
        
      case 'completed':
        if (message.data || message.progress) {
          const progress = this.parseProgressUpdate(message.data || message.progress);
          this.handlers.onCompleted?.(progress);
        }
        break;
        
      case 'failed':
        if (message.data || message.progress) {
          const progress = this.parseProgressUpdate(message.data || message.progress);
          this.handlers.onFailed?.(progress);
        }
        break;
        
      case 'ping':
        // Respond to ping if WebSocket
        if (this.connection instanceof WebSocket) {
          this.connection.send(JSON.stringify({ type: 'pong' }));
        }
        break;
    }
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.connection = null;
    
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.handlers.onDisconnected?.();
    
    // Attempt reconnection
    if (this.reconnectAttempt < this.options.reconnectAttempts) {
      this.reconnectAttempt++;
      this.handlers.onReconnecting?.(this.reconnectAttempt);
      
      const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempt - 1);
      this.reconnectTimer = setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will try again if attempts remain
        });
      }, delay);
    }
  }

  /**
   * Parse progress update from API response
   */
  private parseProgressUpdate(data: any): ProgressUpdate {
    return {
      contractId: data.contractId,
      tenantId: data.tenantId,
      stage: data.stage,
      progress: data.progress,
      message: data.message,
      estimatedTimeRemaining: data.estimatedTimeRemaining,
      startedAt: new Date(data.startedAt),
      updatedAt: new Date(data.updatedAt),
      completedStages: data.completedStages || [],
      errors: data.errors?.map((error: any) => this.parseProcessingError(error)),
      metadata: data.metadata
    };
  }

  /**
   * Parse processing error from API response
   */
  private parseProcessingError(data: any): ProcessingError {
    return {
      stage: data.stage,
      error: data.error,
      timestamp: new Date(data.timestamp),
      recoverable: data.recoverable,
      retryCount: data.retryCount
    };
  }
}

/**
 * Create a progress client instance
 */
export function createProgressClient(options: ProgressClientOptions): ProgressClient {
  return new ProgressClient(options);
}