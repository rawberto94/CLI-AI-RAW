'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  memo,
  ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Sparkles,
  Upload,
  FileText,
  BarChart3,
  Settings,
  Users,
  Zap,
  Brain,
  Target,
  Rocket,
  ArrowRight,
  CircleDot,
  Play,
  SkipForward,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  content?: ReactNode;
  completedMessage?: string;
}

export interface OnboardingConfig {
  id: string;
  title: string;
  subtitle?: string;
  steps: OnboardingStep[];
  onComplete?: () => void;
  onSkip?: () => void;
  showProgressBar?: boolean;
  allowSkip?: boolean;
  persistKey?: string;
}

interface OnboardingContextType {
  isOnboarding: boolean;
  currentOnboarding: OnboardingConfig | null;
  currentStep: number;
  startOnboarding: (config: OnboardingConfig) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipOnboarding: () => void;
  completeOnboarding: () => void;
  goToStep: (step: number) => void;
  isComplete: (onboardingId: string) => boolean;
  resetOnboarding: (onboardingId: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider = memo(function OnboardingProvider({
  children,
}: OnboardingProviderProps) {
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentOnboarding, setCurrentOnboarding] = useState<OnboardingConfig | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedOnboardings, setCompletedOnboardings] = useState<Set<string>>(new Set());

  // Load completed onboardings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('completed-onboardings');
      if (stored) {
        setCompletedOnboardings(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore errors
    }
  }, []);

  // Save completed onboardings to localStorage
  const saveCompleted = useCallback((completed: Set<string>) => {
    try {
      localStorage.setItem('completed-onboardings', JSON.stringify([...completed]));
    } catch {
      // Ignore errors
    }
  }, []);

  const startOnboarding = useCallback((config: OnboardingConfig) => {
    setCurrentOnboarding(config);
    setCurrentStep(0);
    setIsOnboarding(true);
  }, []);

