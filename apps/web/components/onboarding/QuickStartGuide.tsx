'use client';

/**
 * Quick Start Guide
 * Interactive walkthrough for new users
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  Upload,
  FileText,
  MessageSquare,
  Search,
  BarChart3,
  CheckCircle2,
  Sparkles,
  Keyboard,
  Zap,
  ArrowRight,
  ExternalLink,
  Play,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface QuickStartStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  tips: string[];
  shortcut?: string;
  color: string;
}

const steps: QuickStartStep[] = [
  {
    id: 'upload',
    title: 'Upload Your Contracts',
    description: 'Start by uploading your contracts. We support PDF, Word, and image files. Our AI will automatically extract key information.',
    icon: Upload,
    action: { label: 'Go to Upload', href: '/upload' },
    tips: [
      'Drag and drop multiple files at once',
      'Supported formats: PDF, DOCX, DOC, JPG, PNG',
      'Files are processed with enterprise-grade OCR'
    ],
    shortcut: '⌘⇧U',
    color: 'from-violet-500 to-purple-500'
  },
  {
    id: 'browse',
    title: 'Browse & Organize',
    description: 'View all your contracts in one place. Filter by status, type, or expiration date. Use the sidebar to navigate.',
    icon: FileText,
    action: { label: 'View Contracts', href: '/contracts' },
    tips: [
      'Use grid or list view to browse',
      'Click any contract to see details',
      'Star important contracts for quick access'
    ],
    shortcut: '⌘⇧C',
    color: 'from-violet-500 to-purple-500'
  },
  {
    id: 'ai',
    title: 'Ask AI Anything',
    description: 'Use our AI assistant to ask questions about your contracts. Get instant answers about terms, dates, and obligations.',
    icon: MessageSquare,
    action: { label: 'Try AI Chat', href: '/ai/chat' },
    tips: [
      'Ask "What are my contracts expiring this month?"',
      'Try "Summarize the payment terms in contract X"',
      'Request risk analysis or compliance checks'
    ],
    shortcut: '⌘/',
    color: 'from-violet-500 to-pink-500'
  },
  {
    id: 'search',
    title: 'Smart Search',
    description: 'Find anything across all contracts with our semantic search. Search by meaning, not just keywords.',
    icon: Search,
    action: { label: 'Try Search', href: '/search' },
    tips: [
      'Search for concepts like "liability clauses"',
      'Filter results by contract type or date',
      'Use natural language queries'
    ],
    shortcut: '⌘K',
    color: 'from-amber-500 to-orange-500'
  },
  {
    id: 'analytics',
    title: 'View Analytics',
    description: 'Get insights into your contract portfolio. Track renewals, monitor risks, and identify opportunities.',
    icon: BarChart3,
    action: { label: 'See Analytics', href: '/analytics' },
    tips: [
      'Monitor portfolio health at a glance',
      'Track upcoming renewals and expirations',
      'Identify contracts needing attention'
    ],
    shortcut: '⌘⇧A',
    color: 'from-violet-500 to-violet-500'
  }
];

interface QuickStartGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function QuickStartGuide({ isOpen, onClose, onComplete }: QuickStartGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  const markStepComplete = useCallback(() => {
    setCompletedSteps(prev => new Set([...prev, step.id]));
  }, [step.id]);

  const handleNext = useCallback(() => {
    markStepComplete();
    if (isLastStep) {
      onComplete?.();
      onClose();
      // Save completion to localStorage
      localStorage.setItem('contigo-quickstart-completed', 'true');
    } else {
      setCurrentStep(prev => prev + 1);
    }
  }, [isLastStep, markStepComplete, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleSkip = useCallback(() => {
    localStorage.setItem('contigo-quickstart-skipped', 'true');
    onClose();
  }, [onClose]);

  const StepIcon = step.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="contents">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSkip}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg bg-gradient-to-br text-white",
                  step.color
                )}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Quick Start Guide</h2>
                  <p className="text-xs text-slate-500">Step {currentStep + 1} of {steps.length}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleSkip} aria-label="Close quick start guide">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress */}
            <div className="px-4 pt-2">
              <Progress value={progress} className="h-1" />
            </div>

            {/* Step Navigation Pills */}
            <div className="flex gap-1 px-4 py-3 overflow-x-auto">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                    i === currentStep
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : completedSteps.has(s.id)
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  )}
                >
                  {completedSteps.has(s.id) && <CheckCircle2 className="h-3 w-3" />}
                  {s.title}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Icon & Title */}
                  <div className="flex items-start gap-4 mb-6">
                    <div className={cn(
                      "p-4 rounded-2xl bg-gradient-to-br text-white shadow-lg",
                      step.color
                    )}>
                      <StepIcon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                        {step.title}
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        {step.description}
                      </p>
                      {step.shortcut && (
                        <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
                          <Keyboard className="h-3 w-3" />
                          <span>Shortcut:</span>
                          <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono">
                            {step.shortcut}
                          </kbd>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      Pro Tips
                    </h4>
                    <ul className="space-y-2">
                      {step.tips.map((tip, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <ChevronRight className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Button */}
                  {step.action && (
                    <div className="flex justify-center">
                      {step.action.href ? (
                        <Button
                          asChild
                          size="lg"
                          className={cn(
                            "gap-2 bg-gradient-to-r text-white shadow-lg hover:shadow-xl transition-shadow",
                            step.color
                          )}
                        >
                          <Link href={step.action.href}>
                            <Play className="h-4 w-4" />
                            {step.action.label}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={step.action.onClick}
                          className={cn(
                            "gap-2 bg-gradient-to-r text-white shadow-lg hover:shadow-xl transition-shadow",
                            step.color
                          )}
                        >
                          <Play className="h-4 w-4" />
                          {step.action.label}
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSkip}>
                  Skip for now
                </Button>
                <Button onClick={handleNext} className="gap-1">
                  {isLastStep ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Get Started
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook to manage Quick Start Guide state
 */
export function useQuickStartGuide() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // Check if should auto-show on first visit
  const checkFirstVisit = useCallback(() => {
    if (typeof window === 'undefined') return false;
    const completed = localStorage.getItem('contigo-quickstart-completed');
    const skipped = localStorage.getItem('contigo-quickstart-skipped');
    return !completed && !skipped;
  }, []);

  return {
    isOpen,
    open,
    close,
    checkFirstVisit,
  };
}

export default QuickStartGuide;
