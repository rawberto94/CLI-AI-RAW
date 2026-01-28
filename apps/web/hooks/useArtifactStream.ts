import { useState, useEffect, useCallback, useRef } from 'react';

// Bulletproof constants
const MAX_RECONNECT_ATTEMPTS = 5;
const STALE_CONNECTION_TIMEOUT = 45000; // 45s without update = stale
const FORCE_COMPLETE_TIMEOUT = 180000; // 3 min max processing time
const EXPECTED_ARTIFACT_COUNT = 10;
const HEARTBEAT_EXPECTED_INTERVAL = 20000; // Heartbeat every 15s, allow 20s buffer

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
  type: 'connected' | 'update' | 'complete' | 'error' | 'heartbeat';
  contractId?: string;
  contractStatus?: string;
  processingStage?: string;
  errorMessage?: string;
  artifacts?: ArtifactUpdate[];
  timestamp?: string;
  status?: string;
  artifactCount?: number;
  error?: string;
  recoverable?: boolean;
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
  const completeKey = `artifact-complete-${contractId}`;
  
  const [artifacts, setArtifacts] = useState<ArtifactUpdate[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(() => {
    if (typeof window !== 'undefined') {
      // Check if we've already marked this contract as complete
      const savedComplete = sessionStorage.getItem(completeKey);
      if (savedComplete === 'true') return true;
      
      // Also check if we have 10+ completed artifacts
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const artifacts = JSON.parse(saved);
        const completedCount = artifacts.filter((a: ArtifactUpdate) => a.status === 'COMPLETED').length;
        if (completedCount >= 10) return true;
      }
    }
    return false;
  });
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const staleCheckIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const forceCompleteTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const streamStartTimeRef = useRef<number>(Date.now());
  const maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;
  
  // Save artifacts to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && artifacts.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(artifacts));
    }
  }, [artifacts, storageKey]);

  // Save isComplete status to sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && isComplete) {
      sessionStorage.setItem(completeKey, 'true');
    }
  }, [isComplete, completeKey]);

  // Also mark complete if all artifacts are done (fallback)
  useEffect(() => {
    if (!isComplete && artifacts.length >= EXPECTED_ARTIFACT_COUNT) {
      const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
      if (completedCount >= EXPECTED_ARTIFACT_COUNT) {
        setIsComplete(true);
        // Clean up connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
    }
  }, [artifacts, isComplete]);

  // Visibility change handler - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isComplete && !isConnected) {
        // Check if we should reconnect
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > HEARTBEAT_EXPECTED_INTERVAL) {
          reconnectAttemptsRef.current = 0; // Reset attempts on visibility change
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isComplete, isConnected]);

  // Force complete after maximum processing time (safety net)
  useEffect(() => {
    if (!isComplete && enabled && contractId) {
      streamStartTimeRef.current = Date.now();
      
      forceCompleteTimeoutRef.current = setTimeout(() => {
        if (!isComplete) {
          const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
          if (completedCount > 0) {
            // We have some artifacts, consider it a success
            setIsComplete(true);
            setError(null);
          } else {
            // No artifacts at all - this is a real problem
            setError('Processing timeout - please try uploading again');
            setIsComplete(true);
          }
          
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
        }
      }, FORCE_COMPLETE_TIMEOUT);

      return () => {
        if (forceCompleteTimeoutRef.current) {
          clearTimeout(forceCompleteTimeoutRef.current);
        }
      };
    }
  }, [enabled, contractId, isComplete]);

  const connect = useCallback(() => {
    // Skip establishing new connections after completion
    if (!enabled || !contractId || isComplete) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create new EventSource connection with tenant ID in URL (EventSource can't send headers)
    const url = `/api/contracts/${contractId}/artifacts/stream?tenantId=${encodeURIComponent(tenantId)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0; // Reset on successful connection
      lastUpdateTimeRef.current = Date.now();
      
      // Start stale connection detection
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
      }
      staleCheckIntervalRef.current = setInterval(() => {
        const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
        if (timeSinceLastUpdate > STALE_CONNECTION_TIMEOUT && !isComplete) {
          eventSource.close();
          reconnectAttemptsRef.current++;
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            setTimeout(() => connect(), 1000);
          }
        }
      }, 10000); // Check every 10 seconds
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamMessage = JSON.parse(event.data);
        
        switch (data.type) {
          case 'connected':
            break;
            
          case 'heartbeat':
            // Heartbeat received - connection is alive
            lastUpdateTimeRef.current = Date.now();
            reconnectAttemptsRef.current = 0;
            break;

          case 'update':
            // Batch state updates to reduce re-renders
            lastUpdateTimeRef.current = Date.now();
            if (data.artifacts) {
              setArtifacts(data.artifacts);
              // Auto-complete if all artifacts are done (immediate detection)
              const completed = data.artifacts.filter((a: ArtifactUpdate) => a.status === 'COMPLETED').length;
              if (completed >= EXPECTED_ARTIFACT_COUNT) {
                setIsComplete(true);
                eventSource.close();
                if (onComplete) onComplete(data.artifacts);
                return;
              }
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
            // Only set error if it's not recoverable
            if (!data.recoverable) {
              setError(data.error || 'Unknown error');
              if (onError) {
                onError(data.error || 'Unknown error');
              }
              eventSource.close();
            }
            break;
        }
      } catch {
        // Failed to parse SSE message
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      
      // Don't reconnect if already complete or if connection was explicitly closed
      if (eventSource.readyState === EventSource.CLOSED) {
        return;
      }
      
      eventSource.close();
      
      // Increment reconnection attempts
      reconnectAttemptsRef.current++;

      // Auto-retry connection with exponential backoff if not complete
      if (!isComplete && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const retryDelay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, retryDelay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        const message = 'Unable to connect to live updates. Please refresh the page to retry.';
        setError(message);
        setIsComplete(true);
        if (onError) {
          onError(message);
        }
      }
    };

    return () => {
      eventSource.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [contractId, enabled, isComplete, onComplete, onError, tenantId]);

  useEffect(() => {
    if (!enabled || !contractId) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const verifyAndConnect = async () => {
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`/api/contracts/${contractId}`, {
          headers: {
            'x-tenant-id': tenantId
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const message = response.status === 404
            ? 'Contract not found or no longer available.'
            : 'Unable to verify contract status.';
          throw new Error(message);
        }

        if (cancelled) {
          return;
        }

        cleanup = connect();
      } catch (err) {
        if (cancelled) return;
        
        // Handle abort errors gracefully
        if (err instanceof Error && err.name === 'AbortError') {
          // Try to connect directly without verification
          cleanup = connect();
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to connect to live updates.';
        setError(message);
        // Don't mark as complete on verification failure - allow retry
        setIsConnected(false);
        if (onError) {
          onError(message);
        }
      }
    };

    verifyAndConnect();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [contractId, enabled, tenantId, connect, onError]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (staleCheckIntervalRef.current) {
      clearInterval(staleCheckIntervalRef.current);
    }
    if (forceCompleteTimeoutRef.current) {
      clearTimeout(forceCompleteTimeoutRef.current);
    }
    setIsConnected(false);
  }, []);

  // Cleanup all intervals/timeouts on unmount
  useEffect(() => {
    return () => {
      if (staleCheckIntervalRef.current) {
        clearInterval(staleCheckIntervalRef.current);
      }
      if (forceCompleteTimeoutRef.current) {
        clearTimeout(forceCompleteTimeoutRef.current);
      }
    };
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
