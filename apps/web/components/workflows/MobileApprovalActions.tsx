'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  ArrowRight,
  UserPlus,
  MessageSquare,
  X,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround - use 'any' to avoid complex type conflicts with framer-motion
const MotionDiv = motion.div as any;

interface MobileApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  onDelegate?: () => void;
  onEscalate?: () => void;
  onComment?: () => void;
  isProcessing?: boolean;
  processingAction?: 'approve' | 'reject' | 'delegate' | 'escalate' | null;
  className?: string;
}

/**
 * Mobile-optimized approval actions with swipe gestures and bottom sheet
 * Fully accessible with ARIA labels, roles, and keyboard support
 */
export function MobileApprovalActions({
  onApprove,
  onReject,
  onDelegate,
  onEscalate,
  onComment,
  isProcessing = false,
  processingAction = null,
  className,
}: MobileApprovalActionsProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* Fixed bottom action bar */}
      <nav
        role="toolbar"
        aria-label="Approval actions"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-4 safe-area-inset-bottom md:hidden",
          className
        )}
      >
        <div className="flex items-center gap-3">
          {/* Main Actions - Always visible */}
          <button
            onClick={onApprove}
            disabled={isProcessing}
            aria-label="Approve this request"
            aria-busy={isProcessing && processingAction === 'approve'}
            className={cn(
              "flex-1 py-4 px-4 rounded-xl font-semibold text-white transition-all active:scale-95",
              "bg-green-500 hover:bg-green-600 active:bg-green-700",
              "flex items-center justify-center gap-2 text-base",
              "touch-manipulation select-none",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            {isProcessing && processingAction === 'approve' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <ThumbsUp className="w-5 h-5" aria-hidden="true" />
            )}
            <span>Approve</span>
          </button>

          <button
            onClick={onReject}
            disabled={isProcessing}
            aria-label="Reject this request"
            aria-busy={isProcessing && processingAction === 'reject'}
            className={cn(
              "flex-1 py-4 px-4 rounded-xl font-semibold text-white transition-all active:scale-95",
              "bg-red-500 hover:bg-red-600 active:bg-red-700",
              "flex items-center justify-center gap-2 text-base",
              "touch-manipulation select-none",
              "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            {isProcessing && processingAction === 'reject' ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <ThumbsDown className="w-5 h-5" aria-hidden="true" />
            )}
            <span>Reject</span>
          </button>

          {/* More Actions */}
          {(onDelegate || onEscalate || onComment) && (
            <button
              onClick={() => setShowMore(true)}
              aria-label="More actions"
              aria-haspopup="dialog"
              aria-expanded={showMore}
              className={cn(
                "w-14 h-14 rounded-xl font-semibold transition-all active:scale-95",
                "bg-slate-100 hover:bg-slate-200 active:bg-slate-300",
                "flex items-center justify-center",
                "touch-manipulation select-none",
                "focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              )}
            >
              <MoreHorizontal className="w-6 h-6 text-slate-700" aria-hidden="true" />
            </button>
          )}
        </div>
      </nav>

      {/* More actions bottom sheet */}
      <AnimatePresence>
        {showMore && (
          <>
            {/* Backdrop */}
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
              className="fixed inset-0 z-50 bg-black/40 md:hidden"
              aria-hidden="true"
            />
            
            {/* Sheet */}
            <MotionDiv
              role="dialog"
              aria-modal="true"
              aria-label="Additional approval actions"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              onDragEnd={(_e: any, info: any) => {
                if (info.offset.y > 100) {
                  setShowMore(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 safe-area-inset-bottom md:hidden"
            >
              {/* Drag handle */}
              <div 
                className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-6" 
                aria-hidden="true"
              />
              
              <div className="space-y-3" role="menu">
                {onDelegate && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onDelegate();
                    }}
                    role="menuitem"
                    disabled={isProcessing}
                    aria-label="Delegate to a team member"
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none",
                      "focus:outline-none focus:ring-2 focus:ring-blue-500",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing && processingAction === 'delegate' ? (
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserPlus className="w-5 h-5" aria-hidden="true" />
                    )}
                    Delegate to Team Member
                  </button>
                )}

                {onEscalate && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onEscalate();
                    }}
                    role="menuitem"
                    disabled={isProcessing}
                    aria-label="Escalate to manager"
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-purple-50 text-purple-700 hover:bg-purple-100 active:bg-purple-200",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isProcessing && processingAction === 'escalate' ? (
                      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <ArrowRight className="w-5 h-5" aria-hidden="true" />
                    )}
                    Escalate to Manager
                  </button>
                )}

                {onComment && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onComment();
                    }}
                    role="menuitem"
                    disabled={isProcessing}
                    aria-label="Add a comment"
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none",
                      "focus:outline-none focus:ring-2 focus:ring-slate-500"
                    )}
                  >
                    <MessageSquare className="w-5 h-5" aria-hidden="true" />
                    Add Comment
                  </button>
                )}

                {/* Cancel */}
                <button
                  onClick={() => setShowMore(false)}
                  role="menuitem"
                  aria-label="Close menu"
                  className={cn(
                    "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                    "bg-slate-200 text-slate-700 hover:bg-slate-300",
                    "flex items-center justify-center gap-2 text-base mt-2",
                    "touch-manipulation select-none",
                    "focus:outline-none focus:ring-2 focus:ring-slate-500"
                  )}
                >
                  Cancel
                </button>
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

