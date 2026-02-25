import { useState, useEffect, useCallback, useRef } from 'react';

// Bulletproof constants
const MAX_RECONNECT_ATTEMPTS = 5;
const STALE_CONNECTION_TIMEOUT = 45000; // 45s without update = stale
const FORCE_COMPLETE_TIMEOUT = 300000; // 5 min max processing time (large docs can take 3-4 min)
const HEARTBEAT_EXPECTED_INTERVAL = 20000; // Heartbeat every 15s, allow 20s buffer

export interface ArtifactUpdate {
  id: string;
  type: string;
  status: string;
  hasContent: boolean;
  contentLength: number;
  qualityScore: number | null;
  completenessScore: number | null;
  confidence: number | null;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactTransition {
  artifactId: string;
  type: string;
  from: string;
  to: string;
}

export interface StreamMessage {
  type: 'connected' | 'update' | 'complete' | 'error' | 'heartbeat';
  contractId?: string;
  contractStatus?: string;
  processingStage?: string;
  progress?: number;
  completedCount?: number;
  totalCount?: number;
  transitions?: ArtifactTransition[];
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
  tenantId?: string; // Deprecated: server uses session tenant from middleware
  onComplete?: (artifacts: ArtifactUpdate[]) => void;
  onError?: (error: string) => void;
  enabled?: boolean;
}

export function useArtifactStream({
  contractId,
  tenantId: _tenantId, // Ignored — server uses session tenant from middleware
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
  const [progress, setProgress] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(() => wasNotFound ? 'Contract not found' : null);
  const [contractNotFound, setContractNotFound] = useState(wasNotFound);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const staleCheckIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const forceCompleteTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const streamStartTimeRef = useRef<number>(Date.now());
  const isCompleteRef = useRef(false);
  const contractNotFoundRef = useRef(false);
  // Stabilize callback refs to prevent useEffect/useCallback dependency churn.
  // Without this, inline arrow functions from the parent cause connect() to get
  // a new identity every render, which restarts the verification effect and
  // tears down the SSE connection in an infinite loop.
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const maxReconnectAttempts = MAX_RECONNECT_ATTEMPTS;

  // Keep callback refs in sync
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // Also mark complete if all received artifacts are done (fallback)
  // Don't hardcode a count — contract-type filtering may produce fewer than 10
  useEffect(() => {
    if (!isComplete && artifacts.length > 0) {
      const completedCount = artifacts.filter(a => a.status === 'COMPLETED').length;
      if (completedCount >= artifacts.length) {
        // All artifacts the server told us about are complete
        setIsComplete(true);
        isCompleteRef.current = true;
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
    // Read from refs to avoid depending on state that changes every render
    if (!enabled || !contractId || isCompleteRef.current || contractNotFoundRef.current) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Create EventSource connection — the middleware injects the session tenant via
    // x-tenant-id header automatically, so we don't pass tenantId in the URL
    // (localStorage tenantId can be stale/mismatched with the session).
    const url = `/api/contracts/${contractId}/artifacts/stream`;
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
        if (timeSinceLastUpdate > STALE_CONNECTION_TIMEOUT && !isCompleteRef.current) {
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
            }
            if (data.contractStatus) {
              setContractStatus(data.contractStatus);
            }
            if (data.processingStage) {
              setProcessingStage(data.processingStage);
            }
            if (typeof data.progress === 'number') {
              setProgress(data.progress);
            }
            if (typeof data.completedCount === 'number') {
              setCompletedCount(data.completedCount);
            }
            if (typeof data.totalCount === 'number') {
              setTotalCount(data.totalCount);
            }
            if (data.errorMessage) {
              setError(data.errorMessage);
            }
            break;

          case 'complete':
            setIsComplete(true);
            isCompleteRef.current = true;
            setIsConnected(false);
            // Use artifacts from message or current state
            const finalArtifacts = data.artifacts || artifacts;
            if (finalArtifacts.length > 0 && onCompleteRef.current) {
              onCompleteRef.current(finalArtifacts);
            }
            eventSource.close();
            break;

          case 'error':
            // Only set error if it's not recoverable
            if (!data.recoverable) {
              setError(data.error || 'Unknown error');
              if (onErrorRef.current) {
                onErrorRef.current(data.error || 'Unknown error');
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
      if (!isCompleteRef.current && reconnectAttemptsRef.current < maxReconnectAttempts) {
        const retryDelay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 10000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, retryDelay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        const message = 'Unable to connect to live updates. Please refresh the page to retry.';
        setError(message);
        setIsComplete(true);
        isCompleteRef.current = true;
        if (onErrorRef.current) {
          onErrorRef.current(message);
        }
      }
    };

    return () => {
      eventSource.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
    
  // Stable deps only — callbacks are accessed via refs to avoid infinite loop
  }, [contractId, enabled]);

  // Use a ref for connect so the verification effect doesn't restart when connect changes
  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);

  useEffect(() => {
    if (!enabled || !contractId) {
      return;
    }

    // Don't try to connect if contract was already marked as not found
    if (contractNotFoundRef.current || wasNotFound) {
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
      console.log(`[useArtifactStream] Verification attempt ${verifyAttempts}/${MAX_VERIFY_ATTEMPTS} for contract ${contractId}`);
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Don't manually set x-tenant-id — the middleware injects
        // the correct session tenant into the header automatically.
        const response = await fetch(`/api/contracts/${contractId}`, {
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
            contractNotFoundRef.current = true;
            setArtifacts([]);
            setIsComplete(false);
            isCompleteRef.current = false;
            const message = 'Contract not found - it may have been deleted.';
            setError(message);
            if (onErrorRef.current) {
              onErrorRef.current(message);
            }
            return; // Don't retry on 404
          }
          console.error(`[useArtifactStream] Non-404 error: ${response.status} for contract ${contractId}`);
          // Retry on 429 (rate limited) or 5xx server errors
          if ((response.status === 429 || response.status >= 500) && verifyAttempts < MAX_VERIFY_ATTEMPTS) {
            const retryDelay = response.status === 429 ? 3000 : VERIFY_RETRY_DELAY;
            console.log(`[useArtifactStream] Retrying verification in ${retryDelay}ms (status ${response.status})`);
            if (!cancelled) {
              setTimeout(() => {
                if (!cancelled) verifyAndConnect();
              }, retryDelay);
            }
            return;
          }
          throw new Error('Unable to verify contract status.');
        }

        console.log(`[useArtifactStream] Contract ${contractId} verified successfully, connecting to SSE...`);
        
        if (cancelled) {
          return;
        }

        cleanup = connectRef.current();
      } catch (err) {
        if (cancelled) return;
        
        // Handle abort errors gracefully
        if (err instanceof Error && err.name === 'AbortError') {
          // Try to connect directly without verification
          cleanup = connectRef.current();
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to connect to live updates.';
        setError(message);
        // Don't mark as complete on verification failure - allow retry
        setIsConnected(false);
        if (onErrorRef.current) {
          onErrorRef.current(message);
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
    
  // Only restart the entire verify+connect cycle when contractId or enabled changes.
  // Callbacks are accessed via refs to avoid triggering this effect on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, enabled]);

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
    progress,
    completedCount,
    totalCount,
    error,
    contractNotFound,
    disconnect,
    reconnect: connect
  };
}
