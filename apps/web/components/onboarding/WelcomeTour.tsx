'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Upload,
  Zap,
  CheckCircle2,
  Calendar,
  Shield,
  FileText,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  action?: {
    label: string;
    href: string;
  };
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Contract Intelligence',
    description: 'Your AI-powered command center for contract management. Let\'s take a quick tour of the key features.',
    icon: Sparkles,
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'upload',
    title: 'Upload Contracts',
    description: 'Drop any contract document and our AI will automatically extract key information, dates, parties, and obligations.',
    icon: Upload,
    color: 'from-blue-500 to-cyan-500',
    action: { label: 'Try Upload', href: '/upload' },
  },
  {
    id: 'intelligence',
    title: 'AI Intelligence Hub',
    description: 'Get health scores, AI-powered search, knowledge graphs, and negotiation insights for all your contracts.',
    icon: Zap,
    color: 'from-amber-500 to-orange-500',
    action: { label: 'Explore Intelligence', href: '/intelligence' },
  },
  {
    id: 'approvals',
    title: 'Smart Approvals',
    description: 'Track pending approvals with urgency indicators. Never miss a critical decision deadline.',
    icon: CheckCircle2,
    color: 'from-green-500 to-emerald-500',
    action: { label: 'View Approvals', href: '/approvals' },
  },
  {
    id: 'renewals',
    title: 'Renewal Management',
    description: 'Stay ahead of contract renewals with automated reminders and renewal forecasting.',
    icon: Calendar,
    color: 'from-teal-500 to-green-500',
    action: { label: 'Check Renewals', href: '/renewals' },
  },
  {
    id: 'governance',
    title: 'AI Governance',
    description: 'Ensure compliance with policies and guardrails. Get alerts when contracts violate standards.',
    icon: Shield,
    color: 'from-slate-500 to-gray-600',
    action: { label: 'Review Policies', href: '/governance' },
  },
  {
    id: 'shortcuts',
    title: 'Power User Shortcuts',
    description: 'Press ? anytime to see all keyboard shortcuts. Use ⌘K (or Ctrl+K) to quickly search and navigate.',
    icon: Keyboard,
    color: 'from-pink-500 to-rose-500',
  },
];

const STORAGE_KEY = 'contract-intel-tour-completed';

export function WelcomeTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if tour has been completed
    const tourCompleted = localStorage.getItem(STORAGE_KEY);
    if (!tourCompleted) {
      // Show tour after a short delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;

  if (!step) return null;
  
  const Icon = step.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={handleSkip}
          />

          {/* Tour Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-lg"
          >
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Header with Icon */}
              <div className={cn(
                "p-8 text-center bg-gradient-to-br text-white",
                step.color
              )}>
                <motion.div
                  key={step.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                  className="inline-flex p-4 bg-white/20 rounded-2xl mb-4"
                >
                  <Icon className="h-10 w-10" />
                </motion.div>
                <motion.h2
                  key={`title-${step.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-2xl font-bold mb-2"
                >
                  {step.title}
                </motion.h2>
              </div>

              {/* Content */}
              <div className="p-6">
                <motion.p
                  key={`desc-${step.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-gray-600 text-center mb-6"
                >
                  {step.description}
                </motion.p>

                {step.action && (
                  <Link
                    href={step.action.href}
                    onClick={handleComplete}
                    className="block w-full mb-4"
                  >
                    <Button className="w-full" variant="outline">
                      {step.action.label}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}

                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mb-6">
                  {tourSteps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        index === currentStep
                          ? "w-6 bg-purple-500"
                          : "bg-gray-200 hover:bg-gray-300"
                      )}
                    />
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={handlePrev}
                    disabled={currentStep === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="text-gray-500"
                  >
                    Skip Tour
                  </Button>

                  <Button
                    onClick={handleNext}
                    className={cn(
                      "gap-1",
                      isLastStep && "bg-gradient-to-r from-purple-500 to-indigo-500"
                    )}
                  >
                    {isLastStep ? 'Get Started' : 'Next'}
                    {!isLastStep && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to reset tour for testing
export function useResetTour() {
  return () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
}
