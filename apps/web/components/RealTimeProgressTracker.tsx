/**
 * Real-Time Progress Tracker Component
 * Displays real-time progress updates for contract processing
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createProgressClient, ProgressClient, ProgressUpdate, ProcessingError } from '../lib/progress-client';

interface RealTimeProgressTrackerProps {
  contractId?: string;
  tenantId: string;
  apiUrl?: string;
  onCompleted?: (progress: ProgressUpdate) => void;
  onFailed?: (progress: ProgressUpdate) => void;
  className?: string;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  transport?: 'websocket' | 'sse' | 'polling';
  reconnectAttempt?: number;
}

export const RealTimeProgressTracker: React.FC<RealTimeProgressTrackerProps> = ({
  contractId,
  tenantId,
  apiUrl = '/api',
  onCompleted,
  onFailed,
  className = ''
}) => {
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({ status: 'disconnected' });
  const [client, setClient] = useState<ProgressClient | null>(null);

  // Initialize progress client
  useEffect(() => {
    const progressClient = createProgressClient({
      apiUrl,
      tenantId,
      preferredTransport: 'websocket'
    });

    progressClient.on({
      onProgress: (update) => {
        setProgress(update);
      },
      onError: (error) => {
        setErrors(prev => [...prev, error]);
      },
      onCompleted: (update) => {
        setProgress(update);
        onCompleted?.(update);
      },
      onFailed: (update) => {
        setProgress(update);
        onFailed?.(update);
      },
      onConnected: () => {
        setConnection(prev => ({ ...prev, status: 'connected' }));
      },
      onDisconnected: () => {
        setConnection(prev => ({ ...prev, status: 'disconnected' }));
      },
      onReconnecting: (attempt) => {
        setConnection(prev => ({ 
          ...prev, 
          status: 'reconnecting', 
          reconnectAttempt: attempt 
        }));
      }
    });

    setClient(progressClient);

    return () => {
      progressClient.disconnect();
    };
  }, [apiUrl, tenantId, onCompleted, onFailed]);

  // Connect and subscribe
  useEffect(() => {
    if (!client) return;

    const connect = async () => {
      try {
        setConnection(prev => ({ ...prev, status: 'connecting' }));
        await client.connect();
        
        if (contractId) {
          client.subscribe(contractId);
        }
      } catch (error) {
        console.error('Failed to connect to progress tracking:', error);
        setConnection(prev => ({ ...prev, status: 'disconnected' }));
      }
    };

    connect();
  }, [client, contractId]);

  // Subscribe to new contract when contractId changes
  useEffect(() => {
    if (!client || !contractId) return;

    client.subscribe(contractId);

    return () => {
      client.unsubscribe(contractId);
    };
  }, [client, contractId]);

  const getProgressPercentage = useCallback(() => {
    return progress?.progress || 0;
  }, [progress]);

  const getStageDisplayName = useCallback((stage: string) => {
    const stageNames: Record<string, string> = {
      upload_validation: 'Upload Validation',
      file_extraction: 'File Extraction',
      content_analysis: 'Content Analysis',
      template_analysis: 'Template Analysis',
      financial_analysis: 'Financial Analysis',
      enhanced_overview: 'Enhanced Overview',
      clauses_analysis: 'Clauses Analysis',
      rates_analysis: 'Rates Analysis',
      risk_assessment: 'Risk Assessment',
      compliance_check: 'Compliance Check',
      benchmark_analysis: 'Benchmark Analysis',
      artifact_generation: 'Artifact Generation',
      indexation: 'Indexation',
      completed: 'Completed',
      failed: 'Failed'
    };
    return stageNames[stage] || stage;
  }, []);

  const formatTimeRemaining = useCallback((seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Unknown';
    
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      return `${Math.round(seconds / 3600)}h`;
    }
  }, []);

  const getConnectionStatusColor = useCallback(() => {
    switch (connection.status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'reconnecting': return 'text-orange-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }, [connection.status]);

  const getConnectionStatusIcon = useCallback(() => {
    switch (connection.status) {
      case 'connected': return '🟢';
      case 'connecting': return '🟡';
      case 'reconnecting': return '🟠';
      case 'disconnected': return '🔴';
      default: return '⚪';
    }
  }, [connection.status]);

  if (!progress && connection.status === 'disconnected') {
    return (
      <div className={`p-4 border rounded-lg bg-gray-50 ${className}`}>
        <div className="text-center text-gray-600">
          <div className="mb-2">📡</div>
          <div>Connecting to progress tracking...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 border rounded-lg bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Processing Progress
        </h3>
        <div className={`flex items-center text-sm ${getConnectionStatusColor()}`}>
          <span className="mr-1">{getConnectionStatusIcon()}</span>
          <span className="capitalize">{connection.status}</span>
          {connection.reconnectAttempt && (
            <span className="ml-1">({connection.reconnectAttempt})</span>
          )}
        </div>
      </div>

      {progress && (
        <>
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{getStageDisplayName(progress.stage)}</span>
              <span>{getProgressPercentage()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progress.stage === 'completed' 
                    ? 'bg-green-500' 
                    : progress.stage === 'failed'
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>

          {/* Current Status */}
          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-1">Current Status:</div>
            <div className="text-gray-900">{progress.message}</div>
          </div>

          {/* Time Remaining */}
          {progress.estimatedTimeRemaining !== undefined && progress.estimatedTimeRemaining > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">Estimated Time Remaining:</div>
              <div className="text-gray-900">{formatTimeRemaining(progress.estimatedTimeRemaining)}</div>
            </div>
          )}

          {/* Completed Stages */}
          {progress.completedStages.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Completed Stages:</div>
              <div className="flex flex-wrap gap-2">
                {progress.completedStages.map((stage, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full"
                  >
                    ✓ {getStageDisplayName(stage)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Processing Errors:</div>
              <div className="space-y-2">
                {errors.map((error, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-sm ${
                      error.recoverable 
                        ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                  >
                    <div className="font-medium">
                      {error.recoverable ? '⚠️' : '❌'} {getStageDisplayName(error.stage)}
                    </div>
                    <div className="mt-1">{error.error}</div>
                    {error.retryCount && error.retryCount > 0 && (
                      <div className="text-xs mt-1">
                        Retry attempt: {error.retryCount}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-500 border-t pt-3">
            <div>Started: {progress.startedAt.toLocaleString()}</div>
            <div>Last Updated: {progress.updatedAt.toLocaleString()}</div>
            {progress.contractId && (
              <div>Contract ID: {progress.contractId}</div>
            )}
          </div>
        </>
      )}

      {!progress && connection.status === 'connected' && (
        <div className="text-center text-gray-600 py-8">
          <div className="mb-2">⏳</div>
          <div>Waiting for progress updates...</div>
          {contractId && (
            <div className="text-xs mt-2">Contract: {contractId}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default RealTimeProgressTracker;