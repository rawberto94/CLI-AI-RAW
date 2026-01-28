'use client';

/**
 * Modal Dialog Component
 * Accessible modal system with animations
 */

import React, { useEffect, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ModalContextType {
  close: () => void;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

// ============================================================================
// Context
// ============================================================================

const ModalContext = createContext<ModalContextType | null>(null);

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('Modal components must be used within Modal');
  }
  return context;
}

// ============================================================================
// Size Classes
// ============================================================================

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-[90vw] max-h-[90vh]',
};

// ============================================================================
// Main Modal Component
// ============================================================================

export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, closeOnEscape]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalContext.Provider value={{ close: onClose }}>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            {/* Modal */}
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-900/50 overflow-hidden',
                sizeClasses[size],
                className
              )}
              role="dialog"
              aria-modal="true"
            >
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {children}
            </motion.div>
          </motion.div>
        </ModalContext.Provider>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Modal Parts
// ============================================================================

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn('px-6 pt-6 pb-4', className)}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{children}</h2>
    </div>
  );
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('px-6 py-4 overflow-y-auto', className)}>{children}</div>
  );
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Alert Modal
// ============================================================================

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  type?: AlertType;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm?: () => void;
}

const alertConfig: Record<AlertType, { icon: LucideIcon; color: string; bgColor: string }> = {
  info: { icon: Info, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/50' },
  success: { icon: CheckCircle, color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/50' },
  warning: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/50' },
  error: { icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/50' },
};

export function AlertModal({
  isOpen,
  onClose,
  type = 'info',
  title,
  message,
  confirmLabel = 'OK',
  onConfirm,
}: AlertModalProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="p-6 text-center">
        <div
          className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
            config.bgColor
          )}
        >
          <Icon className={cn('w-8 h-8', config.color)} />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
        <button
          onClick={handleConfirm}
          className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ============================================================================
// Drawer (Side Panel)
// ============================================================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
  className?: string;
}

const drawerSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function Drawer({
  isOpen,
  onClose,
  children,
  side = 'right',
  size = 'md',
  title,
  className,
}: DrawerProps) {
  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const slideDirection = side === 'right' ? { x: '100%' } : { x: '-100%' };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={slideDirection}
            animate={{ x: 0 }}
            exit={slideDirection}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'fixed top-0 bottom-0 z-50 w-full bg-white dark:bg-slate-800 shadow-2xl dark:shadow-slate-900/50 flex flex-col',
              side === 'right' ? 'right-0' : 'left-0',
              drawerSizes[size],
              className
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              {title && (
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
              )}
              <button
                onClick={onClose}
                className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors ml-auto"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
