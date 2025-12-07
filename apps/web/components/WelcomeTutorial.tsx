"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  action?: {
    label: string;
    href: string;
  };
  gradient: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to ConTigo",
    description: "Your AI-powered contract intelligence platform. Let's get you started with the core features.",
    icon: Sparkles,
    features: [
      "Analyze contracts with AI in seconds",
      "Extract key terms and obligations automatically",
      "Get instant answers to contract questions",
      "Generate AI-powered reports across your portfolio",
    ],
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "contracts",
    title: "Contracts Hub",
    description: "Your central hub for managing all contracts. Upload, organize, and analyze documents.",
    icon: FolderOpen,
    features: [
      "Upload PDF, DOCX, or image files",
      "AI extracts parties, dates, values automatically",
      "View contract status and health scores",
      "Search and filter across all documents",
    ],
    action: {
      label: "Go to Contracts",
      href: "/contracts",
    },
    gradient: "from-emerald-600 to-teal-600",
  },
  {
    id: "ai-chatbot",
    title: "AI Agent Assistant",
    description: "Ask complex questions about your contracts. ConTigo's AI agent understands context and provides deep analysis.",
    icon: MessageSquare,
    features: [
      "Ask 'Summarize Deloitte contracts from 2024'",
      "Get duration, value, and category breakdowns",
      "Compare clauses across multiple contracts",
      "Find obligations, deadlines, and renewal terms",
    ],
    action: {
      label: "Try AI Agent",
      href: "/ai/chat",
    },
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "ai-reports",
    title: "Self-Service AI Reports",
    description: "Generate comprehensive AI-powered reports across your entire contract portfolio.",
    icon: BarChart3,
    features: [
      "Filter by supplier, category, year, or status",
      "Get AI-generated executive summaries",
      "Visualize spend and contract distribution",
      "Export insights for stakeholder presentations",
    ],
    action: {
      label: "Build a Report",
      href: "/reports/ai-builder",
    },
    gradient: "from-cyan-600 to-blue-600",
  },
  {
    id: "get-started",
    title: "You're All Set!",
    description: "Start by uploading a contract or exploring the AI features with your existing data.",
    icon: CheckCircle,
    features: [
      "Upload your first contract to see AI analysis",
      "Ask the AI agent to summarize your contracts",
      "Build a custom report in Self-Service",
      "Check the Dashboard for portfolio overview",
    ],
    action: {
      label: "Start Exploring",
      href: "/contracts",
    },
    gradient: "from-orange-500 to-rose-500",
  },
];

export function WelcomeTutorial() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user has seen the full tutorial
    const hasCompletedTutorial = localStorage.getItem("contigo-tutorial-completed");
    if (!hasCompletedTutorial) {
      setIsOpen(true);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (dontShowAgain) {
      localStorage.setItem("contigo-tutorial-completed", "true");
    }
  }, [dontShowAgain]);

  const handleComplete = useCallback(() => {
    setIsOpen(false);
    localStorage.setItem("contigo-tutorial-completed", "true");
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setDirection('next');
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setDirection('prev');
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleAction = useCallback(() => {
    const step = tutorialSteps[currentStep];
    if (step?.action) {
      handleComplete();
      if (step.id === "ai-chatbot") {
        // Open the AI chatbot bubble instead of navigating
        window.dispatchEvent(new CustomEvent('openAIChatbot'));
      } else {
        router.push(step.action.href);
      }
    }
  }, [currentStep, handleComplete, router]);

  const handleSkip = useCallback(() => {
    if (dontShowAgain) {
      localStorage.setItem("contigo-tutorial-completed", "true");
    }
    setIsOpen(false);
  }, [dontShowAgain]);

  if (!isOpen) return null;

  const step = tutorialSteps[currentStep];
  if (!step) return null;
  
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Step counter */}
        <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full">
          <span className="text-white text-sm font-medium">
            Step {currentStep + 1} of {tutorialSteps.length}
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-10 p-2 text-white/80 hover:text-white transition-colors"
          title="Press Escape to close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with gradient - animated */}
        <div 
          key={step.id}
          className={cn(
            "p-8 bg-gradient-to-br transition-all duration-500 ease-out",
            step.gradient,
            direction === 'next' ? 'animate-in slide-in-from-right-4' : 'animate-in slide-in-from-left-4'
          )}
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-sm animate-in zoom-in-75 duration-300 delay-100">
              <Icon className="h-8 w-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{step.title}</h2>
              <p className="text-white/80 text-sm mt-1">{step.description}</p>
            </div>
          </div>
        </div>

        {/* Features list - animated */}
        <div 
          key={`features-${step.id}`}
          className={cn(
            "p-6",
            direction === 'next' ? 'animate-in fade-in slide-in-from-right-2 duration-300' : 'animate-in fade-in slide-in-from-left-2 duration-300'
          )}
        >
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
            Key Features
          </h3>
          <ul className="space-y-3">
            {step.features.map((feature, index) => (
              <li 
                key={index} 
                className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br", step.gradient)}>
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <span className="text-slate-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentStep ? 'next' : 'prev');
                setCurrentStep(index);
              }}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index === currentStep
                  ? "w-8 bg-blue-600"
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              )}
              title={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 p-4 border-t border-slate-100 bg-slate-50">
          {/* Don't show again checkbox */}
          <label className="flex items-center gap-2 text-sm text-slate-500 cursor-pointer hover:text-slate-700">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            Don&apos;t show this again
          </label>
          
          <div className="flex items-center justify-between">
            <div>
              {currentStep > 0 ? (
              <Button
                variant="ghost"
                onClick={handlePrevious}
                className="text-slate-600"
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

          <div className="flex gap-2">
            {step.action && (
              <Button
                variant="outline"
                onClick={handleAction}
                className="gap-1"
              >
                {step.action.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={handleNext}
              className={cn("gap-1 bg-gradient-to-r hover:opacity-90", step.gradient)}
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
            </div>
          </div>
          
          {/* Keyboard hint */}
          <p className="text-xs text-center text-slate-400">
            Use ← → arrow keys to navigate, Escape to close
          </p>
        </div>
      </div>
    </div>
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
