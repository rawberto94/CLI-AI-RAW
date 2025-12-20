'use client';

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Calendar,
  DollarSign,
  FileText,
  AlertTriangle,
  Shield,
  Plus,
  Upload,
  Sparkles,
  ArrowRight,
  Search,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateType =
  | 'no-parties'
  | 'no-dates'
  | 'no-value'
  | 'no-risks'
  | 'no-compliance'
  | 'no-summary'
  | 'no-activity'
  | 'no-reminders'
  | 'processing'
  | 'error';

interface EnhancedEmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  isProcessing?: boolean;
  progress?: number;
  className?: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateType, {
  icon: React.ElementType;
  defaultTitle: string;
  defaultDescription: string;
  illustration: string;
  color: string;
  bgGradient: string;
}> = {
  'no-parties': {
    icon: Users,
    defaultTitle: 'No Parties Identified',
    defaultDescription: 'Contract parties will appear here once AI analysis is complete, or you can add them manually.',
    illustration: '👥',
    color: 'text-blue-500',
    bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
  },
  'no-dates': {
    icon: Calendar,
    defaultTitle: 'No Dates Found',
    defaultDescription: 'Key contract dates like effective date, expiration, and renewal will appear here.',
    illustration: '📅',
    color: 'text-emerald-500',
    bgGradient: 'from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30',
  },
  'no-value': {
    icon: DollarSign,
    defaultTitle: 'Contract Value Not Set',
    defaultDescription: 'Add the total contract value and payment terms for better tracking.',
    illustration: '💰',
    color: 'text-amber-500',
    bgGradient: 'from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30',
  },
  'no-risks': {
    icon: AlertTriangle,
    defaultTitle: 'No Risks Identified',
    defaultDescription: 'AI risk analysis will highlight potential concerns and areas needing attention.',
    illustration: '🛡️',
    color: 'text-orange-500',
    bgGradient: 'from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30',
  },
  'no-compliance': {
    icon: Shield,
    defaultTitle: 'Compliance Status Unknown',
    defaultDescription: 'Run compliance checks to verify regulatory adherence.',
    illustration: '✅',
    color: 'text-purple-500',
    bgGradient: 'from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30',
  },
  'no-summary': {
    icon: FileText,
    defaultTitle: 'Summary Not Available',
    defaultDescription: 'An AI-generated summary will appear here once the contract is processed.',
    illustration: '📝',
    color: 'text-slate-500',
    bgGradient: 'from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30',
  },
  'no-activity': {
    icon: Clock,
    defaultTitle: 'No Recent Activity',
    defaultDescription: 'Activity like edits, views, and comments will be tracked here.',
    illustration: '📊',
    color: 'text-cyan-500',
    bgGradient: 'from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/30',
  },
  'no-reminders': {
    icon: Clock,
    defaultTitle: 'No Reminders Set',
    defaultDescription: 'Set reminders for important dates like renewals and expirations.',
    illustration: '⏰',
    color: 'text-rose-500',
    bgGradient: 'from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30',
  },
  'processing': {
    icon: RefreshCw,
    defaultTitle: 'Processing Contract',
    defaultDescription: 'AI is analyzing your contract. This may take a few moments.',
    illustration: '⚙️',
    color: 'text-blue-500',
    bgGradient: 'from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30',
  },
  'error': {
    icon: AlertTriangle,
    defaultTitle: 'Something Went Wrong',
    defaultDescription: 'We couldn\'t load this data. Please try again.',
    illustration: '⚠️',
    color: 'text-red-500',
    bgGradient: 'from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30',
  },
};

export const EnhancedEmptyState = memo(function EnhancedEmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  isProcessing = false,
  progress,
  className = '',
}: EnhancedEmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-dashed",
        `bg-gradient-to-br ${config.bgGradient}`,
        "border-slate-200 dark:border-slate-700",
        className
      )}
    >
      {/* Decorative Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      <div className="relative py-8 px-6 text-center">
        {/* Animated Icon/Illustration */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mb-4"
        >
          <div className="relative inline-flex">
            {/* Background Glow */}
            <div className={cn(
              "absolute inset-0 rounded-full blur-xl opacity-30",
              config.color.replace('text-', 'bg-')
            )} />
            
            {/* Icon Container */}
            <div className={cn(
              "relative w-16 h-16 rounded-2xl flex items-center justify-center",
              "bg-white dark:bg-slate-800 shadow-lg"
            )}>
              {isProcessing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCw className={cn("h-7 w-7", config.color)} />
                </motion.div>
              ) : (
                <span className="text-3xl">{config.illustration}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h3
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2"
        >
          {title || config.defaultTitle}
        </motion.h3>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto mb-4"
        >
          {description || config.defaultDescription}
        </motion.p>

        {/* Progress Bar (for processing state) */}
        {isProcessing && progress !== undefined && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0.8 }}
            animate={{ opacity: 1, scaleX: 1 }}
            className="max-w-xs mx-auto mb-4"
          >
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{progress}% complete</p>
          </motion.div>
        )}

        {/* Actions */}
        {(actionLabel || secondaryActionLabel) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-3"
          >
            {actionLabel && onAction && (
              <Button
                size="sm"
                onClick={onAction}
                className={cn(
                  "gap-2",
                  type === 'processing' 
                    ? "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                )}
              >
                {type === 'no-parties' && <Plus className="h-4 w-4" />}
                {type === 'no-risks' && <Sparkles className="h-4 w-4" />}
                {type === 'error' && <RefreshCw className="h-4 w-4" />}
                {actionLabel}
              </Button>
            )}
            {secondaryActionLabel && onSecondaryAction && (
              <Button
                size="sm"
                variant="outline"
                onClick={onSecondaryAction}
                className="gap-2"
              >
                {secondaryActionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
});

export default EnhancedEmptyState;
