'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle2, 
  Upload, 
  Sparkles, 
  Target, 
  ArrowRight,
  ArrowLeft,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

// ============================================================================
// TYPES
// ============================================================================

export type UserRole = 
  | 'procurement-manager'
  | 'analyst'
  | 'executive'
  | 'legal'
  | 'finance'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  component: React.ComponentType<OnboardingStepProps>
}

interface OnboardingStepProps {
  onNext: (data?: any) => void
  onSkip: () => void
  data: Record<string, any>
}

interface OnboardingState {
  currentStep: number
  completed: boolean
  skipped: boolean
  userData: {
    role?: UserRole
    name?: string
    company?: string
    goals?: string[]
    preferences?: {
      dashboardLayout?: string
      notifications?: boolean
      theme?: 'light' | 'dark'
    }
  }
  progress: {
    [stepId: string]: {
      completed: boolean
      skipped: boolean
      data?: any
      timestamp?: Date
    }
  }
}

// ============================================================================
// STEP COMPONENTS
// ============================================================================

const WelcomeStep: React.FC<OnboardingStepProps> = ({ onNext }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-6"
    >
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          Welcome to Chain IQ
        </h2>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Let's get you set up in just 3 minutes. We'll customize your experience 
          and show you how to get the most value from the platform.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto pt-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-2">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm font-medium text-gray-700">Upload Contracts</p>
          <p className="text-xs text-gray-500">AI-powered analysis</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm font-medium text-gray-700">Get Insights</p>
          <p className="text-xs text-gray-500">Instant intelligence</p>
        </div>
        
        <div className="text-center">
          <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-2">
            <Target className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm font-medium text-gray-700">Save Money</p>
          <p className="text-xs text-gray-500">Identify opportunities</p>
        </div>
      </div>

      <Button 
        size="lg" 
        onClick={() => onNext()}
        className="mt-8"
      >
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  )
}

