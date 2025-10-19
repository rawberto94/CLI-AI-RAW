'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Trophy, Star, Sparkles, Award, Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SuccessCelebrationProps {
  show: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'onboarding' | 'first-upload' | 'milestone' | 'achievement'
  confetti?: boolean
}

export function SuccessCelebration({
  show,
  onClose,
  title,
  message,
  type = 'achievement',
  confetti = true
}: SuccessCelebrationProps) {
  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    if (show && confetti) {
      setShowConfetti(true)
      // Stop confetti after 3 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [show, confetti])

  const getIcon = () => {
    switch (type) {
      case 'onboarding':
        return <CheckCircle className="w-16 h-16 text-green-500" />
      case 'first-upload':
        return <Sparkles className="w-16 h-16 text-blue-500" />
      case 'milestone':
        return <Trophy className="w-16 h-16 text-yellow-500" />
      case 'achievement':
        return <Award className="w-16 h-16 text-purple-500" />
      default:
        return <Star className="w-16 h-16 text-blue-500" />
    }
  }

  const getColor = () => {
    switch (type) {
      case 'onboarding':
        return 'from-green-500 to-emerald-500'
      case 'first-upload':
        return 'from-blue-500 to-indigo-500'
      case 'milestone':
        return 'from-yellow-500 to-orange-500'
      case 'achievement':
        return 'from-purple-500 to-pink-500'
      default:
        return 'from-blue-500 to-purple-500'
    }
  }

  return (
    <>
      {/* Confetti Effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-[100]">
          {Array.from({ length: 50 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-10px',
                backgroundColor: [
                  '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'
                ][Math.floor(Math.random() * 6)]
              }}
              initial={{ y: 0, opacity: 1, rotate: 0 }}
              animate={{
                y: window.innerHeight + 100,
                opacity: 0,
                rotate: Math.random() * 360,
                x: (Math.random() - 0.5) * 200
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                ease: 'easeOut',
                delay: Math.random() * 0.5
              }}
            />
          ))}
        </div>
      )}

      {/* Success Modal */}
      <AnimatePresence>
        {show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 50 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative z-10 w-full max-w-md"
            >
              <Card className="border-0 shadow-2xl overflow-hidden">
                {/* Gradient Header */}
                <div className={`bg-gradient-to-r ${getColor()} p-8 text-center`}>
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                    className="inline-block mb-4"
                  >
                    {getIcon()}
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold text-white mb-2"
                  >
                    {title}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="text-white/90"
                  >
                    {message}
                  </motion.p>
                </div>

                {/* Content */}
                <CardContent className="p-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-4"
                  >
                    {type === 'onboarding' && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
                        <ul className="space-y-2 text-sm text-blue-700">
                          <li className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            <span>Upload your first contract</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            <span>Explore AI-powered insights</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <Target className="w-4 h-4" />
                            <span>Customize your dashboard</span>
                          </li>
                        </ul>
                      </div>
                    )}

                    {type === 'first-upload' && (
                      <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                        <h3 className="font-semibold text-green-900 mb-2">Great Start!</h3>
                        <p className="text-sm text-green-700">
                          Your contract is being analyzed by our AI. You'll receive insights on risks,
                          opportunities, and compliance in just a few moments.
                        </p>
                      </div>
                    )}

                    <Button
                      onClick={onClose}
                      className={`w-full bg-gradient-to-r ${getColor()} hover:opacity-90 text-white`}
                    >
                      Continue
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * Hook to trigger success celebrations
 */
export function useSuccessCelebration() {
  const [celebration, setCelebration] = useState<{
    show: boolean
    title: string
    message: string
    type: 'onboarding' | 'first-upload' | 'milestone' | 'achievement'
  }>({
    show: false,
    title: '',
    message: '',
    type: 'achievement'
  })

  const celebrate = (
    title: string,
    message: string,
    type: 'onboarding' | 'first-upload' | 'milestone' | 'achievement' = 'achievement'
  ) => {
    setCelebration({ show: true, title, message, type })
  }

  const close = () => {
    setCelebration(prev => ({ ...prev, show: false }))
  }

  return {
    celebration,
    celebrate,
    close
  }
}
