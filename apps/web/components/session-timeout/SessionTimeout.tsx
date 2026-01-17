'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, LogOut, X, RefreshCw } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface SessionState {
  isActive: boolean;
  lastActivity: Date;
  timeRemaining: number | null;
  isWarning: boolean;
  isExpired: boolean;
}

interface SessionContextValue extends SessionState {
  resetTimer: () => void;
  extendSession: () => void;
  logout: () => void;
}

// ============================================================================
// Context
// ============================================================================

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionTimeoutProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface SessionTimeoutProviderProps {
  children: React.ReactNode;
  /** Total session timeout in milliseconds (default: 30 minutes) */
  timeout?: number;
  /** Time before timeout to show warning in milliseconds (default: 5 minutes) */
  warningTime?: number;
  /** Events that reset the activity timer */
  activityEvents?: string[];
  /** Callback when session expires */
  onExpire?: () => void;
  /** Callback to extend session (e.g., refresh token) */
  onExtend?: () => Promise<void>;
  /** Callback for logout */
  onLogout?: () => void;
  /** Show the built-in warning modal */
  showWarningModal?: boolean;
}

export function SessionTimeoutProvider({
  children,
  timeout = 30 * 60 * 1000, // 30 minutes
  warningTime = 5 * 60 * 1000, // 5 minutes
  activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'],
  onExpire,
  onExtend,
  onLogout,
  showWarningModal = true,
}: SessionTimeoutProviderProps) {
  const [state, setState] = useState<SessionState>({
    isActive: true,
    lastActivity: new Date(),
    timeRemaining: timeout,
    isWarning: false,
    isExpired: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Start countdown when warning shows
  const startCountdown = useCallback(() => {
    const endTime = Date.now() + warningTime;
    
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setState(prev => ({
        ...prev,
        timeRemaining: remaining,
      }));
      
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }, 1000);
  }, [warningTime]);

  // Reset timer on activity
  const resetTimer = useCallback(() => {
    clearTimers();
    lastActivityRef.current = new Date();
    
    setState(prev => ({
      ...prev,
      lastActivity: lastActivityRef.current,
      timeRemaining: timeout,
      isWarning: false,
      isExpired: false,
    }));

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isWarning: true, timeRemaining: warningTime }));
      startCountdown();
    }, timeout - warningTime);

    // Set expiration timer
    timeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isExpired: true, isActive: false }));
      onExpire?.();
    }, timeout);
  }, [timeout, warningTime, clearTimers, startCountdown, onExpire]);

  // Extend session
  const extendSession = useCallback(async () => {
    try {
      await onExtend?.();
      resetTimer();
    } catch {
      // Error handled silently
    }
  }, [onExtend, resetTimer]);

  // Logout
  const logout = useCallback(() => {
    clearTimers();
    setState(prev => ({ ...prev, isActive: false, isExpired: true }));
    onLogout?.();
  }, [clearTimers, onLogout]);

  // Activity handler with throttling
  useEffect(() => {
    let throttleTimer: NodeJS.Timeout | null = null;
    
    const handleActivity = () => {
      if (throttleTimer) return;
      
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 1000);

      // Only reset if not already in warning state
      if (!state.isWarning) {
        lastActivityRef.current = new Date();
        setState(prev => ({ ...prev, lastActivity: lastActivityRef.current }));
      }
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [activityEvents, state.isWarning]);

  // Initialize timers
  useEffect(() => {
    resetTimer();
    return () => clearTimers();
  }, [resetTimer, clearTimers]);

  return (
    <SessionContext.Provider
      value={{
        ...state,
        resetTimer,
        extendSession,
        logout,
      }}
    >
      {children}
      {showWarningModal && <SessionWarningModal />}
    </SessionContext.Provider>
  );
}

// ============================================================================
// Session Warning Modal
// ============================================================================

