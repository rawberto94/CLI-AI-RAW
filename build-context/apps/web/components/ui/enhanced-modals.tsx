'use client';

/**
 * Enhanced Modal & Dialog Components
 * Beautiful modals, sheets, drawers, and confirmation dialogs
 */

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, HelpCircle, Trash2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Modal Context for Stacking
// ============================================

interface ModalContextValue {
  zIndex: number;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue>({ zIndex: 50, closeModal: () => {} });

// ============================================
// Base Modal
// ============================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  preventScroll?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

export function Modal({
  isOpen,
  onClose,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  preventScroll = true,
  className,
}: ModalProps) {
  useEffect(() => {
    if (preventScroll && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, preventScroll]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, closeOnEscape, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalContext.Provider key="open" value={{ zIndex: 50, closeModal: onClose }}>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeOnOverlayClick ? onClose : undefined}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={cn(
                'relative w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl',
                sizeStyles[size],
                className
              )}
            >
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {children}
            </motion.div>
          </div>
        </ModalContext.Provider>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Modal Parts
// ============================================

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalHeader({ children, className }: ModalHeaderProps) {
  return (
    <div className={cn('px-6 pt-6 pb-4', className)}>
      {children}
    </div>
  );
}

interface ModalTitleProps {
  children: React.ReactNode;
  description?: string;
  className?: string;
}

export function ModalTitle({ children, description, className }: ModalTitleProps) {
  return (
    <div className={className}>
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
        {children}
      </h2>
      {description && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className }: ModalBodyProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn(
      'px-6 py-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl flex items-center justify-end gap-3',
      className
    )}>
      {children}
    </div>
  );
}

// ============================================
// Alert Dialog
// ============================================

type AlertType = 'info' | 'success' | 'warning' | 'error' | 'confirm';

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  type?: AlertType;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

const alertIcons: Record<AlertType, React.ReactNode> = {
  info: <Info className="w-6 h-6 text-violet-500" />,
  success: <CheckCircle className="w-6 h-6 text-green-500" />,
  warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
  error: <AlertCircle className="w-6 h-6 text-red-500" />,
  confirm: <HelpCircle className="w-6 h-6 text-violet-500" />,
};

const alertColors: Record<AlertType, string> = {
  info: 'bg-violet-100 dark:bg-violet-900/30',
  success: 'bg-green-100 dark:bg-green-900/30',
  warning: 'bg-amber-100 dark:bg-amber-900/30',
  error: 'bg-red-100 dark:bg-red-900/30',
  confirm: 'bg-violet-100 dark:bg-violet-900/30',
};

export function AlertDialog({
  isOpen,
  onClose,
  onConfirm,
  type = 'confirm',
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  isLoading = false,
}: AlertDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn('p-3 rounded-full', alertColors[type])}>
            {alertIcons[type]}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            {description && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2',
                isDestructive
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-violet-500 hover:bg-violet-600',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Delete Confirmation Dialog
// ============================================

interface DeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemName?: string;
  itemType?: string;
  isLoading?: boolean;
}

export function DeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = 'item',
  isLoading = false,
}: DeleteDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
            Delete {itemType}?
          </h3>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {itemName ? (
              <>Are you sure you want to delete <span className="font-medium text-slate-700 dark:text-slate-300">&quot;{itemName}&quot;</span>?</>
            ) : (
              <>Are you sure you want to delete this {itemType}?</>
            )}
            <br />
            This action cannot be undone.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================
// Bottom Sheet (Mobile-friendly)
// ============================================

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[];
  defaultSnapPoint?: number;
}

export function BottomSheet({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.5, 0.9],
  defaultSnapPoint = 0,
}: BottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(defaultSnapPoint);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50;
    
    if (info.velocity.y > 500 || info.offset.y > threshold) {
      // Swiped down
      if (currentSnap === 0) {
        onClose();
      } else {
        setCurrentSnap(Math.max(0, currentSnap - 1));
      }
    } else if (info.velocity.y < -500 || info.offset.y < -threshold) {
      // Swiped up
      setCurrentSnap(Math.min(snapPoints.length - 1, currentSnap + 1));
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentSnap(defaultSnapPoint);
    }
  }, [isOpen, defaultSnapPoint]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: `${(1 - snapPoints[currentSnap]) * 100}%` }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl"
            style={{ height: '90vh' }}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Title */}
            {title && (
              <div className="px-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {title}
                </h3>
              </div>
            )}

            {/* Content */}
            <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Slide-over / Drawer
// ============================================

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showOverlay?: boolean;
  footer?: React.ReactNode;
}

const drawerSizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-2xl',
};

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  description,
  position = 'right',
  size = 'md',
  showOverlay = true,
  footer,
}: DrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const slideFrom = position === 'left' ? '-100%' : '100%';

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="fixed inset-0 z-50 flex">
          {/* Overlay */}
          {showOverlay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60"
              onClick={onClose}
            />
          )}

          {/* Drawer */}
          <motion.div
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={cn(
              'absolute top-0 bottom-0 w-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col',
              position === 'left' ? 'left-0' : 'right-0',
              drawerSizes[size]
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                {title && (
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Image Preview Modal
// ============================================

interface ImagePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  src: string;
  alt?: string;
  title?: string;
}

export function ImagePreview({
  isOpen,
  onClose,
  src,
  alt = 'Preview',
  title,
}: ImagePreviewProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div key="open" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative max-w-5xl max-h-[90vh]"
          >
            <button
              onClick={onClose}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {title && (
              <h3 className="absolute -top-12 left-0 text-white font-medium">
                {title}
              </h3>
            )}

            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Full Page Modal (Takeover)
// ============================================

interface FullPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function FullPageModal({
  isOpen,
  onClose,
  children,
  title,
  subtitle,
  actions,
}: FullPageModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div key="open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col"
        >
          {/* Header */}
          <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                {title && (
                  <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Hook: useModal
// ============================================

export function useModal(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

// ============================================
// Hook: useConfirmation
// ============================================

interface ConfirmationOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: AlertType;
  isDestructive?: boolean;
}

export function useConfirmation() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    options: null,
    resolve: null,
  });

  const confirm = useCallback((options: ConfirmationOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ isOpen: true, options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, options: null, resolve: null });
  }, [state.resolve]);

  const ConfirmationDialog = useCallback(() => {
    if (!state.options) return null;

    return (
      <AlertDialog
        isOpen={state.isOpen}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        type={state.options.type}
        isDestructive={state.options.isDestructive}
      />
    );
  }, [state, handleConfirm, handleCancel]);

  return { confirm, ConfirmationDialog };
}

export default {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
  AlertDialog,
  DeleteDialog,
  BottomSheet,
  Drawer,
  ImagePreview,
  FullPageModal,
  useModal,
  useConfirmation,
};
