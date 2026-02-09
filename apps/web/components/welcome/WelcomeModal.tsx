'use client';

/**
 * Welcome Modal
 * 
 * Beautiful, animated welcome modal shown to first-time users.
 * Offers the option to start the guided tour or skip it.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  X,
  Sparkles,
  Play,
  ArrowRight,
  Brain,
  Shield,
  Zap,
  Clock,
  FileText,
  MessageSquare,
  Rocket,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWelcomeTour } from './WelcomeTourProvider';

// ============================================================================
// Feature Cards Data
// ============================================================================

const features = [
  {
    icon: Brain,
    title: 'AI Analysis',
    description: 'Instant insights from any contract',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  {
    icon: Shield,
    title: 'Risk Detection',
    description: 'AI-powered risk identification',
    color: 'from-violet-500 to-violet-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  {
    icon: MessageSquare,
    title: 'Smart Q&A',
    description: 'Ask questions in plain English',
    color: 'from-violet-500 to-purple-500',
    bgColor: 'bg-violet-100 dark:bg-violet-900/30',
  },
  {
    icon: Zap,
    title: 'Auto Extract',
    description: 'Key terms extracted automatically',
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
];

// ============================================================================
// Animated Background
// ============================================================================

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient orbs */}
      <motion.div
        className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-violet-500/30 to-purple-500/20 rounded-full blur-3xl"
        animate={{
          x: [0, 30, 0],
          y: [0, -20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute -bottom-20 -right-20 w-96 h-96 bg-gradient-to-br from-violet-500/30 to-purple-500/20 rounded-full blur-3xl"
        animate={{
          x: [0, -30, 0],
          y: [0, 20, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-pink-500/20 to-rose-500/10 rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />
      
      {/* Floating particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-white/40 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: Math.random() * 2,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Feature Card Component
// ============================================================================

interface FeatureCardProps {
  feature: typeof features[0];
  index: number;
}

function FeatureCard({ feature, index }: FeatureCardProps) {
  const Icon = feature.icon;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.1 }}
      className="group relative"
    >
      <div className={cn(
        'p-4 rounded-xl border border-white/10 backdrop-blur-sm',
        'bg-white/5 hover:bg-white/10 transition-all duration-300',
        'hover:border-white/20 hover:shadow-lg hover:-translate-y-1'
      )}>
        <div className={cn(
          'inline-flex p-2 rounded-lg mb-3',
          feature.bgColor
        )}>
          <Icon className="w-5 h-5 text-current" style={{
            color: feature.color.includes('violet') ? '#8B5CF6' :
                   feature.color.includes('emerald') ? '#10B981' :
                   feature.color.includes('blue') ? '#3B82F6' :
                   '#F59E0B'
          }} />
        </div>
        <h3 className="font-semibold text-white text-sm mb-1">{feature.title}</h3>
        <p className="text-xs text-white/70">{feature.description}</p>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Welcome Modal Component
// ============================================================================

export function WelcomeModal() {
  const { isWelcomeModalOpen, closeWelcomeModal, startTour, skipTour } = useWelcomeTour();
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const router = useRouter();

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem('contigo-welcome-dont-show', 'true');
    }
    skipTour();
  };

  const handleStartTour = () => {
    startTour();
  };

  const handleExplore = () => {
    closeWelcomeModal();
    router.push('/contracts');
  };

  return (
    <AnimatePresence>
      {isWelcomeModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleSkip}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl"
          >
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700" />
            <AnimatedBackground />
            
            {/* Content */}
            <div className="relative z-10 p-8 md:p-10">
              {/* Close button */}
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Header */}
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4"
                >
                  <Sparkles className="w-8 h-8 text-white" />
                </motion.div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-3xl md:text-4xl font-bold text-white mb-2"
                >
                  Welcome to ConTigo!
                </motion.h1>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg text-white/80"
                >
                  Your AI-powered contract intelligence platform
                </motion.p>
              </div>
              
              {/* Feature grid */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {features.map((feature, index) => (
                  <FeatureCard key={feature.title} feature={feature} index={index} />
                ))}
              </div>
              
              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Button
                  onClick={handleStartTour}
                  size="lg"
                  className="flex-1 bg-white text-violet-700 hover:bg-white/90 shadow-lg gap-2 h-12 text-base font-semibold"
                >
                  <Play className="w-5 h-5" />
                  Take the Tour
                  <span className="text-violet-500/70 text-sm font-normal ml-1">
                    ~2 min
                  </span>
                </Button>
                
                <Button
                  onClick={handleExplore}
                  size="lg"
                  variant="outline"
                  className="flex-1 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/40 gap-2 h-12 text-base"
                >
                  Skip & Explore
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
              
              {/* Don't show again checkbox */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex items-center justify-center gap-2 mt-6"
              >
                <input
                  type="checkbox"
                  id="dont-show-again"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-white/10 text-violet-500 focus:ring-violet-400 focus:ring-offset-0"
                />
                <label htmlFor="dont-show-again" className="text-sm text-white/70 cursor-pointer">
                  Don&apos;t show this again
                </label>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WelcomeModal;
