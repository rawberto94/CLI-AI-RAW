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
  const [artifacts, setArtifacts] = useState<ArtifactUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    if (!enabled || !contractId) return;

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
            if (data.artifacts && onComplete) {
              onComplete(data.artifacts);
            }
            eventSource.close();
            break;

          case 'error':
            console.error('[SSE] Stream error:', data.error);
            setError(data.error || 'Unknown error');
            if (onError) {
              onError(data.error || 'Unknown error');
            }
            break;
        }
      } catch (err) {
        console.error('[SSE] Failed to parse message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      setIsConnected(false);
      eventSource.close();

      // Retry connection after 2 seconds if not complete
      if (!isComplete) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[SSE] Reconnecting...');
          connect();
        }, 2000);
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
