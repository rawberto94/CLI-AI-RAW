'use client';

/**
 * Action Hints Component
 * Shows contextual action hints based on user's current context
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  X, 
  ChevronRight,
  Keyboard,
  Sparkles,
  Upload,
  Search,
  MessageSquare,
  Eye,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ActionHint {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  shortcut?: string;
  icon?: React.ElementType;
  priority: number; // Higher = more important
}

interface ActionHintsProps {
  context: 'dashboard' | 'contracts' | 'upload' | 'search' | 'ai-chat' | 'analytics';
  className?: string;
}

const contextHints: Record<string, ActionHint[]> = {
  dashboard: [
    {
      id: 'upload-first',
      title: 'Upload your first contract',
      description: 'Start by uploading a contract to see AI-powered analysis',
      action: { label: 'Upload Now', href: '/upload' },
      shortcut: '⌘⇧U',
      icon: Upload,
      priority: 10
    },
    {
      id: 'try-ai',
      title: 'Try the AI Assistant',
      description: 'Ask questions about your contracts in natural language',
      action: { label: 'Open AI Chat', href: '/ai/chat' },
      shortcut: '⌘/',
      icon: MessageSquare,
      priority: 8
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Learn keyboard shortcuts',
      description: 'Navigate faster with keyboard shortcuts',
      action: { 
        label: 'View Shortcuts', 
        onClick: () => window.dispatchEvent(new CustomEvent('openKeyboardShortcuts'))
      },
      shortcut: '?',
      icon: Keyboard,
      priority: 5
    }
  ],
  contracts: [
    {
      id: 'bulk-select',
      title: 'Bulk select contracts',
      description: 'Hold Shift and click to select multiple contracts',
      icon: Eye,
      priority: 7
    },
    {
      id: 'quick-filter',
      title: 'Quick filters',
      description: 'Use the filter bar to narrow down contracts by status or type',
      icon: Search,
      priority: 6
    },
    {
      id: 'ai-analyze',
      title: 'AI Analysis available',
      description: 'Click on any contract to see AI-powered insights',
      icon: Sparkles,
      priority: 8
    }
  ],
  upload: [
    {
      id: 'drag-drop',
      title: 'Drag & Drop supported',
      description: 'Drop files anywhere on this page to upload',
      icon: Upload,
      priority: 9
    },
    {
      id: 'ocr-selection',
      title: 'Choose OCR engine',
      description: 'Select the best OCR engine for your document type',
      icon: Sparkles,
      priority: 7
    }
  ],
  search: [
    {
      id: 'semantic-search',
      title: 'Semantic search enabled',
      description: 'Search by meaning, not just keywords. Try "contracts with liability clauses"',
      icon: Search,
      priority: 9
    },
    {
      id: 'filter-results',
      title: 'Filter your results',
      description: 'Use the sidebar filters to narrow down search results',
      icon: Eye,
      priority: 6
    }
  ],
  'ai-chat': [
    {
      id: 'ask-anything',
      title: 'Ask anything about contracts',
      description: 'Try: "What are my expiring contracts?" or "Summarize contract X"',
      icon: MessageSquare,
      priority: 9
    },
    {
      id: 'follow-up',
      title: 'Follow-up questions',
      description: 'You can ask follow-up questions for more details',
      icon: Sparkles,
      priority: 7
    }
  ],
  analytics: [
    {
      id: 'export-data',
      title: 'Export your data',
      description: 'Download reports as PDF or CSV for sharing',
      icon: Eye,
      priority: 7
    },
    {
      id: 'date-range',
      title: 'Adjust date range',
      description: 'Use the date picker to view historical trends',
      icon: Search,
      priority: 6
    }
  ]
};

export function ActionHints({ context, className }: ActionHintsProps) {
  const [dismissedHints, setDismissedHints] = useState<Set<string>>(new Set());
  const [currentHintIndex, setCurrentHintIndex] = useState(0);

  // Load dismissed hints from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('contigo-dismissed-hints');
    if (saved) {
      setDismissedHints(new Set(JSON.parse(saved)));
    }
  }, []);

  // Get available hints for current context
  const availableHints = (contextHints[context] || [])
    .filter(hint => !dismissedHints.has(hint.id))
    .sort((a, b) => b.priority - a.priority);

  const currentHint = availableHints[currentHintIndex];

  // Dismiss a hint
  const dismissHint = useCallback((hintId: string) => {
    const newDismissed = new Set([...dismissedHints, hintId]);
    setDismissedHints(newDismissed);
    localStorage.setItem('contigo-dismissed-hints', JSON.stringify([...newDismissed]));
    setCurrentHintIndex(0); // Reset to first hint
  }, [dismissedHints]);

  // Cycle through hints
  const nextHint = useCallback(() => {
    setCurrentHintIndex(prev => (prev + 1) % availableHints.length);
  }, [availableHints.length]);

  if (!currentHint || availableHints.length === 0) {
    return null;
  }

  const HintIcon = currentHint.icon || Lightbulb;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30",
          "border border-amber-200 dark:border-amber-800 rounded-xl p-4",
          className
        )}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-400 flex-shrink-0">
            <HintIcon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-amber-900 dark:text-amber-100 text-sm">
                {currentHint.title}
              </h4>
              {currentHint.shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded">
                  {currentHint.shortcut}
                </kbd>
              )}
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              {currentHint.description}
            </p>
            
            <div className="flex items-center gap-2">
              {currentHint.action && (
                currentHint.action.href ? (
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                  >
                    <Link href={currentHint.action.href}>
                      {currentHint.action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={currentHint.action.onClick}
                    className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
                  >
                    {currentHint.action.label}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )
              )}
              
              {availableHints.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={nextHint}
                  className="h-7 text-xs text-amber-600 hover:text-amber-700"
                >
                  Next tip
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          </div>

          {/* Dismiss button */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => dismissHint(currentHint.id)}
            className="h-6 w-6 text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Hint counter */}
        {availableHints.length > 1 && (
          <div className="flex justify-center gap-1 mt-3">
            {availableHints.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentHintIndex(i)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === currentHintIndex
                    ? "bg-amber-500"
                    : "bg-amber-300 hover:bg-amber-400"
                )}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Inline hint for forms and specific UI elements
 */
interface InlineHintProps {
  children: React.ReactNode;
  className?: string;
}

export function InlineHint({ children, className }: InlineHintProps) {
  return (
    <div className={cn(
      "flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5",
      className
    )}>
      <Lightbulb className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export default ActionHints;
