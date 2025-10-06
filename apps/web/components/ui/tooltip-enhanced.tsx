/**
 * Enhanced Tooltip Component
 * Contextual tooltips with multi-step support and mobile compatibility
 */

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { popVariants } from '@/lib/animations/variants';
import { animationConfig } from '@/lib/animations/config';

export interface TooltipStep {
  title: string;
  content: string;
  example?: string;
}

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  multiStep?: boolean;
  steps?: TooltipStep[];
  showIcon?: boolean;
  className?: string;
}

export function TooltipEnhanced({
  content,
  children,
  placement = 'top',
  delay = 300,
  multiStep = false,
  steps = [],
  showIcon = false,
  className = '',
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [delayTimer, setDelayTimer] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    const timer = setTimeout(() => setIsOpen(true), delay);
    setDelayTimer(timer);
  };

  const handleMouseLeave = () => {
    if (delayTimer) clearTimeout(delayTimer);
    setIsOpen(false);
    setCurrentStep(0);
  };

  const handleClick = () => {
    // For touch devices
    setIsOpen(!isOpen);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getPlacementClasses = () => {
    switch (placement) {
      case 'top':
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (placement) {
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent';
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 border-x-transparent border-t-transparent';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 border-y-transparent border-r-transparent';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 border-y-transparent border-l-transparent';
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 border-x-transparent border-b-transparent';
    }
  };

  const renderContent = () => {
    if (multiStep && steps.length > 0) {
      const step = steps[currentStep];
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">{step.title}</h4>
            <span className="text-xs text-gray-400">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          <p className="text-sm">{step.content}</p>
          {step.example && (
            <div className="mt-2 p-2 bg-gray-800 rounded text-xs font-mono">
              {step.example}
            </div>
          )}
          {steps.length > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <button
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex items-center gap-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:text-blue-400 transition-colors"
              >
                <ChevronLeft className="h-3 w-3" />
                Previous
              </button>
              <button
                onClick={nextStep}
                disabled={currentStep === steps.length - 1}
                className="flex items-center gap-1 text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:text-blue-400 transition-colors"
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      );
    }

    return typeof content === 'string' ? (
      <p className="text-sm">{content}</p>
    ) : (
      content
    );
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Trigger */}
      <div className="inline-flex items-center gap-1">
        {children}
        {showIcon && (
          <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 transition-colors" />
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={popVariants}
            className={`absolute z-50 ${getPlacementClasses()}`}
            style={{ minWidth: '200px', maxWidth: '320px' }}
          >
            {/* Arrow */}
            <div
              className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}
            />

            {/* Content */}
            <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3">
              {renderContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
