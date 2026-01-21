"use client";

/**
 * Smart Suggestions Component
 * 
 * Provides proactive AI suggestions while viewing contracts.
 * Analyzes contract context and offers relevant tips and actions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  Calendar,
  FileText,
  Shield,
  DollarSign,
  Users,
  Clock,
  ChevronRight,
  X,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
interface Suggestion {
  id: string;
  type: 'tip' | 'warning' | 'action' | 'insight';
  category: 'dates' | 'clauses' | 'risk' | 'compliance' | 'cost' | 'parties' | 'general';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  dismissible?: boolean;
  confidence: number;
}

interface SmartSuggestionsProps {
  contractId?: string;
  contractText?: string;
  contractType?: string;
  onSuggestionAction?: (suggestion: Suggestion) => void;
  className?: string;
  maxSuggestions?: number;
  autoRefresh?: boolean;
}

// Category icons
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  dates: Calendar,
  clauses: FileText,
  risk: AlertTriangle,
  compliance: Shield,
  cost: DollarSign,
  parties: Users,
  general: Lightbulb,
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  dates: 'text-blue-500 bg-blue-50 border-blue-200',
  clauses: 'text-purple-500 bg-purple-50 border-purple-200',
  risk: 'text-red-500 bg-red-50 border-red-200',
  compliance: 'text-green-500 bg-green-50 border-green-200',
  cost: 'text-amber-500 bg-amber-50 border-amber-200',
  parties: 'text-cyan-500 bg-cyan-50 border-cyan-200',
  general: 'text-slate-500 bg-slate-50 border-slate-200',
};

// Priority badges
const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  high: { label: 'High Priority', class: 'bg-red-100 text-red-700' },
  medium: { label: 'Medium', class: 'bg-amber-100 text-amber-700' },
  low: { label: 'Low', class: 'bg-slate-100 text-slate-600' },
};

export function SmartSuggestions({
  contractId,
  contractText,
  contractType = 'general',
  onSuggestionAction,
  className = '',
  maxSuggestions = 5,
  autoRefresh = true,
}: SmartSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  // Generate suggestions based on contract context
  const generateSuggestions = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // In production, this would call an AI endpoint
      // For now, generate contextual suggestions based on contract type
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      const baseSuggestions: Suggestion[] = [
        // Date-related suggestions
        {
          id: 'date-1',
          type: 'warning',
          category: 'dates',
          title: 'Renewal date approaching',
          description: 'This contract has an auto-renewal clause. Review within 30 days to avoid automatic renewal.',
          priority: 'high',
          action: { label: 'Set reminder', onClick: () => {} },
          dismissible: true,
          confidence: 0.92,
        },
        {
          id: 'date-2',
          type: 'tip',
          category: 'dates',
          title: 'Add key dates to calendar',
          description: 'We found 3 important deadlines that aren\'t tracked. Would you like to add them?',
          priority: 'medium',
          action: { label: 'Add to calendar', onClick: () => {} },
          dismissible: true,
          confidence: 0.88,
        },
        
        // Risk suggestions
        {
          id: 'risk-1',
          type: 'warning',
          category: 'risk',
          title: 'Unlimited liability clause detected',
          description: 'The indemnification clause doesn\'t cap liability. Consider negotiating a limit.',
          priority: 'high',
          action: { label: 'View clause', onClick: () => {} },
          dismissible: true,
          confidence: 0.95,
        },
        {
          id: 'risk-2',
          type: 'insight',
          category: 'risk',
          title: 'Termination rights favor counterparty',
          description: 'The other party has more termination options. Review for balance.',
          priority: 'medium',
          dismissible: true,
          confidence: 0.78,
        },
        
        // Compliance suggestions
        {
          id: 'compliance-1',
          type: 'tip',
          category: 'compliance',
          title: 'GDPR compliance check',
          description: 'This contract involves personal data. Run a GDPR compliance check.',
          priority: 'medium',
          action: { label: 'Run check', onClick: () => {} },
          dismissible: true,
          confidence: 0.85,
        },
        
        // Cost suggestions
        {
          id: 'cost-1',
          type: 'insight',
          category: 'cost',
          title: 'Payment terms analysis',
          description: 'Net-60 payment terms are longer than industry standard (Net-30). Consider negotiating.',
          priority: 'low',
          dismissible: true,
          confidence: 0.82,
        },
        
        // Clause suggestions
        {
          id: 'clause-1',
          type: 'action',
          category: 'clauses',
          title: 'Missing force majeure clause',
          description: 'No force majeure clause found. Consider adding one for protection against unforeseen events.',
          priority: 'medium',
          action: { label: 'Generate clause', onClick: () => {} },
          dismissible: true,
          confidence: 0.90,
        },
        {
          id: 'clause-2',
          type: 'tip',
          category: 'clauses',
          title: 'Ambiguous governing law',
          description: 'The governing law clause could be clearer. Specify the jurisdiction explicitly.',
          priority: 'low',
          dismissible: true,
          confidence: 0.75,
        },
        
        // General suggestions
        {
          id: 'general-1',
          type: 'tip',
          category: 'general',
          title: 'Compare with similar contracts',
          description: 'You have 3 similar contracts. Compare terms to ensure consistency.',
          priority: 'low',
          action: { label: 'Compare', onClick: () => {} },
          dismissible: true,
          confidence: 0.70,
        },
      ];

      // Filter based on contract type
      let filtered = baseSuggestions;
      if (contractType === 'nda') {
        filtered = baseSuggestions.filter((s) =>
          ['risk', 'compliance', 'dates', 'general'].includes(s.category)
        );
      } else if (contractType === 'service') {
        filtered = baseSuggestions.filter((s) =>
          ['clauses', 'cost', 'risk', 'dates'].includes(s.category)
        );
      }

      // Sort by priority and confidence
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      filtered.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.confidence - a.confidence;
      });

      setSuggestions(filtered.slice(0, maxSuggestions + 3));
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contractType, maxSuggestions]);

  useEffect(() => {
    generateSuggestions();
    
    if (autoRefresh) {
      const interval = setInterval(generateSuggestions, 5 * 60 * 1000); // Refresh every 5 minutes
      return () => clearInterval(interval);
    }
  }, [generateSuggestions, autoRefresh]);

  // Filter out dismissed suggestions
  const visibleSuggestions = useMemo(() => {
    return suggestions
      .filter((s) => !dismissedIds.has(s.id))
      .slice(0, maxSuggestions);
  }, [suggestions, dismissedIds, maxSuggestions]);

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({ ...prev, [id]: type }));
    // In production, send feedback to improve suggestions
  };

  const handleAction = (suggestion: Suggestion) => {
    if (suggestion.action?.onClick) {
      suggestion.action.onClick();
    }
    onSuggestionAction?.(suggestion);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg hover:from-purple-100 hover:to-blue-100 transition-colors ${className}`}
      >
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-purple-700">
          {visibleSuggestions.length} Smart Suggestions
        </span>
        <ChevronRight className="w-4 h-4 text-purple-400" />
      </button>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-semibold text-slate-800">Smart Suggestions</h3>
          {!isLoading && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              {visibleSuggestions.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={generateSuggestions}
            disabled={isLoading}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Refresh suggestions"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-slate-100 rounded transition-colors"
            title="Minimize"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Suggestions List */}
      <ScrollArea className="max-h-96">
        <div className="p-2">
          {isLoading && visibleSuggestions.length === 0 ? (
            <div className="space-y-3 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-100 rounded w-full" />
                </div>
              ))}
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No suggestions at this time</p>
            </div>
          ) : (
            <AnimatePresence>
              {visibleSuggestions.map((suggestion, index) => (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SuggestionCard
                    suggestion={suggestion}
                    onDismiss={handleDismiss}
                    onAction={handleAction}
                    onFeedback={handleFeedback}
                    feedback={feedback[suggestion.id]}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {visibleSuggestions.length > 0 && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 rounded-b-lg">
          <p className="text-xs text-slate-500 text-center">
            Suggestions powered by AI • Feedback helps improve accuracy
          </p>
        </div>
      )}
    </div>
  );
}

// Individual Suggestion Card
function SuggestionCard({
  suggestion,
  onDismiss,
  onAction,
  onFeedback,
  feedback,
}: {
  suggestion: Suggestion;
  onDismiss: (id: string) => void;
  onAction: (suggestion: Suggestion) => void;
  onFeedback: (id: string, type: 'up' | 'down') => void;
  feedback?: 'up' | 'down';
}) {
  const Icon = CATEGORY_ICONS[suggestion.category] || Lightbulb;
  const colorClass = CATEGORY_COLORS[suggestion.category] || CATEGORY_COLORS.general;
  const priorityBadge = PRIORITY_BADGES[suggestion.priority];

  return (
    <div className={`p-3 mb-2 rounded-lg border ${colorClass} transition-colors hover:shadow-sm`}>
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-md bg-white/80">
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-slate-800 truncate">
              {suggestion.title}
            </h4>
            {suggestion.priority === 'high' && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityBadge.class}`}>
                {priorityBadge.label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mb-2">
            {suggestion.description}
          </p>
          
          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {suggestion.action && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onAction(suggestion)}
                >
                  {suggestion.action.label}
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {/* Feedback buttons */}
              <button
                onClick={() => onFeedback(suggestion.id, 'up')}
                className={`p-1 rounded hover:bg-white/50 ${
                  feedback === 'up' ? 'text-green-600' : 'text-slate-400'
                }`}
                title="Helpful"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onFeedback(suggestion.id, 'down')}
                className={`p-1 rounded hover:bg-white/50 ${
                  feedback === 'down' ? 'text-red-600' : 'text-slate-400'
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
              
              {/* Dismiss */}
              {suggestion.dismissible && (
                <button
                  onClick={() => onDismiss(suggestion.id)}
                  className="p-1 rounded hover:bg-white/50 text-slate-400"
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini suggestion pill for inline use
export function SuggestionPill({
  text,
  onClick,
}: {
  text: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-full text-sm text-purple-700 hover:from-purple-100 hover:to-blue-100 transition-colors"
    >
      <Lightbulb className="w-3.5 h-3.5" />
      {text}
    </button>
  );
}

export default SmartSuggestions;
