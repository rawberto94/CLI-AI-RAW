"use client";

/**
 * Batch Contract Analysis Component
 * 
 * Allows users to analyze multiple contracts at once with progress tracking.
 * Uses the /api/ai/analyze and /api/rag/batch-process endpoints.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';

// Types
interface Contract {
  id: string;
  fileName: string;
  status: string;
  supplier?: string;
  hasText: boolean;
}

interface AnalysisResult {
  contractId: string;
  success: boolean;
  error?: string;
  summary?: string;
  keyTerms?: Array<{ term: string; value: string }>;
  risks?: Array<{ title: string; severity: string }>;
  processingTime?: number;
}

interface BatchStatus {
  batchId: string;
  status: 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  failed: number;
  startTime: number;
  endTime?: number;
}

type AnalysisType = 'full' | 'quick' | 'risks' | 'obligations' | 'embeddings';

export function BatchContractAnalysis() {
  // State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [analysisType, setAnalysisType] = useState<AnalysisType>('quick');
  
  // Batch processing state
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [results, setResults] = useState<Map<string, AnalysisResult>>(new Map());
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Fetch contracts
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        setIsFetching(true);
        const response = await fetch('/api/contracts?limit=100');
        const data = await response.json();
        
        if (data.success && data.data?.contracts) {
          setContracts(data.data.contracts.map((c: {
            id: string;
            fileName: string;
            status: string;
            supplier?: { name?: string };
            rawText?: string;
          }) => ({
            id: c.id,
            fileName: c.fileName,
            status: c.status,
            supplier: c.supplier?.name,
            hasText: !!c.rawText,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch contracts:', error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchContracts();
  }, []);

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contract.supplier?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Toggle selection
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select all visible
  const selectAll = useCallback(() => {
    const ids = filteredContracts.map(c => c.id);
    setSelectedIds(new Set(ids));
  }, [filteredContracts]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Poll batch status for RAG processing
  const pollBatchStatus = useCallback(async (batchId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/rag/batch-process?batchId=${batchId}`);
        const data = await response.json();

        if (data.status) {
          setBatchStatus({
            batchId,
            status: data.status,
            total: data.total,
            processed: data.processed,
            failed: data.failed,
            startTime: data.startTime,
            endTime: data.endTime,
          });

          // Update results from batch results
          if (data.results) {
            setResults(prev => {
              const next = new Map(prev);
              data.results.forEach((r: { contractId: string; success: boolean; error?: string }) => {
                next.set(r.contractId, {
                  contractId: r.contractId,
                  success: r.success,
                  error: r.error,
                });
              });
              return next;
            });
          }

          if (data.status === 'running') {
            setTimeout(poll, 2000);
          } else {
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Failed to poll batch status:', error);
        setIsLoading(false);
      }
    };

    poll();
  }, []);

  // Start batch analysis
  const startBatchAnalysis = useCallback(async () => {
    if (selectedIds.size === 0) return;

    setIsLoading(true);
    setResults(new Map());
    
    const contractIds = Array.from(selectedIds);

    if (analysisType === 'embeddings') {
      // Use RAG batch processing
      try {
        const response = await fetch('/api/rag/batch-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contractIds,
            forceReprocess: false,
          }),
        });

        const data = await response.json();
        
        if (data.success && data.batchId) {
          setBatchStatus({
            batchId: data.batchId,
            status: 'running',
            total: data.total,
            processed: 0,
            failed: 0,
            startTime: Date.now(),
          });

          // Poll for status
          pollBatchStatus(data.batchId);
        }
      } catch (error) {
        console.error('Failed to start batch:', error);
        setIsLoading(false);
      }
    } else {
      // Sequential AI analysis
      setBatchStatus({
        batchId: `local-${Date.now()}`,
        status: 'running',
        total: contractIds.length,
        processed: 0,
        failed: 0,
        startTime: Date.now(),
      });

      for (const contractId of contractIds) {
        try {
          const response = await fetch('/api/ai/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contractId, analysisType }),
          });

          const data = await response.json();

          setResults(prev => {
            const next = new Map(prev);
            next.set(contractId, {
              contractId,
              success: !data.error,
              error: data.error,
              summary: data.summary,
              keyTerms: data.keyTerms,
              risks: data.risks,
              processingTime: data.metadata?.processingTime,
            });
            return next;
          });

          setBatchStatus(prev => prev ? {
            ...prev,
            processed: prev.processed + 1,
            failed: prev.failed + (data.error ? 1 : 0),
          } : null);

        } catch (error) {
          setResults(prev => {
            const next = new Map(prev);
            next.set(contractId, {
              contractId,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            return next;
          });

          setBatchStatus(prev => prev ? {
            ...prev,
            processed: prev.processed + 1,
            failed: prev.failed + 1,
          } : null);
        }
      }

      setBatchStatus(prev => prev ? {
        ...prev,
        status: 'completed',
        endTime: Date.now(),
      } : null);

      setIsLoading(false);
    }
  }, [selectedIds, analysisType, pollBatchStatus]);

  // Toggle result expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedResults(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Export results
  const exportResults = useCallback(() => {
    const exportData = Array.from(results.entries()).map(([id, result]) => {
      const contract = contracts.find(c => c.id === id);
      return {
        contractId: id,
        fileName: contract?.fileName,
        success: result.success,
        error: result.error,
        summary: result.summary,
        keyTerms: result.keyTerms,
        risks: result.risks,
        processingTime: result.processingTime,
      };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results, contracts]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Batch Contract Analysis</h2>
          <p className="text-slate-600 mt-1">
            Analyze multiple contracts at once with AI
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={analysisType} onValueChange={(v) => setAnalysisType(v as AnalysisType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Analysis type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quick">Quick Summary</SelectItem>
              <SelectItem value="full">Full Analysis</SelectItem>
              <SelectItem value="risks">Risk Focus</SelectItem>
              <SelectItem value="obligations">Obligations</SelectItem>
              <SelectItem value="embeddings">Generate Embeddings</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            onClick={startBatchAnalysis}
            disabled={selectedIds.size === 0 || isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Analyze {selectedIds.size} Contract{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <AnimatePresence>
        {batchStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {batchStatus.status === 'running' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    ) : batchStatus.status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {batchStatus.status === 'running' ? 'Processing...' : 
                       batchStatus.status === 'completed' ? 'Completed' : 'Failed'}
                    </span>
                  </div>
                  <span className="text-sm text-slate-500">
                    {batchStatus.processed} / {batchStatus.total} contracts
                    {batchStatus.failed > 0 && (
                      <span className="text-red-500 ml-2">
                        ({batchStatus.failed} failed)
                      </span>
                    )}
                  </span>
                </div>
                <Progress 
                  value={(batchStatus.processed / batchStatus.total) * 100} 
                  className="h-2"
                />
                {batchStatus.endTime && (
                  <p className="text-xs text-slate-500 mt-2">
                    Completed in {((batchStatus.endTime - batchStatus.startTime) / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contracts..."
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAll}>
            Select All ({filteredContracts.length})
          </Button>
          <Button variant="outline" size="sm" onClick={clearSelection}>
            Clear
          </Button>
          {results.size > 0 && (
            <Button variant="outline" size="sm" onClick={exportResults}>
              <Download className="w-4 h-4 mr-2" />
              Export Results
            </Button>
          )}
        </div>
      </div>

      {/* Contract List */}
      <div className="space-y-2">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No contracts found
          </div>
        ) : (
          filteredContracts.map((contract) => {
            const isSelected = selectedIds.has(contract.id);
            const result = results.get(contract.id);
            const isExpanded = expandedResults.has(contract.id);

            return (
              <motion.div
                key={contract.id}
                layout
                className={`
                  border rounded-lg p-4 transition-colors cursor-pointer
                  ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}
                  ${result?.success === false ? 'border-red-200 bg-red-50' : ''}
                  ${result?.success === true ? 'border-green-200 bg-green-50' : ''}
                `}
                onClick={() => toggleSelection(contract.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(contract.id)}
                      className="w-4 h-4 rounded border-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <FileText className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="font-medium text-slate-900">{contract.fileName}</p>
                      {contract.supplier && (
                        <p className="text-sm text-slate-500">{contract.supplier}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge variant={contract.hasText ? 'default' : 'secondary'}>
                      {contract.hasText ? 'Has Text' : 'No Text'}
                    </Badge>
                    <Badge variant="outline">{contract.status}</Badge>
                    
                    {result && (
                      <>
                        {result.success ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        {result.summary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(contract.id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Result */}
                <AnimatePresence>
                  {isExpanded && result && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 pt-4 border-t border-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {result.error ? (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>{result.error}</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {result.summary && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-700 mb-1">Summary</h4>
                              <p className="text-sm text-slate-600">{result.summary}</p>
                            </div>
                          )}
                          
                          {result.risks && result.risks.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-slate-700 mb-2">Risks</h4>
                              <div className="flex flex-wrap gap-2">
                                {result.risks.slice(0, 3).map((risk, i) => (
                                  <Badge 
                                    key={i}
                                    variant={
                                      risk.severity === 'high' || risk.severity === 'critical' 
                                        ? 'destructive' 
                                        : 'secondary'
                                    }
                                  >
                                    {risk.title}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {result.processingTime && (
                            <p className="text-xs text-slate-400">
                              Processed in {result.processingTime}ms
                            </p>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default BatchContractAnalysis;
