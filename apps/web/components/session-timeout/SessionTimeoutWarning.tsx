'use client';

/**
 * Session Timeout Warning Modal
 * Warns users before their session expires and allows them to extend it
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogOut, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// Types
// ============================================

interface SessionTimeoutConfig {
  /** Total session duration in milliseconds */
  sessionDuration: number;
  /** Time before expiry to show warning (ms) */
  warningThreshold: number;
  /** Callback when session expires */
  onExpire: () => void;
  /** Callback to extend session */
  onExtend: () => Promise<boolean>;
  /** Whether session timeout is enabled */
  enabled?: boolean;
}

interface SessionTimeoutState {
  isWarningVisible: boolean;
  timeRemaining: number;
  isExtending: boolean;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  sessionDuration: 30 * 60 * 1000, // 30 minutes
  warningThreshold: 5 * 60 * 1000, // 5 minutes before expiry
  onExpire: () => {
    window.location.href = '/auth/signin?reason=session_expired';
  },
  onExtend: async () => {
    const res = await fetch('/api/auth/extend-session', { method: 'POST' });
    return res.ok;
  },
  enabled: true,
};

// ============================================
// Session Timeout Hook
// ============================================

export function useSessionTimeout(config: Partial<SessionTimeoutConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const {
    sessionDuration,
    warningThreshold,
    onExpire,
    onExtend,
    enabled,
  } = mergedConfig;

  const [state, setState] = useState<SessionTimeoutState>({
    isWarningVisible: false,
    timeRemaining: sessionDuration,
    isExtending: false,
  });

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const expireTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Reset activity timestamp
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setState(prev => ({
      ...prev,
      isWarningVisible: false,
      timeRemaining: sessionDuration,
    }));
  }, [sessionDuration]);

  // Extend session
  const extendSession = useCallback(async () => {
    setState(prev => ({ ...prev, isExtending: true }));
    
    try {
      const success = await onExtend();
      if (success) {
        resetActivity();
      } else {
        onExpire();
      }
    } catch (error) {
      console.error('Failed to extend session:', error);
      onExpire();
    } finally {
      setState(prev => ({ ...prev, isExtending: false }));
    }
  }, [onExtend, onExpire, resetActivity]);

  // Sign out immediately
  const signOut = useCallback(() => {
    onExpire();
  }, [onExpire]);

  // Setup timers and activity listeners
  useEffect(() => {
    if (!enabled) return;

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttled activity handler
    let activityThrottled = false;
    const handleActivity = () => {
      if (activityThrottled) return;
      activityThrottled = true;
      
      // Only reset if warning is not visible
      if (!state.isWarningVisible) {
        resetActivity();
      }
      
      setTimeout(() => {
        activityThrottled = false;
      }, 1000);
    };

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Setup warning timer
    const setupTimers = () => {
      // Clear existing timers
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      const timeUntilWarning = sessionDuration - warningThreshold;
      
      // Show warning
      warningTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isWarningVisible: true,
          timeRemaining: warningThreshold,
        }));

        // Start countdown
        countdownRef.current = setInterval(() => {
          setState(prev => {
            const newRemaining = prev.timeRemaining - 1000;
            if (newRemaining <= 0) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              onExpire();
              return { ...prev, timeRemaining: 0 };
            }
            return { ...prev, timeRemaining: newRemaining };
          });
        }, 1000);
      }, timeUntilWarning);

      // Expire session
      expireTimeoutRef.current = setTimeout(onExpire, sessionDuration);
    };

    setupTimers();

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (expireTimeoutRef.current) clearTimeout(expireTimeoutRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [enabled, sessionDuration, warningThreshold, onExpire, resetActivity, state.isWarningVisible]);

  return {
    ...state,
    extendSession,
    signOut,
    resetActivity,
  };
}

// ============================================
// Time Formatter
// ============================================

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ============================================
// Session Timeout Modal
// ============================================

interface SessionTimeoutModalProps {
  isOpen: boolean;
  timeRemaining: number;
  isExtending: boolean;
  onExtend: () => void;
  onSignOut: () => void;
}

export function SessionTimeoutModal({
  isOpen,
  timeRemaining,
  isExtending,
  onExtend,
  onSignOut,
}: SessionTimeoutModalProps) {
  const progress = Math.max(0, Math.min(100, (timeRemaining / (5 * 60 * 1000)) * 100));
  const isUrgent = timeRemaining < 60000; // Less than 1 minute

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50"
          >
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden mx-4">
              {/* Progress bar */}
              <div className="h-1 bg-slate-200 dark:bg-slate-700">
                <motion.div
                  className={`h-full ${isUrgent ? 'bg-red-500' : 'bg-amber-500'}`}
                  initial={{ width: '100%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="p-6">
                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    animate={{ scale: isUrgent ? [1, 1.1, 1] : 1 }}
                    transition={{ repeat: isUrgent ? Infinity : 0, duration: 1 }}
                    className={`p-4 rounded-full ${
                      isUrgent
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-amber-100 dark:bg-amber-900/30'
                    }`}
                  >
                    {isUrgent ? (
                      <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                    ) : (
                      <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    )}
                  </motion.div>
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-2">
                  {isUrgent ? 'Session Expiring!' : 'Session Timeout Warning'}
                </h2>

                {/* Message */}
                <p className="text-center text-slate-600 dark:text-slate-400 mb-4">
                  {isUrgent
                    ? 'Your session will expire very soon. Please save your work or extend your session.'
                    : 'Your session is about to expire due to inactivity.'}
                </p>

                {/* Countdown */}
                <div className="flex justify-center mb-6">
                  <motion.div
                    key={timeRemaining}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-4xl font-mono font-bold ${
                      isUrgent
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {formatTime(timeRemaining)}
                  </motion.div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={onSignOut}
                    disabled={isExtending}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                  <Button
                    className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    onClick={onExtend}
                    disabled={isExtending}
                  >
                    {isExtending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {isExtending ? 'Extending...' : 'Stay Signed In'}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Session Timeout Provider
// ============================================

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  config?: Partial<SessionTimeoutConfig>;
}

export function SessionTimeoutProvider({
  children,
  config,
}: SessionTimeoutProviderProps) {
  const {
    isWarningVisible,
    timeRemaining,
    isExtending,
    extendSession,
    signOut,
  } = useSessionTimeout(config);

  return (
    <>
      {children}
      <SessionTimeoutModal
        isOpen={isWarningVisible}
        timeRemaining={timeRemaining}
        isExtending={isExtending}
        onExtend={extendSession}
        onSignOut={signOut}
      />
    </>
  );
}

export default SessionTimeoutProvider;
