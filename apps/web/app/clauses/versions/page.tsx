'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Search,
  Clock,
  FileText,
  ArrowLeftRight,
  ChevronRight,
  User,
  Calendar,
  Loader2,
  RefreshCw,
  Plus,
  Minus,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { PageBreadcrumb } from '@/components/navigation';

interface ClauseVersion {
  id: string;
  clauseId: string;
  clauseName: string;
  category: string;
  version: number;
  content: string;
  changeDescription: string;
  createdBy: string;
  createdAt: string;
  status: 'current' | 'approved' | 'draft' | 'archived';
}

export default function ClauseVersionsPage() {
  const [clauses, setClauses] = useState<Record<string, ClauseVersion[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [diffVersions, setDiffVersions] = useState<[ClauseVersion, ClauseVersion] | null>(null);

  useEffect(() => {
    fetchClauseVersions();
  }, []);

  const fetchClauseVersions = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/clauses?includeVersions=true');
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      
      // Group by clause ID
      const grouped: Record<string, ClauseVersion[]> = {};
      const clauseList = data.data?.clauses || data.clauses || [];
      
      for (const clause of clauseList) {
        const versions = clause.versions || [clause];
        grouped[clause.id] = versions.map((v: any, i: number) => ({
          id: v.id || `${clause.id}-v${i}`,
          clauseId: clause.id,
          clauseName: clause.name || clause.title || 'Untitled Clause',
          category: clause.category || 'General',
          version: v.version || versions.length - i,
          content: v.content || clause.content || '',
          changeDescription: v.changeDescription || (i === 0 ? 'Current version' : `Version ${versions.length - i}`),
          createdBy: v.createdBy || v.updatedBy || 'System',
          createdAt: v.createdAt || v.updatedAt || new Date().toISOString(),
          status: i === 0 ? 'current' : 'approved',
        }));
      }
      
      setClauses(grouped);
      if (Object.keys(grouped).length > 0) {
        setSelectedClauseId(Object.keys(grouped)[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load clause versions';
      setLoadError(msg);
      toast.error('Failed to load clause versions');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedVersions = selectedClauseId ? clauses[selectedClauseId] || [] : [];
  
  const filteredClauses = Object.entries(clauses).filter(([_, versions]) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return versions.some(v => v.clauseName.toLowerCase().includes(q) || v.category.toLowerCase().includes(q));
  });

  const statusColor = (s: string) => {
    switch (s) {
      case 'current': return 'bg-green-100 text-green-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Simple diff viewer: highlight additions/removals line by line
  const renderDiff = (oldText: string, newText: string) => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLen = Math.max(oldLines.length, newLines.length);
    const lines: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
    
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';
      if (oldLine === newLine) {
        lines.push({ type: 'same', text: newLine });
      } else {
        if (oldLine) lines.push({ type: 'removed', text: oldLine });
        if (newLine) lines.push({ type: 'added', text: newLine });
      }
    }
    return lines;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <PageBreadcrumb />
      
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg">
          <GitBranch className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
            Clause Versions
          </h1>
          <p className="text-muted-foreground">
            Track changes and compare versions of your contract clauses
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={fetchClauseVersions}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {loadError && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50/50 p-4 mb-6">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Couldn’t load clause versions</p>
              <p className="text-sm text-rose-700 mt-1">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchClauseVersions} className="flex-shrink-0">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Clause List */}
        <div className="col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Clauses</CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clauses..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {filteredClauses.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No clauses found</p>
                  </div>
                ) : (
                  filteredClauses.map(([clauseId, versions]) => (
                    <button
                      key={clauseId}
                      onClick={() => { setSelectedClauseId(clauseId); setDiffVersions(null); }}
                      className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors ${selectedClauseId === clauseId ? 'bg-violet-50 dark:bg-violet-950/20 border-l-2 border-l-violet-500' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">{versions[0]?.clauseName}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{versions[0]?.category}</Badge>
                        <span className="text-xs text-muted-foreground">{versions.length} version{versions.length !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  ))
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Version History */}
        <div className="col-span-8">
          {diffVersions ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ArrowLeftRight className="h-5 w-5" />
                    Comparing v{diffVersions[0].version} → v{diffVersions[1].version}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => setDiffVersions(null)}>Close Diff</Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <pre className="text-sm font-mono space-y-0">
                    {renderDiff(diffVersions[0].content, diffVersions[1].content).map((line, i) => (
                      <div
                        key={i}
                        className={`px-3 py-0.5 ${
                          line.type === 'added' ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200' :
                          line.type === 'removed' ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200' :
                          ''
                        }`}
                      >
                        <span className="inline-block w-6 text-muted-foreground">
                          {line.type === 'added' ? <Plus className="h-3 w-3 inline" /> : line.type === 'removed' ? <Minus className="h-3 w-3 inline" /> : ''}
                        </span>
                        {line.text || ' '}
                      </div>
                    ))}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : selectedVersions.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedVersions[0]?.clauseName}</CardTitle>
                <CardDescription>Version history — click two versions to compare</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedVersions.map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative pl-8 pb-4"
                    >
                      {/* Timeline line */}
                      {i < selectedVersions.length - 1 && (
                        <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-muted" />
                      )}
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        {v.version}
                      </div>
                      
                      <Card className={i === 0 ? 'border-violet-200 dark:border-violet-800' : ''}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={statusColor(v.status)}>{v.status}</Badge>
                              <span className="text-sm font-medium">v{v.version}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {i < selectedVersions.length - 1 && (
                                <Button variant="outline" size="sm" onClick={() => setDiffVersions([selectedVersions[i + 1], v])}>
                                  <ArrowLeftRight className="h-3 w-3 mr-1" /> Diff
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{v.changeDescription}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {v.createdBy}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(v.createdAt).toLocaleDateString()}</span>
                          </div>
                          {i === 0 && v.content && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm max-h-40 overflow-y-auto">
                              {v.content.slice(0, 500)}{v.content.length > 500 ? '...' : ''}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-[400px] flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select a clause to view versions</p>
                <p className="text-sm">Choose from the list on the left</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
