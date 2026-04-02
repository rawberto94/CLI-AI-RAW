'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { History, GitCompare, ArrowLeft, User, Calendar, FileText, ChevronRight, Plus, Minus, Equal } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface ClauseVersion {
  id: string;
  clauseId: string;
  version: number;
  text: string;
  plainText: string;
  changeNotes: string | null;
  createdAt: string;
  createdById: string;
  createdByUser?: { name: string; email: string };
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  lineNumber?: number;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  let i = m, j = n;
  const ops: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'unchanged', text: oldLines[i - 1], lineNumber: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', text: newLines[j - 1], lineNumber: j });
      j--;
    } else {
      ops.unshift({ type: 'removed', text: oldLines[i - 1], lineNumber: i });
      i--;
    }
  }

  return ops;
}

function computeWordDiff(oldText: string, newText: string): { added: number; removed: number; unchanged: number } {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);
  const oldSet = new Set(oldWords);
  const newSet = new Set(newWords);
  const added = newWords.filter(w => !oldSet.has(w)).length;
  const removed = oldWords.filter(w => !newSet.has(w)).length;
  return { added, removed, unchanged: Math.min(oldWords.length, newWords.length) - removed };
}

interface ClauseVersionHistoryProps {
  clauseId?: string;
  onBack?: () => void;
}

