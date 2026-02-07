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
  // Storage keys for tracking state (simplified - no sessionStorage caching)
  const storageKey = `artifact-stream-${contractId}`;
  const completeKey = `artifact-complete-${contractId}`;
  
  // Don't use sessionStorage for notFound - it causes issues when contracts are temporarily unavailable
  const wasNotFound = false;
  
  // Don't restore from sessionStorage - it causes stale data issues
  const [artifacts, setArtifacts] = useState<ArtifactUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => wasNotFound ? 'Contract not found' : null);
  const [contractNotFound, setContractNotFound] = useState(wasNotFound);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const staleCheckIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const forceCompleteTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const streamStartTimeRef = useRef<number>(Date.now());
  const maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;

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
          // Call connect directly via ref pattern to avoid stale closure
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
          // Check artifacts at timeout time via ref check
          setIsComplete(true);
          
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
    // Skip establishing new connections after completion or if not found
    if (!enabled || !contractId || isComplete || contractNotFound) {
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
    
  }, [contractId, enabled, isComplete, contractNotFound, onComplete, onError, tenantId]);

  useEffect(() => {
    if (!enabled || !contractId) {
      return;
    }

    // Don't try to connect if contract was already marked as not found
    if (contractNotFound || wasNotFound) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;
    let verifyAttempts = 0;
    const MAX_VERIFY_ATTEMPTS = 5;
    const VERIFY_RETRY_DELAY = 2000; // 2 seconds between retries
    const INITIAL_DELAY = 1000; // Wait 1 second before first verification to allow DB commit

    const verifyAndConnect = async () => {
      verifyAttempts++;
      console.log(`[useArtifactStream] Verification attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS} for contract ${contractId} with tenant ${tenantId}`);
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
        console.log(`[useArtifactStream] Verification response status: ${response.status} for contract ${contractId}`);

        if (!response.ok) {
          // For 404, retry a few times before giving up (contract may not be committed yet)
          if (response.status === 404) {
            if (verifyAttempts < MAX_VERIFY_ATTEMPTS) {
              console.log(`[useArtifactStream] Contract ${contractId} not found (404), retry ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS} in ${VERIFY_RETRY_DELAY}ms`);
              // Retry after delay
              if (!cancelled) {
                setTimeout(() => {
                  if (!cancelled) verifyAndConnect();
                }, VERIFY_RETRY_DELAY);
              }
              return;
            }
            // Max retries reached - mark as not found (but don't persist in sessionStorage)
            console.warn(`[useArtifactStream] Contract ${contractId} not found after ${MAX_VERIFY_ATTEMPTS} retries - marking as not found`);
            // Don't persist in sessionStorage - just set local state
            setContractNotFound(true);
            setArtifacts([]);
            setIsComplete(false);
            const message = 'Contract not found - it may have been deleted.';
            setError(message);
            if (onError) {
              onError(message);
            }
            return; // Don't retry on 404
          }
          console.error(`[useArtifactStream] Non-404 error: ${response.status} for contract ${contractId}`);
          throw new Error('Unable to verify contract status.');
        }

        console.log(`[useArtifactStream] Contract ${contractId} verified successfully, connecting to SSE...`);
        
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

    // Add initial delay to allow database transaction to commit
    const initialDelayTimeout = setTimeout(() => {
      if (!cancelled) {
        verifyAndConnect();
      }
    }, INITIAL_DELAY);

    return () => {
      cancelled = true;
      clearTimeout(initialDelayTimeout);
      if (cleanup) cleanup();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    
  }, [contractId, enabled, tenantId, connect, onError, contractNotFound, wasNotFound]);

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
    contractNotFound,
    disconnect,
    reconnect: connect
  };
}
