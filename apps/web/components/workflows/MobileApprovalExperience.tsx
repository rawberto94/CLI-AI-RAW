'use client';

import { useState, useRef, useCallback, TouchEvent as ReactTouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { 
  Check, 
  X, 
  MoreHorizontal,
  MessageSquare,
  Clock,
  AlertTriangle,
  ChevronRight,
  User,
  DollarSign,
  Calendar,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';

// Types
interface MobileApprovalItem {
  id: string;
  title: string;
  contractType?: string;
  vendor?: string;
  value?: number;
  deadline?: Date;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected';
  requester?: string;
  requestedAt?: Date;
  aiSuggestion?: 'approve' | 'reject' | 'review';
  aiConfidence?: number;
}

interface SwipeableApprovalCardProps {
  item: MobileApprovalItem;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewDetails: (id: string) => void;
  onComment: (id: string) => void;
  disabled?: boolean;
}

// Swipe threshold in pixels
const SWIPE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;

export function SwipeableApprovalCard({
  item,
  onApprove,
  onReject,
  onViewDetails,
  onComment,
  disabled = false
}: SwipeableApprovalCardProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const x = useMotionValue(0);
  
  // Transform x position to background colors
  const approveOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const scale = useTransform(
    x, 
    [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD], 
    [0.95, 1, 0.95]
  );

  const handleDragEnd = useCallback((_event: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    
    // Check if swipe was fast enough or far enough
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > SWIPE_VELOCITY_THRESHOLD) {
      if (offset.x > 0) {
        onApprove(item.id);
      } else {
        onReject(item.id);
      }
    }
  }, [item.id, onApprove, onReject]);

  const priorityConfig = {
    low: { color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', label: 'Low' },
    medium: { color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400', label: 'Medium' },
    high: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', label: 'High' },
    urgent: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', label: 'Urgent' }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div 
      className="relative overflow-hidden rounded-lg mb-3"
      role="listitem"
      aria-label={`Approval request: ${item.title}${item.vendor ? ` from ${item.vendor}` : ''}${item.value ? `, ${formatCurrency(item.value)}` : ''}`}
    >
      {/* Background actions revealed on swipe */}
      <div className="absolute inset-0 flex" aria-hidden="true">
        {/* Approve background (right swipe) */}
        <motion.div 
          className="flex-1 bg-green-500 flex items-center justify-start pl-6"
          style={{ opacity: approveOpacity }}
        >
          <div className="flex flex-col items-center text-white">
            <Check className="h-8 w-8" />
            <span className="text-sm font-medium mt-1">Approve</span>
          </div>
        </motion.div>
        
        {/* Reject background (left swipe) */}
        <motion.div 
          className="flex-1 bg-red-500 flex items-center justify-end pr-6"
          style={{ opacity: rejectOpacity }}
        >
          <div className="flex flex-col items-center text-white">
            <X className="h-8 w-8" />
            <span className="text-sm font-medium mt-1">Reject</span>
          </div>
        </motion.div>
      </div>

      {/* Main card - draggable */}
      <motion.div
        style={{ x, scale }}
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="relative bg-background touch-pan-y"
        role="button"
        tabIndex={0}
        aria-describedby={`swipe-hint-${item.id}`}
      >
        <Card 
          className="cursor-grab active:cursor-grabbing border-0 shadow-md focus-within:ring-2 focus-within:ring-primary/50"
          onClick={() => onViewDetails(item.id)}
        >
          <CardContent className="p-4">
            {/* Header row */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base truncate pr-2">
                  {item.title}
                </h3>
                {item.vendor && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                    <User size={12} />
                    <span className="truncate">{item.vendor}</span>
                  </div>
                )}
              </div>
              {item.priority && (
                <Badge className={cn('shrink-0', priorityConfig[item.priority].color)}>
                  {priorityConfig[item.priority].label}
                </Badge>
              )}
            </div>

            {/* Details row */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
              {item.value && (
                <div className="flex items-center gap-1">
                  <DollarSign size={14} />
                  <span className="font-medium text-foreground">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              )}
              {item.deadline && (
                <div className={cn(
                  'flex items-center gap-1',
                  new Date(item.deadline) < new Date() && 'text-red-500'
                )}>
                  <Calendar size={14} />
                  <span>{formatDate(item.deadline)}</span>
                </div>
              )}
              {item.contractType && (
                <Badge variant="outline" className="text-xs">
                  {item.contractType}
                </Badge>
              )}
            </div>

            {/* AI Suggestion preview */}
            {item.aiSuggestion && (
              <div className="flex items-center gap-2 p-2 rounded-md bg-violet-50 dark:bg-violet-900/20 mb-3">
                <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
                <span className="text-xs text-violet-700 dark:text-violet-300">
                  AI suggests: <span className="font-medium capitalize">{item.aiSuggestion}</span>
                  {item.aiConfidence && ` (${item.aiConfidence}%)`}
                </span>
              </div>
            )}

            {/* Quick actions */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground" id={`swipe-hint-${item.id}`}>
                <span className="hidden sm:inline">← Reject</span>
                <span className="sm:hidden">Swipe to approve/reject</span>
                <span className="hidden sm:inline"> | Approve →</span>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  aria-label="Add comment"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComment(item.id);
                  }}
                >
                  <MessageSquare size={16} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  aria-label="View details"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(item.id);
                  }}
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// Mobile approval list with pull-to-refresh
interface MobileApprovalListProps {
  items: MobileApprovalItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onViewDetails: (id: string) => void;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function MobileApprovalList({
  items,
  onApprove,
  onReject,
  onViewDetails,
  onRefresh,
  isLoading = false,
  emptyMessage = 'No pending approvals'
}: MobileApprovalListProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (containerRef.current?.scrollTop === 0 && onRefresh && touch) {
      startY.current = touch.clientY;
      isPulling.current = true;
    }
  }, [onRefresh]);

  const handleTouchMove = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    if (!isPulling.current || !onRefresh) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    const currentY = touch.clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  }, [onRefresh]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || !onRefresh) return;
    
    if (pullDistance > 60) {
      setIsRefreshing(true);
      await onRefresh();
      setIsRefreshing(false);
    }
    
    setPullDistance(0);
    isPulling.current = false;
  }, [pullDistance, onRefresh]);

  const handleComment = useCallback((id: string) => {
    setSelectedItemId(id);
    setCommentDrawerOpen(true);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="h-full overflow-y-auto overscroll-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      <AnimatePresence>
        {pullDistance > 0 && (
          <motion.div 
            className="flex items-center justify-center py-4"
            style={{ height: pullDistance }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              animate={{ rotate: isRefreshing ? 360 : pullDistance * 2 }}
              transition={{ duration: isRefreshing ? 1 : 0, repeat: isRefreshing ? Infinity : 0 }}
            >
              <Clock className={cn(
                'h-6 w-6',
                pullDistance > 60 ? 'text-primary' : 'text-muted-foreground'
              )} />
            </motion.div>
            <span className="ml-2 text-sm text-muted-foreground">
              {pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {isLoading && items.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse space-y-4 w-full px-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-4 rounded-full bg-muted mb-4">
            <Check className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-center">{emptyMessage}</p>
        </div>
      )}

      {/* Approval cards */}
      <div className="px-4 py-2">
        <AnimatePresence>
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ delay: index * 0.05 }}
            >
              <SwipeableApprovalCard
                item={item}
                onApprove={onApprove}
                onReject={onReject}
                onViewDetails={onViewDetails}
                onComment={handleComment}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Comment drawer */}
      <CommentDrawer
        open={commentDrawerOpen}
        onOpenChange={setCommentDrawerOpen}
        itemId={selectedItemId}
      />
    </div>
  );
}

