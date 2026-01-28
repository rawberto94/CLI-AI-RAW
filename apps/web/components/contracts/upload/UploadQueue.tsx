'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Play,
  Pause,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  Settings2,
  Layers,
  Brain
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedUploadProgress } from './EnhancedUploadProgress';

// ============================================================================
// Types
// ============================================================================

export interface QueuedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  contractId?: string;
  error?: string;
  isDuplicate?: boolean;
  existingContractId?: string;
  startTime?: number;
  endTime?: number;
  position?: number;
}

export interface UploadQueueProps {
  files: QueuedFile[];
  onUploadAll: () => void;
  onPauseAll: () => void;
  onRemoveFile: (id: string) => void;
  onRetryFile: (id: string) => void;
  onClearCompleted: () => void;
  onViewContract: (contractId: string) => void;
  isUploading: boolean;
  isPaused: boolean;
  concurrency?: number;
  tenantId?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface QueueStatsProps {
  files: QueuedFile[];
  isUploading: boolean;
}

function QueueStats({ files, isUploading }: QueueStatsProps) {
  const stats = useMemo(() => {
    const pending = files.filter(f => f.status === 'pending').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const processing = files.filter(f => f.status === 'processing').length;
    const completed = files.filter(f => f.status === 'completed').length;
    const errors = files.filter(f => f.status === 'error').length;
    const total = files.length;
    const active = uploading + processing;
    
    return { pending, uploading, processing, completed, errors, total, active };
  }, [files]);

  const overallProgress = useMemo(() => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-slate-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
        <div className="text-xs text-slate-500">Total Files</div>
      </div>
      <div className="bg-violet-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-violet-600 flex items-center justify-center gap-1">
          {stats.active}
          {isUploading && stats.active > 0 && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>
        <div className="text-xs text-violet-600">Processing</div>
      </div>
      <div className="bg-amber-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
        <div className="text-xs text-amber-600">In Queue</div>
      </div>
      <div className="bg-green-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
        <div className="text-xs text-green-600">Completed</div>
      </div>
      <div className="bg-red-50 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
        <div className="text-xs text-red-600">Errors</div>
      </div>
    </div>
  );
}

interface EstimatedTimeProps {
  files: QueuedFile[];
}

function EstimatedTime({ files }: EstimatedTimeProps) {
  const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'uploading' || f.status === 'processing');
  
  if (pendingFiles.length === 0) return null;
  
  // Estimate ~15 seconds per file on average
  const estimatedSeconds = pendingFiles.length * 15;
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;
  
  return (
    <Badge variant="outline" className="bg-slate-50">
      <Clock className="h-3 w-3 mr-1" />
      {minutes > 0 ? `~${minutes}m ${seconds}s` : `~${seconds}s`} remaining
    </Badge>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function UploadQueue({
  files,
  onUploadAll,
  onPauseAll,
  onRemoveFile,
  onRetryFile,
  onClearCompleted,
  onViewContract,
  isUploading,
  isPaused,
  concurrency = 2,
  tenantId = 'demo'
}: UploadQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedView, setSelectedView] = useState<'all' | 'pending' | 'processing' | 'completed' | 'errors'>('all');

  const filteredFiles = useMemo(() => {
    switch (selectedView) {
      case 'pending':
        return files.filter(f => f.status === 'pending');
      case 'processing':
        return files.filter(f => f.status === 'uploading' || f.status === 'processing');
      case 'completed':
        return files.filter(f => f.status === 'completed');
      case 'errors':
        return files.filter(f => f.status === 'error');
      default:
        return files;
    }
  }, [files, selectedView]);

  const hasErrors = files.some(f => f.status === 'error');
  const hasCompleted = files.some(f => f.status === 'completed');
  const hasPending = files.some(f => f.status === 'pending');
  const isComplete = files.length > 0 && files.every(f => f.status === 'completed' || f.status === 'error');
  const overallProgress = useMemo(() => {
    if (files.length === 0) return 0;
    const completed = files.filter(f => f.status === 'completed').length;
    return Math.round((completed / files.length) * 100);
  }, [files]);

  if (files.length === 0) return null;

  return (
    <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2.5 rounded-xl shadow-lg',
              isComplete && !hasErrors
                ? 'bg-gradient-to-br from-violet-500 to-violet-600'
                : isUploading
                ? 'bg-gradient-to-br from-violet-500 to-purple-600'
                : 'bg-gradient-to-br from-slate-500 to-slate-600'
            )}>
              {isComplete && !hasErrors ? (
                <CheckCircle2 className="h-5 w-5 text-white" />
              ) : isUploading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Layers className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">
                Upload Queue
                <Badge className="ml-2" variant="secondary">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                {isComplete
                  ? 'All files processed'
                  : isUploading
                  ? 'Processing in progress...'
                  : 'Ready to process'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <EstimatedTime files={files} />
            
            {hasPending && !isUploading && (
              <Button onClick={onUploadAll} className="gap-2">
                <Play className="h-4 w-4" />
                Start All
              </Button>
            )}
            
            {isUploading && !isPaused && (
              <Button onClick={onPauseAll} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            
            {isPaused && (
              <Button onClick={onUploadAll} className="gap-2">
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            
            {hasCompleted && (
              <Button onClick={onClearCompleted} variant="outline" size="sm" className="gap-1">
                <Trash2 className="h-3.5 w-3.5" />
                Clear Completed
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        
        {/* Overall Progress */}
        {isUploading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Overall Progress</span>
              <span>{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
        )}
      </CardHeader>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <CardContent className="pt-0">
              {/* Queue Stats */}
              <QueueStats files={files} isUploading={isUploading} />
              
              {/* Filter Tabs */}
              <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
                {[
                  { id: 'all', label: 'All', count: files.length },
                  { id: 'pending', label: 'Pending', count: files.filter(f => f.status === 'pending').length },
                  { id: 'processing', label: 'Processing', count: files.filter(f => f.status === 'uploading' || f.status === 'processing').length },
                  { id: 'completed', label: 'Completed', count: files.filter(f => f.status === 'completed').length },
                  { id: 'errors', label: 'Errors', count: files.filter(f => f.status === 'error').length },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedView(tab.id as typeof selectedView)}
                    className={cn(
                      'flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                      selectedView === tab.id
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'ml-1.5 min-w-[20px] h-5',
                          tab.id === 'errors' && tab.count > 0 && 'bg-red-100 text-red-700'
                        )}
                      >
                        {tab.count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
              
              {/* File List */}
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                <AnimatePresence mode="popLayout">
                  {filteredFiles.map((file, index) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <EnhancedUploadProgress
                        fileId={file.id}
                        fileName={file.file.name}
                        fileSize={file.file.size}
                        contractId={file.contractId}
                        status={file.status}
                        error={file.error}
                        isDuplicate={file.isDuplicate}
                        existingContractId={file.existingContractId}
                        onRetry={() => onRetryFile(file.id)}
                        onRemove={() => onRemoveFile(file.id)}
                        onViewContract={onViewContract}
                        tenantId={tenantId}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {filteredFiles.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No files in this category</p>
                  </div>
                )}
              </div>
              
              {/* Retry All Errors */}
              {hasErrors && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {files.filter(f => f.status === 'error').length} file(s) failed to process
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-100"
                    onClick={() => {
                      files.filter(f => f.status === 'error').forEach(f => onRetryFile(f.id));
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Retry All
                  </Button>
                </div>
              )}
              
              {/* Processing Info */}
              {isUploading && (
                <div className="mt-4 p-3 bg-violet-50 rounded-lg">
                  <div className="flex items-center gap-2 text-violet-700">
                    <Brain className="h-4 w-4" />
                    <span className="text-sm">
                      Processing {concurrency} file{concurrency !== 1 ? 's' : ''} in parallel with AI analysis
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export default UploadQueue;
