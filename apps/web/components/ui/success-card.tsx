/**
 * Success Card Component
 * Complete success celebration with stats and actions
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SuccessCheckmark } from './success-checkmark';
import { CountUp } from './count-up';
import { Confetti } from './confetti';

export interface SuccessStats {
  recordsImported?: number;
  validationsPassed?: number;
  timeElapsed?: number; // seconds
  errorsFixed?: number;
  duplicatesRemoved?: number;
}

export interface SuccessAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export interface SuccessCardProps {
  title: string;
  message?: string;
  stats?: SuccessStats;
  actions?: SuccessAction[];
  showConfetti?: boolean;
  onClose?: () => void;
  className?: string;
}

export function SuccessCard({
  title,
  message,
  stats,
  actions = [],
  showConfetti = true,
  onClose,
  className = '',
}: SuccessCardProps) {
  const [showCelebration, setShowCelebration] = useState(showConfetti);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <>
      <Confetti active={showCelebration} duration={3000} />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={`
          bg-white rounded-xl shadow-xl border border-green-200 p-8 max-w-md mx-auto relative
          ${className}
        `}
      >
        <div className="text-center mb-6">
          <SuccessCheckmark 
            size="lg" 
            delay={0.2}
            onComplete={() => setTimeout(() => setShowCelebration(false), 1000)}
          />
          
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold text-gray-900 mt-4"
          >
            {title}
          </motion.h2>
          
          {message && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-gray-600 mt-2"
            >
              {message}
            </motion.p>
          )}
        </div>

        {stats && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              {stats.recordsImported !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    <CountUp to={stats.recordsImported} delay={0.8} separator="," />
                  </div>
                  <div className="text-sm text-gray-600">Records Imported</div>
                </div>
              )}
              
              {stats.validationsPassed !== undefined && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-violet-600">
                    <CountUp to={stats.validationsPassed} delay={0.9} separator="," />
                  </div>
                  <div className="text-sm text-gray-600">Validations Passed</div>
                </div>
              )}
              
              {stats.timeElapsed !== undefined && (
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    {formatTime(stats.timeElapsed)}
                  </div>
                  <div className="text-sm text-gray-600">Processing Time</div>
                </div>
              )}
            </div>
          </div>
        )}

        {actions.length > 0 && (
          <div className="flex flex-col gap-3">
            {actions.map((action) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className={`
                  flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
                  ${action.variant === 'primary' 
                    ? 'bg-green-600 text-white hover:bg-green-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }
                `}
              >
                {action.icon}
                {action.label}
              </motion.button>
            ))}
          </div>
        )}

        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </motion.div>
    </>
  );
}
