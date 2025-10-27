'use client';

/**
 * Saved Filters Component
 * 
 * Manages saved filter presets for quick access
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Trash2, Share2, Users } from 'lucide-react';
import { RateCardFilterCriteria } from './RateCardFilters';

interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filters: RateCardFilterCriteria;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SavedFiltersProps {
  onApplyFilter: (filters: RateCardFilterCriteria) => void;
}

export function SavedFilters({ onApplyFilter }: SavedFiltersProps) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedFilters();
  }, []);

  const fetchSavedFilters = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/rate-cards/filters');
      if (response.ok) {
        const data = await response.json();
        setSavedFilters(data.filters || []);
      }
    } catch (error) {
      console.error('Error fetching saved filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (filter: SavedFilter) => {
    onApplyFilter(filter.filters);
  };

  const handleDeleteFilter = async (filterId: string) => {
    if (!confirm('Are you sure you want to delete this filter?')) {
      return;
    }

    try {
      const response = await fetch(`/api/rate-cards/filters/${filterId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSavedFilters(prev => prev.filter(f => f.id !== filterId));
      }
    } catch (error) {
      console.error('Error deleting filter:', error);
    }
  };

  const handleShareFilter = async (filterId: string) => {
    try {
      const response = await fetch(`/api/rate-cards/filters/${filterId}/share`, {
        method: 'POST',
      });

      if (response.ok) {
        fetchSavedFilters(); // Refresh to show updated share status
      }
    } catch (error) {
      console.error('Error sharing filter:', error);
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
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Loading saved filters...</p>
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
                    onClick={() => handleDeleteFilter(filter.id)}
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
      </CardContent>
    </Card>
  );
}
