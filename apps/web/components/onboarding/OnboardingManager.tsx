'use client'

import React, { useState, useEffect } from 'react'
import { OnboardingWizard } from './OnboardingWizard'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { SuccessCelebration } from '@/components/celebrations/SuccessCelebration'
import { OnboardingErrorBoundary } from '@/components/error-boundaries/UXErrorBoundary'

interface OnboardingStatus {
  completed: boolean
  skipped: boolean
  state: any
  role?: string
}

export function OnboardingManager() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCelebration, setShowCelebration] = useState(false)

  // Check onboarding status on mount
  useEffect(() => {
    async function checkOnboardingStatus() {
      try {
        const response = await fetch('/api/user/onboarding')
        const { data } = await response.json()
        
        setOnboardingStatus(data)
        
        // Show onboarding if not completed and not skipped
        if (!data.completed && !data.skipped) {
          setShowOnboarding(true)
        }
        // Show resume prompt if skipped but not completed
        else if (data.skipped && !data.completed) {
          // Show resume prompt after a delay
          setTimeout(() => {
            setShowResumePrompt(true)
          }, 2000)
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [])

  const handleComplete = async (userData: any) => {
    try {
      // Save onboarding completion
      await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed: true,
          role: userData.role,
          goals: userData.goals,
          state: userData
        })
      })

      // Apply role-based dashboard layout
      const { getDefaultLayout } = await import('@/lib/dashboard/default-layouts')
      const defaultLayout = getDefaultLayout(userData.role)
      
      await fetch('/api/dashboard/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          layout: defaultLayout,
          isDefault: true
        })
      })
      
      setShowOnboarding(false)
      setShowResumePrompt(false)
      
      // Show celebration
      setShowCelebration(true)
      
      // Reload after celebration
      setTimeout(() => {
        window.location.reload()
      }, 4000)
    } catch (error) {
      console.error('Failed to complete onboarding:', error)
    }
  }

  const handleSkip = () => {
    setShowOnboarding(false)
    setShowResumePrompt(true)
  }

  const handleResume = () => {
    setShowResumePrompt(false)
    setShowOnboarding(true)
  }

  const handleDismissPrompt = () => {
    setShowResumePrompt(false)
  }

  if (loading) {
    return null
  }

  return (
    <OnboardingErrorBoundary>
      {/* Success Celebration */}
      <SuccessCelebration
        show={showCelebration}
        onClose={() => {
          setShowCelebration(false)
          window.location.reload()
        }}
        title="Welcome Aboard! 🎉"
        message="Your workspace is ready. Let's start analyzing contracts!"
        type="onboarding"
        confetti={true}
      />

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleComplete}
          onSkip={handleSkip}
        />
      )}

      {/* Resume Prompt */}
      {showResumePrompt && !showOnboarding && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm">
          <div className="bg-white shadow-lg rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900">
                  Complete your setup?
                </h4>
                <p className="text-xs text-gray-600 mt-1">
                  Finish onboarding to customize your experience and unlock all features.
                </p>
              </div>
              <button
                onClick={handleDismissPrompt}
                className="text-gray-400 hover:text-gray-600 ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleResume}
                className="flex-1"
              >
                Resume Setup
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismissPrompt}
              >
                Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </OnboardingErrorBoundary>
  )
}
