"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  MessageSquare,
  Upload,
  Search,
  FileText,
  Sparkles,
  CheckCircle,
  ArrowRight,
  BarChart3,
  Zap,
  Brain,
  Shield,
  Clock,
  Target,
  Layers,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TutorialStep {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  features: Array<{ text: string; icon: React.ElementType }>;
  action?: {
    label: string;
    href: string;
  };
  gradient: string;
  bgPattern: string;
  accentColor: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to ConTigo",
    subtitle: "AI-Powered Contract Intelligence",
    description: "Transform how you manage contracts with advanced AI that understands, analyzes, and automates.",
    icon: Sparkles,
    features: [
      { text: "Instant AI analysis of any contract", icon: Brain },
      { text: "Automatic extraction of key terms", icon: Target },
      { text: "Smart contract health scoring", icon: Shield },
      { text: "Natural language Q&A", icon: MessageSquare },
    ],
    gradient: "from-violet-600 via-purple-600 to-indigo-600",
    bgPattern: "radial-gradient(circle at 20% 80%, rgba(139, 92, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.3) 0%, transparent 50%)",
    accentColor: "violet",
  },
  {
    id: "contracts",
    title: "Your Contract Hub",
    subtitle: "Centralized Management",
    description: "All your contracts in one intelligent workspace. Upload, organize, and find anything instantly.",
    icon: FolderOpen,
    features: [
      { text: "Drag & drop PDF, DOCX, images", icon: Upload },
      { text: "AI extracts parties & dates", icon: Clock },
      { text: "Smart search across all docs", icon: Search },
      { text: "Real-time processing status", icon: Zap },
    ],
    action: {
      label: "Explore Contracts",
      href: "/contracts",
    },
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
    bgPattern: "radial-gradient(circle at 30% 70%, rgba(16, 185, 129, 0.3) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(6, 182, 212, 0.3) 0%, transparent 50%)",
    accentColor: "emerald",
  },
  {
    id: "ai-chatbot",
    title: "AI Assistant",
    subtitle: "Your Contract Expert",
    description: "Ask complex questions in plain English. Get instant answers backed by your contract data.",
    icon: MessageSquare,
    features: [
      { text: '"Summarize Q3 vendor contracts"', icon: FileText },
      { text: '"What obligations do we have?"', icon: Target },
      { text: '"Compare pricing across MSAs"', icon: BarChart3 },
      { text: '"Find renewal deadlines"', icon: Clock },
    ],
    action: {
      label: "Try AI Chat",
      href: "/ai/chat",
    },
    gradient: "from-pink-500 via-rose-500 to-red-500",
    bgPattern: "radial-gradient(circle at 25% 75%, rgba(236, 72, 153, 0.3) 0%, transparent 50%), radial-gradient(circle at 75% 25%, rgba(239, 68, 68, 0.3) 0%, transparent 50%)",
    accentColor: "pink",
  },
  {
    id: "analytics",
    title: "Self-Service Reports",
    subtitle: "Insights On Demand",
    description: "Build custom AI-powered reports across your entire portfolio. Export insights in seconds.",
    icon: BarChart3,
    features: [
      { text: "Filter by supplier, category, year", icon: Layers },
      { text: "AI-generated executive summaries", icon: Brain },
      { text: "Interactive visualizations", icon: BarChart3 },
      { text: "One-click export to PDF", icon: FileText },
    ],
    action: {
      label: "Build Report",
      href: "/reports/ai-builder",
    },
    gradient: "from-blue-500 via-indigo-500 to-violet-500",
    bgPattern: "radial-gradient(circle at 20% 60%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 40%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)",
    accentColor: "blue",
  },
  {
    id: "ready",
    title: "You're Ready!",
    subtitle: "Start Your Journey",
    description: "Dive in and discover how ConTigo transforms your contract workflow.",
    icon: CheckCircle,
    features: [
      { text: "Upload your first contract", icon: Upload },
      { text: "Ask AI about your documents", icon: MessageSquare },
      { text: "Build a custom report", icon: BarChart3 },
      { text: "Explore the dashboard", icon: Target },
    ],
    action: {
      label: "Let's Go!",
      href: "/contracts",
    },
    gradient: "from-amber-500 via-orange-500 to-red-500",
    bgPattern: "radial-gradient(circle at 40% 60%, rgba(245, 158, 11, 0.3) 0%, transparent 50%), radial-gradient(circle at 60% 40%, rgba(239, 68, 68, 0.3) 0%, transparent 50%)",
    accentColor: "amber",
  },
];

