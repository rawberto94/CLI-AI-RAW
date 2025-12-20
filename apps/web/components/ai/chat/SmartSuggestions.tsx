'use client';

/**
 * Smart Suggestions Engine
 * Context-aware suggestions based on user behavior and conversation history
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  Clock,
  FileText,
  Search,
  DollarSign,
  Shield,
  Calendar,
  ArrowRight,
  Lightbulb,
  History,
  Star,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Suggestion {
  id: string;
  text: string;
  category: 'quick' | 'contextual' | 'trending' | 'recent' | 'smart';
  icon?: React.ElementType;
  priority: number;
  metadata?: {
    usageCount?: number;
    lastUsed?: Date;
    relevanceScore?: number;
  };
}

interface SuggestionCategory {
  id: string;
  label: string;
  icon: React.ElementType;
  suggestions: Suggestion[];
}

// Storage key for user suggestion history
const STORAGE_KEY = 'contigo-suggestion-history';

// Default quick suggestions
const DEFAULT_QUICK_SUGGESTIONS: Suggestion[] = [
  { id: 'summary', text: 'Contract portfolio summary', category: 'quick', icon: FileText, priority: 1 },
  { id: 'expiring', text: 'Contracts expiring this month', category: 'quick', icon: Calendar, priority: 2 },
  { id: 'top-suppliers', text: 'Top suppliers by value', category: 'quick', icon: DollarSign, priority: 3 },
  { id: 'high-risk', text: 'High risk contracts', category: 'quick', icon: Shield, priority: 4 },
  { id: 'savings', text: 'Cost savings opportunities', category: 'quick', icon: TrendingUp, priority: 5 },
];

// Context-based suggestions
const CONTEXT_SUGGESTIONS: Record<string, Suggestion[]> = {
  'contracts-list': [
    { id: 'filter-active', text: 'Show only active contracts', category: 'contextual', priority: 1 },
    { id: 'sort-value', text: 'Sort by contract value', category: 'contextual', priority: 2 },
    { id: 'group-supplier', text: 'Group by supplier', category: 'contextual', priority: 3 },
  ],
  'contract-detail': [
    { id: 'summarize', text: 'Summarize this contract', category: 'contextual', priority: 1 },
    { id: 'key-terms', text: 'Extract key terms', category: 'contextual', priority: 2 },
    { id: 'compare', text: 'Compare with similar contracts', category: 'contextual', priority: 3 },
    { id: 'risks', text: 'Identify risks in this contract', category: 'contextual', priority: 4 },
  ],
  'analytics': [
    { id: 'spending', text: 'Spending breakdown by category', category: 'contextual', priority: 1 },
    { id: 'trends', text: 'Contract value trends', category: 'contextual', priority: 2 },
    { id: 'renewal-forecast', text: 'Renewal forecast', category: 'contextual', priority: 3 },
  ],
  'dashboard': [
    { id: 'overview', text: 'Quick portfolio overview', category: 'contextual', priority: 1 },
    { id: 'action-items', text: 'What needs my attention?', category: 'contextual', priority: 2 },
    { id: 'recent', text: 'Show recent activity', category: 'contextual', priority: 3 },
  ],
};

// Smart suggestions based on time/patterns
function getSmartSuggestions(): Suggestion[] {
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const suggestions: Suggestion[] = [];

  // Monday morning - weekly review
  if (dayOfWeek === 1 && hour < 12) {
    suggestions.push({
      id: 'weekly-review',
      text: 'Show contracts needing attention this week',
      category: 'smart',
      icon: Lightbulb,
      priority: 1,
    });
  }

  // End of month - renewals
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (dayOfMonth > daysInMonth - 5) {
    suggestions.push({
      id: 'month-end',
      text: 'Review end-of-month renewals',
      category: 'smart',
      icon: Calendar,
      priority: 1,
    });
  }

  // Q4 - annual planning
  const month = new Date().getMonth();
  if (month >= 9) {
    suggestions.push({
      id: 'annual-review',
      text: 'Prepare annual contract review',
      category: 'smart',
      icon: TrendingUp,
      priority: 2,
    });
  }

  return suggestions;
}

interface SmartSuggestionsProps {
  pageContext?: string;
  contractContext?: { id: string; name: string } | null;
  onSuggestionClick: (text: string) => void;
  maxSuggestions?: number;
  variant?: 'pills' | 'cards' | 'list';
  showCategories?: boolean;
  className?: string;
}

export const SmartSuggestions = memo(({
  pageContext = 'dashboard',
  contractContext,
  onSuggestionClick,
  maxSuggestions = 6,
  variant = 'pills',
  showCategories = false,
  className,
}: SmartSuggestionsProps) => {
  const [recentSuggestions, setRecentSuggestions] = useState<Suggestion[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Load recent suggestions from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setRecentSuggestions(parsed.slice(0, 5).map((item: any, index: number) => ({
          id: `recent-${index}`,
          text: item.text,
          category: 'recent' as const,
          icon: History,
          priority: index + 1,
          metadata: {
            usageCount: item.count,
            lastUsed: new Date(item.lastUsed),
          },
        })));
      }
    } catch (e) {
      console.warn('Failed to load suggestion history:', e);
    }
  }, []);

  // Save suggestion to history
  const trackSuggestion = useCallback((text: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const history = stored ? JSON.parse(stored) : [];
      
      const existing = history.findIndex((item: any) => item.text === text);
      if (existing >= 0) {
        history[existing].count += 1;
        history[existing].lastUsed = new Date().toISOString();
      } else {
        history.unshift({ text, count: 1, lastUsed: new Date().toISOString() });
      }
      
      // Sort by usage and recency
      history.sort((a: any, b: any) => {
        const scoreA = a.count + (Date.now() - new Date(a.lastUsed).getTime() < 86400000 ? 2 : 0);
        const scoreB = b.count + (Date.now() - new Date(b.lastUsed).getTime() < 86400000 ? 2 : 0);
        return scoreB - scoreA;
      });
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
    } catch (e) {
      console.warn('Failed to save suggestion history:', e);
    }
  }, []);

  // Handle click
  const handleClick = useCallback((suggestion: Suggestion) => {
    trackSuggestion(suggestion.text);
    onSuggestionClick(suggestion.text);
  }, [trackSuggestion, onSuggestionClick]);

  // Compile all suggestions with priority
  const allSuggestions = useMemo(() => {
    const suggestions: Suggestion[] = [];

    // Add context-specific suggestions
    const contextSuggestions = CONTEXT_SUGGESTIONS[pageContext] || [];
    suggestions.push(...contextSuggestions);

    // Add contract-specific suggestions
    if (contractContext) {
      suggestions.push({
        id: 'contract-summary',
        text: `Summarize ${contractContext.name}`,
        category: 'contextual',
        icon: FileText,
        priority: 0,
      });
    }

    // Add smart suggestions
    suggestions.push(...getSmartSuggestions());

    // Add recent suggestions (lower priority)
    suggestions.push(...recentSuggestions.map(s => ({ ...s, priority: s.priority + 10 })));

    // Add default quick suggestions (lowest priority)
    suggestions.push(...DEFAULT_QUICK_SUGGESTIONS.map(s => ({ ...s, priority: s.priority + 20 })));

    // Sort by priority and deduplicate
    const seen = new Set<string>();
    return suggestions
      .filter(s => {
        const key = s.text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, maxSuggestions);
  }, [pageContext, contractContext, recentSuggestions, maxSuggestions]);

  // Group by category for list view
  const groupedSuggestions = useMemo(() => {
    if (!showCategories) return null;

    const groups: SuggestionCategory[] = [
      { id: 'contextual', label: 'For This Page', icon: Zap, suggestions: [] },
      { id: 'smart', label: 'Smart Suggestions', icon: Lightbulb, suggestions: [] },
      { id: 'recent', label: 'Recently Used', icon: History, suggestions: [] },
      { id: 'quick', label: 'Quick Actions', icon: Star, suggestions: [] },
    ];

    allSuggestions.forEach(suggestion => {
      const group = groups.find(g => g.id === suggestion.category);
      if (group) group.suggestions.push(suggestion);
    });

    return groups.filter(g => g.suggestions.length > 0);
  }, [allSuggestions, showCategories]);

  if (allSuggestions.length === 0) return null;

  // Pills variant
  if (variant === 'pills') {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {allSuggestions.map((suggestion) => (
          <motion.button
            key={suggestion.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleClick(suggestion)}
            onMouseEnter={() => setHoveredId(suggestion.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all",
              suggestion.category === 'contextual'
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                : suggestion.category === 'smart'
                ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                : suggestion.category === 'recent'
                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
            )}
          >
            {suggestion.icon && (
              <suggestion.icon className="h-3.5 w-3.5" />
            )}
            <span>{suggestion.text}</span>
            {hoveredId === suggestion.id && (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
          </motion.button>
        ))}
      </div>
    );
  }

  // Cards variant
  if (variant === 'cards') {
    return (
      <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", className)}>
        {allSuggestions.map((suggestion) => (
          <motion.button
            key={suggestion.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleClick(suggestion)}
            className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-2">
              {suggestion.icon && (
                <div className={cn(
                  "p-2 rounded-lg",
                  suggestion.category === 'contextual'
                    ? "bg-indigo-100 dark:bg-indigo-900/30"
                    : suggestion.category === 'smart'
                    ? "bg-amber-100 dark:bg-amber-900/30"
                    : "bg-slate-100 dark:bg-slate-800"
                )}>
                  <suggestion.icon className={cn(
                    "h-4 w-4",
                    suggestion.category === 'contextual'
                      ? "text-indigo-600 dark:text-indigo-400"
                      : suggestion.category === 'smart'
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-600 dark:text-slate-400"
                  )} />
                </div>
              )}
              {suggestion.category === 'smart' && (
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">
                  Suggested
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {suggestion.text}
            </p>
          </motion.button>
        ))}
      </div>
    );
  }

  // List variant with categories
  if (variant === 'list' && groupedSuggestions) {
    return (
      <div className={cn("space-y-4", className)}>
        {groupedSuggestions.map((group) => (
          <div key={group.id}>
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <group.icon className="h-3.5 w-3.5" />
              {group.label}
            </div>
            <div className="space-y-1">
              {group.suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleClick(suggestion)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left group"
                >
                  <ArrowRight className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
});

SmartSuggestions.displayName = 'SmartSuggestions';

export default SmartSuggestions;
