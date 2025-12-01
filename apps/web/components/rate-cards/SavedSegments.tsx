'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { 
  Folder, 
  Share2, 
  Trash2, 
  Copy, 
  MoreVertical,
  Users,
  User,
  TrendingUp
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Segment {
  id: string;
  name: string;
  description?: string;
  filters: any;
  shared: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface SavedSegmentsProps {
  tenantId: string;
  userId: string;
  onSelectSegment: (segment: Segment) => void;
  onRefresh?: () => void;
}

export function SavedSegments({
  tenantId,
  userId,
  onSelectSegment,
  onRefresh,
}: SavedSegmentsProps) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showShared, setShowShared] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [segmentToDelete, setSegmentToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadSegments();
  }, [tenantId, userId, showShared]);

  const loadSegments = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/rate-cards/segments?tenantId=${tenantId}&userId=${userId}&includeShared=${showShared}`
      );

      if (response.ok) {
        const data = await response.json();
        setSegments(data.segments || []);
      }
    } catch (error) {
      console.error('Error loading segments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async (segmentId: string) => {
    try {
      const response = await fetch(`/api/rate-cards/segments/${segmentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId }),
      });

      if (response.ok) {
        loadSegments();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error sharing segment:', error);
    }
  };

  const handleUnshare = async (segmentId: string) => {
    try {
      const response = await fetch(
        `/api/rate-cards/segments/${segmentId}/share?tenantId=${tenantId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Segment unshared');
        loadSegments();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error unsharing segment:', error);
      toast.error('Failed to unshare segment');
    }
  };

  const openDeleteDialog = (segmentId: string) => {
    setSegmentToDelete(segmentId);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!segmentToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/rate-cards/segments/${segmentToDelete}?tenantId=${tenantId}&userId=${userId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        toast.success('Segment deleted successfully');
        loadSegments();
        onRefresh?.();
      } else {
        toast.error('Failed to delete segment');
      }
    } catch (error) {
      console.error('Error deleting segment:', error);
      toast.error('Failed to delete segment');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setSegmentToDelete(null);
    }
  };

  const handleDuplicate = async (segment: Segment) => {
    try {
      const response = await fetch('/api/rate-cards/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          userId,
          name: `${segment.name} (Copy)`,
          description: segment.description,
          filters: segment.filters,
          shared: false,
        }),
      });

      if (response.ok) {
        loadSegments();
        onRefresh?.();
      }
    } catch (error) {
      console.error('Error duplicating segment:', error);
    }
  };

  const mySegments = segments.filter((s) => s.user.id === userId);
  const sharedSegments = segments.filter((s) => s.user.id !== userId && s.shared);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            Saved Segments
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={showShared ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowShared(!showShared)}
            >
              <Users className="h-4 w-4 mr-2" />
              {showShared ? 'Hide' : 'Show'} Shared
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading segments...</div>
        ) : (
          <>
            {/* My Segments */}
            {mySegments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <User className="h-4 w-4" />
                  My Segments
                </div>
                {mySegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onSelectSegment(segment)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{segment.name}</span>
                        {segment.shared && (
                          <Badge variant="secondary" className="text-xs">
                            <Share2 className="h-3 w-3 mr-1" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {segment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Used {segment.usageCount} times
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onSelectSegment(segment);
                        }}>
                          Apply Filter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(segment);
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {segment.shared ? (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleUnshare(segment.id);
                          }}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Unshare
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleShare(segment.id);
                          }}>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share with Team
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteDialog(segment.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}

            {/* Shared Segments */}
            {showShared && sharedSegments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Shared by Team
                </div>
                {sharedSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => onSelectSegment(segment)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{segment.name}</span>
                        <Badge variant="outline" className="text-xs">
                          by {segment.user.name || segment.user.email}
                        </Badge>
                      </div>
                      {segment.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {segment.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Used {segment.usageCount} times
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          onSelectSegment(segment);
                        }}>
                          Apply Filter
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(segment);
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate to My Segments
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {mySegments.length === 0 && (!showShared || sharedSegments.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No saved segments yet</p>
                <p className="text-sm mt-1">Create filters and save them for quick access</p>
              </div>
            )}
          </>
        )}

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete Segment"
          description="Are you sure you want to delete this segment? This action cannot be undone."
          confirmLabel="Delete"
          variant="destructive"
          isLoading={isDeleting}
          onConfirm={handleDelete}
        />
      </CardContent>
    </Card>
  );
}