export function WelcomeTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const hasCompletedTutorial = localStorage.getItem("contigo-tutorial-completed");
    if (!hasCompletedTutorial) {
      // Small delay for smoother entrance
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
      else if (e.key === 'ArrowLeft') handlePrevious();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStep, isAnimating]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (dontShowAgain) localStorage.setItem("contigo-tutorial-completed", "true");
  }, [dontShowAgain]);

  const handleComplete = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem("contigo-tutorial-completed", "true");
  }, []);

  const handleNext = useCallback(() => {
    if (isAnimating) return;
    if (currentStep < tutorialSteps.length - 1) {
      setIsAnimating(true);
      setDirection('next');
      setCurrentStep((prev) => prev + 1);
      setTimeout(() => setIsAnimating(false), 400);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete, isAnimating]);

  const handlePrevious = useCallback(() => {
    if (isAnimating || currentStep <= 0) return;
    setIsAnimating(true);
    setDirection('prev');
    setCurrentStep((prev) => prev - 1);
    setTimeout(() => setIsAnimating(false), 400);
  }, [currentStep, isAnimating]);

  const handleAction = useCallback(() => {
    const step = tutorialSteps[currentStep];
    if (step?.action) {
      handleComplete();
      if (step.id === "ai-chatbot") {
        window.dispatchEvent(new CustomEvent('openAIChatbot'));
      } else {
        router.push(step.action.href);
      }
    }
  }, [currentStep, handleComplete, router]);

  const handleSkip = useCallback(() => {
    if (dontShowAgain) localStorage.setItem("contigo-tutorial-completed", "true");
    setIsOpen(false);
  }, [dontShowAgain]);

  const step = useMemo(() => tutorialSteps[currentStep], [currentStep]);
  
  if (!isOpen || !step) return null;
  
  const Icon = step.icon;
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  return (
    <AnimatePresence mode="wait">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        {/* Animated background */}
        <motion.div 
          className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleSkip}
        />
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white/10 rounded-full"
              initial={{ 
                x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
                y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                y: [null, Math.random() * -200 - 100],
                opacity: [0.3, 0]
              }}
              transition={{ 
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                repeatType: "loop",
                delay: Math.random() * 2
              }}
            />
          ))}
        </div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 40 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-2xl"
        >
          {/* Glowing border effect */}
          <div className={cn(
            "absolute -inset-1 rounded-3xl bg-gradient-to-r opacity-75 blur-lg transition-all duration-500",
            step.gradient
          )} />
          
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            {/* Progress bar at top */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-800">
              <motion.div 
                className={cn("h-full bg-gradient-to-r", step.gradient)}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Close button */}
            <motion.button
              onClick={handleSkip}
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              className="absolute top-5 right-5 z-20 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </motion.button>

            {/* Header section with animated background */}
            <div 
              className={cn("relative p-8 pb-12 overflow-hidden bg-gradient-to-br", step.gradient)}
              style={{ backgroundImage: step.bgPattern }}
            >
              {/* Animated circles in background */}
              <motion.div
                className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/10"
                animate={{ 
                  scale: [1, 1.2, 1],
                  x: [0, 20, 0],
                  y: [0, -20, 0]
                }}
                transition={{ duration: 8, repeat: Infinity }}
              />
              <motion.div
                className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-white/10"
                animate={{ 
                  scale: [1, 1.3, 1],
                  x: [0, -10, 0],
                  y: [0, 10, 0]
                }}
                transition={{ duration: 6, repeat: Infinity, delay: 1 }}
              />

              {/* Step indicator */}
              <div className="relative z-10 flex items-center gap-2 mb-6">
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-white/20 text-white backdrop-blur-sm">
                  {currentStep + 1} / {tutorialSteps.length}
                </span>
                <span className="text-white/60 text-sm">{step.subtitle}</span>
              </div>

              {/* Icon and title */}
              <div className="relative z-10 flex items-start gap-5">
                <motion.div
                  key={step.id}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, stiffness: 200 }}
                  className="flex-shrink-0 p-4 rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg"
                >
                  <Icon className="h-10 w-10 text-white" />
                </motion.div>
                <div>
                  <motion.h2 
                    key={`title-${step.id}`}
                    initial={{ opacity: 0, x: direction === 'next' ? 30 : -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-3xl font-bold text-white mb-2"
                  >
                    {step.title}
                  </motion.h2>
                  <motion.p 
                    key={`desc-${step.id}`}
                    initial={{ opacity: 0, x: direction === 'next' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-white/80 text-lg max-w-md"
                  >
                    {step.description}
                  </motion.p>
                </div>
              </div>
            </div>

            {/* Features grid */}
            <div className="p-8">
              <div className="grid grid-cols-2 gap-4">
                {step.features.map((feature, index) => {
                  const FeatureIcon = feature.icon;
                  return (
                    <motion.div
                      key={`${step.id}-feature-${index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + index * 0.08 }}
                      whileHover={{ scale: 1.02, x: 4 }}
                      className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all cursor-default"
                    >
                      <div className={cn(
                        "flex-shrink-0 p-2 rounded-lg bg-gradient-to-br text-white",
                        step.gradient
                      )}>
                        <FeatureIcon className="h-4 w-4" />
                      </div>
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-tight">
                        {feature.text}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Navigation footer */}
            <div className="px-8 pb-6 pt-2 border-t border-slate-100 dark:border-slate-800">
              {/* Step dots */}
              <div className="flex justify-center gap-2 mb-6">
                {tutorialSteps.map((_, index) => (
                  <motion.button
                    key={index}
                    onClick={() => {
                      if (!isAnimating) {
                        setIsAnimating(true);
                        setDirection(index > currentStep ? 'next' : 'prev');
                        setCurrentStep(index);
                        setTimeout(() => setIsAnimating(false), 400);
                      }
                    }}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-300",
                      index === currentStep ? "w-8" : "w-2.5"
                    )}
                    whileHover={{ scale: 1.2 }}
                    style={{
                      background: index === currentStep 
                        ? `linear-gradient(to right, var(--tw-gradient-stops))` 
                        : '#e2e8f0'
                    }}
                  >
                    <span 
                      className={cn(
                        "block w-full h-full rounded-full bg-gradient-to-r",
                        index === currentStep ? step.gradient : "from-slate-300 to-slate-300"
                      )}
                    />
                  </motion.button>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {currentStep > 0 ? (
                    <Button
                      variant="ghost"
                      onClick={handlePrevious}
                      disabled={isAnimating}
                      className="text-slate-600 hover:text-slate-900"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={handleSkip}
                      className="text-slate-500"
                    >
                      Skip Tour
                    </Button>
                  )}
                </div>

                <div className="flex gap-3">
                  {step.action && (
                    <Button
                      variant="outline"
                      onClick={handleAction}
                      className="gap-2 border-2"
                    >
                      {step.action.label}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      onClick={handleNext}
                      disabled={isAnimating}
                      className={cn(
                        "gap-2 bg-gradient-to-r text-white shadow-lg hover:opacity-90 hover:shadow-xl transition-all",
                        step.gradient
                      )}
                    >
                      {currentStep < tutorialSteps.length - 1 ? (
                        <>
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Get Started
                          <Sparkles className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              </div>

              {/* Keyboard hint */}
              <p className="text-xs text-center text-slate-400 mt-4 flex items-center justify-center gap-2">
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">←</kbd>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">→</kbd>
                to navigate
                <span className="mx-1">•</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">esc</kbd>
                to close
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to reset and show tutorial
export function useWelcomeTutorial() {
  const showTutorial = useCallback(() => {
    localStorage.removeItem("contigo-tutorial-completed");
    // Trigger a re-render by dispatching a custom event
    window.dispatchEvent(new CustomEvent("show-tutorial"));
  }, []);

  return { showTutorial };
}

// Smaller tooltip-style hints for specific features
export function FeatureHint({
  children,
  title,
  description,
  show = true,
  storageKey,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  show?: boolean;
  storageKey: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      const hasSeen = localStorage.getItem(`hint-${storageKey}`);
      if (!hasSeen) {
        setIsVisible(true);
      }
    }
  }, [show, storageKey]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    localStorage.setItem(`hint-${storageKey}`, "true");
  }, [storageKey]);

  if (!isVisible) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 w-64 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-slate-900 text-white rounded-lg p-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm">{title}</h4>
              <p className="text-xs text-slate-300 mt-1">{description}</p>
            </div>
            <button
              onClick={dismiss}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-slate-900" />
        </div>
      </div>
    </div>
  );
}
