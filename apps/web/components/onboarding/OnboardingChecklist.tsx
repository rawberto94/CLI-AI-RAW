'use client';

/**
 * Onboarding Checklist
 * Guided setup checklist for new users
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Circle, 
  ChevronDown, 
  ChevronUp, 
  Upload, 
  FileSearch, 
  MessageSquare, 
  Settings, 
  Sparkles,
  X,
  Trophy,
  ArrowRight,
  Gift,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completedKey: string;
  reward?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'upload',
    title: 'Upload Your First Contract',
    description: 'Get started by uploading a contract document to analyze.',
    icon: Upload,
    href: '/upload',
    completedKey: 'onboarding_uploaded',
    reward: 'Unlock AI analysis features',
  },
  {
    id: 'explore',
    title: 'Explore AI Analysis',
    description: 'View extracted data and insights from your contract.',
    icon: FileSearch,
    href: '/contracts',
    completedKey: 'onboarding_explored',
    reward: 'Unlock search capabilities',
  },
  {
    id: 'chat',
    title: 'Ask AI a Question',
    description: 'Use the AI assistant to get answers about your contracts.',
    icon: MessageSquare,
    href: '/ai/chat',
    completedKey: 'onboarding_chatted',
    reward: 'Unlock advanced AI features',
  },
  {
    id: 'customize',
    title: 'Customize Your Settings',
    description: 'Set your preferences and configure your workspace.',
    icon: Settings,
    href: '/settings',
    completedKey: 'onboarding_customized',
    reward: 'Complete setup bonus',
  },
];

const STORAGE_KEY = 'contigo_onboarding_progress';

interface OnboardingProgress {
  completedSteps: string[];
  dismissed: boolean;
  startedAt: number;
  completedAt?: number;
}

function getProgress(): OnboardingProgress {
  if (typeof window === 'undefined') {
    return { completedSteps: [], dismissed: false, startedAt: Date.now() };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* localStorage unavailable (private browsing) */ }
  return { completedSteps: [], dismissed: false, startedAt: Date.now() };
}

function saveProgress(progress: OnboardingProgress) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch { /* localStorage unavailable (private browsing) */ }
}

