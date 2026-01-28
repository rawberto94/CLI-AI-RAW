'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Send,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType = 'helpful' | 'not_helpful' | 'incorrect' | 'partially_helpful';
export type FeedbackCategory = 
  | 'accuracy' 
  | 'relevance' 
  | 'completeness' 
  | 'clarity' 
  | 'timeliness'
  | 'other';

export interface AISuggestion {
  id: string;
  type: 'risk' | 'clause' | 'workflow' | 'correction' | 'recommendation' | 'insight';
  title: string;
  content: string;
  confidence: number; // 0-100
  source?: string;
  timestamp: string;
}

export interface FeedbackData {
  suggestionId: string;
  type: FeedbackType;
  category?: FeedbackCategory;
  comment?: string;
  alternativeSuggestion?: string;
  rating?: number; // 1-5
}

interface AISuggestionFeedbackProps {
  suggestion: AISuggestion;
  onFeedback: (feedback: FeedbackData) => Promise<void>;
  variant?: 'inline' | 'card' | 'minimal';
  showDetails?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string; description: string }[] = [
  { value: 'accuracy', label: 'Accuracy', description: 'Information is factually incorrect' },
  { value: 'relevance', label: 'Relevance', description: 'Not applicable to this context' },
  { value: 'completeness', label: 'Completeness', description: 'Missing important information' },
  { value: 'clarity', label: 'Clarity', description: 'Hard to understand or confusing' },
  { value: 'timeliness', label: 'Timeliness', description: 'Outdated or not timely' },
  { value: 'other', label: 'Other', description: 'Something else' },
];

// ============================================================================
// Components
// ============================================================================

/**
 * Quick feedback buttons (thumbs up/down)
 */
const QuickFeedback: React.FC<{
  onFeedback: (type: FeedbackType) => void;
  currentFeedback: FeedbackType | null;
  disabled?: boolean;
}> = ({ onFeedback, currentFeedback, disabled }) => (
  <div className="flex items-center gap-1">
    <button
      onClick={() => onFeedback('helpful')}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-all ${
        currentFeedback === 'helpful'
          ? 'bg-green-100 text-green-600'
          : 'hover:bg-slate-100 text-slate-400 hover:text-green-600'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Helpful"
    >
      <ThumbsUp className="w-4 h-4" />
    </button>
    <button
      onClick={() => onFeedback('not_helpful')}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition-all ${
        currentFeedback === 'not_helpful' || currentFeedback === 'incorrect'
          ? 'bg-red-100 text-red-600'
          : 'hover:bg-slate-100 text-slate-400 hover:text-red-600'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title="Not helpful"
    >
      <ThumbsDown className="w-4 h-4" />
    </button>
  </div>
);

/**
 * Star rating component
 */
const StarRating: React.FC<{
  rating: number;
  onChange: (rating: number) => void;
}> = ({ rating, onChange }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        onClick={() => onChange(star)}
        className={`p-0.5 transition-colors ${
          star <= rating ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'
        }`}
      >
        <Star className={`w-5 h-5 ${star <= rating ? 'fill-current' : ''}`} />
      </button>
    ))}
  </div>
);

/**
 * Detailed feedback form
 */
