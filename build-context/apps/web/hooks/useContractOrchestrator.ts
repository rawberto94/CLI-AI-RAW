'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface OrchestratorProgress {
  contractId: string;
  tenantId: string;
  status: 'idle' | 'planning' | 'running' | 'completed' | 'failed';
  iteration: number;
  maxIterations: number;
  plan: {
    metadataExtraction?: boolean;
    categorization?: boolean;
    ragIndexing?: boolean;
  } | null;
  steps: Record<string, {
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    progress: number;
    error?: string;
  }>;
  agent: {
    lastTickAt: string;
    done: boolean;
    lastDecision: {
      decidedAt: string;
      proposals: Array<{
        agent: string;
        tool: string;
        reason: string;
        priority: number;
      }>;
      enqueued: Array<{
        queue: string;
        name: string;
        jobId?: string | null;
      }>;
      done: boolean;
    };
  } | null;
  artifacts: {
    total: number;
    completed: number;
    required: string[];
    missing: string[];
  };
  lastUpdated: string;
}

export interface ArtifactSuggestion {
  type: string;
  relevance: 'required' | 'optional';
  reason: string;
  canGenerate: boolean;
}

interface UseContractOrchestratorOptions {
  contractId: string;
  tenantId: string;
  enabled?: boolean;
  pollInterval?: number;
}

export function useContractOrchestrator({
  contractId,
  tenantId,
  enabled = true,
  pollInterval = 2000,
}: UseContractOrchestratorOptions) {
  const [progress, setProgress] = useState<OrchestratorProgress | null>(null);
  const [suggestions, setSuggestions] = useState<ArtifactSuggestion[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch current orchestrator state
  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/orchestrator/progress?tenantId=${tenantId}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch orchestrator progress');
      }
      
      const data = await response.json();
      setProgress(data.progress);
      setSuggestions(data.suggestions || []);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [contractId, tenantId]);

  // Connect to real-time updates via SSE
  const connectSSE = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    const url = `/api/contracts/${contractId}/orchestrator/stream?tenantId=${tenantId}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress') {
          setProgress(data.progress);
          setSuggestions(data.suggestions || []);
        } else if (data.type === 'complete') {
          setProgress(data.progress);
          // Close connection when done
          setTimeout(() => {
            eventSource.close();
            setIsConnected(false);
          }, 1000);
        }
      } catch {
        // Failed to parse SSE message
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      eventSource.close();
      
      // Fallback to polling
      if (enabled) {
        pollTimerRef.current = setInterval(fetchProgress, pollInterval);
      }
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [contractId, tenantId, enabled, fetchProgress, pollInterval]);

  // Trigger artifact generation for a specific type
  const generateArtifact = useCallback(async (artifactType: string) => {
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/orchestrator/generate-artifact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            artifactType,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger artifact generation');
      }

      const data = await response.json();
      return data;
    } catch (err: unknown) {
      throw err;
    }
  }, [contractId, tenantId]);

  // Trigger orchestrator manually
  const triggerOrchestrator = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/contracts/${contractId}/orchestrator/trigger`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to trigger orchestrator');
      }

      const data = await response.json();
      return data;
    } catch (err: unknown) {
      throw err;
    }
  }, [contractId, tenantId]);

  // Initialize connection
  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchProgress();

    // Try SSE first
    const cleanup = connectSSE();

    return () => {
      cleanup?.();
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, fetchProgress, connectSSE]);

  return {
    progress,
    suggestions,
    isConnected,
    error,
    generateArtifact,
    triggerOrchestrator,
    refresh: fetchProgress,
  };
}
