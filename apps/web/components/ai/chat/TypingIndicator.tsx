'use client';

/**
 * Typing Indicator
 * Animated typing dots and streaming text indicator
 */

import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  variant?: 'dots' | 'pulse' | 'wave';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  showAvatar?: boolean;
}

const dotVariants = {
  initial: { y: 0 },
  animate: { y: -6 },
};

const dotTransition = (delay: number) => ({
  duration: 0.4,
  repeat: Infinity,
  repeatType: 'reverse' as const,
  ease: 'easeInOut',
  delay,
});

export const TypingIndicator = memo(({
  variant = 'dots',
  size = 'md',
  label = 'AI is thinking',
  showAvatar = true,
}: TypingIndicatorProps) => {
  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <div className="flex items-start gap-3">
      {showAvatar && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
      )}

      <div className={cn(
        "flex items-center gap-2 px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm",
        sizeClasses[size]
      )}>
        {variant === 'dots' && (
          <div className="flex items-center gap-1">
            {[0, 0.15, 0.3].map((delay, i) => (
              <motion.div
                key={i}
                variants={dotVariants}
                initial="initial"
                animate="animate"
                transition={dotTransition(delay)}
                className={cn(
                  "rounded-full bg-gradient-to-r from-indigo-500 to-purple-500",
                  dotSizes[size]
                )}
              />
            ))}
          </div>
        )}

        {variant === 'pulse' && (
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-indigo-500"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {label}...
            </span>
          </div>
        )}

        {variant === 'wave' && (
          <div className="flex items-center gap-0.5">
            {[0, 0.1, 0.2, 0.3, 0.4].map((delay, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.5, 1, 0.5] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay,
                }}
                className="w-1 h-4 rounded-full bg-gradient-to-t from-indigo-500 to-purple-500 origin-center"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';

// Streaming text indicator
interface StreamingIndicatorProps {
  text: string;
  showCursor?: boolean;
}

export const StreamingIndicator = memo(({ text, showCursor = true }: StreamingIndicatorProps) => {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <Sparkles className="h-4 w-4 text-white" />
      </div>

      <div className="max-w-[75%] rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {text}
          {showCursor && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="inline-block w-2 h-4 bg-indigo-500 ml-0.5 -mb-0.5"
            />
          )}
        </div>
      </div>
    </div>
  );
});

StreamingIndicator.displayName = 'StreamingIndicator';

// Thinking status with stages
interface ThinkingStage {
  id: string;
  label: string;
  completed: boolean;
}

interface ThinkingStatusProps {
  stages?: ThinkingStage[];
  currentStage?: string;
}

export const ThinkingStatus = memo(({ 
  stages = [
    { id: 'understand', label: 'Understanding query', completed: false },
    { id: 'search', label: 'Searching contracts', completed: false },
    { id: 'analyze', label: 'Analyzing results', completed: false },
    { id: 'generate', label: 'Generating response', completed: false },
  ],
  currentStage = 'understand',
}: ThinkingStatusProps) => {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </motion.div>
      </div>

      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col gap-2">
          {stages.map((stage, index) => {
            const isCurrent = stage.id === currentStage;
            const isPast = stages.findIndex(s => s.id === currentStage) > index;
            
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-2 text-sm transition-all",
                  isPast || stage.completed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : isCurrent
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-400 dark:text-slate-500"
                )}
              >
                {isPast || stage.completed ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                ) : isCurrent ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="w-4 h-4 rounded-full bg-indigo-500"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
                <span className={cn(isCurrent && "font-medium")}>
                  {stage.label}
                  {isCurrent && (
                    <span className="ml-1">
                      <motion.span
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        ...
                      </motion.span>
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ThinkingStatus.displayName = 'ThinkingStatus';

export default TypingIndicator;
