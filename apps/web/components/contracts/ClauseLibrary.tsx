'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Search,
  Copy,
  Edit,
  Trash2,
  Tag,
  BookOpen,
  Check,
  Star,
  AlertCircle,
  Filter,
  Download,
  Upload,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Clause {
  id: string;
  title: string;
  content: string;
  category: string;
  subcategory: string;
  tags: string[];
  riskLevel: 'low' | 'medium' | 'high';
  isStandard: boolean;
  isFavorite?: boolean;
  usageCount?: number;
  variables: string[];
  alternativeVersions?: string[];
  legalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClauseLibraryProps {
  onSelectClause?: (clause: Clause) => void;
  onAddClauses?: (clauses: Clause[]) => void;
  multiSelect?: boolean;
}

export function ClauseLibrary({ onSelectClause, onAddClauses, multiSelect = false }: ClauseLibraryProps) {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [filteredClauses, setFilteredClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedClauses, setSelectedClauses] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);

  const [newClause, setNewClause] = useState({
    title: '',
    content: '',
    category: '',
    subcategory: '',
    tags: [] as string[],
    riskLevel: 'medium' as const,
    legalNotes: '',
  });

  const categories = [
    'Confidentiality',
    'Termination',
    'Payment Terms',
    'Liability',
    'Intellectual Property',
    'Dispute Resolution',
    'Force Majeure',
    'Indemnification',
    'Warranties',
    'Non-Compete',
    'Data Protection',
    'Compliance',
  ];

  const riskLevels = [
    { value: 'low', label: 'Low Risk', color: 'bg-green-100 text-green-700' },
    { value: 'medium', label: 'Medium Risk', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'high', label: 'High Risk', color: 'bg-red-100 text-red-700' },
  ];

  useEffect(() => {
    fetchClauses();
  }, []);

  useEffect(() => {
    filterClauses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clauses, searchQuery, selectedCategory, selectedRisk, showFavoritesOnly]);

  const fetchClauses = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/clauses');
      if (response.ok) {
        const data = await response.json();
        setClauses(data.clauses || []);
      }
    } catch {
      // Failed to fetch clauses
    } finally {
      setLoading(false);
    }
  };

  const filterClauses = () => {
    let filtered = [...clauses];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.content.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query) ||
          c.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((c) => c.category === selectedCategory);
    }

    if (selectedRisk !== 'all') {
      filtered = filtered.filter((c) => c.riskLevel === selectedRisk);
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((c) => c.isFavorite);
    }

    setFilteredClauses(filtered);
  };

  const handleCreateClause = async () => {
    try {
      const response = await fetch('/api/clauses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClause),
      });

      if (response.ok) {
        const data = await response.json();
        setClauses([data.clause, ...clauses]);
        setShowCreateDialog(false);
        setNewClause({
          title: '',
          content: '',
          category: '',
          subcategory: '',
          tags: [],
          riskLevel: 'medium',
          legalNotes: '',
        });
      }
    } catch {
      // Failed to create clause
    }
  };

  const handleToggleFavorite = async (clauseId: string) => {
    try {
      const clause = clauses.find((c) => c.id === clauseId);
      const response = await fetch(`/api/clauses/${clauseId}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !clause?.isFavorite }),
      });

      if (response.ok) {
        setClauses(
          clauses.map((c) => (c.id === clauseId ? { ...c, isFavorite: !c.isFavorite } : c))
        );
      }
    } catch {
      // Failed to toggle favorite
    }
  };

  const handleToggleSelect = (clauseId: string) => {
    const newSelected = new Set(selectedClauses);
    if (newSelected.has(clauseId)) {
      newSelected.delete(clauseId);
    } else {
      newSelected.add(clauseId);
    }
    setSelectedClauses(newSelected);
  };

  const handleAddSelected = () => {
    if (onAddClauses) {
      const selectedClauseObjects = clauses.filter((c) => selectedClauses.has(c.id));
      onAddClauses(selectedClauseObjects);
      setSelectedClauses(new Set());
    }
  };

  const handleCopyClause = async (clause: Clause) => {
    try {
      await navigator.clipboard.writeText(clause.content);
      toast.success('Clause copied to clipboard');
    } catch {
      toast.error('Failed to copy clause');
    }
  };

  const handleViewDetails = (clause: Clause) => {
    setSelectedClause(clause);
    setShowDetailsDialog(true);
  };

  const getRiskLevelBadge = (riskLevel: string) => {
    const risk = riskLevels.find((r) => r.value === riskLevel);
    return (
      <Badge className={risk?.color}>
        {riskLevel === 'high' && <AlertCircle className="h-3 w-3 mr-1" />}
        {risk?.label}
      </Badge>
    );
  };

  const groupedClauses = filteredClauses.reduce((acc, clause) => {
    if (!acc[clause.category]) {
      acc[clause.category] = [];
    }
    acc[clause.category]!.push(clause);
    return acc;
  }, {} as Record<string, Clause[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading clause library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clause Library</h2>
          <p className="text-gray-600 mt-1">
            {filteredClauses.length} clause{filteredClauses.length !== 1 ? 's' : ''} available
            {selectedClauses.size > 0 && ` • ${selectedClauses.size} selected`}
          </p>
        </div>
        <div className="flex gap-2">
          {multiSelect && selectedClauses.size > 0 && (
            <Button onClick={handleAddSelected} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-2" />
              Add {selectedClauses.size} Clause{selectedClauses.size !== 1 ? 's' : ''}
            </Button>
          )}
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Clause
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search clauses by title, content, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Risk Filter */}
            <Select value={selectedRisk} onValueChange={setSelectedRisk}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                {riskLevels.map((risk) => (
                  <SelectItem key={risk.value} value={risk.value}>
                    {risk.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Favorites Toggle */}
            <Button
              variant={showFavoritesOnly ? 'default' : 'outline'}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Star className={`h-4 w-4 mr-2 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              Favorites
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Clauses List */}
      {filteredClauses.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No clauses found</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedCategory !== 'all' || selectedRisk !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by adding your first clause'}
              </p>
              {!searchQuery && selectedCategory === 'all' && selectedRisk === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Clause
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-4">
          {Object.entries(groupedClauses).map(([category, categoryClauses]) => (
            <AccordionItem key={category} value={category} className="border rounded-lg">
              <AccordionTrigger className="px-6 hover:bg-gray-50">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-medium text-lg">{category}</span>
                  <Badge variant="secondary">{categoryClauses.length} clauses</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-4">
                <div className="space-y-3 mt-3">
                  {categoryClauses.map((clause) => (
                    <Card key={clause.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {/* Checkbox for multi-select */}
                          {multiSelect && (
                            <Checkbox
                              checked={selectedClauses.has(clause.id)}
                              onCheckedChange={() => handleToggleSelect(clause.id)}
                              className="mt-1"
                            />
                          )}

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 mb-1">{clause.title}</h4>
                                {clause.subcategory && (
                                  <p className="text-sm text-gray-600 mb-2">{clause.subcategory}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                {getRiskLevelBadge(clause.riskLevel)}
                                {clause.isStandard && (
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Check className="h-3 w-3 mr-1" />
                                    Standard
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Preview */}
                            <p className="text-sm text-gray-700 line-clamp-2 mb-3">{clause.content}</p>

                            {/* Tags */}
                            {clause.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {clause.tags.map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Stats & Actions */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                {clause.usageCount !== undefined && (
                                  <span>{clause.usageCount} uses</span>
                                )}
                                {clause.variables.length > 0 && (
                                  <span>{clause.variables.length} variables</span>
                                )}
                                {clause.alternativeVersions && clause.alternativeVersions.length > 0 && (
                                  <span>{clause.alternativeVersions.length} alternatives</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleFavorite(clause.id)}
                                >
                                  <Star
                                    className={`h-4 w-4 ${
                                      clause.isFavorite
                                        ? 'fill-yellow-500 text-yellow-500'
                                        : 'text-gray-400'
                                    }`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCopyClause(clause)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewDetails(clause)}
                                >
                                  View Details
                                </Button>
                                {onSelectClause && !multiSelect && (
                                  <Button
                                    size="sm"
                                    onClick={() => onSelectClause(clause)}
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                  >
                                    Use Clause
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Create Clause Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Clause</DialogTitle>
            <DialogDescription>Create a reusable clause for your contract library</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Clause Title</Label>
              <Input
                id="title"
                placeholder="e.g., Confidentiality Obligations"
                value={newClause.title}
                onChange={(e) => setNewClause({ ...newClause, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newClause.category}
                  onValueChange={(value) => setNewClause({ ...newClause, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="riskLevel">Risk Level</Label>
                <Select
                  value={newClause.riskLevel}
                  onValueChange={(value: any) => setNewClause({ ...newClause, riskLevel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {riskLevels.map((risk) => (
                      <SelectItem key={risk.value} value={risk.value}>
                        {risk.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="subcategory">Subcategory (Optional)</Label>
              <Input
                id="subcategory"
                placeholder="e.g., Mutual Confidentiality"
                value={newClause.subcategory}
                onChange={(e) => setNewClause({ ...newClause, subcategory: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="content">Clause Content</Label>
              <Textarea
                id="content"
                placeholder="Enter the clause text with variables like {{party_name}}, {{term_length}}"
                value={newClause.content}
                onChange={(e) => setNewClause({ ...newClause, content: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use double curly braces for variables: {`{{variable_name}}`}
              </p>
            </div>

            <div>
              <Label htmlFor="legalNotes">Legal Notes (Optional)</Label>
              <Textarea
                id="legalNotes"
                placeholder="Add any legal considerations, best practices, or usage notes"
                value={newClause.legalNotes}
                onChange={(e) => setNewClause({ ...newClause, legalNotes: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                placeholder="e.g., confidential, nda, privacy"
                onChange={(e) =>
                  setNewClause({
                    ...newClause,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateClause}
              disabled={!newClause.title || !newClause.category || !newClause.content}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              Add Clause
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clause Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DialogTitle>{selectedClause?.title}</DialogTitle>
                <DialogDescription>{selectedClause?.subcategory}</DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {selectedClause && getRiskLevelBadge(selectedClause.riskLevel)}
                {selectedClause?.isStandard && (
                  <Badge variant="outline" className="bg-blue-50">
                    <Check className="h-3 w-3 mr-1" />
                    Standard
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedClause && (
            <div className="space-y-6">
              {/* Category & Tags */}
              <div>
                <h4 className="font-medium mb-2">Category</h4>
                <Badge variant="secondary">{selectedClause.category}</Badge>
                {selectedClause.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedClause.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <h4 className="font-medium mb-2">Clause Content</h4>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <p className="text-sm whitespace-pre-wrap">{selectedClause.content}</p>
                </div>
              </div>

              {/* Variables */}
              {selectedClause.variables.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Variables ({selectedClause.variables.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedClause.variables.map((variable, idx) => (
                      <Badge key={idx} variant="secondary" className="font-mono">
                        {variable}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Alternative Versions */}
              {selectedClause.alternativeVersions && selectedClause.alternativeVersions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">
                    Alternative Versions ({selectedClause.alternativeVersions.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedClause.alternativeVersions.map((alt, idx) => (
                      <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 text-sm">
                        {alt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal Notes */}
              {selectedClause.legalNotes && (
                <div>
                  <h4 className="font-medium mb-2">Legal Notes</h4>
                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-900">{selectedClause.legalNotes}</p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
                <div>
                  <span className="text-gray-600">Usage Count:</span>{' '}
                  <span className="font-medium">{selectedClause.usageCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-600">Last Updated:</span>{' '}
                  <span className="font-medium">
                    {new Date(selectedClause.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => selectedClause && handleCopyClause(selectedClause)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy to Clipboard
            </Button>
            {onSelectClause && selectedClause && (
              <Button
                onClick={() => {
                  onSelectClause(selectedClause);
                  setShowDetailsDialog(false);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                Use This Clause
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