export default function ClauseVersionHistory({ clauseId: propClauseId, onBack }: ClauseVersionHistoryProps) {
  const [clauses, setClauses] = useState<any[]>([]);
  const [selectedClauseId, setSelectedClauseId] = useState(propClauseId || '');
  const [versions, setVersions] = useState<ClauseVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [leftVersion, setLeftVersion] = useState<string>('');
  const [rightVersion, setRightVersion] = useState<string>('');

  // Fetch clause list
  useEffect(() => {
    if (propClauseId) return;
    (async () => {
      try {
        const res = await fetch('/api/clauses/versions');
        const json = await res.json();
        if (json.success) setClauses(json.data.clauses || []);
      } catch { /* ignore */ }
    })();
  }, [propClauseId]);

  // Fetch versions for selected clause
  const fetchVersions = useCallback(async () => {
    if (!selectedClauseId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clauses/versions?clauseId=${selectedClauseId}`);
      const json = await res.json();
      if (json.success) {
        setVersions(json.data.versions || []);
        const vs = json.data.versions || [];
        if (vs.length >= 2) {
          setRightVersion(vs[0].id);
          setLeftVersion(vs[1].id);
        } else if (vs.length === 1) {
          setRightVersion(vs[0].id);
          setLeftVersion(vs[0].id);
        }
      }
    } catch { toast.error('Failed to load versions'); }
    finally { setLoading(false); }
  }, [selectedClauseId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  const leftVer = useMemo(() => versions.find(v => v.id === leftVersion), [versions, leftVersion]);
  const rightVer = useMemo(() => versions.find(v => v.id === rightVersion), [versions, rightVersion]);
  const diffLines = useMemo(() => {
    if (!leftVer || !rightVer) return [];
    return computeLineDiff(leftVer.plainText || leftVer.text, rightVer.plainText || rightVer.text);
  }, [leftVer, rightVer]);

  const diffStats = useMemo(() => {
    if (!leftVer || !rightVer) return { added: 0, removed: 0, unchanged: 0 };
    return computeWordDiff(leftVer.plainText || leftVer.text, rightVer.plainText || rightVer.text);
  }, [leftVer, rightVer]);

  return (
    <div className="max-w-[1600px] mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-8 w-8" /> Clause Version History
            </h1>
            <p className="text-muted-foreground mt-1">Compare clause versions side by side</p>
          </div>
        </div>
        {versions.length >= 2 && (
          <Button onClick={() => setDiffOpen(true)}>
            <GitCompare className="h-4 w-4 mr-2" /> Compare Versions
          </Button>
        )}
      </div>

      {/* Clause Selector */}
      {!propClauseId && (
        <Card>
          <CardContent className="py-4">
            <Select value={selectedClauseId} onValueChange={setSelectedClauseId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a clause to view history..." />
              </SelectTrigger>
              <SelectContent>
                {clauses.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title} (v{c.versions?.[0]?.version || 1}, {c._count?.versions || 0} versions)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Version Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : versions.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>{selectedClauseId ? 'No versions found for this clause' : 'Select a clause to view its history'}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{versions.length}</p>
                <p className="text-sm text-blue-600">Total Versions</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {versions[0] ? `v${versions[0].version}` : '-'}
                </p>
                <p className="text-sm text-green-600">Latest Version</p>
              </CardContent>
            </Card>
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="py-3 text-center">
                <p className="text-2xl font-bold text-purple-700">
                  {versions[0] ? formatDistanceToNow(new Date(versions[0].createdAt), { addSuffix: true }) : '-'}
                </p>
                <p className="text-sm text-purple-600">Last Updated</p>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Version Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="relative">
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
                  {versions.map((v, idx) => (
                    <div key={v.id} className="relative pl-14 pb-6 last:pb-0">
                      <div className={cn(
                        'absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        idx === 0 ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-muted-foreground/40'
                      )}>
                        <span className="text-[10px] font-bold">{v.version}</span>
                      </div>
                      <Card className={cn('hover:shadow-md transition-shadow', idx === 0 && 'border-primary/30')}>
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant={idx === 0 ? 'default' : 'outline'}>v{v.version}</Badge>
                                {idx === 0 && <Badge variant="secondary">Latest</Badge>}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {v.createdByUser?.name || v.createdByUser?.email || 'Unknown'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(v.createdAt), 'MMM dd, yyyy HH:mm')}
                                </span>
                              </div>
                              {v.changeNotes && (
                                <p className="text-sm mt-2 text-muted-foreground italic">&ldquo;{v.changeNotes}&rdquo;</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {idx < versions.length - 1 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setLeftVersion(versions[idx + 1].id);
                                    setRightVersion(v.id);
                                    setDiffOpen(true);
                                  }}
                                >
                                  <GitCompare className="h-3 w-3 mr-1" /> Diff
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Inline preview */}
                          <div className="mt-3 p-3 bg-muted/50 rounded text-sm font-mono max-h-24 overflow-hidden relative">
                            {(v.plainText || v.text || '').slice(0, 300)}
                            {(v.plainText || v.text || '').length > 300 && <span className="text-muted-foreground">...</span>}
                            <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-muted/50 to-transparent" />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Diff Dialog */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" /> Version Comparison
            </DialogTitle>
            <DialogDescription>Side-by-side clause text diff</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-2">
            <Select value={leftVersion} onValueChange={setLeftVersion}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Left version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>v{v.version} — {format(new Date(v.createdAt), 'MMM dd')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <Select value={rightVersion} onValueChange={setRightVersion}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Right version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>v{v.version} — {format(new Date(v.createdAt), 'MMM dd')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600"><Plus className="h-3 w-3" /> {diffStats.added} added</span>
              <span className="flex items-center gap-1 text-red-600"><Minus className="h-3 w-3" /> {diffStats.removed} removed</span>
            </div>
          </div>

          <Separator />

          <ScrollArea className="flex-1 max-h-[55vh]">
            <div className="font-mono text-sm">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'px-4 py-0.5 flex items-start gap-3 border-l-2',
                    line.type === 'added' && 'bg-green-50 border-green-500 dark:bg-green-950/30',
                    line.type === 'removed' && 'bg-red-50 border-red-500 dark:bg-red-950/30',
                    line.type === 'unchanged' && 'border-transparent'
                  )}
                >
                  <span className="text-muted-foreground w-6 text-right shrink-0 select-none text-xs pt-0.5">
                    {line.lineNumber || ''}
                  </span>
                  <span className="w-4 shrink-0 select-none">
                    {line.type === 'added' && <Plus className="h-3 w-3 text-green-600 mt-0.5" />}
                    {line.type === 'removed' && <Minus className="h-3 w-3 text-red-600 mt-0.5" />}
                    {line.type === 'unchanged' && <Equal className="h-3 w-3 text-muted-foreground/30 mt-0.5" />}
                  </span>
                  <span className={cn(
                    'flex-1 break-all whitespace-pre-wrap',
                    line.type === 'added' && 'text-green-800 dark:text-green-300',
                    line.type === 'removed' && 'text-red-800 dark:text-red-300 line-through opacity-75',
                  )}>
                    {line.text || '\u00A0'}
                  </span>
                </div>
              ))}
              {diffLines.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  {leftVersion === rightVersion ? 'Select two different versions to compare' : 'No differences found'}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
