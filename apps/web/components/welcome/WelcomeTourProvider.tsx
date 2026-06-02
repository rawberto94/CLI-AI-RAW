'use client';

/**
 * Welcome Tour Provider
 * 
 * Manages the welcome tour state and provides context for tour components.
 * Handles first-time user detection, tour progress persistence, and tour triggers.
 */

import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useEffect, 
  useMemo,
  ReactNode 
} from 'react';

// ============================================================================
// Types
// ============================================================================

export interface TourStep {
  id: string;
  target?: string; // CSS selector for element to highlight
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  spotlightPadding?: number;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  tip?: string;
}

interface WelcomeTourContextValue {
  // State
  isOpen: boolean;
  isWelcomeModalOpen: boolean;
  currentStep: number;
  steps: TourStep[];
  isFirstVisit: boolean;
  hasCompletedTour: boolean;
  
  // Actions
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  startTour: () => void;
  endTour: (completed?: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  skipTour: () => void;
  resetTour: () => void;
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  FIRST_VISIT: 'contigo-first-visit',
  TOUR_COMPLETED: 'contigo-welcome-tour-completed',
  TOUR_SKIPPED: 'contigo-welcome-tour-skipped',
  DONT_SHOW_AGAIN: 'contigo-welcome-dont-show',
} as const;

// ============================================================================
// Context
// ============================================================================

const WelcomeTourContext = createContext<WelcomeTourContextValue | null>(null);

export function useWelcomeTour() {
  const context = useContext(WelcomeTourContext);
  if (!context) {
    throw new Error('useWelcomeTour must be used within WelcomeTourProvider');
  }
  return context;
}

// Optional hook that doesn't throw
export function useWelcomeTourOptional() {
  return useContext(WelcomeTourContext);
}

// ============================================================================
// Default Tour Steps
// ============================================================================

import {
  Sparkles,
  TrainFront,
  FolderOpen,
  Upload,
  MessageSquare,
  Search,
  PartyPopper,
  Zap,
} from 'lucide-react';

const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome, Stadler 🚆',
    description: "ConTigo brings Swiss-precision AI to your contract portfolio. In the next 90 seconds, you'll see how we turn complex supplier agreements, maintenance contracts, and procurement deals into instant, actionable intelligence.",
    icon: TrainFront,
    position: 'center',
    tip: 'You can restart this tour anytime from the help menu',
  },
  {
    id: 'contracts',
    title: 'Your Contract Library',
    description: 'Every supplier agreement, service contract, and maintenance deal — organized, searchable, and enriched with AI-generated summaries, risk scores, and key dates. No more digging through shared drives.',
    icon: FolderOpen,
    position: 'center',
    action: {
      label: 'Browse Contracts',
      href: '/contracts',
    },
  },
  {
    id: 'upload',
    title: 'Smart Upload',
    description: 'Drag and drop any PDF, Word doc, or scanned image. Our AI extracts parties, contract values, renewal dates, liability caps, and termination clauses — automatically, in seconds.',
    icon: Upload,
    position: 'center',
    tip: 'OCR handles scanned documents and multi-language contracts',
  },
  {
    id: 'search',
    title: 'Semantic Search',
    description: 'Search like you think. "Find all maintenance contracts with auto-renewal" or "Which suppliers have liability caps below CHF 5M?" ConTigo understands context, not just keywords.',
    icon: Search,
    position: 'center',
    tip: 'Press ⌘K (or Ctrl+K) to search from anywhere',
  },
  {
    id: 'ai-assistant',
    title: 'AI Assistant ✨',
    description: 'Ask anything in plain language. "Summarize the Alstom maintenance agreement." "What contracts expire in Q3?" "Compare liability clauses across my top 5 suppliers." Your AI counsel is always on.',
    icon: MessageSquare,
    position: 'center',
    action: {
      label: 'Try AI Chat',
      href: '/ai/chat',
    },
  },
  {
    id: 'complete',
    title: "You're All Set! 🚀",
    description: "That's the essentials. Upload a contract, ask a question, or run a search — ConTigo is ready when you are. Need help? Click the help button anytime.",
    icon: PartyPopper,
    position: 'center',
    action: {
      label: 'Explore ConTigo',
      href: '/contracts',
    },
  },
];

