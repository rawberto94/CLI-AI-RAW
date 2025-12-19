'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ThumbsUp, ThumbsDown, Star, Heart, Smile, Frown, 
  MessageSquare, Send, X, ChevronDown, Check
} from 'lucide-react';

// ============================================================================
// Star Rating
// ============================================================================

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  readOnly?: boolean;
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  max = 5,
  size = 'md',
  readOnly = false,
  showValue = false,
  className = '',
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const displayValue = hoverValue ?? value;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          disabled={readOnly}
          onClick={() => onChange?.(i + 1)}
          onMouseEnter={() => !readOnly && setHoverValue(i + 1)}
          onMouseLeave={() => setHoverValue(null)}
          className={`transition-transform ${!readOnly ? 'hover:scale-110 cursor-pointer' : 'cursor-default'}`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              i < displayValue
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        </button>
      ))}
      {showValue && (
        <span className="ml-2 text-gray-600 dark:text-gray-400 font-medium">
          {value}/{max}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// Thumbs Rating
// ============================================================================

interface ThumbsRatingProps {
  value?: 'up' | 'down' | null;
  onChange?: (value: 'up' | 'down' | null) => void;
  size?: 'sm' | 'md' | 'lg';
  showCounts?: boolean;
  upCount?: number;
  downCount?: number;
  className?: string;
}

export function ThumbsRating({
  value,
  onChange,
  size = 'md',
  showCounts = false,
  upCount = 0,
  downCount = 0,
  className = '',
}: ThumbsRatingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => onChange?.(value === 'up' ? null : 'up')}
        className={`${buttonClasses[size]} rounded-lg transition-colors ${
          value === 'up'
            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}
      >
        <ThumbsUp className={sizeClasses[size]} />
      </button>
      {showCounts && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{upCount}</span>
      )}
      
      <button
        onClick={() => onChange?.(value === 'down' ? null : 'down')}
        className={`${buttonClasses[size]} rounded-lg transition-colors ${
          value === 'down'
            ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'
        }`}
      >
        <ThumbsDown className={sizeClasses[size]} />
      </button>
      {showCounts && (
        <span className="text-sm text-gray-600 dark:text-gray-400">{downCount}</span>
      )}
    </div>
  );
}

// ============================================================================
// Emoji Rating
// ============================================================================

interface EmojiRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export function EmojiRating({ value, onChange, className = '' }: EmojiRatingProps) {
  const emojis = [
    { value: 1, emoji: '😡', label: 'Very Unhappy' },
    { value: 2, emoji: '😕', label: 'Unhappy' },
    { value: 3, emoji: '😐', label: 'Neutral' },
    { value: 4, emoji: '🙂', label: 'Happy' },
    { value: 5, emoji: '😍', label: 'Very Happy' },
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {emojis.map(item => (
        <button
          key={item.value}
          onClick={() => onChange?.(item.value)}
          className={`text-3xl transition-transform hover:scale-125 ${
            value === item.value ? 'scale-125' : 'grayscale hover:grayscale-0'
          }`}
          title={item.label}
        >
          {item.emoji}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// NPS (Net Promoter Score)
// ============================================================================

interface NPSRatingProps {
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export function NPSRating({ value, onChange, className = '' }: NPSRatingProps) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">Not likely</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">Very likely</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 11 }).map((_, i) => (
          <button
            key={i}
            onClick={() => onChange?.(i)}
            className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
              value === i
                ? i <= 6
                  ? 'bg-red-500 text-white'
                  : i <= 8
                  ? 'bg-yellow-500 text-white'
                  : 'bg-green-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Heart/Like Button
// ============================================================================

interface LikeButtonProps {
  liked: boolean;
  onChange?: (liked: boolean) => void;
  count?: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LikeButton({
  liked,
  onChange,
  count = 0,
  showCount = true,
  size = 'md',
  className = '',
}: LikeButtonProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      onClick={() => onChange?.(!liked)}
      className={`inline-flex items-center gap-1.5 group ${className}`}
    >
      <motion.div
        animate={liked ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <Heart
          className={`${sizeClasses[size]} transition-colors ${
            liked
              ? 'fill-red-500 text-red-500'
              : 'text-gray-400 group-hover:text-red-400'
          }`}
        />
      </motion.div>
      {showCount && (
        <span className={`text-sm ${liked ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Feedback Form
// ============================================================================

interface FeedbackFormProps {
  onSubmit: (feedback: { rating: number; message: string }) => void;
  title?: string;
  placeholder?: string;
  className?: string;
}

export function FeedbackForm({
  onSubmit,
  title = 'How was your experience?',
  placeholder = 'Tell us more about your experience...',
  className = '',
}: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating > 0) {
      onSubmit({ rating, message });
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`text-center py-8 ${className}`}
      >
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Thank you for your feedback!
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Your feedback helps us improve.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      
      <div className="flex justify-center mb-6">
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />

      <button
        type="submit"
        disabled={rating === 0}
        className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-medium transition-colors"
      >
        Submit Feedback
      </button>
    </form>
  );
}

// ============================================================================
// Inline Feedback
// ============================================================================

interface InlineFeedbackProps {
  question: string;
  onFeedback: (helpful: boolean) => void;
  className?: string;
}

export function InlineFeedback({ question, onFeedback, className = '' }: InlineFeedbackProps) {
  const [answered, setAnswered] = useState<boolean | null>(null);

  const handleFeedback = (helpful: boolean) => {
    setAnswered(helpful);
    onFeedback(helpful);
  };

  if (answered !== null) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 ${className}`}
      >
        <Check className="w-4 h-4 text-green-500" />
        Thanks for your feedback!
      </motion.div>
    );
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="text-sm text-gray-600 dark:text-gray-400">{question}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleFeedback(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-green-100 dark:hover:bg-green-900 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:text-green-700 dark:hover:text-green-300"
        >
          <ThumbsUp className="w-4 h-4" />
          Yes
        </button>
        <button
          onClick={() => handleFeedback(false)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-900 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300"
        >
          <ThumbsDown className="w-4 h-4" />
          No
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Satisfaction Survey
// ============================================================================

interface SatisfactionSurveyProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { satisfaction: number; improvements: string[]; comment: string }) => void;
  title?: string;
}

export function SatisfactionSurvey({
  isOpen,
  onClose,
  onSubmit,
  title = 'Quick Survey',
}: SatisfactionSurveyProps) {
  const [step, setStep] = useState(1);
  const [satisfaction, setSatisfaction] = useState(0);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [comment, setComment] = useState('');

  const improvementOptions = [
    'Performance',
    'User Interface',
    'Features',
    'Documentation',
    'Support',
    'Pricing',
  ];

  const toggleImprovement = (option: string) => {
    setImprovements(prev =>
      prev.includes(option)
        ? prev.filter(i => i !== option)
        : [...prev, option]
    );
  };

  const handleSubmit = () => {
    onSubmit({ satisfaction, improvements, comment });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl p-6 z-50 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2 mb-6">
              {[1, 2, 3].map(s => (
                <div
                  key={s}
                  className={`flex-1 h-1 rounded-full ${
                    step >= s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    How satisfied are you with our product?
                  </p>
                  <div className="flex justify-center">
                    <EmojiRating value={satisfaction} onChange={setSatisfaction} />
                  </div>
                  <button
                    onClick={() => setStep(2)}
                    disabled={satisfaction === 0}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    What areas could we improve? (Optional)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {improvementOptions.map(option => (
                      <button
                        key={option}
                        onClick={() => toggleImprovement(option)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          improvements.includes(option)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Continue
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Any additional comments? (Optional)
                  </p>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Share your thoughts..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <button
                    onClick={handleSubmit}
                    className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
                  >
                    Submit
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
