'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Pause,
  Play,
  AlertTriangle as _AlertTriangle,
  BarChart3,
  FileText,
  Loader2,
  Zap,
  TrendingUp,
  Settings,
  Trash2,
  Eye,
  ChevronRight as _ChevronRight,
  Database,
  Cpu,
  HardDrive,
  Gauge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription as _CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// Types for queue/job management
interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface Job {
  id: string;
  name: string;
  queue: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  data: {
    contractId?: string;
    contractTitle?: string;
    tenantId?: string;
    source?: string;
  };
  attemptsMade: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
  failedReason?: string;
  duration?: number;
}

interface ImportBatch {
  id: string;
  name: string;
  source: 'upload' | 'connection' | 'api';
  connectionId?: string;
  connectionName?: string;
  totalContracts: number;
  processed: number;
  successful: number;
  failed: number;
  status: 'pending' | 'processing' | 'completed' | 'paused' | 'failed';
  startedAt: string;
  estimatedCompletion?: string;
  averageTimePerContract?: number;
}

interface SystemHealth {
  cpu: number;
  memory: number;
  queueLatency: number;
  dbConnections: number;
  redisConnected: boolean;
  workersActive: number;
}

export default function ImportQueuePage() {
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Fetch queue data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/queue-status');
      if (response.ok) {
        const data = await response.json();
        setQueues(data.queues || []);
        setJobs(data.recentJobs || []);
        setBatches(data.importBatches || []);
        setHealth(data.health || null);
        setLastRefresh(new Date());
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchData, autoRefresh]);

  // Pause/resume a queue
  const toggleQueuePause = useCallback(async (queueName: string, pause: boolean) => {
    try {
      await fetch('/api/admin/queue-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pause ? 'pause' : 'resume', queue: queueName }),
      });
      fetchData();
    } catch {
      // Error handled silently
    }
  }, [fetchData]);

  // Retry a failed job
  const retryJob = useCallback(async (jobId: string, queue: string) => {
    try {
      await fetch('/api/admin/queue-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', jobId, queue }),
      });
      fetchData();
    } catch {
      // Error handled silently
    }
  }, [fetchData]);

  // Clear completed jobs
  const clearCompleted = useCallback(async (queueName: string) => {
    try {
      await fetch('/api/admin/queue-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-completed', queue: queueName }),
      });
      fetchData();
    } catch {
      // Error handled silently
    }
  }, [fetchData]);

  // Calculate totals
  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active, 0);
  const totalCompleted = queues.reduce((sum, q) => sum + q.completed, 0);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  // Get status badge
  const getStatusBadge = (status: Job['status']) => {
    const config = {
      waiting: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
      active: { color: 'bg-violet-100 text-violet-700', icon: Loader2 },
      completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-700', icon: XCircle },
      delayed: { color: 'bg-violet-100 text-violet-700', icon: Clock },
    };
    const { color, icon: Icon } = config[status];
    return (
      <Badge className={cn('gap-1', color)}>
        <Icon className={cn('h-3 w-3', status === 'active' && 'animate-spin')} />
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-purple-50/20 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              Import Queue Manager
            </h1>
            <p className="text-gray-500 mt-1">
              Monitor and manage contract processing jobs
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(autoRefresh && 'bg-green-50 border-green-200')}
            >
              {autoRefresh ? (
                <>
                  <Pause className="h-4 w-4 mr-1" />
                  Auto-refresh ON
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  Auto-refresh OFF
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* System Health */}
        {health && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-violet-500" />
                  <span className="text-sm text-gray-600">CPU</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.cpu}%</p>
                <Progress value={health.cpu} className="h-1 mt-2" />
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-violet-500" />
                  <span className="text-sm text-gray-600">Memory</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.memory}%</p>
                <Progress value={health.memory} className="h-1 mt-2" />
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-gray-600">Latency</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.queueLatency}ms</p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600">DB Conns</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.dbConnections}</p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Zap className={cn('h-4 w-4', health.redisConnected ? 'text-green-500' : 'text-red-500')} />
                  <span className="text-sm text-gray-600">Redis</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.redisConnected ? 'OK' : 'DOWN'}</p>
              </CardContent>
            </Card>
            
            <Card className="border-0 shadow-sm">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-500" />
                  <span className="text-sm text-gray-600">Workers</span>
                </div>
                <p className="text-2xl font-bold mt-1">{health.workersActive}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Queue Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-md bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-yellow-700">{totalWaiting}</p>
                  <p className="text-sm text-yellow-600 mt-1">Waiting</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-violet-700">{totalActive}</p>
                  <p className="text-sm text-violet-600 mt-1">Processing</p>
                </div>
                <Loader2 className="h-8 w-8 text-violet-500 opacity-50 animate-spin" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-700">{totalCompleted}</p>
                  <p className="text-sm text-green-600 mt-1">Completed</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-red-700">{totalFailed}</p>
                  <p className="text-sm text-red-600 mt-1">Failed</p>
                </div>
                <XCircle className="h-8 w-8 text-red-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Import Batches */}
        {batches.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                Active Import Batches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {batches.map((batch) => (
                  <div key={batch.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{batch.name}</h3>
                        <p className="text-sm text-gray-500">
                          {batch.connectionName || batch.source} • Started {new Date(batch.startedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={cn(
                        batch.status === 'completed' && 'bg-green-100 text-green-700',
                        batch.status === 'processing' && 'bg-violet-100 text-violet-700',
                        batch.status === 'failed' && 'bg-red-100 text-red-700',
                        batch.status === 'paused' && 'bg-yellow-100 text-yellow-700',
                        batch.status === 'pending' && 'bg-gray-100 text-gray-700',
                      )}>
                        {batch.status}
                      </Badge>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">
                          {batch.processed} / {batch.totalContracts} contracts
                        </span>
                        <span className="text-gray-500">
                          {Math.round((batch.processed / batch.totalContracts) * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={(batch.processed / batch.totalContracts) * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        {batch.successful} successful
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-3 w-3 text-red-500" />
                        {batch.failed} failed
                      </span>
                      {batch.averageTimePerContract && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{batch.averageTimePerContract}s per contract
                        </span>
                      )}
                      {batch.estimatedCompletion && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          ETA: {new Date(batch.estimatedCompletion).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Queue Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queue List */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-violet-500" />
                Processing Queues
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
                </div>
              ) : queues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No queues available</p>
                  <p className="text-xs mt-1">Queue system may be initializing...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queues.map((queue) => (
                    <div 
                      key={queue.name}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all cursor-pointer",
                        selectedQueue === queue.name 
                          ? "border-violet-400 bg-violet-50" 
                          : "border-gray-100 hover:border-gray-200 bg-white"
                      )}
                      onClick={() => setSelectedQueue(selectedQueue === queue.name ? null : queue.name)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{queue.name}</h3>
                          {queue.paused && (
                            <Badge className="bg-yellow-100 text-yellow-700">
                              <Pause className="h-3 w-3 mr-1" />
                              Paused
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleQueuePause(queue.name, !queue.paused);
                            }}
                          >
                            {queue.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearCompleted(queue.name);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-2 text-center text-xs">
                        <div className="p-2 bg-yellow-50 rounded-lg">
                          <p className="font-bold text-yellow-700">{queue.waiting}</p>
                          <p className="text-yellow-600">Waiting</p>
                        </div>
                        <div className="p-2 bg-violet-50 rounded-lg">
                          <p className="font-bold text-violet-700">{queue.active}</p>
                          <p className="text-violet-600">Active</p>
                        </div>
                        <div className="p-2 bg-green-50 rounded-lg">
                          <p className="font-bold text-green-700">{queue.completed}</p>
                          <p className="text-green-600">Done</p>
                        </div>
                        <div className="p-2 bg-red-50 rounded-lg">
                          <p className="font-bold text-red-700">{queue.failed}</p>
                          <p className="text-red-600">Failed</p>
                        </div>
                        <div className="p-2 bg-violet-50 rounded-lg">
                          <p className="font-bold text-violet-700">{queue.delayed}</p>
                          <p className="text-violet-600">Delayed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-violet-500" />
                Recent Jobs
                {selectedQueue && (
                  <Badge variant="outline" className="ml-2">
                    {selectedQueue}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recent jobs</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {jobs
                    .filter(job => !selectedQueue || job.queue === selectedQueue)
                    .slice(0, 20)
                    .map((job) => (
                      <div 
                        key={job.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(job.status)}
                            <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                              {job.data.contractTitle || job.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {job.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => retryJob(job.id, job.queue)}
                                className="h-7 text-xs"
                              >
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Retry
                              </Button>
                            )}
                            {job.data.contractId && (
                              <Link href={`/contracts/${job.data.contractId}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                        
                        {job.status === 'active' && (
                          <Progress value={job.progress} className="h-1 mt-2" />
                        )}
                        
                        {job.failedReason && (
                          <p className="text-xs text-red-600 mt-1 truncate">
                            {job.failedReason}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{job.queue}</span>
                          <span>•</span>
                          <span>Attempt {job.attemptsMade}/{job.maxAttempts}</span>
                          {job.duration && (
                            <>
                              <span>•</span>
                              <span>{job.duration}ms</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rate Limiting Info */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-gray-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-slate-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-slate-700">Processing Configuration</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Contracts are processed with a <strong>1-second delay</strong> between jobs to prevent API rate limits.
                  Each job has <strong>3 retry attempts</strong> with exponential backoff (30s, 60s, 120s).
                  AI extraction uses batching to optimize token usage.
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <Link href="/admin/settings">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Settings className="h-4 w-4" />
                      Configure Limits
                    </Button>
                  </Link>
                  <Link href="/admin/integrations">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Database className="h-4 w-4" />
                      Data Connections
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