// ============================================================================
// Provider Component
// ============================================================================

interface WelcomeTourProviderProps {
  children: ReactNode;
  steps?: TourStep[];
  autoShowForNewUsers?: boolean;
  showDelay?: number;
}

export function WelcomeTourProvider({
  children,
  steps = defaultTourSteps,
  autoShowForNewUsers = true,
  showDelay = 1000,
}: WelcomeTourProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for first visit on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const tourCompleted = localStorage.getItem(STORAGE_KEYS.TOUR_COMPLETED);
    const tourSkipped = localStorage.getItem(STORAGE_KEYS.TOUR_SKIPPED);
    const dontShow = localStorage.getItem(STORAGE_KEYS.DONT_SHOW_AGAIN);
    const firstVisit = localStorage.getItem(STORAGE_KEYS.FIRST_VISIT);

    const hasCompleted = tourCompleted === 'true';
    const hasSkipped = tourSkipped === 'true';
    const shouldNotShow = dontShow === 'true';
    const isNew = !firstVisit;

    setHasCompletedTour(hasCompleted);
    setIsFirstVisit(isNew);

    // Mark that user has visited
    if (isNew) {
      localStorage.setItem(STORAGE_KEYS.FIRST_VISIT, 'true');
    }

    // Auto-show welcome modal for new users
    if (autoShowForNewUsers && isNew && !hasCompleted && !hasSkipped && !shouldNotShow) {
      const timer = setTimeout(() => {
        setIsWelcomeModalOpen(true);
      }, showDelay);
      return () => clearTimeout(timer);
    }

    setIsInitialized(true);
  }, [autoShowForNewUsers, showDelay]);

  // Listen for global tour trigger events
  useEffect(() => {
    const handleShowTour = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };

    const handleShowWelcome = () => {
      setIsWelcomeModalOpen(true);
    };

    window.addEventListener('contigo-start-tour', handleShowTour);
    window.addEventListener('contigo-show-welcome', handleShowWelcome);

    return () => {
      window.removeEventListener('contigo-start-tour', handleShowTour);
      window.removeEventListener('contigo-show-welcome', handleShowWelcome);
    };
  }, []);

  const openWelcomeModal = useCallback(() => {
    setIsWelcomeModalOpen(true);
  }, []);

  const closeWelcomeModal = useCallback(() => {
    setIsWelcomeModalOpen(false);
  }, []);

  const startTour = useCallback(() => {
    setIsWelcomeModalOpen(false);
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const endTour = useCallback((completed = false) => {
    setIsOpen(false);
    if (completed) {
      setHasCompletedTour(true);
      localStorage.setItem(STORAGE_KEYS.TOUR_COMPLETED, 'true');
    }
  }, []);

  const skipTour = useCallback(() => {
    setIsOpen(false);
    setIsWelcomeModalOpen(false);
    localStorage.setItem(STORAGE_KEYS.TOUR_SKIPPED, 'true');
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour(true);
    }
  }, [currentStep, steps.length, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((index: number) => {
    if (index >= 0 && index < steps.length) {
      setCurrentStep(index);
    }
  }, [steps.length]);

  const resetTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.TOUR_COMPLETED);
    localStorage.removeItem(STORAGE_KEYS.TOUR_SKIPPED);
    localStorage.removeItem(STORAGE_KEYS.DONT_SHOW_AGAIN);
    setHasCompletedTour(false);
    setCurrentStep(0);
  }, []);

  const value = useMemo<WelcomeTourContextValue>(() => ({
    isOpen,
    isWelcomeModalOpen,
    currentStep,
    steps,
    isFirstVisit,
    hasCompletedTour,
    openWelcomeModal,
    closeWelcomeModal,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    resetTour,
  }), [
    isOpen,
    isWelcomeModalOpen,
    currentStep,
    steps,
    isFirstVisit,
    hasCompletedTour,
    openWelcomeModal,
    closeWelcomeModal,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    resetTour,
  ]);

  return (
    <WelcomeTourContext.Provider value={value}>
      {children}
    </WelcomeTourContext.Provider>
  );
}

// Helper function to trigger tour from anywhere
export function triggerWelcomeTour() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('contigo-start-tour'));
  }
}

export function triggerWelcomeModal() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('contigo-show-welcome'));
  }
}