function SessionWarningModal() {
  const { isWarning, isExpired, timeRemaining, extendSession, logout } = useSession();

  const formatTime = (ms: number | null) => {
    if (ms === null) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isExpired) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center"
        >
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogOut className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Session Expired
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your session has expired due to inactivity. Please log in again to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Log In Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-8 max-w-md mx-4"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <button
                onClick={() => logout()}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Session About to Expire
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your session will expire due to inactivity. Would you like to stay logged in?
            </p>

            {/* Countdown Timer */}
            <div className="flex items-center justify-center gap-3 mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <Clock className="w-6 h-6 text-gray-500" />
              <span className="text-3xl font-mono font-bold text-gray-900 dark:text-white">
                {formatTime(timeRemaining)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => logout()}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Log Out
              </button>
              <button
                onClick={() => extendSession()}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Stay Logged In
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Session Timer Display
// ============================================================================

interface SessionTimerProps {
  className?: string;
  showWhenActive?: boolean;
}

export function SessionTimer({ className = '', showWhenActive = false }: SessionTimerProps) {
  const { timeRemaining, isWarning } = useSession();

  const formatTime = (ms: number | null) => {
    if (ms === null) return '--:--';
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isWarning && !showWhenActive) {
    return null;
  }

  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
        ${isWarning 
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        }
        ${className}
      `}
    >
      <Clock className="w-4 h-4" />
      <span>{formatTime(timeRemaining)}</span>
    </div>
  );
}

// ============================================================================
// Idle Detector
// ============================================================================

interface IdleDetectorProps {
  children: React.ReactNode;
  idleTime?: number;
  onIdle?: () => void;
  onActive?: () => void;
}

export function IdleDetector({
  children,
  idleTime = 60000, // 1 minute
  onIdle,
  onActive,
}: IdleDetectorProps) {
  const [isIdle, setIsIdle] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasIdleRef = useRef(false);

  useEffect(() => {
    const resetTimeout = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (wasIdleRef.current) {
        wasIdleRef.current = false;
        setIsIdle(false);
        onActive?.();
      }

      timeoutRef.current = setTimeout(() => {
        wasIdleRef.current = true;
        setIsIdle(true);
        onIdle?.();
      }, idleTime);
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, resetTimeout, { passive: true });
    });

    resetTimeout();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimeout);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [idleTime, onIdle, onActive]);

  return <>{children}</>;
}

// ============================================================================
// Auto Save Indicator
// ============================================================================

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date;
  className?: string;
}

export function AutoSaveIndicator({
  status,
  lastSaved,
  className = '',
}: AutoSaveIndicatorProps) {
  const formatLastSaved = (date?: Date) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`inline-flex items-center gap-2 text-sm ${className}`}
    >
      {status === 'saving' && (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <RefreshCw className="w-4 h-4 text-blue-500" />
          </motion.div>
          <span className="text-blue-600 dark:text-blue-400">Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-gray-500 dark:text-gray-400">
            Saved {formatLastSaved(lastSaved)}
          </span>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full" />
          <span className="text-red-600 dark:text-red-400">Save failed</span>
        </>
      )}

      {status === 'idle' && lastSaved && (
        <>
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
          <span className="text-gray-400">
            Last saved {formatLastSaved(lastSaved)}
          </span>
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// Use Auto Save Hook
// ============================================================================

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<T>(data);

  useEffect(() => {
    if (!enabled) return;
    
    // Check if data actually changed
    if (JSON.stringify(data) === JSON.stringify(lastDataRef.current)) {
      return;
    }

    lastDataRef.current = data;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        await onSave(data);
        setStatus('saved');
        setLastSaved(new Date());
        
        // Reset to idle after a delay
        setTimeout(() => setStatus('idle'), 2000);
      } catch {
        setStatus('error');
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, onSave, delay, enabled]);

  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setStatus('saving');
    try {
      await onSave(data);
      setStatus('saved');
      setLastSaved(new Date());
    } catch {
      setStatus('error');
    }
  }, [data, onSave]);

  return {
    status,
    lastSaved,
    saveNow,
  };
}