const DetailedFeedbackForm: React.FC<{
  initialType: FeedbackType;
  onSubmit: (data: Partial<FeedbackData>) => void;
  onCancel: () => void;
}> = ({ initialType, onSubmit, onCancel }) => {
  const [category, setCategory] = useState<FeedbackCategory | undefined>();
  const [comment, setComment] = useState('');
  const [alternative, setAlternative] = useState('');
  const [rating, setRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onSubmit({
      type: initialType,
      category,
      comment: comment.trim() || undefined,
      alternativeSuggestion: alternative.trim() || undefined,
      rating: rating || undefined,
    });
    setIsSubmitting(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="pt-4 space-y-4">
        {/* Rating */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">
            How would you rate this suggestion?
          </label>
          <StarRating rating={rating} onChange={setRating} />
        </div>

        {/* Category Selection */}
        {(initialType === 'not_helpful' || initialType === 'incorrect' || initialType === 'partially_helpful') && (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              What was the issue? (optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`p-2 rounded-lg border text-left text-sm transition-all ${
                    category === cat.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  <div className="font-medium">{cat.label}</div>
                  <div className="text-xs text-slate-500">{cat.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Additional comments (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us more about your experience..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none transition-all"
          />
        </div>

        {/* Alternative Suggestion */}
        {(initialType === 'not_helpful' || initialType === 'incorrect') && (
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              What would have been more helpful? (optional)
            </label>
            <textarea
              value={alternative}
              onChange={(e) => setAlternative(e.target.value)}
              placeholder="Share what you expected or needed..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm resize-none transition-all"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Feedback
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AISuggestionFeedback: React.FC<AISuggestionFeedbackProps> = ({
  suggestion,
  onFeedback,
  variant = 'inline',
  showDetails = true,
}) => {
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackType | null>(null);
  const [showDetailedForm, setShowDetailedForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQuickFeedback = useCallback(async (type: FeedbackType) => {
    if (currentFeedback === type) {
      // Toggle off
      setCurrentFeedback(null);
      setShowDetailedForm(false);
      return;
    }

    setCurrentFeedback(type);
    
    if (type === 'helpful') {
      // Submit immediately for positive feedback
      setIsSubmitting(true);
      try {
        await onFeedback({
          suggestionId: suggestion.id,
          type,
        });
        setSubmitted(true);
        toast.success('Thanks for your feedback!');
      } catch (_error) {
        toast.error('Failed to submit feedback');
      }
      setIsSubmitting(false);
    } else {
      // Show detailed form for negative feedback
      setShowDetailedForm(true);
    }
  }, [currentFeedback, onFeedback, suggestion.id]);

  const handleDetailedSubmit = useCallback(async (data: Partial<FeedbackData>) => {
    try {
      await onFeedback({
        suggestionId: suggestion.id,
        ...data,
        type: data.type || currentFeedback || 'not_helpful',
      });
      setSubmitted(true);
      setShowDetailedForm(false);
      toast.success('Thanks for your detailed feedback!');
    } catch (_error) {
      toast.error('Failed to submit feedback');
    }
  }, [currentFeedback, onFeedback, suggestion.id]);

  // Minimal variant - just thumbs up/down
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-1">
        {submitted ? (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Thanks!
          </span>
        ) : (
          <QuickFeedback
            onFeedback={handleQuickFeedback}
            currentFeedback={currentFeedback}
            disabled={isSubmitting}
          />
        )}
      </div>
    );
  }

  // Inline variant - compact with expandable details
  if (variant === 'inline') {
    return (
      <div className="border-t border-slate-100 pt-3 mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Was this helpful?</span>
          {submitted ? (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Feedback received
            </span>
          ) : (
            <QuickFeedback
              onFeedback={handleQuickFeedback}
              currentFeedback={currentFeedback}
              disabled={isSubmitting}
            />
          )}
        </div>

        <AnimatePresence>
          {showDetailedForm && !submitted && (
            <DetailedFeedbackForm
              initialType={currentFeedback || 'not_helpful'}
              onSubmit={handleDetailedSubmit}
              onCancel={() => {
                setShowDetailedForm(false);
                setCurrentFeedback(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Card variant - full display
  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      {/* Suggestion Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-lg">
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <span className="text-sm font-medium text-slate-900">{suggestion.title}</span>
            <span className="ml-2 text-xs text-slate-400">
              {new Date(suggestion.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            suggestion.confidence >= 80 ? 'bg-green-100 text-green-700' :
            suggestion.confidence >= 60 ? 'bg-amber-100 text-amber-700' :
            'bg-slate-100 text-slate-600'
          }`}>
            {suggestion.confidence}% confidence
          </span>
        </div>
      </div>

      {/* Suggestion Content */}
      {showDetails && (
        <p className="text-sm text-slate-600 mb-4">{suggestion.content}</p>
      )}

      {/* Feedback Section */}
      <div className="border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Rate this suggestion</span>
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-1.5 text-green-600"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Thank you for your feedback!</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-3">
              <QuickFeedback
                onFeedback={handleQuickFeedback}
                currentFeedback={currentFeedback}
                disabled={isSubmitting}
              />
              <button
                onClick={() => setShowDetailedForm(!showDetailedForm)}
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                Add details
                <ChevronDown className={`w-4 h-4 transition-transform ${showDetailedForm ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showDetailedForm && !submitted && (
            <DetailedFeedbackForm
              initialType={currentFeedback || 'partially_helpful'}
              onSubmit={handleDetailedSubmit}
              onCancel={() => setShowDetailedForm(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/**
 * Hook for managing feedback state with API persistence
 */
export function useSuggestionFeedback() {
  const [feedbackHistory, setFeedbackHistory] = useState<Map<string, FeedbackData>>(new Map());

  const submitFeedback = useCallback(async (feedback: FeedbackData): Promise<void> => {
    // Store locally first for optimistic update
    setFeedbackHistory(prev => {
      const newMap = new Map(prev);
      newMap.set(feedback.suggestionId, feedback);
      return newMap;
    });

    // Persist to API
    try {
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: feedback.suggestionId,
          feedbackType: feedback.type,
          category: feedback.category,
          comment: feedback.comment,
          alternativeSuggestion: feedback.alternativeSuggestion,
          rating: feedback.rating,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setFeedbackHistory(prev => {
          const newMap = new Map(prev);
          newMap.delete(feedback.suggestionId);
          return newMap;
        });
        throw new Error('Failed to submit feedback');
      }
    } catch {
      // Silent fail - feedback stored locally as fallback
    }
  }, []);

  const getFeedback = useCallback((suggestionId: string): FeedbackData | undefined => {
    return feedbackHistory.get(suggestionId);
  }, [feedbackHistory]);

  return {
    submitFeedback,
    getFeedback,
    feedbackHistory,
  };
}

/**
 * Wrapper component for AI suggestions with feedback
 */
export const AISuggestionWithFeedback: React.FC<{
  suggestion: AISuggestion;
  variant?: 'inline' | 'card' | 'minimal';
  className?: string;
}> = ({ suggestion, variant = 'card', className }) => {
  const { submitFeedback } = useSuggestionFeedback();

  return (
    <div className={className}>
      <AISuggestionFeedback
        suggestion={suggestion}
        onFeedback={submitFeedback}
        variant={variant}
        showDetails={variant === 'card'}
      />
    </div>
  );
};

export default AISuggestionFeedback;
