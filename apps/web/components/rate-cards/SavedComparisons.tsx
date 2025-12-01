'use client';

/**
 * Saved Comparisons Component
 * 
 * List and manage saved rate card comparisons
 * Requirements: 6.5
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { copyToClipboard } from '@/hooks/useCopyToClipboard';
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
} from 'lucide-react';

interface SavedComparison {
  id: string;
  name: string;
  description?: string;
  comparisonType: string;
  isShared: boolean;
  createdAt: string;
  rateCardEntries: Array<{
    rateCardEntry: {
      id: string;
      supplierName: string;
      roleStandardized: string;
      dailyRateUSD: number;
    };
  }>;
}

interface SavedComparisonsProps {
  onViewComparison?: (comparisonId: string) => void;
}

export function SavedComparisons({ onViewComparison }: SavedComparisonsProps) {
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [comparisonToDelete, setComparisonToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchComparisons();
  }, []);

  const fetchComparisons = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rate-cards/comparisons');
      if (response.ok) {
        const data = await response.json();
        setComparisons(data.comparisons || []);
      }
    } catch (error) {
      console.error('Error fetching comparisons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (comparisonId: string) => {
    if (onViewComparison) {
      onViewComparison(comparisonId);
    } else {
      window.location.href = `/rate-cards/comparisons/${comparisonId}`;
    }
  };

  const handleShare = async (comparisonId: string) => {
    try {
      const response = await fetch(`/api/rate-cards/comparisons/${comparisonId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isShared: true }),
      });

      if (response.ok) {
        const data = await response.json();
        copyToClipboard(window.location.origin + data.shareUrl, {
          successMessage: 'Share link copied to clipboard!',
        });
        fetchComparisons(); // Refresh to show updated share status
      }
    } catch (error) {
      console.error('Error sharing comparison:', error);
      toast.error('Failed to share comparison');
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
        // For PDF, we would need to implement client-side PDF generation
        toast.info('PDF export coming soon!');
      }
    } catch (error) {
      console.error('Error exporting comparison:', error);
      toast.error('Failed to export comparison');
    }
  };

  const openDeleteDialog = (comparisonId: string) => {
    setComparisonToDelete(comparisonId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!comparisonToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/rate-cards/comparisons/${comparisonToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Comparison deleted successfully');
        fetchComparisons(); // Refresh list
      } else {
        toast.error('Failed to delete comparison');
      }
    } catch (error) {
      console.error('Error deleting comparison:', error);
      toast.error('Failed to delete comparison');
    } finally {
      setIsDeleting(false);
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
          <div className="text-center py-8 text-muted-foreground">
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
        <CardHeader>
          <CardTitle className="text-base">Saved Comparisons ({comparisons.length})</CardTitle>
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
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
