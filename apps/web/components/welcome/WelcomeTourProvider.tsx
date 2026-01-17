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
  LayoutDashboard,
  FolderOpen,
  Upload,
  MessageSquare,
  Search,
  BarChart3,
  Settings,
  Keyboard,
  PartyPopper,
  Bell,
  Shield,
  Zap,
} from 'lucide-react';

const defaultTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ConTigo! 🎉',
    description: "We're thrilled to have you! Let's take a quick 2-minute tour to help you get the most out of your AI-powered contract management platform.",
    icon: Sparkles,
    position: 'center',
    tip: 'You can restart this tour anytime from Settings',
  },
  {
    id: 'dashboard',
    target: '[data-tour="dashboard"]',
    title: 'Your Command Center',
    description: 'Get a bird\'s-eye view of your entire contract portfolio. Monitor active contracts, upcoming renewals, and portfolio health at a glance.',
    icon: LayoutDashboard,
    position: 'right',
    spotlightPadding: 12,
    action: {
      label: 'Go to Dashboard',
      href: '/',
    },
  },
  {
    id: 'contracts',
    target: '[data-tour="contracts"]',
    title: 'Contract Library',
    description: 'All your contracts organized in one place. Search, filter, and manage your entire portfolio with powerful AI-assisted tools.',
    icon: FolderOpen,
    position: 'right',
    spotlightPadding: 12,
    action: {
      label: 'Browse Contracts',
      href: '/contracts',
    },
  },
  {
    id: 'upload',
    target: '[data-tour="upload"]',
    title: 'Smart Upload',
    description: 'Simply drag and drop your contracts. Our AI automatically extracts parties, dates, values, and key terms from any document format.',
    icon: Upload,
    position: 'right',
    spotlightPadding: 12,
    tip: 'Supports PDF, DOCX, and images with OCR',
  },
  {
    id: 'ai-assistant',
    target: '[data-tour="ai-assistant"]',
    title: 'AI Assistant ✨',
    description: 'Ask questions in natural language! "What contracts expire this quarter?" "Find all NDAs with tech companies." Your AI understands your contracts.',
    icon: MessageSquare,
    position: 'right',
    spotlightPadding: 12,
    action: {
      label: 'Try AI Chat',
      href: '/ai/chat',
    },
  },
  {
    id: 'search',
    target: '[data-tour="smart-search"]',
    title: 'Semantic Search',
    description: 'Search that understands context, not just keywords. Find "liability caps over $1M" or "auto-renewal clauses" instantly across all documents.',
    icon: Search,
    position: 'right',
    spotlightPadding: 12,
    tip: 'Press ⌘K (or Ctrl+K) to quick search anytime',
  },
  {
    id: 'reports',
    target: '[data-tour="analytics"]',
    title: 'AI Report Builder',
    description: 'Generate custom reports with AI assistance. Get executive summaries, risk analyses, and actionable insights for any subset of contracts.',
    icon: BarChart3,
    position: 'right',
    spotlightPadding: 12,
    action: {
      label: 'Build a Report',
      href: '/reports/ai-builder',
    },
  },
  {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Smart Alerts',
    description: 'Never miss a deadline. Get intelligent notifications for renewals, expirations, and AI-detected risks before they become problems.',
    icon: Bell,
    position: 'left',
    spotlightPadding: 12,
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Pro Tips ⌨️',
    description: 'Power up your workflow! Press ⌘K for the command palette, / to focus search, ⌘/ for AI Assistant, and ? to see all keyboard shortcuts.',
    icon: Keyboard,
    position: 'center',
    tip: 'Keyboard shortcuts work anywhere in the app',
  },
  {
    id: 'complete',
    title: "You're All Set! 🚀",
    description: "That's the essentials! Explore at your own pace. Need help later? Click the ? icon or visit the Tour page anytime from the sidebar.",
    icon: PartyPopper,
    position: 'center',
    action: {
      label: 'Start Exploring',
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