interface SwipeableApprovalCardProps {
  children: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  disabled?: boolean;
  approvalTitle?: string;
  className?: string;
}

/**
 * Swipeable card for quick approve/reject gestures on mobile
 * Includes accessibility hints for screen readers
 */
export function SwipeableApprovalCard({
  children,
  onApprove,
  onReject,
  disabled = false,
  approvalTitle = 'this approval',
  className,
}: SwipeableApprovalCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const threshold = 100;

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    
    if (disabled) return;
    
    if (info.offset.x > threshold) {
      onApprove();
    } else if (info.offset.x < -threshold) {
      onReject();
    }
    
    setDragX(0);
  };

  // Determine swipe hint text
  const getSwipeHint = () => {
    if (dragX > 50) return 'Release to approve';
    if (dragX < -50) return 'Release to reject';
    return 'Swipe right to approve, left to reject';
  };

  return (
    <div 
      className={cn("relative overflow-hidden touch-pan-y", className)}
      role="article"
      aria-label={`Approval card for ${approvalTitle}`}
    >
      {/* Screen reader hint */}
      <span className="sr-only">
        {disabled ? 'Actions disabled' : getSwipeHint()}
      </span>
      
      {/* Background actions */}
      <div className="absolute inset-0 flex" aria-hidden="true">
        <div className={cn(
          "flex-1 flex items-center justify-start pl-6 transition-colors",
          dragX > 50 ? "bg-green-500" : "bg-green-100"
        )}>
          <ThumbsUp className={cn(
            "w-8 h-8 transition-colors",
            dragX > 50 ? "text-white" : "text-green-500"
          )} />
          {dragX > 50 && (
            <span className="ml-2 text-white font-semibold">Approve</span>
          )}
        </div>
        <div className={cn(
          "flex-1 flex items-center justify-end pr-6 transition-colors",
          dragX < -50 ? "bg-red-500" : "bg-red-100"
        )}>
          {dragX < -50 && (
            <span className="mr-2 text-white font-semibold">Reject</span>
          )}
          <ThumbsDown className={cn(
            "w-8 h-8 transition-colors",
            dragX < -50 ? "text-white" : "text-red-500"
          )} />
        </div>
      </div>
      
      {/* Main card */}
      <MotionDiv
        drag={disabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragStart={() => setIsDragging(true)}
        onDrag={(_e: any, info: any) => setDragX(info.offset.x)}
        onDragEnd={handleDragEnd}
        style={{ x: isDragging ? dragX : 0 }}
        className="relative bg-white"
      >
        {children}
      </MotionDiv>
    </div>
  );
}

interface QuickActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: 'approve' | 'reject' | 'default' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Touch-optimized action button with haptic-like feedback
 * Includes loading states and full accessibility support
 */
export function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  isLoading = false,
  className,
}: QuickActionButtonProps) {
  const variantStyles = {
    approve: 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white focus:ring-green-500',
    reject: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white focus:ring-red-500',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white focus:ring-amber-500',
    default: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 focus:ring-slate-500',
  };

  const sizeStyles = {
    sm: 'py-2 px-3 text-sm gap-1.5 rounded-lg min-h-[36px]',
    md: 'py-3 px-4 text-base gap-2 rounded-xl min-h-[48px]',
    lg: 'py-4 px-6 text-lg gap-3 rounded-2xl min-h-[56px]',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      aria-busy={isLoading}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all",
        "touch-manipulation select-none active:scale-95",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && "opacity-50 cursor-not-allowed active:scale-100",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className={cn(iconSizes[size], "animate-spin")} aria-hidden="true" />
      ) : (
        <Icon className={iconSizes[size]} aria-hidden="true" />
      )}
      <span>{label}</span>
    </button>
  );
}

export default MobileApprovalActions;
