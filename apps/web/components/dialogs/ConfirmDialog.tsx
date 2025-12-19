'use client';

/**
 * Confirmation Dialog
 * Beautiful, accessible confirmation dialogs
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Trash2,
  LogOut,
  RefreshCw,
  Shield,
  Send,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

type ConfirmVariant = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: LucideIcon;
  destructive?: boolean;
  requireConfirmation?: string; // User must type this to confirm
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
}

// ============================================================================
// Presets
// ============================================================================

export const confirmPresets = {
  delete: (itemName?: string): ConfirmOptions => ({
    title: 'Delete permanently?',
    description: itemName 
      ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
      : 'Are you sure you want to delete this? This action cannot be undone.',
    confirmText: 'Delete',
    variant: 'danger',
    icon: Trash2,
    destructive: true,
  }),
  
  logout: (): ConfirmOptions => ({
    title: 'Sign out?',
    description: 'You will need to sign in again to access your account.',
    confirmText: 'Sign Out',
    variant: 'warning',
    icon: LogOut,
  }),
  
  discard: (): ConfirmOptions => ({
    title: 'Discard changes?',
    description: 'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
    confirmText: 'Discard',
    cancelText: 'Keep Editing',
    variant: 'warning',
    icon: AlertTriangle,
  }),
  
  publish: (): ConfirmOptions => ({
    title: 'Publish contract?',
    description: 'This will make the contract visible and send notifications to relevant parties.',
    confirmText: 'Publish',
    variant: 'success',
    icon: Send,
  }),
  
  reset: (): ConfirmOptions => ({
    title: 'Reset to defaults?',
    description: 'This will reset all settings to their default values.',
    confirmText: 'Reset',
    variant: 'warning',
    icon: RefreshCw,
  }),
  
  dangerousAction: (confirmation: string): ConfirmOptions => ({
    title: 'Confirm dangerous action',
    description: `Type "${confirmation}" to confirm this action.`,
    confirmText: 'Confirm',
    variant: 'danger',
    icon: Shield,
    destructive: true,
    requireConfirmation: confirmation,
  }),
};

// ============================================================================
// Styles
// ============================================================================

const VARIANT_STYLES: Record<ConfirmVariant, {
  iconBg: string;
  iconColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  danger: {
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonBg: 'bg-red-600 hover:bg-red-700',
    buttonHover: 'hover:bg-red-50',
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600 hover:bg-amber-700',
    buttonHover: 'hover:bg-amber-50',
  },
  info: {
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonBg: 'bg-blue-600 hover:bg-blue-700',
    buttonHover: 'hover:bg-blue-50',
  },
  success: {
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-700',
    buttonHover: 'hover:bg-emerald-50',
  },
};

// ============================================================================
// Dialog Component
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  options: ConfirmOptions | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ isOpen, options, onConfirm, onCancel }: ConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  
  if (!options) return null;
  
  const variant = options.variant || 'warning';
  const styles = VARIANT_STYLES[variant];
  const Icon = options.icon || AlertTriangle;
  
  const isConfirmDisabled = options.requireConfirmation 
    ? confirmInput !== options.requireConfirmation 
    : false;

  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm();
      setConfirmInput('');
    }
  };

  const handleCancel = () => {
    onCancel();
    setConfirmInput('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          
          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="fixed inset-x-4 top-[30%] max-w-md mx-auto z-50"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              {/* Content */}
              <div className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={cn('p-3 rounded-xl', styles.iconBg)}>
                    <Icon className={cn('w-6 h-6', styles.iconColor)} />
                  </div>
                  
                  {/* Text */}
                  <div className="flex-1 pt-1">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {options.title}
                    </h3>
                    {options.description && (
                      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                        {options.description}
                      </p>
                    )}
                    
                    {/* Confirmation Input */}
                    {options.requireConfirmation && (
                      <div className="mt-4">
                        <input
                          type="text"
                          value={confirmInput}
                          onChange={(e) => setConfirmInput(e.target.value)}
                          placeholder={`Type "${options.requireConfirmation}"`}
                          className={cn(
                            'w-full px-3 py-2 text-sm border rounded-lg',
                            'focus:outline-none focus:ring-2 focus:ring-offset-1',
                            confirmInput === options.requireConfirmation
                              ? 'border-emerald-300 focus:ring-emerald-500'
                              : 'border-slate-200 focus:ring-slate-400'
                          )}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={handleCancel}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-slate-700 rounded-lg',
                    'border border-slate-200 bg-white',
                    'hover:bg-slate-50 transition-colors'
                  )}
                >
                  {options.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isConfirmDisabled}
                  className={cn(
                    'px-4 py-2 text-sm font-medium text-white rounded-lg',
                    'transition-all duration-150',
                    styles.buttonBg,
                    isConfirmDisabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {options.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Provider
// ============================================================================

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);
    
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setIsOpen(false);
    resolvePromise?.(true);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolvePromise?.(false);
    setResolvePromise(null);
  }, [resolvePromise]);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmDialog
        isOpen={isOpen}
        options={options}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}
