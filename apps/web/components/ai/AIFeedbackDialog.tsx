/**
 * AI Feedback Dialog
 * 
 * Captures user feedback on AI responses with correction ability.
 * Feeds into the Continuous Learning Agent for model improvement.
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageId: string;
  messageContent: string;
  originalQuery?: string;
  initialRating?: "like" | "dislike";
  onFeedbackSubmit?: (feedback: FeedbackData) => void;
  onOpenFeedback?: () => void;
  conversationId?: string;
  onFeedbackSubmitted?: () => void;
}

export interface FeedbackData {
  messageId: string;
  rating: "like" | "dislike";
  category?: FeedbackCategory;
  correction?: string;
  comment?: string;
  originalQuery?: string;
  originalResponse?: string;
}

type FeedbackCategory = 
  | "incorrect_facts"
  | "missing_info"
  | "wrong_contract"
  | "formatting"
  | "too_long"
  | "too_short"
  | "other";

const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string; icon: React.ReactNode }[] = [
  { value: "incorrect_facts", label: "Incorrect Facts", icon: <AlertCircle className="w-4 h-4" /> },
  { value: "missing_info", label: "Missing Information", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "wrong_contract", label: "Wrong Contract Data", icon: <AlertCircle className="w-4 h-4" /> },
  { value: "formatting", label: "Formatting Issues", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "too_long", label: "Response Too Long", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "too_short", label: "Response Too Short", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "other", label: "Other", icon: <Lightbulb className="w-4 h-4" /> },
];

export function AIFeedbackDialog({
  open,
  onOpenChange,
  messageId,
  messageContent,
  originalQuery,
  initialRating,
  onFeedbackSubmit,
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<"like" | "dislike" | null>(initialRating || null);
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [correction, setCorrection] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!rating) return;

    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      messageId,
      rating,
      category: category || undefined,
      correction: correction.trim() || undefined,
      comment: comment.trim() || undefined,
      originalQuery,
      originalResponse: messageContent,
    };

    try {
      // Submit to chat feedback API
      await fetch("/api/ai/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      onFeedbackSubmit?.(feedbackData);
      setSubmitted(true);

      // Auto-close after success
      setTimeout(() => {
        onOpenChange(false);
        // Reset state
        setTimeout(() => {
          setRating(null);
          setCategory(null);
          setCorrection("");
          setComment("");
          setSubmitted(false);
        }, 300);
      }, 1500);
    } catch (error) {
      console.error("Feedback submission failed:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [rating, category, correction, comment, messageId, messageContent, originalQuery, onFeedbackSubmit, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            Help ConTigo Learn
          </DialogTitle>
          <DialogDescription>
            Your feedback helps improve AI responses for everyone.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div key="AIFeedbackDialog-ap-1"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center py-8 gap-3"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 10, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center"
              >
                <CheckCircle className="w-8 h-8 text-white" />
              </motion.div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Thank you!</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                Your feedback helps ConTigo AI become smarter and more accurate.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5 py-2"
            >
              {/* Rating */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  How was this response?
                </label>
                <div className="flex gap-3">
                  <Button
                    variant={rating === "like" ? "default" : "outline"}
                    className={`flex-1 ${
                      rating === "like"
                        ? "bg-green-500 hover:bg-green-600 text-white border-green-500"
                        : "hover:border-green-500 hover:text-green-600"
                    }`}
                    onClick={() => setRating("like")}
                  >
                    <ThumbsUp className="w-4 h-4 mr-2" />
                    Helpful
                  </Button>
                  <Button
                    variant={rating === "dislike" ? "default" : "outline"}
                    className={`flex-1 ${
                      rating === "dislike"
                        ? "bg-red-500 hover:bg-red-600 text-white border-red-500"
                        : "hover:border-red-500 hover:text-red-600"
                    }`}
                    onClick={() => setRating("dislike")}
                  >
                    <ThumbsDown className="w-4 h-4 mr-2" />
                    Not Helpful
                  </Button>
                </div>
              </div>

              {/* Category (shown for negative feedback) */}
              <AnimatePresence>
                {rating === "dislike" && (
                  <motion.div key="rating"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3"
                  >
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      What was wrong? (optional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {FEEDBACK_CATEGORIES.map((cat) => (
                        <Badge
                          key={cat.value}
                          variant={category === cat.value ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${
                            category === cat.value
                              ? "bg-violet-500 text-white border-violet-500"
                              : "hover:border-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950"
                          }`}
                          onClick={() => setCategory(category === cat.value ? null : cat.value)}
                        >
                          {cat.icon}
                          <span className="ml-1">{cat.label}</span>
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Correction */}
              <AnimatePresence>
                {rating === "dislike" && (
                  <motion.div key="rating"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      What should the correct response be? (optional)
                    </label>
                    <Textarea
                      placeholder="Provide the correct information or a better response..."
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      This helps train the AI to give better answers in the future.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Additional comments */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Additional comments (optional)
                </label>
                <Textarea
                  placeholder="Any other feedback or suggestions..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              {/* Original response preview */}
              <div className="rounded-lg bg-gray-50 dark:bg-slate-800 p-3 border border-gray-200 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Response you are rating:</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                  {(messageContent || '').slice(0, 200)}
                  {(messageContent?.length || 0) > 200 && "..."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!submitted && (
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!rating || isSubmitting}
              className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Inline feedback buttons for message bubbles
 */
interface InlineFeedbackProps {
  messageId: string;
  messageContent: string;
  originalQuery?: string;
  currentReaction?: "like" | "dislike";
  onReact: (reaction: "like" | "dislike") => void;
  onOpenFeedback: () => void;
}

export function InlineFeedback({
  messageId,
  messageContent,
  originalQuery,
  currentReaction,
  onReact,
  onOpenFeedback: _onOpenFeedback,
}: InlineFeedbackProps) {
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);

  const handleDislike = () => {
    onReact("dislike");
    setShowFeedbackDialog(true);
  };

  return (
    <>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-lg ${
            currentReaction === "like"
              ? "text-green-500 bg-green-50"
              : "text-gray-400 hover:text-green-500 hover:bg-green-50"
          }`}
          onClick={() => onReact("like")}
          aria-label="Mark as helpful"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={`h-7 w-7 rounded-lg ${
            currentReaction === "dislike"
              ? "text-red-500 bg-red-50"
              : "text-gray-400 hover:text-red-500 hover:bg-red-50"
          }`}
          onClick={handleDislike}
          aria-label="Mark as not helpful"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </Button>
      </div>

      <AIFeedbackDialog
        open={showFeedbackDialog}
        onOpenChange={setShowFeedbackDialog}
        messageId={messageId}
        messageContent={messageContent}
        originalQuery={originalQuery}
        initialRating="dislike"
      />
    </>
  );
}
