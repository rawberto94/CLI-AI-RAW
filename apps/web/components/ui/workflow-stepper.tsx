'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Check, Circle, ChevronRight, Loader2 } from 'lucide-react'

export interface WorkflowStep {
  id: string
  label: string
  description?: string
  status: 'completed' | 'current' | 'upcoming' | 'error'
  icon?: React.ComponentType<{ className?: string }>
}

interface WorkflowStepperProps {
  steps: WorkflowStep[]
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md' | 'lg'
  showDescriptions?: boolean
  className?: string
  onStepClick?: (stepId: string) => void
}

const sizeConfig = {
  sm: {
    container: 'gap-2',
    icon: 'h-6 w-6',
    iconInner: 'h-3 w-3',
    label: 'text-xs',
    description: 'text-[10px]',
    connector: 'h-0.5 w-8',
    connectorVertical: 'w-0.5 h-6',
  },
  md: {
    container: 'gap-3',
    icon: 'h-8 w-8',
    iconInner: 'h-4 w-4',
    label: 'text-sm',
    description: 'text-xs',
    connector: 'h-0.5 w-12',
    connectorVertical: 'w-0.5 h-8',
  },
  lg: {
    container: 'gap-4',
    icon: 'h-10 w-10',
    iconInner: 'h-5 w-5',
    label: 'text-base',
    description: 'text-sm',
    connector: 'h-0.5 w-16',
    connectorVertical: 'w-0.5 h-10',
  },
}

export function WorkflowStepper({
  steps,
  orientation = 'horizontal',
  size = 'md',
  showDescriptions = true,
  className,
  onStepClick,
}: WorkflowStepperProps) {
  const config = sizeConfig[size]
  const isHorizontal = orientation === 'horizontal'

  return (
    <div
      className={cn(
        'flex',
        isHorizontal ? 'flex-row items-start' : 'flex-col',
        config.container,
        className
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1
        const Icon = step.icon

        return (
          <React.Fragment key={step.id}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex',
                isHorizontal ? 'flex-col items-center' : 'flex-row items-start gap-3',
                onStepClick && step.status !== 'upcoming' && 'cursor-pointer'
              )}
              onClick={() => onStepClick && step.status !== 'upcoming' && onStepClick(step.id)}
            >
              {/* Step Icon */}
              <div
                className={cn(
                  'relative flex items-center justify-center rounded-full border-2 transition-all duration-300',
                  config.icon,
                  step.status === 'completed' && 'bg-green-500 border-green-500 text-white',
                  step.status === 'current' && 'bg-violet-500 border-violet-500 text-white animate-pulse',
                  step.status === 'upcoming' && 'bg-gray-100 border-gray-300 text-gray-400',
                  step.status === 'error' && 'bg-red-500 border-red-500 text-white'
                )}
              >
                {step.status === 'completed' ? (
                  <Check className={config.iconInner} />
                ) : step.status === 'current' ? (
                  Icon ? (
                    <Icon className={config.iconInner} />
                  ) : (
                    <Loader2 className={cn(config.iconInner, 'animate-spin')} />
                  )
                ) : step.status === 'error' ? (
                  <span className={cn(config.iconInner, 'font-bold')}>!</span>
                ) : Icon ? (
                  <Icon className={config.iconInner} />
                ) : (
                  <Circle className={config.iconInner} />
                )}
              </div>

              {/* Step Content */}
              <div
                className={cn(
                  'flex flex-col',
                  isHorizontal ? 'items-center mt-2' : 'items-start'
                )}
              >
                <span
                  className={cn(
                    'font-medium transition-colors',
                    config.label,
                    step.status === 'completed' && 'text-green-700',
                    step.status === 'current' && 'text-violet-700',
                    step.status === 'upcoming' && 'text-gray-400',
                    step.status === 'error' && 'text-red-700'
                  )}
                >
                  {step.label}
                </span>
                {showDescriptions && step.description && (
                  <span
                    className={cn(
                      'text-gray-500 mt-0.5',
                      config.description,
                      isHorizontal && 'text-center max-w-[100px]'
                    )}
                  >
                    {step.description}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Connector */}
            {!isLast && (
              <div
                className={cn(
                  'flex-shrink-0',
                  isHorizontal ? 'self-center mt-4' : 'ml-4'
                )}
              >
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.1 + 0.1 }}
                  className={cn(
                    'rounded-full origin-left transition-colors',
                    isHorizontal ? config.connector : config.connectorVertical,
                    step.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  )}
                />
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// Preset workflow configurations for common contract workflows
export const contractWorkflowSteps: WorkflowStep[] = [
  { id: 'draft', label: 'Draft', description: 'Create document', status: 'upcoming' },
  { id: 'review', label: 'Review', description: 'Legal check', status: 'upcoming' },
  { id: 'approve', label: 'Approve', description: 'Get approval', status: 'upcoming' },
  { id: 'sign', label: 'Sign', description: 'Execute', status: 'upcoming' },
  { id: 'active', label: 'Active', description: 'In effect', status: 'upcoming' },
]

export const uploadWorkflowSteps: WorkflowStep[] = [
  { id: 'upload', label: 'Upload', description: 'Add files', status: 'upcoming' },
  { id: 'process', label: 'Process', description: 'AI analysis', status: 'upcoming' },
  { id: 'extract', label: 'Extract', description: 'Get data', status: 'upcoming' },
  { id: 'review', label: 'Review', description: 'Verify', status: 'upcoming' },
]

export const legalReviewWorkflowSteps: WorkflowStep[] = [
  { id: 'analyze', label: 'Analyze', description: 'AI review', status: 'upcoming' },
  { id: 'compare', label: 'Compare', description: 'Vs playbook', status: 'upcoming' },
  { id: 'redline', label: 'Redline', description: 'Mark changes', status: 'upcoming' },
  { id: 'finalize', label: 'Finalize', description: 'Complete', status: 'upcoming' },
]

// Helper to update step statuses
export function getStepsWithStatus(
  steps: WorkflowStep[],
  currentStepId: string
): WorkflowStep[] {
  const currentIndex = steps.findIndex(s => s.id === currentStepId)
  
  return steps.map((step, index) => ({
    ...step,
    status:
      index < currentIndex
        ? 'completed'
        : index === currentIndex
        ? 'current'
        : 'upcoming',
  }))
}