  const nextStep = useCallback(() => {
    if (!currentOnboarding) return;
    if (currentStep < currentOnboarding.steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Complete onboarding
      const newCompleted = new Set(completedOnboardings);
      newCompleted.add(currentOnboarding.id);
      setCompletedOnboardings(newCompleted);
      saveCompleted(newCompleted);
      currentOnboarding.onComplete?.();
      setIsOnboarding(false);
      setCurrentOnboarding(null);
    }
  }, [currentOnboarding, currentStep, completedOnboardings, saveCompleted]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const skipOnboarding = useCallback(() => {
    if (currentOnboarding) {
      currentOnboarding.onSkip?.();
      // Mark as complete even when skipped
      const newCompleted = new Set(completedOnboardings);
      newCompleted.add(currentOnboarding.id);
      setCompletedOnboardings(newCompleted);
      saveCompleted(newCompleted);
    }
    setIsOnboarding(false);
    setCurrentOnboarding(null);
  }, [currentOnboarding, completedOnboardings, saveCompleted]);

  const completeOnboarding = useCallback(() => {
    if (currentOnboarding) {
      const newCompleted = new Set(completedOnboardings);
      newCompleted.add(currentOnboarding.id);
      setCompletedOnboardings(newCompleted);
      saveCompleted(newCompleted);
      currentOnboarding.onComplete?.();
    }
    setIsOnboarding(false);
    setCurrentOnboarding(null);
  }, [currentOnboarding, completedOnboardings, saveCompleted]);

  const goToStep = useCallback((step: number) => {
    if (currentOnboarding && step >= 0 && step < currentOnboarding.steps.length) {
      setCurrentStep(step);
    }
  }, [currentOnboarding]);

  const isComplete = useCallback(
    (onboardingId: string) => completedOnboardings.has(onboardingId),
    [completedOnboardings]
  );

  const resetOnboarding = useCallback(
    (onboardingId: string) => {
      const newCompleted = new Set(completedOnboardings);
      newCompleted.delete(onboardingId);
      setCompletedOnboardings(newCompleted);
      saveCompleted(newCompleted);
    },
    [completedOnboardings, saveCompleted]
  );

  const value = useMemo(
    () => ({
      isOnboarding,
      currentOnboarding,
      currentStep,
      startOnboarding,
      nextStep,
      previousStep,
      skipOnboarding,
      completeOnboarding,
      goToStep,
      isComplete,
      resetOnboarding,
    }),
    [
      isOnboarding,
      currentOnboarding,
      currentStep,
      startOnboarding,
      nextStep,
      previousStep,
      skipOnboarding,
      completeOnboarding,
      goToStep,
      isComplete,
      resetOnboarding,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <OnboardingModal />
    </OnboardingContext.Provider>
  );
});

// ============================================================================
// Modal Component
// ============================================================================

const OnboardingModal = memo(function OnboardingModal() {
  const { isOnboarding, currentOnboarding, currentStep, nextStep, previousStep, skipOnboarding } =
    useOnboarding();

  if (!isOnboarding || !currentOnboarding) return null;

  const step = currentOnboarding.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === currentOnboarding.steps.length - 1;
  const progress = ((currentStep + 1) / currentOnboarding.steps.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Progress Bar */}
          {currentOnboarding.showProgressBar !== false && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-100 dark:bg-zinc-800">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}

          {/* Close/Skip Button */}
          {currentOnboarding.allowSkip !== false && (
            <button
              onClick={skipOnboarding}
              className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Step Indicators */}
          <div className="flex justify-center gap-2 pt-6">
            {currentOnboarding.steps.map((_, index) => (
              <motion.div
                key={index}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-8 bg-violet-500'
                    : index < currentStep
                    ? 'w-2 bg-violet-500'
                    : 'w-2 bg-zinc-200 dark:bg-zinc-700'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="p-8 pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="text-center"
              >
                {/* Icon */}
                {step.icon && (
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-gradient-to-br from-violet-500 to-violet-500 rounded-2xl shadow-lg shadow-violet-500/25">
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                )}

                {/* Illustration */}
                {step.illustration && (
                  <div className="mb-6">{step.illustration}</div>
                )}

                {/* Title */}
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-3">
                  {step.title}
                </h2>

                {/* Description */}
                <p className="text-zinc-600 dark:text-zinc-400 text-lg mb-6 max-w-md mx-auto">
                  {step.description}
                </p>

                {/* Custom Content */}
                {step.content && <div className="mb-6">{step.content}</div>}

                {/* Step Counter */}
                <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-6">
                  Step {currentStep + 1} of {currentOnboarding.steps.length}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-8 pb-8">
            <button
              onClick={previousStep}
              disabled={isFirstStep}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                isFirstStep
                  ? 'opacity-0 pointer-events-none'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {step.secondaryAction && (
                <button
                  onClick={step.secondaryAction.onClick}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  {step.secondaryAction.label}
                </button>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={step.action?.onClick || nextStep}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
              >
                {step.action?.label || (isLastStep ? 'Get Started' : 'Continue')}
                {isLastStep ? (
                  <Rocket className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});

// ============================================================================
// Welcome Screen Component
// ============================================================================

interface WelcomeScreenProps {
  title: string;
  subtitle?: string;
  features: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }[];
  onGetStarted: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
}

export const WelcomeScreen = memo(function WelcomeScreen({
  title,
  subtitle,
  features,
  onGetStarted,
  onSkip,
  showSkip = true,
}: WelcomeScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900"
    >
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        {/* Logo/Icon Animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 15, delay: 0.2 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-violet-500 via-violet-500 to-purple-500 rounded-3xl shadow-2xl shadow-violet-500/30 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <Check className="w-4 h-4 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4"
        >
          {title}
        </motion.h1>

        {/* Subtitle */}
        {subtitle && (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto"
          >
            {subtitle}
          </motion.p>
        )}

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="p-6 bg-white dark:bg-zinc-800/50 rounded-2xl shadow-lg border border-zinc-200 dark:border-zinc-700/50"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500/10 to-violet-500/10 rounded-xl flex items-center justify-center mb-4 mx-auto">
                <feature.icon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onGetStarted}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-500 to-violet-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
          >
            <Play className="w-5 h-5" />
            Get Started
          </motion.button>

          {showSkip && onSkip && (
            <button
              onClick={onSkip}
              className="flex items-center gap-2 px-6 py-3 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4" />
              Skip for now
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
});

// ============================================================================
// Checklist Component
// ============================================================================

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  completed: boolean;
  href?: string;
  onClick?: () => void;
}

interface OnboardingChecklistProps {
  title: string;
  subtitle?: string;
  items: ChecklistItem[];
  onItemClick?: (item: ChecklistItem) => void;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const OnboardingChecklist = memo(function OnboardingChecklist({
  title,
  subtitle,
  items,
  onItemClick,
  className = '',
  collapsed = false,
  onToggleCollapse,
}: OnboardingChecklistProps) {
  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;
  const allCompleted = completedCount === items.length;

  if (allCompleted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className={`p-4 border-b border-zinc-100 dark:border-zinc-800 ${
          onToggleCollapse ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''
        }`}
        onClick={onToggleCollapse}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-violet-500 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">{title}</h3>
              {subtitle && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {completedCount}/{items.length}
            </span>
            {onToggleCollapse && (
              <ChevronRight
                className={`w-5 h-5 text-zinc-400 transition-transform ${
                  collapsed ? '' : 'rotate-90'
                }`}
              />
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-violet-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Items */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-2">
              {items.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    item.onClick?.();
                    onItemClick?.(item);
                  }}
                  disabled={item.completed}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left ${
                    item.completed
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      item.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {item.completed ? (
                      <Check className="w-4 h-4" />
                    ) : item.icon ? (
                      <item.icon className="w-4 h-4" />
                    ) : (
                      <CircleDot className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium ${
                        item.completed
                          ? 'text-green-700 dark:text-green-400 line-through'
                          : 'text-zinc-900 dark:text-white'
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {!item.completed && (
                    <ArrowRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ============================================================================
// Progress Badge Component
// ============================================================================

interface ProgressBadgeProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export const ProgressBadge = memo(function ProgressBadge({
  current,
  total,
  label = 'Setup',
  className = '',
}: ProgressBadgeProps) {
  const progress = (current / total) * 100;

  if (current >= total) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 rounded-full ${className}`}
    >
      <div className="w-16 h-1.5 bg-violet-100 dark:bg-violet-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs font-medium text-violet-700 dark:text-violet-400">
        {label} {current}/{total}
      </span>
    </motion.div>
  );
});

// ============================================================================
// Default Onboarding Configuration
// ============================================================================

export const defaultContractOnboarding: OnboardingConfig = {
  id: 'contract-platform-intro',
  title: 'Welcome to Contract Intelligence',
  steps: [
    {
      id: 'welcome',
      title: 'Welcome to Contract Intelligence',
      description:
        'Your AI-powered platform for contract management, analysis, and optimization. Let us show you around!',
      icon: Sparkles,
    },
    {
      id: 'upload',
      title: 'Upload Your Contracts',
      description:
        'Drag and drop your contracts to get started. We support PDF, Word, and scanned documents with OCR processing.',
      icon: Upload,
    },
    {
      id: 'analysis',
      title: 'AI-Powered Analysis',
      description:
        'Our AI automatically extracts key terms, dates, obligations, and identifies potential risks in your contracts.',
      icon: Brain,
    },
    {
      id: 'analytics',
      title: 'Powerful Analytics',
      description:
        'Get insights into your contract portfolio with dashboards, reports, and trend analysis.',
      icon: BarChart3,
    },
    {
      id: 'ready',
      title: "You're All Set!",
      description:
        "You're ready to start managing your contracts more intelligently. Let's begin!",
      icon: Rocket,
    },
  ],
  showProgressBar: true,
  allowSkip: true,
};
