'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface TourStep {
  id: string
  title: string
  content: string
  target?: string // CSS selector for element to highlight
  position?: 'top' | 'bottom' | 'left' | 'right'
  action?: () => void
}

interface GuidedTourProps {
  steps: TourStep[]
  onComplete?: () => void
  onSkip?: () => void
  autoStart?: boolean
}

export function GuidedTour({
  steps,
  onComplete,
  onSkip,
  autoStart = false
}: GuidedTourProps) {
  const [isActive, setIsActive] = useState(autoStart)
  const [currentStep, setCurrentStep] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)

  const step = steps[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === steps.length - 1

  useEffect(() => {
    if (!isActive || !step?.target) {
      setTargetElement(null)
      return
    }

    const element = document.querySelector(step.target) as HTMLElement
    setTargetElement(element)

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [isActive, step, currentStep])

  const handleNext = () => {
    if (step.action) {
      step.action()
    }

    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    setIsActive(false)
    onSkip?.()
  }

  const handleComplete = () => {
    setIsActive(false)
    onComplete?.()
    
    // Save completion state
    if (typeof window !== 'undefined') {
      localStorage.setItem('negotiation-tour-completed', 'true')
    }
  }

  if (!isActive) {
    return null
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleSkip}
      />

      {/* Spotlight */}
      {targetElement && (
        <Spotlight element={targetElement} />
      )}

      {/* Tour Card */}
      <AnimatePresence mode="wait">
        <TourCard
          key={currentStep}
          step={step}
          currentStep={currentStep}
          totalSteps={steps.length}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkip={handleSkip}
          targetElement={targetElement}
        />
      </AnimatePresence>
    </>
  )
}

interface TourCardProps {
  step: TourStep
  currentStep: number
  totalSteps: number
  isFirstStep: boolean
  isLastStep: boolean
  onNext: () => void
  onPrevious: () => void
  onSkip: () => void
  targetElement: HTMLElement | null
}

function TourCard({
  step,
  currentStep,
  totalSteps,
  isFirstStep,
  isLastStep,
  onNext,
  onPrevious,
  onSkip,
  targetElement
}: TourCardProps) {
  const getPosition = () => {
    if (!targetElement) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    const rect = targetElement.getBoundingClientRect()
    const position = step.position || 'bottom'

    switch (position) {
      case 'top':
        return {
          top: `${rect.top - 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)'
        }
      case 'bottom':
        return {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        }
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - 20}px`,
          transform: 'translate(-100%, -50%)'
        }
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + 20}px`,
          transform: 'translateY(-50%)'
        }
      default:
        return {
          top: `${rect.bottom + 20}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translateX(-50%)'
        }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 w-96 bg-white rounded-lg shadow-2xl"
      style={getPosition()}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-gray-900">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
        <button
          onClick={onSkip}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {step.title}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {step.content}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200">
        <Button
          onClick={onPrevious}
          variant="ghost"
          size="sm"
          disabled={isFirstStep}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>

        <Button onClick={onNext} size="sm">
          {isLastStep ? (
            <>
              <Check className="w-4 h-4 mr-1" />
              Finish
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

function Spotlight({ element }: { element: HTMLElement }) {
  const rect = element.getBoundingClientRect()

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed z-40 pointer-events-none"
      style={{
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
        borderRadius: '8px'
      }}
    />
  )
}

// Default tour steps for Negotiation Prep
export const negotiationPrepTourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Negotiation Prep!',
    content: 'This tool helps you prepare for supplier negotiations with data-driven insights and AI-powered recommendations. Let\'s take a quick tour!'
  },
  {
    id: 'overview',
    title: 'Overview Tab',
    content: 'Start here to see a summary of your negotiation scenario, including market position, recommended strategy, and key talking points.',
    target: '[data-tour="overview-tab"]',
    position: 'bottom'
  },
  {
    id: 'ai-recommendations',
    title: 'AI-Powered Recommendations',
    content: 'Our AI analyzes market data and suggests the best negotiation strategy with confidence scores, risks, and opportunities.',
    target: '[data-tour="ai-panel"]',
    position: 'top'
  },
  {
    id: 'trends',
    title: 'Historical Trends',
    content: 'View 12 months of rate history to understand market movements and identify the best time to negotiate.',
    target: '[data-tour="trends-tab"]',
    position: 'bottom'
  },
  {
    id: 'talking-points',
    title: 'Talking Points Library',
    content: 'Access pre-generated talking points organized by category to strengthen your negotiation position.',
    target: '[data-tour="talking-points-tab"]',
    position: 'bottom'
  },
  {
    id: 'scenarios',
    title: 'Scenario Modeling',
    content: 'Compare different negotiation outcomes and their financial impact to choose the best approach.',
    target: '[data-tour="scenarios-tab"]',
    position: 'bottom'
  },
  {
    id: 'export',
    title: 'Export & Share',
    content: 'Export your analysis to PDF or PowerPoint, and share with your team for collaboration.',
    target: '[data-tour="export-button"]',
    position: 'left'
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    content: 'You now know the basics of the Negotiation Prep tool. Start preparing your negotiation strategy with confidence!'
  }
]

// Hook to check if tour should be shown
export function useShouldShowTour(): boolean {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const completed = localStorage.getItem('negotiation-tour-completed')
      setShouldShow(!completed)
    }
  }, [])

  return shouldShow
}
