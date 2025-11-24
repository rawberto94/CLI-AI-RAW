import { useState, useEffect, useCallback, useRef } from 'react';

export interface ArtifactUpdate {
  id: string;
  type: string;
  status: string;
  hasContent: boolean;
  contentLength: number;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface StreamMessage {
  type: 'connected' | 'update' | 'complete' | 'error';
  contractId?: string;
  contractStatus?: string;
  processingStage?: string;
  errorMessage?: string;
  artifacts?: ArtifactUpdate[];
  timestamp?: string;
  status?: string;
  artifactCount?: number;
  error?: string;
}

export interface UseArtifactStreamOptions {
  contractId: string;
  tenantId?: string;
  onComplete?: (artifacts: ArtifactUpdate[]) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export function useArtifactStream({
  contractId,
  tenantId = 'demo',
  onComplete,
  onError,
  enabled = true
}: UseArtifactStreamOptions) {
  // Persist state in sessionStorage to survive page refreshes
  const storageKey = `artifact-stream-${contractId}`;
  
  const [artifacts, setArtifacts] = useState<ArtifactUpdate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Save artifacts to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && artifacts.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(artifacts));
    }
  }, [artifacts, storageKey]);

  const connect = useCallback(() => {
    // Skip establishing new connections after completion
    if (!enabled || !contractId || isComplete) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource connection
    const url = `/api/contracts/${contractId}/artifacts/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected to artifact stream');
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            console.log('[SSE] Stream connected:', data.contractId);
            break;

          case 'update':
            // Batch state updates to reduce re-renders
            if (data.artifacts) {
              setArtifacts(data.artifacts);
            }
            if (data.contractStatus) {
              setContractStatus(data.contractStatus);
            }
            if (data.processingStage) {
              setProcessingStage(data.processingStage);
            }
            if (data.errorMessage) {
              setError(data.errorMessage);
            }
            break;

          case 'complete':
            console.log('[SSE] Stream complete:', data);
            setIsComplete(true);
            setIsConnected(false);
            // Use artifacts from message or current state
            const finalArtifacts = data.artifacts || artifacts;
            if (finalArtifacts.length > 0 && onComplete) {
              onComplete(finalArtifacts);
            }
            eventSource.close();
            break;

          case 'error':
            console.error('[SSE] Stream error:', data.error);
            // Only set error if it's not recoverable
            if (!data.recoverable) {
              setError(data.error || 'Unknown error');
              if (onError) {
                onError(data.error || 'Unknown error');
              }
              eventSource.close();
            } else {
              console.log('[SSE] Recoverable error, continuing...');
            }
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    };

    eventSource.onerror = (err) => {
      // EventSource errors typically don't have useful info, only log state
      console.log('[SSE] Connection state:', eventSource.readyState);
      setIsConnected(false);
      
      // Don't reconnect if already complete or if connection was explicitly closed
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[SSE] Connection closed by server');
        return;
      }
      
      eventSource.close();

      // Auto-retry connection with exponential backoff if not complete
      if (!isComplete) {
        const retryDelay = Math.min(2000 * Math.pow(1.5, (reconnectTimeoutRef.current ? 1 : 0)), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Auto-reconnecting...');
          connect();
        }, retryDelay);
      }
    };

    return () => {
      eventSource.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [contractId, enabled, isComplete, onComplete, onError]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  return {
    artifacts,
    isConnected,
    isComplete,
    contractStatus,
    processingStage,
    error,
    disconnect,
    reconnect: connect
  };
}
