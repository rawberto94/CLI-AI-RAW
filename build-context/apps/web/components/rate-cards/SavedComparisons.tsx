'use client';

/**
 * Saved Comparisons Component
 * 
 * List and manage saved rate card comparisons.
 * Uses React Query for data fetching with optimistic mutations.
 * Requirements: 6.5
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  GitCompare,
  MoreVertical,
  Eye,
  Share2,
  Download,
  Trash2,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { 
  useSavedComparisonsQuery, 
  useDeleteComparisonMutation, 
  useShareComparisonMutation,
  type SavedComparison 
} from '@/hooks/use-saved-items-queries';
import { DataFreshnessIndicator } from '@/components/shared/DataFreshnessIndicator';

interface SavedComparisonsProps {
  onViewComparison?: (comparisonId: string) => void;
}

export function SavedComparisons({ onViewComparison }: SavedComparisonsProps) {
  const { 
    data: comparisons = [], 
    isLoading: loading, 
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useSavedComparisonsQuery();
  
  const deleteMutation = useDeleteComparisonMutation();
  const shareMutation = useShareComparisonMutation();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comparisonToDelete, setComparisonToDelete] = useState<string | null>(null);

  const handleView = (comparisonId: string) => {
    if (onViewComparison) {
      onViewComparison(comparisonId);
    } else {
      window.location.href = `/rate-cards/comparisons/${comparisonId}`;
    }
  };

  const handleShare = async (comparisonId: string) => {
    try {
      await shareMutation.mutateAsync(comparisonId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleExport = async (comparisonId: string, format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/rate-cards/comparisons/${comparisonId}/export?format=${format}`);
      
      if (format === 'csv' && response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rate-comparison-${comparisonId}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('CSV exported successfully');
      } else if (format === 'pdf') {
        toast.info('PDF export requires additional setup. Use CSV export for now.');
      }
    } catch {
      toast.error('Failed to export comparison');
    }
  };

  const openDeleteDialog = (comparisonId: string) => {
    setComparisonToDelete(comparisonId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!comparisonToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(comparisonToDelete);
    } catch (error) {
      // Error handled in mutation
    } finally {
      setDeleteDialogOpen(false);
      setComparisonToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getLowestRate = (comparison: SavedComparison) => {
    const rates = comparison.rateCardEntries.map(entry => entry.rateCardEntry.dailyRateUSD);
    return Math.min(...rates);
  };

  const getHighestRate = (comparison: SavedComparison) => {
    const rates = comparison.rateCardEntries.map(entry => entry.rateCardEntry.dailyRateUSD);
    return Math.max(...rates);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved comparisons...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <GitCompare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No saved comparisons yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create a comparison to save it for later
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Saved Comparisons ({comparisons.length})</CardTitle>
            <DataFreshnessIndicator
              dataUpdatedAt={dataUpdatedAt}
              isFetching={isFetching}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {comparisons.map((comparison) => (
              <div
                key={comparison.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium">{comparison.name}</h3>
                    {comparison.isShared && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Shared
                      </Badge>
                    )}
                    <Badge variant="outline">{comparison.comparisonType}</Badge>
                  </div>

                  {comparison.description && (
                    <p className="text-sm text-muted-foreground">{comparison.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitCompare className="h-4 w-4" />
                      {comparison.rateCardEntries.length} rate cards
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(comparison.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Range: </span>
                      <span className="font-semibold text-green-600">
                        ${getLowestRate(comparison).toLocaleString()}
                      </span>
                      <span className="text-muted-foreground"> - </span>
                      <span className="font-semibold text-red-600">
                        ${getHighestRate(comparison).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(comparison.id)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleShare(comparison.id)}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Share
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(comparison.id, 'csv')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(comparison.id, 'pdf')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => openDeleteDialog(comparison.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Comparison"
        description="Are you sure you want to delete this comparison? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}
