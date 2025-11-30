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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Framer Motion typing workaround
const MotionDiv = motion.div as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & {
    initial?: object;
    animate?: object;
    exit?: object;
    drag?: boolean | 'x' | 'y';
    dragConstraints?: object;
    onDragEnd?: (e: any, info: any) => void;
    style?: React.CSSProperties;
    className?: string;
  }
>;

interface MobileApprovalActionsProps {
  onApprove: () => void;
  onReject: () => void;
  onDelegate?: () => void;
  onEscalate?: () => void;
  onComment?: () => void;
  isProcessing?: boolean;
  className?: string;
}

/**
 * Mobile-optimized approval actions with swipe gestures and bottom sheet
 */
export function MobileApprovalActions({
  onApprove,
  onReject,
  onDelegate,
  onEscalate,
  onComment,
  isProcessing = false,
  className,
}: MobileApprovalActionsProps) {
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {/* Fixed bottom action bar */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-4 safe-area-inset-bottom md:hidden",
        className
      )}>
        <div className="flex items-center gap-3">
          {/* Main Actions - Always visible */}
          <button
            onClick={onApprove}
            disabled={isProcessing}
            className={cn(
              "flex-1 py-4 px-4 rounded-xl font-semibold text-white transition-all active:scale-95",
              "bg-green-500 hover:bg-green-600 active:bg-green-700",
              "flex items-center justify-center gap-2 text-base",
              "touch-manipulation select-none",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            <ThumbsUp className="w-5 h-5" />
            Approve
          </button>

          <button
            onClick={onReject}
            disabled={isProcessing}
            className={cn(
              "flex-1 py-4 px-4 rounded-xl font-semibold text-white transition-all active:scale-95",
              "bg-red-500 hover:bg-red-600 active:bg-red-700",
              "flex items-center justify-center gap-2 text-base",
              "touch-manipulation select-none",
              isProcessing && "opacity-50 cursor-not-allowed"
            )}
          >
            <ThumbsDown className="w-5 h-5" />
            Reject
          </button>

          {/* More Actions */}
          {(onDelegate || onEscalate || onComment) && (
            <button
              onClick={() => setShowMore(true)}
              className={cn(
                "w-14 h-14 rounded-xl font-semibold transition-all active:scale-95",
                "bg-slate-100 hover:bg-slate-200 active:bg-slate-300",
                "flex items-center justify-center",
                "touch-manipulation select-none"
              )}
            >
              <MoreHorizontal className="w-6 h-6 text-slate-700" />
            </button>
          )}
        </div>
      </div>

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
            />
            
            {/* Sheet */}
            <MotionDiv
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setShowMore(false);
                }
              }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 safe-area-inset-bottom md:hidden"
            >
              {/* Drag handle */}
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-6" />
              
              <div className="space-y-3">
                {onDelegate && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onDelegate();
                    }}
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-blue-50 text-blue-700 hover:bg-blue-100 active:bg-blue-200",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none"
                    )}
                  >
                    <UserPlus className="w-5 h-5" />
                    Delegate to Team Member
                  </button>
                )}

                {onEscalate && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onEscalate();
                    }}
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-purple-50 text-purple-700 hover:bg-purple-100 active:bg-purple-200",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none"
                    )}
                  >
                    <ArrowRight className="w-5 h-5" />
                    Escalate to Manager
                  </button>
                )}

                {onComment && (
                  <button
                    onClick={() => {
                      setShowMore(false);
                      onComment();
                    }}
                    className={cn(
                      "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                      "bg-slate-100 text-slate-700 hover:bg-slate-200 active:bg-slate-300",
                      "flex items-center justify-center gap-3 text-base",
                      "touch-manipulation select-none"
                    )}
                  >
                    <MessageSquare className="w-5 h-5" />
                    Add Comment
                  </button>
                )}

                {/* Cancel */}
                <button
                  onClick={() => setShowMore(false)}
                  className={cn(
                    "w-full py-4 px-4 rounded-xl font-semibold transition-all active:scale-[0.98]",
                    "bg-slate-200 text-slate-700 hover:bg-slate-300",
                    "flex items-center justify-center gap-2 text-base mt-2",
                    "touch-manipulation select-none"
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
  className?: string;
}

/**
 * Swipeable card for quick approve/reject gestures on mobile
 */
export function SwipeableApprovalCard({
  children,
  onApprove,
  onReject,
  disabled = false,
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

  return (
    <div className={cn("relative overflow-hidden touch-pan-y", className)}>
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        <div className={cn(
          "flex-1 flex items-center justify-start pl-6 transition-colors",
          dragX > 50 ? "bg-green-500" : "bg-green-100"
        )}>
          <ThumbsUp className={cn(
            "w-8 h-8 transition-colors",
            dragX > 50 ? "text-white" : "text-green-500"
          )} />
        </div>
        <div className={cn(
          "flex-1 flex items-center justify-end pr-6 transition-colors",
          dragX < -50 ? "bg-red-500" : "bg-red-100"
        )}>
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
        onDrag={(_, info) => setDragX(info.offset.x)}
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
  className?: string;
}

/**
 * Touch-optimized action button with haptic-like feedback
 */
export function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
}: QuickActionButtonProps) {
  const variantStyles = {
    approve: 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white',
    reject: 'bg-red-500 hover:bg-red-600 active:bg-red-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white',
    default: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700',
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

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-all",
        "touch-manipulation select-none active:scale-95",
        variantStyles[variant],
        sizeStyles[size],
        disabled && "opacity-50 cursor-not-allowed active:scale-100",
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>{label}</span>
    </button>
  );
}

export default MobileApprovalActions;
