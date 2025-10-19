'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export function OnboardingWrapper() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem('onboarding-completed')
    const skipped = localStorage.getItem('onboarding-skipped')
    
    if (!completed && !skipped) {
      // Show onboarding after a brief delay
      const timer = setTimeout(() => {
        setShowOnboarding(true)
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [])

  const handleComplete = (userData: any) => {
    // Save user preferences
    localStorage.setItem('onboarding-completed', 'true')
    localStorage.setItem('user-preferences', JSON.stringify(userData))
    setShowOnboarding(false)
    
    // Optional: Redirect based on role
    if (userData.role) {
      // Could redirect to role-specific dashboard
      console.log('User completed onboarding:', userData)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding-skipped', 'true')
    setShowOnboarding(false)
  }

  if (!showOnboarding) {
    return null
  }

  return (
    <OnboardingWizard
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  )
}
