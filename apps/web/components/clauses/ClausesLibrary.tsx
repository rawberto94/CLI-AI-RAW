/**
 * Clauses Library
 * Standard contract clause management and insertion
 * Uses real database data via /api/clauses
 */

'use client';

import { memo, useState, useMemo, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import {
  Library,
  Search,
  Plus,
  Star,
  Copy,
  Edit,
  Trash2,
  FileText,
  AlertTriangle,
  Shield,
  Scale,
  Clock,
  Loader2,
  Filter,
  Tag,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

type ClauseCategory = 
  | 'general' 
  | 'liability' 
  | 'confidentiality' 
  | 'termination' 
  | 'payment' 
  | 'intellectual_property'
  | 'indemnification'
  | 'force_majeure'
  | 'dispute_resolution'
  | 'compliance';

type RiskLevel = 'low' | 'medium' | 'high';

interface Clause {
  id: string;
  name: string;
  content: string;
  category: ClauseCategory;
  riskLevel: RiskLevel;
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  lastUsed: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  variables: string[];
  notes?: string;
}

// Transform API response to component format
function transformClause(apiClause: Record<string, unknown>): Clause {
  return {
    id: apiClause.id as string,
    name: (apiClause.title as string) || (apiClause.name as string) || '',
    content: apiClause.content as string || '',
    category: (apiClause.category as ClauseCategory) || 'general',
    riskLevel: (apiClause.riskLevel as RiskLevel) || 'low',
    tags: (apiClause.tags as string[]) || [],
    isFavorite: (apiClause.isFavorite as boolean) || false,
    usageCount: (apiClause.usageCount as number) || 0,
    lastUsed: apiClause.lastUsed ? new Date(apiClause.lastUsed as string) : null,
    createdAt: apiClause.createdAt ? new Date(apiClause.createdAt as string) : new Date(),
    updatedAt: apiClause.updatedAt ? new Date(apiClause.updatedAt as string) : new Date(),
    createdBy: (apiClause.createdBy as string) || 'Legal Team',
    variables: (apiClause.variables as string[]) || [],
    notes: apiClause.notes as string || undefined,
  };
}

const categoryConfig: Record<ClauseCategory, { label: string; icon: React.ElementType; color: string }> = {
  general: { label: 'General', icon: FileText, color: 'bg-slate-100 text-slate-700' },
  liability: { label: 'Liability', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  confidentiality: { label: 'Confidentiality', icon: Shield, color: 'bg-violet-100 text-violet-700' },
  termination: { label: 'Termination', icon: Clock, color: 'bg-red-100 text-red-700' },
  payment: { label: 'Payment', icon: FileText, color: 'bg-green-100 text-green-700' },
  intellectual_property: { label: 'IP', icon: FileText, color: 'bg-violet-100 text-violet-700' },
  indemnification: { label: 'Indemnification', icon: Shield, color: 'bg-yellow-100 text-yellow-700' },
  force_majeure: { label: 'Force Majeure', icon: AlertTriangle, color: 'bg-violet-100 text-violet-700' },
  dispute_resolution: { label: 'Disputes', icon: Scale, color: 'bg-violet-100 text-violet-700' },
  compliance: { label: 'Compliance', icon: Shield, color: 'bg-pink-100 text-pink-700' },
};

const riskColors: Record<RiskLevel, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-red-100 text-red-700',
};

interface ClausesLibraryProps {
  onInsertClause?: (clause: Clause) => void;
  className?: string;
}

export const ClausesLibrary = memo(function ClausesLibrary({
  onInsertClause,
  className,
}: ClausesLibraryProps) {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | 'all'>('all');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [showNewClauseDialog, setShowNewClauseDialog] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);

  // Form state for new clause
  const [newClause, setNewClause] = useState({
    name: '',
    content: '',
    category: 'general' as ClauseCategory,
    riskLevel: 'low' as RiskLevel,
    tags: '',
    notes: '',
  });

  // Fetch clauses from API
  const fetchClauses = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (riskFilter !== 'all') params.set('riskLevel', riskFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      
      const response = await fetch(`/api/clauses?${params}`);
      if (!response.ok) throw new Error('Failed to fetch clauses');
      
      const data = await response.json();
      const transformed = (data.clauses || []).map(transformClause);
      setClauses(transformed);
    } catch (error) {
      console.error('Failed to fetch clauses:', error);
      toast.error('Failed to load clauses library');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, riskFilter, debouncedSearch]);

  // Initial fetch
  useEffect(() => {
    fetchClauses();
  }, [fetchClauses]);

  const filteredClauses = useMemo(() => {
    return clauses.filter(clause => {
      // Search filter (already handled by API but keep for local favorites filter)
      if (search) {
        const searchLower = search.toLowerCase();
        if (
          !clause.name.toLowerCase().includes(searchLower) &&
          !clause.content.toLowerCase().includes(searchLower) &&
          !clause.tags.some(t => t.toLowerCase().includes(searchLower))
        ) {
          return false;
        }
      }

      // Category filter
      if (categoryFilter !== 'all' && clause.category !== categoryFilter) {
        return false;
      }

      // Risk filter
      if (riskFilter !== 'all' && clause.riskLevel !== riskFilter) {
        return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !clause.isFavorite) {
        return false;
      }

      return true;
    });
  }, [clauses, search, categoryFilter, riskFilter, showFavoritesOnly]);

  const toggleFavorite = async (id: string) => {
    const clause = clauses.find(c => c.id === id);
    if (!clause) return;
    
    // Optimistic update
    setClauses(prev =>
      prev.map(c =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
    
    // Note: Would need /api/clauses/[id] PATCH endpoint for full persistence
  };

  const copyClause = async (clause: Clause) => {
    setCopying(clause.id);
    await navigator.clipboard.writeText(clause.content);
    
    // Update usage count via API
    try {
      await fetch(`/api/clauses/${clause.id}/copy`, { method: 'POST' });
    } catch {
      // Silent fail - copy still works
    }
    
    // Update local state
    setClauses(prev =>
      prev.map(c =>
        c.id === clause.id
          ? { ...c, usageCount: c.usageCount + 1, lastUsed: new Date() }
          : c
      )
    );

    setTimeout(() => {
      setCopying(null);
      toast.success('Clause copied to clipboard');
    }, 500);
  };

  const deleteClause = async (id: string) => {
    try {
      const response = await fetch(`/api/clauses/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      
      setClauses(prev => prev.filter(c => c.id !== id));
      toast.success('Clause deleted');
    } catch {
      toast.error('Failed to delete clause');
    }
  };

  const createClause = async () => {
    if (!newClause.name || !newClause.content) {
      toast.error('Name and content are required');
      return;
    }

    try {
      const response = await fetch('/api/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newClause.name,
          content: newClause.content,
          category: newClause.category,
          riskLevel: newClause.riskLevel.toUpperCase(),
          tags: newClause.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create clause');
      
      const data = await response.json();
      const created = transformClause(data.clause);
      
      setClauses(prev => [created, ...prev]);
      setShowNewClauseDialog(false);
      setNewClause({
        name: '',
        content: '',
        category: 'general',
        riskLevel: 'low',
        tags: '',
        notes: '',
      });
      toast.success('Clause created');
    } catch {
      toast.error('Failed to create clause');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4">
              <div className="flex gap-4">
                <div className="h-16 w-16 bg-slate-200 rounded animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-2/3 bg-slate-200 rounded animate-pulse" />
                  <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-1/3 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Library className="h-6 w-6 text-violet-600" />
            Clauses Library
          </h2>
          <p className="text-slate-600 mt-1">
            Standard contract clauses for quick insertion
          </p>
        </div>
        <Button onClick={() => setShowNewClauseDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Clause
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search clauses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v as ClauseCategory | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryConfig).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={riskFilter}
          onValueChange={(v) => setRiskFilter(v as RiskLevel | 'all')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
            <SelectItem value="medium">Medium Risk</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={showFavoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Star className={cn('h-4 w-4 mr-1', showFavoritesOnly && 'fill-current')} />
          Favorites
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <span>{filteredClauses.length} clauses</span>
        <span>•</span>
        <span>{clauses.filter(c => c.isFavorite).length} favorites</span>
      </div>

      {/* Clauses Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredClauses.map(clause => {
          const catConfig = categoryConfig[clause.category];
          const Icon = catConfig.icon;

          return (
            <Card
              key={clause.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedClause(clause)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={catConfig.color}>
                      <Icon className="h-3 w-3 mr-1" />
                      {catConfig.label}
                    </Badge>
                    <Badge className={riskColors[clause.riskLevel]}>
                      {clause.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(clause.id);
                      }}
                      aria-label={clause.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          clause.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'
                        )}
                      />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Clause actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => copyClause(clause)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedClause(clause)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteClause(clause.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardTitle className="text-base mt-2">{clause.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 line-clamp-3">
                  {clause.content}
                </p>
                {clause.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {clause.tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="text-xs text-slate-500 pt-0">
                <span>Used {clause.usageCount} times</span>
                {clause.variables.length > 0 && (
                  <>
                    <span className="mx-2">•</span>
                    <span>{clause.variables.length} variables</span>
                  </>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {filteredClauses.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Library className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No clauses found</p>
          <p className="text-sm mt-1">Try adjusting your filters or create a new clause</p>
        </div>
      )}

      {/* Clause Detail Dialog */}
      <Dialog open={!!selectedClause} onOpenChange={() => setSelectedClause(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedClause && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge className={categoryConfig[selectedClause.category].color}>
                    {categoryConfig[selectedClause.category].label}
                  </Badge>
                  <Badge className={riskColors[selectedClause.riskLevel]}>
                    {selectedClause.riskLevel} risk
                  </Badge>
                </div>
                <DialogTitle className="mt-2">{selectedClause.name}</DialogTitle>
                <DialogDescription>
                  Created by {selectedClause.createdBy} • Used {selectedClause.usageCount} times
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-slate-500 mb-2 block">
                    Clause Content
                  </Label>
                  <div className="p-4 bg-slate-50 rounded-lg border text-sm whitespace-pre-wrap">
                    {selectedClause.content}
                  </div>
                </div>

                {selectedClause.variables.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-slate-500 mb-2 block">
                      Variables ({selectedClause.variables.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedClause.variables.map(v => (
                        <Badge key={v} variant="outline" className="font-mono text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedClause.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-slate-500 mb-2 block">
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedClause.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedClause.notes && (
                  <div>
                    <Label className="text-sm font-medium text-slate-500 mb-2 block">
                      Notes
                    </Label>
                    <p className="text-sm text-slate-600">{selectedClause.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedClause(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    copyClause(selectedClause);
                    setSelectedClause(null);
                  }}
                  disabled={copying === selectedClause.id}
                >
                  {copying === selectedClause.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy to Clipboard
                </Button>
                {onInsertClause && (
                  <Button
                    variant="default"
                    onClick={() => {
                      onInsertClause(selectedClause);
                      setSelectedClause(null);
                    }}
                  >
                    Insert Clause
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Clause Dialog */}
      <Dialog open={showNewClauseDialog} onOpenChange={setShowNewClauseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Clause</DialogTitle>
            <DialogDescription>
              Add a new standard clause to your library
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Clause Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Standard Confidentiality"
                value={newClause.name}
                onChange={(e) => setNewClause(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newClause.category}
                  onValueChange={(v) => setNewClause(prev => ({ ...prev, category: v as ClauseCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="risk">Risk Level</Label>
                <Select
                  value={newClause.riskLevel}
                  onValueChange={(v) => setNewClause(prev => ({ ...prev, riskLevel: v as RiskLevel }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="content">Clause Content *</Label>
              <Textarea
                id="content"
                placeholder="Enter the clause text. Use {{VARIABLE_NAME}} for variables."
                value={newClause.content}
                onChange={(e) => setNewClause(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
              />
              <p className="text-xs text-slate-500 mt-1">
                Use {"{{VARIABLE_NAME}}"} syntax for placeholders
              </p>
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                placeholder="standard, nda, liability (comma-separated)"
                value={newClause.tags}
                onChange={(e) => setNewClause(prev => ({ ...prev, tags: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes or usage guidelines..."
                value={newClause.notes}
                onChange={(e) => setNewClause(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewClauseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={createClause}>
              <Plus className="h-4 w-4 mr-2" />
              Create Clause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ClausesLibrary;