// Comment drawer for mobile
interface CommentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string | null;
  onSubmit?: (id: string, comment: string) => void;
}

function CommentDrawer({ open, onOpenChange, itemId, onSubmit }: CommentDrawerProps) {
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    if (itemId && comment.trim()) {
      onSubmit?.(itemId, comment);
      setComment('');
      onOpenChange(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Add Comment</DrawerTitle>
          <DrawerDescription>
            Add a comment or note to this approval
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4">
          <Textarea
            placeholder="Type your comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="resize-none"
          />
        </div>
        <DrawerFooter>
          <Button onClick={handleSubmit} disabled={!comment.trim()}>
            Submit Comment
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Quick action buttons for mobile bottom bar
interface MobileQuickActionsProps {
  selectedCount: number;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onClearSelection: () => void;
  disabled?: boolean;
}

export function MobileQuickActions({
  selectedCount,
  onApproveSelected,
  onRejectSelected,
  onClearSelection,
  disabled = false
}: MobileQuickActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg safe-area-inset-bottom"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">
          {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>
      <div className="flex gap-2">
        <Button 
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={onApproveSelected}
          disabled={disabled}
        >
          <Check size={18} className="mr-2" />
          Approve All
        </Button>
        <Button 
          variant="destructive"
          className="flex-1"
          onClick={onRejectSelected}
          disabled={disabled}
        >
          <X size={18} className="mr-2" />
          Reject All
        </Button>
      </div>
    </motion.div>
  );
}

// Mobile filter chips
interface FilterChip {
  id: string;
  label: string;
  active: boolean;
}

interface MobileFilterChipsProps {
  filters: FilterChip[];
  onToggle: (filterId: string) => void;
  className?: string;
}

export function MobileFilterChips({ filters, onToggle, className }: MobileFilterChipsProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-2 px-4 -mx-4 scrollbar-hide', className)}>
      {filters.map(filter => (
        <button
          key={filter.id}
          onClick={() => onToggle(filter.id)}
          className={cn(
            'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            filter.active 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

// Mobile stats summary
interface MobileStatsSummaryProps {
  stats: {
    pending: number;
    approved: number;
    rejected: number;
    urgent: number;
  };
  className?: string;
}

export function MobileStatsSummary({ stats, className }: MobileStatsSummaryProps) {
  return (
    <div className={cn('grid grid-cols-4 gap-2 px-4', className)}>
      <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
        <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
          {stats.pending}
        </div>
        <div className="text-xs text-muted-foreground">Pending</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
        <div className="text-xl font-bold text-green-600 dark:text-green-400">
          {stats.approved}
        </div>
        <div className="text-xs text-muted-foreground">Approved</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
        <div className="text-xl font-bold text-red-600 dark:text-red-400">
          {stats.rejected}
        </div>
        <div className="text-xs text-muted-foreground">Rejected</div>
      </div>
      <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
        <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
          {stats.urgent}
        </div>
        <div className="text-xs text-muted-foreground">Urgent</div>
      </div>
    </div>
  );
}

// Hook for detecting mobile viewport
export function useMobileView(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);

  // Use effect to check on mount and window resize
  if (typeof window !== 'undefined') {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    
    // Check on mount
    if (typeof window !== 'undefined' && !isMobile && window.innerWidth < breakpoint) {
      setIsMobile(true);
    }
  }

  return isMobile;
}

export default MobileApprovalList;