const RoleSelectionStep: React.FC<OnboardingStepProps> = ({ onNext, data }) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(
    data.role || null
  )

  const roles: Array<{ value: UserRole; label: string; description: string }> = [
    {
      value: 'procurement-manager',
      label: 'Procurement Manager',
      description: 'Manage contracts, suppliers, and negotiations'
    },
    {
      value: 'analyst',
      label: 'Procurement Analyst',
      description: 'Analyze spend, rates, and performance'
    },
    {
      value: 'executive',
      label: 'Executive',
      description: 'High-level insights and ROI tracking'
    },
    {
      value: 'legal',
      label: 'Legal',
      description: 'Compliance and risk management'
    },
    {
      value: 'finance',
      label: 'Finance',
      description: 'Budget tracking and cost analysis'
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What's your role?
        </h2>
        <p className="text-gray-600">
          We'll customize your dashboard and features based on your role
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
        {roles.map((role) => (
          <Card
            key={role.value}
            className={`cursor-pointer transition-all ${
              selectedRole === role.value
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:shadow-md'
            }`}
            onClick={() => setSelectedRole(role.value)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {role.label}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {role.description}
                  </p>
                </div>
                {selectedRole === role.value && (
                  <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 ml-2" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => onNext({ role: selectedRole })}
          disabled={!selectedRole}
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  )
}

const GoalsSelectionStep: React.FC<OnboardingStepProps> = ({ onNext, data }) => {
  const [selectedGoals, setSelectedGoals] = useState<string[]>(
    data.goals || []
  )

  const goals = [
    { id: 'save-money', label: 'Save Money', icon: '💰' },
    { id: 'compliance', label: 'Ensure Compliance', icon: '✅' },
    { id: 'efficiency', label: 'Improve Efficiency', icon: '⚡' },
    { id: 'visibility', label: 'Increase Visibility', icon: '👁️' },
    { id: 'risk', label: 'Reduce Risk', icon: '🛡️' },
    { id: 'relationships', label: 'Manage Suppliers', icon: '🤝' }
  ]

  const toggleGoal = (goalId: string) => {
    setSelectedGoals(prev =>
      prev.includes(goalId)
        ? prev.filter(g => g !== goalId)
        : [...prev, goalId]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What are your main goals?
        </h2>
        <p className="text-gray-600">
          Select all that apply - we'll prioritize relevant features
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        {goals.map((goal) => (
          <Card
            key={goal.id}
            className={`cursor-pointer transition-all ${
              selectedGoals.includes(goal.id)
                ? 'ring-2 ring-blue-500 bg-blue-50'
                : 'hover:shadow-md'
            }`}
            onClick={() => toggleGoal(goal.id)}
          >
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-2">{goal.icon}</div>
              <p className="font-medium text-gray-900">{goal.label}</p>
              {selectedGoals.includes(goal.id) && (
                <CheckCircle2 className="w-5 h-5 text-blue-600 mx-auto mt-2" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={() => onNext({ goals: selectedGoals })}
          disabled={selectedGoals.length === 0}
        >
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  )
}

const CompletionStep: React.FC<OnboardingStepProps> = ({ onNext, data }) => {
  const [useSampleData, setUseSampleData] = useState(false)
  
  const roleLabels: Record<UserRole, string> = {
    'procurement-manager': 'Procurement Manager',
    'analyst': 'Procurement Analyst',
    'executive': 'Executive',
    'legal': 'Legal',
    'finance': 'Finance'
  }

  const handleFinish = () => {
    onNext({ useSampleData })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-white" />
      </div>
      
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">
          You're all set!
        </h2>
        <p className="text-lg text-gray-600 max-w-md mx-auto">
          Your dashboard has been customized for a {roleLabels[data.role as UserRole]}.
          Let's explore what you can do.
        </p>
      </div>

      <Card className="max-w-md mx-auto">
        <CardContent className="p-6 text-left space-y-4">
          <h3 className="font-semibold text-gray-900 mb-3">
            Recommended next steps:
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload your first contract</p>
                <p className="text-sm text-gray-600">See AI analysis in action</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Explore use cases</p>
                <p className="text-sm text-gray-600">Find workflows that match your goals</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-blue-600">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Check out the dashboard</p>
                <p className="text-sm text-gray-600">See insights tailored to your role</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sample Data Option */}
      <div className="max-w-md mx-auto">
        <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="checkbox"
            checked={useSampleData}
            onChange={(e) => setUseSampleData(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-gray-900">
              Load sample data
            </p>
            <p className="text-xs text-gray-600">
              Explore the platform with pre-loaded sample contracts and data
            </p>
          </div>
        </label>
      </div>

      <Button 
        size="lg" 
        onClick={handleFinish}
        className="mt-8"
      >
        Go to Dashboard
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </motion.div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const OnboardingWizard: React.FC<{
  onComplete: (data: OnboardingState['userData']) => void
  onSkip: () => void
}> = ({ onComplete, onSkip }) => {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 0,
    completed: false,
    skipped: false,
    userData: {},
    progress: {}
  })

  // Load saved state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('onboarding-state')
    if (saved) {
      try {
        const parsedState = JSON.parse(saved)
        setState(parsedState)
      } catch (error) {
        console.error('Failed to parse saved onboarding state:', error)
      }
    }
  }, [])

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('onboarding-state', JSON.stringify(state))
  }, [state])

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      description: 'Get started with Chain IQ',
      icon: Sparkles,
      component: WelcomeStep
    },
    {
      id: 'role',
      title: 'Your Role',
      description: 'Customize your experience',
      icon: Target,
      component: RoleSelectionStep
    },
    {
      id: 'goals',
      title: 'Your Goals',
      description: 'What matters most to you',
      icon: CheckCircle2,
      component: GoalsSelectionStep
    },
    {
      id: 'complete',
      title: 'Complete',
      description: 'You are ready to go',
      icon: CheckCircle2,
      component: CompletionStep
    }
  ]

  const currentStepData = steps[state.currentStep]
  const StepComponent = currentStepData.component
  const progress = ((state.currentStep + 1) / steps.length) * 100

  const handleNext = async (data?: any) => {
    const newUserData = { ...state.userData, ...data }
    const currentStepId = currentStepData.id
    
    // Update progress for current step
    const newProgress = {
      ...state.progress,
      [currentStepId]: {
        completed: true,
        skipped: false,
        data,
        timestamp: new Date()
      }
    }
    
    // Save to API
    try {
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            currentStep: state.currentStep,
            completed: state.currentStep === steps.length - 1,
            userData: newUserData,
            progress: newProgress
          },
          role: newUserData.role,
          goals: newUserData.goals,
          completed: state.currentStep === steps.length - 1,
          stepId: currentStepId,
          action: 'completed'
        })
      })
    } catch (error) {
      console.error('Failed to save onboarding progress:', error)
      // Continue anyway - localStorage backup exists
    }
    
    if (state.currentStep === steps.length - 1) {
      // Last step - complete onboarding
      setState(prev => ({ 
        ...prev, 
        completed: true, 
        userData: newUserData,
        progress: newProgress
      }))
      onComplete(newUserData)
    } else {
      // Move to next step
      setState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        userData: newUserData,
        progress: newProgress
      }))
    }
  }

  const handleBack = () => {
    if (state.currentStep > 0) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }))
    }
  }

  const handleSkip = async () => {
    // Save skip to API
    try {
      await fetch('/api/user/onboarding/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipped: true })
      })
    } catch (error) {
      console.error('Failed to save skip status:', error)
    }
    
    setState(prev => ({ ...prev, skipped: true }))
    onSkip()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {currentStepData.title}
              </h1>
              <p className="text-sm text-gray-600">
                {currentStepData.description}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-600">
              <span>Step {state.currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-12">
          <AnimatePresence mode="wait">
            <StepComponent
              key={currentStepData.id}
              onNext={handleNext}
              onSkip={handleSkip}
              data={state.userData}
            />
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={state.currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="text-gray-600"
            >
              Skip for now
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default OnboardingWizard
