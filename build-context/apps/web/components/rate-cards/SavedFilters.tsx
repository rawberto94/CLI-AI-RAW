'use client';

/**
 * Saved Filters Component
 * 
 * Manages saved filter presets for quick access.
 * Uses React Query for data fetching with optimistic mutations.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { Bookmark, Trash2, Share2, Users, RefreshCw, Loader2 } from 'lucide-react';
import { RateCardFilterCriteria } from './RateCardFilters';
import { 
  useSavedFiltersQuery, 
  useDeleteSavedFilterMutation, 
  useShareFilterMutation,
  type SavedFilter 
} from '@/hooks/use-saved-items-queries';
import { DataFreshnessIndicator } from '@/components/shared/DataFreshnessIndicator';

interface SavedFiltersProps {
  onApplyFilter: (filters: RateCardFilterCriteria) => void;
}

export function SavedFilters({ onApplyFilter }: SavedFiltersProps) {
  const { 
    data: savedFilters = [], 
    isLoading: loading, 
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useSavedFiltersQuery();
  
  const deleteMutation = useDeleteSavedFilterMutation();
  const shareMutation = useShareFilterMutation();
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filterToDelete, setFilterToDelete] = useState<string | null>(null);

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.filters as RateCardFilterCriteria);
    toast.success(`Filter "${filter.name}" applied`);
  };

  const openDeleteDialog = (filterId: string) => {
    setFilterToDelete(filterId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteFilter = async () => {
    if (!filterToDelete) return;
    
    try {
      await deleteMutation.mutateAsync(filterToDelete);
    } catch (error) {
      // Error handled in mutation
    } finally {
      setDeleteDialogOpen(false);
      setFilterToDelete(null);
    }
  };

  const handleShareFilter = async (filterId: string) => {
    try {
      await shareMutation.mutateAsync(filterId);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const getFilterSummary = (filters: RateCardFilterCriteria): string => {
    const parts: string[] = [];
    
    if (filters.supplier) parts.push(`Supplier: ${filters.supplier}`);
    if (filters.role) parts.push(`Role: ${filters.role}`);
    if (filters.seniority) parts.push(`Seniority: ${filters.seniority}`);
    if (filters.lineOfService) parts.push(`Service: ${filters.lineOfService}`);
    if (filters.country) parts.push(`Country: ${filters.country}`);
    if (filters.region) parts.push(`Region: ${filters.region}`);
    if (filters.rateMin || filters.rateMax) {
      parts.push(`Rate: $${filters.rateMin || 0}-${filters.rateMax || '∞'}`);
    }

    return parts.join(' • ') || 'No filters';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading saved filters...
        </CardContent>
      </Card>
    );
  }

  if (savedFilters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Saved Filters
          </CardTitle>
          <CardDescription>
            No saved filters yet. Create filters and save them for quick access.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-5 w-5" />
          Saved Filters
          <Badge variant="secondary">{savedFilters.length}</Badge>
        </CardTitle>
        <CardDescription>
          Quick access to your frequently used filter combinations
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {savedFilters.map((filter) => (
            <div
              key={filter.id}
              className="p-4 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{filter.name}</h4>
                    {filter.isShared && (
                      <Badge variant="outline" className="text-xs">
                        <Users className="h-3 w-3 mr-1" />
                        Shared
                      </Badge>
                    )}
                  </div>
                  {filter.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {filter.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {getFilterSummary(filter.filters)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleApplyFilter(filter)}
                  >
                    Apply
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleShareFilter(filter.id)}
                    title={filter.isShared ? 'Unshare' : 'Share with team'}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(filter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Last updated: {new Date(filter.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Filter"
          description="Are you sure you want to delete this saved filter? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          isLoading={deleteMutation.isPending}
          onConfirm={handleDeleteFilter}
        />
      </CardContent>
    </Card>
  );
}
