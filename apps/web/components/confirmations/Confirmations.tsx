'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, Trash2, CheckCircle, AlertCircle, 
  Info, HelpCircle, X, Loader2 
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ConfirmationType = 'confirm' | 'delete' | 'warning' | 'info' | 'success';

interface ConfirmationOptions {
  type?: ConfirmationType;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger' | 'warning';
  icon?: React.ReactNode;
  loading?: boolean;
  inputConfirmation?: {
    label: string;
    value: string;
    caseSensitive?: boolean;
  };
}

interface ConfirmationContextValue {
  confirm: (options: ConfirmationOptions) => Promise<boolean>;
  alert: (options: Omit<ConfirmationOptions, 'cancelLabel'>) => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within ConfirmationProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

interface ConfirmationProviderProps {
  children: React.ReactNode;
}

export function ConfirmationProvider({ children }: ConfirmationProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setOptions(opts);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const alert = useCallback((opts: Omit<ConfirmationOptions, 'cancelLabel'>): Promise<void> => {
    return new Promise((resolve) => {
      setOptions({ ...opts, cancelLabel: undefined });
      setIsOpen(true);
      resolveRef.current = () => resolve();
    });
  }, []);

  const handleConfirm = async () => {
    if (options?.loading) {
      setIsLoading(true);
      // Simulate async operation
      await new Promise(r => setTimeout(r, 500));
      setIsLoading(false);
    }
    setIsOpen(false);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setIsOpen(false);
    resolveRef.current?.(false);
  };

  return (
    <ConfirmationContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmationDialog
        isOpen={isOpen}
        options={options}
        isLoading={isLoading}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmationContext.Provider>
  );
}

// ============================================================================
// Confirmation Dialog
// ============================================================================

interface ConfirmationDialogProps {
  isOpen: boolean;
  options: ConfirmationOptions | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationDialog({
  isOpen,
  options,
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('');
  
  const typeConfig = {
    confirm: {
      icon: <HelpCircle className="w-6 h-6 text-blue-500" />,
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    delete: {
      icon: <Trash2 className="w-6 h-6 text-red-500" />,
      bgColor: 'bg-red-100 dark:bg-red-900',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-yellow-500" />,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    },
    info: {
      icon: <Info className="w-6 h-6 text-blue-500" />,
      bgColor: 'bg-blue-100 dark:bg-blue-900',
    },
    success: {
      icon: <CheckCircle className="w-6 h-6 text-green-500" />,
      bgColor: 'bg-green-100 dark:bg-green-900',
    },
  };

  const config = typeConfig[options?.type || 'confirm'];

  const confirmButtonVariants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  };

  const isInputValid = () => {
    if (!options?.inputConfirmation) return true;
    const { value, caseSensitive } = options.inputConfirmation;
    if (caseSensitive) {
      return inputValue === value;
    }
    return inputValue.toLowerCase() === value.toLowerCase();
  };

  // Reset input when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && options && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${config.bgColor}`}>
                {options.icon || config.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {options.title}
                </h3>
                <div className="mt-2 text-gray-600 dark:text-gray-400">
                  {options.message}
                </div>
              </div>
              {options.cancelLabel && (
                <button
                  onClick={onCancel}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Input Confirmation */}
            {options.inputConfirmation && (
              <div className="mt-4">
                <label htmlFor="confirmationInput" className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {options.inputConfirmation.label}
                </label>
                <input
                  id="confirmationInput"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={options.inputConfirmation.value}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Type <span className="font-mono font-bold">{options.inputConfirmation.value}</span> to confirm
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              {options.cancelLabel && (
                <button
                  onClick={onCancel}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  {options.cancelLabel}
                </button>
              )}
              <button
                onClick={onConfirm}
                disabled={isLoading || !isInputValid()}
                className={`
                  flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors
                  flex items-center justify-center gap-2
                  ${confirmButtonVariants[options.confirmVariant || 'primary']}
                  ${(!isInputValid() || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Standalone Delete Confirmation
// ============================================================================

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemName: string;
  itemType?: string;
  requireTyping?: boolean;
}

export function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  requireTyping = false,
}: DeleteConfirmationProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canConfirm = !requireTyping || inputValue === itemName;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) setInputValue('');
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-full">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete {itemType}?
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete <strong>{itemName}</strong>? 
              All associated data will be permanently removed.
            </p>

            {requireTyping && (
              <div className="mb-4">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Type <strong>{itemName}</strong> to confirm
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm || isLoading}
                className={`
                  flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium
                  flex items-center justify-center gap-2
                  ${canConfirm && !isLoading ? 'hover:bg-red-700' : 'opacity-50 cursor-not-allowed'}
                `}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Quick Confirm Button
// ============================================================================

interface QuickConfirmButtonProps {
  children: React.ReactNode;
  onConfirm: () => void | Promise<void>;
  confirmMessage?: string;
  variant?: 'danger' | 'warning' | 'primary';
  className?: string;
}

export function QuickConfirmButton({
  children,
  onConfirm,
  confirmMessage = 'Are you sure?',
  variant = 'danger',
  className = '',
}: QuickConfirmButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleClick = () => {
    if (!isConfirming) {
      setIsConfirming(true);
      timeoutRef.current = setTimeout(() => setIsConfirming(false), 3000);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
      setIsConfirming(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  };

  const variantClasses = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  };

  return (
    <AnimatePresence mode="wait">
      {isConfirming ? (
        <motion.div
          key="confirm"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-2"
        >
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {confirmMessage}
          </span>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${variantClasses[variant]} ${className}`}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes'}
          </button>
          <button
            onClick={() => setIsConfirming(false)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            No
          </button>
        </motion.div>
      ) : (
        <motion.button
          key="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={handleClick}
          className={className}
        >
          {children}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Unsaved Changes Warning
// ============================================================================

interface UnsavedChangesWarningProps {
  hasChanges: boolean;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onContinue?: () => void;
}

export function useUnsavedChangesWarning({
  hasChanges,
  onSave,
  onDiscard,
  onContinue,
}: UnsavedChangesWarningProps) {
  const [showWarning, setShowWarning] = useState(false);

  // Browser beforeunload
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const checkUnsavedChanges = useCallback(() => {
    if (hasChanges) {
      setShowWarning(true);
      return false;
    }
    return true;
  }, [hasChanges]);

  const WarningDialog = () => (
    <AnimatePresence>
      {showWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowWarning(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Unsaved Changes
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You have unsaved changes. What would you like to do?
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  await onSave();
                  setShowWarning(false);
                  onContinue?.();
                }}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  onDiscard();
                  setShowWarning(false);
                  onContinue?.();
                }}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Discard Changes
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="w-full px-4 py-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Continue Editing
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return {
    checkUnsavedChanges,
    WarningDialog,
  };
}