export function OnboardingChecklist() {
  const [progress, setProgress] = useState<OnboardingProgress>(() => getProgress());
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  const completedCount = progress.completedSteps.length;
  const totalSteps = ONBOARDING_STEPS.length;
  const progressPercent = (completedCount / totalSteps) * 100;
  const isComplete = completedCount === totalSteps;

  // Check for completed steps on mount
  useEffect(() => {
    const checkForCompletions = () => {
      const newProgress = { ...progress };
      let hasChanges = false;

      ONBOARDING_STEPS.forEach(step => {
        const isCompleted = localStorage.getItem(step.completedKey) === 'true';
        if (isCompleted && !newProgress.completedSteps.includes(step.id)) {
          newProgress.completedSteps.push(step.id);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        if (newProgress.completedSteps.length === totalSteps && !newProgress.completedAt) {
          newProgress.completedAt = Date.now();
          setShowCelebration(true);
        }
        setProgress(newProgress);
        saveProgress(newProgress);
      }
    };

    checkForCompletions();
    
    // Listen for completion events
    const handleStepComplete = (e: CustomEvent) => {
      const stepId = e.detail?.stepId;
      if (stepId && !progress.completedSteps.includes(stepId)) {
        const newProgress = {
          ...progress,
          completedSteps: [...progress.completedSteps, stepId],
        };
        if (newProgress.completedSteps.length === totalSteps) {
          newProgress.completedAt = Date.now();
          setShowCelebration(true);
        }
        setProgress(newProgress);
        saveProgress(newProgress);
      }
    };

    window.addEventListener('onboardingStepComplete' as any, handleStepComplete);
    return () => window.removeEventListener('onboardingStepComplete' as any, handleStepComplete);
  }, [progress, totalSteps]);

  const markStepComplete = useCallback((stepId: string) => {
    if (progress.completedSteps.includes(stepId)) return;
    
    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (step) {
      localStorage.setItem(step.completedKey, 'true');
    }

    const newProgress = {
      ...progress,
      completedSteps: [...progress.completedSteps, stepId],
      completedAt: progress.completedSteps.length + 1 === totalSteps ? Date.now() : undefined,
    };
    setProgress(newProgress);
    saveProgress(newProgress);

    if (newProgress.completedSteps.length === totalSteps) {
      setShowCelebration(true);
    }
  }, [progress, totalSteps]);

  const dismiss = useCallback(() => {
    const newProgress = { ...progress, dismissed: true };
    setProgress(newProgress);
    saveProgress(newProgress);
  }, [progress]);

  const resetProgress = useCallback(() => {
    ONBOARDING_STEPS.forEach(step => {
      localStorage.removeItem(step.completedKey);
    });
    const newProgress = { completedSteps: [], dismissed: false, startedAt: Date.now() };
    setProgress(newProgress);
    saveProgress(newProgress);
    setShowCelebration(false);
  }, []);

  // Don't show if dismissed or complete
  if (progress.dismissed && isComplete) return null;

  return (
    <>
      {/* Celebration Modal */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div key="celebration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center"
              >
                <Trophy className="h-10 w-10 text-white" />
              </motion.div>
              
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                🎉 Onboarding Complete!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                You&apos;ve mastered the basics of ConTigo. You&apos;re now ready to unlock the full power of AI-driven contract management.
              </p>

              <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 justify-center text-violet-600 dark:text-violet-400 mb-2">
                  <Gift className="h-5 w-5" />
                  <span className="font-medium">Rewards Unlocked</span>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['AI Analysis', 'Smart Search', 'Advanced Chat', 'Custom Settings'].map((reward) => (
                    <span
                      key={reward}
                      className="px-2 py-1 bg-white dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 shadow-sm"
                    >
                      ✓ {reward}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setShowCelebration(false);
                  dismiss();
                }}
                className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-medium hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/25"
              >
                Start Exploring
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist Widget */}
      {!progress.dismissed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 md:bottom-4 left-4 z-40 w-80 max-w-[calc(100vw-2rem)]"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div 
              className="flex items-center justify-between p-4 cursor-pointer bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 shadow-lg shadow-violet-500/25">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Getting Started
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {completedCount} of {totalSteps} complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss();
                  }}
                  className="p-1 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-slate-400" />
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 dark:bg-slate-800">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-purple-600"
              />
            </div>

            {/* Steps */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div key="expanded"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 space-y-2">
                    {ONBOARDING_STEPS.map((step, index) => {
                      const isStepComplete = progress.completedSteps.includes(step.id);
                      const isNextStep = !isStepComplete && 
                        ONBOARDING_STEPS.slice(0, index).every(s => progress.completedSteps.includes(s.id));

                      return (
                        <Link
                          key={step.id}
                          href={step.href}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg transition-all",
                            isStepComplete
                              ? "bg-violet-50 dark:bg-violet-900/20"
                              : isNextStep
                              ? "bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          <div className={cn(
                            "flex-shrink-0 mt-0.5",
                            isStepComplete ? "text-violet-500" : "text-slate-300 dark:text-slate-600"
                          )}>
                            {isStepComplete ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <step.icon className={cn(
                                "h-4 w-4 flex-shrink-0",
                                isStepComplete 
                                  ? "text-violet-600 dark:text-violet-400" 
                                  : "text-slate-400"
                              )} />
                              <span className={cn(
                                "text-sm font-medium",
                                isStepComplete 
                                  ? "text-violet-700 dark:text-violet-300 line-through" 
                                  : "text-slate-700 dark:text-slate-300"
                              )}>
                                {step.title}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {step.description}
                            </p>
                            {step.reward && !isStepComplete && (
                              <div className="flex items-center gap-1 mt-1 text-[10px] text-violet-600 dark:text-indigo-400">
                                <Zap className="h-3 w-3" />
                                {step.reward}
                              </div>
                            )}
                          </div>
                          {isNextStep && (
                            <ArrowRight className="h-4 w-4 text-violet-500 flex-shrink-0" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </>
  );
}

// Hook to mark onboarding steps complete
export function useOnboardingStep(stepId: string) {
  const markComplete = useCallback(() => {
    const step = ONBOARDING_STEPS.find(s => s.id === stepId);
    if (step) {
      localStorage.setItem(step.completedKey, 'true');
      window.dispatchEvent(new CustomEvent('onboardingStepComplete', { detail: { stepId } }));
    }
  }, [stepId]);

  return { markComplete };
}

export default OnboardingChecklist;
